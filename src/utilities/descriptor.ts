import config from "../config";
import { MiniscriptElements, MiniscriptScheme, MiniscriptTypes, MultisigScriptType, VaultSigner } from "../interfaces/vault";
import { VaultScheme } from "../interfaces/vault";
import { generateEnhancedVaultElements } from "./miniscript/default/EnhancedVault";
import { generateMiniscript } from "./miniscript/miniscript";
import { generateMiniscriptPolicy } from "./miniscript/policy-generator";
import { getFingerprintFromExtendedKey } from "./multisig";

export interface ParsedSignersDetails {
    xpub: string;
    masterFingerprint: string;
    path: string;
    isMultisig: Boolean;
}
export interface ParsedVauleText {
    signersDetails: ParsedSignersDetails[] | null;
    isMultisig: Boolean | null;
    scheme: VaultScheme;
    miniscriptElements?: MiniscriptElements;
}

const isAllowedScheme = (m, n) => {
    return m <= n;
};

function removeEmptyLines(data) {
    const lines = data.split('\n');
    const nonEmptyLines = lines.filter((line) => line.trim() !== '');
    const output = nonEmptyLines.join('\n');
    return output;
}

function isValidMasterFingerprint(masterFingerprint) {
    return /^[0-9a-fA-F]{8}$/.test(masterFingerprint);
}

function isValidDerivationPath(derivationPath) {
    return /^m(\/\d+'?)+$/.test(derivationPath);
}

function isValidXpub(xpub) {
    return typeof xpub === 'string' && xpub.length > 4;
}

const parseKeyExpression = (keyExpression) => {
    let masterFingerprint = '';
    let path = '';
    let xpub = '';

    // Case 1: If the keyExpression is enclosed in square brackets
    const bracketMatch = keyExpression.match(/\[([^\]]+)\](.*)/);
    if (bracketMatch) {
        const insideBracket = bracketMatch[1];
        masterFingerprint = insideBracket.substring(0, 8).toUpperCase();
        path = `m${insideBracket
            .substring(8)
            .replace(/(\d+)h/g, "$1'")
            .replace(/'/g, "'")}`;
        xpub = bracketMatch[2].replace(/[^\w\s]+$/, '').split(/[^\w]+/)[0];
    } else {
        // Case 2: If the keyExpression is not enclosed in square brackets
        const parts = keyExpression.split("'");
        masterFingerprint = parts[0].substring(0, 8).toUpperCase();
        path = `m${keyExpression.substring(8, keyExpression.lastIndexOf("'") + 1).replace(/'/g, "'")}`;
        xpub = keyExpression
            .substring(keyExpression.lastIndexOf("'") + 1)
            .replace(/[^\w\s]+$/, '')
            .split(/[^\w]+/)[0];
    }
    if (
        !isValidMasterFingerprint(masterFingerprint) ||
        !isValidDerivationPath(path) ||
        !isValidXpub(xpub)
    ) {
        return null; // At least one of the fields is invalid
    }

    return { masterFingerprint, path, xpub };
};

function extractStagesWithAfter(script: string): { stage: string; afterValue: number }[] {
    const stagePattern = /and_v\((.*?),after\((\d+)\)\)/g;
    const matches = [...script.matchAll(stagePattern)];

    return matches.map((match) => ({
        stage: match[1].trim(),
        afterValue: parseInt(match[2], 10),
    }));
}

function categorizeKeys(
    stages: { stage: string; afterValue: number }[],
    uniqueKeys: VaultSigner[],
    regularKeysFingerprints: string[],
    isOnlyInheritanceKeys: boolean
) {
    const keyRegex = /\[([A-F0-9]{8})[^\]]*\]/g;
    const emergencyPattern = /v:pkh\(\[([A-F0-9]{8})[^\]]*\]/g;

    let inheritanceKeys: { signer: VaultSigner; timelock: number }[] = [];
    let emergencyKeys: { signer: VaultSigner; timelock: number }[] = [];

    const processedInheritanceKeys = new Set<string>();

    stages.forEach(({ stage, afterValue }) => {
        const stageKeys = [...stage.matchAll(keyRegex)].map((match) => match[1]);
        const emergencyKeysInStage = [...stage.matchAll(emergencyPattern)].map((match) => match[1]);

        stageKeys.forEach((fingerprint) => {
            const isEmergency = emergencyKeysInStage.includes(fingerprint);
            const isRegular = regularKeysFingerprints.some((fp) => fp === fingerprint);
            const isAlreadyProcessed = processedInheritanceKeys.has(fingerprint);

            if (isEmergency) {
                const signer = uniqueKeys.find((key) => key.masterFingerprint === fingerprint);
                if (signer) {
                    if (isOnlyInheritanceKeys) {
                        inheritanceKeys.push({ signer, timelock: afterValue });
                    } else {
                        emergencyKeys.push({ signer, timelock: afterValue });
                    }
                }
            } else if (!isRegular && !isAlreadyProcessed) {
                const signer = uniqueKeys.find((key) => key.masterFingerprint === fingerprint);
                if (signer) {
                    inheritanceKeys.push({ signer, timelock: afterValue });
                    processedInheritanceKeys.add(fingerprint);
                }
            }
        });
    });

    return { inheritanceKeys, emergencyKeys };
}

  
function parseEnhancedVaultMiniscript(miniscript: string): {
    signers: VaultSigner[];
    inheritanceKeys: { signer: VaultSigner; timelock: number }[];
    emergencyKeys: { signer: VaultSigner; timelock: number }[];
    importedKeyUsageCounts: Record<string, number>;
} {
    // Remove wsh() wrapper and checksum
    const innerScript = miniscript.replace('wsh(', '').replace(/\)#.*$/, '');

    // Extract all key expressions with derivation path and path restrictions
    const keyRegex = /\[([A-F0-9]{8})(\/[0-9h'/]+)\]([a-zA-Z0-9]+)\/<(\d+);(\d+)>\//g;
    const matches = [...innerScript.matchAll(keyRegex)];

    // Track each occurrence to calculate importedKeyUsageCounts
    const keyOccurrences = matches.map((match) => ({
        masterFingerprint: match[1],
        derivationPath: 'm' + match[2],
        xpub: match[3],
        pathRestriction: `<${match[4]};${match[5]}>`,
        xfp: getFingerprintFromExtendedKey(
            match[3],
            config.NETWORK
        ),
    }));

    // Create unique signers list (without duplicates)
    const uniqueKeys: VaultSigner[] = Array.from(
        new Map(
            keyOccurrences.map((key) => [
                key.xpub,
                {
                    masterFingerprint: key.masterFingerprint,
                    derivationPath: key.derivationPath,
                    xpub: key.xpub,
                    xfp: key.xfp,
                },
            ])
        ).values()
    );

    const stages = extractStagesWithAfter(innerScript);
    // Extract all key expressions from the entire innerScript
    const allKeyMatches = [...innerScript.matchAll(keyRegex)];

    // Extract all key expressions from the stages
    const stageKeyMatches = stages.flatMap((stage) => [...stage.stage.matchAll(keyRegex)]);

    // Create a map to count occurrences of each key in the entire innerScript
    const allKeyCounts = new Map<string, number>();
    allKeyMatches.forEach((match) => {
        const key = match[0];
        allKeyCounts.set(key, (allKeyCounts.get(key) || 0) + 1);
    });

    // Create a map to count occurrences of each key in the stages
    const stageKeyCounts = new Map<string, number>();
    stageKeyMatches.forEach((match) => {
        const key = match[0];
        stageKeyCounts.set(key, (stageKeyCounts.get(key) || 0) + 1);
    });

    // Identify regular keys (keys that appear more in the entire innerScript than in the stages)
    const regularKeys = Array.from(allKeyCounts.entries())
        .filter(([key, count]) => count > (stageKeyCounts.get(key) || 0))
        .map(([key]) => key);

    const fingerprintRegex = /\[([A-Fa-f0-9]{8})/; // Adjusted regex

    const regularFingerprints = regularKeys
        .map((key) => {
            const match = key.match(fingerprintRegex);
            return match ? match[1] : null;
        })
        .filter((fingerprint) => fingerprint !== null);

    const { inheritanceKeys, emergencyKeys } = categorizeKeys(
        stages,
        uniqueKeys,
        regularFingerprints,
        uniqueKeys.length === keyOccurrences.length
    );

    // Derive importedKeyUsageCounts from occurrences

    const importedKeyUsageCounts: Record<string, number> = {};
    keyOccurrences.forEach((occurrence) => {
        const match = occurrence.pathRestriction.match(/<(\d+);/);
        if (match) {
            const index = parseInt(match[1], 10);
            if (index > 0) {
                const count = index / 2;
                if (
                    importedKeyUsageCounts[occurrence.masterFingerprint] === undefined ||
                    count < importedKeyUsageCounts[occurrence.masterFingerprint]
                ) {
                    importedKeyUsageCounts[occurrence.masterFingerprint] = count;
                }
            }
        }
    });

    // Second pass: if a fingerprint has a <0;1> occurrence, set its count to 0
    keyOccurrences.forEach((occurrence) => {
        const match = occurrence.pathRestriction.match(/<(\d+);/);
        if (match) {
            const index = parseInt(match[1], 10);
            if (index === 0) {
                delete importedKeyUsageCounts[occurrence.masterFingerprint];
            }
        }
    });

    return {
        signers: uniqueKeys.filter((key) => regularFingerprints.includes(key.masterFingerprint)),
        inheritanceKeys,
        emergencyKeys,
        importedKeyUsageCounts,
    };
}

export const generateMiniscriptScheme = (
    miniscriptElements: MiniscriptElements,
    miniscriptTypes: MiniscriptTypes[],
    existingMiniscriptScheme?: MiniscriptScheme,
    importedKeyUsageCounts?: Record<string, number>
  ): MiniscriptScheme => {
    const {
      miniscriptPhases,
      policy: miniscriptPolicy,
      keyInfoMap,
    } = generateMiniscriptPolicy(
      miniscriptElements,
      existingMiniscriptScheme,
      importedKeyUsageCounts
    );
  
    const { miniscript } = generateMiniscript(miniscriptPolicy);
    const miniscriptScheme: MiniscriptScheme = {
      miniscriptElements: {
        ...miniscriptElements,
        phases: miniscriptPhases, // w/ unique key identifiers
      },
      keyInfoMap,
      miniscriptPolicy,
      miniscript,
      usedMiniscriptTypes: miniscriptTypes,
    };
  
    return miniscriptScheme;
  };

export const parseDescriptor = (secret: string) => {
    let config;
    if (secret.includes('wpkh(')) {
        config = { descriptor: secret, label: 'Singlesig vault' };

        const descriptorIndex = config.descriptor.indexOf('wpkh(');
        const hasSquareBrackets = config.descriptor[descriptorIndex + 3] === '[';
        const start = descriptorIndex + (hasSquareBrackets ? 6 : 5);
        const keyExpressions = config.descriptor
            .substring(start)
            .split(',')
            .map((expression) => expression.trim());

        const signersDetailsList = keyExpressions.map((expression) => parseKeyExpression(expression));
        const parsedResponse: ParsedVauleText = {
            signersDetails: signersDetailsList,
            isMultisig: false,
            scheme: {
                m: 1,
                n: 1,
            },
        };
        return parsedResponse;
    }
    if (!config && secret.indexOf('sortedmulti(')) {
        config = { descriptor: secret, label: 'Multisig vault' };
    }
    if (secret.indexOf('sortedmulti(') !== -1 && config.descriptor) {
        if (config.descriptor.includes('sh(wsh(')) {
            throw Error('Unsuportted Script type');
        }

        const descriptorIndex = config.descriptor.indexOf('sortedmulti(');
        const hasSquareBrackets = config.descriptor[descriptorIndex + 10] === '[';
        const start = descriptorIndex + (hasSquareBrackets ? 13 : 12);
        const keyExpressions = config.descriptor
            .substring(start)
            .split(',')
            .map((expression) => expression.trim());

        const signersDetailsList = keyExpressions
            .map((expression) => parseKeyExpression(expression))
            .filter((details) => details !== null);

        const m = parseInt(keyExpressions.splice(0, 1)[0]);
        const n = signersDetailsList.length;
        if (!isAllowedScheme(m, n)) {
            throw Error('Unsupported schemes');
        }
        const scheme: VaultScheme = {
            m,
            n,
        };

        const parsedResponse: ParsedVauleText = {
            signersDetails: signersDetailsList,
            isMultisig: true,
            scheme,
        };
        return parsedResponse;
    }
    if (secret.includes('Derivation')) {
        const text = removeEmptyLines(secret);
        const lines = text.split('\n');
        const signersDetailsList = [];
        let scheme;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('Policy')) {
                const [m, n] = line.split('Policy:')[1].split('of');
                scheme = { m: parseInt(m), n: parseInt(n) };
                if (!isAllowedScheme(m, n)) {
                    throw Error('Unsupported scheme');
                }
            }
            if (line.startsWith('Derivation:')) {
                const path = line.split(':')[1].trim();
                const masterFingerprintLine = lines[i + 1].trim();
                const masterFingerprint = masterFingerprintLine.split(':')[0].trim();
                const xpub = lines[i + 1].split(':')[1].trim();
                signersDetailsList.push({ xpub, masterFingerprint: masterFingerprint.toUpperCase(), path });
            }
        }

        const parsedResponse: ParsedVauleText = {
            signersDetails: signersDetailsList,
            isMultisig: scheme.n !== 1,
            scheme,
        };
        return parsedResponse;
    }
    if (secret.includes('after(')) {
        const { signers, inheritanceKeys, emergencyKeys, importedKeyUsageCounts } =
            parseEnhancedVaultMiniscript(secret);
        const multiMatch = secret.match(/thresh\((\d+),/);
        const m = multiMatch ? parseInt(multiMatch[1]) : 1;

        const miniscriptElements = generateEnhancedVaultElements(
            signers,
            inheritanceKeys,
            emergencyKeys,
            { m, n: signers.length }
        );

        const miniscriptScheme = generateMiniscriptScheme(
            miniscriptElements,
            inheritanceKeys.length || emergencyKeys.length
                ? [
                    ...(inheritanceKeys.length ? [MiniscriptTypes.INHERITANCE] : []),
                    ...(emergencyKeys.length ? [MiniscriptTypes.EMERGENCY] : []),
                ]
                : [],
            null,
            importedKeyUsageCounts
        );

        // Verify the miniscript generated matches the input
        const { miniscript, keyInfoMap } = miniscriptScheme;
        let walletPolicyDescriptor = miniscript;
        for (const keyId in keyInfoMap) {
            walletPolicyDescriptor = walletPolicyDescriptor.replace(`(${keyId}`, `(${keyInfoMap[keyId]}`);
            walletPolicyDescriptor = walletPolicyDescriptor.replace(`,${keyId}`, `,${keyInfoMap[keyId]}`);
        }
        const desc = `wsh(${walletPolicyDescriptor})`;
        if (secret.includes('#')) {
            secret = secret.replace(/#.*$/, '');
        }
        if (desc !== secret) {
            throw Error('Unsupported Miniscript configuration detected!');
        }

        const parsedResponse: ParsedVauleText = {
            signersDetails: [
                ...signers,
                ...inheritanceKeys.map((ik) => ik.signer),
                ...emergencyKeys
                    .filter(
                        (ek) => !signers.map((s) => s.masterFingerprint).includes(ek.signer.masterFingerprint)
                    )
                    .map((ek) => ek.signer),
            ]
                .filter(Boolean)
                .map((key) => ({
                    xpub: key.xpub,
                    masterFingerprint: key.masterFingerprint,
                    path: key.derivationPath,
                    isMultisig: true,
                })),
            isMultisig: true,
            scheme: {
                m,
                n: signers.length,
                multisigScriptType: MultisigScriptType.MINISCRIPT_MULTISIG,
                miniscriptScheme,
            },
            miniscriptElements,
        };
        return parsedResponse;
    }
    throw Error('Data provided does not match supported formats');
};