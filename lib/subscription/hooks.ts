/**
 * Client-side hooks for feature access control
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SubscriptionTier } from '@/lib/types/database';
import type { FeatureName } from './access-control';

/**
 * Hook to check feature access on the client side
 * Note: This should NOT be used for security - always verify on server
 * Use this only for UI conditional rendering
 */
export function useFeatureAccess(featureName: FeatureName) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<SubscriptionTier>('free');

  useEffect(() => {
    async function checkAccess() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setHasAccess(false);
          setTier('free');
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single();

        const userTier: SubscriptionTier = profile?.subscription_tier || 'free';
        setTier(userTier);

        // Feature access matrix (must match server-side)
        const featureAccess: Record<SubscriptionTier, FeatureName[]> = {
          free: [],
          basic: ['advanced_budgeting', 'export_data'],
          premium: [
            'unlimited_accounts',
            'advanced_budgeting',
            'investment_tracking',
            'debt_optimization',
            'retirement_planning',
            'export_data',
            'priority_support',
          ],
        };

        const access = featureAccess[userTier].includes(featureName);
        setHasAccess(access);
      } catch (error) {
        console.error('Error checking feature access:', error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [featureName]);

  return { hasAccess, loading, tier };
}

/**
 * Hook to get the current user's subscription tier
 */
export function useSubscriptionTier() {
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTier() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setTier('free');
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single();

        setTier(profile?.subscription_tier || 'free');
      } catch (error) {
        console.error('Error loading subscription tier:', error);
        setTier('free');
      } finally {
        setLoading(false);
      }
    }

    loadTier();
  }, []);

  return { tier, loading };
}

/**
 * Hook to check account limits
 */
export function useAccountLimits() {
  const [canAdd, setCanAdd] = useState(false);
  const [current, setCurrent] = useState(0);
  const [limit, setLimit] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLimits() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        // Get tier
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single();

        const tier: SubscriptionTier = profile?.subscription_tier || 'free';

        // Define limits
        const limits = {
          free: 2,
          basic: 5,
          premium: Infinity,
        };

        const accountLimit = limits[tier];

        // Count accounts
        const { count } = await supabase
          .from('financial_accounts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        const currentCount = count || 0;
        setCurrent(currentCount);
        setLimit(accountLimit);
        setCanAdd(currentCount < accountLimit);
      } catch (error) {
        console.error('Error loading account limits:', error);
      } finally {
        setLoading(false);
      }
    }

    loadLimits();
  }, []);

  return { canAdd, current, limit, loading };
}
