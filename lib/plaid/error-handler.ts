/**
 * Plaid Error Handler
 * Maps Plaid error codes to user-friendly messages and provides error metadata
 */

/**
 * Plaid error response structure
 */
export interface PlaidErrorResponse {
  userMessage: string;
  errorCode: string;
  requiresReconnect: boolean;
  isTransient: boolean;
  suggestedAction?: string;
}

/**
 * Known Plaid error codes and their characteristics
 */
const PLAID_ERROR_MAPPINGS: Record<
  string,
  Omit<PlaidErrorResponse, 'errorCode'>
> = {
  // Authentication errors - require user action
  ITEM_LOGIN_REQUIRED: {
    userMessage:
      'Your account connection has expired. Please reconnect your account to continue syncing data.',
    requiresReconnect: true,
    isTransient: false,
    suggestedAction: 'Click "Reconnect" to update your credentials.',
  },
  INVALID_CREDENTIALS: {
    userMessage:
      'The username or password you provided is incorrect. Please check your credentials and try again.',
    requiresReconnect: true,
    isTransient: false,
    suggestedAction: 'Verify your login credentials with your bank.',
  },
  INVALID_MFA: {
    userMessage:
      'The multi-factor authentication code is invalid or has expired. Please try again.',
    requiresReconnect: true,
    isTransient: false,
    suggestedAction: 'Request a new verification code from your institution.',
  },

  // Account lockout errors
  ITEM_LOCKED: {
    userMessage:
      'Your account has been locked by your financial institution. Please contact your bank to unlock it.',
    requiresReconnect: true,
    isTransient: false,
    suggestedAction: 'Contact your financial institution for assistance.',
  },
  USER_SETUP_REQUIRED: {
    userMessage:
      'Your account requires additional setup at your financial institution before it can be connected.',
    requiresReconnect: true,
    isTransient: false,
    suggestedAction: 'Complete the setup process with your institution.',
  },

  // Transient errors - may resolve automatically
  INSTITUTION_DOWN: {
    userMessage:
      'Your financial institution is currently unavailable. This is usually temporary.',
    requiresReconnect: false,
    isTransient: true,
    suggestedAction: 'Please try again in a few minutes.',
  },
  INSTITUTION_NOT_RESPONDING: {
    userMessage:
      'Your financial institution is not responding. This is typically temporary.',
    requiresReconnect: false,
    isTransient: true,
    suggestedAction: 'We will automatically retry this connection.',
  },
  RATE_LIMIT_EXCEEDED: {
    userMessage:
      'Too many requests have been made. Please wait a moment before trying again.',
    requiresReconnect: false,
    isTransient: true,
    suggestedAction: 'Wait a few minutes before retrying.',
  },

  // Product-specific errors
  PRODUCTS_NOT_READY: {
    userMessage:
      'Account data is still being retrieved. Please try again in a few moments.',
    requiresReconnect: false,
    isTransient: true,
    suggestedAction: 'Wait 30 seconds and try again.',
  },
  ITEM_NOT_FOUND: {
    userMessage:
      'The account connection could not be found. It may have been removed.',
    requiresReconnect: true,
    isTransient: false,
    suggestedAction: 'Please reconnect your account.',
  },

  // API errors
  INVALID_REQUEST: {
    userMessage:
      'An error occurred while processing your request. Please try again.',
    requiresReconnect: false,
    isTransient: false,
    suggestedAction: 'Contact support if this issue persists.',
  },
  INVALID_API_KEYS: {
    userMessage:
      'There is a configuration error. Please contact support for assistance.',
    requiresReconnect: false,
    isTransient: false,
    suggestedAction: 'Contact support for assistance.',
  },
  INTERNAL_SERVER_ERROR: {
    userMessage:
      'A server error occurred. We have been notified and are working to resolve it.',
    requiresReconnect: false,
    isTransient: true,
    suggestedAction: 'Please try again later.',
  },

  // Network errors
  PLANNED_MAINTENANCE: {
    userMessage:
      'Plaid is undergoing scheduled maintenance. Service will resume shortly.',
    requiresReconnect: false,
    isTransient: true,
    suggestedAction: 'Check back in 30 minutes.',
  },

  // Item errors
  ITEM_NO_ERROR: {
    userMessage: 'No error detected. Your account is connected successfully.',
    requiresReconnect: false,
    isTransient: false,
  },
};

/**
 * Handle Plaid API errors and map them to user-friendly responses
 * @param error Error object from Plaid API
 * @returns Structured error response with user message and metadata
 */
export function handlePlaidError(error: unknown): PlaidErrorResponse {
  // Handle null/undefined errors
  if (!error) {
    return {
      userMessage: 'An unknown error occurred. Please try again.',
      errorCode: 'UNKNOWN_ERROR',
      requiresReconnect: false,
      isTransient: false,
      suggestedAction: 'Contact support if this issue persists.',
    };
  }

  // Extract error code from Plaid error object
  let errorCode = 'UNKNOWN_ERROR';
  let displayMessage: string | undefined;

  // Handle Plaid API error structure
  if (
    typeof error === 'object' &&
    error !== null &&
    'error_code' in error &&
    typeof error.error_code === 'string'
  ) {
    errorCode = error.error_code;

    // Get display message if available
    if ('display_message' in error && typeof error.display_message === 'string') {
      displayMessage = error.display_message;
    }
  }

  // Handle JavaScript Error objects
  if (error instanceof Error && errorCode === 'UNKNOWN_ERROR') {
    // Try to extract Plaid error code from error message
    const match = error.message.match(/error_code:\s*(\w+)/i);
    if (match) {
      errorCode = match[1];
    }
  }

  // Look up error mapping
  const mapping = PLAID_ERROR_MAPPINGS[errorCode];

  if (mapping) {
    return {
      ...mapping,
      errorCode,
      // Use Plaid's display message if available, otherwise use our mapping
      userMessage: displayMessage || mapping.userMessage,
    };
  }

  // Default fallback for unknown errors
  return {
    userMessage:
      displayMessage ||
      'An unexpected error occurred while connecting to your financial institution. Please try again.',
    errorCode,
    requiresReconnect: false,
    isTransient: false,
    suggestedAction: 'Contact support if this issue persists.',
  };
}

/**
 * Check if an error requires user reconnection
 * @param error Error object from Plaid API
 * @returns True if error requires reconnection
 */
export function requiresReconnection(error: unknown): boolean {
  return handlePlaidError(error).requiresReconnect;
}

/**
 * Check if an error is transient and may resolve with retry
 * @param error Error object from Plaid API
 * @returns True if error is transient
 */
export function isTransientError(error: unknown): boolean {
  return handlePlaidError(error).isTransient;
}

/**
 * Get suggested user action for an error
 * @param error Error object from Plaid API
 * @returns Suggested action string or undefined
 */
export function getSuggestedAction(error: unknown): string | undefined {
  return handlePlaidError(error).suggestedAction;
}
