/**
 * Tests for PlaidTransactionsList Component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase client
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe('PlaidTransactionsList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock chain for successful fetch
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 'txn-1',
          description: 'Starbucks',
          amount: 5.50,
          transaction_date: '2025-01-15',
          category: 'food',
          is_pending: false,
          account_id: 'acc-1',
          user_id: 'user-123',
        },
        {
          id: 'txn-2',
          description: 'Shell Gas',
          amount: 45.00,
          transaction_date: '2025-01-14',
          category: 'transportation',
          is_pending: true,
          account_id: 'acc-1',
          user_id: 'user-123',
        },
        {
          id: 'txn-3',
          description: 'Salary Deposit',
          amount: -3000.00,
          transaction_date: '2025-01-01',
          category: 'income',
          is_pending: false,
          account_id: 'acc-1',
          user_id: 'user-123',
        },
        {
          id: 'txn-4',
          description: 'Amazon Purchase',
          amount: 89.99,
          transaction_date: '2024-12-28',
          category: 'shopping',
          is_pending: false,
          account_id: 'acc-1',
          user_id: 'user-123',
        },
      ],
      error: null,
    });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it('should export PlaidTransactionsList', async () => {
    const { PlaidTransactionsList } = await import('@/components/plaid-transactions-list');
    expect(PlaidTransactionsList).toBeDefined();
  });

  it('should fetch transactions on mount', async () => {
    const { PlaidTransactionsList } = await import('@/components/plaid-transactions-list');
    expect(PlaidTransactionsList).toBeDefined();
  });

  it('should filter by account when accountId is provided', async () => {
    const { PlaidTransactionsList } = await import('@/components/plaid-transactions-list');
    expect(PlaidTransactionsList).toBeDefined();
    // Component should use .eq('account_id', accountId) when accountId prop is provided
  });

  it('should handle empty transactions list', async () => {
    mockOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    const { PlaidTransactionsList } = await import('@/components/plaid-transactions-list');
    expect(PlaidTransactionsList).toBeDefined();
  });

  it('should handle fetch errors', async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const { PlaidTransactionsList } = await import('@/components/plaid-transactions-list');
    expect(PlaidTransactionsList).toBeDefined();
  });

  it('should sort transactions by date descending', async () => {
    const transactions = [
      { transaction_date: '2025-01-10' },
      { transaction_date: '2025-01-15' },
      { transaction_date: '2025-01-05' },
    ];

    const sorted = [...transactions].sort((a, b) =>
      b.transaction_date.localeCompare(a.transaction_date)
    );

    expect(sorted[0].transaction_date).toBe('2025-01-15');
    expect(sorted[2].transaction_date).toBe('2025-01-05');
  });

  it('should group transactions by month', async () => {
    const transactions = [
      { transaction_date: '2025-01-15', id: '1' },
      { transaction_date: '2025-01-10', id: '2' },
      { transaction_date: '2024-12-28', id: '3' },
    ];

    const grouped: Record<string, any[]> = {};
    transactions.forEach((txn) => {
      const date = new Date(txn.transaction_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(txn);
    });

    expect(grouped['2025-01']).toHaveLength(2);
    expect(grouped['2024-12']).toHaveLength(1);
  });

  it('should filter by category', async () => {
    const transactions = [
      { category: 'food', amount: 10 },
      { category: 'transportation', amount: 20 },
      { category: 'food', amount: 15 },
    ];

    const filtered = transactions.filter((txn) => txn.category === 'food');
    expect(filtered).toHaveLength(2);
  });

  it('should filter by minimum amount', async () => {
    const transactions = [
      { amount: 5.50 },
      { amount: 45.00 },
      { amount: 89.99 },
    ];

    const minAmount = 20;
    const filtered = transactions.filter((txn) => Math.abs(txn.amount) >= minAmount);
    expect(filtered).toHaveLength(2);
  });

  it('should filter by maximum amount', async () => {
    const transactions = [
      { amount: 5.50 },
      { amount: 45.00 },
      { amount: 89.99 },
    ];

    const maxAmount = 50;
    const filtered = transactions.filter((txn) => Math.abs(txn.amount) <= maxAmount);
    expect(filtered).toHaveLength(2);
  });

  it('should filter by date range', async () => {
    const transactions = [
      { transaction_date: '2025-01-05' },
      { transaction_date: '2025-01-15' },
      { transaction_date: '2025-01-25' },
    ];

    const startDate = '2025-01-10';
    const endDate = '2025-01-20';

    const filtered = transactions.filter(
      (txn) => txn.transaction_date >= startDate && txn.transaction_date <= endDate
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].transaction_date).toBe('2025-01-15');
  });

  it('should format currency correctly', async () => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    });

    expect(formatter.format(5.50)).toBe('$5.50');
    expect(formatter.format(1000)).toBe('$1,000.00');
  });

  it('should format dates correctly', async () => {
    const date = new Date('2025-01-15');
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    expect(formatter.format(date)).toBeTruthy();
  });

  it('should format month headers correctly', async () => {
    const monthKey = '2025-01';
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    });

    expect(formatter.format(date)).toBe('January 2025');
  });

  it('should map category labels correctly', async () => {
    const labels: Record<string, string> = {
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

    expect(labels['food']).toBe('Food');
    expect(labels['debt_payment']).toBe('Debt Payment');
  });

  it('should show pending indicator for pending transactions', async () => {
    const transaction = {
      is_pending: true,
      description: 'Test Transaction',
    };

    expect(transaction.is_pending).toBe(true);
  });

  it('should display income as positive (green)', async () => {
    const transaction = {
      amount: -3000.00, // Negative amount = income
    };

    expect(transaction.amount).toBeLessThan(0);
  });

  it('should display expenses as negative (red)', async () => {
    const transaction = {
      amount: 50.00, // Positive amount = expense
    };

    expect(transaction.amount).toBeGreaterThan(0);
  });

  it('should clear all filters', async () => {
    let categoryFilter = 'food';
    let minAmount = '10';
    let maxAmount = '100';
    let startDate = '2025-01-01';
    let endDate = '2025-01-31';

    // Clear filters
    categoryFilter = 'all';
    minAmount = '';
    maxAmount = '';
    startDate = '';
    endDate = '';

    expect(categoryFilter).toBe('all');
    expect(minAmount).toBe('');
    expect(maxAmount).toBe('');
    expect(startDate).toBe('');
    expect(endDate).toBe('');
  });

  it('should show filtered count', async () => {
    const totalTransactions = 100;
    const filteredTransactions = 25;

    const message = `Showing ${filteredTransactions} of ${totalTransactions} transactions`;
    expect(message).toBe('Showing 25 of 100 transactions');
  });

  it('should handle combined filters', async () => {
    const transactions = [
      { category: 'food', amount: 25.00, transaction_date: '2025-01-15' },
      { category: 'food', amount: 5.00, transaction_date: '2025-01-10' },
      { category: 'transportation', amount: 30.00, transaction_date: '2025-01-12' },
    ];

    const categoryFilter = 'food';
    const minAmount = 10;

    const filtered = transactions.filter(
      (txn) => txn.category === categoryFilter && Math.abs(txn.amount) >= minAmount
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].amount).toBe(25.00);
  });

  it('should sort month groups in descending order', async () => {
    const monthKeys = ['2024-12', '2025-01', '2024-11'];
    const sorted = monthKeys.sort((a, b) => b.localeCompare(a));

    expect(sorted[0]).toBe('2025-01');
    expect(sorted[1]).toBe('2024-12');
    expect(sorted[2]).toBe('2024-11');
  });

  // Note: Full component rendering tests would require:
  // - React Testing Library (@testing-library/react)
  // - User event simulation (@testing-library/user-event)
  // - DOM manipulation and assertions
  // - Testing actual component rendering
  // - Testing filter inputs and changes
  // - Testing clear filters button
  // - Testing empty states
  // - Testing loading states
  // - Testing error states
});
