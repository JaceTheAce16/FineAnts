/**
 * Background Sync System for Plaid Transactions
 *
 * Solves the critical timeout issue where initial historical transaction
 * syncs (2 years of data) can take 10-30 seconds, exceeding Vercel's
 * 30-second API route timeout.
 *
 * Architecture:
 * 1. exchange-token endpoint starts sync job and returns immediately
 * 2. Sync runs in "background" (actually a fire-and-forget promise)
 * 3. Frontend polls sync-status endpoint for progress
 * 4. Status stored in plaid_items table
 *
 * Created: 2025-12-02
 */

import { createClient } from '@supabase/supabase-js';
import { syncTransactions } from './client';
import { mapPlaidCategoryToApp } from './category-mapper';
import { trackPlaidError } from '@/lib/monitoring/error-tracker';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Sync status enum
 */
export type SyncStatus =
  | 'pending'     // Job queued, not started
  | 'syncing'     // Currently syncing
  | 'completed'   // Sync finished successfully
  | 'failed'      // Sync failed
  | 'timeout';    // Sync exceeded max time

/**
 * Sync progress information
 */
export interface SyncProgress {
  status: SyncStatus;
  progress: number;           // 0-100
  transactionCount: number;   // Transactions synced so far
  message: string;            // User-friendly status message
  error?: string;             // Error message if failed
  startedAt?: string;         // ISO timestamp
  completedAt?: string;       // ISO timestamp
  estimatedTimeRemaining?: number; // Seconds (calculated)
}

/**
 * Start background sync for initial historical transactions
 * Returns immediately while sync continues in background
 */
export async function startHistoricalSync(
  userId: string,
  itemId: string,
  accessToken: string
): Promise<{ syncId: string }> {
  console.log(`[Background Sync] Starting for item ${itemId}`);

  // Update status to 'pending'
  await updateSyncStatus(itemId, {
    status: 'pending',
    progress: 0,
    transactionCount: 0,
    message: 'Preparing to sync transactions...',
    startedAt: new Date().toISOString(),
  });

  // Start sync in background (fire-and-forget)
  // Don't await - let it run independently
  runHistoricalSync(userId, itemId, accessToken)
    .catch((error) => {
      console.error(`[Background Sync] Fatal error for item ${itemId}:`, error);
      // Last-resort error handling
      updateSyncStatus(itemId, {
        status: 'failed',
        progress: 0,
        transactionCount: 0,
        message: 'Sync failed unexpectedly',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date().toISOString(),
      });
    });

  return { syncId: itemId };
}

/**
 * Actually run the sync (called by startHistoricalSync)
 * This is the long-running operation
 */
async function runHistoricalSync(
  userId: string,
  itemId: string,
  accessToken: string
): Promise<void> {
  const startTime = Date.now();
  const MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes max (safety limit)

  try {
    // Update to 'syncing'
    await updateSyncStatus(itemId, {
      status: 'syncing',
      progress: 5,
      transactionCount: 0,
      message: 'Fetching transactions from your bank...',
    });

    let cursor: string | undefined = undefined;
    let hasMore = true;
    let totalTransactions = 0;
    let iterationCount = 0;
    const MAX_ITERATIONS = 50; // Safety limit

    // Cursor-based sync loop (same as original, but with progress updates)
    while (hasMore && iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      // Check if we've exceeded max duration
      if (Date.now() - startTime > MAX_DURATION_MS) {
        console.warn(`[Background Sync] Timeout after ${iterationCount} iterations`);
        await updateSyncStatus(itemId, {
          status: 'timeout',
          progress: 90,
          transactionCount: totalTransactions,
          message: 'Sync taking longer than expected. Will retry automatically.',
          completedAt: new Date().toISOString(),
        });
        return;
      }

      // Fetch batch of transactions
      const syncResult = await syncTransactions(accessToken, cursor);

      // Process added transactions
      if (syncResult.added.length > 0) {
        const transactionInserts = [];

        for (const plaidTxn of syncResult.added) {
          // Get the account_id from financial_accounts table
          const { data: accountData } = await supabaseAdmin
            .from('financial_accounts')
            .select('id')
            .eq('plaid_account_id', plaidTxn.accountId)
            .eq('user_id', userId)
            .single();

          if (!accountData) {
            console.warn(`Account not found for plaid_account_id: ${plaidTxn.accountId}`);
            continue;
          }

          const category = mapPlaidCategoryToApp(plaidTxn.category);

          transactionInserts.push({
            user_id: userId,
            account_id: accountData.id,
            plaid_transaction_id: plaidTxn.transactionId,
            amount: plaidTxn.amount,
            description: plaidTxn.name,
            category: category,
            transaction_date: plaidTxn.date,
            is_pending: plaidTxn.pending,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        // Batch insert transactions
        if (transactionInserts.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('transactions')
            .insert(transactionInserts);

          if (insertError) {
            console.error('[Background Sync] Error inserting transactions:', insertError);
            // Continue processing even if some transactions fail
          } else {
            totalTransactions += transactionInserts.length;

            // Update progress (estimate based on iterations)
            // Most syncs complete in 5-15 iterations
            const estimatedProgress = Math.min(95, 5 + (iterationCount * 6));

            await updateSyncStatus(itemId, {
              status: 'syncing',
              progress: estimatedProgress,
              transactionCount: totalTransactions,
              message: `Syncing transactions... (${totalTransactions} found)`,
            });
          }
        }
      }

      // Update cursor for next iteration
      cursor = syncResult.nextCursor;
      hasMore = syncResult.hasMore;

      console.log(
        `[Background Sync] Iteration ${iterationCount}: Added ${syncResult.added.length} transactions, hasMore: ${hasMore}`
      );
    }

    // Store the final cursor in plaid_items table
    await supabaseAdmin
      .from('plaid_items')
      .update({
        transactions_cursor: cursor,
        last_sync: new Date().toISOString(),
      })
      .eq('item_id', itemId);

    // Mark as completed
    await updateSyncStatus(itemId, {
      status: 'completed',
      progress: 100,
      transactionCount: totalTransactions,
      message: totalTransactions > 0
        ? `Successfully synced ${totalTransactions} transactions!`
        : 'Account connected! No transactions found.',
      completedAt: new Date().toISOString(),
    });

    console.log(
      `[Background Sync] Completed for item ${itemId}: ${totalTransactions} transactions in ${iterationCount} iterations`
    );

  } catch (error) {
    console.error('[Background Sync] Error:', error);

    // Track error
    trackPlaidError(error, {
      userId,
      itemId,
      operation: 'sync',
    });

    // Mark as failed
    await updateSyncStatus(itemId, {
      status: 'failed',
      progress: 0,
      transactionCount: 0,
      message: 'Failed to sync transactions. Please try again.',
      error: error instanceof Error ? error.message : 'Unknown error',
      completedAt: new Date().toISOString(),
    });
  }
}

/**
 * Update sync status in database
 * Stores progress in plaid_items table
 */
async function updateSyncStatus(
  itemId: string,
  progress: Partial<SyncProgress>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('plaid_items')
    .update({
      sync_status: progress.status,
      sync_progress: progress.progress,
      sync_transaction_count: progress.transactionCount,
      sync_message: progress.message,
      sync_error: progress.error || null,
      sync_started_at: progress.startedAt,
      sync_completed_at: progress.completedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('item_id', itemId);

  if (error) {
    console.error('[Background Sync] Error updating status:', error);
  }
}

/**
 * Get current sync status for an item
 */
export async function getSyncStatus(itemId: string): Promise<SyncProgress | null> {
  const { data, error } = await supabaseAdmin
    .from('plaid_items')
    .select(
      'sync_status, sync_progress, sync_transaction_count, sync_message, sync_error, sync_started_at, sync_completed_at'
    )
    .eq('item_id', itemId)
    .single();

  if (error || !data) {
    return null;
  }

  // Calculate estimated time remaining (rough estimate)
  let estimatedTimeRemaining: number | undefined;
  if (data.sync_status === 'syncing' && data.sync_started_at) {
    const elapsed = Date.now() - new Date(data.sync_started_at).getTime();
    const elapsedSeconds = elapsed / 1000;
    const progress = data.sync_progress || 0;

    if (progress > 10) {
      // Estimate based on current progress
      const estimatedTotal = (elapsedSeconds / progress) * 100;
      estimatedTimeRemaining = Math.max(0, Math.ceil(estimatedTotal - elapsedSeconds));
    } else {
      // Early stage - use generic estimate
      estimatedTimeRemaining = 20; // 20 seconds average
    }
  }

  return {
    status: (data.sync_status as SyncStatus) || 'pending',
    progress: data.sync_progress || 0,
    transactionCount: data.sync_transaction_count || 0,
    message: data.sync_message || 'Syncing...',
    error: data.sync_error,
    startedAt: data.sync_started_at,
    completedAt: data.sync_completed_at,
    estimatedTimeRemaining,
  };
}

/**
 * Check if sync is still in progress
 */
export function isSyncInProgress(status: SyncProgress | null): boolean {
  if (!status) return false;
  return status.status === 'pending' || status.status === 'syncing';
}

/**
 * Check if sync completed successfully
 */
export function isSyncCompleted(status: SyncProgress | null): boolean {
  if (!status) return false;
  return status.status === 'completed';
}

/**
 * Check if sync failed
 */
export function isSyncFailed(status: SyncProgress | null): boolean {
  if (!status) return false;
  return status.status === 'failed' || status.status === 'timeout';
}

// =============================================================================
// DATABASE SCHEMA UPDATES NEEDED
// =============================================================================

/**
 * Add these columns to your plaid_items table:
 *
 * ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_status TEXT;
 * ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_progress INTEGER DEFAULT 0;
 * ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_transaction_count INTEGER DEFAULT 0;
 * ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_message TEXT;
 * ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_error TEXT;
 * ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_started_at TIMESTAMPTZ;
 * ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_completed_at TIMESTAMPTZ;
 *
 * Or run the migration script that will be created.
 */
