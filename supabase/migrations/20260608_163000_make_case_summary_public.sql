begin;

create or replace function public.get_recruitment_case_detail(
  p_case_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  case_payload jsonb;
  assignments_payload jsonb := '[]'::jsonb;
  candidates_payload jsonb := '[]'::jsonb;
  audit_payload jsonb := '[]'::jsonb;
  has_full_access boolean;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  -- 1. Determinar si el usuario tiene acceso completo al detalle sensible (candidatos)
  has_full_access := public.user_can_access_candidate_control(current_user_id)
                     and public.user_can_view_recruitment_case(current_user_id, p_case_id);

  -- 2. Cargar siempre los datos básicos del caso (necesarios para el widget global "Folios en curso")
  select jsonb_build_object(
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
    'close_reason', rc.close_reason,
    'hiring_request', jsonb_build_object(
      'id', hr.id,
      'folio', hr.folio,
      'requester_name', hr.requester_name,
      'requester_email', hr.requester_email,
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
    )
  )
  into case_payload
  from public.recruitment_cases rc
  join public.hiring_requests hr
    on hr.id = rc.hiring_request_id
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
      and hra.status in ('approved', 'rejected')
    order by coalesce(hra.decided_at, hra.updated_at, hra.created_at) desc, hra.id desc
    limit 1
  ) latest_approval on true
  where rc.id = p_case_id;

  if case_payload is null then
    raise exception 'Caso no encontrado';
  end if;

  -- 3. Cargar datos sensibles (candidatos, asignaciones, auditoría) SOLO si tiene acceso completo
  if has_full_access then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', rca.id,
          'user_id', rca.user_id,
          'assignment_role', rca.assignment_role,
          'is_primary', rca.is_primary,
          'assigned_at', rca.assigned_at,
          'full_name', p.full_name,
          'email', p.email
        )
        order by rca.is_primary desc, rca.id asc
      ),
      '[]'::jsonb
    )
    into assignments_payload
    from public.recruitment_case_assignments rca
    join public.profiles p
      on p.id = rca.user_id
    where rca.recruitment_case_id = p_case_id;

    select coalesce(
      jsonb_agg(candidate_row.payload order by candidate_row.sort_created_at asc),
      '[]'::jsonb
    )
    into candidates_payload
    from (
      select
        jsonb_build_object(
          'id', rcc.id,
          'candidate_profile_id', cp.id,
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
          'hired_at', rcc.hired_at,
          'created_at', rcc.created_at,
          'worker_file', (
            select case
              when cwf.id is null then null
              else jsonb_build_object(
                'id', cwf.id,
                'project_name', cwf.project_name,
                'company_entry_date', cwf.company_entry_date,
                'shift_name', cwf.shift_name,
                'advance_amount', cwf.advance_amount,
                'contract_notes', cwf.contract_notes,
                'created_at', cwf.created_at,
                'updated_at', cwf.updated_at
              )
            end
            from public.candidate_worker_files cwf
            where cwf.recruitment_case_candidate_id = rcc.id
            limit 1
          ),
          'who_approval', (
            select jsonb_build_object(
              'id', csa.id,
              'status', csa.status,
              'requested_by', csa.requested_by,
              'requested_by_name', requested_profile.full_name,
              'requested_at', csa.requested_at,
              'approved_by', csa.approved_by,
              'approved_by_name', approved_profile.full_name,
              'approved_at', csa.approved_at,
              'comment', csa.comment,
              'causes', csa.causes
            )
            from public.candidate_stage_approvals csa
            left join public.profiles requested_profile
              on requested_profile.id = csa.requested_by
            left join public.profiles approved_profile
              on approved_profile.id = csa.approved_by
            where csa.recruitment_case_candidate_id = rcc.id
              and csa.stage_code = 'who_pending'
            order by coalesce(csa.approved_at, csa.requested_at) desc, csa.id desc
            limit 1
          ),
          'stage_history', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', sh.id,
                'from_stage', sh.from_stage,
                'to_stage', sh.to_stage,
                'changed_by', sh.changed_by,
                'reason_code', sh.reason_code,
                'comment', sh.comment,
                'created_at', sh.created_at
              )
              order by sh.created_at desc
            )
            from public.recruitment_case_candidate_stage_history sh
            where sh.recruitment_case_candidate_id = rcc.id
          ), '[]'::jsonb)
        ) as payload,
        rcc.created_at as sort_created_at
      from public.recruitment_case_candidates rcc
      join public.candidate_profiles cp
        on cp.id = rcc.candidate_profile_id
      where rcc.recruitment_case_id = p_case_id
    ) as candidate_row;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', al.id,
          'action_type', al.action_type,
          'actor_user_id', al.actor_user_id,
          'actor_name', actor_profile.full_name,
          'old_values', al.old_values,
          'new_values', al.new_values,
          'metadata', al.metadata,
          'created_at', al.created_at
        )
        order by al.created_at desc
      ),
      '[]'::jsonb
    )
    into audit_payload
    from public.recruitment_case_audit_log al
    left join public.profiles actor_profile
      on actor_profile.id = al.actor_user_id
    where al.recruitment_case_id = p_case_id
    limit 40;
  end if;

  return jsonb_build_object(
    'case', case_payload,
    'assignments', assignments_payload,
    'candidates', candidates_payload,
    'audit', audit_payload
  );
end;
$function$;

revoke all on function public.get_recruitment_case_detail(uuid) from public, anon;
grant execute on function public.get_recruitment_case_detail(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
