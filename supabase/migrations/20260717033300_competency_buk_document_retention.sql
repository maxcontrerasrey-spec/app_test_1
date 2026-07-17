begin;

alter table public.competency_certificates
  alter column buk_folder_name set default 'Acreditacion',
  add column if not exists buk_document_name text,
  add column if not exists storage_purged_at timestamptz,
  add column if not exists storage_purge_status text not null default 'pending',
  add column if not exists storage_purge_error text;

alter table public.competency_certificates
  drop constraint if exists competency_certificates_storage_purge_status_check;

alter table public.competency_certificates
  add constraint competency_certificates_storage_purge_status_check
  check (storage_purge_status in ('pending', 'success', 'failed', 'skipped'));

alter table public.competency_evaluations
  add column if not exists buk_folder_name text,
  add column if not exists buk_folder_id text,
  add column if not exists buk_document_id text,
  add column if not exists buk_document_url text,
  add column if not exists buk_document_name text,
  add column if not exists buk_uploaded_at timestamptz,
  add column if not exists storage_purged_at timestamptz,
  add column if not exists storage_purge_status text not null default 'pending',
  add column if not exists storage_purge_error text;

alter table public.competency_evaluations
  drop constraint if exists competency_evaluations_storage_purge_status_check;

alter table public.competency_evaluations
  add constraint competency_evaluations_storage_purge_status_check
  check (storage_purge_status in ('pending', 'success', 'failed', 'skipped'));

create index if not exists idx_competency_evaluations_buk_upload
  on public.competency_evaluations (buk_uploaded_at, storage_purge_status);

create index if not exists idx_competency_certificates_storage_purge
  on public.competency_certificates (buk_upload_status, storage_purge_status);

update public.competency_certificates
set buk_folder_name = 'Acreditacion'
where buk_folder_name = 'Competencias';

notify pgrst, 'reload schema';

commit;
