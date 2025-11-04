/**
 * API Route: Check Plaid Account Limit
 * Returns current account count and limit based on user's subscription tier
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkPlaidAccountLimit } from '@/lib/subscription/access-control';

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limitInfo = await checkPlaidAccountLimit();

    return NextResponse.json(limitInfo);
  } catch (error) {
    console.error('Error checking account limit:', error);
    return NextResponse.json(
      { error: 'Failed to check account limit' },
      { status: 500 }
    );
  }
}
