/**
 * Tests for Stripe Error Handler
 */

import Stripe from 'stripe';
import {
  handleStripeError,
  getErrorSeverity,
  isRetryableError,
  formatErrorResponse,
  ERROR_MESSAGES,
} from '@/lib/stripe/error-handler';

describe('Stripe Error Handler', () => {
  describe('handleStripeError', () => {
    it('should handle card declined errors', () => {
      const error = new Stripe.errors.StripeCardError({
        message: 'Your card was declined',
        type: 'card_error',
        code: 'card_declined',
      } as any);

      expect(handleStripeError(error)).toBe(ERROR_MESSAGES.card_declined);
    });

    it('should handle insufficient funds specifically', () => {
      const error = new Stripe.errors.StripeCardError({
        message: 'Your card has insufficient funds',
        type: 'card_error',
        code: 'card_declined',
        decline_code: 'insufficient_funds',
      } as any);

      expect(handleStripeError(error)).toBe(ERROR_MESSAGES.insufficient_funds);
    });

    it('should handle expired card errors', () => {
      const error = new Stripe.errors.StripeCardError({
        message: 'Your card has expired',
        type: 'card_error',
        code: 'expired_card',
      } as any);

      expect(handleStripeError(error)).toBe(ERROR_MESSAGES.expired_card);
    });

    it('should handle incorrect CVC errors', () => {
      const error = new Stripe.errors.StripeCardError({
        message: 'Your card CVC is incorrect',
        type: 'card_error',
        code: 'incorrect_cvc',
      } as any);

      expect(handleStripeError(error)).toBe(ERROR_MESSAGES.incorrect_cvc);
    });

    it('should handle rate limit errors', () => {
      const error = new Stripe.errors.StripeRateLimitError({
        message: 'Rate limit exceeded',
        type: 'rate_limit_error',
      } as any);

      expect(handleStripeError(error)).toBe(ERROR_MESSAGES.rate_limit);
    });

    it('should handle API errors', () => {
      const error = new Stripe.errors.StripeAPIError({
        message: 'API error occurred',
        type: 'api_error',
      } as any);

      expect(handleStripeError(error)).toBe(ERROR_MESSAGES.server_error);
    });

    it('should handle connection errors', () => {
      const error = new Stripe.errors.StripeConnectionError({
        message: 'Connection failed',
        type: 'connection_error',
      } as any);

      expect(handleStripeError(error)).toBe(ERROR_MESSAGES.network_error);
    });

    it('should handle generic JavaScript errors', () => {
      const error = new Error('Something went wrong');
      expect(handleStripeError(error)).toBe('Something went wrong');
    });

    it('should handle unknown errors', () => {
      const error = { unknown: 'error' };
      expect(handleStripeError(error)).toBe(ERROR_MESSAGES.unknown_error);
    });
  });

  describe('getErrorSeverity', () => {
    it('should return info for card errors', () => {
      const error = new Stripe.errors.StripeCardError({
        message: 'Card error',
        type: 'card_error',
        code: 'card_declined',
      } as any);

      expect(getErrorSeverity(error)).toBe('info');
    });

    it('should return warning for rate limit errors', () => {
      const error = new Stripe.errors.StripeRateLimitError({
        message: 'Rate limit',
        type: 'rate_limit_error',
      } as any);

      expect(getErrorSeverity(error)).toBe('warning');
    });

    it('should return critical for API errors', () => {
      const error = new Stripe.errors.StripeAPIError({
        message: 'API error',
        type: 'api_error',
      } as any);

      expect(getErrorSeverity(error)).toBe('critical');
    });

    it('should return error for unknown errors', () => {
      const error = new Error('Unknown');
      expect(getErrorSeverity(error)).toBe('error');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for rate limit errors', () => {
      const error = new Stripe.errors.StripeRateLimitError({
        message: 'Rate limit',
        type: 'rate_limit_error',
      } as any);

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for connection errors', () => {
      const error = new Stripe.errors.StripeConnectionError({
        message: 'Connection error',
        type: 'connection_error',
      } as any);

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for card errors', () => {
      const error = new Stripe.errors.StripeCardError({
        message: 'Card declined',
        type: 'card_error',
        code: 'card_declined',
      } as any);

      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for invalid request errors', () => {
      const error = new Stripe.errors.StripeInvalidRequestError({
        message: 'Invalid request',
        type: 'invalid_request_error',
      } as any);

      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('formatErrorResponse', () => {
    it('should format complete error response', () => {
      const error = new Stripe.errors.StripeCardError({
        message: 'Card declined',
        type: 'card_error',
        code: 'card_declined',
      } as any);

      const response = formatErrorResponse(error);

      expect(response).toEqual({
        error: ERROR_MESSAGES.card_declined,
        code: 'card_declined',
        severity: 'info',
        retryable: false,
      });
    });

    it('should handle errors without codes', () => {
      const error = new Error('Generic error');
      const response = formatErrorResponse(error);

      expect(response).toEqual({
        error: 'Generic error',
        severity: 'error',
        retryable: false,
      });
      expect(response.code).toBeUndefined();
    });
  });
});
