/**
 * Integration Tests for Plaid Historical Transaction Fetch
 * Tests: Initial historical transaction sync, cursor pagination, transaction storage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Plaid client
const mockExchangePublicToken = vi.fn();
const mockGetAccounts = vi.fn();
const mockSyncTransactions = vi.fn();

vi.mock('@/lib/plaid/client', () => ({
  exchangePublicToken: mockExchangePublicToken,
  getAccounts: mockGetAccounts,
  syncTransactions: mockSyncTransactions,
}));

// Mock token manager
const mockStoreAccessToken = vi.fn();

vi.mock('@/lib/plaid/token-manager', () => ({
  storeAccessToken: mockStoreAccessToken,
}));

// Mock category mapper
const mockMapPlaidCategoryToApp = vi.fn();

vi.mock('@/lib/plaid/category-mapper', () => ({
  mapPlaidCategoryToApp: mockMapPlaidCategoryToApp,
}));

// Mock Supabase clients
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe('Plaid Historical Transaction Fetch Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default successful authentication
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    // Setup default Plaid operations
    mockExchangePublicToken.mockResolvedValue({
      accessToken: 'access-sandbox-test',
      itemId: 'item-test-123',
    });

    mockGetAccounts.mockResolvedValue([
      {
        accountId: 'account-1',
        name: 'Checking Account',
        type: 'depository',
        subtype: 'checking',
        mask: '1234',
        balances: {
          available: 1000,
          current: 1050,
          isoCurrencyCode: 'USD',
        },
      },
      {
        accountId: 'account-2',
        name: 'Savings Account',
        type: 'depository',
        subtype: 'savings',
        mask: '5678',
        balances: {
          available: 5000,
          current: 5000,
          isoCurrencyCode: 'USD',
        },
      },
    ]);

    // Setup default category mapping
    mockMapPlaidCategoryToApp.mockReturnValue('other');

    // Setup Supabase mock chains
    const createEqChain = () => {
      const chain = {
        eq: vi.fn(() => chain),
        single: mockSingle,
      };
      return chain;
    };

    mockSingle.mockResolvedValue({
      data: { id: 'db-account-1' },
      error: null,
    });

    mockEq.mockImplementation(() => createEqChain());
    mockSelect.mockReturnValue(createEqChain());

    mockInsert.mockResolvedValue({ data: [], error: null });
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: {}, error: null }) });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'financial_accounts') {
        return {
          insert: mockInsert,
          select: mockSelect,
        };
      } else if (table === 'transactions') {
        return {
          insert: mockInsert,
        };
      } else if (table === 'plaid_items') {
        return {
          update: mockUpdate,
        };
      }
      return {};
    });

    mockStoreAccessToken.mockResolvedValue(undefined);
  });

  describe('Initial Historical Transaction Fetch', () => {
    it('should fetch and store historical transactions on account connection', async () => {
      // Mock syncTransactions to return transactions in first call
      mockSyncTransactions.mockResolvedValueOnce({
        added: [
          {
            transactionId: 'txn-1',
            accountId: 'account-1',
            amount: 50.00,
            date: '2024-01-15',
            name: 'Coffee Shop',
            category: ['Food and Drink', 'Restaurants'],
            pending: false,
          },
          {
            transactionId: 'txn-2',
            accountId: 'account-1',
            amount: 120.00,
            date: '2024-01-14',
            name: 'Grocery Store',
            category: ['Food and Drink', 'Groceries'],
            pending: false,
          },
        ],
        modified: [],
        removed: [],
        nextCursor: 'cursor-end',
        hasMore: false,
      });

      const { POST } = await import('@/app/api/plaid/exchange-token/route');

      const request = {
        json: async () => ({
          publicToken: 'public-sandbox-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      // Verify successful response
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.transactionCount).toBe(2);

      // Verify syncTransactions was called
      expect(mockSyncTransactions).toHaveBeenCalledWith('access-sandbox-test', undefined);

      // Verify transactions were inserted
      expect(mockInsert).toHaveBeenCalled();
      const insertCalls = mockInsert.mock.calls;
      const transactionInsert = insertCalls.find((call) => Array.isArray(call[0]) && call[0][0]?.plaid_transaction_id);
      expect(transactionInsert).toBeDefined();
      expect(transactionInsert[0]).toHaveLength(2);
    });

    it('should handle cursor pagination for large transaction sets', async () => {
      // Mock syncTransactions to return multiple pages
      mockSyncTransactions
        .mockResolvedValueOnce({
          added: Array.from({ length: 100 }, (_, i) => ({
            transactionId: `txn-page1-${i}`,
            accountId: 'account-1',
            amount: 10.00 + i,
            date: '2024-01-15',
            name: `Transaction ${i}`,
            category: ['Shopping'],
            pending: false,
          })),
          modified: [],
          removed: [],
          nextCursor: 'cursor-page-2',
          hasMore: true,
        })
        .mockResolvedValueOnce({
          added: Array.from({ length: 100 }, (_, i) => ({
            transactionId: `txn-page2-${i}`,
            accountId: 'account-1',
            amount: 20.00 + i,
            date: '2024-01-14',
            name: `Transaction ${i + 100}`,
            category: ['Food and Drink'],
            pending: false,
          })),
          modified: [],
          removed: [],
          nextCursor: 'cursor-page-3',
          hasMore: true,
        })
        .mockResolvedValueOnce({
          added: Array.from({ length: 50 }, (_, i) => ({
            transactionId: `txn-page3-${i}`,
            accountId: 'account-2',
            amount: 30.00 + i,
            date: '2024-01-13',
            name: `Transaction ${i + 200}`,
            category: ['Transportation'],
            pending: false,
          })),
          modified: [],
          removed: [],
          nextCursor: 'cursor-final',
          hasMore: false,
        });

      const { POST } = await import('@/app/api/plaid/exchange-token/route');

      const request = {
        json: async () => ({
          publicToken: 'public-sandbox-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      // Verify all pages were processed
      expect(data.transactionCount).toBe(250); // 100 + 100 + 50

      // Verify syncTransactions was called multiple times with cursors
      expect(mockSyncTransactions).toHaveBeenCalledTimes(3);
      expect(mockSyncTransactions).toHaveBeenNthCalledWith(1, 'access-sandbox-test', undefined);
      expect(mockSyncTransactions).toHaveBeenNthCalledWith(2, 'access-sandbox-test', 'cursor-page-2');
      expect(mockSyncTransactions).toHaveBeenNthCalledWith(3, 'access-sandbox-test', 'cursor-page-3');

      // Verify cursor was updated in database
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith('plaid_items');
    });

    it('should store cursor for future syncs', async () => {
      mockSyncTransactions.mockResolvedValueOnce({
        added: [
          {
            transactionId: 'txn-1',
            accountId: 'account-1',
            amount: 50.00,
            date: '2024-01-15',
            name: 'Test Transaction',
            category: ['Other'],
            pending: false,
          },
        ],
        modified: [],
        removed: [],
        nextCursor: 'cursor-final-stored',
        hasMore: false,
      });

      const { POST } = await import('@/app/api/plaid/exchange-token/route');

      const request = {
        json: async () => ({
          publicToken: 'public-sandbox-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any;

      await POST(request);

      // Verify cursor was stored
      expect(mockUpdate).toHaveBeenCalled();
      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.transactions_cursor).toBe('cursor-final-stored');
      expect(updateCall.last_sync).toBeDefined();
    });
  });

  describe('Transaction Data Mapping', () => {
    it('should correctly map Plaid transaction fields to database schema', async () => {
      mockSyncTransactions.mockResolvedValueOnce({
        added: [
          {
            transactionId: 'txn-mapping-test',
            accountId: 'account-1',
            amount: 75.50,
            date: '2024-01-15',
            name: 'Restaurant Meal',
            merchantName: 'Fancy Restaurant',
            category: ['Food and Drink', 'Restaurants'],
            categoryId: 'cat-123',
            pending: false,
            isoCurrencyCode: 'USD',
          },
        ],
        modified: [],
        removed: [],
        nextCursor: 'cursor-end',
        hasMore: false,
      });

      mockMapPlaidCategoryToApp.mockReturnValue('food');

      const { POST } = await import('@/app/api/plaid/exchange-token/route');

      const request = {
        json: async () => ({
          publicToken: 'public-sandbox-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any;

      await POST(request);

      // Verify transaction was mapped correctly
      const insertCalls = mockInsert.mock.calls;
      const transactionInsert = insertCalls.find((call) => Array.isArray(call[0]) && call[0][0]?.plaid_transaction_id);

      expect(transactionInsert).toBeDefined();
      const transaction = transactionInsert[0][0];

      expect(transaction.plaid_transaction_id).toBe('txn-mapping-test');
      expect(transaction.amount).toBe(75.50);
      expect(transaction.description).toBe('Restaurant Meal');
      expect(transaction.category).toBe('food');
      expect(transaction.transaction_date).toBe('2024-01-15');
      expect(transaction.is_pending).toBe(false);
      expect(transaction.user_id).toBe('user-123');
      expect(transaction.account_id).toBe('db-account-1');
    });

    it('should use category mapper for transaction categorization', async () => {
      mockSyncTransactions.mockResolvedValueOnce({
        added: [
          {
            transactionId: 'txn-1',
            accountId: 'account-1',
            amount: 100.00,
            date: '2024-01-15',
            name: 'Gas Station',
            category: ['Transportation', 'Gas Stations'],
            pending: false,
          },
        ],
        modified: [],
        removed: [],
        nextCursor: 'cursor-end',
        hasMore: false,
      });

      mockMapPlaidCategoryToApp.mockReturnValue('transportation');

      const { POST } = await import('@/app/api/plaid/exchange-token/route');

      const request = {
        json: async () => ({
          publicToken: 'public-sandbox-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any;

      await POST(request);

      // Verify category mapper was called
      expect(mockMapPlaidCategoryToApp).toHaveBeenCalledWith(['Transportation', 'Gas Stations']);
    });
  });

  describe('Error Handling', () => {
    it('should handle sync errors gracefully and return error info', async () => {
      mockSyncTransactions.mockRejectedValueOnce(new Error('Plaid API unavailable'));

      const { POST } = await import('@/app/api/plaid/exchange-token/route');

      const request = {
        json: async () => ({
          publicToken: 'public-sandbox-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      // Should still succeed with account connection
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.accountCount).toBe(2);
      expect(data.transactionCount).toBe(0);
      expect(data.transactionFetchError).toBeDefined();
      expect(data.transactionFetchError).toContain('Plaid API unavailable');
    });

    it('should skip transactions for accounts that do not exist', async () => {
      mockSyncTransactions.mockResolvedValueOnce({
        added: [
          {
            transactionId: 'txn-1',
            accountId: 'account-nonexistent',
            amount: 50.00,
            date: '2024-01-15',
            name: 'Test Transaction',
            category: ['Other'],
            pending: false,
          },
        ],
        modified: [],
        removed: [],
        nextCursor: 'cursor-end',
        hasMore: false,
      });

      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const { POST } = await import('@/app/api/plaid/exchange-token/route');

      const request = {
        json: async () => ({
          publicToken: 'public-sandbox-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      // Should succeed but transaction should be skipped
      expect(response.status).toBe(200);
      expect(data.transactionCount).toBe(0);
    });

    it('should prevent infinite loops with MAX_ITERATIONS limit', async () => {
      // Mock endless pagination
      mockSyncTransactions.mockResolvedValue({
        added: [
          {
            transactionId: 'txn-infinite',
            accountId: 'account-1',
            amount: 10.00,
            date: '2024-01-15',
            name: 'Test',
            category: ['Other'],
            pending: false,
          },
        ],
        modified: [],
        removed: [],
        nextCursor: 'cursor-next',
        hasMore: true, // Always has more
      });

      const { POST } = await import('@/app/api/plaid/exchange-token/route');

      const request = {
        json: async () => ({
          publicToken: 'public-sandbox-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      // Should stop at MAX_ITERATIONS (50)
      expect(mockSyncTransactions).toHaveBeenCalledTimes(50);
      expect(response.status).toBe(200);
      expect(data.transactionCount).toBeLessThanOrEqual(50);
    });
  });

  describe('Transaction Storage', () => {
    it('should batch insert transactions efficiently', async () => {
      mockSyncTransactions.mockResolvedValueOnce({
        added: Array.from({ length: 50 }, (_, i) => ({
          transactionId: `txn-batch-${i}`,
          accountId: 'account-1',
          amount: 10.00 + i,
          date: '2024-01-15',
          name: `Transaction ${i}`,
          category: ['Other'],
          pending: false,
        })),
        modified: [],
        removed: [],
        nextCursor: 'cursor-end',
        hasMore: false,
      });

      const { POST } = await import('@/app/api/plaid/exchange-token/route');

      const request = {
        json: async () => ({
          publicToken: 'public-sandbox-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any;

      await POST(request);

      // Verify batch insert was used
      const insertCalls = mockInsert.mock.calls;
      const transactionInsert = insertCalls.find((call) => Array.isArray(call[0]) && call[0][0]?.plaid_transaction_id);

      expect(transactionInsert).toBeDefined();
      expect(transactionInsert[0]).toHaveLength(50);
    });

    it('should continue processing even if some transaction inserts fail', async () => {
      mockSyncTransactions
        .mockResolvedValueOnce({
          added: [
            {
              transactionId: 'txn-1',
              accountId: 'account-1',
              amount: 50.00,
              date: '2024-01-15',
              name: 'Transaction 1',
              category: ['Other'],
              pending: false,
            },
          ],
          modified: [],
          removed: [],
          nextCursor: 'cursor-2',
          hasMore: true,
        })
        .mockResolvedValueOnce({
          added: [
            {
              transactionId: 'txn-2',
              accountId: 'account-1',
              amount: 60.00,
              date: '2024-01-14',
              name: 'Transaction 2',
              category: ['Other'],
              pending: false,
            },
          ],
          modified: [],
          removed: [],
          nextCursor: 'cursor-end',
          hasMore: false,
        });

      // Make transaction insert fail on first call but succeed on account insert
      mockInsert
        .mockResolvedValueOnce({ data: [], error: null }) // Account insert succeeds
        .mockResolvedValueOnce({ data: [], error: { message: 'Transaction insert failed' } }) // First transaction insert fails
        .mockResolvedValueOnce({ data: [], error: null }); // Second transaction insert succeeds

      const { POST } = await import('@/app/api/plaid/exchange-token/route');

      const request = {
        json: async () => ({
          publicToken: 'public-sandbox-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any;

      const response = await POST(request);

      // Should still succeed overall
      expect(response.status).toBe(200);

      // Both sync calls should have happened
      expect(mockSyncTransactions).toHaveBeenCalledTimes(2);
    });
  });

  describe('Response Format', () => {
    it('should return transaction count in response', async () => {
      mockSyncTransactions.mockResolvedValueOnce({
        added: Array.from({ length: 25 }, (_, i) => ({
          transactionId: `txn-${i}`,
          accountId: 'account-1',
          amount: 10.00,
          date: '2024-01-15',
          name: `Transaction ${i}`,
          category: ['Other'],
          pending: false,
        })),
        modified: [],
        removed: [],
        nextCursor: 'cursor-end',
        hasMore: false,
      });

      const { POST } = await import('@/app/api/plaid/exchange-token/route');

      const request = {
        json: async () => ({
          publicToken: 'public-sandbox-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.itemId).toBe('item-test-123');
      expect(data.accountCount).toBe(2);
      expect(data.transactionCount).toBe(25);
      expect(data.transactionFetchError).toBeUndefined();
    });
  });
});
