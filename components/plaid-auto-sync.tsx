/**
 * Plaid Auto Sync Component
 * Automatically syncs Plaid accounts when the app is opened
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RefreshCw } from 'lucide-react';

const SYNC_THRESHOLD_HOURS = 4;
const SYNC_THRESHOLD_MS = SYNC_THRESHOLD_HOURS * 60 * 60 * 1000;

export function PlaidAutoSync() {
  const [syncing, setSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);

  useEffect(() => {
    checkAndSync();
  }, []);

  const checkAndSync = async () => {
    try {
      const supabase = createClient();

      // Check if user has any Plaid items
      const { data: items, error } = await supabase
        .from('plaid_items')
        .select('last_sync')
        .eq('status', 'active');

      if (error) {
        console.error('Error checking Plaid items:', error);
        return;
      }

      // If no items, nothing to sync
      if (!items || items.length === 0) {
        return;
      }

      // Check if any item needs sync
      const needsSync = items.some((item) => {
        if (!item.last_sync) {
          return true; // Never synced
        }

        const lastSyncTime = new Date(item.last_sync).getTime();
        const now = Date.now();
        const timeSinceSync = now - lastSyncTime;

        return timeSinceSync > SYNC_THRESHOLD_MS;
      });

      if (needsSync) {
        await triggerSync();
      }
    } catch (error) {
      console.error('Error in auto-sync:', error);
    }
  };

  const triggerSync = async () => {
    try {
      setSyncing(true);

      const response = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      setSyncComplete(true);

      // Hide completion indicator after 3 seconds
      setTimeout(() => {
        setSyncComplete(false);
      }, 3000);
    } catch (error) {
      console.error('Error during sync:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Don't render anything if not syncing or sync not complete
  if (!syncing && !syncComplete) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`rounded-lg shadow-lg p-4 ${
          syncing
            ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
            : 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <RefreshCw
            className={`h-5 w-5 ${
              syncing
                ? 'animate-spin text-blue-600 dark:text-blue-400'
                : 'text-green-600 dark:text-green-400'
            }`}
          />
          <div>
            <p
              className={`font-semibold text-sm ${
                syncing
                  ? 'text-blue-900 dark:text-blue-100'
                  : 'text-green-900 dark:text-green-100'
              }`}
            >
              {syncing ? 'Syncing accounts...' : 'Sync complete'}
            </p>
            {syncing && (
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Updating your latest transactions
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
