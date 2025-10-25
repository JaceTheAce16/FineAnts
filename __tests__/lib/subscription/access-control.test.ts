/**
 * Tests for Feature Access Control
 */

import {
  getRequiredTierForFeature,
  getAccountLimit,
  getExportLimit,
  getFeaturesForTier,
  FEATURE_DESCRIPTIONS,
} from '@/lib/subscription/access-control';

describe('Feature Access Control', () => {
  describe('getRequiredTierForFeature', () => {
    it('should return correct tier for basic features', () => {
      expect(getRequiredTierForFeature('advanced_budgeting')).toBe('basic');
      expect(getRequiredTierForFeature('export_data')).toBe('basic');
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
      expect(features).toHaveLength(2);
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
      expect(features).toHaveLength(7);
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
});
