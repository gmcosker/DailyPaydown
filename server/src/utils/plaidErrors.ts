/**
 * Plaid error handling utilities
 */

import logger from './logger';

export interface PlaidError {
  error_code: string;
  error_message: string;
  error_type: string;
  display_message?: string;
}

/**
 * Check if a Plaid error indicates token expiration or login required
 */
export function isTokenExpiredError(error: any): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const errorCode = error.error_code || error.code || '';
  const errorType = error.error_type || error.type || '';

  // Plaid error codes that indicate token issues
  const expiredCodes = [
    'ITEM_LOGIN_REQUIRED',
    'INVALID_ACCESS_TOKEN',
    'ACCESS_TOKEN_NOT_FOUND',
    'ITEM_NOT_FOUND',
  ];

  return expiredCodes.includes(errorCode) || 
         errorCode === 'ITEM_ERROR' && errorType === 'ITEM_LOGIN_REQUIRED';
}

/**
 * Extract error information from Plaid error
 */
export function extractPlaidError(error: any): PlaidError | null {
  if (!error) {
    return null;
  }

  // Handle Plaid API error response format
  if (error.response?.data) {
    return {
      error_code: error.response.data.error_code || 'UNKNOWN',
      error_message: error.response.data.error_message || 'Unknown error',
      error_type: error.response.data.error_type || 'UNKNOWN',
      display_message: error.response.data.display_message,
    };
  }

  // Handle direct error object
  if (error.error_code) {
    return {
      error_code: error.error_code,
      error_message: error.error_message || error.message || 'Unknown error',
      error_type: error.error_type || 'UNKNOWN',
      display_message: error.display_message,
    };
  }

  return null;
}

/**
 * Log Plaid error with context
 */
export function logPlaidError(
  error: any,
  context: { userId?: string; itemId?: string; operation?: string }
): void {
  const plaidError = extractPlaidError(error);
  
  if (plaidError) {
    logger.error('Plaid API error', {
      ...context,
      error_code: plaidError.error_code,
      error_type: plaidError.error_type,
      error_message: plaidError.error_message,
      isTokenExpired: isTokenExpiredError(error),
    });
  } else {
    logger.error('Unknown Plaid error format', {
      ...context,
      error: error.toString(),
      errorObject: error,
    });
  }
}


