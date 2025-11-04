/**
 * Plaid Accounts List Component
 * Displays all financial accounts (both Plaid and manual) with appropriate actions
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Unlink, AlertCircle, Link2, User } from 'lucide-react';
import type { FinancialAccount } from '@/lib/types/database';

interface AccountWithItem extends FinancialAccount {
  plaid_items?: {
    last_sync: string | null;
    institution_name: string;
  };
}

interface PlaidAccountsListProps {
  onAccountsChange?: () => void;
}

export function PlaidAccountsList({ onAccountsChange }: PlaidAccountsListProps) {
  const [accounts, setAccounts] = useState<AccountWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts on mount
  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from('financial_accounts')
        .select(`
          *,
          plaid_items:plaid_item_id (
            last_sync,
            institution_name
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setAccounts(data || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError('Failed to load accounts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing('all');
      setError(null);

      const response = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      // Refresh accounts after sync
      await fetchAccounts();

      if (onAccountsChange) {
        onAccountsChange();
      }
    } catch (err) {
      console.error('Error syncing accounts:', err);
      setError('Failed to sync accounts. Please try again.');
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (itemId: string, institutionName: string) => {
    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to disconnect ${institutionName}? This will remove all associated accounts and transactions.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDisconnecting(itemId);
      setError(null);

      const response = await fetch('/api/plaid/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });

      if (!response.ok) {
        throw new Error('Disconnect failed');
      }

      // Refresh accounts after disconnect
      await fetchAccounts();

      if (onAccountsChange) {
        onAccountsChange();
      }
    } catch (err) {
      console.error('Error disconnecting account:', err);
      setError('Failed to disconnect account. Please try again.');
    } finally {
      setDisconnecting(null);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const getAccountTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      checking: 'Checking',
      savings: 'Savings',
      credit_card: 'Credit Card',
      investment: 'Investment',
      retirement: 'Retirement',
      loan: 'Loan',
      mortgage: 'Mortgage',
      other: 'Other',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading accounts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-semibold text-red-900 dark:text-red-100">Error</p>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No accounts yet.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Connect your accounts via Plaid or add them manually to get started.
        </p>
      </div>
    );
  }

  // Separate Plaid and manual accounts, then group Plaid accounts by institution
  const plaidAccounts = accounts.filter((account) => !account.is_manual);
  const manualAccounts = accounts.filter((account) => account.is_manual);

  const plaidAccountsByInstitution = plaidAccounts.reduce((acc, account) => {
    const institution = account.institution_name || 'Unknown';
    if (!acc[institution]) {
      acc[institution] = [];
    }
    acc[institution].push(account);
    return acc;
  }, {} as Record<string, AccountWithItem[]>);

  return (
    <div className="space-y-6">
      {/* Sync All Button - Only show if there are Plaid accounts */}
      {plaidAccounts.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleSync}
            disabled={syncing === 'all'}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing === 'all' ? 'animate-spin' : ''}`} />
            {syncing === 'all' ? 'Syncing...' : 'Sync All Plaid Accounts'}
          </Button>
        </div>
      )}

      {/* Plaid Accounts by Institution */}
      {Object.entries(plaidAccountsByInstitution).map(([institution, institutionAccounts]) => {
        const itemId = institutionAccounts[0]?.plaid_item_id;
        const lastSync = institutionAccounts[0]?.plaid_items?.last_sync;

        return (
          <Card key={institution}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle>{institution}</CardTitle>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Link2 className="h-3 w-3" />
                      Plaid
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Last synced: {formatDate(lastSync)}
                  </p>
                </div>
                {itemId && (
                  <Button
                    onClick={() => handleDisconnect(itemId, institution)}
                    disabled={disconnecting === itemId}
                    variant="ghost"
                    size="sm"
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    {disconnecting === itemId ? 'Disconnecting...' : 'Disconnect'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {institutionAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{account.name}</p>
                        <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                          {getAccountTypeLabel(account.account_type)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        •••• {account.account_number_last4}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(account.current_balance, account.currency)}
                      </p>
                      {account.available_balance !== null && (
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(account.available_balance, account.currency)} available
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Manual Accounts */}
      {manualAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Manual Accounts</CardTitle>
              <Badge variant="outline" className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Manual
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {manualAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{account.name}</p>
                      <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                        {getAccountTypeLabel(account.account_type)}
                      </span>
                    </div>
                    {account.institution_name && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {account.institution_name}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatCurrency(account.current_balance, account.currency)}
                    </p>
                    {account.available_balance !== null && (
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(account.available_balance, account.currency)} available
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
