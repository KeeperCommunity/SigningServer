import { Router } from "express";
import inheritanceKeyV3 from "../../services/assistedKeys.ts/inheritance/inheritanceKeyV3";
import { isAuthorized } from "../router";
import { EMAIL_TEMPLATES } from "../../services/mailing/templates";

export const routesV3 = (router: Router): Router => {
  router.post("/v3/initializeIKSetup", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    try {
      const { setupData } = await inheritanceKeyV3.initializeIKSetup();
      res.status(200).json({
        setupData,
      });
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  router.post("/v3/finalizeIKSetup", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.id) {
      return res.status(400).json({ err: "Input param missing - id" });
    }

    if (!req.body.configuration) {
      return res
        .status(400)
        .json({ err: "Input param missing - configuration" });
    }

    if (!req.body.updatedEncryptedPolicy) {
      return res
        .status(400)
        .json({ err: "Input param missing - updatedEncryptedPolicy" });
    }

    try {
      const { setupSuccessful } = await inheritanceKeyV3.finalizeIKSetup(
        req.body.id,
        req.body.configuration,
        req.body.updatedEncryptedPolicy
      );
      res.status(200).json({
        setupSuccessful,
      });
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  router.post("/v3/updateInheritanceConfig", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.id) {
      return res.status(400).json({ err: "Input param missing - id" });
    }

    if (!req.body.existingThresholdDescriptors) {
      return res
        .status(400)
        .json({ err: "Input param missing - existingThresholdDescriptors" });
    }

    if (!req.body.newConfiguration) {
      return res
        .status(400)
        .json({ err: "Input param missing - newConfiguration" });
    }

    try {
      const { updated } = await inheritanceKeyV3.updateInheritanceConfig(
        req.body.id,
        req.body.existingThresholdDescriptors,
        req.body.newConfiguration
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

  router.post("/v3/updateInheritancePolicy", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.id) {
      return res.status(400).json({ err: "Input param missing - id" });
    }

    if (!req.body.updatedEncryptedPolicy) {
      return res
        .status(400)
        .json({ err: "Input param missing - updatedEncryptedPolicy" });
    }

    if (!req.body.thresholdDescriptors) {
      return res
        .status(400)
        .json({ err: "Input param missing - thresholdDescriptors" });
    }

    try {
      const { updated } = await inheritanceKeyV3.updateInheritancePolicy(
        req.body.id,
        req.body.updatedEncryptedPolicy,
        req.body.thresholdDescriptors
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

  router.post("/v3/updateCosignersToSignerMapIKS", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.id) {
      return res.status(400).json({ err: "Input param missing - id" });
    }

    if (!req.body.cosignersMapIKSUpdates) {
      return res
        .status(400)
        .json({ err: "Input param missing - cosignersMapIKSUpdates" });
    }

    try {
      const { updated } = await inheritanceKeyV3.updateCosignersToSignerMapIKS(
        req.body.cosignersMapIKSUpdates,
        req.body.id
      );
      res.status(200).json({
        updated,
      });
    } catch (err) {
      res.status(400).json({
        updated: false,
        err: err.message,
      });
    }
  });

  router.post("/v3/findIKSSetup", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.ids) {
      return res.status(400).json({ err: "Input param missing - ids" });
    }

    if (!req.body.thresholdDescriptors) {
      return res
        .status(400)
        .json({ err: "Input param missing - thresholdDescriptors" });
    }

    try {
      const { setupInfo } = await inheritanceKeyV3.findIKSSetup(
        req.body.ids,
        req.body.thresholdDescriptors
      );
      res.status(200).json({ setupInfo });
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  router.post("/v3/fetchIKSBackup", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.id) {
      return res.status(400).json({ err: "Input param missing - id" });
    }

    if (!req.body.requestId) {
      return res.status(400).json({ err: "Input param missing - requestId" });
    }

    if (!req.body.thresholdDescriptors) {
      return res
        .status(400)
        .json({ err: "Input param missing - thresholdDescriptors" });
    }

    if (!req.body.publicKey) {
      return res.status(400).json({ err: "Input param missing - publicKey" });
    }

    try {
      const { requestStatus, encryptedBackup } =
        await inheritanceKeyV3.fetchBackup(
          req.body.id,
          req.body.requestId,
          req.body.thresholdDescriptors,
          req.body.publicKey
        );
      res.status(200).json({
        requestStatus,
        encryptedBackup,
      });
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  router.post("/v3/checkIKSHealth", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.id) {
      return res.status(400).json({ err: "Input param missing - id" });
    }

    try {
      const { isIKSAvailable } = await inheritanceKeyV3.checkIKSHealth(
        req.body.id
      );
      res.status(200).json({
        isIKSAvailable,
      });
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  router.post("/v3/requestInheritanceKey", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.requestId) {
      return res.status(400).json({ err: "Input param missing - requestId" });
    }

    if (!req.body.cosignersId) {
      return res.status(400).json({ err: "Input param missing - cosignersId" });
    }

    if (!req.body.thresholdDescriptors) {
      return res
        .status(400)
        .json({ err: "Input param missing - thresholdDescriptors" });
    }

    try {
      const { requestStatus, setupInfo } =
        await inheritanceKeyV3.requestInheritanceKey(
          req.body.requestId,
          req.body.cosignersId,
          req.body.thresholdDescriptors
        );
      res.status(200).json({ requestStatus, setupInfo });
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  router.post("/v3/declineInheritanceKeyRequest", async (req, res) => {
    if (!req.body.requestId) {
      return res.status(400).json({ err: "Input param missing - requestId" });
    }

    try {
      const { declined, requestStatus } =
        await inheritanceKeyV3.declineInheritanceKeyRequest(req.body.requestId);

      if (!declined) {
        throw new Error("Failed to decline request");
      }

      if (req.body.isKeeper)
        res.status(200).json({
          declined,
        });
      // API request originating from within the Keeper app
      else {
        res.status(200).send(
          EMAIL_TEMPLATES.IKS_DECLINE.replace(
            // API request origination from external app(gmail), share formatted html 
            "{{status}}",
            requestStatus
          )
        );
      }
    } catch (err) {
      if (req.body.isKeeper)
        res.status(400).json({
          err: err.message,
        });
      else {
        res
          .status(400)
          .send(
            EMAIL_TEMPLATES.IKS_DECLINE.replace(
              "{{status}}",
              "Failed to Decline Inheritance Key Request"
            )
          );
      }
    }
  });

  router.post("/v3/signTransactionViaInheritanceKey", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.id) {
      return res.status(400).json({ err: "Input param missing - id" });
    }

    if (!req.body.requestId) {
      return res.status(400).json({ err: "Input param missing - requestId" });
    }

    if (!req.body.serializedPSBT) {
      return res
        .status(400)
        .json({ err: "Input param missing - serializedPSBT" });
    }

    if (!req.body.thresholdDescriptors) {
      return res
        .status(400)
        .json({ err: "Input param missing - thresholdDescriptors" });
    }

    try {
      const { requestStatus, signedPSBT } = await inheritanceKeyV3.signPSBT(
        req.body.id,
        req.body.requestId,
        req.body.serializedPSBT,
        req.body.thresholdDescriptors
      );
      res.status(200).json({
        requestStatus,
        signedPSBT,
      });
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  router.post("/v3/migrateIKSSignersV2ToV3", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.vaultId) {
      return res.status(400).json({ err: "Input param missing - vaultId" });
    }

    if (!req.body.cosignersMapIKSUpdates) {
      return res
        .status(400)
        .json({ err: "Input param missing - cosignersMapIKSUpdates" });
    }

    try {
      const { migrationSuccessful, setupData } =
        await inheritanceKeyV3.migrateIKSSignersV2ToV3(
          req.body.vaultId,
          req.body.cosignersMapIKSUpdates
        );
      res.status(200).json({
        migrationSuccessful,
        setupData,
      });
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  router.post("/v3/enrichCosignersToSignerMapIKS", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.id) {
      return res.status(400).json({ err: "Input param missing - id" });
    }

    if (!req.body.cosignersMapIKSUpdates) {
      return res
        .status(400)
        .json({ err: "Input param missing - cosignersMapIKSUpdates" });
    }

    try {
      const { updated } = await inheritanceKeyV3.enrichCosignersToSignerMapIKS(
        req.body.cosignersMapIKSUpdates,
        req.body.id
      );
      res.status(200).json({
        updated,
      });
    } catch (err) {
      res.status(400).json({
        updated: false,
        err: err.message,
      });
    }
  });

  return router;
};
