-- EEES-DB-005: approved
-- owner: Engineering
-- rollback: forward-only; recrear el esquema desde las migraciones ORION históricas y restaurar respaldos antes de volver a desplegar sus Edge Functions.

begin;

-- Storage binaries must be deleted through the Storage API before this migration.
-- Refuse to orphan files by deleting storage.objects rows directly.
do $$
begin
  if exists (
    select 1
    from storage.objects
    where bucket_id = 'orion_knowledge'
  ) then
    raise exception 'Empty the orion_knowledge bucket through the Storage API before removing ORION.';
  end if;
end;
$$;

drop policy if exists "Authenticated users can upload knowledge docs" on storage.objects;
drop policy if exists "Authenticated users can read knowledge docs" on storage.objects;
drop policy if exists "Authenticated users can delete knowledge docs" on storage.objects;
drop policy if exists "orion_knowledge_admin_upload" on storage.objects;
drop policy if exists "orion_knowledge_admin_read" on storage.objects;
drop policy if exists "orion_knowledge_admin_delete" on storage.objects;

-- The empty bucket is removed through the Storage API before this migration.

drop function if exists public.orion_get_hiring_summary();
drop function if exists public.orion_search_candidate(text);
drop function if exists public.match_knowledge_documents(extensions.vector, double precision, integer);

drop table if exists public.orion_messages;
drop table if exists public.orion_sessions;
drop table if exists public.orion_knowledge_base;

delete from public.role_module_access
where module_code = 'ai_assistant';

delete from public.app_modules
where code = 'ai_assistant';

notify pgrst, 'reload schema';

commit;
