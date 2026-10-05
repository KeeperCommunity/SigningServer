export enum DerivationPurpose {
  BIP44 = 44, // P2PKH: legacy, single-sig
  BIP48 = 48, // P2WSH & P2SH-P2WSH: native and wrapped segwit, multi-sig
  BIP49 = 49, // P2SH-P2WPKH: wrapped segwit, single-sg
  BIP84 = 84, // P2WPKH: native segwit, single-sig
}

export enum BIP48ScriptTypes {
  WRAPPED_SEGWIT = "WRAPPED_SEGWIT",
  NATIVE_SEGWIT = "NATIVE_SEGWIT",
}

export enum WalletCredsVersion {
  // Skipped V1, maintaining consistency w/ API versioning
  V2 = 'V2', // default version
  V3 = 'V3',
}

export interface BIP85Config {
  index: number;
  words: number;
  language: string;
  derivationPath: string;
}