/**
 * Error Alert Component
 * Displays errors with appropriate styling and retry information
 */

'use client';

import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { ErrorResponse } from '@/lib/stripe/error-handler';

interface ErrorAlertProps {
  error: string | ErrorResponse;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorAlert({ error, onDismiss, className = '' }: ErrorAlertProps) {
  // Handle both string and ErrorResponse types
  const errorMessage = typeof error === 'string' ? error : error.error;
  const severity = typeof error === 'object' && 'severity' in error ? error.severity : 'error';
  const retryable = typeof error === 'object' && 'retryable' in error ? error.retryable : false;

  // Style based on severity
  const styles = {
    info: {
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-800 dark:text-blue-200',
      icon: Info,
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-950/30',
      border: 'border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-800 dark:text-yellow-200',
      icon: AlertTriangle,
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-950/30',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-800 dark:text-red-200',
      icon: AlertCircle,
    },
    critical: {
      bg: 'bg-red-100 dark:bg-red-950/50',
      border: 'border-red-300 dark:border-red-700',
      text: 'text-red-900 dark:text-red-100',
      icon: AlertCircle,
    },
  };

  const style = styles[severity];
  const Icon = style.icon;

  return (
    <div
      className={`${style.bg} ${style.border} ${style.text} border rounded-lg p-4 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold mb-1">
            {severity === 'critical' && 'Critical Error'}
            {severity === 'error' && 'Error'}
            {severity === 'warning' && 'Warning'}
            {severity === 'info' && 'Notice'}
          </p>
          <p className="text-sm">{errorMessage}</p>
          {retryable && (
            <p className="text-xs mt-2 opacity-75">
              This error is temporary. Please try again in a few moments.
            </p>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 hover:opacity-70 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Inline error message for forms
 */
export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mt-1">
      <AlertCircle className="h-4 w-4" />
      <span>{message}</span>
    </div>
  );
}
