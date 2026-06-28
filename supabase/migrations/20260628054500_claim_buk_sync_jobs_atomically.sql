begin;

create or replace function public.claim_buk_sync_jobs(
  p_limit integer default 10,
  p_job_ids uuid[] default null
)
returns table (
  id uuid,
  recruitment_case_candidate_id uuid,
  status text,
  attempts integer,
  result_snapshot jsonb
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  normalized_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
begin
  return query
  with selected_jobs as (
    select bsj.id
      from public.buk_sync_jobs bsj
     where (
        p_job_ids is not null
        and bsj.id = any (p_job_ids)
        and bsj.status in ('pending', 'error')
      )
        or (
          p_job_ids is null
          and bsj.status = 'pending'
        )
     order by bsj.created_at asc
     for update skip locked
     limit normalized_limit
  ),
  updated_jobs as (
    update public.buk_sync_jobs bsj
       set status = 'processing',
           attempts = bsj.attempts + 1,
           started_at = timezone('utc', now()),
           error_message = null
      from selected_jobs sj
     where bsj.id = sj.id
     returning
       bsj.id,
       bsj.recruitment_case_candidate_id,
       bsj.status,
       bsj.attempts,
       bsj.result_snapshot
  )
  select
    updated_jobs.id,
    updated_jobs.recruitment_case_candidate_id,
    updated_jobs.status,
    updated_jobs.attempts,
    updated_jobs.result_snapshot
  from updated_jobs;
end;
$function$;

revoke all on function public.claim_buk_sync_jobs(integer, uuid[]) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
