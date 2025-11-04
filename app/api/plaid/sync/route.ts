/**
 * Sync API Route
 * Synchronizes account balances and transactions from Plaid
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncAccountBalances, syncUserTransactions } from '@/lib/plaid/sync-service';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to continue.' },
        { status: 401 }
      );
    }

    // Sync account balances and transactions in parallel
    const [balanceResult, transactionResult] = await Promise.allSettled([
      syncAccountBalances(user.id),
      syncUserTransactions(user.id),
    ]);

    // Extract results or errors
    const balances = balanceResult.status === 'fulfilled'
      ? balanceResult.value
      : null;

    const transactions = transactionResult.status === 'fulfilled'
      ? transactionResult.value
      : null;

    // Check if both syncs completely failed
    if (!balances && !transactions) {
      return NextResponse.json(
        {
          error: 'Sync failed. Please try again later.',
          details: {
            balanceError: balanceResult.status === 'rejected' ? balanceResult.reason?.message : null,
            transactionError: transactionResult.status === 'rejected' ? transactionResult.reason?.message : null,
          }
        },
        { status: 500 }
      );
    }

    // Return success with sync results
    // Even if one failed, we return success if the other succeeded
    return NextResponse.json({
      success: true,
      balances: balances || {
        itemsProcessed: 0,
        itemsSuccessful: 0,
        itemsFailed: 0,
        totalAccountsUpdated: 0,
        errors: [],
        results: [],
      },
      transactions: transactions || {
        itemsProcessed: 0,
        itemsSuccessful: 0,
        itemsFailed: 0,
        totalTransactionsAdded: 0,
        totalTransactionsModified: 0,
        totalTransactionsRemoved: 0,
        errors: [],
        results: [],
      },
      partialFailure: balanceResult.status === 'rejected' || transactionResult.status === 'rejected',
    });
  } catch (error) {
    console.error('Error syncing data:', error);

    // Return user-friendly error message
    return NextResponse.json(
      { error: 'Failed to sync account data. Please try again.' },
      { status: 500 }
    );
  }
}
