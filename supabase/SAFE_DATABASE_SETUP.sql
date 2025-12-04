-- ==============================================================================
-- FINEANANTS SAFE DATABASE SETUP
-- This version handles existing objects gracefully
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- ==============================================================================
-- 1. CREATE CUSTOM TYPES (with existence checks)
-- ==============================================================================

DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('checking', 'savings', 'credit_card', 'investment', 'retirement', 'loan', 'mortgage', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_category AS ENUM ('income', 'housing', 'transportation', 'food', 'utilities', 'healthcare', 'entertainment', 'shopping', 'debt_payment', 'savings', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'premium');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE plaid_item_status AS ENUM ('active', 'error', 'pending_expiration', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- 2. CREATE TABLES (with IF NOT EXISTS)
-- ==============================================================================

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial accounts table
CREATE TABLE IF NOT EXISTS financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type account_type NOT NULL,
  institution_name TEXT,
  account_number_last4 TEXT,
  current_balance DECIMAL(12, 2) DEFAULT 0,
  available_balance DECIMAL(12, 2),
  currency TEXT DEFAULT 'USD',
  is_manual BOOLEAN DEFAULT true,
  plaid_account_id TEXT,
  plaid_item_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES financial_accounts(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT NOT NULL,
  category transaction_category DEFAULT 'other',
  transaction_date DATE NOT NULL,
  is_pending BOOLEAN DEFAULT false,
  plaid_transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category transaction_category NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  period TEXT DEFAULT 'monthly',
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Savings goals table
CREATE TABLE IF NOT EXISTS savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount DECIMAL(12, 2) NOT NULL,
  current_amount DECIMAL(12, 2) DEFAULT 0,
  target_date DATE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  tier subscription_tier NOT NULL DEFAULT 'free',
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook events table
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  attempts INTEGER DEFAULT 0,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Plaid items table
CREATE TABLE IF NOT EXISTS plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  status plaid_item_status NOT NULL DEFAULT 'active',
  error_code TEXT,
  error_message TEXT,
  transactions_cursor TEXT,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. ADD SYNC STATUS COLUMNS TO PLAID_ITEMS (if they don't exist)
-- ==============================================================================

DO $$ BEGIN
  ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_status TEXT;
  ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_progress INTEGER DEFAULT 0;
  ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_transaction_count INTEGER DEFAULT 0;
  ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_message TEXT;
  ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_error TEXT;
  ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_started_at TIMESTAMPTZ;
  ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_completed_at TIMESTAMPTZ;
END $$;

-- ==============================================================================
-- 4. CREATE INDEXES (with IF NOT EXISTS)
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_financial_accounts_user_id ON financial_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_item_id ON plaid_items(item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_status ON plaid_items(status);
CREATE INDEX IF NOT EXISTS idx_plaid_items_sync_status ON plaid_items(item_id, sync_status) WHERE sync_status IS NOT NULL;

-- ==============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ==============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 6. CREATE RLS POLICIES (drop existing first to avoid conflicts)
-- ==============================================================================

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Financial accounts policies
DROP POLICY IF EXISTS "Users can view own accounts" ON financial_accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON financial_accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON financial_accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON financial_accounts;

CREATE POLICY "Users can view own accounts" ON financial_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON financial_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON financial_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON financial_accounts FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);

-- Budgets policies
DROP POLICY IF EXISTS "Users can view own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON budgets;

CREATE POLICY "Users can view own budgets" ON budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON budgets FOR DELETE USING (auth.uid() = user_id);

-- Savings goals policies
DROP POLICY IF EXISTS "Users can view own goals" ON savings_goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON savings_goals;
DROP POLICY IF EXISTS "Users can update own goals" ON savings_goals;
DROP POLICY IF EXISTS "Users can delete own goals" ON savings_goals;

CREATE POLICY "Users can view own goals" ON savings_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON savings_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON savings_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON savings_goals FOR DELETE USING (auth.uid() = user_id);

-- Subscriptions policies
DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;

CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Plaid items policies
DROP POLICY IF EXISTS "Users can view their own Plaid items" ON plaid_items;
DROP POLICY IF EXISTS "Users can delete their own Plaid items" ON plaid_items;

CREATE POLICY "Users can view their own Plaid items" ON plaid_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own Plaid items" ON plaid_items FOR DELETE USING (auth.uid() = user_id);

-- ==============================================================================
-- 7. CREATE FUNCTIONS AND TRIGGERS
-- ==============================================================================

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup (drop existing first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update plaid_items updated_at timestamp
CREATE OR REPLACE FUNCTION update_plaid_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at (drop existing first)
DROP TRIGGER IF EXISTS on_plaid_items_update ON plaid_items;

CREATE TRIGGER on_plaid_items_update
  BEFORE UPDATE ON plaid_items
  FOR EACH ROW
  EXECUTE FUNCTION update_plaid_items_updated_at();

-- ==============================================================================
-- 8. ADD COMMENTS FOR DOCUMENTATION
-- ==============================================================================

COMMENT ON TABLE plaid_items IS 'Stores Plaid item metadata and encrypted access tokens for financial account connectivity';
COMMENT ON COLUMN plaid_items.access_token IS 'AES-256-GCM encrypted Plaid access token';
COMMENT ON COLUMN plaid_items.transactions_cursor IS 'Cursor for incremental transaction sync using Plaid /transactions/sync endpoint';
COMMENT ON COLUMN plaid_items.sync_status IS 'Background sync status: pending, syncing, completed, failed, timeout';
COMMENT ON COLUMN plaid_items.sync_progress IS 'Sync progress percentage (0-100)';
COMMENT ON COLUMN plaid_items.sync_transaction_count IS 'Number of transactions synced so far';
COMMENT ON COLUMN plaid_items.sync_message IS 'User-friendly status message';
COMMENT ON COLUMN plaid_items.sync_error IS 'Error message if sync failed';
COMMENT ON COLUMN plaid_items.sync_started_at IS 'Timestamp when sync started';
COMMENT ON COLUMN plaid_items.sync_completed_at IS 'Timestamp when sync completed or failed';

-- ==============================================================================
-- SETUP COMPLETE!
-- ==============================================================================
-- Your database is now ready for FineAnts with:
-- ✅ Core financial tracking (accounts, transactions, budgets, savings goals)
-- ✅ Stripe subscription management
-- ✅ Plaid bank connectivity with background sync
-- ✅ Webhook event tracking with retry support
-- ✅ Full Row Level Security (RLS)
-- ==============================================================================
