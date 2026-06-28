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
      'solicitud_contrataciones'::text as module_code,
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
      null::text as requested_by_name,
      null::jsonb as who_causes,
      null::text as employee_name,
      null::text as current_company_name,
      null::text as destination_company_name,
      null::text as source_job_title,
      null::text as source_area_name,
      null::text as destination_area_name,
      null::boolean as requires_termination,
      null::text as mobility_motive,
      null::text as title,
      null::text as subtitle,
      null::timestamptz as service_date,
      null::numeric as calculated_amount
    from public.hiring_request_approvals hra
    join public.hiring_requests hr
      on hr.id = hra.hiring_request_id
    where hra.approver_user_id = p_user_id
      and hra.status = 'pending'
      and hr.status in ('pending_area_manager', 'pending_contracts_control')
      and hr.current_step_code is not null
      and hra.step_code = hr.current_step_code

    union all

    select
      'mobility_approval_' || imra.id as id,
      'approval' as type,
      'movilidad_interna'::text as module_code,
      imra.id as approval_id,
      imra.step_code,
      imra.step_name,
      null::uuid as hiring_request_id,
      imr.folio,
      null::uuid as case_candidate_id,
      null::text as candidate_name,
      imr.destination_job_title as job_position_name,
      imr.destination_area_name as contract_name,
      imr.destination_cost_center_code as cost_center_code,
      null::integer as requested_vacancies,
      imr.requester_name,
      imr.requester_email,
      imra.status as status_code,
      'En Revision' as status_label,
      'Alta' as priority,
      imra.created_at,
      null::date as requested_income_date,
      null::date as contract_start_date,
      null::date as contract_end_date,
      null::text as shift_code,
      null::numeric as salary_liquid,
      null::boolean as camp_required,
      null::boolean as flight_tickets_required,
      null::text as travel_methodology,
      null::text as other_benefits,
      null::text as approval_comment,
      null::text as requested_by_name,
      null::jsonb as who_causes,
      imr.employee_full_name as employee_name,
      imr.current_company_name,
      imr.destination_company_name,
      imr.current_job_title as source_job_title,
      imr.current_area_name as source_area_name,
      imr.destination_area_name,
      imr.requires_termination,
      imr.motive as mobility_motive,
      null::text as title,
      null::text as subtitle,
      null::timestamptz as service_date,
      null::numeric as calculated_amount
    from public.internal_mobility_request_approvals imra
    join public.internal_mobility_requests imr
      on imr.id = imra.internal_mobility_request_id
    where imra.approver_user_id = p_user_id
      and imra.status = 'pending'
      and imr.status in ('pending_area_manager', 'pending_contracts_control')
      and imr.current_step_code is not null
      and imra.step_code = imr.current_step_code

    union all

    select
      'hr_incentive_approval_' || hira.id as id,
      'hr_incentive_approval' as type,
      'recursos_humanos'::text as module_code,
      hira.id as approval_id,
      hira.step_code,
      hira.step_name,
      hir.id as hiring_request_id,
      hir.folio::text as folio,
      null::uuid as case_candidate_id,
      null::text as candidate_name,
      hir.incentive_type_name as job_position_name,
      hir.selected_area_name as contract_name,
      hir.selected_area_code as cost_center_code,
      null::integer as requested_vacancies,
      coalesce(requester_profile.full_name, requester_profile.email, 'Usuario no disponible') as requester_name,
      requester_profile.email as requester_email,
      hira.status as status_code,
      'Incentivo Pendiente' as status_label,
      'Alta' as priority,
      hira.created_at,
      null::date as requested_income_date,
      null::date as contract_start_date,
      null::date as contract_end_date,
      null::text as shift_code,
      null::numeric as salary_liquid,
      null::boolean as camp_required,
      null::boolean as flight_tickets_required,
      null::text as travel_methodology,
      hir.description as other_benefits,
      null::text as approval_comment,
      null::text as requested_by_name,
      null::jsonb as who_causes,
      hir.employee_full_name as employee_name,
      null::text as current_company_name,
      null::text as destination_company_name,
      hir.employee_job_title as source_job_title,
      null::text as source_area_name,
      hir.selected_area_name as destination_area_name,
      null::boolean as requires_termination,
      hir.motive as mobility_motive,
      hir.incentive_type_name as title,
      hir.selected_contract_code as subtitle,
      hir.service_date,
      hir.calculated_amount
    from public.hr_incentive_request_approvals hira
    join public.hr_incentive_requests hir
      on hir.id = hira.incentive_request_id
    left join public.profiles requester_profile
      on requester_profile.id = hir.created_by
    where hira.status = 'pending'
      and (
        hira.approver_user_id = p_user_id
        or public.user_is_admin(p_user_id)
      )

    union all

    select
      'who_approval_' || csa.id as id,
      'who_approval' as type,
      'control_contrataciones'::text as module_code,
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
      requester_profile.full_name as requested_by_name,
      csa.causes as who_causes,
      null::text as employee_name,
      null::text as current_company_name,
      null::text as destination_company_name,
      null::text as source_job_title,
      null::text as source_area_name,
      null::text as destination_area_name,
      null::boolean as requires_termination,
      null::text as mobility_motive,
      null::text as title,
      null::text as subtitle,
      null::timestamptz as service_date,
      null::numeric as calculated_amount
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
      and rcc.stage_code = 'who_pending'
      and rc.status in ('open', 'sourcing', 'screening', 'ready_to_hire', 'partially_filled')
      and public.user_has_capability(p_user_id, 'can_approve_who_stage')
      and public.user_can_view_recruitment_case(p_user_id, rc.id)
  ) t;

  return result;
end;
$function$;

revoke all on function public.get_dashboard_tasks(uuid) from public, anon;
grant execute on function public.get_dashboard_tasks(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
