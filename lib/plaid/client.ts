/**
 * Plaid API Client
 * Wrapper around Plaid SDK with type-safe helper functions
 */

import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { plaidConfig, plaidPublicConfig, plaidWebhookUrl } from './config';

// Initialize Plaid configuration
const configuration = new Configuration({
  basePath: PlaidEnvironments[plaidConfig.environment],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': plaidPublicConfig.clientId,
      'PLAID-SECRET': plaidConfig.secret,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

// Type definitions
export interface PlaidLinkTokenOptions {
  userId: string;
  clientName: string;
  countryCodes?: CountryCode[];
  language?: string;
  products?: Products[];
  redirectUri?: string;
  webhook?: string;
  accessToken?: string; // For update mode
}

export interface PlaidAccountData {
  accountId: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  balances: {
    available: number | null;
    current: number | null;
    isoCurrencyCode: string | null;
  };
}

export interface PlaidTransactionData {
  transactionId: string;
  accountId: string;
  amount: number;
  date: string;
  name: string;
  merchantName: string | null;
  category: string[] | null;
  categoryId: string | null;
  pending: boolean;
  isoCurrencyCode: string | null;
}

export interface PlaidSyncResult {
  added: PlaidTransactionData[];
  modified: PlaidTransactionData[];
  removed: { transactionId: string }[];
  nextCursor: string;
  hasMore: boolean;
}

/**
 * Create a Link token for Plaid Link initialization
 * @param options Link token configuration options
 * @returns Link token string
 */
export async function createLinkToken(options: PlaidLinkTokenOptions): Promise<string> {
  const response = await plaidClient.linkTokenCreate({
    user: {
      client_user_id: options.userId
    },
    client_name: options.clientName,
    products: (options.products || [Products.Auth, Products.Transactions]) as Products[],
    country_codes: (options.countryCodes || [CountryCode.Us]) as CountryCode[],
    language: options.language || 'en',
    webhook: options.webhook || plaidWebhookUrl,
    access_token: options.accessToken, // For update mode
    redirect_uri: options.redirectUri,
  });

  return response.data.link_token;
}

/**
 * Exchange a public token for an access token
 * @param publicToken Public token from Plaid Link
 * @returns Access token and item ID
 */
export async function exchangePublicToken(publicToken: string): Promise<{
  accessToken: string;
  itemId: string;
}> {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });

  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  };
}

/**
 * Get account information for an item
 * @param accessToken Plaid access token
 * @returns Array of account data
 */
export async function getAccounts(accessToken: string): Promise<PlaidAccountData[]> {
  const response = await plaidClient.accountsGet({
    access_token: accessToken,
  });

  return response.data.accounts.map(account => ({
    accountId: account.account_id,
    name: account.name,
    officialName: account.official_name || null,
    type: account.type,
    subtype: account.subtype || null,
    mask: account.mask || null,
    balances: {
      available: account.balances.available || null,
      current: account.balances.current || null,
      isoCurrencyCode: account.balances.iso_currency_code || null,
    },
  }));
}

/**
 * Get account balances for an item
 * @param accessToken Plaid access token
 * @returns Array of account data with current balances
 */
export async function getAccountBalances(accessToken: string): Promise<PlaidAccountData[]> {
  const response = await plaidClient.accountsBalanceGet({
    access_token: accessToken,
  });

  return response.data.accounts.map(account => ({
    accountId: account.account_id,
    name: account.name,
    officialName: account.official_name || null,
    type: account.type,
    subtype: account.subtype || null,
    mask: account.mask || null,
    balances: {
      available: account.balances.available || null,
      current: account.balances.current || null,
      isoCurrencyCode: account.balances.iso_currency_code || null,
    },
  }));
}

/**
 * Get transactions for a date range (legacy endpoint)
 * @param accessToken Plaid access token
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format
 * @returns Array of transaction data
 */
export async function getTransactions(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<PlaidTransactionData[]> {
  const response = await plaidClient.transactionsGet({
    access_token: accessToken,
    start_date: startDate,
    end_date: endDate,
  });

  return response.data.transactions.map(transaction => ({
    transactionId: transaction.transaction_id,
    accountId: transaction.account_id,
    amount: transaction.amount,
    date: transaction.date,
    name: transaction.name,
    merchantName: transaction.merchant_name || null,
    category: transaction.category || null,
    categoryId: transaction.category_id || null,
    pending: transaction.pending,
    isoCurrencyCode: transaction.iso_currency_code || null,
  }));
}

/**
 * Sync transactions using cursor-based pagination
 * @param accessToken Plaid access token
 * @param cursor Optional cursor for pagination (omit for initial sync)
 * @returns Sync result with added, modified, removed transactions and next cursor
 */
export async function syncTransactions(
  accessToken: string,
  cursor?: string
): Promise<PlaidSyncResult> {
  const response = await plaidClient.transactionsSync({
    access_token: accessToken,
    cursor: cursor,
  });

  return {
    added: response.data.added.map(transaction => ({
      transactionId: transaction.transaction_id,
      accountId: transaction.account_id,
      amount: transaction.amount,
      date: transaction.date,
      name: transaction.name,
      merchantName: transaction.merchant_name || null,
      category: transaction.category || null,
      categoryId: transaction.category_id || null,
      pending: transaction.pending,
      isoCurrencyCode: transaction.iso_currency_code || null,
    })),
    modified: response.data.modified.map(transaction => ({
      transactionId: transaction.transaction_id,
      accountId: transaction.account_id,
      amount: transaction.amount,
      date: transaction.date,
      name: transaction.name,
      merchantName: transaction.merchant_name || null,
      category: transaction.category || null,
      categoryId: transaction.category_id || null,
      pending: transaction.pending,
      isoCurrencyCode: transaction.iso_currency_code || null,
    })),
    removed: response.data.removed.map(transaction => ({
      transactionId: transaction.transaction_id,
    })),
    nextCursor: response.data.next_cursor,
    hasMore: response.data.has_more,
  };
}

/**
 * Remove (revoke) a Plaid item
 * @param accessToken Plaid access token
 */
export async function removeItem(accessToken: string): Promise<void> {
  await plaidClient.itemRemove({
    access_token: accessToken,
  });
}

/**
 * Get item metadata
 * @param accessToken Plaid access token
 * @returns Item metadata including institution information
 */
export async function getItem(accessToken: string) {
  const response = await plaidClient.itemGet({
    access_token: accessToken,
  });

  return {
    itemId: response.data.item.item_id,
    institutionId: response.data.item.institution_id || null,
    webhook: response.data.item.webhook || null,
    error: response.data.item.error || null,
    availableProducts: response.data.item.available_products,
    billedProducts: response.data.item.billed_products,
  };
}
