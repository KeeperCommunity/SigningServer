import * as bitcoinJS from "bitcoinjs-lib";
import bitHyveWallet from "../../../wallet/bithyve";
import dbV2 from "../../../databases/dbV2";
import {
  InheritanceConfiguration,
  InheritanceKeyV2,
  InheritanceKeyRequestV2,
  InheritanceNotification,
  InheritancePolicy,
} from "../../../interfaces/inheritance";
import config, { SERVER_TYPE } from "../../../config";
import idx from "idx";
import * as Mailer from "../../mailing/mailer";
import axios, { AxiosResponse } from "axios";
import { logger } from "../../../utilities/logger";
import { WalletCredsVersion } from "../../../interfaces/wallet";

export class InheritanceKeyServiceV2 {
  private validateSigners = (
    thresholdDescriptors: string[],
    configuration: InheritanceConfiguration
  ) => {
    // validate signers, should have m - 1 signers before we consider providing IK
    let validSigners = 0;
    thresholdDescriptors.forEach((tDescriptor) => {
      for (let descriptor of configuration.descriptors) {
        if (tDescriptor === descriptor) {
          validSigners++;
          break;
        }
      }
    });
    return validSigners >= configuration.m - 1;
  };

  private pushIKNotification = async (FCMs: string[], requestId: string) => {
    try {
      const requestData = {
        FCMs,
        notification: {
          notificationType: "unread",
          title: "Inheritance Key Request",
          body: `You've a request from heir to inherit IK : ${requestId}`,
          data: {
            type: "IKS_REQUEST",
            reqId: requestId,
          },
        },
      };

      const response = await axios.post(
        config.RELAY + "sendKeeperNotifications",
        requestData,
        {
          headers: {
            "HEXA-ID": config.HEXA_ID,
          },
        }
      );

      const { sent } = response.data;
      if (!sent) throw new Error(`keeper-relay send failure`);
    } catch (err) {
      logger.error(`Failed to send notification for ${requestId}, err: ${err}`);
    }
  };

  private sendEmailsViaMailer = (
    emails: string[],
    emailType: Mailer.EMAIL_TYPE,
    options: {
      requestId?: string,
      requestAutoApprovesIn?: number  
    },  ) => {
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

  /**
   * initialize the setup of Inheritance Key
   * @param  {string} vaultId
   * @returns Promise
   */
  public initializeIKSetup = async (
    vaultId: string
  ): Promise<{
    setupData: {
      inheritanceXpub: any;
      masterFingerprint: any;
      derivationPath: string;
    };
  }> => {
    const inheritanceKeyV2Model: any = dbV2.getInheritanceKeyV2Model();
    let [doc] = await inheritanceKeyV2Model.find({ vaultId });

    if (doc) throw new Error(`Inheritance key already exists for vault ${vaultId}`);
    
    const { xpub, xIndex, masterFingerprint, derivationPath } =
      bitHyveWallet.getRandomXpub({ inheritance: true, version: WalletCredsVersion.V2 , isBIP85: false });

    const inheritanceKeyInstance = new inheritanceKeyV2Model({
      vaultId,
      xIndex,
    });

    await inheritanceKeyInstance.save((err) => {
      if (err)
        throw new Error(`Error occured while saving to database: ${err}`);
    });

    return {
      setupData: {
        inheritanceXpub: xpub,
        masterFingerprint,
        derivationPath,
      },
    };
  };

  /**
   * finalize the setup of Inheritance Key
   * @param  {string} vaultId
   * @param  {InheritanceConfiguration} configuration
   * @param  {InheritancePolicy} policy
   * @returns Promise
   */
  public finalizeIKSetup = async (
    vaultId: string,
    configuration: InheritanceConfiguration,
    policy: InheritancePolicy
  ): Promise<{
    setupSuccessful: boolean;
  }> => {
    const inheritanceKeyV2Model: any = dbV2.getInheritanceKeyV2Model();
    let [doc] = await inheritanceKeyV2Model.find({ vaultId });
    if (!doc)
      throw new Error(
        `Inheritance key setup has not been initialized for ${vaultId}`
      );
    if (doc.configuration || doc.policy)
      throw new Error(
        `Inheritance key setup has already been finalized for ${vaultId}`
      );

    (doc as InheritanceKeyV2).configuration = configuration; // update configuration
    (doc as InheritanceKeyV2).policy = policy; // update policy

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
   * @param  {string} vaultId
   * @param {string[]} thresholdDescriptors
   * @param  {string} newBSMS
   * @param {InheritanceConfiguration} newConfiguration
   * @returns Promise
   */
  public updateInheritanceConfig = async (
    vaultId: string,
    existingThresholdDescriptors: string[],
    newConfiguration: InheritanceConfiguration
  ): Promise<{
    updated: boolean;
  }> => {
    const inheritanceKeyV2Model: any = dbV2.getInheritanceKeyV2Model();
    let [doc] = await inheritanceKeyV2Model.find({ vaultId });
    if (!doc)
      throw new Error(`Inheritance key doesn't exists for vault ${vaultId}`);

    const existingConfiguration: InheritanceConfiguration = doc.configuration;
    const isValid = this.validateSigners(
      existingThresholdDescriptors,
      existingConfiguration
    );
    if (!isValid)
      throw new Error(
        `Not enough valid signers, required: ${existingConfiguration.m - 1}`
      );

    (doc as InheritanceKeyV2).configuration = newConfiguration; // update configuration

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
   * @param  {string} vaultId
   * @param  {InheritancePolicy} policy
   * @returns Promise
   */
  public updateInheritancePolicy = async (
    vaultId: string,
    updates: {
      notification?: InheritanceNotification;
    },
    thresholdDescriptors: string[]
  ): Promise<{
    updated: boolean;
  }> => {
    const inheritanceKeyV2Model: any = dbV2.getInheritanceKeyV2Model();
    let [doc] = await inheritanceKeyV2Model.find({ vaultId });
    if (!doc)
      throw new Error(`Inheritance key doesn't exists for vault ${vaultId}`);

    const configuration: InheritanceConfiguration = doc.configuration;

    const isValid = this.validateSigners(thresholdDescriptors, configuration);
    if (!isValid)
      throw new Error(
        `Not enough valid signers, required: ${configuration.m - 1}`
      );

    (doc.policy as InheritancePolicy) = {
      ...doc.policy,
      ...updates,
    };

    await doc.save((err) => {
      if (err)
        throw new Error(`Error occured while saving to database: ${err}`);
    });
    return {
      updated: true,
    };
  };

  public requestInheritanceKey = async (
    requestId: string,
    vaultId: string,
    thresholdDescriptors: string[]
  ): Promise<{
    requestStatus: {
      approvesIn: number;
      isApproved: boolean;
      isDeclined: boolean;
    };
    setupInfo?: {
      inheritanceXpub: string;
      masterFingerprint: string;
      derivationPath: string;
      configuration: InheritanceConfiguration;
      policy: InheritancePolicy;
    };
  }> => {
    const inheritanceKeyV2Model: any = dbV2.getInheritanceKeyV2Model();
    let [doc]: [doc: InheritanceKeyV2] = inheritanceKeyV2Model.find({
      vaultId,
    });
    if (!doc) throw new Error(`Inheritance key doesn't exists for ${vaultId}`);
    if (!doc.configuration || !doc.policy)
      throw new Error(
        `Inheritance key setup has not been finalized for ${vaultId}`
      );

    const isValid = this.validateSigners(
      thresholdDescriptors,
      doc.configuration
    );
    if (!isValid)
      throw new Error(
        `Not enough valid signers, required: ${doc.configuration.m - 1}`
      );

    let isRequestApproved = false;
    let isRequestDeclined = false;

    const inheritanceKeyRequestV2Model: any =
      dbV2.getInheritanceKeyRequestV2Model();
    let [request] = await inheritanceKeyRequestV2Model.find({ requestId });

    const requestHasWaitedFor = request ? Date.now() - request.arrivedAt : 0;
    let requestAutoApprovesIn = Math.max(
      config.INHERITANCE_KEY_REQUEST_THRESHOLD - requestHasWaitedFor,
      0
    );

    if (request) {
      // case: existing request
      if (request.status.isDeclined) isRequestDeclined = true;
      else
        isRequestApproved =
          request.status.isApproved || requestAutoApprovesIn === 0;
    } else {
      // case: new request
      const inheritanceKeyRequestInstance = new inheritanceKeyRequestV2Model({
        requestId,
        vaultId,
        arrivedAt: Date.now(),
        status: {
          isDeclined: false,
          isApproved: false,
        },
      });

      // send notification and email
      this.pushIKNotification(doc.policy.notification.targets, requestId);
      const emails = idx(doc.policy, (_) => _.alert.emails) || [];
      if (emails.length)
        this.sendEmailsViaMailer(emails, Mailer.EMAIL_TYPE.IKS_REQUEST, {requestId: request.requestId, requestAutoApprovesIn});

      await inheritanceKeyRequestInstance.save((err) => {
        if (err)
          throw new Error(`Error occured while saving to database: ${err}`);
      });
    }

    if (isRequestApproved) {
      const xIndex = doc.xIndex;
      const { xpub, masterFingerprint, derivationPath } =
        bitHyveWallet.getRandomXpub({ xIndex, inheritance: true, version: WalletCredsVersion.V2, isBIP85: false });

      if (!request.status.isApproved) {
        (request as InheritanceKeyRequestV2).status.isApproved = true;
        await request.save((err) => {
          if (err)
            throw new Error(`Error occured while saving to database: ${err}`);
        });
      }

      return {
        requestStatus: {
          approvesIn: requestAutoApprovesIn,
          isApproved: isRequestApproved,
          isDeclined: isRequestDeclined,
        },
        setupInfo: {
          inheritanceXpub: xpub,
          masterFingerprint,
          derivationPath,
          configuration: doc.configuration,
          policy: doc.policy,
        },
      };
    } else {
      return {
        requestStatus: {
          approvesIn: requestAutoApprovesIn,
          isApproved: isRequestApproved,
          isDeclined: isRequestDeclined,
        },
      };
    }
  };

  public declineInheritanceKeyRequest = async (
    requestId: string
  ): Promise<{
    declined: boolean;
  }> => {
    const inheritanceKeyRequestV2Model: any =
      dbV2.getInheritanceKeyRequestV2Model();
    let [doc] = await inheritanceKeyRequestV2Model.find({ requestId });
    if (!doc)
      throw new Error(`Inheritance key doesn't exists for ${requestId}`);

    if ((doc as InheritanceKeyRequestV2).status.isDeclined)
      return { declined: true }; // already declined
    else
      (doc as InheritanceKeyRequestV2).status = {
        ...doc.status,
        isDeclined: true,
      };

    await doc.save((err) => {
      if (err)
        throw new Error(`Error occured while saving to database: ${err}`);
    });
    return {
      declined: doc.status.isDeclined,
    };
  };

  public sendNotifications = async (): Promise<{
    sent: boolean;
  }> => {
    const inheritanceKeyRequestV2Model: any =
      dbV2.getInheritanceKeyRequestV2Model();
    let requests = await inheritanceKeyRequestV2Model.find({});
    if (!requests.length) return { sent: true };

    for (const request of requests) {
      if (request.status.isApproved || request.status.declined) continue; // case: request has already been approved/declined
      if (
        !request.status.isDeclined &&
        Date.now() - request.arrivedAt >
          config.INHERITANCE_KEY_REQUEST_THRESHOLD
      ) {
        (request as InheritanceKeyRequestV2).status.isApproved = true;
        await request.save((err) => {
          if (err)
            throw new Error(`Error occured while saving to database: ${err}`);
        });
        continue;
      } // case: crossed threshold, request is being marked as approved

      const inheritanceKeyV2Model: any = dbV2.getInheritanceKeyV2Model();
      const [doc] = await inheritanceKeyV2Model.find({
        vaultId: (request as InheritanceKeyRequestV2).vaultId,
      });
      this.pushIKNotification(
        (doc.policy as InheritancePolicy).notification.targets,
        request.requestId
      ); // send notification
    }

    return {
      sent: true,
    };
  };

  public sendIKRequestEmails = async (): Promise<{
    sent: boolean;
  }> => {
    const inheritanceKeyRequestV2Model: any =
      dbV2.getInheritanceKeyRequestV2Model();
    let requests = await inheritanceKeyRequestV2Model.find({});
    if (!requests.length) return { sent: true };

    for (const request of requests) {
      if (request.status.isApproved || request.status.declined) continue; // case: request has already been approved/declined
      if (
        !request.status.isDeclined &&
        Date.now() - request.arrivedAt >
          config.INHERITANCE_KEY_REQUEST_THRESHOLD
      ) {
        (request as InheritanceKeyRequestV2).status.isApproved = true;
        await request.save((err) => {
          if (err)
            throw new Error(`Error occured while saving to database: ${err}`);
        });
        continue;
      } // case: crossed threshold, request is being marked as approved

      const inheritanceKeyV2Model: any = dbV2.getInheritanceKeyV2Model();
      const [doc] = await inheritanceKeyV2Model.find({
        vaultId: (request as InheritanceKeyRequestV2).vaultId,
      });

      const emails = idx(doc.policy, (_) => _.alert.emails) || [];
      if (emails.length) {
        const requestHasWaitedFor = Date.now() - request.arrivedAt;
        let requestAutoApprovesIn = Math.max(
          config.INHERITANCE_KEY_REQUEST_THRESHOLD - requestHasWaitedFor,
          0
        );
        this.sendEmailsViaMailer(emails, Mailer.EMAIL_TYPE.IKS_REQUEST, {requestId: request.requestId, requestAutoApprovesIn});
      }
    }

    return {
      sent: true,
    };
  };
}

export default new InheritanceKeyServiceV2();
