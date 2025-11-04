/**
 * Plaid Transactions List Component
 * Displays transactions with filtering and grouping by month
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, AlertCircle, Clock } from 'lucide-react';
import type { Transaction, TransactionCategory } from '@/lib/types/database';

interface PlaidTransactionsListProps {
  accountId?: string;
}

export function PlaidTransactionsList({ accountId }: PlaidTransactionsListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<TransactionCategory | 'all'>('all');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    fetchTransactions();
  }, [accountId]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      let query = supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false });

      // Filter by account if provided
      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters to transactions
  const getFilteredTransactions = () => {
    return transactions.filter((txn) => {
      // Category filter
      if (categoryFilter !== 'all' && txn.category !== categoryFilter) {
        return false;
      }

      // Amount filters
      if (minAmount && Math.abs(txn.amount) < parseFloat(minAmount)) {
        return false;
      }
      if (maxAmount && Math.abs(txn.amount) > parseFloat(maxAmount)) {
        return false;
      }

      // Date range filters
      if (startDate && txn.transaction_date < startDate) {
        return false;
      }
      if (endDate && txn.transaction_date > endDate) {
        return false;
      }

      return true;
    });
  };

  // Group transactions by month
  const groupByMonth = (txns: Transaction[]) => {
    const grouped: Record<string, Transaction[]> = {};

    txns.forEach((txn) => {
      const date = new Date(txn.transaction_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(txn);
    });

    return grouped;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const formatMonthHeader = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  const getCategoryLabel = (category: TransactionCategory) => {
    const labels: Record<TransactionCategory, string> = {
      income: 'Income',
      housing: 'Housing',
      transportation: 'Transportation',
      food: 'Food',
      utilities: 'Utilities',
      healthcare: 'Healthcare',
      entertainment: 'Entertainment',
      shopping: 'Shopping',
      debt_payment: 'Debt Payment',
      savings: 'Savings',
      other: 'Other',
    };
    return labels[category] || category;
  };

  const clearFilters = () => {
    setCategoryFilter('all');
    setMinAmount('');
    setMaxAmount('');
    setStartDate('');
    setEndDate('');
  };

  const filteredTransactions = getFilteredTransactions();
  const groupedTransactions = groupByMonth(filteredTransactions);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading transactions...</span>
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

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters</CardTitle>
            <Button onClick={clearFilters} variant="ghost" size="sm">
              Clear All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as TransactionCategory | 'all')}
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Categories</option>
                <option value="income">Income</option>
                <option value="housing">Housing</option>
                <option value="transportation">Transportation</option>
                <option value="food">Food</option>
                <option value="utilities">Utilities</option>
                <option value="healthcare">Healthcare</option>
                <option value="entertainment">Entertainment</option>
                <option value="shopping">Shopping</option>
                <option value="debt_payment">Debt Payment</option>
                <option value="savings">Savings</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Min Amount */}
            <div>
              <Label htmlFor="minAmount">Min Amount</Label>
              <Input
                id="minAmount"
                type="number"
                placeholder="0.00"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
              />
            </div>

            {/* Max Amount */}
            <div>
              <Label htmlFor="maxAmount">Max Amount</Label>
              <Input
                id="maxAmount"
                type="number"
                placeholder="0.00"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
              />
            </div>

            {/* Start Date */}
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No transactions found.</p>
          {(categoryFilter !== 'all' || minAmount || maxAmount || startDate || endDate) && (
            <Button onClick={clearFilters} variant="outline" size="sm" className="mt-4">
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTransactions)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([monthKey, monthTransactions]) => (
              <Card key={monthKey}>
                <CardHeader>
                  <CardTitle className="text-lg">{formatMonthHeader(monthKey)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {monthTransactions.map((txn) => (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{txn.description}</p>
                            {txn.is_pending && (
                              <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 px-2 py-0.5 rounded">
                                <Clock className="h-3 w-3" />
                                Pending
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span>{formatDate(txn.transaction_date)}</span>
                            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                              {getCategoryLabel(txn.category)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-semibold ${
                              txn.amount < 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {txn.amount < 0 ? '+' : '-'}
                            {formatCurrency(txn.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
