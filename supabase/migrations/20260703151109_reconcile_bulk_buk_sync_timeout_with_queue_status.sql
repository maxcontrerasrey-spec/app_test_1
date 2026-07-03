begin;

create or replace function public.get_buk_sync_jobs_status(
  p_job_ids uuid[]
)
returns table (
  job_id uuid,
  recruitment_case_candidate_id uuid,
  status text,
  buk_employee_id text,
  error_message text,
  attempts integer,
  started_at timestamptz,
  finished_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_generate_buk_candidates(current_user_id) then
    raise exception 'Solo RRHH administrativo puede consultar jobs BUK';
  end if;

  return query
  with normalized_job_ids as (
    select distinct job_ref
    from unnest(coalesce(p_job_ids, '{}'::uuid[])) as job_ref
    where job_ref is not null
  ),
  visible_jobs as (
    select
      bsj.id as job_id,
      bsj.recruitment_case_candidate_id,
      bsj.status,
      bsj.buk_employee_id,
      bsj.error_message,
      bsj.attempts,
      bsj.started_at,
      bsj.finished_at,
      bsj.created_at
    from normalized_job_ids nji
    join public.buk_sync_jobs bsj
      on bsj.id = nji.job_ref
    join public.recruitment_case_candidates rcc
      on rcc.id = bsj.recruitment_case_candidate_id
    where
      public.user_can_manage_recruitment_case(current_user_id, rcc.recruitment_case_id)
      or public.user_can_manage_recruitment_personnel_candidate(current_user_id, rcc.id)
  )
  select
    vj.job_id,
    vj.recruitment_case_candidate_id,
    vj.status,
    vj.buk_employee_id,
    vj.error_message,
    vj.attempts,
    vj.started_at,
    vj.finished_at
  from visible_jobs vj
  order by vj.created_at asc;
end;
$function$;

revoke all on function public.get_buk_sync_jobs_status(uuid[]) from public, anon;
grant execute on function public.get_buk_sync_jobs_status(uuid[]) to authenticated;

commit;
