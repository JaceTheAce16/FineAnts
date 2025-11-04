/**
 * Tests for Plaid Error Logger
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock function
const mockInsert = vi.fn();

// Mock Supabase client module
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => ({
        insert: mockInsert,
      })),
    })),
  };
});

// Import after mocking
import {
  logPlaidError,
  logPlaidApiError,
  logSuccess,
  logInfo,
  logWarning,
  type PlaidErrorOptions,
} from '@/lib/plaid/logger';

describe('Plaid Logger', () => {
  let originalEnv: string | undefined;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env.NODE_ENV;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('logPlaidError', () => {
    it('should log error to database with all fields', async () => {
      mockInsert.mockResolvedValue({ data: [], error: null });

      const errorOptions: PlaidErrorOptions = {
        userId: 'user-123',
        itemId: 'item-456',
        errorCode: 'ITEM_LOGIN_REQUIRED',
        errorMessage: 'User needs to reconnect account',
        errorType: 'plaid_api',
        endpoint: '/transactions/sync',
        requestData: { access_token: 'test-token' },
        stackTrace: 'Error: test\n  at test.ts:10',
        severity: 'warning',
      };

      await logPlaidError(errorOptions);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          item_id: 'item-456',
          error_code: 'ITEM_LOGIN_REQUIRED',
          error_message: 'User needs to reconnect account',
          error_type: 'plaid_api',
          endpoint: '/transactions/sync',
          request_data: { access_token: 'test-token' },
          stack_trace: 'Error: test\n  at test.ts:10',
          severity: 'warning',
        })
      );
    });

    it('should handle optional fields as null', async () => {
      mockInsert.mockResolvedValue({ data: [], error: null });

      await logPlaidError({
        errorMessage: 'Simple error',
        errorType: 'sync',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: null,
          item_id: null,
          error_code: null,
          error_message: 'Simple error',
          error_type: 'sync',
          endpoint: null,
          request_data: null,
          stack_trace: null,
          severity: 'error', // Default severity
        })
      );
    });

    it('should default severity to "error"', async () => {
      mockInsert.mockResolvedValue({ data: [], error: null });

      await logPlaidError({
        errorMessage: 'Test error',
        errorType: 'database',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
        })
      );
    });

    it('should log to console in development environment', async () => {
      process.env.NODE_ENV = 'development';
      mockInsert.mockResolvedValue({ data: [], error: null });

      await logPlaidError({
        userId: 'user-123',
        errorCode: 'TEST_ERROR',
        errorMessage: 'Test error message',
        errorType: 'plaid_api',
        severity: 'error',
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '🔴 Plaid Error:',
        expect.objectContaining({
          severity: 'error',
          errorType: 'plaid_api',
          errorCode: 'TEST_ERROR',
          errorMessage: 'Test error message',
          userId: 'user-123',
        })
      );
    });

    it('should log stack trace in development', async () => {
      process.env.NODE_ENV = 'development';
      mockInsert.mockResolvedValue({ data: [], error: null });

      await logPlaidError({
        errorMessage: 'Error with stack',
        errorType: 'plaid_api',
        stackTrace: 'Error: test\n  at test.ts:10',
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Stack trace:', 'Error: test\n  at test.ts:10');
    });

    it('should log request data in development', async () => {
      process.env.NODE_ENV = 'development';
      mockInsert.mockResolvedValue({ data: [], error: null });

      const requestData = { foo: 'bar', nested: { value: 123 } };

      await logPlaidError({
        errorMessage: 'Error with request data',
        errorType: 'plaid_api',
        requestData,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Request data:',
        JSON.stringify(requestData, null, 2)
      );
    });

    it('should not log to console in production environment', async () => {
      process.env.NODE_ENV = 'production';
      mockInsert.mockResolvedValue({ data: [], error: null });

      await logPlaidError({
        errorMessage: 'Production error',
        errorType: 'plaid_api',
      });

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('🔴 Plaid Error:'),
        expect.anything()
      );
    });

    it('should handle database insert errors gracefully', async () => {
      mockInsert.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      // Should not throw
      await expect(
        logPlaidError({
          errorMessage: 'Test error',
          errorType: 'plaid_api',
        })
      ).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to insert error log into database:',
        expect.objectContaining({ message: 'Database connection failed' })
      );
    });

    it('should handle database exceptions gracefully', async () => {
      mockInsert.mockRejectedValue(new Error('Database exception'));

      // Should not throw
      await expect(
        logPlaidError({
          errorMessage: 'Test error',
          errorType: 'plaid_api',
        })
      ).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error logging to database:',
        expect.any(Error)
      );
    });

    it('should include Sentry placeholder in production with SENTRY_DSN', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      mockInsert.mockResolvedValue({ data: [], error: null });

      await logPlaidError({
        errorCode: 'SENTRY_TEST',
        errorMessage: 'Test Sentry integration',
        errorType: 'plaid_api',
        severity: 'critical',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Sentry Placeholder] Would send to Sentry:',
        expect.objectContaining({
          severity: 'critical',
          errorType: 'plaid_api',
          errorCode: 'SENTRY_TEST',
        })
      );

      delete process.env.SENTRY_DSN;
    });
  });

  describe('logPlaidApiError', () => {
    it('should extract error details from Plaid API error', async () => {
      mockInsert.mockResolvedValue({ data: [], error: null });

      const plaidError = {
        response: {
          data: {
            error_code: 'ITEM_LOGIN_REQUIRED',
            error_message: 'The login details of this item have changed',
          },
        },
        stack: 'Error: ITEM_LOGIN_REQUIRED\n  at plaid.ts:100',
      };

      await logPlaidApiError(plaidError, {
        userId: 'user-123',
        itemId: 'item-456',
        endpoint: '/transactions/sync',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          item_id: 'item-456',
          error_code: 'ITEM_LOGIN_REQUIRED',
          error_message: 'The login details of this item have changed',
          error_type: 'plaid_api',
          endpoint: '/transactions/sync',
          severity: 'warning', // ITEM_LOGIN_REQUIRED is a warning
        })
      );
    });

    it('should determine severity as "warning" for ITEM_LOGIN_REQUIRED', async () => {
      mockInsert.mockResolvedValue({ data: [], error: null });

      await logPlaidApiError(
        {
          response: {
            data: {
              error_code: 'ITEM_LOGIN_REQUIRED',
              error_message: 'Login required',
            },
          },
        },
        { userId: 'user-123' }
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warning',
        })
      );
    });

    it('should determine severity as "warning" for PENDING_EXPIRATION', async () => {
      mockInsert.mockResolvedValue({ data: [], error: null });

      await logPlaidApiError(
        {
          response: {
            data: {
              error_code: 'PENDING_EXPIRATION',
              error_message: 'Item will expire soon',
            },
          },
        },
        { itemId: 'item-123' }
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warning',
        })
      );
    });

    it('should determine severity as "critical" for RATE_LIMIT_EXCEEDED', async () => {
      mockInsert.mockResolvedValue({ data: [], error: null });

      await logPlaidApiError(
        {
          response: {
            data: {
              error_code: 'RATE_LIMIT_EXCEEDED',
              error_message: 'Rate limit exceeded',
            },
          },
        },
        { userId: 'user-123' }
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
        })
      );
    });

    it('should determine severity as "critical" for INTERNAL_SERVER_ERROR', async () => {
      mockInsert.mockResolvedValue({ data: [], error: null });

      await logPlaidApiError(
        {
          response: {
            data: {
              error_code: 'INTERNAL_SERVER_ERROR',
              error_message: 'Internal server error',
            },
          },
        },
        { userId: 'user-123' }
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
        })
      );
    });

    it('should default severity to "error" for other errors', async () => {
      mockInsert.mockResolvedValue({ data: [], error: null });

      await logPlaidApiError(
        {
          response: {
            data: {
              error_code: 'INVALID_REQUEST',
              error_message: 'Invalid request',
            },
          },
        },
        { userId: 'user-123' }
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
        })
      );
    });

    it('should handle errors without response.data structure', async () => {
      mockInsert.mockResolvedValue({ data: [], error: null });

      const genericError = {
        code: 'GENERIC_ERROR',
        message: 'Something went wrong',
        stack: 'Error: Something went wrong',
      };

      await logPlaidApiError(genericError, {
        userId: 'user-123',
        endpoint: '/test',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          error_code: 'GENERIC_ERROR',
          error_message: 'Something went wrong',
        })
      );
    });

    it('should handle unknown error format', async () => {
      mockInsert.mockResolvedValue({ data: [], error: null });

      await logPlaidApiError({}, { userId: 'user-123' });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          error_code: 'UNKNOWN_ERROR',
          error_message: 'Unknown error occurred',
        })
      );
    });

    it('should include request data in log', async () => {
      mockInsert.mockResolvedValue({ data: [], error: null });

      const requestData = { access_token: 'test-token', count: 100 };

      await logPlaidApiError(
        {
          response: {
            data: {
              error_code: 'INVALID_ACCESS_TOKEN',
              error_message: 'Invalid token',
            },
          },
        },
        {
          userId: 'user-123',
          requestData,
        }
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          request_data: requestData,
        })
      );
    });
  });

  describe('logSuccess', () => {
    it('should log success message in development', () => {
      process.env.NODE_ENV = 'development';

      logSuccess('Transaction sync completed', { count: 25 });

      expect(consoleLogSpy).toHaveBeenCalledWith('✅', 'Transaction sync completed', { count: 25 });
    });

    it('should not log in production', () => {
      process.env.NODE_ENV = 'production';

      logSuccess('Operation completed');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should work without details', () => {
      process.env.NODE_ENV = 'development';

      logSuccess('Operation completed');

      expect(consoleLogSpy).toHaveBeenCalledWith('✅', 'Operation completed', '');
    });
  });

  describe('logInfo', () => {
    it('should log info message in development', () => {
      process.env.NODE_ENV = 'development';

      logInfo('Starting sync', { userId: 'user-123' });

      expect(consoleLogSpy).toHaveBeenCalledWith('ℹ️', 'Starting sync', { userId: 'user-123' });
    });

    it('should not log in production', () => {
      process.env.NODE_ENV = 'production';

      logInfo('Some info');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should work without details', () => {
      process.env.NODE_ENV = 'development';

      logInfo('Information message');

      expect(consoleLogSpy).toHaveBeenCalledWith('ℹ️', 'Information message', '');
    });
  });

  describe('logWarning', () => {
    it('should log warning message in development', () => {
      process.env.NODE_ENV = 'development';

      logWarning('Cursor not found', { itemId: 'item-456' });

      expect(consoleWarnSpy).toHaveBeenCalledWith('⚠️', 'Cursor not found', { itemId: 'item-456' });
    });

    it('should not log in production', () => {
      process.env.NODE_ENV = 'production';

      logWarning('Warning message');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should work without details', () => {
      process.env.NODE_ENV = 'development';

      logWarning('Warning message');

      expect(consoleWarnSpy).toHaveBeenCalledWith('⚠️', 'Warning message', '');
    });
  });
});
