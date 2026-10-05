import { Router } from "express";
import inheritanceKeyV2 from "../../services/assistedKeys.ts/inheritance/inheritanceKeyV2";
import { isAuthorized } from "../router";

export const routesV2 = (router: Router): Router => {
  router.post("/v2/initializeIKSetup", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.vaultId) {
      return res.status(400).json({ err: "Input param missing - vaultId" });
    }

    try {
      const { setupData } = await inheritanceKeyV2.initializeIKSetup(
        req.body.vaultId
      );
      res.status(200).json({
        setupData,
      });
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  router.post("/v2/finalizeIKSetup", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.vaultId) {
      return res.status(400).json({ err: "Input param missing - vaultId" });
    }

    if (!req.body.configuration) {
      return res
        .status(400)
        .json({ err: "Input param missing - configuration" });
    }

    if (!req.body.policy) {
      return res.status(400).json({ err: "Input param missing - policy" });
    }

    try {
      const { setupSuccessful } = await inheritanceKeyV2.finalizeIKSetup(
        req.body.vaultId,
        req.body.configuration,
        req.body.policy
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

  router.post("/v2/updateInheritanceConfig", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.vaultId) {
      return res.status(400).json({ err: "Input param missing - vaultId" });
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
      const { updated } = await inheritanceKeyV2.updateInheritanceConfig(
        req.body.vaultId,
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

  router.post("/v2/updateInheritancePolicy", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.vaultId) {
      return res.status(400).json({ err: "Input param missing - vaultId" });
    }

    if (!req.body.updates) {
      return res.status(400).json({ err: "Input param missing - updates" });
    }

    if (!req.body.thresholdDescriptors) {
      return res
        .status(400)
        .json({ err: "Input param missing - thresholdDescriptors" });
    }

    try {
      const { updated } = await inheritanceKeyV2.updateInheritancePolicy(
        req.body.vaultId,
        req.body.updates,
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

  router.post("/v2/requestInheritanceKey", async (req, res) => {
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(400).json({ err: "Unauthorized request" });
    }

    if (!req.body.vaultId) {
      return res.status(400).json({ err: "Input param missing - vaultId" });
    }

    if (!req.body.requestId) {
      return res.status(400).json({ err: "Input param missing - requestId" });
    }

    if (!req.body.thresholdDescriptors) {
      return res
        .status(400)
        .json({ err: "Input param missing - thresholdDescriptors" });
    }

    try {
      const { requestStatus, setupInfo } =
        await inheritanceKeyV2.requestInheritanceKey(
          req.body.requestId,
          req.body.vaultId,
          req.body.thresholdDescriptors
        );
      res.status(200).json({ requestStatus, setupInfo });
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  router.post("/v2/declineInheritanceKeyRequest", async (req, res) => {
    if (!req.body.requestId) {
      return res.status(400).json({ err: "Input param missing - requestId" });
    }

    try {
      const { declined } = await inheritanceKeyV2.declineInheritanceKeyRequest(
        req.body.requestId
      );
      res.status(200).json({ declined });
    } catch (err) {
      res.status(400).json({
        err: err.message,
      });
    }
  });

  return router;
};
