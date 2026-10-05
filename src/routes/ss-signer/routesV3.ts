import { Router, Request, Response, NextFunction } from "express";
import signerV3 from "../../services/assistedKeys.ts/ss-signer/signerV3";
import { StatusCodes } from "../router";
import * as SignerV3Schemas from "../../validators/signerV3Schemas";
import { authorizeRequest } from "../../middleware/authorization";
import { validateRequest } from "../../middleware/validation";
import { handleRouteError } from "../../middleware/errorHandling";

export const routesV3 = (router: Router): Router => {
  // --- Setup Signer ---
  router.post(
    "/v3/setupSigner",
    authorizeRequest,
    validateRequest(SignerV3Schemas.setupSignerSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.setupSigner(
          req.body.policy
        );
        res.status(StatusCodes.OK).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Validate Signer Setup ---
  router.post(
    "/v3/validateSingerSetup",
    authorizeRequest,
    validateRequest(SignerV3Schemas.validateSignerSetupSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.validateSignerSetup(
          req.body.id,
          req.body.verificationToken
        );
        if (result.valid) res.status(StatusCodes.OK).json(result);
        else throw new Error("Validation failed: verification token is either invalid or has expired");
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Add Secondary Verification Option ---
  router.post(
    "/v3/addSecondaryVerificationOption",
    authorizeRequest,
    validateRequest(SignerV3Schemas.addSecondaryVerificationOptionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.addSecondaryVerificationOption(
          req.body.id,
          req.body.verificationToken,
          req.body.newOption
        );
        res.status(StatusCodes.OK).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Remove Secondary Verification Option ---
  router.post(
    "/v3/removeSecondaryVerificationOption",
    authorizeRequest,
    validateRequest(SignerV3Schemas.removeSecondaryVerificationOptionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.removeSecondaryVerificationOption(
          req.body.id,
          req.body.verificationToken,
          req.body.optionId
        );
        res.status(StatusCodes.OK).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Fetch Signer Setup ---
  router.post(
    "/v3/fetchSignerSetup",
    authorizeRequest,
    validateRequest(SignerV3Schemas.fetchSignerSetupSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.fetchSignerSetup(
          req.body.id,
          req.body.verificationToken
        );
        if (result.valid) res.status(StatusCodes.OK).json(result);
        else throw new Error("Validation failed: verification token is either invalid or has expired");
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Update Backup Setting ---
  router.post(
    "/v3/updateBackupSetting",
    authorizeRequest,
    validateRequest(SignerV3Schemas.updateBackupSettingSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.updateBackupSetting(
          req.body.id,
          req.body.verifierDigest,
          req.body.disable
        );
        res.status(StatusCodes.OK).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Fetch Backup ---
  router.post(
    "/v3/fetchBackup",
    authorizeRequest,
    validateRequest(SignerV3Schemas.fetchBackupSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.fetchBackup(
          req.body.id,
          req.body.verificationToken,
          req.body.publicKey
        );
        res.status(StatusCodes.OK).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Check Signer Health ---
  router.post(
    "/v3/checkSignerHealth",
    authorizeRequest,
    validateRequest(SignerV3Schemas.checkSignerHealthSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.checkSignerHealth(
          req.body.id,
          req.body.verificationToken
        );
        res.status(StatusCodes.OK).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Update Signer Policy ---
  router.post(
    "/v3/updateSignerPolicy",
    authorizeRequest,
    validateRequest(SignerV3Schemas.updateSignerPolicySchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.updateSignerPolicy(
          req.body.id,
          req.body.updates,
          req.body.verificationToken,
          req.body.FCM,
        );
        res.status(StatusCodes.OK).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Sign Transaction ---
  router.post(
    "/v3/signTransaction",
    authorizeRequest,
    validateRequest(SignerV3Schemas.signTransactionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.signPSBT(
          req.body.id,
          req.body.serializedPSBT,
          req.body.verificationToken,
          req.body.change,
          req.body.descriptor,
          req.body.FCM,
        );
        res.status(StatusCodes.OK).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Cancel Delayed Transaction ---
  router.post(
    "/v3/cancelDelayedTransaction",
    authorizeRequest,
    validateRequest(SignerV3Schemas.cancelDelayedTransactionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.cancelDelayedTransaction(
          req.body.signerId,
          req.body.txid,
          req.body.verificationToken
        );
        res.status(StatusCodes.OK).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Fetch Signed Delayed Transaction ---
  router.post(
    "/v3/fetchSignedDelayedTransaction",
    authorizeRequest,
    validateRequest(SignerV3Schemas.fetchSignedDelayedTransactionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.fetchSignedDelayedTransaction(
          req.body.txid,
          req.body.verificationToken
        );
        res.status(StatusCodes.OK).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Fetch Delayed Policy Update ---
  router.post(
    "/v3/fetchDelayedPolicyUpdate",
    authorizeRequest,
    validateRequest(SignerV3Schemas.fetchDelayedPolicyUpdateSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.fetchDelayedPolicyUpdate(
          req.body.policyId,
          req.body.verificationToken
        );
        res.status(StatusCodes.OK).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Migrate Signer Policy ---
  router.post(
    "/v3/migrateSignerPolicy",
    authorizeRequest,
    validateRequest(SignerV3Schemas.migrateSignerPolicySchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result =
          await signerV3.migrateSignerPolicy(
            req.body.id,
            req.body.oldPolicy,
          );
        res.status(StatusCodes.OK).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Migrate Signers V2 To V3 ---
  router.post(
    "/v3/migrateSignersV2ToV3",
    authorizeRequest,
    validateRequest(SignerV3Schemas.migrateSignersV2ToV3Schema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result =
          await signerV3.migrateSignersV2ToV3(
            req.body.vaultId,
            req.body.appId,
            req.body.cosignersMapUpdates
          );
        res.status(StatusCodes.OK).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Fetch Signer Setup Via Cosigners ---
  router.post(
    "/v3/fetchSignerSetupViaCosigners",
    authorizeRequest,
    validateRequest(SignerV3Schemas.fetchSignerSetupViaCosignersSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.fetchSignerSetupViaCosigners(
          req.body.cosignersId,
          req.body.verificationToken
        );
        if (result.valid) res.status(StatusCodes.OK).json(result);
        else throw new Error("Validation failed: verification token is either invalid or has expired");
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Update Cosigners To Signer Map ---
  router.post(
    "/v3/updateCosignersToSignerMap",
    authorizeRequest,
    validateRequest(SignerV3Schemas.updateCosignersToSignerMapSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.updateCosignersToSignerMap(
          req.body.cosignersMapUpdates,
          req.body.id
        );
        res.status(StatusCodes.OK).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Enrich Cosigners To Signer Map ---
  router.post(
    "/v3/enrichCosignersToSignerMap",
    authorizeRequest,
    validateRequest(SignerV3Schemas.enrichCosignersToSignerMapSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await signerV3.enrichCosignersToSignerMap(
          req.body.cosignersMapUpdates,
          req.body.id
        );
        res.status(StatusCodes.OK).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // generic error handler for this router instance - invoked upon next(err) by route handlers
  router.use(handleRouteError);
  return router;
};
