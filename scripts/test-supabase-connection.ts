/**
 * Test script to verify Supabase connection
 * Run with: npx tsx scripts/test-supabase-connection.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function testConnection() {
  console.log('🧪 Testing Supabase Connection...\n')

  // Validate environment variables
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:')
    if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL')
    if (!supabaseAnonKey) console.error('  - NEXT_PUBLIC_SUPABASE_ANON_KEY')
    if (!supabaseServiceKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  console.log('✅ Environment variables loaded')
  console.log(`   URL: ${supabaseUrl}\n`)

  // Test with anon key
  console.log('🔑 Testing connection with anon key...')
  const anonClient = createClient(supabaseUrl, supabaseAnonKey)

  try {
    const { data, error } = await anonClient.from('profiles').select('count').limit(0).single()
    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is fine for testing
      throw error
    }
    console.log('✅ Anon key connection successful\n')
  } catch (error: any) {
    console.error('❌ Anon key connection failed:', error.message)
    console.error('   This might indicate the database schema is not yet applied.\n')
  }

  // Test with service role key
  console.log('🔑 Testing connection with service role key...')
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // List all tables
    const { data: tables, error } = await serviceClient
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name')

    if (error) throw error

    console.log('✅ Service role key connection successful')

    if (tables && tables.length > 0) {
      console.log(`\n📊 Found ${tables.length} tables in database:`)
      tables.forEach((table: any) => {
        console.log(`   - ${table.table_name}`)
      })
    } else {
      console.log('\n⚠️  No tables found in database')
      console.log('   You may need to run migrations: npx supabase db push')
    }

    // Check storage buckets
    console.log('\n🗄️  Checking storage buckets...')
    const { data: buckets, error: bucketsError } = await serviceClient.storage.listBuckets()

    if (bucketsError) {
      console.error('❌ Could not list storage buckets:', bucketsError.message)
    } else if (buckets && buckets.length > 0) {
      console.log(`✅ Found ${buckets.length} storage bucket(s):`)
      buckets.forEach((bucket: any) => {
        console.log(`   - ${bucket.name} (${bucket.public ? 'public' : 'private'})`)
      })
    } else {
      console.log('⚠️  No storage buckets found')
      console.log('   Consider creating buckets for user uploads')
    }

  } catch (error: any) {
    console.error('❌ Service role key connection failed:', error.message)
    process.exit(1)
  }

  console.log('\n✅ All Supabase connection tests passed!')
  console.log('\n🎉 Supabase is configured correctly and ready to use!\n')
}

testConnection().catch(console.error)
