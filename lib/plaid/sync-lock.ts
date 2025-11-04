/**
 * Sync Lock Manager
 * Prevents multiple simultaneous sync operations for the same user
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Create Supabase admin client (bypasses RLS)
 */
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Lock types for different sync operations
 */
export type SyncLockType = 'balance_sync' | 'transaction_sync' | 'full_sync';

/**
 * Lock acquisition result
 */
export interface LockResult {
  acquired: boolean;
  lockId?: string;
  message?: string;
}

/**
 * Lock duration in milliseconds (5 minutes)
 * Locks automatically expire after this time to handle crashes/failures
 */
const LOCK_DURATION_MS = 5 * 60 * 1000;

/**
 * Clean up expired sync locks
 * Called before acquiring new locks to ensure stale locks don't block syncs
 *
 * @returns Number of expired locks removed
 */
export async function cleanupExpiredLocks(): Promise<number> {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data, error } = await supabaseAdmin.rpc('cleanup_expired_sync_locks');

    if (error) {
      console.error('Error cleaning up expired locks:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error('Exception cleaning up expired locks:', error);
    return 0;
  }
}

/**
 * Acquire a sync lock for a user
 *
 * This function:
 * - Cleans up expired locks first
 * - Attempts to insert a new lock record
 * - Returns success if lock is acquired
 * - Returns failure if lock already exists (sync in progress)
 *
 * @param userId - User ID to acquire lock for
 * @param lockType - Type of sync operation
 * @returns Lock acquisition result
 *
 * @example
 * ```typescript
 * const lock = await acquireSyncLock('user-123', 'balance_sync');
 * if (!lock.acquired) {
 *   return { error: 'Sync already in progress' };
 * }
 * try {
 *   // Perform sync operation
 * } finally {
 *   await releaseSyncLock(lock.lockId!);
 * }
 * ```
 */
export async function acquireSyncLock(
  userId: string,
  lockType: SyncLockType
): Promise<LockResult> {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    // Clean up expired locks first
    await cleanupExpiredLocks();

    // Calculate expiration time (5 minutes from now)
    const expiresAt = new Date(Date.now() + LOCK_DURATION_MS);

    // Try to insert lock (will fail if lock already exists due to unique constraint)
    const { data, error } = await supabaseAdmin
      .from('sync_locks')
      .insert({
        user_id: userId,
        lock_type: lockType,
        acquired_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      // Check if error is due to unique constraint violation (lock already exists)
      if (error.code === '23505') {
        // Unique violation - sync already in progress
        return {
          acquired: false,
          message: `A ${lockType} operation is already in progress for this user`,
        };
      }

      // Other database error
      console.error('Error acquiring sync lock:', error);
      return {
        acquired: false,
        message: 'Failed to acquire sync lock',
      };
    }

    // Lock acquired successfully
    return {
      acquired: true,
      lockId: data.id,
      message: 'Lock acquired successfully',
    };
  } catch (error) {
    console.error('Exception acquiring sync lock:', error);
    return {
      acquired: false,
      message: 'Failed to acquire sync lock due to exception',
    };
  }
}

/**
 * Release a sync lock
 *
 * Should be called after sync operation completes (success or failure)
 * Use in a finally block to ensure lock is always released
 *
 * @param lockId - Lock ID returned from acquireSyncLock
 * @returns True if lock was released, false otherwise
 *
 * @example
 * ```typescript
 * const lock = await acquireSyncLock('user-123', 'balance_sync');
 * if (lock.acquired) {
 *   try {
 *     // Perform sync
 *   } finally {
 *     await releaseSyncLock(lock.lockId!);
 *   }
 * }
 * ```
 */
export async function releaseSyncLock(lockId: string): Promise<boolean> {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { error } = await supabaseAdmin
      .from('sync_locks')
      .delete()
      .eq('id', lockId);

    if (error) {
      console.error('Error releasing sync lock:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception releasing sync lock:', error);
    return false;
  }
}

/**
 * Check if a sync lock exists for a user
 *
 * Useful for checking lock status without acquiring a lock
 *
 * @param userId - User ID to check
 * @param lockType - Type of sync operation
 * @returns True if lock exists and hasn't expired, false otherwise
 */
export async function isSyncLocked(
  userId: string,
  lockType: SyncLockType
): Promise<boolean> {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    // Clean up expired locks first
    await cleanupExpiredLocks();

    // Check if active lock exists
    const { data, error } = await supabaseAdmin
      .from('sync_locks')
      .select('id')
      .eq('user_id', userId)
      .eq('lock_type', lockType)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) {
      // No lock found or error occurred
      return false;
    }

    return data !== null;
  } catch (error) {
    console.error('Exception checking sync lock:', error);
    return false;
  }
}

/**
 * Force release all locks for a user
 *
 * Use with caution - only for administrative/cleanup purposes
 * Not recommended for normal operation
 *
 * @param userId - User ID to release locks for
 * @returns Number of locks released
 */
export async function forceReleaseUserLocks(userId: string): Promise<number> {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { error } = await supabaseAdmin
      .from('sync_locks')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error force releasing user locks:', error);
      return 0;
    }

    // Can't get count from delete, so just return 1 if successful
    return 1;
  } catch (error) {
    console.error('Exception force releasing user locks:', error);
    return 0;
  }
}
