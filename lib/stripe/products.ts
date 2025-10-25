/**
 * Stripe Subscription Plans Configuration
 * Defines the available subscription tiers and their features
 */

import { stripeConfig } from './config';

export const SUBSCRIPTION_PLANS = {
  basic: {
    name: 'Basic Plan',
    priceId: stripeConfig.basicPriceId!,
    amount: 999, // $9.99 in cents
    interval: 'month' as const,
    features: [
      'Up to 5 connected accounts',
      'Basic budgeting tools',
      'Transaction tracking',
      'Monthly reports',
      'Email support',
    ],
    limits: {
      accounts: 5,
      exports: 10, // per month
    },
  },
  premium: {
    name: 'Premium Plan',
    priceId: stripeConfig.premiumPriceId!,
    amount: 1999, // $19.99 in cents
    interval: 'month' as const,
    features: [
      'Unlimited connected accounts',
      'Advanced budgeting & forecasting',
      'Investment tracking',
      'Debt optimization',
      'Retirement planning',
      'Real-time insights',
      'Priority support',
      'Unlimited exports to Excel/CSV',
    ],
    limits: {
      accounts: Infinity,
      exports: Infinity,
    },
  },
} as const;

export type PlanType = keyof typeof SUBSCRIPTION_PLANS;

/**
 * Get plan configuration by plan type
 */
export function getPlan(planType: PlanType) {
  return SUBSCRIPTION_PLANS[planType];
}

/**
 * Get plan type from Stripe price ID
 */
export function getPlanTypeFromPriceId(priceId: string): PlanType | null {
  if (priceId === SUBSCRIPTION_PLANS.basic.priceId) {
    return 'basic';
  }
  if (priceId === SUBSCRIPTION_PLANS.premium.priceId) {
    return 'premium';
  }
  return null;
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

/**
 * Check if a plan type is valid
 */
export function isValidPlanType(planType: string): planType is PlanType {
  return planType === 'basic' || planType === 'premium';
}

/**
 * Get all available plans as an array
 */
export function getAllPlans() {
  return Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => ({
    type: key as PlanType,
    ...plan,
  }));
}
