/**
 * Standardized API Error Response Handler
 *
 * Provides consistent error responses across all API routes with:
 * - Automatic error tracking
 * - User-friendly messages
 * - Proper HTTP status codes
 * - Structured error format
 *
 * Usage in API routes:
 *   import { handleApiError, ApiError } from '@/lib/api/error-response';
 *
 *   export async function POST(request: Request) {
 *     try {
 *       // your code
 *     } catch (error) {
 *       return handleApiError(error, 'create-checkout-session');
 *     }
 *   }
 */

import { NextResponse } from 'next/server';
import { trackError, ErrorSeverity } from '@/lib/monitoring/error-tracker';
import { handleStripeError, isRetryableError as isStripeRetryable, getErrorSeverity as getStripeSeverity } from '@/lib/stripe/error-handler';
import { handlePlaidError, isTransientError as isPlaidTransient } from '@/lib/plaid/error-handler';
import Stripe from 'stripe';

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  error: string;               // User-friendly message
  code?: string;               // Error code for client-side handling
  severity: ErrorSeverity;     // Error severity level
  retryable: boolean;          // Whether client should retry
  requestId?: string;          // For support/debugging
  timestamp: string;           // ISO timestamp
}

/**
 * Custom API error class with additional metadata
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public retryable: boolean = false,
    public severity: ErrorSeverity = 'error'
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Common API errors - use these for consistency
 */
export const ApiErrors = {
  UNAUTHORIZED: new ApiError('Unauthorized', 401, 'UNAUTHORIZED', false, 'warning'),
  FORBIDDEN: new ApiError('Forbidden', 403, 'FORBIDDEN', false, 'warning'),
  NOT_FOUND: new ApiError('Resource not found', 404, 'NOT_FOUND', false, 'info'),
  BAD_REQUEST: new ApiError('Invalid request', 400, 'BAD_REQUEST', false, 'info'),
  RATE_LIMITED: new ApiError('Too many requests', 429, 'RATE_LIMITED', true, 'warning'),
  INTERNAL_ERROR: new ApiError('Internal server error', 500, 'INTERNAL_ERROR', true, 'critical'),
  SERVICE_UNAVAILABLE: new ApiError('Service temporarily unavailable', 503, 'SERVICE_UNAVAILABLE', true, 'error'),
};

/**
 * Main error handler for API routes
 * Automatically determines error type and tracks it
 */
export function handleApiError(
  error: unknown,
  context: string,
  additionalContext?: Record<string, any>
): NextResponse<ApiErrorResponse> {
  // Extract error details
  const errorInfo = extractErrorInfo(error);

  // Track the error
  trackError(error, {
    severity: errorInfo.severity,
    context: {
      action: context,
      ...additionalContext,
    },
  });

  // Build response
  const response: ApiErrorResponse = {
    error: errorInfo.userMessage,
    code: errorInfo.code,
    severity: errorInfo.severity,
    retryable: errorInfo.retryable,
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
  };

  // Return NextResponse with appropriate status code
  return NextResponse.json(response, {
    status: errorInfo.statusCode,
    headers: {
      'X-Request-ID': response.requestId,
    },
  });
}

/**
 * Extract error information from various error types
 */
interface ErrorInfo {
  userMessage: string;
  statusCode: number;
  code?: string;
  severity: ErrorSeverity;
  retryable: boolean;
}

function extractErrorInfo(error: unknown): ErrorInfo {
  // Handle ApiError (our custom errors)
  if (error instanceof ApiError) {
    return {
      userMessage: error.message,
      statusCode: error.statusCode,
      code: error.code,
      severity: error.severity,
      retryable: error.retryable,
    };
  }

  // Handle Stripe errors
  if (error instanceof Stripe.errors.StripeError) {
    return {
      userMessage: handleStripeError(error),
      statusCode: error.statusCode || 500,
      code: error.code,
      severity: getStripeSeverity(error),
      retryable: isStripeRetryable(error),
    };
  }

  // Handle Plaid errors
  if (isPlaidError(error)) {
    const plaidErrorInfo = handlePlaidError(error);
    return {
      userMessage: plaidErrorInfo.userMessage,
      statusCode: 500,  // Plaid errors are typically 500
      code: plaidErrorInfo.errorCode,
      severity: plaidErrorInfo.isTransient ? 'warning' : 'error',
      retryable: plaidErrorInfo.isTransient,
    };
  }

  // Handle Supabase errors
  if (isSupabaseError(error)) {
    return handleSupabaseError(error);
  }

  // Handle standard JavaScript errors
  if (error instanceof Error) {
    return {
      userMessage: 'An unexpected error occurred. Please try again.',
      statusCode: 500,
      severity: 'error',
      retryable: false,
    };
  }

  // Handle unknown error types
  return {
    userMessage: 'An unknown error occurred. Please contact support.',
    statusCode: 500,
    severity: 'critical',
    retryable: false,
  };
}

// =============================================================================
// DOMAIN-SPECIFIC ERROR HANDLERS
// =============================================================================

/**
 * Handle authentication errors
 */
export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof Error && error.message.includes('Invalid login')) {
    return NextResponse.json(
      {
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
        severity: 'info',
        retryable: false,
        timestamp: new Date().toISOString(),
      } as ApiErrorResponse,
      { status: 401 }
    );
  }

  if (error instanceof Error && error.message.includes('Email already')) {
    return NextResponse.json(
      {
        error: 'An account with this email already exists',
        code: 'EMAIL_EXISTS',
        severity: 'info',
        retryable: false,
        timestamp: new Date().toISOString(),
      } as ApiErrorResponse,
      { status: 409 }
    );
  }

  return handleApiError(error, 'authentication');
}

/**
 * Handle validation errors (for use with Zod or similar)
 */
export function handleValidationError(
  validationErrors: Array<{ field: string; message: string }>
): NextResponse {
  return NextResponse.json(
    {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      severity: 'info',
      retryable: false,
      timestamp: new Date().toISOString(),
      details: validationErrors,
    },
    { status: 400 }
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if error is a Plaid error
 */
function isPlaidError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error_code' in error &&
    typeof (error as any).error_code === 'string'
  );
}

/**
 * Check if error is a Supabase error
 */
function isSupabaseError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as any).code === 'string'
  );
}

/**
 * Handle Supabase-specific errors
 */
function handleSupabaseError(error: any): ErrorInfo {
  const code = error.code;

  // Handle specific Supabase error codes
  switch (code) {
    case '23505': // Unique violation
      return {
        userMessage: 'This record already exists',
        statusCode: 409,
        code: 'DUPLICATE_RECORD',
        severity: 'info',
        retryable: false,
      };

    case '23503': // Foreign key violation
      return {
        userMessage: 'Related record not found',
        statusCode: 400,
        code: 'INVALID_REFERENCE',
        severity: 'info',
        retryable: false,
      };

    case '42501': // Insufficient privilege
      return {
        userMessage: 'Permission denied',
        statusCode: 403,
        code: 'PERMISSION_DENIED',
        severity: 'warning',
        retryable: false,
      };

    case 'PGRST116': // JWT expired
      return {
        userMessage: 'Session expired. Please log in again.',
        statusCode: 401,
        code: 'SESSION_EXPIRED',
        severity: 'info',
        retryable: false,
      };

    default:
      return {
        userMessage: 'Database operation failed',
        statusCode: 500,
        code: 'DATABASE_ERROR',
        severity: 'error',
        retryable: true,
      };
  }
}

/**
 * Generate a unique request ID for tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// =============================================================================
// UTILITY FUNCTIONS FOR API ROUTES
// =============================================================================

/**
 * Wrap an API route handler with error handling
 */
export function withErrorHandling(
  handler: (request: Request) => Promise<Response>,
  context: string
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      return handleApiError(error, context);
    }
  };
}

/**
 * Assert that a condition is true, throw ApiError if not
 */
export function assert(condition: boolean, error: ApiError): asserts condition {
  if (!condition) {
    throw error;
  }
}

/**
 * Require that a value is not null/undefined, throw ApiError if it is
 */
export function requireParam<T>(
  value: T | null | undefined,
  paramName: string
): T {
  if (value === null || value === undefined) {
    throw new ApiError(
      `Missing required parameter: ${paramName}`,
      400,
      'MISSING_PARAMETER',
      false,
      'info'
    );
  }
  return value;
}

/**
 * Create a successful API response
 */
export function successResponse<T>(
  data: T,
  status: number = 200
): NextResponse<T> {
  return NextResponse.json(data, { status });
}
