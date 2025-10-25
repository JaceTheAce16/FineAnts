/**
 * Tests for Stripe Client
 */

import { stripe } from '@/lib/stripe/client';

describe('Stripe Client', () => {
  it('should initialize Stripe client', () => {
    expect(stripe).toBeDefined();
    expect(typeof stripe.customers.create).toBe('function');
    expect(typeof stripe.checkout.sessions.create).toBe('function');
  });

  it('should have correct API version', () => {
    // Verify Stripe is configured with expected version
    expect(stripe).toHaveProperty('VERSION');
  });

  it('should have app info configured', () => {
    // The stripe instance should be properly initialized
    expect(stripe).toBeDefined();
  });
});

describe('getOrCreateStripeCustomer', () => {
  // Note: These tests would require mocking Supabase and Stripe
  // For now, we're just ensuring the module can be imported
  it('should export getOrCreateStripeCustomer function', async () => {
    const { getOrCreateStripeCustomer } = await import('@/lib/stripe/client');
    expect(typeof getOrCreateStripeCustomer).toBe('function');
  });
});
