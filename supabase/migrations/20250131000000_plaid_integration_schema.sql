-- Plaid Integration Schema
-- Migration: Add Plaid financial account connectivity tables

-- Create custom types for Plaid item status
CREATE TYPE plaid_item_status AS ENUM (
  'active',
  'error',
  'pending_expiration',
  'revoked'
);

-- Create plaid_items table for storing encrypted access tokens
CREATE TABLE plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL, -- Encrypted access token
  institution_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  status plaid_item_status NOT NULL DEFAULT 'active',
  error_code TEXT,
  error_message TEXT,
  transactions_cursor TEXT, -- For incremental transaction sync
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX idx_plaid_items_item_id ON plaid_items(item_id);
CREATE INDEX idx_plaid_items_status ON plaid_items(status);

-- Enable Row Level Security
ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plaid_items
CREATE POLICY "Users can view their own Plaid items"
  ON plaid_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Plaid items"
  ON plaid_items FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all Plaid items (for webhooks and sync operations)
-- No explicit policy needed as service role bypasses RLS

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_plaid_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER on_plaid_items_update
  BEFORE UPDATE ON plaid_items
  FOR EACH ROW
  EXECUTE FUNCTION update_plaid_items_updated_at();

-- Update webhook_events table to support Plaid webhooks
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS event_data JSONB;

-- Add comment explaining the table purpose
COMMENT ON TABLE plaid_items IS 'Stores Plaid item metadata and encrypted access tokens for financial account connectivity';
COMMENT ON COLUMN plaid_items.access_token IS 'AES-256-GCM encrypted Plaid access token';
COMMENT ON COLUMN plaid_items.transactions_cursor IS 'Cursor for incremental transaction sync using Plaid /transactions/sync endpoint';
