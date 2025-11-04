/**
 * Tests for Feature Access Control
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRequiredTierForFeature,
  getAccountLimit,
  getExportLimit,
  getFeaturesForTier,
  FEATURE_DESCRIPTIONS,
} from '@/lib/subscription/access-control';

// Mock Supabase client
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

describe('Feature Access Control', () => {
  describe('getRequiredTierForFeature', () => {
    it('should return correct tier for basic features', () => {
      expect(getRequiredTierForFeature('advanced_budgeting')).toBe('basic');
      expect(getRequiredTierForFeature('export_data')).toBe('basic');
      expect(getRequiredTierForFeature('plaid_integration')).toBe('basic');
    });

    it('should return correct tier for premium features', () => {
      expect(getRequiredTierForFeature('unlimited_accounts')).toBe('premium');
      expect(getRequiredTierForFeature('investment_tracking')).toBe('premium');
      expect(getRequiredTierForFeature('retirement_planning')).toBe('premium');
    });
  });

  describe('getAccountLimit', () => {
    it('should return correct limits for each tier', () => {
      expect(getAccountLimit('free')).toBe(2);
      expect(getAccountLimit('basic')).toBe(5);
      expect(getAccountLimit('premium')).toBe(Infinity);
    });
  });

  describe('getExportLimit', () => {
    it('should return correct export limits', () => {
      expect(getExportLimit('free')).toBe(0);
      expect(getExportLimit('basic')).toBe(10);
      expect(getExportLimit('premium')).toBe(Infinity);
    });
  });

  describe('getFeaturesForTier', () => {
    it('should return no features for free tier', () => {
      const features = getFeaturesForTier('free');
      expect(features).toHaveLength(0);
    });

    it('should return correct features for basic tier', () => {
      const features = getFeaturesForTier('basic');
      expect(features).toContain('advanced_budgeting');
      expect(features).toContain('export_data');
      expect(features).toContain('plaid_integration');
      expect(features).toHaveLength(3);
    });

    it('should return all features for premium tier', () => {
      const features = getFeaturesForTier('premium');
      expect(features).toContain('unlimited_accounts');
      expect(features).toContain('advanced_budgeting');
      expect(features).toContain('investment_tracking');
      expect(features).toContain('debt_optimization');
      expect(features).toContain('retirement_planning');
      expect(features).toContain('export_data');
      expect(features).toContain('priority_support');
      expect(features).toContain('plaid_integration');
      expect(features).toHaveLength(8);
    });
  });

  describe('FEATURE_DESCRIPTIONS', () => {
    it('should have descriptions for all features', () => {
      const features = [
        'unlimited_accounts',
        'advanced_budgeting',
        'investment_tracking',
        'debt_optimization',
        'retirement_planning',
        'export_data',
        'priority_support',
        'plaid_integration',
      ];

      features.forEach((feature) => {
        expect(FEATURE_DESCRIPTIONS[feature as keyof typeof FEATURE_DESCRIPTIONS]).toBeDefined();
        expect(typeof FEATURE_DESCRIPTIONS[feature as keyof typeof FEATURE_DESCRIPTIONS]).toBe('string');
      });
    });
  });

  // Note: Tests for checkFeatureAccess, requireFeatureAccess, and canAddAccount
  // would require mocking Supabase client
  describe('Server-side access functions', () => {
    it('should export checkFeatureAccess', async () => {
      const { checkFeatureAccess } = await import('@/lib/subscription/access-control');
      expect(typeof checkFeatureAccess).toBe('function');
    });

    it('should export requireFeatureAccess', async () => {
      const { requireFeatureAccess } = await import('@/lib/subscription/access-control');
      expect(typeof requireFeatureAccess).toBe('function');
    });

    it('should export canAddAccount', async () => {
      const { canAddAccount } = await import('@/lib/subscription/access-control');
      expect(typeof canAddAccount).toBe('function');
    });
  });

  describe('checkPlaidAccountLimit', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockIn.mockResolvedValue({ count: 0, error: null });
      mockEq.mockReturnValue({ in: mockIn });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });
    });

    it('should return limit of 0 for free tier users', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: { subscription_tier: 'free' },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: mockSingle,
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: mockIn,
            }),
          }),
        };
      });

      const { checkPlaidAccountLimit } = await import('@/lib/subscription/access-control');
      const result = await checkPlaidAccountLimit();

      expect(result.limit).toBe(0);
      expect(result.tier).toBe('free');
      expect(result.canAddMore).toBe(false);
    });

    it('should return limit of 5 for basic tier users', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: { subscription_tier: 'basic' },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: mockSingle,
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: mockIn,
            }),
          }),
        };
      });

      mockIn.mockResolvedValue({ count: 2, error: null });

      const { checkPlaidAccountLimit } = await import('@/lib/subscription/access-control');
      const result = await checkPlaidAccountLimit();

      expect(result.limit).toBe(5);
      expect(result.tier).toBe('basic');
      expect(result.current).toBe(2);
      expect(result.canAddMore).toBe(true);
    });

    it('should return limit of 999 for premium tier users', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: { subscription_tier: 'premium' },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: mockSingle,
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: mockIn,
            }),
          }),
        };
      });

      mockIn.mockResolvedValue({ count: 50, error: null });

      const { checkPlaidAccountLimit } = await import('@/lib/subscription/access-control');
      const result = await checkPlaidAccountLimit();

      expect(result.limit).toBe(999);
      expect(result.tier).toBe('premium');
      expect(result.current).toBe(50);
      expect(result.canAddMore).toBe(true);
    });

    it('should return canAddMore false when at limit', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: { subscription_tier: 'basic' },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: mockSingle,
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: mockIn,
            }),
          }),
        };
      });

      mockIn.mockResolvedValue({ count: 5, error: null });

      const { checkPlaidAccountLimit } = await import('@/lib/subscription/access-control');
      const result = await checkPlaidAccountLimit();

      expect(result.canAddMore).toBe(false);
    });

    it('should handle unauthenticated users', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { checkPlaidAccountLimit } = await import('@/lib/subscription/access-control');
      const result = await checkPlaidAccountLimit();

      expect(result.canAddMore).toBe(false);
      expect(result.current).toBe(0);
      expect(result.limit).toBe(0);
      expect(result.tier).toBe('free');
    });

    it('should handle database errors gracefully', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockFrom.mockImplementation(() => {
        throw new Error('Database connection error');
      });

      const { checkPlaidAccountLimit } = await import('@/lib/subscription/access-control');
      const result = await checkPlaidAccountLimit();

      expect(result.canAddMore).toBe(false);
      expect(result.current).toBe(0);
      expect(result.limit).toBe(0);
      expect(result.tier).toBe('free');
    });
  });
});
