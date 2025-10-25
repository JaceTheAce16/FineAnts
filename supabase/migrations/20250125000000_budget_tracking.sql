-- Budget Tracking Schema
-- Adds tables for income, expenses, and financial goals

-- Create budget categories enum
CREATE TYPE budget_category AS ENUM (
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
  'other'
);

-- Create income table
CREATE TABLE income_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  frequency TEXT NOT NULL DEFAULT 'monthly', -- monthly, weekly, biweekly, yearly
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create expenses table
CREATE TABLE expense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category budget_category NOT NULL,
  name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  frequency TEXT NOT NULL DEFAULT 'monthly',
  is_recurring BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create financial goals table
CREATE TABLE financial_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_name TEXT NOT NULL,
  target_amount DECIMAL(10, 2) NOT NULL CHECK (target_amount > 0),
  current_amount DECIMAL(10, 2) DEFAULT 0 CHECK (current_amount >= 0),
  target_date DATE,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_income_user_id ON income_items(user_id);
CREATE INDEX idx_expense_user_id ON expense_items(user_id);
CREATE INDEX idx_expense_category ON expense_items(category);
CREATE INDEX idx_goals_user_id ON financial_goals(user_id);

-- Enable RLS
ALTER TABLE income_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own income"
  ON income_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own income"
  ON income_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own income"
  ON income_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own income"
  ON income_items FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own expenses"
  ON expense_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON expense_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON expense_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON expense_items FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own goals"
  ON financial_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON financial_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON financial_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON financial_goals FOR DELETE
  USING (auth.uid() = user_id);
