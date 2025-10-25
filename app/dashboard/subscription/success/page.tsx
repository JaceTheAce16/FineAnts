/**
 * Checkout Success Page
 * Displays success message after completing subscription purchase
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Verify the session exists (optional: could fetch session details from backend)
    if (!sessionId) {
      setError('No session ID found');
      setLoading(false);
      return;
    }

    // Give webhooks a moment to process
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [sessionId]);

  if (error) {
    return (
      <div className="container mx-auto py-12 max-w-2xl">
        <Card className="p-8 text-center">
          <div className="text-red-500 mb-4">
            <p className="text-lg font-semibold">Something went wrong</p>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
          </div>
          <Button onClick={() => router.push('/dashboard')}>
            Return to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-12 max-w-2xl">
        <Card className="p-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg font-semibold">Processing your subscription...</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please wait while we confirm your payment
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 max-w-2xl">
      <Card className="p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to Premium!</h1>
          <p className="text-muted-foreground">
            Your subscription has been successfully activated
          </p>
        </div>

        <div className="bg-muted rounded-lg p-6 mb-6">
          <h2 className="font-semibold mb-3">What's Next?</h2>
          <ul className="text-left space-y-2 text-sm">
            <li className="flex items-start">
              <Check className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
              <span>You now have access to all premium features</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
              <span>A confirmation email has been sent to your inbox</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
              <span>You can manage your subscription anytime in settings</span>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full"
            size="lg"
            onClick={() => router.push('/dashboard')}
          >
            Go to Dashboard
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/dashboard/subscription')}
          >
            View Subscription Details
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Session ID: {sessionId}
        </p>
      </Card>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-12 max-w-2xl">
        <Card className="p-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
        </Card>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
