-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; preserve external BUK evidence and candidate history.
begin;

create or replace function public.get_recruitment_case_effective_metrics(p_case_id uuid)
returns table (
  requested_vacancies integer,
  hired_candidate_count integer,
  ready_candidate_count integer,
  active_candidate_count integer,
  pending_mobility_count integer,
  approved_mobility_count integer,
  effective_filled_vacancies integer,
  effective_active_candidates integer,
  available_vacancies integer
)
language sql stable security definer set search_path = public
as $function$
  select
    rc.requested_vacancies,
    coalesce(candidate_stats.hired_candidate_count, 0)::integer,
    coalesce(candidate_stats.ready_candidate_count, 0)::integer,
    coalesce(candidate_stats.active_candidate_count, 0)::integer,
    coalesce(mobility_stats.pending_mobility_count, 0)::integer,
    coalesce(mobility_stats.approved_mobility_count, 0)::integer,
    (
      coalesce(candidate_stats.hired_candidate_count, 0)
      + coalesce(mobility_stats.approved_mobility_count, 0)
      + coalesce(external_stats.external_hire_count, 0)
    )::integer,
    (
      coalesce(candidate_stats.active_candidate_count, 0)
      + coalesce(mobility_stats.pending_mobility_count, 0)
    )::integer,
    greatest(
      rc.requested_vacancies - (
        coalesce(candidate_stats.hired_candidate_count, 0)
        + coalesce(mobility_stats.pending_mobility_count, 0)
        + coalesce(mobility_stats.approved_mobility_count, 0)
        + coalesce(external_stats.external_hire_count, 0)
      ),
      0
    )::integer
  from public.recruitment_cases rc
  left join lateral (
    select
      count(*) filter (where rcc.stage_code = 'hired') as hired_candidate_count,
      count(*) filter (where rcc.stage_code = 'ready_for_hire') as ready_candidate_count,
      count(*) filter (where rcc.stage_code not in ('rejected', 'withdrawn', 'hired', 'ready_for_hire')) as active_candidate_count
    from public.recruitment_case_candidates rcc
    where rcc.recruitment_case_id = rc.id
  ) candidate_stats on true
  left join lateral (
    select
      count(*) filter (where imr.status in ('pending_area_manager', 'pending_contracts_control')) as pending_mobility_count,
      count(*) filter (where imr.status = 'approved') as approved_mobility_count
    from public.internal_mobility_requests imr
    where imr.recruitment_case_id = rc.id
  ) mobility_stats on true
  left join lateral (
    select count(*) as external_hire_count
    from public.recruitment_case_external_hires external_hire
    where external_hire.recruitment_case_id = rc.id
      and external_hire.is_active
      and external_hire.recruitment_case_candidate_id is null
  ) external_stats on true
  where rc.id = p_case_id;
$function$;

notify pgrst, 'reload schema';
commit;
