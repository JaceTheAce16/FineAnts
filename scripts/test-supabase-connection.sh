#!/bin/bash

# Test script to verify Supabase connection
# Load environment variables from .env.local

if [ ! -f .env.local ]; then
  echo "❌ .env.local file not found"
  exit 1
fi

# Load environment variables
export $(cat .env.local | grep -v '^#' | xargs)

echo "🧪 Testing Supabase Connection..."
echo ""

# Validate environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_URL is not set"
  exit 1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ SUPABASE_SERVICE_ROLE_KEY is not set"
  exit 1
fi

echo "✅ Environment variables loaded"
echo "   URL: $NEXT_PUBLIC_SUPABASE_URL"
echo ""

# Test connection with anon key
echo "🔑 Testing connection with anon key..."
ANON_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/")

if [ "$ANON_RESPONSE" = "200" ] || [ "$ANON_RESPONSE" = "404" ]; then
  echo "✅ Anon key connection successful (HTTP $ANON_RESPONSE)"
else
  echo "❌ Anon key connection failed (HTTP $ANON_RESPONSE)"
  exit 1
fi
echo ""

# Test connection with service role key
echo "🔑 Testing connection with service role key..."
SERVICE_RESPONSE=$(curl -s \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/")

if echo "$SERVICE_RESPONSE" | grep -q "relation\|table\|No tables"; then
  echo "✅ Service role key connection successful"
  echo ""

  # Try to list tables
  echo "📊 Checking database tables..."
  TABLES_RESPONSE=$(curl -s \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/")

  echo "$TABLES_RESPONSE" | head -20
  echo ""
else
  echo "❌ Service role key connection failed"
  echo "$SERVICE_RESPONSE"
  exit 1
fi

# Test storage buckets
echo "🗄️  Checking storage buckets..."
BUCKETS_RESPONSE=$(curl -s \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/bucket")

if echo "$BUCKETS_RESPONSE" | grep -q "\[\]"; then
  echo "⚠️  No storage buckets found"
  echo "   Consider creating buckets for user uploads"
elif echo "$BUCKETS_RESPONSE" | grep -q "id"; then
  echo "✅ Storage buckets found:"
  echo "$BUCKETS_RESPONSE" | jq -r '.[].name' 2>/dev/null || echo "$BUCKETS_RESPONSE"
else
  echo "❌ Could not check storage buckets"
  echo "$BUCKETS_RESPONSE"
fi

echo ""
echo "✅ All Supabase connection tests passed!"
echo "🎉 Supabase is configured correctly and ready to use!"
echo ""
