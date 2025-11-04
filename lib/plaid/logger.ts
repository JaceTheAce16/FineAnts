/**
 * Plaid Error Logger
 * Logs errors to database and external monitoring services
 */

import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client for logging (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Error severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'critical';

/**
 * Error type categories
 */
export type ErrorType =
  | 'plaid_api'
  | 'sync'
  | 'webhook'
  | 'authentication'
  | 'token_management'
  | 'database'
  | 'network'
  | 'validation';

/**
 * Plaid error logging options
 */
export interface PlaidErrorOptions {
  userId?: string;
  itemId?: string;
  errorCode?: string;
  errorMessage: string;
  errorType: ErrorType;
  endpoint?: string;
  requestData?: any;
  stackTrace?: string;
  severity?: ErrorSeverity;
}

/**
 * Log a Plaid error to the database and external monitoring services
 *
 * This function:
 * - Stores error details in the error_logs table for debugging
 * - Logs to console in development environment
 * - Sends to Sentry in production (when configured)
 *
 * @param options - Error logging options
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * await logPlaidError({
 *   userId: 'user-123',
 *   itemId: 'item-456',
 *   errorCode: 'ITEM_LOGIN_REQUIRED',
 *   errorMessage: 'User needs to reconnect their account',
 *   errorType: 'plaid_api',
 *   endpoint: '/transactions/sync',
 *   severity: 'warning'
 * });
 * ```
 */
export async function logPlaidError(options: PlaidErrorOptions): Promise<void> {
  const {
    userId,
    itemId,
    errorCode,
    errorMessage,
    errorType,
    endpoint,
    requestData,
    stackTrace,
    severity = 'error',
  } = options;

  // Console logging for development
  if (process.env.NODE_ENV === 'development') {
    console.error('🔴 Plaid Error:', {
      severity,
      errorType,
      errorCode,
      errorMessage,
      userId,
      itemId,
      endpoint,
      timestamp: new Date().toISOString(),
    });

    if (stackTrace) {
      console.error('Stack trace:', stackTrace);
    }

    if (requestData) {
      console.error('Request data:', JSON.stringify(requestData, null, 2));
    }
  }

  // Store error in database
  try {
    const { error: insertError } = await supabaseAdmin.from('error_logs').insert({
      user_id: userId || null,
      item_id: itemId || null,
      error_code: errorCode || null,
      error_message: errorMessage,
      error_type: errorType,
      endpoint: endpoint || null,
      request_data: requestData || null,
      stack_trace: stackTrace || null,
      severity,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('Failed to insert error log into database:', insertError);
    }
  } catch (dbError) {
    // Don't let logging errors crash the application
    console.error('Error logging to database:', dbError);
  }

  // Send to Sentry in production (placeholder for future implementation)
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    try {
      // Placeholder for Sentry integration
      // When Sentry is added to the project, uncomment the following:
      //
      // const Sentry = require('@sentry/nextjs');
      // Sentry.captureException(new Error(errorMessage), {
      //   level: severity === 'critical' ? 'fatal' : severity,
      //   tags: {
      //     errorType,
      //     errorCode,
      //     endpoint,
      //   },
      //   extra: {
      //     userId,
      //     itemId,
      //     requestData,
      //   },
      // });

      console.log('[Sentry Placeholder] Would send to Sentry:', {
        severity,
        errorType,
        errorCode,
        errorMessage,
      });
    } catch (sentryError) {
      console.error('Failed to send error to Sentry:', sentryError);
    }
  }
}

/**
 * Log a Plaid API error from a caught exception
 *
 * Extracts error details from Plaid API errors and logs them
 *
 * @param error - The caught error object
 * @param options - Additional context for the error
 *
 * @example
 * ```typescript
 * try {
 *   await plaidClient.transactionsSync({ access_token });
 * } catch (error) {
 *   await logPlaidApiError(error, {
 *     userId: 'user-123',
 *     itemId: 'item-456',
 *     endpoint: '/transactions/sync'
 *   });
 * }
 * ```
 */
export async function logPlaidApiError(
  error: any,
  context: {
    userId?: string;
    itemId?: string;
    endpoint?: string;
    requestData?: any;
  }
): Promise<void> {
  // Extract Plaid error details
  const errorCode = error?.response?.data?.error_code || error?.code || 'UNKNOWN_ERROR';
  const errorMessage = error?.response?.data?.error_message || error?.message || 'Unknown error occurred';
  const stackTrace = error?.stack || undefined;

  // Determine severity based on error code
  let severity: ErrorSeverity = 'error';
  if (errorCode === 'ITEM_LOGIN_REQUIRED' || errorCode === 'PENDING_EXPIRATION') {
    severity = 'warning';
  } else if (errorCode === 'RATE_LIMIT_EXCEEDED' || errorCode === 'INTERNAL_SERVER_ERROR') {
    severity = 'critical';
  }

  await logPlaidError({
    userId: context.userId,
    itemId: context.itemId,
    errorCode,
    errorMessage,
    errorType: 'plaid_api',
    endpoint: context.endpoint,
    requestData: context.requestData,
    stackTrace,
    severity,
  });
}

/**
 * Log a successful operation for monitoring purposes
 *
 * Useful for tracking important operations and debugging
 * Only logs to console in development
 *
 * @param operation - Name of the operation
 * @param details - Additional details about the operation
 *
 * @example
 * ```typescript
 * logSuccess('Transaction sync completed', {
 *   userId: 'user-123',
 *   itemId: 'item-456',
 *   transactionsAdded: 25
 * });
 * ```
 */
export function logSuccess(operation: string, details?: Record<string, any>): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('✅', operation, details ? details : '');
  }
}

/**
 * Log an informational message
 *
 * Used for tracking important events and debugging
 * Only logs to console in development
 *
 * @param message - The message to log
 * @param details - Additional details
 *
 * @example
 * ```typescript
 * logInfo('Starting transaction sync', { userId: 'user-123' });
 * ```
 */
export function logInfo(message: string, details?: Record<string, any>): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('ℹ️', message, details ? details : '');
  }
}

/**
 * Log a warning message
 *
 * Used for non-critical issues that should be monitored
 *
 * @param message - The warning message
 * @param details - Additional details
 *
 * @example
 * ```typescript
 * logWarning('Cursor not found, starting fresh sync', { itemId: 'item-456' });
 * ```
 */
export function logWarning(message: string, details?: Record<string, any>): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️', message, details ? details : '');
  }
}
