/**
 * Tests for Plaid Sync Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock functions
const mockSupabaseUpdate = vi.fn();
const mockSupabaseEq = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseSingle = vi.fn();

const mockSupabaseAdmin = {
  from: vi.fn((table: string) => ({
    update: mockSupabaseUpdate,
    select: mockSupabaseSelect,
  })),
};

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseAdmin),
}));

// Mock Plaid client
const mockGetAccountBalances = vi.fn();
vi.mock('@/lib/plaid/client', () => ({
  getAccountBalances: mockGetAccountBalances,
}));

// Mock token manager
const mockGetUserAccessTokens = vi.fn();
const mockDecryptToken = vi.fn();
vi.mock('@/lib/plaid/token-manager', () => ({
  getUserAccessTokens: mockGetUserAccessTokens,
  decryptToken: mockDecryptToken,
}));

// Mock sync lock
const mockAcquireSyncLock = vi.fn();
const mockReleaseSyncLock = vi.fn();
vi.mock('@/lib/plaid/sync-lock', () => ({
  acquireSyncLock: mockAcquireSyncLock,
  releaseSyncLock: mockReleaseSyncLock,
}));

describe('Sync Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockSupabaseUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    mockSupabaseSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSupabaseSingle,
        }),
      }),
    });

    // Default: lock acquisition succeeds
    mockAcquireSyncLock.mockResolvedValue({
      acquired: true,
      lockId: 'test-lock-id',
      message: 'Lock acquired successfully',
    });

    mockReleaseSyncLock.mockResolvedValue(true);
  });

  describe('syncAccountBalances', () => {
    it('should sync balances for all user accounts successfully', async () => {
      // Mock user has 2 Plaid items
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-1',
          accessToken: 'access-token-1',
          institutionId: 'ins_1',
          institutionName: 'Chase',
        },
        {
          itemId: 'item-2',
          accessToken: 'access-token-2',
          institutionId: 'ins_2',
          institutionName: 'Bank of America',
        },
      ]);

      // Mock Plaid API responses
      mockGetAccountBalances
        .mockResolvedValueOnce([
          {
            accountId: 'acc-1',
            name: 'Checking',
            type: 'depository',
            subtype: 'checking',
            balances: {
              current: 1000.0,
              available: 950.0,
              isoCurrencyCode: 'USD',
            },
          },
          {
            accountId: 'acc-2',
            name: 'Savings',
            type: 'depository',
            subtype: 'savings',
            balances: {
              current: 5000.0,
              available: 5000.0,
              isoCurrencyCode: 'USD',
            },
          },
        ])
        .mockResolvedValueOnce([
          {
            accountId: 'acc-3',
            name: 'Credit Card',
            type: 'credit',
            subtype: 'credit card',
            balances: {
              current: -250.0,
              available: 4750.0,
              isoCurrencyCode: 'USD',
            },
          },
        ]);

      const { syncAccountBalances } = await import('@/lib/plaid/sync-service');
      const result = await syncAccountBalances('user-123');

      expect(result.itemsProcessed).toBe(2);
      expect(result.itemsSuccessful).toBe(2);
      expect(result.itemsFailed).toBe(0);
      expect(result.totalAccountsUpdated).toBe(3);
      expect(result.errors).toHaveLength(0);

      // Verify Plaid API was called for each item
      expect(mockGetAccountBalances).toHaveBeenCalledTimes(2);
      expect(mockGetAccountBalances).toHaveBeenCalledWith('access-token-1');
      expect(mockGetAccountBalances).toHaveBeenCalledWith('access-token-2');

      // Verify database updates were called
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('financial_accounts');
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('plaid_items');
    });

    it('should return empty result when user has no connected accounts', async () => {
      mockGetUserAccessTokens.mockResolvedValue([]);

      const { syncAccountBalances } = await import('@/lib/plaid/sync-service');
      const result = await syncAccountBalances('user-no-accounts');

      expect(result.itemsProcessed).toBe(0);
      expect(result.itemsSuccessful).toBe(0);
      expect(result.itemsFailed).toBe(0);
      expect(result.totalAccountsUpdated).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Should not call Plaid API
      expect(mockGetAccountBalances).not.toHaveBeenCalled();
    });

    it('should continue syncing other items when one fails', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-good',
          accessToken: 'access-token-good',
          institutionId: 'ins_1',
          institutionName: 'Chase',
        },
        {
          itemId: 'item-bad',
          accessToken: 'access-token-bad',
          institutionId: 'ins_2',
          institutionName: 'Wells Fargo',
        },
      ]);

      // First item succeeds
      mockGetAccountBalances
        .mockResolvedValueOnce([
          {
            accountId: 'acc-good',
            name: 'Checking',
            type: 'depository',
            subtype: 'checking',
            balances: {
              current: 1000.0,
              available: 950.0,
              isoCurrencyCode: 'USD',
            },
          },
        ])
        // Second item fails
        .mockRejectedValueOnce(new Error('ITEM_LOGIN_REQUIRED'));

      const { syncAccountBalances } = await import('@/lib/plaid/sync-service');
      const result = await syncAccountBalances('user-123');

      expect(result.itemsProcessed).toBe(2);
      expect(result.itemsSuccessful).toBe(1);
      expect(result.itemsFailed).toBe(1);
      expect(result.totalAccountsUpdated).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        itemId: 'item-bad',
        error: 'ITEM_LOGIN_REQUIRED',
      });

      // Verify both items were attempted
      expect(mockGetAccountBalances).toHaveBeenCalledTimes(2);
    });

    it('should update last_sync timestamp for successful syncs', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-1',
          accessToken: 'access-token-1',
          institutionId: 'ins_1',
          institutionName: 'Chase',
        },
      ]);

      mockGetAccountBalances.mockResolvedValue([
        {
          accountId: 'acc-1',
          name: 'Checking',
          type: 'depository',
          subtype: 'checking',
          balances: {
            current: 1000.0,
            available: 950.0,
            isoCurrencyCode: 'USD',
          },
        },
      ]);

      const { syncAccountBalances } = await import('@/lib/plaid/sync-service');
      await syncAccountBalances('user-123');

      // Verify plaid_items table was updated with last_sync
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('plaid_items');
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          last_sync: expect.any(String),
          updated_at: expect.any(String),
        })
      );
    });

    it('should mark item as error when sync fails', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-error',
          accessToken: 'access-token-error',
          institutionId: 'ins_1',
          institutionName: 'Chase',
        },
      ]);

      mockGetAccountBalances.mockRejectedValue(
        new Error('INSTITUTION_DOWN')
      );

      const { syncAccountBalances } = await import('@/lib/plaid/sync-service');
      const result = await syncAccountBalances('user-123');

      expect(result.itemsFailed).toBe(1);

      // Verify item was marked as error
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error_message: 'INSTITUTION_DOWN',
        })
      );
    });

    it('should handle accounts with null available balance', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-1',
          accessToken: 'access-token-1',
          institutionId: 'ins_1',
          institutionName: 'Chase',
        },
      ]);

      mockGetAccountBalances.mockResolvedValue([
        {
          accountId: 'acc-1',
          name: 'Loan Account',
          type: 'loan',
          subtype: 'student',
          balances: {
            current: -25000.0,
            available: null,
            isoCurrencyCode: 'USD',
          },
        },
      ]);

      const { syncAccountBalances } = await import('@/lib/plaid/sync-service');
      const result = await syncAccountBalances('user-123');

      expect(result.totalAccountsUpdated).toBe(1);
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          current_balance: -25000.0,
          available_balance: null,
        })
      );
    });

    it('should provide detailed results for each item', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-1',
          accessToken: 'access-token-1',
          institutionId: 'ins_1',
          institutionName: 'Chase',
        },
        {
          itemId: 'item-2',
          accessToken: 'access-token-2',
          institutionId: 'ins_2',
          institutionName: 'Bank of America',
        },
      ]);

      mockGetAccountBalances
        .mockResolvedValueOnce([
          {
            accountId: 'acc-1',
            name: 'Checking',
            type: 'depository',
            subtype: 'checking',
            balances: {
              current: 1000.0,
              available: 950.0,
              isoCurrencyCode: 'USD',
            },
          },
        ])
        .mockResolvedValueOnce([
          {
            accountId: 'acc-2',
            name: 'Savings',
            type: 'depository',
            subtype: 'savings',
            balances: {
              current: 5000.0,
              available: 5000.0,
              isoCurrencyCode: 'USD',
            },
          },
        ]);

      const { syncAccountBalances } = await import('@/lib/plaid/sync-service');
      const result = await syncAccountBalances('user-123');

      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toEqual({
        itemId: 'item-1',
        institutionName: 'Chase',
        success: true,
        accountsUpdated: 1,
      });
      expect(result.results[1]).toEqual({
        itemId: 'item-2',
        institutionName: 'Bank of America',
        success: true,
        accountsUpdated: 1,
      });
    });
  });

  describe('syncItemBalances', () => {
    it('should sync balances for a specific item', async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: {
          access_token: 'encrypted-token',
          institution_name: 'Chase',
        },
        error: null,
      });

      mockDecryptToken.mockReturnValue('decrypted-access-token');

      mockGetAccountBalances.mockResolvedValue([
        {
          accountId: 'acc-1',
          name: 'Checking',
          type: 'depository',
          subtype: 'checking',
          balances: {
            current: 1000.0,
            available: 950.0,
            isoCurrencyCode: 'USD',
          },
        },
      ]);

      const { syncItemBalances } = await import('@/lib/plaid/sync-service');
      const result = await syncItemBalances('item-123');

      expect(result.success).toBe(true);
      expect(result.itemId).toBe('item-123');
      expect(result.institutionName).toBe('Chase');
      expect(result.accountsUpdated).toBe(1);

      // Verify decryption was called
      expect(mockDecryptToken).toHaveBeenCalledWith('encrypted-token');

      // Verify Plaid API was called
      expect(mockGetAccountBalances).toHaveBeenCalledWith(
        'decrypted-access-token'
      );
    });

    it('should return error when item not found', async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: null,
        error: { message: 'Item not found' },
      });

      const { syncItemBalances } = await import('@/lib/plaid/sync-service');
      const result = await syncItemBalances('item-nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Item not found or not active');

      // Should not call Plaid API
      expect(mockGetAccountBalances).not.toHaveBeenCalled();
    });

    it('should mark item as error when sync fails', async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: {
          access_token: 'encrypted-token',
          institution_name: 'Chase',
        },
        error: null,
      });

      mockDecryptToken.mockReturnValue('decrypted-access-token');
      mockGetAccountBalances.mockRejectedValue(
        new Error('ITEM_LOGIN_REQUIRED')
      );

      const { syncItemBalances } = await import('@/lib/plaid/sync-service');
      const result = await syncItemBalances('item-error');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ITEM_LOGIN_REQUIRED');

      // Verify item was marked as error
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error_message: 'ITEM_LOGIN_REQUIRED',
        })
      );
    });

    it('should update multiple accounts for single item', async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: {
          access_token: 'encrypted-token',
          institution_name: 'Chase',
        },
        error: null,
      });

      mockDecryptToken.mockReturnValue('decrypted-access-token');

      mockGetAccountBalances.mockResolvedValue([
        {
          accountId: 'acc-1',
          name: 'Checking',
          type: 'depository',
          subtype: 'checking',
          balances: {
            current: 1000.0,
            available: 950.0,
            isoCurrencyCode: 'USD',
          },
        },
        {
          accountId: 'acc-2',
          name: 'Savings',
          type: 'depository',
          subtype: 'savings',
          balances: {
            current: 5000.0,
            available: 5000.0,
            isoCurrencyCode: 'USD',
          },
        },
        {
          accountId: 'acc-3',
          name: 'Credit Card',
          type: 'credit',
          subtype: 'credit card',
          balances: {
            current: -250.0,
            available: 4750.0,
            isoCurrencyCode: 'USD',
          },
        },
      ]);

      const { syncItemBalances } = await import('@/lib/plaid/sync-service');
      const result = await syncItemBalances('item-123');

      expect(result.success).toBe(true);
      expect(result.accountsUpdated).toBe(3);
    });
  });

  describe('Concurrent Sync Prevention', () => {
    describe('syncAccountBalances with lock', () => {
      it('should acquire and release lock when syncing balances', async () => {
        mockGetUserAccessTokens.mockResolvedValue([
          {
            itemId: 'item-1',
            accessToken: 'access-token-1',
            institutionId: 'ins_1',
            institutionName: 'Chase',
          },
        ]);

        mockGetAccountBalances.mockResolvedValue([
          {
            accountId: 'acc-1',
            balances: {
              current: 1000.0,
              available: 950.0,
            },
          },
        ]);

        const { syncAccountBalances } = await import('@/lib/plaid/sync-service');
        await syncAccountBalances('user-123');

        // Verify lock was acquired
        expect(mockAcquireSyncLock).toHaveBeenCalledWith('user-123', 'balance_sync');

        // Verify lock was released
        expect(mockReleaseSyncLock).toHaveBeenCalledWith('test-lock-id');
      });

      it('should return early when lock cannot be acquired', async () => {
        // Mock lock acquisition failure
        mockAcquireSyncLock.mockResolvedValue({
          acquired: false,
          message: 'A balance_sync operation is already in progress for this user',
        });

        const { syncAccountBalances } = await import('@/lib/plaid/sync-service');
        const result = await syncAccountBalances('user-123');

        // Should return early without syncing
        expect(result.itemsProcessed).toBe(0);
        expect(result.itemsSuccessful).toBe(0);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].error).toContain('already in progress');

        // Should not call getUserAccessTokens
        expect(mockGetUserAccessTokens).not.toHaveBeenCalled();

        // Should not release lock (since it was never acquired)
        expect(mockReleaseSyncLock).not.toHaveBeenCalled();
      });

      it('should release lock even if sync fails', async () => {
        mockGetUserAccessTokens.mockResolvedValue([
          {
            itemId: 'item-1',
            accessToken: 'access-token-1',
            institutionId: 'ins_1',
            institutionName: 'Chase',
          },
        ]);

        // Mock getAccountBalances to throw error
        mockGetAccountBalances.mockRejectedValue(new Error('Plaid API error'));

        const { syncAccountBalances } = await import('@/lib/plaid/sync-service');
        await syncAccountBalances('user-123');

        // Lock should still be released
        expect(mockReleaseSyncLock).toHaveBeenCalledWith('test-lock-id');
      });
    });

    describe('syncUserTransactions with lock', () => {
      // Import sync-related mocks
      const mockSyncTransactions = vi.fn();

      beforeEach(() => {
        vi.doMock('@/lib/plaid/client', () => ({
          syncTransactions: mockSyncTransactions,
        }));
      });

      it('should acquire and release lock when syncing transactions', async () => {
        mockGetUserAccessTokens.mockResolvedValue([
          {
            itemId: 'item-1',
            accessToken: 'access-token-1',
            institutionId: 'ins_1',
            institutionName: 'Chase',
          },
        ]);

        mockSupabaseSelect.mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { transactions_cursor: 'cursor-123' },
              error: null,
            }),
          }),
        });

        mockSyncTransactions.mockResolvedValue({
          added: [],
          modified: [],
          removed: [],
          nextCursor: 'cursor-124',
          hasMore: false,
        });

        const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
        await syncUserTransactions('user-123');

        // Verify lock was acquired
        expect(mockAcquireSyncLock).toHaveBeenCalledWith('user-123', 'transaction_sync');

        // Verify lock was released
        expect(mockReleaseSyncLock).toHaveBeenCalledWith('test-lock-id');
      });

      it('should return early when transaction sync lock cannot be acquired', async () => {
        // Mock lock acquisition failure
        mockAcquireSyncLock.mockResolvedValue({
          acquired: false,
          message: 'A transaction_sync operation is already in progress for this user',
        });

        const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
        const result = await syncUserTransactions('user-123');

        // Should return early without syncing
        expect(result.itemsProcessed).toBe(0);
        expect(result.itemsSuccessful).toBe(0);
        expect(result.totalTransactionsAdded).toBe(0);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].error).toContain('already in progress');

        // Should not call getUserAccessTokens
        expect(mockGetUserAccessTokens).not.toHaveBeenCalled();

        // Should not release lock (since it was never acquired)
        expect(mockReleaseSyncLock).not.toHaveBeenCalled();
      });

      it('should release lock even if transaction sync fails', async () => {
        mockGetUserAccessTokens.mockResolvedValue([
          {
            itemId: 'item-1',
            accessToken: 'access-token-1',
            institutionId: 'ins_1',
            institutionName: 'Chase',
          },
        ]);

        // Mock select for cursor
        mockSupabaseSelect.mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { transactions_cursor: 'cursor-123' },
              error: null,
            }),
          }),
        });

        // Mock syncTransactions to throw error
        mockSyncTransactions.mockRejectedValue(new Error('Sync failed'));

        const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
        await syncUserTransactions('user-123');

        // Lock should still be released
        expect(mockReleaseSyncLock).toHaveBeenCalledWith('test-lock-id');
      });
    });
  });
});
