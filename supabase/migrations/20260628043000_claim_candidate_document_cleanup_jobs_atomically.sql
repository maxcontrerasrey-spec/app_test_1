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
begin
  return query
  with selected_jobs as (
    select cdcj.id
      from public.candidate_document_cleanup_jobs cdcj
     where cdcj.status in ('pending', 'error')
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
           error_message = null
      from selected_jobs sj
     where cdcj.id = sj.id
     returning
       cdcj.id,
       cdcj.recruitment_case_candidate_id,
       cdcj.recruitment_case_id,
       cdcj.candidate_profile_id,
       cdcj.terminal_stage,
       cdcj.requested_by,
       cdcj.attempts
  )
  select
    updated_jobs.id,
    updated_jobs.recruitment_case_candidate_id,
    updated_jobs.recruitment_case_id,
    updated_jobs.candidate_profile_id,
    updated_jobs.terminal_stage,
    updated_jobs.requested_by,
    updated_jobs.attempts
  from updated_jobs;
end;
$function$;

revoke all on function public.claim_candidate_document_cleanup_jobs(integer, uuid[]) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
