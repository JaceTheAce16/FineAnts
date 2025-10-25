/**
 * Subscription Pricing Page
 * Displays available subscription plans and allows users to subscribe
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Loader2 } from 'lucide-react';
import { SUBSCRIPTION_PLANS, formatPrice, type PlanType } from '@/lib/stripe/products';
import { ErrorAlert } from '@/components/error-alert';
import type { ErrorResponse } from '@/lib/stripe/error-handler';

export default function SubscriptionPage() {
  const [loading, setLoading] = useState<PlanType | null>(null);
  const [error, setError] = useState<string | ErrorResponse | null>(null);

  async function handleSubscribe(planType: PlanType, priceId: string) {
    setLoading(planType);
    setError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, planType }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Use full error response if available, otherwise just the message
        setError(data.severity ? data : (data.error || 'Failed to start checkout'));
        setLoading(null);
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('No checkout URL received');
        setLoading(null);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Failed to start checkout. Please try again.');
      setLoading(null);
    }
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Unlock powerful financial tools and insights to take control of your finances
        </p>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto mb-6">
          <ErrorAlert error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => {
          const planType = key as PlanType;
          const isPopular = planType === 'premium';

          return (
            <Card
              key={key}
              className={`p-8 relative ${
                isPopular ? 'border-2 border-primary shadow-lg' : ''
              }`}
            >
              {isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
                <div className="flex items-baseline mb-4">
                  <span className="text-4xl font-bold">
                    {formatPrice(plan.amount)}
                  </span>
                  <span className="text-muted-foreground ml-2">/{plan.interval}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                size="lg"
                onClick={() => handleSubscribe(planType, plan.priceId)}
                disabled={loading !== null}
                variant={isPopular ? 'default' : 'outline'}
              >
                {loading === planType ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Subscribe Now'
                )}
              </Button>

              {planType === 'basic' && (
                <p className="text-xs text-center text-muted-foreground mt-3">
                  Perfect for getting started
                </p>
              )}
              {planType === 'premium' && (
                <p className="text-xs text-center text-muted-foreground mt-3">
                  Best value for power users
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <div className="text-center mt-12 text-sm text-muted-foreground">
        <p>All plans include a secure payment process powered by Stripe</p>
        <p className="mt-2">Cancel anytime, no questions asked</p>
      </div>
    </div>
  );
}
