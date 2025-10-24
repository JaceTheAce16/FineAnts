import { FinancialAccount, Transaction, AccountType, TransactionCategory } from './types/database';

export const mockAccounts: Omit<FinancialAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Main Checking',
    account_type: 'checking' as AccountType,
    institution_name: 'Chase Bank',
    account_number_last4: '1234',
    current_balance: 5432.50,
    available_balance: 5432.50,
    currency: 'USD',
    is_manual: true,
    plaid_account_id: null,
    plaid_item_id: null,
  },
  {
    name: 'Rewards Credit Card',
    account_type: 'credit_card' as AccountType,
    institution_name: 'Capital One',
    account_number_last4: '5678',
    current_balance: -1250.75,
    available_balance: 8749.25,
    currency: 'USD',
    is_manual: true,
    plaid_account_id: null,
    plaid_item_id: null,
  },
];

export const mockTransactions: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  {
    account_id: null, // Will be set when account is created
    amount: -85.32,
    description: 'Whole Foods Market',
    category: 'food' as TransactionCategory,
    transaction_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_pending: false,
    plaid_transaction_id: null,
  },
  {
    account_id: null,
    amount: -45.00,
    description: 'Shell Gas Station',
    category: 'transportation' as TransactionCategory,
    transaction_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_pending: false,
    plaid_transaction_id: null,
  },
  {
    account_id: null,
    amount: 3500.00,
    description: 'Payroll Deposit',
    category: 'income' as TransactionCategory,
    transaction_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_pending: false,
    plaid_transaction_id: null,
  },
  {
    account_id: null,
    amount: -1200.00,
    description: 'Rent Payment',
    category: 'housing' as TransactionCategory,
    transaction_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_pending: false,
    plaid_transaction_id: null,
  },
  {
    account_id: null,
    amount: -29.99,
    description: 'Netflix Subscription',
    category: 'entertainment' as TransactionCategory,
    transaction_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_pending: false,
    plaid_transaction_id: null,
  },
  {
    account_id: null,
    amount: -125.50,
    description: 'Electric Company',
    category: 'utilities' as TransactionCategory,
    transaction_date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_pending: false,
    plaid_transaction_id: null,
  },
  {
    account_id: null,
    amount: -67.89,
    description: 'Amazon.com',
    category: 'shopping' as TransactionCategory,
    transaction_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_pending: false,
    plaid_transaction_id: null,
  },
  {
    account_id: null,
    amount: -150.00,
    description: 'Dr. Smith Medical Center',
    category: 'healthcare' as TransactionCategory,
    transaction_date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_pending: false,
    plaid_transaction_id: null,
  },
  {
    account_id: null,
    amount: -42.15,
    description: 'Starbucks',
    category: 'food' as TransactionCategory,
    transaction_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_pending: true,
    plaid_transaction_id: null,
  },
  {
    account_id: null,
    amount: -500.00,
    description: 'Credit Card Payment',
    category: 'debt_payment' as TransactionCategory,
    transaction_date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_pending: false,
    plaid_transaction_id: null,
  },
];

export function calculateNetWorth(accounts: FinancialAccount[]): number {
  return accounts.reduce((total, account) => {
    // Credit cards and loans are negative (liabilities)
    if (account.account_type === 'credit_card' || account.account_type === 'loan' || account.account_type === 'mortgage') {
      return total - Math.abs(account.current_balance);
    }
    // Everything else is positive (assets)
    return total + account.current_balance;
  }, 0);
}

export function calculateMonthlySpending(transactions: Transaction[]): number {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return transactions
    .filter(t => {
      const tDate = new Date(t.transaction_date);
      return tDate >= firstDayOfMonth && t.amount < 0;
    })
    .reduce((total, t) => total + Math.abs(t.amount), 0);
}
