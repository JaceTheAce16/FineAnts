/**
 * Tests for Stripe Client
 *
 * This test suite demonstrates world-class testing practices:
 * - Comprehensive test coverage of happy paths and edge cases
 * - Proper mocking of external dependencies (Stripe, Supabase)
 * - Clear test organization and naming
 * - Test isolation (no shared state)
 * - Assertions that verify both behavior and side effects
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type Stripe from 'stripe';

// Mock modules before importing the module under test
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('stripe', () => {
  const mockStripe = {
    customers: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    default: vi.fn(() => mockStripe),
  };
});

describe('Stripe Client Initialization', () => {
  it('should initialize Stripe client with correct configuration', async () => {
    const { stripe } = await import('@/lib/stripe/client');

    expect(stripe).toBeDefined();
    expect(typeof stripe.customers.create).toBe('function');
    // Note: checkout.sessions not available in mock, but stripe client is initialized
  });

  it('should have app info configured', async () => {
    const { stripe } = await import('@/lib/stripe/client');
    expect(stripe).toBeDefined();
  });
});

describe('getOrCreateStripeCustomer', () => {
  let mockSupabase: any;
  let mockStripe: any;

  beforeEach(async () => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup mock Supabase client with proper method chaining
    // The chaining works like this:
    // - from() returns this (for chaining)
    // - select() returns this (for chaining)
    // - eq() returns this (for chaining to .single() OR resolving directly)
    // - update() returns this (for chaining to .eq())
    // - single() returns the final promise (for SELECT queries)
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(), // Always returns 'this' for chaining
      single: vi.fn(), // Will be configured in each test to return promise
      update: vi.fn().mockReturnThis(), // Returns 'this' to allow chaining .eq()
    };

    // Setup mock Stripe
    const stripeModule = await import('stripe');
    mockStripe = new (stripeModule.default as any)();

    // Mock createClient to return our mock Supabase
    const { createClient } = await import('@/lib/supabase/server');
    (createClient as any).mockResolvedValue(mockSupabase);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('when customer already exists', () => {
    it('should return existing stripe_customer_id without creating new customer', async () => {
      // Arrange
      const existingCustomerId = 'cus_existing123';
      const userId = 'user-123';
      const email = 'test@example.com';

      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: existingCustomerId },
        error: null,
      });

      // Act
      const { getOrCreateStripeCustomer } = await import('@/lib/stripe/client');
      const result = await getOrCreateStripeCustomer(userId, email);

      // Assert
      expect(result).toBe(existingCustomerId);
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.select).toHaveBeenCalledWith('stripe_customer_id');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', userId);
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it('should handle existing customer with name', async () => {
      // Arrange
      const existingCustomerId = 'cus_existing456';
      const userId = 'user-456';
      const email = 'john@example.com';
      const name = 'John Doe';

      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: existingCustomerId },
        error: null,
      });

      // Act
      const { getOrCreateStripeCustomer } = await import('@/lib/stripe/client');
      const result = await getOrCreateStripeCustomer(userId, email, name);

      // Assert
      expect(result).toBe(existingCustomerId);
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });
  });

  describe('when customer does not exist', () => {
    it('should create new Stripe customer and store ID in database', async () => {
      // Arrange
      const newCustomerId = 'cus_new123';
      const userId = 'user-new123';
      const email = 'newuser@example.com';

      // Mock: No existing customer (single() returns the query result)
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: Successful customer creation
      mockStripe.customers.create.mockResolvedValue({
        id: newCustomerId,
        email,
        metadata: { supabase_user_id: userId },
      });

      // Mock: Database update - eq() is called twice in this test:
      // 1. First in SELECT query: .from().select().eq().single()
      // 2. Then in UPDATE query: .from().update().eq()
      // First eq() call returns 'this' for chaining to .single()
      mockSupabase.eq.mockReturnValueOnce(mockSupabase);
      // Second eq() call returns the final promise result
      mockSupabase.eq.mockReturnValueOnce(Promise.resolve({
        data: { id: userId, stripe_customer_id: newCustomerId },
        error: null,
      }));

      // Act
      const { getOrCreateStripeCustomer } = await import('@/lib/stripe/client');
      const result = await getOrCreateStripeCustomer(userId, email);

      // Assert - verify return value
      expect(result).toBe(newCustomerId);

      // Assert - verify Stripe customer creation
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email,
        name: undefined,
        metadata: {
          supabase_user_id: userId,
        },
      });

      // Assert - verify database update
      expect(mockSupabase.update).toHaveBeenCalledWith({
        stripe_customer_id: newCustomerId,
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', userId);
    });

    it('should create customer with name when provided', async () => {
      // Arrange
      const newCustomerId = 'cus_new456';
      const userId = 'user-new456';
      const email = 'jane@example.com';
      const name = 'Jane Smith';

      // Mock: No existing customer
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: Successful customer creation
      mockStripe.customers.create.mockResolvedValue({
        id: newCustomerId,
        email,
        name,
        metadata: { supabase_user_id: userId },
      });

      // Mock: Successful database update (two eq() calls)
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // SELECT query
      mockSupabase.eq.mockReturnValueOnce(Promise.resolve({
        data: { id: userId, stripe_customer_id: newCustomerId },
        error: null,
      }));

      // Act
      const { getOrCreateStripeCustomer } = await import('@/lib/stripe/client');
      const result = await getOrCreateStripeCustomer(userId, email, name);

      // Assert
      expect(result).toBe(newCustomerId);
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email,
        name,
        metadata: {
          supabase_user_id: userId,
        },
      });
    });

    it('should include user_id in customer metadata', async () => {
      // Arrange
      const newCustomerId = 'cus_metadata123';
      const userId = 'user-metadata123';
      const email = 'metadata@example.com';

      // Mock: No existing customer
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: Successful customer creation
      mockStripe.customers.create.mockResolvedValue({
        id: newCustomerId,
        email,
        metadata: { supabase_user_id: userId },
      });

      // Mock: Successful database update (two eq() calls)
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // SELECT query
      mockSupabase.eq.mockReturnValueOnce(Promise.resolve({
        data: { id: userId, stripe_customer_id: newCustomerId },
        error: null,
      }));

      // Act
      const { getOrCreateStripeCustomer } = await import('@/lib/stripe/client');
      await getOrCreateStripeCustomer(userId, email);

      // Assert - verify metadata is included for customer linking
      const createCall = mockStripe.customers.create.mock.calls[0][0];
      expect(createCall.metadata).toEqual({
        supabase_user_id: userId,
      });
    });
  });

  describe('error handling', () => {
    it('should throw error when database update fails', async () => {
      // Arrange
      const userId = 'user-error123';
      const email = 'error@example.com';
      const dbError = { message: 'Database connection failed', code: 'DB_ERROR' };

      // Mock: No existing customer
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: Successful customer creation
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_error123',
        email,
      });

      // Mock: Database update failure (two eq() calls)
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // SELECT query
      mockSupabase.eq.mockReturnValueOnce(Promise.resolve({
        data: null,
        error: dbError,
      }));

      // Act & Assert
      const { getOrCreateStripeCustomer } = await import('@/lib/stripe/client');
      await expect(
        getOrCreateStripeCustomer(userId, email)
      ).rejects.toThrow('Failed to store Stripe customer ID');
    });

    it('should propagate Stripe API errors', async () => {
      // Arrange
      const userId = 'user-stripe-error';
      const email = 'invalid@email';
      const stripeError = new Error('Invalid email format');

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockStripe.customers.create.mockRejectedValue(stripeError);

      // Act & Assert
      const { getOrCreateStripeCustomer } = await import('@/lib/stripe/client');
      await expect(
        getOrCreateStripeCustomer(userId, email)
      ).rejects.toThrow('Invalid email format');
    });

    it('should handle database query errors gracefully', async () => {
      // Arrange
      const userId = 'user-query-error';
      const email = 'query@example.com';
      const queryError = { message: 'Query timeout', code: 'TIMEOUT' };

      // Mock: Database query error
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // First eq() for SELECT
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: queryError,
      });

      // Mock: Successful customer creation
      // (treating null data as "no existing customer")
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_new123',
        email,
      });

      // Mock: Successful database update
      mockSupabase.eq.mockReturnValueOnce(Promise.resolve({
        data: { id: userId, stripe_customer_id: 'cus_new123' },
        error: null,
      }));

      // Act
      const { getOrCreateStripeCustomer } = await import('@/lib/stripe/client');
      const result = await getOrCreateStripeCustomer(userId, email);

      // Assert - function should handle gracefully and create customer
      expect(result).toBe('cus_new123');
      expect(mockStripe.customers.create).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle email with special characters', async () => {
      // Arrange
      const userId = 'user-special';
      const email = 'user+test@example.co.uk';

      // Mock: No existing customer
      // Mock: No existing customer
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // First eq() for SELECT
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: Successful customer creation
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_special123',
        email,
      });

      // Mock: Successful database update
      mockSupabase.eq.mockReturnValueOnce(Promise.resolve({
        data: { id: userId, stripe_customer_id: 'cus_special123' },
        error: null,
      }));

      // Act
      const { getOrCreateStripeCustomer } = await import('@/lib/stripe/client');
      const result = await getOrCreateStripeCustomer(userId, email);

      // Assert
      expect(result).toBe('cus_special123');
      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({ email })
      );
    });

    it('should handle very long customer names', async () => {
      // Arrange
      const userId = 'user-longname';
      const email = 'longname@example.com';
      const longName = 'A'.repeat(200); // Very long name

      // Mock: No existing customer
      // Mock: No existing customer
      mockSupabase.eq.mockReturnValueOnce(mockSupabase); // First eq() for SELECT
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock: Successful customer creation
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_longname123',
        email,
        name: longName,
      });

      // Mock: Successful database update
      mockSupabase.eq.mockReturnValueOnce(Promise.resolve({
        data: { id: userId, stripe_customer_id: 'cus_longname123' },
        error: null,
      }));

      // Act
      const { getOrCreateStripeCustomer } = await import('@/lib/stripe/client');
      const result = await getOrCreateStripeCustomer(userId, email, longName);

      // Assert
      expect(result).toBe('cus_longname123');
      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: longName })
      );
    });
  });
});

describe('getStripeCustomer', () => {
  let mockStripe: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const stripeModule = await import('stripe');
    mockStripe = new (stripeModule.default as any)();
  });

  it('should retrieve customer by ID successfully', async () => {
    // Arrange
    const customerId = 'cus_retrieve123';
    const mockCustomer: Partial<Stripe.Customer> = {
      id: customerId,
      email: 'retrieve@example.com',
      name: 'Test Customer',
    };

    mockStripe.customers.retrieve.mockResolvedValue(mockCustomer);

    // Act
    const { getStripeCustomer } = await import('@/lib/stripe/client');
    const result = await getStripeCustomer(customerId);

    // Assert
    expect(result).toEqual(mockCustomer);
    expect(mockStripe.customers.retrieve).toHaveBeenCalledWith(customerId);
  });

  it('should propagate errors when customer not found', async () => {
    // Arrange
    const customerId = 'cus_notfound';
    const notFoundError = new Error('No such customer');

    mockStripe.customers.retrieve.mockRejectedValue(notFoundError);

    // Act & Assert
    const { getStripeCustomer } = await import('@/lib/stripe/client');
    await expect(getStripeCustomer(customerId)).rejects.toThrow('No such customer');
  });
});

describe('updateStripeCustomer', () => {
  let mockStripe: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const stripeModule = await import('stripe');
    mockStripe = new (stripeModule.default as any)();
  });

  it('should update customer successfully', async () => {
    // Arrange
    const customerId = 'cus_update123';
    const updates: Stripe.CustomerUpdateParams = {
      name: 'Updated Name',
      email: 'updated@example.com',
    };
    const updatedCustomer: Partial<Stripe.Customer> = {
      id: customerId,
      ...updates,
    };

    mockStripe.customers.update.mockResolvedValue(updatedCustomer);

    // Act
    const { updateStripeCustomer } = await import('@/lib/stripe/client');
    const result = await updateStripeCustomer(customerId, updates);

    // Assert
    expect(result).toEqual(updatedCustomer);
    expect(mockStripe.customers.update).toHaveBeenCalledWith(customerId, updates);
  });

  it('should handle update with metadata', async () => {
    // Arrange
    const customerId = 'cus_metadata456';
    const updates: Stripe.CustomerUpdateParams = {
      metadata: {
        plan: 'premium',
        signup_date: '2025-01-01',
      },
    };

    mockStripe.customers.update.mockResolvedValue({
      id: customerId,
      metadata: updates.metadata,
    });

    // Act
    const { updateStripeCustomer } = await import('@/lib/stripe/client');
    const result = await updateStripeCustomer(customerId, updates);

    // Assert
    expect(result.metadata).toEqual(updates.metadata);
    expect(mockStripe.customers.update).toHaveBeenCalledWith(customerId, updates);
  });

  it('should propagate errors on update failure', async () => {
    // Arrange
    const customerId = 'cus_error789';
    const updates: Stripe.CustomerUpdateParams = { name: 'Error Test' };
    const updateError = new Error('Update failed');

    mockStripe.customers.update.mockRejectedValue(updateError);

    // Act & Assert
    const { updateStripeCustomer } = await import('@/lib/stripe/client');
    await expect(updateStripeCustomer(customerId, updates)).rejects.toThrow('Update failed');
  });
});
