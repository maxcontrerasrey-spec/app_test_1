create or replace function public.get_dashboard_operational_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  today_cl date := timezone('America/Santiago', now())::date;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  return (
    with visible_hiring_scope as (
      select distinct
        hr.id,
        hr.requester_id,
        hr.cost_center_code,
        hr.contract_number
      from public.hiring_requests hr
      where public.user_can_view_hiring_request_process_summary(
        current_user_id,
        hr.requester_id,
        hr.cost_center_code
      )
    ),
    visible_contract_scope as (
      select distinct c.code as contract_code
      from visible_hiring_scope vhs
      join public.contracts c
        on c.contract_number = vhs.contract_number
       and c.is_active = true
    ),
    visible_cases as (
      select
        rc.id,
        rc.requested_vacancies
      from public.recruitment_cases rc
      join public.hiring_requests hr
        on hr.id = rc.hiring_request_id
      where rc.status in ('open', 'sourcing', 'screening', 'ready_to_hire', 'partially_filled')
        and public.user_can_view_hiring_request_process_summary(
          current_user_id,
          hr.requester_id,
          hr.cost_center_code
        )
    ),
    recruitment_summary as (
      select
        count(*)::bigint as open_processes,
        coalesce(sum(vc.requested_vacancies), 0)::bigint as requested_vacancies,
        coalesce(sum(case_metrics.active_candidate_count), 0)::bigint as in_progress_candidates,
        coalesce(sum(case_metrics.hired_candidate_count), 0)::bigint as hired_candidates
      from visible_cases vc
      left join lateral public.get_recruitment_case_effective_metrics(vc.id) as case_metrics on true
    ),
    visible_population as (
      select
        e.buk_employee_id,
        e.hire_date,
        coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO') as contract_code
      from public.employees_active_current e
      where exists (
        select 1
        from visible_contract_scope vcs
        where vcs.contract_code = coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO')
      )
    ),
    workforce_absences_today as (
      select
        count(distinct hre.employee_buk_employee_id) filter (
          where hre.exception_type = 'vacation'
        )::bigint as vacations_today,
        count(distinct hre.employee_buk_employee_id) filter (
          where hre.exception_type = 'medical_leave'
        )::bigint as medical_leaves_today,
        count(distinct hre.employee_buk_employee_id) filter (
          where hre.exception_type in ('vacation', 'medical_leave', 'absent', 'administrative_leave', 'union_leave')
        )::bigint as absent_people_today
      from public.hr_roster_exceptions hre
      join visible_population vp
        on vp.buk_employee_id = hre.employee_buk_employee_id
      where hre.exception_date = today_cl
        and hre.is_active = true
    ),
    workforce_summary as (
      select
        count(*)::bigint as total_employees,
        coalesce(max(wat.medical_leaves_today), 0)::bigint as medical_leaves_today,
        coalesce(max(wat.vacations_today), 0)::bigint as vacations_today,
        case
          when count(*) = 0 then 0::numeric
          else round((coalesce(max(wat.absent_people_today), 0)::numeric / count(*)::numeric) * 100, 1)
        end as absenteeism_pct
      from visible_population vp
      cross join workforce_absences_today wat
    ),
    incentives_summary as (
      select
        count(*) filter (where hir.status <> 'R')::bigint as total_generated,
        count(*) filter (where hir.status in ('P', 'E'))::bigint as pending_approval,
        count(*) filter (where hir.status = 'F')::bigint as approved
      from public.hr_incentive_requests hir
      where exists (
        select 1
        from visible_contract_scope vcs
        where vcs.contract_code = hir.selected_contract_code
      )
    )
    select jsonb_build_object(
      'recruitment',
      jsonb_build_object(
        'open_processes', coalesce((select open_processes from recruitment_summary), 0),
        'requested_vacancies', coalesce((select requested_vacancies from recruitment_summary), 0),
        'in_progress_candidates', coalesce((select in_progress_candidates from recruitment_summary), 0),
        'hired_candidates', coalesce((select hired_candidates from recruitment_summary), 0)
      ),
      'workforce',
      jsonb_build_object(
        'total_employees', coalesce((select total_employees from workforce_summary), 0),
        'medical_leaves_today', coalesce((select medical_leaves_today from workforce_summary), 0),
        'vacations_today', coalesce((select vacations_today from workforce_summary), 0),
        'absenteeism_pct', coalesce((select absenteeism_pct from workforce_summary), 0)
      ),
      'incentives',
      jsonb_build_object(
        'total_generated', coalesce((select total_generated from incentives_summary), 0),
        'pending_approval', coalesce((select pending_approval from incentives_summary), 0),
        'approved', coalesce((select approved from incentives_summary), 0)
      )
    )
  );
end;
$function$;

revoke all on function public.get_dashboard_operational_summary() from public, anon;
grant execute on function public.get_dashboard_operational_summary() to authenticated;

create or replace function public.get_dashboard_home_bundle(
  p_birthdays_limit integer default 6
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  active_folios jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select coalesce(
    jsonb_agg(case_row.payload order by case_row.sort_opened_at desc),
    '[]'::jsonb
  )
  into active_folios
  from (
    select
      jsonb_build_object(
        'id', rc.id,
        'case_code', rc.case_code,
        'status', rc.status,
        'requested_vacancies', rc.requested_vacancies,
        'filled_vacancies', coalesce(case_metrics.effective_filled_vacancies, 0),
        'title', rc.title,
        'contract_name', rc.contract_name,
        'job_position_name', rc.job_position_name,
        'cost_center_code', rc.cost_center_code,
        'cost_center_name', rc.cost_center_name,
        'requested_entry_date', rc.requested_entry_date,
        'target_close_date', rc.target_close_date,
        'opened_at', rc.opened_at,
        'requester_name', hr.requester_name,
        'requester_email', hr.requester_email,
        'hiring_request_status', hr.status,
        'can_close_request', public.user_can_close_hiring_request(current_user_id, hr.id),
        'owner_name', owner_profile.full_name,
        'owner_user_id', owner_assignment.user_id,
        'candidate_count', coalesce(case_metrics.effective_active_candidates, 0),
        'ready_candidates', coalesce(case_metrics.ready_candidate_count, 0),
        'hired_candidates', coalesce(case_metrics.effective_filled_vacancies, 0),
        'mobility_active_count', coalesce(case_metrics.pending_mobility_count, 0),
        'mobility_approved_count', coalesce(case_metrics.approved_mobility_count, 0)
      ) as payload,
      rc.opened_at as sort_opened_at
    from public.recruitment_cases rc
    join public.hiring_requests hr
      on hr.id = rc.hiring_request_id
    left join lateral (
      select rca.user_id
      from public.recruitment_case_assignments rca
      where rca.recruitment_case_id = rc.id
        and rca.is_primary = true
      order by rca.id asc
      limit 1
    ) as owner_assignment on true
    left join public.profiles owner_profile
      on owner_profile.id = owner_assignment.user_id
    left join lateral public.get_recruitment_case_effective_metrics(rc.id) as case_metrics on true
    where rc.status in ('open', 'sourcing', 'screening', 'ready_to_hire', 'partially_filled')
      and public.user_can_view_hiring_request_process_summary(
        current_user_id,
        hr.requester_id,
        hr.cost_center_code
      )
    order by rc.opened_at desc
    limit 25
  ) as case_row;

  return jsonb_build_object(
    'tasks_data',
    coalesce(public.get_dashboard_tasks(current_user_id)::jsonb, '[]'::jsonb),
    'approval_tracking_data',
    coalesce(public.get_dashboard_approval_tracking()::jsonb, '[]'::jsonb),
    'active_folios_data',
    active_folios,
    'birthdays_data',
    coalesce(
      public.get_upcoming_birthdays(greatest(coalesce(p_birthdays_limit, 6), 1)),
      '[]'::jsonb
    ),
    'operational_summary_data',
    coalesce(public.get_dashboard_operational_summary(), '{}'::jsonb)
  );
end;
$function$;

revoke all on function public.get_dashboard_home_bundle(integer) from public, anon;
grant execute on function public.get_dashboard_home_bundle(integer) to authenticated;

notify pgrst, 'reload schema';
