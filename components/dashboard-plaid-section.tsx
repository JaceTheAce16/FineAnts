'use client';

/**
 * Dashboard Plaid Section
 * Client component wrapper for interactive Plaid buttons
 */

import { PlaidLinkButton } from "@/components/plaid-link-button";

export function DashboardPlaidSection() {
  const handlePlaidSuccess = () => {
    window.location.reload();
  };

  const handlePlaidError = (error: string) => {
    console.error('Plaid connection error:', error);
  };

  return (
    <PlaidLinkButton
      onSuccess={handlePlaidSuccess}
      onError={handlePlaidError}
    >
      Connect with Plaid
    </PlaidLinkButton>
  );
}

export function DashboardPlaidGetStarted() {
  const handlePlaidSuccess = () => {
    window.location.reload();
  };

  return (
    <PlaidLinkButton
      onSuccess={handlePlaidSuccess}
      size="sm"
      showLimitInfo={false}
    >
      Get Started
    </PlaidLinkButton>
  );
}
