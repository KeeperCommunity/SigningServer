jest.mock("axios", () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock("node-cron", () => ({ __esModule: true, default: { schedule: jest.fn() } }));
jest.mock("../../src/services/assistedKeys.ts/inheritance/inheritanceKeyV2", () => ({
  __esModule: true, default: {
    sendNotifications: jest.fn(async () => { throw Error("synthetic-private-data-canary"); }),
    sendIKRequestEmails: jest.fn(async () => { throw Error("synthetic-private-data-canary"); }),
  },
}));
jest.mock("../../src/services/assistedKeys.ts/inheritance/inheritanceKeyV3", () => ({
  __esModule: true, default: {
    sendNotifications: jest.fn(async () => { throw Error("synthetic-private-data-canary"); }),
    sendIKRequestEmails: jest.fn(async () => { throw Error("synthetic-private-data-canary"); }),
  },
}));
jest.mock("../../src/services/assistedKeys.ts/ss-signer/signerV3", () => ({
  __esModule: true, default: {
    processDelayedTransactions: jest.fn(async () => { throw Error("synthetic-private-data-canary"); }),
    processDelayedPolicyUpdates: jest.fn(async () => { throw Error("synthetic-private-data-canary"); }),
  },
}));

import axios from "axios";
import cron from "node-cron";
import { initializeCrons } from "../../src/utilities/crons";
import { logger } from "../../src/utilities/logger";
import { pushIKNotification, pushServerKeyNotification, NOTIFICATION_TYPE } from "../../src/services/notifications/pushNotification";

describe("operational log privacy", () => {
  const canary = "synthetic-private-data-canary";
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

  it("logs a category for every failed scheduled job without exception contents", async () => {
    const errorLog = jest.spyOn(logger, "error").mockImplementation(() => logger);
    jest.spyOn(logger, "info").mockImplementation(() => logger);
    initializeCrons();
    const callbacks = (cron.schedule as jest.Mock).mock.calls.map(call => call[1]);
    expect(callbacks).toHaveLength(6);
    for (const callback of callbacks) await callback();
    expect(errorLog).toHaveBeenCalledTimes(6);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(canary);
  });

  it("does not log notification identifiers or underlying provider errors", async () => {
    const errorLog = jest.spyOn(logger, "error").mockImplementation(() => logger);
    (axios.post as jest.Mock).mockRejectedValue(new Error(canary));
    await pushIKNotification(["synthetic-token"], NOTIFICATION_TYPE.IKS_REQUEST, { requestId: canary, requestAutoApprovesIn: 60000 });
    await pushServerKeyNotification(["synthetic-token"], NOTIFICATION_TYPE.POLICY_UPDATE_APPLIED, { id: canary });
    expect(errorLog).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(canary);
  });
});
