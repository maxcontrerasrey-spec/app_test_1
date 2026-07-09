begin;

drop policy if exists "operational_onboarding_storage_insert" on storage.objects;
drop policy if exists "operational_onboarding_storage_select" on storage.objects;
drop policy if exists "operational_onboarding_storage_update" on storage.objects;
drop policy if exists "operational_onboarding_storage_delete" on storage.objects;

notify pgrst, 'reload schema';

commit;
