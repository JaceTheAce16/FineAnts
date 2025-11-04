/**
 * Exchange Token API Route
 * Exchanges Plaid public token for access token and creates financial accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangePublicToken, getAccounts, syncTransactions } from '@/lib/plaid/client';
import { storeAccessToken } from '@/lib/plaid/token-manager';
import { mapPlaidCategoryToApp } from '@/lib/plaid/category-mapper';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { AccountType } from '@/lib/types/database';

const supabaseAdmin = createAdminClient(
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
 * Map Plaid account type and subtype to app AccountType
 *
 * Handles all common Plaid account types including:
 * - Depository accounts (checking, savings, HSA, CD, money market, etc.)
 * - Credit accounts (credit cards, lines of credit)
 * - Investment accounts (brokerage, 401k, IRA, etc.)
 * - Loan accounts (mortgage, student, auto, personal, etc.)
 *
 * @param type - Plaid account type (depository, credit, investment, loan, etc.)
 * @param subtype - Plaid account subtype (checking, savings, credit card, etc.)
 * @returns AccountType enum value
 */
export function mapPlaidAccountType(type: string, subtype: string | null): AccountType {
  // Handle null or undefined type
  if (!type) {
    return 'other';
  }

  // Normalize to lowercase for consistent matching
  const normalizedType = type.toLowerCase();
  const normalizedSubtype = subtype?.toLowerCase() || '';

  // DEPOSITORY ACCOUNTS
  if (normalizedType === 'depository') {
    if (normalizedSubtype === 'checking') return 'checking';
    if (normalizedSubtype === 'savings') return 'savings';
    if (normalizedSubtype === 'hsa') return 'savings'; // Health Savings Account
    if (normalizedSubtype === 'cd') return 'savings'; // Certificate of Deposit
    if (normalizedSubtype === 'money market') return 'savings';
    if (normalizedSubtype === 'paypal') return 'checking';
    if (normalizedSubtype === 'prepaid') return 'checking';
    if (normalizedSubtype === 'cash management') return 'checking';
    if (normalizedSubtype === 'ebt') return 'checking'; // Electronic Benefit Transfer
    return 'checking'; // Default depository to checking
  }

  // CREDIT ACCOUNTS
  if (normalizedType === 'credit') {
    if (normalizedSubtype === 'credit card') return 'credit_card';
    if (normalizedSubtype === 'paypal') return 'credit_card';
    if (normalizedSubtype === 'line of credit') return 'credit_card';
    return 'credit_card'; // Default credit to credit_card
  }

  // INVESTMENT ACCOUNTS
  if (normalizedType === 'investment') {
    // Retirement accounts
    if (normalizedSubtype === '401k') return 'retirement';
    if (normalizedSubtype === '403b') return 'retirement';
    if (normalizedSubtype === '401a') return 'retirement';
    if (normalizedSubtype === '457b') return 'retirement';
    if (normalizedSubtype === 'ira') return 'retirement';
    if (normalizedSubtype === 'roth') return 'retirement';
    if (normalizedSubtype === 'roth 401k') return 'retirement';
    if (normalizedSubtype === 'roth ira') return 'retirement';
    if (normalizedSubtype === 'sep ira') return 'retirement';
    if (normalizedSubtype === 'simple ira') return 'retirement';
    if (normalizedSubtype === 'sarsep') return 'retirement';
    if (normalizedSubtype === 'pension') return 'retirement';
    if (normalizedSubtype === 'profit sharing plan') return 'retirement';
    if (normalizedSubtype === 'stock plan') return 'retirement';
    if (normalizedSubtype === 'keogh') return 'retirement';
    if (normalizedSubtype === 'retirement') return 'retirement';

    // Canadian retirement accounts
    if (normalizedSubtype === 'rrsp') return 'retirement'; // Registered Retirement Savings Plan
    if (normalizedSubtype === 'rrif') return 'retirement'; // Registered Retirement Income Fund
    if (normalizedSubtype === 'tfsa') return 'retirement'; // Tax-Free Savings Account
    if (normalizedSubtype === 'lira') return 'retirement'; // Locked-In Retirement Account
    if (normalizedSubtype === 'lif') return 'retirement'; // Life Income Fund
    if (normalizedSubtype === 'lrsp') return 'retirement'; // Locked-In Retirement Savings Plan
    if (normalizedSubtype === 'lrif') return 'retirement'; // Locked-In Retirement Income Fund
    if (normalizedSubtype === 'rlif') return 'retirement'; // Restricted Life Income Fund
    if (normalizedSubtype === 'prif') return 'retirement'; // Prescribed Retirement Income Fund
    if (normalizedSubtype === 'rdsp') return 'retirement'; // Registered Disability Savings Plan
    if (normalizedSubtype === 'resp') return 'retirement'; // Registered Education Savings Plan

    // UK retirement accounts
    if (normalizedSubtype === 'sipp') return 'retirement'; // Self-Invested Personal Pension

    // Investment/brokerage accounts (non-retirement)
    if (normalizedSubtype === 'brokerage') return 'investment';
    if (normalizedSubtype === '529') return 'investment'; // Education savings
    if (normalizedSubtype === 'education savings account') return 'investment';
    if (normalizedSubtype === 'mutual fund') return 'investment';
    if (normalizedSubtype === 'trust') return 'investment';
    if (normalizedSubtype === 'ugma') return 'investment'; // Uniform Gifts to Minors Act
    if (normalizedSubtype === 'utma') return 'investment'; // Uniform Transfers to Minors Act
    if (normalizedSubtype === 'non-taxable brokerage account') return 'investment';
    if (normalizedSubtype === 'fixed annuity') return 'investment';
    if (normalizedSubtype === 'variable annuity') return 'investment';
    if (normalizedSubtype === 'cash isa') return 'investment'; // Individual Savings Account
    if (normalizedSubtype === 'isa') return 'investment';
    if (normalizedSubtype === 'gic') return 'investment'; // Guaranteed Investment Certificate
    if (normalizedSubtype === 'health reimbursement arrangement') return 'investment';
    if (normalizedSubtype === 'hsa') return 'investment'; // Investment HSA

    // Default investment to investment
    return 'investment';
  }

  // LOAN ACCOUNTS
  if (normalizedType === 'loan') {
    if (normalizedSubtype === 'mortgage') return 'mortgage';
    if (normalizedSubtype === 'home equity') return 'mortgage';
    if (normalizedSubtype === 'student') return 'loan';
    if (normalizedSubtype === 'auto') return 'loan';
    if (normalizedSubtype === 'personal') return 'loan';
    if (normalizedSubtype === 'commercial') return 'loan';
    if (normalizedSubtype === 'construction') return 'loan';
    if (normalizedSubtype === 'business') return 'loan';
    if (normalizedSubtype === 'consumer') return 'loan';
    if (normalizedSubtype === 'line of credit') return 'loan';
    if (normalizedSubtype === 'loan') return 'loan';
    if (normalizedSubtype === 'overdraft') return 'loan';
    if (normalizedSubtype === 'other') return 'loan';
    return 'loan'; // Default loan to loan
  }

  // BROKERAGE (legacy Plaid type)
  if (normalizedType === 'brokerage') {
    return 'investment';
  }

  // OTHER/UNKNOWN TYPES
  return 'other';
}

/**
 * Fetch and store initial historical transactions for a newly connected account
 * Uses cursor-based sync to retrieve up to 2 years of transaction history
 */
async function fetchInitialHistoricalTransactions(
  userId: string,
  itemId: string,
  accessToken: string
): Promise<{ transactionCount: number; error?: string }> {
  try {
    let cursor: string | undefined = undefined;
    let hasMore = true;
    let totalTransactions = 0;
    let iterationCount = 0;
    const MAX_ITERATIONS = 50; // Prevent infinite loops (safety limit)

    console.log(`Starting historical transaction fetch for item ${itemId}`);

    // Use cursor-based sync to fetch all available historical transactions
    while (hasMore && iterationCount < MAX_ITERATIONS) {
      iterationCount++;

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
            console.error('Error inserting transactions:', insertError);
            // Continue processing even if some transactions fail
          } else {
            totalTransactions += transactionInserts.length;
            console.log(`Inserted ${transactionInserts.length} transactions (batch ${iterationCount})`);
          }
        }
      }

      // Update cursor for next iteration
      cursor = syncResult.nextCursor;
      hasMore = syncResult.hasMore;

      console.log(
        `Sync iteration ${iterationCount}: Added ${syncResult.added.length} transactions, hasMore: ${hasMore}`
      );
    }

    // Store the final cursor in plaid_items table for future syncs
    await supabaseAdmin
      .from('plaid_items')
      .update({
        transactions_cursor: cursor,
        last_sync: new Date().toISOString(),
      })
      .eq('item_id', itemId);

    console.log(
      `Historical transaction fetch complete for item ${itemId}: ${totalTransactions} transactions in ${iterationCount} iterations`
    );

    return { transactionCount: totalTransactions };
  } catch (error) {
    console.error('Error fetching historical transactions:', error);
    return {
      transactionCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

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

    // Parse and validate request body
    const body = await request.json();
    const { publicToken, institutionId, institutionName } = body;

    if (!publicToken || !institutionId || !institutionName) {
      return NextResponse.json(
        { error: 'Missing required fields: publicToken, institutionId, and institutionName are required.' },
        { status: 400 }
      );
    }

    // Exchange public token for access token
    const { accessToken, itemId } = await exchangePublicToken(publicToken);

    // Store encrypted access token
    await storeAccessToken(user.id, itemId, accessToken, institutionId, institutionName);

    // Fetch accounts from Plaid
    const accounts = await getAccounts(accessToken);

    // Store accounts in database
    const accountInserts = accounts.map((account) => ({
      user_id: user.id,
      name: account.name,
      account_type: mapPlaidAccountType(account.type, account.subtype),
      institution_name: institutionName,
      account_number_last4: account.mask || 'N/A',
      current_balance: account.balances.current || 0,
      available_balance: account.balances.available || null,
      currency: account.balances.isoCurrencyCode || 'USD',
      is_manual: false,
      plaid_account_id: account.accountId,
      plaid_item_id: itemId,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('financial_accounts')
      .insert(accountInserts);

    if (insertError) {
      console.error('Error inserting accounts:', insertError);
      throw new Error(`Failed to store accounts: ${insertError.message}`);
    }

    // Fetch initial historical transactions (up to 2 years)
    // This is done asynchronously - we don't wait for completion to return the response
    // The transactions will be available shortly after account connection
    const historicalResult = await fetchInitialHistoricalTransactions(
      user.id,
      itemId,
      accessToken
    );

    return NextResponse.json({
      success: true,
      itemId,
      accountCount: accounts.length,
      transactionCount: historicalResult.transactionCount,
      transactionFetchError: historicalResult.error,
    });
  } catch (error) {
    console.error('Error exchanging token:', error);

    // Return user-friendly error message
    return NextResponse.json(
      { error: 'Failed to connect account. Please try again.' },
      { status: 500 }
    );
  }
}
