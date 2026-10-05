import * as bip39 from "bip39";
import { Network } from "bitcoinjs-lib";
import * as bitcoinJS from "bitcoinjs-lib";
import config from "../config";
import {
  BIP48ScriptTypes,
  DerivationPurpose,
  WalletCredsVersion,
} from "../interfaces/wallet";
import { fetchSecrets } from "../utilities/secretManager";
import BIP32Factory, { BIP32Interface } from "bip32";
import * as ecc from "tiny-secp256k1";
import crypto from "crypto";
import BIP85 from "./BIP85";
const bip32 = BIP32Factory(ecc);

export const BIP85_CHILD_XINDEX = 0;

class BitHyveWallet {
  public network: Network;
  private walletCreds = {};

  constructor() {
    this.network = config.NETWORK;
    this.initializeWalletCreds();
  }

  public deriveWalletCreds = (
    mnemonic: string,
    inheritanceMnemonic: string
  ) => {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, this.network);

    const inheritanceSeed = bip39.mnemonicToSeedSync(inheritanceMnemonic);
    const inheritanceRoot = bip32.fromSeed(inheritanceSeed, this.network);

    return {
      mnemonic,
      seed,
      root,
      inheritanceMnemonic,
      inheritanceSeed,
      inheritanceRoot,
    };
  };

  public initializeWalletCreds = async () => {
    for (const version of [WalletCredsVersion.V2, WalletCredsVersion.V3]) {
      const mnemonicId = config.MNEMONIC_IDENTIFIERS[version];
      const inheritanceMnemonicId =
        config.INHERITANCE_MNEMONIC_IDENTIFIERS[version];

      const [mnemonicResponse, inheritanceMnemonicResponse] =
        await fetchSecrets([mnemonicId, inheritanceMnemonicId]);

      this.walletCreds[version] = this.deriveWalletCreds(
        mnemonicResponse[mnemonicId],
        inheritanceMnemonicResponse[inheritanceMnemonicId]
      );
    }
  };

  public getWalletCreds = (
    inheritance: boolean,
    version: WalletCredsVersion
  ) => {
    if (this.walletCreds[version] === undefined)
      throw new Error(`Failed to find wallet creds ${version}`);

    if (inheritance) {
      // case: inheritance key server signer creds
      return {
        mnemonic: this.walletCreds[version].inheritanceMnemonic,
        seed: this.walletCreds[version].inheritanceSeed,
        root: this.walletCreds[version].inheritanceRoot,
      };
    } else {
      // case: signing server signer creds
      return {
        mnemonic: this.walletCreds[version].mnemonic,
        seed: this.walletCreds[version].seed,
        root: this.walletCreds[version].root,
      };
    }
  };

  public getAddress = (keyPair): string =>
    bitcoinJS.payments.p2sh({
      redeem: bitcoinJS.payments.p2wpkh({
        pubkey: keyPair.publicKey,
        network: this.network,
      }),
      network: this.network,
    }).address;

  public getFingerprintFromNode = (node: BIP32Interface) => {
    let fingerprintHex = node.fingerprint.toString("hex");
    while (fingerprintHex.length < 8) fingerprintHex = "0" + fingerprintHex;
    return fingerprintHex.toUpperCase();
  };

  public getFingerprintFromExtendedKey = (
    extendedKey: string,
    network: bitcoinJS.networks.Network
  ) => {
    const node = bip32.fromBase58(extendedKey, network);
    return this.getFingerprintFromNode(node);
  };

  public getFingerprintFromSeed = (seed: Buffer) => {
    const root = bip32.fromSeed(seed);
    return this.getFingerprintFromNode(root);
  };

  public getDerivationPath = (
    accountNumber: number,
    purpose: DerivationPurpose = DerivationPurpose.BIP48,
    scriptType: BIP48ScriptTypes = BIP48ScriptTypes.NATIVE_SEGWIT
  ): string => {
    const isTestnet = this.network === bitcoinJS.networks.testnet ? 1 : 0;
    const scriptNum = scriptType === BIP48ScriptTypes.NATIVE_SEGWIT ? 2 : 1;
    return `m/${purpose}'/${isTestnet}'/${accountNumber}'/${scriptNum}'`;
  };

  public getBIP85ChildFromParent = (inheritance: boolean, version: WalletCredsVersion, childIndex: number) => {
    const { root: parentRoot } = this.getWalletCreds(inheritance, version);

    const bip85Config = BIP85.generateBIP85Configuration(childIndex);
    const entropy = BIP85.bip39RootToEntropy(
      bip85Config.derivationPath,
      parentRoot
    );
    const childMnemonic = BIP85.entropyToBIP39(entropy, bip85Config.words);
    return childMnemonic
  }

  public getBIP85ChildRootFromParent = (
    parentRoot: BIP32Interface,
    index: number
  ) => {
    const bip85Config = BIP85.generateBIP85Configuration(index);
    const entropy = BIP85.bip39RootToEntropy(
      bip85Config.derivationPath,
      parentRoot
    );
    const childMnemonic = BIP85.entropyToBIP39(entropy, bip85Config.words);
    const childSeed = bip39.mnemonicToSeedSync(childMnemonic);
    const childRoot = bip32.fromSeed(childSeed, this.network);
    return childRoot;
  };

  public deriveAssistedKeyAssetsFromWallet = (
    root: BIP32Interface,
    xIndex: number,
    isBIP85: Boolean
  ) => {
    const derivationPath = this.getDerivationPath(xIndex);
    const randomXpriv = root.derivePath(derivationPath);
    const xpub = randomXpriv.neutered().toBase58();

    // generate fingerprints
    const xfp = this.getFingerprintFromExtendedKey(xpub, this.network);
    let masterFingerprint;
    if (isBIP85) {
      masterFingerprint = this.getFingerprintFromNode(root);
    } else {
      masterFingerprint = xfp; // for Assisted Keys, xfp is being sent as the mfp
      // (resolves multiple assisted keys issue and fingerprint uniqueness issue for IKS legal doc)
    }

    return {
      xfp,
      xpub,
      xIndex,
      masterFingerprint,
      derivationPath,
    };
  };

  public getRandomXpub = ({
    xIndex,
    inheritance = false,
    version,
    isBIP85,
  }: {
    xIndex?: number;
    inheritance?: boolean;
    version: WalletCredsVersion;
    isBIP85: boolean;
  }) => {
    if (!xIndex) xIndex = (crypto as any).randomInt(10 ** 9); // bip39RootToEntropy can handle upto UInt31, throws error for UInt32 and beyond
    const { root } = this.getWalletCreds(inheritance, version);

    if (isBIP85) {
      const childRoot = this.getBIP85ChildRootFromParent(root, xIndex);
      return {
        ...this.deriveAssistedKeyAssetsFromWallet(
          childRoot,
          BIP85_CHILD_XINDEX,
          isBIP85
        ),
        xIndex, // returns the BIP-85 index for storage
      };
    } else {
      return this.deriveAssistedKeyAssetsFromWallet(root, xIndex, isBIP85);
    }
  };

  public getKeyPairFromSubPath = (
    xpriv: BIP32Interface,
    subPath: number[],
  ) => {
    let keyPair = xpriv;
    subPath.forEach((index) => {
      keyPair = keyPair.derive(index);
    });
    return keyPair;
  };

  public signPSBT = (
    psbt: bitcoinJS.Psbt,
    xIndex: number,
    isBIP85: boolean,
    inheritance: boolean,
    version: WalletCredsVersion
  ): any => {
    let vin = 0;
    const { root } = this.getWalletCreds(inheritance, version);

    let signerMasterFingerprint: string;
    let xpriv: BIP32Interface;
    if (isBIP85) {
      // key-pair derivation for Assisted Keys+
      const bip85ChildIndex = xIndex;
      const childRoot = this.getBIP85ChildRootFromParent(root, bip85ChildIndex);
      const derivationPath = this.getDerivationPath(BIP85_CHILD_XINDEX);
      xpriv = childRoot.derivePath(derivationPath);
      signerMasterFingerprint = this.getFingerprintFromNode(childRoot);
    } else {
      // key-pair derivation for Assisted Keys
      const derivationPath = this.getDerivationPath(xIndex);
      xpriv = root.derivePath(derivationPath);
      signerMasterFingerprint = this.getFingerprintFromExtendedKey(xpriv.neutered().toBase58(), this.network);
    }

    for (let input of psbt.data.inputs) {
      const subPaths = []
      for (let { masterFingerprint, path } of input.bip32Derivation) {
        if (masterFingerprint.toString('hex').toUpperCase() === signerMasterFingerprint) {
          const pathElements = path.split('/');
          const chainIndex = parseInt(pathElements[pathElements.length - 2], 10);
          const childIndex = parseInt(pathElements[pathElements.length - 1], 10);
          const subPath = [chainIndex, childIndex];
          subPaths.push(subPath);
        }
      }
      if(subPaths.length === 0) throw new Error("Signing err: Failed to find signer's subpath in PSBT");

      subPaths.forEach((subPath) => {
        const keyPair = this.getKeyPairFromSubPath(
          xpriv,
          subPath,
        );
        psbt.signInput(vin, keyPair);
      })

      vin += 1;
    }

    return psbt;
  };
}

export default new BitHyveWallet();
