import config from "../../config";
import moment from "moment";
import AWS from "aws-sdk";
import { EMAIL_TEMPLATES } from "./templates";

const SES_CONFIG = {
  accessKeyId: config.MAILER_CONFIG.ACCESS_KEY_ID,
  secretAccessKey: config.MAILER_CONFIG.SECRET_ACCESS_KEY,
  region: config.MAILER_CONFIG.SES_REGION,
};
const AWS_SES = new AWS.SES(SES_CONFIG);

export function formatDuration(ms) {
  const duration = moment.duration(ms);
  return (
    Math.floor(duration.asHours()) +
    moment.utc(duration.asMilliseconds()).format(":mm:ss")
  );
}

export enum EMAIL_TYPE {
  IKS_SETUP = "IKS_SETUP",
  IKS_REQUEST = "IKS_REQUEST",
  ONE_TIME_BACKUP = "ONE_TIME_BACKUP",
  SIGN_TRANSACTION = "SIGN_TRANSACTION",
}

const fetchEmailContentByType = (
  type: EMAIL_TYPE,
  options: {
    requestId?: string;
    requestAutoApprovesIn?: number;
  }
): { subject: string; html: string } => {
  switch (type) {
    case EMAIL_TYPE.IKS_SETUP:
      return {
        subject: "Bitcoin Keeper - Inheritance Key Setup Confirmation",
        html: EMAIL_TEMPLATES.IKS_SETUP,
      };

    case EMAIL_TYPE.IKS_REQUEST:
    case EMAIL_TYPE.ONE_TIME_BACKUP:
    case EMAIL_TYPE.SIGN_TRANSACTION:

      let template; let subject;
      if(type === EMAIL_TYPE.ONE_TIME_BACKUP) {
        template = EMAIL_TEMPLATES.ONE_TIME_BACKUP;
        subject ="Bitcoin Keeper - Inheritance Key One Time Backup Request"
      }
      else if (type === EMAIL_TYPE.SIGN_TRANSACTION) {
        template = EMAIL_TEMPLATES.SIGN_TRANSACTION
        subject = "Bitcoin Keeper - Inheritance Key Signing Request"
      }
      else {
        template = EMAIL_TEMPLATES.IKS_REQUEST;
        subject = "Bitcoin Keeper - Inheritance Key Request"
      }

      return {
        subject,
        html: template.replace(
          new RegExp("{{requestId}}", "g"),
          options.requestId
        )
          .replace(
            "{{server_url}}",
            config.ENVIRONMENT === "MAIN"
              ? "https://sign.bithyve.com"
              : "https://dev-sign.bithyve.com"
          )
          .replace(
            "{{requestAutoApprovesIn}}",
            formatDuration(options.requestAutoApprovesIn)
          ),
      };

    default:
      throw new Error("Invalid EmailType");
  }
};

export const sendEmails = (
  recipientEmails: string[],
  type: EMAIL_TYPE,
  options: {
    requestId?: string;
    requestAutoApprovesIn?: number;
  }
) => {
  const { subject, html } = fetchEmailContentByType(type, options);

  let params = {
    Source: config.MAILER_CONFIG.SOURCE_EMAIL,
    Destination: {
      ToAddresses: recipientEmails,
    },
    ReplyToAddresses: [],
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: html,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: subject,
      },
    },
  };
  return AWS_SES.sendEmail(params).promise();
};
