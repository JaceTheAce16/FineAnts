# Security Guidelines

This document outlines security best practices for the FineAnts application.

## Environment Variables Security

### Critical Rules

1. **NEVER import server-side configs in client components**
   - Files marked with `'use client'` must ONLY import client-safe configurations
   - Server-side secrets (API keys, service role keys, webhook secrets) should NEVER be bundled into client code

2. **Use proper environment variable prefixes**
   - `NEXT_PUBLIC_*` - Safe to expose in browser (client-side code)
   - No prefix - Server-side only, NEVER exposed to browser

### Environment Variable Classification

#### ❌ Server-Side Only (NEVER expose to client)
- `STRIPE_SECRET_KEY` - Stripe secret API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key (bypasses RLS)
- `PLAID_SECRET_KEY` - Plaid secret API key
- `PLAID_ENCRYPTION_KEY` - Encryption key for storing Plaid tokens

#### ✅ Client-Safe (can be exposed publicly)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID` - Product price identifier
- `NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID` - Product price identifier
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (safe, RLS protected)
- `NEXT_PUBLIC_PLAID_CLIENT_ID` - Plaid client identifier
- `NEXT_PUBLIC_APP_URL` - Application URL

## Configuration File Structure

### ✅ Correct Pattern

```typescript
// lib/example/config.ts

// Server-side only - NEVER import this in client components!
export const serverConfig = {
  secretKey: process.env.SECRET_KEY,
  apiKey: process.env.API_KEY,
};

// Client-safe - OK to import in client components
export const publicConfig = {
  publicKey: process.env.NEXT_PUBLIC_PUBLIC_KEY,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
};
```

### ❌ Dangerous Pattern (Avoid This!)

```typescript
// lib/example/products.ts

// BAD: Importing server config in a file used by client components
import { serverConfig } from './config';

export const PRODUCTS = {
  basic: {
    priceId: serverConfig.priceId, // This will bundle server config into client!
  }
};
```

### ✅ Fixed Pattern

```typescript
// lib/example/products.ts

// GOOD: Directly use public environment variables
const PRICE_ID = process.env.NEXT_PUBLIC_PRICE_ID;

export const PRODUCTS = {
  basic: {
    priceId: PRICE_ID, // Safe for client components
  }
};
```

## Import Rules

### Server-Side Files (API routes, server components, lib utilities)
✅ CAN import: `lib/*/config.ts` (both server and public configs)
✅ CAN use: Any environment variable

### Client-Side Files (marked with 'use client')
✅ CAN import: Public configs only (e.g., `publicConfig`, `plaidPublicConfig`)
❌ NEVER import: Server configs (e.g., `stripeConfig`, `plaidConfig`)
✅ CAN use: Only `NEXT_PUBLIC_*` environment variables

## Security Checklist for Code Reviews

- [ ] Client components (`'use client'`) don't import server-side configs
- [ ] New environment variables use correct prefix (`NEXT_PUBLIC_` for client-safe)
- [ ] Sensitive keys are never hardcoded in source code
- [ ] `.env` files are in `.gitignore`
- [ ] Only `.env.local.example` with placeholder values is committed to git
- [ ] Server-side configs have clear security warnings in comments
- [ ] API keys and secrets are never logged or exposed in error messages

## Example Security Violations and Fixes

### Issue: Server Config Imported by Client Component

**Problem Found:**
```typescript
// lib/stripe/products.ts
import { stripeConfig } from './config'; // Contains STRIPE_SECRET_KEY!

export const PLANS = {
  basic: { priceId: stripeConfig.basicPriceId }
};

// app/pricing/page.tsx
'use client';
import { PLANS } from '@/lib/stripe/products'; // Bundles server secrets!
```

**Fix Applied:**
```typescript
// lib/stripe/products.ts
// No server config import!
const BASIC_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID;

export const PLANS = {
  basic: { priceId: BASIC_PRICE_ID }
};

// app/pricing/page.tsx
'use client';
import { PLANS } from '@/lib/stripe/products'; // Now safe!
```

## Rotating Compromised Keys

If a secret key is accidentally committed to git or exposed:

1. **Immediately revoke** the compromised key in the service dashboard (Stripe, Plaid, Supabase)
2. **Generate new keys** and update your `.env.local` file
3. **Update production** environment variables in your hosting platform
4. **Remove from git history** if committed (use `git filter-branch` or BFG Repo-Cleaner)
5. **Review access logs** in service dashboards for unauthorized usage

## Additional Resources

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Stripe Security Best Practices](https://stripe.com/docs/security/guide)
- [Plaid Security](https://plaid.com/security/)
- [Supabase Security](https://supabase.com/docs/guides/platform/going-into-prod#security)

## Reporting Security Issues

If you discover a security vulnerability, please email [security@fineanants.com](mailto:security@fineanants.com) instead of creating a public issue.
