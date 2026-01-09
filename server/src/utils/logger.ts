/**
 * Structured logging configuration using Winston
 * Provides consistent logging across the application with log levels and formatting
 */

import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, errors, json, colorize, printf, splat } = winston.format;

// Custom format for console output in development
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// Create the logger instance
const logger = winston.createLogger({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }), // Capture stack traces
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    splat(), // Enable string interpolation
    env.nodeEnv === 'production' ? json() : consoleFormat
  ),
  defaultMeta: { service: 'dailypaydown-api' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: env.nodeEnv === 'production'
        ? combine(timestamp(), json())
        : combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), consoleFormat),
    }),
    // In production, also write errors to error.log
    ...(env.nodeEnv === 'production'
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Add request ID tracking capability
export interface LoggerWithRequestId {
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  info: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

export function createLoggerWithRequestId(requestId: string): LoggerWithRequestId {
  return {
    error: (message: string, meta?: any) => logger.error(message, { requestId, ...meta }),
    warn: (message: string, meta?: any) => logger.warn(message, { requestId, ...meta }),
    info: (message: string, meta?: any) => logger.info(message, { requestId, ...meta }),
    debug: (message: string, meta?: any) => logger.debug(message, { requestId, ...meta }),
  };
}

export default logger;


