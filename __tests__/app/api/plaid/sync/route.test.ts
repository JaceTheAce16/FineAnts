/**
 * Tests for Sync API Route
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

// Mock the sync service functions
const mockSyncAccountBalances = vi.fn();
const mockSyncUserTransactions = vi.fn();
vi.mock('@/lib/plaid/sync-service', () => ({
  syncAccountBalances: mockSyncAccountBalances,
  syncUserTransactions: mockSyncUserTransactions,
}));

describe('Sync API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export POST handler', async () => {
    const { POST } = await import('@/app/api/plaid/sync/route');
    expect(typeof POST).toBe('function');
  });

  it('should return 401 when user is not authenticated', async () => {
    // Mock authentication failure
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Unauthorized'),
    });

    const { POST } = await import('@/app/api/plaid/sync/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/sync', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('Unauthorized');
  });

  it('should successfully sync balances and transactions', async () => {
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

    // Mock successful balance sync
    mockSyncAccountBalances.mockResolvedValue({
      itemsProcessed: 2,
      itemsSuccessful: 2,
      itemsFailed: 0,
      totalAccountsUpdated: 5,
      errors: [],
      results: [
        {
          itemId: 'item-1',
          institutionName: 'Chase',
          success: true,
          accountsUpdated: 3,
        },
        {
          itemId: 'item-2',
          institutionName: 'Bank of America',
          success: true,
          accountsUpdated: 2,
        },
      ],
    });

    // Mock successful transaction sync
    mockSyncUserTransactions.mockResolvedValue({
      itemsProcessed: 2,
      itemsSuccessful: 2,
      itemsFailed: 0,
      totalTransactionsAdded: 10,
      totalTransactionsModified: 2,
      totalTransactionsRemoved: 1,
      errors: [],
      results: [
        {
          itemId: 'item-1',
          institutionName: 'Chase',
          success: true,
          transactionsAdded: 7,
          transactionsModified: 1,
          transactionsRemoved: 1,
        },
        {
          itemId: 'item-2',
          institutionName: 'Bank of America',
          success: true,
          transactionsAdded: 3,
          transactionsModified: 1,
          transactionsRemoved: 0,
        },
      ],
    });

    const { POST } = await import('@/app/api/plaid/sync/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/sync', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.partialFailure).toBe(false);
    expect(data.balances.itemsSuccessful).toBe(2);
    expect(data.balances.totalAccountsUpdated).toBe(5);
    expect(data.transactions.itemsSuccessful).toBe(2);
    expect(data.transactions.totalTransactionsAdded).toBe(10);

    // Verify both sync functions were called
    expect(mockSyncAccountBalances).toHaveBeenCalledWith('user-123');
    expect(mockSyncUserTransactions).toHaveBeenCalledWith('user-123');
  });

  it('should handle partial failure when balance sync fails', async () => {
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

    // Mock balance sync failure
    mockSyncAccountBalances.mockRejectedValue(new Error('Plaid API error'));

    // Mock successful transaction sync
    mockSyncUserTransactions.mockResolvedValue({
      itemsProcessed: 1,
      itemsSuccessful: 1,
      itemsFailed: 0,
      totalTransactionsAdded: 5,
      totalTransactionsModified: 0,
      totalTransactionsRemoved: 0,
      errors: [],
      results: [
        {
          itemId: 'item-1',
          institutionName: 'Chase',
          success: true,
          transactionsAdded: 5,
          transactionsModified: 0,
          transactionsRemoved: 0,
        },
      ],
    });

    const { POST } = await import('@/app/api/plaid/sync/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/sync', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.partialFailure).toBe(true);
    expect(data.balances.itemsProcessed).toBe(0); // Default values when sync fails
    expect(data.transactions.itemsSuccessful).toBe(1);
  });

  it('should handle partial failure when transaction sync fails', async () => {
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

    // Mock successful balance sync
    mockSyncAccountBalances.mockResolvedValue({
      itemsProcessed: 1,
      itemsSuccessful: 1,
      itemsFailed: 0,
      totalAccountsUpdated: 3,
      errors: [],
      results: [
        {
          itemId: 'item-1',
          institutionName: 'Chase',
          success: true,
          accountsUpdated: 3,
        },
      ],
    });

    // Mock transaction sync failure
    mockSyncUserTransactions.mockRejectedValue(new Error('Database error'));

    const { POST } = await import('@/app/api/plaid/sync/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/sync', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.partialFailure).toBe(true);
    expect(data.balances.itemsSuccessful).toBe(1);
    expect(data.transactions.itemsProcessed).toBe(0); // Default values when sync fails
  });

  it('should return 500 when both syncs fail', async () => {
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

    // Mock both sync failures
    mockSyncAccountBalances.mockRejectedValue(new Error('Balance sync error'));
    mockSyncUserTransactions.mockRejectedValue(new Error('Transaction sync error'));

    const { POST } = await import('@/app/api/plaid/sync/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/sync', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Sync failed');
    expect(data.details).toBeDefined();
  });

  it('should handle user with no connected accounts', async () => {
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

    // Mock sync with no accounts
    mockSyncAccountBalances.mockResolvedValue({
      itemsProcessed: 0,
      itemsSuccessful: 0,
      itemsFailed: 0,
      totalAccountsUpdated: 0,
      errors: [],
      results: [],
    });

    mockSyncUserTransactions.mockResolvedValue({
      itemsProcessed: 0,
      itemsSuccessful: 0,
      itemsFailed: 0,
      totalTransactionsAdded: 0,
      totalTransactionsModified: 0,
      totalTransactionsRemoved: 0,
      errors: [],
      results: [],
    });

    const { POST } = await import('@/app/api/plaid/sync/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/sync', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.balances.itemsProcessed).toBe(0);
    expect(data.transactions.itemsProcessed).toBe(0);
  });

  it('should sync balances and transactions in parallel', async () => {
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

    let balanceStartTime: number;
    let transactionStartTime: number;
    let balanceEndTime: number;
    let transactionEndTime: number;

    // Mock balance sync with delay
    mockSyncAccountBalances.mockImplementation(async () => {
      balanceStartTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 10));
      balanceEndTime = Date.now();
      return {
        itemsProcessed: 1,
        itemsSuccessful: 1,
        itemsFailed: 0,
        totalAccountsUpdated: 1,
        errors: [],
        results: [],
      };
    });

    // Mock transaction sync with delay
    mockSyncUserTransactions.mockImplementation(async () => {
      transactionStartTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 10));
      transactionEndTime = Date.now();
      return {
        itemsProcessed: 1,
        itemsSuccessful: 1,
        itemsFailed: 0,
        totalTransactionsAdded: 1,
        totalTransactionsModified: 0,
        totalTransactionsRemoved: 0,
        errors: [],
        results: [],
      };
    });

    const { POST } = await import('@/app/api/plaid/sync/route');

    const request = new NextRequest('http://localhost:3000/api/plaid/sync', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify both functions were called
    expect(mockSyncAccountBalances).toHaveBeenCalled();
    expect(mockSyncUserTransactions).toHaveBeenCalled();

    // Check that they ran in parallel (start times should be close)
    // If they were sequential, transactionStartTime would be after balanceEndTime
    // But in parallel, transactionStartTime should be before or close to balanceEndTime
    const timeDiff = Math.abs(balanceStartTime! - transactionStartTime!);
    expect(timeDiff).toBeLessThan(5); // Should start within 5ms of each other
  });
});
