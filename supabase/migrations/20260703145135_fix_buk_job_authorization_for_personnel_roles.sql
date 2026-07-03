begin;

create or replace function public.authorize_buk_sync_jobs(
  p_actor_user_id uuid,
  p_job_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  with normalized_job_ids as (
    select distinct job_id
    from unnest(coalesce(p_job_ids, '{}'::uuid[])) as job_id
    where job_id is not null
  ),
  visible_jobs as (
    select nj.job_id
    from normalized_job_ids nj
    join public.buk_sync_jobs bsj
      on bsj.id = nj.job_id
    join public.recruitment_case_candidates rcc
      on rcc.id = bsj.recruitment_case_candidate_id
    where
      public.user_can_manage_recruitment_case(p_actor_user_id, rcc.recruitment_case_id)
      or public.user_can_manage_recruitment_personnel_candidate(p_actor_user_id, rcc.id)
  )
  select
    public.user_can_generate_buk_candidates(p_actor_user_id)
    and exists (select 1 from normalized_job_ids)
    and (select count(*) from normalized_job_ids) = (select count(*) from visible_jobs);
$function$;

revoke all on function public.authorize_buk_sync_jobs(uuid, uuid[]) from public, anon, authenticated;

commit;
