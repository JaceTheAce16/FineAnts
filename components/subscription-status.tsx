/**
 * Subscription Status Component
 * Displays current subscription status and billing information
 */

'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Crown, ArrowUpRight, Loader2, Calendar, CreditCard } from 'lucide-react';
import type { Subscription, SubscriptionTier } from '@/lib/types/database';
import { useRouter } from 'next/navigation';

export function SubscriptionStatus() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);
  const [managingBilling, setManagingBilling] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadSubscription();
  }, []);

  async function loadSubscription() {
    try {
      const supabase = createClient();

      // Get user's subscription tier
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Get profile with tier
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();

      setTier(profile?.subscription_tier || 'free');

      // Get active subscription details if exists
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      setSubscription(sub);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleManageBilling() {
    setManagingBilling(true);

    try {
      const response = await fetch('/api/portal', { method: 'POST' });
      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No portal URL received');
        setManagingBilling(false);
      }
    } catch (error) {
      console.error('Error accessing billing portal:', error);
      setManagingBilling(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  // Free tier - show upgrade prompt
  if (tier === 'free' || !subscription) {
    return (
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg">Free Plan</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Upgrade to unlock premium features and take full control of your finances
            </p>
            <Button
              onClick={() => router.push('/dashboard/subscription')}
              className="gap-2"
            >
              <Crown className="h-4 w-4" />
              Upgrade to Premium
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Paid subscription - show status and manage billing
  const tierDisplayName = tier.charAt(0).toUpperCase() + tier.slice(1);
  const nextBillingDate = new Date(subscription.current_period_end).toLocaleDateString(
    'en-US',
    { month: 'long', day: 'numeric', year: 'numeric' }
  );

  const isCanceling = subscription.cancel_at_period_end;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{tierDisplayName} Plan</h3>
            <p className="text-xs text-muted-foreground">
              {subscription.status === 'active' && !isCanceling && 'Active subscription'}
              {subscription.status === 'active' && isCanceling && 'Cancels at period end'}
              {subscription.status === 'past_due' && 'Payment past due'}
              {subscription.status === 'trialing' && 'Trial period'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {subscription.status === 'active' && !isCanceling && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Next billing:</span>
            <span className="font-medium">{nextBillingDate}</span>
          </div>
        )}

        {isCanceling && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Access until:</span>
            <span className="font-medium">{nextBillingDate}</span>
          </div>
        )}

        {subscription.status === 'past_due' && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Your payment is past due. Please update your payment method to continue your subscription.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleManageBilling}
          disabled={managingBilling}
          className="gap-2"
        >
          {managingBilling ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Manage Billing
            </>
          )}
        </Button>

        {tier !== 'premium' && (
          <Button
            onClick={() => router.push('/dashboard/subscription')}
            className="gap-2"
          >
            Upgrade
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}
