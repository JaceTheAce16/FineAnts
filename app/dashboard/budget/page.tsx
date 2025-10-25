/**
 * Budget Management Page
 * Allows users to track income, expenses, and financial goals with database persistence
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, TrendingUp, TrendingDown, Target, Loader2 } from 'lucide-react';

// Types
interface IncomeItem {
  id: string;
  source_name: string;
  amount: number;
}

interface ExpenseItem {
  id: string;
  category: string;
  name: string;
  amount: number;
}

interface Goal {
  id: string;
  goal_name: string;
  target_amount: number;
  current_amount: number;
}

const EXPENSE_CATEGORIES = [
  'housing',
  'transportation',
  'food',
  'utilities',
  'insurance',
  'healthcare',
  'entertainment',
  'personal',
  'debt',
  'savings',
  'other',
];

const CATEGORY_LABELS: Record<string, string> = {
  housing: 'Housing',
  transportation: 'Transportation',
  food: 'Food',
  utilities: 'Utilities',
  insurance: 'Insurance',
  healthcare: 'Healthcare',
  entertainment: 'Entertainment',
  personal: 'Personal',
  debt: 'Debt',
  savings: 'Savings',
  other: 'Other',
};

export default function BudgetPage() {
  const [income, setIncome] = useState<IncomeItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Load data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadIncome(), loadExpenses(), loadGoals()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadIncome = async () => {
    const { data, error } = await supabase
      .from('income_items')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading income:', error);
      return;
    }

    setIncome(data || []);
  };

  const loadExpenses = async () => {
    const { data, error } = await supabase
      .from('expense_items')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading expenses:', error);
      return;
    }

    setExpenses(data || []);
  };

  const loadGoals = async () => {
    const { data, error } = await supabase
      .from('financial_goals')
      .select('*')
      .eq('is_completed', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading goals:', error);
      return;
    }

    setGoals(data || []);
  };

  // Calculate totals
  const totalIncome = income.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const netIncome = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((netIncome / totalIncome) * 100).toFixed(1) : '0';

  // Income Functions
  const addIncome = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('income_items')
      .insert({
        user_id: user.id,
        source_name: 'New Income Source',
        amount: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding income:', error);
      return;
    }

    setIncome([...income, data]);
  };

  const removeIncome = async (id: string) => {
    const { error } = await supabase
      .from('income_items')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error removing income:', error);
      return;
    }

    setIncome(income.filter((item) => item.id !== id));
  };

  const updateIncome = async (id: string, field: 'source_name' | 'amount', value: string | number) => {
    const updates: any = { [field]: value };

    const { error } = await supabase
      .from('income_items')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating income:', error);
      return;
    }

    setIncome(
      income.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // Expense Functions
  const addExpense = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('expense_items')
      .insert({
        user_id: user.id,
        category: EXPENSE_CATEGORIES[0],
        name: 'New Expense',
        amount: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding expense:', error);
      return;
    }

    setExpenses([...expenses, data]);
  };

  const removeExpense = async (id: string) => {
    const { error } = await supabase
      .from('expense_items')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error removing expense:', error);
      return;
    }

    setExpenses(expenses.filter((item) => item.id !== id));
  };

  const updateExpense = async (
    id: string,
    field: 'category' | 'name' | 'amount',
    value: string | number
  ) => {
    const updates: any = { [field]: value };

    const { error } = await supabase
      .from('expense_items')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating expense:', error);
      return;
    }

    setExpenses(
      expenses.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // Goal Functions
  const addGoal = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('financial_goals')
      .insert({
        user_id: user.id,
        goal_name: 'New Goal',
        target_amount: 0,
        current_amount: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding goal:', error);
      return;
    }

    setGoals([...goals, data]);
  };

  const removeGoal = async (id: string) => {
    const { error } = await supabase
      .from('financial_goals')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error removing goal:', error);
      return;
    }

    setGoals(goals.filter((item) => item.id !== id));
  };

  const updateGoal = async (
    id: string,
    field: 'goal_name' | 'target_amount' | 'current_amount',
    value: string | number
  ) => {
    const updates: any = { [field]: value };

    const { error } = await supabase
      .from('financial_goals')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating goal:', error);
      return;
    }

    setGoals(
      goals.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // Calculate expense breakdown by category
  const expensesByCategory = expenses.reduce((acc, expense) => {
    const category = expense.category;
    acc[category] = (acc[category] || 0) + Number(expense.amount);
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your budget...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header with Summary */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Budget Planner</h1>
        <p className="text-muted-foreground">
          Track your income, expenses, and financial goals
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-2xl font-bold text-green-600">
                ${totalIncome.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">
                ${totalExpenses.toFixed(2)}
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Net Income</p>
              <p
                className={`text-2xl font-bold ${
                  netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                ${netIncome.toFixed(2)}
              </p>
            </div>
            <Target className="h-8 w-8" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Savings Rate</p>
              <p className="text-2xl font-bold">{savingsRate}%</p>
            </div>
            <div className="text-sm text-muted-foreground">
              {netIncome >= 0 ? 'On Track' : 'Overspending'}
            </div>
          </div>
        </Card>
      </div>

      {/* Income & Expenses Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Income Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Income Sources</h2>
            <Button onClick={addIncome} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Income
            </Button>
          </div>

          <div className="space-y-3">
            {income.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No income sources added. Click "Add Income" to get started.
              </p>
            ) : (
              income.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 p-3 border rounded-lg"
                >
                  <input
                    type="text"
                    placeholder="Source (e.g., Salary)"
                    value={item.source_name}
                    onChange={(e) =>
                      updateIncome(item.id, 'source_name', e.target.value)
                    }
                    className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    value={item.amount || ''}
                    onChange={(e) =>
                      updateIncome(
                        item.id,
                        'amount',
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-32 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    min="0"
                    step="0.01"
                  />
                  <Button
                    onClick={() => removeIncome(item.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {income.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center font-semibold">
                <span>Total Monthly Income:</span>
                <span className="text-green-600 text-lg">
                  ${totalIncome.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Expenses Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Expenses</h2>
            <Button onClick={addExpense} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No expenses added. Click "Add Expense" to track your spending.
              </p>
            ) : (
              expenses.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 p-3 border rounded-lg"
                >
                  <select
                    value={item.category}
                    onChange={(e) =>
                      updateExpense(item.id, 'category', e.target.value)
                    }
                    className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Name"
                    value={item.name}
                    onChange={(e) =>
                      updateExpense(item.id, 'name', e.target.value)
                    }
                    className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    value={item.amount || ''}
                    onChange={(e) =>
                      updateExpense(
                        item.id,
                        'amount',
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-28 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    min="0"
                    step="0.01"
                  />
                  <Button
                    onClick={() => removeExpense(item.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {expenses.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center font-semibold">
                <span>Total Monthly Expenses:</span>
                <span className="text-red-600 text-lg">
                  ${totalExpenses.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Expense Breakdown Chart */}
      {expenses.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Spending by Category</h2>
          <div className="space-y-3">
            {Object.entries(expensesByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([category, amount]) => {
                const percentage =
                  totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                return (
                  <div key={category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{CATEGORY_LABELS[category]}</span>
                      <span>
                        ${amount.toFixed(2)} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {/* Financial Goals */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Financial Goals</h2>
          <Button onClick={addGoal} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Goal
          </Button>
        </div>

        <div className="space-y-4">
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No goals set. Click "Add Goal" to start tracking your financial goals.
            </p>
          ) : (
            goals.map((goal) => {
              const progress =
                goal.target_amount > 0
                  ? (Number(goal.current_amount) / Number(goal.target_amount)) * 100
                  : 0;
              const remaining = Number(goal.target_amount) - Number(goal.current_amount);

              return (
                <div key={goal.id} className="p-4 border rounded-lg">
                  <div className="flex items-start gap-3 mb-3">
                    <input
                      type="text"
                      placeholder="Goal name (e.g., Emergency Fund)"
                      value={goal.goal_name}
                      onChange={(e) =>
                        updateGoal(goal.id, 'goal_name', e.target.value)
                      }
                      className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <Button
                      onClick={() => removeGoal(goal.id)}
                      variant="outline"
                      size="sm"
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-sm text-muted-foreground block mb-1">
                        Target Amount
                      </label>
                      <input
                        type="number"
                        placeholder="Target"
                        value={goal.target_amount || ''}
                        onChange={(e) =>
                          updateGoal(
                            goal.id,
                            'target_amount',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground block mb-1">
                        Current Amount
                      </label>
                      <input
                        type="number"
                        placeholder="Current"
                        value={goal.current_amount || ''}
                        onChange={(e) =>
                          updateGoal(
                            goal.id,
                            'current_amount',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  {goal.target_amount > 0 && (
                    <>
                      <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                        <div
                          className="bg-green-600 h-3 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-semibold"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        >
                          {progress >= 20 && `${progress.toFixed(0)}%`}
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          ${Number(goal.current_amount).toFixed(2)} saved
                        </span>
                        <span className="text-muted-foreground">
                          ${remaining.toFixed(2)} remaining
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Budget Health Indicator */}
      {(income.length > 0 || expenses.length > 0) && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Budget Health</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Income vs Expenses</span>
                <span className="font-semibold">
                  ${netIncome.toFixed(2)} {netIncome >= 0 ? 'surplus' : 'deficit'}
                </span>
              </div>
              <div className="relative w-full bg-gray-200 rounded-full h-4">
                <div
                  className={`absolute h-4 rounded-full transition-all duration-300 ${
                    netIncome >= 0 ? 'bg-green-600' : 'bg-red-600'
                  }`}
                  style={{
                    width: `${
                      totalIncome > 0
                        ? Math.min((totalExpenses / totalIncome) * 100, 100)
                        : 0
                    }%`,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                  {totalIncome > 0 &&
                    `${((totalExpenses / totalIncome) * 100).toFixed(0)}% spent`}
                </div>
              </div>
            </div>

            {netIncome >= 0 && totalIncome > 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Great job!</strong> You're saving ${netIncome.toFixed(2)} per
                  month ({savingsRate}% of your income). Keep it up!
                </p>
              </div>
            )}

            {netIncome < 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> Your expenses exceed your income by $
                  {Math.abs(netIncome).toFixed(2)}. Consider reducing expenses or
                  increasing income.
                </p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
