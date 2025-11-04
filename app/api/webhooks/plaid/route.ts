/**
 * Plaid Webhook Handler
 * Processes webhook events from Plaid to keep account data synchronized
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncUserTransactions } from '@/lib/plaid/sync-service';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Create Supabase admin client with service role key for webhook operations
// This bypasses Row Level Security policies
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Plaid webhook payload interface
 */
interface PlaidWebhook {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: {
    error_code: string;
    error_message: string;
  };
  new_transactions?: number;
  removed_transactions?: string[];
}

/**
 * Handle TRANSACTIONS webhook events
 */
async function handleTransactionsWebhook(webhook: PlaidWebhook, userId: string) {
  const { webhook_code } = webhook;

  switch (webhook_code) {
    case 'INITIAL_UPDATE':
    case 'HISTORICAL_UPDATE':
    case 'DEFAULT_UPDATE':
      // Trigger transaction sync for the user
      try {
        await syncUserTransactions(userId);
      } catch (error) {
        console.error('Error syncing transactions from webhook:', error);
      }
      break;

    case 'TRANSACTIONS_REMOVED':
      // Handle transaction removal
      // The sync service will handle this during the next sync
      console.log(`Transactions removed for item ${webhook.item_id}`);
      break;

    default:
      console.log(`Unhandled transaction webhook code: ${webhook_code}`);
  }
}

/**
 * Handle ITEM webhook events
 */
async function handleItemWebhook(webhook: PlaidWebhook, userId: string) {
  const { webhook_code, error } = webhook;

  switch (webhook_code) {
    case 'ERROR':
      // Update item status to error
      await supabaseAdmin
        .from('plaid_items')
        .update({
          status: 'error',
          error_code: error?.error_code || null,
          error_message: error?.error_message || null,
          updated_at: new Date().toISOString(),
        })
        .eq('item_id', webhook.item_id);

      console.log(`Item ${webhook.item_id} marked as error: ${error?.error_code}`);
      break;

    case 'PENDING_EXPIRATION':
      // Update item status to pending_expiration
      await supabaseAdmin
        .from('plaid_items')
        .update({
          status: 'pending_expiration',
          updated_at: new Date().toISOString(),
        })
        .eq('item_id', webhook.item_id);

      console.log(`Item ${webhook.item_id} pending expiration`);
      break;

    default:
      console.log(`Unhandled item webhook code: ${webhook_code}`);
  }
}

/**
 * Verify webhook signature using JWT
 *
 * Plaid webhooks include a JWT in the Plaid-Verification header that should be verified
 * to ensure the webhook came from Plaid and hasn't been tampered with.
 *
 * @param request NextRequest object containing the Plaid-Verification header
 * @param body Raw request body string
 * @returns boolean indicating if signature is valid
 */
function verifyWebhookSignature(request: NextRequest, body: string): boolean {
  try {
    // Skip verification in development if no webhook key is configured
    const webhookVerificationKey = process.env.PLAID_WEBHOOK_VERIFICATION_KEY;

    if (!webhookVerificationKey) {
      if (process.env.NODE_ENV === 'production') {
        console.error('PLAID_WEBHOOK_VERIFICATION_KEY not configured in production!');
        return false;
      }
      // Allow webhooks in development without verification
      console.log('Webhook signature verification skipped (no key configured)');
      return true;
    }

    // Extract JWT from Plaid-Verification header
    const signedJwt = request.headers.get('plaid-verification');

    if (!signedJwt) {
      console.error('Missing Plaid-Verification header');
      return false;
    }

    // Verify and decode the JWT
    let decodedToken: any;
    try {
      // Ensure the key is properly formatted
      const formattedKey = webhookVerificationKey.trim();

      decodedToken = jwt.verify(signedJwt, formattedKey, {
        algorithms: ['ES256'], // Plaid uses ES256 algorithm
      });
    } catch (error) {
      console.error('JWT verification failed:', error);
      return false;
    }

    // Verify the request body SHA256 hash matches the JWT claim
    const bodyHash = crypto.createHash('sha256').update(body).digest('hex');

    if (decodedToken.request_body_sha256 !== bodyHash) {
      console.error('Request body hash mismatch');
      return false;
    }

    // Verify the timestamp is recent (within 5 minutes) to prevent replay attacks
    const now = Math.floor(Date.now() / 1000);
    const tokenAge = now - decodedToken.iat;
    const MAX_TOKEN_AGE = 5 * 60; // 5 minutes

    if (tokenAge > MAX_TOKEN_AGE) {
      console.error(`Webhook token too old: ${tokenAge} seconds`);
      return false;
    }

    // All checks passed
    return true;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * POST /api/webhooks/plaid
 * Handle incoming webhook events from Plaid
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();

    // Verify webhook signature
    if (!verifyWebhookSignature(request, body)) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse webhook payload
    const webhook: PlaidWebhook = JSON.parse(body);

    // Look up user_id from item_id
    const { data: itemData, error: itemError } = await supabaseAdmin
      .from('plaid_items')
      .select('user_id')
      .eq('item_id', webhook.item_id)
      .single();

    if (itemError || !itemData) {
      console.error(`Item not found: ${webhook.item_id}`);
      // Still return 200 to acknowledge receipt
      return NextResponse.json({ received: true });
    }

    const userId = itemData.user_id;

    // Handle different webhook types
    switch (webhook.webhook_type) {
      case 'TRANSACTIONS':
        await handleTransactionsWebhook(webhook, userId);
        break;

      case 'ITEM':
        await handleItemWebhook(webhook, userId);
        break;

      default:
        console.log(`Unhandled webhook type: ${webhook.webhook_type}`);
    }

    // Log webhook event to database
    await supabaseAdmin.from('webhook_events').insert({
      event_type: 'plaid_webhook',
      event_data: webhook,
      processed: true,
      processed_at: new Date().toISOString(),
    });

    // Always return 200 OK to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);

    // Still return 200 to prevent Plaid from retrying
    // Log the error for manual investigation
    return NextResponse.json({ received: true });
  }
}
