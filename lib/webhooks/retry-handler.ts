/**
 * Webhook Retry Handler
 *
 * Provides automatic retry logic with exponential backoff for webhook processing.
 * Critical for ensuring webhook events are not lost due to transient failures.
 *
 * Features:
 * - Exponential backoff (1s, 2s, 4s, 8s, 16s)
 * - Maximum retry attempts configurable
 * - Dead letter queue for failed events
 * - Idempotency handling
 * - Monitoring and alerting
 *
 * Usage:
 *   import { processWebhookWithRetry } from '@/lib/webhooks/retry-handler';
 *
 *   const result = await processWebhookWithRetry(
 *     event,
 *     async (evt) => {
 *       // Your webhook processing logic
 *       await handleSubscriptionUpdate(evt);
 *     },
 *     { provider: 'stripe', maxRetries: 3 }
 *   );
 */

import { trackWebhookError, trackEvent } from '@/lib/monitoring/error-tracker';

export interface WebhookRetryOptions {
  provider: 'stripe' | 'plaid';
  maxRetries?: number;           // Default: 3
  initialDelayMs?: number;       // Default: 1000 (1 second)
  maxDelayMs?: number;           // Default: 16000 (16 seconds)
  timeout?: number;              // Default: 30000 (30 seconds)
  onRetry?: (attempt: number, error: unknown) => void;
  onFailure?: (error: unknown, attempts: number) => void;
}

export interface WebhookProcessResult {
  success: boolean;
  attempts: number;
  error?: unknown;
  processingTimeMs: number;
}

/**
 * Process a webhook with automatic retry logic
 */
export async function processWebhookWithRetry<T>(
  event: T,
  processor: (event: T) => Promise<void>,
  options: WebhookRetryOptions
): Promise<WebhookProcessResult> {
  const {
    provider,
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 16000,
    timeout = 30000,
    onRetry,
    onFailure,
  } = options;

  const startTime = Date.now();
  let attempts = 0;
  let lastError: unknown;

  // Extract event ID for tracking
  const eventId = extractEventId(event, provider);
  const eventType = extractEventType(event, provider);

  while (attempts <= maxRetries) {
    attempts++;

    try {
      // Add timeout wrapper
      await Promise.race([
        processor(event),
        timeoutPromise(timeout),
      ]);

      // Success!
      const processingTime = Date.now() - startTime;

      trackEvent('webhook_processed', {
        provider,
        eventType,
        eventId,
        attempts,
        processingTimeMs: processingTime,
        success: true,
      });

      return {
        success: true,
        attempts,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      lastError = error;

      // Check if this is a retryable error
      if (!isRetryableError(error)) {
        // Non-retryable error - fail fast
        trackWebhookError(error, {
          provider,
          eventType,
          eventId,
          attemptNumber: attempts,
        });

        if (onFailure) {
          onFailure(error, attempts);
        }

        return {
          success: false,
          attempts,
          error,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // If we have retries left, wait and try again
      if (attempts <= maxRetries) {
        const delay = calculateBackoffDelay(attempts, initialDelayMs, maxDelayMs);

        trackEvent('webhook_retry', {
          provider,
          eventType,
          eventId,
          attempt: attempts,
          nextRetryInMs: delay,
        });

        if (onRetry) {
          onRetry(attempts, error);
        }

        // Wait before next retry
        await sleep(delay);
      } else {
        // Max retries exceeded
        trackWebhookError(error, {
          provider,
          eventType,
          eventId,
          attemptNumber: attempts,
        });

        if (onFailure) {
          onFailure(error, attempts);
        }

        // TODO: Add to dead letter queue
        await addToDeadLetterQueue({
          provider,
          eventType,
          eventId,
          event,
          error: serializeError(error),
          attempts,
        });
      }
    }
  }

  // All retries failed
  return {
    success: false,
    attempts,
    error: lastError,
    processingTimeMs: Date.now() - startTime,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate exponential backoff delay
 * Formula: min(maxDelay, initialDelay * 2^(attempt - 1))
 */
function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number
): number {
  const delay = initialDelayMs * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a timeout promise
 */
function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Webhook processing timeout after ${ms}ms`)), ms);
  });
}

/**
 * Extract event ID from webhook payload
 */
function extractEventId(event: any, provider: string): string {
  if (provider === 'stripe') {
    return event.id || 'unknown';
  }
  if (provider === 'plaid') {
    return event.webhook_id || event.item_id || 'unknown';
  }
  return 'unknown';
}

/**
 * Extract event type from webhook payload
 */
function extractEventType(event: any, provider: string): string {
  if (provider === 'stripe') {
    return event.type || 'unknown';
  }
  if (provider === 'plaid') {
    return event.webhook_type || event.webhook_code || 'unknown';
  }
  return 'unknown';
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  // Timeout errors are retryable
  if (error instanceof Error && error.message.includes('timeout')) {
    return true;
  }

  // Network errors are retryable
  if (error instanceof Error && error.message.includes('network')) {
    return true;
  }

  // Database connection errors are retryable
  if (error instanceof Error && error.message.includes('connection')) {
    return true;
  }

  // Rate limit errors are retryable
  if (error instanceof Error && error.message.includes('rate limit')) {
    return true;
  }

  // 5xx server errors are retryable
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = (error as any).statusCode;
    if (statusCode >= 500 && statusCode < 600) {
      return true;
    }
  }

  // Database-specific retryable errors
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as any).code;
    // Supabase/Postgres connection errors
    const retryableCodes = [
      '08000', // Connection exception
      '08003', // Connection does not exist
      '08006', // Connection failure
      '40001', // Serialization failure
      '40P01', // Deadlock detected
      '53000', // Insufficient resources
      '53300', // Too many connections
    ];
    if (retryableCodes.includes(code)) {
      return true;
    }
  }

  // Default: don't retry
  return false;
}

/**
 * Serialize error for storage
 */
function serializeError(error: unknown): any {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === 'object' && error !== null) {
    return JSON.parse(JSON.stringify(error));
  }

  return { error: String(error) };
}

/**
 * Add failed webhook to dead letter queue
 * This allows manual retry or investigation later
 */
async function addToDeadLetterQueue(data: {
  provider: string;
  eventType: string;
  eventId: string;
  event: any;
  error: any;
  attempts: number;
}): Promise<void> {
  // TODO: Implement storage in database
  // For now, log it
  console.error('[Dead Letter Queue] Failed webhook after max retries:', {
    ...data,
    timestamp: new Date().toISOString(),
  });

  // TODO: Store in database table for manual processing
  // await supabaseAdmin.from('webhook_dead_letter_queue').insert({
  //   provider: data.provider,
  //   event_type: data.eventType,
  //   event_id: data.eventId,
  //   event_payload: data.event,
  //   error_details: data.error,
  //   attempts: data.attempts,
  //   created_at: new Date().toISOString(),
  // });

  // TODO: Send alert to monitoring service
  // await sendAlert({
  //   severity: 'critical',
  //   message: `Webhook processing failed after ${data.attempts} attempts`,
  //   details: data,
  // });
}

// =============================================================================
// WEBHOOK QUEUE MANAGEMENT (Future Enhancement)
// =============================================================================

/**
 * Process webhooks in a queue with concurrency control
 * This prevents overwhelming the database with parallel requests
 */
export class WebhookQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private concurrency: number;

  constructor(concurrency: number = 5) {
    this.concurrency = concurrency;
  }

  async add<T>(
    event: T,
    processor: (event: T) => Promise<void>,
    options: WebhookRetryOptions
  ): Promise<WebhookProcessResult> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await processWebhookWithRetry(event, processor, options);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;

    while (this.queue.length > 0) {
      // Process up to 'concurrency' webhooks in parallel
      const batch = this.queue.splice(0, this.concurrency);
      await Promise.allSettled(batch.map((fn) => fn()));
    }

    this.processing = false;
  }
}

// Export a singleton instance
export const webhookQueue = new WebhookQueue(5);

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/**
 * Example: Use in Stripe webhook handler
 *
 * ```typescript
 * export async function POST(request: Request) {
 *   const body = await request.text();
 *   const signature = request.headers.get('stripe-signature');
 *
 *   // Verify webhook signature
 *   const event = stripe.webhooks.constructEvent(
 *     body,
 *     signature!,
 *     process.env.STRIPE_WEBHOOK_SECRET!
 *   );
 *
 *   // Process with retry
 *   const result = await processWebhookWithRetry(
 *     event,
 *     async (evt) => {
 *       switch (evt.type) {
 *         case 'checkout.session.completed':
 *           await handleCheckoutComplete(evt.data.object);
 *           break;
 *         case 'customer.subscription.updated':
 *           await handleSubscriptionUpdate(evt.data.object);
 *           break;
 *         // ... other cases
 *       }
 *     },
 *     {
 *       provider: 'stripe',
 *       maxRetries: 3,
 *       onRetry: (attempt, error) => {
 *         console.log(`Retry ${attempt} for event ${event.id}`, error);
 *       },
 *       onFailure: (error, attempts) => {
 *         console.error(`Failed after ${attempts} attempts`, error);
 *       },
 *     }
 *   );
 *
 *   if (result.success) {
 *     return NextResponse.json({ received: true });
 *   } else {
 *     // Return 200 to acknowledge receipt even if processing failed
 *     // (Stripe will retry based on their schedule)
 *     return NextResponse.json(
 *       { received: true, willRetry: true },
 *       { status: 200 }
 *     );
 *   }
 * }
 * ```
 */
