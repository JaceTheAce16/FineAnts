/**
 * Tests for Disconnect API Route
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the Supabase clients
const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table) => {
      if (table === 'plaid_items') {
        return {
          select: mockSelect,
        };
      } else if (table === 'financial_accounts') {
        return {
          delete: mockDelete,
        };
      }
      return {};
    }),
  })),
}));

// Mock the Plaid client and token manager
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

describe('Disconnect API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock chain for plaid_items select
    mockSingle.mockResolvedValue({
      data: { user_id: 'user-123' },
      error: null,
    });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });

    // Setup default mock chain for financial_accounts delete
    const deleteEq1 = vi.fn();
    const deleteEq2 = vi.fn();
    deleteEq2.mockResolvedValue({ error: null });
    deleteEq1.mockReturnValue({ eq: deleteEq2 });
    mockDelete.mockReturnValue({ eq: deleteEq1 });
  });

  it('should export POST handler', async () => {
    const { POST } = await import('@/app/api/plaid/disconnect/route');
    expect(typeof POST).toBe('function');
  });

  it('should return 401 when user is not authenticated', async () => {
    // Mock authentication failure
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Unauthorized'),
    });

    const { POST } = await import('@/app/api/plaid/disconnect/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/disconnect', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'item-123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('Unauthorized');
  });

  it('should return 400 when itemId is missing', async () => {
    // Mock successful authentication
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    const { POST } = await import('@/app/api/plaid/disconnect/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/disconnect', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required field');
  });

  it('should return 404 when item does not exist', async () => {
    // Mock successful authentication
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    // Mock item not found
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Item not found' },
    });

    const { POST } = await import('@/app/api/plaid/disconnect/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/disconnect', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'item-nonexistent' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found');
  });

  it('should return 403 when user does not own the item', async () => {
    // Mock successful authentication
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    // Mock item belonging to different user
    mockSingle.mockResolvedValue({
      data: { user_id: 'user-456' },
      error: null,
    });

    const { POST } = await import('@/app/api/plaid/disconnect/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/disconnect', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'item-123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Unauthorized');
    expect(data.error).toContain('do not have permission');
  });

  it('should successfully disconnect account', async () => {
    // Mock successful authentication
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    // Mock item exists and belongs to user
    mockSingle.mockResolvedValue({
      data: { user_id: 'user-123' },
      error: null,
    });

    // Mock successful operations
    mockGetAccessToken.mockResolvedValue('access-sandbox-token');
    mockRemoveItem.mockResolvedValue(undefined);
    mockRevokeAccessToken.mockResolvedValue(undefined);

    const { POST } = await import('@/app/api/plaid/disconnect/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/disconnect', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'item-123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('disconnected successfully');

    // Verify all operations were called
    expect(mockGetAccessToken).toHaveBeenCalledWith('item-123');
    expect(mockRemoveItem).toHaveBeenCalledWith('access-sandbox-token');
    expect(mockRevokeAccessToken).toHaveBeenCalledWith('item-123');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('should handle missing access token gracefully', async () => {
    // Mock successful authentication
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    // Mock item exists
    mockSingle.mockResolvedValue({
      data: { user_id: 'user-123' },
      error: null,
    });

    // Mock no access token (already revoked or deleted)
    mockGetAccessToken.mockResolvedValue(null);
    mockRevokeAccessToken.mockResolvedValue(undefined);

    const { POST } = await import('@/app/api/plaid/disconnect/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/disconnect', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'item-123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify removeItem was NOT called (no access token)
    expect(mockRemoveItem).not.toHaveBeenCalled();

    // But revoke and delete should still be called
    expect(mockRevokeAccessToken).toHaveBeenCalledWith('item-123');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('should continue cleanup even if Plaid API fails', async () => {
    // Mock successful authentication
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    // Mock item exists
    mockSingle.mockResolvedValue({
      data: { user_id: 'user-123' },
      error: null,
    });

    // Mock Plaid API error
    mockGetAccessToken.mockResolvedValue('access-sandbox-token');
    mockRemoveItem.mockRejectedValue(new Error('Plaid API error'));
    mockRevokeAccessToken.mockResolvedValue(undefined);

    const { POST } = await import('@/app/api/plaid/disconnect/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/disconnect', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'item-123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Should still succeed despite Plaid error
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify cleanup operations were still called
    expect(mockRevokeAccessToken).toHaveBeenCalledWith('item-123');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('should return 500 when database deletion fails', async () => {
    // Mock successful authentication
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    // Mock item exists
    mockSingle.mockResolvedValue({
      data: { user_id: 'user-123' },
      error: null,
    });

    // Mock successful Plaid operations
    mockGetAccessToken.mockResolvedValue('access-sandbox-token');
    mockRemoveItem.mockResolvedValue(undefined);
    mockRevokeAccessToken.mockResolvedValue(undefined);

    // Mock database deletion error
    const deleteEq1 = vi.fn();
    const deleteEq2 = vi.fn();
    deleteEq2.mockResolvedValue({ error: { message: 'Database error' } });
    deleteEq1.mockReturnValue({ eq: deleteEq2 });
    mockDelete.mockReturnValue({ eq: deleteEq1 });

    const { POST } = await import('@/app/api/plaid/disconnect/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/disconnect', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'item-123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Failed to disconnect account');
  });

  it('should verify item ownership before disconnecting', async () => {
    // Mock successful authentication
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    // Mock item belonging to different user
    mockSingle.mockResolvedValue({
      data: { user_id: 'user-456' },
      error: null,
    });

    const { POST } = await import('@/app/api/plaid/disconnect/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/disconnect', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'item-123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);

    // Verify that no cleanup operations were attempted
    expect(mockGetAccessToken).not.toHaveBeenCalled();
    expect(mockRemoveItem).not.toHaveBeenCalled();
    expect(mockRevokeAccessToken).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
