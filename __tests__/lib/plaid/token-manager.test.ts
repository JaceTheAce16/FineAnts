/**
 * Tests for Token Manager (Encryption/Decryption)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';

// Generate a valid 32-byte (64 hex char) encryption key
const TEST_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

// Mock the config module
vi.mock('@/lib/plaid/config', () => ({
  plaidConfig: {
    secret: 'test-secret',
    environment: 'sandbox' as const,
    encryptionKey: TEST_ENCRYPTION_KEY,
  },
}));

describe('Token Manager - Encryption/Decryption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('encryptToken', () => {
    it('should encrypt a token successfully', async () => {
      const { encryptToken } = await import('@/lib/plaid/token-manager');
      const plaintext = 'access-sandbox-test-token-12345';

      const encrypted = encryptToken(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
    });

    it('should return encrypted token in correct format (iv:authTag:encrypted)', async () => {
      const { encryptToken } = await import('@/lib/plaid/token-manager');
      const plaintext = 'test-token';

      const encrypted = encryptToken(plaintext);

      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);

      // IV should be 16 bytes = 32 hex chars
      expect(parts[0]).toHaveLength(32);
      // Auth tag should be 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32);
      // Encrypted data length varies
      expect(parts[2].length).toBeGreaterThan(0);
    });

    it('should use different IVs for each encryption', async () => {
      const { encryptToken } = await import('@/lib/plaid/token-manager');
      const plaintext = 'test-token';

      const encrypted1 = encryptToken(plaintext);
      const encrypted2 = encryptToken(plaintext);

      expect(encrypted1).not.toBe(encrypted2);

      // Check that IVs are different
      const iv1 = encrypted1.split(':')[0];
      const iv2 = encrypted2.split(':')[0];
      expect(iv1).not.toBe(iv2);
    });

    it('should produce different ciphertexts for same plaintext (due to random IV)', async () => {
      const { encryptToken } = await import('@/lib/plaid/token-manager');
      const plaintext = 'identical-token';

      const encrypted1 = encryptToken(plaintext);
      const encrypted2 = encryptToken(plaintext);
      const encrypted3 = encryptToken(plaintext);

      // All should be different
      expect(encrypted1).not.toBe(encrypted2);
      expect(encrypted2).not.toBe(encrypted3);
      expect(encrypted1).not.toBe(encrypted3);

      // Extract encrypted portions
      const cipher1 = encrypted1.split(':')[2];
      const cipher2 = encrypted2.split(':')[2];
      const cipher3 = encrypted3.split(':')[2];

      expect(cipher1).not.toBe(cipher2);
      expect(cipher2).not.toBe(cipher3);
    });

    it('should encrypt different tokens to different ciphertexts', async () => {
      const { encryptToken } = await import('@/lib/plaid/token-manager');

      const encrypted1 = encryptToken('token-one');
      const encrypted2 = encryptToken('token-two');

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error when encryption key is not set', async () => {
      // Mock config without encryption key
      vi.resetModules();
      vi.doMock('@/lib/plaid/config', () => ({
        plaidConfig: {
          secret: 'test-secret',
          environment: 'sandbox' as const,
          encryptionKey: undefined,
        },
      }));

      const { encryptToken } = await import('@/lib/plaid/token-manager');

      expect(() => encryptToken('test-token')).toThrow('PLAID_ENCRYPTION_KEY is not set');

      // Restore original mock
      vi.resetModules();
      vi.doMock('@/lib/plaid/config', () => ({
        plaidConfig: {
          secret: 'test-secret',
          environment: 'sandbox' as const,
          encryptionKey: TEST_ENCRYPTION_KEY,
        },
      }));
    });

    it('should handle empty string token', async () => {
      const { encryptToken } = await import('@/lib/plaid/token-manager');

      const encrypted = encryptToken('');

      expect(encrypted).toBeDefined();
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
    });

    it('should handle long tokens', async () => {
      const { encryptToken } = await import('@/lib/plaid/token-manager');
      const longToken = 'a'.repeat(1000);

      const encrypted = encryptToken(longToken);

      expect(encrypted).toBeDefined();
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
    });

    it('should handle tokens with special characters', async () => {
      const { encryptToken } = await import('@/lib/plaid/token-manager');
      const specialToken = 'token-with-special!@#$%^&*()_+-=[]{}|;:,.<>?';

      const encrypted = encryptToken(specialToken);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });
  });

  describe('decryptToken', () => {
    it('should decrypt an encrypted token successfully', async () => {
      const { encryptToken, decryptToken } = await import('@/lib/plaid/token-manager');
      const plaintext = 'access-sandbox-test-token-12345';

      const encrypted = encryptToken(plaintext);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should perform round-trip encryption/decryption correctly', async () => {
      const { encryptToken, decryptToken } = await import('@/lib/plaid/token-manager');

      const testTokens = [
        'short',
        'access-sandbox-token-with-dashes',
        'token_with_underscores',
        'TokenWithMixedCase123',
        'very-long-token-' + 'x'.repeat(500),
        'token!with@special#chars',
      ];

      for (const token of testTokens) {
        const encrypted = encryptToken(token);
        const decrypted = decryptToken(encrypted);
        expect(decrypted).toBe(token);
      }
    });

    it('should decrypt multiple encryptions of same token correctly', async () => {
      const { encryptToken, decryptToken } = await import('@/lib/plaid/token-manager');
      const plaintext = 'test-token';

      const encrypted1 = encryptToken(plaintext);
      const encrypted2 = encryptToken(plaintext);
      const encrypted3 = encryptToken(plaintext);

      expect(decryptToken(encrypted1)).toBe(plaintext);
      expect(decryptToken(encrypted2)).toBe(plaintext);
      expect(decryptToken(encrypted3)).toBe(plaintext);
    });

    it('should throw error for invalid token format', async () => {
      const { decryptToken } = await import('@/lib/plaid/token-manager');

      expect(() => decryptToken('invalid')).toThrow('Invalid encrypted token format');
      expect(() => decryptToken('only:two')).toThrow('Invalid encrypted token format');
      expect(() => decryptToken('too:many:parts:here')).toThrow('Invalid encrypted token format');
      expect(() => decryptToken('')).toThrow('Invalid encrypted token format');
    });

    it('should throw error for invalid IV length', async () => {
      const { decryptToken } = await import('@/lib/plaid/token-manager');

      // Create token with invalid IV (too short)
      const invalidToken = 'abcd:' + 'a'.repeat(32) + ':encrypted';

      expect(() => decryptToken(invalidToken)).toThrow('Invalid IV length');
    });

    it('should throw error for invalid auth tag length', async () => {
      const { decryptToken } = await import('@/lib/plaid/token-manager');

      // Create token with valid IV but invalid auth tag
      const invalidToken = 'a'.repeat(32) + ':abcd:encrypted';

      expect(() => decryptToken(invalidToken)).toThrow('Invalid auth tag length');
    });

    it('should throw error when decryption key is not set', async () => {
      // Mock config without encryption key
      vi.resetModules();
      vi.doMock('@/lib/plaid/config', () => ({
        plaidConfig: {
          secret: 'test-secret',
          environment: 'sandbox' as const,
          encryptionKey: undefined,
        },
      }));

      const { decryptToken } = await import('@/lib/plaid/token-manager');

      expect(() => decryptToken('a:b:c')).toThrow('PLAID_ENCRYPTION_KEY is not set');

      // Restore original mock
      vi.resetModules();
      vi.doMock('@/lib/plaid/config', () => ({
        plaidConfig: {
          secret: 'test-secret',
          environment: 'sandbox' as const,
          encryptionKey: TEST_ENCRYPTION_KEY,
        },
      }));
    });

    it('should throw error when auth tag verification fails (tampered data)', async () => {
      const { encryptToken, decryptToken } = await import('@/lib/plaid/token-manager');

      const encrypted = encryptToken('test-token');
      const parts = encrypted.split(':');

      // Tamper with the encrypted data
      const tamperedEncrypted = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}ff`;

      expect(() => decryptToken(tamperedEncrypted)).toThrow();
    });

    it('should throw error when using wrong encryption key', async () => {
      // Encrypt with one key
      vi.resetModules();
      const key1 = crypto.randomBytes(32).toString('hex');
      vi.doMock('@/lib/plaid/config', () => ({
        plaidConfig: {
          secret: 'test-secret',
          environment: 'sandbox' as const,
          encryptionKey: key1,
        },
      }));

      const { encryptToken } = await import('@/lib/plaid/token-manager');
      const encrypted = encryptToken('test-token');

      // Try to decrypt with different key
      vi.resetModules();
      const key2 = crypto.randomBytes(32).toString('hex');
      vi.doMock('@/lib/plaid/config', () => ({
        plaidConfig: {
          secret: 'test-secret',
          environment: 'sandbox' as const,
          encryptionKey: key2,
        },
      }));

      const { decryptToken } = await import('@/lib/plaid/token-manager');

      expect(() => decryptToken(encrypted)).toThrow();

      // Restore original mock
      vi.resetModules();
      vi.doMock('@/lib/plaid/config', () => ({
        plaidConfig: {
          secret: 'test-secret',
          environment: 'sandbox' as const,
          encryptionKey: TEST_ENCRYPTION_KEY,
        },
      }));
    });

    it('should handle empty string decryption', async () => {
      const { encryptToken, decryptToken } = await import('@/lib/plaid/token-manager');

      const encrypted = encryptToken('');
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe('');
    });
  });

  describe('Security properties', () => {
    it('should use unique IV for each encryption (non-deterministic)', async () => {
      const { encryptToken } = await import('@/lib/plaid/token-manager');
      const plaintext = 'same-token';

      const ivs = new Set<string>();

      // Encrypt same token 100 times
      for (let i = 0; i < 100; i++) {
        const encrypted = encryptToken(plaintext);
        const iv = encrypted.split(':')[0];
        ivs.add(iv);
      }

      // All IVs should be unique
      expect(ivs.size).toBe(100);
    });

    it('should produce ciphertexts with correct hex encoding', async () => {
      const { encryptToken } = await import('@/lib/plaid/token-manager');

      const encrypted = encryptToken('test-token');
      const parts = encrypted.split(':');

      // Check all parts are valid hex
      const hexPattern = /^[0-9a-f]+$/i;
      expect(hexPattern.test(parts[0])).toBe(true); // IV
      expect(hexPattern.test(parts[1])).toBe(true); // Auth tag
      expect(hexPattern.test(parts[2])).toBe(true); // Encrypted data
    });

    it('should maintain encryption integrity over multiple operations', async () => {
      const { encryptToken, decryptToken } = await import('@/lib/plaid/token-manager');

      const tokens = [
        'token1',
        'token2',
        'token3',
        'token4',
        'token5',
      ];

      // Encrypt all tokens
      const encrypted = tokens.map(t => encryptToken(t));

      // Decrypt in random order
      const shuffled = [...encrypted].sort(() => Math.random() - 0.5);

      // All should decrypt to original values
      const originalTokens = shuffled.map(e => decryptToken(e));
      expect(originalTokens.sort()).toEqual(tokens.sort());
    });
  });
});
