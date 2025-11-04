/**
 * Integration Tests for Plaid Sync Operations
 * Tests: balance sync, transaction sync with pagination, cursor management, duplicate prevention
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockRpc = vi.fn();

// Separate mocks for sync_locks to avoid confusion with transaction inserts
const mockSyncLockInsert = vi.fn();
const mockSyncLockDelete = vi.fn();
const mockSyncLockSelect = vi.fn();

const supabaseAdminClient = {
  from: mockFrom,
  rpc: mockRpc,
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

// Mock Supabase admin client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => supabaseAdminClient),
}));

// Mock Plaid client
const mockGetAccountBalances = vi.fn();
const mockSyncTransactions = vi.fn();

vi.mock('@/lib/plaid/client', () => ({
  getAccountBalances: mockGetAccountBalances,
  syncTransactions: mockSyncTransactions,
}));

// Mock token manager
const mockGetUserAccessTokens = vi.fn();
const mockDecryptToken = vi.fn();

vi.mock('@/lib/plaid/token-manager', () => ({
  getUserAccessTokens: mockGetUserAccessTokens,
  decryptToken: mockDecryptToken,
}));

// Mock category mapper
vi.mock('@/lib/plaid/category-mapper', () => ({
  mapPlaidCategoryToApp: vi.fn((category) => {
    if (!category) return 'Other';
    if (category.includes('Food')) return 'Food & Dining';
    if (category.includes('Transfer')) return 'Transfer';
    return 'Other';
  }),
}));

describe('Plaid Sync Operations Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default user authentication
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });

    // Create a chainable eq mock that can be called multiple times
    // and eventually resolves to a promise
    const createEqChain = () => {
      const eqChain = {
        eq: vi.fn(() => eqChain), // Returns itself for chaining
        single: mockSingle,
        then: (resolve: any) => resolve({ data: {}, error: null }), // Make it awaitable
      };
      return eqChain;
    };

    mockEq.mockImplementation(() => createEqChain());

    mockUpdate.mockReturnValue(createEqChain());

    // Mock insert to support chaining with select and single
    const createInsertChain = () => ({
      select: vi.fn(() => ({
        single: mockSingle,
      })),
      then: (resolve: any) => resolve({ data: {}, error: null }),
    });

    mockInsert.mockImplementation(() => createInsertChain());
    mockSyncLockInsert.mockImplementation(() => createInsertChain());

    mockDelete.mockReturnValue(createEqChain());
    mockSyncLockDelete.mockReturnValue(createEqChain());
    mockSyncLockSelect.mockReturnValue(createEqChain());

    mockSingle.mockResolvedValue({ data: { id: 'lock-123' }, error: null });
    mockSelect.mockReturnValue(createEqChain());
    mockRpc.mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'sync_locks') {
        return {
          insert: mockSyncLockInsert,
          delete: mockSyncLockDelete,
          select: mockSyncLockSelect,
        };
      }
      return {
        update: mockUpdate,
        insert: mockInsert,
        delete: mockDelete,
        select: mockSelect,
      };
    });
  });

  describe('Balance Sync', () => {
    it('should sync account balances and update database correctly', async () => {
      // Setup: User has one Plaid item with two accounts
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-123',
          accessToken: 'access-token-decrypted', // getUserAccessTokens returns decrypted tokens
          institutionName: 'Chase',
        },
      ]);

      mockGetAccountBalances.mockResolvedValue([
        {
          accountId: 'acc-1',
          name: 'Checking',
          balances: {
            current: 1500.00,
            available: 1400.00,
            isoCurrencyCode: 'USD',
          },
        },
        {
          accountId: 'acc-2',
          name: 'Savings',
          balances: {
            current: 5500.00,
            available: 5500.00,
            isoCurrencyCode: 'USD',
          },
        },
      ]);

      const { syncAccountBalances } = await import('@/lib/plaid/sync-service');
      const result = await syncAccountBalances('user-123');

      expect(result.itemsProcessed).toBe(1);
      expect(result.itemsSuccessful).toBe(1);
      expect(result.totalAccountsUpdated).toBe(2);
      expect(mockGetAccountBalances).toHaveBeenCalledWith('access-token-decrypted');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should update last_sync timestamp after successful sync', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-123',
          accessToken: 'access-token',
          institutionName: 'Chase',
        },
      ]);

      mockDecryptToken.mockReturnValue('decrypted-token');

      mockGetAccountBalances.mockResolvedValue([
        {
          accountId: 'acc-1',
          balances: { current: 1000, available: 950, isoCurrencyCode: 'USD' },
        },
      ]);

      const beforeSync = Date.now();

      const { syncAccountBalances } = await import('@/lib/plaid/sync-service');
      await syncAccountBalances('user-123');

      // Verify last_sync was updated
      const updateCalls = mockUpdate.mock.calls;
      const lastSyncUpdate = updateCalls.find((call) => {
        const updateData = call[0];
        return updateData && 'last_sync' in updateData;
      });

      expect(lastSyncUpdate).toBeDefined();
      const lastSyncTime = new Date(lastSyncUpdate[0].last_sync).getTime();
      expect(lastSyncTime).toBeGreaterThanOrEqual(beforeSync);
    });

    it('should handle multiple Plaid items for a user', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-1',
          accessToken: 'token-1',
          institutionName: 'Chase',
        },
        {
          itemId: 'item-2',
          accessToken: 'token-2',
          institutionName: 'Bank of America',
        },
      ]);

      mockDecryptToken.mockReturnValue('decrypted');

      mockGetAccountBalances.mockResolvedValue([
        {
          accountId: 'acc-x',
          balances: { current: 1000, available: 900, isoCurrencyCode: 'USD' },
        },
      ]);

      const { syncAccountBalances } = await import('@/lib/plaid/sync-service');
      const result = await syncAccountBalances('user-123');

      expect(result.itemsProcessed).toBe(2);
      expect(mockGetAccountBalances).toHaveBeenCalledTimes(2);
    });

    it('should continue syncing other items if one fails', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-good',
          accessToken: 'token-good',
          institutionName: 'Chase',
        },
        {
          itemId: 'item-bad',
          accessToken: 'token-bad',
          institutionName: 'Wells Fargo',
        },
      ]);

      mockDecryptToken.mockReturnValue('decrypted');

      mockGetAccountBalances
        .mockResolvedValueOnce([
          {
            accountId: 'acc-1',
            balances: { current: 1000, available: 900, isoCurrencyCode: 'USD' },
          },
        ])
        .mockRejectedValueOnce(new Error('INSTITUTION_DOWN'));

      const { syncAccountBalances } = await import('@/lib/plaid/sync-service');
      const result = await syncAccountBalances('user-123');

      expect(result.itemsProcessed).toBe(2);
      expect(result.itemsSuccessful).toBe(1);
      expect(result.itemsFailed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].itemId).toBe('item-bad');
    });

    it('should return empty result when user has no Plaid items', async () => {
      mockGetUserAccessTokens.mockResolvedValue([]);

      const { syncAccountBalances } = await import('@/lib/plaid/sync-service');
      const result = await syncAccountBalances('user-123');

      expect(result.itemsProcessed).toBe(0);
      expect(result.itemsSuccessful).toBe(0);
      expect(result.totalAccountsUpdated).toBe(0);
      expect(mockGetAccountBalances).not.toHaveBeenCalled();
    });
  });

  describe('Transaction Sync', () => {
    it('should sync transactions with cursor pagination', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-123',
          accessToken: 'decrypted-token', // getUserAccessTokens returns decrypted tokens
          institutionName: 'Chase',
        },
      ]);

      // Mock plaid_items query for cursor
      const mockPlaidItemsQuery = vi.fn()
        .mockResolvedValueOnce({
          data: { transactions_cursor: 'cursor-1' },
          error: null,
        });

      // Mock financial_accounts query
      const mockAccountsQuery = vi.fn()
        .mockResolvedValue({
          data: [
            { id: 'internal-acc-1', plaid_account_id: 'plaid-acc-1' },
          ],
          error: null,
        });

      // First page of transactions
      mockSyncTransactions.mockResolvedValueOnce({
        added: [
          {
            transactionId: 'txn-1',
            accountId: 'plaid-acc-1',
            amount: -50.00,
            date: '2024-01-15',
            name: 'Grocery Store',
            merchantName: 'Whole Foods',
            category: ['Food', 'Groceries'],
            categoryId: '13005000',
            pending: false,
            isoCurrencyCode: 'USD',
          },
          {
            transactionId: 'txn-2',
            accountId: 'plaid-acc-1',
            amount: -25.00,
            date: '2024-01-16',
            name: 'Coffee Shop',
            merchantName: 'Starbucks',
            category: ['Food', 'Coffee'],
            categoryId: '13005001',
            pending: false,
            isoCurrencyCode: 'USD',
          },
        ],
        modified: [],
        removed: [],
        nextCursor: 'cursor-2',
        hasMore: true,
      });

      // Second page of transactions
      mockSyncTransactions.mockResolvedValueOnce({
        added: [
          {
            transactionId: 'txn-3',
            accountId: 'plaid-acc-1',
            amount: -100.00,
            date: '2024-01-17',
            name: 'Gas Station',
            merchantName: 'Shell',
            category: ['Transportation', 'Gas'],
            categoryId: '22006000',
            pending: false,
            isoCurrencyCode: 'USD',
          },
        ],
        modified: [],
        removed: [],
        nextCursor: 'cursor-3',
        hasMore: false,
      });

      // Override mockFrom to return different results based on table
      mockFrom.mockImplementation((table: string) => {
        if (table === 'plaid_items') {
          return {
            select: () => ({
              eq: () => ({
                single: mockPlaidItemsQuery,
              }),
            }),
            update: mockUpdate,
          };
        }
        if (table === 'financial_accounts') {
          return {
            select: () => ({
              eq: mockAccountsQuery,
            }),
          };
        }
        if (table === 'transactions') {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            insert: mockInsert,
            update: mockUpdate,
            delete: mockDelete,
          };
        }
        return {
          update: mockUpdate,
          insert: mockInsert,
          delete: mockDelete,
          select: mockSelect,
        };
      });

      const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
      const result = await syncUserTransactions('user-123');

      expect(result.itemsSuccessful).toBe(1);
      expect(result.totalTransactionsAdded).toBe(3);
      expect(mockSyncTransactions).toHaveBeenCalledTimes(2);
      expect(mockSyncTransactions).toHaveBeenNthCalledWith(1, 'decrypted-token', 'cursor-1');
      expect(mockSyncTransactions).toHaveBeenNthCalledWith(2, 'decrypted-token', 'cursor-2');
    });

    it('should handle added, modified, and removed transactions', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-123',
          accessToken: 'token',
          institutionName: 'Chase',
        },
      ]);

      mockDecryptToken.mockReturnValue('decrypted');

      mockSyncTransactions.mockResolvedValue({
        added: [
          {
            transactionId: 'new-txn',
            accountId: 'plaid-acc-1',
            amount: -30.00,
            date: '2024-01-20',
            name: 'New Purchase',
            merchantName: 'Store',
            category: ['Shopping'],
            categoryId: '19000000',
            pending: false,
            isoCurrencyCode: 'USD',
          },
        ],
        modified: [
          {
            transactionId: 'existing-txn',
            accountId: 'plaid-acc-1',
            amount: -45.00, // Updated amount
            date: '2024-01-18',
            name: 'Updated Purchase',
            merchantName: 'Updated Store',
            category: ['Shopping'],
            categoryId: '19000000',
            pending: false,
            isoCurrencyCode: 'USD',
          },
        ],
        removed: [
          { transactionId: 'removed-txn' },
        ],
        nextCursor: 'cursor-new',
        hasMore: false,
      });

      // Mock for existing transaction check
      const mockTransactionSelect = vi.fn()
        .mockResolvedValueOnce({ data: null, error: null }) // new-txn doesn't exist
        .mockResolvedValueOnce({ data: { id: 'internal-txn-id' }, error: null }); // existing-txn exists

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sync_locks') {
          return {
            insert: mockSyncLockInsert,
            delete: mockSyncLockDelete,
            select: mockSyncLockSelect,
          };
        }
        if (table === 'plaid_items') {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { transactions_cursor: null },
                  error: null,
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        if (table === 'financial_accounts') {
          return {
            select: () => ({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'internal-acc-1', plaid_account_id: 'plaid-acc-1' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'transactions') {
          return {
            select: () => ({
              eq: () => ({
                single: mockTransactionSelect,
              }),
            }),
            insert: mockInsert,
            update: mockUpdate,
            delete: mockDelete,
          };
        }
        return { update: mockUpdate };
      });

      const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
      const result = await syncUserTransactions('user-123');

      expect(result.totalTransactionsAdded).toBe(1);
      expect(result.totalTransactionsModified).toBe(1);
      expect(result.totalTransactionsRemoved).toBe(1);
      expect(mockInsert).toHaveBeenCalledTimes(1); // Added transaction
      expect(mockUpdate).toHaveBeenCalled(); // Modified transaction and cursor update
      expect(mockDelete).toHaveBeenCalledTimes(1); // Removed transaction
    });

    it('should prevent duplicate transactions', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-123',
          accessToken: 'token',
          institutionName: 'Chase',
        },
      ]);

      mockDecryptToken.mockReturnValue('decrypted');

      mockSyncTransactions.mockResolvedValue({
        added: [
          {
            transactionId: 'duplicate-txn',
            accountId: 'plaid-acc-1',
            amount: -50.00,
            date: '2024-01-15',
            name: 'Store',
            merchantName: 'Store',
            category: ['Shopping'],
            categoryId: '19000000',
            pending: false,
            isoCurrencyCode: 'USD',
          },
        ],
        modified: [],
        removed: [],
        nextCursor: 'cursor',
        hasMore: false,
      });

      // Mock: Transaction already exists in database
      const mockExistingTransaction = vi.fn().mockResolvedValue({
        data: { id: 'existing-internal-id' },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sync_locks') {
          return {
            insert: mockSyncLockInsert,
            delete: mockSyncLockDelete,
            select: mockSyncLockSelect,
          };
        }
        if (table === 'plaid_items') {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { transactions_cursor: null },
                  error: null,
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        if (table === 'financial_accounts') {
          return {
            select: () => ({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'internal-acc-1', plaid_account_id: 'plaid-acc-1' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'transactions') {
          return {
            select: () => ({
              eq: () => ({
                single: mockExistingTransaction,
              }),
            }),
            insert: mockInsert,
            update: mockUpdate,
          };
        }
        return { update: mockUpdate };
      });

      const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
      await syncUserTransactions('user-123');

      // Should update existing transaction, not insert new one
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should update cursor after successful sync', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-123',
          accessToken: 'token',
          institutionName: 'Chase',
        },
      ]);

      mockDecryptToken.mockReturnValue('decrypted');

      const newCursor = 'cursor-after-sync-12345';

      mockSyncTransactions.mockResolvedValue({
        added: [],
        modified: [],
        removed: [],
        nextCursor: newCursor,
        hasMore: false,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sync_locks') {
          return {
            insert: mockSyncLockInsert,
            delete: mockSyncLockDelete,
            select: mockSyncLockSelect,
          };
        }
        if (table === 'plaid_items') {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { transactions_cursor: 'old-cursor' },
                  error: null,
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        if (table === 'financial_accounts') {
          return {
            select: () => ({
              eq: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        return { update: mockUpdate };
      });

      const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
      await syncUserTransactions('user-123');

      // Verify cursor was updated
      const updateCalls = mockUpdate.mock.calls;
      const cursorUpdate = updateCalls.find((call) => {
        const updateData = call[0];
        return updateData && 'transactions_cursor' in updateData;
      });

      expect(cursorUpdate).toBeDefined();
      expect(cursorUpdate[0].transactions_cursor).toBe(newCursor);
    });

    it('should handle no transactions to sync', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-123',
          accessToken: 'token',
          institutionName: 'Chase',
        },
      ]);

      mockDecryptToken.mockReturnValue('decrypted');

      mockSyncTransactions.mockResolvedValue({
        added: [],
        modified: [],
        removed: [],
        nextCursor: 'same-cursor',
        hasMore: false,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'plaid_items') {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { transactions_cursor: 'same-cursor' },
                  error: null,
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return { update: mockUpdate };
      });

      const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
      const result = await syncUserTransactions('user-123');

      expect(result.totalTransactionsAdded).toBe(0);
      expect(result.totalTransactionsModified).toBe(0);
      expect(result.totalTransactionsRemoved).toBe(0);
    });
  });

  describe('Sync API Route', () => {
    it('should sync both balances and transactions via API', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-123',
          accessToken: 'token',
          institutionName: 'Chase',
        },
      ]);

      mockDecryptToken.mockReturnValue('decrypted');

      mockGetAccountBalances.mockResolvedValue([
        {
          accountId: 'acc-1',
          balances: { current: 1000, available: 900, isoCurrencyCode: 'USD' },
        },
      ]);

      mockSyncTransactions.mockResolvedValue({
        added: [],
        modified: [],
        removed: [],
        nextCursor: 'cursor',
        hasMore: false,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'plaid_items') {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { transactions_cursor: null },
                  error: null,
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        if (table === 'financial_accounts') {
          return {
            select: () => ({
              eq: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        return {
          update: mockUpdate,
          insert: mockInsert,
        };
      });

      const { POST } = await import('@/app/api/plaid/sync/route');
      const response = await POST({} as any);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.balances).toBeDefined();
      expect(data.transactions).toBeDefined();
      expect(data.balances.itemsProcessed).toBe(1);
      expect(data.transactions.itemsProcessed).toBe(1);
    });

    it('should return unauthorized for unauthenticated requests', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { POST } = await import('@/app/api/plaid/sync/route');
      const response = await POST({} as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should handle partial sync failure gracefully', async () => {
      mockGetUserAccessTokens
        .mockResolvedValueOnce([]) // First call for balance sync - no tokens
        .mockResolvedValueOnce([   // Second call for transaction sync - has tokens
          {
            itemId: 'item-123',
            accessToken: 'token',
            institutionName: 'Chase',
          },
        ]);

      mockDecryptToken.mockReturnValue('decrypted');

      mockSyncTransactions.mockResolvedValue({
        added: [],
        modified: [],
        removed: [],
        nextCursor: 'cursor',
        hasMore: false,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sync_locks') {
          return {
            insert: mockSyncLockInsert,
            delete: mockSyncLockDelete,
            select: mockSyncLockSelect,
          };
        }
        if (table === 'plaid_items') {
          return {
            select: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { transactions_cursor: null },
                  error: null,
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return { update: mockUpdate };
      });

      const { POST } = await import('@/app/api/plaid/sync/route');
      const response = await POST({} as any);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.balances.itemsProcessed).toBe(0);
      expect(data.transactions.itemsProcessed).toBe(1);
    });
  });
});
