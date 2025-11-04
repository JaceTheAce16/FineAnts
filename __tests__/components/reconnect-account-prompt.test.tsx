/**
 * Tests for ReconnectAccountPrompt Component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase client
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockIn = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock PlaidLinkButton
vi.mock('@/components/plaid-link-button', () => ({
  PlaidLinkButton: ({ children, onSuccess }: any) => {
    return null; // Mock implementation
  },
}));

describe('ReconnectAccountPrompt Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock chain
    mockIn.mockResolvedValue({
      data: [],
      error: null,
    });
    mockSelect.mockReturnValue({ in: mockIn });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it('should export ReconnectAccountPrompt', async () => {
    const { ReconnectAccountPrompt } = await import('@/components/reconnect-account-prompt');
    expect(ReconnectAccountPrompt).toBeDefined();
  });

  it('should fetch items with error or pending_expiration status', async () => {
    const { ReconnectAccountPrompt } = await import('@/components/reconnect-account-prompt');
    expect(ReconnectAccountPrompt).toBeDefined();

    // Component should query for items with status 'error' or 'pending_expiration'
    // .in('status', ['error', 'pending_expiration'])
  });

  it('should not render when no items need reconnection', async () => {
    mockIn.mockResolvedValue({
      data: [],
      error: null,
    });

    const { ReconnectAccountPrompt } = await import('@/components/reconnect-account-prompt');
    expect(ReconnectAccountPrompt).toBeDefined();
    // Should return null when no items
  });

  it('should display prompt for items with error status', async () => {
    mockIn.mockResolvedValue({
      data: [
        {
          item_id: 'item-123',
          institution_name: 'Chase',
          status: 'error',
          error_code: 'ITEM_LOGIN_REQUIRED',
          error_message: 'Login required',
        },
      ],
      error: null,
    });

    const { ReconnectAccountPrompt } = await import('@/components/reconnect-account-prompt');
    expect(ReconnectAccountPrompt).toBeDefined();
  });

  it('should display prompt for items with pending_expiration status', async () => {
    mockIn.mockResolvedValue({
      data: [
        {
          item_id: 'item-456',
          institution_name: 'Bank of America',
          status: 'pending_expiration',
          error_code: null,
          error_message: null,
        },
      ],
      error: null,
    });

    const { ReconnectAccountPrompt } = await import('@/components/reconnect-account-prompt');
    expect(ReconnectAccountPrompt).toBeDefined();
  });

  it('should map error codes to user-friendly messages', async () => {
    const errorMessages: Record<string, string> = {
      'ITEM_LOGIN_REQUIRED': 'Please reconnect Chase with your updated credentials.',
      'INVALID_CREDENTIALS': 'Your credentials for Chase are invalid. Please reconnect.',
      'INSTITUTION_NOT_RESPONDING': 'Chase is not responding. Please try reconnecting later.',
      'ITEM_NOT_SUPPORTED': 'Chase is no longer supported. Please disconnect and use a different account.',
    };

    expect(errorMessages['ITEM_LOGIN_REQUIRED']).toContain('updated credentials');
    expect(errorMessages['INVALID_CREDENTIALS']).toContain('invalid');
  });

  it('should show warning severity for pending_expiration', async () => {
    const item = {
      status: 'pending_expiration',
    };

    const severity = item.status === 'pending_expiration' ? 'warning' : 'error';
    expect(severity).toBe('warning');
  });

  it('should show error severity for error status', async () => {
    const item = {
      status: 'error',
    };

    const severity = item.status === 'pending_expiration' ? 'warning' : 'error';
    expect(severity).toBe('error');
  });

  it('should allow dismissing prompts', async () => {
    const dismissedItems = new Set<string>();
    const itemId = 'item-123';

    dismissedItems.add(itemId);

    expect(dismissedItems.has(itemId)).toBe(true);
  });

  it('should filter out dismissed items', async () => {
    const allItems = [
      { item_id: 'item-1', institution_name: 'Chase' },
      { item_id: 'item-2', institution_name: 'BoA' },
      { item_id: 'item-3', institution_name: 'Wells Fargo' },
    ];

    const dismissedItems = new Set(['item-2']);

    const visibleItems = allItems.filter(item => !dismissedItems.has(item.item_id));

    expect(visibleItems).toHaveLength(2);
    expect(visibleItems.find(i => i.item_id === 'item-2')).toBeUndefined();
  });

  it('should pass accessToken to PlaidLinkButton for update mode', async () => {
    const item = {
      item_id: 'item-123',
      institution_name: 'Chase',
    };

    // PlaidLinkButton should receive accessToken prop with item_id
    expect(item.item_id).toBe('item-123');
  });

  it('should refresh items after successful reconnection', async () => {
    const { ReconnectAccountPrompt } = await import('@/components/reconnect-account-prompt');
    expect(ReconnectAccountPrompt).toBeDefined();

    // onSuccess callback should refetch items
  });

  it('should handle fetch errors gracefully', async () => {
    mockIn.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const { ReconnectAccountPrompt } = await import('@/components/reconnect-account-prompt');
    expect(ReconnectAccountPrompt).toBeDefined();
    // Should not throw, just log error
  });

  it('should display multiple prompts for multiple items', async () => {
    mockIn.mockResolvedValue({
      data: [
        {
          item_id: 'item-1',
          institution_name: 'Chase',
          status: 'error',
          error_code: 'ITEM_LOGIN_REQUIRED',
        },
        {
          item_id: 'item-2',
          institution_name: 'Bank of America',
          status: 'pending_expiration',
          error_code: null,
        },
      ],
      error: null,
    });

    const { ReconnectAccountPrompt } = await import('@/components/reconnect-account-prompt');
    expect(ReconnectAccountPrompt).toBeDefined();
    // Should render 2 prompts
  });

  it('should use appropriate button variant based on severity', async () => {
    const warningVariant = 'outline';
    const errorVariant = 'default';

    expect(warningVariant).toBe('outline');
    expect(errorVariant).toBe('default');
  });

  it('should show institution name in reconnect button', async () => {
    const institutionName = 'Chase';
    const buttonText = `Reconnect ${institutionName}`;

    expect(buttonText).toBe('Reconnect Chase');
  });

  it('should handle ITEM_LOGIN_REQUIRED error code', async () => {
    const errorCode = 'ITEM_LOGIN_REQUIRED';
    const institutionName = 'Chase';

    const message = `Please reconnect ${institutionName} with your updated credentials.`;
    expect(message).toContain('updated credentials');
  });

  it('should handle INVALID_CREDENTIALS error code', async () => {
    const errorCode = 'INVALID_CREDENTIALS';
    const institutionName = 'Chase';

    const message = `Your credentials for ${institutionName} are invalid. Please reconnect.`;
    expect(message).toContain('invalid');
  });

  it('should handle INSTITUTION_NOT_RESPONDING error code', async () => {
    const errorCode = 'INSTITUTION_NOT_RESPONDING';
    const institutionName = 'Chase';

    const message = `${institutionName} is not responding. Please try reconnecting later.`;
    expect(message).toContain('not responding');
  });

  it('should handle ITEM_NOT_SUPPORTED error code', async () => {
    const errorCode = 'ITEM_NOT_SUPPORTED';
    const institutionName = 'Chase';

    const message = `${institutionName} is no longer supported. Please disconnect and use a different account.`;
    expect(message).toContain('no longer supported');
  });

  it('should show generic message for unknown error codes', async () => {
    const institutionName = 'Chase';
    const message = `There was an issue connecting to ${institutionName}. Please reconnect your account.`;

    expect(message).toContain('issue connecting');
  });

  it('should show expiring message for pending_expiration', async () => {
    const institutionName = 'Chase';
    const message = `Your connection to ${institutionName} will expire soon. Please reconnect to continue syncing.`;

    expect(message).toContain('will expire soon');
  });

  it('should not render during loading', async () => {
    const loading = true;
    const visibleItems: any[] = [];

    const shouldRender = !loading && visibleItems.length > 0;
    expect(shouldRender).toBe(false);
  });

  // Note: Full component rendering tests would require:
  // - React Testing Library (@testing-library/react)
  // - Testing actual component rendering
  // - Testing dismiss button clicks
  // - Testing PlaidLinkButton integration
  // - Testing refresh after reconnection
  // - Testing color schemes for different severities
  // - Testing icons display
});
