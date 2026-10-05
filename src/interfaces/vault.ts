export interface KeyInfo {
    identifier: string;
    descriptor: string;
    uniqueKeyIdentifier?: string;
}

export interface KeyInfoMap {
    [uniqueIdentifier: string]: string; // maps unique key identifiers to unique descriptors
}

export interface Path {
    id: number;
    keys: KeyInfo[];
    threshold: number;
}

export interface Phase {
    id: number;
    timelock: number;
    paths: Path[];
    requiredPaths: number; // Number of paths required to satisfy the phase's threshold
    probability?: number; // relative probability of the phase being executed
    // Note: probability difference between phases needs to be of a certain threshold for script optimization by the compiler. For ex(MS-IK): or(4@POL1, 1@POL2) -> optimization while or(3@POL1, 1@POL2) -> no optimization
}

export enum MiniscriptTypes {
    ASSISTED = 'ASSISTED',
    TIMELOCKED = 'TIMELOCKED',
    INHERITANCE = 'INHERITANCE',
    EMERGENCY = 'EMERGENCY',
}

export interface MiniscriptElements {
    keysInfo: KeyInfo[]; // identifier and key descriptor
    timelocks: number[]; // timelocks
    phases: Phase[]; // structure for generating miniscript policy
    signerFingerprints: { [identifier: string]: string }; // miniscript signer key_identifier <> MFP
}

export interface MiniscriptScheme {
    miniscriptElements: MiniscriptElements;
    keyInfoMap: KeyInfoMap;
    miniscriptPolicy: string; // miniscript policy
    miniscript: string; // miniscript
    usedMiniscriptTypes: MiniscriptTypes[];
}

export enum MultisigScriptType {
    DEFAULT_MULTISIG = 'DEFAULT_MULTISIG',
    MINISCRIPT_MULTISIG = 'MINISCRIPT_MULTISIG',
}

export type RegisteredVaultInfo = {
    vaultId: string;
    registered: boolean;
    registrationInfo?: string;
    hmac?: string;
};

export interface VaultScheme {
    m: number; // threshold number of signatures required
    n: number; // total number of xpubs
    multisigScriptType?: MultisigScriptType; // multisig script type(allows for more complex and flexible vaults)
    miniscriptScheme?: MiniscriptScheme;
}

export interface VaultSigner {
    // Represents xpub(Extended Key) belonging to one of the Signers,
    // Rel: VaultSigner(Extended Key) could only belong to one Signer, and is an active part of a Vault(s)
    masterFingerprint: string;
    xpub: string;
    xpriv?: string;
    xfp: string;
    derivationPath: string;
    registeredVaults?: RegisteredVaultInfo[];
}