# FineAnts Data Flow Analysis
**Complete Journey Through Your Application - From Click to Database**

*A beginner-friendly guide to understanding how data flows through your app*

---

## Table of Contents
1. [Initial App Load Flow](#1-initial-app-load-flow)
2. [Main Action: Connecting a Bank Account](#2-main-action-connecting-a-bank-account)
3. [User Authentication Flow](#3-user-authentication-flow)
4. [Payment Processing Flow](#4-payment-processing-flow)
5. [Database Architecture](#5-database-architecture)

---

## 1. Initial App Load Flow
### What Happens When a User First Visits Your App?

Let's trace the journey from typing the URL to seeing the homepage.

#### Step 1: User Types URL → Next.js Receives Request
**File**: `middleware.ts:4`
```
Browser Request: https://fineanants.com/
         ↓
Next.js Middleware (ALWAYS runs first)
```

**What happens**:
- Before ANY page loads, Next.js middleware intercepts the request
- Middleware calls `updateSession()` function

---

#### Step 2: Session Authentication Check
**File**: `lib/supabase/middleware.ts:4` → Function `updateSession()`

```typescript
// Creates Supabase client with user's cookies
const supabase = createServerClient(...)

// Checks if user has a valid session
await supabase.auth.getUser()
```

**What happens**:
1. Creates a Supabase client that can read cookies from the browser
2. Calls `supabase.auth.getUser()` to check if user is logged in
3. Refreshes the authentication token if it's expired
4. Updates cookies with fresh token
5. Returns a response allowing the page to load

**Result**:
- If logged in → User data is available in cookies
- If not logged in → Cookies are empty, user is anonymous

---

#### Step 3: Root Layout Renders
**File**: `app/layout.tsx:16` → Function `RootLayout()`

```typescript
<html lang="en">
  <body className="antialiased">
    {children}  // This is where your page content goes
  </body>
</html>
```

**What happens**:
- Wraps the entire app with HTML structure
- Sets metadata (title, description, PWA settings)
- Adds global CSS classes
- The `{children}` prop is where specific pages render

---

#### Step 4: Homepage Renders
**File**: `app/page.tsx:5` → Function `Home()`

```typescript
// Static homepage - no server calls needed
return (
  <main>
    <h1>Welcome to FineAnts</h1>
    <Button href="/auth/signup">Get Started</Button>
    // ... feature cards
  </main>
)
```

**What happens**:
- Renders static HTML (no database queries)
- Shows welcome message and feature cards
- Displays "Get Started" button linking to signup
- Renders in browser immediately (fast!)

**Final Result**: User sees the homepage!

---

### Complete Initial Load Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ User types URL: https://fineanants.com/                        │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 1. Middleware Intercepts (middleware.ts:4)                     │
│    - Runs BEFORE any page loads                                │
│    - Calls updateSession()                                      │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Auth Check (lib/supabase/middleware.ts:31)                  │
│    - Reads cookies from browser                                 │
│    - Checks if user is logged in                                │
│    - Refreshes auth token if needed                             │
│    - Returns updated cookies                                    │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Root Layout Renders (app/layout.tsx:16)                     │
│    - Sets up HTML structure                                     │
│    - Adds global metadata and styles                            │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Homepage Renders (app/page.tsx:5)                           │
│    - Shows welcome message                                      │
│    - Displays feature cards                                     │
│    - No database queries (static content)                       │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ ✅ User sees homepage in their browser!                         │
└─────────────────────────────────────────────────────────────────┘
```

**Time elapsed**: ~100-300ms (very fast because no database queries!)

---

## 2. Main Action: Connecting a Bank Account
### The Complete Plaid Integration Flow (Step-by-Step)

This is the most complex flow in your app. Let's trace it from button click to database storage.

---

### Phase 1: User Clicks "Connect with Plaid" Button

#### Step 1: Button Click on Dashboard
**File**: `app/dashboard/page.tsx:269` → Component `<PlaidLinkButton>`

```typescript
<PlaidLinkButton
  onSuccess={() => window.location.reload()}
  onError={(error) => console.error(error)}
>
  Connect with Plaid
</PlaidLinkButton>
```

**User Action**: Clicks the button
**What happens**: Button component starts loading

---

#### Step 2: Button Component Checks Account Limit
**File**: `components/plaid-link-button.tsx:98` → Function `checkLimit()`

```typescript
// Check if user can add more accounts based on subscription
const response = await fetch('/api/plaid/account-limit');
const data = await response.json();
// data = { canAddMore: true, current: 1, limit: 5, tier: 'basic' }
```

**What happens**:
1. Calls API to check subscription limits
2. Free tier: 0 Plaid accounts allowed
3. Basic tier: 5 Plaid accounts allowed
4. Premium tier: 999 Plaid accounts allowed
5. If limit reached, shows upgrade message

---

#### Step 3: User Clicks Button → Create Link Token
**File**: `components/plaid-link-button.tsx:122` → Function `handleClick()`

```typescript
// Call API to get Plaid Link token
const response = await fetch('/api/plaid/link-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ accessToken: undefined })
});

const data = await response.json();
setLinkToken(data.linkToken); // Store token in state
```

**What happens**:
- Makes API call to backend to create Plaid Link token
- Token is needed to open Plaid's UI

---

#### Step 4: Backend Creates Link Token
**File**: `app/api/plaid/link-token/route.ts:11` → Function `POST()`

**Server-side code runs**:

```typescript
// 1. Authenticate user
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// 2. Call Plaid API to create link token
const linkToken = await createLinkToken({
  userId: user.id,
  clientName: 'FineAnts',
  countryCodes: [CountryCode.Us],
  products: [Products.Auth, Products.Transactions],
});

// 3. Return link token to frontend
return NextResponse.json({ linkToken });
```

**What happens**:
1. Verifies user is logged in (checks session cookies)
2. Calls Plaid API with your app's credentials
3. Plaid generates a temporary link token (expires in 30 minutes)
4. Returns token to frontend

**API Call Flow**:
```
Frontend → Your Server → Plaid API → Your Server → Frontend
         (creates token)  (generates token) (returns token)
```

---

#### Step 5: Plaid Link Modal Opens
**File**: `components/plaid-link-button.tsx:116-118`

```typescript
useEffect(() => {
  if (linkToken && ready) {
    open(); // Opens Plaid Link UI modal
  }
}, [linkToken, ready, open]);
```

**What happens**:
- Plaid's JavaScript library opens a modal window
- User sees bank selection screen
- User selects their bank (e.g., Chase, Bank of America)
- User logs in with bank credentials
- User selects accounts to connect
- Plaid validates credentials with the bank

**This all happens in Plaid's secure UI (not your code)**

---

### Phase 2: User Completes Bank Login → Exchange Token

#### Step 6: Plaid Returns Public Token
**File**: `components/plaid-link-button.tsx:49` → `onSuccess` callback

```typescript
onSuccess: async (publicToken, metadata) => {
  // publicToken: temporary token from Plaid
  // metadata: { institution: { id: "...", name: "Chase" }, ... }

  // Call your API to exchange token
  const response = await fetch('/api/plaid/exchange-token', {
    method: 'POST',
    body: JSON.stringify({
      publicToken,
      institutionId: metadata.institution?.institution_id,
      institutionName: metadata.institution?.name,
    }),
  });
}
```

**What happens**:
1. User successfully logs into their bank via Plaid
2. Plaid returns a `publicToken` (single-use, expires in 30 minutes)
3. Frontend immediately sends this to your backend
4. Also sends bank name and ID

---

#### Step 7: Backend Exchanges Public Token for Access Token
**File**: `app/api/plaid/exchange-token/route.ts:260` → Function `POST()`

**This is the critical step that stores permanent access to the bank account**:

```typescript
// 1. Authenticate user
const { data: { user } } = await supabase.auth.getUser();

// 2. Validate request has all required fields
const { publicToken, institutionId, institutionName } = await request.json();

// 3. Exchange public token for access token (Plaid API call)
const { accessToken, itemId } = await exchangePublicToken(publicToken);
// accessToken: permanent token to access this bank account
// itemId: unique ID for this bank connection

// 4. Store encrypted access token in database
await storeAccessToken(user.id, itemId, accessToken, institutionId, institutionName);
```

**What `exchangePublicToken()` does**:
```javascript
// Calls Plaid API
const response = await plaidClient.itemPublicTokenExchange({
  public_token: publicToken
});

// Returns permanent credentials
return {
  accessToken: response.data.access_token,  // Use this forever!
  itemId: response.data.item_id            // Unique bank connection ID
};
```

**Security Note**: The access token is encrypted before storing in database!

---

#### Step 8: Fetch and Store Bank Accounts
**File**: `app/api/plaid/exchange-token/route.ts:291`

```typescript
// Fetch all accounts from this bank
const accounts = await getAccounts(accessToken);
// Returns: [
//   { accountId: "abc", name: "Chase Checking", type: "depository",
//     balances: { current: 5000.00 } },
//   { accountId: "def", name: "Chase Savings", type: "depository",
//     balances: { current: 10000.00 } }
// ]

// Map each account to database format
const accountInserts = accounts.map((account) => ({
  user_id: user.id,
  name: account.name,
  account_type: mapPlaidAccountType(account.type, account.subtype),
  institution_name: institutionName,
  current_balance: account.balances.current,
  plaid_account_id: account.accountId,
  plaid_item_id: itemId,
  is_manual: false, // This is a Plaid-connected account
}));

// Insert all accounts into database
await supabaseAdmin
  .from('financial_accounts')
  .insert(accountInserts);
```

**What happens**:
1. Calls Plaid API to get account details (names, balances, types)
2. Converts Plaid's account types to your app's types
   - Plaid: "depository/checking" → Your app: "checking"
   - Plaid: "credit/credit card" → Your app: "credit_card"
   - Plaid: "investment/401k" → Your app: "retirement"
3. Inserts all accounts into `financial_accounts` table

---

#### Step 9: Fetch Historical Transactions (Async)
**File**: `app/api/plaid/exchange-token/route.ts:320`

```typescript
const historicalResult = await fetchInitialHistoricalTransactions(
  user.id,
  itemId,
  accessToken
);
// Fetches up to 2 years of transaction history
```

**What `fetchInitialHistoricalTransactions()` does** (Line 158-258):

```typescript
let cursor = undefined;
let hasMore = true;

// Fetch transactions in batches (Plaid returns ~500 at a time)
while (hasMore) {
  // Call Plaid sync API
  const syncResult = await syncTransactions(accessToken, cursor);

  // Process each transaction
  for (const plaidTxn of syncResult.added) {
    // Find the account in our database
    const accountData = await supabase
      .from('financial_accounts')
      .select('id')
      .eq('plaid_account_id', plaidTxn.accountId)
      .single();

    // Map category
    const category = mapPlaidCategoryToApp(plaidTxn.category);

    // Prepare transaction for database
    transactionInserts.push({
      user_id: userId,
      account_id: accountData.id,
      plaid_transaction_id: plaidTxn.transactionId,
      amount: plaidTxn.amount,
      description: plaidTxn.name,
      category: category,
      transaction_date: plaidTxn.date,
      is_pending: plaidTxn.pending,
    });
  }

  // Insert batch into database
  await supabase.from('transactions').insert(transactionInserts);

  // Get next batch
  cursor = syncResult.nextCursor;
  hasMore = syncResult.hasMore;
}
```

**What happens**:
1. Plaid returns transactions in batches of ~500
2. Each transaction is mapped to your database format
3. Categories are converted (e.g., Plaid "Food and Drink" → Your app "food")
4. All transactions inserted into `transactions` table
5. Typically fetches 100-2000+ transactions depending on account history

---

#### Step 10: Return Success to Frontend
**File**: `app/api/plaid/exchange-token/route.ts:326`

```typescript
return NextResponse.json({
  success: true,
  itemId: itemId,
  accountCount: accounts.length,
  transactionCount: historicalResult.transactionCount,
});
```

**Response example**:
```json
{
  "success": true,
  "itemId": "abc123",
  "accountCount": 2,
  "transactionCount": 847
}
```

---

#### Step 11: Frontend Reloads Page
**File**: `components/plaid-link-button.tsx:69`

```typescript
// Success callback
onSuccess(); // Calls window.location.reload()
```

**What happens**:
- Page reloads
- Dashboard re-fetches all data from database
- User sees their newly connected accounts and transactions!

---

### Complete Bank Connection Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ USER: Clicks "Connect with Plaid" button                        │
│ File: app/dashboard/page.tsx:269                                │
└──────────────────────┬───────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1: Check Account Limit                                     │
│ File: components/plaid-link-button.tsx:98                       │
│ API: GET /api/plaid/account-limit                               │
│ Returns: { canAddMore: true, current: 1, limit: 5 }             │
└──────────────────────┬───────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2: Create Link Token                                       │
│ File: components/plaid-link-button.tsx:122                      │
│ API: POST /api/plaid/link-token                                 │
│       ↓                                                          │
│ File: app/api/plaid/link-token/route.ts:11                      │
│ - Verify user is logged in                                      │
│ - Call Plaid API to generate link token                         │
│ - Return token to frontend                                      │
└──────────────────────┬───────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 3: Open Plaid Link Modal                                   │
│ File: components/plaid-link-button.tsx:118                      │
│ - Plaid's UI opens in browser                                   │
│ - User selects bank (Chase, BoA, etc.)                          │
│ - User enters bank username/password                            │
│ - User selects accounts to connect                              │
│ - Plaid validates with bank                                     │
└──────────────────────┬───────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 4: Plaid Returns Public Token                              │
│ File: components/plaid-link-button.tsx:51                       │
│ Receives: publicToken, institutionName, institutionId           │
└──────────────────────┬───────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 5: Exchange Token                                          │
│ File: components/plaid-link-button.tsx:53                       │
│ API: POST /api/plaid/exchange-token                             │
│      Body: { publicToken, institutionName, institutionId }      │
│       ↓                                                          │
│ File: app/api/plaid/exchange-token/route.ts:260                 │
│ Backend processing...                                            │
└──────────────────────┬───────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 6: Exchange Public Token for Access Token                  │
│ File: app/api/plaid/exchange-token/route.ts:285                 │
│ - Call Plaid API: exchangePublicToken(publicToken)              │
│ - Receive: { accessToken: "access-...", itemId: "..." }         │
│ - Encrypt and store access token in database                    │
│   Table: plaid_items                                             │
└──────────────────────┬───────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 7: Fetch Accounts from Plaid                               │
│ File: app/api/plaid/exchange-token/route.ts:291                 │
│ - Call Plaid API: getAccounts(accessToken)                      │
│ - Returns: Array of account objects with balances               │
│ - Map each account to database format                           │
│ - Insert into financial_accounts table                          │
│   Database INSERT: 2 accounts                                    │
└──────────────────────┬───────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 8: Fetch Historical Transactions                           │
│ File: app/api/plaid/exchange-token/route.ts:320                 │
│ Function: fetchInitialHistoricalTransactions()                  │
│ - Fetch transactions in batches (cursor-based pagination)       │
│ - Map each transaction to database format                       │
│ - Convert Plaid categories to app categories                    │
│ - Insert into transactions table                                │
│   Database INSERT: 847 transactions                              │
└──────────────────────┬───────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 9: Return Success to Frontend                              │
│ Response: {                                                      │
│   success: true,                                                 │
│   accountCount: 2,                                               │
│   transactionCount: 847                                          │
│ }                                                                │
└──────────────────────┬───────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 10: Page Reloads                                           │
│ File: components/plaid-link-button.tsx:69                       │
│ - window.location.reload()                                       │
│ - Dashboard re-fetches data from database                       │
│ - User sees new accounts and transactions!                      │
└──────────────────────────────────────────────────────────────────┘
```

**Total time**: 5-15 seconds (depends on transaction count and bank speed)

**Database Changes**:
- ✅ 1 row in `plaid_items` table (access token storage)
- ✅ 2 rows in `financial_accounts` table (accounts)
- ✅ 847 rows in `transactions` table (historical transactions)

---

## 3. User Authentication Flow
### How Signup, Login, and Session Management Works

---

### Signup Flow

#### Step 1: User Visits Signup Page
**File**: `app/auth/signup/page.tsx:12`

```typescript
export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // ... form renders
}
```

**What happens**: Simple form with email and password fields

---

#### Step 2: User Submits Form
**File**: `app/auth/signup/page.tsx:20` → Function `handleSignUp()`

```typescript
const handleSignUp = async (e: React.FormEvent) => {
  e.preventDefault();

  // Call Supabase Auth API
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) throw error;

  // Redirect to dashboard
  router.push("/dashboard");
}
```

**What happens**:
1. Calls Supabase authentication API
2. Supabase creates user account in `auth.users` table
3. Supabase sends confirmation email (if email verification enabled)
4. Returns session token (JWT)
5. Token stored in browser cookies
6. User redirected to dashboard

**Database Changes**:
- ✅ New row in `auth.users` table (managed by Supabase)
- ✅ New row in `profiles` table (auto-created by trigger)

---

### Login Flow

#### Step 1: User Visits Login Page
**File**: `app/auth/login/page.tsx:12`

Simple form (same structure as signup)

---

#### Step 2: User Submits Credentials
**File**: `app/auth/login/page.tsx:20` → Function `handleLogin()`

```typescript
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();

  // Call Supabase Auth API
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Redirect to dashboard
  router.push("/dashboard");
}
```

**What happens**:
1. Supabase checks email/password against database
2. If valid, generates JWT (JSON Web Token)
3. JWT stored in browser cookies
4. User redirected to dashboard

**JWT Contents** (simplified):
```json
{
  "sub": "user-uuid-here",
  "email": "user@example.com",
  "exp": 1234567890
}
```

---

### Session Verification (Every Page Load)

#### Middleware Checks Authentication
**File**: `middleware.ts:4` → Every single request

```typescript
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}
```

**File**: `lib/supabase/middleware.ts:4`

```typescript
export async function updateSession(request: NextRequest) {
  // Create Supabase client with cookies
  const supabase = createServerClient(..., {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookies) { /* update cookies */ }
    }
  });

  // Verify and refresh token
  await supabase.auth.getUser();

  return response;
}
```

**What happens on EVERY page request**:
1. Reads JWT from cookies
2. Verifies signature is valid
3. Checks if token expired
4. If expired, refreshes with new token
5. If invalid, clears cookies (logs user out)
6. Updates cookies with fresh token

**This runs on EVERY page** - that's how your app knows if user is logged in!

---

### Protected Page Example (Dashboard)

**File**: `app/dashboard/page.tsx:13`

```typescript
export default async function DashboardPage() {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  // If not logged in, redirect to login
  if (!user) {
    redirect("/auth/login");
  }

  // User is authenticated, fetch their data
  const { data: accounts } = await supabase
    .from('financial_accounts')
    .select('*')
    .eq('user_id', user.id);

  // ... render dashboard
}
```

**What happens**:
1. Gets user from session (already verified by middleware)
2. If no user, redirects to login page
3. If user exists, fetches their data using `user.id`
4. Renders personalized dashboard

---

### Authentication Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ SIGNUP FLOW                                                      │
└──────────────────────────────────────────────────────────────────┘

User fills form (email + password)
         ↓
app/auth/signup/page.tsx:26
supabase.auth.signUp({ email, password })
         ↓
Supabase Auth API
- Creates user in auth.users table
- Generates JWT token
- Stores token in cookies
- Triggers database: creates profile row
         ↓
Redirect to /dashboard
         ↓
✅ User is logged in!

┌──────────────────────────────────────────────────────────────────┐
│ LOGIN FLOW                                                       │
└──────────────────────────────────────────────────────────────────┘

User enters credentials
         ↓
app/auth/login/page.tsx:26
supabase.auth.signInWithPassword({ email, password })
         ↓
Supabase Auth API
- Verifies password hash
- Generates JWT token
- Stores token in cookies
         ↓
Redirect to /dashboard
         ↓
✅ User is logged in!

┌──────────────────────────────────────────────────────────────────┐
│ SESSION VERIFICATION (Every Page Load)                          │
└──────────────────────────────────────────────────────────────────┘

User visits ANY page
         ↓
middleware.ts:4 (ALWAYS runs first)
         ↓
lib/supabase/middleware.ts:31
- Read JWT from cookies
- Verify signature
- Check expiration
- Refresh if needed
- Update cookies
         ↓
Page renders with user data
         ↓
✅ User stays logged in!

┌──────────────────────────────────────────────────────────────────┐
│ PROTECTED PAGE ACCESS (Dashboard)                               │
└──────────────────────────────────────────────────────────────────┘

User visits /dashboard
         ↓
middleware.ts verifies session (JWT valid?)
         ↓
app/dashboard/page.tsx:18
const { data: { user } } = await supabase.auth.getUser()
         ↓
if (!user) → redirect("/auth/login")
         ↓
Fetch user's data using user.id
         ↓
✅ Render personalized dashboard!
```

---

## 4. Payment Processing Flow
### How Stripe Subscription Purchase Works

---

### Step 1: User Clicks "Upgrade to Premium"
**File**: `app/dashboard/subscription/page.tsx` (assumed based on structure)

User clicks button to purchase subscription

---

### Step 2: Create Checkout Session
**File**: `app/api/checkout/route.ts:14` → Function `POST()`

```typescript
// 1. Authenticate user
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// 2. Validate plan selection
const { priceId, planType } = await request.json();
// priceId: "price_1ABC..." (from Stripe dashboard)
// planType: "basic" or "premium"

// 3. Check for existing subscription
const { data: existingSub } = await supabase
  .from('subscriptions')
  .select('*')
  .eq('user_id', user.id)
  .eq('status', 'active')
  .single();

if (existingSub) {
  return NextResponse.json({
    error: 'You already have an active subscription'
  }, { status: 400 });
}
```

**What happens**:
1. Verifies user is logged in
2. Checks they don't already have active subscription
3. Validates the plan they selected matches a real Stripe price

---

#### Step 3: Get or Create Stripe Customer
**File**: `app/api/checkout/route.ts:77`

```typescript
// Get user's name from profile
const { data: profile } = await supabase
  .from('profiles')
  .select('full_name')
  .eq('id', user.id)
  .single();

// Get or create Stripe customer
const customerId = await getOrCreateStripeCustomer(
  user.id,
  user.email!,
  profile?.full_name
);
```

**What `getOrCreateStripeCustomer()` does**:
```typescript
// Check if customer already exists in database
const { data: existing } = await supabase
  .from('stripe_customers')
  .select('stripe_customer_id')
  .eq('user_id', userId)
  .single();

if (existing) {
  return existing.stripe_customer_id; // Return existing
}

// Create new customer in Stripe
const customer = await stripe.customers.create({
  email: email,
  name: name,
  metadata: { user_id: userId }
});

// Store in database
await supabase
  .from('stripe_customers')
  .insert({
    user_id: userId,
    stripe_customer_id: customer.id
  });

return customer.id;
```

**What happens**:
1. Checks if user already has a Stripe customer ID
2. If not, creates new customer in Stripe
3. Stores mapping in database: `user_id` ↔ `stripe_customer_id`
4. Returns Stripe customer ID

---

#### Step 4: Create Stripe Checkout Session
**File**: `app/api/checkout/route.ts:84`

```typescript
// Create Checkout Session
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  mode: 'subscription',
  payment_method_types: ['card'],
  line_items: [
    {
      price: priceId,        // e.g., "price_1ABC..." (Premium plan)
      quantity: 1,
    },
  ],
  success_url: `${appUrl}/dashboard/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${appUrl}/dashboard/subscription`,
  metadata: {
    user_id: user.id,
    plan_type: planType,     // "basic" or "premium"
  },
  subscription_data: {
    metadata: {
      user_id: user.id,
      plan_type: planType,
    },
  },
  allow_promotion_codes: true,
});

// Return checkout URL to frontend
return NextResponse.json({
  sessionId: session.id,
  url: session.url
});
```

**What happens**:
1. Calls Stripe API to create checkout session
2. Session includes:
   - Customer ID
   - Price ID (which plan they're buying)
   - Success/cancel URLs (where to redirect after payment)
   - Metadata (to identify user later)
3. Stripe returns checkout URL
4. Backend sends URL to frontend

---

#### Step 5: Redirect to Stripe Checkout
**Frontend receives response**:

```typescript
const response = await fetch('/api/checkout', { ... });
const { url } = await response.json();

// Redirect to Stripe's checkout page
window.location.href = url;
```

**What happens**:
- User redirected to Stripe's secure checkout page
- User enters credit card details
- Stripe processes payment
- If successful, Stripe redirects back to your app

---

### Step 6: Stripe Webhook (Payment Complete)
**File**: `app/api/webhooks/stripe/route.ts`

**When payment succeeds, Stripe sends webhook to your server**:

```typescript
export async function POST(request: NextRequest) {
  // 1. Verify webhook signature (security!)
  const signature = request.headers.get('stripe-signature');
  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );

  // 2. Handle different event types
  switch (event.type) {
    case 'checkout.session.completed':
      // Payment succeeded!
      const session = event.data.object;
      await handleCheckoutComplete(session);
      break;

    case 'customer.subscription.updated':
      // Subscription changed (e.g., upgraded)
      await handleSubscriptionUpdate(event.data.object);
      break;

    case 'customer.subscription.deleted':
      // Subscription cancelled
      await handleSubscriptionCancel(event.data.object);
      break;
  }

  return NextResponse.json({ received: true });
}
```

**What `handleCheckoutComplete()` does**:
```typescript
async function handleCheckoutComplete(session) {
  const userId = session.metadata.user_id;
  const planType = session.metadata.plan_type;

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription
  );

  // Store subscription in database
  await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: session.customer,
      status: 'active',
      plan_type: planType,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
    });
}
```

**What happens**:
1. Stripe calls your webhook endpoint
2. Your server verifies the webhook is really from Stripe (signature check)
3. Processes the event (subscription created, updated, cancelled)
4. Updates database to reflect subscription status
5. User now has access to premium features!

---

### Payment Processing Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ USER: Clicks "Upgrade to Premium"                               │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1: Create Checkout Session                                 │
│ File: app/api/checkout/route.ts:14                              │
│ - Verify user is logged in                                      │
│ - Check no existing active subscription                         │
│ - Validate plan selection                                       │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2: Get/Create Stripe Customer                              │
│ File: app/api/checkout/route.ts:77                              │
│ - Check if user has Stripe customer ID                          │
│ - If not, create customer in Stripe                             │
│ - Store customer ID in database                                 │
│   Table: stripe_customers                                        │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 3: Create Stripe Checkout Session                          │
│ File: app/api/checkout/route.ts:84                              │
│ Stripe API Call: stripe.checkout.sessions.create({              │
│   customer: customerId,                                          │
│   mode: 'subscription',                                          │
│   line_items: [{ price: 'price_1ABC...', quantity: 1 }],        │
│   metadata: { user_id, plan_type }                              │
│ })                                                               │
│ Returns: { url: "https://checkout.stripe.com/..." }             │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 4: Redirect to Stripe Checkout                             │
│ window.location.href = checkoutUrl                              │
│ - User sees Stripe's checkout page                              │
│ - User enters credit card                                       │
│ - Stripe processes payment                                      │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 5: Payment Succeeds                                        │
│ Stripe redirects to: /dashboard/subscription/success            │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│ STEP 6: Stripe Sends Webhook (Async)                            │
│ File: app/api/webhooks/stripe/route.ts                          │
│ Event: checkout.session.completed                               │
│ - Verify webhook signature                                      │
│ - Extract user_id and plan_type from metadata                   │
│ - Fetch subscription details from Stripe                        │
│ - Insert into subscriptions table                               │
│   Database INSERT: {                                             │
│     user_id: "...",                                              │
│     status: "active",                                            │
│     plan_type: "premium",                                        │
│     stripe_subscription_id: "sub_..."                           │
│   }                                                              │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│ ✅ User now has premium subscription!                            │
│ - Can connect unlimited Plaid accounts                          │
│ - Can export data                                                │
│ - Access to premium features                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Security Notes**:
- ✅ Credit card info NEVER touches your server (handled by Stripe)
- ✅ Webhook signatures verified to prevent fraud
- ✅ User ID stored in metadata to link payment to account

---

## 5. Database Architecture
### What Data is Stored and Why

Your database uses PostgreSQL (via Supabase) with Row Level Security.

---

### Core Tables

#### 1. `auth.users` (Managed by Supabase)
**Purpose**: Stores authentication credentials

```sql
TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  encrypted_password TEXT,
  created_at TIMESTAMPTZ
)
```

**Created when**: User signs up
**Why**: Handles login/logout, password resets

---

#### 2. `profiles`
**Purpose**: Extended user information

```sql
TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Created when**: User signs up (auto-created by database trigger)
**Why**: Store additional user info without modifying auth.users
**Example row**:
```
id: "abc-123"
email: "john@example.com"
full_name: "John Doe"
```

---

#### 3. `financial_accounts`
**Purpose**: Stores bank accounts, credit cards, investments

```sql
TABLE financial_accounts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT,                          -- "Chase Checking"
  account_type account_type,          -- checking, savings, credit_card, etc.
  institution_name TEXT,              -- "Chase"
  account_number_last4 TEXT,          -- "1234"
  current_balance DECIMAL(12, 2),     -- 5000.00
  available_balance DECIMAL(12, 2),   -- 4800.00
  currency TEXT DEFAULT 'USD',
  is_manual BOOLEAN,                  -- true = manually added, false = Plaid
  plaid_account_id TEXT,              -- Plaid's ID (if connected via Plaid)
  plaid_item_id TEXT,                 -- Plaid item ID
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Created when**:
- User connects bank via Plaid
- User manually adds account

**Why**: Track all financial accounts in one place
**Example rows**:
```
id: "acc-1", user_id: "abc-123", name: "Chase Checking",
account_type: "checking", current_balance: 5000.00, is_manual: false

id: "acc-2", user_id: "abc-123", name: "Chase Savings",
account_type: "savings", current_balance: 10000.00, is_manual: false

id: "acc-3", user_id: "abc-123", name: "Cash Wallet",
account_type: "other", current_balance: 250.00, is_manual: true
```

**Row Level Security**:
```sql
-- Users can only see their own accounts
CREATE POLICY "Users can view own accounts"
ON financial_accounts FOR SELECT
USING (auth.uid() = user_id);
```

---

#### 4. `transactions`
**Purpose**: Stores all financial transactions

```sql
TABLE transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  account_id UUID REFERENCES financial_accounts(id),
  amount DECIMAL(12, 2),              -- 45.67 (positive = expense, negative = income)
  description TEXT,                   -- "Starbucks Coffee"
  category transaction_category,      -- food, transportation, etc.
  transaction_date DATE,              -- 2025-01-15
  is_pending BOOLEAN,                 -- true if not yet cleared
  plaid_transaction_id TEXT,          -- Plaid's ID (if from Plaid)
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Created when**:
- Plaid syncs transactions from bank
- User manually adds transaction

**Why**: Track all spending and income
**Example rows**:
```
id: "txn-1", user_id: "abc-123", account_id: "acc-1",
amount: 4.50, description: "Starbucks", category: "food",
transaction_date: "2025-01-20", is_pending: false

id: "txn-2", user_id: "abc-123", account_id: "acc-1",
amount: 1500.00, description: "Rent Payment", category: "housing",
transaction_date: "2025-01-01", is_pending: false
```

**Indexes for performance**:
```sql
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
```
*Why indexes?* Make queries like "show all transactions this month" super fast!

---

#### 5. `budgets`
**Purpose**: User-defined spending limits

```sql
TABLE budgets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT,                          -- "Groceries Budget"
  category transaction_category,      -- food
  amount DECIMAL(12, 2),              -- 500.00
  period TEXT,                        -- "monthly", "yearly"
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Created when**: User creates budget
**Why**: Help users track spending vs. budget
**Example row**:
```
id: "bud-1", user_id: "abc-123", name: "Food Budget",
category: "food", amount: 500.00, period: "monthly"
```

---

#### 6. `savings_goals`
**Purpose**: Track savings targets

```sql
TABLE savings_goals (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT,                          -- "Vacation Fund"
  target_amount DECIMAL(12, 2),       -- 5000.00
  current_amount DECIMAL(12, 2),      -- 1250.00
  target_date DATE,                   -- 2025-06-01
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Created when**: User sets savings goal
**Why**: Motivate saving and track progress
**Example row**:
```
id: "goal-1", user_id: "abc-123", name: "Vacation Fund",
target_amount: 5000.00, current_amount: 1250.00,
target_date: "2025-06-01"
```

**Progress calculation** (in application code):
```typescript
const progress = (current_amount / target_amount) * 100; // 25%
```

---

### Plaid Integration Tables

#### 7. `plaid_items`
**Purpose**: Store Plaid access tokens (encrypted)

```sql
TABLE plaid_items (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  item_id TEXT UNIQUE,                -- Plaid's item ID
  access_token TEXT,                  -- Encrypted token
  institution_id TEXT,                -- "ins_3" (Chase)
  institution_name TEXT,              -- "Chase"
  status TEXT DEFAULT 'active',       -- active, error, requires_update
  error_code TEXT,                    -- If connection fails
  transactions_cursor TEXT,           -- For incremental sync
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Created when**: User connects bank via Plaid
**Why**:
- Store permanent access to bank data
- Track sync status
- Handle connection errors

**Security**: `access_token` is encrypted before storage!

**Example row**:
```
id: "item-1", user_id: "abc-123", item_id: "item_abc123",
access_token: "[encrypted]", institution_name: "Chase",
status: "active", last_sync: "2025-01-20 10:30:00"
```

---

### Subscription/Payment Tables

#### 8. `subscriptions`
**Purpose**: Track user subscription status

```sql
TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  stripe_subscription_id TEXT,        -- "sub_1ABC..."
  stripe_customer_id TEXT,            -- "cus_1ABC..."
  status TEXT,                        -- active, cancelled, past_due
  plan_type TEXT,                     -- free, basic, premium
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Created when**: Stripe webhook fires (after payment)
**Why**: Control feature access based on subscription
**Example row**:
```
id: "sub-1", user_id: "abc-123",
stripe_subscription_id: "sub_1ABC123",
status: "active", plan_type: "premium",
current_period_end: "2025-02-20"
```

**Used for**: Feature gating (check if user can access premium features)

---

#### 9. `stripe_customers`
**Purpose**: Map users to Stripe customers

```sql
TABLE stripe_customers (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  stripe_customer_id TEXT UNIQUE,     -- "cus_1ABC..."
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Created when**: User first attempts to subscribe
**Why**: Link your user IDs to Stripe customer IDs
**Example row**:
```
id: "cust-1", user_id: "abc-123",
stripe_customer_id: "cus_1ABC123"
```

---

### Budget Tracking Tables

#### 10. `expense_items`
**Purpose**: Recurring expenses for budget tracking

```sql
TABLE expense_items (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT,                          -- "Netflix"
  amount DECIMAL(12, 2),              -- 15.99
  frequency TEXT,                     -- monthly, weekly, yearly
  category transaction_category,      -- entertainment
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Created when**: User adds recurring expense
**Why**: Calculate monthly budget from recurring expenses
**Example row**:
```
id: "exp-1", user_id: "abc-123", name: "Netflix",
amount: 15.99, frequency: "monthly", category: "entertainment"
```

**Budget calculation** (in dashboard):
```typescript
// Convert all to monthly amount
const monthlyTotal = expenses.reduce((total, exp) => {
  if (exp.frequency === 'weekly') return total + (exp.amount * 4.33);
  if (exp.frequency === 'yearly') return total + (exp.amount / 12);
  return total + exp.amount; // monthly
}, 0);
```

---

#### 11. `financial_goals`
**Purpose**: Financial milestones

```sql
TABLE financial_goals (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  target_amount DECIMAL(12, 2),
  current_progress DECIMAL(12, 2),
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Created when**: User sets financial goal
**Why**: Track long-term financial objectives

---

### Logging Tables (For Debugging)

#### 12. `plaid_sync_logs`
**Purpose**: Track sync operations

```sql
TABLE plaid_sync_logs (
  id UUID PRIMARY KEY,
  user_id UUID,
  item_id TEXT,
  sync_type TEXT,                     -- balance, transaction
  status TEXT,                        -- success, error
  error_message TEXT,
  transactions_added INTEGER,
  transactions_modified INTEGER,
  transactions_removed INTEGER,
  created_at TIMESTAMPTZ
)
```

**Created when**: Every Plaid sync operation
**Why**: Debug sync issues, monitor performance

---

### Database Relationships Diagram

```
┌─────────────────┐
│   auth.users    │
│  (Supabase)     │
└────────┬────────┘
         │
         ├─────────────────────────────────────┐
         │                                     │
         ↓                                     ↓
┌─────────────────┐                  ┌─────────────────┐
│    profiles     │                  │  subscriptions  │
│  (User info)    │                  │   (Billing)     │
└─────────────────┘                  └─────────────────┘
         │                                     │
         ↓                                     │
┌─────────────────┐                           │
│financial_accounts│←──────────────────────────┤
│  (Bank accounts) │                           │
└────────┬────────┘                           │
         │                                     │
         ↓                                     ↓
┌─────────────────┐                  ┌─────────────────┐
│  transactions   │                  │stripe_customers │
│ (All spending)  │                  │ (Stripe mapping)│
└─────────────────┘                  └─────────────────┘
         │
         │
         ↓
┌─────────────────┐
│    budgets      │
│ (Spending limits)│
└─────────────────┘
         │
         ↓
┌─────────────────┐
│ savings_goals   │
│  (Save targets) │
└─────────────────┘
```

---

### Row Level Security (RLS)

**Every table has policies that enforce**:
```sql
-- Example: financial_accounts table
CREATE POLICY "Users can view own accounts"
ON financial_accounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts"
ON financial_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

**What this means**:
- Users can ONLY see their own data
- Impossible to access other users' accounts
- Enforced at database level (not just application)
- Even if your app has a bug, users can't see others' data

**Example query**:
```sql
-- User abc-123 is logged in
SELECT * FROM financial_accounts;

-- RLS automatically adds: WHERE user_id = 'abc-123'
-- User can ONLY see their accounts, even though they didn't filter!
```

This is **critical for security** in a financial app!

---

## Summary: Complete Data Journey

### User Connects Bank Account (Full Stack Trace)

```
1. BROWSER: User clicks button
   ↓
2. REACT COMPONENT: plaid-link-button.tsx calls API
   ↓
3. API ROUTE: /api/plaid/link-token
   - Checks auth (middleware)
   - Calls Plaid API
   - Returns token
   ↓
4. PLAID SDK: Opens bank login modal
   ↓
5. USER: Logs into bank
   ↓
6. PLAID: Returns public token
   ↓
7. REACT COMPONENT: Sends token to backend
   ↓
8. API ROUTE: /api/plaid/exchange-token
   - Exchanges for access token
   - Stores encrypted in plaid_items table
   - Fetches accounts from Plaid
   - Inserts into financial_accounts table
   - Fetches transactions from Plaid
   - Inserts into transactions table
   ↓
9. BROWSER: Page reloads
   ↓
10. DASHBOARD: Queries database
   - SELECT * FROM financial_accounts WHERE user_id = ?
   - SELECT * FROM transactions WHERE user_id = ?
   ↓
11. USER: Sees accounts and transactions!
```

**Database changes**: 3 tables updated, 849+ rows inserted, user's financial data now accessible!

---

## Key Takeaways for World-Class Engineers

### 1. **Middleware is the Gatekeeper**
Every request passes through `middleware.ts` FIRST. This is where authentication happens.

### 2. **Server vs Client Components**
- `'use client'` = Runs in browser (can use hooks, state)
- No directive = Server component (can access database directly)

### 3. **API Routes Are Your Backend**
Files in `app/api/**/route.ts` are server-side endpoints. They handle business logic, call external APIs, and interact with database.

### 4. **Security Layers**
1. Middleware checks auth
2. API routes verify user
3. Database enforces RLS policies
4. Encryption for sensitive data (Plaid tokens)

### 5. **Async Operations**
Notice how everything uses `async/await`. Modern web development is asynchronous - operations don't block each other.

### 6. **Data Flow Pattern**
```
User Action → Component → API Route → External Service → Database → API Response → Component Update → UI Refresh
```

### 7. **Third-Party Integrations**
- **Plaid**: Bank data (accounts, transactions)
- **Stripe**: Payments (subscriptions, billing)
- **Supabase**: Database + Auth (all user data)

Each has its own SDK, webhooks, and authentication flow.

---

## Further Learning

To master data flow in web applications:

1. **Trace more flows**: Pick a different action (e.g., creating a budget) and trace it yourself
2. **Read the database logs**: See actual SQL queries being run
3. **Use browser DevTools**: Watch Network tab to see API calls
4. **Console.log everything**: Add logs to understand execution order
5. **Draw diagrams**: Visualize data flow for complex features

**You're now equipped to understand how ANY feature works in this codebase!** 🚀

---

**Document Created**: 2025-01-21
**Author**: Claude (AI Assistant)
**For**: Aspiring World-Class Engineers
