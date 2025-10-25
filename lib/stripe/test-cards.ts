/**
 * Stripe Test Card Numbers
 * Use these card numbers for testing different payment scenarios
 * https://stripe.com/docs/testing
 */

export const TEST_CARDS = {
  /**
   * Success - Payment succeeds and no authentication is required
   * Use any future expiration date and any 3-digit CVC
   */
  success: '4242424242424242',

  /**
   * Card Declined - Payment is declined with generic decline code
   */
  declined: '4000000000000002',

  /**
   * Insufficient Funds - Payment is declined with insufficient_funds code
   */
  insufficient_funds: '4000000000009995',

  /**
   * Lost Card - Payment is declined with lost_card code
   */
  lost_card: '4000000000009987',

  /**
   * Stolen Card - Payment is declined with stolen_card code
   */
  stolen_card: '4000000000009979',

  /**
   * Expired Card - Payment is declined with expired_card code
   */
  expired_card: '4000000000000069',

  /**
   * Incorrect CVC - Payment is declined with incorrect_cvc code
   */
  incorrect_cvc: '4000000000000127',

  /**
   * Processing Error - Payment is declined with processing_error code
   */
  processing_error: '4000000000000119',

  /**
   * Requires 3D Secure (SCA) - Payment requires authentication
   */
  requires_3ds: '4000002500003155',

  /**
   * 3D Secure 2 Authentication Required
   */
  requires_3ds2: '4000002760003184',

  /**
   * Always Fails 3D Secure Authentication
   */
  fails_3ds: '4000008400001629',

  /**
   * Visa (Debit) - Success
   */
  visa_debit: '4000056655665556',

  /**
   * Mastercard - Success
   */
  mastercard: '5555555555554444',

  /**
   * American Express - Success
   */
  amex: '378282246310005',

  /**
   * Discover - Success
   */
  discover: '6011111111111117',

  /**
   * Diners Club - Success
   */
  diners: '3056930009020004',

  /**
   * JCB - Success
   */
  jcb: '3566002020360505',
} as const;

/**
 * Test card expiration dates
 */
export const TEST_EXPIRATION = {
  /**
   * Valid future date
   */
  valid: { month: '12', year: '2034' },

  /**
   * Expired date
   */
  expired: { month: '01', year: '2020' },
} as const;

/**
 * Test CVC codes
 */
export const TEST_CVC = {
  /**
   * Valid CVC
   */
  valid: '123',

  /**
   * Valid CVC for Amex (4 digits)
   */
  validAmex: '1234',

  /**
   * Will trigger incorrect_cvc error with card 4000000000000127
   */
  incorrect: '000',
} as const;

/**
 * Testing instructions and tips
 */
export const TESTING_GUIDE = {
  setup: [
    'Use Stripe test mode keys (sk_test_... and pk_test_...)',
    'Enable test mode in Stripe Dashboard',
    'Use test card numbers from this file',
    'Use any future expiration date',
    'Use any 3-digit CVC (or 4 for Amex)',
    'Use any billing postal code',
  ],

  testingScenarios: [
    {
      scenario: 'Successful Payment',
      card: TEST_CARDS.success,
      expected: 'Payment succeeds immediately',
    },
    {
      scenario: 'Declined Card',
      card: TEST_CARDS.declined,
      expected: 'Payment is declined with generic error',
    },
    {
      scenario: 'Insufficient Funds',
      card: TEST_CARDS.insufficient_funds,
      expected: 'Payment is declined with specific insufficient funds message',
    },
    {
      scenario: '3D Secure Required',
      card: TEST_CARDS.requires_3ds,
      expected: 'Payment requires additional authentication step',
    },
    {
      scenario: 'Expired Card',
      card: TEST_CARDS.expired_card,
      expected: 'Payment is declined due to expired card',
    },
  ],

  webhookTesting: [
    'Install Stripe CLI: brew install stripe/stripe-cli/stripe',
    'Login: stripe login',
    'Forward webhooks: stripe listen --forward-to localhost:3000/api/webhooks/stripe',
    'Trigger events: stripe trigger payment_intent.succeeded',
    'View webhook events in Stripe Dashboard > Developers > Webhooks',
  ],

  commonIssues: [
    {
      issue: 'Webhook signature verification fails',
      solution: 'Make sure STRIPE_WEBHOOK_SECRET matches the secret from `stripe listen` output',
    },
    {
      issue: 'Payment succeeds but subscription not created',
      solution: 'Check webhook endpoint is receiving events. Verify webhook handler processes subscription.created',
    },
    {
      issue: 'Using live keys in development',
      solution: 'Always use test keys (sk_test_...) in development. Live keys start with sk_live_',
    },
  ],
};

/**
 * Helper to format test card for display
 */
export function formatTestCard(cardNumber: string): string {
  return cardNumber.match(/.{1,4}/g)?.join(' ') || cardNumber;
}

/**
 * Get card type from number
 */
export function getCardType(cardNumber: string): string {
  if (cardNumber.startsWith('4')) return 'Visa';
  if (cardNumber.startsWith('5')) return 'Mastercard';
  if (cardNumber.startsWith('3')) {
    if (cardNumber.startsWith('34') || cardNumber.startsWith('37')) return 'American Express';
    if (cardNumber.startsWith('36') || cardNumber.startsWith('38')) return 'Diners Club';
    if (cardNumber.startsWith('35')) return 'JCB';
  }
  if (cardNumber.startsWith('6')) return 'Discover';
  return 'Unknown';
}
