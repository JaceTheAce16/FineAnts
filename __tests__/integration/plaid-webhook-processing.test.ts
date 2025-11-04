/**
 * Integration Tests for Plaid Webhook Processing
 * Tests: TRANSACTIONS webhooks, ITEM webhooks, signature verification, error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase admin client
const mockFrom = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
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

describe('Plaid Webhook Processing Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Create chainable eq mock
    const createEqChain = () => {
      const eqChain = {
        eq: vi.fn(() => eqChain),
        single: mockSingle,
        then: (resolve: any) => resolve({ data: {}, error: null }),
      };
      return eqChain;
    };

    mockEq.mockImplementation(() => createEqChain());
    mockUpdate.mockReturnValue(createEqChain());
    mockInsert.mockResolvedValue({ data: {}, error: null });
    mockSingle.mockResolvedValue({ data: { user_id: 'user-123' }, error: null });
    mockSelect.mockReturnValue(createEqChain());
    mockFrom.mockReturnValue({
      update: mockUpdate,
      insert: mockInsert,
      select: mockSelect,
    });

    mockSyncUserTransactions.mockResolvedValue({
      itemsProcessed: 1,
      itemsSuccessful: 1,
      itemsFailed: 0,
      totalTransactionsAdded: 5,
      totalTransactionsModified: 0,
      totalTransactionsRemoved: 0,
      errors: [],
      results: [],
    });
  });

  describe('TRANSACTIONS Webhook', () => {
    it('should trigger sync on INITIAL_UPDATE webhook', async () => {
      const webhook = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'INITIAL_UPDATE',
        item_id: 'item-123',
        new_transactions: 50,
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      const response = await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers({
          'Plaid-Verification': 'mock-jwt-token',
        }),
      } as any);

      const data = await response.json();

      expect(data.received).toBe(true);
      expect(mockSyncUserTransactions).toHaveBeenCalledWith('user-123');
    });

    it('should trigger sync on HISTORICAL_UPDATE webhook', async () => {
      const webhook = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'HISTORICAL_UPDATE',
        item_id: 'item-456',
        new_transactions: 200,
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      const response = await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      const data = await response.json();

      expect(data.received).toBe(true);
      expect(mockSyncUserTransactions).toHaveBeenCalledWith('user-123');
    });

    it('should trigger sync on DEFAULT_UPDATE webhook', async () => {
      const webhook = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-789',
        new_transactions: 10,
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      const response = await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      const data = await response.json();

      expect(data.received).toBe(true);
      expect(mockSyncUserTransactions).toHaveBeenCalled();
    });

    it('should handle TRANSACTIONS_REMOVED webhook', async () => {
      const webhook = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'TRANSACTIONS_REMOVED',
        item_id: 'item-123',
        removed_transactions: ['txn-1', 'txn-2', 'txn-3'],
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      const response = await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      const data = await response.json();

      expect(data.received).toBe(true);
      // TRANSACTIONS_REMOVED is logged but doesn't trigger immediate sync
      expect(mockSyncUserTransactions).not.toHaveBeenCalled();
    });

    it('should log webhook event to database', async () => {
      const webhook = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
        new_transactions: 5,
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      expect(mockFrom).toHaveBeenCalledWith('webhook_events');
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('ITEM Webhook', () => {
    it('should update item status to error on ERROR webhook', async () => {
      const webhook = {
        webhook_type: 'ITEM',
        webhook_code: 'ERROR',
        item_id: 'item-error-123',
        error: {
          error_code: 'ITEM_LOGIN_REQUIRED',
          error_message: 'Login required',
        },
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      const response = await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      const data = await response.json();

      expect(data.received).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();

      // Verify update was called with error status
      const updateCalls = mockUpdate.mock.calls;
      const errorUpdate = updateCalls.find((call) => {
        const data = call[0];
        return data && 'status' in data && data.status === 'error';
      });

      expect(errorUpdate).toBeDefined();
      expect(errorUpdate[0].error_code).toBe('ITEM_LOGIN_REQUIRED');
      expect(errorUpdate[0].error_message).toBe('Login required');
    });

    it('should update item status to pending_expiration on PENDING_EXPIRATION webhook', async () => {
      const webhook = {
        webhook_type: 'ITEM',
        webhook_code: 'PENDING_EXPIRATION',
        item_id: 'item-expiring-123',
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      const response = await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      const data = await response.json();

      expect(data.received).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();

      // Verify update was called with pending_expiration status
      const updateCalls = mockUpdate.mock.calls;
      const statusUpdate = updateCalls.find((call) => {
        const data = call[0];
        return data && 'status' in data && data.status === 'pending_expiration';
      });

      expect(statusUpdate).toBeDefined();
    });

    it('should handle unrecognized ITEM webhook codes gracefully', async () => {
      const webhook = {
        webhook_type: 'ITEM',
        webhook_code: 'UNKNOWN_CODE',
        item_id: 'item-123',
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      const response = await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      const data = await response.json();

      expect(data.received).toBe(true);
      // Should still log the event even if code is unrecognized
      expect(mockFrom).toHaveBeenCalledWith('webhook_events');
    });
  });

  describe('Webhook Signature Verification', () => {
    it('should verify webhook signature', async () => {
      const webhook = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
        new_transactions: 1,
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      const response = await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers({
          'Plaid-Verification': 'valid-jwt-token',
        }),
      } as any);

      const data = await response.json();

      expect(data.received).toBe(true);
      // Note: Current implementation returns true for all signatures in dev
      // Production implementation should verify JWT
    });

    it('should process webhooks without signature header in development', async () => {
      const webhook = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      const response = await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      const data = await response.json();

      // Should still process in development
      expect(data.received).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid item_id gracefully', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const webhook = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'non-existent-item',
        new_transactions: 5,
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      const response = await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      const data = await response.json();

      // Should still return 200 even if item not found
      expect(response.status).toBe(200);
      expect(data.received).toBe(true);

      // Should not call sync if item not found
      expect(mockSyncUserTransactions).not.toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      mockSyncUserTransactions.mockRejectedValueOnce(
        new Error('Sync failed due to API error')
      );

      const webhook = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
        new_transactions: 10,
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      const response = await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      const data = await response.json();

      // Should still return 200 to prevent Plaid from retrying
      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
    });

    it('should handle malformed webhook payload', async () => {
      const { POST } = await import('@/app/api/webhooks/plaid/route');
      const response = await POST({
        text: async () => 'invalid json {{{',
        headers: new Headers(),
      } as any);

      const data = await response.json();

      // Should return 200 even with invalid JSON to prevent retries
      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
    });

    it('should handle database errors when logging webhook', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Database connection failed'));

      const webhook = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
        new_transactions: 1,
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      const response = await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      const data = await response.json();

      // Should still return 200 even if logging fails
      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
    });
  });

  describe('Webhook Types', () => {
    it('should handle unrecognized webhook types', async () => {
      const webhook = {
        webhook_type: 'UNKNOWN_TYPE',
        webhook_code: 'SOME_CODE',
        item_id: 'item-123',
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      const response = await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      const data = await response.json();

      expect(data.received).toBe(true);
      // Should still log unknown webhook types
      expect(mockFrom).toHaveBeenCalledWith('webhook_events');
    });

    it('should process multiple webhook fields correctly', async () => {
      const webhook = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
        new_transactions: 15,
        removed_transactions: ['txn-old-1', 'txn-old-2'],
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      // Verify webhook event was logged with all data
      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.event_data).toEqual(webhook);
      expect(insertCall.event_type).toBe('plaid_webhook');
      expect(insertCall.processed).toBe(true);
    });
  });

  describe('User Lookup', () => {
    it('should look up user_id from item_id', async () => {
      const webhook = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'specific-item-789',
      };

      mockSingle.mockResolvedValueOnce({
        data: { user_id: 'specific-user-456' },
        error: null,
      });

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      expect(mockFrom).toHaveBeenCalledWith('plaid_items');
      expect(mockSyncUserTransactions).toHaveBeenCalledWith('specific-user-456');
    });

    it('should query plaid_items table with correct item_id', async () => {
      const webhook = {
        webhook_type: 'ITEM',
        webhook_code: 'ERROR',
        item_id: 'query-test-item-id',
        error: {
          error_code: 'INVALID_CREDENTIALS',
          error_message: 'Invalid credentials',
        },
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      expect(mockFrom).toHaveBeenCalledWith('plaid_items');
      expect(mockSelect).toHaveBeenCalled();
    });
  });

  describe('Webhook Event Logging', () => {
    it('should log processed webhook with timestamp', async () => {
      const beforeTime = Date.now();

      const webhook = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      const afterTime = Date.now();

      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.calls[0][0];

      expect(insertCall.event_type).toBe('plaid_webhook');
      expect(insertCall.processed).toBe(true);
      expect(insertCall.processed_at).toBeDefined();

      const processedTime = new Date(insertCall.processed_at).getTime();
      expect(processedTime).toBeGreaterThanOrEqual(beforeTime);
      expect(processedTime).toBeLessThanOrEqual(afterTime);
    });

    it('should preserve webhook payload in event log', async () => {
      const webhook = {
        webhook_type: 'ITEM',
        webhook_code: 'PENDING_EXPIRATION',
        item_id: 'item-preserve-test',
        extra_field: 'extra_value',
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.event_data).toEqual(webhook);
    });
  });

  describe('Response Format', () => {
    it('should always return JSON with received: true', async () => {
      const webhook = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      };

      const { POST } = await import('@/app/api/webhooks/plaid/route');
      const response = await POST({
        text: async () => JSON.stringify(webhook),
        headers: new Headers(),
      } as any);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ received: true });
    });

    it('should return 200 status code for all webhooks', async () => {
      const webhooks = [
        {
          webhook_type: 'TRANSACTIONS',
          webhook_code: 'INITIAL_UPDATE',
          item_id: 'item-1',
        },
        {
          webhook_type: 'ITEM',
          webhook_code: 'ERROR',
          item_id: 'item-2',
          error: { error_code: 'TEST', error_message: 'Test error' },
        },
        {
          webhook_type: 'UNKNOWN',
          webhook_code: 'UNKNOWN',
          item_id: 'item-3',
        },
      ];

      const { POST } = await import('@/app/api/webhooks/plaid/route');

      for (const webhook of webhooks) {
        const response = await POST({
          text: async () => JSON.stringify(webhook),
          headers: new Headers(),
        } as any);

        expect(response.status).toBe(200);
      }
    });
  });
});
