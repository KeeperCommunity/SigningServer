import SignerV3 from "../../src/services/assistedKeys.ts/ss-signer/signerV3";
import dbV2 from "../../src/databases/dbV2";
import bitHyveWallet from "../../src/wallet/bithyve";
import {
  CosignersMapUpdateAction,
  VerificationType,
  PermittedAction,
} from "../../src/interfaces/signer";
import BIP32Factory from "bip32";
import * as ecc from "tiny-secp256k1";
import * as bip39 from "bip39";
import config from "../../src/config";
import { authenticator } from "otplib";
import { WalletCredsVersion } from "../../src/interfaces/wallet";
import {
  asymmetricDecrypt,
  generateRSAKeyPair,
} from "../../src/utilities/encryption";
const bip32 = BIP32Factory(ecc);

jest.mock("mongoose", () => ({
  Schema: jest.fn(),
  model: jest.fn(),
  connect: jest.fn(),
  createConnection: jest.fn(),
  Types: { ObjectId: jest.fn(), Decimal128: { fromString: jest.fn() } },
}));
jest.mock("../../src/databases/dbV2");
jest.mock("google-auth-library", () => {
  return {
    GoogleAuth: jest.fn().mockImplementation(() => ({
      getClient: jest.fn().mockResolvedValue({
        getRequestMetadata: jest.fn().mockResolvedValue({}),
      }),
      getApplicationDefaultAsync: jest.fn().mockResolvedValue({}),
    })),
  };
});

const generateMockServerKeyDoc = ({
  policy,
  isBIP85 = true,
}: {
  policy?: any;
  isBIP85?: boolean;
}) => {
  const doc = {
    id: mockSigner.xfp,
    isBIP85,
    credsVersion: WalletCredsVersion.V3,
    xIndex: mockSigner.xIndex,
    policy: policy,
  };

  return {
    save: jest.fn((cb) => cb && cb()),
    toObject: jest.fn(function () {
      return this;
    }),
    ...doc,
  };
};

const generateVerificationToken = (signer) =>
  authenticator.generate(signer.signerPolicy.verification.verifier);

const mnemonic =
  "absent beauty three bronze reduce runway oil girl decide juice point cruel";
const seed = bip39.mnemonicToSeedSync(mnemonic);
const root = bip32.fromSeed(seed, config.NETWORK);
const mockWalletCreds = { mnemonic, seed, root };
const mockSigner = {
  xpub: "tpubDERPm4XUYBFJXrA1h3cUQyhZhVXiDkjRRQXJiaSFnqwXnucEseRVcqC99fYgGxZaPEE5ZZu3nKEoW2pVGz2obWBVnpS9Noncs7kw5QkF51q",
  derivationPath: "m/48'/1'/0'/2'",
  masterFingerprint: "3EE66DDF",
  signerType: "SignerType.POLICY_SERVER",
  storageType: "SignerStorage.WARM",
  isMultisig: true,
  xfp: "CBEBA4AD",
  isBIP85: true,
  signerPolicy: {
    verification: {
      method: VerificationType.TWO_FA,
      verifier: "NZDA2HBHGIQSSUCY", // mock store: not available on actual signer @Keeper
    },
    restrictions: {
      maxTransactionAmount: 10000,
      timeWindow: 1800000,
      none: false,
    },
    signingDelay: 300000,
    secondaryVerification: [],
  },
  xIndex: 939810192, // mock store: not available on actual signer @Keeper
  backupMnemonic:
    "item danger music green leg blush staff love cushion hammer midnight festival", // mock store: not available on actual signer @Keeper
};

describe("SignerV3", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("setupSigner", () => {
    it("should setup a new signer and return setup data", async () => {
      const save = jest.fn((cb) => cb && cb());
      const getWalletCreds = jest
        .spyOn(bitHyveWallet, "getWalletCreds")
        .mockReturnValue(mockWalletCreds);
      const signerV3Model = jest
        .fn()
        .mockImplementation((data) => ({ ...data, save }));
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue(signerV3Model);
      const policy = { ...mockSigner.signerPolicy };
      const result = await SignerV3.setupSigner(policy);
      expect(result.setupSuccessful).toBe(true);
      expect(result.setupData).toEqual({
        id: expect.any(String),
        isBIP85: true,
        bhXpub: expect.any(String),
        masterFingerprint: expect.any(String),
        derivationPath: expect.any(String),
        verification: expect.any(Object),
      });
      expect(result.setupData.verification.verifier).toEqual(
        expect.any(String)
      );
      expect(save).toHaveBeenCalled();
      getWalletCreds.mockRestore();
    });
    it("should throw if policy.exceptions is set", async () => {
      await expect(
        SignerV3.setupSigner({
          ...mockSigner.signerPolicy,
          exceptions: { none: false },
        })
      ).rejects.toThrow("Update required");
    });
  });

  describe("validateSignerSetup", () => {
    it("should validate setup with correct token", async () => {
      const doc = generateMockServerKeyDoc({ policy: mockSigner.signerPolicy });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      const result = await SignerV3.validateSignerSetup(
        mockSigner.xfp,
        generateVerificationToken(mockSigner)
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("addSecondaryVerificationOption", () => {
    it("should add a new secondary verification option", async () => {
      const doc = generateMockServerKeyDoc({
        policy: { ...mockSigner.signerPolicy, secondaryVerification: [] },
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      const result = await SignerV3.addSecondaryVerificationOption(
        mockSigner.xfp,
        generateVerificationToken(mockSigner),
        {
          id: "opt1",
          label: "Sec Sign",
          method: VerificationType.TWO_FA,
          permittedActions: [PermittedAction.SIGN_TRANSACTION],
        }
      );
      expect(result.success).toBe(true);
      expect(result.secondaryVerificationOption.verifier).toEqual(
        expect.any(String)
      );
    });
    it("should throw if verification fails", async () => {
      const doc = generateMockServerKeyDoc({
        policy: { ...mockSigner.signerPolicy, secondaryVerification: [] },
      });

      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      await expect(
        SignerV3.addSecondaryVerificationOption(mockSigner.xfp, "123245", {
          id: "opt1",
          label: "Sec Sign",
          method: VerificationType.TWO_FA,
          permittedActions: [PermittedAction.SIGN_TRANSACTION],
        })
      ).rejects.toThrow("Validation token is either invalid or has expired");
    });
    it("should throw if missing id/method", async () => {
      const doc = generateMockServerKeyDoc({
        policy: { ...mockSigner.signerPolicy, secondaryVerification: [] },
      });

      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      await expect(
        SignerV3.addSecondaryVerificationOption(
          mockSigner.xfp,
          generateVerificationToken(mockSigner),
          {
            id: "",
            method: undefined as any,
            permittedActions: [PermittedAction.SIGN_TRANSACTION],
          }
        )
      ).rejects.toThrow("Missing secondary verification");
    });
    it("should throw if permittedActions missing", async () => {
      const doc = generateMockServerKeyDoc({ policy: { ...mockSigner.signerPolicy, secondaryVerification: [] } });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      await expect(
        SignerV3.addSecondaryVerificationOption(
          mockSigner.xfp,
          generateVerificationToken(mockSigner),
          { id: "x", method: VerificationType.TWO_FA, permittedActions: [] }
        )
      ).rejects.toThrow("Missing secondary verification");
    });
    it("should throw if permittedActions invalid", async () => {
      const doc = generateMockServerKeyDoc({ policy: { ...mockSigner.signerPolicy, secondaryVerification: [] } });


      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      await expect(
        SignerV3.addSecondaryVerificationOption(
          mockSigner.xfp,
          generateVerificationToken(mockSigner),
          {
            id: "x",
            method: VerificationType.TWO_FA,
            permittedActions: ["INVALID"] as any,
          }
        )
      ).rejects.toThrow("Invalid secondary verification");
    });
    it("should throw if option already exists", async () => {
      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          secondaryVerification: [
            {
              id: "opt1",
              method: VerificationType.TWO_FA,
              verifier: "v",
              permittedActions: [PermittedAction.SIGN_TRANSACTION],
            },
          ],
        }
      });


      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      await expect(
        SignerV3.addSecondaryVerificationOption(
          mockSigner.xfp,
          generateVerificationToken(mockSigner),
          {
            id: "opt1",
            method: VerificationType.TWO_FA,
            permittedActions: [PermittedAction.SIGN_TRANSACTION],
          }
        )
      ).rejects.toThrow("Verification option already exists");
    });
  });

  describe("removeSecondaryVerificationOption", () => {
    it("should remove a secondary verification option", async () => {

      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          secondaryVerification: [
            {
              id: "opt1",
              method: VerificationType.TWO_FA,
              verifier: "L43HWNYZMF4BMMZD",
              permittedActions: [],
            },
          ],
        }
      });


      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      const result = await SignerV3.removeSecondaryVerificationOption(
        mockSigner.xfp,
        generateVerificationToken(mockSigner),
        "opt1"
      );
      expect(result.success).toBe(true);
    });
    it("should throw if a non-primary/secondary verification code is used", async () => {


      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          secondaryVerification: [
            {
              id: "opt1",
              method: VerificationType.TWO_FA,
              verifier: "L43HWNYZMF4BMMZD",
              permittedActions: [],
            },
          ],
        }
      });


      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      await expect(
        SignerV3.removeSecondaryVerificationOption(
          mockSigner.xfp,
          authenticator.generate("L43HWNYZMF4BMMZD"),
          "opt1"
        )
      ).rejects.toThrow("Validation token is either invalid or has expired");
    });
    it("should throw if option not found", async () => {
      const doc = generateMockServerKeyDoc({
        policy: { ...mockSigner.signerPolicy, secondaryVerification: [] },
      });

      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      await expect(
        SignerV3.removeSecondaryVerificationOption(
          mockSigner.xfp,
          generateVerificationToken(mockSigner),
          "opt1"
        )
      ).rejects.toThrow("Verification option not found");
    });
    it("should throw if no secondaryVerification", async () => {
      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          secondaryVerification: undefined,
        }
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      await expect(
        SignerV3.removeSecondaryVerificationOption(
          mockSigner.xfp,
          generateVerificationToken(mockSigner),
          "opt1"
        )
      ).rejects.toThrow("No secondary verification options");
    });
  });

  describe("fetchSignerSetup", () => {
    const mockSecondaryVerification = [
      {
        id: "opt1",
        method: VerificationType.TWO_FA,
        verifier: "L43HWNYZMF4BMMZD",
        permittedActions: [PermittedAction.SIGN_TRANSACTION],
      },
    ];
    
    it("should fetch signer setup with valid token", async () => {
            const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          secondaryVerification: mockSecondaryVerification,
          toObject: function () {
            return this;
          },
        },
      });

      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      const getWalletCreds = jest
        .spyOn(bitHyveWallet, "getWalletCreds")
        .mockReturnValue(mockWalletCreds);
      const result = await SignerV3.fetchSignerSetup(
        mockSigner.xfp,
        generateVerificationToken(mockSigner)
      );

      expect(result.valid).toEqual(true);
      expect(result.id).toEqual(mockSigner.xfp);
      expect(result.masterFingerprint).toEqual(mockSigner.masterFingerprint);

      expect(result.policy?.restrictions).toEqual(
        mockSigner.signerPolicy.restrictions
      );
      expect(result.policy?.signingDelay).toEqual(
        mockSigner.signerPolicy.signingDelay
      );
      expect(result.linkedViaSecondary).toBe(false);

      const expectedSecondaryVerification = {
        ...mockSecondaryVerification[0],
        verifier: null,
      };
      expect(result.policy?.secondaryVerification).toEqual([
        expectedSecondaryVerification,
      ]);
      expect(result.policy?.verification).toEqual({
        method: VerificationType.TWO_FA,
        verifier: null,
      });
      getWalletCreds.mockRestore();
    });
    it("should return valid: false if verification fails", async () => {

            const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          secondaryVerification: mockSecondaryVerification,
          toObject: function () {
            return this;
          },
        },
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      const getWalletCreds = jest
        .spyOn(bitHyveWallet, "getWalletCreds")
        .mockReturnValue(mockWalletCreds);
      const result = await SignerV3.fetchSignerSetup(mockSigner.xfp, "101010");
      expect(result).toEqual({
        valid: false,
        id: undefined,
        isBIP85: undefined,
        bhXpub: undefined,
        masterFingerprint: undefined,
        derivationPath: undefined,
      });
      getWalletCreds.mockRestore();
    });
    it("should fetch signer setup with valid secondary token", async () => {
             const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          secondaryVerification: mockSecondaryVerification,
          toObject: function () {
            return this;
          },
        },
      });
      
 
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      const getWalletCreds = jest
        .spyOn(bitHyveWallet, "getWalletCreds")
        .mockReturnValue(mockWalletCreds);
      const result = await SignerV3.fetchSignerSetup(
        mockSigner.xfp,
        authenticator.generate(mockSecondaryVerification[0].verifier)
      );
      expect(result.valid).toEqual(true);
      expect(result.id).toEqual(mockSigner.xfp);
      expect(result.masterFingerprint).toEqual(mockSigner.masterFingerprint);

      expect(result.policy?.restrictions).toEqual(
        mockSigner.signerPolicy.restrictions
      );
      expect(result.policy?.signingDelay).toEqual(
        mockSigner.signerPolicy.signingDelay
      );
      expect(result.linkedViaSecondary).toBe(true);
      expect(result.policy?.secondaryVerification).toEqual([]);
      expect(result.policy?.verification).toEqual({
        method: VerificationType.TWO_FA,
        verifier: null,
      });
      getWalletCreds.mockRestore();
    });
  });

  describe("updateSignerPolicy", () => {
    it("should update policy immediately(restrictive policy updates)", async () => {
      const delayedPolicyUpdateModel = function (data: any) {
        return {
          ...data,
          save: jest.fn((cb) => cb && cb()),
        };
      };
      delayedPolicyUpdateModel.find = jest.fn().mockResolvedValue([undefined]);
      (dbV2.getDelayedPolicyUpdateModel as jest.Mock).mockReturnValue(
        delayedPolicyUpdateModel
      );
      const result = await SignerV3.updateSignerPolicy(
        mockSigner.xfp,
        {
          restrictions: {
            ...mockSigner.signerPolicy.restrictions,
            maxTransactionAmount: 2000,
          },
          signingDelay: mockSigner.signerPolicy.signingDelay,
        },
        generateVerificationToken(mockSigner)
      );

      expect(result.updated).toBe(true);
    });
    it("should return delayed policy update object(permissive policy updates)", async () => {
      const delayedPolicyUpdateModel = function (data: any) {
        return {
          ...data,
          save: jest.fn((cb) => cb && cb()),
        };
      };
      delayedPolicyUpdateModel.find = jest.fn().mockResolvedValue([undefined]);
      (dbV2.getDelayedPolicyUpdateModel as jest.Mock).mockReturnValue(
        delayedPolicyUpdateModel
      );

      const policyUpdates = {
        restrictions: {
          ...mockSigner.signerPolicy.restrictions,
          maxTransactionAmount:
            mockSigner.signerPolicy.restrictions.maxTransactionAmount + 10000,
        },
        signingDelay: mockSigner.signerPolicy.signingDelay,
      };
      const verificationToken = generateVerificationToken(mockSigner);
      const result = await SignerV3.updateSignerPolicy(
        mockSigner.xfp,
        policyUpdates,
        verificationToken
      );

      expect(result.updated).toBe(false);
      expect(result.delayedPolicyUpdate).toEqual({
        policyId: expect.any(String),
        signerId: mockSigner.xfp,
        policyUpdates,
        verificationToken,
        timestamp: expect.any(Number),
        delayUntil: expect.any(Number),
        FCM: undefined,
      });
    });
    it("should throw if verification fails", async () => {
      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          toObject: function () {
            return this;
          },
        },
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      await expect(
        SignerV3.updateSignerPolicy(
          mockSigner.xfp,
          {
            restrictions: {
              ...mockSigner.signerPolicy.restrictions,
              maxTransactionAmount: 2000,
            },
            signingDelay: mockSigner.signerPolicy.signingDelay,
          },
          "111111"
        )
      ).rejects.toBeTruthy();
    });
    it("should throw if verification settings are overridden", async () => {
      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          toObject: function () {
            return this;
          },
        },
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      await expect(
        SignerV3.updateSignerPolicy(
          mockSigner.xfp,
          {
            restrictions: mockSigner.signerPolicy.restrictions,
            signingDelay: 0,
            verification: {},
          } as any,
          generateVerificationToken(mockSigner)
        )
      ).rejects.toThrow("Verification settings cannot be overridden");
    });
    it("should throw if delayed policy update exists", async () => {
      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          toObject: function () {
            return this;
          },
        },
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      const delayedPolicyUpdateModel = {
        find: jest.fn().mockResolvedValue([{ isApplied: false }]),
      };
      (dbV2.getDelayedPolicyUpdateModel as jest.Mock).mockReturnValue(
        delayedPolicyUpdateModel
      );
      await expect(
        SignerV3.updateSignerPolicy(
          mockSigner.xfp,
          {
            restrictions: mockSigner.signerPolicy.restrictions,
            signingDelay: 0,
          },
          generateVerificationToken(mockSigner)
        )
      ).rejects.toThrow("A policy update(delayed) is already being processed");
    });
  });

  describe("fetchBackup", () => {
    const mockKeyPair = generateRSAKeyPair();

    it("should fetch backup if allowed", async () => {
      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          toObject: function () {
            return this;
          },
        },
      });

      const getWalletCreds = jest
        .spyOn(bitHyveWallet, "getWalletCreds")
        .mockReturnValue(mockWalletCreds);
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      const result = await SignerV3.fetchBackup(
        mockSigner.xfp,
        generateVerificationToken(mockSigner),
        mockKeyPair.publicKey
      );
      expect(result.encryptedBackup).toEqual(expect.any(String));
      expect(
        JSON.parse(
          asymmetricDecrypt(result.encryptedBackup, mockKeyPair.privateKey)
        ).mnemonic
      ).toEqual(mockSigner.backupMnemonic);
      getWalletCreds.mockRestore();
    });
    it("should throw if not BIP85", async () => {
      const doc = generateMockServerKeyDoc({
        isBIP85: false,
        policy: {
          ...mockSigner.signerPolicy,
          toObject: function () {
            return this;
          },
        },
      });
      const getWalletCreds = jest
        .spyOn(bitHyveWallet, "getWalletCreds")
        .mockReturnValue(mockWalletCreds);
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      await expect(
        SignerV3.fetchBackup(
          mockSigner.xfp,
          generateVerificationToken(mockSigner),
          mockKeyPair.publicKey
        )
      ).rejects.toBeTruthy();
      getWalletCreds.mockRestore();
    });
    it("should throw if backup is disabled", async () => {
      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          backupDisabled: true,
          toObject: function () {
            return this;
          },
        },
      });
      const getWalletCreds = jest
        .spyOn(bitHyveWallet, "getWalletCreds")
        .mockReturnValue(mockWalletCreds);

      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      await expect(
        SignerV3.fetchBackup(
          mockSigner.xfp,
          generateVerificationToken(mockSigner),
          mockKeyPair.publicKey
        )
      ).rejects.toThrow("Backup is disabled");
      getWalletCreds.mockRestore();
    });
    it("should throw if verification fails", async () => {
      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          toObject: function () {
            return this;
          },
        },
      });
      const getWalletCreds = jest
        .spyOn(bitHyveWallet, "getWalletCreds")
        .mockReturnValue(mockWalletCreds);
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      await expect(
        SignerV3.fetchBackup(mockSigner.xfp, "111111", mockKeyPair.publicKey)
      ).rejects.toThrow("Validation token is either invalid or has expired");
      getWalletCreds.mockRestore();
    });
  });

  describe("checkSignerHealth", () => {
    it("should return the health as true if doc and xIndex exists", async () => {
      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          toObject: function () {
            return this;
          },
        },
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      const result = await SignerV3.checkSignerHealth(
        mockSigner.xfp,
        generateVerificationToken(mockSigner)
      );
      expect(result.isSignerAvailable).toBe(true);
    });
  });

  describe("signPSBT", () => {
    // PSBT w/ outgoing 8000, less than maxTransactionAmount of 10000
    const PSBT =
      "cHNidP8BAH0CAAAAAWdi1tqJP+SBLyL51bUxmHxnON8MZN3zuTOZIyQ2ZiKVAQAAAAD+////AgoHAAAAAAAAIgAgLbioU1QQsqvYyX3u9RO9ysCdXsuUIpe3XsQK3xum9AdAHwAAAAAAABYAFBr1DJcOVsFSSMpwfWWsxn1MgCVnekUBAAABASsQJwAAAAAAACIAIPlKBnVi8hjHD1hPnxA0UBPSzQQHagJiJgBhqabRwwRuAQVpUiECgi80IJdHs2emQZTqq/va/dwz6Eo3Oop78L//pBDNv0EhAwYEYm5vzL5uXKJWoUwd7+wUuriebS1f8QZ70JZJKxPWIQPjR0KRnP+Sx9/6QnLuWDbBiJBlDPQjFxA/MOdOnbwnTFOuIgYCgi80IJdHs2emQZTqq/va/dwz6Eo3Oop78L//pBDNv0EcGX6qnzAAAIABAACAAAAAgAIAAIAAAAAAAAAAACIGAwYEYm5vzL5uXKJWoUwd7+wUuriebS1f8QZ70JZJKxPWHMtv5GAwAACAAQAAgHsAAIACAACAAAAAAAAAAAAiBgPjR0KRnP+Sx9/6QnLuWDbBiJBlDPQjFxA/MOdOnbwnTBw+5m3fMAAAgAEAAIAAAACAAgAAgAAAAAAAAAAAAAEAIgAgLbioU1QQsqvYyX3u9RO9ysCdXsuUIpe3XsQK3xum9AcBAWlSIQIB8Zd5bIQfsv6IdgZvJ37dynKqtuzYCemQeI0gVqKhFiEC2A3yGzdx4cQZQ3+Xq7XB8D92cE/VoOCaMvCIowUYk48hA6e0l1oy4DUoheQnJsVMl3ybhM/G6ulDydeSWJUmwm3ZU64iAgIB8Zd5bIQfsv6IdgZvJ37dynKqtuzYCemQeI0gVqKhFhw+5m3fMAAAgAEAAIAAAACAAgAAgAEAAAAAAAAAIgIC2A3yGzdx4cQZQ3+Xq7XB8D92cE/VoOCaMvCIowUYk48cGX6qnzAAAIABAACAAAAAgAIAAIABAAAAAAAAACICA6e0l1oy4DUoheQnJsVMl3ybhM/G6ulDydeSWJUmwm3ZHMtv5GAwAACAAQAAgHsAAIACAACAAQAAAAAAAAAAAA==";

    // PSBT w/ outgoing 12000, more than maxTransactionAmount of 10000
    const PSBT2 =
      "cHNidP8BAKYCAAAAAmdi1tqJP+SBLyL51bUxmHxnON8MZN3zuTOZIyQ2ZiKVAQAAAAD+////l4/xOUNCCdogiAhhU1tODKAVMrAzs/oXeN4Wo7AfGHYBAAAAAP7///8CUhIAAAAAAAAiACAtuKhTVBCyq9jJfe71E73KwJ1ey5Qil7dexArfG6b0B5g6AAAAAAAAFgAUGvUMlw5WwVJIynB9ZazGfUyAJWd9RQEAAAEBKxAnAAAAAAAAIgAg+UoGdWLyGMcPWE+fEDRQE9LNBAdqAmImAGGpptHDBG4BBWlSIQKCLzQgl0ezZ6ZBlOqr+9r93DPoSjc6invwv/+kEM2/QSEDBgRibm/Mvm5colahTB3v7BS6uJ5tLV/xBnvQlkkrE9YhA+NHQpGc/5LH3/pCcu5YNsGIkGUM9CMXED8w506dvCdMU64iBgKCLzQgl0ezZ6ZBlOqr+9r93DPoSjc6invwv/+kEM2/QRwZfqqfMAAAgAEAAIAAAACAAgAAgAAAAAAAAAAAIgYDBgRibm/Mvm5colahTB3v7BS6uJ5tLV/xBnvQlkkrE9Ycy2/kYDAAAIABAACAewAAgAIAAIAAAAAAAAAAACIGA+NHQpGc/5LH3/pCcu5YNsGIkGUM9CMXED8w506dvCdMHD7mbd8wAACAAQAAgAAAAIACAACAAAAAAAAAAAAAAQErECcAAAAAAAAiACD5SgZ1YvIYxw9YT58QNFAT0s0EB2oCYiYAYamm0cMEbgEFaVIhAoIvNCCXR7NnpkGU6qv72v3cM+hKNzqKe/C//6QQzb9BIQMGBGJub8y+blyiVqFMHe/sFLq4nm0tX/EGe9CWSSsT1iED40dCkZz/ksff+kJy7lg2wYiQZQz0IxcQPzDnTp28J0xTriIGAoIvNCCXR7NnpkGU6qv72v3cM+hKNzqKe/C//6QQzb9BHBl+qp8wAACAAQAAgAAAAIACAACAAAAAAAAAAAAiBgMGBGJub8y+blyiVqFMHe/sFLq4nm0tX/EGe9CWSSsT1hzLb+RgMAAAgAEAAIB7AACAAgAAgAAAAAAAAAAAIgYD40dCkZz/ksff+kJy7lg2wYiQZQz0IxcQPzDnTp28J0wcPuZt3zAAAIABAACAAAAAgAIAAIAAAAAAAAAAAAABACIAIC24qFNUELKr2Ml97vUTvcrAnV7LlCKXt17ECt8bpvQHAQFpUiECAfGXeWyEH7L+iHYGbyd+3cpyqrbs2AnpkHiNIFaioRYhAtgN8hs3ceHEGUN/l6u1wfA/dnBP1aDgmjLwiKMFGJOPIQOntJdaMuA1KIXkJybFTJd8m4TPxurpQ8nXkliVJsJt2VOuIgICAfGXeWyEH7L+iHYGbyd+3cpyqrbs2AnpkHiNIFaioRYcPuZt3zAAAIABAACAAAAAgAIAAIABAAAAAAAAACICAtgN8hs3ceHEGUN/l6u1wfA/dnBP1aDgmjLwiKMFGJOPHBl+qp8wAACAAQAAgAAAAIACAACAAQAAAAAAAAAiAgOntJdaMuA1KIXkJybFTJd8m4TPxurpQ8nXkliVJsJt2RzLb+RgMAAAgAEAAIB7AACAAgAAgAEAAAAAAAAAAAA=";
    const change = {
      address: "tb1q9ku2s565zze2hkxf0hh02yaaetqf6hktjs3f0d67cs9d7xax7srsfc4kmr",
      index: 0,
    };
    const descriptor =
      "wsh(sortedmulti(2,[197EAA9F/48h/1h/0h/2h]tpubDEd7sCYEyTVyuwDrA8ZnbGNbp8WMQ1p2j21xxAANrKJs4uxD6nvAihb9oW7WEP35HvgoRAKZJMR2j6vLghhX1Ha7uiTv7PFAHvyzdSNm5yP/<0;1>/*,[3EE66DDF/48h/1h/0h/2h]tpubDERPm4XUYBFJXrA1h3cUQyhZhVXiDkjRRQXJiaSFnqwXnucEseRVcqC99fYgGxZaPEE5ZZu3nKEoW2pVGz2obWBVnpS9Noncs7kw5QkF51q/<0;1>/*,[CB6FE460/48h/1h/123h/2h]tpubDFJbyzFGfyGhwjc2CP7YHjD3hK53AoQWU2Q5eABX2VXcnEBxWVVHjtZhzg9PQLnoHe6iKjR3TamW3N9RVAY5WBbK5DBAs1D86wi2DEgMwpN/<0;1>/*))#r4eaxwum";

    let getWalletCreds: jest.SpyInstance;
    beforeEach(() => {
      jest.clearAllMocks();
      getWalletCreds = jest
        .spyOn(bitHyveWallet, "getWalletCreds")
        .mockReturnValue(mockWalletCreds);

      const delayedTransactionModel = function (data: any) {
        return {
          ...data,
          save: jest.fn((cb) => cb && cb()),
        };
      };
      delayedTransactionModel.find = jest.fn().mockResolvedValue([undefined]);
      (dbV2.getDelayedTransactionModel as jest.Mock).mockReturnValue(
        delayedTransactionModel
      );
    });

    afterEach(() => {
      getWalletCreds.mockRestore();
    });

    it("should sign a PSBT immediately if all checks pass", async () => {
      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          signingDelay: 0,
          toObject: function () {
            return this;
          },
        },
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });

      const mockAggregate = jest.fn().mockResolvedValue([{ total: 0 }]);
      const mockTransactionLogModel = function (data: any) {
        return {
          ...data,
          save: jest.fn((cb) => cb && cb()),
        };
      };
      mockTransactionLogModel.aggregate = mockAggregate;

      (dbV2.getTransactionLogModel as jest.Mock).mockReturnValue(
        mockTransactionLogModel
      );

      const result = await SignerV3.signPSBT(
        mockSigner.xfp,
        PSBT,
        generateVerificationToken(mockSigner),
        change,
        descriptor
      );
      expect(result.delayed).toEqual(undefined);
      expect(result.signedPSBT).toEqual(expect.any(String));
    });
    it("should provide delayed transaction object if all checks pass", async () => {
      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          signingDelay: 1000,
          toObject: function () {
            return this;
          },
        },
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });

      const mockAggregate = jest.fn().mockResolvedValue([{ total: 0 }]);
      const mockTransactionLogModel = function (data: any) {
        return {
          ...data,
          save: jest.fn((cb) => cb && cb()),
        };
      };
      mockTransactionLogModel.aggregate = mockAggregate;

      (dbV2.getTransactionLogModel as jest.Mock).mockReturnValue(
        mockTransactionLogModel
      );

      const verificationToken = generateVerificationToken(mockSigner);
      const result = await SignerV3.signPSBT(
        mockSigner.xfp,
        PSBT,
        verificationToken,
        change,
        descriptor
      );

      expect(result.delayed).toEqual(true);
      expect(result.signedPSBT).toEqual(undefined);
      expect(result.delayedTransaction).toEqual({
        FCM: undefined,
        delayUntil: expect.any(Number),
        outgoing: 8000,
        serializedPSBT: expect.any(String),
        signerId: mockSigner.xfp,
        timestamp: expect.any(Number),
        txid: "05c2772f700a82c2d15061697afe524dbc5790455e8973b1f58d35a0781342f3",
        verificationToken,
      });
    });
    it("should sign a PSBT immediately if all checks pass, using secondary token", async () => {
      const mockSecondaryVerification = [
        {
          id: "opt1",
          method: VerificationType.TWO_FA,
          verifier: "L43HWNYZMF4BMMZD",
          permittedActions: [PermittedAction.SIGN_TRANSACTION],
        },
      ];
      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          signingDelay: 0,
          secondaryVerification: mockSecondaryVerification,
          toObject: function () {
            return this;
          },
        },
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });

      const mockAggregate = jest.fn().mockResolvedValue([{ total: 0 }]);
      const mockTransactionLogModel = function (data: any) {
        return {
          ...data,
          save: jest.fn((cb) => cb && cb()),
        };
      };
      mockTransactionLogModel.aggregate = mockAggregate;

      (dbV2.getTransactionLogModel as jest.Mock).mockReturnValue(
        mockTransactionLogModel
      );

      const result = await SignerV3.signPSBT(
        mockSigner.xfp,
        PSBT,
        authenticator.generate(mockSecondaryVerification[0].verifier),
        change,
        descriptor
      );
      expect(result.delayed).toEqual(undefined);
      expect(result.signedPSBT).toEqual(expect.any(String));
    });
    it("should reject signing a PSBT if the validation fails", async () => {
      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          signingDelay: 0,
          toObject: function () {
            return this;
          },
        },
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });

      const mockAggregate = jest.fn().mockResolvedValue([{ total: 0 }]);
      const mockTransactionLogModel = function (data: any) {
        return {
          ...data,
          save: jest.fn((cb) => cb && cb()),
        };
      };
      mockTransactionLogModel.aggregate = mockAggregate;

      (dbV2.getTransactionLogModel as jest.Mock).mockReturnValue(
        mockTransactionLogModel
      );

      await expect(
        SignerV3.signPSBT(mockSigner.xfp, PSBT, "123232", change, descriptor)
      ).rejects.toThrow(
        "Signing failed: validation token is either invalid or has expired"
      );
    });
    it("should reject signing a PSBT if the outgoing amount is more than maxTransaction amount set by the policy", async () => {
      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          signingDelay: 0,
          toObject: function () {
            return this;
          },
        },
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });

      const mockAggregate = jest.fn().mockResolvedValue([{ total: 0 }]);
      const mockTransactionLogModel = function (data: any) {
        return {
          ...data,
          save: jest.fn((cb) => cb && cb()),
        };
      };
      mockTransactionLogModel.aggregate = mockAggregate;

      (dbV2.getTransactionLogModel as jest.Mock).mockReturnValue(
        mockTransactionLogModel
      );

      await expect(
        SignerV3.signPSBT(
          mockSigner.xfp,
          PSBT2,
          generateVerificationToken(mockSigner),
          change,
          descriptor
        )
      ).rejects.toThrow(
        "Signing failed: exceeded spending limit for the specified time duration"
      );
    });
    it("should reject signing a PSBT if the outgoing aggregate amount is more than maxTransaction amount set by the policy", async () => {
      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          signingDelay: 0,
          toObject: function () {
            return this;
          },
        },
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });

      const mockAggregate = jest.fn().mockResolvedValue([{ total: 5000 }]); // simulate an aggregate spent amount of 5000 for this given timewindow
      const mockTransactionLogModel = function (data: any) {
        return {
          ...data,
          save: jest.fn((cb) => cb && cb()),
        };
      };
      mockTransactionLogModel.aggregate = mockAggregate;

      (dbV2.getTransactionLogModel as jest.Mock).mockReturnValue(
        mockTransactionLogModel
      );

      await expect(
        SignerV3.signPSBT(
          mockSigner.xfp,
          PSBT,
          generateVerificationToken(mockSigner),
          change,
          descriptor
        ) // rejects as the outgoing amount(8000) + aggregate amount (5000) = 13000 > maxTransactionAmount (10000)
      ).rejects.toThrow(
        "Signing failed: exceeded spending limit for the specified time duration"
      );
    });
  });

  describe("processDelayedPolicyUpdates", () => {
    let mockDelayedPolicyUpdateModel;
    let mockDate;

    beforeEach(() => {
      jest.clearAllMocks();
      mockDate = 1621234567890; // Mock Date.now() to return a consistent timestamp
      jest.spyOn(Date, "now").mockReturnValue(mockDate);
      mockDelayedPolicyUpdateModel = {
        find: jest.fn(),
        updateOne: jest.fn().mockResolvedValue({}),
      };
      (dbV2.getDelayedPolicyUpdateModel as jest.Mock).mockReturnValue(
        mockDelayedPolicyUpdateModel
      );
    });

    it("should process all eligible delayed policy updates", async () => {
      const mockUpdates = [
        {
          policyId: "policy1",
          signerId: mockSigner.xfp,
          policyUpdates: {
            restrictions: {
              maxTransactionAmount: 5000,
              timeWindow: 86400000,
              none: false,
            },
            signingDelay: 0,
          },
          delayUntil: mockDate,
          FCM: "fcm-token-1",
        },
        {
          policyId: "policy2",
          signerId: mockSigner.xfp,
          policyUpdates: {
            restrictions: {
              maxTransactionAmount: 3000,
              timeWindow: 86400000,
              none: false,
            },
            signingDelay: 0,
          },
          delayUntil: mockDate,
        },
      ];
      mockDelayedPolicyUpdateModel.find.mockResolvedValue(mockUpdates);

      const doc = generateMockServerKeyDoc({
        policy: {
          ...mockSigner.signerPolicy,
          toObject: function () {
            return this;
          },
        },
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });

      const pushNotificationSpy = jest
        .spyOn(
          require("../../src/services/notifications/pushNotification"),
          "pushServerKeyNotification"
        )
        .mockImplementation(() => { });

      await SignerV3.processDelayedPolicyUpdates();

      expect(mockDelayedPolicyUpdateModel.find).toHaveBeenCalledWith({
        delayUntil: { $lte: mockDate },
        isApplied: { $exists: false },
      });
      expect(mockDelayedPolicyUpdateModel.updateOne).toHaveBeenCalledTimes(2);
      expect(mockDelayedPolicyUpdateModel.updateOne).toHaveBeenCalledWith(
        { policyId: "policy1" },
        { isApplied: true }
      );
      expect(mockDelayedPolicyUpdateModel.updateOne).toHaveBeenCalledWith(
        { policyId: "policy2" },
        { isApplied: true }
      );

      expect(pushNotificationSpy).toHaveBeenCalledTimes(1);
      expect(pushNotificationSpy).toHaveBeenCalledWith(
        ["fcm-token-1"],
        "POLICY_UPDATE_APPLIED",
        { id: "policy1" }
      );
      pushNotificationSpy.mockRestore();
    });
    it("should handle errors when processing policy updates", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      const mockUpdates = [
        {
          policyId: "policy1",
          signerId: mockSigner.xfp,
          policyUpdates: {
            restrictions: {
              maxTransactionAmount: 5000,
              timeWindow: 86400000,
              none: false,
            },
            signingDelay: 0,
          },
          delayUntil: mockDate,
        },
        {
          policyId: "policy2",
          signerId: "invalid-signer", // This will cause getSigner to throw
          policyUpdates: {
            restrictions: {
              maxTransactionAmount: 3000,
              timeWindow: 86400000,
              none: false,
            },
            signingDelay: 0,
          },
          delayUntil: mockDate,
        },
      ];

      mockDelayedPolicyUpdateModel.find.mockResolvedValue(mockUpdates);

      const mockSignerV3Model = {
        find: jest.fn((query) => {
          if (query.id === mockSigner.xfp) {
            return Promise.resolve([
              generateMockServerKeyDoc({
                policy: {
                  ...mockSigner.signerPolicy,
                  toObject: function () {
                    return this;
                  },
                },
              }),
            ]);
          }
          return Promise.resolve([]);
        }),
      };
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue(mockSignerV3Model);

      await SignerV3.processDelayedPolicyUpdates();

      expect(mockDelayedPolicyUpdateModel.updateOne).toHaveBeenCalledTimes(1);
      expect(mockDelayedPolicyUpdateModel.updateOne).toHaveBeenCalledWith(
        { policyId: "policy1" },
        { isApplied: true }
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to process delayed policy update policy2: Singer not found against vault: invalid-signer"
      );
      consoleErrorSpy.mockRestore();
    });
    it("should do nothing if there are no eligible policy updates", async () => {
      mockDelayedPolicyUpdateModel.find.mockResolvedValue([]);
      await SignerV3.processDelayedPolicyUpdates();

      expect(mockDelayedPolicyUpdateModel.find).toHaveBeenCalled();
      expect(mockDelayedPolicyUpdateModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe("fetchDelayedPolicyUpdate", () => {
    let mockDelayedPolicyUpdateModel;

    beforeEach(() => {
      jest.clearAllMocks();
      mockDelayedPolicyUpdateModel = {
        find: jest.fn(),
        deleteOne: jest.fn().mockResolvedValue({}),
      };
      (dbV2.getDelayedPolicyUpdateModel as jest.Mock).mockReturnValue(
        mockDelayedPolicyUpdateModel
      );
    });

    it("should fetch an applied policy update successfully", async () => {
      const policyId = "policy123";
      const verificationToken = "101010";
      const mockPolicy = {
        policyId,
        verificationToken,
        isApplied: true,
        signerId: mockSigner.xfp,
        policyUpdates: {
          restrictions: {
            maxTransactionAmount: 5000,
            timeWindow: 86400000,
            none: false,
          },
          signingDelay: 0,
        },
        timestamp: Date.now(),
        delayUntil: Date.now() + 30000,
        FCM: "fcm-token",
      };

      mockDelayedPolicyUpdateModel.find.mockResolvedValue([mockPolicy]);

      const result = await SignerV3.fetchDelayedPolicyUpdate(
        policyId,
        verificationToken
      );

      expect(mockDelayedPolicyUpdateModel.find).toHaveBeenCalledWith({
        policyId,
      });
      expect(mockDelayedPolicyUpdateModel.deleteOne).toHaveBeenCalledWith({
        policyId,
      });
      expect(result).toEqual({
        delayedPolicy: mockPolicy,
      });
    });

    it("should throw if policy update is not found", async () => {
      mockDelayedPolicyUpdateModel.find.mockResolvedValue([]);

      await expect(
        SignerV3.fetchDelayedPolicyUpdate("non-existent-policyId", "101010")
      ).rejects.toThrow("Policy update not found or already applied");
    });

    it("should throw if verification token doesn't match", async () => {
      const mockPolicy = {
        policyId: "policy123",
        verificationToken: "101010",
        isApplied: true,
      };

      mockDelayedPolicyUpdateModel.find.mockResolvedValue([mockPolicy]);

      await expect(
        SignerV3.fetchDelayedPolicyUpdate("policy123", "111111")
      ).rejects.toThrow("Validation token mismatch");
    });

    it("should throw if policy is not applied yet", async () => {
      const mockPolicy = {
        policyId: "policy123",
        verificationToken: "101010",
        // isApplied is undefined/false
      };

      mockDelayedPolicyUpdateModel.find.mockResolvedValue([mockPolicy]);

      await expect(
        SignerV3.fetchDelayedPolicyUpdate("policy123", "101010")
      ).rejects.toThrow("Policy is not updated yet");
    });
  });

  describe("processDelayedTransactions", () => {
    let mockDelayedTransactionModel;
    let mockDate;
    const PSBT =
      "cHNidP8BAH0CAAAAAWdi1tqJP+SBLyL51bUxmHxnON8MZN3zuTOZIyQ2ZiKVAQAAAAD+////AgoHAAAAAAAAIgAgLbioU1QQsqvYyX3u9RO9ysCdXsuUIpe3XsQK3xum9AdAHwAAAAAAABYAFBr1DJcOVsFSSMpwfWWsxn1MgCVnekUBAAABASsQJwAAAAAAACIAIPlKBnVi8hjHD1hPnxA0UBPSzQQHagJiJgBhqabRwwRuAQVpUiECgi80IJdHs2emQZTqq/va/dwz6Eo3Oop78L//pBDNv0EhAwYEYm5vzL5uXKJWoUwd7+wUuriebS1f8QZ70JZJKxPWIQPjR0KRnP+Sx9/6QnLuWDbBiJBlDPQjFxA/MOdOnbwnTFOuIgYCgi80IJdHs2emQZTqq/va/dwz6Eo3Oop78L//pBDNv0EcGX6qnzAAAIABAACAAAAAgAIAAIAAAAAAAAAAACIGAwYEYm5vzL5uXKJWoUwd7+wUuriebS1f8QZ70JZJKxPWHMtv5GAwAACAAQAAgHsAAIACAACAAAAAAAAAAAAiBgPjR0KRnP+Sx9/6QnLuWDbBiJBlDPQjFxA/MOdOnbwnTBw+5m3fMAAAgAEAAIAAAACAAgAAgAAAAAAAAAAAAAEAIgAgLbioU1QQsqvYyX3u9RO9ysCdXsuUIpe3XsQK3xum9AcBAWlSIQIB8Zd5bIQfsv6IdgZvJ37dynKqtuzYCemQeI0gVqKhFiEC2A3yGzdx4cQZQ3+Xq7XB8D92cE/VoOCaMvCIowUYk48hA6e0l1oy4DUoheQnJsVMl3ybhM/G6ulDydeSWJUmwm3ZU64iAgIB8Zd5bIQfsv6IdgZvJ37dynKqtuzYCemQeI0gVqKhFhw+5m3fMAAAgAEAAIAAAACAAgAAgAEAAAAAAAAAIgIC2A3yGzdx4cQZQ3+Xq7XB8D92cE/VoOCaMvCIowUYk48cGX6qnzAAAIABAACAAAAAgAIAAIABAAAAAAAAACICA6e0l1oy4DUoheQnJsVMl3ybhM/G6ulDydeSWJUmwm3ZHMtv5GAwAACAAQAAgHsAAIACAACAAQAAAAAAAAAAAA==";
    const PSBT2 =
      "cHNidP8BAKYCAAAAAmdi1tqJP+SBLyL51bUxmHxnON8MZN3zuTOZIyQ2ZiKVAQAAAAD+////l4/xOUNCCdogiAhhU1tODKAVMrAzs/oXeN4Wo7AfGHYBAAAAAP7///8CUhIAAAAAAAAiACAtuKhTVBCyq9jJfe71E73KwJ1ey5Qil7dexArfG6b0B5g6AAAAAAAAFgAUGvUMlw5WwVJIynB9ZazGfUyAJWd9RQEAAAEBKxAnAAAAAAAAIgAg+UoGdWLyGMcPWE+fEDRQE9LNBAdqAmImAGGpptHDBG4BBWlSIQKCLzQgl0ezZ6ZBlOqr+9r93DPoSjc6invwv/+kEM2/QSEDBgRibm/Mvm5colahTB3v7BS6uJ5tLV/xBnvQlkkrE9YhA+NHQpGc/5LH3/pCcu5YNsGIkGUM9CMXED8w506dvCdMU64iBgKCLzQgl0ezZ6ZBlOqr+9r93DPoSjc6invwv/+kEM2/QRwZfqqfMAAAgAEAAIAAAACAAgAAgAAAAAAAAAAAIgYDBgRibm/Mvm5colahTB3v7BS6uJ5tLV/xBnvQlkkrE9Ycy2/kYDAAAIABAACAewAAgAIAAIAAAAAAAAAAACIGA+NHQpGc/5LH3/pCcu5YNsGIkGUM9CMXED8w506dvCdMHD7mbd8wAACAAQAAgAAAAIACAACAAAAAAAAAAAAAAQErECcAAAAAAAAiACD5SgZ1YvIYxw9YT58QNFAT0s0EB2oCYiYAYamm0cMEbgEFaVIhAoIvNCCXR7NnpkGU6qv72v3cM+hKNzqKe/C//6QQzb9BIQMGBGJub8y+blyiVqFMHe/sFLq4nm0tX/EGe9CWSSsT1iED40dCkZz/ksff+kJy7lg2wYiQZQz0IxcQPzDnTp28J0xTriIGAoIvNCCXR7NnpkGU6qv72v3cM+hKNzqKe/C//6QQzb9BHBl+qp8wAACAAQAAgAAAAIACAACAAAAAAAAAAAAiBgMGBGJub8y+blyiVqFMHe/sFLq4nm0tX/EGe9CWSSsT1hzLb+RgMAAAgAEAAIB7AACAAgAAgAAAAAAAAAAAIgYD40dCkZz/ksff+kJy7lg2wYiQZQz0IxcQPzDnTp28J0wcPuZt3zAAAIABAACAAAAAgAIAAIAAAAAAAAAAAAABACIAIC24qFNUELKr2Ml97vUTvcrAnV7LlCKXt17ECt8bpvQHAQFpUiECAfGXeWyEH7L+iHYGbyd+3cpyqrbs2AnpkHiNIFaioRYhAtgN8hs3ceHEGUN/l6u1wfA/dnBP1aDgmjLwiKMFGJOPIQOntJdaMuA1KIXkJybFTJd8m4TPxurpQ8nXkliVJsJt2VOuIgICAfGXeWyEH7L+iHYGbyd+3cpyqrbs2AnpkHiNIFaioRYcPuZt3zAAAIABAACAAAAAgAIAAIABAAAAAAAAACICAtgN8hs3ceHEGUN/l6u1wfA/dnBP1aDgmjLwiKMFGJOPHBl+qp8wAACAAQAAgAAAAIACAACAAQAAAAAAAAAiAgOntJdaMuA1KIXkJybFTJd8m4TPxurpQ8nXkliVJsJt2RzLb+RgMAAAgAEAAIB7AACAAgAAgAEAAAAAAAAAAAA=";

    beforeEach(() => {
      jest.clearAllMocks();
      mockDate = 1621234567890;
      jest.spyOn(Date, "now").mockReturnValue(mockDate);
      mockDelayedTransactionModel = {
        find: jest.fn(),
        updateOne: jest.fn().mockResolvedValue({}),
      };
      (dbV2.getDelayedTransactionModel as jest.Mock).mockReturnValue(
        mockDelayedTransactionModel
      );
    });

    it("should process all eligible delayed transactions", async () => {
      const mockTransactions = [
        {
          txid: "tx1",
          signerId: mockSigner.xfp,
          serializedPSBT: PSBT,
          FCM: "fcm-token-1",
        },
        {
          txid: "tx2",
          signerId: mockSigner.xfp,
          serializedPSBT: PSBT2,
        },
      ];

      mockDelayedTransactionModel.find.mockResolvedValue(mockTransactions);

      const doc = generateMockServerKeyDoc({});
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });
      const getWalletCreds = jest
        .spyOn(bitHyveWallet, "getWalletCreds")
        .mockReturnValue(mockWalletCreds);

      const pushNotificationSpy = jest
        .spyOn(
          require("../../src/services/notifications/pushNotification"),
          "pushServerKeyNotification"
        )
        .mockImplementation(() => { });
      await SignerV3.processDelayedTransactions();

      expect(mockDelayedTransactionModel.find).toHaveBeenCalledWith({
        delayUntil: { $lte: mockDate },
        signedPSBT: { $exists: false },
      });

      expect(mockDelayedTransactionModel.updateOne).toHaveBeenCalledTimes(2);
      expect(mockDelayedTransactionModel.updateOne).toHaveBeenCalledWith(
        { txid: "tx1" },
        { signedPSBT: expect.any(String) }
      );
      expect(mockDelayedTransactionModel.updateOne).toHaveBeenCalledWith(
        { txid: "tx2" },
        { signedPSBT: expect.any(String) }
      );

      expect(pushNotificationSpy).toHaveBeenCalledTimes(1);
      expect(pushNotificationSpy).toHaveBeenCalledWith(
        ["fcm-token-1"],
        "SIGNED_DELAYED_TRANSACTION",
        { id: "tx1", signedTx: expect.any(String) }
      );

      getWalletCreds.mockRestore();
      pushNotificationSpy.mockRestore();
    });

    it("should handle errors when processing transactions", async () => {
      const signPSBT = jest
        .spyOn(bitHyveWallet, "signPSBT")
        .mockImplementation(() => ({
          toBase64: () => "signed-psbt-base64",
        }));

      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      const mockTransactions = [
        {
          txid: "tx1",
          signerId: mockSigner.xfp,
          serializedPSBT: PSBT,
        },
        {
          txid: "tx2",
          signerId: "invalid-signer", // This will cause getSigner to throw
          serializedPSBT: PSBT2,
        },
      ];

      mockDelayedTransactionModel.find.mockResolvedValue(mockTransactions);

      const mockSignerV3Model = {
        find: jest.fn((query) => {
          if (query.id === mockSigner.xfp) {
            return Promise.resolve([
              generateMockServerKeyDoc({
              }),
            ]);
          }
          return Promise.resolve([]);
        }),
      };
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue(mockSignerV3Model);
      const getWalletCreds = jest
        .spyOn(bitHyveWallet, "getWalletCreds")
        .mockReturnValue(mockWalletCreds);

      await SignerV3.processDelayedTransactions();

      expect(mockDelayedTransactionModel.updateOne).toHaveBeenCalledTimes(1);
      expect(mockDelayedTransactionModel.updateOne).toHaveBeenCalledWith(
        { txid: "tx1" },
        { signedPSBT: expect.any(String) }
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to process delayed transaction")
      );
      signPSBT.mockRestore();
      getWalletCreds.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it("should do nothing if there are no eligible transactions", async () => {
      mockDelayedTransactionModel.find.mockResolvedValue([]);
      await SignerV3.processDelayedTransactions();
      expect(mockDelayedTransactionModel.find).toHaveBeenCalled();
      expect(mockDelayedTransactionModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe("fetchSignedDelayedTransaction", () => {
    let mockDelayedTransactionModel;

    beforeEach(() => {
      jest.clearAllMocks();
      mockDelayedTransactionModel = {
        find: jest.fn(),
        deleteOne: jest.fn().mockResolvedValue({}),
      };
      (dbV2.getDelayedTransactionModel as jest.Mock).mockReturnValue(
        mockDelayedTransactionModel
      );
    });

    it("should fetch a signed delayed transaction successfully", async () => {
      const txid = "tx123";
      const cachedVerificationToken = "101010";
      const mockTransaction = {
        txid,
        verificationToken: cachedVerificationToken,
        signedPSBT: "signed-psbt-base64",
        signerId: mockSigner.xfp,
        serializedPSBT: "serialized-psbt",
        outgoing: 5000,
        timestamp: Date.now(),
        delayUntil: Date.now() + 30000,
        FCM: "fcm-token",
      };

      mockDelayedTransactionModel.find.mockResolvedValue([mockTransaction]);

      const result = await SignerV3.fetchSignedDelayedTransaction(
        txid,
        cachedVerificationToken
      );

      expect(mockDelayedTransactionModel.find).toHaveBeenCalledWith({
        txid,
      });
      expect(mockDelayedTransactionModel.deleteOne).toHaveBeenCalledWith({
        txid,
      });
      expect(result).toEqual({
        delayedTransaction: mockTransaction,
      });
    });

    it("should throw if transaction is not found", async () => {
      mockDelayedTransactionModel.find.mockResolvedValue([]);

      await expect(
        SignerV3.fetchSignedDelayedTransaction("non-existent-txid", "101010")
      ).rejects.toThrow("Transaction not found or already processed");
    });

    it("should throw if verification token doesn't match", async () => {
      const mockTransaction = {
        txid: "tx123",
        verificationToken: "101010",
        signedPSBT: "signed-psbt-base64",
      };

      mockDelayedTransactionModel.find.mockResolvedValue([mockTransaction]);

      await expect(
        SignerV3.fetchSignedDelayedTransaction("tx123", "111111")
      ).rejects.toThrow("Validation token mismatch");
    });

    it("should throw if transaction isn't signed yet", async () => {
      const mockTransaction = {
        txid: "tx123",
        verificationToken: "101010",
        // No signedPSBT
      };

      mockDelayedTransactionModel.find.mockResolvedValue([mockTransaction]);

      await expect(
        SignerV3.fetchSignedDelayedTransaction("tx123", "101010")
      ).rejects.toThrow("Transaction isn't signed yet");
    });
  });

  describe("migrateSignerPolicy", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should return existing policy if signer already has new spending limit", async () => {
      const mockPolicy = {
        verification: {
          method: VerificationType.TWO_FA,
          verifier: null,
        },
        restrictions: {
          maxTransactionAmount: 10000,
          timeWindow: 1800000,
          none: false,
        },
        signingDelay: 300000,
        secondaryVerification: [],
        toObject: function () {
          return this;
        },
      };

      const doc = generateMockServerKeyDoc({
        policy: mockPolicy,
      });

      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });

      const result = await SignerV3.migrateSignerPolicy(
        mockSigner.xfp,
        mockSigner.signerPolicy
      );

      expect(result.newPolicy).toEqual(mockPolicy);
      expect(doc.save).not.toHaveBeenCalled();
    });

    it("should throw if verification settings don't match", async () => {
      const storedPolicy = {
        verification: {
          method: VerificationType.TWO_FA,
          verifier: "NZDA2HBHGIQSSUCY",
        },
        restrictions: {
          maxTransactionAmount: 10000,
          none: false,
        },
        exceptions: {
          none: true,
        },
        toObject: function () {
          return this;
        },
      };

      const doc = generateMockServerKeyDoc({
        policy: storedPolicy,
      });

      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });

      await expect(
        SignerV3.migrateSignerPolicy(mockSigner.xfp, {
          verification: {
            method: "DIFFERENT_METHOD" as any,
            verifier: "VERIFIER",
          },
          restrictions: {
            maxTransactionAmount: 10000,
            none: false,
          },
        })
      ).rejects.toThrow("Policy mismatch: verification settings do not match");
    });

    it("should throw if restrictions don't match", async () => {
      const storedPolicy = {
        verification: {
          method: VerificationType.TWO_FA,
          verifier: "NZDA2HBHGIQSSUCY",
        },
        restrictions: {
          maxTransactionAmount: 10000,
          none: false,
        },
        exceptions: {
          none: true,
        },
        toObject: function () {
          return this;
        },
      };

      const doc = generateMockServerKeyDoc({
        policy: storedPolicy,
      });

      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([doc]),
      });

      await expect(
        SignerV3.migrateSignerPolicy(mockSigner.xfp, {
          verification: {
            method: VerificationType.TWO_FA,
            verifier: "",
          },
          restrictions: {
            maxTransactionAmount: 5000,
            none: false,
          },
        })
      ).rejects.toThrow("Policy mismatch: spending restrictions do not match");
    });
  });

  describe("migrateSignersV2ToV3", () => {
    it("migrates a legacy signer without returning its stored verifier", async () => {
      const storedVerifierKey = "JBSWY3DPEHPK3PXP";
      const verificationToken = authenticator.generate(storedVerifierKey);
      const policy = {
        verification: {
          method: VerificationType.TWO_FA,
          verifier: { twoFAKey: storedVerifierKey },
        },
        restrictions: { none: false, maxTransactionAmount: 10000 },
        toObject: jest.fn(() => ({
          verification: { method: VerificationType.TWO_FA, verifier: { twoFAKey: storedVerifierKey } },
          restrictions: { none: false, maxTransactionAmount: 10000 },
        })),
      };
      const save = jest.fn((callback) => callback && callback());
      const signerV3Model: any = jest.fn().mockImplementation((data) => ({
        ...data,
        save,
      }));
      signerV3Model.find = jest.fn().mockResolvedValue([]);
      (dbV2.getSignerV2Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([{ xIndex: mockSigner.xIndex, policy }]),
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue(signerV3Model);
      const insertMany = jest.fn().mockResolvedValue([]);
      const cosignersMapModel: any = jest.fn().mockImplementation((data) => data);
      cosignersMapModel.find = jest.fn().mockResolvedValue([]);
      cosignersMapModel.insertMany = insertMany;
      (dbV2.getCoSignersToSignerMapV3Model as jest.Mock).mockReturnValue(cosignersMapModel);
      const derive = jest.spyOn(bitHyveWallet, "getRandomXpub").mockReturnValue({
        xpub: mockSigner.xpub,
        xfp: mockSigner.xfp,
        masterFingerprint: mockSigner.masterFingerprint,
        derivationPath: mockSigner.derivationPath,
        xIndex: mockSigner.xIndex,
      });
      const mapUpdates = [{
        cosignersId: "unit-test-cosigners",
        signerId: mockSigner.xfp,
        action: CosignersMapUpdateAction.ADD,
      }];

      try {
        const result = await SignerV3.migrateSignersV2ToV3(
          "unit-test-vault",
          "unit-test-app",
          mapUpdates
        );

        expect(result.migrationSuccessful).toBe(true);
        expect(result.setupData.verification).toEqual({
          method: VerificationType.TWO_FA,
          verifier: null,
        });
        expect(JSON.stringify(result)).not.toContain(storedVerifierKey);
        const savedPolicy = signerV3Model.mock.calls[0][0].policy;
        expect(policy.toObject).toHaveBeenCalled();
        expect(savedPolicy.verification).toEqual({ method: VerificationType.TWO_FA, verifier: storedVerifierKey });
        expect(savedPolicy.restrictions).toEqual(policy.restrictions);
        expect(authenticator.verify({ secret: savedPolicy.verification.verifier, token: verificationToken })).toBe(true);
        expect(policy.verification.verifier).toEqual({ twoFAKey: storedVerifierKey });
        expect(save).toHaveBeenCalled();
        expect(insertMany).toHaveBeenCalled();
      } finally {
        derive.mockRestore();
      }
    });

    it("keeps the verifier redacted when retrying after a V3 signer was saved", async () => {
      const storedVerifierKey = "UNIT_TEST_RETRY_TOTP_SECRET";
      const policy = {
        verification: {
          method: VerificationType.TWO_FA,
          verifier: { twoFAKey: storedVerifierKey },
        },
      };
      const signerV3Model: any = jest.fn();
      signerV3Model.find = jest.fn().mockResolvedValue([{ id: mockSigner.xfp, policy }]);
      (dbV2.getSignerV2Model as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue([{ xIndex: mockSigner.xIndex, policy }]),
      });
      (dbV2.getSignerV3Model as jest.Mock).mockReturnValue(signerV3Model);
      const cosignersMapModel: any = jest.fn().mockImplementation((data) => data);
      cosignersMapModel.find = jest.fn().mockResolvedValue([]);
      cosignersMapModel.insertMany = jest.fn().mockResolvedValue([]);
      (dbV2.getCoSignersToSignerMapV3Model as jest.Mock).mockReturnValue(cosignersMapModel);
      const derive = jest.spyOn(bitHyveWallet, "getRandomXpub").mockReturnValue({
        xpub: mockSigner.xpub,
        xfp: mockSigner.xfp,
        masterFingerprint: mockSigner.masterFingerprint,
        derivationPath: mockSigner.derivationPath,
        xIndex: mockSigner.xIndex,
      });

      try {
        const result = await SignerV3.migrateSignersV2ToV3(
          "unit-test-vault",
          "unit-test-app",
          [{ cosignersId: "unit-test-cosigners", signerId: mockSigner.xfp, action: CosignersMapUpdateAction.ADD }]
        );

        expect(result.migrationSuccessful).toBe(true);
        expect(result.setupData.verification).toEqual({ method: VerificationType.TWO_FA, verifier: null });
        expect(JSON.stringify(result)).not.toContain(storedVerifierKey);
        expect(signerV3Model).not.toHaveBeenCalled();
        expect(cosignersMapModel.insertMany).toHaveBeenCalled();
      } finally {
        derive.mockRestore();
      }
    });
  });
});
