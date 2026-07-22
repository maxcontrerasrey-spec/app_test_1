begin;

create table if not exists public.accreditation_document_upload_jobs (
  id uuid primary key default gen_random_uuid(),
  operation_key text not null unique,
  actor_user_id uuid not null references public.profiles(id),
  buk_employee_id text not null,
  site_id uuid not null references public.accreditation_sites(id),
  requirement_id uuid not null references public.accreditation_requirements(id),
  file_sha256 text not null,
  request_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'buk_uploaded', 'success', 'error')),
  attempts integer not null default 0 check (attempts >= 0),
  result_snapshot jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists accreditation_document_upload_jobs_business_uidx
  on public.accreditation_document_upload_jobs (
    buk_employee_id, site_id, requirement_id, file_sha256, operation_key
  );

alter table public.accreditation_document_upload_jobs enable row level security;
revoke all on public.accreditation_document_upload_jobs from public, anon, authenticated;
grant select, insert, update on public.accreditation_document_upload_jobs to service_role;

commit;
