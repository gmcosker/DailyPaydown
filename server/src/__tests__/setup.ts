/**
 * Global test setup
 * Runs before all tests
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';
process.env.PLAID_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.PORT = '3001'; // Use different port for tests

// Suppress console logs during tests (optional - uncomment if needed)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Clean up test database before each test suite
beforeAll(async () => {
  // Generate Prisma client for test environment
  try {
    const schemaPath = path.join(__dirname, '../../../prisma/schema.prisma');
    execSync(`npx prisma generate --schema=${schemaPath}`, {
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
      stdio: 'ignore',
    });
  } catch (error) {
    // If generation fails, continue - Prisma might already be generated
  }

  // Reset database schema for tests
  try {
    const schemaPath = path.join(__dirname, '../../../prisma/schema.prisma');
    execSync(`npx prisma migrate reset --force --schema=${schemaPath}`, {
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
      stdio: 'ignore',
    });
  } catch (error) {
    // If migration fails, database might not exist yet - that's okay
    // Prisma will create it when we first connect
  }
});

// Clean up after all tests
afterAll(async () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    // Clean up test database
    await prisma.$disconnect();
  } catch (error) {
    // Ignore cleanup errors
  }
});

