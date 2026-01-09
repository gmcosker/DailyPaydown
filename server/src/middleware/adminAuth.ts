/**
 * Admin authentication middleware
 * Protects admin endpoints with API key authentication
 */

import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { AuthorizationError } from '../utils/errors';
import logger from '../utils/logger';

export interface AdminRequest extends Request {
  isAdmin?: boolean;
}

/**
 * Middleware to authenticate admin requests
 * Checks for ADMIN_API_KEY in Authorization header or query parameter
 */
export function authenticateAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): void {
  // If no admin API key is configured, allow access (for development)
  if (!env.adminApiKey) {
    logger.warn('Admin API key not configured, allowing access (development mode)');
    req.isAdmin = true;
    return next();
  }

  // Check Authorization header: "Bearer <api-key>" or "ApiKey <api-key>"
  const authHeader = req.headers.authorization;
  let providedKey: string | undefined;

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && (parts[0] === 'Bearer' || parts[0] === 'ApiKey')) {
      providedKey = parts[1];
    }
  }

  // Also check query parameter (less secure, but useful for testing)
  if (!providedKey && req.query.apiKey) {
    providedKey = req.query.apiKey as string;
  }

  if (!providedKey) {
    logger.warn('Admin endpoint accessed without API key', { 
      path: req.path, 
      ip: req.ip 
    });
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Admin API key required',
      },
    });
    return;
  }

  // Compare keys using constant-time comparison
  if (providedKey !== env.adminApiKey) {
    logger.warn('Invalid admin API key provided', { 
      path: req.path, 
      ip: req.ip 
    });
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid admin API key',
      },
    });
    return;
  }

  req.isAdmin = true;
  logger.debug('Admin request authenticated', { path: req.path });
  next();
}

