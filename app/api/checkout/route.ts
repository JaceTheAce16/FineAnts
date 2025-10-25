/**
 * Checkout Session API Route
 * Creates a Stripe Checkout session for subscription purchase
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { getOrCreateStripeCustomer } from '@/lib/stripe/client';
import { SUBSCRIPTION_PLANS, isValidPlanType, type PlanType } from '@/lib/stripe/products';
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

    // Parse request body
    const body = await request.json();
    const { priceId, planType } = body;

    // Validate plan type
    if (!planType || !isValidPlanType(planType)) {
      return NextResponse.json(
        { error: 'Invalid plan type. Please select a valid subscription plan.' },
        { status: 400 }
      );
    }

    // Validate price ID matches plan
    const selectedPlan = SUBSCRIPTION_PLANS[planType as PlanType];
    if (priceId !== selectedPlan.priceId) {
      return NextResponse.json(
        { error: 'Price ID does not match selected plan.' },
        { status: 400 }
      );
    }

    // Check for existing active subscription
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (existingSub) {
      return NextResponse.json(
        {
          error: 'You already have an active subscription. Please manage your subscription in the billing portal.',
        },
        { status: 400 }
      );
    }

    // Get user profile for name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(
      user.id,
      user.email!,
      profile?.full_name || undefined
    );

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${stripePublicConfig.appUrl}/dashboard/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${stripePublicConfig.appUrl}/dashboard/subscription`,
      metadata: {
        user_id: user.id,
        plan_type: planType,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_type: planType,
        },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Checkout error:', error);

    // Use error handler to format user-friendly response
    const errorResponse = formatErrorResponse(error);

    // Log severity for monitoring
    if (errorResponse.severity === 'critical') {
      console.error('CRITICAL checkout error:', error);
    }

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
