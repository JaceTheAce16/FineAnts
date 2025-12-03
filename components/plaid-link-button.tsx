/**
 * Plaid Link Button Component
 * Initiates Plaid Link flow to connect financial accounts
 */

'use client';

import { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import type { SubscriptionTier } from '@/lib/types/database';

interface PlaidLinkButtonProps {
  onSuccess: (syncId?: string) => void;  // Now receives optional syncId
  onError?: (error: string) => void;
  accessToken?: string; // For update mode
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children: React.ReactNode;
  disabled?: boolean;
  showLimitInfo?: boolean; // Whether to show account limit information
}

interface AccountLimitInfo {
  canAddMore: boolean;
  current: number;
  limit: number;
  tier: SubscriptionTier;
}

export function PlaidLinkButton({
  onSuccess,
  onError,
  accessToken,
  variant = 'default',
  size = 'default',
  children,
  disabled = false,
  showLimitInfo = true,
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [limitInfo, setLimitInfo] = useState<AccountLimitInfo | null>(null);
  const [checkingLimit, setCheckingLimit] = useState(true);

  // Configure Plaid Link
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      try {
        const response = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicToken,
            institutionId: metadata.institution?.institution_id,
            institutionName: metadata.institution?.name,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to connect account');
        }

        // Parse response to get syncId
        const data = await response.json();

        // Call success callback with syncId
        // syncId is used to poll for background sync progress
        onSuccess(data.syncId);
      } catch (error) {
        console.error('Error exchanging token:', error);
        if (onError) {
          onError(error instanceof Error ? error.message : 'Failed to connect account');
        }
      }
    },
    onExit: (err, metadata) => {
      // User closed Link modal
      if (err) {
        console.error('Plaid Link error:', err);
        if (onError) {
          onError('Connection cancelled or failed. Please try again.');
        }
      }
      setLoading(false);
    },
  });

  // Check account limit on mount (skip for update mode)
  useEffect(() => {
    if (accessToken) {
      // In update mode, skip limit check
      setCheckingLimit(false);
      setLimitInfo({ canAddMore: true, current: 0, limit: 0, tier: 'free' });
      return;
    }

    const checkLimit = async () => {
      try {
        const response = await fetch('/api/plaid/account-limit');
        if (response.ok) {
          const data = await response.json();
          setLimitInfo(data);
        }
      } catch (error) {
        console.error('Error checking account limit:', error);
      } finally {
        setCheckingLimit(false);
      }
    };

    checkLimit();
  }, [accessToken]);

  // Open Plaid Link when ready
  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  const handleClick = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });

      if (!response.ok) {
        throw new Error('Failed to create link token');
      }

      const data = await response.json();
      setLinkToken(data.linkToken);
    } catch (error) {
      console.error('Error creating link token:', error);
      setLoading(false);

      if (onError) {
        onError('Failed to initialize account connection. Please try again.');
      }
    }
  };

  const isButtonDisabled = loading || disabled || checkingLimit || Boolean(limitInfo && !limitInfo.canAddMore);

  const getUpgradeMessage = () => {
    if (!limitInfo || limitInfo.canAddMore) return null;

    if (limitInfo.tier === 'free') {
      return 'Upgrade to Basic or Premium to connect bank accounts with Plaid.';
    }

    if (limitInfo.tier === 'basic') {
      return `You've reached your limit of ${limitInfo.limit} connected accounts. Upgrade to Premium for up to 999 accounts.`;
    }

    return `You've reached your account limit of ${limitInfo.limit} accounts.`;
  };

  return (
    <div className="space-y-3">
      {/* Account limit reached warning */}
      {limitInfo && !limitInfo.canAddMore && !accessToken && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {getUpgradeMessage()}
          </AlertDescription>
        </Alert>
      )}

      {/* Account limit info */}
      {showLimitInfo && limitInfo && !accessToken && limitInfo.limit > 0 && (
        <div className="text-sm text-muted-foreground">
          Connected accounts: {limitInfo.current} / {limitInfo.limit}
        </div>
      )}

      <Button
        onClick={handleClick}
        disabled={isButtonDisabled}
        variant={variant}
        size={size}
      >
        {checkingLimit ? 'Checking...' : loading ? 'Loading...' : children}
      </Button>
    </div>
  );
}
