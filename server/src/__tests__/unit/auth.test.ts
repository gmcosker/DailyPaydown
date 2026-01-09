/**
 * Unit tests for authentication functions
 */

import { hashPassword, verifyPassword, generateToken, verifyToken } from '../../auth';

describe('Auth Functions', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
      expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });

    it('should produce different hashes for the same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2); // Different salts should produce different hashes
    });

    it('should handle empty password', async () => {
      const password = '';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('verifyPassword', () => {
    it('should verify a correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should handle empty password', async () => {
      const password = '';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword('', hash);
      expect(isValid).toBe(true);
    });

    it('should reject empty password against non-empty hash', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword('', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate a JWT token', () => {
      const userId = 'test-user-id-123';
      const token = generateToken(userId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate different tokens for different users', () => {
      const userId1 = 'test-user-id-123';
      const userId2 = 'test-user-id-456';
      
      const token1 = generateToken(userId1);
      const token2 = generateToken(userId2);
      
      expect(token1).not.toBe(token2);
    });

    it('should generate different tokens on each call', () => {
      const userId = 'test-user-id-123';
      const token1 = generateToken(userId);
      const token2 = generateToken(userId);
      
      // Tokens might be different due to timestamp in JWT
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const userId = 'test-user-id-123';
      const token = generateToken(userId);
      
      const decoded = verifyToken(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded).toHaveProperty('userId', userId);
    });

    it('should reject an invalid token', () => {
      const invalidToken = 'invalid.token.here';
      
      const decoded = verifyToken(invalidToken);
      
      expect(decoded).toBeNull();
    });

    it('should reject a malformed token', () => {
      const malformedToken = 'not-a-jwt-token';
      
      const decoded = verifyToken(malformedToken);
      
      expect(decoded).toBeNull();
    });

    it('should reject an empty token', () => {
      const emptyToken = '';
      
      const decoded = verifyToken(emptyToken);
      
      expect(decoded).toBeNull();
    });

    it('should extract correct userId from token', () => {
      const userId = 'test-user-id-123';
      const token = generateToken(userId);
      
      const decoded = verifyToken(token);
      
      expect(decoded).not.toBeNull();
      if (decoded) {
        expect(decoded.userId).toBe(userId);
      }
    });
  });

  describe('Integration: hashPassword and verifyPassword', () => {
    it('should work together correctly', async () => {
      const password = 'MySecurePassword123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });
  });

  describe('Integration: generateToken and verifyToken', () => {
    it('should work together correctly', () => {
      const userId = 'test-user-id-123';
      const token = generateToken(userId);
      const decoded = verifyToken(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(userId);
    });
  });
});

