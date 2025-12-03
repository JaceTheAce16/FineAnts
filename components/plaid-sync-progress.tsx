/**
 * Plaid Sync Progress Component
 *
 * Displays real-time progress of historical transaction sync.
 * Shows progress bar, transaction count, and estimated time remaining.
 *
 * Usage:
 * ```tsx
 * <PlaidSyncProgress syncId={syncId} onComplete={() => loadAccounts()} />
 * ```
 *
 * Created: 2025-12-02
 */

'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { usePlaidSync, formatTimeRemaining } from '@/hooks/usePlaidSync';
import { Button } from '@/components/ui/button';

interface PlaidSyncProgressProps {
  syncId: string | null;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function PlaidSyncProgress({
  syncId,
  onComplete,
  onError,
}: PlaidSyncProgressProps) {
  const { status, isPolling, error, retry } = usePlaidSync(syncId, {
    pollInterval: 2000,  // Poll every 2 seconds
    onComplete,
    onError,
  });

  // Don't render if no sync ID
  if (!syncId) return null;

  // Don't render if no status yet
  if (!status && !error) {
    return (
      <Alert className="bg-blue-50 border-blue-200">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <AlertDescription className="text-blue-800">
          Initializing sync...
        </AlertDescription>
      </Alert>
    );
  }

  // Error state
  if (error || status?.isFailed) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <span>{status?.message || error}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={retry}
              className="ml-4"
            >
              Retry
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Completed state
  if (status?.isComplete) {
    return (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          {status.message}
        </AlertDescription>
      </Alert>
    );
  }

  // Syncing state
  if (isPolling && status) {
    return (
      <Alert className="bg-blue-50 border-blue-200">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <AlertDescription>
          <div className="space-y-3">
            {/* Status message and progress percentage */}
            <div className="flex items-center justify-between text-blue-800">
              <span className="font-medium">{status.message}</span>
              <span className="text-sm font-semibold">{status.progress}%</span>
            </div>

            {/* Progress bar */}
            <Progress value={status.progress} className="h-2" />

            {/* Additional info */}
            <div className="flex items-center justify-between text-xs text-blue-700">
              <div className="flex items-center gap-4">
                {status.transactionCount > 0 && (
                  <span>
                    {status.transactionCount} transaction{status.transactionCount === 1 ? '' : 's'} found
                  </span>
                )}
              </div>

              {status.estimatedTimeRemaining && status.estimatedTimeRemaining > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatTimeRemaining(status.estimatedTimeRemaining)} remaining</span>
                </div>
              )}
            </div>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

/**
 * Compact version for use in smaller spaces
 */
export function PlaidSyncProgressCompact({
  syncId,
  onComplete,
}: PlaidSyncProgressProps) {
  const { status, isPolling } = usePlaidSync(syncId, {
    pollInterval: 2000,
    onComplete,
  });

  if (!syncId || !status || !isPolling) return null;

  if (status.isComplete) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        <span>Synced {status.transactionCount} transactions</span>
      </div>
    );
  }

  if (status.isFailed) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600">
        <XCircle className="h-4 w-4" />
        <span>Sync failed</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-blue-600">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>
        Syncing... {status.progress}% ({status.transactionCount} found)
      </span>
    </div>
  );
}
