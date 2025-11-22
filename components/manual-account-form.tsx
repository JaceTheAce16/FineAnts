/**
 * Manual Account Entry Form Component
 * Allows users to add accounts manually (not through Plaid)
 */

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

interface ManualAccountFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'investment', label: 'Investment' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'loan', label: 'Loan' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'other', label: 'Other' },
];

export function ManualAccountForm({ onSuccess, onCancel }: ManualAccountFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    account_type: 'checking',
    institution_name: '',
    account_number_last4: '',
    current_balance: '',
  });

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be logged in to add an account');
        return;
      }

      const { error: insertError } = await supabase
        .from('financial_accounts')
        .insert({
          user_id: user.id,
          name: formData.name,
          account_type: formData.account_type,
          institution_name: formData.institution_name || null,
          account_number_last4: formData.account_number_last4 || null,
          current_balance: parseFloat(formData.current_balance) || 0,
          is_manual: true,
        });

      if (insertError) {
        throw insertError;
      }

      // Success!
      onSuccess();
    } catch (err: any) {
      console.error('Error adding manual account:', err);
      setError(err.message || 'Failed to add account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Add Manual Account</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={loading}
        >
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

          <div className="space-y-2">
            <Label htmlFor="name">Account Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Chase Checking"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_type">Account Type *</Label>
            <select
              id="account_type"
              value={formData.account_type}
              onChange={(e) => handleChange('account_type', e.target.value)}
              required
              disabled={loading}
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {ACCOUNT_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="institution_name">Bank/Institution</Label>
            <Input
              id="institution_name"
              placeholder="e.g., Chase Bank"
              value={formData.institution_name}
              onChange={(e) => handleChange('institution_name', e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_number_last4">Last 4 Digits of Account</Label>
            <Input
              id="account_number_last4"
              placeholder="e.g., 1234"
              value={formData.account_number_last4}
              onChange={(e) => {
                // Only allow numbers and limit to 4 digits
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                handleChange('account_number_last4', value);
              }}
              maxLength={4}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="current_balance">Current Balance *</Label>
            <Input
              id="current_balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.current_balance}
              onChange={(e) => handleChange('current_balance', e.target.value)}
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              For debt accounts (credit cards, loans), enter the amount owed as a positive number
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Adding Account...' : 'Add Account'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
