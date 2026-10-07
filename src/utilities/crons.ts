import cron from "node-cron";
import inheritanceKeyV2 from "../services/assistedKeys.ts/inheritance/inheritanceKeyV2";
import inheritanceKeyV3 from "../services/assistedKeys.ts/inheritance/inheritanceKeyV3";
import { logger } from "./logger";
import signerV3 from "../services/assistedKeys.ts/ss-signer/signerV3";

const notificationIKCron = () => {
  // IK notification job v3: runs every Saturday at 1 am
  cron.schedule("0 1 * * 6", async () => {
    try {
      logger.info(`------------- Running cron: notificationIK V3------------- ${Date()}`);
      const { sent, count } = await inheritanceKeyV3.sendNotifications();
      if (!sent) throw new Error("Unable to send notification IK V3");
      logger.info(`------------- Sent ${count} IK notifications V3------------- ${Date()}`);
    } catch (err) {
      logger.error("Inheritance V3 notification job failed");
    }
  });

  // IK notification job v2: runs every Sunday at 1 am
  cron.schedule("0 1 * * 0", async () => {
    try {
      logger.info(`------------- Running cron: notificationIK V2------------- ${Date()}`);
      const { sent } = await inheritanceKeyV2.sendNotifications();
      if (!sent) throw new Error("Unable to send notification IK V2");
      logger.info(`------------- Sent IK notifications V2------------- ${Date()}`);
    } catch (err) {
      logger.error("Inheritance V2 notification job failed");
    }
  });
};

const emailIKCron = () => {
  // IK email job v3: runs every Saturday at 1:30 am
  cron.schedule("30 1 * * 6", async () => {
    try {
      logger.info(`------------- Running cron: emailIK V3------------- ${Date()}`);
      const { sent, count } = await inheritanceKeyV3.sendIKRequestEmails();
      if (!sent) throw new Error("Unable to send emails V3");
      logger.info(`------------- Sent ${count} IK emails V3------------- ${Date()}`);
    } catch (err) {
      logger.error("Inheritance V3 email job failed");
    }
  });

  // IK email job v2: runs every Sunday at 1:30 am
  cron.schedule("30 1 * * 0", async () => {
    try {
      logger.info(`------------- Running cron: emailIK V2------------- ${Date()}`);
      const { sent } = await inheritanceKeyV2.sendIKRequestEmails();
      if (!sent) throw new Error("Unable to send emails V2");
      logger.info(`------------- Sent IK emails V2------------- ${Date()}`);
    } catch (err) {
      logger.error("Inheritance V2 email job failed");
    }
  });
};

const processDelayedTransactionsCron = () => {
  cron.schedule("*/10 * * * *", async () => {
    try {
      logger.info(`------------- Running cron: process delayed txs------------- ${Date()}`);
      await signerV3.processDelayedTransactions(); 
      logger.info(`------------- Processed delayed transactions------------- ${Date()}`);
    } catch (err) {
      logger.error("Delayed transaction job failed");
    }
  });
};

const processDelayedPolicyUpdatesCron = () => {
  // Run every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    try {
      logger.info(`------------- Running cron: process delayed policy updates ------------- ${Date()}`);
      await signerV3.processDelayedPolicyUpdates();
      logger.info(`------------- Processed delayed policy updates ------------- ${Date()}`);
    } catch (err) {
      logger.error("Delayed policy update job failed");
    }
  });
};


export const initializeCrons = () => {
  notificationIKCron();
  emailIKCron();
  processDelayedTransactionsCron();
  processDelayedPolicyUpdatesCron();
};
