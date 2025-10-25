/**
 * Feature Gate Component
 * Conditionally renders content based on subscription tier
 */

'use client';

import { useFeatureAccess } from '@/lib/subscription/hooks';
import type { FeatureName } from '@/lib/subscription/access-control';
import { Button } from '@/components/ui/button';
import { Lock, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface FeatureGateProps {
  feature: FeatureName;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

/**
 * FeatureGate component
 * Shows children if user has access, fallback or upgrade prompt if not
 *
 * @example
 * <FeatureGate feature="advanced_budgeting">
 *   <AdvancedBudgetingTools />
 * </FeatureGate>
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}: FeatureGateProps) {
  const { hasAccess, loading } = useFeatureAccess(feature);
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showUpgradePrompt) {
      return (
        <div className="text-center p-8 border-2 border-dashed rounded-lg bg-muted/50">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Premium Feature</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Upgrade your subscription to unlock this feature and gain access to advanced tools
          </p>
          <Button onClick={() => router.push('/dashboard/subscription')}>
            View Plans
          </Button>
        </div>
      );
    }

    return null;
  }

  return <>{children}</>;
}

/**
 * Inline feature gate that doesn't show upgrade prompt
 * Useful for hiding/showing smaller UI elements
 */
export function InlineFeatureGate({
  feature,
  children,
}: {
  feature: FeatureName;
  children: React.ReactNode;
}) {
  const { hasAccess, loading } = useFeatureAccess(feature);

  if (loading || !hasAccess) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Badge to show which tier a feature requires
 */
export function FeatureBadge({
  requiredTier,
}: {
  requiredTier: 'basic' | 'premium';
}) {
  const badgeStyles = {
    basic: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    premium: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeStyles[requiredTier]}`}
    >
      {requiredTier === 'basic' ? 'Basic' : 'Premium'}
    </span>
  );
}
