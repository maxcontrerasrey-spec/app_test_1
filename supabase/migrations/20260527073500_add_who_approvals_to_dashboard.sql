begin;

create or replace function public.get_dashboard_tasks(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  result json;
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado';
  end if;

  if auth.uid() <> p_user_id and not public.user_is_admin(auth.uid()) then
    raise exception 'Sin permisos para consultar tareas de otro usuario';
  end if;

  select coalesce(json_agg(t order by t.created_at asc), '[]'::json) into result
  from (
    select
      'approval_' || hra.id as id,
      'approval' as type,
      hra.id as approval_id,
      hra.step_code,
      hra.step_name,
      hr.id as hiring_request_id,
      coalesce(hr.folio, 'Borrador') as folio,
      null::uuid as case_candidate_id,
      null::text as candidate_name,
      hr.job_position_name,
      hr.contract_name,
      hr.cost_center_code,
      hr.vacancies as requested_vacancies,
      hr.requester_name,
      hr.requester_email,
      hra.status as status_code,
      'En Revision' as status_label,
      'Alta' as priority,
      hra.created_at,
      hr.requested_entry_date as requested_income_date,
      hr.start_date as contract_start_date,
      hr.end_date as contract_end_date,
      hr.shift_name as shift_code,
      hr.salary_offer as salary_liquid,
      hr.campamento as camp_required,
      hr.pasajes as flight_tickets_required,
      hr.travel_methodology,
      hr.other_benefits,
      null::text as approval_comment,
      null::text as requested_by_name
    from public.hiring_request_approvals hra
    join public.hiring_requests hr
      on hr.id = hra.hiring_request_id
    where hra.approver_user_id = p_user_id
      and hra.status = 'pending'

    union all

    select
      'who_approval_' || csa.id as id,
      'who_approval' as type,
      null::bigint as approval_id,
      'who_pending' as step_code,
      'Aprobación Who' as step_name,
      rc.hiring_request_id,
      rc.case_code as folio,
      rcc.id as case_candidate_id,
      cp.full_name as candidate_name,
      rc.job_position_name,
      rc.contract_name,
      rc.cost_center_code,
      rc.requested_vacancies as requested_vacancies,
      hr.requester_name,
      hr.requester_email,
      csa.status as status_code,
      'Who Pendiente' as status_label,
      'Alta' as priority,
      csa.requested_at as created_at,
      rc.requested_entry_date as requested_income_date,
      hr.start_date as contract_start_date,
      hr.end_date as contract_end_date,
      hr.shift_name as shift_code,
      hr.salary_offer as salary_liquid,
      hr.campamento as camp_required,
      hr.pasajes as flight_tickets_required,
      hr.travel_methodology,
      hr.other_benefits,
      csa.comment as approval_comment,
      requester_profile.full_name as requested_by_name
    from public.candidate_stage_approvals csa
    join public.recruitment_case_candidates rcc
      on rcc.id = csa.recruitment_case_candidate_id
    join public.recruitment_cases rc
      on rc.id = rcc.recruitment_case_id
    join public.candidate_profiles cp
      on cp.id = rcc.candidate_profile_id
    left join public.hiring_requests hr
      on hr.id = rc.hiring_request_id
    left join public.profiles requester_profile
      on requester_profile.id = csa.requested_by
    where csa.stage_code = 'who_pending'
      and csa.status = 'pending'
      and public.user_has_capability(p_user_id, 'can_approve_who_stage')
      and public.user_can_view_recruitment_case(p_user_id, rc.id)
  ) t;

  return result;
end;
$function$;

revoke all on function public.get_dashboard_tasks(uuid) from public, anon;
grant execute on function public.get_dashboard_tasks(uuid) to authenticated;

create or replace function public.get_dashboard_approval_tracking()
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  result json;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'control_contrataciones') then
    raise exception 'Sin permisos para ver seguimiento de aprobaciones';
  end if;

  select coalesce(json_agg(t order by t.created_at asc), '[]'::json) into result
  from (
    select
      'tracking_' || hr.id as id,
      'approval' as type,
      hra.id as approval_id,
      hr.id as hiring_request_id,
      coalesce(hr.folio, 'Borrador') as folio,
      null::uuid as case_candidate_id,
      null::text as candidate_name,
      hr.job_position_name,
      hr.contract_name,
      hr.cost_center_code,
      hr.vacancies as requested_vacancies,
      hr.requester_name,
      hr.requester_email,
      hr.status as status_code,
      case
        when hr.status = 'pending_area_manager' then 'Pendiente gerente de area'
        when hr.status = 'pending_contracts_control' then 'Pendiente control contratos'
        else 'Pendiente'
      end as status_label,
      hra.step_code as current_step_code,
      hra.step_name as current_step_name,
      hra.approver_name as current_approver_name,
      hra.approver_email as current_approver_email,
      hra.created_at,
      hr.requested_entry_date as requested_income_date,
      hr.start_date as contract_start_date,
      hr.end_date as contract_end_date,
      hr.shift_name as shift_code,
      hr.salary_offer as salary_liquid,
      hr.campamento as camp_required,
      hr.pasajes as flight_tickets_required,
      hr.travel_methodology,
      hr.other_benefits,
      null::text as approval_comment,
      null::text as requested_by_name
    from public.hiring_requests hr
    join public.hiring_request_approvals hra
      on hra.hiring_request_id = hr.id
     and hra.status = 'pending'
     and hra.step_code = hr.current_step_code
    where hr.status in ('pending_area_manager', 'pending_contracts_control')

    union all

    select
      'who_tracking_' || csa.id as id,
      'who_approval' as type,
      null::bigint as approval_id,
      rc.hiring_request_id,
      rc.case_code as folio,
      rcc.id as case_candidate_id,
      cp.full_name as candidate_name,
      rc.job_position_name,
      rc.contract_name,
      rc.cost_center_code,
      rc.requested_vacancies as requested_vacancies,
      hr.requester_name,
      hr.requester_email,
      csa.status as status_code,
      'Who Pendiente' as status_label,
      'who_pending' as current_step_code,
      'Aprobación Who' as current_step_name,
      'Capacidad Who' as current_approver_name,
      null::text as current_approver_email,
      csa.requested_at as created_at,
      rc.requested_entry_date as requested_income_date,
      hr.start_date as contract_start_date,
      hr.end_date as contract_end_date,
      hr.shift_name as shift_code,
      hr.salary_offer as salary_liquid,
      hr.campamento as camp_required,
      hr.pasajes as flight_tickets_required,
      hr.travel_methodology,
      hr.other_benefits,
      csa.comment as approval_comment,
      requester_profile.full_name as requested_by_name
    from public.candidate_stage_approvals csa
    join public.recruitment_case_candidates rcc
      on rcc.id = csa.recruitment_case_candidate_id
    join public.recruitment_cases rc
      on rc.id = rcc.recruitment_case_id
    join public.candidate_profiles cp
      on cp.id = rcc.candidate_profile_id
    left join public.hiring_requests hr
      on hr.id = rc.hiring_request_id
    left join public.profiles requester_profile
      on requester_profile.id = csa.requested_by
    where csa.stage_code = 'who_pending'
      and csa.status = 'pending'
      and public.user_can_view_recruitment_case(current_user_id, rc.id)
  ) t;

  return result;
end;
$function$;

revoke all on function public.get_dashboard_approval_tracking() from public, anon;
grant execute on function public.get_dashboard_approval_tracking() to authenticated;

notify pgrst, 'reload schema';

commit;
