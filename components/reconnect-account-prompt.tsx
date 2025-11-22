/**
 * Reconnect Account Prompt Component
 * Displays notifications for Plaid items that need reconnection
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PlaidLinkButton } from '@/components/plaid-link-button';
import { AlertTriangle, AlertCircle, X } from 'lucide-react';
import type { PlaidItem } from '@/lib/types/database';

export function ReconnectAccountPrompt() {
  const [itemsNeedingReconnect, setItemsNeedingReconnect] = useState<PlaidItem[]>([]);
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItemsNeedingReconnect();
  }, []);

  const fetchItemsNeedingReconnect = useCallback(async () => {
    try {
      setLoading(true);

      const supabase = createClient();

      const { data, error } = await supabase
        .from('plaid_items')
        .select('*')
        .in('status', ['error', 'pending_expiration']);

      if (error) {
        console.error('Error fetching items needing reconnect:', error);
        return;
      }

      setItemsNeedingReconnect(data || []);
    } catch (err) {
      console.error('Error in fetchItemsNeedingReconnect:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDismiss = (itemId: string) => {
    setDismissedItems(prev => new Set(prev).add(itemId));
  };

  const handleReconnectSuccess = useCallback(async () => {
    // Refresh the list after successful reconnection
    await fetchItemsNeedingReconnect();
  }, [fetchItemsNeedingReconnect]);

  const getErrorMessage = (item: PlaidItem) => {
    if (item.status === 'pending_expiration') {
      return `Your connection to ${item.institution_name} will expire soon. Please reconnect to continue syncing.`;
    }

    // Map common error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
      'ITEM_LOGIN_REQUIRED': `Please reconnect ${item.institution_name} with your updated credentials.`,
      'INVALID_CREDENTIALS': `Your credentials for ${item.institution_name} are invalid. Please reconnect.`,
      'INSTITUTION_NOT_RESPONDING': `${item.institution_name} is not responding. Please try reconnecting later.`,
      'ITEM_NOT_SUPPORTED': `${item.institution_name} is no longer supported. Please disconnect and use a different account.`,
    };

    if (item.error_code && errorMessages[item.error_code]) {
      return errorMessages[item.error_code];
    }

    return `There was an issue connecting to ${item.institution_name}. Please reconnect your account.`;
  };

  const getSeverity = (item: PlaidItem): 'warning' | 'error' => {
    return item.status === 'pending_expiration' ? 'warning' : 'error';
  };

  // Filter out dismissed items
  const visibleItems = itemsNeedingReconnect.filter(
    item => !dismissedItems.has(item.item_id)
  );

  if (loading || visibleItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 mb-6">
      {visibleItems.map((item) => {
        const severity = getSeverity(item);
        const Icon = severity === 'warning' ? AlertTriangle : AlertCircle;

        return (
          <div
            key={item.item_id}
            className={`rounded-lg border p-4 ${
              severity === 'warning'
                ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800'
                : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
            }`}
          >
            <div className="flex items-start gap-3">
              <Icon
                className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                  severity === 'warning'
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p
                      className={`font-semibold ${
                        severity === 'warning'
                          ? 'text-yellow-900 dark:text-yellow-100'
                          : 'text-red-900 dark:text-red-100'
                      }`}
                    >
                      {severity === 'warning' ? 'Connection Expiring' : 'Connection Issue'}
                    </p>
                    <p
                      className={`text-sm mt-1 ${
                        severity === 'warning'
                          ? 'text-yellow-700 dark:text-yellow-300'
                          : 'text-red-700 dark:text-red-300'
                      }`}
                    >
                      {getErrorMessage(item)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDismiss(item.item_id)}
                    className="flex-shrink-0 hover:opacity-70 transition-opacity"
                    aria-label="Dismiss"
                  >
                    <X
                      className={`h-4 w-4 ${
                        severity === 'warning'
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    />
                  </button>
                </div>
                <div className="mt-3">
                  <PlaidLinkButton
                    onSuccess={handleReconnectSuccess}
                    accessToken={item.item_id}
                    variant={severity === 'warning' ? 'outline' : 'default'}
                    size="sm"
                  >
                    Reconnect {item.institution_name}
                  </PlaidLinkButton>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
