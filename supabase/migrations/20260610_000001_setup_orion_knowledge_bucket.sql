-- Setup Supabase Storage bucket for ORION knowledge base documents

-- 1. Create the bucket
insert into storage.buckets (id, name, public)
values ('orion_knowledge', 'orion_knowledge', false)
on conflict (id) do nothing;

-- 2. RLS policies for storage.objects
drop policy if exists "Authenticated users can upload knowledge docs" on storage.objects;
drop policy if exists "Authenticated users can read knowledge docs" on storage.objects;
drop policy if exists "Authenticated users can delete knowledge docs" on storage.objects;
drop policy if exists "orion_knowledge_admin_upload" on storage.objects;
drop policy if exists "orion_knowledge_admin_read" on storage.objects;
drop policy if exists "orion_knowledge_admin_delete" on storage.objects;

create policy "orion_knowledge_admin_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'orion_knowledge'
    and (
      public.user_is_admin((select auth.uid()))
      or public.user_can_access_module((select auth.uid()), 'ai_assistant')
    )
  );

create policy "orion_knowledge_admin_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'orion_knowledge'
    and (
      public.user_is_admin((select auth.uid()))
      or public.user_can_access_module((select auth.uid()), 'ai_assistant')
    )
  );

create policy "orion_knowledge_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'orion_knowledge'
    and (
      public.user_is_admin((select auth.uid()))
      or public.user_can_access_module((select auth.uid()), 'ai_assistant')
    )
  );
