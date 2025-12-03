/**
 * Stripe Webhook Handler
 * Processes webhook events from Stripe to keep subscriptions synchronized
 *
 * Updated: 2025-12-02
 * - Added automatic retry logic with exponential backoff
 * - Enhanced error tracking and monitoring
 * - Improved idempotency handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { stripeConfig } from '@/lib/stripe/config';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { processWebhookWithRetry } from '@/lib/webhooks/retry-handler';
import { trackWebhookError } from '@/lib/monitoring/error-tracker';

// Create Supabase admin client with service role key for webhook operations
// This bypasses Row Level Security policies
const supabaseAdmin = createClient(
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
 * Handle subscription created or updated events
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.user_id;
  if (!userId) {
    throw new Error('No user_id in subscription metadata');
  }

  const subscriptionData = {
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    stripe_price_id: subscription.items.data[0].price.id,
    status: subscription.status as any,
    current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
    current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    trial_start: (subscription as any).trial_start
      ? new Date((subscription as any).trial_start * 1000).toISOString()
      : null,
    trial_end: (subscription as any).trial_end
      ? new Date((subscription as any).trial_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'stripe_subscription_id',
    });

  if (error) {
    console.error('Error upserting subscription:', error);
    throw error;
  }

  console.log(`✅ Subscription ${subscription.status}: ${subscription.id}`);
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }

  console.log(`✅ Subscription canceled: ${subscription.id}`);
}

/**
 * Handle invoice payment succeeded event
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Subscription payment successful - already handled by subscription.updated
  // This is logged for monitoring purposes
  console.log(`✅ Payment succeeded for invoice: ${invoice.id}`);
}

/**
 * Handle invoice payment failed event
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string;

  if (!subscriptionId) {
    console.warn('Invoice payment failed but no subscription ID found');
    return;
  }

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    console.error('Error updating subscription to past_due:', error);
    throw error;
  }

  console.log(`⚠️ Payment failed for subscription: ${subscriptionId}`);
  // TODO: Send email notification to user about failed payment
}

/**
 * Main webhook handler
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('❌ No stripe-signature header found');
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  if (!stripeConfig.webhookSecret) {
    console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  // Verify webhook signature
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      stripeConfig.webhookSecret
    );
  } catch (error) {
    console.error('❌ Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  console.log(`📥 Webhook received: ${event.type} (${event.id})`);

  // Check if event already processed (idempotency)
  const { data: existingEvent } = await supabaseAdmin
    .from('webhook_events')
    .select('id, processed')
    .eq('stripe_event_id', event.id)
    .single();

  if (existingEvent) {
    console.log(`✅ Event already processed: ${event.id}`);
    return NextResponse.json({ received: true, cached: true });
  }

  // Log webhook event
  const { error: logError } = await supabaseAdmin
    .from('webhook_events')
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      processed: false,
    });

  if (logError) {
    console.error('Error logging webhook event:', logError);
  }

  // Process webhook with automatic retry logic
  const result = await processWebhookWithRetry(
    event,
    async (evt) => {
      // Handle different event types
      switch (evt.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpdate(evt.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(evt.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(evt.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(evt.data.object as Stripe.Invoice);
          break;

        default:
          console.log(`ℹ️ Unhandled event type: ${evt.type}`);
      }
    },
    {
      provider: 'stripe',
      maxRetries: 3,
      initialDelayMs: 1000,
      timeout: 30000,
      onRetry: (attempt, error) => {
        console.log(`🔄 Retrying webhook ${event.id} (attempt ${attempt})`, error);
      },
      onFailure: (error, attempts) => {
        console.error(`❌ Webhook ${event.id} failed after ${attempts} attempts`);
        trackWebhookError(error, {
          provider: 'stripe',
          eventType: event.type,
          eventId: event.id,
          attemptNumber: attempts,
        });
      },
    }
  );

  // Update webhook event status in database
  if (result.success) {
    // Mark as processed
    await supabaseAdmin
      .from('webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('stripe_event_id', event.id);

    console.log(`✅ Webhook processed successfully: ${event.id} (${result.attempts} attempts, ${result.processingTimeMs}ms)`);
    return NextResponse.json({ received: true });
  } else {
    // Log error in database
    await supabaseAdmin
      .from('webhook_events')
      .update({
        processed: false,
        error_message: result.error instanceof Error ? result.error.message : 'Unknown error',
      })
      .eq('stripe_event_id', event.id);

    // Return 200 to acknowledge receipt (prevents Stripe's own retry)
    // Our retry handler already attempted multiple times
    console.error(`❌ Webhook processing failed: ${event.id} (${result.attempts} attempts, ${result.processingTimeMs}ms)`);
    return NextResponse.json(
      {
        received: true,
        processed: false,
        note: 'Event received but processing failed after retries. Check dead letter queue.'
      },
      { status: 200 }
    );
  }
}
