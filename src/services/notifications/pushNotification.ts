import axios from "axios";
import { logger } from "../../utilities/logger";
import config from "../../config";
import { InheritanceKeyRequestV3Types } from "../../interfaces/inheritance";

export enum NOTIFICATION_TYPE {
  IKS_SETUP = "IKS_SETUP",
  IKS_REQUEST = "IKS_REQUEST",
  ONE_TIME_BACKUP = "ONE_TIME_BACKUP",
  SIGN_TRANSACTION = "SIGN_TRANSACTION",
  SIGNED_DELAYED_TRANSACTION = "SIGNED_DELAYED_TRANSACTION",
  POLICY_UPDATE_APPLIED = "POLICY_UPDATE_APPLIED"
}

export const getNotificationType = (
  requestType: InheritanceKeyRequestV3Types
) => {
  let notificationType: NOTIFICATION_TYPE;
  switch (requestType) {
    case InheritanceKeyRequestV3Types.RECOVER_KEY:
      notificationType = NOTIFICATION_TYPE.IKS_REQUEST;
      break;
    case InheritanceKeyRequestV3Types.ONE_TIME_BACKUP:
      notificationType = NOTIFICATION_TYPE.ONE_TIME_BACKUP;
      break;
    case InheritanceKeyRequestV3Types.SIGN_TRANSACTION:
      notificationType = NOTIFICATION_TYPE.SIGN_TRANSACTION;
      break;
    default:
      notificationType = NOTIFICATION_TYPE.IKS_REQUEST;
  }
  return notificationType;
};

const fetchNotificationContentByType = (
  pushNotificationType: NOTIFICATION_TYPE,
  options: {
    requestId: string;
    requestAutoApprovesIn?: number;
  }
) => {
  const { requestId, requestAutoApprovesIn } = options;
  let title;
  let body;

  switch (pushNotificationType) {
    case NOTIFICATION_TYPE.IKS_SETUP:
      title = "Inheritance Key Setup Confirmation";
      body = `Your inheritance key has been setup successfully`;
      break;
    case NOTIFICATION_TYPE.IKS_REQUEST:
      title = "Inheritance Key Request";
      body = `You've a request from heir to inherit IK: ${requestId}`;
      break;
    case NOTIFICATION_TYPE.ONE_TIME_BACKUP:
      title = "Inheritance Key One Time Backup Request";
      body = `You've a request for fetching the one time backup: ${requestId}`;
      break;
    case NOTIFICATION_TYPE.SIGN_TRANSACTION:
      title = "Inheritance Key Signing Request";
      body = `You've a request for signing a transaction: ${requestId}`;
      break;

    default:
      title = "Inheritance Key Request";
      body = `You've a request from heir to inherit IK : ${requestId}`;
  }

  return {
    notificationType: "unread",
    title,
    body,
    data: {
      type: pushNotificationType,
      reqId: requestId,
    },
  };
};

export const pushIKNotification = async (
  FCMs: string[],
  notificationType: NOTIFICATION_TYPE,
  options: {
    requestId: string;
    requestAutoApprovesIn?: number;
  }
) => {
  try {
    const requestData = {
      FCMs,
      notification: fetchNotificationContentByType(notificationType, options),
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
    logger.error("Inheritance notification delivery failed");
  }
};

export const pushServerKeyNotification = async (
  FCMs: string[],
  notificationType: NOTIFICATION_TYPE,
  options: {
    id: string;
    signedTx?: string;
  }
) => {
  try {
    let title;
    let body;
    switch (notificationType) {
      case NOTIFICATION_TYPE.SIGNED_DELAYED_TRANSACTION:
        title = "Transaction Signed by Server Key";
        body = `Your delayed transaction has been signed successfully`;
        break;

      default:
        throw new Error("Unsupported Notification Type");
    }

    const notification = {
      notificationType: "unread",
      title,
      body,
      data: {
        type: notificationType,
        id: options.id,
        signedTx: options.signedTx,
      },
    };

    const requestData = {
      FCMs,
      notification,
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
    logger.error("Server Key notification delivery failed");
  }
};
