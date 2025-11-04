/**
 * Integration tests for Token Storage and Retrieval
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';

// Generate a valid encryption key for tests
const TEST_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

// Mock Supabase
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockSingle = vi.fn();

const mockSupabaseClient = {
  from: vi.fn(() => ({
    upsert: mockUpsert,
    select: mockSelect,
    update: mockUpdate,
  })),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Mock config
vi.mock('@/lib/plaid/config', () => ({
  plaidConfig: {
    secret: 'test-secret',
    environment: 'sandbox' as const,
    encryptionKey: TEST_ENCRYPTION_KEY,
  },
}));

describe('Token Storage and Retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Create a factory function that generates fresh chainable objects
    const createChainableQuery = () => {
      const chain: any = {
        eq: vi.fn(() => chain),
        single: mockSingle,
      };
      return chain;
    };

    // Mock implementations
    mockSelect.mockImplementation(createChainableQuery);
    mockUpdate.mockImplementation(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
  });

  describe('storeAccessToken', () => {
    it('should store an encrypted access token successfully', async () => {
      mockUpsert.mockResolvedValue({ error: null });

      const { storeAccessToken } = await import('@/lib/plaid/token-manager');

      await storeAccessToken(
        'user-123',
        'item-456',
        'access-sandbox-token',
        'ins_3',
        'Chase Bank'
      );

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('plaid_items');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          item_id: 'item-456',
          institution_id: 'ins_3',
          institution_name: 'Chase Bank',
          status: 'active',
        }),
        { onConflict: 'item_id' }
      );

      // Verify the access_token was encrypted (should not match plaintext)
      const callArgs = mockUpsert.mock.calls[0][0];
      expect(callArgs.access_token).not.toBe('access-sandbox-token');
      expect(callArgs.access_token).toContain(':'); // Encrypted format has colons
    });

    it('should encrypt the token before storing', async () => {
      mockUpsert.mockResolvedValue({ error: null });

      const { storeAccessToken } = await import('@/lib/plaid/token-manager');

      await storeAccessToken(
        'user-789',
        'item-abc',
        'plaintext-token',
        'ins_4',
        'Bank of America'
      );

      const callArgs = mockUpsert.mock.calls[0][0];

      // Verify it's in encrypted format (iv:authTag:encrypted)
      const parts = callArgs.access_token.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(32); // IV is 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32); // Auth tag is 16 bytes = 32 hex chars
    });

    it('should throw error when upsert fails', async () => {
      mockUpsert.mockResolvedValue({
        error: { message: 'Database connection failed' },
      });

      const { storeAccessToken } = await import('@/lib/plaid/token-manager');

      await expect(
        storeAccessToken('user-123', 'item-456', 'token', 'ins_3', 'Chase')
      ).rejects.toThrow('Failed to store access token: Database connection failed');
    });

    it('should update existing token when item_id already exists', async () => {
      mockUpsert.mockResolvedValue({ error: null });

      const { storeAccessToken } = await import('@/lib/plaid/token-manager');

      // First call
      await storeAccessToken('user-123', 'item-same', 'token1', 'ins_3', 'Chase');

      // Second call with same item_id
      await storeAccessToken('user-123', 'item-same', 'token2', 'ins_3', 'Chase');

      expect(mockUpsert).toHaveBeenCalledTimes(2);

      // Both should use onConflict to handle updates
      expect(mockUpsert.mock.calls[0][1]).toEqual({ onConflict: 'item_id' });
      expect(mockUpsert.mock.calls[1][1]).toEqual({ onConflict: 'item_id' });
    });
  });

  describe('getAccessToken', () => {
    it('should retrieve and decrypt an access token', async () => {
      // First, encrypt a token to use as test data
      const { encryptToken } = await import('@/lib/plaid/token-manager');
      const encryptedToken = encryptToken('access-sandbox-token');

      mockSingle.mockResolvedValue({
        data: { access_token: encryptedToken },
        error: null,
      });

      const { getAccessToken } = await import('@/lib/plaid/token-manager');

      const result = await getAccessToken('item-456');

      expect(result).toBe('access-sandbox-token');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('plaid_items');
      expect(mockSelect).toHaveBeenCalledWith('access_token');
    });

    it('should return null when item not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const { getAccessToken } = await import('@/lib/plaid/token-manager');

      const result = await getAccessToken('item-nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when item is not active', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const { getAccessToken } = await import('@/lib/plaid/token-manager');

      const result = await getAccessToken('item-revoked');

      expect(result).toBeNull();
    });

    it('should correctly decrypt round-trip token', async () => {
      const { storeAccessToken, getAccessToken, encryptToken } = await import('@/lib/plaid/token-manager');

      const originalToken = 'access-sandbox-original-token-12345';
      const encryptedToken = encryptToken(originalToken);

      mockUpsert.mockResolvedValue({ error: null });
      mockSingle.mockResolvedValue({
        data: { access_token: encryptedToken },
        error: null,
      });

      const retrieved = await getAccessToken('item-test');

      expect(retrieved).toBe(originalToken);
    });
  });

  describe('getUserAccessTokens', () => {
    it('should retrieve all active tokens for a user', async () => {
      const { encryptToken } = await import('@/lib/plaid/token-manager');

      const token1 = encryptToken('access-token-1');
      const token2 = encryptToken('access-token-2');

      // Create a chain that ends with the final resolved value
      const chainWithData = {
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              item_id: 'item-1',
              access_token: token1,
              institution_id: 'ins_3',
              institution_name: 'Chase',
            },
            {
              item_id: 'item-2',
              access_token: token2,
              institution_id: 'ins_4',
              institution_name: 'Bank of America',
            },
          ],
          error: null,
        }),
      };

      mockSelect.mockReturnValue({ eq: vi.fn(() => chainWithData) });

      const { getUserAccessTokens } = await import('@/lib/plaid/token-manager');

      const result = await getUserAccessTokens('user-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        itemId: 'item-1',
        accessToken: 'access-token-1',
        institutionId: 'ins_3',
        institutionName: 'Chase',
      });
      expect(result[1]).toEqual({
        itemId: 'item-2',
        accessToken: 'access-token-2',
        institutionId: 'ins_4',
        institutionName: 'Bank of America',
      });
    });

    it('should return empty array when user has no active tokens', async () => {
      const chainWithEmpty = {
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockSelect.mockReturnValue({ eq: vi.fn(() => chainWithEmpty) });

      const { getUserAccessTokens } = await import('@/lib/plaid/token-manager');

      const result = await getUserAccessTokens('user-no-tokens');

      expect(result).toEqual([]);
    });

    it('should return empty array when query fails', async () => {
      const chainWithError = {
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Query failed' },
        }),
      };

      mockSelect.mockReturnValue({ eq: vi.fn(() => chainWithError) });

      const { getUserAccessTokens } = await import('@/lib/plaid/token-manager');

      const result = await getUserAccessTokens('user-error');

      expect(result).toEqual([]);
    });

    it('should only include active items', async () => {
      const { encryptToken } = await import('@/lib/plaid/token-manager');

      const token1 = encryptToken('active-token');

      const chainWithActiveItems = {
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              item_id: 'item-active',
              access_token: token1,
              institution_id: 'ins_3',
              institution_name: 'Chase',
            },
          ],
          error: null,
        }),
      };

      mockSelect.mockReturnValue({ eq: vi.fn(() => chainWithActiveItems) });

      const { getUserAccessTokens } = await import('@/lib/plaid/token-manager');

      const result = await getUserAccessTokens('user-123');

      // Verify we got the active items
      expect(result).toHaveLength(1);
      expect(result[0].itemId).toBe('item-active');
    });
  });

  describe('revokeAccessToken', () => {
    it('should revoke an access token successfully', async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const { revokeAccessToken } = await import('@/lib/plaid/token-manager');

      await revokeAccessToken('item-456');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('plaid_items');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'revoked',
        })
      );
    });

    it('should update the updated_at timestamp', async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const { revokeAccessToken } = await import('@/lib/plaid/token-manager');

      await revokeAccessToken('item-789');

      const callArgs = mockUpdate.mock.calls[0][0];
      expect(callArgs.updated_at).toBeDefined();
      expect(new Date(callArgs.updated_at).getTime()).toBeGreaterThan(Date.now() - 5000);
    });

    it('should throw error when update fails', async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: { message: 'Item not found' },
        }),
      });

      const { revokeAccessToken } = await import('@/lib/plaid/token-manager');

      await expect(
        revokeAccessToken('item-nonexistent')
      ).rejects.toThrow('Failed to revoke access token: Item not found');
    });
  });

  describe('Integration flow', () => {
    it('should handle complete store-retrieve-revoke cycle', async () => {
      const { storeAccessToken, getAccessToken, revokeAccessToken, encryptToken } = await import('@/lib/plaid/token-manager');

      const originalToken = 'access-complete-cycle-token';
      const encryptedToken = encryptToken(originalToken);

      // Store
      mockUpsert.mockResolvedValue({ error: null });
      await storeAccessToken('user-cycle', 'item-cycle', originalToken, 'ins_3', 'Test Bank');
      expect(mockUpsert).toHaveBeenCalled();

      // Retrieve
      mockSingle.mockResolvedValue({
        data: { access_token: encryptedToken },
        error: null,
      });
      const retrieved = await getAccessToken('item-cycle');
      expect(retrieved).toBe(originalToken);

      // Revoke
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      await revokeAccessToken('item-cycle');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'revoked' })
      );

      // After revoke, getAccessToken should return null
      mockSingle.mockResolvedValue({ data: null, error: null });
      const afterRevoke = await getAccessToken('item-cycle');
      expect(afterRevoke).toBeNull();
    });
  });
});
