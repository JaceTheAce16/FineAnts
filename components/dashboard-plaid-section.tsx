'use client';

/**
 * Dashboard Plaid Section
 * Client component wrapper for interactive Plaid buttons
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function DashboardPlaidSection() {
  return (
    <div className="relative">
      <Button disabled variant="outline" className="relative">
        Connect with Plaid
        <Badge variant="secondary" className="ml-2 text-xs">Coming Soon</Badge>
      </Button>
    </div>
  );
}

export function DashboardPlaidGetStarted() {
  return (
    <div className="relative">
      <Button disabled size="sm" variant="outline" className="relative">
        Get Started
        <Badge variant="secondary" className="ml-2 text-xs">Coming Soon</Badge>
      </Button>
    </div>
  );
}
