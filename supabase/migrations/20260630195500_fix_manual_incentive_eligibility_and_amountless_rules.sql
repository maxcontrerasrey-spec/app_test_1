begin;

create or replace function public.add_hr_incentive_rate_rule(
  p_incentive_type_id uuid,
  p_amount numeric,
  p_contract_code text default null,
  p_job_title text default null,
  p_union_name text default null,
  p_union_status text default null,
  p_priority integer default 100,
  p_valid_from date default null,
  p_valid_to date default null,
  p_fallback_base_salary numeric default null,
  p_fallback_weekly_hours numeric default null,
  p_overtime_multiplier numeric default 1.5
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_union_name text := nullif(trim(coalesce(p_union_name, '')), '');
  normalized_union_status text := nullif(trim(coalesce(p_union_status, '')), '');
  resolved_hour_rate_strategy text := 'rule_amount';
  resolved_allows_manual_amount boolean := false;
  resolved_amount numeric(12,2) := null;
  result_id uuid;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para administrar incentivos';
  end if;

  if normalized_union_status is not null
     and normalized_union_status not in ('unionized', 'non_unionized', 'unknown') then
    raise exception 'El estado sindical no es válido';
  end if;

  if p_valid_from is not null and p_valid_to is not null and p_valid_to < p_valid_from then
    raise exception 'El rango de vigencia de la regla no es válido';
  end if;

  if p_fallback_base_salary is not null and p_fallback_base_salary < 0 then
    raise exception 'El sueldo base fallback no puede ser negativo';
  end if;

  if p_fallback_weekly_hours is not null and p_fallback_weekly_hours <= 0 then
    raise exception 'La jornada semanal fallback debe ser mayor a cero';
  end if;

  if coalesce(p_overtime_multiplier, 0) <= 0 then
    raise exception 'El multiplicador de hora extra debe ser mayor a cero';
  end if;

  select
    hour_rate_strategy,
    allows_manual_amount
  into
    resolved_hour_rate_strategy,
    resolved_allows_manual_amount
  from public.hr_incentive_types
  where id = p_incentive_type_id;

  if resolved_hour_rate_strategy is null then
    raise exception 'Tipo de incentivo no encontrado para la regla';
  end if;

  if p_amount is null then
    if resolved_allows_manual_amount or resolved_hour_rate_strategy = 'buk_overtime' then
      resolved_amount := 0;
    else
      raise exception 'Debe indicar un monto válido para la regla';
    end if;
  elsif p_amount < 0 then
    raise exception 'Debe indicar un monto válido para la regla';
  else
    resolved_amount := round(p_amount::numeric, 2);
  end if;

  insert into public.hr_incentive_rate_rules (
    incentive_type_id,
    amount,
    contract_code,
    job_title,
    union_name,
    union_status,
    fallback_base_salary,
    fallback_weekly_hours,
    overtime_multiplier,
    priority,
    valid_from,
    valid_to
  )
  values (
    p_incentive_type_id,
    resolved_amount,
    nullif(trim(coalesce(p_contract_code, '')), ''),
    nullif(trim(coalesce(p_job_title, '')), ''),
    normalized_union_name,
    normalized_union_status,
    case
      when resolved_hour_rate_strategy = 'buk_overtime'
        then round(p_fallback_base_salary::numeric, 2)
      else null
    end,
    case
      when resolved_hour_rate_strategy = 'buk_overtime'
        then round(p_fallback_weekly_hours::numeric, 2)
      else null
    end,
    case
      when resolved_hour_rate_strategy = 'buk_overtime'
        then round(coalesce(p_overtime_multiplier, 1.5)::numeric, 3)
      else 1.5
    end,
    coalesce(p_priority, 100),
    p_valid_from,
    p_valid_to
  )
  returning id into result_id;

  return result_id;
end;
$function$;

drop function if exists public.get_hr_incentive_eligible_types(text, text, date);

create or replace function public.get_hr_incentive_eligible_types(
  p_buk_employee_id text,
  p_selected_contract_code text,
  p_service_date date default null
)
returns table (
  id uuid,
  code text,
  name text,
  calculation_basis text,
  hour_rate_strategy text,
  requires_replacement boolean,
  requires_rest_day boolean,
  allows_manual_amount boolean,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_data jsonb;
  worker_job_title text;
  worker_union_name text;
  worker_union_status text;
  worker_base_salary numeric;
  worker_weekly_hours numeric;
  resolved_service_date date := coalesce(p_service_date, current_date);
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para consultar incentivos elegibles';
  end if;

  if nullif(trim(coalesce(p_buk_employee_id, '')), '') is null then
    return;
  end if;

  if nullif(trim(coalesce(p_selected_contract_code, '')), '') is null then
    return;
  end if;

  worker_data := public.get_hr_incentive_worker_core(p_buk_employee_id);
  worker_job_title := worker_data ->> 'job_title';
  worker_union_name := worker_data ->> 'union_name';
  worker_union_status := worker_data ->> 'union_status';
  worker_base_salary := nullif(worker_data ->> 'base_salary', '')::numeric;
  worker_weekly_hours := nullif(worker_data ->> 'weekly_hours', '')::numeric;

  return query
  with rule_backed_types as (
    select
      it.id,
      it.code,
      it.name,
      matched_rule.calculation_basis,
      matched_rule.hour_rate_strategy,
      matched_rule.requires_replacement,
      matched_rule.requires_rest_day,
      matched_rule.allows_manual_amount,
      it.is_active,
      it.created_at,
      rate_resolution.rate_resolution
    from public.hr_incentive_types it
    join lateral public.resolve_hr_incentive_rate_rule(
      it.id,
      worker_job_title,
      trim(p_selected_contract_code),
      worker_union_name,
      worker_union_status,
      resolved_service_date
    ) matched_rule on true
    cross join lateral (
      select public.resolve_hr_incentive_hour_rate(
        matched_rule.hour_rate_strategy,
        matched_rule.rate_rule_amount,
        worker_base_salary,
        worker_weekly_hours,
        matched_rule.fallback_base_salary,
        matched_rule.fallback_weekly_hours,
        matched_rule.overtime_multiplier
      ) as rate_resolution
    ) rate_resolution
    where it.is_active = true
      and (
        matched_rule.calculation_basis <> 'per_hour'
        or coalesce((rate_resolution.rate_resolution ->> 'can_resolve')::boolean, false)
        or matched_rule.allows_manual_amount = true
      )
  ),
  manual_types as (
    select
      it.id,
      it.code,
      it.name,
      it.calculation_basis,
      it.hour_rate_strategy,
      it.requires_replacement,
      it.requires_rest_day,
      it.allows_manual_amount,
      it.is_active,
      it.created_at,
      1 as source_priority
    from public.hr_incentive_types it
    where it.is_active = true
      and it.allows_manual_amount = true
  ),
  combined as (
    select
      rbt.id,
      rbt.code,
      rbt.name,
      rbt.calculation_basis,
      rbt.hour_rate_strategy,
      rbt.requires_replacement,
      rbt.requires_rest_day,
      rbt.allows_manual_amount,
      rbt.is_active,
      rbt.created_at,
      0 as source_priority
    from rule_backed_types rbt

    union all

    select
      mt.id,
      mt.code,
      mt.name,
      mt.calculation_basis,
      mt.hour_rate_strategy,
      mt.requires_replacement,
      mt.requires_rest_day,
      mt.allows_manual_amount,
      mt.is_active,
      mt.created_at,
      mt.source_priority
    from manual_types mt
  ),
  deduplicated as (
    select distinct on (c.id)
      c.id,
      c.code,
      c.name,
      c.calculation_basis,
      c.hour_rate_strategy,
      c.requires_replacement,
      c.requires_rest_day,
      c.allows_manual_amount,
      c.is_active,
      c.created_at
    from combined c
    order by c.id, c.source_priority asc
  )
  select
    d.id,
    d.code,
    d.name,
    d.calculation_basis,
    d.hour_rate_strategy,
    d.requires_replacement,
    d.requires_rest_day,
    d.allows_manual_amount,
    d.is_active,
    d.created_at
  from deduplicated d
  order by d.name asc, d.code asc;
end;
$function$;

create or replace function public.build_hr_incentive_preview_from_worker_data(
  p_worker_data jsonb,
  p_buk_employee_id text,
  p_incentive_type_id uuid,
  p_selected_contract_code text,
  p_duration_hours numeric default null,
  p_service_date date default null,
  p_manual_amount numeric default null
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
  worker_base_salary numeric;
  worker_weekly_hours numeric;
  type_row record;
  rule_row record;
  roster_day_row record;
  conflicting_rest_day_request_row record;
  rate_resolution jsonb;
  calculated_amount numeric(12,2);
  resolved_schedule_label text;
  resolved_absence_label text;
  resolved_rest_day_conflict_contract_label text;
  resolved_block_reason text;
  resolved_amount_source text := 'rule';
  resolved_manual_amount numeric(12,2) := null;
  resolved_requires_replacement boolean := false;
  resolved_requires_rest_day boolean := false;
  resolved_calculation_basis text := 'fixed';
  resolved_incentive_type_name text := '';
  resolved_hour_rate_strategy text := 'rule_amount';
  resolved_allows_manual_amount boolean := false;
  resolved_rate_rule_id uuid := null;
  resolved_rate_rule_amount numeric(12,2) := 0;
  resolved_rate_source text := 'rule_amount';
  resolved_rate_base_salary numeric(12,2) := null;
  resolved_rate_weekly_hours numeric(8,2) := null;
  resolved_rate_overtime_multiplier numeric(6,3) := null;
  resolved_matched_contract_code text := null;
  resolved_matched_job_title text := null;
  resolved_matched_union_name text := null;
  resolved_matched_union_status text := null;
  resolved_matched_priority integer := 0;
begin
  if coalesce(jsonb_typeof(p_worker_data), 'null') <> 'object'
     or nullif(trim(coalesce(p_worker_data ->> 'buk_employee_id', '')), '') is null then
    raise exception 'No fue posible resolver el contexto base del trabajador para calcular el incentivo';
  end if;

  worker_job_title := p_worker_data ->> 'job_title';
  worker_union_name := p_worker_data ->> 'union_name';
  worker_union_status := p_worker_data ->> 'union_status';
  worker_base_salary := nullif(p_worker_data ->> 'base_salary', '')::numeric;
  worker_weekly_hours := nullif(p_worker_data ->> 'weekly_hours', '')::numeric;

  select
    it.id,
    it.name,
    it.calculation_basis,
    it.hour_rate_strategy,
    it.requires_replacement,
    it.requires_rest_day,
    it.allows_manual_amount
  into type_row
  from public.hr_incentive_types it
  where it.id = p_incentive_type_id
    and it.is_active = true;

  if not found then
    raise exception 'No existe un tipo de incentivo activo para la solicitud seleccionada';
  end if;

  resolved_requires_replacement := coalesce(type_row.requires_replacement, false);
  resolved_requires_rest_day := coalesce(type_row.requires_rest_day, false);
  resolved_calculation_basis := coalesce(type_row.calculation_basis, 'fixed');
  resolved_hour_rate_strategy := coalesce(type_row.hour_rate_strategy, 'rule_amount');
  resolved_incentive_type_name := coalesce(type_row.name, '');
  resolved_allows_manual_amount := coalesce(type_row.allows_manual_amount, false);

  if p_manual_amount is not null and p_manual_amount < 0 then
    raise exception 'El monto manual no puede ser negativo';
  end if;

  if p_manual_amount is not null and not resolved_allows_manual_amount then
    raise exception 'El tipo de incentivo seleccionado no permite ingresar monto manual';
  end if;

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

  if rule_row.incentive_type_id is not null then
    resolved_rate_rule_id := rule_row.rate_rule_id;
    resolved_rate_rule_amount := coalesce(rule_row.rate_rule_amount, 0);
    resolved_matched_contract_code := rule_row.matched_contract_code;
    resolved_matched_job_title := rule_row.matched_job_title;
    resolved_matched_union_name := rule_row.matched_union_name;
    resolved_matched_union_status := rule_row.matched_union_status;
    resolved_matched_priority := coalesce(rule_row.matched_priority, 0);
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

  if resolved_requires_rest_day then
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

  if p_manual_amount is not null then
    resolved_amount_source := 'manual';
    resolved_manual_amount := round(p_manual_amount::numeric, 2);
    calculated_amount := resolved_manual_amount;
  else
    if resolved_rate_rule_id is null then
      if resolved_allows_manual_amount then
        raise exception
          'Debes ingresar un monto manual o configurar una regla de monto activa para la combinación seleccionada';
      end if;

      raise exception 'No existe una regla de monto activa para la combinación seleccionada';
    end if;

    if resolved_allows_manual_amount
       and resolved_hour_rate_strategy = 'rule_amount'
       and resolved_rate_rule_amount <= 0 then
      raise exception
        'Debes ingresar un monto manual o configurar una regla de monto activa para la combinación seleccionada';
    end if;

    rate_resolution := public.resolve_hr_incentive_hour_rate(
      resolved_hour_rate_strategy,
      resolved_rate_rule_amount,
      worker_base_salary,
      worker_weekly_hours,
      rule_row.fallback_base_salary,
      rule_row.fallback_weekly_hours,
      rule_row.overtime_multiplier
    );

    if not coalesce((rate_resolution ->> 'can_resolve')::boolean, false) then
      raise exception '%', coalesce(
        nullif(trim(coalesce(rate_resolution ->> 'reason', '')), ''),
        'No fue posible calcular el valor hora del incentivo.'
      );
    end if;

    resolved_rate_rule_amount := coalesce(
      nullif(rate_resolution ->> 'rate_rule_amount', '')::numeric,
      resolved_rate_rule_amount
    );
    resolved_rate_source := coalesce(rate_resolution ->> 'rate_source', 'rule_amount');
    resolved_rate_base_salary := nullif(rate_resolution ->> 'base_salary', '')::numeric;
    resolved_rate_weekly_hours := nullif(rate_resolution ->> 'weekly_hours', '')::numeric;
    resolved_rate_overtime_multiplier := nullif(rate_resolution ->> 'overtime_multiplier', '')::numeric;

    if resolved_calculation_basis = 'per_hour' then
      if p_duration_hours is null or p_duration_hours <= 0 then
        raise exception 'Debe indicar una duración válida para calcular el incentivo';
      end if;

      calculated_amount := round((resolved_rate_rule_amount * p_duration_hours)::numeric, 2);
    else
      calculated_amount := round(resolved_rate_rule_amount::numeric, 2);
    end if;
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
      'rate_rule_id', resolved_rate_rule_id,
      'incentive_type_id', p_incentive_type_id,
      'incentive_type_name', resolved_incentive_type_name,
      'calculation_basis', resolved_calculation_basis,
      'hour_rate_strategy', resolved_hour_rate_strategy,
      'requires_replacement', resolved_requires_replacement,
      'requires_rest_day', resolved_requires_rest_day,
      'allows_manual_amount', resolved_allows_manual_amount,
      'rate_rule_amount', resolved_rate_rule_amount,
      'matched_contract_code', resolved_matched_contract_code,
      'matched_job_title', resolved_matched_job_title,
      'matched_union_name', resolved_matched_union_name,
      'matched_union_status', resolved_matched_union_status,
      'priority', resolved_matched_priority
    ),
    'roster_validation', jsonb_build_object(
      'requires_rest_day', resolved_requires_rest_day,
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
    'amount_source', resolved_amount_source,
    'manual_amount', resolved_manual_amount,
    'rate_source', resolved_rate_source,
    'rate_base_salary', resolved_rate_base_salary,
    'rate_weekly_hours', resolved_rate_weekly_hours,
    'rate_overtime_multiplier', resolved_rate_overtime_multiplier,
    'calculated_amount', calculated_amount
  );
end;
$function$;

grant execute on function public.add_hr_incentive_rate_rule(uuid, numeric, text, text, text, text, integer, date, date, numeric, numeric, numeric) to authenticated;
grant execute on function public.get_hr_incentive_eligible_types(text, text, date) to authenticated;

notify pgrst, 'reload schema';

commit;
