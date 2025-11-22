/**
 * Transactions Management Page
 * View, search, filter, and manage all financial transactions
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  Edit2,
  Trash2,
  Download,
  X,
  Calendar,
  DollarSign,
  Tag,
  FileText,
  Loader2
} from 'lucide-react';

// Types
interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  amount: number;
  description: string;
  category: string;
  transaction_date: string;
  is_pending: boolean;
  plaid_transaction_id: string | null;
  created_at: string;
  financial_accounts?: {
    name: string;
    institution_name: string | null;
  };
}

interface FinancialAccount {
  id: string;
  name: string;
  institution_name: string | null;
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'income', label: 'Income' },
  { value: 'housing', label: 'Housing' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'food', label: 'Food' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'debt_payment', label: 'Debt Payment' },
  { value: 'savings', label: 'Savings' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_COLORS: Record<string, string> = {
  income: 'bg-green-100 text-green-800',
  housing: 'bg-blue-100 text-blue-800',
  transportation: 'bg-purple-100 text-purple-800',
  food: 'bg-orange-100 text-orange-800',
  utilities: 'bg-yellow-100 text-yellow-800',
  healthcare: 'bg-red-100 text-red-800',
  entertainment: 'bg-pink-100 text-pink-800',
  shopping: 'bg-indigo-100 text-indigo-800',
  debt_payment: 'bg-gray-100 text-gray-800',
  savings: 'bg-teal-100 text-teal-800',
  other: 'bg-slate-100 text-slate-800',
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<'transaction_date' | 'amount'>('transaction_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadTransactions(), loadAccounts()]);
    setLoading(false);
  };

  const loadTransactions = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        financial_accounts (
          name,
          institution_name
        )
      `)
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('Error loading transactions:', error);
      return;
    }

    setTransactions(data || []);
  };

  const loadAccounts = async () => {
    const { data, error } = await supabase
      .from('financial_accounts')
      .select('id, name, institution_name')
      .order('name');

    if (error) {
      console.error('Error loading accounts:', error);
      return;
    }

    setAccounts(data || []);
  };

  const deleteTransaction = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction');
      return;
    }

    setTransactions(transactions.filter(t => t.id !== id));
  };

  // Filter and sort transactions
  const filteredTransactions = transactions.filter(transaction => {
    // Search filter
    if (searchQuery && !transaction.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Account filter
    if (selectedAccount !== 'all' && transaction.account_id !== selectedAccount) {
      return false;
    }

    // Category filter
    if (selectedCategory !== 'all' && transaction.category !== selectedCategory) {
      return false;
    }

    // Date range filter
    if (dateFrom && transaction.transaction_date < dateFrom) {
      return false;
    }
    if (dateTo && transaction.transaction_date > dateTo) {
      return false;
    }

    return true;
  }).sort((a, b) => {
    const aValue = sortField === 'transaction_date' ? a.transaction_date : a.amount;
    const bValue = sortField === 'transaction_date' ? b.transaction_date : b.amount;

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const toggleSort = (field: 'transaction_date' | 'amount') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Account', 'Amount'];
    const rows = filteredTransactions.map(t => [
      t.transaction_date,
      t.description,
      t.category,
      t.financial_accounts?.name || 'Unknown',
      t.amount.toString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Calculate summary stats
  const totalIncome = filteredTransactions
    .filter(t => t.category === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpenses = filteredTransactions
    .filter(t => t.category !== 'income' && t.amount > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0);

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
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => setShowAddForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Income</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalIncome)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalExpenses)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net</p>
                <p className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalIncome - totalExpenses)}
                </p>
              </div>
              <DollarSign className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Account Filter */}
            <div className="space-y-2">
              <Label htmlFor="account">Account</Label>
              <select
                id="account"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Accounts</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="space-y-2">
              <Label htmlFor="dateFrom">From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            {/* Date To */}
            <div className="space-y-2">
              <Label htmlFor="dateTo">To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Clear Filters */}
          {(searchQuery || selectedAccount !== 'all' || selectedCategory !== 'all' || dateFrom || dateTo) && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedAccount('all');
                  setSelectedCategory('all');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Transaction Form */}
      {showAddForm && (
        <AddTransactionForm
          accounts={accounts}
          onSuccess={() => {
            setShowAddForm(false);
            loadTransactions();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            {filteredTransactions.length === 0 && transactions.length > 0
              ? 'No transactions match your filters'
              : `Showing ${filteredTransactions.length} transaction${filteredTransactions.length !== 1 ? 's' : ''}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {transactions.length === 0
                  ? 'No transactions yet. Add your first transaction or connect accounts.'
                  : 'No transactions match your filters.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 bg-muted rounded-md text-sm font-medium">
                <div className="col-span-2 flex items-center cursor-pointer" onClick={() => toggleSort('transaction_date')}>
                  Date
                  <ArrowUpDown className="h-4 w-4 ml-1" />
                </div>
                <div className="col-span-3">Description</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-2">Account</div>
                <div className="col-span-2 flex items-center cursor-pointer" onClick={() => toggleSort('amount')}>
                  Amount
                  <ArrowUpDown className="h-4 w-4 ml-1" />
                </div>
                <div className="col-span-1">Actions</div>
              </div>

              {/* Transaction Rows */}
              {filteredTransactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  isEditing={editingId === transaction.id}
                  onEdit={() => setEditingId(transaction.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onDelete={() => deleteTransaction(transaction.id)}
                  onSave={() => {
                    setEditingId(null);
                    loadTransactions();
                  }}
                  accounts={accounts}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Transaction Row Component
function TransactionRow({
  transaction,
  isEditing,
  onEdit,
  onCancelEdit,
  onDelete,
  onSave,
  accounts,
}: {
  transaction: Transaction;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onSave: () => void;
  accounts: FinancialAccount[];
}) {
  const [editData, setEditData] = useState({
    description: transaction.description,
    amount: transaction.amount.toString(),
    category: transaction.category,
    transaction_date: transaction.transaction_date,
  });

  const supabase = createClient();

  const handleSave = async () => {
    const { error } = await supabase
      .from('transactions')
      .update({
        description: editData.description,
        amount: parseFloat(editData.amount),
        category: editData.category,
        transaction_date: editData.transaction_date,
      })
      .eq('id', transaction.id);

    if (error) {
      console.error('Error updating transaction:', error);
      alert('Failed to update transaction');
      return;
    }

    onSave();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const categoryColor = CATEGORY_COLORS[transaction.category] || CATEGORY_COLORS.other;

  if (isEditing) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border rounded-md">
        <div className="md:col-span-2">
          <Input
            type="date"
            value={editData.transaction_date}
            onChange={(e) => setEditData({ ...editData, transaction_date: e.target.value })}
          />
        </div>
        <div className="md:col-span-3">
          <Input
            value={editData.description}
            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
            placeholder="Description"
          />
        </div>
        <div className="md:col-span-2">
          <select
            value={editData.category}
            onChange={(e) => setEditData({ ...editData, category: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CATEGORIES.filter(c => c.value !== 'all').map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <p className="text-sm py-2">{transaction.financial_accounts?.name || 'Unknown'}</p>
        </div>
        <div className="md:col-span-2">
          <Input
            type="number"
            step="0.01"
            value={editData.amount}
            onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
          />
        </div>
        <div className="md:col-span-1 flex gap-2">
          <Button size="sm" onClick={handleSave}>Save</Button>
          <Button size="sm" variant="outline" onClick={onCancelEdit}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border rounded-md hover:bg-muted/50 transition-colors">
      <div className="md:col-span-2 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground md:hidden" />
        <span className="text-sm">{formatDate(transaction.transaction_date)}</span>
      </div>
      <div className="md:col-span-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground md:hidden" />
        <span className="font-medium">{transaction.description}</span>
      </div>
      <div className="md:col-span-2 flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground md:hidden" />
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${categoryColor}`}>
          {CATEGORIES.find(c => c.value === transaction.category)?.label || transaction.category}
        </span>
      </div>
      <div className="md:col-span-2 flex items-center text-sm text-muted-foreground">
        {transaction.financial_accounts?.name || 'Unknown'}
      </div>
      <div className="md:col-span-2 flex items-center">
        <span className={`font-semibold ${transaction.category === 'income' ? 'text-green-600' : 'text-red-600'}`}>
          {transaction.category === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
        </span>
      </div>
      <div className="md:col-span-1 flex items-center gap-2">
        {!transaction.plaid_transaction_id && (
          <>
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-600">
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// Add Transaction Form Component
function AddTransactionForm({
  accounts,
  onSuccess,
  onCancel,
}: {
  accounts: FinancialAccount[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'other',
    account_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in');
        return;
      }

      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          description: formData.description,
          amount: parseFloat(formData.amount),
          category: formData.category,
          account_id: formData.account_id || null,
          transaction_date: formData.transaction_date,
          is_pending: false,
        });

      if (insertError) throw insertError;

      onSuccess();
    } catch (err: any) {
      console.error('Error adding transaction:', err);
      setError(err.message || 'Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Add Manual Transaction</CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Grocery shopping"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
                disabled={loading}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CATEGORIES.filter(c => c.value !== 'all').map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account">Account</Label>
              <select
                id="account"
                value={formData.account_id}
                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                disabled={loading}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select account (optional)</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Transaction Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Adding...' : 'Add Transaction'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
