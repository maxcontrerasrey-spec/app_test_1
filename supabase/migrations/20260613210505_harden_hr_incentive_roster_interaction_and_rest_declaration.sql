alter table public.hr_incentive_requests
  add column if not exists declared_rest_day boolean;

alter table public.hr_roster_exceptions
  add column if not exists superseded_exception_type text,
  add column if not exists superseded_exception_source text,
  add column if not exists superseded_notes text,
  add column if not exists superseded_created_by uuid references public.profiles (id) on delete set null;

alter table public.hr_roster_exceptions
  drop constraint if exists hr_roster_exceptions_exception_source_check;

alter table public.hr_roster_exceptions
  add constraint hr_roster_exceptions_exception_source_check
  check (exception_source in ('manual', 'buk', 'incentive_auto'));

alter table public.hr_roster_exceptions
  drop constraint if exists hr_roster_exceptions_superseded_exception_source_check;

alter table public.hr_roster_exceptions
  add constraint hr_roster_exceptions_superseded_exception_source_check
  check (
    superseded_exception_source is null
    or superseded_exception_source in ('manual', 'buk', 'incentive_auto')
  );

create or replace function public.calculate_hr_incentive_preview(
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
  current_user_id uuid := auth.uid();
  worker_payload jsonb;
  worker_job_title text;
  worker_union_name text;
  worker_union_status text;
  resolved_service_date date := coalesce(p_service_date, current_date);
  rule_row record;
  calculated_amount numeric(12,2);
  roster_base_status text;
  roster_effective_status text;
  roster_exception_type text;
  roster_exception_label text;
  roster_pattern_name text;
  resolved_schedule_label text;
  resolved_absence_label text;
  resolved_is_rest_day boolean := false;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para calcular incentivos';
  end if;

  worker_payload := public.get_hr_incentive_worker_context(p_buk_employee_id);
  worker_job_title := worker_payload -> 'worker' ->> 'job_title';
  worker_union_name := worker_payload -> 'worker' ->> 'union_name';
  worker_union_status := worker_payload -> 'worker' ->> 'union_status';

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

  select
    rs.base_status,
    rs.effective_status,
    rs.exception_type,
    rs.exception_label,
    rs.pattern_name
  into
    roster_base_status,
    roster_effective_status,
    roster_exception_type,
    roster_exception_label,
    roster_pattern_name
  from public.resolve_hr_roster_day_status(p_buk_employee_id, resolved_service_date) rs;

  if not found then
    roster_base_status := 'unassigned';
    roster_effective_status := 'unassigned';
    roster_exception_type := null;
    roster_exception_label := null;
    roster_pattern_name := null;
  end if;

  resolved_is_rest_day := roster_base_status = 'resting'
    and coalesce(roster_effective_status, roster_base_status) = 'resting';

  resolved_schedule_label := coalesce(
    roster_exception_label,
    case coalesce(roster_effective_status, roster_base_status)
      when 'resting' then 'Descanso'
      when 'working' then 'En turno'
      when 'extra_shift' then 'Turno adicional'
      when 'training' then 'Capacitación'
      when 'absent' then 'Ausencia'
      when 'administrative_leave' then 'Permiso administrativo'
      when 'union_leave' then 'Permiso sindical'
      when 'vacation' then 'Vacaciones'
      when 'medical_leave' then 'Licencia médica'
      when 'unassigned' then 'Sin pauta'
      else null
    end
  );

  if roster_effective_status in ('vacation', 'medical_leave') then
    resolved_absence_label := coalesce(
      roster_exception_label,
      case roster_effective_status
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
    if resolved_is_rest_day is false then
      if coalesce(roster_effective_status, roster_base_status) = 'unassigned' then
        raise exception
          'No puedes usar a este trabajador como reemplazo el % porque no tiene una pauta operativa asignada para esa fecha. Este incentivo solo se permite cuando el trabajador está en descanso.',
          to_char(resolved_service_date, 'DD/MM/YYYY');
      end if;

      raise exception
        'No puedes usar a este trabajador como reemplazo el % porque su estado operativo en esa fecha es "%". Este incentivo solo se permite cuando el trabajador está en descanso.',
        to_char(resolved_service_date, 'DD/MM/YYYY'),
        coalesce(resolved_schedule_label, 'Sin pauta');
    end if;
  end if;

  if rule_row.calculation_basis = 'per_hour' then
    if p_duration_hours is null or p_duration_hours <= 0 then
      raise exception 'Debe indicar una duración válida para calcular el incentivo';
    end if;

    calculated_amount := round((rule_row.rate_rule_amount * p_duration_hours)::numeric, 2);
  else
    calculated_amount := round(rule_row.rate_rule_amount::numeric, 2);
  end if;

  return jsonb_build_object(
    'worker', worker_payload -> 'worker',
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
      'base_status', roster_base_status,
      'effective_status', roster_effective_status,
      'exception_type', roster_exception_type,
      'exception_label', roster_exception_label,
      'pattern_name', roster_pattern_name,
      'is_rest_day', resolved_is_rest_day,
      'blocked_by_absence', roster_effective_status in ('vacation', 'medical_leave'),
      'block_reason',
        case
          when roster_effective_status in ('vacation', 'medical_leave') then format(
            'No se puede registrar este incentivo porque el trabajador figura con %s para la fecha %s. Este estado bloquea el registro.',
            coalesce(roster_exception_label, 'Vacaciones o licencia médica'),
            to_char(resolved_service_date, 'DD/MM/YYYY')
          )
          else null
        end,
      'schedule_status', coalesce(roster_effective_status, roster_base_status),
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

drop function if exists public.create_hr_incentive_request(
  text,
  uuid,
  text,
  text,
  text,
  timestamptz,
  numeric,
  text,
  text,
  text
);

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
  worker_payload jsonb;
  replacement_payload jsonb;
  worker_data jsonb;
  preview_payload jsonb;
  rule_data jsonb;
  approver_context_row record;
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
  roster_exception_type text;
  roster_exception_source text;
  resolved_calendar_marking text := 'not_applicable';
  resolved_actual_rest_day boolean := false;
  resolved_schedule_status text;
  resolved_schedule_label text;
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

  worker_payload := public.get_hr_incentive_worker_context(p_buk_employee_id);
  worker_data := worker_payload -> 'worker';
  resolved_is_contract_mismatch := public.resolve_hr_incentive_contract_mismatch(
    worker_data ->> 'primary_contract_code',
    trim(p_selected_contract_code)
  );

  preview_payload := public.calculate_hr_incentive_preview(
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

    replacement_payload := public.get_hr_incentive_worker_context(
      p_replacement_buk_employee_id
    ) -> 'worker';
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
    nullif(trim(coalesce(replacement_payload ->> 'document_number', '')), ''),
    nullif(trim(coalesce(replacement_payload ->> 'full_name', '')), ''),
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
    select
      hre.id,
      hre.exception_type,
      hre.exception_source
    into
      roster_exception_id,
      roster_exception_type,
      roster_exception_source
    from public.hr_roster_exceptions hre
    where hre.employee_buk_employee_id = worker_data ->> 'buk_employee_id'
      and hre.exception_date = resolved_service_at::date
      and hre.is_active = true
    limit 1;

    if roster_exception_id is null then
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
        format(
          'Marcado automáticamente por incentivo folio %s (%s).',
          new_folio,
          coalesce(rule_data ->> 'incentive_type_name', 'Sin tipo')
        ),
        current_user_id
      );
      resolved_calendar_marking := 'extra_shift_created';
    elsif roster_exception_type = 'extra_shift' then
      update public.hr_roster_exceptions
      set
        notes = format(
          'Marcado automáticamente por incentivo folio %s (%s).',
          new_folio,
          coalesce(rule_data ->> 'incentive_type_name', 'Sin tipo')
        ),
        is_active = true,
        updated_at = timezone('utc', now())
      where id = roster_exception_id;
      resolved_calendar_marking := 'extra_shift_refreshed';
    else
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

    update public.hr_roster_exceptions
    set
      employee_buk_employee_id = worker_row.buk_employee_id,
      employee_document_type = worker_row.document_type,
      employee_document_number = worker_row.document_number,
      employee_full_name = worker_row.full_name,
      exception_date = p_exception_date,
      exception_type = normalized_exception_type,
      exception_source = 'manual',
      superseded_exception_type = null,
      superseded_exception_source = null,
      superseded_notes = null,
      superseded_created_by = null,
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
        superseded_exception_type = null,
        superseded_exception_source = null,
        superseded_notes = null,
        superseded_created_by = null,
        notes = excluded.notes,
        is_active = true,
        updated_at = timezone('utc', now())
      where public.hr_roster_exceptions.exception_source <> 'buk'
    returning id into result_id;

    if result_id is null then
      raise exception 'La excepción de esta fecha está gobernada por BUK y no puede reemplazarse manualmente';
    end if;
  end if;

  return result_id;
end;
$function$;

create or replace function public.sync_hr_roster_exception_from_buk(
  p_buk_employee_id text,
  p_exception_date date,
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
  existing_row public.hr_roster_exceptions%rowtype;
  normalized_exception_type text := lower(trim(coalesce(p_exception_type, '')));
  has_internal_context boolean := coalesce(current_setting('request.jwt.claims', true), '') = '';
  result_id uuid;
begin
  if not has_internal_context and not public.user_is_admin(current_user_id) then
    raise exception 'Sin permisos para sincronizar excepciones de BUK';
  end if;

  if p_exception_date is null then
    raise exception 'Debe indicar la fecha de la excepción BUK';
  end if;

  if normalized_exception_type <> ''
    and normalized_exception_type not in ('vacation', 'medical_leave') then
    raise exception 'BUK solo puede sincronizar vacaciones o licencia médica';
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
    raise exception 'Trabajador BUK no encontrado para sincronizar excepción';
  end if;

  select *
    into existing_row
  from public.hr_roster_exceptions hre
  where hre.employee_buk_employee_id = worker_row.buk_employee_id
    and hre.exception_date = p_exception_date
  limit 1;

  if normalized_exception_type = '' then
    if existing_row.id is null or existing_row.exception_source <> 'buk' then
      return null;
    end if;

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
      where id = existing_row.id
      returning id into result_id;

      return result_id;
    end if;

    update public.hr_roster_exceptions
    set
      is_active = false,
      superseded_exception_type = null,
      superseded_exception_source = null,
      superseded_notes = null,
      superseded_created_by = null,
      updated_at = timezone('utc', now())
    where id = existing_row.id
    returning id into result_id;

    return result_id;
  end if;

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
      worker_row.buk_employee_id,
      worker_row.document_type,
      worker_row.document_number,
      worker_row.full_name,
      p_exception_date,
      normalized_exception_type,
      'buk',
      nullif(trim(coalesce(p_notes, '')), ''),
      null
    )
    returning id into result_id;

    return result_id;
  end if;

  update public.hr_roster_exceptions
  set
    employee_document_type = worker_row.document_type,
    employee_document_number = worker_row.document_number,
    employee_full_name = worker_row.full_name,
    exception_type = normalized_exception_type,
    exception_source = 'buk',
    superseded_exception_type = case
      when existing_row.exception_source <> 'buk' then existing_row.exception_type
      else existing_row.superseded_exception_type
    end,
    superseded_exception_source = case
      when existing_row.exception_source <> 'buk' then existing_row.exception_source
      else existing_row.superseded_exception_source
    end,
    superseded_notes = case
      when existing_row.exception_source <> 'buk' then existing_row.notes
      else existing_row.superseded_notes
    end,
    superseded_created_by = case
      when existing_row.exception_source <> 'buk' then existing_row.created_by
      else existing_row.superseded_created_by
    end,
    notes = nullif(trim(coalesce(p_notes, '')), ''),
    is_active = true,
    updated_at = timezone('utc', now())
  where id = existing_row.id
  returning id into result_id;

  return result_id;
end;
$function$;

drop function if exists public.get_hr_incentive_requests(
  text,
  text,
  text,
  text,
  uuid,
  date
);

create or replace function public.get_hr_incentive_requests(
  p_period_code text default null,
  p_status text default 'A',
  p_contract_code text default null,
  p_worker_search text default null,
  p_type_id uuid default null,
  p_service_date_until date default null
)
returns table (
  id uuid,
  folio bigint,
  employee_buk_employee_id text,
  employee_document_type text,
  employee_document_number text,
  employee_full_name text,
  employee_job_title text,
  employee_union_name text,
  employee_union_status text,
  employee_union_joined_at date,
  primary_contract_code text,
  primary_area_name text,
  selected_contract_code text,
  selected_area_name text,
  selected_area_code text,
  incentive_type_id uuid,
  incentive_type_name text,
  requires_replacement boolean,
  replacement_buk_employee_id text,
  replacement_document_number text,
  replacement_full_name text,
  motive text,
  description text,
  service_date timestamptz,
  duration_hours numeric,
  period_code text,
  calculation_basis text,
  rate_rule_id uuid,
  rate_rule_amount numeric,
  calculated_amount numeric,
  created_by uuid,
  requester_name text,
  requester_email text,
  status text,
  current_flow_user text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_comment text,
  created_at timestamptz,
  updated_at timestamptz,
  entry_lag_days integer,
  is_out_of_deadline boolean,
  is_contract_mismatch boolean,
  declared_rest_day boolean
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_worker_search, '')));
  normalized_status text := upper(trim(coalesce(p_status, 'A')));
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para ver incentivos';
  end if;

  return query
  select
    hir.id,
    hir.folio,
    hir.employee_buk_employee_id,
    hir.employee_document_type,
    hir.employee_document_number,
    hir.employee_full_name,
    hir.employee_job_title,
    hir.employee_union_name,
    hir.employee_union_status,
    hir.employee_union_joined_at,
    hir.primary_contract_code,
    hir.primary_area_name,
    hir.selected_contract_code,
    hir.selected_area_name,
    hir.selected_area_code,
    hir.incentive_type_id,
    hir.incentive_type_name,
    hir.requires_replacement,
    hir.replacement_buk_employee_id,
    hir.replacement_document_number,
    hir.replacement_full_name,
    hir.motive,
    hir.description,
    hir.service_date,
    hir.duration_hours,
    hir.period_code,
    hir.calculation_basis,
    hir.rate_rule_id,
    hir.rate_rule_amount,
    hir.calculated_amount,
    hir.created_by,
    coalesce(requester_profile.full_name, requester_profile.email, 'Usuario no disponible') as requester_name,
    requester_profile.email as requester_email,
    hir.status,
    pending_approval.approver_name as current_flow_user,
    hir.cancelled_at,
    hir.cancelled_by,
    hir.cancellation_comment,
    hir.created_at,
    hir.updated_at,
    hir.entry_lag_days,
    hir.is_out_of_deadline,
    hir.is_contract_mismatch,
    hir.declared_rest_day
  from public.hr_incentive_requests hir
  left join public.profiles requester_profile
    on requester_profile.id = hir.created_by
  left join lateral (
    select
      hira.approver_name
    from public.hr_incentive_request_approvals hira
    where hira.incentive_request_id = hir.id
      and hira.status = 'pending'
    order by hira.step_order asc, hira.created_at asc
    limit 1
  ) pending_approval on true
  where
    (p_period_code is null or trim(p_period_code) = '' or hir.period_code = trim(p_period_code))
    and (normalized_status = 'A' or hir.status = normalized_status)
    and (p_contract_code is null or trim(p_contract_code) = '' or hir.selected_contract_code = trim(p_contract_code))
    and (p_type_id is null or hir.incentive_type_id = p_type_id)
    and (p_service_date_until is null or hir.service_date::date <= p_service_date_until)
    and (
      normalized_search = ''
      or lower(
        concat_ws(
          ' ',
          hir.employee_full_name,
          coalesce(hir.employee_document_number, ''),
          coalesce(hir.employee_job_title, ''),
          coalesce(hir.replacement_full_name, ''),
          coalesce(hir.selected_area_name, ''),
          coalesce(hir.selected_contract_code, ''),
          coalesce(hir.incentive_type_name, ''),
          coalesce(pending_approval.approver_name, '')
        )
      ) like '%' || normalized_search || '%'
    )
  order by hir.created_at desc, hir.folio desc;
end;
$function$;

create or replace function public.get_hr_incentive_request_detail(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  can_view_request boolean := false;
  request_payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  can_view_request :=
    public.user_can_manage_hr_incentives(current_user_id)
    or exists (
      select 1
      from public.hr_incentive_request_approvals hira
      where hira.incentive_request_id = p_request_id
        and hira.approver_user_id = current_user_id
    );

  if not can_view_request then
    raise exception 'Sin permisos para ver el detalle del incentivo';
  end if;

  select jsonb_build_object(
    'request',
    jsonb_build_object(
      'id', hir.id,
      'folio', hir.folio,
      'status', hir.status,
      'employee_buk_employee_id', hir.employee_buk_employee_id,
      'employee_document_type', hir.employee_document_type,
      'employee_document_number', hir.employee_document_number,
      'employee_full_name', hir.employee_full_name,
      'employee_job_title', hir.employee_job_title,
      'employee_union_name', hir.employee_union_name,
      'employee_union_status', hir.employee_union_status,
      'employee_union_joined_at', hir.employee_union_joined_at,
      'primary_contract_code', hir.primary_contract_code,
      'primary_area_name', hir.primary_area_name,
      'selected_contract_code', hir.selected_contract_code,
      'selected_area_name', hir.selected_area_name,
      'selected_area_code', hir.selected_area_code,
      'incentive_type_name', hir.incentive_type_name,
      'requires_replacement', hir.requires_replacement,
      'replacement_buk_employee_id', hir.replacement_buk_employee_id,
      'replacement_document_number', hir.replacement_document_number,
      'replacement_full_name', hir.replacement_full_name,
      'motive', hir.motive,
      'description', hir.description,
      'service_date', hir.service_date,
      'duration_hours', hir.duration_hours,
      'period_code', hir.period_code,
      'entry_lag_days', hir.entry_lag_days,
      'is_out_of_deadline', hir.is_out_of_deadline,
      'is_contract_mismatch', hir.is_contract_mismatch,
      'declared_rest_day', hir.declared_rest_day,
      'calculation_basis', hir.calculation_basis,
      'rate_rule_amount', hir.rate_rule_amount,
      'calculated_amount', hir.calculated_amount,
      'requester_name', coalesce(requester_profile.full_name, requester_profile.email, 'Usuario no disponible'),
      'requester_email', requester_profile.email,
      'current_step_code', pending_approval.step_code,
      'current_step_name', pending_approval.step_name,
      'current_approver_name', pending_approval.approver_name,
      'cancelled_at', hir.cancelled_at,
      'cancellation_comment', hir.cancellation_comment,
      'created_at', hir.created_at,
      'updated_at', hir.updated_at
    ),
    'approvals',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', hira.id,
          'step_code', hira.step_code,
          'step_name', hira.step_name,
          'step_order', hira.step_order,
          'approver_user_id', hira.approver_user_id,
          'approver_name', hira.approver_name,
          'approver_email', hira.approver_email,
          'status', hira.status,
          'decision_by', hira.decision_by,
          'decision_comment', hira.decision_comment,
          'decided_at', hira.decided_at,
          'created_at', hira.created_at
        )
        order by hira.step_order asc, hira.created_at asc
      )
      from public.hr_incentive_request_approvals hira
      where hira.incentive_request_id = hir.id
    ), '[]'::jsonb),
    'history',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', hih.id,
          'action_type', hih.action_type,
          'actor_user_id', hih.actor_user_id,
          'actor_name', coalesce(actor_profile.full_name, actor_profile.email, 'Usuario no disponible'),
          'comment', hih.comment,
          'metadata', hih.metadata,
          'created_at', hih.created_at
        )
        order by hih.created_at desc, hih.id desc
      )
      from public.hr_incentive_request_history hih
      left join public.profiles actor_profile
        on actor_profile.id = hih.actor_user_id
      where hih.incentive_request_id = hir.id
    ), '[]'::jsonb)
  )
  into request_payload
  from public.hr_incentive_requests hir
  left join public.profiles requester_profile
    on requester_profile.id = hir.created_by
  left join lateral (
    select
      hira.step_code,
      hira.step_name,
      hira.approver_name
    from public.hr_incentive_request_approvals hira
    where hira.incentive_request_id = hir.id
      and hira.status = 'pending'
    order by hira.step_order asc, hira.created_at asc
    limit 1
  ) pending_approval on true
  where hir.id = p_request_id;

  if request_payload is null then
    raise exception 'No existe el incentivo solicitado';
  end if;

  return request_payload;
end;
$function$;

revoke all on function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.get_hr_incentive_requests(text, text, text, text, uuid, date) from public, anon, authenticated;
revoke all on function public.sync_hr_roster_exception_from_buk(text, date, text, text) from public, anon, authenticated;

grant execute on function public.calculate_hr_incentive_preview(text, uuid, text, numeric, date) to authenticated;
grant execute on function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean) to authenticated;
grant execute on function public.get_hr_incentive_requests(text, text, text, text, uuid, date) to authenticated;
grant execute on function public.sync_hr_roster_exception_from_buk(text, date, text, text) to service_role;

notify pgrst, 'reload schema';
