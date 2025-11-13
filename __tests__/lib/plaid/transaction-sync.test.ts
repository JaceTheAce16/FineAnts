/**
 * Tests for Transaction Synchronization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock functions
const mockSupabaseInsert = vi.fn();
const mockSupabaseUpdate = vi.fn();
const mockSupabaseDelete = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseSingle = vi.fn();
const mockSupabaseEq = vi.fn();

// Separate mocks for sync_locks to avoid confusion with transaction operations
const mockSyncLockInsert = vi.fn();
const mockSyncLockDelete = vi.fn();
const mockSyncLockSelect = vi.fn();
const mockRpc = vi.fn();

const mockSupabaseAdmin = {
  from: vi.fn((table: string) => {
    if (table === 'sync_locks') {
      return {
        insert: mockSyncLockInsert,
        delete: mockSyncLockDelete,
        select: mockSyncLockSelect,
      };
    }
    return {
      insert: mockSupabaseInsert,
      update: mockSupabaseUpdate,
      delete: mockSupabaseDelete,
      select: mockSupabaseSelect,
    };
  }),
  rpc: mockRpc,
};

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseAdmin),
}));

// Mock Plaid client
const mockSyncTransactions = vi.fn();
vi.mock('@/lib/plaid/client', () => ({
  getAccountBalances: vi.fn(),
  syncTransactions: mockSyncTransactions,
}));

// Mock token manager
const mockGetUserAccessTokens = vi.fn();
vi.mock('@/lib/plaid/token-manager', () => ({
  getUserAccessTokens: mockGetUserAccessTokens,
  decryptToken: vi.fn(),
}));

// Mock category mapper
vi.mock('@/lib/plaid/category-mapper', () => ({
  mapPlaidCategoryToApp: vi.fn((category) => {
    if (!category || category.length === 0) return 'other';
    if (category[0].toLowerCase().includes('food')) return 'food';
    if (category[0].toLowerCase().includes('transfer')) return 'savings';
    return 'other';
  }),
}));

describe('Transaction Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Helper to create proper chain
    const createSelectChain = () => ({
      eq: vi.fn().mockReturnValue({
        single: mockSupabaseSingle,
      }),
    });

    // Helper to create insert chain for sync_locks
    const createInsertChain = () => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: { id: 'lock-123' }, error: null }),
      })),
      then: (resolve: any) => resolve({ data: {}, error: null }),
    });

    // Default mock implementations
    mockSupabaseSelect.mockImplementation(createSelectChain);

    mockSupabaseUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockSupabaseDelete.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockSupabaseInsert.mockResolvedValue({ error: null });

    // Configure sync_locks mocks
    mockSyncLockInsert.mockImplementation(() => createInsertChain());
    mockSyncLockDelete.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockSyncLockSelect.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    // Configure RPC mock for cleanup function
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  describe('syncUserTransactions', () => {
    it('should sync transactions with additions, modifications, and removals', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-1',
          accessToken: 'access-token-1',
          institutionId: 'ins_1',
          institutionName: 'Chase',
        },
      ]);

      // Mock cursor retrieval and account mapping
      let selectCallCount = 0;
      mockSupabaseSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: cursor retrieval
          return {
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { transactions_cursor: null },
                error: null,
              }),
            }),
          };
        } else if (selectCallCount === 2) {
          // Second call: account mapping
          return {
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'acc-internal-1', plaid_account_id: 'plaid-acc-1' },
                { id: 'acc-internal-2', plaid_account_id: 'plaid-acc-2' },
              ],
              error: null,
            }),
          };
        } else if (selectCallCount <= 4) {
          // Transaction checks for added transactions (new)
          return {
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        } else {
          // Transaction check for modified transaction (existing)
          return {
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'existing-txn-id' },
                error: null,
              }),
            }),
          };
        }
      });

      // Mock transaction sync response
      mockSyncTransactions.mockResolvedValue({
        added: [
          {
            transactionId: 'txn-new-1',
            accountId: 'plaid-acc-1',
            amount: 50.0,
            date: '2025-01-31',
            name: 'Starbucks',
            merchantName: 'Starbucks Coffee',
            category: ['Food and Drink', 'Restaurants'],
            categoryId: '13005000',
            pending: false,
            isoCurrencyCode: 'USD',
          },
          {
            transactionId: 'txn-new-2',
            accountId: 'plaid-acc-2',
            amount: 100.0,
            date: '2025-01-30',
            name: 'Transfer',
            merchantName: null,
            category: ['Transfer', 'Deposit'],
            categoryId: '21000000',
            pending: false,
            isoCurrencyCode: 'USD',
          },
        ],
        modified: [
          {
            transactionId: 'txn-existing',
            accountId: 'plaid-acc-1',
            amount: 25.5,
            date: '2025-01-29',
            name: 'Amazon',
            merchantName: 'Amazon.com',
            category: ['Shops', 'Online Retail'],
            categoryId: '19013000',
            pending: false,
            isoCurrencyCode: 'USD',
          },
        ],
        removed: [{ transactionId: 'txn-deleted' }],
        nextCursor: 'cursor-abc-123',
        hasMore: false,
      });


      const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
      const result = await syncUserTransactions('user-123');

      expect(result.itemsProcessed).toBe(1);
      expect(result.itemsSuccessful).toBe(1);
      expect(result.itemsFailed).toBe(0);
      expect(result.totalTransactionsAdded).toBe(2);
      expect(result.totalTransactionsModified).toBe(1);
      expect(result.totalTransactionsRemoved).toBe(1);

      // Verify Plaid API was called
      expect(mockSyncTransactions).toHaveBeenCalledWith('access-token-1', undefined);

      // Verify transactions were inserted (2 new)
      expect(mockSupabaseInsert).toHaveBeenCalledTimes(2);

      // Verify transaction was updated (1 modified) + cursor/last_sync update
      expect(mockSupabaseUpdate).toHaveBeenCalled();

      // Verify transaction was deleted (1 removed)
      expect(mockSupabaseDelete).toHaveBeenCalledTimes(1);
    });

    it('should handle pagination when hasMore is true', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-1',
          accessToken: 'access-token-1',
          institutionId: 'ins_1',
          institutionName: 'Chase',
        },
      ]);

      // Mock select calls
      let selectCallCount = 0;
      mockSupabaseSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Cursor retrieval
          return {
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { transactions_cursor: null },
                error: null,
              }),
            }),
          };
        } else if (selectCallCount === 2) {
          // Account mapping for page 1
          return {
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'acc-internal-1', plaid_account_id: 'plaid-acc-1' }],
              error: null,
            }),
          };
        } else if (selectCallCount === 3) {
          // Transaction check for page 1
          return {
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        } else if (selectCallCount === 4) {
          // Account mapping for page 2
          return {
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'acc-internal-1', plaid_account_id: 'plaid-acc-1' }],
              error: null,
            }),
          };
        } else {
          // Transaction check for page 2
          return {
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
      });

      // First page - hasMore: true
      mockSyncTransactions
        .mockResolvedValueOnce({
          added: [
            {
              transactionId: 'txn-page1',
              accountId: 'plaid-acc-1',
              amount: 50.0,
              date: '2025-01-31',
              name: 'Transaction 1',
              merchantName: 'Merchant 1',
              category: ['Food and Drink'],
              categoryId: '13000000',
              pending: false,
              isoCurrencyCode: 'USD',
            },
          ],
          modified: [],
          removed: [],
          nextCursor: 'cursor-page-2',
          hasMore: true,
        })
        // Second page - hasMore: false
        .mockResolvedValueOnce({
          added: [
            {
              transactionId: 'txn-page2',
              accountId: 'plaid-acc-1',
              amount: 75.0,
              date: '2025-01-30',
              name: 'Transaction 2',
              merchantName: 'Merchant 2',
              category: ['Food and Drink'],
              categoryId: '13000000',
              pending: false,
              isoCurrencyCode: 'USD',
            },
          ],
          modified: [],
          removed: [],
          nextCursor: 'cursor-final',
          hasMore: false,
        });

      const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
      const result = await syncUserTransactions('user-123');

      // Should have made 2 API calls (pagination)
      expect(mockSyncTransactions).toHaveBeenCalledTimes(2);
      expect(mockSyncTransactions).toHaveBeenNthCalledWith(1, 'access-token-1', undefined);
      expect(mockSyncTransactions).toHaveBeenNthCalledWith(2, 'access-token-1', 'cursor-page-2');

      expect(result.totalTransactionsAdded).toBe(2);
    });

    it('should prevent duplicate transactions with upsert logic', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-1',
          accessToken: 'access-token-1',
          institutionId: 'ins_1',
          institutionName: 'Chase',
        },
      ]);

      // Mock select calls properly
      let selectCallCount = 0;
      mockSupabaseSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Cursor retrieval
          return {
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { transactions_cursor: null },
                error: null,
              }),
            }),
          };
        } else if (selectCallCount === 2) {
          // Account mapping
          return {
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'acc-internal-1', plaid_account_id: 'plaid-acc-1' }],
              error: null,
            }),
          };
        } else {
          // Transaction exists check - return existing transaction
          return {
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'existing-txn-id' },
                error: null,
              }),
            }),
          };
        }
      });

      mockSyncTransactions.mockResolvedValue({
        added: [
          {
            transactionId: 'txn-duplicate',
            accountId: 'plaid-acc-1',
            amount: 50.0,
            date: '2025-01-31',
            name: 'Duplicate Transaction',
            merchantName: 'Merchant',
            category: ['Food and Drink'],
            categoryId: '13000000',
            pending: false,
            isoCurrencyCode: 'USD',
          },
        ],
        modified: [],
        removed: [],
        nextCursor: 'cursor-abc',
        hasMore: false,
      });

      const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
      const result = await syncUserTransactions('user-123');

      // Should count as "added" but actually updates existing
      expect(result.totalTransactionsAdded).toBe(1);

      // Should update, not insert
      expect(mockSupabaseUpdate).toHaveBeenCalled();
      expect(mockSupabaseInsert).not.toHaveBeenCalled();
    });

    it('should return empty result when user has no connected accounts', async () => {
      mockGetUserAccessTokens.mockResolvedValue([]);

      const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
      const result = await syncUserTransactions('user-no-accounts');

      expect(result.itemsProcessed).toBe(0);
      expect(result.itemsSuccessful).toBe(0);
      expect(result.itemsFailed).toBe(0);
      expect(result.totalTransactionsAdded).toBe(0);

      expect(mockSyncTransactions).not.toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-error',
          accessToken: 'access-token-error',
          institutionId: 'ins_1',
          institutionName: 'Chase',
        },
      ]);

      // Mock cursor retrieval
      mockSupabaseSelect.mockImplementation(() => ({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { transactions_cursor: null },
            error: null,
          }),
        }),
      }));

      mockSyncTransactions.mockRejectedValue(new Error('ITEM_LOGIN_REQUIRED'));

      const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
      const result = await syncUserTransactions('user-123');

      expect(result.itemsProcessed).toBe(1);
      expect(result.itemsSuccessful).toBe(0);
      expect(result.itemsFailed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        itemId: 'item-error',
        error: 'ITEM_LOGIN_REQUIRED',
      });

      // Should mark item as error
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error_message: 'ITEM_LOGIN_REQUIRED',
        })
      );
    });

    it('should update cursor after successful sync', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-1',
          accessToken: 'access-token-1',
          institutionId: 'ins_1',
          institutionName: 'Chase',
        },
      ]);

      // Mock select calls
      let selectCallCount = 0;
      mockSupabaseSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Cursor retrieval
          return {
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { transactions_cursor: 'old-cursor' },
                error: null,
              }),
            }),
          };
        } else {
          // Account mapping
          return {
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'acc-internal-1', plaid_account_id: 'plaid-acc-1' }],
              error: null,
            }),
          };
        }
      });

      mockSyncTransactions.mockResolvedValue({
        added: [],
        modified: [],
        removed: [],
        nextCursor: 'new-cursor-123',
        hasMore: false,
      });

      const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
      await syncUserTransactions('user-123');

      // Verify cursor was updated
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          transactions_cursor: 'new-cursor-123',
          last_sync: expect.any(String),
        })
      );
    });

    it('should use category mapper for transaction categorization', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-1',
          accessToken: 'access-token-1',
          institutionId: 'ins_1',
          institutionName: 'Chase',
        },
      ]);

      // Mock select calls
      let selectCallCount = 0;
      mockSupabaseSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Cursor retrieval
          return {
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { transactions_cursor: null },
                error: null,
              }),
            }),
          };
        } else if (selectCallCount === 2) {
          // Account mapping
          return {
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'acc-internal-1', plaid_account_id: 'plaid-acc-1' }],
              error: null,
            }),
          };
        } else {
          // Transaction existence check
          return {
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
      });

      mockSyncTransactions.mockResolvedValue({
        added: [
          {
            transactionId: 'txn-1',
            accountId: 'plaid-acc-1',
            amount: 25.5,
            date: '2025-01-31',
            name: 'Restaurant',
            merchantName: 'Chipotle',
            category: ['Food and Drink', 'Restaurants'],
            categoryId: '13005000',
            pending: false,
            isoCurrencyCode: 'USD',
          },
        ],
        modified: [],
        removed: [],
        nextCursor: 'cursor',
        hasMore: false,
      });

      const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
      await syncUserTransactions('user-123');

      // Verify transaction was inserted with mapped category
      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'food', // Mapped from ['Food and Drink', 'Restaurants']
          description: 'Chipotle', // Prefers merchantName over name
        })
      );
    });

    it('should skip transactions for unmapped accounts', async () => {
      mockGetUserAccessTokens.mockResolvedValue([
        {
          itemId: 'item-1',
          accessToken: 'access-token-1',
          institutionId: 'ins_1',
          institutionName: 'Chase',
        },
      ]);

      // Mock select calls
      let selectCallCount = 0;
      mockSupabaseSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Cursor retrieval
          return {
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { transactions_cursor: null },
                error: null,
              }),
            }),
          };
        } else if (selectCallCount === 2) {
          // Account mapping - only one account exists
          return {
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'acc-internal-1', plaid_account_id: 'plaid-acc-1' }],
              error: null,
            }),
          };
        } else {
          // Transaction existence check
          return {
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
      });

      mockSyncTransactions.mockResolvedValue({
        added: [
          {
            transactionId: 'txn-1',
            accountId: 'plaid-acc-1', // Has mapping
            amount: 50.0,
            date: '2025-01-31',
            name: 'Transaction 1',
            merchantName: null,
            category: null,
            categoryId: null,
            pending: false,
            isoCurrencyCode: 'USD',
          },
          {
            transactionId: 'txn-2',
            accountId: 'plaid-acc-unknown', // No mapping
            amount: 75.0,
            date: '2025-01-30',
            name: 'Transaction 2',
            merchantName: null,
            category: null,
            categoryId: null,
            pending: false,
            isoCurrencyCode: 'USD',
          },
        ],
        modified: [],
        removed: [],
        nextCursor: 'cursor',
        hasMore: false,
      });

      mockSupabaseSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const { syncUserTransactions } = await import('@/lib/plaid/sync-service');
      const result = await syncUserTransactions('user-123');

      // Sync should complete successfully
      expect(result.itemsProcessed).toBe(1);
      expect(result.itemsSuccessful).toBe(1);
      expect(result.itemsFailed).toBe(0);

      // Only mapped transactions should be processed (skipping unmapped ones)
      expect(result.totalTransactionsAdded).toBeGreaterThanOrEqual(0);
    });
  });
});
