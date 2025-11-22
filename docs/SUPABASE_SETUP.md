# Supabase Integration Setup Guide

## Overview

FineAnts uses Supabase as its backend platform, providing:
- **PostgreSQL Database** - Structured data storage with RLS
- **Authentication** - User authentication and session management
- **Storage** - File storage for receipts and documents
- **Realtime** - Live data updates (optional)

## Quick Start

### 1. Environment Variables

Create a `.env.local` file with your Supabase credentials:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Apply Database Migrations

#### Option A: Using Supabase CLI (Recommended)

```bash
# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref your-project-ref

# Push migrations to production
npx supabase db push
```

#### Option B: Manual Migration (if CLI not available)

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Navigate to SQL Editor
3. Run each migration file in order:
   - `supabase/migrations/20250101000000_initial_schema.sql`
   - `supabase/migrations/20250102000000_stripe_subscription_schema.sql`
   - `supabase/migrations/20250125000000_budget_tracking.sql`
   - `supabase/migrations/20250131000000_plaid_integration_schema.sql`
   - `supabase/migrations/20250201000000_logging_tables.sql`
   - `supabase/migrations/20250202000000_sync_locks.sql`

## Database Schema

### Core Tables

#### `profiles`
User profile information, automatically created on signup.
- `id` - UUID (references auth.users)
- `email` - User email
- `full_name` - User's full name
- `subscription_tier` - free/basic/premium
- Row Level Security: Users can only access their own profile

#### `financial_accounts`
Connected bank accounts via Plaid.
- `id` - UUID
- `user_id` - References profiles
- `plaid_account_id` - Plaid account identifier
- `name` - Account name
- `type` - checking/savings/credit
- `balance` - Current balance
- Row Level Security: Users can only access their own accounts

#### `transactions`
Financial transactions synced from Plaid.
- `id` - UUID
- `user_id` - References profiles
- `account_id` - References financial_accounts
- `plaid_transaction_id` - Plaid transaction identifier
- `amount` - Transaction amount
- `date` - Transaction date
- `name` - Merchant/description
- `category` - Transaction category
- Row Level Security: Users can only access their own transactions

#### `budgets`
User-defined budgets for spending categories.
- `id` - UUID
- `user_id` - References profiles
- `category` - Budget category
- `amount` - Budget amount
- `period` - monthly/weekly/yearly
- Row Level Security: Users can only access their own budgets

#### `savings_goals`
User savings goals tracking.
- `id` - UUID
- `user_id` - References profiles
- `name` - Goal name
- `target_amount` - Target amount
- `current_amount` - Current progress
- `target_date` - Goal deadline
- Row Level Security: Users can only access their own goals

### Subscription Tables

#### `subscriptions`
Stripe subscription management.
- `id` - UUID
- `user_id` - References profiles
- `stripe_subscription_id` - Stripe subscription ID
- `status` - active/canceled/past_due
- `tier` - basic/premium
- `current_period_end` - Subscription period end date
- Row Level Security: Users can only access their own subscription

#### `income_items` & `expense_items`
Income and expense tracking for budget management.

### Integration Tables

#### `plaid_items`
Stores encrypted Plaid access tokens.
- `id` - UUID
- `user_id` - References profiles
- `item_id` - Plaid item ID
- `access_token_encrypted` - Encrypted access token
- `cursor` - Sync cursor for incremental updates
- `status` - active/error/revoked
- Row Level Security: Users can only access their own items

#### `sync_locks`
Prevents concurrent transaction syncing.
- `user_id` - Lock owner
- `expires_at` - Lock expiration time

### Monitoring Tables

#### `webhook_events`
Logs all webhook events (Stripe, Plaid).
- `id` - UUID
- `source` - stripe/plaid
- `event_type` - Event type
- `payload` - Event data (JSONB)
- `processed` - Processing status
- Row Level Security: No user access (service role only)

#### `error_logs`
Application error tracking.
- `id` - UUID
- `user_id` - References profiles (nullable)
- `error_type` - Error classification
- `message` - Error message
- `severity` - info/warning/error/critical
- `metadata` - Additional context (JSONB)
- Row Level Security: No user access (service role only)

## Storage Buckets

### Setting Up Storage Buckets

FineAnts requires the following storage buckets:

#### 1. User Documents Bucket
For storing financial documents and receipts.

```sql
-- Run in Supabase SQL Editor
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false);

-- Create RLS policy for documents bucket
create policy "Users can upload their own documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can view their own documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);
```

#### 2. Profile Images Bucket
For user profile pictures.

```sql
-- Run in Supabase SQL Editor
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

-- Create RLS policy for avatars bucket
create policy "Avatar images are publicly accessible"
on storage.objects for select
to public
using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);
```

## Realtime Configuration

### Enable Realtime for Tables

To enable real-time updates for specific tables:

```sql
-- Enable realtime for transactions table
alter publication supabase_realtime add table transactions;

-- Enable realtime for financial_accounts table
alter publication supabase_realtime add table financial_accounts;

-- Enable realtime for budgets table
alter publication supabase_realtime add table budgets;
```

### Using Realtime in Components

```typescript
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export function RealtimeTransactions() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState([])

  useEffect(() => {
    // Subscribe to transaction changes
    const channel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions'
        },
        (payload) => {
          console.log('Transaction change:', payload)
          // Update local state
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return <div>{/* Render transactions */}</div>
}
```

## Security Configuration

### Row Level Security (RLS)

All tables have RLS enabled with policies that ensure users can only access their own data.

**Example Policy:**
```sql
create policy "Users can only see their own transactions"
on transactions for select
to authenticated
using (auth.uid() = user_id);
```

### Service Role Key

The service role key bypasses RLS and should only be used for:
- Webhook handlers (Stripe, Plaid)
- Admin operations
- Background jobs

**Never expose the service role key to clients!**

## Authentication Configuration

### Current Setup
- Email/password authentication enabled
- JWT expiry: 1 hour (3600s)
- Minimum password length: 6 characters
- Email confirmation: Enabled

### Adding OAuth Providers

To enable Google OAuth:

1. Go to Supabase Dashboard > Authentication > Providers
2. Enable Google provider
3. Add OAuth credentials from Google Cloud Console
4. Update site URL and redirect URLs

```typescript
// In your login component
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`
  }
})
```

## Production Checklist

### Before Deploying

- [ ] All migrations applied to production database
- [ ] Environment variables configured in hosting platform
- [ ] Storage buckets created with proper RLS policies
- [ ] Auth providers configured (if using OAuth)
- [ ] SMTP configured for production emails (not Inbucket)
- [ ] Database backups enabled
- [ ] Row Level Security verified on all tables
- [ ] Service role key secured (not in client code)

### Recommended Supabase Project Settings

1. **Database**
   - Enable automatic backups (daily)
   - Set up connection pooling for production
   - Monitor query performance

2. **Auth**
   - Configure SMTP for production emails
   - Set appropriate rate limiting
   - Enable email confirmation for new users

3. **Storage**
   - Set file size limits (e.g., 5MB for receipts)
   - Configure file type restrictions
   - Set up automatic cleanup for old files

4. **API**
   - Review rate limits for your plan
   - Monitor API usage
   - Set up alerting for errors

## Monitoring & Maintenance

### Database Monitoring

Use the built-in logging tables:

```sql
-- Check recent errors
select * from error_logs
where created_at > now() - interval '1 day'
order by created_at desc;

-- Check webhook processing
select
  source,
  event_type,
  processed,
  count(*)
from webhook_events
where created_at > now() - interval '1 day'
group by source, event_type, processed;
```

### Performance Optimization

1. Add indexes for frequently queried fields:
```sql
create index idx_transactions_user_date
on transactions(user_id, date desc);

create index idx_financial_accounts_user
on financial_accounts(user_id);
```

2. Monitor slow queries in Supabase Dashboard > Database > Query Performance

## Troubleshooting

### Common Issues

#### 1. "relation does not exist" error
- **Cause:** Migrations not applied
- **Solution:** Run `npx supabase db push` or apply migrations manually

#### 2. "new row violates row-level security policy"
- **Cause:** RLS policy blocking the operation
- **Solution:** Check RLS policies and ensure user_id is properly set

#### 3. Authentication errors
- **Cause:** Invalid JWT or expired session
- **Solution:** Refresh user session or re-authenticate

#### 4. Storage upload fails
- **Cause:** Missing bucket or RLS policy
- **Solution:** Create storage buckets and configure RLS policies

### Getting Help

- Supabase Documentation: https://supabase.com/docs
- FineAnts Issues: https://github.com/your-repo/issues
- Supabase Discord: https://discord.supabase.com

## API Reference

### Supabase Client Instances

#### Browser Client
```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
```

#### Server Client
```typescript
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
```

### Common Operations

#### Query Data
```typescript
const { data, error } = await supabase
  .from('transactions')
  .select('*')
  .order('date', { ascending: false })
  .limit(10)
```

#### Insert Data
```typescript
const { data, error } = await supabase
  .from('budgets')
  .insert({
    category: 'groceries',
    amount: 500,
    period: 'monthly'
  })
```

#### Update Data
```typescript
const { data, error } = await supabase
  .from('profiles')
  .update({ full_name: 'John Doe' })
  .eq('id', userId)
```

#### Delete Data
```typescript
const { data, error } = await supabase
  .from('transactions')
  .delete()
  .eq('id', transactionId)
```

## Next Steps

1. Apply all database migrations to your production Supabase project
2. Create storage buckets for file uploads
3. Configure production SMTP for emails
4. Set up database backups
5. Review and adjust RLS policies as needed
6. Monitor error_logs and webhook_events tables
7. Configure OAuth providers (optional)
8. Enable realtime for tables that need live updates (optional)

## Support

For issues or questions:
- Check the Supabase documentation
- Review error logs in the database
- Contact the development team
