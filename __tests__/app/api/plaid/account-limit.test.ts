/**
 * Tests for Plaid Account Limit API Route
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

// Mock checkPlaidAccountLimit
vi.mock('@/lib/subscription/access-control', () => ({
  checkPlaidAccountLimit: vi.fn(),
}));

import { GET } from '@/app/api/plaid/account-limit/route';
import { checkPlaidAccountLimit } from '@/lib/subscription/access-control';

const mockCheckPlaidAccountLimit = checkPlaidAccountLimit as ReturnType<typeof vi.fn>;

describe('GET /api/plaid/account-limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 if there is an auth error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Auth error' },
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return limit info for authenticated users', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const limitInfo = {
      canAddMore: true,
      current: 2,
      limit: 5,
      tier: 'basic',
    };

    mockCheckPlaidAccountLimit.mockResolvedValue(limitInfo);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(limitInfo);
    expect(mockCheckPlaidAccountLimit).toHaveBeenCalledOnce();
  });

  it('should return limit of 0 for free tier users', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const limitInfo = {
      canAddMore: false,
      current: 0,
      limit: 0,
      tier: 'free',
    };

    mockCheckPlaidAccountLimit.mockResolvedValue(limitInfo);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tier).toBe('free');
    expect(data.limit).toBe(0);
    expect(data.canAddMore).toBe(false);
  });

  it('should return limit of 5 for basic tier users', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const limitInfo = {
      canAddMore: true,
      current: 2,
      limit: 5,
      tier: 'basic',
    };

    mockCheckPlaidAccountLimit.mockResolvedValue(limitInfo);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tier).toBe('basic');
    expect(data.limit).toBe(5);
    expect(data.current).toBe(2);
  });

  it('should return limit of 999 for premium tier users', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const limitInfo = {
      canAddMore: true,
      current: 50,
      limit: 999,
      tier: 'premium',
    };

    mockCheckPlaidAccountLimit.mockResolvedValue(limitInfo);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tier).toBe('premium');
    expect(data.limit).toBe(999);
    expect(data.current).toBe(50);
  });

  it('should return 500 if checkPlaidAccountLimit throws an error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    mockCheckPlaidAccountLimit.mockRejectedValue(new Error('Database error'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to check account limit');
  });

  it('should indicate when user is at limit', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const limitInfo = {
      canAddMore: false,
      current: 5,
      limit: 5,
      tier: 'basic',
    };

    mockCheckPlaidAccountLimit.mockResolvedValue(limitInfo);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.canAddMore).toBe(false);
    expect(data.current).toBe(data.limit);
  });
});
