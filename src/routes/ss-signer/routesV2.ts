import { Router } from "express";
import signerV2 from "../../services/assistedKeys.ts/ss-signer/signerV2";
import { isAuthorized } from "../router";

export const routesV2 = (router: Router): Router => {
  router.post("/v2/setupSigner", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    // versions > 1.0.1, registers using vaultId instead of appId
    if (!req.body.vaultId && !req.body.appId) {
      return res
        .status(400)
        .json({ err: "Input param missing - vaultId/appId" });
    }

    if (!req.body.policy) {
      return res.status(400).json({ err: "Input param missing - policy" });
    }

    try {
      const { setupSuccessful, setupData } = await signerV2.setupSigner(
        req.body.vaultId,
        req.body.appId,
        req.body.policy
      );
      res.status(200).json({
        setupSuccessful,
        setupData,
      });
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  router.post("/v2/validateSingerSetup", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.vaultId && !req.body.appId) {
      return res
        .status(400)
        .json({ err: "Input param missing - vaultId/appId" });
    }

    if (!req.body.verificationToken) {
      return res
        .status(400)
        .json({ err: "Input param missing - verificationToken" });
    }

    try {
      const { isValid } = await signerV2.validateSignerSetup(
        req.body.vaultId,
        req.body.appId,
        req.body.verificationToken
      );

      if (isValid) {
        res.status(200).json({
          valid: isValid,
        });
      } else {
        res.status(400).json({
          err: "Validation failed: verification token is either invalid or has expired",
        });
      }
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  router.post("/v2/fetchSignerSetup", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.vaultId && !req.body.appId) {
      return res
        .status(400)
        .json({ err: "Input param missing - vaultId/appId" });
    }

    if (!req.body.verificationToken) {
      return res
        .status(400)
        .json({ err: "Input param missing - verificationToken" });
    }

    try {
      const { isValid, xpub, masterFingerprint, derivationPath, policy } =
        await signerV2.fetchSignerSetup(
          req.body.vaultId,
          req.body.appId,
          req.body.verificationToken
        );

      if (isValid) {
        res.status(200).json({
          valid: isValid,
          xpub,
          masterFingerprint,
          derivationPath,
          policy,
        });
      } else {
        res.status(400).json({
          err: "Validation failed: verification token is either invalid or has expired",
        });
      }
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  router.post("/v2/updateSignerPolicy", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.vaultId && !req.body.appId) {
      return res
        .status(400)
        .json({ err: "Input param missing - vaultId/appId" });
    }

    if (!req.body.updates) {
      return res.status(400).json({ err: "Input param missing - updates" });
    }

    try {
      const { updated } = await signerV2.updateSignerPolicy(
        req.body.vaultId,
        req.body.appId,
        req.body.updates
      );
      res.status(200).json({
        updated,
      });
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  router.post("/v2/signTransaction", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.vaultId && !req.body.appId) {
      return res
        .status(400)
        .json({ err: "Input param missing - vaultId/appId" });
    }

    if (!req.body.serializedPSBT) {
      return res
        .status(400)
        .json({ err: "Input param missing - serializedPSBT" });
    }

    if (!req.body.outgoing) {
      return res.status(400).json({ err: "Input param missing - outgoing" });
    }

    try {
      const signedPSBT = await signerV2.signPSBT(
        req.body.vaultId,
        req.body.appId,
        req.body.serializedPSBT,
        req.body.outgoing,
        req.body.verificationToken
      );
      res.status(200).json({
        signedPSBT,
      });
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  router.post("/v2/checkSignerHealth", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.vaultId && !req.body.appId) {
      return res
        .status(400)
        .json({ err: "Input param missing - vaultId/appId" });
    }

    try {
      const { isSignerAvailable } = await signerV2.checkSignerHealth(
        req.body.vaultId,
        req.body.appId
      );
      res.status(200).json({
        isSignerAvailable,
      });
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  return router;
};
