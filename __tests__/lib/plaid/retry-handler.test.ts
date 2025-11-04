/**
 * Tests for Retry Handler with Exponential Backoff
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withRetry, retryPlaidApiCall, withRetryWrapper } from '@/lib/plaid/retry-handler';

// Mock the error handler
vi.mock('@/lib/plaid/error-handler', () => ({
  isTransientError: vi.fn((error: any) => {
    if (error && typeof error === 'object' && 'error_code' in error) {
      return ['INSTITUTION_DOWN', 'RATE_LIMIT_EXCEEDED', 'INTERNAL_SERVER_ERROR'].includes(
        error.error_code
      );
    }
    return false;
  }),
}));

describe('Retry Handler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('withRetry', () => {
    it('should return result on first attempt if successful', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = withRetry(fn);
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ error_code: 'INSTITUTION_DOWN' })
        .mockResolvedValue('success');

      const promise = withRetry(fn);

      // Fast-forward through the retry delay
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should implement exponential backoff: 1s, 2s, 4s, 8s', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ error_code: 'INSTITUTION_DOWN' })
        .mockRejectedValueOnce({ error_code: 'INSTITUTION_DOWN' })
        .mockRejectedValueOnce({ error_code: 'INSTITUTION_DOWN' })
        .mockRejectedValueOnce({ error_code: 'INSTITUTION_DOWN' })
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      const promise = withRetry(fn, { onRetry });

      // First retry - 1s delay
      await vi.advanceTimersByTimeAsync(1000);
      expect(onRetry).toHaveBeenNthCalledWith(1, 2, expect.anything(), 1000);

      // Second retry - 2s delay
      await vi.advanceTimersByTimeAsync(2000);
      expect(onRetry).toHaveBeenNthCalledWith(2, 3, expect.anything(), 2000);

      // Third retry - 4s delay
      await vi.advanceTimersByTimeAsync(4000);
      expect(onRetry).toHaveBeenNthCalledWith(3, 4, expect.anything(), 4000);

      // Fourth retry - 8s delay
      await vi.advanceTimersByTimeAsync(8000);
      expect(onRetry).toHaveBeenNthCalledWith(4, 5, expect.anything(), 8000);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should not retry non-transient errors', async () => {
      const fn = vi.fn().mockRejectedValue({ error_code: 'INVALID_CREDENTIALS' });

      await expect(withRetry(fn)).rejects.toEqual({ error_code: 'INVALID_CREDENTIALS' });

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw error after max retries exceeded', async () => {
      const fn = vi.fn().mockRejectedValue({ error_code: 'INSTITUTION_DOWN' });

      const promise = withRetry(fn, { maxRetries: 2 }).catch(error => error);

      // First retry
      await vi.advanceTimersByTimeAsync(1000);

      // Second retry
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toEqual({ error_code: 'INSTITUTION_DOWN' });
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should respect maxDelay configuration', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ error_code: 'INSTITUTION_DOWN' })
        .mockRejectedValueOnce({ error_code: 'INSTITUTION_DOWN' })
        .mockRejectedValueOnce({ error_code: 'INSTITUTION_DOWN' })
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      const promise = withRetry(fn, {
        baseDelay: 1000,
        maxDelay: 3000, // Cap at 3s
        onRetry,
      });

      // First retry - 1s
      await vi.advanceTimersByTimeAsync(1000);
      expect(onRetry).toHaveBeenNthCalledWith(1, 2, expect.anything(), 1000);

      // Second retry - 2s
      await vi.advanceTimersByTimeAsync(2000);
      expect(onRetry).toHaveBeenNthCalledWith(2, 3, expect.anything(), 2000);

      // Third retry - capped at 3s (would be 4s without maxDelay)
      await vi.advanceTimersByTimeAsync(3000);
      expect(onRetry).toHaveBeenNthCalledWith(3, 4, expect.anything(), 3000);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should call onRetry callback on each retry attempt', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ error_code: 'INSTITUTION_DOWN' })
        .mockRejectedValueOnce({ error_code: 'INSTITUTION_DOWN' })
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      const promise = withRetry(fn, { onRetry });

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      await promise;

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(
        1,
        2,
        { error_code: 'INSTITUTION_DOWN' },
        1000
      );
      expect(onRetry).toHaveBeenNthCalledWith(
        2,
        3,
        { error_code: 'INSTITUTION_DOWN' },
        2000
      );
    });

    it('should handle custom baseDelay', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ error_code: 'INSTITUTION_DOWN' })
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      const promise = withRetry(fn, {
        baseDelay: 500, // 0.5s base delay
        onRetry,
      });

      await vi.advanceTimersByTimeAsync(500);

      await promise;

      expect(onRetry).toHaveBeenCalledWith(2, expect.anything(), 500);
    });

    it('should handle RATE_LIMIT_EXCEEDED error', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ error_code: 'RATE_LIMIT_EXCEEDED' })
        .mockResolvedValue('success');

      const promise = withRetry(fn);

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle INTERNAL_SERVER_ERROR', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ error_code: 'INTERNAL_SERVER_ERROR' })
        .mockResolvedValue('success');

      const promise = withRetry(fn);

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('retryPlaidApiCall', () => {
    it('should wrap API call with retry logic', async () => {
      const apiCall = vi
        .fn()
        .mockRejectedValueOnce({ error_code: 'INSTITUTION_DOWN' })
        .mockResolvedValue({ data: 'success' });

      const promise = retryPlaidApiCall(apiCall);

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result).toEqual({ data: 'success' });
      expect(apiCall).toHaveBeenCalledTimes(2);
    });

    it('should log Plaid-specific retry information', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const apiCall = vi
        .fn()
        .mockRejectedValueOnce({ error_code: 'INSTITUTION_DOWN' })
        .mockResolvedValue('success');

      const promise = retryPlaidApiCall(apiCall);

      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Plaid Retry]')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('withRetryWrapper', () => {
    it('should create a wrapped function with retry logic', async () => {
      const originalFn = vi
        .fn()
        .mockRejectedValueOnce({ error_code: 'INSTITUTION_DOWN' })
        .mockResolvedValue('success');

      const wrappedFn = withRetryWrapper(originalFn);

      const promise = wrappedFn();

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result).toBe('success');
      expect(originalFn).toHaveBeenCalledTimes(2);
    });

    it('should preserve function arguments', async () => {
      const originalFn = vi
        .fn()
        .mockRejectedValueOnce({ error_code: 'INSTITUTION_DOWN' })
        .mockResolvedValue('success');

      const wrappedFn = withRetryWrapper(originalFn);

      const promise = wrappedFn('arg1', 'arg2', 123);

      await vi.advanceTimersByTimeAsync(1000);

      await promise;

      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2', 123);
      expect(originalFn).toHaveBeenCalledTimes(2);
    });
  });
});
