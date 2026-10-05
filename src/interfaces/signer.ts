export enum VerificationType {
  TWO_FA = "TWO_FA",
}

export enum CosignersMapUpdateAction {
  ADD = "ADD",
  REMOVE = "REMOVE",
}

export enum PermittedAction {
  SIGN_TRANSACTION = 'SIGN_TRANSACTION',
  // CANCEL_TRANSACTION = 'CANCEL_TRANSACTION',
  FETCH_SIGNER_SETUP = 'FETCH_SIGNER_SETUP',
}

export const DEFAULT_PERMITTED_ACTIONS = [PermittedAction.FETCH_SIGNER_SETUP]

export interface VerificationOption {
  id: string; 
  method: VerificationType;
  label?: string;
  verifier: string;
  permittedActions: PermittedAction[];
}

export interface SingerVerification {
  method: VerificationType; // primary verification method
  verifier: string;         // primary verifier
}

export interface SignerRestriction { // aka Signer's SpendingLimit
  none: Boolean;
  maxTransactionAmount?: number; // max amount for an outgoing transaction
  timeWindow?: number; // time period in milliseconds (e.g., 7 days = 7 * 24 * 60 * 60 * 1000)
  // note: if timeWindow is present, maxTransactionAmount turns into the aggregate maximum amount allowed in that time period
}

export interface SignerException {
  none: Boolean;
  transactionAmount?: number; // max tx amount till no verification is needed
}

export interface SignerPolicy {
  verification: SingerVerification; // primary verification method
  restrictions: SignerRestriction;
  secondaryVerification?: VerificationOption[]; // secondary verification options
  signingDelay?: number; // delay in milliseconds
  backupDisabled?: boolean;
  exceptions?: SignerException; // exceptions are not available for new policy(time based spending limit)
}


export interface CosignersMapUpdate {
  cosignersId: string,
  signerId: string,
  action: CosignersMapUpdateAction
}

export interface DelayedTransaction {
  txid: string,
  serializedPSBT: string,
  signerId: string,
  outgoing: number;
  verificationToken: string;
  timestamp: number;
  delayUntil: number;
  FCM: string;
  signedPSBT?: string;
}
export interface DelayedPolicyUpdate {
  policyId: string;
  signerId: string;
  policyUpdates: { 
    restrictions: SignerRestriction;
    signingDelay: number;  
  };
  verificationToken: string;
  timestamp: number;
  delayUntil: number;
  FCM?: string;
  isApplied?: boolean;
}