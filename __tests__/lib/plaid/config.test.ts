/**
 * Tests for Plaid Configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Plaid Configuration', () => {
  // Store original env values
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validatePlaidConfig', () => {
    it('should pass validation with all required variables set correctly', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '1234567890abcdef';
      process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { validatePlaidConfig } = await import('@/lib/plaid/config');
      const result = validatePlaidConfig();

      expect(result).toBe(true);
    });

    it('should fail validation when NEXT_PUBLIC_PLAID_CLIENT_ID is missing', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '';
      process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { validatePlaidConfig } = await import('@/lib/plaid/config');
      const result = validatePlaidConfig();

      expect(result).toBe(false);
    });

    it('should fail validation when client ID is too short', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '123';
      process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { validatePlaidConfig } = await import('@/lib/plaid/config');
      const result = validatePlaidConfig();

      expect(result).toBe(false);
    });

    it('should fail validation when PLAID_SECRET_KEY is missing', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '1234567890abcdef';
      process.env.PLAID_SECRET_KEY = '';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { validatePlaidConfig } = await import('@/lib/plaid/config');
      const result = validatePlaidConfig();

      expect(result).toBe(false);
    });

    it('should fail validation when secret key is too short', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '1234567890abcdef';
      process.env.PLAID_SECRET_KEY = '123';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { validatePlaidConfig } = await import('@/lib/plaid/config');
      const result = validatePlaidConfig();

      expect(result).toBe(false);
    });

    it('should fail validation with invalid PLAID_ENV', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '1234567890abcdef';
      process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
      process.env.PLAID_ENV = 'invalid-env';
      process.env.PLAID_ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { validatePlaidConfig } = await import('@/lib/plaid/config');
      const result = validatePlaidConfig();

      expect(result).toBe(false);
    });

    it('should accept valid PLAID_ENV values', async () => {
      const validEnvs = ['sandbox', 'development', 'production'];

      for (const env of validEnvs) {
        process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '1234567890abcdef';
        process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
        process.env.PLAID_ENV = env;
        process.env.PLAID_ENCRYPTION_KEY = 'a'.repeat(64);
        process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

        vi.resetModules();
        const { validatePlaidConfig } = await import('@/lib/plaid/config');
        const result = validatePlaidConfig();

        expect(result).toBe(true);
      }
    });

    it('should fail validation when PLAID_ENCRYPTION_KEY is missing', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '1234567890abcdef';
      process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_ENCRYPTION_KEY = '';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { validatePlaidConfig } = await import('@/lib/plaid/config');
      const result = validatePlaidConfig();

      expect(result).toBe(false);
    });

    it('should fail validation when encryption key is not 64 hex characters', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '1234567890abcdef';
      process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_ENCRYPTION_KEY = 'tooshort';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { validatePlaidConfig } = await import('@/lib/plaid/config');
      const result = validatePlaidConfig();

      expect(result).toBe(false);
    });

    it('should fail validation when encryption key contains non-hex characters', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '1234567890abcdef';
      process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_ENCRYPTION_KEY = 'g'.repeat(64); // 'g' is not a hex character
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { validatePlaidConfig } = await import('@/lib/plaid/config');
      const result = validatePlaidConfig();

      expect(result).toBe(false);
    });

    it('should accept valid hex encryption key (lowercase)', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '1234567890abcdef';
      process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_ENCRYPTION_KEY = 'abcdef0123456789'.repeat(4); // 64 valid hex chars
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { validatePlaidConfig } = await import('@/lib/plaid/config');
      const result = validatePlaidConfig();

      expect(result).toBe(true);
    });

    it('should accept valid hex encryption key (uppercase)', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '1234567890abcdef';
      process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_ENCRYPTION_KEY = 'ABCDEF0123456789'.repeat(4); // 64 valid hex chars
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { validatePlaidConfig } = await import('@/lib/plaid/config');
      const result = validatePlaidConfig();

      expect(result).toBe(true);
    });

    it('should fail validation when NEXT_PUBLIC_APP_URL is missing', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '1234567890abcdef';
      process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.NEXT_PUBLIC_APP_URL = '';

      const { validatePlaidConfig } = await import('@/lib/plaid/config');
      const result = validatePlaidConfig();

      expect(result).toBe(false);
    });

    it('should fail validation when APP_URL does not start with http', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '1234567890abcdef';
      process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.NEXT_PUBLIC_APP_URL = 'localhost:3000';

      const { validatePlaidConfig } = await import('@/lib/plaid/config');
      const result = validatePlaidConfig();

      expect(result).toBe(false);
    });

    it('should accept http and https URLs', async () => {
      const validUrls = ['http://localhost:3000', 'https://example.com'];

      for (const url of validUrls) {
        process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '1234567890abcdef';
        process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
        process.env.PLAID_ENV = 'sandbox';
        process.env.PLAID_ENCRYPTION_KEY = 'a'.repeat(64);
        process.env.NEXT_PUBLIC_APP_URL = url;

        vi.resetModules();
        const { validatePlaidConfig } = await import('@/lib/plaid/config');
        const result = validatePlaidConfig();

        expect(result).toBe(true);
      }
    });
  });

  describe('isPlaidConfigured', () => {
    it('should return true when all required variables are set', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '1234567890abcdef';
      process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { isPlaidConfigured } = await import('@/lib/plaid/config');
      const result = isPlaidConfigured();

      expect(result).toBe(true);
    });

    it('should return false when any required variable is missing', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '';
      process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { isPlaidConfigured } = await import('@/lib/plaid/config');
      const result = isPlaidConfigured();

      expect(result).toBe(false);
    });

    it('should return false when environment is invalid', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = '1234567890abcdef';
      process.env.PLAID_SECRET_KEY = 'sandbox-secret-key-1234567890';
      process.env.PLAID_ENV = 'invalid';
      process.env.PLAID_ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { isPlaidConfigured } = await import('@/lib/plaid/config');
      const result = isPlaidConfigured();

      expect(result).toBe(false);
    });
  });

  describe('plaidConfig and plaidPublicConfig', () => {
    it('should export server-side config', async () => {
      process.env.PLAID_SECRET_KEY = 'test-secret';
      process.env.PLAID_ENV = 'sandbox';
      process.env.PLAID_ENCRYPTION_KEY = 'a'.repeat(64);

      const { plaidConfig } = await import('@/lib/plaid/config');

      expect(plaidConfig.secret).toBe('test-secret');
      expect(plaidConfig.environment).toBe('sandbox');
      expect(plaidConfig.encryptionKey).toBe('a'.repeat(64));
    });

    it('should export client-side config', async () => {
      process.env.NEXT_PUBLIC_PLAID_CLIENT_ID = 'test-client-id';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { plaidPublicConfig } = await import('@/lib/plaid/config');

      expect(plaidPublicConfig.clientId).toBe('test-client-id');
      expect(plaidPublicConfig.appUrl).toBe('http://localhost:3000');
    });

    it('should default to sandbox environment', async () => {
      process.env.PLAID_ENV = '';

      const { plaidConfig } = await import('@/lib/plaid/config');

      expect(plaidConfig.environment).toBe('sandbox');
    });

    it('should export webhook URL', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const { plaidWebhookUrl } = await import('@/lib/plaid/config');

      expect(plaidWebhookUrl).toBe('http://localhost:3000/api/webhooks/plaid');
    });
  });
});
