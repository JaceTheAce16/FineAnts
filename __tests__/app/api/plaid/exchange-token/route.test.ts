/**
 * Tests for Exchange Token API Route
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the Supabase clients
const mockGetUser = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({
  insert: mockInsert,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock the Plaid client functions
const mockExchangePublicToken = vi.fn();
const mockGetAccounts = vi.fn();
vi.mock('@/lib/plaid/client', () => ({
  exchangePublicToken: mockExchangePublicToken,
  getAccounts: mockGetAccounts,
}));

// Mock the token manager
const mockStoreAccessToken = vi.fn();
vi.mock('@/lib/plaid/token-manager', () => ({
  storeAccessToken: mockStoreAccessToken,
}));

describe('Exchange Token API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset insert mock to return success by default
    mockInsert.mockResolvedValue({ error: null });
  });

  it('should export POST handler', async () => {
    const { POST } = await import('@/app/api/plaid/exchange-token/route');
    expect(typeof POST).toBe('function');
  });

  it('should return 401 when user is not authenticated', async () => {
    // Mock authentication failure
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Unauthorized'),
    });

    const { POST } = await import('@/app/api/plaid/exchange-token/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({
        publicToken: 'public-sandbox-token',
        institutionId: 'ins_3',
        institutionName: 'Chase',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('Unauthorized');
  });

  it('should return 400 when publicToken is missing', async () => {
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

    const { POST } = await import('@/app/api/plaid/exchange-token/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({
        institutionId: 'ins_3',
        institutionName: 'Chase',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });

  it('should return 400 when institutionId is missing', async () => {
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

    const { POST } = await import('@/app/api/plaid/exchange-token/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({
        publicToken: 'public-sandbox-token',
        institutionName: 'Chase',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });

  it('should return 400 when institutionName is missing', async () => {
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

    const { POST } = await import('@/app/api/plaid/exchange-token/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({
        publicToken: 'public-sandbox-token',
        institutionId: 'ins_3',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });

  it('should successfully exchange token and create accounts', async () => {
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

    // Mock successful token exchange
    mockExchangePublicToken.mockResolvedValue({
      accessToken: 'access-sandbox-token',
      itemId: 'item-sandbox-123',
    });

    // Mock account data from Plaid
    mockGetAccounts.mockResolvedValue([
      {
        accountId: 'acc-checking-123',
        name: 'Plaid Checking',
        officialName: 'Plaid Gold Standard 0% Interest Checking',
        type: 'depository',
        subtype: 'checking',
        mask: '0000',
        balances: {
          available: 100.0,
          current: 110.0,
          isoCurrencyCode: 'USD',
        },
      },
      {
        accountId: 'acc-savings-456',
        name: 'Plaid Savings',
        officialName: null,
        type: 'depository',
        subtype: 'savings',
        mask: '1111',
        balances: {
          available: 200.0,
          current: 210.0,
          isoCurrencyCode: 'USD',
        },
      },
    ]);

    // Mock successful token storage
    mockStoreAccessToken.mockResolvedValue(undefined);

    const { POST } = await import('@/app/api/plaid/exchange-token/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({
        publicToken: 'public-sandbox-token',
        institutionId: 'ins_3',
        institutionName: 'Chase',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.itemId).toBe('item-sandbox-123');
    expect(data.accountCount).toBe(2);

    // Verify token exchange was called
    expect(mockExchangePublicToken).toHaveBeenCalledWith('public-sandbox-token');

    // Verify token storage was called
    expect(mockStoreAccessToken).toHaveBeenCalledWith(
      'user-123',
      'item-sandbox-123',
      'access-sandbox-token',
      'ins_3',
      'Chase'
    );

    // Verify accounts fetch was called
    expect(mockGetAccounts).toHaveBeenCalledWith('access-sandbox-token');

    // Verify accounts were inserted
    expect(mockInsert).toHaveBeenCalledWith([
      {
        user_id: 'user-123',
        name: 'Plaid Checking',
        account_type: 'checking',
        institution_name: 'Chase',
        account_number_last4: '0000',
        current_balance: 110.0,
        available_balance: 100.0,
        currency: 'USD',
        is_manual: false,
        plaid_account_id: 'acc-checking-123',
        plaid_item_id: 'item-sandbox-123',
      },
      {
        user_id: 'user-123',
        name: 'Plaid Savings',
        account_type: 'savings',
        institution_name: 'Chase',
        account_number_last4: '1111',
        current_balance: 210.0,
        available_balance: 200.0,
        currency: 'USD',
        is_manual: false,
        plaid_account_id: 'acc-savings-456',
        plaid_item_id: 'item-sandbox-123',
      },
    ]);
  });

  it('should handle accounts with null mask', async () => {
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

    // Mock successful token exchange
    mockExchangePublicToken.mockResolvedValue({
      accessToken: 'access-sandbox-token',
      itemId: 'item-sandbox-123',
    });

    // Mock account with null mask
    mockGetAccounts.mockResolvedValue([
      {
        accountId: 'acc-credit-789',
        name: 'Credit Card',
        officialName: null,
        type: 'credit',
        subtype: 'credit card',
        mask: null,
        balances: {
          available: null,
          current: -500.0,
          isoCurrencyCode: 'USD',
        },
      },
    ]);

    mockStoreAccessToken.mockResolvedValue(undefined);

    const { POST } = await import('@/app/api/plaid/exchange-token/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({
        publicToken: 'public-sandbox-token',
        institutionId: 'ins_3',
        institutionName: 'Chase',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify account was inserted with 'N/A' for null mask
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        account_number_last4: 'N/A',
        account_type: 'credit_card',
        current_balance: -500.0,
        available_balance: null,
      }),
    ]);
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
    mockExchangePublicToken.mockRejectedValue(new Error('Invalid public token'));

    const { POST } = await import('@/app/api/plaid/exchange-token/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({
        publicToken: 'invalid-token',
        institutionId: 'ins_3',
        institutionName: 'Chase',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Failed to connect account');
  });

  it('should handle database insertion errors', async () => {
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

    mockExchangePublicToken.mockResolvedValue({
      accessToken: 'access-sandbox-token',
      itemId: 'item-sandbox-123',
    });

    mockGetAccounts.mockResolvedValue([
      {
        accountId: 'acc-checking-123',
        name: 'Checking',
        officialName: null,
        type: 'depository',
        subtype: 'checking',
        mask: '0000',
        balances: {
          available: 100.0,
          current: 110.0,
          isoCurrencyCode: 'USD',
        },
      },
    ]);

    mockStoreAccessToken.mockResolvedValue(undefined);

    // Mock database insertion error
    mockInsert.mockResolvedValue({
      error: { message: 'Database error' },
    });

    const { POST } = await import('@/app/api/plaid/exchange-token/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({
        publicToken: 'public-sandbox-token',
        institutionId: 'ins_3',
        institutionName: 'Chase',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Failed to connect account');
  });

  it('should correctly map different account types', async () => {
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

    mockExchangePublicToken.mockResolvedValue({
      accessToken: 'access-sandbox-token',
      itemId: 'item-sandbox-123',
    });

    // Mock various account types
    mockGetAccounts.mockResolvedValue([
      {
        accountId: 'acc-1',
        name: 'Checking',
        type: 'depository',
        subtype: 'checking',
        mask: '0000',
        balances: { available: 100, current: 100, isoCurrencyCode: 'USD' },
      },
      {
        accountId: 'acc-2',
        name: 'Savings',
        type: 'depository',
        subtype: 'savings',
        mask: '1111',
        balances: { available: 200, current: 200, isoCurrencyCode: 'USD' },
      },
      {
        accountId: 'acc-3',
        name: 'Credit Card',
        type: 'credit',
        subtype: 'credit card',
        mask: '2222',
        balances: { available: 1000, current: -500, isoCurrencyCode: 'USD' },
      },
      {
        accountId: 'acc-4',
        name: '401k',
        type: 'investment',
        subtype: '401k',
        mask: '3333',
        balances: { available: null, current: 50000, isoCurrencyCode: 'USD' },
      },
      {
        accountId: 'acc-5',
        name: 'Mortgage',
        type: 'loan',
        subtype: 'mortgage',
        mask: '4444',
        balances: { available: null, current: -200000, isoCurrencyCode: 'USD' },
      },
      {
        accountId: 'acc-6',
        name: 'Unknown Type',
        type: 'unknown',
        subtype: 'unknown',
        mask: '5555',
        balances: { available: null, current: 0, isoCurrencyCode: 'USD' },
      },
    ]);

    mockStoreAccessToken.mockResolvedValue(undefined);

    const { POST } = await import('@/app/api/plaid/exchange-token/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({
        publicToken: 'public-sandbox-token',
        institutionId: 'ins_3',
        institutionName: 'Test Bank',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accountCount).toBe(6);

    // Verify account type mappings
    const insertedAccounts = mockInsert.mock.calls[0][0];
    expect(insertedAccounts[0].account_type).toBe('checking');
    expect(insertedAccounts[1].account_type).toBe('savings');
    expect(insertedAccounts[2].account_type).toBe('credit_card');
    expect(insertedAccounts[3].account_type).toBe('retirement');
    expect(insertedAccounts[4].account_type).toBe('mortgage');
    expect(insertedAccounts[5].account_type).toBe('other'); // Unknown type maps to 'other'
  });
});
