-- Realtime Configuration for FineAnts
-- Run this SQL in your Supabase SQL Editor to enable realtime features

-- ============================================================================
-- Enable Realtime for Tables
-- ============================================================================

-- Note: Realtime is optional and adds overhead. Only enable for tables that
-- truly need live updates. Consider whether polling would be more appropriate.

-- Enable realtime for transactions (HIGH PRIORITY)
-- Use case: Show new transactions as they're synced from Plaid
alter publication supabase_realtime add table transactions;

-- Enable realtime for financial_accounts (MEDIUM PRIORITY)
-- Use case: Update account balances in real-time
alter publication supabase_realtime add table financial_accounts;

-- Enable realtime for budgets (LOW PRIORITY)
-- Use case: Show budget updates if user is editing from multiple devices
alter publication supabase_realtime add table budgets;

-- Enable realtime for savings_goals (LOW PRIORITY)
-- Use case: Show progress updates in real-time
alter publication supabase_realtime add table savings_goals;

-- Enable realtime for subscriptions (MEDIUM PRIORITY)
-- Use case: Show subscription status changes immediately
alter publication supabase_realtime add table subscriptions;

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Run this to verify realtime is enabled for the correct tables
select
  schemaname,
  tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;

-- ============================================================================
-- Realtime Usage Examples (TypeScript/React)
-- ============================================================================

/*
// Example 1: Listen to transaction inserts
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export function RealtimeTransactions() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState([])

  useEffect(() => {
    // Fetch initial data
    const fetchTransactions = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(50)
      setTransactions(data || [])
    }

    fetchTransactions()

    // Subscribe to realtime changes
    const channel = supabase
      .channel('transactions-all-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions'
        },
        (payload) => {
          console.log('New transaction:', payload.new)
          // Add new transaction to the top of the list
          setTransactions((current) => [payload.new, ...current])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions'
        },
        (payload) => {
          console.log('Transaction updated:', payload.new)
          // Update the transaction in the list
          setTransactions((current) =>
            current.map((t) =>
              t.id === payload.new.id ? payload.new : t
            )
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'transactions'
        },
        (payload) => {
          console.log('Transaction deleted:', payload.old)
          // Remove the transaction from the list
          setTransactions((current) =>
            current.filter((t) => t.id !== payload.old.id)
          )
        }
      )
      .subscribe()

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div>
      {transactions.map((transaction) => (
        <div key={transaction.id}>{transaction.name}</div>
      ))}
    </div>
  )
}

// Example 2: Listen to account balance updates
export function RealtimeAccountBalance({ accountId }: { accountId: string }) {
  const supabase = createClient()
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    // Fetch initial balance
    const fetchBalance = async () => {
      const { data } = await supabase
        .from('financial_accounts')
        .select('balance')
        .eq('id', accountId)
        .single()
      setBalance(data?.balance || 0)
    }

    fetchBalance()

    // Subscribe to balance updates for this specific account
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
          console.log('Balance updated:', payload.new.balance)
          setBalance(payload.new.balance)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [accountId])

  return (
    <div>
      Balance: ${balance?.toFixed(2)}
    </div>
  )
}

// Example 3: Listen to budget updates
export function RealtimeBudgets() {
  const supabase = createClient()
  const [budgets, setBudgets] = useState([])

  useEffect(() => {
    const fetchBudgets = async () => {
      const { data } = await supabase
        .from('budgets')
        .select('*')
        .order('category')
      setBudgets(data || [])
    }

    fetchBudgets()

    const channel = supabase
      .channel('budgets-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'budgets'
        },
        (payload) => {
          console.log('Budget change:', payload)
          // Refetch budgets when any change occurs
          fetchBudgets()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div>
      {budgets.map((budget) => (
        <div key={budget.id}>
          {budget.category}: ${budget.amount}
        </div>
      ))}
    </div>
  )
}

// Example 4: Presence - Show who else is viewing the page
export function RealtimePresence() {
  const supabase = createClient()
  const [onlineUsers, setOnlineUsers] = useState([])

  useEffect(() => {
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: 'user_id'
        }
      }
    })

    // Track presence
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = Object.values(state).flat()
        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Send presence event when connected
          await channel.track({
            user_id: 'current-user-id',
            online_at: new Date().toISOString()
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div>
      Online users: {onlineUsers.length}
    </div>
  )
}

// Example 5: Broadcast - Send messages to other connected clients
export function RealtimeBroadcast() {
  const supabase = createClient()
  const [messages, setMessages] = useState([])

  useEffect(() => {
    const channel = supabase.channel('room1')

    channel
      .on('broadcast', { event: 'message' }, (payload) => {
        console.log('Received message:', payload)
        setMessages((current) => [...current, payload])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const sendMessage = async (message: string) => {
    const channel = supabase.channel('room1')
    await channel.send({
      type: 'broadcast',
      event: 'message',
      payload: { text: message }
    })
  }

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.text}</div>
      ))}
      <button onClick={() => sendMessage('Hello!')}>
        Send Message
      </button>
    </div>
  )
}
*/

-- ============================================================================
-- Performance Considerations
-- ============================================================================

/*
1. Realtime connections consume resources on both client and server
   - Each subscription creates a WebSocket connection
   - Limit the number of active subscriptions per client

2. Filter events on the server when possible
   - Use filter: `id=eq.${accountId}` to only receive relevant updates
   - This reduces network traffic and client processing

3. Consider debouncing updates
   - If updates are frequent, debounce state updates on the client
   - Use a queue to batch multiple updates together

4. Cleanup is critical
   - Always remove channels in useEffect cleanup
   - Unsubscribed channels continue consuming resources if not removed

5. Alternative: Polling
   - For less critical data, polling may be simpler and more efficient
   - Use SWR or React Query with refetchInterval for automatic polling

Example polling with SWR:
```typescript
import useSWR from 'swr'

function Transactions() {
  const { data, error } = useSWR(
    'transactions',
    async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
      return data
    },
    { refreshInterval: 5000 } // Poll every 5 seconds
  )

  return <div>{JSON.stringify(data)}</div>
}
```
*/

-- ============================================================================
-- Monitoring Realtime
-- ============================================================================

-- Check active realtime connections (from Supabase Dashboard)
-- Dashboard > Database > Replication

-- Monitor realtime performance in logs
-- Dashboard > Logs > Realtime Logs

-- ============================================================================
-- Disabling Realtime (if needed)
-- ============================================================================

-- To disable realtime for a specific table:
-- alter publication supabase_realtime drop table transactions;

-- To disable realtime for all tables:
-- alter publication supabase_realtime set table;

-- ============================================================================
-- Security Notes
-- ============================================================================

/*
1. Row Level Security (RLS) applies to realtime events
   - Clients only receive events for rows they have access to
   - Make sure RLS policies are properly configured

2. Broadcast and Presence are not filtered by RLS
   - Anyone subscribed to a channel can receive broadcast messages
   - Use authorization checks in your application logic

3. Realtime events contain the full row data
   - Be careful not to expose sensitive information
   - Consider using triggers to emit custom events with filtered data
*/
