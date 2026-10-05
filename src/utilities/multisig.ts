import { MiniscriptScheme, MultisigScriptType, VaultScheme } from "../interfaces/vault";
import * as bitcoinJS from "bitcoinjs-lib";
import BIP32Factory from "bip32";
import * as ecc from "tiny-secp256k1";
import { generateBitcoinScript } from "./miniscript/miniscript";
import * as serverConfig from "../config"

const bip32 = BIP32Factory(ecc);

export enum BIP48ScriptTypes {
    WRAPPED_SEGWIT = 'WRAPPED_SEGWIT',
    NATIVE_SEGWIT = 'NATIVE_SEGWIT',
}

export interface MultisigConfig {
    multisigScriptType: MultisigScriptType;
    childIndex: number;
    internal: boolean;
    required?: number;
    miniscriptScheme?: MiniscriptScheme;
}

export const getFingerprintFromExtendedKey = (
    extendedKey: string,
    network: bitcoinJS.networks.Network
) => {
    const node = bip32.fromBase58(extendedKey, network);
    let fingerprintHex = node.fingerprint.toString("hex");
    while (fingerprintHex.length < 8) fingerprintHex = "0" + fingerprintHex;
    return fingerprintHex.toUpperCase();
};

const generateChildFromExtendedKey = (
    extendedKey: string,
    network: bitcoinJS.networks.Network,
    childIndex: number,
    internal: boolean,
    shouldNotDerive?: boolean
) => {
    const xKey = bip32.fromBase58(extendedKey, network);
    let childXKey;
    if (shouldNotDerive) childXKey = xKey.derive(childIndex);
    else childXKey = xKey.derive(internal ? 1 : 0).derive(childIndex);
    return childXKey.toBase58();
};

const generateCustomScript = (
    miniscriptScheme: MiniscriptScheme,
    isInternal: boolean,
    childIndex: number,
    network: bitcoinJS.networks.Network
): {
    script: Buffer;
    subPaths: {
        [xpub: string]: number[];
    };
    signerPubkeyMap: Map<string, Buffer>;
} => {
    const subPaths = {};
    const signerPubkeyMap = new Map<string, Buffer>();

    const { miniscript, miniscriptElements, keyInfoMap } = miniscriptScheme;
    const { timelocks } = miniscriptElements;

    // generate asm from miniscript
    // eslint-disable-next-line prefer-const
    let { asm, issane } = generateBitcoinScript(miniscript);
    if (!issane) throw new Error('ASM is not sane - incorrect miniscript');

    // generate public keys to replace the key identifiers
    const identifiersToPublicKey = {};
    for (const keyIdentifier in keyInfoMap) {
        const fragments = keyInfoMap[keyIdentifier].split('/');
        const multipathIndex = fragments[5];
        const [_, xpub] = fragments[4].split(']');
        const multipathFragments = multipathIndex.split(';');
        const externalChainIndex = multipathFragments[0].slice(1);
        const internalChainIndex = multipathFragments[1].slice(0, -1);
        const subPath = [
            parseInt(isInternal ? internalChainIndex : externalChainIndex, 10),
            childIndex,
        ];
        const xKey = bip32.fromBase58(xpub, network);
        const childXKey = xKey.derive(subPath[0]).derive(subPath[1]);
        identifiersToPublicKey[keyIdentifier] = childXKey.publicKey;
        subPaths[xpub + multipathIndex] = subPath;
        signerPubkeyMap.set(xpub + multipathIndex, childXKey.publicKey);
    }

    // replace identifiers in the asm with actual public keys
    for (const keyIdentifier in identifiersToPublicKey) {
        const publicKey = identifiersToPublicKey[keyIdentifier];
        asm = asm.replace(`<${keyIdentifier}>`, publicKey.toString('hex'));
        asm = asm.replace(
            `<HASH160(${keyIdentifier})>`,
            bitcoinJS.crypto.hash160(publicKey).toString('hex')
        );
    }

    // prepare and enrich the time locks
    for (const tl of timelocks) {
        const encodedTL = bitcoinJS.script.number.encode(tl).toString('hex');
        asm = asm.replace(`<${encodedTL}>`, encodedTL);
    }

    // Convert small integers to OP codes
    asm = asm
        .split(' ')
        .map((token) => {
            if (token.length <= 2) {
                // prevents the code from attempting to parse longer strings(like public keys) as integers
                const num = parseInt(token);
                if (!isNaN(num) && num >= 0 && num <= 16) {
                    return `OP_${num}`;
                }
            }
            return token;
        })
        .join(' ');

    const script = bitcoinJS.script.fromASM(asm);
    return { script, subPaths, signerPubkeyMap };
};

const deriveMultiSig = (
    xpubs: string[],
    multisigConfig: MultisigConfig,
    network: bitcoinJS.Network,
    scriptType: BIP48ScriptTypes = BIP48ScriptTypes.NATIVE_SEGWIT
): {
    p2wsh: bitcoinJS.payments.Payment;
    p2sh: bitcoinJS.payments.Payment | undefined;
    subPaths: { [xpub: string]: number[] };
    signerPubkeyMap: Map<string, Buffer>;
    orderPreservedPubkeys?: string[];
} => {
    if (multisigConfig.multisigScriptType === MultisigScriptType.DEFAULT_MULTISIG) {
        if (!multisigConfig.required) {
            throw new Error('Invalid multisig config');
        }

        const subPaths = {};
        const signerPubkeyMap = new Map<string, Buffer>();
        const { internal, childIndex } = multisigConfig;

        let orderPreservedPubkeys: string[] = []; // non-bip-67(original order)
        let pubkeys: Buffer[] = []; // bip-67 ordered

        xpubs.forEach(
            (xpub) => (subPaths[xpub] = [internal ? 1 : 0, childIndex]) // same for all xpubs in default multisig
        );

        // generating pubkeys to prepare multisig assets
        for (let i = 0; i < xpubs.length; i++) {
            const childExtendedKey = generateChildFromExtendedKey(
                xpubs[i],
                network,
                childIndex,
                internal
            );
            const xKey = bip32.fromBase58(childExtendedKey, network);
            orderPreservedPubkeys[i] = xKey.publicKey.toString('hex');
            pubkeys[i] = xKey.publicKey;
            signerPubkeyMap.set(xpubs[i], pubkeys[i]); // the order is currently preserved for pubkeys array(non bip-67)
        }
        pubkeys = pubkeys.sort((a, b) => (a.toString('hex') > b.toString('hex') ? 1 : -1)); // bip-67 compatible


        const p2ms = bitcoinJS.payments.p2ms({
            m: multisigConfig.required,
            pubkeys,
            network,
        });

        const p2wsh = bitcoinJS.payments.p2wsh({
            redeem: p2ms,
            network,
        });

        let p2sh;
        if (scriptType === BIP48ScriptTypes.WRAPPED_SEGWIT) {
            // wrap native segwit
            p2sh = bitcoinJS.payments.p2sh({
                redeem: p2wsh,
                network,
            });
        }

        return { p2wsh, p2sh, subPaths, signerPubkeyMap, orderPreservedPubkeys };
    } else if (multisigConfig.multisigScriptType === MultisigScriptType.MINISCRIPT_MULTISIG) {
        if (!multisigConfig.miniscriptScheme) {
            throw new Error('Invalid multisig config - miniscript scheme missing');
        }

        const { internal, childIndex } = multisigConfig;
        const { script, subPaths, signerPubkeyMap } = generateCustomScript(
            multisigConfig.miniscriptScheme,
            internal,
            childIndex,
            network
        );

        const p2wsh = bitcoinJS.payments.p2wsh({
            redeem: {
                output: script,
                network,
            },
        });

        let p2sh;
        if (scriptType === BIP48ScriptTypes.WRAPPED_SEGWIT) {
            // wrap native segwit
            p2sh = bitcoinJS.payments.p2sh({
                redeem: p2wsh,
                network,
            });
        }

        return { p2wsh, p2sh, subPaths, signerPubkeyMap };
    } else throw new Error('Invalid multisig type');
};

export const createMultiSig = (
    xpubs: string[],
    scheme: VaultScheme,
    childIndex: number,
    internal: boolean,
    scriptType: BIP48ScriptTypes = BIP48ScriptTypes.NATIVE_SEGWIT
): {
    p2wsh: bitcoinJS.payments.Payment;
    p2sh: bitcoinJS.payments.Payment;
    address: string;
    subPaths: { [xpub: string]: number[] };
    signerPubkeyMap: Map<string, Buffer>;
    orderPreservedPubkeys?: string[];
} => {
    let config: MultisigConfig;
    const multisigScriptType =
        scheme.multisigScriptType || MultisigScriptType.DEFAULT_MULTISIG;

    if (multisigScriptType === MultisigScriptType.DEFAULT_MULTISIG) {
        config = {
            multisigScriptType,
            required: scheme.m,
            childIndex,
            internal,
        };
    } else if (multisigScriptType === MultisigScriptType.MINISCRIPT_MULTISIG) {
        const { miniscriptScheme } = scheme;
        if (!miniscriptScheme) throw new Error('Miniscript scheme missing');
        config = {
            multisigScriptType,
            miniscriptScheme,
            childIndex,
            internal,
        };
    } else throw new Error('Unsupported multisig script type');

    const { p2wsh, p2sh, subPaths, signerPubkeyMap, orderPreservedPubkeys } =
        deriveMultiSig(xpubs, config, serverConfig.default.NETWORK, scriptType);
    const address = p2sh ? p2sh.address : p2wsh.address;

    return {
        p2wsh,
        p2sh,
        address,
        subPaths,
        signerPubkeyMap,
        orderPreservedPubkeys,
    };
};
