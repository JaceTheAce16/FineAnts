/**
 * Plaid Error Alert Component
 * Displays user-friendly error messages with appropriate actions
 */

'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { handlePlaidError, type PlaidErrorResponse } from '@/lib/plaid/error-handler';

interface PlaidErrorAlertProps {
  error: unknown;
  onReconnect?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDismiss?: boolean;
}

export function PlaidErrorAlert({
  error,
  onReconnect,
  onRetry,
  onDismiss,
  showDismiss = true,
}: PlaidErrorAlertProps) {
  const errorInfo: PlaidErrorResponse = handlePlaidError(error);

  // Determine severity based on error characteristics
  const getSeverity = (): 'error' | 'warning' | 'info' => {
    if (errorInfo.requiresReconnect) {
      return 'error';
    }
    if (errorInfo.isTransient) {
      return 'warning';
    }
    return 'info';
  };

  const severity = getSeverity();

  // Get icon based on severity
  const getIcon = () => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
    }
  };

  // Get title based on severity
  const getTitle = () => {
    switch (severity) {
      case 'error':
        return 'Connection Error';
      case 'warning':
        return 'Temporary Issue';
      case 'info':
        return 'Notice';
    }
  };

  return (
    <Alert variant={severity === 'error' ? 'destructive' : 'default'}>
      {getIcon()}
      <div className="flex-1">
        <AlertTitle>{getTitle()}</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-2">{errorInfo.userMessage}</p>
          {errorInfo.suggestedAction && (
            <p className="text-sm text-muted-foreground">{errorInfo.suggestedAction}</p>
          )}
        </AlertDescription>

        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
          {errorInfo.requiresReconnect && onReconnect && (
            <Button onClick={onReconnect} size="sm" variant="default">
              <RefreshCw className="h-3 w-3 mr-1" />
              Reconnect Account
            </Button>
          )}

          {errorInfo.isTransient && onRetry && (
            <Button onClick={onRetry} size="sm" variant="outline">
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry Now
            </Button>
          )}

          {showDismiss && onDismiss && (
            <Button onClick={onDismiss} size="sm" variant="ghost">
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
}
