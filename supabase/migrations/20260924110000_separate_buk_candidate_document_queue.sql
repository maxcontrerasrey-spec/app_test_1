-- EEES-DB-005: approved
-- owner: Recruitment and HR Integrations
-- rollback: forward-only; preserve queue history and disable workers before any rollback plan.

begin;

create table if not exists public.buk_candidate_document_jobs (
  id uuid primary key default gen_random_uuid(),
  buk_sync_job_id uuid not null references public.buk_sync_jobs(id) on delete cascade,
  recruitment_case_candidate_id uuid not null references public.recruitment_case_candidates(id) on delete cascade,
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  buk_employee_id text not null,
  source_document_id uuid not null,
  source_document_name text not null,
  source_file_path text null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'success', 'failed', 'reconciliation_required')),
  attempts integer not null default 0 check (attempts >= 0),
  buk_document_id text null,
  buk_document_url text null,
  buk_employee_folder_id text null,
  buk_document_name text null,
  transport text null,
  response_snapshot jsonb not null default '{}'::jsonb,
  storage_cleanup_error text null,
  last_error text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (buk_sync_job_id, source_document_id)
);

create index if not exists idx_buk_candidate_document_jobs_status_created
  on public.buk_candidate_document_jobs (status, created_at asc);

create index if not exists idx_buk_candidate_document_jobs_sync_job
  on public.buk_candidate_document_jobs (buk_sync_job_id, status, created_at asc);

create index if not exists idx_buk_candidate_document_jobs_candidate
  on public.buk_candidate_document_jobs (recruitment_case_candidate_id, status);

drop trigger if exists trg_buk_candidate_document_jobs_set_updated_at
  on public.buk_candidate_document_jobs;
create trigger trg_buk_candidate_document_jobs_set_updated_at
before update on public.buk_candidate_document_jobs
for each row execute function public.set_updated_at();

create table if not exists public.buk_candidate_document_queue_control (
  id boolean primary key default true check (id),
  max_concurrency integer not null default 3 check (max_concurrency between 1 and 3),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.buk_candidate_document_queue_control (id, max_concurrency)
values (true, 3)
on conflict (id) do nothing;

alter table public.buk_candidate_document_jobs enable row level security;
drop policy if exists buk_candidate_document_jobs_no_direct_access
  on public.buk_candidate_document_jobs;
create policy buk_candidate_document_jobs_no_direct_access
on public.buk_candidate_document_jobs
for all
to authenticated
using (false)
with check (false);

alter table public.buk_candidate_document_queue_control enable row level security;
drop policy if exists buk_candidate_document_queue_control_no_direct_access
  on public.buk_candidate_document_queue_control;
create policy buk_candidate_document_queue_control_no_direct_access
on public.buk_candidate_document_queue_control
for all
to authenticated
using (false)
with check (false);

create or replace function public.enqueue_buk_candidate_document_jobs(
  p_buk_sync_job_id uuid,
  p_buk_employee_id text,
  p_existing_documents jsonb default '[]'::jsonb
)
returns table (
  job_id uuid,
  source_document_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  source_job public.buk_sync_jobs%rowtype;
  document_item jsonb;
  uploaded_item jsonb;
  v_source_document_id uuid;
  queued_document_id uuid;
  normalized_employee_id text := nullif(trim(coalesce(p_buk_employee_id, '')), '');
begin
  if normalized_employee_id is null then
    raise exception 'La ficha BUK es obligatoria para encolar documentos';
  end if;

  select * into source_job
    from public.buk_sync_jobs
   where id = p_buk_sync_job_id
   for update;

  if source_job.id is null then
    raise exception 'No existe el job BUK para encolar documentos';
  end if;

  for document_item in
    select value
      from jsonb_array_elements(coalesce(source_job.payload_snapshot -> 'documents', '[]'::jsonb))
  loop
    v_source_document_id := nullif(document_item ->> 'id', '')::uuid;
    if v_source_document_id is null
       or nullif(trim(coalesce(document_item ->> 'file_path', '')), '') is null then
      continue;
    end if;

    select value into uploaded_item
      from jsonb_array_elements(
        case
          when jsonb_typeof(coalesce(p_existing_documents, '[]'::jsonb)) = 'array'
            and jsonb_array_length(
              case
                when jsonb_typeof(coalesce(p_existing_documents, '[]'::jsonb)) = 'array'
                  then coalesce(p_existing_documents, '[]'::jsonb)
                else '[]'::jsonb
              end
            ) > 0
            then p_existing_documents
          else coalesce(source_job.result_snapshot -> 'documents', '[]'::jsonb)
        end
      )
     where value ->> 'sourceDocumentId' = v_source_document_id::text
     limit 1;

    insert into public.buk_candidate_document_jobs (
      buk_sync_job_id,
      recruitment_case_candidate_id,
      candidate_profile_id,
      buk_employee_id,
      v_source_document_id,
      source_document_name,
      source_file_path,
      status,
      buk_document_id,
      buk_document_url,
      buk_employee_folder_id,
      buk_document_name,
      transport,
      response_snapshot,
      finished_at
    )
    values (
      source_job.id,
      source_job.recruitment_case_candidate_id,
      (source_job.payload_snapshot -> 'candidate' ->> 'candidate_profile_id')::uuid,
      normalized_employee_id,
      source_document_id,
      coalesce(nullif(trim(document_item ->> 'document_name'), ''), v_source_document_id::text),
      nullif(trim(document_item ->> 'file_path'), ''),
      case when uploaded_item is null then 'pending' else 'success' end,
      nullif(trim(uploaded_item ->> 'bukDocumentId'), ''),
      nullif(trim(uploaded_item ->> 'bukDocumentUrl'), ''),
      nullif(trim(uploaded_item ->> 'bukEmployeeFolderId'), ''),
      nullif(trim(uploaded_item ->> 'bukDocumentName'), ''),
      nullif(trim(uploaded_item ->> 'transport'), ''),
      coalesce(uploaded_item -> 'response', '{}'::jsonb),
      case when uploaded_item is null then null else timezone('utc', now()) end
    )
    on conflict (buk_sync_job_id, source_document_id) do update
      set buk_employee_id = excluded.buk_employee_id,
          source_document_name = excluded.source_document_name,
          source_file_path = excluded.source_file_path
     where public.buk_candidate_document_jobs.status <> 'success';

    select id, buk_candidate_document_jobs.status
      into queued_document_id, status
      from public.buk_candidate_document_jobs
     where buk_sync_job_id = source_job.id
       and buk_candidate_document_jobs.source_document_id = v_source_document_id;

    job_id := queued_document_id;
    source_document_id := v_source_document_id;
    return next;
  end loop;
end;
$function$;

create or replace function public.claim_buk_candidate_document_jobs(
  p_limit integer default 3,
  p_buk_sync_job_ids uuid[] default null
)
returns table (
  id uuid,
  buk_sync_job_id uuid,
  recruitment_case_candidate_id uuid,
  candidate_profile_id uuid,
  buk_employee_id text,
  source_document_id uuid,
  source_document_name text,
  source_file_path text,
  status text,
  attempts integer,
  response_snapshot jsonb,
  payload_snapshot jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  control_row public.buk_candidate_document_queue_control%rowtype;
  active_count integer;
  claim_limit integer;
begin
  select * into control_row
    from public.buk_candidate_document_queue_control
   where id = true
   for update;

  update public.buk_candidate_document_jobs
     set status = 'reconciliation_required',
         last_error = 'La carga BUK documental anterior quedo inconclusa; se requiere conciliacion antes de reintentar.',
         finished_at = null
   where status = 'processing'
     and started_at < timezone('utc', now()) - interval '10 minutes';

  select count(*)::integer into active_count
    from public.buk_candidate_document_jobs
   where status = 'processing';

  claim_limit := greatest(0, least(coalesce(p_limit, 3), control_row.max_concurrency - active_count));
  if claim_limit = 0 then
    return;
  end if;

  return query
  with selected_jobs as (
    select document_job.id
      from public.buk_candidate_document_jobs document_job
     where document_job.status in ('pending', 'failed', 'reconciliation_required')
       and (
         p_buk_sync_job_ids is null
         or document_job.buk_sync_job_id = any (p_buk_sync_job_ids)
       )
     order by document_job.created_at asc, document_job.id asc
     for update skip locked
     limit claim_limit
  ),
  updated_jobs as (
    update public.buk_candidate_document_jobs document_job
       set status = 'processing',
           attempts = document_job.attempts + 1,
           started_at = timezone('utc', now()),
           finished_at = null,
           last_error = null
      from selected_jobs selected
     where document_job.id = selected.id
     returning document_job.*
  )
  select
    updated_jobs.id,
    updated_jobs.buk_sync_job_id,
    updated_jobs.recruitment_case_candidate_id,
    updated_jobs.candidate_profile_id,
    updated_jobs.buk_employee_id,
    updated_jobs.source_document_id,
    updated_jobs.source_document_name,
    updated_jobs.source_file_path,
    updated_jobs.status,
    updated_jobs.attempts,
    updated_jobs.response_snapshot,
    source_job.payload_snapshot
    from updated_jobs
    join public.buk_sync_jobs source_job on source_job.id = updated_jobs.buk_sync_job_id;
end;
$function$;

revoke all on table public.buk_candidate_document_jobs from public, anon, authenticated;
revoke all on table public.buk_candidate_document_queue_control from public, anon, authenticated;
grant select, insert, update on table public.buk_candidate_document_jobs to service_role;
grant select, update on table public.buk_candidate_document_queue_control to service_role;

revoke all on function public.enqueue_buk_candidate_document_jobs(uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.claim_buk_candidate_document_jobs(integer, uuid[])
  from public, anon, authenticated;
grant execute on function public.enqueue_buk_candidate_document_jobs(uuid, text, jsonb) to service_role;
grant execute on function public.claim_buk_candidate_document_jobs(integer, uuid[]) to service_role;

notify pgrst, 'reload schema';
commit;
