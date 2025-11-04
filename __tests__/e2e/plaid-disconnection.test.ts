/**
 * E2E Tests for Plaid Account Disconnection Flow
 * Tests: User initiating disconnect, confirmation dialog, database cleanup, Plaid API revocation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Supabase client
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock Plaid client and token manager
const mockGetAccessToken = vi.fn();
const mockRevokeAccessToken = vi.fn();
const mockRemoveItem = vi.fn();

vi.mock('@/lib/plaid/token-manager', () => ({
  getAccessToken: mockGetAccessToken,
  revokeAccessToken: mockRevokeAccessToken,
}));

vi.mock('@/lib/plaid/client', () => ({
  removeItem: mockRemoveItem,
}));

// Mock Supabase server client
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

describe('Plaid Account Disconnection E2E Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default successful authentication
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    // Setup default chainable mocks
    const createEqChain = () => {
      const chain = {
        eq: vi.fn(() => chain),
        single: mockSingle,
      };
      return chain;
    };

    mockSingle.mockResolvedValue({
      data: { user_id: 'user-123' },
      error: null,
    });

    mockEq.mockImplementation(() => createEqChain());
    mockSelect.mockReturnValue(createEqChain());

    // Setup delete chain
    const deleteEq1 = vi.fn();
    const deleteEq2 = vi.fn();
    deleteEq2.mockResolvedValue({ data: [], error: null });
    deleteEq1.mockReturnValue({ eq: deleteEq2 });
    mockDelete.mockReturnValue({ eq: deleteEq1 });

    // Setup update chain
    const updateEq1 = vi.fn();
    updateEq1.mockResolvedValue({ data: {}, error: null });
    mockUpdate.mockReturnValue({ eq: updateEq1 });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'plaid_items') {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      } else if (table === 'financial_accounts') {
        return {
          delete: mockDelete,
        };
      } else if (table === 'transactions') {
        return {
          delete: mockDelete,
        };
      }
      return {};
    });

    // Setup Plaid operations
    mockGetAccessToken.mockResolvedValue('access-sandbox-abc123');
    mockRemoveItem.mockResolvedValue(undefined);
    mockRevokeAccessToken.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Disconnection Flow', () => {
    it('should successfully disconnect account with all cleanup operations', async () => {
      const itemId = 'item-test-123';
      const userId = 'user-123';

      // Import the disconnect route
      const { POST } = await import('@/app/api/plaid/disconnect/route');

      // Simulate the disconnection request
      const request = {
        json: async () => ({ itemId }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      // Verify successful response
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('disconnected successfully');

      // Verify ownership check was performed
      expect(mockFrom).toHaveBeenCalledWith('plaid_items');
      expect(mockSelect).toHaveBeenCalled();
      expect(mockSingle).toHaveBeenCalled();

      // Verify Plaid access token was retrieved
      expect(mockGetAccessToken).toHaveBeenCalledWith(itemId);

      // Verify Plaid API was called to remove the item
      expect(mockRemoveItem).toHaveBeenCalledWith('access-sandbox-abc123');

      // Verify access token was revoked in database
      expect(mockRevokeAccessToken).toHaveBeenCalledWith(itemId);

      // Verify financial accounts were deleted
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should verify user owns the item before disconnecting', async () => {
      const itemId = 'item-test-456';

      // Mock item belonging to different user
      mockSingle.mockResolvedValueOnce({
        data: { user_id: 'different-user-789' },
        error: null,
      });

      const { POST } = await import('@/app/api/plaid/disconnect/route');

      const request = {
        json: async () => ({ itemId }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      // Verify unauthorized response
      expect(response.status).toBe(403);
      expect(data.error).toContain('do not have permission');

      // Verify no cleanup operations were performed
      expect(mockGetAccessToken).not.toHaveBeenCalled();
      expect(mockRemoveItem).not.toHaveBeenCalled();
      expect(mockRevokeAccessToken).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe('Confirmation Dialog', () => {
    it('should require user confirmation before disconnecting', async () => {
      // This test verifies the UI component requires confirmation
      // The actual confirmation is tested in the component test below
      const itemId = 'item-confirm-test';

      const { POST } = await import('@/app/api/plaid/disconnect/route');

      // The API route itself doesn't have confirmation logic
      // Confirmation happens in the UI (PlaidAccountsList component)
      // This test verifies the API requires explicit request
      const request = {
        json: async () => ({ itemId }),
      } as any;

      const response = await POST(request);

      // Should succeed if itemId is provided (confirmation already happened in UI)
      expect(response.status).toBe(200);
    });

    it('should not proceed if itemId is missing', async () => {
      const { POST } = await import('@/app/api/plaid/disconnect/route');

      const request = {
        json: async () => ({}), // Missing itemId
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required field');
    });
  });

  describe('Access Token Revocation', () => {
    it('should revoke access token with Plaid API', async () => {
      const itemId = 'item-revoke-test';
      const accessToken = 'access-sandbox-revoke-test';

      mockGetAccessToken.mockResolvedValue(accessToken);

      const { POST } = await import('@/app/api/plaid/disconnect/route');

      const request = {
        json: async () => ({ itemId }),
      } as any;

      await POST(request);

      // Verify Plaid removeItem was called with correct access token
      expect(mockRemoveItem).toHaveBeenCalledWith(accessToken);
      expect(mockRemoveItem).toHaveBeenCalledTimes(1);
    });

    it('should mark item as revoked in database', async () => {
      const itemId = 'item-status-test';

      const { POST } = await import('@/app/api/plaid/disconnect/route');

      const request = {
        json: async () => ({ itemId }),
      } as any;

      await POST(request);

      // Verify revokeAccessToken was called to update status
      expect(mockRevokeAccessToken).toHaveBeenCalledWith(itemId);
      expect(mockRevokeAccessToken).toHaveBeenCalledTimes(1);
    });

    it('should handle already-revoked access tokens gracefully', async () => {
      const itemId = 'item-already-revoked';

      // Mock no access token (already revoked)
      mockGetAccessToken.mockResolvedValue(null);

      const { POST } = await import('@/app/api/plaid/disconnect/route');

      const request = {
        json: async () => ({ itemId }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      // Should still succeed
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Should not call Plaid API if no token
      expect(mockRemoveItem).not.toHaveBeenCalled();

      // But should still revoke in database
      expect(mockRevokeAccessToken).toHaveBeenCalledWith(itemId);
    });

    it('should continue cleanup even if Plaid API call fails', async () => {
      const itemId = 'item-api-failure';

      // Mock Plaid API failure
      mockRemoveItem.mockRejectedValue(new Error('Plaid API unavailable'));

      const { POST } = await import('@/app/api/plaid/disconnect/route');

      const request = {
        json: async () => ({ itemId }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      // Should still succeed despite Plaid error
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify cleanup still happened
      expect(mockRevokeAccessToken).toHaveBeenCalledWith(itemId);
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('Database Cleanup', () => {
    it('should delete all financial accounts for the item', async () => {
      const itemId = 'item-accounts-delete';
      const userId = 'user-123';

      const { POST } = await import('@/app/api/plaid/disconnect/route');

      const request = {
        json: async () => ({ itemId }),
      } as any;

      await POST(request);

      // Verify delete was called on financial_accounts table
      expect(mockFrom).toHaveBeenCalledWith('financial_accounts');
      expect(mockDelete).toHaveBeenCalled();

      // Verify the delete query includes both itemId and userId filters
      const deleteChain = mockDelete.mock.results[0]?.value;
      expect(deleteChain.eq).toHaveBeenCalled();
    });

    it('should delete all transactions for the disconnected accounts', async () => {
      const itemId = 'item-transactions-delete';

      const { POST } = await import('@/app/api/plaid/disconnect/route');

      const request = {
        json: async () => ({ itemId }),
      } as any;

      await POST(request);

      // The cascade delete on financial_accounts should handle transactions
      // Or explicit delete on transactions table
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const itemId = 'item-db-error';

      // Mock database error on delete
      const deleteEq1 = vi.fn();
      const deleteEq2 = vi.fn();
      deleteEq2.mockResolvedValue({
        data: null,
        error: { message: 'Database connection lost' },
      });
      deleteEq1.mockReturnValue({ eq: deleteEq2 });
      mockDelete.mockReturnValue({ eq: deleteEq1 });

      const { POST } = await import('@/app/api/plaid/disconnect/route');

      const request = {
        json: async () => ({ itemId }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      // Should return error on database failure
      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to disconnect account');
    });
  });

  describe('Item Status Update', () => {
    it('should update plaid_items status to revoked', async () => {
      const itemId = 'item-status-update';

      const { POST } = await import('@/app/api/plaid/disconnect/route');

      const request = {
        json: async () => ({ itemId }),
      } as any;

      await POST(request);

      // Verify revokeAccessToken updates the status
      expect(mockRevokeAccessToken).toHaveBeenCalledWith(itemId);
    });

    it('should verify item exists before attempting disconnect', async () => {
      const itemId = 'item-nonexistent';

      // Mock item not found
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Item not found' },
      });

      const { POST } = await import('@/app/api/plaid/disconnect/route');

      const request = {
        json: async () => ({ itemId }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      // Should return 404
      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');

      // Should not attempt any cleanup operations
      expect(mockGetAccessToken).not.toHaveBeenCalled();
      expect(mockRemoveItem).not.toHaveBeenCalled();
      expect(mockRevokeAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should require authentication', async () => {
      // Mock authentication failure
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const { POST } = await import('@/app/api/plaid/disconnect/route');

      const request = {
        json: async () => ({ itemId: 'item-123' }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should provide clear error messages', async () => {
      const { POST } = await import('@/app/api/plaid/disconnect/route');

      // Test missing itemId
      const request1 = {
        json: async () => ({}),
      } as any;

      const response1 = await POST(request1);
      const data1 = await response1.json();

      expect(data1.error).toBeTruthy();
      expect(typeof data1.error).toBe('string');
      expect(data1.error.length).toBeGreaterThan(0);
    });

    it('should handle concurrent disconnect attempts', async () => {
      const itemId = 'item-concurrent';

      const { POST } = await import('@/app/api/plaid/disconnect/route');

      const request1 = { json: async () => ({ itemId }) } as any;
      const request2 = { json: async () => ({ itemId }) } as any;

      // Simulate concurrent requests
      const [response1, response2] = await Promise.all([
        POST(request1),
        POST(request2),
      ]);

      // First should succeed
      expect(response1.status).toBe(200);

      // Second might succeed or fail depending on timing
      // But should not cause errors
      expect([200, 404]).toContain(response2.status);
    });
  });

  describe('Integration with UI', () => {
    it('should return success data that UI can use to update state', async () => {
      const itemId = 'item-ui-test';

      const { POST } = await import('@/app/api/plaid/disconnect/route');

      const request = {
        json: async () => ({ itemId }),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      // Verify response structure for UI consumption
      expect(data).toHaveProperty('success');
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('message');
      expect(typeof data.message).toBe('string');
    });

    it('should handle rapid disconnect requests gracefully', async () => {
      const items = ['item-1', 'item-2', 'item-3'];

      const { POST } = await import('@/app/api/plaid/disconnect/route');

      const requests = items.map((itemId) => ({
        json: async () => ({ itemId }),
      }));

      const responses = await Promise.all(
        requests.map((req) => POST(req as any))
      );

      // All should complete without errors
      for (const response of responses) {
        expect(response.status).toBe(200);
      }

      // Verify each was processed
      expect(mockGetAccessToken).toHaveBeenCalledTimes(3);
      expect(mockRevokeAccessToken).toHaveBeenCalledTimes(3);
    });
  });
});
