'use client';

/**
 * Transactions Page
 * View and manage all financial transactions with filtering and manual entry
 */


import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Filter, Download, Edit2, Save, X, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';


export default function TransactionsPage() {

// Types
interface Transaction {
  id: string;
  account_id: string | null;
  amount: number;
  description: string;
  category: string;
  transaction_date: string;
  is_pending: boolean;
  plaid_transaction_id: string | null;
  account?: {
    name: string;
  };
}

interface Account {
  id: string;
  name: string;
}

const TRANSACTION_CATEGORIES = [
  { value: 'income', label: 'Income', color: 'text-green-600' },
  { value: 'housing', label: 'Housing', color: 'text-blue-600' },
  { value: 'transportation', label: 'Transportation', color: 'text-purple-600' },
  { value: 'food', label: 'Food', color: 'text-orange-600' },
  { value: 'utilities', label: 'Utilities', color: 'text-yellow-600' },
  { value: 'healthcare', label: 'Healthcare', color: 'text-red-600' },
  { value: 'entertainment', label: 'Entertainment', color: 'text-pink-600' },
  { value: 'shopping', label: 'Shopping', color: 'text-indigo-600' },
  { value: 'debt_payment', label: 'Debt Payment', color: 'text-gray-600' },
  { value: 'savings', label: 'Savings', color: 'text-green-600' },
  { value: 'other', label: 'Other', color: 'text-gray-600' },
];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    account_id: '',
    amount: '',
    description: '',
    category: 'other',
    transaction_date: new Date().toISOString().split('T')[0],
    is_pending: false,
  });
  const supabase = createClient();

  useEffect(() => {
    Promise.all([loadTransactions(), loadAccounts()]);
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          account:financial_accounts(name)
        `)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const { data, error} = await supabase
        .from('financial_accounts')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setAccounts(data || []);
      if (data && data.length > 0) {
        setFormData((prev) => ({ ...prev, account_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          account_id: formData.account_id || null,
          amount: parseFloat(formData.amount),
          description: formData.description,
          category: formData.category,
          transaction_date: formData.transaction_date,
          is_pending: formData.is_pending,
        })
        .select(`
          *,
          account:financial_accounts(name)
        `)
        .single();

      if (error) throw error;

      setTransactions([data, ...transactions]);
      setFormData({
        account_id: accounts[0]?.id || '',
        amount: '',
        description: '',
        category: 'other',
        transaction_date: new Date().toISOString().split('T')[0],
        is_pending: false,
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Failed to add transaction. Please try again.');
    }
  };

  const handleUpdateTransaction = async (id: string, updates: Partial<Transaction>) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setTransactions(
        transactions.map((transaction) =>
          transaction.id === id ? { ...transaction, ...updates } : transaction
        )
      );
      setEditingId(null);
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Failed to update transaction. Please try again.');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTransactions(transactions.filter((transaction) => transaction.id !== id));
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction. Please try again.');
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((transaction) => {
    const matchesCategory = filterCategory === 'all' || transaction.category === filterCategory;
    const matchesAccount = filterAccount === 'all' || transaction.account_id === filterAccount;
    const matchesSearch =
      searchTerm === '' ||
      transaction.description.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesCategory && matchesAccount && matchesSearch;
  });

  // Calculate totals
  const totalIncome = filteredTransactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpenses = filteredTransactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  const getCategoryLabel = (category: string) => {
    return TRANSACTION_CATEGORIES.find((c) => c.value === category)?.label || category;
  };

  const getCategoryColor = (category: string) => {
    return TRANSACTION_CATEGORIES.find((c) => c.value === category)?.color || 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage all your financial transactions
          </p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Transaction
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-2xl font-bold text-green-600">${totalIncome.toFixed(2)}</p>
            </div>
            <ArrowDownRight className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">${totalExpenses.toFixed(2)}</p>
            </div>
            <ArrowUpRight className="h-8 w-8 text-red-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Net</p>
              <p className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${(totalIncome - totalExpenses).toFixed(2)}
              </p>
            </div>
          </div>
        </Card>

      {/* Add Transaction Form */}
      {showAddForm && (
        <Card className="p-6">
          <form onSubmit={handleAddTransaction} className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">New Transaction</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Account</label>
                <select
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">No Account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount * (negative for expense)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  placeholder="-50.00 or 1000.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Grocery shopping"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {TRANSACTION_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="is_pending"
                  checked={formData.is_pending}
                  onChange={(e) => setFormData({ ...formData, is_pending: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_pending" className="text-sm font-medium">
                  Pending Transaction
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Add Transaction</Button>
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              placeholder="Search descriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Categories</option>
              {TRANSACTION_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Account</label>
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(filterCategory !== 'all' || filterAccount !== 'all' || searchTerm) && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setFilterCategory('all');
              setFilterAccount('all');
              setSearchTerm('');
            }}
          >
            Clear Filters
          </Button>
        )}
      </Card>

      {/* Transactions List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">
            All Transactions ({filteredTransactions.length})
          </h3>
          {filteredTransactions.length > 0 && (
            <Button variant="outline" size="sm" disabled>
              <Download className="h-4 w-4 mr-2" />
              Export CSV (Coming Soon)
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {filteredTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No transactions found. {transactions.length === 0 ? 'Add your first transaction above.' : 'Try adjusting your filters.'}
            </p>
          ) : (
            filteredTransactions.map((transaction) => {
              const isEditing = editingId === transaction.id;
              const isIncome = transaction.amount > 0;

              return (
                <div
                  key={transaction.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* Date */}
                  <div className="text-sm text-muted-foreground w-24">
                    {new Date(transaction.transaction_date).toLocaleDateString()}
                  </div>

                  {/* Description & Category */}
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={transaction.description}
                          onChange={(e) =>
                            setTransactions(
                              transactions.map((t) =>
                                t.id === transaction.id ? { ...t, description: e.target.value } : t
                              )
                            )
                          }
                          className="w-full px-3 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <select
                          value={transaction.category}
                          onChange={(e) =>
                            setTransactions(
                              transactions.map((t) =>
                                t.id === transaction.id ? { ...t, category: e.target.value } : t
                              )
                            )
                          }
                          className="w-full px-3 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {TRANSACTION_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <>
                        <div className="font-semibold">{transaction.description}</div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className={getCategoryColor(transaction.category)}>
                            {getCategoryLabel(transaction.category)}
                          </span>
                          {transaction.account && (
                            <>
                              <span>•</span>
                              <span>{transaction.account.name}</span>
                            </>
                          )}
                          {transaction.is_pending && (
                            <>
                              <span>•</span>
                              <span className="text-orange-600">Pending</span>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="text-right w-32">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={transaction.amount}
                        onChange={(e) =>
                          setTransactions(
                            transactions.map((t) =>
                              t.id === transaction.id
                                ? { ...t, amount: parseFloat(e.target.value) || 0 }
                                : t
                            )
                          )
                        }
                        className="w-full px-3 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary text-right"
                      />
                    ) : (
                      <div
                        className={`text-lg font-semibold ${
                          isIncome ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {isIncome ? '+' : '-'}${Math.abs(Number(transaction.amount)).toFixed(2)}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!transaction.plaid_transaction_id && (
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleUpdateTransaction(transaction.id, {
                                description: transaction.description,
                                category: transaction.category,
                                amount: transaction.amount,
                              })
                            }
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null);
                              loadTransactions();
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
                            onClick={() => setEditingId(transaction.id)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteTransaction(transaction.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
