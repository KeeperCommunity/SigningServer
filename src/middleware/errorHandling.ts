import { Request, Response, NextFunction } from "express"; // Added Request, Response, NextFunction
import { StatusCodes } from "../routes/router";
import { logger } from "../utilities/logger";


/**
 * Middleware function to handle errors occurring in routes.
 *
 * Logs a fixed failure message and sends a JSON response
 * with the appropriate HTTP status code and error message.
 *
 * @param err - The error object, which can be an instance of `Error` or any other type.
 * @param req - The Express `Request` object representing the HTTP request.
 * @param res - The Express `Response` object used to send the HTTP response.
 * @param next - The Express `NextFunction` used to pass control to the next middleware.
 *
 * @remarks
 * If the error object has a `statusCode` property, it will be used as the HTTP status code.
 * Otherwise, the status code defaults to `400 Bad Request`.
 * The error message is extracted from the `Error` object if available, or a generic message is used.
 */
export const handleRouteError = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Provider and database exceptions can contain request or configuration data.
  logger.error("Signing Server route failed");
  const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
  const statusCode = err.statusCode || StatusCodes.BAD_REQUEST;
  res.status(statusCode).json({
    err: message,
  });
};
