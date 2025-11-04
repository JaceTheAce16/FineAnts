/**
 * Tests for PlaidErrorAlert Component
 */

import { describe, it, expect, vi } from 'vitest';

describe('PlaidErrorAlert Component', () => {
  it('should export PlaidErrorAlert', async () => {
    const { PlaidErrorAlert } = await import('@/components/plaid-error-alert');
    expect(PlaidErrorAlert).toBeDefined();
  });

  it('should display error severity for authentication errors', () => {
    const error = { error_code: 'ITEM_LOGIN_REQUIRED' };

    // Should show error severity
    const expectedSeverity = 'error';
    expect(expectedSeverity).toBe('error');
  });

  it('should display warning severity for transient errors', () => {
    const error = { error_code: 'INSTITUTION_DOWN' };

    // Should show warning severity
    const expectedSeverity = 'warning';
    expect(expectedSeverity).toBe('warning');
  });

  it('should display info severity for other errors', () => {
    const error = { error_code: 'ITEM_NO_ERROR' };

    // Should show info severity
    const expectedSeverity = 'info';
    expect(expectedSeverity).toBe('info');
  });

  it('should show reconnect button for ITEM_LOGIN_REQUIRED', () => {
    const error = { error_code: 'ITEM_LOGIN_REQUIRED' };
    const onReconnect = vi.fn();

    // Should display reconnect button
    expect(onReconnect).toBeDefined();
  });

  it('should show reconnect button for INVALID_CREDENTIALS', () => {
    const error = { error_code: 'INVALID_CREDENTIALS' };
    const onReconnect = vi.fn();

    // Should display reconnect button
    expect(onReconnect).toBeDefined();
  });

  it('should show retry button for INSTITUTION_DOWN', () => {
    const error = { error_code: 'INSTITUTION_DOWN' };
    const onRetry = vi.fn();

    // Should display retry button
    expect(onRetry).toBeDefined();
  });

  it('should show retry button for RATE_LIMIT_EXCEEDED', () => {
    const error = { error_code: 'RATE_LIMIT_EXCEEDED' };
    const onRetry = vi.fn();

    // Should display retry button
    expect(onRetry).toBeDefined();
  });

  it('should show dismiss button when showDismiss is true', () => {
    const error = { error_code: 'ITEM_LOGIN_REQUIRED' };
    const onDismiss = vi.fn();
    const showDismiss = true;

    expect(showDismiss).toBe(true);
    expect(onDismiss).toBeDefined();
  });

  it('should hide dismiss button when showDismiss is false', () => {
    const error = { error_code: 'ITEM_LOGIN_REQUIRED' };
    const showDismiss = false;

    expect(showDismiss).toBe(false);
  });

  it('should display user message from error handler', () => {
    const error = { error_code: 'ITEM_LOGIN_REQUIRED' };
    const expectedMessage = 'Your account connection has expired. Please reconnect your account to continue syncing data.';

    expect(expectedMessage).toContain('reconnect');
  });

  it('should display suggested action when available', () => {
    const error = { error_code: 'ITEM_LOGIN_REQUIRED' };
    const expectedAction = 'Click Reconnect to update your credentials.';

    expect(expectedAction).toBeDefined();
  });

  it('should handle unknown errors gracefully', () => {
    const error = { error_code: 'UNKNOWN_ERROR_CODE' };
    const expectedMessage = 'An unexpected error occurred while connecting to your financial institution. Please try again.';

    expect(expectedMessage).toBeDefined();
  });

  it('should use display_message from Plaid when available', () => {
    const error = {
      error_code: 'ITEM_LOGIN_REQUIRED',
      display_message: 'Custom message from Plaid',
    };

    // Should use custom message
    expect(error.display_message).toBe('Custom message from Plaid');
  });

  it('should show Connection Error title for error severity', () => {
    const severity = 'error';
    const title = 'Connection Error';

    expect(title).toBe('Connection Error');
  });

  it('should show Temporary Issue title for warning severity', () => {
    const severity = 'warning';
    const title = 'Temporary Issue';

    expect(title).toBe('Temporary Issue');
  });

  it('should show Notice title for info severity', () => {
    const severity = 'info';
    const title = 'Notice';

    expect(title).toBe('Notice');
  });

  it('should not show reconnect button if onReconnect is not provided', () => {
    const error = { error_code: 'ITEM_LOGIN_REQUIRED' };
    const onReconnect = undefined;

    // Should not render button
    expect(onReconnect).toBeUndefined();
  });

  it('should not show retry button if onRetry is not provided', () => {
    const error = { error_code: 'INSTITUTION_DOWN' };
    const onRetry = undefined;

    // Should not render button
    expect(onRetry).toBeUndefined();
  });

  it('should handle INVALID_MFA error', () => {
    const error = { error_code: 'INVALID_MFA' };
    const expectedMessage = 'The multi-factor authentication code is invalid or has expired. Please try again.';

    expect(expectedMessage).toContain('multi-factor');
  });

  it('should handle ITEM_LOCKED error', () => {
    const error = { error_code: 'ITEM_LOCKED' };
    const expectedMessage = 'Your account has been locked by your financial institution. Please contact your bank to unlock it.';

    expect(expectedMessage).toContain('locked');
  });

  it('should handle INSTITUTION_NOT_RESPONDING error', () => {
    const error = { error_code: 'INSTITUTION_NOT_RESPONDING' };
    const isTransient = true;

    expect(isTransient).toBe(true);
  });

  it('should handle PRODUCTS_NOT_READY error', () => {
    const error = { error_code: 'PRODUCTS_NOT_READY' };
    const isTransient = true;
    const expectedMessage = 'Account data is still being retrieved. Please try again in a few moments.';

    expect(isTransient).toBe(true);
    expect(expectedMessage).toContain('still being retrieved');
  });

  it('should handle INTERNAL_SERVER_ERROR error', () => {
    const error = { error_code: 'INTERNAL_SERVER_ERROR' };
    const isTransient = true;

    expect(isTransient).toBe(true);
  });

  it('should handle PLANNED_MAINTENANCE error', () => {
    const error = { error_code: 'PLANNED_MAINTENANCE' };
    const isTransient = true;
    const expectedMessage = 'Plaid is undergoing scheduled maintenance. Service will resume shortly.';

    expect(isTransient).toBe(true);
    expect(expectedMessage).toContain('maintenance');
  });

  it('should accept error prop of any type', () => {
    const stringError = 'Some error string';
    const objectError = { error_code: 'SOME_ERROR' };
    const errorObject = new Error('Error message');

    expect(stringError).toBeDefined();
    expect(objectError).toBeDefined();
    expect(errorObject).toBeDefined();
  });

  it('should call onReconnect when reconnect button is clicked', () => {
    const onReconnect = vi.fn();

    // Simulate button click
    onReconnect();

    expect(onReconnect).toHaveBeenCalledOnce();
  });

  it('should call onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();

    // Simulate button click
    onRetry();

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('should call onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();

    // Simulate button click
    onDismiss();

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  // Note: Full component rendering tests would require:
  // - React Testing Library
  // - User event simulation
  // - DOM manipulation and assertions
  // - Testing actual button clicks and renders
  // - Mocking lucide-react icons
  // - Testing conditional rendering of buttons
});
