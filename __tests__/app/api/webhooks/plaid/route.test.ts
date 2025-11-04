/**
 * Tests for Plaid Webhook Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the sync service
const mockSyncUserTransactions = vi.fn();
vi.mock('@/lib/plaid/sync-service', () => ({
  syncUserTransactions: mockSyncUserTransactions,
}));

// Mock Supabase client
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table) => {
      if (table === 'plaid_items') {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      } else if (table === 'webhook_events') {
        return {
          insert: mockInsert,
        };
      }
      return {};
    }),
  })),
}));

describe('Plaid Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock chain for plaid_items select
    mockSingle.mockResolvedValue({
      data: { user_id: 'user-123' },
      error: null,
    });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });

    // Setup default mock chain for plaid_items update
    const updateEq = vi.fn();
    updateEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: updateEq });

    // Setup default mock for webhook_events insert
    mockInsert.mockResolvedValue({ error: null });

    // Setup default mock for sync service
    mockSyncUserTransactions.mockResolvedValue({
      itemsProcessed: 1,
      itemsSuccessful: 1,
      itemsFailed: 0,
      totalTransactionsAdded: 5,
      totalTransactionsModified: 0,
      totalTransactionsRemoved: 0,
      errors: [],
      results: [],
    });
  });

  it('should export POST handler', async () => {
    const { POST } = await import('@/app/api/webhooks/plaid/route');
    expect(typeof POST).toBe('function');
  });

  it('should handle TRANSACTIONS INITIAL_UPDATE webhook', async () => {
    const webhookPayload = {
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'INITIAL_UPDATE',
      item_id: 'item-123',
      new_transactions: 10,
    };

    const { POST } = await import('@/app/api/webhooks/plaid/route');

    const request = new NextRequest('http://localhost:3000/api/webhooks/plaid', {
      method: 'POST',
      body: JSON.stringify(webhookPayload),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);

    // Verify user lookup
    expect(mockSelect).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('item_id', 'item-123');

    // Verify transaction sync was triggered
    expect(mockSyncUserTransactions).toHaveBeenCalledWith('user-123');

    // Verify webhook was logged
    expect(mockInsert).toHaveBeenCalledWith({
      event_type: 'plaid_webhook',
      event_data: webhookPayload,
      processed: true,
      processed_at: expect.any(String),
    });
  });

  it('should handle TRANSACTIONS HISTORICAL_UPDATE webhook', async () => {
    const webhookPayload = {
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'HISTORICAL_UPDATE',
      item_id: 'item-456',
      new_transactions: 50,
    };

    const { POST } = await import('@/app/api/webhooks/plaid/route');

    const request = new NextRequest('http://localhost:3000/api/webhooks/plaid', {
      method: 'POST',
      body: JSON.stringify(webhookPayload),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockSyncUserTransactions).toHaveBeenCalledWith('user-123');
  });

  it('should handle TRANSACTIONS DEFAULT_UPDATE webhook', async () => {
    const webhookPayload = {
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'DEFAULT_UPDATE',
      item_id: 'item-789',
      new_transactions: 3,
    };

    const { POST } = await import('@/app/api/webhooks/plaid/route');

    const request = new NextRequest('http://localhost:3000/api/webhooks/plaid', {
      method: 'POST',
      body: JSON.stringify(webhookPayload),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockSyncUserTransactions).toHaveBeenCalledWith('user-123');
  });

  it('should handle TRANSACTIONS TRANSACTIONS_REMOVED webhook', async () => {
    const webhookPayload = {
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'TRANSACTIONS_REMOVED',
      item_id: 'item-123',
      removed_transactions: ['txn-1', 'txn-2'],
    };

    const { POST } = await import('@/app/api/webhooks/plaid/route');

    const request = new NextRequest('http://localhost:3000/api/webhooks/plaid', {
      method: 'POST',
      body: JSON.stringify(webhookPayload),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);

    // Should not trigger sync for TRANSACTIONS_REMOVED
    expect(mockSyncUserTransactions).not.toHaveBeenCalled();
  });

  it('should handle ITEM ERROR webhook', async () => {
    const webhookPayload = {
      webhook_type: 'ITEM',
      webhook_code: 'ERROR',
      item_id: 'item-123',
      error: {
        error_code: 'ITEM_LOGIN_REQUIRED',
        error_message: 'User needs to reconnect account',
      },
    };

    const { POST } = await import('@/app/api/webhooks/plaid/route');

    const request = new NextRequest('http://localhost:3000/api/webhooks/plaid', {
      method: 'POST',
      body: JSON.stringify(webhookPayload),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);

    // Verify item status was updated to error
    expect(mockUpdate).toHaveBeenCalledWith({
      status: 'error',
      error_code: 'ITEM_LOGIN_REQUIRED',
      error_message: 'User needs to reconnect account',
      updated_at: expect.any(String),
    });
  });

  it('should handle ITEM PENDING_EXPIRATION webhook', async () => {
    const webhookPayload = {
      webhook_type: 'ITEM',
      webhook_code: 'PENDING_EXPIRATION',
      item_id: 'item-123',
    };

    const { POST } = await import('@/app/api/webhooks/plaid/route');

    const request = new NextRequest('http://localhost:3000/api/webhooks/plaid', {
      method: 'POST',
      body: JSON.stringify(webhookPayload),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);

    // Verify item status was updated to pending_expiration
    expect(mockUpdate).toHaveBeenCalledWith({
      status: 'pending_expiration',
      updated_at: expect.any(String),
    });
  });

  it('should handle unknown webhook type gracefully', async () => {
    const webhookPayload = {
      webhook_type: 'UNKNOWN_TYPE',
      webhook_code: 'UNKNOWN_CODE',
      item_id: 'item-123',
    };

    const { POST } = await import('@/app/api/webhooks/plaid/route');

    const request = new NextRequest('http://localhost:3000/api/webhooks/plaid', {
      method: 'POST',
      body: JSON.stringify(webhookPayload),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);

    // Should still log the webhook
    expect(mockInsert).toHaveBeenCalled();
  });

  it('should handle item not found gracefully', async () => {
    // Mock item not found
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Item not found' },
    });

    const webhookPayload = {
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'DEFAULT_UPDATE',
      item_id: 'item-nonexistent',
    };

    const { POST } = await import('@/app/api/webhooks/plaid/route');

    const request = new NextRequest('http://localhost:3000/api/webhooks/plaid', {
      method: 'POST',
      body: JSON.stringify(webhookPayload),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);

    // Should not attempt to sync or update
    expect(mockSyncUserTransactions).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('should continue even if transaction sync fails', async () => {
    // Mock sync failure
    mockSyncUserTransactions.mockRejectedValue(new Error('Sync failed'));

    const webhookPayload = {
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'DEFAULT_UPDATE',
      item_id: 'item-123',
    };

    const { POST } = await import('@/app/api/webhooks/plaid/route');

    const request = new NextRequest('http://localhost:3000/api/webhooks/plaid', {
      method: 'POST',
      body: JSON.stringify(webhookPayload),
    });

    const response = await POST(request);
    const data = await response.json();

    // Should still return 200 OK
    expect(response.status).toBe(200);
    expect(data.received).toBe(true);

    // Webhook should still be logged
    expect(mockInsert).toHaveBeenCalled();
  });

  it('should handle malformed JSON gracefully', async () => {
    const { POST } = await import('@/app/api/webhooks/plaid/route');

    const request = new NextRequest('http://localhost:3000/api/webhooks/plaid', {
      method: 'POST',
      body: 'invalid-json',
    });

    const response = await POST(request);
    const data = await response.json();

    // Should still return 200 to prevent retries
    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it('should log all webhook events to database', async () => {
    const webhookPayload = {
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'DEFAULT_UPDATE',
      item_id: 'item-123',
      new_transactions: 5,
    };

    const { POST } = await import('@/app/api/webhooks/plaid/route');

    const request = new NextRequest('http://localhost:3000/api/webhooks/plaid', {
      method: 'POST',
      body: JSON.stringify(webhookPayload),
    });

    await POST(request);

    // Verify webhook event was inserted with all required fields
    expect(mockInsert).toHaveBeenCalledWith({
      event_type: 'plaid_webhook',
      event_data: expect.objectContaining({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
      }),
      processed: true,
      processed_at: expect.any(String),
    });
  });

  it('should handle ITEM ERROR webhook with missing error details', async () => {
    const webhookPayload = {
      webhook_type: 'ITEM',
      webhook_code: 'ERROR',
      item_id: 'item-123',
      // No error field
    };

    const { POST } = await import('@/app/api/webhooks/plaid/route');

    const request = new NextRequest('http://localhost:3000/api/webhooks/plaid', {
      method: 'POST',
      body: JSON.stringify(webhookPayload),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);

    // Should update with null error values
    expect(mockUpdate).toHaveBeenCalledWith({
      status: 'error',
      error_code: null,
      error_message: null,
      updated_at: expect.any(String),
    });
  });
});
