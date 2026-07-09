begin;

drop policy if exists "orion_knowledge_base_select_ai_assistant" on public.orion_knowledge_base;
drop policy if exists "orion_knowledge_base_delete_ai_assistant" on public.orion_knowledge_base;

create policy "orion_knowledge_base_select_admin"
on public.orion_knowledge_base
for select
to authenticated
using (public.user_is_admin((select auth.uid())));

create policy "orion_knowledge_base_delete_admin"
on public.orion_knowledge_base
for delete
to authenticated
using (public.user_is_admin((select auth.uid())));

drop policy if exists "orion_knowledge_admin_upload" on storage.objects;
drop policy if exists "orion_knowledge_admin_read" on storage.objects;
drop policy if exists "orion_knowledge_admin_delete" on storage.objects;

create policy "orion_knowledge_admin_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'orion_knowledge'
  and public.user_is_admin((select auth.uid()))
);

create policy "orion_knowledge_admin_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'orion_knowledge'
  and public.user_is_admin((select auth.uid()))
);

create policy "orion_knowledge_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'orion_knowledge'
  and public.user_is_admin((select auth.uid()))
);

notify pgrst, 'reload schema';

commit;
