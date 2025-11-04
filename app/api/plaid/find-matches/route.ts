/**
 * Find Account Matches API Route
 * Finds potential matches between manual and Plaid accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findAccountMatches } from '@/lib/plaid/account-matcher';

/**
 * GET /api/plaid/find-matches
 * Finds potential matches between manual and Plaid accounts for the current user
 *
 * Returns:
 * - matches: Array of AccountMatch objects sorted by match score
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in to continue.' }, { status: 401 });
    }

    // Fetch all accounts for the user
    const { data: accounts, error: fetchError } = await supabase
      .from('financial_accounts')
      .select('*')
      .eq('user_id', user.id);

    if (fetchError) {
      throw fetchError;
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // Separate manual and Plaid accounts
    const manualAccounts = accounts.filter((a) => a.is_manual);
    const plaidAccounts = accounts.filter((a) => !a.is_manual);

    // Find potential matches
    const matches = findAccountMatches(manualAccounts, plaidAccounts);

    // Return matches with limited data (don't expose internal fields)
    const safeMatches = matches.map((match) => ({
      manualAccount: {
        id: match.manualAccount.id,
        name: match.manualAccount.name,
        institution_name: match.manualAccount.institution_name,
        account_type: match.manualAccount.account_type,
        account_number_last4: match.manualAccount.account_number_last4,
        current_balance: match.manualAccount.current_balance,
      },
      plaidAccount: {
        id: match.plaidAccount.id,
        name: match.plaidAccount.name,
        institution_name: match.plaidAccount.institution_name,
        account_type: match.plaidAccount.account_type,
        account_number_last4: match.plaidAccount.account_number_last4,
        current_balance: match.plaidAccount.current_balance,
      },
      matchScore: match.matchScore,
      matchReasons: match.matchReasons,
    }));

    return NextResponse.json({ matches: safeMatches });
  } catch (error) {
    console.error('Error finding account matches:', error);

    return NextResponse.json({ error: 'Failed to find account matches. Please try again.' }, { status: 500 });
  }
}
