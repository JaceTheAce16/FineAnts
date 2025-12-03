/**
 * Plaid Sync Status Polling Endpoint
 *
 * GET /api/plaid/sync-status/[itemId]
 *
 * Returns the current status of a background transaction sync.
 * Frontend polls this endpoint every 2-3 seconds to show progress bar.
 *
 * Response format:
 * {
 *   status: 'pending' | 'syncing' | 'completed' | 'failed' | 'timeout',
 *   progress: 0-100,
 *   transactionCount: number,
 *   message: "User-friendly status message",
 *   estimatedTimeRemaining: number | undefined (seconds)
 * }
 *
 * Created: 2025-12-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSyncStatus, isSyncCompleted, isSyncFailed } from '@/lib/plaid/background-sync';

export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const itemId = params.itemId;

    if (!itemId) {
      return NextResponse.json(
        { error: 'Missing itemId parameter' },
        { status: 400 }
      );
    }

    // Verify that this item belongs to the authenticated user
    const { data: itemData, error: itemError } = await supabase
      .from('plaid_items')
      .select('user_id')
      .eq('item_id', itemId)
      .single();

    if (itemError || !itemData) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    if (itemData.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - item belongs to different user' },
        { status: 403 }
      );
    }

    // Get sync status
    const status = await getSyncStatus(itemId);

    if (!status) {
      return NextResponse.json(
        {
          status: 'unknown',
          progress: 0,
          transactionCount: 0,
          message: 'No sync status found',
        }
      );
    }

    // Return status with additional computed fields
    return NextResponse.json({
      ...status,
      isComplete: isSyncCompleted(status),
      isFailed: isSyncFailed(status),
    });

  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}
