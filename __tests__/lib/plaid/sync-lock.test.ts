/**
 * Tests for Sync Lock Manager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock functions
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockRpc = vi.fn();

// Mock Supabase client module
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => ({
        insert: mockInsert,
        delete: mockDelete,
        select: mockSelect,
      })),
      rpc: mockRpc,
    })),
  };
});

// Import after mocking
import {
  acquireSyncLock,
  releaseSyncLock,
  isSyncLocked,
  cleanupExpiredLocks,
  forceReleaseUserLocks,
  type SyncLockType,
} from '@/lib/plaid/sync-lock';

describe('Sync Lock Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanupExpiredLocks', () => {
    it('should call cleanup RPC function', async () => {
      mockRpc.mockResolvedValue({ data: 3, error: null });

      const result = await cleanupExpiredLocks();

      expect(mockRpc).toHaveBeenCalledWith('cleanup_expired_sync_locks');
      expect(result).toBe(3);
    });

    it('should return 0 on RPC error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

      const result = await cleanupExpiredLocks();

      expect(result).toBe(0);
    });

    it('should handle RPC exception gracefully', async () => {
      mockRpc.mockRejectedValue(new Error('Database error'));

      const result = await cleanupExpiredLocks();

      expect(result).toBe(0);
    });
  });

  describe('acquireSyncLock', () => {
    beforeEach(() => {
      // Mock cleanup RPC to succeed
      mockRpc.mockResolvedValue({ data: 0, error: null });
    });

    it('should successfully acquire lock when no lock exists', async () => {
      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'lock-123' },
            error: null,
          }),
        }),
      });

      const result = await acquireSyncLock('user-456', 'balance_sync');

      expect(result.acquired).toBe(true);
      expect(result.lockId).toBe('lock-123');
      expect(result.message).toBe('Lock acquired successfully');
    });

    it('should fail to acquire lock when lock already exists (unique violation)', async () => {
      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'duplicate key violation' },
          }),
        }),
      });

      const result = await acquireSyncLock('user-456', 'balance_sync');

      expect(result.acquired).toBe(false);
      expect(result.lockId).toBeUndefined();
      expect(result.message).toContain('already in progress');
    });

    it('should handle database errors gracefully', async () => {
      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '42000', message: 'Database error' },
          }),
        }),
      });

      const result = await acquireSyncLock('user-456', 'transaction_sync');

      expect(result.acquired).toBe(false);
      expect(result.message).toBe('Failed to acquire sync lock');
    });

    it('should handle exceptions gracefully', async () => {
      mockInsert.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await acquireSyncLock('user-456', 'balance_sync');

      expect(result.acquired).toBe(false);
      expect(result.message).toContain('exception');
    });

    it('should insert lock with correct fields', async () => {
      const userId = 'user-123';
      const lockType: SyncLockType = 'transaction_sync';

      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'lock-456' },
            error: null,
          }),
        }),
      });

      await acquireSyncLock(userId, lockType);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          lock_type: lockType,
        })
      );

      // Check that acquired_at and expires_at are present
      const callArgs = mockInsert.mock.calls[0][0];
      expect(callArgs.acquired_at).toBeDefined();
      expect(callArgs.expires_at).toBeDefined();

      // Verify expires_at is approximately 5 minutes from now
      const expiresAt = new Date(callArgs.expires_at);
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      const fiveMinutesMs = 5 * 60 * 1000;

      // Allow 1 second tolerance
      expect(diffMs).toBeGreaterThan(fiveMinutesMs - 1000);
      expect(diffMs).toBeLessThan(fiveMinutesMs + 1000);
    });

    it('should clean up expired locks before acquiring', async () => {
      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'lock-789' },
            error: null,
          }),
        }),
      });

      await acquireSyncLock('user-456', 'full_sync');

      expect(mockRpc).toHaveBeenCalledWith('cleanup_expired_sync_locks');
    });
  });

  describe('releaseSyncLock', () => {
    it('should successfully release lock', async () => {
      mockDelete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await releaseSyncLock('lock-123');

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should return false on database error', async () => {
      mockDelete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
      });

      const result = await releaseSyncLock('lock-123');

      expect(result).toBe(false);
    });

    it('should handle exceptions gracefully', async () => {
      mockDelete.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await releaseSyncLock('lock-123');

      expect(result).toBe(false);
    });

    it('should delete lock with correct ID', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      mockDelete.mockReturnValue({
        eq: mockEq,
      });

      await releaseSyncLock('lock-456');

      expect(mockEq).toHaveBeenCalledWith('id', 'lock-456');
    });
  });

  describe('isSyncLocked', () => {
    beforeEach(() => {
      // Mock cleanup RPC to succeed
      mockRpc.mockResolvedValue({ data: 0, error: null });
    });

    it('should return true when active lock exists', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'lock-123' },
          error: null,
        }),
      });

      const result = await isSyncLocked('user-456', 'balance_sync');

      expect(result).toBe(true);
    });

    it('should return false when no lock exists', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        }),
      });

      const result = await isSyncLocked('user-456', 'balance_sync');

      expect(result).toBe(false);
    });

    it('should check for correct user and lock type', async () => {
      const mockEq = vi.fn().mockReturnThis();
      const mockGt = vi.fn().mockReturnThis();

      mockSelect.mockReturnValue({
        eq: mockEq,
        gt: mockGt,
        single: vi.fn().mockResolvedValue({
          data: { id: 'lock-123' },
          error: null,
        }),
      });

      await isSyncLocked('user-789', 'transaction_sync');

      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-789');
      expect(mockEq).toHaveBeenCalledWith('lock_type', 'transaction_sync');
      expect(mockGt).toHaveBeenCalledWith('expires_at', expect.any(String));
    });

    it('should clean up expired locks before checking', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      await isSyncLocked('user-456', 'balance_sync');

      expect(mockRpc).toHaveBeenCalledWith('cleanup_expired_sync_locks');
    });

    it('should handle exceptions gracefully', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await isSyncLocked('user-456', 'balance_sync');

      expect(result).toBe(false);
    });
  });

  describe('forceReleaseUserLocks', () => {
    it('should successfully release all user locks', async () => {
      mockDelete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await forceReleaseUserLocks('user-456');

      expect(result).toBe(1);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should delete locks for correct user', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      mockDelete.mockReturnValue({
        eq: mockEq,
      });

      await forceReleaseUserLocks('user-789');

      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-789');
    });

    it('should return 0 on database error', async () => {
      mockDelete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
      });

      const result = await forceReleaseUserLocks('user-456');

      expect(result).toBe(0);
    });

    it('should handle exceptions gracefully', async () => {
      mockDelete.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await forceReleaseUserLocks('user-456');

      expect(result).toBe(0);
    });
  });
});
