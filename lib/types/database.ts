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

export type SubscriptionTier = 'free' | 'basic' | 'premium';

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'trialing';

export type PlaidItemStatus =
  | 'active'
  | 'error'
  | 'pending_expiration'
  | 'revoked';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  subscription_tier: SubscriptionTier;
  stripe_customer_id: string | null;
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

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_price_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  event_data: Record<string, any> | null;
  processed: boolean;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface PlaidItem {
  id: string;
  user_id: string;
  item_id: string;
  access_token: string; // Always encrypted
  institution_id: string;
  institution_name: string;
  status: PlaidItemStatus;
  error_code: string | null;
  error_message: string | null;
  transactions_cursor: string | null;
  last_sync: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaidLinkMetadata {
  institution: {
    institution_id: string;
    name: string;
  } | null;
  accounts: Array<{
    id: string;
    name: string;
    mask: string | null;
    type: string;
    subtype: string | null;
  }>;
  link_session_id: string;
  public_token: string;
}
