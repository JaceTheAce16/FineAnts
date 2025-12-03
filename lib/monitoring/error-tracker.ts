/**
 * Centralized Error Tracking and Monitoring
 *
 * This module provides a unified interface for error tracking across the application.
 * It supports multiple backends (Sentry, console, etc.) and provides structured logging.
 *
 * Usage:
 *   import { trackError, trackEvent, ErrorSeverity } from '@/lib/monitoring/error-tracker';
 *
 *   try {
 *     // risky operation
 *   } catch (error) {
 *     trackError(error, {
 *       severity: 'error',
 *       context: { userId: user.id, action: 'payment' }
 *     });
 *   }
 */

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorContext {
  userId?: string;
  action?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export interface ErrorTrackingOptions {
  severity?: ErrorSeverity;
  context?: ErrorContext;
  fingerprint?: string[];  // For grouping similar errors
  tags?: Record<string, string>;
}

/**
 * Initialize error tracking service
 * Call this in your app initialization (e.g., root layout)
 */
export function initErrorTracking() {
  if (typeof window === 'undefined') {
    // Server-side initialization
    console.log('[Error Tracker] Initialized (Server)');

    // TODO: Initialize Sentry SDK here
    // Sentry.init({
    //   dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    //   environment: process.env.NODE_ENV,
    //   tracesSampleRate: 0.1,
    // });
  } else {
    // Client-side initialization
    console.log('[Error Tracker] Initialized (Client)');

    // TODO: Initialize client-side error tracking
  }
}

/**
 * Track an error with context
 */
export function trackError(
  error: unknown,
  options: ErrorTrackingOptions = {}
): void {
  const { severity = 'error', context = {}, fingerprint, tags } = options;

  // Extract error details
  const errorDetails = extractErrorDetails(error);

  // Log to console (always)
  logToConsole(severity, errorDetails, context);

  // Send to external service (if configured)
  if (shouldSendToExternalService()) {
    sendToErrorTracking({
      ...errorDetails,
      severity,
      context,
      fingerprint,
      tags,
    });
  }

  // Track in analytics (if available)
  trackInAnalytics('error', {
    errorType: errorDetails.type,
    errorMessage: errorDetails.message,
    severity,
    ...context,
  });
}

/**
 * Track a custom event (for monitoring important actions)
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, any>
): void {
  console.log(`[Event] ${eventName}`, properties);

  // TODO: Send to analytics service
  // analytics.track(eventName, properties);
}

/**
 * Track a performance metric
 */
export function trackPerformance(
  metricName: string,
  duration: number,
  metadata?: Record<string, any>
): void {
  console.log(`[Performance] ${metricName}: ${duration}ms`, metadata);

  // TODO: Send to monitoring service
  // monitoring.recordMetric(metricName, duration, metadata);
}

/**
 * Create a breadcrumb for debugging (shows user actions leading to error)
 */
export function addBreadcrumb(
  message: string,
  category: string = 'user-action',
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
): void {
  // TODO: Add to Sentry breadcrumbs
  // Sentry.addBreadcrumb({ message, category, level, data });

  console.log(`[Breadcrumb:${category}] ${message}`, data);
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  subscriptionTier?: string;
}): void {
  // TODO: Set in Sentry
  // Sentry.setUser({
  //   id: user.id,
  //   email: user.email,
  //   subscriptionTier: user.subscriptionTier,
  // });

  console.log('[User Context] Set:', user.id);
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext(): void {
  // TODO: Clear in Sentry
  // Sentry.setUser(null);

  console.log('[User Context] Cleared');
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

interface ErrorDetails {
  type: string;
  message: string;
  stack?: string;
  code?: string;
}

function extractErrorDetails(error: unknown): ErrorDetails {
  // Handle Error objects
  if (error instanceof Error) {
    return {
      type: error.name || 'Error',
      message: error.message,
      stack: error.stack,
    };
  }

  // Handle Stripe errors
  if (typeof error === 'object' && error !== null && 'type' in error) {
    const stripeError = error as any;
    return {
      type: stripeError.type || 'StripeError',
      message: stripeError.message || 'Unknown Stripe error',
      code: stripeError.code,
      stack: stripeError.stack,
    };
  }

  // Handle Plaid errors
  if (typeof error === 'object' && error !== null && 'error_code' in error) {
    const plaidError = error as any;
    return {
      type: 'PlaidError',
      message: plaidError.display_message || plaidError.error_message || 'Unknown Plaid error',
      code: plaidError.error_code,
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      type: 'StringError',
      message: error,
    };
  }

  // Handle unknown error types
  return {
    type: 'UnknownError',
    message: String(error),
  };
}

function logToConsole(
  severity: ErrorSeverity,
  errorDetails: ErrorDetails,
  context: ErrorContext
): void {
  const timestamp = new Date().toISOString();
  const logFn = getConsoleFn(severity);

  logFn(
    `[${timestamp}] [${severity.toUpperCase()}] ${errorDetails.type}: ${errorDetails.message}`,
    {
      error: errorDetails,
      context,
    }
  );
}

function getConsoleFn(severity: ErrorSeverity): typeof console.log {
  switch (severity) {
    case 'info':
      return console.info;
    case 'warning':
      return console.warn;
    case 'error':
    case 'critical':
      return console.error;
    default:
      return console.log;
  }
}

function shouldSendToExternalService(): boolean {
  // Don't send in development
  if (process.env.NODE_ENV === 'development') {
    return false;
  }

  // Check if external service is configured
  return !!process.env.NEXT_PUBLIC_SENTRY_DSN;
}

function sendToErrorTracking(payload: any): void {
  // TODO: Implement Sentry SDK call
  // Sentry.captureException(payload.error, {
  //   level: payload.severity,
  //   tags: payload.tags,
  //   contexts: { custom: payload.context },
  //   fingerprint: payload.fingerprint,
  // });
}

function trackInAnalytics(eventName: string, properties: Record<string, any>): void {
  // TODO: Send to analytics service
  // analytics.track(eventName, properties);
}

// =============================================================================
// ERROR HELPERS FOR SPECIFIC DOMAINS
// =============================================================================

/**
 * Track a payment error
 */
export function trackPaymentError(
  error: unknown,
  paymentContext: {
    userId: string;
    amount?: number;
    currency?: string;
    paymentMethodType?: string;
  }
): void {
  trackError(error, {
    severity: 'critical',  // Payments are always critical
    context: {
      ...paymentContext,
      action: 'payment',
    },
    tags: {
      domain: 'payment',
      provider: 'stripe',
    },
    fingerprint: ['payment-error', paymentContext.userId],
  });
}

/**
 * Track a webhook processing error
 */
export function trackWebhookError(
  error: unknown,
  webhookContext: {
    provider: 'stripe' | 'plaid';
    eventType: string;
    eventId: string;
    attemptNumber?: number;
  }
): void {
  trackError(error, {
    severity: 'error',
    context: {
      ...webhookContext,
      action: 'webhook_processing',
    },
    tags: {
      domain: 'webhook',
      provider: webhookContext.provider,
    },
    fingerprint: ['webhook-error', webhookContext.eventType, webhookContext.eventId],
  });
}

/**
 * Track a Plaid sync error
 */
export function trackPlaidError(
  error: unknown,
  plaidContext: {
    userId: string;
    itemId?: string;
    institutionName?: string;
    operation: 'connect' | 'sync' | 'disconnect';
  }
): void {
  trackError(error, {
    severity: 'error',
    context: {
      ...plaidContext,
      action: 'plaid_operation',
    },
    tags: {
      domain: 'banking',
      provider: 'plaid',
    },
    fingerprint: ['plaid-error', plaidContext.operation, plaidContext.userId],
  });
}

/**
 * Track an authentication error
 */
export function trackAuthError(
  error: unknown,
  authContext: {
    action: 'login' | 'signup' | 'logout' | 'session_refresh';
    email?: string;
  }
): void {
  trackError(error, {
    severity: 'warning',
    context: {
      ...authContext,
      action: 'authentication',
    },
    tags: {
      domain: 'auth',
    },
    fingerprint: ['auth-error', authContext.action],
  });
}

/**
 * Track a database error
 */
export function trackDatabaseError(
  error: unknown,
  dbContext: {
    operation: 'select' | 'insert' | 'update' | 'delete';
    table: string;
    userId?: string;
  }
): void {
  trackError(error, {
    severity: 'critical',  // Database errors are critical
    context: {
      ...dbContext,
      action: 'database_operation',
    },
    tags: {
      domain: 'database',
    },
    fingerprint: ['db-error', dbContext.operation, dbContext.table],
  });
}

// =============================================================================
// MONITORING HELPERS
// =============================================================================

/**
 * Wrap an async function with error tracking
 */
export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: ErrorTrackingOptions = {}
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      trackError(error, options);
      throw error;  // Re-throw to maintain normal error flow
    }
  }) as T;
}

/**
 * Wrap an async function with performance tracking
 */
export function withPerformanceTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  metricName: string
): T {
  return (async (...args: any[]) => {
    const start = performance.now();
    try {
      const result = await fn(...args);
      const duration = performance.now() - start;
      trackPerformance(metricName, duration, { success: true });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      trackPerformance(metricName, duration, { success: false });
      throw error;
    }
  }) as T;
}
