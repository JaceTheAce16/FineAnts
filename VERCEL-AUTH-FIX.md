# Vercel Authentication Error - Troubleshooting Guide

**Error**: `Application error: a server-side exception has occurred`
**When**: Attempting to sign in

---

## Quick Fix Checklist

### 1. ✅ Verify Vercel Environment Variables

Go to your Vercel project → Settings → Environment Variables and ensure ALL of these are set:

```bash
# CRITICAL - Must be set for auth to work
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Required for app URL redirects
NEXT_PUBLIC_APP_URL=https://fine-ants-beige.vercel.app
```

**How to get these values**:
1. Go to your Supabase project: https://supabase.com/dashboard
2. Click on your project
3. Go to Settings → API
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. ✅ Configure Supabase Auth Redirect URLs

In your Supabase project:

1. Go to **Authentication** → **URL Configuration**
2. Add these URLs to **Redirect URLs**:

```
https://fine-ants-beige.vercel.app/auth/callback
https://fine-ants-beige.vercel.app/
http://localhost:3000/auth/callback  (for local dev)
http://localhost:3000/
```

3. Set **Site URL** to:
```
https://fine-ants-beige.vercel.app
```

### 3. ✅ Enable Email Auth in Supabase

1. Go to **Authentication** → **Providers**
2. Make sure **Email** is enabled
3. **Confirm email** can be disabled for testing (enable for production)

### 4. ✅ Check Vercel Deployment Logs

After the new deployment completes:

1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on the latest deployment
3. Click on "**Runtime Logs**" or "**Function Logs**"
4. Look for any error messages related to auth

### 5. ✅ Test Authentication Flow

After fixing the above:

1. Visit: https://fine-ants-beige.vercel.app/auth/login
2. Try signing up with a new email
3. Check for errors in browser console (F12 → Console tab)
4. Check Vercel function logs for backend errors

---

## Common Issues & Solutions

### Issue 1: "Invalid API Key" or "Unauthorized"

**Cause**: Wrong or missing Supabase keys in Vercel

**Fix**:
1. Verify environment variables in Vercel match your Supabase project
2. Make sure you're using the **anon** key for `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not service_role)
3. Redeploy after updating environment variables

### Issue 2: "Redirect URL mismatch"

**Cause**: Supabase doesn't recognize your Vercel domain

**Fix**:
1. Add your Vercel URL to Supabase redirect URLs (see step 2 above)
2. Make sure there are no typos in the URL
3. Include both with and without trailing slash

### Issue 3: "Session not found" or "User not authenticated"

**Cause**: Cookies not being set properly

**Fix**:
1. Check that `NEXT_PUBLIC_APP_URL` is set to your Vercel domain
2. Verify middleware is running (check middleware.ts exists)
3. Clear browser cookies and try again

### Issue 4: Still getting "Application error: a server-side exception"

**Debugging Steps**:

1. **Check Vercel Function Logs**:
   ```
   Vercel Dashboard → Deployments → [Latest] → Runtime Logs
   ```

2. **Look for specific error**:
   - "Cannot read property of undefined" → Missing environment variable
   - "Invalid JWT" → Wrong Supabase keys
   - "Network error" → Supabase URL incorrect

3. **Test locally first**:
   ```bash
   cd fineanants-app
   npm run dev
   ```
   - Try signing in locally
   - If it works locally but not on Vercel → Environment variable issue
   - If it fails locally too → Code issue (check recent changes)

---

## Step-by-Step: Setting Environment Variables on Vercel

### Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/dashboard
2. Click on your **FineAnts** project
3. Click **Settings** tab
4. Click **Environment Variables** in sidebar
5. For each variable:
   - Click **Add New**
   - Name: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: `https://xxxxx.supabase.co`
   - Environment: Select **Production**, **Preview**, **Development**
   - Click **Save**

6. Repeat for all variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_APP_URL
   ```

7. After adding all variables, click **Redeploy** in Deployments tab

### Via Vercel CLI (Alternative)

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link to your project
cd fineanants-app
vercel link

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Paste your Supabase URL when prompted

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Paste your anon key when prompted

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste your service role key when prompted

vercel env add NEXT_PUBLIC_APP_URL production
# Enter: https://fine-ants-beige.vercel.app

# Redeploy
vercel --prod
```

---

## Verification Checklist

After following the steps above, verify:

- [ ] All 4 environment variables set in Vercel
- [ ] Vercel URL added to Supabase redirect URLs
- [ ] Site URL set in Supabase
- [ ] Email auth enabled in Supabase
- [ ] Latest deployment successful (no build errors)
- [ ] Can access https://fine-ants-beige.vercel.app (loads without error)
- [ ] Can navigate to /auth/login
- [ ] Can see sign-up/login form
- [ ] Test sign-up with new email works
- [ ] Redirected to /dashboard after sign-up

---

## Still Having Issues?

### Get Detailed Error Information

1. **Browser Console**:
   - Open your app in Chrome/Firefox
   - Press F12 → Console tab
   - Try signing in
   - Copy any red error messages

2. **Vercel Function Logs**:
   - Vercel Dashboard → Deployments → [Latest] → Runtime Logs
   - Try signing in
   - Copy the error logs that appear

3. **Supabase Logs**:
   - Supabase Dashboard → Logs → Auth Logs
   - Check for authentication attempts and errors

### Contact Support

If you've checked everything above and still have issues:

1. **Check Vercel Status**: https://www.vercel-status.com/
2. **Check Supabase Status**: https://status.supabase.com/
3. **Vercel Discord**: https://vercel.com/discord
4. **Supabase Discord**: https://discord.supabase.com/

---

## Quick Test After Fix

Run this in browser console on your login page:

```javascript
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('App URL:', process.env.NEXT_PUBLIC_APP_URL)
```

Both should show valid URLs. If either is `undefined`, environment variables aren't set correctly.

---

**Last Updated**: 2025-11-21
**Deployment**: https://fine-ants-beige.vercel.app
