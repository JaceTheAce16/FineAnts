/**
 * Retry Handler for Plaid API calls
 * Implements exponential backoff for transient errors
 */

import { isTransientError } from './error-handler';

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // in milliseconds
  maxDelay: number; // maximum delay in milliseconds
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 4,
  baseDelay: 1000, // 1 second
  maxDelay: 8000, // 8 seconds
};

/**
 * Calculate exponential backoff delay
 * Returns: baseDelay * 2^(attempt - 1)
 * Example: 1s, 2s, 4s, 8s for baseDelay=1000
 */
function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  const delay = baseDelay * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param config Retry configuration
 * @returns Result of the function
 * @throws Error after max retries exceeded
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const mergedConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: unknown;
  let attempt = 0;

  while (attempt <= mergedConfig.maxRetries) {
    try {
      attempt++;

      // First attempt - no delay
      if (attempt === 1) {
        return await fn();
      }

      // Subsequent attempts - apply backoff delay
      const delay = calculateBackoffDelay(
        attempt - 1,
        mergedConfig.baseDelay,
        mergedConfig.maxDelay
      );

      // Log retry attempt
      if (mergedConfig.onRetry) {
        mergedConfig.onRetry(attempt, lastError, delay);
      } else {
        console.log(
          `Retry attempt ${attempt}/${mergedConfig.maxRetries} after ${delay}ms delay`
        );
      }

      await sleep(delay);
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is transient and retryable
      if (!isTransientError(error)) {
        console.log('Non-transient error detected, not retrying');
        throw error;
      }

      // If we've exhausted all retries, throw the last error
      if (attempt > mergedConfig.maxRetries) {
        console.error(
          `Max retries (${mergedConfig.maxRetries}) exceeded. Giving up.`
        );
        throw error;
      }
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Wrapper for Plaid API calls with automatic retry
 * @param apiCall Function that makes the Plaid API call
 * @param config Optional retry configuration
 * @returns Result of the API call
 */
export async function retryPlaidApiCall<T>(
  apiCall: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  return withRetry(apiCall, {
    ...config,
    onRetry: (attempt, error, delay) => {
      console.log(`[Plaid Retry] Attempt ${attempt} after ${delay}ms`);
      if (error && typeof error === 'object' && 'error_code' in error) {
        console.log(`[Plaid Retry] Error code: ${(error as any).error_code}`);
      }

      if (config.onRetry) {
        config.onRetry(attempt, error, delay);
      }
    },
  });
}

/**
 * Create a retry wrapper for a specific API function
 * @param fn Function to wrap with retry logic
 * @param config Optional retry configuration
 * @returns Wrapped function with retry logic
 */
export function withRetryWrapper<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config: Partial<RetryConfig> = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    return withRetry(() => fn(...args), config);
  };
}
