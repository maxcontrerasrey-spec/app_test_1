begin;

create or replace function public.user_can_view_hiring_request_process_summary(
  target_user_id uuid,
  requester_user_id uuid,
  request_cost_center_code text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    target_user_id is not null
    and (
      public.user_is_admin(target_user_id)
      or public.user_has_role(target_user_id, 'reclutamiento')
      or public.user_has_role(target_user_id, 'control_contratos')
      or public.user_has_role(target_user_id, 'director_eje')
      or public.user_has_role(target_user_id, 'gerente_general')
      or public.user_has_role(target_user_id, 'director_op')
      or (
        public.user_has_role(target_user_id, 'gerencia')
        and exists (
          select 1
          from public.cost_center_approvers cca
          where cca.cost_center_code = request_cost_center_code
            and cca.approver_user_id = target_user_id
            and cca.is_active = true
        )
      )
      or (
        not public.user_has_role(target_user_id, 'gerencia')
        and requester_user_id = target_user_id
      )
    );
$function$;

create or replace function public.user_can_view_recruitment_process_summary(
  target_user_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.recruitment_cases rc
    join public.hiring_requests hr
      on hr.id = rc.hiring_request_id
    where rc.id = target_case_id
      and public.user_can_view_hiring_request_process_summary(
        target_user_id,
        hr.requester_id,
        hr.cost_center_code
      )
  );
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
    where rc.status in ('open', 'ready_to_hire')
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

  if not public.user_can_access_module(current_user_id, 'control_contrataciones') then
    raise exception 'Sin permisos para ver control de contrataciones';
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
          'hired_candidates', coalesce(candidate_stats.hired_candidates, 0),
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
      left join lateral (
        select
          count(*) filter (
            where rcc.stage_code not in ('rejected', 'withdrawn', 'hired', 'ready_for_hire')
          ) as candidate_count,
          count(*) filter (where rcc.stage_code = 'ready_for_hire') as ready_candidates,
          count(*) filter (where rcc.stage_code = 'hired') as hired_candidates
        from public.recruitment_case_candidates rcc
        where rcc.recruitment_case_id = rc.id
      ) as candidate_stats on true
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
          'contract_locked_case_id', contract_lock.case_id,
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
          else 7
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
          (
            rc.status not in ('filled', 'closed_unfilled', 'cancelled')
            and rcc.stage_code not in ('hired', 'rejected', 'withdrawn')
          )
          or (
            rc.status = 'cancelled'
            and hr.status = 'closed'
            and rcc.stage_code in ('rejected', 'withdrawn')
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

revoke all on function public.user_can_view_hiring_request_process_summary(uuid, uuid, text) from public, anon;
grant execute on function public.user_can_view_hiring_request_process_summary(uuid, uuid, text) to authenticated;

revoke all on function public.user_can_view_recruitment_process_summary(uuid, uuid) from public, anon;
grant execute on function public.user_can_view_recruitment_process_summary(uuid, uuid) to authenticated;

revoke all on function public.get_dashboard_home_bundle(integer) from public, anon;
grant execute on function public.get_dashboard_home_bundle(integer) to authenticated;

revoke all on function public.get_recruitment_control_dashboard_v2() from public, anon;
grant execute on function public.get_recruitment_control_dashboard_v2() to authenticated;

notify pgrst, 'reload schema';

commit;
