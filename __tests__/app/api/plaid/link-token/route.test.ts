/**
 * Tests for Link Token API Route
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the Supabase client
const mockGetUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

// Mock the Plaid client
const mockCreateLinkToken = vi.fn();
vi.mock('@/lib/plaid/client', () => ({
  createLinkToken: mockCreateLinkToken,
}));

// Mock Plaid types
vi.mock('plaid', () => ({
  Products: {
    Auth: 'auth',
    Transactions: 'transactions',
  },
  CountryCode: {
    Us: 'US',
  },
}));

describe('Link Token API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export POST handler', async () => {
    const { POST } = await import('@/app/api/plaid/link-token/route');
    expect(typeof POST).toBe('function');
  });

  it('should return 401 when user is not authenticated', async () => {
    // Mock authentication failure
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Unauthorized'),
    });

    const { POST } = await import('@/app/api/plaid/link-token/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/link-token', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('Unauthorized');
  });

  it('should create link token for new connection (no accessToken)', async () => {
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

    // Mock successful link token creation
    mockCreateLinkToken.mockResolvedValue('link-sandbox-test-token');

    const { POST } = await import('@/app/api/plaid/link-token/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/link-token', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.linkToken).toBe('link-sandbox-test-token');
    expect(mockCreateLinkToken).toHaveBeenCalledWith({
      userId: 'user-123',
      clientName: 'FineAnts',
      countryCodes: ['US'],
      language: 'en',
      products: ['auth', 'transactions'],
      accessToken: undefined,
    });
  });

  it('should create link token for update mode (with accessToken)', async () => {
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

    // Mock successful link token creation
    mockCreateLinkToken.mockResolvedValue('link-sandbox-update-token');

    const { POST } = await import('@/app/api/plaid/link-token/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/link-token', {
      method: 'POST',
      body: JSON.stringify({ accessToken: 'access-sandbox-existing-token' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.linkToken).toBe('link-sandbox-update-token');
    expect(mockCreateLinkToken).toHaveBeenCalledWith({
      userId: 'user-123',
      clientName: 'FineAnts',
      countryCodes: ['US'],
      language: 'en',
      products: ['auth', 'transactions'],
      accessToken: 'access-sandbox-existing-token',
    });
  });

  it('should handle Plaid API errors gracefully', async () => {
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

    // Mock Plaid API error
    mockCreateLinkToken.mockRejectedValue(new Error('Plaid API error'));

    const { POST } = await import('@/app/api/plaid/link-token/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/link-token', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Failed to create link token');
  });

  it('should handle malformed request body gracefully', async () => {
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

    // Mock successful link token creation
    mockCreateLinkToken.mockResolvedValue('link-sandbox-test-token');

    const { POST } = await import('@/app/api/plaid/link-token/route');

    // Create request with malformed body (will be caught and default to {})
    const request = new NextRequest('http://localhost:3000/api/plaid/link-token', {
      method: 'POST',
      body: 'not-json',
    });

    const response = await POST(request);
    const data = await response.json();

    // Should still succeed because malformed body is caught and defaults to {}
    expect(response.status).toBe(200);
    expect(data.linkToken).toBe('link-sandbox-test-token');
  });
});
