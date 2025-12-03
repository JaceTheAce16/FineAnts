/**
 * Accounts Page
 * Manage all financial accounts - both Plaid-connected and manual accounts
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Wallet, CreditCard, Building, TrendingUp, DollarSign, Home, Car, Loader2, Edit2, Save, X } from 'lucide-react';
import { PlaidLinkButton } from '@/components/plaid-link-button';
import { PlaidAccountsList } from '@/components/plaid-accounts-list';
import { PlaidSyncProgress } from '@/components/plaid-sync-progress';

// Types
interface FinancialAccount {
  id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  account_number_last4: string | null;
  current_balance: number;
  available_balance: number | null;
  currency: string;
  is_manual: boolean;
  plaid_account_id: string | null;
  created_at: string;
}

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking', icon: Wallet },
  { value: 'savings', label: 'Savings', icon: DollarSign },
  { value: 'credit_card', label: 'Credit Card', icon: CreditCard },
  { value: 'investment', label: 'Investment', icon: TrendingUp },
  { value: 'retirement', label: 'Retirement', icon: TrendingUp },
  { value: 'loan', label: 'Loan', icon: Building },
  { value: 'mortgage', label: 'Mortgage', icon: Home },
  { value: 'other', label: 'Other', icon: Wallet },
];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [syncId, setSyncId] = useState<string | null>(null);  // Track Plaid sync progress
  const [formData, setFormData] = useState({
    name: '',
    account_type: 'checking',
    institution_name: '',
    account_number_last4: '',
    current_balance: '',
  });
  const supabase = createClient();

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('financial_accounts')
        .select('*')
        .eq('is_manual', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('financial_accounts')
        .insert({
          user_id: user.id,
          name: formData.name,
          account_type: formData.account_type,
          institution_name: formData.institution_name || null,
          account_number_last4: formData.account_number_last4 || null,
          current_balance: parseFloat(formData.current_balance) || 0,
          is_manual: true,
        })
        .select()
        .single();

      if (error) throw error;

      setAccounts([data, ...accounts]);
      setFormData({
        name: '',
        account_type: 'checking',
        institution_name: '',
        account_number_last4: '',
        current_balance: '',
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding account:', error);
      alert('Failed to add account. Please try again.');
    }
  };

  const handleUpdateAccount = async (id: string, updates: Partial<FinancialAccount>) => {
    try {
      const { error } = await supabase
        .from('financial_accounts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setAccounts(
        accounts.map((account) =>
          account.id === id ? { ...account, ...updates } : account
        )
      );
      setEditingId(null);
    } catch (error) {
      console.error('Error updating account:', error);
      alert('Failed to update account. Please try again.');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account? This will also delete all associated transactions.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('financial_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAccounts(accounts.filter((account) => account.id !== id));
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
    }
  };

  const getAccountIcon = (type: string) => {
    const accountType = ACCOUNT_TYPES.find((t) => t.value === type);
    return accountType ? accountType.icon : Wallet;
  };

  const totalBalance = accounts.reduce(
    (sum, account) => sum + Number(account.current_balance),
    0
  );

  if (loading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Accounts</h1>
        <p className="text-muted-foreground">
          Manage your financial accounts - connected and manual
        </p>
      </div>

      {/* Total Balance Card */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
            <p className="text-4xl font-bold">${totalBalance.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Across {accounts.length} manual {accounts.length === 1 ? 'account' : 'accounts'}
            </p>
          </div>
          <Wallet className="h-16 w-16 text-primary opacity-50" />
        </div>
      </Card>

      {/* Plaid Connected Accounts */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Connected Accounts (Plaid)</h2>
            <p className="text-sm text-muted-foreground">
              Accounts automatically synced with your financial institutions
            </p>
          </div>
          <PlaidLinkButton
            onSuccess={(newSyncId) => {
              // Set syncId to start showing progress
              setSyncId(newSyncId || null);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Connect Account
          </PlaidLinkButton>
        </div>

        {/* Show sync progress if syncing */}
        {syncId && (
          <div className="mb-4">
            <PlaidSyncProgress
              syncId={syncId}
              onComplete={() => {
                // Reload page when sync completes
                window.location.reload();
              }}
            />
          </div>
        )}

        <PlaidAccountsList />
      </Card>

      {/* Manual Accounts */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Manual Accounts</h2>
            <p className="text-sm text-muted-foreground">
              Accounts you track manually
            </p>
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Manual Account
          </Button>
        </div>

        {/* Add Account Form */}
        {showAddForm && (
          <form onSubmit={handleAddAccount} className="mb-6 p-4 border rounded-lg bg-muted/30">
            <h3 className="font-semibold mb-4">New Manual Account</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Account Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Chase Checking"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Account Type *</label>
                <select
                  required
                  value={formData.account_type}
                  onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Institution Name</label>
                <input
                  type="text"
                  placeholder="e.g., Chase Bank"
                  value={formData.institution_name}
                  onChange={(e) => setFormData({ ...formData, institution_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last 4 Digits (optional)</label>
                <input
                  type="text"
                  placeholder="1234"
                  maxLength={4}
                  value={formData.account_number_last4}
                  onChange={(e) => setFormData({ ...formData, account_number_last4: e.target.value.replace(/\D/g, '') })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Current Balance *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  placeholder="0.00"
                  value={formData.current_balance}
                  onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button type="submit">Add Account</Button>
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Accounts List */}
        <div className="space-y-3">
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No manual accounts yet. Click "Add Manual Account" to get started.
            </p>
          ) : (
            accounts.map((account) => {
              const Icon = getAccountIcon(account.account_type);
              const isEditing = editingId === account.id;
              const accountType = ACCOUNT_TYPES.find((t) => t.value === account.account_type);

              return (
                <div
                  key={account.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>

                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={account.name}
                          onChange={(e) =>
                            setAccounts(
                              accounts.map((a) =>
                                a.id === account.id ? { ...a, name: e.target.value } : a
                              )
                            )
                          }
                          className="w-full px-3 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={account.current_balance}
                          onChange={(e) =>
                            setAccounts(
                              accounts.map((a) =>
                                a.id === account.id
                                  ? { ...a, current_balance: parseFloat(e.target.value) || 0 }
                                  : a
                              )
                            )
                          }
                          className="w-full px-3 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    ) : (
                      <>
                        <h3 className="font-semibold text-lg">{account.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{accountType?.label}</span>
                          {account.institution_name && (
                            <>
                              <span>•</span>
                              <span>{account.institution_name}</span>
                            </>
                          )}
                          {account.account_number_last4 && (
                            <>
                              <span>•</span>
                              <span>••••{account.account_number_last4}</span>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      ${Number(account.current_balance).toFixed(2)}
                    </div>
                    {account.available_balance !== null && (
                      <div className="text-sm text-muted-foreground">
                        Available: ${Number(account.available_balance).toFixed(2)}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateAccount(account.id, {
                            name: account.name,
                            current_balance: account.current_balance,
                          })}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(null);
                            loadAccounts();
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(account.id)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteAccount(account.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ACCOUNT_TYPES.slice(0, 3).map((type) => {
          const typeAccounts = accounts.filter((a) => a.account_type === type.value);
          const typeBalance = typeAccounts.reduce(
            (sum, a) => sum + Number(a.current_balance),
            0
          );
          const Icon = type.icon;

          if (typeAccounts.length === 0) return null;

          return (
            <Card key={type.value} className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{type.label}</p>
                  <p className="text-xl font-bold">${typeBalance.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {typeAccounts.length} {typeAccounts.length === 1 ? 'account' : 'accounts'}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
