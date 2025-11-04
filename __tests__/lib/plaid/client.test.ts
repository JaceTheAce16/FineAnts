/**
 * Tests for Plaid API Client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock functions - must be defined before mocks
const mockLinkTokenCreate = vi.fn();
const mockItemPublicTokenExchange = vi.fn();
const mockAccountsGet = vi.fn();
const mockAccountsBalanceGet = vi.fn();
const mockTransactionsGet = vi.fn();
const mockTransactionsSync = vi.fn();
const mockItemRemove = vi.fn();
const mockItemGet = vi.fn();

// Mock the config module
vi.mock('@/lib/plaid/config', () => ({
  plaidConfig: {
    secret: 'test-secret',
    environment: 'sandbox' as const,
    encryptionKey: 'a'.repeat(64),
  },
  plaidPublicConfig: {
    clientId: 'test-client-id',
    appUrl: 'http://localhost:3000',
  },
  plaidWebhookUrl: 'http://localhost:3000/api/webhooks/plaid',
}));

// Mock Plaid SDK
vi.mock('plaid', async () => {
  const actual = await vi.importActual('plaid');
  return {
    ...actual,
    PlaidApi: vi.fn(function() {
      return {
        linkTokenCreate: mockLinkTokenCreate,
        itemPublicTokenExchange: mockItemPublicTokenExchange,
        accountsGet: mockAccountsGet,
        accountsBalanceGet: mockAccountsBalanceGet,
        transactionsGet: mockTransactionsGet,
        transactionsSync: mockTransactionsSync,
        itemRemove: mockItemRemove,
        itemGet: mockItemGet,
      };
    }),
    PlaidEnvironments: {
      sandbox: 'https://sandbox.plaid.com',
      development: 'https://development.plaid.com',
      production: 'https://production.plaid.com',
    },
    Configuration: vi.fn(),
  };
});

// Import types after mocks
const { Products, CountryCode } = await import('plaid');

describe('Plaid Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createLinkToken', () => {
    it('should create a link token with default options', async () => {
      mockLinkTokenCreate.mockResolvedValue({
        data: {
          link_token: 'link-sandbox-test-token',
          expiration: '2025-01-31T12:00:00Z',
        },
      });

      const { createLinkToken } = await import('@/lib/plaid/client');

      const linkToken = await createLinkToken({
        userId: 'user-123',
        clientName: 'FineAnts',
      });

      expect(linkToken).toBe('link-sandbox-test-token');
      expect(mockLinkTokenCreate).toHaveBeenCalledWith({
        user: { client_user_id: 'user-123' },
        client_name: 'FineAnts',
        products: [Products.Auth, Products.Transactions],
        country_codes: [CountryCode.Us],
        language: 'en',
        webhook: 'http://localhost:3000/api/webhooks/plaid',
        access_token: undefined,
        redirect_uri: undefined,
      });
    });

    it('should create a link token with custom options', async () => {
      mockLinkTokenCreate.mockResolvedValue({
        data: {
          link_token: 'link-sandbox-test-token',
        },
      });

      const { createLinkToken } = await import('@/lib/plaid/client');

      await createLinkToken({
        userId: 'user-456',
        clientName: 'CustomApp',
        products: [Products.Transactions],
        countryCodes: [CountryCode.Ca],
        language: 'fr',
        webhook: 'https://example.com/webhook',
        redirectUri: 'https://example.com/redirect',
      });

      expect(mockLinkTokenCreate).toHaveBeenCalledWith({
        user: { client_user_id: 'user-456' },
        client_name: 'CustomApp',
        products: [Products.Transactions],
        country_codes: [CountryCode.Ca],
        language: 'fr',
        webhook: 'https://example.com/webhook',
        access_token: undefined,
        redirect_uri: 'https://example.com/redirect',
      });
    });

    it('should create a link token in update mode', async () => {
      mockLinkTokenCreate.mockResolvedValue({
        data: {
          link_token: 'link-sandbox-update-token',
        },
      });

      const { createLinkToken } = await import('@/lib/plaid/client');

      await createLinkToken({
        userId: 'user-789',
        clientName: 'FineAnts',
        accessToken: 'access-sandbox-existing-token',
      });

      expect(mockLinkTokenCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          access_token: 'access-sandbox-existing-token',
        })
      );
    });
  });

  describe('exchangePublicToken', () => {
    it('should exchange public token for access token', async () => {
      mockItemPublicTokenExchange.mockResolvedValue({
        data: {
          access_token: 'access-sandbox-test-token',
          item_id: 'item-test-123',
          request_id: 'request-123',
        },
      });

      const { exchangePublicToken } = await import('@/lib/plaid/client');

      const result = await exchangePublicToken('public-sandbox-token');

      expect(result).toEqual({
        accessToken: 'access-sandbox-test-token',
        itemId: 'item-test-123',
      });
      expect(mockItemPublicTokenExchange).toHaveBeenCalledWith({
        public_token: 'public-sandbox-token',
      });
    });
  });

  describe('getAccounts', () => {
    it('should get accounts with full data', async () => {
      mockAccountsGet.mockResolvedValue({
        data: {
          accounts: [
            {
              account_id: 'acc-123',
              name: 'Checking Account',
              official_name: 'Official Checking',
              type: 'depository',
              subtype: 'checking',
              mask: '1234',
              balances: {
                available: 1000.50,
                current: 1000.50,
                iso_currency_code: 'USD',
              },
            },
            {
              account_id: 'acc-456',
              name: 'Savings Account',
              official_name: null,
              type: 'depository',
              subtype: 'savings',
              mask: '5678',
              balances: {
                available: 5000.00,
                current: 5000.00,
                iso_currency_code: 'USD',
              },
            },
          ],
        },
      });

      const { getAccounts } = await import('@/lib/plaid/client');

      const accounts = await getAccounts('access-token');

      expect(accounts).toHaveLength(2);
      expect(accounts[0]).toEqual({
        accountId: 'acc-123',
        name: 'Checking Account',
        officialName: 'Official Checking',
        type: 'depository',
        subtype: 'checking',
        mask: '1234',
        balances: {
          available: 1000.50,
          current: 1000.50,
          isoCurrencyCode: 'USD',
        },
      });
      expect(accounts[1].officialName).toBeNull();
    });

    it('should handle missing optional fields', async () => {
      mockAccountsGet.mockResolvedValue({
        data: {
          accounts: [
            {
              account_id: 'acc-789',
              name: 'Credit Card',
              type: 'credit',
              balances: {
                current: -250.75,
              },
            },
          ],
        },
      });

      const { getAccounts } = await import('@/lib/plaid/client');

      const accounts = await getAccounts('access-token');

      expect(accounts[0]).toEqual({
        accountId: 'acc-789',
        name: 'Credit Card',
        officialName: null,
        type: 'credit',
        subtype: null,
        mask: null,
        balances: {
          available: null,
          current: -250.75,
          isoCurrencyCode: null,
        },
      });
    });
  });

  describe('getAccountBalances', () => {
    it('should get account balances', async () => {
      mockAccountsBalanceGet.mockResolvedValue({
        data: {
          accounts: [
            {
              account_id: 'acc-123',
              name: 'Checking',
              type: 'depository',
              subtype: 'checking',
              mask: '1234',
              balances: {
                available: 999.99,
                current: 1000.00,
                iso_currency_code: 'USD',
              },
            },
          ],
        },
      });

      const { getAccountBalances } = await import('@/lib/plaid/client');

      const accounts = await getAccountBalances('access-token');

      expect(accounts).toHaveLength(1);
      expect(accounts[0].balances.current).toBe(1000.00);
      expect(mockAccountsBalanceGet).toHaveBeenCalledWith({
        access_token: 'access-token',
      });
    });
  });

  describe('getTransactions', () => {
    it('should get transactions for date range', async () => {
      mockTransactionsGet.mockResolvedValue({
        data: {
          transactions: [
            {
              transaction_id: 'txn-123',
              account_id: 'acc-123',
              amount: 25.50,
              date: '2025-01-30',
              name: 'Starbucks',
              merchant_name: 'Starbucks Coffee',
              category: ['Food and Drink', 'Restaurants'],
              category_id: '13005000',
              pending: false,
              iso_currency_code: 'USD',
            },
            {
              transaction_id: 'txn-456',
              account_id: 'acc-123',
              amount: 100.00,
              date: '2025-01-29',
              name: 'Transfer',
              pending: true,
            },
          ],
        },
      });

      const { getTransactions } = await import('@/lib/plaid/client');

      const transactions = await getTransactions('access-token', '2025-01-01', '2025-01-31');

      expect(transactions).toHaveLength(2);
      expect(transactions[0]).toEqual({
        transactionId: 'txn-123',
        accountId: 'acc-123',
        amount: 25.50,
        date: '2025-01-30',
        name: 'Starbucks',
        merchantName: 'Starbucks Coffee',
        category: ['Food and Drink', 'Restaurants'],
        categoryId: '13005000',
        pending: false,
        isoCurrencyCode: 'USD',
      });
      expect(transactions[1].merchantName).toBeNull();
      expect(transactions[1].pending).toBe(true);
    });
  });

  describe('syncTransactions', () => {
    it('should sync transactions without cursor (initial sync)', async () => {
      mockTransactionsSync.mockResolvedValue({
        data: {
          added: [
            {
              transaction_id: 'txn-new-1',
              account_id: 'acc-123',
              amount: 50.00,
              date: '2025-01-31',
              name: 'New Transaction',
              pending: false,
            },
          ],
          modified: [],
          removed: [],
          next_cursor: 'cursor-abc-123',
          has_more: false,
        },
      });

      const { syncTransactions } = await import('@/lib/plaid/client');

      const result = await syncTransactions('access-token');

      expect(result.added).toHaveLength(1);
      expect(result.modified).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.nextCursor).toBe('cursor-abc-123');
      expect(result.hasMore).toBe(false);
      expect(mockTransactionsSync).toHaveBeenCalledWith({
        access_token: 'access-token',
        cursor: undefined,
      });
    });

    it('should sync transactions with cursor (incremental sync)', async () => {
      mockTransactionsSync.mockResolvedValue({
        data: {
          added: [
            {
              transaction_id: 'txn-new-2',
              account_id: 'acc-123',
              amount: 75.00,
              date: '2025-02-01',
              name: 'Another Transaction',
              pending: false,
            },
          ],
          modified: [
            {
              transaction_id: 'txn-existing',
              account_id: 'acc-123',
              amount: 25.00,
              date: '2025-01-30',
              name: 'Updated Transaction',
              pending: false,
            },
          ],
          removed: [
            {
              transaction_id: 'txn-deleted',
            },
          ],
          next_cursor: 'cursor-def-456',
          has_more: true,
        },
      });

      const { syncTransactions } = await import('@/lib/plaid/client');

      const result = await syncTransactions('access-token', 'cursor-abc-123');

      expect(result.added).toHaveLength(1);
      expect(result.modified).toHaveLength(1);
      expect(result.removed).toHaveLength(1);
      expect(result.removed[0]).toEqual({ transactionId: 'txn-deleted' });
      expect(result.hasMore).toBe(true);
      expect(mockTransactionsSync).toHaveBeenCalledWith({
        access_token: 'access-token',
        cursor: 'cursor-abc-123',
      });
    });

    it('should map transaction fields correctly', async () => {
      mockTransactionsSync.mockResolvedValue({
        data: {
          added: [
            {
              transaction_id: 'txn-complete',
              account_id: 'acc-456',
              amount: 125.99,
              date: '2025-02-01',
              name: 'Amazon Purchase',
              merchant_name: 'Amazon.com',
              category: ['Shops', 'Online Retail'],
              category_id: '19013000',
              pending: true,
              iso_currency_code: 'USD',
            },
          ],
          modified: [],
          removed: [],
          next_cursor: 'cursor-xyz',
          has_more: false,
        },
      });

      const { syncTransactions } = await import('@/lib/plaid/client');

      const result = await syncTransactions('access-token');

      expect(result.added[0]).toEqual({
        transactionId: 'txn-complete',
        accountId: 'acc-456',
        amount: 125.99,
        date: '2025-02-01',
        name: 'Amazon Purchase',
        merchantName: 'Amazon.com',
        category: ['Shops', 'Online Retail'],
        categoryId: '19013000',
        pending: true,
        isoCurrencyCode: 'USD',
      });
    });
  });

  describe('removeItem', () => {
    it('should remove an item', async () => {
      mockItemRemove.mockResolvedValue({
        data: {
          request_id: 'request-123',
        },
      });

      const { removeItem } = await import('@/lib/plaid/client');

      await removeItem('access-token');

      expect(mockItemRemove).toHaveBeenCalledWith({
        access_token: 'access-token',
      });
    });
  });

  describe('getItem', () => {
    it('should get item metadata', async () => {
      mockItemGet.mockResolvedValue({
        data: {
          item: {
            item_id: 'item-123',
            institution_id: 'ins_3',
            webhook: 'https://example.com/webhook',
            error: null,
            available_products: ['investments'],
            billed_products: ['auth', 'transactions'],
          },
        },
      });

      const { getItem } = await import('@/lib/plaid/client');

      const item = await getItem('access-token');

      expect(item).toEqual({
        itemId: 'item-123',
        institutionId: 'ins_3',
        webhook: 'https://example.com/webhook',
        error: null,
        availableProducts: ['investments'],
        billedProducts: ['auth', 'transactions'],
      });
    });

    it('should handle missing optional fields in item', async () => {
      mockItemGet.mockResolvedValue({
        data: {
          item: {
            item_id: 'item-456',
            available_products: [],
            billed_products: ['transactions'],
          },
        },
      });

      const { getItem } = await import('@/lib/plaid/client');

      const item = await getItem('access-token');

      expect(item.institutionId).toBeNull();
      expect(item.webhook).toBeNull();
      expect(item.error).toBeNull();
    });
  });
});
