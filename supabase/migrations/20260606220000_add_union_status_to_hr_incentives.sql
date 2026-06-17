alter table public.hr_incentive_rate_rules
  add column if not exists union_status text null;

alter table public.hr_incentive_rate_rules
  drop constraint if exists hr_incentive_rate_rules_union_status_check;

alter table public.hr_incentive_rate_rules
  add constraint hr_incentive_rate_rules_union_status_check
  check (union_status is null or union_status in ('unionized', 'non_unionized', 'unknown'));

alter table public.hr_incentive_requests
  add column if not exists employee_union_status text not null default 'unknown';

alter table public.hr_incentive_requests
  add column if not exists employee_union_joined_at date null;

alter table public.hr_incentive_requests
  drop constraint if exists hr_incentive_requests_employee_union_status_check;

alter table public.hr_incentive_requests
  add constraint hr_incentive_requests_employee_union_status_check
  check (employee_union_status in ('unionized', 'non_unionized', 'unknown'));

create or replace function public.get_hr_incentive_union_status(
  p_raw_payload jsonb
)
returns text
language sql
immutable
as $function$
  select
    case
      when lower(trim(coalesce(p_raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Afecto a convenio Colectivo', ''))) in ('si', 'sí', 'yes', 'true', '1')
        then 'unionized'
      when lower(trim(coalesce(p_raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Afecto a convenio Colectivo', ''))) in ('no', 'false', '0')
        then 'non_unionized'
      when nullif(trim(coalesce(p_raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Fecha incorporación al sindicato', '')), '') is not null
        then 'unionized'
      else 'unknown'
    end;
$function$;

create or replace function public.get_hr_incentive_union_status_label(
  p_union_status text
)
returns text
language sql
immutable
as $function$
  select
    case
      when p_union_status = 'unionized' then 'Sindicalizado'
      when p_union_status = 'non_unionized' then 'No sindicalizado'
      else 'Sin información'
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
          'requires_replacement', it.requires_replacement,
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
          'union_status', rr.union_status,
          'amount', rr.amount,
          'priority', rr.priority,
          'valid_from', rr.valid_from,
          'valid_to', rr.valid_to,
          'is_active', rr.is_active,
          'created_at', rr.created_at
        )
        order by rr.is_active desc, it.name, rr.priority asc, rr.contract_code nulls last, rr.job_title nulls last, rr.union_status nulls last
      )
      from public.hr_incentive_rate_rules rr
      join public.hr_incentive_types it
        on it.id = rr.incentive_type_id
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.add_hr_incentive_rate_rule(
  p_incentive_type_id uuid,
  p_amount numeric,
  p_contract_code text default null,
  p_job_title text default null,
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
declare
  current_user_id uuid := auth.uid();
  normalized_union_status text := nullif(trim(coalesce(p_union_status, '')), '');
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

  insert into public.hr_incentive_rate_rules (
    incentive_type_id,
    amount,
    contract_code,
    job_title,
    union_status,
    priority,
    valid_from,
    valid_to
  )
  values (
    p_incentive_type_id,
    p_amount,
    nullif(trim(coalesce(p_contract_code, '')), ''),
    nullif(trim(coalesce(p_job_title, '')), ''),
    normalized_union_status,
    coalesce(p_priority, 100),
    p_valid_from,
    p_valid_to
  )
  returning id into result_id;

  return result_id;
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
    public.get_hr_incentive_union_status(e.raw_payload) as union_status,
    nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Fecha incorporación al sindicato'), '') as union_joined_at,
    nullif(trim(e.contract_code), '') as contract_code,
    nullif(trim(e.area_name), '') as area_name,
    nullif(trim(e.area_code), '') as area_code
  into worker_row
  from public.employees_active_current e
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_row.id is null then
    raise exception 'Trabajador BUK no encontrado';
  end if;

  resolved_union_status := coalesce(worker_row.union_status, 'unknown');

  return jsonb_build_object(
    'worker', jsonb_build_object(
      'buk_employee_id', worker_row.buk_employee_id,
      'full_name', worker_row.full_name,
      'document_number', worker_row.document_number,
      'document_type', worker_row.document_type,
      'job_title', worker_row.job_title,
      'union_status', resolved_union_status,
      'union_status_label', public.get_hr_incentive_union_status_label(resolved_union_status),
      'union_joined_at', worker_row.union_joined_at,
      'primary_contract_code', worker_row.contract_code,
      'primary_area_name', worker_row.area_name,
      'primary_area_code', worker_row.area_code
    ),
    'available_areas',
    coalesce((
      with worker_identity as (
        select
          coalesce(nullif(trim(worker_row.document_type), ''), 'rut') as document_type,
          coalesce(
            nullif(regexp_replace(coalesce(worker_row.document_number, ''), '\D', '', 'g'), ''),
            worker_row.buk_employee_id
          ) as identity_value
      ),
      ranked_options as (
        select
          e.contract_code,
          e.area_name,
          e.area_code,
          e.updated_at,
          case
            when coalesce(nullif(trim(e.contract_code), ''), '__none__') = coalesce(worker_row.contract_code, '__none__')
              and coalesce(nullif(trim(e.area_name), ''), '__none__') = coalesce(worker_row.area_name, '__none__')
            then 0
            else 1
          end as option_rank,
          row_number() over (
            partition by
              coalesce(nullif(trim(e.contract_code), ''), '__none__'),
              coalesce(nullif(trim(e.area_name), ''), '__none__'),
              coalesce(nullif(trim(e.area_code), ''), '__none__')
            order by
              case when e.is_active then 0 else 1 end,
              e.updated_at desc nulls last,
              e.created_at desc nulls last
          ) as row_rank
        from public.employees e
        cross join worker_identity wi
        where coalesce(nullif(trim(e.document_type), ''), 'rut') = wi.document_type
          and coalesce(
            nullif(regexp_replace(coalesce(e.document_number, ''), '\D', '', 'g'), ''),
            e.buk_employee_id
          ) = wi.identity_value
      )
      select jsonb_agg(
        jsonb_build_object(
          'contract_code', ro.contract_code,
          'area_name', ro.area_name,
          'area_code', ro.area_code,
          'label', concat_ws(' · ', coalesce(ro.contract_code, ro.area_code, 'Sin código'), coalesce(ro.area_name, 'Sin área')),
          'is_primary', ro.option_rank = 0
        )
        order by ro.option_rank asc, ro.updated_at desc nulls last, ro.contract_code nulls last, ro.area_name nulls last
      )
      from ranked_options ro
      where ro.row_rank = 1
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.resolve_hr_incentive_rate_rule(
  p_incentive_type_id uuid,
  p_job_title text,
  p_contract_code text,
  p_union_status text,
  p_service_date date
)
returns table (
  incentive_type_id uuid,
  incentive_type_name text,
  calculation_basis text,
  requires_replacement boolean,
  rate_rule_id uuid,
  rate_rule_amount numeric,
  matched_contract_code text,
  matched_job_title text,
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
    it.requires_replacement,
    rr.id,
    rr.amount,
    rr.contract_code,
    rr.job_title,
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
      rr.union_status is null
      or rr.union_status = coalesce(nullif(trim(coalesce(p_union_status, '')), ''), 'unknown')
    )
  order by
    case when rr.contract_code is not null then 0 else 1 end,
    case when rr.job_title is not null then 0 else 1 end,
    case when rr.union_status is not null then 0 else 1 end,
    rr.priority asc,
    rr.updated_at desc nulls last
  limit 1;
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
  worker_payload jsonb;
  worker_job_title text;
  worker_union_status text;
  resolved_service_date date := coalesce(p_service_date, current_date);
  rule_row record;
  calculated_amount numeric(12,2);
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para calcular incentivos';
  end if;

  worker_payload := public.get_hr_incentive_worker_context(p_buk_employee_id);
  worker_job_title := worker_payload -> 'worker' ->> 'job_title';
  worker_union_status := worker_payload -> 'worker' ->> 'union_status';

  select *
    into rule_row
  from public.resolve_hr_incentive_rate_rule(
    p_incentive_type_id,
    worker_job_title,
    p_selected_contract_code,
    worker_union_status,
    resolved_service_date
  );

  if rule_row.incentive_type_id is null then
    raise exception 'No existe una regla de monto activa para la combinación seleccionada';
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
      'rate_rule_amount', rule_row.rate_rule_amount,
      'matched_contract_code', rule_row.matched_contract_code,
      'matched_job_title', rule_row.matched_job_title,
      'matched_union_status', rule_row.matched_union_status,
      'priority', rule_row.matched_priority
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
  p_replacement_buk_employee_id text default null
)
returns table (
  request_id uuid,
  folio bigint,
  status text,
  calculated_amount numeric
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
  new_request_id uuid;
  new_folio bigint;
  resolved_service_at timestamptz := coalesce(p_service_date, timezone('utc', now()));
  resolved_period_code text := to_char(coalesce(p_service_date, timezone('utc', now())), 'YYYYMM');
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

  worker_payload := public.get_hr_incentive_worker_context(p_buk_employee_id);
  worker_data := worker_payload -> 'worker';
  preview_payload := public.calculate_hr_incentive_preview(
    p_buk_employee_id,
    p_incentive_type_id,
    p_selected_contract_code,
    p_duration_hours,
    resolved_service_at::date
  );
  rule_data := preview_payload -> 'rule';

  if coalesce((rule_data ->> 'requires_replacement')::boolean, false) then
    if nullif(trim(coalesce(p_replacement_buk_employee_id, '')), '') is null then
      raise exception 'El tipo de incentivo seleccionado exige trabajador reemplazado';
    end if;

    replacement_payload := public.get_hr_incentive_worker_context(p_replacement_buk_employee_id) -> 'worker';
  end if;

  insert into public.hr_incentive_requests (
    employee_buk_employee_id,
    employee_document_type,
    employee_document_number,
    employee_full_name,
    employee_job_title,
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
    status,
    created_by
  )
  values (
    worker_data ->> 'buk_employee_id',
    coalesce(worker_data ->> 'document_type', 'rut'),
    worker_data ->> 'document_number',
    worker_data ->> 'full_name',
    worker_data ->> 'job_title',
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
    'P',
    current_user_id
  )
  returning id, folio into new_request_id, new_folio;

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
      'employee_union_status', coalesce(worker_data ->> 'union_status', 'unknown'),
      'calculated_amount', (preview_payload ->> 'calculated_amount')::numeric
    )
  );

  return query
  select
    new_request_id,
    new_folio,
    'P'::text,
    (preview_payload ->> 'calculated_amount')::numeric;
end;
$function$;

revoke all on function public.add_hr_incentive_rate_rule(uuid, numeric, text, text, text, integer, date, date) from public, anon, authenticated;
grant execute on function public.add_hr_incentive_rate_rule(uuid, numeric, text, text, text, integer, date, date) to authenticated;

revoke all on function public.resolve_hr_incentive_rate_rule(uuid, text, text, text, date) from public, anon, authenticated;
grant execute on function public.resolve_hr_incentive_rate_rule(uuid, text, text, text, date) to authenticated;

notify pgrst, 'reload schema';
