begin;

alter table public.candidate_stage_approvals
  add column if not exists causes jsonb not null default '[]'::jsonb;

create or replace function public.normalize_candidate_who_causes(
  p_causes jsonb
)
returns jsonb
language plpgsql
stable
as $function$
declare
  cause_item jsonb;
  normalized jsonb := '[]'::jsonb;
  cause_type text;
  cause_year_text text;
  cause_year integer;
  cause_comment text;
  cause_count integer := 0;
begin
  if p_causes is null or jsonb_typeof(p_causes) <> 'array' then
    raise exception 'Debes informar las causas Who en formato lista';
  end if;

  cause_count := jsonb_array_length(p_causes);

  if cause_count = 0 then
    raise exception 'Debes registrar al menos una causa Who antes de enviar la aprobación';
  end if;

  if cause_count > 4 then
    raise exception 'Solo se permiten hasta 4 causas Who por solicitud';
  end if;

  for cause_item in
    select value
    from jsonb_array_elements(p_causes)
  loop
    cause_type := lower(trim(coalesce(cause_item->>'type', '')));
    cause_year_text := trim(coalesce(cause_item->>'year', ''));
    cause_comment := nullif(trim(coalesce(cause_item->>'comment', '')), '');

    if cause_type not in ('laboral', 'penal', 'civil') then
      raise exception 'Cada causa Who debe indicar tipo laboral, penal o civil';
    end if;

    if cause_year_text !~ '^\d{4}$' then
      raise exception 'Cada causa Who debe indicar un año válido de 4 dígitos';
    end if;

    cause_year := cause_year_text::integer;

    if cause_year < 1900 or cause_year > extract(year from timezone('utc', now()))::integer + 1 then
      raise exception 'El año informado en causas Who está fuera de rango';
    end if;

    if cause_comment is null then
      raise exception 'Cada causa Who debe incluir comentario';
    end if;

    normalized := normalized || jsonb_build_array(
      jsonb_build_object(
        'type', cause_type,
        'year', cause_year,
        'comment', cause_comment
      )
    );
  end loop;

  return normalized;
end;
$function$;

drop function if exists public.advance_recruitment_candidate_stage(uuid, text, text);
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

  if p_to_stage not in (
    'lead',
    'who_pending',
    'who_approved',
    'medical_exams',
    'document_review',
    'ready_for_hire',
    'hired',
    'rejected',
    'withdrawn'
  ) then
    raise exception 'Etapa invalida';
  end if;

  if p_to_stage = 'who_pending' then
    raise exception 'La etapa Who debe solicitarse con request_candidate_stage_who';
  end if;

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para actualizar este candidato';
  end if;

  if candidate_record.stage_code in ('hired', 'rejected', 'withdrawn') then
    raise exception 'El candidato ya se encuentra en una etapa terminal';
  end if;

  if candidate_record.stage_code = p_to_stage then
    raise exception 'El candidato ya se encuentra en esta etapa';
  end if;

  if candidate_record.stage_code = 'lead'
     and p_to_stage not in ('rejected', 'withdrawn') then
    raise exception 'Desde Lead solo puedes enviar a Who o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'who_pending'
     and p_to_stage not in ('rejected', 'withdrawn') then
    raise exception 'El candidato no puede avanzar hasta que la aprobación Who sea resuelta';
  end if;

  if candidate_record.stage_code = 'who_approved'
     and p_to_stage not in ('medical_exams', 'rejected', 'withdrawn') then
    raise exception 'Desde Who Aprobado solo puedes mover a Exámenes Médicos o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'medical_exams'
     and p_to_stage not in ('document_review', 'rejected', 'withdrawn') then
    raise exception 'Desde Exámenes Médicos solo puedes mover a Revisión Documental o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'document_review'
     and p_to_stage not in ('ready_for_hire', 'rejected', 'withdrawn') then
    raise exception 'Desde Revisión Documental solo puedes mover a Listo para contratar o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'ready_for_hire'
     and p_to_stage not in ('hired', 'rejected', 'withdrawn') then
    raise exception 'Desde Listo para contratar solo puedes contratar o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'who_approved'
     and p_to_stage = 'medical_exams'
     and not exists (
       select 1
       from public.candidate_stage_approvals csa
       where csa.recruitment_case_candidate_id = candidate_record.id
         and csa.stage_code = 'who_pending'
         and csa.status = 'approved'
     ) then
    raise exception 'No existe aprobación Who resuelta para avanzar a Exámenes Médicos';
  end if;

  if p_to_stage = 'ready_for_hire' then
    select *
      into conflicting_contract_lock
      from public.find_active_candidate_contract_lock(
        candidate_record.candidate_profile_id,
        candidate_record.id
      )
      limit 1;

    if conflicting_contract_lock.case_candidate_id is not null then
      raise exception 'El candidato mantiene una ruta contractual activa y no puede quedar listo para contratar';
    end if;
  end if;

  update public.recruitment_case_candidates rcc
     set stage_code = p_to_stage,
         stage_entered_at = timezone('utc', now()),
         hired_at = case when p_to_stage = 'hired' then timezone('utc', now()) else rcc.hired_at end,
         rejection_reason = case when p_to_stage = 'rejected' then normalized_comment else rcc.rejection_reason end,
         withdrawal_reason = case when p_to_stage = 'withdrawn' then normalized_comment else rcc.withdrawal_reason end,
         updated_at = timezone('utc', now())
   where rcc.id = candidate_record.id;

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id,
    from_stage,
    to_stage,
    changed_by,
    reason_code,
    comment
  )
  values (
    candidate_record.id,
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
      'stage_code', candidate_record.stage_code
    ),
    jsonb_build_object(
      'stage_code', p_to_stage
    ),
    jsonb_build_object(
      'comment', normalized_comment
    )
  );

  next_case_status := public.sync_recruitment_case_status(candidate_record.recruitment_case_id, current_user_id);

  return query
  select candidate_record.recruitment_case_id, p_to_stage, next_case_status;
end;
$function$;

create or replace function public.request_candidate_stage_who(
  p_case_candidate_id uuid,
  p_comment text default null,
  p_causes jsonb default '[]'::jsonb
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
  normalized_causes jsonb := public.normalize_candidate_who_causes(p_causes);
  next_case_status text;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para solicitar aprobación Who';
  end if;

  if candidate_record.stage_code <> 'lead' then
    raise exception 'La aprobación Who solo puede solicitarse desde la etapa Lead';
  end if;

  update public.candidate_stage_approvals csa
     set status = 'cancelled',
         updated_at = timezone('utc', now())
   where csa.recruitment_case_candidate_id = candidate_record.id
     and csa.stage_code = 'who_pending'
     and csa.status = 'pending';

  insert into public.candidate_stage_approvals (
    recruitment_case_candidate_id,
    stage_code,
    status,
    requested_by,
    requested_at,
    comment,
    causes,
    created_at,
    updated_at
  )
  values (
    candidate_record.id,
    'who_pending',
    'pending',
    current_user_id,
    timezone('utc', now()),
    normalized_comment,
    normalized_causes,
    timezone('utc', now()),
    timezone('utc', now())
  );

  update public.recruitment_case_candidates rcc
     set stage_code = 'who_pending',
         stage_entered_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   where rcc.id = candidate_record.id;

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id,
    from_stage,
    to_stage,
    changed_by,
    reason_code,
    comment
  )
  values (
    candidate_record.id,
    candidate_record.stage_code,
    'who_pending',
    current_user_id,
    'who_requested',
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
    'candidate_stage_approval_requested',
    jsonb_build_object(
      'stage_code', candidate_record.stage_code
    ),
    jsonb_build_object(
      'stage_code', 'who_pending'
    ),
    jsonb_build_object(
      'comment', normalized_comment,
      'causes', normalized_causes
    )
  );

  next_case_status := public.sync_recruitment_case_status(candidate_record.recruitment_case_id, current_user_id);

  return query
  select candidate_record.recruitment_case_id, 'who_pending'::text, next_case_status;
end;
$function$;

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
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_view_recruitment_case(current_user_id, p_case_id) then
    raise exception 'Sin permisos para ver este caso';
  end if;

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
        'interview_notes', rcc.interview_notes,
        'stage_code', rcc.stage_code,
        'stage_entered_at', rcc.stage_entered_at,
        'suitability_status', rcc.suitability_status,
        'is_selected', rcc.is_selected,
        'hired_at', rcc.hired_at,
        'created_at', rcc.created_at,
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

  return jsonb_build_object(
    'case', case_payload,
    'assignments', assignments_payload,
    'candidates', candidates_payload,
    'audit', audit_payload
  );
end;
$function$;

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
      null::text as requested_by_name,
      null::jsonb as who_causes
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
      requester_profile.full_name as requested_by_name,
      csa.causes as who_causes
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
      null::text as requested_by_name,
      null::jsonb as who_causes
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
      requester_profile.full_name as requested_by_name,
      csa.causes as who_causes
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

revoke all on function public.advance_recruitment_candidate_stage(uuid, text, text) from public, anon;
grant execute on function public.advance_recruitment_candidate_stage(uuid, text, text) to authenticated;

revoke all on function public.request_candidate_stage_who(uuid, text, jsonb) from public, anon;
grant execute on function public.request_candidate_stage_who(uuid, text, jsonb) to authenticated;

revoke all on function public.get_recruitment_case_detail(uuid) from public, anon;
grant execute on function public.get_recruitment_case_detail(uuid) to authenticated;

revoke all on function public.get_dashboard_tasks(uuid) from public, anon;
grant execute on function public.get_dashboard_tasks(uuid) to authenticated;

revoke all on function public.get_dashboard_approval_tracking() from public, anon;
grant execute on function public.get_dashboard_approval_tracking() to authenticated;

notify pgrst, 'reload schema';

commit;
