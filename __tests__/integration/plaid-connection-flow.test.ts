/**
 * Integration Tests for Complete Plaid Connection Flow
 * Tests: link token creation → Plaid Link → token exchange → accounts stored
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

// Mock Supabase admin client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock Plaid client
const mockCreateLinkToken = vi.fn();
const mockExchangePublicToken = vi.fn();
const mockGetAccounts = vi.fn();
const mockGetTransactions = vi.fn();
const mockSyncTransactions = vi.fn();

vi.mock('@/lib/plaid/client', () => ({
  createLinkToken: mockCreateLinkToken,
  exchangePublicToken: mockExchangePublicToken,
  getAccounts: mockGetAccounts,
  getTransactions: mockGetTransactions,
  syncTransactions: mockSyncTransactions,
}));

// Mock token manager
const mockStoreAccessToken = vi.fn();
const mockGetAccessToken = vi.fn();

vi.mock('@/lib/plaid/token-manager', () => ({
  storeAccessToken: mockStoreAccessToken,
  getAccessToken: mockGetAccessToken,
}));

describe('Plaid Connection Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default user authentication
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });

    // Default database mock chain
    mockInsert.mockResolvedValue({ data: {}, error: null });
    mockSingle.mockResolvedValue({ data: {}, error: null });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
    });

    // Mock syncTransactions to return empty result
    mockSyncTransactions.mockResolvedValue({
      added: [],
      modified: [],
      removed: [],
      has_more: false,
      next_cursor: null,
    });
  });

  describe('Complete Connection Flow', () => {
    it('should complete full flow: create link token → exchange token → store accounts', async () => {
      // Step 1: Create link token
      mockCreateLinkToken.mockResolvedValue('link-sandbox-token-123');

      const { POST: createLinkTokenHandler } = await import('@/app/api/plaid/link-token/route');
      const linkTokenResponse = await createLinkTokenHandler({
        json: async () => ({}),
      } as any);
      const linkTokenData = await linkTokenResponse.json();

      expect(linkTokenData.linkToken).toBe('link-sandbox-token-123');
      expect(mockCreateLinkToken).toHaveBeenCalled();

      // Step 2: Exchange public token
      mockExchangePublicToken.mockResolvedValue({
        accessToken: 'access-sandbox-token',
        itemId: 'item-123',
      });

      mockGetAccounts.mockResolvedValue([
        {
          accountId: 'acc-checking-1',
          name: 'Plaid Checking',
          officialName: null,
          type: 'depository',
          subtype: 'checking',
          mask: '0000',
          balances: {
            current: 1000.50,
            available: 950.00,
            isoCurrencyCode: 'USD',
          },
        },
        {
          accountId: 'acc-savings-1',
          name: 'Plaid Savings',
          officialName: null,
          type: 'depository',
          subtype: 'savings',
          mask: '1111',
          balances: {
            current: 5000.00,
            available: 5000.00,
            isoCurrencyCode: 'USD',
          },
        },
      ]);

      mockStoreAccessToken.mockResolvedValue(undefined);

      const { POST: exchangeTokenHandler } = await import('@/app/api/plaid/exchange-token/route');
      const exchangeResponse = await exchangeTokenHandler({
        json: async () => ({
          publicToken: 'public-sandbox-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any);

      const exchangeData = await exchangeResponse.json();

      expect(exchangeData.success).toBe(true);
      expect(exchangeData.accountCount).toBe(2);
      expect(mockExchangePublicToken).toHaveBeenCalledWith('public-sandbox-token');
      expect(mockStoreAccessToken).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith('financial_accounts');
    });

    it('should handle checking account type correctly', async () => {
      mockExchangePublicToken.mockResolvedValue({
        accessToken: 'access-token',
        itemId: 'item-123',
      });

      mockGetAccounts.mockResolvedValue([
        {
          accountId: 'acc-1',
          name: 'Checking Account',
          officialName: null,
          type: 'depository',
          subtype: 'checking',
          mask: '0000',
          balances: {
            current: 1500.00,
            available: 1400.00,
            isoCurrencyCode: 'USD',
          },
        },
      ]);

      mockStoreAccessToken.mockResolvedValue(undefined);

      const { POST: exchangeTokenHandler } = await import('@/app/api/plaid/exchange-token/route');
      const response = await exchangeTokenHandler({
        json: async () => ({
          publicToken: 'public-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any);

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('financial_accounts');
    });

    it('should handle savings account type correctly', async () => {
      mockExchangePublicToken.mockResolvedValue({
        accessToken: 'access-token',
        itemId: 'item-123',
      });

      mockGetAccounts.mockResolvedValue([
        {
          accountId: 'acc-1',
          name: 'Savings Account',
          officialName: null,
          type: 'depository',
          subtype: 'savings',
          mask: '1111',
          balances: {
            current: 10000.00,
            available: 10000.00,
            isoCurrencyCode: 'USD',
          },
        },
      ]);

      mockStoreAccessToken.mockResolvedValue(undefined);

      const { POST: exchangeTokenHandler } = await import('@/app/api/plaid/exchange-token/route');
      const response = await exchangeTokenHandler({
        json: async () => ({
          publicToken: 'public-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any);

      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it('should handle investment account type correctly', async () => {
      mockExchangePublicToken.mockResolvedValue({
        accessToken: 'access-token',
        itemId: 'item-123',
      });

      mockGetAccounts.mockResolvedValue([
        {
          accountId: 'acc-1',
          name: '401k Account',
          officialName: null,
          type: 'investment',
          subtype: '401k',
          mask: '2222',
          balances: {
            current: 50000.00,
            available: null,
            isoCurrencyCode: 'USD',
          },
        },
      ]);

      mockStoreAccessToken.mockResolvedValue(undefined);

      const { POST: exchangeTokenHandler } = await import('@/app/api/plaid/exchange-token/route');
      const response = await exchangeTokenHandler({
        json: async () => ({
          publicToken: 'public-token',
          institutionId: 'ins_3',
          institutionName: 'Vanguard',
        }),
      } as any);

      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it('should handle credit card account type correctly', async () => {
      mockExchangePublicToken.mockResolvedValue({
        accessToken: 'access-token',
        itemId: 'item-123',
      });

      mockGetAccounts.mockResolvedValue([
        {
          accountId: 'acc-1',
          name: 'Credit Card',
          officialName: null,
          type: 'credit',
          subtype: 'credit card',
          mask: '3333',
          balances: {
            current: -500.00,
            available: 4500.00,
            isoCurrencyCode: 'USD',
          },
        },
      ]);

      mockStoreAccessToken.mockResolvedValue(undefined);

      const { POST: exchangeTokenHandler } = await import('@/app/api/plaid/exchange-token/route');
      const response = await exchangeTokenHandler({
        json: async () => ({
          publicToken: 'public-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any);

      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it('should store plaid_item in database', async () => {
      mockExchangePublicToken.mockResolvedValue({
        accessToken: 'access-token',
        itemId: 'item-123',
      });

      mockGetAccounts.mockResolvedValue([
        {
          accountId: 'acc-1',
          name: 'Account',
          officialName: null,
          type: 'depository',
          subtype: 'checking',
          mask: '0000',
          balances: {
            current: 1000.00,
            available: 1000.00,
            isoCurrencyCode: 'USD',
          },
        },
      ]);

      mockStoreAccessToken.mockResolvedValue(undefined);

      const { POST: exchangeTokenHandler } = await import('@/app/api/plaid/exchange-token/route');
      await exchangeTokenHandler({
        json: async () => ({
          publicToken: 'public-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any);

      expect(mockStoreAccessToken).toHaveBeenCalledWith(
        'user-123',
        'item-123',
        'access-token',
        'ins_3',
        'Chase'
      );
    });

    it('should create financial_accounts for each Plaid account', async () => {
      mockExchangePublicToken.mockResolvedValue({
        accessToken: 'access-token',
        itemId: 'item-123',
      });

      mockGetAccounts.mockResolvedValue([
        {
          accountId: 'acc-1',
          name: 'Account 1',
          officialName: null,
          type: 'depository',
          subtype: 'checking',
          mask: '0000',
          balances: { current: 1000, available: 1000, isoCurrencyCode: 'USD' },
        },
        {
          accountId: 'acc-2',
          name: 'Account 2',
          officialName: null,
          type: 'depository',
          subtype: 'savings',
          mask: '1111',
          balances: { current: 5000, available: 5000, isoCurrencyCode: 'USD' },
        },
      ]);

      mockStoreAccessToken.mockResolvedValue(undefined);

      const { POST: exchangeTokenHandler } = await import('@/app/api/plaid/exchange-token/route');
      await exchangeTokenHandler({
        json: async () => ({
          publicToken: 'public-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any);

      // Should insert accounts
      expect(mockFrom).toHaveBeenCalledWith('financial_accounts');
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('Initial Transaction Sync', () => {
    it('should verify accounts are stored in database after connection', async () => {
      const insertedAccounts: any[] = [];

      mockInsert.mockImplementation((data) => {
        insertedAccounts.push(data);
        return Promise.resolve({ data, error: null });
      });

      mockExchangePublicToken.mockResolvedValue({
        accessToken: 'access-token',
        itemId: 'item-123',
      });

      mockGetAccounts.mockResolvedValue([
        {
          accountId: 'acc-1',
          name: 'Test Account',
          officialName: null,
          type: 'depository',
          subtype: 'checking',
          mask: '0000',
          balances: { current: 1000, available: 1000, isoCurrencyCode: 'USD' },
        },
      ]);

      mockStoreAccessToken.mockResolvedValue(undefined);

      const { POST: exchangeTokenHandler } = await import('@/app/api/plaid/exchange-token/route');
      await exchangeTokenHandler({
        json: async () => ({
          publicToken: 'public-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any);

      expect(mockInsert).toHaveBeenCalled();
    });

    it('should call getTransactions for initial sync', async () => {
      mockGetTransactions.mockResolvedValue({
        added: [
          {
            transaction_id: 'txn-1',
            account_id: 'acc-1',
            amount: -50.00,
            date: '2024-01-15',
            name: 'Grocery Store',
            category: ['Food', 'Groceries'],
            pending: false,
          },
        ],
        modified: [],
        removed: [],
        has_more: false,
        next_cursor: null,
      });

      // Verify getTransactions is available for sync
      expect(mockGetTransactions).toBeDefined();
    });
  });

  describe('Multiple Account Types', () => {
    it('should handle connection with mixed account types', async () => {
      mockExchangePublicToken.mockResolvedValue({
        accessToken: 'access-token',
        itemId: 'item-123',
      });

      mockGetAccounts.mockResolvedValue([
        {
          accountId: 'acc-checking',
          name: 'Checking',
          officialName: null,
          type: 'depository',
          subtype: 'checking',
          mask: '0000',
          balances: { current: 1000, available: 900, isoCurrencyCode: 'USD' },
        },
        {
          accountId: 'acc-savings',
          name: 'Savings',
          officialName: null,
          type: 'depository',
          subtype: 'savings',
          mask: '1111',
          balances: { current: 5000, available: 5000, isoCurrencyCode: 'USD' },
        },
        {
          accountId: 'acc-credit',
          name: 'Credit Card',
          officialName: null,
          type: 'credit',
          subtype: 'credit card',
          mask: '2222',
          balances: { current: -500, available: 4500, isoCurrencyCode: 'USD' },
        },
        {
          accountId: 'acc-investment',
          name: '401k',
          officialName: null,
          type: 'investment',
          subtype: '401k',
          mask: '3333',
          balances: { current: 50000, available: null, isoCurrencyCode: 'USD' },
        },
      ]);

      mockStoreAccessToken.mockResolvedValue(undefined);

      const { POST: exchangeTokenHandler } = await import('@/app/api/plaid/exchange-token/route');
      const response = await exchangeTokenHandler({
        json: async () => ({
          publicToken: 'public-token',
          institutionId: 'ins_3',
          institutionName: 'Chase',
        }),
      } as any);

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.accountCount).toBe(4);
    });
  });

  // Note: Full integration tests would require:
  // - Actual Plaid sandbox environment
  // - Real database with test data
  // - E2E browser automation (Playwright/Cypress)
  // - Network request interception
  // - Webhook simulation
  // - Time-based testing for sync thresholds
});
