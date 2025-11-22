/**
 * Savings Goals Page
 * Set and track progress toward financial goals
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Target, TrendingUp, Calendar, DollarSign, Loader2, Edit2, Save, X } from 'lucide-react';

// Types
interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  description: string | null;
  created_at: string;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    current_amount: '0',
    target_date: '',
    description: '',
  });
  const supabase = createClient();

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('savings_goals')
        .insert({
          user_id: user.id,
          name: formData.name,
          target_amount: parseFloat(formData.target_amount),
          current_amount: parseFloat(formData.current_amount) || 0,
          target_date: formData.target_date || null,
          description: formData.description || null,
        })
        .select()
        .single();

      if (error) throw error;

      setGoals([data, ...goals]);
      setFormData({
        name: '',
        target_amount: '',
        current_amount: '0',
        target_date: '',
        description: '',
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding goal:', error);
      alert('Failed to add goal. Please try again.');
    }
  };

  const handleUpdateGoal = async (id: string, updates: Partial<SavingsGoal>) => {
    try {
      const { error } = await supabase
        .from('savings_goals')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setGoals(
        goals.map((goal) =>
          goal.id === id ? { ...goal, ...updates } : goal
        )
      );
      setEditingId(null);
    } catch (error) {
      console.error('Error updating goal:', error);
      alert('Failed to update goal. Please try again.');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('savings_goals')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setGoals(goals.filter((goal) => goal.id !== id));
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('Failed to delete goal. Please try again.');
    }
  };

  const calculateProgress = (goal: SavingsGoal) => {
    if (goal.target_amount <= 0) return 0;
    return Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100);
  };

  const calculateRemaining = (goal: SavingsGoal) => {
    return Math.max(Number(goal.target_amount) - Number(goal.current_amount), 0);
  };

  const getDaysRemaining = (targetDate: string | null) => {
    if (!targetDate) return null;
    const today = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const totalTargetAmount = goals.reduce((sum, goal) => sum + Number(goal.target_amount), 0);
  const totalSavedAmount = goals.reduce((sum, goal) => sum + Number(goal.current_amount), 0);
  const overallProgress = totalTargetAmount > 0 ? (totalSavedAmount / totalTargetAmount) * 100 : 0;

  if (loading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your goals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Savings Goals</h1>
          <p className="text-muted-foreground">
            Set and track progress toward your financial goals
          </p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Goal
        </Button>
      </div>

      {/* Overall Progress Card */}
      {goals.length > 0 && (
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">Overall Progress</h2>
              <p className="text-sm text-muted-foreground">
                Track your progress across all goals
              </p>
            </div>
            <Target className="h-12 w-12 text-primary opacity-50" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Saved</span>
              <span className="font-semibold">${totalSavedAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total Target</span>
              <span className="font-semibold">${totalTargetAmount.toFixed(2)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 mt-2">
              <div
                className="bg-primary h-4 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-semibold"
                style={{ width: `${Math.min(overallProgress, 100)}%` }}
              >
                {overallProgress >= 15 && `${overallProgress.toFixed(0)}%`}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Add Goal Form */}
      {showAddForm && (
        <Card className="p-6">
          <form onSubmit={handleAddGoal} className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">New Savings Goal</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Goal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Emergency Fund, Vacation, New Car"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Target Amount *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  placeholder="10000.00"
                  value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Current Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.current_amount}
                  onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Target Date (optional)</label>
                <input
                  type="date"
                  value={formData.target_date}
                  onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Description (optional)</label>
                <textarea
                  placeholder="Why is this goal important to you?"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Add Goal</Button>
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Goals List */}
      <div className="space-y-4">
        {goals.length === 0 ? (
          <Card className="p-12 text-center">
            <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No Goals Yet</h3>
            <p className="text-muted-foreground mb-4">
              Start by creating your first savings goal to track your progress
            </p>
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Goal
            </Button>
          </Card>
        ) : (
          goals.map((goal) => {
            const progress = calculateProgress(goal);
            const remaining = calculateRemaining(goal);
            const daysRemaining = getDaysRemaining(goal.target_date);
            const isEditing = editingId === goal.id;
            const isCompleted = progress >= 100;

            return (
              <Card key={goal.id} className={`p-6 ${isCompleted ? 'border-green-500 bg-green-50/50' : ''}`}>
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {isEditing ? (
                        <input
                          type="text"
                          value={goal.name}
                          onChange={(e) =>
                            setGoals(
                              goals.map((g) =>
                                g.id === goal.id ? { ...g, name: e.target.value } : g
                              )
                            )
                          }
                          className="w-full text-xl font-bold px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        <h3 className="text-xl font-bold">{goal.name}</h3>
                      )}
                      {goal.description && !isEditing && (
                        <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleUpdateGoal(goal.id, {
                                name: goal.name,
                                current_amount: goal.current_amount,
                                target_amount: goal.target_amount,
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
                              loadGoals();
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
                            onClick={() => setEditingId(goal.id)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteGoal(goal.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Current</p>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={goal.current_amount}
                            onChange={(e) =>
                              setGoals(
                                goals.map((g) =>
                                  g.id === goal.id
                                    ? { ...g, current_amount: parseFloat(e.target.value) || 0 }
                                    : g
                                )
                              )
                            }
                            className="w-full text-sm font-semibold px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        ) : (
                          <p className="text-sm font-semibold">${Number(goal.current_amount).toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
                        <Target className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Target</p>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={goal.target_amount}
                            onChange={(e) =>
                              setGoals(
                                goals.map((g) =>
                                  g.id === goal.id
                                    ? { ...g, target_amount: parseFloat(e.target.value) || 0 }
                                    : g
                                )
                              )
                            }
                            className="w-full text-sm font-semibold px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        ) : (
                          <p className="text-sm font-semibold">${Number(goal.target_amount).toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100">
                        {goal.target_date ? <Calendar className="h-5 w-5 text-purple-600" /> : <TrendingUp className="h-5 w-5 text-purple-600" />}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {goal.target_date ? 'Days Left' : 'Remaining'}
                        </p>
                        <p className="text-sm font-semibold">
                          {goal.target_date && daysRemaining !== null
                            ? daysRemaining > 0
                              ? `${daysRemaining} days`
                              : 'Past due'
                            : `$${remaining.toFixed(2)}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">{progress.toFixed(1)}% Complete</span>
                      <span className="text-muted-foreground">
                        ${remaining.toFixed(2)} to go
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className={`h-4 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-semibold ${
                          isCompleted ? 'bg-green-600' : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      >
                        {progress >= 15 && `${progress.toFixed(0)}%`}
                      </div>
                    </div>
                  </div>

                  {/* Target Date */}
                  {goal.target_date && (
                    <div className="text-sm text-muted-foreground">
                      Target date: {new Date(goal.target_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  )}

                  {/* Completion Badge */}
                  {isCompleted && (
                    <div className="flex items-center gap-2 p-3 bg-green-100 border border-green-200 rounded-lg">
                      <Target className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-semibold text-green-800">
                        🎉 Congratulations! You've reached your goal!
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
