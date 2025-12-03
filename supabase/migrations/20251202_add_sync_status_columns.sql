-- Migration: Add Background Sync Status Tracking to plaid_items
-- Created: 2025-12-02
-- Purpose: Track progress of historical transaction syncs to prevent timeout issues
--
-- Background: Initial transaction syncs (2 years of data) were timing out
-- after 30 seconds. This migration adds columns to track background sync progress
-- so the frontend can show progress bars while syncs run independently.

-- Add sync status tracking columns
ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_status TEXT;
ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_progress INTEGER DEFAULT 0;
ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_transaction_count INTEGER DEFAULT 0;
ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_message TEXT;
ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_error TEXT;
ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_started_at TIMESTAMPTZ;
ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS sync_completed_at TIMESTAMPTZ;

-- Add index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_plaid_items_sync_status
ON plaid_items(item_id, sync_status)
WHERE sync_status IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN plaid_items.sync_status IS 'Background sync status: pending, syncing, completed, failed, timeout';
COMMENT ON COLUMN plaid_items.sync_progress IS 'Sync progress percentage (0-100)';
COMMENT ON COLUMN plaid_items.sync_transaction_count IS 'Number of transactions synced so far';
COMMENT ON COLUMN plaid_items.sync_message IS 'User-friendly status message';
COMMENT ON COLUMN plaid_items.sync_error IS 'Error message if sync failed';
COMMENT ON COLUMN plaid_items.sync_started_at IS 'Timestamp when sync started';
COMMENT ON COLUMN plaid_items.sync_completed_at IS 'Timestamp when sync completed or failed';
