-- Stripe Subscription Integration Schema
-- Migration: Add subscription management tables and fields

-- Create custom types for subscription management
CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'premium');

CREATE TYPE subscription_status AS ENUM (
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'trialing'
);

-- Extend profiles table with subscription fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- Create subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  status subscription_status NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create webhook_events table for idempotency
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);

-- Enable Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Webhook events are system-only (no user access)
CREATE POLICY "No public access to webhook events"
  ON webhook_events FOR ALL
  USING (false);

-- Function to update profile subscription tier
CREATE OR REPLACE FUNCTION update_profile_subscription_tier()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET
    subscription_tier = CASE
      WHEN NEW.status = 'active' AND NEW.stripe_price_id LIKE '%basic%' THEN 'basic'::subscription_tier
      WHEN NEW.status = 'active' AND NEW.stripe_price_id LIKE '%premium%' THEN 'premium'::subscription_tier
      ELSE 'free'::subscription_tier
    END,
    updated_at = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync subscription tier to profile
CREATE TRIGGER on_subscription_change
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_subscription_tier();
