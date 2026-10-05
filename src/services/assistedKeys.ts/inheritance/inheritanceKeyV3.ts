import * as bitcoinJS from "bitcoinjs-lib";
import bitHyveWallet, { BIP85_CHILD_XINDEX } from "../../../wallet/bithyve";
import dbV2 from "../../../databases/dbV2";
import {
  InheritanceConfiguration,
  InheritanceKeyV3,
  InheritanceKeyRequestV3,
  EncryptedInheritancePolicy,
  InheritancePolicy,
  InheritanceKeyV2,
  InheritanceKeyRequestV3Types,
} from "../../../interfaces/inheritance";
import config, { SERVER_TYPE } from "../../../config";
import idx from "idx";
import * as Mailer from "../../mailing/mailer";
import {
  IKSCosignersMapUpdate,
  IKSCosignersMapUpdateAction,
} from "../../../interfaces/inheritance";
import { logger } from "../../../utilities/logger";
import {
  asymmetricDecrypt,
  asymmetricEncrypt,
} from "../../../utilities/encryption";
import { WalletCredsVersion } from "../../../interfaces/wallet";
import { hash256 } from "../../../utilities/encryption";
import { getNotificationType, pushIKNotification } from "../../notifications/pushNotification";

export class InheritanceKeyServiceV3 {
  private validateSigners = (
    thresholdDescriptors: string[],
    configurations: InheritanceConfiguration[],
    isRecovering: boolean = false
  ) => {
    const hashedDescriptors = thresholdDescriptors.map((tDescriptor) =>
      hash256(tDescriptor)
    );
    for (let config of configurations) {
      let validSigners = 0;
      hashedDescriptors.forEach((hashedtDescriptor) => {
        for (let descriptor of config.descriptors) {
          if (hashedtDescriptor === descriptor) {
            validSigners++;
            break;
          }
        }
      });

      const required = isRecovering ? config.m - 1 : config.m; // validate signers, should have m - 1 signers before we consider providing IK during recovery
      if (validSigners >= required) return true;
    }

    return false;
  };

  private sendEmailsViaMailer = (
    emails: string[],
    emailType: Mailer.EMAIL_TYPE,
    options: {
      requestId?: string,
      requestAutoApprovesIn?: number
    },
  ) => {
    try {
      Mailer.sendEmails(
        emails,
        emailType,
        options,
      );
    } catch (err) {
      logger.error(`Failed to send email for ${emailType}, err: ${err}`);
    }
  };

  private getDecryptedInheritancePolicy = (
    encryptedPolicy: EncryptedInheritancePolicy
  ): InheritancePolicy => {
    let decryptedPolicy: InheritancePolicy;
    if (encryptedPolicy) {
      decryptedPolicy = {
        ...encryptedPolicy,
        alert: encryptedPolicy.alert
          ? JSON.parse(asymmetricDecrypt(encryptedPolicy.alert))
          : undefined,
      };
    }

    return decryptedPolicy;
  };

  private getEncryptedInheritancePolicy = (
    policy: InheritancePolicy
  ): EncryptedInheritancePolicy => {
    let encryptedPolicy: EncryptedInheritancePolicy;
    if (policy) {
      encryptedPolicy = {
        ...policy,
        alert: policy.alert
          ? asymmetricEncrypt(JSON.stringify(policy.alert))
          : undefined,
      };
    }

    return encryptedPolicy;
  };

  private getEmailType = (requestType: InheritanceKeyRequestV3Types) => {
    let emailType: Mailer.EMAIL_TYPE;
    switch (requestType) {
      case InheritanceKeyRequestV3Types.RECOVER_KEY:
        emailType = Mailer.EMAIL_TYPE.IKS_REQUEST;
        break;
      case InheritanceKeyRequestV3Types.ONE_TIME_BACKUP:
        emailType = Mailer.EMAIL_TYPE.ONE_TIME_BACKUP
        break;
      case InheritanceKeyRequestV3Types.SIGN_TRANSACTION:
        emailType = Mailer.EMAIL_TYPE.SIGN_TRANSACTION
        break;
      default:
        emailType = Mailer.EMAIL_TYPE.IKS_REQUEST
    }
    return emailType
  }


  private processRequest = async (requestId: string, requestType: InheritanceKeyRequestV3Types, inheritanceDoc: InheritanceKeyV3) => {
    const inheritanceKeyRequestV3Model: any =
      dbV2.getInheritanceKeyRequestV3Model();

    const [request] = await inheritanceKeyRequestV3Model.find({ requestId });

    let isRequestApproved = false;
    let isRequestDeclined = false;

    const requestHasWaitedFor = request ? Date.now() - request.arrivedAt : 0;
    let requestAutoApprovesIn = Math.max(
      config.INHERITANCE_KEY_REQUEST_THRESHOLD - requestHasWaitedFor,
      0
    );

    if (request) {
      // case: existing request
      if (request.type && request.type !== requestType) throw new Error(`Request type mismatch, stored: ${request.type} provided: ${requestType}`)

      if (request.status.isDeclined) isRequestDeclined = true;
      else
        isRequestApproved =
          request.status.isApproved || requestAutoApprovesIn === 0;

      if (isRequestApproved && request.status.isApproved === false) {
        request.status.isApproved = true;
        request.save((err) => {
          if (err)
            throw new Error(`Error occured while saving to database: ${err}`);
        });
      }
    } else {
      // case: new request
      const inheritanceKeyRequestInstance = new inheritanceKeyRequestV3Model({
        requestId,
        inheritanceKeyId: inheritanceDoc.id,
        arrivedAt: Date.now(),
        type: requestType,
        status: {
          isDeclined: false,
          isApproved: false,
        },
      });

      // send notification and alerts(emails)
      if (inheritanceDoc.policy) {
        if (inheritanceDoc.policy.notification) {
          const targets = idx(inheritanceDoc.policy.notification, (_) => _.targets) || []

          if (targets.length) {
            const notificationType = getNotificationType(requestType)
            pushIKNotification(targets, notificationType, { requestId: requestId, requestAutoApprovesIn });
            logger.info(`Notification sent: ${inheritanceDoc.id}:${requestId}, ${Date()}`);
          }
        }

        if (inheritanceDoc.policy.alert) {
          let decryptedPolicy = this.getDecryptedInheritancePolicy(inheritanceDoc.policy);

          const emails = idx(decryptedPolicy, (_) => _.alert.emails) || [];
          if (emails.length) {
            const emailType = this.getEmailType(requestType)
            this.sendEmailsViaMailer(emails, emailType, { requestId: requestId, requestAutoApprovesIn });
            logger.info(`Email sent: ${inheritanceDoc.id}:${requestId}, ${Date()}`);
          }
        }
      }

      inheritanceKeyRequestInstance.save((err) => {
        if (err)
          throw new Error(`Error occured while saving to database: ${err}`);
      });
    }

    const requestStatus = {
      approvesIn: requestAutoApprovesIn,
      isApproved: isRequestApproved,
      isDeclined: isRequestDeclined,
    }

    return {
      requestStatus,
    }
  }

  /**
   * initialize the setup of Inheritance Key
   * @param  {string} id
   * @returns Promise
   */
  public initializeIKSetup = async (): Promise<{
    setupData: {
      id: string;
      isBIP85: boolean;
      inheritanceXpub: any;
      masterFingerprint: any;
      derivationPath: string;
    };
  }> => {
    const inheritanceKeyV3Model: any = dbV2.getInheritanceKeyV3Model();

    const credsVersion = WalletCredsVersion.V3;
    const isBIP85 = true;
    const { xpub, xfp, xIndex, masterFingerprint, derivationPath } =
      bitHyveWallet.getRandomXpub({
        inheritance: true,
        version: credsVersion,
        isBIP85,
      });

    const inheritanceKeyInstance = new inheritanceKeyV3Model({
      id: xfp,
      xIndex,
      isBIP85,
      credsVersion,
    });

    await inheritanceKeyInstance.save((err) => {
      if (err)
        throw new Error(`Error occured while saving to database: ${err}`);
    });

    return {
      setupData: {
        id: xfp,
        isBIP85,
        inheritanceXpub: xpub,
        masterFingerprint,
        derivationPath,
      },
    };
  };

  /**
   * finalize the setup of Inheritance Key
   * @param  {string} id
   * @param  {InheritanceConfiguration} configuration
   * @param  {EncryptedInheritancePolicy} updatedEncryptedPolicy
   * @returns Promise
   */
  public finalizeIKSetup = async (
    id: string,
    configuration: InheritanceConfiguration,
    updatedEncryptedPolicy: EncryptedInheritancePolicy
  ): Promise<{
    setupSuccessful: boolean;
  }> => {
    const inheritanceKeyV3Model: any = dbV2.getInheritanceKeyV3Model();
    let [doc] = await inheritanceKeyV3Model.find({ id });
    if (!doc)
      throw new Error(
        `Inheritance key setup has not been initialized for ${id}`
      );
    if (doc.configurations || doc.policy)
      throw new Error(
        `Inheritance key setup has already been finalized for ${id}`
      );

    (doc as InheritanceKeyV3).configurations = [configuration]; // initialize first config
    (doc as InheritanceKeyV3).policy = updatedEncryptedPolicy; // update policy

    await doc.save((err) => {
      if (err)
        throw new Error(`Error occured while saving to database: ${err}`);
    });

    return {
      setupSuccessful: true,
    };
  };

  /**
   * updates the vault setup(BSMS) and/or threshold signer descriptors
   * @param  {string} id
   * @param {string[]} thresholdDescriptors
   * @param  {string} newBSMS
   * @param {InheritanceConfiguration} newConfiguration
   * @returns Promise
   */
  public updateInheritanceConfig = async (
    id: string,
    existingThresholdDescriptors: string[],
    newConfiguration: InheritanceConfiguration
  ): Promise<{
    updated: boolean;
  }> => {
    const inheritanceKeyV3Model: any = dbV2.getInheritanceKeyV3Model();
    dbV2.getCoSignersToSignerMapIKSV3Model();
    let [doc] = await inheritanceKeyV3Model.find({ id });
    if (!doc) throw new Error(`Inheritance key doesn't exists for vault ${id}`);

    const existingConfigurations: InheritanceConfiguration[] =
      doc.configurations;
    const isValid = this.validateSigners(
      existingThresholdDescriptors,
      existingConfigurations
    );
    if (!isValid) throw new Error(`Not enough valid cosigners`);

    (doc as InheritanceKeyV3).configurations.push(newConfiguration); // add new config

    await doc.save((err) => {
      if (err)
        throw new Error(`Error occured while saving to database: ${err}`);
    });
    return {
      updated: true,
    };
  };

  /**
   * updates the inheritance policy for the given vault
   * @param  {string} id
   * @param  {EncryptedInheritancePolicy} updatedEncryptedPolicy
   * @returns Promise
   */
  public updateInheritancePolicy = async (
    id: string,
    updatedEncryptedPolicy: EncryptedInheritancePolicy,
    thresholdDescriptors: string[]
  ): Promise<{
    updated: boolean;
  }> => {
    const inheritanceKeyV3Model: any = dbV2.getInheritanceKeyV3Model();
    let [doc] = await inheritanceKeyV3Model.find({ id });
    if (!doc) throw new Error(`Inheritance key doesn't exists for vault ${id}`);

    const configurations: InheritanceConfiguration[] = doc.configurations;

    const isValid = this.validateSigners(thresholdDescriptors, configurations);
    if (!isValid) throw new Error(`Not enough valid cosigners`);

    const emailsUpdated = updatedEncryptedPolicy.alert && updatedEncryptedPolicy.alert !== doc.policy?.alert;
    if (emailsUpdated) {
      let decryptedPolicy = this.getDecryptedInheritancePolicy(updatedEncryptedPolicy);

      const emails = idx(decryptedPolicy, (_) => _.alert.emails) || [];
      if (emails.length) {
        this.sendEmailsViaMailer(emails, Mailer.EMAIL_TYPE.IKS_SETUP, {});
        logger.info(`Setup Confirmation email sent: ${doc.id}, ${Date()}`);
      }
    }
    doc.policy = updatedEncryptedPolicy;

    await doc.save((err) => {
      if (err)
        throw new Error(`Error occured while saving to database: ${err}`);
    });
    return {
      updated: true,
    };
  };

  public updateCosignersToSignerMapIKS = async (
    cosignersMapIKSUpdates: IKSCosignersMapUpdate[],
    id?: string
  ) => {
    const inheritanceKeyV3Model: any = dbV2.getInheritanceKeyV3Model();
    const cosignersToSignerMapIKSV3Model: any =
      dbV2.getCoSignersToSignerMapIKSV3Model();

    if (id) {
      const [doc] = await inheritanceKeyV3Model.find({ id });
      if (!doc)
        throw new Error(`Inheritance Key doesn't exists for given id ${id}`);
    }

    const mapInstancesToSave = []
    for (let update of cosignersMapIKSUpdates) {
      if (update.action !== IKSCosignersMapUpdateAction.ADD) throw new Error('Unsupported action type: not IKSCosignersMapUpdateAction.Add')

      let [doc] = await cosignersToSignerMapIKSV3Model.find({
        cosignersId: update.cosignersId,
      });

      if (doc) {
        if (update.inheritanceKeyId === doc.inheritanceKeyId) continue // new vault w/ existing cosigners(at least 2) and inheritance key
        else throw new Error('Another Inheritance Key is already associated with these cosigners') // existing cosingers found for a different IKS
        // cannot associate new IKS, would lead to conflict during recovery
      } else {
        const mapInstance = new cosignersToSignerMapIKSV3Model({
          cosignersId: update.cosignersId,
          inheritanceKeyId: update.inheritanceKeyId,
        });
        mapInstancesToSave.push(mapInstance)
      }
    }

    // save new updates, if none of the cosignersId are already mapped to a different inheritance key
    try {
      if (mapInstancesToSave.length) await cosignersToSignerMapIKSV3Model.insertMany(mapInstancesToSave);
    } catch (err) {
      throw new Error(`Error occurred while inserting documents: ${err}`);
    }

    return { updated: true };
  };

  public findIKSSetup = async (
    ids: string[],
    thresholdDescriptors: string[]
  ): Promise<{
    setupInfo: {
      id: string;
    };
  }> => {
    const inheritanceKeyV3Model: any = dbV2.getInheritanceKeyV3Model();

    let doc;
    for (let inheritanceKeyId of ids) {
      [doc] = await inheritanceKeyV3Model.find({
        id: inheritanceKeyId,
      });
    }
    if (!doc)
      throw new Error(`Inheritance key doesn't exists for the provided ids`);

    if (!doc.configurations || !doc.policy)
      throw new Error(
        `IKS setup has not been finalized for the identified inheritance key`
      );

    const isValid = this.validateSigners(
      thresholdDescriptors,
      doc.configurations
    );
    if (!isValid) throw new Error(`Not enough valid cosigners`);

    const xIndex = doc.xIndex;
    const isBIP85 = doc.isBIP85 || false;
    const { xfp } = bitHyveWallet.getRandomXpub({
      xIndex,
      inheritance: true,
      version: doc.credsVersion || WalletCredsVersion.V2,
      isBIP85,
    });

    return {
      setupInfo: {
        id: xfp,
      },
    };
  };

  public fetchBackup = async (
    id: string,
    requestId: string,
    thresholdDescriptors: string[],
    publicKey: string
  ) => {
    const inheritanceKeyV3Model: any = dbV2.getInheritanceKeyV3Model();
    let [doc] = await inheritanceKeyV3Model.find({ id });
    if (!doc.isBIP85) throw new Error("Backup is only available for Inheritance Key+");

    const isValid = this.validateSigners(
      thresholdDescriptors,
      doc.configurations
    );
    if (!isValid) throw new Error(`Not enough valid cosigners`);

    const { requestStatus } = await this.processRequest(requestId, InheritanceKeyRequestV3Types.ONE_TIME_BACKUP, doc)

    if (requestStatus.isApproved) {
      const mnemonic = bitHyveWallet.getBIP85ChildFromParent(
        true,
        doc.credsVersion || WalletCredsVersion.V2,
        doc.xIndex
      );
      const derivationPath = bitHyveWallet.getDerivationPath(BIP85_CHILD_XINDEX)

      return {
        requestStatus,
        encryptedBackup: asymmetricEncrypt(
          JSON.stringify({ mnemonic, derivationPath }),
          publicKey
        ),
      };
    } else {
      return {
        requestStatus
      }
    }
  };

  public checkIKSHealth = async (id: string) => {
    let isIKSAvailable = false;
    const inheritanceKeyV3Model: any = dbV2.getInheritanceKeyV3Model();
    let [doc] = await inheritanceKeyV3Model.find({ id });

    if (doc && doc.xIndex) isIKSAvailable = true;
    return { isIKSAvailable };
  };

  public requestInheritanceKey = async (
    requestId: string,
    cosignersId: string,
    thresholdDescriptors: string[]
  ): Promise<{
    requestStatus: {
      approvesIn: number;
      isApproved: boolean;
      isDeclined: boolean;
    };
    setupInfo?: {
      id: string;
      isBIP85: boolean;
      inheritanceXpub: string;
      masterFingerprint: string;
      derivationPath: string;
      configurations: InheritanceConfiguration[];
      policy: InheritancePolicy;
    };
  }> => {
    const inheritanceKeyV3Model: any = dbV2.getInheritanceKeyV3Model();
    const cosignersToSignerMapIKSV3Model: any =
      dbV2.getCoSignersToSignerMapIKSV3Model();

    let [cosignerMapDoc] = await cosignersToSignerMapIKSV3Model.find({
      cosignersId: cosignersId,
    });
    if (!cosignerMapDoc)
      throw new Error(
        `Failed to find a signer against cosignersId: ${cosignersId}`
      );
    const inheritanceKeyId = cosignerMapDoc.inheritanceKeyId;

    let [doc]: [doc: InheritanceKeyV3] = await inheritanceKeyV3Model.find({
      id: inheritanceKeyId,
    });
    if (!doc)
      throw new Error(`Inheritance key doesn't exists for ${inheritanceKeyId}`);
    if (!doc.configurations || !doc.policy)
      throw new Error(
        `Inheritance key setup has not been finalized for ${inheritanceKeyId}`
      );

    const isValid = this.validateSigners(
      thresholdDescriptors,
      doc.configurations,
      true // the user should be able to recover the IKS with m-1 signers(and reach threshold m as the IKS recovers)
    );
    if (!isValid) throw new Error(`Not enough valid cosigners`);

    const { requestStatus } = await this.processRequest(requestId, InheritanceKeyRequestV3Types.RECOVER_KEY, doc)

    if (requestStatus.isApproved) {
      const xIndex = doc.xIndex;
      const isBIP85 = doc.isBIP85 || false;

      const { xpub, xfp, masterFingerprint, derivationPath } =
        bitHyveWallet.getRandomXpub({
          xIndex,
          inheritance: true,
          version: doc.credsVersion || WalletCredsVersion.V2,
          isBIP85,
        });

      return {
        requestStatus,
        setupInfo: {
          id: xfp,
          isBIP85,
          inheritanceXpub: xpub,
          masterFingerprint,
          derivationPath,
          configurations: doc.configurations, // TODO: once BSMS is enabled, we'll have to decrypt them and send back
          policy: this.getDecryptedInheritancePolicy(doc.policy),
        },
      };
    } else {
      return {
        requestStatus,
      };
    }
  };

  public declineInheritanceKeyRequest = async (
    requestId: string
  ): Promise<{
    declined: boolean;
    requestStatus: string,
  }> => {
    const inheritanceKeyRequestV3Model: any =
      dbV2.getInheritanceKeyRequestV3Model();

    let [doc] = await inheritanceKeyRequestV3Model.find({ requestId });
    if (!doc)
      throw new Error(`Inheritance key doesn't exists for ${requestId}`);

    const requestType = (doc as InheritanceKeyRequestV3).type

    let requestStatus: string;
    switch (requestType) {
      case InheritanceKeyRequestV3Types.RECOVER_KEY:
        requestStatus = 'Inheritance Key Recovery Request is Declined'
        break
      case InheritanceKeyRequestV3Types.ONE_TIME_BACKUP:
        requestStatus = 'Inheritance Key One Time Backup Request is Declined'
        break
      case InheritanceKeyRequestV3Types.SIGN_TRANSACTION:
        requestStatus = 'Inheritance Key Signing Request is Declined'
        break
      default:
        requestStatus = 'Inheritance Key Recovery Request is Declined'
        break
    }

    if ((doc as InheritanceKeyRequestV3).status.isDeclined)
      return { declined: true, requestStatus }; // already declined
    else
      (doc as InheritanceKeyRequestV3).status = {
        ...doc.status,
        isDeclined: true,
      };

    await doc.save((err) => {
      if (err)
        throw new Error(`Error occured while saving to database: ${err}`);
    });
    return {
      declined: doc.status.isDeclined,
      requestStatus
    };
  };

  /**
   * signs PSBT using IK
   * @param  {string} id
   * @param  {string} serializedPSBT
   * @returns Promise
   */
  public signPSBT = async (
    id: string,
    requestId: string,
    serializedPSBT: string,
    thresholdDescriptors: string[]
  ): Promise<{
    requestStatus: {
      approvesIn: number;
      isApproved: boolean;
      isDeclined: boolean;
    };
    signedPSBT?: string;
  }> => {
    const inheritanceKeyV3Model: any = dbV2.getInheritanceKeyV3Model();
    let [doc] = await inheritanceKeyV3Model.find({ id });
    if (!doc) throw new Error(`Inheritance key doesn't exists for vault ${id}`);

    const configurations: InheritanceConfiguration[] = doc.configurations;
    const isValid = this.validateSigners(thresholdDescriptors, configurations);
    if (!isValid) throw new Error(`Not enough valid cosigners`);

    const { requestStatus } = await this.processRequest(requestId, InheritanceKeyRequestV3Types.SIGN_TRANSACTION, doc)

    if (requestStatus.isApproved) {
      const PSBT = bitcoinJS.Psbt.fromBase64(serializedPSBT);

      const signedPSBT = bitHyveWallet.signPSBT(
        PSBT,
        doc.xIndex,
        doc.isBIP85 || false,
        true,
        doc.credsVersion || WalletCredsVersion.V2
      );

      return { requestStatus, signedPSBT: signedPSBT.toBase64() }
    } else {

      return { requestStatus }
    }
  };

  public migrateIKSSignersV2ToV3 = async (
    vaultId: string,
    cosignersMapIKSUpdates: IKSCosignersMapUpdate[]
  ) => {
    const inheritanceKeyV3Model: any = dbV2.getInheritanceKeyV3Model();
    const inheritanceKeyV2Model: any = dbV2.getInheritanceKeyV2Model();

    let [docV2] = await inheritanceKeyV2Model.find({ vaultId });
    if (!docV2) throw new Error(`Inheritance key don't exist for ${vaultId}`);

    const xIndex = docV2.xIndex;
    const policy: InheritancePolicy = docV2.policy;
    const encryptedPolicy = this.getEncryptedInheritancePolicy(policy);

    const config: InheritanceConfiguration = (docV2 as InheritanceKeyV2)
      .configuration;
    config.id = (docV2 as InheritanceKeyV2).vaultId;

    const isBIP85 = false;
    const { xpub, xfp, masterFingerprint, derivationPath } =
      bitHyveWallet.getRandomXpub({
        xIndex,
        inheritance: true,
        version: WalletCredsVersion.V2,
        isBIP85,
      });

    let [docV3] = await inheritanceKeyV3Model.find({ id: xfp }); // won't be available typically, unless previous migration
    // request failed at updateCosignersToSignerMap step
    if (!docV3) {
      const inheritanceKeyInstance = new inheritanceKeyV3Model({
        id: xfp,
        isBIP85,
        xIndex,
        configurations: [config],
        policy: encryptedPolicy,
      });

      await inheritanceKeyInstance.save((err) => {
        if (err) {
          throw new Error(`Error occured while saving to database: ${err}`);
        }
      });
    }

    await this.updateCosignersToSignerMapIKS(cosignersMapIKSUpdates);

    return {
      migrationSuccessful: true,
      setupData: {
        id: xfp,
        isBIP85,
        inheritanceXpub: xpub,
        masterFingerprint,
        derivationPath,
        policy,
        configurations: [config],
      },
    };
  };

  public enrichCosignersToSignerMapIKS = async (
    cosignersMapIKSUpdates: IKSCosignersMapUpdate[],
    id: string
  ) => {
    // enrichment logic for apps upgrading from version <= 1.2.6
    const inheritanceKeyV3Model: any = dbV2.getInheritanceKeyV3Model();
    const cosignersToSignerMapIKSV3Model: any =
      dbV2.getCoSignersToSignerMapIKSV3Model();

    if (id) {
      const [doc] = await inheritanceKeyV3Model.find({ id });
      if (!doc) throw new Error(`Inheritance Key doesn't exists for given id ${id}`);
    }

    const mapInstancesToSave = []

    for (let update of cosignersMapIKSUpdates) {
      if (update.action !== IKSCosignersMapUpdateAction.ADD) throw new Error("Unsupported action type")

      let [doc] = await cosignersToSignerMapIKSV3Model.find({
        cosignersId: update.cosignersId,
      });

      if (doc) {
        if (doc.inheritanceKeyId === update.inheritanceKeyId) continue; // case: redundant update(cosigners map already exists), most cases
        else {
          // case: different inheritance keys are mapped to same two cosigners, so we keep the latest(one which upgrades beyond 1.2.6 most recently)
          doc.inheritanceKeyId = update.inheritanceKeyId;
          await doc.save((err) => {
            if (err)
              throw new Error(`Error occured while saving to database: ${err}`);
          });
        }

      } else {
        const mapInstance = new cosignersToSignerMapIKSV3Model({
          cosignersId: update.cosignersId,
          inheritanceKeyId: update.inheritanceKeyId,
        });
        mapInstancesToSave.push(mapInstance)
      }
    }

    try {
      if (mapInstancesToSave.length) await cosignersToSignerMapIKSV3Model.insertMany(mapInstancesToSave);
    } catch (err) {
      throw new Error(`Error occurred while inserting documents: ${err}`);
    }

    return { updated: true };
  };


  public sendNotifications = async (): Promise<{
    sent: boolean;
    count: number;
  }> => {
    const inheritanceKeyV3Model: any = dbV2.getInheritanceKeyV3Model();
    const inheritanceKeyRequestV3Model: any =
      dbV2.getInheritanceKeyRequestV3Model();

    let requests = await inheritanceKeyRequestV3Model.find({});
    if (!requests.length) return { sent: true, count: 0 };

    let count = 0;
    for (const request of requests) {
      if (request.status.isApproved || request.status.declined) continue; // case: request has already been approved/declined
      if (
        !request.status.isDeclined &&
        Date.now() - request.arrivedAt >
        config.INHERITANCE_KEY_REQUEST_THRESHOLD
      ) {
        (request as InheritanceKeyRequestV3).status.isApproved = true;
        await request.save((err) => {
          if (err)
            throw new Error(`Error occured while saving to database: ${err}`);
        });
        continue;
      } // case: crossed threshold, request is being marked as approved

      const [doc] = await inheritanceKeyV3Model.find({
        id: (request as InheritanceKeyRequestV3).inheritanceKeyId,
      });

      if (doc.policy && doc.policy.notification) {
        const targets = idx((doc.policy as EncryptedInheritancePolicy).notification, (_) => _.targets) || []

        if (targets.length) {
          const notificationType = getNotificationType((request as InheritanceKeyRequestV3).type)
          const requestHasWaitedFor = Date.now() - request.arrivedAt;
          let requestAutoApprovesIn = Math.max(
            config.INHERITANCE_KEY_REQUEST_THRESHOLD - requestHasWaitedFor,
            0
          );

          pushIKNotification(targets, notificationType, { requestId: request.requestId, requestAutoApprovesIn }); // send notification
          logger.info(
            `Notification sent: ${doc.id}:${request.requestId}, ${Date()}`
          );
          count++;
        }
      }
    }

    return {
      sent: true,
      count,
    };
  };

  public sendIKRequestEmails = async (): Promise<{
    sent: boolean;
    count: number;
  }> => {
    const inheritanceKeyV3Model: any = dbV2.getInheritanceKeyV3Model();
    const inheritanceKeyRequestV3Model: any =
      dbV2.getInheritanceKeyRequestV3Model();

    let requests = await inheritanceKeyRequestV3Model.find({});
    if (!requests.length) return { sent: true, count: 0 };

    let count = 0;
    for (const request of requests) {
      if (request.status.isApproved || request.status.declined) continue; // case: request has already been approved/declined
      if (
        !request.status.isDeclined &&
        Date.now() - request.arrivedAt >
        config.INHERITANCE_KEY_REQUEST_THRESHOLD
      ) {
        (request as InheritanceKeyRequestV3).status.isApproved = true;
        await request.save((err) => {
          if (err)
            throw new Error(`Error occured while saving to database: ${err}`);
        });
        continue;
      } // case: crossed threshold, request is being marked as approved

      const [doc] = await inheritanceKeyV3Model.find({
        id: (request as InheritanceKeyRequestV3).inheritanceKeyId,
      });

      if (doc.policy && doc.policy.alert) {
        const decryptedPolicy = this.getDecryptedInheritancePolicy(doc.policy);

        const emails = idx(decryptedPolicy, (_) => _.alert.emails) || [];
        if (emails.length) {
          const requestHasWaitedFor = Date.now() - request.arrivedAt;
          let requestAutoApprovesIn = Math.max(
            config.INHERITANCE_KEY_REQUEST_THRESHOLD - requestHasWaitedFor,
            0
          );

          const emailType = this.getEmailType((request as InheritanceKeyRequestV3).type)
          this.sendEmailsViaMailer(emails, emailType, { requestId: request.requestId, requestAutoApprovesIn });
          logger.info(`Emails sent: ${doc.id}:${request.requestId}, ${Date()}`);
          count++;
        }
      }
    }

    return {
      sent: true,
      count,
    };
  };
}

export default new InheritanceKeyServiceV3();
