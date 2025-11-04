/**
 * Disconnect API Route
 * Disconnects a Plaid item and removes associated accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAccessToken, revokeAccessToken } from '@/lib/plaid/token-manager';
import { removeItem } from '@/lib/plaid/client';
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
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json(
        { error: 'Missing required field: itemId is required.' },
        { status: 400 }
      );
    }

    // Verify that the item belongs to the user
    const { data: itemData, error: itemError } = await supabaseAdmin
      .from('plaid_items')
      .select('user_id')
      .eq('item_id', itemId)
      .single();

    if (itemError || !itemData) {
      return NextResponse.json(
        { error: 'Plaid item not found.' },
        { status: 404 }
      );
    }

    if (itemData.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized. You do not have permission to disconnect this item.' },
        { status: 403 }
      );
    }

    // Get access token
    const accessToken = await getAccessToken(itemId);

    // Remove item from Plaid (if access token exists)
    if (accessToken) {
      try {
        await removeItem(accessToken);
      } catch (plaidError) {
        // Log error but continue with cleanup
        // The item might already be removed or invalid
        console.error('Error removing item from Plaid:', plaidError);
      }
    }

    // Revoke access token in database
    await revokeAccessToken(itemId);

    // Delete associated financial accounts
    const { error: deleteError } = await supabaseAdmin
      .from('financial_accounts')
      .delete()
      .eq('plaid_item_id', itemId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting financial accounts:', deleteError);
      throw new Error(`Failed to delete accounts: ${deleteError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Account disconnected successfully.',
    });
  } catch (error) {
    console.error('Error disconnecting account:', error);

    // Return user-friendly error message
    return NextResponse.json(
      { error: 'Failed to disconnect account. Please try again.' },
      { status: 500 }
    );
  }
}
