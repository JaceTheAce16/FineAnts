/**
 * Token Manager
 * Handles encryption, decryption, storage, and retrieval of Plaid access tokens
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { plaidConfig } from './config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16; // 16 bytes authentication tag

/**
 * Encrypt a Plaid access token using AES-256-GCM
 * @param token Plaintext token to encrypt
 * @returns Encrypted token in format: iv:authTag:encrypted
 */
export function encryptToken(token: string): string {
  if (!plaidConfig.encryptionKey) {
    throw new Error('PLAID_ENCRYPTION_KEY is not set');
  }

  // Generate random IV for each encryption
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher with encryption key and IV
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(plaidConfig.encryptionKey, 'hex'),
    iv
  );

  // Encrypt the token
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Return format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a Plaid access token using AES-256-GCM
 * @param encryptedToken Encrypted token in format: iv:authTag:encrypted
 * @returns Decrypted plaintext token
 */
export function decryptToken(encryptedToken: string): string {
  if (!plaidConfig.encryptionKey) {
    throw new Error('PLAID_ENCRYPTION_KEY is not set');
  }

  // Parse the encrypted token format
  const parts = encryptedToken.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format. Expected format: iv:authTag:encrypted');
  }

  const [ivHex, authTagHex, encrypted] = parts;

  // Convert hex strings back to buffers
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  // Validate buffer lengths
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length. Expected ${IV_LENGTH} bytes, got ${iv.length}`);
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length. Expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
  }

  // Create decipher
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(plaidConfig.encryptionKey, 'hex'),
    iv
  );

  // Set authentication tag
  decipher.setAuthTag(authTag);

  // Decrypt the token
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Create Supabase admin client (bypasses RLS)
 * Used for server-side operations like webhooks and token management
 */
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Store an encrypted Plaid access token
 * @param userId User ID
 * @param itemId Plaid item ID
 * @param accessToken Plaid access token (will be encrypted)
 * @param institutionId Institution ID
 * @param institutionName Institution name
 */
export async function storeAccessToken(
  userId: string,
  itemId: string,
  accessToken: string,
  institutionId: string,
  institutionName: string
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();

  // Encrypt the access token
  const encryptedToken = encryptToken(accessToken);

  // Upsert into plaid_items table
  const { error } = await supabaseAdmin.from('plaid_items').upsert(
    {
      user_id: userId,
      item_id: itemId,
      access_token: encryptedToken,
      institution_id: institutionId,
      institution_name: institutionName,
      status: 'active',
      last_sync: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'item_id',
    }
  );

  if (error) {
    throw new Error(`Failed to store access token: ${error.message}`);
  }
}

/**
 * Retrieve and decrypt a Plaid access token by item ID
 * @param itemId Plaid item ID
 * @returns Decrypted access token or null if not found
 */
export async function getAccessToken(itemId: string): Promise<string | null> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('plaid_items')
    .select('access_token')
    .eq('item_id', itemId)
    .eq('status', 'active')
    .single();

  if (error || !data) {
    return null;
  }

  // Decrypt and return the token
  return decryptToken(data.access_token);
}

/**
 * Retrieve all active access tokens for a user
 * @param userId User ID
 * @returns Array of item IDs with decrypted access tokens
 */
export async function getUserAccessTokens(userId: string): Promise<
  Array<{
    itemId: string;
    accessToken: string;
    institutionId: string;
    institutionName: string;
  }>
> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('plaid_items')
    .select('item_id, access_token, institution_id, institution_name')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error || !data) {
    return [];
  }

  // Decrypt all tokens
  return data.map((item) => ({
    itemId: item.item_id,
    accessToken: decryptToken(item.access_token),
    institutionId: item.institution_id,
    institutionName: item.institution_name,
  }));
}

/**
 * Revoke (mark as revoked) a Plaid access token
 * @param itemId Plaid item ID
 */
export async function revokeAccessToken(itemId: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin
    .from('plaid_items')
    .update({
      status: 'revoked',
      updated_at: new Date().toISOString(),
    })
    .eq('item_id', itemId);

  if (error) {
    throw new Error(`Failed to revoke access token: ${error.message}`);
  }
}
