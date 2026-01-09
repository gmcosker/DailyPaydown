/**
 * Rate limiting middleware configurations
 * Protects against abuse and brute force attacks
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import logger from '../utils/logger';

/**
 * Rate limiter for authentication routes (login, register)
 * Stricter limits to prevent brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.',
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded for auth route', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts, please try again later.',
      },
    });
  },
});

/**
 * Rate limiter for Plaid routes
 * Moderate limits for API-intensive operations
 */
export const plaidLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each user to 20 requests per minute
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many Plaid API requests, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use userId from request if available (set by auth middleware)
  keyGenerator: (req: Request) => {
    return (req as any).userId || req.ip;
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded for Plaid route', {
      userId: (req as any).userId,
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many Plaid API requests, please try again later.',
      },
    });
  },
});

/**
 * General rate limiter for all other routes
 * More lenient limits for normal API usage
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each user to 100 requests per windowMs
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use userId from request if available (set by auth middleware)
  keyGenerator: (req: Request) => {
    return (req as any).userId || req.ip;
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      userId: (req as any).userId,
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
      },
    });
  },
});

