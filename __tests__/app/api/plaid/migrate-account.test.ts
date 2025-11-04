/**
 * Tests for Migrate Account API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase
const mockSupabaseUpdate = vi.fn();
const mockSupabaseDelete = vi.fn();
const mockSupabaseSingle = vi.fn();

// Create mock chain for select().eq().eq().single()
const createMockEqChain = () => {
  const eqChain2 = {
    single: mockSupabaseSingle,
  };
  const eqChain1 = {
    eq: vi.fn(() => eqChain2),
  };
  return {
    eq: vi.fn(() => eqChain1),
  };
};

const mockSupabaseSelect = vi.fn(() => createMockEqChain());

const mockSupabaseClient = {
  from: vi.fn((table: string) => ({
    select: mockSupabaseSelect,
    update: mockSupabaseUpdate,
    delete: mockSupabaseDelete,
  })),
  auth: {
    getUser: vi.fn(),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe('Migrate Account API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated user
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });
  });

  describe('POST /api/plaid/migrate-account', () => {
    it('should require authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const { POST } = await import('@/app/api/plaid/migrate-account/route');
      const request = new Request('http://localhost/api/plaid/migrate-account', {
        method: 'POST',
        body: JSON.stringify({
          manualAccountId: 'manual-1',
          plaidAccountId: 'plaid-1',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should require manualAccountId and plaidAccountId', async () => {
      const { POST } = await import('@/app/api/plaid/migrate-account/route');
      const request = new Request('http://localhost/api/plaid/migrate-account', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should verify manual account exists and belongs to user', async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const { POST } = await import('@/app/api/plaid/migrate-account/route');
      const request = new Request('http://localhost/api/plaid/migrate-account', {
        method: 'POST',
        body: JSON.stringify({
          manualAccountId: 'manual-1',
          plaidAccountId: 'plaid-1',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Manual account not found');
    });

    it('should verify accounts are of correct types', async () => {
      // Mock: manual account is already Plaid-connected
      mockSupabaseSingle
        .mockResolvedValueOnce({
          data: {
            id: 'manual-1',
            user_id: 'user-123',
            is_manual: false, // Should be true!
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'plaid-1',
            user_id: 'user-123',
            is_manual: false,
          },
          error: null,
        });

      const { POST } = await import('@/app/api/plaid/migrate-account/route');
      const request = new Request('http://localhost/api/plaid/migrate-account', {
        method: 'POST',
        body: JSON.stringify({
          manualAccountId: 'manual-1',
          plaidAccountId: 'plaid-1',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('already Plaid-connected');
    });

    it('should successfully migrate accounts', async () => {
      // Mock account fetch
      mockSupabaseSingle
        .mockResolvedValueOnce({
          data: {
            id: 'manual-1',
            user_id: 'user-123',
            name: 'My Checking',
            is_manual: true,
            account_number_last4: '1234',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'plaid-1',
            user_id: 'user-123',
            name: 'Plaid Checking',
            is_manual: false,
            plaid_account_id: 'plaid-acc-123',
            plaid_item_id: 'plaid-item-123',
            institution_name: 'Chase',
            account_number_last4: '1234',
          },
          error: null,
        });

      // Mock transaction counts and operations
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 10 }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {
          select: mockSupabaseSelect,
          update: mockSupabaseUpdate,
          delete: mockSupabaseDelete,
        };
      });

      // Mock update, move transactions, and delete
      mockSupabaseUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      mockSupabaseDelete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const { POST } = await import('@/app/api/plaid/migrate-account/route');
      const request = new Request('http://localhost/api/plaid/migrate-account', {
        method: 'POST',
        body: JSON.stringify({
          manualAccountId: 'manual-1',
          plaidAccountId: 'plaid-1',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.accountId).toBe('manual-1');
    });
  });
});
