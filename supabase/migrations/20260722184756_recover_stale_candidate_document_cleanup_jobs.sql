begin;

create or replace function public.claim_candidate_document_cleanup_jobs(
  p_limit integer default 25,
  p_candidate_ids uuid[] default null
)
returns table (
  id uuid,
  recruitment_case_candidate_id uuid,
  recruitment_case_id uuid,
  candidate_profile_id uuid,
  terminal_stage text,
  requested_by uuid,
  attempts integer
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  normalized_limit integer := greatest(1, least(coalesce(p_limit, 25), 250));
  stale_cutoff timestamptz := timezone('utc', now()) - interval '15 minutes';
begin
  return query
  with selected_jobs as (
    select cdcj.id
    from public.candidate_document_cleanup_jobs cdcj
    where (
      cdcj.status in ('pending', 'error')
      or (
        cdcj.status = 'processing'
        and cdcj.finished_at is null
        and cdcj.started_at is not null
        and cdcj.started_at < stale_cutoff
      )
    )
    and (
      p_candidate_ids is null
      or cdcj.recruitment_case_candidate_id = any (p_candidate_ids)
    )
    order by cdcj.created_at asc
    for update skip locked
    limit normalized_limit
  ),
  updated_jobs as (
    update public.candidate_document_cleanup_jobs cdcj
    set status = 'processing',
        attempts = cdcj.attempts + 1,
        started_at = timezone('utc', now()),
        finished_at = null,
        error_message = null,
        result_snapshot = case
          when cdcj.status = 'processing' then
            coalesce(cdcj.result_snapshot, '{}'::jsonb)
            || jsonb_build_object(
              'staleProcessingRecovery',
              jsonb_build_object(
                'reclaimedAt', timezone('utc', now()),
                'previousStartedAt', cdcj.started_at,
                'previousAttempts', cdcj.attempts,
                'source', 'claim_candidate_document_cleanup_jobs'
              )
            )
          else cdcj.result_snapshot
        end
    from selected_jobs sj
    where cdcj.id = sj.id
    returning cdcj.id, cdcj.recruitment_case_candidate_id, cdcj.recruitment_case_id,
              cdcj.candidate_profile_id, cdcj.terminal_stage, cdcj.requested_by, cdcj.attempts
  )
  select * from updated_jobs;
end;
$function$;

revoke all on function public.claim_candidate_document_cleanup_jobs(integer, uuid[])
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
