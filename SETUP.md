# FineAnts Setup Guide

## Quick Start - Fix "Failed to Fetch" Login Error

The login error occurs because you need to configure your environment variables. Follow these steps:

### 1. Set Up Supabase (Required for Authentication)

**Get Your Supabase Credentials:**

1. Go to [https://supabase.com](https://supabase.com) and create a free account
2. Create a new project (choose a region close to you)
3. Wait for the project to finish setting up (~2 minutes)
4. Go to **Project Settings** → **API**
5. Copy these values:
   - **Project URL** → This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → This is your `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

**Update Your .env.local File:**

Open `/home/user/FineAnts/.env.local` and replace the Supabase placeholders:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-actual-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here
```

### 2. Run Database Migrations

After setting up Supabase credentials, run the migrations to create your database tables:

```bash
cd /home/user/FineAnts
npx supabase db push
```

Or manually run the migrations in your Supabase SQL Editor:
1. Go to your Supabase Dashboard → **SQL Editor**
2. Run each migration file from `supabase/migrations/` in order:
   - `20250101000000_initial_schema.sql`
   - `20250102000000_stripe_subscription_schema.sql`
   - `20250125000000_budget_tracking.sql`
   - `20250131000000_plaid_integration_schema.sql`
   - `20250201000000_logging_tables.sql`
   - `20250202000000_sync_locks.sql`

### 3. Restart Your Development Server

```bash
npm run dev
```

Now the login should work!

---

## Optional: Set Up Stripe (For Subscriptions)

If you want to test the subscription features:

1. Go to [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Create a free account
3. Get your API keys from **Developers** → **API Keys**:
   - **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** → `STRIPE_SECRET_KEY`
4. Create products and prices:
   - Go to **Products** → **Add Product**
   - Create "Basic Plan" ($9.99/month) and copy the price ID
   - Create "Premium Plan" ($19.99/month) and copy the price ID
5. Update `.env.local` with your Stripe keys and price IDs

## Optional: Set Up Plaid (For Bank Account Connections)

If you want to test bank account integrations:

1. Go to [https://dashboard.plaid.com](https://dashboard.plaid.com)
2. Create a free account (sandbox mode)
3. Get your credentials from **Team Settings** → **Keys**:
   - **Client ID** → `NEXT_PUBLIC_PLAID_CLIENT_ID`
   - **Sandbox Secret** → `PLAID_SECRET_KEY`
4. Generate encryption key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the output to `PLAID_ENCRYPTION_KEY`
5. Update `.env.local` with your Plaid credentials

---

## Testing the App

### Test Accounts (Supabase)

Create your first user:
1. Go to `http://localhost:3000/auth/signup`
2. Enter your email and password (minimum 6 characters)
3. You'll be automatically logged in

### Test Bank Accounts (Plaid Sandbox)

When connecting a bank account in sandbox mode, use these test credentials:
- Username: `user_good`
- Password: `pass_good`
- Select any bank from the list

### Test Payment (Stripe Test Mode)

Use these test card numbers:
- Success: `4242 4242 4242 4242`
- Declined: `4000 0000 0000 0002`
- Use any future expiry date and any 3-digit CVC

---

## Environment Variables Reference

### Required (Minimum to Run)
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### Optional (For Full Features)
- Stripe (Subscriptions)
- Plaid (Bank connections)
- App URL (Defaults to localhost:3000)

---

## Troubleshooting

### "Failed to fetch" on login
- ✅ **Fixed!** Make sure you've updated `.env.local` with your Supabase credentials
- Restart your dev server after updating environment variables

### "Invalid API key" from Stripe/Plaid
- Check that you're using the correct keys (test vs. live)
- Make sure there are no extra spaces in your `.env.local` file

### Database errors
- Make sure you've run all migrations
- Check that RLS (Row Level Security) policies are enabled in Supabase

### Tables don't exist
- Run migrations in Supabase SQL Editor
- Or use `npx supabase db push` if you have Supabase CLI installed

---

## Next Steps

1. ✅ Set up Supabase credentials (Required)
2. ✅ Run database migrations
3. ✅ Test login/signup
4. Set up Stripe (Optional - for subscriptions)
5. Set up Plaid (Optional - for bank connections)
6. Start using the app!

For more details, see:
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide
- [SECURITY.md](./SECURITY.md) - Security best practices
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Full project documentation
