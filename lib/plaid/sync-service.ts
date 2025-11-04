/**
 * Sync Service
 * Handles synchronization of account balances and transactions from Plaid
 */

import { createClient } from '@supabase/supabase-js';
import { getAccountBalances, syncTransactions } from './client';
import { getUserAccessTokens } from './token-manager';
import { mapPlaidCategoryToApp } from './category-mapper';
import { acquireSyncLock, releaseSyncLock } from './sync-lock';

/**
 * Create Supabase admin client (bypasses RLS)
 * Used for server-side operations
 */
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Result of syncing a single Plaid item
 */
interface ItemSyncResult {
  itemId: string;
  institutionName: string;
  success: boolean;
  accountsUpdated: number;
  error?: string;
}

/**
 * Result of syncing all accounts for a user
 */
export interface BalanceSyncResult {
  itemsProcessed: number;
  itemsSuccessful: number;
  itemsFailed: number;
  totalAccountsUpdated: number;
  errors: Array<{ itemId: string; error: string }>;
  results: ItemSyncResult[];
}

/**
 * Sync account balances for all of a user's connected Plaid items
 * @param userId User ID
 * @returns Summary of sync results
 */
export async function syncAccountBalances(
  userId: string
): Promise<BalanceSyncResult> {
  // Acquire sync lock to prevent concurrent balance syncs
  const lock = await acquireSyncLock(userId, 'balance_sync');

  if (!lock.acquired) {
    // Sync already in progress - return early
    return {
      itemsProcessed: 0,
      itemsSuccessful: 0,
      itemsFailed: 0,
      totalAccountsUpdated: 0,
      errors: [{ itemId: 'N/A', error: lock.message || 'Sync already in progress' }],
      results: [],
    };
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const results: ItemSyncResult[] = [];
    const errors: Array<{ itemId: string; error: string }> = [];

    // Get all active access tokens for the user
    const tokens = await getUserAccessTokens(userId);

    if (tokens.length === 0) {
      return {
        itemsProcessed: 0,
        itemsSuccessful: 0,
        itemsFailed: 0,
        totalAccountsUpdated: 0,
        errors: [],
        results: [],
      };
    }

    // Sync each item separately, continuing even if some fail
    for (const token of tokens) {
      try {
        // Fetch fresh balances from Plaid
        const accounts = await getAccountBalances(token.accessToken);

        let accountsUpdated = 0;

        // Update each account in the database
        for (const account of accounts) {
          try {
            // Update financial_accounts table
            const { error: updateError } = await supabaseAdmin
              .from('financial_accounts')
              .update({
                current_balance: account.balances.current,
                available_balance: account.balances.available,
                updated_at: new Date().toISOString(),
              })
              .eq('plaid_account_id', account.accountId)
              .eq('plaid_item_id', token.itemId);

            if (updateError) {
              console.error(
                `Failed to update account ${account.accountId}:`,
                updateError
              );
              // Continue with other accounts even if one fails
              continue;
            }

            accountsUpdated++;
          } catch (accountError) {
            console.error(
              `Error updating account ${account.accountId}:`,
              accountError
            );
            // Continue with other accounts
          }
        }

        // Update last_sync timestamp in plaid_items table
        await supabaseAdmin
          .from('plaid_items')
          .update({
            last_sync: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('item_id', token.itemId);

        results.push({
          itemId: token.itemId,
          institutionName: token.institutionName,
          success: true,
          accountsUpdated,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        console.error(`Failed to sync item ${token.itemId}:`, error);

        results.push({
          itemId: token.itemId,
          institutionName: token.institutionName,
          success: false,
          accountsUpdated: 0,
          error: errorMessage,
        });

        errors.push({
          itemId: token.itemId,
          error: errorMessage,
        });

        // Mark item as error in database if sync failed
        await supabaseAdmin
          .from('plaid_items')
          .update({
            status: 'error',
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('item_id', token.itemId);
      }
    }

    // Calculate summary statistics
    const itemsSuccessful = results.filter((r) => r.success).length;
    const totalAccountsUpdated = results.reduce(
      (sum, r) => sum + r.accountsUpdated,
      0
    );

    return {
      itemsProcessed: tokens.length,
      itemsSuccessful,
      itemsFailed: errors.length,
      totalAccountsUpdated,
      errors,
      results,
    };
  } finally {
    // Always release lock, even if sync fails
    if (lock.lockId) {
      await releaseSyncLock(lock.lockId);
    }
  }
}

/**
 * Sync account balances for a specific Plaid item
 * @param itemId Plaid item ID
 * @returns Sync result for the item
 */
export async function syncItemBalances(
  itemId: string
): Promise<ItemSyncResult> {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    // Get item details including access token
    const { data: itemData, error: itemError } = await supabaseAdmin
      .from('plaid_items')
      .select('access_token, institution_name')
      .eq('item_id', itemId)
      .eq('status', 'active')
      .single();

    if (itemError || !itemData) {
      throw new Error(`Item not found or not active: ${itemId}`);
    }

    // Import decryptToken here to avoid circular dependency issues
    const { decryptToken } = await import('./token-manager');
    const accessToken = decryptToken(itemData.access_token);

    // Fetch fresh balances from Plaid
    const accounts = await getAccountBalances(accessToken);

    let accountsUpdated = 0;

    // Update each account in the database
    for (const account of accounts) {
      try {
        const { error: updateError } = await supabaseAdmin
          .from('financial_accounts')
          .update({
            current_balance: account.balances.current,
            available_balance: account.balances.available,
            updated_at: new Date().toISOString(),
          })
          .eq('plaid_account_id', account.accountId)
          .eq('plaid_item_id', itemId);

        if (!updateError) {
          accountsUpdated++;
        }
      } catch (accountError) {
        console.error(
          `Error updating account ${account.accountId}:`,
          accountError
        );
      }
    }

    // Update last_sync timestamp
    await supabaseAdmin
      .from('plaid_items')
      .update({
        last_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('item_id', itemId);

    return {
      itemId,
      institutionName: itemData.institution_name,
      success: true,
      accountsUpdated,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Mark item as error
    await supabaseAdmin
      .from('plaid_items')
      .update({
        status: 'error',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('item_id', itemId);

    return {
      itemId,
      institutionName: 'Unknown',
      success: false,
      accountsUpdated: 0,
      error: errorMessage,
    };
  }
}

/**
 * Result of syncing transactions for a single Plaid item
 */
interface TransactionSyncResult {
  itemId: string;
  institutionName: string;
  success: boolean;
  transactionsAdded: number;
  transactionsModified: number;
  transactionsRemoved: number;
  error?: string;
}

/**
 * Result of syncing transactions for all user items
 */
export interface TransactionsSyncResult {
  itemsProcessed: number;
  itemsSuccessful: number;
  itemsFailed: number;
  totalTransactionsAdded: number;
  totalTransactionsModified: number;
  totalTransactionsRemoved: number;
  errors: Array<{ itemId: string; error: string }>;
  results: TransactionSyncResult[];
}

/**
 * Upsert a transaction into the database
 * @param supabase Supabase admin client
 * @param userId User ID
 * @param accountId Financial account ID (internal)
 * @param transaction Transaction data from Plaid
 */
async function upsertTransaction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  accountId: string,
  transaction: {
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
): Promise<void> {
  // Map Plaid category to app category
  const appCategory = mapPlaidCategoryToApp(transaction.category);

  // Check if transaction already exists
  const { data: existingTransaction } = await supabase
    .from('transactions')
    .select('id')
    .eq('plaid_transaction_id', transaction.transactionId)
    .single();

  if (existingTransaction) {
    // Update existing transaction
    await supabase
      .from('transactions')
      .update({
        amount: transaction.amount,
        description: transaction.merchantName || transaction.name,
        category: appCategory,
        transaction_date: transaction.date,
        is_pending: transaction.pending,
        updated_at: new Date().toISOString(),
      })
      .eq('plaid_transaction_id', transaction.transactionId);
  } else {
    // Insert new transaction
    await supabase.from('transactions').insert({
      user_id: userId,
      account_id: accountId,
      amount: transaction.amount,
      description: transaction.merchantName || transaction.name,
      category: appCategory,
      transaction_date: transaction.date,
      is_pending: transaction.pending,
      plaid_transaction_id: transaction.transactionId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}

/**
 * Sync transactions for all of a user's connected Plaid items
 * @param userId User ID
 * @returns Summary of sync results
 */
export async function syncUserTransactions(
  userId: string
): Promise<TransactionsSyncResult> {
  // Acquire sync lock to prevent concurrent transaction syncs
  const lock = await acquireSyncLock(userId, 'transaction_sync');

  if (!lock.acquired) {
    // Sync already in progress - return early
    return {
      itemsProcessed: 0,
      itemsSuccessful: 0,
      itemsFailed: 0,
      totalTransactionsAdded: 0,
      totalTransactionsModified: 0,
      totalTransactionsRemoved: 0,
      errors: [{ itemId: 'N/A', error: lock.message || 'Sync already in progress' }],
      results: [],
    };
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const results: TransactionSyncResult[] = [];
    const errors: Array<{ itemId: string; error: string }> = [];

    // Get all active access tokens for the user
    const tokens = await getUserAccessTokens(userId);

    if (tokens.length === 0) {
      return {
        itemsProcessed: 0,
        itemsSuccessful: 0,
        itemsFailed: 0,
        totalTransactionsAdded: 0,
        totalTransactionsModified: 0,
        totalTransactionsRemoved: 0,
        errors: [],
        results: [],
      };
    }

    // Sync each item separately
    for (const token of tokens) {
      try {
        // Get current cursor from database
        const { data: itemData } = await supabaseAdmin
          .from('plaid_items')
          .select('transactions_cursor')
          .eq('item_id', token.itemId)
          .single();

        let cursor = itemData?.transactions_cursor || undefined;
        let hasMore = true;
        let transactionsAdded = 0;
        let transactionsModified = 0;
        let transactionsRemoved = 0;

        // Keep syncing until no more transactions
        while (hasMore) {
          const syncResult = await syncTransactions(token.accessToken, cursor);

          // Get account mapping (Plaid account ID -> internal account ID)
          const { data: accounts } = await supabaseAdmin
            .from('financial_accounts')
            .select('id, plaid_account_id')
            .eq('plaid_item_id', token.itemId);

          const accountMap = new Map(
            accounts?.map((a) => [a.plaid_account_id, a.id]) || []
          );

          // Process added transactions
          for (const transaction of syncResult.added) {
            const internalAccountId = accountMap.get(transaction.accountId);
            if (internalAccountId) {
              await upsertTransaction(
                supabaseAdmin,
                userId,
                internalAccountId,
                transaction
              );
              transactionsAdded++;
            }
          }

          // Process modified transactions
          for (const transaction of syncResult.modified) {
            const internalAccountId = accountMap.get(transaction.accountId);
            if (internalAccountId) {
              await upsertTransaction(
                supabaseAdmin,
                userId,
                internalAccountId,
                transaction
              );
              transactionsModified++;
            }
          }

          // Process removed transactions
          for (const removedTxn of syncResult.removed) {
            await supabaseAdmin
              .from('transactions')
              .delete()
              .eq('plaid_transaction_id', removedTxn.transactionId);
            transactionsRemoved++;
          }

          // Update cursor and hasMore flag
          cursor = syncResult.nextCursor;
          hasMore = syncResult.hasMore;
        }

        // Update cursor in database
        await supabaseAdmin
          .from('plaid_items')
          .update({
            transactions_cursor: cursor,
            last_sync: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('item_id', token.itemId);

        results.push({
          itemId: token.itemId,
          institutionName: token.institutionName,
          success: true,
          transactionsAdded,
          transactionsModified,
          transactionsRemoved,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        console.error(`Failed to sync transactions for item ${token.itemId}:`, error);

        results.push({
          itemId: token.itemId,
          institutionName: token.institutionName,
          success: false,
          transactionsAdded: 0,
          transactionsModified: 0,
          transactionsRemoved: 0,
          error: errorMessage,
        });

        errors.push({
          itemId: token.itemId,
          error: errorMessage,
        });

        // Mark item as error
        await supabaseAdmin
          .from('plaid_items')
          .update({
            status: 'error',
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('item_id', token.itemId);
      }
    }

    // Calculate summary statistics
    const itemsSuccessful = results.filter((r) => r.success).length;
    const totalTransactionsAdded = results.reduce(
      (sum, r) => sum + r.transactionsAdded,
      0
    );
    const totalTransactionsModified = results.reduce(
      (sum, r) => sum + r.transactionsModified,
      0
    );
    const totalTransactionsRemoved = results.reduce(
      (sum, r) => sum + r.transactionsRemoved,
      0
    );

    return {
      itemsProcessed: tokens.length,
      itemsSuccessful,
      itemsFailed: errors.length,
      totalTransactionsAdded,
      totalTransactionsModified,
      totalTransactionsRemoved,
      errors,
      results,
    };
  } finally {
    // Always release lock, even if sync fails
    if (lock.lockId) {
      await releaseSyncLock(lock.lockId);
    }
  }
}
