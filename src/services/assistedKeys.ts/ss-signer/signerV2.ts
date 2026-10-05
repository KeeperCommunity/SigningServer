import * as bitcoinJS from "bitcoinjs-lib";
import twoFactorAuthentication from "../../../utilities/twoFA";
import bitHyveWallet from "../../../wallet/bithyve";
import dbV2 from "../../../databases/dbV2";
import {
  SignerException,
  SignerPolicy,
  SignerRestriction,
  VerificationType,
} from "../../../interfaces/signer";
import { WalletCredsVersion } from "../../../interfaces/wallet";

export class SignerV2 {
  private twoFAAuth: twoFactorAuthentication;

  constructor() {
    this.twoFAAuth = new twoFactorAuthentication();
  }

  private getSigner = async (vaultId: string, appId: string) => {
    let doc;
    const signerV2Model: any = dbV2.getSignerV2Model();
    if (vaultId) [doc] = await signerV2Model.find({ vaultId });
    if (!doc && appId) [doc] = await signerV2Model.find({ appId }); // for versions <= 1.0.1, signer is registered against appId

    if (!doc) throw new Error(`Singer not found against vault: ${vaultId}`);
    return doc;
  };

  public setupSigner = async (
    vaultId: string,
    appId: string,
    policy: SignerPolicy
  ) => {
    let doc;
    const signerV2Model: any = dbV2.getSignerV2Model();

    if (vaultId) [doc] = await signerV2Model.find({ vaultId });
    if (!doc && appId) [doc] = await signerV2Model.find({ appId });

    if (doc) throw new Error(`Signer already exists for vault ${vaultId}`);

    switch (policy.verification.method) {
      case VerificationType.TWO_FA:
        const { secret } = this.twoFAAuth.generator();
        policy.verification.verifier = secret;
        break;

      default:
        const res = this.twoFAAuth.generator();
        policy.verification.verifier = res.secret;
    }

    const { xpub, xIndex, masterFingerprint, derivationPath } =
      bitHyveWallet.getRandomXpub({ version: WalletCredsVersion.V2, isBIP85: false });

    const signerInstance = new signerV2Model({
      vaultId,
      appId: !vaultId ? appId : null, // for versions <= 1.0.1, signer is registered against appId
      xIndex,
      policy,
    });

    await signerInstance.save((err) => {
      if (err) {
        throw new Error(`Error occured while saving to database: ${err}`);
      }
    });

    return {
      setupSuccessful: true,
      setupData: {
        verification: policy.verification,
        bhXpub: xpub,
        masterFingerprint,
        derivationPath,
      },
    };
  };

  public validate = (
    policy: SignerPolicy,
    verificationToken
  ): { isValid: boolean } => {
    const isValid = this.twoFAAuth.validator(
      policy.verification.verifier,
      verificationToken
    );
    return { isValid };
  };

  public validateSignerSetup = async (
    vaultId: string,
    appId: string,
    verificationToken
  ) => {
    const doc = await this.getSigner(vaultId, appId);

    const policy: SignerPolicy = doc.policy;
    if (policy.verification.method === VerificationType.TWO_FA)
      return this.validate(policy, verificationToken);
    else throw new Error("Verification method not supported");
  };

  public fetchSignerSetup = async (
    vaultId: string,
    appId: string,
    verificationToken
  ): Promise<{
    isValid: boolean;
    xpub?: string;
    masterFingerprint?: string;
    derivationPath?: string;
    policy?: SignerPolicy;
  }> => {
    const doc = await this.getSigner(vaultId, appId);
    const policy: SignerPolicy = doc.policy;
    const { isValid } = this.validate(policy, verificationToken);
    if (!isValid) return { isValid };

    const xIndex = doc.xIndex;
    const { xpub, masterFingerprint, derivationPath } =
      bitHyveWallet.getRandomXpub({ xIndex, version: WalletCredsVersion.V2, isBIP85: false });

    return {
      isValid,
      xpub,
      masterFingerprint,
      derivationPath,
      policy,
    };
  };

  public updateSignerPolicy = async (
    vaultId: string,
    appId: string,
    updates: { restrictions?: SignerRestriction; exceptions?: SignerException }
  ) => {
    const doc = await this.getSigner(vaultId, appId);

    (doc.policy as SignerPolicy) = {
      ...doc.policy,
      restrictions: updates.restrictions
        ? updates.restrictions
        : doc.restrictions,
      exceptions: updates.exceptions ? updates.exceptions : doc.exceptions,
    };
    await doc.save((err) => {
      if (err)
        throw new Error(`Error occured while saving to database: ${err}`);
    });
    return {
      updated: true,
    };
  };

  public signPSBT = async (
    vaultId: string,
    appId: string,
    serializedPSBT: string,
    outgoing: number,
    verificationToken?: any
  ) => {
    const doc = await this.getSigner(vaultId, appId);
    const policy: SignerPolicy = doc.policy;

    const PSBT = bitcoinJS.Psbt.fromBase64(serializedPSBT);

    const { restrictions, exceptions } = policy;
    if (!restrictions.none) {
      // transaction needs to qualify the restrictions
      if (outgoing > restrictions.maxTransactionAmount)
        throw new Error(
          `Signing failed: exceeded max transaction amount (${restrictions.maxTransactionAmount})`
        );
    }

    let shouldValidate = true;
    // if (!exceptions.none) { // validation exception retired
    //   // can transaction be an exception?
    //   if (outgoing <= exceptions.transactionAmount) shouldValidate = false;
    // }

    if (shouldValidate) {
      // requires validation
      if (!verificationToken)
        throw new Error("Signing failed: validation token is invalid");

      const { isValid } = await this.validateSignerSetup(
        vaultId,
        appId,
        verificationToken
      );

      if (!isValid)
        throw new Error(
          "Signing failed: validation token is either invalid or has expired"
        );
    }

    const signedPSBT = bitHyveWallet.signPSBT(
      PSBT,
      doc.xIndex,
      doc.isBIP85 || false,
      false,
      WalletCredsVersion.V2
    );
    return signedPSBT.toBase64();
  };

  public checkSignerHealth = async (vaultId: string, appId: string) => {
    let isSignerAvailable = false;
    try {
      const doc = await this.getSigner(vaultId, appId);
      if (doc && doc.xIndex) isSignerAvailable = true;
    } catch (err) {}

    return { isSignerAvailable };
  };
}

export default new SignerV2();
