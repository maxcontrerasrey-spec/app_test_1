begin;

create or replace function public.find_active_candidate_contract_lock(
  p_candidate_profile_id uuid,
  p_excluded_case_candidate_id uuid default null
)
returns table (
  case_candidate_id uuid,
  recruitment_case_id uuid,
  case_code text,
  folio text,
  stage_code text
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    rcc.id as case_candidate_id,
    rc.id as recruitment_case_id,
    rc.case_code,
    hr.folio,
    rcc.stage_code
  from public.recruitment_case_candidates rcc
  join public.recruitment_cases rc
    on rc.id = rcc.recruitment_case_id
  join public.hiring_requests hr
    on hr.id = rc.hiring_request_id
  where rcc.candidate_profile_id = p_candidate_profile_id
    and rcc.stage_code in ('ready_for_hire', 'hired')
    and (p_excluded_case_candidate_id is null or rcc.id <> p_excluded_case_candidate_id)
    and rc.status not in ('closed_unfilled', 'cancelled')
  order by
    case when rcc.stage_code = 'hired' then 0 else 1 end,
    rcc.stage_entered_at desc,
    rcc.created_at desc
  limit 1;
$function$;

create or replace function public.get_recruitment_control_dashboard_v2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  summary jsonb := '{}'::jsonb;
  pending_approvals jsonb := '[]'::jsonb;
  active_cases jsonb := '[]'::jsonb;
  candidate_control jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'control_contrataciones') then
    raise exception 'Sin permisos para ver control de contrataciones';
  end if;

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
    where hra.step_code = 'contracts_control'
      and hra.status = 'pending'
      and (
        public.user_is_admin(current_user_id)
        or hra.approver_user_id = current_user_id
        or public.user_has_role(current_user_id, 'control_contratos')
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
        'requested_entry_date', rc.requested_entry_date,
        'target_close_date', rc.target_close_date,
        'opened_at', rc.opened_at,
        'owner_name', owner_profile.full_name,
        'owner_user_id', owner_assignment.user_id,
        'candidate_count', coalesce(candidate_stats.candidate_count, 0),
        'ready_candidates', coalesce(candidate_stats.ready_candidates, 0),
        'hired_candidates', coalesce(candidate_stats.hired_candidates, 0)
      ) as payload,
      rc.opened_at as sort_opened_at
    from public.recruitment_cases rc
    left join lateral (
      select
        rca.user_id
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
        count(*) as candidate_count,
        count(*) filter (where rcc.stage_code = 'ready_for_hire') as ready_candidates,
        count(*) filter (where rcc.stage_code = 'hired') as hired_candidates
      from public.recruitment_case_candidates rcc
      where rcc.recruitment_case_id = rc.id
    ) as candidate_stats on true
    where public.user_can_access_recruitment_case(current_user_id, rc.id)
    order by rc.opened_at desc
    limit 40
  ) as case_row;

  select coalesce(
    jsonb_agg(candidate_row.payload order by candidate_row.sort_stage_entered_at desc, candidate_row.sort_created_at desc),
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
        'active_process_count', coalesce(active_process_stats.active_process_count, 0),
        'contract_locked_case_id', contract_lock.recruitment_case_id,
        'contract_locked_case_code', contract_lock.case_code,
        'contract_locked_folio', contract_lock.folio,
        'contract_locked_stage_code', contract_lock.stage_code,
        'is_contract_path_blocked', (contract_lock.case_candidate_id is not null)
      ) as payload,
      rcc.stage_entered_at as sort_stage_entered_at,
      rcc.created_at as sort_created_at
    from public.recruitment_case_candidates rcc
    join public.candidate_profiles cp
      on cp.id = rcc.candidate_profile_id
    join public.recruitment_cases rc
      on rc.id = rcc.recruitment_case_id
    join public.hiring_requests hr
      on hr.id = rc.hiring_request_id
    left join lateral (
      select
        rca.user_id
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
      from public.recruitment_case_candidates sibling_rcc
      join public.recruitment_cases sibling_rc
        on sibling_rc.id = sibling_rcc.recruitment_case_id
      where sibling_rcc.candidate_profile_id = cp.id
        and sibling_rcc.stage_code not in ('rejected', 'withdrawn')
        and sibling_rc.status not in ('filled', 'closed_unfilled', 'cancelled')
    ) as active_process_stats on true
    left join lateral (
      select *
      from public.find_active_candidate_contract_lock(cp.id, rcc.id)
    ) as contract_lock on true
    where public.user_can_access_recruitment_case(current_user_id, rc.id)
      and rc.status not in ('filled', 'closed_unfilled', 'cancelled')
    order by rcc.stage_entered_at desc, rcc.created_at desc
    limit 120
  ) as candidate_row;

  return jsonb_build_object(
    'summary', summary,
    'pending_approvals', pending_approvals,
    'active_cases', active_cases,
    'candidate_control', candidate_control
  );
end;
$function$;

create or replace function public.advance_recruitment_candidate_stage(
  p_case_candidate_id uuid,
  p_to_stage text,
  p_comment text default null
)
returns table (
  recruitment_case_id uuid,
  stage_code text,
  case_status text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
  next_case_status text;
  conflicting_contract_lock record;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_to_stage not in ('lead', 'contacted', 'screening', 'shortlisted', 'documents_pending', 'ready_for_hire', 'hired', 'rejected', 'withdrawn') then
    raise exception 'Etapa invalida';
  end if;

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  if not public.user_can_access_recruitment_case(current_user_id, candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para actualizar este candidato';
  end if;

  if candidate_record.stage_code in ('hired', 'rejected', 'withdrawn') then
    raise exception 'El candidato ya se encuentra en una etapa terminal';
  end if;

  if candidate_record.stage_code = p_to_stage then
    raise exception 'El candidato ya se encuentra en esa etapa';
  end if;

  if p_to_stage in ('ready_for_hire', 'hired') then
    select *
      into conflicting_contract_lock
      from public.find_active_candidate_contract_lock(
        candidate_record.candidate_profile_id,
        candidate_record.id
      );

    if conflicting_contract_lock.case_candidate_id is not null then
      raise exception
        'El candidato ya avanza a contrato en % (%)',
        coalesce(conflicting_contract_lock.case_code, 'otro folio'),
        coalesce(conflicting_contract_lock.folio, 'sin folio');
    end if;
  end if;

  update public.recruitment_case_candidates rcc
     set stage_code = p_to_stage,
         stage_entered_at = timezone('utc', now()),
         is_selected = case
           when p_to_stage in ('ready_for_hire', 'hired') then true
           when p_to_stage in ('rejected', 'withdrawn') then false
           else rcc.is_selected
         end,
         hired_at = case
           when p_to_stage = 'hired' then timezone('utc', now())
           else rcc.hired_at
         end,
         rejection_reason = case when p_to_stage = 'rejected' then normalized_comment else rcc.rejection_reason end,
         withdrawal_reason = case when p_to_stage = 'withdrawn' then normalized_comment else rcc.withdrawal_reason end,
         suitability_status = case
           when p_to_stage in ('ready_for_hire', 'hired') then 'fit'
           when p_to_stage in ('rejected', 'withdrawn') then 'blocked'
           else rcc.suitability_status
         end,
         updated_at = timezone('utc', now())
   where rcc.id = p_case_candidate_id;

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id,
    from_stage,
    to_stage,
    changed_by,
    reason_code,
    comment
  )
  values (
    p_case_candidate_id,
    candidate_record.stage_code,
    p_to_stage,
    current_user_id,
    'manual_transition',
    normalized_comment
  );

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    old_values,
    new_values,
    metadata
  )
  values (
    candidate_record.recruitment_case_id,
    candidate_record.id,
    current_user_id,
    case when p_to_stage = 'hired' then 'candidate_hired' else 'candidate_stage_changed' end,
    jsonb_build_object(
      'stage_code', candidate_record.stage_code,
      'is_selected', candidate_record.is_selected,
      'hired_at', candidate_record.hired_at
    ),
    jsonb_build_object(
      'stage_code', p_to_stage,
      'is_selected', case
        when p_to_stage in ('ready_for_hire', 'hired') then true
        when p_to_stage in ('rejected', 'withdrawn') then false
        else candidate_record.is_selected
      end,
      'hired_at', case
        when p_to_stage = 'hired' then timezone('utc', now())
        else candidate_record.hired_at
      end
    ),
    jsonb_build_object('comment', normalized_comment)
  );

  next_case_status := public.sync_recruitment_case_status(candidate_record.recruitment_case_id, current_user_id);

  return query
  select candidate_record.recruitment_case_id, p_to_stage, next_case_status;
end;
$function$;

grant execute on function public.find_active_candidate_contract_lock(uuid, uuid) to authenticated;
grant execute on function public.get_recruitment_control_dashboard_v2() to authenticated;
grant execute on function public.advance_recruitment_candidate_stage(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
