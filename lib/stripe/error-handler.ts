/**
 * Stripe Error Handler
 * Converts Stripe errors into user-friendly messages
 */

import Stripe from 'stripe';

/**
 * User-friendly error messages for common scenarios
 */
export const ERROR_MESSAGES = {
  // Payment errors
  payment_failed: 'Payment failed. Please check your card details and try again.',
  card_declined: 'Your card was declined. Please use a different payment method.',
  insufficient_funds: 'Insufficient funds. Please try another card.',
  expired_card: 'Your card has expired. Please use a different card.',
  incorrect_cvc: 'Incorrect security code. Please check and try again.',
  incorrect_number: 'Invalid card number. Please check your card number.',
  processing_error: 'An error occurred while processing your payment. Please try again.',

  // Subscription errors
  already_subscribed: 'You already have an active subscription.',
  no_subscription: 'No active subscription found.',
  subscription_expired: 'Your subscription has expired. Please renew to continue.',

  // Feature access
  feature_locked: 'This feature requires a premium subscription.',
  upgrade_required: 'Please upgrade your plan to access this feature.',
  account_limit_reached: 'Account limit reached. Upgrade to add more accounts.',

  // System errors
  server_error: 'Something went wrong. Please try again later.',
  network_error: 'Connection failed. Please check your internet connection.',
  rate_limit: 'Too many requests. Please wait a moment and try again.',
  invalid_request: 'Invalid request. Please contact support if this continues.',

  // Generic
  unknown_error: 'An unexpected error occurred. Please try again.',
};

/**
 * Handle Stripe-specific errors and return user-friendly messages
 */
export function handleStripeError(error: unknown): string {
  // Handle Stripe card errors
  if (error instanceof Stripe.errors.StripeCardError) {
    switch (error.code) {
      case 'card_declined':
        // Check decline code for more specific message
        if (error.decline_code === 'insufficient_funds') {
          return ERROR_MESSAGES.insufficient_funds;
        }
        return ERROR_MESSAGES.card_declined;

      case 'expired_card':
        return ERROR_MESSAGES.expired_card;

      case 'incorrect_cvc':
        return ERROR_MESSAGES.incorrect_cvc;

      case 'incorrect_number':
      case 'invalid_number':
        return ERROR_MESSAGES.incorrect_number;

      case 'processing_error':
        return ERROR_MESSAGES.processing_error;

      default:
        // Use the error message from Stripe if available
        return error.message || ERROR_MESSAGES.payment_failed;
    }
  }

  // Handle rate limit errors
  if (error instanceof Stripe.errors.StripeRateLimitError) {
    return ERROR_MESSAGES.rate_limit;
  }

  // Handle invalid request errors
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    console.error('Invalid Stripe request:', error);
    // Don't expose technical details to users
    return ERROR_MESSAGES.invalid_request;
  }

  // Handle API errors (server-side issues)
  if (error instanceof Stripe.errors.StripeAPIError) {
    console.error('Stripe API error:', error);
    return ERROR_MESSAGES.server_error;
  }

  // Handle connection errors
  if (error instanceof Stripe.errors.StripeConnectionError) {
    return ERROR_MESSAGES.network_error;
  }

  // Handle authentication errors
  if (error instanceof Stripe.errors.StripeAuthenticationError) {
    console.error('Stripe authentication error:', error);
    return ERROR_MESSAGES.server_error;
  }

  // Handle permission errors
  if (error instanceof Stripe.errors.StripePermissionError) {
    console.error('Stripe permission error:', error);
    return ERROR_MESSAGES.server_error;
  }

  // Handle generic Stripe errors
  if (error instanceof Stripe.errors.StripeError) {
    console.error('Stripe error:', error);
    return error.message || ERROR_MESSAGES.unknown_error;
  }

  // Handle standard JavaScript errors
  if (error instanceof Error) {
    console.error('Error:', error);
    return error.message || ERROR_MESSAGES.unknown_error;
  }

  // Fallback for unknown error types
  console.error('Unknown error:', error);
  return ERROR_MESSAGES.unknown_error;
}

/**
 * Categorize error severity for logging/monitoring
 */
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export function getErrorSeverity(error: unknown): ErrorSeverity {
  // Card errors are usually user errors (info level)
  if (error instanceof Stripe.errors.StripeCardError) {
    return 'info';
  }

  // Rate limit errors are warnings
  if (error instanceof Stripe.errors.StripeRateLimitError) {
    return 'warning';
  }

  // Invalid request errors could be our fault (error level)
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    return 'error';
  }

  // API and authentication errors are critical
  if (
    error instanceof Stripe.errors.StripeAPIError ||
    error instanceof Stripe.errors.StripeAuthenticationError ||
    error instanceof Stripe.errors.StripePermissionError
  ) {
    return 'critical';
  }

  // Connection errors are warnings (might be temporary)
  if (error instanceof Stripe.errors.StripeConnectionError) {
    return 'warning';
  }

  // Default to error
  return 'error';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  // Rate limit errors should be retried
  if (error instanceof Stripe.errors.StripeRateLimitError) {
    return true;
  }

  // Connection errors should be retried
  if (error instanceof Stripe.errors.StripeConnectionError) {
    return true;
  }

  // Some API errors might be temporary
  if (error instanceof Stripe.errors.StripeAPIError) {
    return true;
  }

  // Card errors and invalid requests shouldn't be retried
  return false;
}

/**
 * Format error for API response
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  severity: ErrorSeverity;
  retryable: boolean;
}

export function formatErrorResponse(error: unknown): ErrorResponse {
  const message = handleStripeError(error);
  const severity = getErrorSeverity(error);
  const retryable = isRetryableError(error);

  const response: ErrorResponse = {
    error: message,
    severity,
    retryable,
  };

  // Include error code if available
  if (error instanceof Stripe.errors.StripeError && error.code) {
    response.code = error.code;
  }

  return response;
}
