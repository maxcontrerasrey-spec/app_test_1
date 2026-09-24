-- EEES-DB-005: approved
-- owner: Recruitment and HR Integrations
-- rollback: forward-only; preserve queue history and disable workers before any rollback plan.

begin;

-- Qualify status and started_at as well: status is another output column of
-- this RETURNS TABLE function and otherwise becomes ambiguous at execution.
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
  select queue_control.* into control_row
    from public.buk_candidate_document_queue_control as queue_control
   where queue_control.id = true
   for update;

  update public.buk_candidate_document_jobs as stale_job
     set status = 'reconciliation_required',
         last_error = 'La carga BUK documental anterior quedo inconclusa; se requiere conciliacion antes de reintentar.',
         next_attempt_at = timezone('utc', now()),
         finished_at = null
   where stale_job.status = 'processing'
     and stale_job.started_at < timezone('utc', now()) - interval '10 minutes';

  select count(*)::integer into active_count
    from public.buk_candidate_document_jobs as active_job
   where active_job.status = 'processing';

  claim_limit := greatest(0, least(coalesce(p_limit, 3), control_row.max_concurrency - active_count));
  if claim_limit = 0 then
    return;
  end if;

  return query
  with selected_jobs as (
    select document_job.id
      from public.buk_candidate_document_jobs as document_job
     where document_job.status in ('pending', 'failed', 'reconciliation_required')
       and (document_job.next_attempt_at is null or document_job.next_attempt_at <= timezone('utc', now()))
       and (
         p_buk_sync_job_ids is null
         or document_job.buk_sync_job_id = any (p_buk_sync_job_ids)
       )
     order by document_job.created_at asc, document_job.id asc
     for update skip locked
     limit claim_limit
  ),
  updated_jobs as (
    update public.buk_candidate_document_jobs as document_job
       set status = 'processing',
           attempts = document_job.attempts + 1,
           started_at = timezone('utc', now()),
           next_attempt_at = null,
           finished_at = null,
           last_error = null
      from selected_jobs as selected
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
    join public.buk_sync_jobs as source_job on source_job.id = updated_jobs.buk_sync_job_id;
end;
$function$;

revoke all on function public.claim_buk_candidate_document_jobs(integer, uuid[])
  from public, anon, authenticated;
grant execute on function public.claim_buk_candidate_document_jobs(integer, uuid[]) to service_role;

notify pgrst, 'reload schema';
commit;
