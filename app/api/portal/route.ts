/**
 * Customer Portal API Route
 * Creates a Stripe billing portal session for subscription management
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/server';
import { stripePublicConfig } from '@/lib/stripe/config';
import { formatErrorResponse } from '@/lib/stripe/error-handler';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to continue.' },
        { status: 401 }
      );
    }

    // Get user's Stripe customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        {
          error: 'No billing account found. Please subscribe to a plan first.',
        },
        { status: 400 }
      );
    }

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${stripePublicConfig.appUrl}/dashboard/subscription`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);

    // Use error handler to format user-friendly response
    const errorResponse = formatErrorResponse(error);

    // Log severity for monitoring
    if (errorResponse.severity === 'critical') {
      console.error('CRITICAL portal error:', error);
    }

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
