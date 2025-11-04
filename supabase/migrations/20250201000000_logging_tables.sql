-- Logging Tables for Error Tracking and Webhook Events
-- Migration: Add error_logs and webhook_events tables for monitoring

-- Create webhook_events table for tracking all incoming webhooks
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- e.g., 'plaid_webhook', 'stripe_webhook'
  event_data JSONB NOT NULL, -- Full webhook payload
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT, -- Error message if processing failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for webhook_events
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);

-- Create error_logs table for tracking all errors
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable in case user is deleted
  item_id TEXT, -- Plaid item_id if applicable
  error_code TEXT, -- Error code from API (e.g., Plaid error code)
  error_message TEXT NOT NULL, -- Error message
  error_type TEXT, -- Error category (e.g., 'plaid_api', 'sync', 'webhook')
  endpoint TEXT, -- API endpoint that failed (e.g., '/transactions/sync')
  request_data JSONB, -- Request payload if applicable
  stack_trace TEXT, -- Stack trace for debugging
  severity TEXT DEFAULT 'error', -- 'error', 'warning', 'critical'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for error_logs
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX idx_error_logs_item_id ON error_logs(item_id);
CREATE INDEX idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_severity ON error_logs(severity);
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at);

-- Enable Row Level Security for error_logs
-- Note: webhook_events doesn't need RLS as it's service-only
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for error_logs
-- Users can view their own error logs
CREATE POLICY "Users can view their own error logs"
  ON error_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all error logs (for system operations)
-- No explicit policy needed as service role bypasses RLS

-- Add comments explaining the tables
COMMENT ON TABLE webhook_events IS 'Tracks all incoming webhook events for monitoring and debugging';
COMMENT ON TABLE error_logs IS 'Stores detailed error logs for debugging and monitoring system health';
COMMENT ON COLUMN error_logs.user_id IS 'User associated with the error, nullable if user is deleted';
COMMENT ON COLUMN error_logs.item_id IS 'Plaid item_id if the error is related to a specific Plaid item';
COMMENT ON COLUMN error_logs.error_type IS 'Category of error for filtering and monitoring (e.g., plaid_api, sync, webhook)';
COMMENT ON COLUMN error_logs.severity IS 'Error severity level: error, warning, or critical';
