/**
 * Tests for Stripe Products Configuration
 */

import {
  SUBSCRIPTION_PLANS,
  getPlan,
  getPlanTypeFromPriceId,
  formatPrice,
  isValidPlanType,
  getAllPlans,
} from '@/lib/stripe/products';

describe('Subscription Plans', () => {
  it('should have basic and premium plans defined', () => {
    expect(SUBSCRIPTION_PLANS.basic).toBeDefined();
    expect(SUBSCRIPTION_PLANS.premium).toBeDefined();
  });

  it('should have correct plan structure', () => {
    const basicPlan = SUBSCRIPTION_PLANS.basic;
    expect(basicPlan.name).toBe('Basic Plan');
    expect(basicPlan.amount).toBe(999);
    expect(basicPlan.interval).toBe('month');
    expect(Array.isArray(basicPlan.features)).toBe(true);
    expect(basicPlan.features.length).toBeGreaterThan(0);
  });

  it('should have different prices for basic and premium', () => {
    expect(SUBSCRIPTION_PLANS.basic.amount).toBeLessThan(
      SUBSCRIPTION_PLANS.premium.amount
    );
  });

  it('should get plan by type', () => {
    const basicPlan = getPlan('basic');
    expect(basicPlan.name).toBe('Basic Plan');

    const premiumPlan = getPlan('premium');
    expect(premiumPlan.name).toBe('Premium Plan');
  });

  it('should format price correctly', () => {
    expect(formatPrice(999)).toBe('$9.99');
    expect(formatPrice(1999)).toBe('$19.99');
    expect(formatPrice(0)).toBe('$0.00');
  });

  it('should validate plan types', () => {
    expect(isValidPlanType('basic')).toBe(true);
    expect(isValidPlanType('premium')).toBe(true);
    expect(isValidPlanType('invalid')).toBe(false);
    expect(isValidPlanType('free')).toBe(false);
  });

  it('should get all plans as array', () => {
    const plans = getAllPlans();
    expect(plans).toHaveLength(2);
    expect(plans[0].type).toBe('basic');
    expect(plans[1].type).toBe('premium');
  });

  it('should have account limits defined', () => {
    expect(SUBSCRIPTION_PLANS.basic.limits.accounts).toBe(5);
    expect(SUBSCRIPTION_PLANS.premium.limits.accounts).toBe(Infinity);
  });
});
