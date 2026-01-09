/**
 * Error handling middleware
 * Catches and formats errors consistently across all routes
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, formatErrorResponse, ErrorCode } from '../utils/errors';
import logger from '../utils/logger';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('Application error', {
        error: err,
        code: err.code,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        details: err.details,
      });
    } else {
      logger.warn('Client error', {
        error: err.message,
        code: err.code,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
      });
    }
  } else {
    // Unknown/unexpected errors
    logger.error('Unexpected error', {
      error: err,
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // Format error response
  const errorResponse = formatErrorResponse(err);
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  res.status(statusCode).json(errorResponse);
}

/**
 * Async route handler wrapper to catch errors
 * Usage: wrapAsync(async (req, res) => { ... })
 */
export function wrapAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}


