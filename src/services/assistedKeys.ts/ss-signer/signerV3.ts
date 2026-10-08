import * as bitcoinJS from "bitcoinjs-lib";
import twoFactorAuthentication from "../../../utilities/twoFA";
import bitHyveWallet, { BIP85_CHILD_XINDEX } from "../../../wallet/bithyve";
import dbV2 from "../../../databases/dbV2";
import {
  CosignersMapUpdate,
  CosignersMapUpdateAction,
  DelayedTransaction,
  DelayedPolicyUpdate,
  SignerException,
  SignerPolicy,
  SignerRestriction,
  SingerVerification,
  VerificationType,
  VerificationOption,
  PermittedAction,
  DEFAULT_PERMITTED_ACTIONS,
} from "../../../interfaces/signer";
import { WalletCredsVersion } from "../../../interfaces/wallet";
import { asymmetricEncrypt } from "../../../utilities/encryption";
import { NOTIFICATION_TYPE, pushServerKeyNotification } from "../../notifications/pushNotification";
import config from "../../../config";
import { hash256 } from "../../../utilities/encryption";
import { parseDescriptor } from "../../../utilities/descriptor";
import { createMultiSig, getFingerprintFromExtendedKey } from "../../../utilities/multisig";

export class SignerV3 {
  private twoFAAuth: twoFactorAuthentication;

  constructor() {
    this.twoFAAuth = new twoFactorAuthentication();
  }

  private getSigner = async (id: string) => {
    // getter: v3 signer
    const signerV3Model: any = dbV2.getSignerV3Model();

    let [doc] = await signerV3Model.find({ id });
    if (!doc) throw new Error(`Singer not found against vault: ${id}`);
    return doc;
  };

  private getSignerV2 = async (vaultId: string, appId: string) => {
    const signerV2Model: any = dbV2.getSignerV2Model();

    let doc;
    if (vaultId) [doc] = await signerV2Model.find({ vaultId });
    if (!doc && appId) [doc] = await signerV2Model.find({ appId }); // for versions <= 1.0.1, signer is registered against appId

    if (!doc) throw new Error(`Singer not found against vault: ${vaultId}`);
    return doc;
  };

  private hasNewSpendingPolicy = (policy: SignerPolicy): boolean => {
    let hasNewPolicy = false;
    const { restrictions, signingDelay, exceptions } = policy // exceptions are not available for new policy(time based spending limit)
    if ((restrictions.maxTransactionAmount && restrictions.timeWindow) || signingDelay || !exceptions) hasNewPolicy = true;
    return hasNewPolicy
  }

  private preparePolicyToSend = (policy: SignerPolicy) => {
    policy = (policy as any).toObject(); // convert mongoose document(w/ property hydration) to plain object
    const sanitizedPolicy = {
      ...policy,
      verification: {
        ...policy.verification,
        verifier: null, // Remove verifier from primary verification
      }
    };

    // If we have secondary verification options, sanitize them too
    if (sanitizedPolicy.secondaryVerification) {
      sanitizedPolicy.secondaryVerification = sanitizedPolicy.secondaryVerification.map(option => ({
        ...option,
        verifier: null // Remove verifier from each secondary option
      }));
    }

    return sanitizedPolicy;
  }

  private generateVerifier = (method: VerificationType) => {
    switch (method) {
      case VerificationType.TWO_FA:
        const { secret } = this.twoFAAuth.generator();
        return secret;

      default:
        throw new Error(`Verification method "${method}" is not supported`);
    }
  }

  private performVerification = (
    method: VerificationType,
    verifier: string,
    verificationToken: string,
  ): boolean => {

    switch (method) {
      case VerificationType.TWO_FA:
        return this.twoFAAuth.validator(
          verifier,
          verificationToken
        );

      default:
        throw new Error(`Verification method "${method}" is not supported`);
    }
  };

  private performPrimaryVerification = (policy: SignerPolicy, verificationToken: string) => {
    const { method, verifier } = policy.verification; // primary verification
    if (!method || !verifier) throw new Error("Missing primary verification's method/verifier")

    return {
      isValid: this.performVerification(method, verifier, verificationToken),
    }
  }

  private performSecondaryVerification = (option: VerificationOption, verificationToken: string) => {
    const { method, verifier } = option;
    if (!method || !verifier) throw new Error("Missing secondary verification's method/verifier")
    return {
      isValid: this.performVerification(method, verifier, verificationToken),
    }
  }

  private validateWithPrimaryOrSecondaryOptions = (policy: SignerPolicy, verificationToken: string, actionType: PermittedAction) => {
    let isPrimaryValid = false;
    try {
      const { isValid } = this.performPrimaryVerification(policy, verificationToken);
      if (isValid) isPrimaryValid = isValid;
    } catch (err) { }

    let isSecondaryValid = false;
    let validSecondaryOption: VerificationOption;

    if (!isPrimaryValid) {
      if (policy.secondaryVerification) {
        for (let option of policy.secondaryVerification) {
          try {
            const { isValid } = this.performSecondaryVerification(option, verificationToken);
            if (isValid) {
              isSecondaryValid = true;
              validSecondaryOption = option;
              break;
            }
          } catch (err) { }
        }
      }
    }

    let isActionPermitted = false;
    if (isPrimaryValid) isActionPermitted = true; // all actions are permitted under primary verification
    else {
      if (isSecondaryValid) {
        const permittedActions = validSecondaryOption.permittedActions || [] // only predefined permitted actions are allowed under secondary verification
        isActionPermitted = DEFAULT_PERMITTED_ACTIONS.includes(actionType) || permittedActions.includes(actionType);
      }
    }


    return { isValid: isPrimaryValid || isSecondaryValid, isPrimaryValid, isSecondaryValid, isActionPermitted, validSecondaryOption }
  }

  private async isWithinSpendingLimit(id: string, policy: SignerPolicy, amount: number): Promise<boolean> {
    const { restrictions } = policy;
    if (!restrictions.maxTransactionAmount || restrictions.maxTransactionAmount === 0) return true; // equivalent to spending limit being disabled

    const transactionLogModel = dbV2.getTransactionLogModel();
    const timeWindow = Date.now() - (restrictions.timeWindow || 0);

    // Get sum of all transactions within time window
    const aggregateResult = await transactionLogModel.aggregate([
      {
        $match: {
          signerId: id,
          timestamp: { $gte: new Date(timeWindow) }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const currentTotal = aggregateResult[0]?.total || 0;
    return (currentTotal + amount) <= restrictions.maxTransactionAmount;
  }

  private async logTransactionDetails(signerId: string, txid: string, amount: number, expiresIn: number): Promise<void> {
    const transactionLogModel = dbV2.getTransactionLogModel();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresIn);

    const transactionLog = new transactionLogModel({
      signerId,
      txid,
      amount,
      timestamp: now,
      expiresAt,
    });

    await transactionLog.save((err) => {
      if (err)
        throw new Error(`Error occured while saving to database: ${err}`);
    });
  }

  /**
* Verifies the input and change addresses and calculates the outgoing value from a PSBT.
* @param serializedPSBT - The PSBT in base64 format
* @param change - The change address and index
* @param descriptor - The descriptor for the vault(vanilla/miniscript)
* @returns The calculated outgoing value in satoshis and whether change verification was successful
*/
  private verifyPSBT = (
    serverKeyId: string,
    PSBT: bitcoinJS.Psbt,
    change: { address: string; index: number },
    descriptor: string,
  ): { outgoingAmount: number } => {

    // step 1: verify input and change address(es)
    const parsedDescriptor = parseDescriptor(descriptor);
    if (!parsedDescriptor) throw new Error("Address validation failed: unable to parse the descriptor")

    let hasServerKey = false;
    const xpubs = [];
    parsedDescriptor.signersDetails.forEach(detail => {
      xpubs.push(detail.xpub);
      if (getFingerprintFromExtendedKey(detail.xpub, config.NETWORK) === serverKeyId) hasServerKey = true;
    })
    if (!hasServerKey) throw new Error("Address validation failed: server key is not a part of the multisig")

    for (const input of PSBT.data.inputs) {
      if (!input.witnessUtxo || !input.witnessUtxo.script) {
        throw new Error('Address validation failed: missing witnessUtxo or script');
      }
      const inputAddress = bitcoinJS.address.fromOutputScript(
        input.witnessUtxo.script,
        config.NETWORK
      );

      if (!input.bip32Derivation) {
        throw new Error("Address validation failed: input does not have bip32Derivation");
      }

      const pathElements = input.bip32Derivation[0].path.split('/');
      const chainIndex = parseInt(pathElements[pathElements.length - 2], 10);
      const childIndex = parseInt(pathElements[pathElements.length - 1], 10);

      const isInternal = chainIndex % 2 !== 0;
      const inputMultiSig = createMultiSig(xpubs, parsedDescriptor.scheme, childIndex, isInternal);

      if (inputMultiSig.address !== inputAddress) {
        throw new Error("Input address validation failed: address mismatch");
      }
    }

    let derivedChangeAddress: string;
    if (change && typeof change === 'string') throw new Error("Address validation failed: malformed change object. Please upgrade the app.")
    if (change && change.address) {
      const isInternal = true;
      derivedChangeAddress = createMultiSig(xpubs, parsedDescriptor.scheme, change.index, isInternal).address
      if (change.address !== derivedChangeAddress) throw new Error("Change address validation failed: address mismatch")
    }

    // step 2: calculate the outgoing amount
    let outgoingAmount = 0;
    for (const output of PSBT.txOutputs) {
      if (output.address === derivedChangeAddress) {
        continue;
      }
      outgoingAmount += output.value;
    }

    return { outgoingAmount };
  };

  private analyzePolicyChanges = (currentPolicy: SignerPolicy, policyUpdates: { restrictions: SignerRestriction, signingDelay: number }): boolean => {
    // Determine restrictiveness based on the difference b/w the daily spending rates for both policies
    let currentRate;
    if (!currentPolicy.restrictions.maxTransactionAmount ||
      !currentPolicy.restrictions.timeWindow
    ) {
      // case1: maxTransactionAmount is zero/null => disabled spending limit; Infinite spending rate
      // case2: timeWindow is zero/null => effective maxTransactionAmount spending rate per transaction
      currentRate = currentPolicy.restrictions.maxTransactionAmount || Infinity;
    } else currentRate = currentPolicy.restrictions.maxTransactionAmount / currentPolicy.restrictions.timeWindow;

    let newRate;
    if (!policyUpdates.restrictions.maxTransactionAmount || !policyUpdates.restrictions.timeWindow) {
      newRate = policyUpdates.restrictions.maxTransactionAmount || Infinity;
    } else newRate = policyUpdates.restrictions.maxTransactionAmount / policyUpdates.restrictions.timeWindow;

    let isMoreRestrictive = newRate <= currentRate

    // Check if the new policy has a shorter signing delay(overrides rates based restrictiveness analysis)
    const isSigningDelayLessRestrictive = (policyUpdates.signingDelay || 0) < (currentPolicy.signingDelay || 0)
    if (isSigningDelayLessRestrictive) isMoreRestrictive = false

    return isMoreRestrictive;
  }

  public setupSigner = async (
    policy: SignerPolicy
  ): Promise<{
    setupSuccessful: boolean;
    setupData: {
      id: any;
      isBIP85: boolean;
      bhXpub: any;
      masterFingerprint: any;
      derivationPath: string;
      verification: SingerVerification;
    };
  }> => {
    if (policy.exceptions) throw new Error("Update required: Server key policy is out of date. Please upgrade your app to the latest version.")

    const signerV3Model: any = dbV2.getSignerV3Model();
    policy.verification.verifier = this.generateVerifier(policy.verification.method);

    const credsVersion = WalletCredsVersion.V3;
    const isBIP85 = true;
    const { xfp, xpub, xIndex, masterFingerprint, derivationPath } =
      bitHyveWallet.getRandomXpub({ version: credsVersion, isBIP85 });
    const signerInstance = new signerV3Model({
      id: xfp,
      xIndex,
      isBIP85,
      policy,
      credsVersion,
    });

    await signerInstance.save((err) => {
      if (err) {
        throw new Error(`Error occured while saving to database: ${err}`);
      }
    });

    return {
      setupSuccessful: true,
      setupData: {
        id: xfp,
        isBIP85,
        bhXpub: xpub,
        masterFingerprint,
        derivationPath,
        verification: policy.verification,
      },
    };
  };

  public validateSignerSetup = async (id: string, verificationToken: string): Promise<{
    valid: boolean;
  }> => {
    // validates the setup using primary 2FA 
    const doc = await this.getSigner(id);
    const { isValid } = this.performPrimaryVerification(doc.policy, verificationToken)
    return { valid: isValid };
  };

  public addSecondaryVerificationOption = async (
    id: string,
    verificationToken: string,
    newOption: Omit<VerificationOption, 'verifier'>
  ): Promise<{ success: boolean; secondaryVerificationOption: VerificationOption }> => {
    const doc = await this.getSigner(id);
    const policy: SignerPolicy = doc.policy;

    if (!newOption.id || !newOption.method) throw new Error("Missing secondary verification's id/method");
    if (!Object.values(VerificationType).includes(newOption.method)) throw new Error("Invalid secondary verification method");

    if (!newOption.permittedActions || !newOption.permittedActions.length) throw new Error("Missing secondary verification's permittedActions");
    const predefinedPermittedActions = Object.values(PermittedAction)
    if (newOption.permittedActions.some(action => !predefinedPermittedActions.includes(action))) throw new Error("Invalid secondary verification's permittedActions");

    const { isValid } = this.performPrimaryVerification(policy, verificationToken);
    if (!isValid) throw new Error("Validation token is either invalid or has expired");

    if (!policy.secondaryVerification) policy.secondaryVerification = []
    if (policy.secondaryVerification.find(option => option.id === newOption.id)) throw new Error("Verification option already exists");

    const secondaryVerificationOption: VerificationOption = {
      ...newOption,
      verifier: this.generateVerifier(newOption.method),
    };
    policy.secondaryVerification.push(secondaryVerificationOption);

    doc.policy = policy;
    await doc.save((err) => {
      if (err)
        throw new Error(`Error occured while saving to database: ${err}`);
    });

    return { success: true, secondaryVerificationOption };
  };

  public removeSecondaryVerificationOption = async (
    id: string,
    verificationToken: string,
    optionId: string
  ): Promise<{ success: boolean }> => {
    const doc = await this.getSigner(id);
    const policy: SignerPolicy = doc.policy;

    const { isValid } = this.performPrimaryVerification(policy, verificationToken);
    if (!isValid) {
      throw new Error("Validation token is either invalid or has expired");
    }

    if (!policy.secondaryVerification) throw new Error("No secondary verification options to remove");
    const option = policy.secondaryVerification.find(opt => opt.id === optionId);
    if (!option) throw new Error("Verification option not found");

    policy.secondaryVerification = policy.secondaryVerification.filter(opt => opt.id !== optionId);

    doc.policy = policy;
    await doc.save((err) => {
      if (err)
        throw new Error(`Error occured while saving to database: ${err}`);
    });

    return { success: true };
  };

  public fetchSignerSetup = async (
    id: string,
    verificationToken: string,
  ): Promise<{
    valid: boolean;
    id?: string;
    isBIP85?: boolean;
    xpub?: string;
    masterFingerprint?: string;
    derivationPath?: string;
    policy?: SignerPolicy;
    linkedViaSecondary?: boolean;
  }> => {
    const doc = await this.getSigner(id);
    const policy: SignerPolicy = doc.policy;

    const { isValid, isActionPermitted, isSecondaryValid } = this.validateWithPrimaryOrSecondaryOptions(policy, verificationToken, PermittedAction.FETCH_SIGNER_SETUP);
    if (!isValid) return { valid: isValid };
    if (!isActionPermitted) throw new Error('Action not permitted: Fetching signer setup is not allowed via this verification method')

    const xIndex = doc.xIndex;
    const isBIP85 = doc.isBIP85 || false;
    const { xpub, xfp, masterFingerprint, derivationPath } =
      bitHyveWallet.getRandomXpub({
        xIndex,
        version: doc.credsVersion || WalletCredsVersion.V2,
        isBIP85,
      });


    const policyToSend = this.preparePolicyToSend(policy);
    if (isSecondaryValid) {
      // list of secondary verification options isn't available for non-primary users(2FA management is only available from the primary app)
      policyToSend.secondaryVerification = [];
    }

    return {
      valid: isValid,
      id: xfp,
      isBIP85,
      xpub,
      masterFingerprint,
      derivationPath,
      policy: policyToSend,
      linkedViaSecondary: isSecondaryValid, // indicates if the signer is fetched using a secondary verification option
    };
  };

  public fetchSignerSetupViaCosigners = async (
    cosignersId: string,
    verificationToken: string
  ): Promise<{
    valid: boolean;
    id?: string;
    isBIP85?: boolean;
    xpub?: string;
    masterFingerprint?: string;
    derivationPath?: string;
    policy?: SignerPolicy;
  }> => {
    const cosignersToSignerMapV3Model: any =
      dbV2.getCoSignersToSignerMapV3Model();

    let [cosignerMapDoc] = await cosignersToSignerMapV3Model.find({
      cosignersId: cosignersId,
    });
    if (!cosignerMapDoc)
      throw new Error(
        `Failed to find a signer against cosignersId: ${cosignersId}`
      );

    const doc = await this.getSigner(cosignerMapDoc.signerId);
    const policy: SignerPolicy = doc.policy;
    const { isValid } = this.performPrimaryVerification(policy, verificationToken);
    if (!isValid) return { valid: isValid };

    const xIndex = doc.xIndex;
    const isBIP85 = doc.isBIP85 || false;

    const { xpub, xfp, masterFingerprint, derivationPath } =
      bitHyveWallet.getRandomXpub({
        xIndex,
        version: doc.credsVersion || WalletCredsVersion.V2,
        isBIP85,
      });

    return {
      valid: isValid,
      id: xfp,
      isBIP85,
      xpub,
      masterFingerprint,
      derivationPath,
      policy: this.preparePolicyToSend(policy),
    };
  };

  public updateBackupSetting = async (id: string, verifierDigest: string, disable: boolean) => {
    const doc = await this.getSigner(id);

    const policy: SignerPolicy = doc.policy.toObject();
    if (hash256(policy.verification.verifier) !== verifierDigest) throw new Error("Invalid verifier digest");

    doc.policy = {
      ...policy,
      backupDisabled: disable,
    };

    await doc.save((err) => {
      if (err)
        throw new Error(`Error occured while saving to database: ${err}`);
    });

    return { updated: true }
  }

  public fetchBackup = async (
    id: string,
    verificationToken: string,
    publicKey: string
  ) => {
    const doc = await this.getSigner(id);
    if (!doc.isBIP85) throw new Error("Backup is only available for Signing Server+");

    const policy: SignerPolicy = doc.policy;
    if (policy.backupDisabled) throw new Error("Backup is disabled for the Server Key")

    const { isValid } = this.performPrimaryVerification(policy, verificationToken);
    if (!isValid)
      throw new Error("Validation token is either invalid or has expired");

    const mnemonic = bitHyveWallet.getBIP85ChildFromParent(
      false,
      doc.credsVersion || WalletCredsVersion.V2,
      doc.xIndex
    );

    const derivationPath = bitHyveWallet.getDerivationPath(BIP85_CHILD_XINDEX)
    return { encryptedBackup: asymmetricEncrypt(JSON.stringify({ mnemonic, derivationPath }), publicKey) };
  };

  public checkSignerHealth = async (id: string, verificationToken: string) => {
    let isSignerAvailable = false;
    const doc = await this.getSigner(id);

    if (doc && doc.xIndex) {
      const { isValid } = this.performPrimaryVerification(doc.policy, verificationToken);
      if (isValid) isSignerAvailable = true;
      else
        throw new Error(
          "Health check failed: validation token is either invalid or has expired"
        );
    }

    return { isSignerAvailable };
  };

  public updateSignerPolicy = async (
    id: string,
    updates: {
      restrictions: SignerRestriction,
      signingDelay: number,
    },
    verificationToken: string,
    FCM?: string,
  ): Promise<{
    updated: boolean;
    delayedPolicyUpdate?: DelayedPolicyUpdate;
  }> => {

    const doc = await this.getSigner(id);
    const { isValid } = this.performPrimaryVerification(doc.policy, verificationToken);
    if (!isValid)
      throw new Error(
        "Validation failed: 2FA token is either invalid or has expired"
      );

    if ((updates as SignerPolicy).verification) throw new Error("Verification settings cannot be overridden") // check for malformed updates object

    // check if there is an existing pending policy update
    const delayedPolicyUpdateModel = dbV2.getDelayedPolicyUpdateModel();
    const [policyDoc] = await delayedPolicyUpdateModel.find({
      signerId: id,
    });

    if (policyDoc && !(policyDoc as undefined as DelayedPolicyUpdate).isApplied) {
      throw new Error("A policy update(delayed) is already being processed")
    }

    const hasNewSpendingLimit = this.hasNewSpendingPolicy(doc.policy);

    if (hasNewSpendingLimit) {
      const isPolicyMoreRestrictive = this.analyzePolicyChanges(doc.policy, updates);

      if (isPolicyMoreRestrictive) {
        // Apply changes immediately
        const updatedPolicy: SignerPolicy = {
          ...doc.policy.toObject(),
          ...updates,
        };
        doc.policy = updatedPolicy;
        await doc.save((err) => {
          if (err)
            throw new Error(`Error occurred while saving to database: ${err}`);
        });
        return {
          updated: true,
        };
      } else {
        // Schedule permissive changes with delay
        const delayedPolicyUpdateModel = dbV2.getDelayedPolicyUpdateModel();
        const delay = Math.max( // lower bound def: MIN_POLICY_UPDATE_DELAY, upper bound def: signingDelay
          config.MIN_POLICY_UPDATE_DELAY,
          doc.policy.signingDelay || 0,
        );

        const now = Date.now();
        const delayedPolicyUpdate: DelayedPolicyUpdate = {
          policyId: hash256(id + verificationToken + now.toString()),
          signerId: id,
          policyUpdates: updates,
          verificationToken,
          timestamp: now,
          delayUntil: now + delay,
          FCM,
        }
        const delayedUpdate = new delayedPolicyUpdateModel(delayedPolicyUpdate);
        await delayedUpdate.save((err) => {
          if (err)
            throw new Error(`Error occurred while saving to database: ${err}`);
        });
        return {
          updated: false,
          delayedPolicyUpdate
        };
      }
    } else {
      (doc.policy as SignerPolicy) = {
        ...doc.policy.toObject(),
        restrictions: updates.restrictions || doc.policy.restrictions.toObject(),
        // exceptions: updates.exceptions ? updates.exceptions : doc.policy.exceptions.toObject(), // updates to exceptions(for old policy) are no more supported(signing interface, signPSBT, has removed the support for exceptions)
      };
      await doc.save((err) => {
        if (err)
          throw new Error(`Error occured while saving to database: ${err}`);
      });
      return {
        updated: true,
      };
    }
  };

  public updateCosignersToSignerMap = async (
    cosignersMapUpdates: CosignersMapUpdate[],
    id?: string
  ) => {
    const signerV3Model: any = dbV2.getSignerV3Model();
    const cosignersToSignerMapV3Model: any =
      dbV2.getCoSignersToSignerMapV3Model();

    if (id) {
      const [doc] = await signerV3Model.find({ id });
      if (!doc) throw new Error(`Signer doesn't exists for given id ${id}`);
    }

    const mapInstancesToSave = []
    for (let update of cosignersMapUpdates) {
      if (update.action !== CosignersMapUpdateAction.ADD) throw new Error('Unsupported action type: not CosignersMapUpdateAction.Add')

      let [doc] = await cosignersToSignerMapV3Model.find({
        cosignersId: update.cosignersId,
      });

      if (doc) {
        if (update.signerId === doc.signerId) continue // new vault w/ existing cosigners(at least 2) and signing server key
        else throw new Error('Another Signing Server Key is already associated with these cosigners') // existing cosingers found for a different signing server key
        // cannot associate new signing server, would lead to conflict during recovery
      } else {
        const mapInstance = new cosignersToSignerMapV3Model({
          cosignersId: update.cosignersId,
          signerId: update.signerId,
        });
        mapInstancesToSave.push(mapInstance)
      }
    }

    // save new updates, if none of the cosignersId are already mapped to a different signing server key
    try {
      if (mapInstancesToSave.length) await cosignersToSignerMapV3Model.insertMany(mapInstancesToSave);
    } catch (err) {
      throw new Error(`Error occurred while inserting documents: ${err}`);
    }

    return { updated: true };
  };

  /**
   * Signs a Partially Signed Bitcoin Transaction (PSBT) based on the provided parameters and policy restrictions.
   *
   * @param {string} id - The identifier for the signer.
   * @param {string} serializedPSBT - The serialized PSBT in base64 format.
   * @param {string} verificationToken - verification token for 2FA validation.
   * @param {string} [changeAddress] - The expected change address
   * @param {string} [descriptor] - The expected change address
   * @param {string} [FCM] - Optional Firebase Cloud Messaging token for notifications.
   * @returns {Promise<string | void>} - The signed PSBT in base64 format or void if the transaction is delayed.
   * @throws {Error} - Throws an error if signing fails due to missing FCM(delayed transaction), invalid verification token, or exceeded spending limits.
   */
  public signPSBT = async (
    id: string,
    serializedPSBT: string,
    verificationToken: string,
    change: { address: string, index: number }, // new policy verifies the change address and uses it to determine the outgoingAmount
    descriptor: string,
    FCM?: string,
  ): Promise<{
    delayed: boolean;
    delayedTransaction: DelayedTransaction;
    signedPSBT?: string;
  } | {
    delayed?: boolean;
    delayedTransaction?: DelayedTransaction;
    signedPSBT: string;
  }> => {
    const doc = await this.getSigner(id);
    const policy: SignerPolicy = doc.policy;
    const { restrictions, signingDelay } = policy;

    const hasNewSpendingLimit = this.hasNewSpendingPolicy(policy);
    if (!hasNewSpendingLimit) throw new Error("Update required: Server key policy is out of date. Please upgrade your app to the latest version.")

    const { isValid, isActionPermitted } = this.validateWithPrimaryOrSecondaryOptions(policy, verificationToken, PermittedAction.SIGN_TRANSACTION);
    if (!isValid) throw new Error("Signing failed: validation token is either invalid or has expired");
    if (!isActionPermitted) throw new Error('Action not permitted: Signing a transaction is not allowed via this verification method')

    const PSBT = bitcoinJS.Psbt.fromBase64(serializedPSBT, {
      network: config.NETWORK,
    });
    const { outgoingAmount } = this.verifyPSBT(doc.id, PSBT, change, descriptor);

    const meetsSpendingLimitRequirements = await this.isWithinSpendingLimit(id, policy, outgoingAmount)
    if (!meetsSpendingLimitRequirements)
      throw new Error(
        "Signing failed: exceeded spending limit for the specified time duration"
      );

    const txid = hash256(serializedPSBT);
    if (signingDelay) {
      const delayedTransactionModel = dbV2.getDelayedTransactionModel();

      const now = Date.now();
      const delayUntil = now + signingDelay;

      const delayedTransaction: DelayedTransaction = {
        txid,
        serializedPSBT,
        signerId: id,
        outgoing: outgoingAmount,
        verificationToken,
        timestamp: now,
        delayUntil,
        FCM,
      };

      const delayedTransactionDoc = new delayedTransactionModel(delayedTransaction);

      await delayedTransactionDoc.save((err) => {
        if (err) {
          throw new Error(`Error occurred while saving to database: ${err}`);
        }
      });

      await this.logTransactionDetails(id, txid, outgoingAmount, restrictions.timeWindow)
      return { delayed: true, delayedTransaction }
    } else {
      const signedPSBT = bitHyveWallet.signPSBT(
        PSBT,
        doc.xIndex,
        doc.isBIP85 || false,
        false,
        doc.credsVersion || WalletCredsVersion.V2
      );
      await this.logTransactionDetails(id, txid, outgoingAmount, restrictions.timeWindow)

      return { signedPSBT: signedPSBT.toBase64() };
    }
  };

  public cancelDelayedTransaction = async (signerId: string, txid: string, verificationToken: string): Promise<{
    canceled: boolean;
  }> => {
    const doc = await this.getSigner(signerId);
    const { isValid } = this.performPrimaryVerification(doc.policy, verificationToken);
    if (!isValid)
      throw new Error(
        "Validation failed: 2FA token is either invalid or has expired"
      );

    const delayedTransactionModel = dbV2.getDelayedTransactionModel();
    const [transactionDoc] = await delayedTransactionModel.find({
      txid,
    });

    if (!transactionDoc) throw new Error('Transaction not found');
    if ((transactionDoc as undefined as DelayedTransaction).signerId !== signerId) throw new Error("Origin mismatch: Transaction doesn't belong to this server key")
    if ((transactionDoc as undefined as DelayedTransaction).signedPSBT) throw new Error('Transaction is already signed')

    await delayedTransactionModel.deleteOne({ txid });
    const transactionLogModel = dbV2.getTransactionLogModel();
    // If the transaction falls within the spending time-limit window, it will auto reduce 
    // the aggregate sum(calculated at runtime) by the transaction amount upon removal. 
    // Otherwise the aggregate sum remains unaffected.
    await transactionLogModel.deleteOne({ txid });

    return {
      canceled: true
    }
  }

  public processDelayedTransactions = async () => {
    const delayedTransactionModel = dbV2.getDelayedTransactionModel();
    const now = Date.now();

    const transactionsToProcess = await delayedTransactionModel.find({
      delayUntil: { $lte: now },
      signedPSBT: { $exists: false },
    });

    for (const tx of transactionsToProcess as unknown as DelayedTransaction[]) {
      try {
        const PSBT = bitcoinJS.Psbt.fromBase64(tx.serializedPSBT);

        const doc = await this.getSigner(tx.signerId);
        let signedPSBT = bitHyveWallet.signPSBT(
          PSBT,
          doc.xIndex,
          doc.isBIP85 || false,
          false,
          doc.credsVersion || WalletCredsVersion.V2
        );
        signedPSBT = signedPSBT.toBase64();

        await delayedTransactionModel.updateOne(
          { txid: tx.txid },
          { signedPSBT }
        );

        if (tx.FCM) pushServerKeyNotification([tx.FCM], NOTIFICATION_TYPE.SIGNED_DELAYED_TRANSACTION, { id: tx.txid, signedTx: signedPSBT })
      } catch (err) {
        console.log(`Failed to process delayed transaction: ${err.message}`);
      }
    }
  };

  public processDelayedPolicyUpdates = async () => {
    const delayedPolicyUpdateModel = dbV2.getDelayedPolicyUpdateModel();
    const now = Date.now();

    const delayedUpdates = await delayedPolicyUpdateModel.find({
      delayUntil: { $lte: now },
      isApplied: { $exists: false },
    });

    for (const update of delayedUpdates as undefined as DelayedPolicyUpdate[]) {
      try {
        const doc = await this.getSigner(update.signerId);
        // Apply the delayed update
        const updatedPolicy: SignerPolicy = {
          ...doc.toObject().policy,
          ...(update.policyUpdates as any),
        };
        doc.policy = updatedPolicy;
        await doc.save((err) => {
          if (err)
            throw new Error(`Error occurred while saving to database: ${err}`);
        });

        await delayedPolicyUpdateModel.updateOne(
          { policyId: update.policyId },
          { isApplied: true }
        );

        // Send notification if FCM token is available
        if (update.FCM) {
          pushServerKeyNotification([update.FCM], NOTIFICATION_TYPE.POLICY_UPDATE_APPLIED, {
            id: update.policyId,
          });
        }

      } catch (err) {
        console.error(`Failed to process delayed policy update ${update.policyId}: ${err.message}`);
      }
    }
  };

  public fetchSignedDelayedTransaction = async (txid: string, verificationToken: string): Promise<{ delayedTransaction: DelayedTransaction }> => {
    const delayedTransactionModel = dbV2.getDelayedTransactionModel();
    const [transactionDoc] = await delayedTransactionModel.find({
      txid,
    });

    if (!transactionDoc)
      throw new Error('Transaction not found or already processed');

    if (verificationToken !== (transactionDoc as any).verificationToken)
      throw new Error("Validation token mismatch") // validate the request using existing validation token(used during signing request)

    if (!(transactionDoc as any).signedPSBT)
      throw new Error("Transaction isn't signed yet")

    await delayedTransactionModel.deleteOne({ txid });

    return { delayedTransaction: transactionDoc as any };
  }

  public fetchDelayedPolicyUpdate = async (policyId: string, verificationToken: string): Promise<{ delayedPolicy: DelayedPolicyUpdate }> => {
    const delayedPolicyUpdateModel = dbV2.getDelayedPolicyUpdateModel();
    const [policyDoc] = await delayedPolicyUpdateModel.find({
      policyId,
    });

    if (!policyDoc)
      throw new Error('Policy update not found or already applied');

    if (verificationToken !== (policyDoc as any).verificationToken)
      throw new Error("Validation token mismatch") // validate the request using existing validation token(used during delayed update creation)

    if (!(policyDoc as any).isApplied)
      throw new Error("Policy is not updated yet")

    await delayedPolicyUpdateModel.deleteOne({ policyId });

    return { delayedPolicy: policyDoc as any };
  }

  public migrateSignerPolicy = async (
    id: string,
    oldPolicy: SignerPolicy
  ): Promise<{ newPolicy: SignerPolicy }> => {
    const doc = await this.getSigner(id);
    const hasNewSpendingLimit = this.hasNewSpendingPolicy(doc.policy);

    if (hasNewSpendingLimit) {
      // already has new time-based spending policy? - return new policy
      const newPolicy: SignerPolicy = doc.policy
      return { newPolicy: this.preparePolicyToSend(newPolicy) };
    } else {
      // case: has old signer policy
      const storedOldPolicy: SignerPolicy = doc.policy;

      // Check verification settings
      if (oldPolicy.verification.method !== storedOldPolicy.verification.method) {
        throw new Error('Policy mismatch: verification settings do not match');
      }

      // Check restrictions
      if (oldPolicy.restrictions.none !== storedOldPolicy.restrictions.none ||
        oldPolicy.restrictions.maxTransactionAmount !== storedOldPolicy.restrictions.maxTransactionAmount) {
        throw new Error('Policy mismatch: spending restrictions do not match');
      }

      const DEFAULT_SPENDING_TIME_WINDOW = 1 * 30 * 24 * 60 * 60 * 1000 // 1 month in milliseconds;
      const restrictions: SignerRestriction = {
        ...oldPolicy.restrictions,
        timeWindow:
          !storedOldPolicy.restrictions.maxTransactionAmount
            ? null
            : DEFAULT_SPENDING_TIME_WINDOW, // mapped to a monthly default(user can manually edit from the settings)
      };

      const newPolicy: SignerPolicy = {
        verification: storedOldPolicy.verification, // verification settings must not be overridden  
        restrictions,
        // exceptions: storedOldPolicy.exceptions, // exceptions are not supported in new policy
        signingDelay: null,
      };

      doc.policy = newPolicy;
      await doc.save((err) => {
        if (err)
          throw new Error(`Error occurred while saving to database: ${err}`);
      });

      return { newPolicy: this.preparePolicyToSend(newPolicy) }
    }
  }

  public migrateSignersV2ToV3 = async (
    vaultId: string,
    appId: string,
    cosignersMapUpdates: CosignersMapUpdate[]
  ) => {
    const signerV3Model: any = dbV2.getSignerV3Model();

    const docV2 = await this.getSignerV2(vaultId, appId);
    const xIndex = docV2.xIndex;
    const policy = docV2.policy;
    const isBIP85 = false;
    const { xpub, xfp, masterFingerprint, derivationPath } =
      bitHyveWallet.getRandomXpub({
        xIndex,
        version: WalletCredsVersion.V2,
        isBIP85,
      });

    let [docV3] = await signerV3Model.find({ id: xfp }); // won't be available typically, unless previous migration
    // request failed at updateCosignersToSignerMap step
    if (!docV3) {
      const signerInstance = new signerV3Model({
        id: xfp,
        isBIP85,
        xIndex,
        policy,
      });

      await signerInstance.save((err) => {
        if (err) {
          throw new Error(`Error occured while saving to database: ${err}`);
        }
      });
    }

    await this.updateCosignersToSignerMap(cosignersMapUpdates);

    return {
      migrationSuccessful: true,
      setupData: {
        id: xfp,
        isBIP85,
        bhXpub: xpub,
        masterFingerprint,
        derivationPath,
        // This migration reuses an existing verifier. Older Keeper clients only
        // consume migrationSuccessful, so never send the stored TOTP secret back.
        verification: {
          method: policy.verification.method,
          verifier: null,
        },
      },
    };
  };


  public enrichCosignersToSignerMap = async (
    cosignersMapUpdates: CosignersMapUpdate[],
    id: string
  ) => {
    // enrichment logic for apps upgrading from version <= 1.2.6
    const signerV3Model: any = dbV2.getSignerV3Model();
    const cosignersToSignerMapV3Model: any =
      dbV2.getCoSignersToSignerMapV3Model();

    if (id) {
      const [doc] = await signerV3Model.find({ id });
      if (!doc) throw new Error(`Signer doesn't exists for given id ${id}`);
    }

    const mapInstancesToSave = []

    for (let update of cosignersMapUpdates) {
      if (update.action !== CosignersMapUpdateAction.ADD) throw new Error("Unsupported action type")

      let [doc] = await cosignersToSignerMapV3Model.find({
        cosignersId: update.cosignersId,
      });

      if (doc) {
        if (doc.signerId === update.signerId) continue; // case: redundant update(cosigners map already exists), most cases
        else {
          // case: different signing server keys are mapped to same two cosigners, so we keep the latest(one which upgrades beyond 1.2.6 most recently)
          doc.signerId = update.signerId;
          await doc.save((err) => {
            if (err)
              throw new Error(`Error occured while saving to database: ${err}`);
          });
        }

      } else {
        const mapInstance = new cosignersToSignerMapV3Model({
          cosignersId: update.cosignersId,
          signerId: update.signerId,
        });
        mapInstancesToSave.push(mapInstance)
      }
    }

    try {
      if (mapInstancesToSave.length) await cosignersToSignerMapV3Model.insertMany(mapInstancesToSave);
    } catch (err) {
      throw new Error(`Error occurred while inserting documents: ${err}`);
    }

    return { updated: true };
  };
}

export default new SignerV3();
