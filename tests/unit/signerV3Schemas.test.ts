import * as schemas from "../../src/validators/signerV3Schemas";
import { VerificationType, PermittedAction, CosignersMapUpdateAction } from "../../src/interfaces/signer";

describe("signerV3Schemas Zod Schemas", () => {
  describe("SignerRestrictionSchema", () => {
    const { SignerRestrictionSchema } = schemas as any;
    it("validates correct object", () => {
      expect(() => SignerRestrictionSchema.parse({
        none: false,
        maxTransactionAmount: 1000,
        timeWindow: 3600,
      })).not.toThrow();
    });
    it("allows nulls for maxTransactionAmount and timeWindow", () => {
      expect(() => SignerRestrictionSchema.parse({
        none: true,
        maxTransactionAmount: null,
        timeWindow: null,
      })).not.toThrow();
    });
    it("fails for negative numbers", () => {
      expect(() => SignerRestrictionSchema.parse({
        none: false,
        maxTransactionAmount: -1,
        timeWindow: -10,
      })).toThrow();
    });
  });

  describe("SingerVerificationSchema", () => {
    const { SingerVerificationSchema } = schemas as any;
    it("validates correct method", () => {
      expect(() => SingerVerificationSchema.parse({ method: VerificationType.TWO_FA })).not.toThrow();
    });
    it("fails for missing method", () => {
      expect(() => SingerVerificationSchema.parse({})).toThrow();
    });
  });

  describe("SignerPolicySchema", () => {
    const { SignerPolicySchema } = schemas as any;
    it("validates correct object", () => {
      expect(() => SignerPolicySchema.parse({
        verification: { method: VerificationType.TWO_FA },
        restrictions: { none: false, maxTransactionAmount: 100, timeWindow: 60 },
        signingDelay: 10,
      })).not.toThrow();
    });
    it("allows null signingDelay", () => {
      expect(() => SignerPolicySchema.parse({
        verification: { method: VerificationType.TWO_FA },
        restrictions: { none: false, maxTransactionAmount: 100, timeWindow: 60 },
        signingDelay: null,
      })).not.toThrow();
    });
    it("fails for missing fields", () => {
      expect(() => SignerPolicySchema.parse({})).toThrow();
    });
  });

  describe("VerificationOptionSchema", () => {
    const { VerificationOptionSchema } = schemas as any;
    it("validates correct object", () => {
      expect(() => VerificationOptionSchema.parse({
        id: "abc",
        method: VerificationType.TWO_FA,
        label: "Email",
        permittedActions: [PermittedAction.SIGN_TRANSACTION],
      })).not.toThrow();
    });
    it("fails for empty permittedActions", () => {
      expect(() => VerificationOptionSchema.parse({
        id: "abc",
        method: VerificationType.TWO_FA,
        permittedActions: [],
      })).toThrow();
    });
    it("fails for missing id", () => {
      expect(() => VerificationOptionSchema.parse({
        method: VerificationType.TWO_FA,
        permittedActions: [PermittedAction.SIGN_TRANSACTION],
      })).toThrow();
    });
  });

  describe("CosignersMapUpdateSchema", () => {
    const { CosignersMapUpdateSchema } = schemas as any;
    it("validates correct object", () => {
      expect(() => CosignersMapUpdateSchema.parse({
        cosignersId: "cos1",
        signerId: "sig1",
        action: CosignersMapUpdateAction.ADD,
      })).not.toThrow();
    });
    it("fails for missing fields", () => {
      expect(() => CosignersMapUpdateSchema.parse({ signerId: "sig1", action: CosignersMapUpdateAction.ADD })).toThrow();
    });
  });

  describe("ChangeSchema", () => {
    const { ChangeSchema } = schemas as any;
    it("validates null", () => {
      expect(() => ChangeSchema.parse(null)).not.toThrow();
    });
    it("validates object with address and index", () => {
      expect(() => ChangeSchema.parse({ address: "addr", index: 0 })).not.toThrow();
    });
    it("allows missing address or index", () => {
      expect(() => ChangeSchema.parse({ address: "addr" })).not.toThrow();
      expect(() => ChangeSchema.parse({ index: 1 })).not.toThrow();
    });
    it("fails for negative index", () => {
      expect(() => ChangeSchema.parse({ index: -1 })).toThrow();
    });
  });

  describe("signerIdentifierSchema", () => {
    const { signerIdentifierSchema } = schemas as any;
    it("validates non-empty string", () => {
      expect(() => signerIdentifierSchema.parse("abc")).not.toThrow();
    });
    it("fails for empty string", () => {
      expect(() => signerIdentifierSchema.parse("")).toThrow();
    });
  });

  describe("verificationTokenSchema", () => {
    const { verificationTokenSchema } = schemas as any;
    it("validates 6-digit string", () => {
      expect(() => verificationTokenSchema.parse("123456")).not.toThrow();
    });
    it("validates 6-digit number", () => {
      expect(() => verificationTokenSchema.parse(123456)).not.toThrow();
    });
    it("fails for wrong length string", () => {
      expect(() => verificationTokenSchema.parse("12345")).toThrow();
    });
    it("fails for wrong length number", () => {
      expect(() => verificationTokenSchema.parse(12345)).toThrow();
    });
  });

  describe("setupSignerSchema", () => {
    const { setupSignerSchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => setupSignerSchema.parse({
        body: {
          policy: {
            verification: { method: VerificationType.TWO_FA },
            restrictions: { none: false, maxTransactionAmount: 100, timeWindow: 60 },
            signingDelay: 0,
          },
        },
      })).not.toThrow();
    });
    it("fails for missing policy", () => {
      expect(() => setupSignerSchema.parse({ body: {} })).toThrow();
    });
  });

  describe("validateSignerSetupSchema", () => {
    const { validateSignerSetupSchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => validateSignerSetupSchema.parse({
        body: { id: "abc", verificationToken: "123456" },
      })).not.toThrow();
    });
    it("fails for missing id", () => {
      expect(() => validateSignerSetupSchema.parse({ body: { verificationToken: "123456" } })).toThrow();
    });
  });

  describe("addSecondaryVerificationOptionSchema", () => {
    const { addSecondaryVerificationOptionSchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => addSecondaryVerificationOptionSchema.parse({
        body: {
          id: "abc",
          verificationToken: "123456",
          newOption: {
            id: "opt1",
            method: VerificationType.TWO_FA,
            permittedActions: [PermittedAction.SIGN_TRANSACTION],
          },
        },
      })).not.toThrow();
    });
    it("fails for missing newOption", () => {
      expect(() => addSecondaryVerificationOptionSchema.parse({ body: { id: "abc", verificationToken: "123456" } })).toThrow();
    });
  });

  describe("removeSecondaryVerificationOptionSchema", () => {
    const { removeSecondaryVerificationOptionSchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => removeSecondaryVerificationOptionSchema.parse({
        body: {
          id: "abc",
          verificationToken: "123456",
          optionId: "opt1",
        },
      })).not.toThrow();
    });
    it("fails for missing optionId", () => {
      expect(() => removeSecondaryVerificationOptionSchema.parse({ body: { id: "abc", verificationToken: "123456" } })).toThrow();
    });
  });

  describe("fetchSignerSetupSchema", () => {
    const { fetchSignerSetupSchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => fetchSignerSetupSchema.parse({
        body: { id: "abc", verificationToken: "123456" },
      })).not.toThrow();
    });
    it("fails for missing verificationToken", () => {
      expect(() => fetchSignerSetupSchema.parse({ body: { id: "abc" } })).toThrow();
    });
  });

  describe("fetchSignerSetupViaCosignersSchema", () => {
    const { fetchSignerSetupViaCosignersSchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => fetchSignerSetupViaCosignersSchema.parse({
        body: { cosignersId: "cos1", verificationToken: "123456" },
      })).not.toThrow();
    });
    it("fails for missing cosignersId", () => {
      expect(() => fetchSignerSetupViaCosignersSchema.parse({ body: { verificationToken: "123456" } })).toThrow();
    });
  });

  describe("updateBackupSettingSchema", () => {
    const { updateBackupSettingSchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => updateBackupSettingSchema.parse({
        body: { id: "abc", verifierDigest: "digest", disable: true },
      })).not.toThrow();
    });
    it("fails for missing verifierDigest", () => {
      expect(() => updateBackupSettingSchema.parse({ body: { id: "abc", disable: true } })).toThrow();
    });
  });

  describe("fetchBackupSchema", () => {
    const { fetchBackupSchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => fetchBackupSchema.parse({
        body: { id: "abc", verificationToken: "123456", publicKey: "pubkey" },
      })).not.toThrow();
    });
    it("fails for missing publicKey", () => {
      expect(() => fetchBackupSchema.parse({ body: { id: "abc", verificationToken: "123456" } })).toThrow();
    });
  });

  describe("checkSignerHealthSchema", () => {
    const { checkSignerHealthSchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => checkSignerHealthSchema.parse({
        body: { id: "abc", verificationToken: "123456" },
      })).not.toThrow();
    });
    it("fails for missing id", () => {
      expect(() => checkSignerHealthSchema.parse({ body: { verificationToken: "123456" } })).toThrow();
    });
  });

  describe("updateSignerPolicySchema", () => {
    const { updateSignerPolicySchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => updateSignerPolicySchema.parse({
        body: {
          id: "abc",
          verificationToken: "123456",
          updates: {
            restrictions: { none: false, maxTransactionAmount: 100, timeWindow: 60 },
            signingDelay: 0,
          },
        },
      })).not.toThrow();
    });
    it("fails for missing updates", () => {
      expect(() => updateSignerPolicySchema.parse({ body: { id: "abc", verificationToken: "123456" } })).toThrow();
    });
  });

  describe("updateCosignersToSignerMapSchema", () => {
    const { updateCosignersToSignerMapSchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => updateCosignersToSignerMapSchema.parse({
        body: {
          cosignersMapUpdates: [
            { cosignersId: "cos1", signerId: "sig1", action: CosignersMapUpdateAction.ADD },
          ],
        },
      })).not.toThrow();
    });
    it("fails for empty cosignersMapUpdates", () => {
      expect(() => updateCosignersToSignerMapSchema.parse({ body: { cosignersMapUpdates: [] } })).toThrow();
    });
  });

  describe("signTransactionSchema", () => {
    const { signTransactionSchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => signTransactionSchema.parse({
        body: {
          id: "abc",
          serializedPSBT: "psbt",
          verificationToken: "123456",
          change: null,
          descriptor: "desc",
        },
      })).not.toThrow();
    });
    it("fails for missing serializedPSBT", () => {
      expect(() => signTransactionSchema.parse({ body: { id: "abc", verificationToken: "123456", descriptor: "desc" } })).toThrow();
    });
  });

  describe("cancelDelayedTransactionSchema", () => {
    const { cancelDelayedTransactionSchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => cancelDelayedTransactionSchema.parse({
        body: { signerId: "abc", txid: "txid", verificationToken: "123456" },
      })).not.toThrow();
    });
    it("fails for missing txid", () => {
      expect(() => cancelDelayedTransactionSchema.parse({ body: { signerId: "abc", verificationToken: "123456" } })).toThrow();
    });
  });

  describe("fetchSignedDelayedTransactionSchema", () => {
    const { fetchSignedDelayedTransactionSchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => fetchSignedDelayedTransactionSchema.parse({
        body: { txid: "txid", verificationToken: "123456" },
      })).not.toThrow();
    });
    it("fails for missing verificationToken", () => {
      expect(() => fetchSignedDelayedTransactionSchema.parse({ body: { txid: "txid" } })).toThrow();
    });
  });

  describe("fetchDelayedPolicyUpdateSchema", () => {
    const { fetchDelayedPolicyUpdateSchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => fetchDelayedPolicyUpdateSchema.parse({
        body: { policyId: "pid", verificationToken: "123456" },
      })).not.toThrow();
    });
    it("fails for missing policyId", () => {
      expect(() => fetchDelayedPolicyUpdateSchema.parse({ body: { verificationToken: "123456" } })).toThrow();
    });
  });

  describe("migrateSignerPolicySchema", () => {
    const { migrateSignerPolicySchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => migrateSignerPolicySchema.parse({
        body: { id: "abc", oldPolicy: {} },
      })).not.toThrow();
    });
    it("fails for missing id", () => {
      expect(() => migrateSignerPolicySchema.parse({ body: { oldPolicy: {} } })).toThrow();
    });
  });

  describe("migrateSignersV2ToV3Schema", () => {
    const { migrateSignersV2ToV3Schema } = schemas as any;
    it("validates correct body", () => {
      expect(() => migrateSignersV2ToV3Schema.parse({
        body: {
          cosignersMapUpdates: [
            { cosignersId: "cos1", signerId: "sig1", action: CosignersMapUpdateAction.ADD },
          ],
        },
      })).not.toThrow();
    });
    it("fails for missing cosignersMapUpdates", () => {
      expect(() => migrateSignersV2ToV3Schema.parse({ body: {} })).toThrow();
    });
  });

  describe("enrichCosignersToSignerMapSchema", () => {
    const { enrichCosignersToSignerMapSchema } = schemas as any;
    it("validates correct body", () => {
      expect(() => enrichCosignersToSignerMapSchema.parse({
        body: {
          id: "abc",
          cosignersMapUpdates: [
            { cosignersId: "cos1", signerId: "sig1", action: CosignersMapUpdateAction.ADD },
          ],
        },
      })).not.toThrow();
    });
    it("fails for missing cosignersMapUpdates", () => {
      expect(() => enrichCosignersToSignerMapSchema.parse({ body: { id: "abc" } })).toThrow();
    });
  });
});
