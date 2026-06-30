begin;

create or replace function public.build_hr_incentive_preview_from_worker_data(
  p_worker_data jsonb,
  p_buk_employee_id text,
  p_incentive_type_id uuid,
  p_selected_contract_code text,
  p_duration_hours numeric default null,
  p_service_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  resolved_service_date date := coalesce(p_service_date, current_date);
  worker_job_title text;
  worker_union_name text;
  worker_union_status text;
  rule_row record;
  roster_day_row record;
  conflicting_rest_day_request_row record;
  calculated_amount numeric(12,2);
  resolved_schedule_label text;
  resolved_absence_label text;
  resolved_rest_day_conflict_contract_label text;
  resolved_block_reason text;
begin
  if coalesce(jsonb_typeof(p_worker_data), 'null') <> 'object'
     or nullif(trim(coalesce(p_worker_data ->> 'buk_employee_id', '')), '') is null then
    raise exception 'No fue posible resolver el contexto base del trabajador para calcular el incentivo';
  end if;

  worker_job_title := p_worker_data ->> 'job_title';
  worker_union_name := p_worker_data ->> 'union_name';
  worker_union_status := p_worker_data ->> 'union_status';

  select *
    into rule_row
  from public.resolve_hr_incentive_rate_rule(
    p_incentive_type_id,
    worker_job_title,
    p_selected_contract_code,
    worker_union_name,
    worker_union_status,
    resolved_service_date
  );

  if rule_row.incentive_type_id is null then
    raise exception 'No existe una regla de monto activa para la combinación seleccionada';
  end if;

  select *
    into roster_day_row
  from public.resolve_hr_roster_day_status(p_buk_employee_id, resolved_service_date);

  if not found then
    raise exception 'No fue posible resolver la pauta operativa del trabajador';
  end if;

  resolved_schedule_label := coalesce(
    roster_day_row.exception_label,
    case roster_day_row.base_status
      when 'resting' then 'Descanso'
      when 'working' then 'Turno'
      when 'unassigned' then 'Sin pauta'
      else null
    end
  );

  if roster_day_row.effective_status in ('vacation', 'medical_leave') then
    resolved_absence_label := coalesce(
      roster_day_row.exception_label,
      case roster_day_row.effective_status
        when 'vacation' then 'Vacaciones'
        when 'medical_leave' then 'Licencia médica'
        else 'Vacaciones o licencia médica'
      end
    );

    raise exception
      'No se puede registrar este incentivo porque el trabajador figura con % para la fecha %. Este estado bloquea el registro.',
      resolved_absence_label,
      to_char(resolved_service_date, 'DD/MM/YYYY');
  end if;

  if rule_row.requires_rest_day then
    if roster_day_row.base_status = 'working' then
      raise exception
        'No puedes usar a este trabajador como reemplazo el % porque su pauta lo marca en turno. Este incentivo solo se permite cuando el trabajador está en descanso.',
        to_char(resolved_service_date, 'DD/MM/YYYY');
    elsif roster_day_row.base_status = 'unassigned' then
      raise exception
        'No puedes usar a este trabajador como reemplazo el % porque no tiene una pauta operativa asignada para esa fecha. Este incentivo solo se permite cuando el trabajador está en descanso.',
        to_char(resolved_service_date, 'DD/MM/YYYY');
    elsif roster_day_row.base_status is distinct from 'resting' then
      raise exception
        'No puedes usar a este trabajador como reemplazo el % porque su pauta vigente no lo deja en descanso.',
        to_char(resolved_service_date, 'DD/MM/YYYY');
    end if;
  end if;

  select
    hir.id,
    hir.folio,
    hir.selected_contract_code,
    hir.selected_area_name,
    hir.incentive_type_name
  into conflicting_rest_day_request_row
  from public.hr_incentive_requests hir
  join public.hr_incentive_types hit
    on hit.id = hir.incentive_type_id
   and hit.requires_rest_day = true
  where hir.employee_buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
    and hir.service_date::date = resolved_service_date
    and hir.status in ('P', 'E', 'F')
  order by hir.created_at desc, hir.id desc
  limit 1;

  if rule_row.calculation_basis = 'per_hour' then
    if p_duration_hours is null or p_duration_hours <= 0 then
      raise exception 'Debe indicar una duración válida para calcular el incentivo';
    end if;

    calculated_amount := round((rule_row.rate_rule_amount * p_duration_hours)::numeric, 2);
  else
    calculated_amount := round(rule_row.rate_rule_amount::numeric, 2);
  end if;

  resolved_rest_day_conflict_contract_label := null;
  resolved_block_reason := null;

  if conflicting_rest_day_request_row.id is not null then
    resolved_rest_day_conflict_contract_label := coalesce(
      nullif(trim(coalesce(conflicting_rest_day_request_row.selected_area_name, '')), ''),
      nullif(trim(coalesce(conflicting_rest_day_request_row.selected_contract_code, '')), ''),
      'otro contrato'
    );

    resolved_block_reason := format(
      'No se puede registrar otro incentivo el %s porque el trabajador ya registra un incentivo con descanso para %s.',
      to_char(resolved_service_date, 'DD/MM/YYYY'),
      resolved_rest_day_conflict_contract_label
    );
  end if;

  return jsonb_build_object(
    'worker', p_worker_data - 'mapping_id',
    'rule', jsonb_build_object(
      'rate_rule_id', rule_row.rate_rule_id,
      'incentive_type_id', rule_row.incentive_type_id,
      'incentive_type_name', rule_row.incentive_type_name,
      'calculation_basis', rule_row.calculation_basis,
      'requires_replacement', rule_row.requires_replacement,
      'requires_rest_day', rule_row.requires_rest_day,
      'rate_rule_amount', rule_row.rate_rule_amount,
      'matched_contract_code', rule_row.matched_contract_code,
      'matched_job_title', rule_row.matched_job_title,
      'matched_union_name', rule_row.matched_union_name,
      'matched_union_status', rule_row.matched_union_status,
      'priority', rule_row.matched_priority
    ),
    'roster_validation', jsonb_build_object(
      'requires_rest_day', rule_row.requires_rest_day,
      'base_status', roster_day_row.base_status,
      'effective_status', roster_day_row.effective_status,
      'exception_type', roster_day_row.exception_type,
      'exception_label', roster_day_row.exception_label,
      'pattern_name', roster_day_row.pattern_name,
      'is_rest_day', roster_day_row.base_status = 'resting',
      'blocked_by_absence', roster_day_row.effective_status in ('vacation', 'medical_leave'),
      'blocked_by_existing_rest_day_incentive', conflicting_rest_day_request_row.id is not null,
      'existing_rest_day_request_id', conflicting_rest_day_request_row.id,
      'existing_rest_day_folio', conflicting_rest_day_request_row.folio,
      'existing_rest_day_contract_code', conflicting_rest_day_request_row.selected_contract_code,
      'existing_rest_day_contract_name', conflicting_rest_day_request_row.selected_area_name,
      'existing_rest_day_incentive_type_name', conflicting_rest_day_request_row.incentive_type_name,
      'block_reason',
        case
          when roster_day_row.effective_status in ('vacation', 'medical_leave') then format(
            'No se puede registrar este incentivo porque el trabajador figura con %s para la fecha %s. Este estado bloquea el registro.',
            coalesce(roster_day_row.exception_label, 'Vacaciones o licencia médica'),
            to_char(resolved_service_date, 'DD/MM/YYYY')
          )
          when conflicting_rest_day_request_row.id is not null then resolved_block_reason
          else null
        end,
      'schedule_status', roster_day_row.effective_status,
      'schedule_label', resolved_schedule_label,
      'matched_date', resolved_service_date
    ),
    'duration_hours', p_duration_hours,
    'service_date', resolved_service_date,
    'selected_contract_code', p_selected_contract_code,
    'calculated_amount', calculated_amount
  );
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
  roster_exception_id uuid;
  roster_exception_source text;
  resolved_calendar_marking text := 'not_applicable';
  resolved_actual_rest_day boolean := false;
  resolved_schedule_status text;
  resolved_schedule_label text;
  resolved_replacement_schedule_status text;
  resolved_replacement_schedule_label text;
  resolved_extra_shift_note text;
  upserted_extra_shift_created boolean := false;
  resolved_existing_rest_day_block_reason text;
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
  resolved_existing_rest_day_block_reason := nullif(
    trim(coalesce(preview_payload -> 'roster_validation' ->> 'block_reason', '')),
    ''
  );

  if coalesce(
    (preview_payload -> 'roster_validation' ->> 'blocked_by_existing_rest_day_incentive')::boolean,
    false
  ) then
    raise exception '%', coalesce(
      resolved_existing_rest_day_block_reason,
      format(
        'No se puede registrar otro incentivo el %s porque el trabajador ya registra un incentivo con descanso activo.',
        to_char(resolved_service_at::date, 'DD/MM/YYYY')
      )
    );
  end if;

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
    area_manager_user_id,
    area_manager_name,
    area_manager_email,
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
    approver_context_row.area_manager_user_id,
    approver_context_row.area_manager_name,
    approver_context_row.area_manager_email,
    'P',
    current_user_id
  )
  returning hir.id, hir.folio into new_request_id, new_folio;

  if resolved_actual_rest_day then
    resolved_extra_shift_note := format(
      'Marcado automáticamente por incentivo folio %s (%s).',
      new_folio,
      coalesce(rule_data ->> 'incentive_type_name', 'Sin tipo')
    );

    with upserted_exception as (
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
        worker_data ->> 'buk_employee_id',
        coalesce(worker_data ->> 'document_type', 'rut'),
        worker_data ->> 'document_number',
        worker_data ->> 'full_name',
        resolved_service_at::date,
        'extra_shift',
        'incentive_auto',
        resolved_extra_shift_note,
        current_user_id
      )
      on conflict (employee_buk_employee_id, exception_date) do update
      set
        employee_document_type = excluded.employee_document_type,
        employee_document_number = excluded.employee_document_number,
        employee_full_name = excluded.employee_full_name,
        notes = excluded.notes,
        is_active = true,
        updated_at = timezone('utc', now())
      where public.hr_roster_exceptions.exception_type = 'extra_shift'
        and coalesce(public.hr_roster_exceptions.exception_source, 'manual') <> 'buk'
      returning
        public.hr_roster_exceptions.id,
        public.hr_roster_exceptions.exception_source,
        (xmax = 0) as inserted
    )
    select
      ue.id,
      ue.exception_source,
      ue.inserted
    into
      roster_exception_id,
      roster_exception_source,
      upserted_extra_shift_created
    from upserted_exception ue;

    if roster_exception_id is not null then
      resolved_calendar_marking := case
        when upserted_extra_shift_created then 'extra_shift_created'
        else 'extra_shift_refreshed'
      end;
    else
      select
        hre.id,
        hre.exception_source
      into
        roster_exception_id,
        roster_exception_source
      from public.hr_roster_exceptions hre
      where hre.employee_buk_employee_id = worker_data ->> 'buk_employee_id'
        and hre.exception_date = resolved_service_at::date
      limit 1;

      resolved_calendar_marking := 'existing_exception_preserved';
    end if;
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
      'area_manager_user_id', approver_context_row.area_manager_user_id,
      'area_manager_name', approver_context_row.area_manager_name,
      'area_manager_email', approver_context_row.area_manager_email,
      'replacement_roster_validation', case
        when coalesce((rule_data ->> 'requires_replacement')::boolean, false) then jsonb_build_object(
          'schedule_status', resolved_replacement_schedule_status,
          'schedule_label', resolved_replacement_schedule_label
        )
        else null
      end,
      'calendar_marking', resolved_calendar_marking,
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

notify pgrst, 'reload schema';

commit;
