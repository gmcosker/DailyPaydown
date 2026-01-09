/**
 * General test helpers
 */

import { Request } from 'express';
import { AuthRequest } from '../../auth';

/**
 * Create a mock request with userId
 */
export function createMockRequest(userId: string): AuthRequest {
  return {
    userId,
    headers: {
      authorization: `Bearer mock-token-${userId}`,
    },
    body: {},
    query: {},
    params: {},
  } as unknown as AuthRequest;
}

/**
 * Create a mock response
 */
export function createMockResponse() {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res;
}

/**
 * Sleep helper for async tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random email for testing
 */
export function randomEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

/**
 * Generate a random string
 */
export function randomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, length + 2);
}

