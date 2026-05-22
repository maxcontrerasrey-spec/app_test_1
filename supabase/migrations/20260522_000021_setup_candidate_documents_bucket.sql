-- Setup Supabase Storage bucket for candidate documents

-- 1. Create the bucket
insert into storage.buckets (id, name, public)
values ('candidate-docs', 'candidate-docs', false)
on conflict (id) do nothing;

-- 2. RLS policies for storage.objects
-- Allow 'authenticated' users to upload objects to the 'candidate-docs' bucket
create policy "Authenticated users can upload candidate docs"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'candidate-docs' );

-- Allow 'authenticated' users to read objects from the 'candidate-docs' bucket
create policy "Authenticated users can read candidate docs"
  on storage.objects for select
  to authenticated
  using ( bucket_id = 'candidate-docs' );

-- Allow 'authenticated' users to update objects in the 'candidate-docs' bucket
create policy "Authenticated users can update candidate docs"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'candidate-docs' );

-- Allow 'authenticated' users to delete objects from the 'candidate-docs' bucket
create policy "Authenticated users can delete candidate docs"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'candidate-docs' );

-- Note: Finer-grained RLS (checking if the user has access to the specific recruitment case) 
-- is already enforced at the DB level on the candidate_documents table. 
-- The bucket policies are kept permissive for 'authenticated' to simplify the upload flow,
-- as the true source of truth for "who can upload/approve" is handled by the RPCs.
