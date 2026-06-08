begin;

-- PASO 1: Arreglar recruitment_cases huérfanos cuyo hiring_request ya fue cerrado
update public.recruitment_cases rc
   set status = 'cancelled',
       close_reason = 'Corrección automática: folio de origen cerrado',
       closed_at = timezone('utc', now()),
       updated_at = timezone('utc', now())
 where rc.status not in ('filled', 'closed_unfilled', 'cancelled')
   and exists (
     select 1 from public.hiring_requests hr
      where hr.id = rc.hiring_request_id
        and hr.status in ('closed', 'rejected')
   );

-- PASO 2: Actualizar get_dashboard_home_bundle (widget Inicio)
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
        'filled_vacancies', rc.filled_vacancies,
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
        'candidate_count', coalesce(candidate_stats.candidate_count, 0),
        'ready_candidates', coalesce(candidate_stats.ready_candidates, 0),
        'hired_candidates', coalesce(candidate_stats.hired_candidates, 0)
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
    left join lateral (
      select
        count(*) filter (where rcc.stage_code not in ('rejected', 'withdrawn', 'hired', 'ready_for_hire')) as candidate_count,
        count(*) filter (where rcc.stage_code = 'ready_for_hire') as ready_candidates,
        count(*) filter (where rcc.stage_code = 'hired') as hired_candidates
      from public.recruitment_case_candidates rcc
      where rcc.recruitment_case_id = rc.id
    ) as candidate_stats on true
    where rc.status in ('open', 'screening', 'ready_to_hire')
      and hr.status not in ('closed', 'rejected')
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
    )
  );
end;
$function$;

revoke all on function public.get_dashboard_home_bundle(integer) from public, anon;
grant execute on function public.get_dashboard_home_bundle(integer) to authenticated;

-- PASO 3: Actualizar get_recruitment_control_dashboard_v2 con claves SNAKE_CASE correctas
create or replace function public.get_recruitment_control_dashboard_v2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  can_access_candidate_control boolean := false;
  summary jsonb := '{}'::jsonb;
  pending_approvals jsonb := '[]'::jsonb;
  active_cases jsonb := '[]'::jsonb;
  candidate_control jsonb := '[]'::jsonb;
  personnel_to_hire jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'control_contrataciones') then
    raise exception 'Sin permisos para ver control de contrataciones';
  end if;

  can_access_candidate_control := public.user_can_access_candidate_control(current_user_id);

  select jsonb_build_object(
    'pending_contracts_control', count(*) filter (where hra.step_code = 'contracts_control' and hra.status = 'pending'),
    'active_cases', count(*) filter (where rc.status not in ('filled', 'closed_unfilled', 'cancelled')),
    'ready_to_hire_cases', count(*) filter (where rc.status = 'ready_to_hire'),
    'filled_cases', count(*) filter (where rc.status = 'filled'),
    'total_cases', count(*)
  )
  into summary
  from public.recruitment_cases rc
  left join public.hiring_request_approvals hra
    on hra.hiring_request_id = rc.hiring_request_id
   and hra.step_code = 'contracts_control'
   and hra.status = 'pending'
  where public.user_can_access_recruitment_case(current_user_id, rc.id);

  select coalesce(
    jsonb_agg(queue_row.payload order by queue_row.sort_created_at asc, queue_row.sort_id asc),
    '[]'::jsonb
  )
  into pending_approvals
  from (
    select
      jsonb_build_object(
        'id', hra.id,
        'step_code', hra.step_code,
        'step_name', hra.step_name,
        'hiring_request_id', hra.hiring_request_id,
        'approver_user_id', hra.approver_user_id,
        'approver_name', hra.approver_name,
        'approver_email', hra.approver_email,
        'created_at', hra.created_at,
        'hiring_requests', jsonb_build_object(
          'folio', hr.folio,
          'status', hr.status,
          'requester_name', hr.requester_name,
          'requester_email', hr.requester_email,
          'contract_name', hr.contract_name,
          'contract_number', hr.contract_number,
          'job_position_name', hr.job_position_name,
          'vacancies', hr.vacancies,
          'requested_entry_date', hr.requested_entry_date,
          'start_date', hr.start_date,
          'end_date', hr.end_date,
          'shift_name', hr.shift_name,
          'salary_offer', hr.salary_offer,
          'campamento', hr.campamento,
          'pasajes', hr.pasajes,
          'other_benefits', hr.other_benefits
        )
      ) as payload,
      hra.created_at as sort_created_at,
      hra.id as sort_id
    from public.hiring_request_approvals hra
    join public.hiring_requests hr
      on hr.id = hra.hiring_request_id
    where hra.step_code in ('area_manager', 'contracts_control')
      and hra.status = 'pending'
      and hr.status not in ('closed', 'rejected')
      and (
        public.user_is_admin(current_user_id)
        or public.user_has_role(current_user_id, 'reclutamiento')
        or hra.approver_user_id = current_user_id
        or (hra.step_code = 'contracts_control' and public.user_has_role(current_user_id, 'control_contratos'))
      )
    order by hra.created_at asc, hra.id asc
    limit 20
  ) as queue_row;

  select coalesce(
    jsonb_agg(case_row.payload order by case_row.sort_opened_at desc),
    '[]'::jsonb
  )
  into active_cases
  from (
    select
      jsonb_build_object(
        'id', rc.id,
        'case_code', rc.case_code,
        'status', rc.status,
        'requested_vacancies', rc.requested_vacancies,
        'filled_vacancies', rc.filled_vacancies,
        'title', rc.title,
        'contract_name', rc.contract_name,
        'job_position_name', rc.job_position_name,
        'cost_center_code', rc.cost_center_code,
        'cost_center_name', rc.cost_center_name,
        'opened_at', rc.opened_at,
        'can_close_request', public.user_can_close_hiring_request(current_user_id, hr.id),
        'hiring_request', jsonb_build_object(
          'id', hr.id,
          'folio', hr.folio,
          'status', hr.status,
          'requester_name', hr.requester_name,
          'requester_email', hr.requester_email,
          'start_date', hr.start_date,
          'end_date', hr.end_date,
          'shift_name', hr.shift_name,
          'salary_offer', hr.salary_offer,
          'campamento', hr.campamento,
          'pasajes', hr.pasajes,
          'other_benefits', hr.other_benefits
        )
      ) as payload,
      rc.opened_at as sort_opened_at
    from public.recruitment_cases rc
    join public.hiring_requests hr
      on hr.id = rc.hiring_request_id
    where public.user_can_access_recruitment_case(current_user_id, rc.id)
    order by rc.opened_at desc
    limit 50
  ) as case_row;

  if can_access_candidate_control then
    select coalesce(
      jsonb_agg(candidate_row.payload order by candidate_row.sort_created_at asc),
      '[]'::jsonb
    )
    into candidate_control
    from (
      select
        jsonb_build_object(
          'id', rcc.id,
          'candidate_profile_id', cp.id,
          'national_id', cp.national_id,
          'full_name', cp.full_name,
          'email', cp.email,
          'phone', cp.phone,
          'stage_code', rcc.stage_code,
          'stage_entered_at', rcc.stage_entered_at,
          'suitability_status', rcc.suitability_status,
          'is_selected', rcc.is_selected,
          'hired_at', rcc.hired_at,
          'created_at', rcc.created_at,
          'case_title', rc.title,
          'case_contract_name', rc.contract_name,
          'case_job_position_name', rc.job_position_name,
          'who_approval', (
            select jsonb_build_object(
              'id', csa.id,
              'status', csa.status,
              'requested_by', csa.requested_by,
              'requested_at', csa.requested_at,
              'approved_by', csa.approved_by,
              'approved_at', csa.approved_at,
              'comment', csa.comment,
              'causes', csa.causes
            )
            from public.candidate_stage_approvals csa
            where csa.recruitment_case_candidate_id = rcc.id
              and csa.stage_code = 'who_pending'
            order by coalesce(csa.approved_at, csa.requested_at) desc, csa.id desc
            limit 1
          )
        ) as payload,
        rcc.created_at as sort_created_at
      from public.recruitment_case_candidates rcc
      join public.candidate_profiles cp
        on cp.id = rcc.candidate_profile_id
      join public.recruitment_cases rc
        on rc.id = rcc.recruitment_case_id
      where rcc.stage_code != 'hired'
        and public.user_can_access_recruitment_case(current_user_id, rc.id)
    ) as candidate_row;

    select coalesce(
      jsonb_agg(personnel_row.payload order by personnel_row.sort_hired_at desc),
      '[]'::jsonb
    )
    into personnel_to_hire
    from (
      select
        jsonb_build_object(
          'id', rcc.id,
          'candidate_profile_id', cp.id,
          'national_id', cp.national_id,
          'full_name', cp.full_name,
          'email', cp.email,
          'phone', cp.phone,
          'stage_code', rcc.stage_code,
          'stage_entered_at', rcc.stage_entered_at,
          'suitability_status', rcc.suitability_status,
          'is_selected', rcc.is_selected,
          'hired_at', rcc.hired_at,
          'created_at', rcc.created_at,
          'case_title', rc.title,
          'case_contract_name', rc.contract_name,
          'case_job_position_name', rc.job_position_name,
          'case_code', rc.case_code,
          'hiring_request_folio', hr.folio
        ) as payload,
        rcc.hired_at as sort_hired_at
      from public.recruitment_case_candidates rcc
      join public.candidate_profiles cp
        on cp.id = rcc.candidate_profile_id
      join public.recruitment_cases rc
        on rc.id = rcc.recruitment_case_id
      join public.hiring_requests hr
        on hr.id = rc.hiring_request_id
      where rcc.stage_code = 'hired'
        and rcc.is_contracted = false
        and public.user_can_access_recruitment_case(current_user_id, rc.id)
    ) as personnel_row;
  end if;

  return jsonb_build_object(
    'summary', summary,
    'pending_approvals', pending_approvals,
    'active_cases', active_cases,
    'candidate_control', candidate_control,
    'personnel_to_hire', personnel_to_hire
  );
end;
$function$;

revoke all on function public.get_recruitment_control_dashboard_v2() from public, anon;
grant execute on function public.get_recruitment_control_dashboard_v2() to authenticated;

notify pgrst, 'reload schema';

commit;
