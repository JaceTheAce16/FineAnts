/**
 * Tests for Plaid Error Handler
 */

import { describe, it, expect } from 'vitest';
import {
  handlePlaidError,
  requiresReconnection,
  isTransientError,
  getSuggestedAction,
} from '@/lib/plaid/error-handler';

describe('Plaid Error Handler', () => {
  describe('handlePlaidError', () => {
    describe('Authentication Errors', () => {
      it('should handle ITEM_LOGIN_REQUIRED error', () => {
        const error = {
          error_code: 'ITEM_LOGIN_REQUIRED',
          error_message: 'The login details of this item have changed.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('ITEM_LOGIN_REQUIRED');
        expect(result.userMessage).toContain('connection has expired');
        expect(result.requiresReconnect).toBe(true);
        expect(result.isTransient).toBe(false);
        expect(result.suggestedAction).toBeDefined();
      });

      it('should handle INVALID_CREDENTIALS error', () => {
        const error = {
          error_code: 'INVALID_CREDENTIALS',
          error_message: 'The provided credentials were invalid.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('INVALID_CREDENTIALS');
        expect(result.userMessage).toContain('username or password');
        expect(result.requiresReconnect).toBe(true);
        expect(result.isTransient).toBe(false);
      });

      it('should handle INVALID_MFA error', () => {
        const error = {
          error_code: 'INVALID_MFA',
          error_message: 'The MFA code was invalid.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('INVALID_MFA');
        expect(result.userMessage).toContain('multi-factor authentication');
        expect(result.requiresReconnect).toBe(true);
        expect(result.isTransient).toBe(false);
      });

      it('should use Plaid display_message when available', () => {
        const error = {
          error_code: 'ITEM_LOGIN_REQUIRED',
          error_message: 'The login details of this item have changed.',
          display_message: 'Please reconnect your Chase account.',
        };

        const result = handlePlaidError(error);

        expect(result.userMessage).toBe('Please reconnect your Chase account.');
      });
    });

    describe('Account Lockout Errors', () => {
      it('should handle ITEM_LOCKED error', () => {
        const error = {
          error_code: 'ITEM_LOCKED',
          error_message: 'The item is locked.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('ITEM_LOCKED');
        expect(result.userMessage).toContain('locked by your financial institution');
        expect(result.requiresReconnect).toBe(true);
        expect(result.isTransient).toBe(false);
        expect(result.suggestedAction).toContain('Contact your financial institution');
      });

      it('should handle USER_SETUP_REQUIRED error', () => {
        const error = {
          error_code: 'USER_SETUP_REQUIRED',
          error_message: 'User setup is required.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('USER_SETUP_REQUIRED');
        expect(result.userMessage).toContain('requires additional setup');
        expect(result.requiresReconnect).toBe(true);
        expect(result.isTransient).toBe(false);
      });
    });

    describe('Transient Errors', () => {
      it('should handle INSTITUTION_DOWN error', () => {
        const error = {
          error_code: 'INSTITUTION_DOWN',
          error_message: 'The institution is down.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('INSTITUTION_DOWN');
        expect(result.userMessage).toContain('currently unavailable');
        expect(result.requiresReconnect).toBe(false);
        expect(result.isTransient).toBe(true);
        expect(result.suggestedAction).toContain('try again');
      });

      it('should handle INSTITUTION_NOT_RESPONDING error', () => {
        const error = {
          error_code: 'INSTITUTION_NOT_RESPONDING',
          error_message: 'The institution is not responding.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('INSTITUTION_NOT_RESPONDING');
        expect(result.userMessage).toContain('not responding');
        expect(result.requiresReconnect).toBe(false);
        expect(result.isTransient).toBe(true);
      });

      it('should handle RATE_LIMIT_EXCEEDED error', () => {
        const error = {
          error_code: 'RATE_LIMIT_EXCEEDED',
          error_message: 'Rate limit exceeded.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('RATE_LIMIT_EXCEEDED');
        expect(result.userMessage).toContain('Too many requests');
        expect(result.requiresReconnect).toBe(false);
        expect(result.isTransient).toBe(true);
        expect(result.suggestedAction).toContain('Wait');
      });

      it('should handle PRODUCTS_NOT_READY error', () => {
        const error = {
          error_code: 'PRODUCTS_NOT_READY',
          error_message: 'Products are not ready.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('PRODUCTS_NOT_READY');
        expect(result.userMessage).toContain('still being retrieved');
        expect(result.requiresReconnect).toBe(false);
        expect(result.isTransient).toBe(true);
      });

      it('should handle INTERNAL_SERVER_ERROR error', () => {
        const error = {
          error_code: 'INTERNAL_SERVER_ERROR',
          error_message: 'Internal server error.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('INTERNAL_SERVER_ERROR');
        expect(result.userMessage).toContain('server error');
        expect(result.requiresReconnect).toBe(false);
        expect(result.isTransient).toBe(true);
      });

      it('should handle PLANNED_MAINTENANCE error', () => {
        const error = {
          error_code: 'PLANNED_MAINTENANCE',
          error_message: 'Planned maintenance.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('PLANNED_MAINTENANCE');
        expect(result.userMessage).toContain('scheduled maintenance');
        expect(result.requiresReconnect).toBe(false);
        expect(result.isTransient).toBe(true);
      });
    });

    describe('Product and API Errors', () => {
      it('should handle ITEM_NOT_FOUND error', () => {
        const error = {
          error_code: 'ITEM_NOT_FOUND',
          error_message: 'Item not found.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('ITEM_NOT_FOUND');
        expect(result.userMessage).toContain('could not be found');
        expect(result.requiresReconnect).toBe(true);
        expect(result.isTransient).toBe(false);
      });

      it('should handle INVALID_REQUEST error', () => {
        const error = {
          error_code: 'INVALID_REQUEST',
          error_message: 'Invalid request.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('INVALID_REQUEST');
        expect(result.userMessage).toContain('error occurred while processing');
        expect(result.requiresReconnect).toBe(false);
        expect(result.isTransient).toBe(false);
      });

      it('should handle INVALID_API_KEYS error', () => {
        const error = {
          error_code: 'INVALID_API_KEYS',
          error_message: 'Invalid API keys.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('INVALID_API_KEYS');
        expect(result.userMessage).toContain('configuration error');
        expect(result.requiresReconnect).toBe(false);
        expect(result.isTransient).toBe(false);
        expect(result.suggestedAction).toContain('Contact support');
      });

      it('should handle ITEM_NO_ERROR', () => {
        const error = {
          error_code: 'ITEM_NO_ERROR',
          error_message: 'No error.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('ITEM_NO_ERROR');
        expect(result.userMessage).toContain('No error detected');
        expect(result.requiresReconnect).toBe(false);
        expect(result.isTransient).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should handle unknown error codes gracefully', () => {
        const error = {
          error_code: 'UNKNOWN_CUSTOM_ERROR',
          error_message: 'Some unknown error.',
        };

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('UNKNOWN_CUSTOM_ERROR');
        expect(result.userMessage).toContain('unexpected error');
        expect(result.requiresReconnect).toBe(false);
        expect(result.isTransient).toBe(false);
        expect(result.suggestedAction).toBeDefined();
      });

      it('should handle Error objects', () => {
        const error = new Error('Some error occurred');

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('UNKNOWN_ERROR');
        expect(result.userMessage).toContain('unexpected error');
      });

      it('should extract error code from Error message', () => {
        const error = new Error('Plaid error: error_code: ITEM_LOGIN_REQUIRED');

        const result = handlePlaidError(error);

        expect(result.errorCode).toBe('ITEM_LOGIN_REQUIRED');
        expect(result.requiresReconnect).toBe(true);
      });

      it('should handle null error', () => {
        const result = handlePlaidError(null);

        expect(result.errorCode).toBe('UNKNOWN_ERROR');
        expect(result.userMessage).toBe('An unknown error occurred. Please try again.');
        expect(result.requiresReconnect).toBe(false);
        expect(result.isTransient).toBe(false);
      });

      it('should handle undefined error', () => {
        const result = handlePlaidError(undefined);

        expect(result.errorCode).toBe('UNKNOWN_ERROR');
        expect(result.userMessage).toBe('An unknown error occurred. Please try again.');
      });

      it('should handle string error', () => {
        const result = handlePlaidError('Some error string');

        expect(result.errorCode).toBe('UNKNOWN_ERROR');
        expect(result.userMessage).toContain('unexpected error');
      });

      it('should handle error with display_message but unknown code', () => {
        const error = {
          error_code: 'RARE_CUSTOM_ERROR',
          display_message: 'Custom institution message',
        };

        const result = handlePlaidError(error);

        expect(result.userMessage).toBe('Custom institution message');
        expect(result.errorCode).toBe('RARE_CUSTOM_ERROR');
      });
    });
  });

  describe('Helper Functions', () => {
    describe('requiresReconnection', () => {
      it('should return true for authentication errors', () => {
        const error = { error_code: 'ITEM_LOGIN_REQUIRED' };
        expect(requiresReconnection(error)).toBe(true);
      });

      it('should return false for transient errors', () => {
        const error = { error_code: 'INSTITUTION_DOWN' };
        expect(requiresReconnection(error)).toBe(false);
      });

      it('should return false for unknown errors', () => {
        const error = { error_code: 'UNKNOWN' };
        expect(requiresReconnection(error)).toBe(false);
      });
    });

    describe('isTransientError', () => {
      it('should return true for institution down', () => {
        const error = { error_code: 'INSTITUTION_DOWN' };
        expect(isTransientError(error)).toBe(true);
      });

      it('should return true for rate limit', () => {
        const error = { error_code: 'RATE_LIMIT_EXCEEDED' };
        expect(isTransientError(error)).toBe(true);
      });

      it('should return false for authentication errors', () => {
        const error = { error_code: 'INVALID_CREDENTIALS' };
        expect(isTransientError(error)).toBe(false);
      });

      it('should return false for unknown errors', () => {
        const error = { error_code: 'UNKNOWN' };
        expect(isTransientError(error)).toBe(false);
      });
    });

    describe('getSuggestedAction', () => {
      it('should return suggested action for mapped errors', () => {
        const error = { error_code: 'ITEM_LOGIN_REQUIRED' };
        const action = getSuggestedAction(error);

        expect(action).toContain('Reconnect');
      });

      it('should return suggested action for transient errors', () => {
        const error = { error_code: 'INSTITUTION_DOWN' };
        const action = getSuggestedAction(error);

        expect(action).toContain('try again');
      });

      it('should return suggested action for unknown errors', () => {
        const error = { error_code: 'UNKNOWN' };
        const action = getSuggestedAction(error);

        expect(action).toContain('Contact support');
      });

      it('should handle errors without suggested actions', () => {
        const error = { error_code: 'ITEM_NO_ERROR' };
        const action = getSuggestedAction(error);

        // ITEM_NO_ERROR doesn't have a suggested action
        expect(action).toBeUndefined();
      });
    });
  });

  describe('Error Classification', () => {
    it('should correctly classify all authentication errors', () => {
      const authErrors = [
        'ITEM_LOGIN_REQUIRED',
        'INVALID_CREDENTIALS',
        'INVALID_MFA',
        'ITEM_LOCKED',
        'USER_SETUP_REQUIRED',
        'ITEM_NOT_FOUND',
      ];

      authErrors.forEach((errorCode) => {
        const result = handlePlaidError({ error_code: errorCode });
        expect(result.requiresReconnect).toBe(true);
        expect(result.isTransient).toBe(false);
      });
    });

    it('should correctly classify all transient errors', () => {
      const transientErrors = [
        'INSTITUTION_DOWN',
        'INSTITUTION_NOT_RESPONDING',
        'RATE_LIMIT_EXCEEDED',
        'PRODUCTS_NOT_READY',
        'INTERNAL_SERVER_ERROR',
        'PLANNED_MAINTENANCE',
      ];

      transientErrors.forEach((errorCode) => {
        const result = handlePlaidError({ error_code: errorCode });
        expect(result.isTransient).toBe(true);
        expect(result.requiresReconnect).toBe(false);
      });
    });

    it('should provide user messages for all known errors', () => {
      const allErrors = [
        'ITEM_LOGIN_REQUIRED',
        'INVALID_CREDENTIALS',
        'INVALID_MFA',
        'ITEM_LOCKED',
        'USER_SETUP_REQUIRED',
        'INSTITUTION_DOWN',
        'INSTITUTION_NOT_RESPONDING',
        'RATE_LIMIT_EXCEEDED',
        'PRODUCTS_NOT_READY',
        'ITEM_NOT_FOUND',
        'INVALID_REQUEST',
        'INVALID_API_KEYS',
        'INTERNAL_SERVER_ERROR',
        'PLANNED_MAINTENANCE',
        'ITEM_NO_ERROR',
      ];

      allErrors.forEach((errorCode) => {
        const result = handlePlaidError({ error_code: errorCode });
        expect(result.userMessage).toBeTruthy();
        expect(result.userMessage.length).toBeGreaterThan(0);
      });
    });
  });
});
