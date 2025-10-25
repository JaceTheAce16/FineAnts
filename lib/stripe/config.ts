/**
 * Stripe Configuration
 * Validates and exports Stripe environment variables
 */

// Server-side only environment variables
export const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  basicPriceId: process.env.STRIPE_BASIC_PRICE_ID,
  premiumPriceId: process.env.STRIPE_PREMIUM_PRICE_ID,
} as const;

// Client-side environment variables
export const stripePublicConfig = {
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
} as const;

/**
 * Validates that all required Stripe environment variables are set
 * Call this on server startup to fail fast if configuration is missing
 */
export function validateStripeConfig() {
  const errors: string[] = [];

  if (!stripeConfig.secretKey) {
    errors.push('STRIPE_SECRET_KEY is not set');
  } else if (!stripeConfig.secretKey.startsWith('sk_')) {
    errors.push('STRIPE_SECRET_KEY must start with "sk_"');
  }

  if (!stripeConfig.webhookSecret) {
    errors.push('STRIPE_WEBHOOK_SECRET is not set');
  } else if (!stripeConfig.webhookSecret.startsWith('whsec_')) {
    errors.push('STRIPE_WEBHOOK_SECRET must start with "whsec_"');
  }

  if (!stripeConfig.basicPriceId) {
    errors.push('STRIPE_BASIC_PRICE_ID is not set');
  } else if (!stripeConfig.basicPriceId.startsWith('price_')) {
    errors.push('STRIPE_BASIC_PRICE_ID must start with "price_"');
  }

  if (!stripeConfig.premiumPriceId) {
    errors.push('STRIPE_PREMIUM_PRICE_ID is not set');
  } else if (!stripeConfig.premiumPriceId.startsWith('price_')) {
    errors.push('STRIPE_PREMIUM_PRICE_ID must start with "price_"');
  }

  if (!stripePublicConfig.publishableKey) {
    errors.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
  } else if (!stripePublicConfig.publishableKey.startsWith('pk_')) {
    errors.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with "pk_"');
  }

  if (!stripePublicConfig.appUrl) {
    errors.push('NEXT_PUBLIC_APP_URL is not set');
  }

  if (errors.length > 0) {
    console.error('❌ Stripe configuration errors:');
    errors.forEach((error) => console.error(`  - ${error}`));
    console.error('\nPlease check your .env.local file and ensure all Stripe variables are set correctly.');
    console.error('See: https://dashboard.stripe.com/test/apikeys\n');

    // Don't throw in development to allow the app to start
    // But log clearly that Stripe features won't work
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Stripe configuration is invalid. Check logs for details.');
    } else {
      console.warn('⚠️  Stripe features will not work until configuration is complete.\n');
    }
  } else {
    console.log('✅ Stripe configuration is valid');
  }

  return errors.length === 0;
}

/**
 * Check if Stripe is properly configured
 * Use this to conditionally enable/disable Stripe features
 */
export function isStripeConfigured(): boolean {
  return !!(
    stripeConfig.secretKey &&
    stripeConfig.webhookSecret &&
    stripeConfig.basicPriceId &&
    stripeConfig.premiumPriceId &&
    stripePublicConfig.publishableKey
  );
}
