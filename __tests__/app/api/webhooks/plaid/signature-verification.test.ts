/**
 * Unit Tests for Plaid Webhook Signature Verification
 * Tests JWT verification, body hash validation, and replay attack prevention
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Mock environment variables
const originalEnv = process.env;

// Mock Supabase
const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock sync service
const mockSyncUserTransactions = vi.fn();

vi.mock('@/lib/plaid/sync-service', () => ({
  syncUserTransactions: mockSyncUserTransactions,
}));

describe('Plaid Webhook Signature Verification', () => {
  // Generate a test key pair for ES256 (same algorithm Plaid uses)
  // These are real ES256 keys generated for testing purposes only
  const testPrivateKey = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgV6nrN/T5gykMoz2A
T4IjFCFoHH6jsHgc1TsocIKFIh+hRANCAARb6V711mZdW10yd62672LEq+tdreXa
kTOapsdoPlVEwJl5mb8IP4yr1TsEW+1gbfSMhucA5bBTcpYzhLZhe1bE
-----END PRIVATE KEY-----`;

  const testPublicKey = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEW+le9dZmXVtdMnetuu9ixKvrXa3l
2pEzmqbHaD5VRMCZeZm/CD+Mq9U7BFvtYG30jIbnAOWwU3KWM4S2YXtWxA==
-----END PUBLIC KEY-----`;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };

    // Setup default mock responses
    mockSingle.mockResolvedValue({
      data: { user_id: 'user-123' },
      error: null,
    });

    const createEqChain = () => {
      const chain = {
        eq: vi.fn(() => chain),
        single: mockSingle,
      };
      return chain;
    };

    mockEq.mockImplementation(() => createEqChain());
    mockSelect.mockReturnValue(createEqChain());
    mockInsert.mockResolvedValue({ data: [], error: null });
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: {}, error: null }) });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'plaid_items') {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      } else if (table === 'webhook_events') {
        return {
          insert: mockInsert,
        };
      }
      return {};
    });

    mockSyncUserTransactions.mockResolvedValue({
      itemsProcessed: 1,
      itemsSuccessful: 1,
      itemsFailed: 0,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  /**
   * Helper function to create a valid JWT for testing
   */
  function createTestJWT(body: string, options: {
    useCorrectHash?: boolean;
    iat?: number;
    expiresIn?: string;
  } = {}): string {
    const {
      useCorrectHash = true,
      iat = Math.floor(Date.now() / 1000),
    } = options;

    const bodyHash = useCorrectHash
      ? crypto.createHash('sha256').update(body).digest('hex')
      : 'invalid-hash-12345';

    return jwt.sign(
      {
        request_body_sha256: bodyHash,
        iat,
      },
      testPrivateKey,
      {
        algorithm: 'ES256',
        ...(options.expiresIn ? { expiresIn: options.expiresIn } : {}),
      }
    );
  }

  describe('Valid Signature Verification', () => {
    it('should accept webhook with valid signature', async () => {
      process.env.PLAID_WEBHOOK_VERIFICATION_KEY = testPublicKey;

      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
        new_transactions: 5,
      });

      const validJWT = createTestJWT(webhookBody);

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      const request = {
        text: async () => webhookBody,
        headers: new Headers({
          'plaid-verification': validJWT,
        }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
    });

    it('should verify body hash correctly', async () => {
      process.env.PLAID_WEBHOOK_VERIFICATION_KEY = testPublicKey;

      const webhookBody = JSON.stringify({
        webhook_type: 'ITEM',
        webhook_code: 'ERROR',
        item_id: 'item-456',
        error: {
          error_code: 'ITEM_LOGIN_REQUIRED',
          error_message: 'Login required',
        },
      });

      const validJWT = createTestJWT(webhookBody, { useCorrectHash: true });

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      const request = {
        text: async () => webhookBody,
        headers: new Headers({
          'plaid-verification': validJWT,
        }),
      } as any;

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Invalid Signature Rejection', () => {
    it('should reject webhook with missing Plaid-Verification header', async () => {
      process.env.PLAID_WEBHOOK_VERIFICATION_KEY = testPublicKey;

      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      });

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      const request = {
        text: async () => webhookBody,
        headers: new Headers(), // No Plaid-Verification header
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid signature');
    });

    it('should reject webhook with invalid JWT signature', async () => {
      process.env.PLAID_WEBHOOK_VERIFICATION_KEY = testPublicKey;

      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      });

      // Create JWT with a different private key (different from testPrivateKey)
      const wrongPrivateKey = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg36Afv5/QuyWUhv8h
rzp8OuKAWw3MDZ3WwldtEAoTOzihRANCAAQNKjJs9lLZ6tA7+Q7KjgblezzelMXE
50sDKD/CONaIIFdHfP1r2c0XrRV6MoET2ChLLxFdVWLU5MnM6QXf064+
-----END PRIVATE KEY-----`;

      const invalidJWT = jwt.sign(
        {
          request_body_sha256: crypto.createHash('sha256').update(webhookBody).digest('hex'),
          iat: Math.floor(Date.now() / 1000),
        },
        wrongPrivateKey,
        { algorithm: 'ES256' }
      );

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      const request = {
        text: async () => webhookBody,
        headers: new Headers({
          'plaid-verification': invalidJWT,
        }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid signature');
    });

    it('should reject webhook with body hash mismatch', async () => {
      process.env.PLAID_WEBHOOK_VERIFICATION_KEY = testPublicKey;

      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      });

      // Create JWT with incorrect body hash
      const invalidJWT = createTestJWT(webhookBody, { useCorrectHash: false });

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      const request = {
        text: async () => webhookBody,
        headers: new Headers({
          'plaid-verification': invalidJWT,
        }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid signature');
    });
  });

  describe('Replay Attack Prevention', () => {
    it('should reject webhook with expired timestamp (older than 5 minutes)', async () => {
      process.env.PLAID_WEBHOOK_VERIFICATION_KEY = testPublicKey;

      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      });

      // Create JWT with timestamp from 10 minutes ago
      const tenMinutesAgo = Math.floor(Date.now() / 1000) - (10 * 60);
      const expiredJWT = createTestJWT(webhookBody, { iat: tenMinutesAgo });

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      const request = {
        text: async () => webhookBody,
        headers: new Headers({
          'plaid-verification': expiredJWT,
        }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid signature');
    });

    it('should accept webhook with recent timestamp (within 5 minutes)', async () => {
      process.env.PLAID_WEBHOOK_VERIFICATION_KEY = testPublicKey;

      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      });

      // Create JWT with timestamp from 2 minutes ago
      const twoMinutesAgo = Math.floor(Date.now() / 1000) - (2 * 60);
      const recentJWT = createTestJWT(webhookBody, { iat: twoMinutesAgo });

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      const request = {
        text: async () => webhookBody,
        headers: new Headers({
          'plaid-verification': recentJWT,
        }),
      } as any;

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should accept webhook with current timestamp', async () => {
      process.env.PLAID_WEBHOOK_VERIFICATION_KEY = testPublicKey;

      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      });

      const currentJWT = createTestJWT(webhookBody, {
        iat: Math.floor(Date.now() / 1000),
      });

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      const request = {
        text: async () => webhookBody,
        headers: new Headers({
          'plaid-verification': currentJWT,
        }),
      } as any;

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Environment Configuration', () => {
    it('should allow webhooks in development without verification key', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.PLAID_WEBHOOK_VERIFICATION_KEY;

      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      });

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      const request = {
        text: async () => webhookBody,
        headers: new Headers(), // No verification header
      } as any;

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should reject webhooks in production without verification key', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.PLAID_WEBHOOK_VERIFICATION_KEY;

      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      });

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      const request = {
        text: async () => webhookBody,
        headers: new Headers(),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid signature');
    });

    it('should enforce verification in production with key configured', async () => {
      process.env.NODE_ENV = 'production';
      process.env.PLAID_WEBHOOK_VERIFICATION_KEY = testPublicKey;

      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      });

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      // Request without verification header
      const request = {
        text: async () => webhookBody,
        headers: new Headers(),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid signature');
    });
  });

  describe('Malformed JWT Handling', () => {
    it('should reject webhook with malformed JWT', async () => {
      process.env.PLAID_WEBHOOK_VERIFICATION_KEY = testPublicKey;

      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      });

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      const request = {
        text: async () => webhookBody,
        headers: new Headers({
          'plaid-verification': 'this-is-not-a-valid-jwt',
        }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid signature');
    });

    it('should reject webhook with empty JWT', async () => {
      process.env.PLAID_WEBHOOK_VERIFICATION_KEY = testPublicKey;

      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      });

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      const request = {
        text: async () => webhookBody,
        headers: new Headers({
          'plaid-verification': '',
        }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid signature');
    });

    it('should reject JWT with wrong algorithm (HS256 instead of ES256)', async () => {
      process.env.PLAID_WEBHOOK_VERIFICATION_KEY = testPublicKey;

      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      });

      // Create JWT with HS256 instead of ES256
      const wrongAlgoJWT = jwt.sign(
        {
          request_body_sha256: crypto.createHash('sha256').update(webhookBody).digest('hex'),
          iat: Math.floor(Date.now() / 1000),
        },
        'secret-key',
        { algorithm: 'HS256' }
      );

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      const request = {
        text: async () => webhookBody,
        headers: new Headers({
          'plaid-verification': wrongAlgoJWT,
        }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid signature');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large webhook payloads', async () => {
      process.env.PLAID_WEBHOOK_VERIFICATION_KEY = testPublicKey;

      // Create a large payload
      const largePayload = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
        data: Array(1000).fill('x').join(''),
      };
      const webhookBody = JSON.stringify(largePayload);

      const validJWT = createTestJWT(webhookBody);

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      const request = {
        text: async () => webhookBody,
        headers: new Headers({
          'plaid-verification': validJWT,
        }),
      } as any;

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should handle webhook with special characters in body', async () => {
      process.env.PLAID_WEBHOOK_VERIFICATION_KEY = testPublicKey;

      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
        special_chars: '特殊文字 éàü 🚀 <script>alert("xss")</script>',
      });

      const validJWT = createTestJWT(webhookBody);

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      const request = {
        text: async () => webhookBody,
        headers: new Headers({
          'plaid-verification': validJWT,
        }),
      } as any;

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });
});
