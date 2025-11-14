-- Storage Buckets Configuration for FineAnts
-- Run this SQL in your Supabase SQL Editor to set up storage buckets

-- ============================================================================
-- 1. Documents Bucket (Private)
-- For storing financial documents, receipts, and statements
-- ============================================================================

-- Create the documents bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  5242880, -- 5MB limit
  array[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- xlsx
    'text/csv'
  ]
)
on conflict (id) do nothing;

-- RLS Policy: Users can upload their own documents
-- Documents are organized by user ID: documents/{user_id}/{filename}
create policy "Users can upload their own documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Users can view their own documents
create policy "Users can view their own documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Users can update their own documents
create policy "Users can update their own documents"
on storage.objects for update
to authenticated
using (
  bucket_id = 'documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Users can delete their own documents
create policy "Users can delete their own documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- 2. Avatars Bucket (Public)
-- For storing user profile pictures
-- ============================================================================

-- Create the avatars bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true, -- Public bucket for easy CDN access
  2097152, -- 2MB limit
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do nothing;

-- RLS Policy: Avatar images are publicly accessible
create policy "Avatar images are publicly accessible"
on storage.objects for select
to public
using (bucket_id = 'avatars');

-- RLS Policy: Users can upload their own avatar
-- Avatars are organized by user ID: avatars/{user_id}/avatar.jpg
create policy "Users can upload their own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Users can update their own avatar
create policy "Users can update their own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Users can delete their own avatar
create policy "Users can delete their own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- 3. Exports Bucket (Private, Temporary)
-- For storing temporary data exports (CSV, PDF reports)
-- ============================================================================

-- Create the exports bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exports',
  'exports',
  false,
  10485760, -- 10MB limit
  array[
    'application/pdf',
    'text/csv',
    'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

-- RLS Policy: Users can access their own exports
create policy "Users can access their own exports"
on storage.objects for select
to authenticated
using (
  bucket_id = 'exports'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Service role can create exports
-- This allows backend to generate export files
create policy "Service role can create exports"
on storage.objects for insert
to service_role
with check (bucket_id = 'exports');

-- RLS Policy: Users can delete their own exports
create policy "Users can delete their own exports"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'exports'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- 4. Storage Helper Functions
-- ============================================================================

-- Function to clean up old export files (run daily via cron or edge function)
create or replace function cleanup_old_exports()
returns void
language plpgsql
security definer
as $$
begin
  delete from storage.objects
  where bucket_id = 'exports'
  and created_at < now() - interval '7 days';
end;
$$;

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Run this to verify buckets were created successfully
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
from storage.buckets
where id in ('documents', 'avatars', 'exports')
order by created_at;

-- ============================================================================
-- Usage Examples
-- ============================================================================

-- Upload a document (from TypeScript/JavaScript):
/*
const { data, error } = await supabase.storage
  .from('documents')
  .upload(`${userId}/receipt-2024-01-01.pdf`, file)
*/

-- Get public URL for avatar:
/*
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl(`${userId}/avatar.jpg`)
*/

-- Download a document:
/*
const { data, error } = await supabase.storage
  .from('documents')
  .download(`${userId}/receipt-2024-01-01.pdf`)
*/

-- List user's documents:
/*
const { data, error } = await supabase.storage
  .from('documents')
  .list(userId)
*/

-- Delete a file:
/*
const { data, error } = await supabase.storage
  .from('documents')
  .remove([`${userId}/old-receipt.pdf`])
*/
