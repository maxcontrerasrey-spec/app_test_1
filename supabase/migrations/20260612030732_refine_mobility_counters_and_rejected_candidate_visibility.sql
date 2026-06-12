begin;

drop function if exists public.get_internal_mobility_requests();

create or replace function public.get_internal_mobility_requests()
returns table (
  request_id uuid,
  folio text,
  status text,
  requester_name text,
  requester_email text,
  employee_full_name text,
  employee_document_number text,
  current_job_title text,
  current_area_name text,
  current_company_name text,
  current_shift_name text,
  recruitment_case_code text,
  source_folio text,
  destination_job_title text,
  destination_area_name text,
  destination_shift_name text,
  destination_cost_center_code text,
  destination_cost_center_name text,
  destination_company_name text,
  requires_termination boolean,
  motive text,
  current_step_name text,
  current_approver_name text,
  created_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz
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

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para ver solicitudes de movilidad interna';
  end if;

  return query
  select
    imr.id,
    imr.folio,
    imr.status,
    imr.requester_name,
    imr.requester_email,
    imr.employee_full_name,
    imr.employee_document_number,
    imr.current_job_title,
    imr.current_area_name,
    imr.current_company_name,
    imr.current_shift_name,
    imr.recruitment_case_code,
    imr.source_folio,
    imr.destination_job_title,
    imr.destination_area_name,
    imr.destination_shift_name,
    imr.destination_cost_center_code,
    imr.destination_cost_center_name,
    imr.destination_company_name,
    imr.requires_termination,
    imr.motive,
    current_approval.step_name,
    current_approval.approver_name,
    imr.created_at,
    imr.submitted_at,
    imr.approved_at,
    imr.rejected_at
  from public.internal_mobility_requests imr
  left join lateral (
    select
      imra.step_name,
      imra.approver_name
    from public.internal_mobility_request_approvals imra
    where imra.internal_mobility_request_id = imr.id
      and imra.status = 'pending'
      and imra.step_code = imr.current_step_code
    limit 1
  ) current_approval on true
  where public.user_can_view_internal_mobility_request_summary(
    current_user_id,
    imr.requester_id,
    imr.destination_cost_center_code
  )
  order by imr.created_at desc
  limit 200;
end;
$function$;

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
        'candidate_count', coalesce(case_metrics.active_candidate_count, 0),
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
    )
  );
end;
$function$;

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

  can_access_candidate_control := public.user_can_access_candidate_control(current_user_id);

  select jsonb_build_object(
    'pending_contracts_control', count(*) filter (
      where hra.step_code = 'contracts_control' and hra.status = 'pending'
    ),
    'active_cases', count(*) filter (where rc.status not in ('filled', 'closed_unfilled', 'cancelled')),
    'ready_to_hire_cases', count(*) filter (where rc.status = 'ready_to_hire'),
    'filled_cases', count(*) filter (where rc.status = 'filled'),
    'total_cases', count(*)
  )
    into summary
  from public.recruitment_cases rc
  join public.hiring_requests hr
    on hr.id = rc.hiring_request_id
  left join public.hiring_request_approvals hra
    on hra.hiring_request_id = rc.hiring_request_id
   and hra.step_code = 'contracts_control'
   and hra.status = 'pending'
  where public.user_can_view_hiring_request_process_summary(
    current_user_id,
    hr.requester_id,
    hr.cost_center_code
  );

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
          'travel_methodology', hr.travel_methodology,
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
        or (
          hra.step_code = 'contracts_control'
          and public.user_has_role(current_user_id, 'control_contratos')
        )
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
    select *
    from (
      select
        jsonb_build_object(
          'id', rc.id,
          'source_type', 'case',
          'hiring_request_id', hr.id,
          'folio', hr.folio,
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
          'candidate_count', coalesce(case_metrics.active_candidate_count, 0),
          'ready_candidates', coalesce(case_metrics.ready_candidate_count, 0),
          'hired_candidates', coalesce(case_metrics.effective_filled_vacancies, 0),
          'mobility_active_count', coalesce(case_metrics.pending_mobility_count, 0),
          'mobility_approved_count', coalesce(case_metrics.approved_mobility_count, 0),
          'start_date', hr.start_date,
          'end_date', hr.end_date,
          'shift_name', hr.shift_name,
          'salary_offer', hr.salary_offer,
          'campamento', hr.campamento,
          'pasajes', hr.pasajes,
          'travel_methodology', hr.travel_methodology,
          'other_benefits', hr.other_benefits,
          'approval_summary', case
            when latest_approval.id is null then null
            else jsonb_build_object(
              'step_name', latest_approval.step_name,
              'status', latest_approval.status,
              'decision_comment', latest_approval.decision_comment,
              'decided_at', latest_approval.decided_at,
              'decided_by_name', latest_approval.decided_by_name
            )
          end
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
      left join lateral (
        select
          hra.id,
          hra.step_name,
          hra.status,
          hra.decision_comment,
          hra.decided_at,
          decision_profile.full_name as decided_by_name
        from public.hiring_request_approvals hra
        left join public.profiles decision_profile
          on decision_profile.id = hra.decision_by
        where hra.hiring_request_id = hr.id
        order by coalesce(hra.decided_at, hra.created_at) desc, hra.id desc
        limit 1
      ) as latest_approval on true
      where public.user_can_view_hiring_request_process_summary(
        current_user_id,
        hr.requester_id,
        hr.cost_center_code
      )

      union all

      select
        jsonb_build_object(
          'id', hr.id,
          'source_type', 'request',
          'hiring_request_id', hr.id,
          'folio', hr.folio,
          'case_code', coalesce(hr.folio, 'Sin folio'),
          'status', 'cancelled',
          'requested_vacancies', coalesce(hr.vacancies, 0),
          'filled_vacancies', 0,
          'title', coalesce(hr.folio, 'Borrador') || ' - ' || hr.job_position_name,
          'contract_name', hr.contract_name,
          'job_position_name', hr.job_position_name,
          'cost_center_code', hr.cost_center_code,
          'cost_center_name', hr.cost_center_name,
          'requested_entry_date', hr.requested_entry_date,
          'target_close_date', null,
          'opened_at', coalesce(hr.rejected_at, hr.updated_at, hr.submitted_at, hr.created_at),
          'requester_name', hr.requester_name,
          'requester_email', hr.requester_email,
          'hiring_request_status', hr.status,
          'can_close_request', false,
          'owner_name', null,
          'owner_user_id', null,
          'candidate_count', 0,
          'ready_candidates', 0,
          'hired_candidates', 0,
          'mobility_active_count', 0,
          'mobility_approved_count', 0,
          'start_date', hr.start_date,
          'end_date', hr.end_date,
          'shift_name', hr.shift_name,
          'salary_offer', hr.salary_offer,
          'campamento', hr.campamento,
          'pasajes', hr.pasajes,
          'travel_methodology', hr.travel_methodology,
          'other_benefits', hr.other_benefits,
          'approval_summary', case
            when latest_approval.id is null then null
            else jsonb_build_object(
              'step_name', latest_approval.step_name,
              'status', latest_approval.status,
              'decision_comment', latest_approval.decision_comment,
              'decided_at', latest_approval.decided_at,
              'decided_by_name', latest_approval.decided_by_name
            )
          end
        ) as payload,
        coalesce(hr.rejected_at, hr.updated_at, hr.submitted_at, hr.created_at) as sort_opened_at
      from public.hiring_requests hr
      left join public.recruitment_cases rc
        on rc.hiring_request_id = hr.id
      left join lateral (
        select
          hra.id,
          hra.step_name,
          hra.status,
          hra.decision_comment,
          hra.decided_at,
          decision_profile.full_name as decided_by_name
        from public.hiring_request_approvals hra
        left join public.profiles decision_profile
          on decision_profile.id = hra.decision_by
        where hra.hiring_request_id = hr.id
        order by coalesce(hra.decided_at, hra.created_at) desc, hra.id desc
        limit 1
      ) as latest_approval on true
      where rc.id is null
        and hr.status in ('rejected', 'closed')
        and public.user_can_view_hiring_request_process_summary(
          current_user_id,
          hr.requester_id,
          hr.cost_center_code
        )
    ) case_union
    order by case_union.sort_opened_at desc
    limit 60
  ) as case_row;

  if can_access_candidate_control then
    select coalesce(
      jsonb_agg(
        candidate_row.payload
        order by
          candidate_row.sort_case_status_priority asc,
          candidate_row.sort_case_opened_at desc,
          candidate_row.sort_stage_rank asc,
          candidate_row.sort_candidate_created_at asc
      ),
      '[]'::jsonb
    )
      into candidate_control
    from (
      select
        jsonb_build_object(
          'id', rcc.id,
          'candidate_profile_id', cp.id,
          'recruitment_case_id', rc.id,
          'case_code', rc.case_code,
          'folio', hr.folio,
          'case_status', rc.status,
          'national_id', cp.national_id,
          'full_name', cp.full_name,
          'email', cp.email,
          'phone', cp.phone,
          'driver_license_number', cp.driver_license_number,
          'driver_license_class', cp.driver_license_class,
          'driver_license_expiry', cp.driver_license_expiry,
          'stage_code', rcc.stage_code,
          'stage_entered_at', rcc.stage_entered_at,
          'suitability_status', rcc.suitability_status,
          'is_selected', rcc.is_selected,
          'contract_name', rc.contract_name,
          'job_position_name', rc.job_position_name,
          'cost_center_code', rc.cost_center_code,
          'cost_center_name', rc.cost_center_name,
          'owner_name', owner_profile.full_name,
          'active_process_count', coalesce(active_processes.active_process_count, 0),
          'contract_locked_case_id', contract_lock.recruitment_case_id,
          'contract_locked_case_code', contract_lock.case_code,
          'contract_locked_folio', contract_lock.folio,
          'contract_locked_stage_code', contract_lock.stage_code,
          'is_contract_path_blocked', contract_lock.case_candidate_id is not null,
          'interview_notes', rcc.interview_notes
        ) as payload,
        case
          when rc.status = 'ready_to_hire' then 0
          when rc.status = 'screening' then 1
          when rc.status = 'open' then 2
          when rc.status = 'sourcing' then 3
          when rc.status = 'partially_filled' then 4
          when rc.status = 'filled' then 5
          else 6
        end as sort_case_status_priority,
        rc.opened_at as sort_case_opened_at,
        case rcc.stage_code
          when 'ready_for_hire' then 0
          when 'document_review' then 1
          when 'medical_exams' then 2
          when 'who_pending' then 3
          when 'who_approved' then 4
          when 'lead' then 5
          when 'hired' then 6
          when 'rejected' then 7
          when 'withdrawn' then 8
          else 9
        end as sort_stage_rank,
        rcc.created_at as sort_candidate_created_at
      from public.recruitment_case_candidates rcc
      join public.recruitment_cases rc
        on rc.id = rcc.recruitment_case_id
      join public.hiring_requests hr
        on hr.id = rc.hiring_request_id
      join public.candidate_profiles cp
        on cp.id = rcc.candidate_profile_id
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
        select count(*) as active_process_count
        from public.recruitment_case_candidates rcc_active
        join public.recruitment_cases rc_active
          on rc_active.id = rcc_active.recruitment_case_id
        where rcc_active.candidate_profile_id = rcc.candidate_profile_id
          and rcc_active.stage_code not in ('hired', 'rejected', 'withdrawn')
          and rc_active.status not in ('filled', 'closed_unfilled', 'cancelled')
      ) as active_processes on true
      left join lateral (
        select *
        from public.find_active_candidate_contract_lock(
          rcc.candidate_profile_id,
          rcc.id
        )
        limit 1
      ) as contract_lock on true
      where public.user_can_access_recruitment_case(current_user_id, rc.id)
        and (
          rcc.stage_code in ('rejected', 'withdrawn')
          or (
            rc.status not in ('filled', 'closed_unfilled', 'cancelled')
            and rcc.stage_code not in ('hired', 'rejected', 'withdrawn')
          )
        )
    ) as candidate_row;

    select coalesce(
      jsonb_agg(
        hired_row.payload
        order by
          hired_row.sort_case_opened_at desc,
          hired_row.sort_hired_at desc,
          hired_row.sort_candidate_created_at asc
      ),
      '[]'::jsonb
    )
      into personnel_to_hire
    from (
      select
        jsonb_build_object(
          'id', rcc.id,
          'candidate_profile_id', cp.id,
          'recruitment_case_id', rc.id,
          'case_code', rc.case_code,
          'folio', hr.folio,
          'case_status', rc.status,
          'national_id', cp.national_id,
          'full_name', cp.full_name,
          'email', cp.email,
          'phone', cp.phone,
          'driver_license_number', cp.driver_license_number,
          'driver_license_class', cp.driver_license_class,
          'driver_license_expiry', cp.driver_license_expiry,
          'stage_code', rcc.stage_code,
          'stage_entered_at', rcc.stage_entered_at,
          'suitability_status', rcc.suitability_status,
          'is_selected', rcc.is_selected,
          'contract_name', rc.contract_name,
          'job_position_name', rc.job_position_name,
          'cost_center_code', rc.cost_center_code,
          'cost_center_name', rc.cost_center_name,
          'owner_name', owner_profile.full_name,
          'active_process_count', 0,
          'contract_locked_case_id', null,
          'contract_locked_case_code', null,
          'contract_locked_folio', null,
          'contract_locked_stage_code', null,
          'is_contract_path_blocked', false,
          'interview_notes', rcc.interview_notes,
          'hired_at', rcc.hired_at
        ) as payload,
        rc.opened_at as sort_case_opened_at,
        coalesce(rcc.hired_at, rcc.updated_at, rcc.created_at) as sort_hired_at,
        rcc.created_at as sort_candidate_created_at
      from public.recruitment_case_candidates rcc
      join public.recruitment_cases rc
        on rc.id = rcc.recruitment_case_id
      join public.hiring_requests hr
        on hr.id = rc.hiring_request_id
      join public.candidate_profiles cp
        on cp.id = rcc.candidate_profile_id
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
      where public.user_can_access_recruitment_case(current_user_id, rc.id)
        and rcc.stage_code = 'hired'
    ) as hired_row;
  end if;

  return jsonb_build_object(
    'summary', coalesce(summary, '{}'::jsonb),
    'pending_approvals', coalesce(pending_approvals, '[]'::jsonb),
    'active_cases', coalesce(active_cases, '[]'::jsonb),
    'candidate_control', coalesce(candidate_control, '[]'::jsonb),
    'personnel_to_hire', coalesce(personnel_to_hire, '[]'::jsonb)
  );
end;
$function$;

notify pgrst, 'reload schema';

commit;
