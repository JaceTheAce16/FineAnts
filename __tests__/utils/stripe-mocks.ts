/**
 * Stripe Mock Utilities for Testing
 * Helper functions to create mock Stripe objects and events
 */

import Stripe from 'stripe';

/**
 * Create a mock Stripe subscription object
 */
export function createMockSubscription(
  overrides?: Partial<Stripe.Subscription>
): Stripe.Subscription {
  return {
    id: 'sub_test_123',
    object: 'subscription',
    application: null,
    application_fee_percent: null,
    automatic_tax: { enabled: false, liability: null },
    billing_cycle_anchor: Math.floor(Date.now() / 1000),
    billing_cycle_anchor_config: null,
    billing_thresholds: null,
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    cancellation_details: null,
    collection_method: 'charge_automatically',
    created: Math.floor(Date.now() / 1000),
    currency: 'usd',
    current_period_end: Math.floor(Date.now() / 1000) + 2592000, // +30 days
    current_period_start: Math.floor(Date.now() / 1000),
    customer: 'cus_test_123',
    days_until_due: null,
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discount: null,
    ended_at: null,
    invoice_settings: { issuer: { type: 'self' } },
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test_123',
          object: 'subscription_item',
          billing_thresholds: null,
          created: Math.floor(Date.now() / 1000),
          metadata: {},
          price: {
            id: 'price_test_premium',
            object: 'price',
            active: true,
            billing_scheme: 'per_unit',
            created: Math.floor(Date.now() / 1000),
            currency: 'usd',
            custom_unit_amount: null,
            livemode: false,
            lookup_key: null,
            metadata: {},
            nickname: null,
            product: 'prod_test_123',
            recurring: {
              aggregate_usage: null,
              interval: 'month',
              interval_count: 1,
              trial_period_days: null,
              usage_type: 'licensed',
            },
            tax_behavior: 'unspecified',
            tiers_mode: null,
            transform_quantity: null,
            type: 'recurring',
            unit_amount: 1999,
            unit_amount_decimal: '1999',
          },
          quantity: 1,
          subscription: 'sub_test_123',
          tax_rates: [],
        },
      ],
      has_more: false,
      url: '/v1/subscription_items',
    },
    latest_invoice: null,
    livemode: false,
    metadata: {
      user_id: 'user_test_123',
      plan_type: 'premium',
    },
    next_pending_invoice_item_invoice: null,
    on_behalf_of: null,
    pause_collection: null,
    payment_settings: {
      payment_method_options: null,
      payment_method_types: null,
      save_default_payment_method: 'off',
    },
    pending_invoice_item_interval: null,
    pending_setup_intent: null,
    pending_update: null,
    plan: null,
    quantity: null,
    schedule: null,
    start_date: Math.floor(Date.now() / 1000),
    status: 'active',
    test_clock: null,
    transfer_data: null,
    trial_end: null,
    trial_settings: { end_behavior: { missing_payment_method: 'create_invoice' } },
    trial_start: null,
    ...overrides,
  } as Stripe.Subscription;
}

/**
 * Create a mock Stripe invoice object
 */
export function createMockInvoice(
  overrides?: Partial<Stripe.Invoice>
): Stripe.Invoice {
  return {
    id: 'in_test_123',
    object: 'invoice',
    account_country: 'US',
    account_name: 'Test Account',
    account_tax_ids: null,
    amount_due: 1999,
    amount_paid: 1999,
    amount_remaining: 0,
    amount_shipping: 0,
    application: null,
    application_fee_amount: null,
    attempt_count: 1,
    attempted: true,
    auto_advance: true,
    automatic_tax: { enabled: false, liability: null, status: null },
    automatically_finalizes_at: null,
    billing_reason: 'subscription_create',
    charge: 'ch_test_123',
    collection_method: 'charge_automatically',
    created: Math.floor(Date.now() / 1000),
    currency: 'usd',
    custom_fields: null,
    customer: 'cus_test_123',
    customer_address: null,
    customer_email: 'test@example.com',
    customer_name: null,
    customer_phone: null,
    customer_shipping: null,
    customer_tax_exempt: 'none',
    customer_tax_ids: [],
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discount: null,
    discounts: [],
    due_date: null,
    effective_at: null,
    ending_balance: 0,
    footer: null,
    from_invoice: null,
    hosted_invoice_url: null,
    invoice_pdf: null,
    issuer: { type: 'self' },
    last_finalization_error: null,
    latest_revision: null,
    lines: {
      object: 'list',
      data: [],
      has_more: false,
      url: '/v1/invoices/in_test_123/lines',
    },
    livemode: false,
    metadata: {},
    next_payment_attempt: null,
    number: null,
    on_behalf_of: null,
    paid: true,
    paid_out_of_band: false,
    payment_intent: 'pi_test_123',
    payment_settings: {
      default_mandate: null,
      payment_method_options: null,
      payment_method_types: null,
    },
    period_end: Math.floor(Date.now() / 1000),
    period_start: Math.floor(Date.now() / 1000) - 2592000,
    post_payment_credit_notes_amount: 0,
    pre_payment_credit_notes_amount: 0,
    quote: null,
    receipt_number: null,
    rendering: null,
    rendering_options: null,
    shipping_cost: null,
    shipping_details: null,
    starting_balance: 0,
    statement_descriptor: null,
    status: 'paid',
    status_transitions: {
      finalized_at: Math.floor(Date.now() / 1000),
      marked_uncollectible_at: null,
      paid_at: Math.floor(Date.now() / 1000),
      voided_at: null,
    },
    subscription: 'sub_test_123',
    subscription_details: { metadata: null },
    subtotal: 1999,
    subtotal_excluding_tax: null,
    tax: null,
    test_clock: null,
    total: 1999,
    total_discount_amounts: [],
    total_excluding_tax: null,
    total_tax_amounts: [],
    transfer_data: null,
    webhooks_delivered_at: Math.floor(Date.now() / 1000),
    ...overrides,
  } as Stripe.Invoice;
}

/**
 * Create a mock Stripe event
 */
export function createMockStripeEvent(
  eventType: string,
  data?: any
): Stripe.Event {
  let eventData;

  switch (eventType) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      eventData = createMockSubscription(data);
      break;
    case 'customer.subscription.deleted':
      eventData = createMockSubscription({ status: 'canceled', ...data });
      break;
    case 'invoice.payment_succeeded':
      eventData = createMockInvoice({ status: 'paid', ...data });
      break;
    case 'invoice.payment_failed':
      eventData = createMockInvoice({ status: 'open', paid: false, ...data });
      break;
    default:
      eventData = data || {};
  }

  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-11-20.acacia',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: eventData,
      previous_attributes: undefined,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type: eventType,
  } as Stripe.Event;
}

/**
 * Generate a test webhook signature
 * Note: This is a simplified version for testing
 * Real signature generation would use Stripe's signing secret
 */
export function generateTestSignature(payload: any): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify(payload);
  // In real tests, you'd use the actual Stripe signing algorithm
  return `t=${timestamp},v1=test_signature`;
}
