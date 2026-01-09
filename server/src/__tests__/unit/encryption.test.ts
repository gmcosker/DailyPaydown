/**
 * Unit tests for encryption utilities
 */

import { encryptPlaidToken, decryptPlaidToken } from '../../db';

describe('Encryption Utilities', () => {
  describe('encryptPlaidToken', () => {
    it('should encrypt a token', () => {
      const plaintext = 'test-access-token-12345';
      const encrypted = encryptPlaidToken(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');
      expect(encrypted.split(':')).toHaveLength(3); // Format: iv:authTag:encrypted
    });

    it('should produce different ciphertext for the same plaintext', () => {
      const plaintext = 'test-access-token-12345';
      const encrypted1 = encryptPlaidToken(plaintext);
      const encrypted2 = encryptPlaidToken(plaintext);
      
      // Different IVs should produce different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty string', () => {
      const plaintext = '';
      const encrypted = encryptPlaidToken(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted.split(':')).toHaveLength(3);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(1000);
      const encrypted = encryptPlaidToken(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted.split(':')).toHaveLength(3);
    });

    it('should handle special characters', () => {
      const plaintext = 'token-with-special-chars!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encryptPlaidToken(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted.split(':')).toHaveLength(3);
    });
  });

  describe('decryptPlaidToken', () => {
    it('should decrypt an encrypted token', () => {
      const plaintext = 'test-access-token-12345';
      const encrypted = encryptPlaidToken(plaintext);
      const decrypted = decryptPlaidToken(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt correctly for different encryptions', () => {
      const plaintext = 'test-access-token-12345';
      const encrypted1 = encryptPlaidToken(plaintext);
      const encrypted2 = encryptPlaidToken(plaintext);
      
      const decrypted1 = decryptPlaidToken(encrypted1);
      const decrypted2 = decryptPlaidToken(encrypted2);
      
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const plaintext = '';
      const encrypted = encryptPlaidToken(plaintext);
      const decrypted = decryptPlaidToken(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(1000);
      const encrypted = encryptPlaidToken(plaintext);
      const decrypted = decryptPlaidToken(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = 'token-with-special-chars!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encryptPlaidToken(plaintext);
      const decrypted = decryptPlaidToken(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for invalid format', () => {
      const invalidEncrypted = 'invalid-format';
      
      expect(() => {
        decryptPlaidToken(invalidEncrypted);
      }).toThrow();
    });

    it('should throw error for malformed data', () => {
      const malformed = 'invalid:format:missing:parts';
      
      expect(() => {
        decryptPlaidToken(malformed);
      }).toThrow();
    });

    it('should throw error for tampered data', () => {
      const plaintext = 'test-access-token-12345';
      const encrypted = encryptPlaidToken(plaintext);
      const parts = encrypted.split(':');
      parts[2] = 'tampered-data'; // Tamper with encrypted data
      const tampered = parts.join(':');
      
      expect(() => {
        decryptPlaidToken(tampered);
      }).toThrow();
    });
  });

  describe('Integration: encrypt and decrypt', () => {
    it('should round-trip correctly', () => {
      const tokens = [
        'simple-token',
        'token-with-numbers-12345',
        'token-with-special!@#$%',
        '',
        'a'.repeat(100),
      ];

      tokens.forEach(token => {
        const encrypted = encryptPlaidToken(token);
        const decrypted = decryptPlaidToken(encrypted);
        expect(decrypted).toBe(token);
      });
    });

    it('should handle real Plaid token format', () => {
      // Real Plaid tokens look like this
      const plaidToken = 'access-sandbox-12345678-1234-1234-1234-123456789012';
      const encrypted = encryptPlaidToken(plaidToken);
      const decrypted = decryptPlaidToken(encrypted);
      
      expect(decrypted).toBe(plaidToken);
    });
  });
});

