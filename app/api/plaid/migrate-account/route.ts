/**
 * Migrate Account API Route
 * Migrates a manual account to a Plaid-connected account
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

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
 * POST /api/plaid/migrate-account
 * Migrates a manual account to link with a Plaid account
 *
 * Request body:
 * - manualAccountId: ID of the manual account to migrate
 * - plaidAccountId: ID of the Plaid account to link with
 *
 * Process:
 * 1. Verify user owns both accounts
 * 2. Verify manual account is actually manual
 * 3. Verify Plaid account is actually Plaid-connected
 * 4. Delete the Plaid account record (we'll keep the manual one)
 * 5. Update manual account with Plaid connection details
 * 6. Update all transactions from the Plaid account to point to the manual account
 * 7. Preserve all historical manual transactions
 * 8. Begin syncing new Plaid transactions using the account's plaid_account_id
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { manualAccountId, plaidAccountId } = body;

    if (!manualAccountId || !plaidAccountId) {
      return NextResponse.json(
        { error: 'Missing required fields: manualAccountId and plaidAccountId are required.' },
        { status: 400 }
      );
    }

    // Fetch both accounts
    const { data: manualAccount, error: manualFetchError } = await supabaseAdmin
      .from('financial_accounts')
      .select('*')
      .eq('id', manualAccountId)
      .eq('user_id', user.id)
      .single();

    if (manualFetchError || !manualAccount) {
      return NextResponse.json({ error: 'Manual account not found or access denied.' }, { status: 404 });
    }

    const { data: plaidAccount, error: plaidFetchError } = await supabaseAdmin
      .from('financial_accounts')
      .select('*')
      .eq('id', plaidAccountId)
      .eq('user_id', user.id)
      .single();

    if (plaidFetchError || !plaidAccount) {
      return NextResponse.json({ error: 'Plaid account not found or access denied.' }, { status: 404 });
    }

    // Verify account types
    if (!manualAccount.is_manual) {
      return NextResponse.json(
        { error: 'The specified manual account is already Plaid-connected.' },
        { status: 400 }
      );
    }

    if (plaidAccount.is_manual) {
      return NextResponse.json(
        { error: 'The specified Plaid account is not Plaid-connected.' },
        { status: 400 }
      );
    }

    // Count existing transactions for both accounts
    const { count: manualTxnCount } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', manualAccountId);

    const { count: plaidTxnCount } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', plaidAccountId);

    // Update the manual account with Plaid connection details
    const { error: updateError } = await supabaseAdmin
      .from('financial_accounts')
      .update({
        is_manual: false,
        plaid_account_id: plaidAccount.plaid_account_id,
        plaid_item_id: plaidAccount.plaid_item_id,
        institution_name: plaidAccount.institution_name,
        account_number_last4: plaidAccount.account_number_last4,
        // Keep the manual account's name and balance (user may have customized)
        updated_at: new Date().toISOString(),
      })
      .eq('id', manualAccountId);

    if (updateError) {
      console.error('Error updating manual account:', updateError);
      throw new Error(`Failed to migrate account: ${updateError.message}`);
    }

    // Move all transactions from Plaid account to the manual account (now migrated)
    if (plaidTxnCount && plaidTxnCount > 0) {
      const { error: moveTxnError } = await supabaseAdmin
        .from('transactions')
        .update({
          account_id: manualAccountId,
          updated_at: new Date().toISOString(),
        })
        .eq('account_id', plaidAccountId);

      if (moveTxnError) {
        console.error('Error moving transactions:', moveTxnError);
        // Continue even if this fails - the account is already migrated
      }
    }

    // Delete the Plaid account record (it's now redundant)
    const { error: deleteError } = await supabaseAdmin
      .from('financial_accounts')
      .delete()
      .eq('id', plaidAccountId);

    if (deleteError) {
      console.error('Error deleting Plaid account:', deleteError);
      // Continue even if this fails - migration is complete
    }

    return NextResponse.json({
      success: true,
      message: 'Account successfully migrated',
      accountId: manualAccountId,
      transactionsPreserved: (manualTxnCount || 0) + (plaidTxnCount || 0),
    });
  } catch (error) {
    console.error('Error migrating account:', error);

    return NextResponse.json(
      { error: 'Failed to migrate account. Please try again.' },
      { status: 500 }
    );
  }
}
