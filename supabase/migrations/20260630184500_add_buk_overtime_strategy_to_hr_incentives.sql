begin;

alter table public.hr_incentive_types
  add column if not exists hour_rate_strategy text not null default 'rule_amount';

alter table public.hr_incentive_types
  drop constraint if exists hr_incentive_types_hour_rate_strategy_check;

alter table public.hr_incentive_types
  add constraint hr_incentive_types_hour_rate_strategy_check
  check (hour_rate_strategy in ('rule_amount', 'buk_overtime'));

alter table public.hr_incentive_rate_rules
  add column if not exists fallback_base_salary numeric(12,2) null;

alter table public.hr_incentive_rate_rules
  drop constraint if exists hr_incentive_rate_rules_fallback_base_salary_check;

alter table public.hr_incentive_rate_rules
  add constraint hr_incentive_rate_rules_fallback_base_salary_check
  check (fallback_base_salary is null or fallback_base_salary >= 0);

alter table public.hr_incentive_rate_rules
  add column if not exists fallback_weekly_hours numeric(8,2) null;

alter table public.hr_incentive_rate_rules
  drop constraint if exists hr_incentive_rate_rules_fallback_weekly_hours_check;

alter table public.hr_incentive_rate_rules
  add constraint hr_incentive_rate_rules_fallback_weekly_hours_check
  check (fallback_weekly_hours is null or fallback_weekly_hours > 0);

alter table public.hr_incentive_rate_rules
  add column if not exists overtime_multiplier numeric(6,3) not null default 1.5;

alter table public.hr_incentive_rate_rules
  drop constraint if exists hr_incentive_rate_rules_overtime_multiplier_check;

alter table public.hr_incentive_rate_rules
  add constraint hr_incentive_rate_rules_overtime_multiplier_check
  check (overtime_multiplier > 0);

update public.hr_incentive_types
   set hour_rate_strategy = 'buk_overtime',
       updated_at = timezone('utc', now())
 where code = 'sobretiempo'
   and calculation_basis = 'per_hour'
   and hour_rate_strategy = 'rule_amount';

create or replace function public.extract_hr_incentive_numeric_value(
  p_value text
)
returns numeric
language plpgsql
immutable
as $function$
declare
  normalized_value text;
begin
  normalized_value := nullif(
    regexp_replace(coalesce(p_value, ''), '[^0-9.\-]', '', 'g'),
    ''
  );

  if normalized_value is null then
    return null;
  end if;

  return normalized_value::numeric;
exception
  when invalid_text_representation then
    return null;
end;
$function$;

create or replace function public.extract_hr_incentive_worker_base_salary(
  p_raw_payload jsonb
)
returns numeric
language plpgsql
immutable
as $function$
declare
  candidate_value numeric;
begin
  candidate_value := public.extract_hr_incentive_numeric_value(p_raw_payload ->> 'base_salary');

  if candidate_value is null then
    candidate_value := public.extract_hr_incentive_numeric_value(
      p_raw_payload -> 'contract' ->> 'base_salary'
    );
  end if;

  if candidate_value is null then
    candidate_value := public.extract_hr_incentive_numeric_value(
      p_raw_payload -> 'current_job' ->> 'base_salary'
    );
  end if;

  if candidate_value is null then
    candidate_value := public.extract_hr_incentive_numeric_value(
      p_raw_payload -> 'current_job' -> 'compensation' ->> 'base_salary'
    );
  end if;

  if candidate_value is not null and candidate_value > 0 then
    return round(candidate_value::numeric, 2);
  end if;

  return null;
end;
$function$;

create or replace function public.extract_hr_incentive_worker_weekly_hours(
  p_raw_payload jsonb
)
returns numeric
language plpgsql
immutable
as $function$
declare
  candidate_value numeric;
begin
  candidate_value := public.extract_hr_incentive_numeric_value(p_raw_payload ->> 'weekly_hours');

  if candidate_value is null then
    candidate_value := public.extract_hr_incentive_numeric_value(
      p_raw_payload -> 'current_job' ->> 'weekly_hours'
    );
  end if;

  if candidate_value is null then
    candidate_value := public.extract_hr_incentive_numeric_value(
      p_raw_payload -> 'contract' ->> 'weekly_hours'
    );
  end if;

  if candidate_value is null then
    candidate_value := public.extract_hr_incentive_numeric_value(
      p_raw_payload -> 'current_job' -> 'schedule' ->> 'weekly_hours'
    );
  end if;

  if candidate_value is not null and candidate_value > 0 then
    return round(candidate_value::numeric, 2);
  end if;

  return null;
end;
$function$;

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
  resolved_base_salary numeric;
  resolved_weekly_hours numeric;
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
    bcm.id as mapping_id,
    e.raw_payload
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
  resolved_base_salary := public.extract_hr_incentive_worker_base_salary(worker_row.raw_payload);
  resolved_weekly_hours := public.extract_hr_incentive_worker_weekly_hours(worker_row.raw_payload);

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
    'mapping_id', worker_row.mapping_id,
    'base_salary', resolved_base_salary,
    'weekly_hours', resolved_weekly_hours
  );
end;
$function$;

create or replace function public.resolve_hr_incentive_hour_rate(
  p_hour_rate_strategy text,
  p_rule_amount numeric,
  p_worker_base_salary numeric default null,
  p_worker_weekly_hours numeric default null,
  p_fallback_base_salary numeric default null,
  p_fallback_weekly_hours numeric default null,
  p_overtime_multiplier numeric default 1.5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  normalized_strategy text := case
    when trim(coalesce(p_hour_rate_strategy, '')) = 'buk_overtime' then 'buk_overtime'
    else 'rule_amount'
  end;
  normalized_rule_amount numeric(12,2) := round(coalesce(p_rule_amount, 0)::numeric, 2);
  normalized_multiplier numeric(6,3) := case
    when coalesce(p_overtime_multiplier, 0) > 0 then round(p_overtime_multiplier::numeric, 3)
    else 1.5
  end;
  resolved_worker_base_salary numeric := case
    when p_worker_base_salary is not null and p_worker_base_salary > 0
      then round(p_worker_base_salary::numeric, 2)
    else null
  end;
  resolved_worker_weekly_hours numeric := case
    when p_worker_weekly_hours is not null and p_worker_weekly_hours > 0
      then round(p_worker_weekly_hours::numeric, 2)
    else null
  end;
  resolved_fallback_base_salary numeric := case
    when p_fallback_base_salary is not null and p_fallback_base_salary > 0
      then round(p_fallback_base_salary::numeric, 2)
    else null
  end;
  resolved_fallback_weekly_hours numeric := case
    when p_fallback_weekly_hours is not null and p_fallback_weekly_hours > 0
      then round(p_fallback_weekly_hours::numeric, 2)
    else null
  end;
  resolved_base_salary numeric;
  resolved_weekly_hours numeric;
  resolved_rate_source text := 'rule_amount';
  resolved_hour_rate numeric(12,2) := normalized_rule_amount;
  resolved_reason text := null;
begin
  if normalized_strategy <> 'buk_overtime' then
    return jsonb_build_object(
      'can_resolve', true,
      'hour_rate_strategy', 'rule_amount',
      'rate_rule_amount', normalized_rule_amount,
      'rate_source', resolved_rate_source,
      'base_salary', null,
      'weekly_hours', null,
      'overtime_multiplier', null,
      'reason', null
    );
  end if;

  resolved_base_salary := coalesce(resolved_worker_base_salary, resolved_fallback_base_salary);
  resolved_weekly_hours := coalesce(resolved_worker_weekly_hours, resolved_fallback_weekly_hours);

  if resolved_base_salary is not null and resolved_weekly_hours is not null then
    resolved_rate_source := case
      when resolved_worker_base_salary is not null and resolved_worker_weekly_hours is not null
        then 'buk_payload'
      else 'rule_fallback_salary'
    end;
    resolved_hour_rate := round(
      ((((resolved_base_salary / 30) * 7) / resolved_weekly_hours) * normalized_multiplier)::numeric,
      2
    );

    return jsonb_build_object(
      'can_resolve', true,
      'hour_rate_strategy', 'buk_overtime',
      'rate_rule_amount', resolved_hour_rate,
      'rate_source', resolved_rate_source,
      'base_salary', resolved_base_salary,
      'weekly_hours', resolved_weekly_hours,
      'overtime_multiplier', normalized_multiplier,
      'reason', null
    );
  end if;

  if normalized_rule_amount > 0 then
    return jsonb_build_object(
      'can_resolve', true,
      'hour_rate_strategy', 'buk_overtime',
      'rate_rule_amount', normalized_rule_amount,
      'rate_source', 'rule_amount',
      'base_salary', null,
      'weekly_hours', null,
      'overtime_multiplier', normalized_multiplier,
      'reason', 'Se aplicó el valor hora de respaldo definido en la regla.'
    );
  end if;

  resolved_reason := case
    when resolved_base_salary is null and resolved_weekly_hours is null then
      'No hay sueldo base BUK ni fallback salarial configurado para calcular la hora extra.'
    when resolved_base_salary is null then
      'Falta el sueldo base BUK y tampoco existe un sueldo base fallback configurado para calcular la hora extra.'
    else
      'Falta la jornada semanal BUK y tampoco existe una jornada fallback configurada para calcular la hora extra.'
  end;

  return jsonb_build_object(
    'can_resolve', false,
    'hour_rate_strategy', 'buk_overtime',
    'rate_rule_amount', normalized_rule_amount,
    'rate_source', 'rule_amount',
    'base_salary', resolved_base_salary,
    'weekly_hours', resolved_weekly_hours,
    'overtime_multiplier', normalized_multiplier,
    'reason', resolved_reason
  );
end;
$function$;

create or replace function public.get_hr_incentive_setup_catalogs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para administrar incentivos';
  end if;

  return jsonb_build_object(
    'buk_job_titles',
    coalesce((
      with active_job_titles as (
        select distinct
          coalesce(
            nullif(trim(e.job_title), ''),
            nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
            nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
            nullif(trim(e.raw_payload ->> 'job_title'), '')
          ) as resolved_job_title
        from public.employees_active_current e
      )
      select jsonb_agg(ajt.resolved_job_title order by upper(ajt.resolved_job_title), ajt.resolved_job_title)
      from active_job_titles ajt
      where ajt.resolved_job_title is not null
    ), '[]'::jsonb),
    'buk_unions',
    coalesce((
      with active_unions as (
        select distinct public.get_hr_incentive_union_name(e.raw_payload) as union_name
        from public.employees_active_current e
      )
      select jsonb_agg(au.union_name order by upper(au.union_name), au.union_name)
      from active_unions au
      where au.union_name is not null
    ), '[]'::jsonb),
    'buk_union_statuses',
    coalesce((
      with active_union_statuses as (
        select distinct public.get_hr_incentive_union_status(e.raw_payload) as union_status
        from public.employees_active_current e
      )
      select jsonb_agg(
        jsonb_build_object(
          'value', aus.union_status,
          'label', public.get_hr_incentive_union_status_label(aus.union_status)
        )
        order by case aus.union_status
          when 'unionized' then 0
          when 'non_unionized' then 1
          else 2
        end
      )
      from active_union_statuses aus
      where aus.union_status is not null
    ), '[]'::jsonb),
    'contract_options',
    coalesce((
      with contract_catalog as (
        select distinct on (c.code)
          c.code as value,
          concat_ws(
            ' · ',
            coalesce(
              nullif(trim(bcm.buk_area_name), ''),
              nullif(trim(c.contract_name), ''),
              c.code
            ),
            c.code
          ) as label
        from public.contracts c
        left join public.buk_contract_mappings bcm
          on bcm.contract_id = c.id
         and bcm.is_operational = true
        where c.is_active = true
        order by c.code, bcm.is_one_to_one desc, bcm.updated_at desc nulls last, bcm.id desc nulls last
      )
      select jsonb_agg(
        jsonb_build_object(
          'value', cc.value,
          'label', cc.label
        )
        order by upper(cc.label), cc.label
      )
      from contract_catalog cc
    ), '[]'::jsonb),
    'allowed_job_titles',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', jt.id,
          'job_title', jt.job_title,
          'is_active', jt.is_active,
          'created_at', jt.created_at
        )
        order by jt.is_active desc, jt.job_title
      )
      from public.hr_incentive_allowed_job_titles jt
    ), '[]'::jsonb),
    'incentive_types',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', it.id,
          'code', it.code,
          'name', it.name,
          'calculation_basis', it.calculation_basis,
          'hour_rate_strategy', it.hour_rate_strategy,
          'requires_replacement', it.requires_replacement,
          'requires_rest_day', it.requires_rest_day,
          'allows_manual_amount', it.allows_manual_amount,
          'is_active', it.is_active,
          'created_at', it.created_at
        )
        order by it.is_active desc, it.name
      )
      from public.hr_incentive_types it
    ), '[]'::jsonb),
    'rate_rules',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', rr.id,
          'incentive_type_id', rr.incentive_type_id,
          'incentive_type_name', it.name,
          'contract_code', rr.contract_code,
          'job_title', rr.job_title,
          'union_name', rr.union_name,
          'union_status', rr.union_status,
          'amount', rr.amount,
          'fallback_base_salary', rr.fallback_base_salary,
          'fallback_weekly_hours', rr.fallback_weekly_hours,
          'overtime_multiplier', rr.overtime_multiplier,
          'priority', rr.priority,
          'valid_from', rr.valid_from,
          'valid_to', rr.valid_to,
          'is_active', rr.is_active,
          'created_at', rr.created_at
        )
        order by rr.is_active desc, it.name, rr.priority asc, rr.contract_code nulls last, rr.job_title nulls last, rr.union_name nulls last, rr.union_status nulls last
      )
      from public.hr_incentive_rate_rules rr
      join public.hr_incentive_types it
        on it.id = rr.incentive_type_id
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.add_hr_incentive_type(
  p_code text,
  p_name text,
  p_calculation_basis text,
  p_requires_replacement boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
begin
  return public.add_hr_incentive_type(
    p_code,
    p_name,
    p_calculation_basis,
    p_requires_replacement,
    false,
    'rule_amount'
  );
end;
$function$;

create or replace function public.add_hr_incentive_type(
  p_code text,
  p_name text,
  p_calculation_basis text,
  p_requires_replacement boolean default false,
  p_allows_manual_amount boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
begin
  return public.add_hr_incentive_type(
    p_code,
    p_name,
    p_calculation_basis,
    p_requires_replacement,
    p_allows_manual_amount,
    'rule_amount'
  );
end;
$function$;

create or replace function public.add_hr_incentive_type(
  p_code text,
  p_name text,
  p_calculation_basis text,
  p_requires_replacement boolean default false,
  p_allows_manual_amount boolean default false,
  p_hour_rate_strategy text default 'rule_amount'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := lower(trim(coalesce(p_code, '')));
  normalized_name text := trim(coalesce(p_name, ''));
  normalized_hour_rate_strategy text := case
    when p_calculation_basis = 'per_hour' and trim(coalesce(p_hour_rate_strategy, '')) = 'buk_overtime'
      then 'buk_overtime'
    else 'rule_amount'
  end;
  result_id uuid;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para administrar incentivos';
  end if;

  if normalized_code = '' or normalized_name = '' then
    raise exception 'Debe indicar código y nombre para el tipo de incentivo';
  end if;

  if p_calculation_basis not in ('fixed', 'per_hour') then
    raise exception 'La base de cálculo no es válida';
  end if;

  insert into public.hr_incentive_types (
    code,
    name,
    calculation_basis,
    hour_rate_strategy,
    requires_replacement,
    allows_manual_amount
  )
  values (
    normalized_code,
    normalized_name,
    p_calculation_basis,
    normalized_hour_rate_strategy,
    coalesce(p_requires_replacement, false),
    coalesce(p_allows_manual_amount, false)
  )
  on conflict (code)
  do update
     set name = excluded.name,
         calculation_basis = excluded.calculation_basis,
         hour_rate_strategy = excluded.hour_rate_strategy,
         requires_replacement = excluded.requires_replacement,
         allows_manual_amount = excluded.allows_manual_amount,
         is_active = true,
         updated_at = timezone('utc', now())
  returning id into result_id;

  return result_id;
end;
$function$;

create or replace function public.set_hr_incentive_type_hour_rate_strategy(
  p_type_id uuid,
  p_hour_rate_strategy text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_strategy text := case
    when trim(coalesce(p_hour_rate_strategy, '')) = 'buk_overtime' then 'buk_overtime'
    when trim(coalesce(p_hour_rate_strategy, '')) = 'rule_amount' then 'rule_amount'
    else null
  end;
  target_basis text;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para administrar incentivos';
  end if;

  if normalized_strategy is null then
    raise exception 'La estrategia horaria no es válida';
  end if;

  select calculation_basis
    into target_basis
  from public.hr_incentive_types
  where id = p_type_id;

  if target_basis is null then
    raise exception 'Tipo de incentivo no encontrado';
  end if;

  if target_basis <> 'per_hour' and normalized_strategy = 'buk_overtime' then
    raise exception 'Solo los incentivos por hora pueden usar cálculo automático de hora extra';
  end if;

  update public.hr_incentive_types
     set hour_rate_strategy = case
       when target_basis = 'per_hour' then normalized_strategy
       else 'rule_amount'
     end
   where id = p_type_id;
end;
$function$;

create or replace function public.add_hr_incentive_rate_rule(
  p_incentive_type_id uuid,
  p_amount numeric,
  p_contract_code text default null,
  p_job_title text default null,
  p_union_name text default null,
  p_union_status text default null,
  p_priority integer default 100,
  p_valid_from date default null,
  p_valid_to date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
begin
  return public.add_hr_incentive_rate_rule(
    p_incentive_type_id,
    p_amount,
    p_contract_code,
    p_job_title,
    p_union_name,
    p_union_status,
    p_priority,
    p_valid_from,
    p_valid_to,
    null,
    null,
    1.5
  );
end;
$function$;

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
  result_id uuid;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para administrar incentivos';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'Debe indicar un monto válido para la regla';
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

  select hour_rate_strategy
    into resolved_hour_rate_strategy
  from public.hr_incentive_types
  where id = p_incentive_type_id;

  if resolved_hour_rate_strategy is null then
    raise exception 'Tipo de incentivo no encontrado para la regla';
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
    p_amount,
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

drop function if exists public.resolve_hr_incentive_rate_rule(uuid, text, text, text, text, date);

create or replace function public.resolve_hr_incentive_rate_rule(
  p_incentive_type_id uuid,
  p_job_title text,
  p_contract_code text,
  p_union_name text,
  p_union_status text,
  p_service_date date
)
returns table (
  incentive_type_id uuid,
  incentive_type_name text,
  calculation_basis text,
  hour_rate_strategy text,
  requires_replacement boolean,
  requires_rest_day boolean,
  allows_manual_amount boolean,
  rate_rule_id uuid,
  rate_rule_amount numeric,
  fallback_base_salary numeric,
  fallback_weekly_hours numeric,
  overtime_multiplier numeric,
  matched_contract_code text,
  matched_job_title text,
  matched_union_name text,
  matched_union_status text,
  matched_priority integer
)
language plpgsql
security definer
set search_path = public
as $function$
begin
  return query
  select
    it.id,
    it.name,
    it.calculation_basis,
    it.hour_rate_strategy,
    it.requires_replacement,
    it.requires_rest_day,
    it.allows_manual_amount,
    rr.id,
    rr.amount,
    rr.fallback_base_salary,
    rr.fallback_weekly_hours,
    rr.overtime_multiplier,
    rr.contract_code,
    rr.job_title,
    rr.union_name,
    rr.union_status,
    rr.priority
  from public.hr_incentive_types it
  join public.hr_incentive_rate_rules rr
    on rr.incentive_type_id = it.id
  where it.id = p_incentive_type_id
    and it.is_active = true
    and rr.is_active = true
    and (rr.valid_from is null or rr.valid_from <= p_service_date)
    and (rr.valid_to is null or rr.valid_to >= p_service_date)
    and (rr.contract_code is null or rr.contract_code = nullif(trim(coalesce(p_contract_code, '')), ''))
    and (
      rr.job_title is null
      or upper(trim(rr.job_title)) = upper(trim(coalesce(p_job_title, '')))
    )
    and (
      rr.union_name is null
      or upper(trim(rr.union_name)) = upper(trim(coalesce(p_union_name, '')))
    )
    and (
      rr.union_status is null
      or rr.union_status = coalesce(nullif(trim(coalesce(p_union_status, '')), ''), 'unknown')
    )
  order by
    case when rr.contract_code is not null then 0 else 1 end,
    case when rr.job_title is not null then 0 else 1 end,
    case when rr.union_name is not null then 0 else 1 end,
    case when rr.union_status is not null then 0 else 1 end,
    rr.priority asc,
    rr.updated_at desc nulls last
  limit 1;
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
  with matched_types as (
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
  )
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
    mt.created_at
  from matched_types mt
  where
    mt.calculation_basis <> 'per_hour'
    or coalesce((mt.rate_resolution ->> 'can_resolve')::boolean, false)
    or mt.allows_manual_amount = true
  order by mt.name asc, mt.code asc;
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
  p_declared_rest_day boolean default null,
  p_manual_amount numeric default null
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
    resolved_service_at::date,
    p_manual_amount
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
    amount_source,
    manual_amount,
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
    coalesce(preview_payload ->> 'amount_source', 'rule'),
    nullif(preview_payload ->> 'manual_amount', '')::numeric,
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
      'rate_rule_amount', (rule_data ->> 'rate_rule_amount')::numeric,
      'rate_source', coalesce(preview_payload ->> 'rate_source', 'rule_amount'),
      'rate_base_salary', nullif(preview_payload ->> 'rate_base_salary', '')::numeric,
      'rate_weekly_hours', nullif(preview_payload ->> 'rate_weekly_hours', '')::numeric,
      'rate_overtime_multiplier', nullif(preview_payload ->> 'rate_overtime_multiplier', '')::numeric,
      'hour_rate_strategy', coalesce(rule_data ->> 'hour_rate_strategy', 'rule_amount'),
      'amount_source', coalesce(preview_payload ->> 'amount_source', 'rule'),
      'manual_amount', nullif(preview_payload ->> 'manual_amount', '')::numeric,
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

grant execute on function public.add_hr_incentive_type(text, text, text, boolean, boolean, text) to authenticated;
grant execute on function public.set_hr_incentive_type_hour_rate_strategy(uuid, text) to authenticated;
grant execute on function public.add_hr_incentive_rate_rule(uuid, numeric, text, text, text, text, integer, date, date, numeric, numeric, numeric) to authenticated;
grant execute on function public.get_hr_incentive_eligible_types(text, text, date) to authenticated;

notify pgrst, 'reload schema';

commit;
