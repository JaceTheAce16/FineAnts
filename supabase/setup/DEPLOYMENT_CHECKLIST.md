# Supabase Deployment Checklist

Use this checklist when deploying FineAnts to production with Supabase.

## Pre-Deployment

### 1. Supabase Project Setup
- [ ] Create a Supabase project at https://app.supabase.com
- [ ] Note down your project URL and API keys
- [ ] Choose the appropriate pricing plan (Free/Pro/Team)
- [ ] Select the closest region to your users

### 2. Environment Variables
- [ ] Copy `.env.local.example` to `.env.local`
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` to your project URL
- [ ] Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` to your anon/public key
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` to your service role key
- [ ] **IMPORTANT:** Never commit `.env.local` to git
- [ ] Add environment variables to your hosting platform (Vercel, Netlify, etc.)

## Database Setup

### 3. Apply Migrations
Choose one method:

#### Option A: Using Supabase CLI (Recommended)
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project (find ref in project settings)
supabase link --project-ref your-project-ref

# Push all migrations
supabase db push
```

#### Option B: Manual Migration
- [ ] Go to Supabase Dashboard → SQL Editor
- [ ] Run migrations in order:
  1. `supabase/migrations/20250101000000_initial_schema.sql`
  2. `supabase/migrations/20250102000000_stripe_subscription_schema.sql`
  3. `supabase/migrations/20250125000000_budget_tracking.sql`
  4. `supabase/migrations/20250131000000_plaid_integration_schema.sql`
  5. `supabase/migrations/20250201000000_logging_tables.sql`
  6. `supabase/migrations/20250202000000_sync_locks.sql`

### 4. Verify Database
- [ ] Check that all tables were created successfully
- [ ] Verify Row Level Security (RLS) is enabled on all tables
- [ ] Test RLS policies by querying as different users
- [ ] Check that triggers and functions were created

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Verify functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public';
```

## Storage Setup

### 5. Create Storage Buckets
- [ ] Go to Supabase Dashboard → Storage
- [ ] Run `supabase/setup/storage-buckets.sql` in SQL Editor
- [ ] Verify buckets were created:
  - `documents` (private, 5MB limit)
  - `avatars` (public, 2MB limit)
  - `exports` (private, 10MB limit)
- [ ] Test upload/download from your application
- [ ] Verify RLS policies work correctly

### 6. Configure Storage Settings
- [ ] Set appropriate file size limits for your plan
- [ ] Configure MIME type restrictions
- [ ] Set up CORS if accessing from different domains
- [ ] Enable/disable public access as needed

## Authentication Setup

### 7. Email Configuration
- [ ] Go to Supabase Dashboard → Authentication → Settings
- [ ] Configure SMTP settings for production emails:
  - [ ] SMTP Host
  - [ ] SMTP Port
  - [ ] SMTP Username/Password
  - [ ] Sender email and name
- [ ] Customize email templates:
  - [ ] Confirmation email
  - [ ] Password reset email
  - [ ] Magic link email
- [ ] Test sending emails in production

### 8. Auth Providers (Optional)
If using OAuth:
- [ ] Enable desired providers (Google, GitHub, Apple, etc.)
- [ ] Configure OAuth credentials from provider
- [ ] Set up redirect URLs:
  - Production: `https://yourdomain.com/auth/callback`
  - Development: `http://localhost:3000/auth/callback`
- [ ] Test OAuth flow end-to-end

### 9. Auth Settings
- [ ] Set site URL to your production URL
- [ ] Configure redirect URLs (allowed domains)
- [ ] Set JWT expiry time (default: 3600s / 1 hour)
- [ ] Set minimum password length (default: 6)
- [ ] Enable/disable email confirmations
- [ ] Configure rate limiting settings

## Realtime Setup (Optional)

### 10. Enable Realtime
- [ ] Run `supabase/setup/realtime-config.sql` if you need realtime
- [ ] Verify realtime publications:
```sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```
- [ ] Test realtime subscriptions in your application
- [ ] Monitor realtime connection count in dashboard

## Security Configuration

### 11. Row Level Security (RLS)
- [ ] Verify RLS is enabled on ALL tables
- [ ] Test RLS policies with different user accounts
- [ ] Ensure service role bypasses RLS only where needed
- [ ] Review policies for any security gaps

### 12. API Security
- [ ] Set appropriate rate limits for your plan
- [ ] Review and configure CORS settings
- [ ] Enable API analytics and monitoring
- [ ] Set up alerts for unusual activity

### 13. Secrets Management
- [ ] **NEVER** expose service role key to client
- [ ] Store sensitive keys in environment variables
- [ ] Use Supabase Vault for additional secrets (Pro plan)
- [ ] Rotate keys periodically
- [ ] Remove any test/development credentials

## Integration Setup

### 14. Stripe Integration (if using)
- [ ] Ensure Stripe environment variables are set
- [ ] Verify webhook endpoint is accessible
- [ ] Test subscription creation and updates
- [ ] Verify subscription tier syncs to profile

### 15. Plaid Integration (if using)
- [ ] Ensure Plaid environment variables are set
- [ ] Set `PLAID_ENV=production` (or sandbox for testing)
- [ ] Configure encryption key for access tokens
- [ ] Test account connection flow
- [ ] Verify transaction syncing works

## Monitoring & Maintenance

### 16. Set Up Monitoring
- [ ] Enable Database Insights (Pro plan)
- [ ] Set up log retention policies
- [ ] Configure alerting for:
  - [ ] Database errors
  - [ ] High CPU/memory usage
  - [ ] Storage limits
  - [ ] API rate limit hits
- [ ] Monitor webhook event processing in `webhook_events` table
- [ ] Monitor errors in `error_logs` table

### 17. Backups
- [ ] Enable automatic daily backups (Pro plan)
- [ ] Set backup retention period
- [ ] Test backup restoration process
- [ ] Document backup/restore procedures
- [ ] Consider point-in-time recovery (Enterprise plan)

### 18. Performance Optimization
- [ ] Add indexes for frequently queried columns
- [ ] Review slow queries in Query Performance tab
- [ ] Enable connection pooling if needed
- [ ] Optimize RLS policies for performance
- [ ] Consider read replicas for heavy read workloads (Enterprise)

## Post-Deployment

### 19. Testing
- [ ] Test user registration flow
- [ ] Test login and logout
- [ ] Test password reset
- [ ] Test OAuth login (if enabled)
- [ ] Test file uploads to storage
- [ ] Test all CRUD operations
- [ ] Test webhook endpoints (Stripe, Plaid)
- [ ] Test realtime subscriptions (if enabled)
- [ ] Load test critical endpoints

### 20. Documentation
- [ ] Update README with deployment instructions
- [ ] Document any custom configuration
- [ ] Share access with team members
- [ ] Document troubleshooting procedures
- [ ] Create runbook for common operations

### 21. Monitoring Setup
- [ ] Set up external uptime monitoring
- [ ] Configure error tracking (Sentry, etc.)
- [ ] Set up log aggregation if needed
- [ ] Create dashboard for key metrics
- [ ] Set up on-call rotation if needed

## Production Maintenance

### 22. Regular Tasks
- [ ] Review error logs weekly
- [ ] Monitor database usage and storage
- [ ] Review and optimize slow queries
- [ ] Check for Supabase platform updates
- [ ] Review and update RLS policies as needed
- [ ] Clean up old export files (run cleanup function)
- [ ] Rotate API keys periodically

### 23. Scaling Considerations
- [ ] Monitor API request volume
- [ ] Monitor database connections
- [ ] Monitor storage usage
- [ ] Consider upgrading plan if limits are reached
- [ ] Optimize queries and indexes
- [ ] Consider caching strategy (Redis, etc.)

## Emergency Procedures

### 24. Incident Response
- [ ] Document rollback procedures
- [ ] Have database backup restoration plan
- [ ] Know how to disable user access if needed
- [ ] Have contact for Supabase support
- [ ] Document emergency contacts
- [ ] Test disaster recovery procedures

## Checklist Summary

**Database:** ✅ Migrations applied, RLS verified
**Storage:** ✅ Buckets created, RLS configured
**Auth:** ✅ SMTP configured, providers enabled
**Realtime:** ✅ Publications configured (if using)
**Security:** ✅ RLS tested, secrets secured
**Integrations:** ✅ Stripe and Plaid working
**Monitoring:** ✅ Alerts configured, backups enabled
**Testing:** ✅ All flows tested in production

---

## Quick Commands Reference

### Supabase CLI
```bash
# Install
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-ref

# Push migrations
supabase db push

# Pull remote changes
supabase db pull

# Generate types
supabase gen types typescript --project-id your-ref > types/supabase.ts

# Reset local database
supabase db reset

# View logs
supabase functions logs function-name
```

### Database Queries
```sql
-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check RLS policies
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';

-- Check recent errors
SELECT * FROM error_logs
WHERE created_at > now() - interval '1 day'
ORDER BY created_at DESC;
```

---

## Support Resources

- **Supabase Documentation:** https://supabase.com/docs
- **Supabase Status:** https://status.supabase.com
- **Supabase Discord:** https://discord.supabase.com
- **GitHub Issues:** https://github.com/supabase/supabase/issues
- **Support Email:** support@supabase.com (Pro plan and above)

---

**Last Updated:** 2024-11-14
**Version:** 1.0
