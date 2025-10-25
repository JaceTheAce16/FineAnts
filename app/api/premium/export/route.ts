/**
 * Export Data API Route (Premium Feature)
 * Example of a protected endpoint using feature access middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { withFeatureAccess } from '@/lib/middleware/feature-access';
import { createClient } from '@/lib/supabase/server';

/**
 * Export user's financial data to CSV
 * This endpoint is protected - only users with 'export_data' feature can access
 */
async function exportHandler(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's financial data
    const { data: accounts } = await supabase
      .from('financial_accounts')
      .select('*')
      .eq('user_id', user.id);

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .limit(1000); // Limit to last 1000 transactions

    const { data: budgets } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id);

    // Generate CSV data
    const csvData = {
      accounts: accounts || [],
      transactions: transactions || [],
      budgets: budgets || [],
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
    };

    // In a real implementation, you would:
    // 1. Convert data to CSV format
    // 2. Set appropriate headers for file download
    // 3. Return CSV file
    // For this example, we return JSON

    return NextResponse.json({
      success: true,
      message: 'Data export successful',
      data: csvData,
      recordCount: {
        accounts: accounts?.length || 0,
        transactions: transactions?.length || 0,
        budgets: budgets?.length || 0,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}

// Export the handler wrapped with feature access protection
export const POST = withFeatureAccess('export_data', exportHandler);

// Also protect GET requests
export const GET = withFeatureAccess('export_data', exportHandler);
