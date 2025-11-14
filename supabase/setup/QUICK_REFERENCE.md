# Supabase Quick Reference Guide

Quick reference for common Supabase operations in FineAnts.

## Table of Contents
- [Client Setup](#client-setup)
- [Authentication](#authentication)
- [Database Queries](#database-queries)
- [Storage Operations](#storage-operations)
- [Realtime Subscriptions](#realtime-subscriptions)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

---

## Client Setup

### Browser Client (Client Components)
```typescript
import { createClient } from '@/lib/supabase/client'

// In a client component or browser context
const supabase = createClient()
```

### Server Client (Server Components, API Routes)
```typescript
import { createClient } from '@/lib/supabase/server'

// In server components, API routes, or server actions
const supabase = await createClient()
```

### Service Role Client (Bypass RLS)
```typescript
import { createClient } from '@supabase/supabase-js'

// Only use on server-side, never expose to client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

---

## Authentication

### Sign Up
```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword',
  options: {
    data: {
      full_name: 'John Doe'
    }
  }
})
```

### Sign In
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securepassword'
})
```

### Sign Out
```typescript
const { error } = await supabase.auth.signOut()
```

### Get Current User
```typescript
const { data: { user } } = await supabase.auth.getUser()
```

### Get Session
```typescript
const { data: { session } } = await supabase.auth.getSession()
```

### OAuth Sign In
```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`
  }
})
```

### Reset Password
```typescript
// Request password reset
const { error } = await supabase.auth.resetPasswordForEmail(
  'user@example.com',
  {
    redirectTo: `${window.location.origin}/auth/reset-password`
  }
})

// Update password (after clicking reset link)
const { error } = await supabase.auth.updateUser({
  password: 'newpassword'
})
```

---

## Database Queries

### Select
```typescript
// Select all columns
const { data, error } = await supabase
  .from('transactions')
  .select('*')

// Select specific columns
const { data, error } = await supabase
  .from('transactions')
  .select('id, name, amount, date')

// Select with join
const { data, error } = await supabase
  .from('transactions')
  .select(`
    *,
    financial_accounts (
      id,
      name,
      type
    )
  `)

// Select single row
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single()

// Count rows
const { count, error } = await supabase
  .from('transactions')
  .select('*', { count: 'exact', head: true })
```

### Filtering
```typescript
// Equal
.eq('status', 'active')

// Not equal
.neq('status', 'deleted')

// Greater than
.gt('amount', 100)

// Greater than or equal
.gte('amount', 100)

// Less than
.lt('amount', 100)

// Less than or equal
.lte('amount', 100)

// Like (pattern matching)
.like('name', '%coffee%')

// iLike (case insensitive)
.ilike('name', '%coffee%')

// In array
.in('status', ['active', 'pending'])

// Is null
.is('deleted_at', null)

// Multiple filters (AND)
.eq('user_id', userId)
.gte('date', '2024-01-01')
.lte('date', '2024-12-31')

// OR filters
.or('status.eq.active,status.eq.pending')

// Text search
.textSearch('description', 'coffee')
```

### Ordering and Pagination
```typescript
// Order by
.order('date', { ascending: false })

// Multiple order by
.order('date', { ascending: false })
.order('amount', { ascending: true })

// Limit
.limit(10)

// Range (pagination)
.range(0, 9)  // First 10 items (0-9)
.range(10, 19)  // Next 10 items (10-19)

// Complete pagination example
const page = 1
const pageSize = 20
const from = (page - 1) * pageSize
const to = from + pageSize - 1

const { data, error, count } = await supabase
  .from('transactions')
  .select('*', { count: 'exact' })
  .order('date', { ascending: false })
  .range(from, to)
```

### Insert
```typescript
// Insert single row
const { data, error } = await supabase
  .from('budgets')
  .insert({
    category: 'groceries',
    amount: 500,
    period: 'monthly'
  })
  .select()

// Insert multiple rows
const { data, error } = await supabase
  .from('transactions')
  .insert([
    { name: 'Coffee', amount: 5.50 },
    { name: 'Lunch', amount: 12.00 }
  ])
  .select()
```

### Update
```typescript
// Update by ID
const { data, error } = await supabase
  .from('profiles')
  .update({ full_name: 'Jane Doe' })
  .eq('id', userId)
  .select()

// Update with filter
const { data, error } = await supabase
  .from('budgets')
  .update({ amount: 600 })
  .eq('category', 'groceries')
  .eq('user_id', userId)
  .select()
```

### Upsert (Insert or Update)
```typescript
const { data, error } = await supabase
  .from('profiles')
  .upsert({
    id: userId,
    full_name: 'John Doe',
    updated_at: new Date().toISOString()
  })
  .select()
```

### Delete
```typescript
// Delete by ID
const { error } = await supabase
  .from('transactions')
  .delete()
  .eq('id', transactionId)

// Delete with filter
const { error } = await supabase
  .from('transactions')
  .delete()
  .eq('user_id', userId)
  .lt('date', '2020-01-01')
```

### Stored Procedures
```typescript
// Call stored procedure
const { data, error } = await supabase
  .rpc('cleanup_old_exports')

// Call with parameters
const { data, error } = await supabase
  .rpc('calculate_budget_spent', {
    p_user_id: userId,
    p_category: 'groceries',
    p_start_date: '2024-01-01',
    p_end_date: '2024-12-31'
  })
```

---

## Storage Operations

### Upload File
```typescript
const file = event.target.files[0]
const filePath = `${userId}/receipt-${Date.now()}.pdf`

const { data, error } = await supabase.storage
  .from('documents')
  .upload(filePath, file, {
    cacheControl: '3600',
    upsert: false
  })
```

### Download File
```typescript
const { data, error } = await supabase.storage
  .from('documents')
  .download(`${userId}/receipt.pdf`)

// Create download URL
if (data) {
  const url = URL.createObjectURL(data)
  // Use url for download
}
```

### Get Public URL
```typescript
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl(`${userId}/avatar.jpg`)

// data.publicUrl contains the URL
```

### Get Signed URL (Private Files)
```typescript
const { data, error } = await supabase.storage
  .from('documents')
  .createSignedUrl(`${userId}/receipt.pdf`, 60) // Expires in 60 seconds
```

### List Files
```typescript
const { data, error } = await supabase.storage
  .from('documents')
  .list(userId, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' }
  })
```

### Delete File
```typescript
const { error } = await supabase.storage
  .from('documents')
  .remove([`${userId}/old-receipt.pdf`])

// Delete multiple files
const { error } = await supabase.storage
  .from('documents')
  .remove([
    `${userId}/file1.pdf`,
    `${userId}/file2.pdf`
  ])
```

### Move File
```typescript
const { error } = await supabase.storage
  .from('documents')
  .move(
    `${userId}/old-path/file.pdf`,
    `${userId}/new-path/file.pdf`
  )
```

---

## Realtime Subscriptions

### Subscribe to Table Changes
```typescript
const channel = supabase
  .channel('transactions-changes')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'transactions'
    },
    (payload) => {
      console.log('New transaction:', payload.new)
    }
  )
  .subscribe()

// Cleanup
supabase.removeChannel(channel)
```

### Subscribe to All Events
```typescript
const channel = supabase
  .channel('all-changes')
  .on(
    'postgres_changes',
    {
      event: '*', // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'budgets'
    },
    (payload) => {
      console.log('Change:', payload)
    }
  )
  .subscribe()
```

### Subscribe with Filter
```typescript
const channel = supabase
  .channel(`account-${accountId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'financial_accounts',
      filter: `id=eq.${accountId}`
    },
    (payload) => {
      console.log('Account updated:', payload.new)
    }
  )
  .subscribe()
```

---

## Common Patterns

### Fetch Data in Server Component
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function TransactionsPage() {
  const supabase = await createClient()

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .limit(50)

  return (
    <div>
      {transactions?.map(t => (
        <div key={t.id}>{t.name}</div>
      ))}
    </div>
  )
}
```

### Fetch Data in Client Component
```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export function TransactionsList() {
  const [transactions, setTransactions] = useState([])
  const supabase = createClient()

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
      setTransactions(data || [])
    }

    fetchTransactions()
  }, [])

  return (
    <div>
      {transactions.map(t => (
        <div key={t.id}>{t.name}</div>
      ))}
    </div>
  )
}
```

### Server Action (Form Submission)
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createBudget(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('budgets')
    .insert({
      user_id: user.id,
      category: formData.get('category'),
      amount: Number(formData.get('amount')),
      period: formData.get('period')
    })

  if (error) throw error

  revalidatePath('/budgets')
}
```

### Protected API Route
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
```

### Optimistic Updates
```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export function TodoList() {
  const [todos, setTodos] = useState([])
  const supabase = createClient()

  const addTodo = async (text: string) => {
    // Optimistic update
    const newTodo = { id: crypto.randomUUID(), text, done: false }
    setTodos([...todos, newTodo])

    // Actual insert
    const { data, error } = await supabase
      .from('todos')
      .insert({ text })
      .select()
      .single()

    if (error) {
      // Revert on error
      setTodos(todos)
      console.error(error)
    } else {
      // Update with real ID
      setTodos([...todos, data])
    }
  }

  return <div>{/* Render todos */}</div>
}
```

---

## Troubleshooting

### Error: "new row violates row-level security policy"
**Cause:** RLS policy is blocking the operation
**Solution:**
1. Check RLS policies for the table
2. Ensure `user_id` is correctly set
3. Use service role key if operation should bypass RLS

### Error: "JWT expired"
**Cause:** User session has expired
**Solution:**
```typescript
const { data, error } = await supabase.auth.refreshSession()
```

### Error: "relation does not exist"
**Cause:** Table hasn't been created
**Solution:** Apply database migrations

### Error: "permission denied for table"
**Cause:** Missing RLS policy or using wrong client
**Solution:**
1. Check RLS policies
2. Ensure using correct client (server vs browser)
3. Check user is authenticated

### Slow Queries
**Cause:** Missing indexes
**Solution:**
```sql
CREATE INDEX idx_transactions_user_date
ON transactions(user_id, date DESC);
```

### Too Many Connections
**Cause:** Not cleaning up connections
**Solution:** Ensure you're reusing the Supabase client, not creating new ones

---

## Environment Variables Reference

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # Server-side only!

# Optional (for local development)
SUPABASE_ACCESS_TOKEN=sbp_xxx  # For CLI
SUPABASE_DB_PASSWORD=xxx  # For direct DB access
```

---

## Useful SQL Queries

### Check Table Sizes
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check RLS Policies
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Check Active Connections
```sql
SELECT
  count(*),
  state,
  usename
FROM pg_stat_activity
GROUP BY state, usename;
```

### Check Slow Queries
```sql
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

**Last Updated:** 2024-11-14
