/**
 * Link Token API Route
 * Creates a Plaid Link token for account connection or update mode
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLinkToken } from '@/lib/plaid/client';
import { Products, CountryCode } from 'plaid';

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

    // Parse request body (optional accessToken for update mode)
    const body = await request.json().catch(() => ({}));
    const { accessToken } = body;

    // Create link token
    const linkToken = await createLinkToken({
      userId: user.id,
      clientName: 'FineAnts',
      countryCodes: [CountryCode.Us],
      language: 'en',
      products: [Products.Auth, Products.Transactions],
      accessToken: accessToken, // undefined for new connections, present for update mode
    });

    return NextResponse.json({ linkToken });
  } catch (error) {
    console.error('Error creating link token:', error);

    // Return user-friendly error message
    return NextResponse.json(
      { error: 'Failed to create link token. Please try again.' },
      { status: 500 }
    );
  }
}
