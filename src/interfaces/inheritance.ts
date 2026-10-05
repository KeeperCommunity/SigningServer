import { WalletCredsVersion } from "./wallet";

export interface InheritanceNotification {
  targets: string[];
}

export interface InheritanceAlert {
  emails?: string[];
}

export interface InheritanceConfiguration {
  id: string; // note: not available for InheritanceKey-V2
  m: number;
  n: number;
  descriptors: string[];
  bsms?: string;
}

export interface InheritancePolicy {
  notification: InheritanceNotification;
  alert?: InheritanceAlert;
}


export interface InheritanceKeyV2 {
  vaultId: string;
  xIndex: number;
  configuration?: InheritanceConfiguration;
  policy?: InheritancePolicy;
}

export interface InheritanceKeyRequestV2 {
  requestId: string;
  vaultId: string;
  arrivedAt: number;
  status: {
    isDeclined: boolean;
    isApproved: boolean;
  };
}

export interface EncryptedInheritancePolicy {
  notification: InheritanceNotification;
  alert?: string;
}

export interface InheritanceKeyV3 {
  id: string;
  xIndex: number;
  isBIP85?: boolean;
  configurations?: InheritanceConfiguration[];
  policy?: EncryptedInheritancePolicy;
  credsVersion?: WalletCredsVersion,
}

export interface InheritanceKeyRequestV3 {
  requestId: string;
  inheritanceKeyId: string;
  arrivedAt: number;
  type: InheritanceKeyRequestV3Types,
  status: {
    isDeclined: boolean;
    isApproved: boolean;
  };
}

export enum InheritanceKeyRequestV3Types {
  RECOVER_KEY = "RECOVER_KEY",
  ONE_TIME_BACKUP = "ONE_TIME_BACKUP",
  SIGN_TRANSACTION = "SIGN_TRANSACTION"
}

export enum IKSCosignersMapUpdateAction {
  ADD = "ADD",
  REMOVE = "REMOVE",
}
export interface IKSCosignersMapUpdate {
  cosignersId: string,
  inheritanceKeyId: string,
  action: IKSCosignersMapUpdateAction
}