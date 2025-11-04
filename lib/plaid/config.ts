/**
 * Plaid Configuration
 * Validates and exports Plaid environment variables
 */

// Server-side only environment variables
export const plaidConfig = {
  secret: process.env.PLAID_SECRET_KEY,
  environment: (process.env.PLAID_ENV || 'sandbox') as 'sandbox' | 'development' | 'production',
  encryptionKey: process.env.PLAID_ENCRYPTION_KEY,
} as const;

// Client-side environment variables
export const plaidPublicConfig = {
  clientId: process.env.NEXT_PUBLIC_PLAID_CLIENT_ID,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
} as const;

// Computed webhook URL
export const plaidWebhookUrl = `${plaidPublicConfig.appUrl}/api/webhooks/plaid`;

/**
 * Validates that all required Plaid environment variables are set
 * Call this on server startup to fail fast if configuration is missing
 */
export function validatePlaidConfig() {
  const errors: string[] = [];

  // Validate client ID
  if (!plaidPublicConfig.clientId) {
    errors.push('NEXT_PUBLIC_PLAID_CLIENT_ID is not set');
  } else if (plaidPublicConfig.clientId.length < 10) {
    errors.push('NEXT_PUBLIC_PLAID_CLIENT_ID appears to be invalid (too short)');
  }

  // Validate secret key
  if (!plaidConfig.secret) {
    errors.push('PLAID_SECRET_KEY is not set');
  } else if (plaidConfig.secret.length < 10) {
    errors.push('PLAID_SECRET_KEY appears to be invalid (too short)');
  }

  // Validate environment
  if (!['sandbox', 'development', 'production'].includes(plaidConfig.environment)) {
    errors.push('PLAID_ENV must be one of: sandbox, development, production');
  }

  // Validate encryption key
  if (!plaidConfig.encryptionKey) {
    errors.push('PLAID_ENCRYPTION_KEY is not set');
  } else {
    // Encryption key should be a 32-byte (64 character) hex string
    const hexPattern = /^[0-9a-fA-F]{64}$/;
    if (!hexPattern.test(plaidConfig.encryptionKey)) {
      errors.push('PLAID_ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes)');
    }
  }

  // Validate app URL
  if (!plaidPublicConfig.appUrl) {
    errors.push('NEXT_PUBLIC_APP_URL is not set');
  } else if (!plaidPublicConfig.appUrl.startsWith('http')) {
    errors.push('NEXT_PUBLIC_APP_URL must start with http:// or https://');
  }

  if (errors.length > 0) {
    console.error('❌ Plaid configuration errors:');
    errors.forEach((error) => console.error(`  - ${error}`));
    console.error('\nPlease check your .env.local file and ensure all Plaid variables are set correctly.');
    console.error('See: https://dashboard.plaid.com/team/keys');
    console.error('\nTo generate a valid encryption key, run:');
    console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.error('');

    // Don't throw in development to allow the app to start
    // But log clearly that Plaid features won't work
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Plaid configuration is invalid. Check logs for details.');
    } else {
      console.warn('⚠️  Plaid features will not work until configuration is complete.\n');
    }
  } else {
    console.log('✅ Plaid configuration is valid');
  }

  return errors.length === 0;
}

/**
 * Check if Plaid is properly configured
 * Use this to conditionally enable/disable Plaid features
 */
export function isPlaidConfigured(): boolean {
  return !!(
    plaidPublicConfig.clientId &&
    plaidConfig.secret &&
    plaidConfig.encryptionKey &&
    plaidPublicConfig.appUrl &&
    ['sandbox', 'development', 'production'].includes(plaidConfig.environment)
  );
}
