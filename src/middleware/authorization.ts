import { Request, Response, NextFunction } from "express";
import { isAuthorized, StatusCodes } from "../routes/router";

/**
 * Middleware function to authorize incoming requests based on the provided HEXA_ID.
 *
 * @param req - The HTTP request object, expected to contain a `body` property with a `HEXA_ID` field.
 * @param res - The HTTP response object used to send a response if the request is unauthorized.
 * @param next - The callback function to pass control to the next middleware in the stack.
 *
 * @returns If the `HEXA_ID` is not authorized, responds with a 400 Bad Request status and an error message.
 *          Otherwise, passes control to the next middleware.
 */
export const authorizeRequest = (req: Request, res: Response, next: NextFunction) => { 
    if (!isAuthorized(req.body.HEXA_ID)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ err: "Unauthorized request" });
    }
    next();
}