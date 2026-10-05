import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { logger } from "../utilities/logger";
import { StatusCodes } from '../routes/router';

/**
 * Middleware to validate request data using Zod schemas.
 * @param {AnyZodObject} schema - The Zod schema to validate against.
 * @returns {Function} Middleware function for Express.
 */
export const validateRequest = (schema: AnyZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse and validate the request body, query, and params
      // We parse body separately as other parts might not always be present
      const validated = await schema.parseAsync({
        body: req.body,
        // query: req.query,
        // params: req.params,
        // Avoid validating all headers unless strictly necessary
      });
     
      // Optional: Replace req parts with validated data if needed, though direct access after parse is safe
      // req.body = validated.body;
      // req.query = validated.query;
      // req.params = validated.params;

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        const primaryError = errorMessages[0]? `Input validation failed @${errorMessages[0].field} - ${errorMessages[0].message}` : 'Invalid Input';
        return res.status(StatusCodes.BAD_REQUEST).json({
          err: primaryError,
          details: errorMessages,
        });
      }
      // Pass other errors to the global error handler
      logger.error('Unhandled Error in Validation Middleware:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ err: 'An unexpected error occurred' });
      // use next(error) if we've a dedicated error handling middleware
      // return next(error);
    }
  };
