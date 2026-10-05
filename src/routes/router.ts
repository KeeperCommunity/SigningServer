import {  Router } from "express";
import config from "../config";
import { ssSignerRoutes } from "./ss-signer";
import { inheritanceRoutes } from "./inheritance";

export const StatusCodes = {
    OK: 200,
    BAD_REQUEST: 400,
    INTERNAL_SERVER_ERROR: 500,
};

export const isAdmin = (ADMIN_KEY: string): boolean => {
  if (ADMIN_KEY === config.ADMIN_KEY) {
    return true;
  }
  return false;
};

export const isAuthorized = (HEXA_ID: string): boolean =>
  config.HEXA_ID === HEXA_ID;

export const isNumber = (value: string): boolean => !isNaN(parseInt(value, 10));

export const initializeRoutes = (app): Router => {
  let router: Router = app.get("router");
  const initializedAt = Date();
  
  router.get("/", (req, res) => {
    res.send(
      `${initializedAt} 
       Signing Server :: ENV:${config.ENVIRONMENT}  
       DB:${config.DB_MODE}  
       V:${config.VERSION}`
    );
  });

  // Signing Server(2FA) signer routes
  // router = ssSignerRoutes.v1(router)   // supports Savings account(v1)         :: in-active
  router = ssSignerRoutes.v2(router)      // supports Signing Server Signer v2    :: active
  router = ssSignerRoutes.v3(router)      // supports Signing Server Signer v3    :: active


  // Inheritance Key routes
  router = inheritanceRoutes.v2(router)   //  supports Inheritance Key Server v2  :: active
  router = inheritanceRoutes.v3(router)   //  supports Inheritance Key Server v3  :: active

  return router
};
