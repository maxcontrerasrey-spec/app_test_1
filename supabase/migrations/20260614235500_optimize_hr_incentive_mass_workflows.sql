begin;

create index if not exists idx_profiles_active_full_name_normalized
  on public.profiles (lower(trim(coalesce(full_name, ''))), updated_at desc, created_at desc)
  where status = 'active';

create index if not exists idx_buk_contract_mappings_approver_resolution
  on public.buk_contract_mappings (contract_id, is_operational, is_one_to_one desc, updated_at desc, id desc)
  where nullif(trim(coalesce(contract_admin_name, '')), '') is not null;

create index if not exists idx_hr_incentive_rate_rules_resolution
  on public.hr_incentive_rate_rules (
    incentive_type_id,
    is_active,
    contract_code,
    job_title,
    union_name,
    union_status,
    valid_from,
    valid_to,
    priority,
    updated_at desc
  );

create index if not exists idx_hr_incentive_request_approvals_pending_global
  on public.hr_incentive_request_approvals (status, step_order, created_at desc)
  where status = 'pending';

create or replace function public.get_hr_incentive_worker_core(
  p_buk_employee_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_row record;
  resolved_union_status text;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para consultar el trabajador';
  end if;

  select
    e.id,
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
    coalesce(
      nullif(trim(e.job_title), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
      nullif(trim(e.raw_payload ->> 'job_title'), '')
    ) as job_title,
    public.get_hr_incentive_union_name(e.raw_payload) as union_name,
    public.get_hr_incentive_union_status(e.raw_payload) as union_status,
    nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Fecha incorporación al sindicato'), '') as union_joined_at,
    c.code as contract_code,
    bcm.buk_area_name as area_name,
    nullif(trim(e.area_code), '') as area_code,
    bcm.id as mapping_id
  into worker_row
  from public.employees_active_current e
  join public.buk_contract_mappings bcm
    on bcm.buk_area_name_normalized = public.normalize_buk_area_name(e.area_name)
   and bcm.is_operational = true
   and bcm.is_one_to_one = true
   and bcm.contract_id is not null
  join public.contracts c
    on c.id = bcm.contract_id
   and c.is_active = true
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_row.id is null then
    raise exception 'Trabajador BUK no encontrado o sin area operativa vinculada';
  end if;

  resolved_union_status := coalesce(worker_row.union_status, 'unknown');

  return jsonb_build_object(
    'buk_employee_id', worker_row.buk_employee_id,
    'full_name', worker_row.full_name,
    'document_number', worker_row.document_number,
    'document_type', worker_row.document_type,
    'job_title', worker_row.job_title,
    'union_name', worker_row.union_name,
    'union_status', resolved_union_status,
    'union_status_label', public.get_hr_incentive_union_status_label(resolved_union_status),
    'union_joined_at', worker_row.union_joined_at,
    'primary_contract_code', worker_row.contract_code,
    'primary_area_name', worker_row.area_name,
    'primary_area_code', worker_row.area_code,
    'mapping_id', worker_row.mapping_id
  );
end;
$function$;

create or replace function public.get_hr_incentive_worker_context(
  p_buk_employee_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_data jsonb;
  worker_mapping_id uuid;
  worker_document_type text;
  worker_identity_value text;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para consultar el trabajador';
  end if;

  worker_data := public.get_hr_incentive_worker_core(p_buk_employee_id);
  worker_mapping_id := nullif(worker_data ->> 'mapping_id', '')::uuid;
  worker_document_type := coalesce(nullif(trim(coalesce(worker_data ->> 'document_type', '')), ''), 'rut');
  worker_identity_value := coalesce(
    nullif(regexp_replace(coalesce(worker_data ->> 'document_number', ''), '\D', '', 'g'), ''),
    worker_data ->> 'buk_employee_id'
  );

  return jsonb_build_object(
    'worker',
    worker_data - 'mapping_id',
    'available_areas',
    coalesce((
      with ranked_worker_options as (
        select
          bcm.id as mapping_id,
          c.code as contract_code,
          bcm.buk_area_name as area_name,
          nullif(trim(e.area_code), '') as area_code,
          greatest(
            coalesce(e.updated_at, '-infinity'::timestamptz),
            coalesce(e.created_at, '-infinity'::timestamptz)
          ) as activity_at,
          case when bcm.id = worker_mapping_id then 0 else 1 end as option_rank,
          row_number() over (
            partition by bcm.id
            order by
              case when e.is_active then 0 else 1 end,
              e.updated_at desc nulls last,
              e.created_at desc nulls last
          ) as row_rank
        from public.employees e
        join public.buk_contract_mappings bcm
          on bcm.buk_area_name_normalized = public.normalize_buk_area_name(e.area_name)
         and bcm.is_operational = true
         and bcm.is_one_to_one = true
         and bcm.contract_id is not null
        join public.contracts c
          on c.id = bcm.contract_id
         and c.is_active = true
        where coalesce(nullif(trim(e.document_type), ''), 'rut') = worker_document_type
          and coalesce(
            nullif(regexp_replace(coalesce(e.document_number, ''), '\D', '', 'g'), ''),
            e.buk_employee_id
          ) = worker_identity_value
      ),
      worker_options as (
        select
          rwo.contract_code,
          rwo.area_name,
          rwo.area_code,
          concat_ws(' · ', coalesce(rwo.contract_code, 'Sin código'), rwo.area_name) as label,
          rwo.option_rank = 0 as is_primary,
          rwo.option_rank,
          rwo.activity_at
        from ranked_worker_options rwo
        where rwo.row_rank = 1
      ),
      active_contract_options as (
        select
          c.code as contract_code,
          c.contract_name as area_name,
          null::text as area_code,
          concat_ws(' · ', c.code, c.contract_name) as label,
          false as is_primary,
          2 as option_rank,
          null::timestamptz as activity_at
        from public.contracts c
        where c.is_active = true
          and not exists (
            select 1
            from worker_options wo
            where wo.contract_code = c.code
          )
      ),
      combined_options as (
        select * from worker_options
        union all
        select * from active_contract_options
      )
      select jsonb_agg(
        jsonb_build_object(
          'contract_code', co.contract_code,
          'area_name', co.area_name,
          'area_code', co.area_code,
          'label', co.label,
          'is_primary', co.is_primary
        )
        order by co.option_rank asc, co.activity_at desc nulls last, co.contract_code nulls last, co.area_name nulls last
      )
      from combined_options co
    ), '[]'::jsonb)
  );
end;
$function$;

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
  calculated_amount numeric(12,2);
  resolved_schedule_label text;
  resolved_absence_label text;
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

  if rule_row.calculation_basis = 'per_hour' then
    if p_duration_hours is null or p_duration_hours <= 0 then
      raise exception 'Debe indicar una duración válida para calcular el incentivo';
    end if;

    calculated_amount := round((rule_row.rate_rule_amount * p_duration_hours)::numeric, 2);
  else
    calculated_amount := round(rule_row.rate_rule_amount::numeric, 2);
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
      'block_reason',
        case
          when roster_day_row.effective_status in ('vacation', 'medical_leave') then format(
            'No se puede registrar este incentivo porque el trabajador figura con %s para la fecha %s. Este estado bloquea el registro.',
            coalesce(roster_day_row.exception_label, 'Vacaciones o licencia médica'),
            to_char(resolved_service_date, 'DD/MM/YYYY')
          )
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
  worker_data jsonb;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para calcular incentivos';
  end if;

  worker_data := public.get_hr_incentive_worker_core(p_buk_employee_id);

  return public.build_hr_incentive_preview_from_worker_data(
    worker_data,
    p_buk_employee_id,
    p_incentive_type_id,
    p_selected_contract_code,
    p_duration_hours,
    p_service_date
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
  roster_exception_type text;
  roster_exception_source text;
  resolved_calendar_marking text := 'not_applicable';
  resolved_actual_rest_day boolean := false;
  resolved_schedule_status text;
  resolved_schedule_label text;
  resolved_replacement_schedule_status text;
  resolved_replacement_schedule_label text;
  resolved_extra_shift_note text;
  upserted_extra_shift_created boolean := false;
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
        public.hr_roster_exceptions.exception_type,
        public.hr_roster_exceptions.exception_source,
        (xmax = 0) as inserted
    )
    select
      ue.id,
      ue.exception_type,
      ue.exception_source,
      ue.inserted
    into
      roster_exception_id,
      roster_exception_type,
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
        hre.exception_type,
        hre.exception_source
      into
        roster_exception_id,
        roster_exception_type,
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

create or replace function public.bulk_decide_hr_incentive_request_approvals(
  p_approval_ids bigint[],
  p_decision text,
  p_comment text default null
)
returns table (
  approval_id bigint,
  request_id uuid,
  success boolean,
  request_status text,
  error text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  normalized_approval_ids bigint[];
  current_approval_id bigint;
  decision_row record;
  locked_approval_row record;
  locked_request_ids uuid[] := '{}'::uuid[];
  locked_approval_count integer := 0;
  expected_approval_count integer := 0;
begin
  normalized_approval_ids := array(
    select distinct approval_id
    from unnest(coalesce(p_approval_ids, '{}'::bigint[])) as approval_id
    where approval_id is not null
    order by approval_id
  );

  expected_approval_count := coalesce(array_length(normalized_approval_ids, 1), 0);

  if expected_approval_count = 0 then
    raise exception 'Debe seleccionar al menos una aprobacion';
  end if;

  for locked_approval_row in
    select hira.id, hira.incentive_request_id
    from public.hr_incentive_request_approvals hira
    where hira.id = any(normalized_approval_ids)
    order by hira.id
    for update
  loop
    locked_approval_count := locked_approval_count + 1;

    if locked_approval_row.incentive_request_id is not null
       and not (locked_approval_row.incentive_request_id = any(locked_request_ids)) then
      locked_request_ids := array_append(locked_request_ids, locked_approval_row.incentive_request_id);
    end if;
  end loop;

  if locked_approval_count <> expected_approval_count then
    raise exception 'Una o más aprobaciones seleccionadas ya no existen o no están disponibles para procesamiento masivo';
  end if;

  perform 1
  from public.hr_incentive_requests hir
  where hir.id = any(locked_request_ids)
  order by hir.id
  for update;

  foreach current_approval_id in array normalized_approval_ids
  loop
    select *
    into decision_row
    from public.decide_hr_incentive_request_approval(
      current_approval_id,
      p_decision,
      p_comment
    );

    approval_id := current_approval_id;
    request_id := decision_row.request_id;
    success := true;
    request_status := decision_row.request_status;
    error := null;
    return next;
  end loop;
end;
$function$;

revoke all on function public.get_hr_incentive_worker_core(text) from public, anon, authenticated;
revoke all on function public.build_hr_incentive_preview_from_worker_data(jsonb, text, uuid, text, numeric, date) from public, anon, authenticated;

grant execute on function public.get_hr_incentive_worker_context(text) to authenticated;
grant execute on function public.calculate_hr_incentive_preview(text, uuid, text, numeric, date) to authenticated;
grant execute on function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean) to authenticated;
grant execute on function public.bulk_decide_hr_incentive_request_approvals(bigint[], text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
