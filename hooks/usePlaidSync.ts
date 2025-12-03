/**
 * usePlaidSync Hook
 *
 * Polls for Plaid transaction sync status and provides real-time updates.
 * Used after connecting a bank account to show progress bar and transaction count.
 *
 * Usage:
 * ```tsx
 * const { status, isPolling } = usePlaidSync(syncId);
 *
 * if (isPolling && status) {
 *   return <ProgressBar progress={status.progress} message={status.message} />;
 * }
 * ```
 *
 * Created: 2025-12-02
 */

import { useState, useEffect, useCallback } from 'react';

export interface SyncStatus {
  status: 'pending' | 'syncing' | 'completed' | 'failed' | 'timeout';
  progress: number;              // 0-100
  transactionCount: number;
  message: string;
  error?: string;
  estimatedTimeRemaining?: number;  // seconds
  startedAt?: string;
  completedAt?: string;
  isComplete: boolean;
  isFailed: boolean;
}

interface UsePlaidSyncResult {
  status: SyncStatus | null;
  isPolling: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Hook to poll for Plaid sync status
 *
 * @param syncId - The item ID returned from exchange-token API
 * @param options - Configuration options
 * @returns Sync status and control functions
 */
export function usePlaidSync(
  syncId: string | null,
  options: {
    pollInterval?: number;      // Milliseconds between polls (default: 2000)
    onComplete?: () => void;    // Callback when sync completes
    onError?: (error: string) => void;  // Callback on error
  } = {}
): UsePlaidSyncResult {
  const {
    pollInterval = 2000,
    onComplete,
    onError,
  } = options;

  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch sync status
  const fetchStatus = useCallback(async () => {
    if (!syncId) return;

    try {
      const res = await fetch(`/api/plaid/sync-status/${syncId}`);

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Sync not found. Please try connecting again.');
        }
        throw new Error('Failed to fetch sync status');
      }

      const data: SyncStatus = await res.json();
      setStatus(data);
      setError(null);

      // Check if sync is complete or failed
      if (data.isComplete) {
        setIsPolling(false);
        if (onComplete) {
          onComplete();
        }
      } else if (data.isFailed) {
        setIsPolling(false);
        const errorMsg = data.error || 'Sync failed';
        setError(errorMsg);
        if (onError) {
          onError(errorMsg);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[usePlaidSync] Error fetching status:', err);
      setError(errorMsg);
      setIsPolling(false);

      if (onError) {
        onError(errorMsg);
      }
    }
  }, [syncId, onComplete, onError]);

  // Start polling when syncId is provided
  useEffect(() => {
    if (!syncId) {
      setIsPolling(false);
      setStatus(null);
      return;
    }

    // Start polling
    setIsPolling(true);
    setError(null);

    // Fetch immediately
    fetchStatus();

    // Set up polling interval
    const intervalId = setInterval(fetchStatus, pollInterval);

    // Cleanup on unmount or syncId change
    return () => {
      clearInterval(intervalId);
    };
  }, [syncId, pollInterval, fetchStatus]);

  // Retry function (useful for failed syncs)
  const retry = useCallback(() => {
    if (syncId) {
      setIsPolling(true);
      setError(null);
      fetchStatus();
    }
  }, [syncId, fetchStatus]);

  return {
    status,
    isPolling,
    error,
    retry,
  };
}

/**
 * Helper: Check if sync is in progress
 */
export function isSyncInProgress(status: SyncStatus | null): boolean {
  if (!status) return false;
  return status.status === 'pending' || status.status === 'syncing';
}

/**
 * Helper: Check if sync completed successfully
 */
export function isSyncComplete(status: SyncStatus | null): boolean {
  if (!status) return false;
  return status.isComplete;
}

/**
 * Helper: Check if sync failed
 */
export function isSyncFailed(status: SyncStatus | null): boolean {
  if (!status) return false;
  return status.isFailed;
}

/**
 * Helper: Format time remaining
 */
export function formatTimeRemaining(seconds: number | undefined): string {
  if (!seconds) return '';

  if (seconds < 10) {
    return 'a few seconds';
  } else if (seconds < 60) {
    return `about ${Math.round(seconds)} seconds`;
  } else {
    const minutes = Math.round(seconds / 60);
    return `about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }
}
