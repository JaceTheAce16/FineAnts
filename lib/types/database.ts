export type AccountType =
  | 'checking'
  | 'savings'
  | 'credit_card'
  | 'investment'
  | 'retirement'
  | 'loan'
  | 'mortgage'
  | 'other';

export type TransactionCategory =
  | 'income'
  | 'housing'
  | 'transportation'
  | 'food'
  | 'utilities'
  | 'healthcare'
  | 'entertainment'
  | 'shopping'
  | 'debt_payment'
  | 'savings'
  | 'other';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialAccount {
  id: string;
  user_id: string;
  name: string;
  account_type: AccountType;
  institution_name: string | null;
  account_number_last4: string | null;
  current_balance: number;
  available_balance: number | null;
  currency: string;
  is_manual: boolean;
  plaid_account_id: string | null;
  plaid_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  amount: number;
  description: string;
  category: TransactionCategory;
  transaction_date: string;
  is_pending: boolean;
  plaid_transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  name: string;
  category: TransactionCategory;
  amount: number;
  period: string;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}
