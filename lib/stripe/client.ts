/**
 * Stripe Client
 * Initializes and exports the Stripe SDK instance
 */

import Stripe from 'stripe';
import { stripeConfig } from './config';

// Validate Stripe secret key exists
if (!stripeConfig.secretKey) {
  throw new Error(
    'STRIPE_SECRET_KEY is not defined. Please add it to your .env.local file.'
  );
}

/**
 * Initialized Stripe client instance
 * Uses the latest API version with TypeScript support
 */
export const stripe = new Stripe(stripeConfig.secretKey, {
  apiVersion: '2025-09-30.clover',
  typescript: true,
  appInfo: {
    name: 'FineAnts',
    version: '1.0.0',
  },
});

/**
 * Get or create a Stripe customer for a user
 * Checks if user already has a stripe_customer_id in the database
 * If not, creates a new customer and stores the ID
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<string> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  // Check if user already has a Stripe customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      supabase_user_id: userId,
    },
  });

  // Store customer ID in profile
  const { error } = await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);

  if (error) {
    console.error('Error storing Stripe customer ID:', error);
    throw new Error('Failed to store Stripe customer ID');
  }

  return customer.id;
}

/**
 * Retrieve a Stripe customer by ID
 */
export async function getStripeCustomer(customerId: string) {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer;
  } catch (error) {
    console.error('Error retrieving Stripe customer:', error);
    throw error;
  }
}

/**
 * Update a Stripe customer
 */
export async function updateStripeCustomer(
  customerId: string,
  updates: Stripe.CustomerUpdateParams
) {
  try {
    const customer = await stripe.customers.update(customerId, updates);
    return customer;
  } catch (error) {
    console.error('Error updating Stripe customer:', error);
    throw error;
  }
}
