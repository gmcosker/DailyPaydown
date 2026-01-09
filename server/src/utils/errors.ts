/**
 * Error classes and error codes for consistent error handling
 */

export enum ErrorCode {
  // Authentication errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  
  // Authorization errors (403)
  FORBIDDEN = 'FORBIDDEN',
  
  // Not found errors (404)
  NOT_FOUND = 'NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Conflict errors (409)
  CONFLICT = 'CONFLICT',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  
  // External service errors (502, 503)
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  PLAID_ERROR = 'PLAID_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  
  // Internal server errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', details?: any) {
    super(ErrorCode.UNAUTHORIZED, message, 401, details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Forbidden', details?: any) {
    super(ErrorCode.FORBIDDEN, message, 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: any) {
    super(ErrorCode.NOT_FOUND, message, 404, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.CONFLICT, message, 409, details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: any) {
    super(ErrorCode.EXTERNAL_SERVICE_ERROR, `${service}: ${message}`, 502, details);
  }
}

/**
 * Format error response for client
 */
export function formatErrorResponse(error: Error | AppError): {
  error: {
    code: string;
    message: string;
    details?: any;
  };
} {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  // For non-AppError errors, return generic error
  return {
    error: {
      code: ErrorCode.UNKNOWN_ERROR,
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message,
      details: process.env.NODE_ENV === 'production' ? undefined : { stack: error.stack },
    },
  };
}


