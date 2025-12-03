/**
 * Exchange Token API Route
 * Exchanges Plaid public token for access token and creates financial accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangePublicToken, getAccounts } from '@/lib/plaid/client';
import { storeAccessToken } from '@/lib/plaid/token-manager';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { AccountType } from '@/lib/types/database';
import { startHistoricalSync } from '@/lib/plaid/background-sync';

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
 * NOTE: fetchInitialHistoricalTransactions has been removed!
 *
 * Historical transaction syncing is now handled by the background sync system
 * in lib/plaid/background-sync.ts to prevent API route timeouts.
 *
 * The old implementation blocked the HTTP request for 10-30 seconds waiting
 * for 2 years of transactions to sync, exceeding Vercel's 30-second timeout.
 *
 * New flow:
 * 1. exchange-token returns immediately with syncId
 * 2. Background sync runs independently
 * 3. Frontend polls /api/plaid/sync-status for progress
 */

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

    // Start historical transaction sync in background
    // This returns immediately (< 500ms) while sync continues independently
    // Frontend will poll /api/plaid/sync-status/{itemId} for progress
    const { syncId } = await startHistoricalSync(
      user.id,
      itemId,
      accessToken
    );

    console.log(`✅ Account connected: ${itemId}. Background sync started: ${syncId}`);

    return NextResponse.json({
      success: true,
      itemId,
      accountCount: accounts.length,
      syncId,  // Frontend uses this to poll for status
      message: 'Account connected! Syncing transactions in background...',
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
