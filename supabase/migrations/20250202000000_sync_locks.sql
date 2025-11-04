-- Sync Locks Table for Preventing Concurrent Syncs
-- Migration: Add sync_locks table to prevent multiple simultaneous syncs

-- Create sync_locks table for tracking active sync operations
CREATE TABLE sync_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lock_type TEXT NOT NULL, -- 'balance_sync', 'transaction_sync', 'full_sync'
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- Lock expires after 5 minutes
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index to prevent multiple locks of same type for same user
-- This ensures only one sync of each type can run at a time for a user
CREATE UNIQUE INDEX idx_sync_locks_user_type ON sync_locks(user_id, lock_type);

-- Create index for cleanup queries (finding expired locks)
CREATE INDEX idx_sync_locks_expires_at ON sync_locks(expires_at);

-- Enable Row Level Security
ALTER TABLE sync_locks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sync_locks
-- Users can view their own sync locks
CREATE POLICY "Users can view their own sync locks"
  ON sync_locks FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all sync locks (for server-side operations)
-- No explicit policy needed as service role bypasses RLS

-- Add comments explaining the table
COMMENT ON TABLE sync_locks IS 'Tracks active sync operations to prevent concurrent syncs for the same user';
COMMENT ON COLUMN sync_locks.lock_type IS 'Type of sync operation: balance_sync, transaction_sync, or full_sync';
COMMENT ON COLUMN sync_locks.expires_at IS 'Lock automatically expires after 5 minutes to handle crashes/failures';

-- Function to clean up expired locks automatically
CREATE OR REPLACE FUNCTION cleanup_expired_sync_locks()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sync_locks
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_sync_locks IS 'Removes expired sync locks. Can be called periodically or before acquiring new locks.';
