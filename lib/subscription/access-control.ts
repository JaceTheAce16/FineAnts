/**
 * Feature Access Control
 * Manages feature access based on user subscription tier
 */

import { createClient } from '@/lib/supabase/server';
import type { SubscriptionTier } from '@/lib/types/database';

/**
 * Available feature flags that can be gated by subscription tier
 */
export type FeatureName =
  | 'unlimited_accounts'
  | 'advanced_budgeting'
  | 'investment_tracking'
  | 'debt_optimization'
  | 'retirement_planning'
  | 'export_data'
  | 'priority_support'
  | 'plaid_integration';

/**
 * Feature access matrix
 * Maps subscription tiers to the features they can access
 */
const FEATURE_ACCESS: Record<SubscriptionTier, FeatureName[]> = {
  free: [],
  basic: ['advanced_budgeting', 'export_data', 'plaid_integration'],
  premium: [
    'unlimited_accounts',
    'advanced_budgeting',
    'investment_tracking',
    'debt_optimization',
    'retirement_planning',
    'export_data',
    'priority_support',
    'plaid_integration',
  ],
};

/**
 * Account limits by tier
 */
const ACCOUNT_LIMITS: Record<SubscriptionTier, number> = {
  free: 2,
  basic: 5,
  premium: Infinity,
};

/**
 * Export limits per month by tier
 */
const EXPORT_LIMITS: Record<SubscriptionTier, number> = {
  free: 0,
  basic: 10,
  premium: Infinity,
};

/**
 * Plaid account limits by tier
 */
const PLAID_ACCOUNT_LIMITS: Record<SubscriptionTier, number> = {
  free: 0,
  basic: 5,
  premium: 999,
};

/**
 * Check if a user has access to a specific feature
 * Server-side function that queries the database
 */
export async function checkFeatureAccess(
  featureName: FeatureName
): Promise<{ hasAccess: boolean; tier: SubscriptionTier }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { hasAccess: false, tier: 'free' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const tier: SubscriptionTier = profile?.subscription_tier || 'free';
    const hasAccess = FEATURE_ACCESS[tier].includes(featureName);

    return { hasAccess, tier };
  } catch (error) {
    console.error('Error checking feature access:', error);
    // Fail closed - deny access on error
    return { hasAccess: false, tier: 'free' };
  }
}

/**
 * Require feature access - throws error if access denied
 * Use this in API routes and server actions
 */
export async function requireFeatureAccess(
  featureName: FeatureName
): Promise<true> {
  const { hasAccess, tier } = await checkFeatureAccess(featureName);

  if (!hasAccess) {
    const requiredTier = getRequiredTierForFeature(featureName);
    throw new Error(
      `Feature "${featureName}" requires ${requiredTier} subscription tier. Current tier: ${tier}`
    );
  }

  return true;
}

/**
 * Get the minimum tier required for a feature
 */
export function getRequiredTierForFeature(
  featureName: FeatureName
): SubscriptionTier {
  if (FEATURE_ACCESS.basic.includes(featureName)) {
    return 'basic';
  }
  if (FEATURE_ACCESS.premium.includes(featureName)) {
    return 'premium';
  }
  return 'free';
}

/**
 * Get account limit for a tier
 */
export function getAccountLimit(tier: SubscriptionTier): number {
  return ACCOUNT_LIMITS[tier];
}

/**
 * Get export limit for a tier
 */
export function getExportLimit(tier: SubscriptionTier): number {
  return EXPORT_LIMITS[tier];
}

/**
 * Check if user can add more accounts
 */
export async function canAddAccount(): Promise<{
  canAdd: boolean;
  current: number;
  limit: number;
  tier: SubscriptionTier;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { canAdd: false, current: 0, limit: 0, tier: 'free' };
    }

    // Get user's subscription tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const tier: SubscriptionTier = profile?.subscription_tier || 'free';
    const limit = ACCOUNT_LIMITS[tier];

    // Count user's accounts
    const { count } = await supabase
      .from('financial_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const current = count || 0;
    const canAdd = current < limit;

    return { canAdd, current, limit, tier };
  } catch (error) {
    console.error('Error checking account limit:', error);
    return { canAdd: false, current: 0, limit: 0, tier: 'free' };
  }
}

/**
 * Get all features available for a tier
 */
export function getFeaturesForTier(tier: SubscriptionTier): FeatureName[] {
  return FEATURE_ACCESS[tier];
}

/**
 * Feature descriptions for UI display
 */
export const FEATURE_DESCRIPTIONS: Record<FeatureName, string> = {
  unlimited_accounts:
    'Connect unlimited bank accounts, credit cards, and investment accounts',
  advanced_budgeting:
    'Create advanced budgets with forecasting and spending insights',
  investment_tracking: 'Track investment portfolios and performance',
  debt_optimization: 'Get personalized debt payoff strategies',
  retirement_planning: 'Plan and track your retirement savings goals',
  export_data: 'Export your financial data to Excel and CSV formats',
  priority_support: 'Get priority email and chat support',
  plaid_integration: 'Automatically sync transactions from your bank accounts',
};

/**
 * Check if user can add more Plaid-connected accounts
 */
export async function checkPlaidAccountLimit(): Promise<{
  canAddMore: boolean;
  current: number;
  limit: number;
  tier: SubscriptionTier;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { canAddMore: false, current: 0, limit: 0, tier: 'free' };
    }

    // Get user's subscription tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const tier: SubscriptionTier = profile?.subscription_tier || 'free';
    const limit = PLAID_ACCOUNT_LIMITS[tier];

    // Count user's Plaid items (not individual accounts, but connected institutions)
    const { count } = await supabase
      .from('plaid_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['active', 'error', 'pending_expiration']);

    const current = count || 0;
    const canAddMore = current < limit;

    return { canAddMore, current, limit, tier };
  } catch (error) {
    console.error('Error checking Plaid account limit:', error);
    return { canAddMore: false, current: 0, limit: 0, tier: 'free' };
  }
}
