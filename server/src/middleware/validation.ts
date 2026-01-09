/**
 * Input validation middleware using express-validator
 * Validates and sanitizes all request inputs
 */

import { body, query, param, ValidationChain, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Middleware to check validation results
 */
export function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation error', { 
        errors: errors.array(), 
        path: req.path,
        method: req.method 
      });
      
      const errorMessages = errors.array().map(err => ({
        field: err.type === 'field' ? err.path : 'unknown',
        message: err.msg,
      }));

      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errorMessages,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Validators for common fields
 */
export const validators = {
  email: body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),

  password: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .optional(),

  passwordRequired: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),

  timezone: body('timezone')
    .optional()
    .trim()
    .isString()
    .withMessage('Timezone must be a string')
    .custom((value) => {
      // Validate IANA timezone format
      // Common timezones: America/New_York, America/Los_Angeles, Europe/London, etc.
      const timezoneRegex = /^[A-Z][a-z]+\/[A-Z][a-z_]+$/;
      if (!timezoneRegex.test(value)) {
        throw new Error('Invalid timezone format. Use IANA format (e.g., America/New_York)');
      }
      return true;
    }),

  notificationTime: body('notificationTime')
    .optional()
    .trim()
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Notification time must be in HH:MM format (24-hour)'),

  goal: body('goal')
    .optional()
    .trim()
    .isString()
    .withMessage('Goal must be a string'),

  creditAccountId: body('creditAccountId')
    .optional()
    .trim()
    .isString()
    .withMessage('Credit account ID must be a string')
    .isLength({ min: 1 })
    .withMessage('Credit account ID cannot be empty'),

  checkingAccountId: body('checkingAccountId')
    .optional()
    .trim()
    .isString()
    .withMessage('Checking account ID must be a string')
    .isLength({ min: 1 })
    .withMessage('Checking account ID cannot be empty'),

  publicToken: body('publicToken')
    .trim()
    .notEmpty()
    .withMessage('publicToken is required')
    .isString()
    .withMessage('publicToken must be a string'),

  apnsToken: body('apnsToken')
    .trim()
    .notEmpty()
    .withMessage('apnsToken is required')
    .isString()
    .withMessage('apnsToken must be a string')
    .isLength({ min: 64, max: 200 })
    .withMessage('apnsToken must be a valid device token'),

  date: body('date')
    .optional()
    .trim()
    .isISO8601()
    .withMessage('Date must be in ISO 8601 format'),

  itemId: param('itemId')
    .trim()
    .notEmpty()
    .withMessage('itemId is required')
    .isString()
    .withMessage('itemId must be a string'),

  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Limit must be between 1 and 365')
    .toInt(),

  offset: query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
    .toInt(),

  startDate: query('startDate')
    .optional()
    .trim()
    .isISO8601()
    .withMessage('startDate must be in ISO 8601 format'),

  endDate: query('endDate')
    .optional()
    .trim()
    .isISO8601()
    .withMessage('endDate must be in ISO 8601 format'),
};

