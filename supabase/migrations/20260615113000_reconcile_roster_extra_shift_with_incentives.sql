begin;

create or replace function public.reconcile_hr_roster_extra_shift_from_incentives(
  p_buk_employee_id text,
  p_service_date date,
  p_document_type text default null,
  p_document_number text default null,
  p_full_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  existing_row public.hr_roster_exceptions%rowtype;
  request_identity_row record;
  active_request_count integer := 0;
  active_folios text;
  active_type_names text;
  normalized_buk_employee_id text := trim(coalesce(p_buk_employee_id, ''));
  resolved_document_type text;
  resolved_document_number text;
  resolved_full_name text;
  resolved_note text;
  resolved_action text := 'noop';
begin
  if normalized_buk_employee_id = '' then
    raise exception 'Debe indicar el trabajador BUK para reconciliar el calendario operativo';
  end if;

  if p_service_date is null then
    raise exception 'Debe indicar la fecha de servicio para reconciliar el calendario operativo';
  end if;

  select *
    into existing_row
  from public.hr_roster_exceptions hre
  where hre.employee_buk_employee_id = normalized_buk_employee_id
    and hre.exception_date = p_service_date
  limit 1
  for update;

  select
    hir.employee_document_type,
    hir.employee_document_number,
    hir.employee_full_name,
    count(*)::integer as active_request_count,
    string_agg(hir.folio::text, ', ' order by hir.folio) as active_folios,
    string_agg(distinct hir.incentive_type_name, ', ' order by hir.incentive_type_name) as active_type_names
  into request_identity_row
  from public.hr_incentive_requests hir
  where hir.employee_buk_employee_id = normalized_buk_employee_id
    and hir.service_date::date = p_service_date
    and hir.declared_rest_day is true
    and hir.status in ('P', 'E', 'F')
  group by
    hir.employee_document_type,
    hir.employee_document_number,
    hir.employee_full_name
  order by max(hir.created_at) desc
  limit 1;

  if request_identity_row is not null then
    active_request_count := request_identity_row.active_request_count;
    active_folios := request_identity_row.active_folios;
    active_type_names := request_identity_row.active_type_names;
  end if;

  resolved_document_type := coalesce(
    nullif(trim(coalesce(p_document_type, '')), ''),
    nullif(trim(coalesce(request_identity_row.employee_document_type, '')), ''),
    nullif(trim(coalesce(existing_row.employee_document_type, '')), ''),
    'rut'
  );
  resolved_document_number := coalesce(
    nullif(trim(coalesce(p_document_number, '')), ''),
    nullif(trim(coalesce(request_identity_row.employee_document_number, '')), ''),
    nullif(trim(coalesce(existing_row.employee_document_number, '')), '')
  );
  resolved_full_name := coalesce(
    nullif(trim(coalesce(p_full_name, '')), ''),
    nullif(trim(coalesce(request_identity_row.employee_full_name, '')), ''),
    nullif(trim(coalesce(existing_row.employee_full_name, '')), '')
  );

  if active_request_count = 0 then
    if existing_row.id is not null
       and existing_row.exception_type = 'extra_shift'
       and existing_row.exception_source = 'incentive_auto' then
      if existing_row.superseded_exception_type is not null then
        update public.hr_roster_exceptions
        set
          exception_type = existing_row.superseded_exception_type,
          exception_source = coalesce(existing_row.superseded_exception_source, 'manual'),
          notes = existing_row.superseded_notes,
          created_by = existing_row.superseded_created_by,
          superseded_exception_type = null,
          superseded_exception_source = null,
          superseded_notes = null,
          superseded_created_by = null,
          is_active = true,
          updated_at = timezone('utc', now())
        where id = existing_row.id;

        resolved_action := 'restored_superseded_exception';
      else
        update public.hr_roster_exceptions
        set
          is_active = false,
          notes = null,
          superseded_exception_type = null,
          superseded_exception_source = null,
          superseded_notes = null,
          superseded_created_by = null,
          updated_at = timezone('utc', now())
        where id = existing_row.id;

        resolved_action := 'deactivated_incentive_auto_exception';
      end if;
    else
      resolved_action := 'no_active_rest_day_incentives';
    end if;

    return jsonb_build_object(
      'action', resolved_action,
      'active_request_count', active_request_count,
      'exception_id', existing_row.id,
      'exception_source', existing_row.exception_source
    );
  end if;

  resolved_note := format(
    'Marcado automáticamente por incentivo(s) folio %s (%s).',
    coalesce(active_folios, 'sin folio'),
    coalesce(active_type_names, 'Sin tipo')
  );

  if existing_row.id is null then
    insert into public.hr_roster_exceptions (
      employee_buk_employee_id,
      employee_document_type,
      employee_document_number,
      employee_full_name,
      exception_date,
      exception_type,
      exception_source,
      notes,
      created_by
    )
    values (
      normalized_buk_employee_id,
      resolved_document_type,
      resolved_document_number,
      resolved_full_name,
      p_service_date,
      'extra_shift',
      'incentive_auto',
      resolved_note,
      auth.uid()
    );

    return jsonb_build_object(
      'action', 'created_incentive_auto_exception',
      'active_request_count', active_request_count,
      'exception_source', 'incentive_auto'
    );
  end if;

  if existing_row.exception_source = 'buk' then
    return jsonb_build_object(
      'action', 'preserved_buk_exception',
      'active_request_count', active_request_count,
      'exception_id', existing_row.id,
      'exception_source', existing_row.exception_source
    );
  end if;

  if existing_row.exception_source = 'incentive_auto' then
    update public.hr_roster_exceptions
    set
      employee_document_type = resolved_document_type,
      employee_document_number = resolved_document_number,
      employee_full_name = resolved_full_name,
      exception_type = 'extra_shift',
      notes = resolved_note,
      is_active = true,
      updated_at = timezone('utc', now())
    where id = existing_row.id;

    return jsonb_build_object(
      'action', 'refreshed_incentive_auto_exception',
      'active_request_count', active_request_count,
      'exception_id', existing_row.id,
      'exception_source', existing_row.exception_source
    );
  end if;

  if existing_row.is_active then
    return jsonb_build_object(
      'action', 'preserved_existing_manual_exception',
      'active_request_count', active_request_count,
      'exception_id', existing_row.id,
      'exception_source', existing_row.exception_source,
      'exception_type', existing_row.exception_type
    );
  end if;

  update public.hr_roster_exceptions
  set
    employee_document_type = resolved_document_type,
    employee_document_number = resolved_document_number,
    employee_full_name = resolved_full_name,
    exception_type = 'extra_shift',
    exception_source = 'incentive_auto',
    notes = resolved_note,
    superseded_exception_type = case
      when existing_row.exception_source <> 'incentive_auto' then existing_row.exception_type
      else existing_row.superseded_exception_type
    end,
    superseded_exception_source = case
      when existing_row.exception_source <> 'incentive_auto' then existing_row.exception_source
      else existing_row.superseded_exception_source
    end,
    superseded_notes = case
      when existing_row.exception_source <> 'incentive_auto' then existing_row.notes
      else existing_row.superseded_notes
    end,
    superseded_created_by = case
      when existing_row.exception_source <> 'incentive_auto' then existing_row.created_by
      else existing_row.superseded_created_by
    end,
    is_active = true,
    updated_at = timezone('utc', now())
  where id = existing_row.id;

  return jsonb_build_object(
    'action', 'replaced_inactive_exception_with_incentive_auto',
    'active_request_count', active_request_count,
    'exception_id', existing_row.id,
    'exception_source', 'incentive_auto'
  );
end;
$function$;

create or replace function public.upsert_hr_roster_exception(
  p_exception_id uuid default null,
  p_buk_employee_id text default null,
  p_exception_date date default null,
  p_exception_type text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_row record;
  normalized_exception_type text := lower(trim(coalesce(p_exception_type, '')));
  result_id uuid;
  existing_source text;
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para administrar excepciones';
  end if;

  if p_exception_date is null then
    raise exception 'Debe indicar la fecha de la excepción';
  end if;

  if normalized_exception_type not in (
    'vacation',
    'medical_leave',
    'absent',
    'extra_shift',
    'training',
    'administrative_leave',
    'union_leave'
  ) then
    raise exception 'El tipo de excepción no es válido';
  end if;

  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type
  into worker_row
  from public.employees_active_current e
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_row.buk_employee_id is null then
    raise exception 'Trabajador BUK no encontrado para registrar excepción';
  end if;

  if p_exception_id is not null then
    select hre.exception_source
      into existing_source
    from public.hr_roster_exceptions hre
    where hre.id = p_exception_id
    limit 1;

    if existing_source is null then
      raise exception 'La excepción seleccionada no existe';
    end if;

    if existing_source = 'buk' then
      raise exception 'La excepción de esta fecha está gobernada por BUK y no puede modificarse manualmente';
    end if;

    if existing_source = 'incentive_auto' then
      raise exception 'La excepción de esta fecha fue generada automáticamente por Incentivos y no puede modificarse manualmente';
    end if;

    update public.hr_roster_exceptions
    set
      employee_buk_employee_id = worker_row.buk_employee_id,
      employee_document_type = worker_row.document_type,
      employee_document_number = worker_row.document_number,
      employee_full_name = worker_row.full_name,
      exception_date = p_exception_date,
      exception_type = normalized_exception_type,
      exception_source = 'manual',
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      is_active = true,
      updated_at = timezone('utc', now())
    where id = p_exception_id
    returning id into result_id;
  else
    insert into public.hr_roster_exceptions (
      employee_buk_employee_id,
      employee_document_type,
      employee_document_number,
      employee_full_name,
      exception_date,
      exception_type,
      exception_source,
      notes,
      created_by
    )
    values (
      worker_row.buk_employee_id,
      worker_row.document_type,
      worker_row.document_number,
      worker_row.full_name,
      p_exception_date,
      normalized_exception_type,
      'manual',
      nullif(trim(coalesce(p_notes, '')), ''),
      current_user_id
    )
    on conflict (employee_buk_employee_id, exception_date)
    do update
      set
        employee_document_type = excluded.employee_document_type,
        employee_document_number = excluded.employee_document_number,
        employee_full_name = excluded.employee_full_name,
        exception_type = excluded.exception_type,
        exception_source = 'manual',
        notes = excluded.notes,
        is_active = true,
        updated_at = timezone('utc', now())
      where public.hr_roster_exceptions.exception_source not in ('buk', 'incentive_auto')
    returning id into result_id;

    if result_id is null then
      raise exception 'La excepción de esta fecha está gobernada por BUK o fue generada por Incentivos y no puede reemplazarse manualmente';
    end if;
  end if;

  return result_id;
end;
$function$;

create or replace function public.set_hr_roster_exception_status(
  p_exception_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  existing_source text;
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para administrar excepciones';
  end if;

  select hre.exception_source
    into existing_source
  from public.hr_roster_exceptions hre
  where hre.id = p_exception_id
  limit 1;

  if existing_source is null then
    raise exception 'La excepción seleccionada no existe';
  end if;

  if existing_source = 'buk' then
    raise exception 'La excepción de esta fecha está gobernada por BUK y no puede activarse ni desactivarse manualmente';
  end if;

  if existing_source = 'incentive_auto' then
    raise exception 'La excepción de esta fecha fue generada automáticamente por Incentivos y no puede activarse ni desactivarse manualmente';
  end if;

  update public.hr_roster_exceptions
  set
    is_active = coalesce(p_is_active, false),
    updated_at = timezone('utc', now())
  where id = p_exception_id;
end;
$function$;

create or replace function public.create_hr_incentive_request(
  p_buk_employee_id text,
  p_incentive_type_id uuid,
  p_selected_contract_code text,
  p_selected_area_name text,
  p_selected_area_code text default null,
  p_service_date timestamptz default null,
  p_duration_hours numeric default null,
  p_motive text default null,
  p_description text default null,
  p_replacement_buk_employee_id text default null,
  p_declared_rest_day boolean default null
)
returns table (
  request_id uuid,
  folio bigint,
  status text,
  calculated_amount numeric,
  period_code text,
  entry_lag_days integer,
  is_out_of_deadline boolean,
  is_contract_mismatch boolean
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_data jsonb;
  replacement_worker_data jsonb;
  preview_payload jsonb;
  rule_data jsonb;
  approver_context_row record;
  replacement_roster_row record;
  new_request_id uuid;
  new_folio bigint;
  resolved_now timestamptz := timezone('utc', now());
  resolved_service_at timestamptz := coalesce(p_service_date, resolved_now);
  resolved_period_code text := public.resolve_hr_incentive_period_code(coalesce(p_service_date, resolved_now));
  resolved_entry_lag_days integer := public.resolve_hr_incentive_entry_lag_days(
    resolved_now,
    coalesce(p_service_date, resolved_now)
  );
  resolved_is_out_of_deadline boolean := false;
  resolved_is_contract_mismatch boolean := false;
  resolved_actual_rest_day boolean := false;
  resolved_schedule_status text;
  resolved_schedule_label text;
  resolved_replacement_schedule_status text;
  resolved_replacement_schedule_label text;
  calendar_sync_result jsonb := jsonb_build_object('action', 'not_applicable');
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para registrar incentivos';
  end if;

  if nullif(trim(coalesce(p_selected_contract_code, '')), '') is null then
    raise exception 'Debe seleccionar el contrato/área aplicable';
  end if;

  if nullif(trim(coalesce(p_selected_area_name, '')), '') is null then
    raise exception 'Debe indicar el nombre del contrato/área aplicable';
  end if;

  if p_declared_rest_day is null then
    raise exception 'Debes confirmar si el trabajador estaba en descanso antes de registrar el incentivo';
  end if;

  if resolved_entry_lag_days > 7 then
    raise exception
      'No se pueden registrar incentivos con más de 7 días hacia atrás. Fecha mínima permitida: %',
      to_char(
        timezone('America/Santiago', resolved_now)::date - 7,
        'DD/MM/YYYY'
      );
  end if;

  resolved_is_out_of_deadline := resolved_entry_lag_days > 2;

  worker_data := public.get_hr_incentive_worker_core(p_buk_employee_id);
  resolved_is_contract_mismatch := public.resolve_hr_incentive_contract_mismatch(
    worker_data ->> 'primary_contract_code',
    trim(p_selected_contract_code)
  );

  preview_payload := public.build_hr_incentive_preview_from_worker_data(
    worker_data,
    p_buk_employee_id,
    p_incentive_type_id,
    p_selected_contract_code,
    p_duration_hours,
    resolved_service_at::date
  );
  rule_data := preview_payload -> 'rule';
  resolved_actual_rest_day := coalesce(
    (preview_payload -> 'roster_validation' ->> 'is_rest_day')::boolean,
    false
  );
  resolved_schedule_status := preview_payload -> 'roster_validation' ->> 'schedule_status';
  resolved_schedule_label := preview_payload -> 'roster_validation' ->> 'schedule_label';

  if p_declared_rest_day is distinct from resolved_actual_rest_day then
    raise exception
      'La confirmación "En descanso" no coincide con la pauta vigente. Para el % el sistema detecta "%".',
      to_char(resolved_service_at::date, 'DD/MM/YYYY'),
      coalesce(resolved_schedule_label, 'Sin pauta');
  end if;

  select *
  into approver_context_row
  from public.resolve_hr_incentive_contract_approvers(trim(p_selected_contract_code));

  if coalesce((rule_data ->> 'requires_replacement')::boolean, false) then
    if nullif(trim(coalesce(p_replacement_buk_employee_id, '')), '') is null then
      raise exception 'El tipo de incentivo seleccionado exige trabajador reemplazado';
    end if;

    replacement_worker_data := public.get_hr_incentive_worker_core(p_replacement_buk_employee_id);

    select *
    into replacement_roster_row
    from public.resolve_hr_roster_day_status(
      p_replacement_buk_employee_id,
      resolved_service_at::date
    );

    resolved_replacement_schedule_status := replacement_roster_row.effective_status;
    resolved_replacement_schedule_label := coalesce(
      replacement_roster_row.exception_label,
      case replacement_roster_row.effective_status
        when 'working' then 'En turno'
        when 'extra_shift' then 'Turno adicional'
        when 'resting' then 'Descanso'
        when 'training' then 'Capacitación'
        when 'vacation' then 'Vacaciones'
        when 'medical_leave' then 'Licencia médica'
        when 'absent' then 'Inasistencia'
        when 'administrative_leave' then 'Permiso administrativo'
        when 'union_leave' then 'Permiso sindical'
        when 'unassigned' then 'Sin pauta'
        else 'Sin pauta'
      end
    );

    if coalesce(resolved_replacement_schedule_status, 'unassigned') not in ('working', 'extra_shift') then
      raise exception
        'El trabajador reemplazado debe estar en turno para registrar este incentivo. Para el % el sistema detecta "%".',
        to_char(resolved_service_at::date, 'DD/MM/YYYY'),
        resolved_replacement_schedule_label;
    end if;
  end if;

  insert into public.hr_incentive_requests as hir (
    employee_buk_employee_id,
    employee_document_type,
    employee_document_number,
    employee_full_name,
    employee_job_title,
    employee_union_name,
    employee_union_status,
    employee_union_joined_at,
    primary_contract_code,
    primary_area_name,
    selected_contract_code,
    selected_area_name,
    selected_area_code,
    incentive_type_id,
    incentive_type_name,
    requires_replacement,
    replacement_buk_employee_id,
    replacement_document_number,
    replacement_full_name,
    motive,
    description,
    service_date,
    duration_hours,
    period_code,
    calculation_basis,
    rate_rule_id,
    rate_rule_amount,
    calculated_amount,
    entry_lag_days,
    is_out_of_deadline,
    is_contract_mismatch,
    declared_rest_day,
    status,
    created_by
  )
  values (
    worker_data ->> 'buk_employee_id',
    coalesce(worker_data ->> 'document_type', 'rut'),
    worker_data ->> 'document_number',
    worker_data ->> 'full_name',
    worker_data ->> 'job_title',
    nullif(worker_data ->> 'union_name', ''),
    coalesce(worker_data ->> 'union_status', 'unknown'),
    nullif(worker_data ->> 'union_joined_at', '')::date,
    worker_data ->> 'primary_contract_code',
    worker_data ->> 'primary_area_name',
    trim(p_selected_contract_code),
    trim(p_selected_area_name),
    nullif(trim(coalesce(p_selected_area_code, '')), ''),
    p_incentive_type_id,
    rule_data ->> 'incentive_type_name',
    coalesce((rule_data ->> 'requires_replacement')::boolean, false),
    nullif(trim(coalesce(p_replacement_buk_employee_id, '')), ''),
    nullif(trim(coalesce(replacement_worker_data ->> 'document_number', '')), ''),
    nullif(trim(coalesce(replacement_worker_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(p_motive, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''),
    resolved_service_at,
    p_duration_hours,
    resolved_period_code,
    rule_data ->> 'calculation_basis',
    (rule_data ->> 'rate_rule_id')::uuid,
    (rule_data ->> 'rate_rule_amount')::numeric,
    (preview_payload ->> 'calculated_amount')::numeric,
    resolved_entry_lag_days,
    resolved_is_out_of_deadline,
    resolved_is_contract_mismatch,
    p_declared_rest_day,
    'P',
    current_user_id
  )
  returning hir.id, hir.folio into new_request_id, new_folio;

  if resolved_actual_rest_day then
    calendar_sync_result := public.reconcile_hr_roster_extra_shift_from_incentives(
      worker_data ->> 'buk_employee_id',
      resolved_service_at::date,
      worker_data ->> 'document_type',
      worker_data ->> 'document_number',
      worker_data ->> 'full_name'
    );
  end if;

  insert into public.hr_incentive_request_approvals (
    incentive_request_id,
    step_code,
    step_name,
    step_order,
    approver_user_id,
    approver_name,
    approver_email,
    status,
    created_at,
    updated_at
  )
  values (
    new_request_id,
    'contract_admin',
    'Administrador de contrato',
    1,
    approver_context_row.contract_admin_user_id,
    approver_context_row.contract_admin_name,
    approver_context_row.contract_admin_email,
    'pending',
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.hr_incentive_request_history (
    incentive_request_id,
    action_type,
    actor_user_id,
    metadata
  )
  values (
    new_request_id,
    'created',
    current_user_id,
    jsonb_build_object(
      'selected_contract_code', trim(p_selected_contract_code),
      'selected_area_name', trim(p_selected_area_name),
      'selected_area_code', nullif(trim(coalesce(p_selected_area_code, '')), ''),
      'duration_hours', p_duration_hours,
      'employee_union_name', nullif(worker_data ->> 'union_name', ''),
      'employee_union_status', coalesce(worker_data ->> 'union_status', 'unknown'),
      'calculated_amount', (preview_payload ->> 'calculated_amount')::numeric,
      'period_code', resolved_period_code,
      'entry_lag_days', resolved_entry_lag_days,
      'is_out_of_deadline', resolved_is_out_of_deadline,
      'is_contract_mismatch', resolved_is_contract_mismatch,
      'declared_rest_day', p_declared_rest_day,
      'actual_rest_day', resolved_actual_rest_day,
      'schedule_status', resolved_schedule_status,
      'schedule_label', resolved_schedule_label,
      'replacement_roster_validation', case
        when coalesce((rule_data ->> 'requires_replacement')::boolean, false) then jsonb_build_object(
          'schedule_status', resolved_replacement_schedule_status,
          'schedule_label', resolved_replacement_schedule_label
        )
        else null
      end,
      'calendar_marking', calendar_sync_result ->> 'action',
      'calendar_sync', calendar_sync_result,
      'roster_validation', preview_payload -> 'roster_validation'
    )
  );

  insert into public.hr_incentive_request_history (
    incentive_request_id,
    action_type,
    actor_user_id,
    metadata
  )
  values (
    new_request_id,
    'approval_created',
    current_user_id,
    jsonb_build_object(
      'step_code', 'contract_admin',
      'step_name', 'Administrador de contrato',
      'approver_user_id', approver_context_row.contract_admin_user_id,
      'approver_name', approver_context_row.contract_admin_name,
      'approver_email', approver_context_row.contract_admin_email,
      'status', 'pending',
      'period_code', resolved_period_code,
      'is_out_of_deadline', resolved_is_out_of_deadline,
      'is_contract_mismatch', resolved_is_contract_mismatch
    )
  );

  return query
  select
    new_request_id,
    new_folio,
    'P'::text,
    (preview_payload ->> 'calculated_amount')::numeric,
    resolved_period_code,
    resolved_entry_lag_days,
    resolved_is_out_of_deadline,
    resolved_is_contract_mismatch;
end;
$function$;

create or replace function public.cancel_hr_incentive_request(
  p_request_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
  can_cancel boolean := false;
  request_row public.hr_incentive_requests%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  can_cancel := public.user_is_admin(current_user_id)
    or public.user_has_role(current_user_id, 'control_contratos');

  if not can_cancel then
    raise exception 'Sin permisos para anular incentivos';
  end if;

  select *
  into request_row
  from public.hr_incentive_requests hir
  where hir.id = p_request_id
  for update;

  if request_row.id is null or request_row.status = 'C' then
    raise exception 'Incentivo no encontrado o ya anulado';
  end if;

  update public.hr_incentive_requests hir
     set status = 'C',
         cancelled_at = timezone('utc', now()),
         cancelled_by = current_user_id,
         cancellation_comment = normalized_comment,
         updated_at = timezone('utc', now())
   where hir.id = p_request_id;

  update public.hr_incentive_request_approvals hira
     set status = 'cancelled',
         decision_by = current_user_id,
         decision_comment = coalesce(normalized_comment, 'Incentivo anulado'),
         decided_at = timezone('utc', now()),
         locked_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   where hira.incentive_request_id = p_request_id
     and hira.status = 'pending';

  if request_row.declared_rest_day is true then
    perform public.reconcile_hr_roster_extra_shift_from_incentives(
      request_row.employee_buk_employee_id,
      request_row.service_date::date,
      request_row.employee_document_type,
      request_row.employee_document_number,
      request_row.employee_full_name
    );
  end if;

  insert into public.hr_incentive_request_history (
    incentive_request_id,
    action_type,
    actor_user_id,
    comment
  )
  values (
    p_request_id,
    'cancelled',
    current_user_id,
    normalized_comment
  );
end;
$function$;

create or replace function public.decide_hr_incentive_request_approval(
  p_approval_id bigint,
  p_decision text,
  p_comment text default null
)
returns table (
  request_id uuid,
  request_status text,
  decided_step text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
  approval_row public.hr_incentive_request_approvals%rowtype;
  request_row public.hr_incentive_requests%rowtype;
  next_step_approver_row record;
  next_approval_id bigint;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision invalida';
  end if;

  if p_decision = 'rejected' and normalized_comment is null then
    raise exception 'Debe indicar un comentario al rechazar el incentivo';
  end if;

  select *
  into approval_row
  from public.hr_incentive_request_approvals hira
  where hira.id = p_approval_id
  for update;

  if approval_row.id is null then
    raise exception 'No existe la aprobacion solicitada';
  end if;

  if approval_row.status <> 'pending' then
    raise exception 'La aprobacion ya fue resuelta y no puede volver a decidirse';
  end if;

  if approval_row.approver_user_id is null
     or (approval_row.approver_user_id <> current_user_id and not public.user_is_admin(current_user_id)) then
    raise exception 'El usuario no esta autorizado para decidir esta aprobacion';
  end if;

  select *
  into request_row
  from public.hr_incentive_requests hir
  where hir.id = approval_row.incentive_request_id
  for update;

  if request_row.id is null then
    raise exception 'No existe la solicitud asociada a la aprobacion';
  end if;

  if approval_row.step_code = 'contract_admin' and request_row.status <> 'P' then
    raise exception 'La solicitud no esta pendiente de administrador de contrato';
  end if;

  if approval_row.step_code = 'area_manager' and request_row.status <> 'E' then
    raise exception 'La solicitud no esta pendiente de gerente de area';
  end if;

  update public.hr_incentive_request_approvals hira
     set status = p_decision,
         decision_by = current_user_id,
         decision_comment = normalized_comment,
         decided_at = timezone('utc', now()),
         locked_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   where hira.id = approval_row.id
     and hira.status = 'pending';

  if p_decision = 'rejected' then
    update public.hr_incentive_requests hir
       set status = 'R',
           updated_at = timezone('utc', now())
     where hir.id = request_row.id;

    update public.hr_incentive_request_approvals hira
       set status = 'cancelled',
           decision_by = current_user_id,
           decision_comment = coalesce(normalized_comment, 'Solicitud rechazada'),
           decided_at = timezone('utc', now()),
           locked_at = timezone('utc', now()),
           updated_at = timezone('utc', now())
     where hira.incentive_request_id = request_row.id
       and hira.id <> approval_row.id
       and hira.status = 'pending';

    if request_row.declared_rest_day is true then
      perform public.reconcile_hr_roster_extra_shift_from_incentives(
        request_row.employee_buk_employee_id,
        request_row.service_date::date,
        request_row.employee_document_type,
        request_row.employee_document_number,
        request_row.employee_full_name
      );
    end if;

    insert into public.hr_incentive_request_history (
      incentive_request_id,
      action_type,
      actor_user_id,
      comment,
      metadata
    )
    values (
      request_row.id,
      'rejected',
      current_user_id,
      normalized_comment,
      jsonb_build_object(
        'step_code', approval_row.step_code,
        'step_name', approval_row.step_name
      )
    );

    return query
    select
      request_row.id,
      'R'::text,
      approval_row.step_code;
    return;
  end if;

  if approval_row.step_code = 'contract_admin' then
    select *
    into next_step_approver_row
    from public.resolve_hr_incentive_contract_approvers(request_row.selected_contract_code);

    if exists (
      select 1
      from public.hr_incentive_request_approvals hira_existing
      where hira_existing.incentive_request_id = request_row.id
        and hira_existing.step_code = 'area_manager'
    ) then
      raise exception 'La aprobacion de gerente de area ya existe para este incentivo';
    end if;

    insert into public.hr_incentive_request_approvals (
      incentive_request_id,
      step_code,
      step_name,
      step_order,
      approver_user_id,
      approver_name,
      approver_email,
      status,
      created_at,
      updated_at
    )
    values (
      request_row.id,
      'area_manager',
      'Gerente de area',
      2,
      next_step_approver_row.area_manager_user_id,
      next_step_approver_row.area_manager_name,
      next_step_approver_row.area_manager_email,
      'pending',
      timezone('utc', now()),
      timezone('utc', now())
    )
    returning id into next_approval_id;

    update public.hr_incentive_requests hir
       set status = 'E',
           updated_at = timezone('utc', now())
     where hir.id = request_row.id;

    insert into public.hr_incentive_request_history (
      incentive_request_id,
      action_type,
      actor_user_id,
      comment,
      metadata
    )
    values (
      request_row.id,
      'approved',
      current_user_id,
      normalized_comment,
      jsonb_build_object(
        'step_code', approval_row.step_code,
        'step_name', approval_row.step_name
      )
    );

    insert into public.hr_incentive_request_history (
      incentive_request_id,
      action_type,
      actor_user_id,
      metadata
    )
    values (
      request_row.id,
      'approval_created',
      current_user_id,
      jsonb_build_object(
        'approval_id', next_approval_id,
        'step_code', 'area_manager',
        'step_name', 'Gerente de area',
        'approver_user_id', next_step_approver_row.area_manager_user_id,
        'approver_name', next_step_approver_row.area_manager_name,
        'approver_email', next_step_approver_row.area_manager_email,
        'status', 'pending'
      )
    );

    return query
    select
      request_row.id,
      'E'::text,
      approval_row.step_code;
    return;
  end if;

  update public.hr_incentive_requests hir
     set status = 'F',
         updated_at = timezone('utc', now())
   where hir.id = request_row.id;

  insert into public.hr_incentive_request_history (
    incentive_request_id,
    action_type,
    actor_user_id,
    comment,
    metadata
  )
  values (
    request_row.id,
    'approved_final',
    current_user_id,
    normalized_comment,
    jsonb_build_object(
      'step_code', approval_row.step_code,
      'step_name', approval_row.step_name
    )
  );

  return query
  select
    request_row.id,
    'F'::text,
    approval_row.step_code;
end;
$function$;

revoke all on function public.reconcile_hr_roster_extra_shift_from_incentives(text, date, text, text, text) from public, anon, authenticated;

grant execute on function public.upsert_hr_roster_exception(uuid, text, date, text, text) to authenticated;
grant execute on function public.set_hr_roster_exception_status(uuid, boolean) to authenticated;
grant execute on function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean) to authenticated;
grant execute on function public.cancel_hr_incentive_request(uuid, text) to authenticated;
grant execute on function public.decide_hr_incentive_request_approval(bigint, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
