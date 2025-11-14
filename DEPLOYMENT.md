# Deployment Guide

## Deploy to Vercel

### Option 1: Using GitHub (Recommended)

1. **Push your code to GitHub**
   - Create a new repository on GitHub
   - Push your local code:
   \`\`\`bash
   git remote add origin <your-github-repo-url>
   git branch -M main
   git push -u origin main
   \`\`\`

2. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings
   - Click "Deploy"

3. **Set up Supabase for Production**
   - Create a project at [supabase.com](https://supabase.com)
   - Go to Project Settings > API
   - Copy your project URL and anon key
   - In Vercel project settings, add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
   - Redeploy the project

4. **Run Database Migrations**
   - In Supabase dashboard, go to SQL Editor
   - Copy the contents of `supabase/migrations/20250101000000_initial_schema.sql`
   - Paste and run the migration

### Option 2: Using Vercel CLI

1. **Install Vercel CLI**
   \`\`\`bash
   npm i -g vercel
   \`\`\`

2. **Login to Vercel**
   \`\`\`bash
   vercel login
   \`\`\`

3. **Deploy**
   \`\`\`bash
   cd fineanants-app
   vercel
   \`\`\`

4. **Set Environment Variables**
   \`\`\`bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   \`\`\`

5. **Deploy to Production**
   \`\`\`bash
   vercel --prod
   \`\`\`

## Testing on iPhone

Once deployed, you can test the PWA on your iPhone:

1. Open Safari on your iPhone
2. Navigate to your Vercel deployment URL
3. Tap the Share button
4. Tap "Add to Home Screen"
5. The app will now work like a native app!

## Environment Variables

For production deployment, you'll need:

### Supabase (Database & Auth)
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (server-side only)

### Stripe (Payments)
- `STRIPE_SECRET_KEY`: Your Stripe secret API key (server-side only)
- `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook signing secret (server-side only)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key
- `NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID`: Stripe price ID for Basic plan
- `NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID`: Stripe price ID for Premium plan

### Plaid (Financial Account Integration)
- `PLAID_SECRET_KEY`: Your Plaid secret API key (server-side only)
- `PLAID_ENCRYPTION_KEY`: 64-char hex encryption key for storing access tokens (server-side only)
- `NEXT_PUBLIC_PLAID_CLIENT_ID`: Your Plaid client ID
- `PLAID_ENV`: Plaid environment (sandbox, development, or production)

### App Configuration
- `NEXT_PUBLIC_APP_URL`: Your application URL (e.g., https://fineanants.app)

⚠️ **Security Note**: Variables prefixed with `NEXT_PUBLIC_` are safe to expose to the browser. All other variables are server-side only and contain sensitive secrets. See [SECURITY.md](./SECURITY.md) for details.

## Post-Deployment Checklist

- [ ] Verify authentication works
- [ ] Test on iPhone (Safari)
- [ ] Add app to Home Screen
- [ ] Test PWA functionality
- [ ] Verify database connection
- [ ] Test signup/login flow

## Troubleshooting

### Issue: "Failed to fetch" errors
- Check that environment variables are set correctly in Vercel
- Verify Supabase project is active
- Check browser console for CORS errors

### Issue: PWA not installing on iPhone
- Ensure manifest.json is accessible
- Check that app is served over HTTPS
- Verify metadata in app/layout.tsx

### Issue: Database connection errors
- Verify Supabase credentials
- Check Row Level Security policies
- Ensure migrations have been run
