-- Setup Supabase Storage bucket for ORION knowledge base documents

-- 1. Create the bucket
insert into storage.buckets (id, name, public)
values ('orion_knowledge', 'orion_knowledge', false)
on conflict (id) do nothing;

-- 2. RLS policies for storage.objects
-- Allow 'authenticated' users to upload objects
create policy "Authenticated users can upload knowledge docs"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'orion_knowledge' );

-- Allow 'authenticated' users to read objects
create policy "Authenticated users can read knowledge docs"
  on storage.objects for select
  to authenticated
  using ( bucket_id = 'orion_knowledge' );

-- Allow 'authenticated' users to delete objects
create policy "Authenticated users can delete knowledge docs"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'orion_knowledge' );
