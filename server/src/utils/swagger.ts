/**
 * Swagger/OpenAPI configuration
 * API documentation setup using swagger-jsdoc and swagger-ui-express
 */

import swaggerJsdoc from 'swagger-jsdoc';
import { env } from '../config/env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DailyPaydown API',
      version: '1.0.0',
      description: 'API documentation for DailyPaydown - Daily credit card spending tracker',
      contact: {
        name: 'DailyPaydown Support',
      },
    },
    servers: [
      {
        url: env.nodeEnv === 'production' 
          ? 'https://api.dailypaydown.com' 
          : `http://localhost:${env.port}`,
        description: env.nodeEnv === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /auth/login or /auth/register',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
          description: 'Admin API key (format: "ApiKey <key>")',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR',
                },
                message: {
                  type: 'string',
                  example: 'Validation failed',
                },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                  },
                },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            timezone: { type: 'string', nullable: true },
            notificationTime: { type: 'string', nullable: true, example: '19:00' },
            goal: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            amount: { type: 'number' },
            pending: { type: 'boolean' },
            date: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Plaid', description: 'Plaid integration endpoints' },
      { name: 'Today', description: 'Today\'s spending summary and transactions' },
      { name: 'History', description: 'Historical spending data' },
      { name: 'Settings', description: 'User settings management' },
      { name: 'Device', description: 'Device registration for push notifications' },
      { name: 'Admin', description: 'Administrative and monitoring endpoints' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/index.ts'], // Path to the API files
};

export const swaggerSpec = swaggerJsdoc(options);

