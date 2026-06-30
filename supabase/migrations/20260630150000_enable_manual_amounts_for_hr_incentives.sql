begin;

alter table public.hr_incentive_types
  add column if not exists allows_manual_amount boolean not null default false;

alter table public.hr_incentive_requests
  add column if not exists amount_source text not null default 'rule';

alter table public.hr_incentive_requests
  drop constraint if exists hr_incentive_requests_amount_source_check;

alter table public.hr_incentive_requests
  add constraint hr_incentive_requests_amount_source_check
  check (amount_source in ('rule', 'manual'));

alter table public.hr_incentive_requests
  add column if not exists manual_amount numeric(12,2) null;

alter table public.hr_incentive_requests
  drop constraint if exists hr_incentive_requests_manual_amount_check;

alter table public.hr_incentive_requests
  add constraint hr_incentive_requests_manual_amount_check
  check (manual_amount is null or manual_amount >= 0);

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
    false
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
declare
  current_user_id uuid := auth.uid();
  normalized_code text := lower(trim(coalesce(p_code, '')));
  normalized_name text := trim(coalesce(p_name, ''));
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
    requires_replacement,
    allows_manual_amount
  )
  values (
    normalized_code,
    normalized_name,
    p_calculation_basis,
    coalesce(p_requires_replacement, false),
    coalesce(p_allows_manual_amount, false)
  )
  on conflict (code)
  do update
     set name = excluded.name,
         calculation_basis = excluded.calculation_basis,
         requires_replacement = excluded.requires_replacement,
         allows_manual_amount = excluded.allows_manual_amount,
         is_active = true,
         updated_at = timezone('utc', now())
  returning id into result_id;

  return result_id;
end;
$function$;

create or replace function public.set_hr_incentive_type_manual_amount_option(
  p_type_id uuid,
  p_allows_manual_amount boolean
)
returns void
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

  update public.hr_incentive_types
  set
    allows_manual_amount = coalesce(p_allows_manual_amount, false),
    updated_at = timezone('utc', now())
  where id = p_type_id;

  if not found then
    raise exception 'No existe el tipo de incentivo indicado';
  end if;
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
  requires_replacement boolean,
  requires_rest_day boolean,
  allows_manual_amount boolean,
  rate_rule_id uuid,
  rate_rule_amount numeric,
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
    it.requires_replacement,
    it.requires_rest_day,
    it.allows_manual_amount,
    rr.id,
    rr.amount,
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
begin
  return public.build_hr_incentive_preview_from_worker_data(
    p_worker_data,
    p_buk_employee_id,
    p_incentive_type_id,
    p_selected_contract_code,
    p_duration_hours,
    p_service_date,
    null
  );
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
  rule_row record;
  roster_day_row record;
  conflicting_rest_day_request_row record;
  calculated_amount numeric(12,2);
  resolved_schedule_label text;
  resolved_absence_label text;
  resolved_rest_day_conflict_contract_label text;
  resolved_block_reason text;
  resolved_amount_source text := 'rule';
  resolved_manual_amount numeric(12,2) := null;
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

  if p_manual_amount is not null and p_manual_amount < 0 then
    raise exception 'El monto manual no puede ser negativo';
  end if;

  if p_manual_amount is not null and not coalesce(rule_row.allows_manual_amount, false) then
    raise exception 'El tipo de incentivo seleccionado no permite ingresar monto manual';
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

  if p_manual_amount is not null then
    resolved_amount_source := 'manual';
    resolved_manual_amount := round(p_manual_amount::numeric, 2);
    calculated_amount := resolved_manual_amount;
  elsif rule_row.calculation_basis = 'per_hour' then
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
      'allows_manual_amount', rule_row.allows_manual_amount,
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
    'amount_source', resolved_amount_source,
    'manual_amount', resolved_manual_amount,
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
begin
  return public.calculate_hr_incentive_preview(
    p_buk_employee_id,
    p_incentive_type_id,
    p_selected_contract_code,
    p_duration_hours,
    p_service_date,
    null
  );
end;
$function$;

create or replace function public.calculate_hr_incentive_preview(
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
    coalesce(p_service_date, current_date),
    p_manual_amount
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
begin
  return query
  select *
  from public.create_hr_incentive_request(
    p_buk_employee_id,
    p_incentive_type_id,
    p_selected_contract_code,
    p_selected_area_name,
    p_selected_area_code,
    p_service_date,
    p_duration_hours,
    p_motive,
    p_description,
    p_replacement_buk_employee_id,
    p_declared_rest_day,
    null
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

drop function if exists public.get_hr_incentive_requests(text, text[], text[], text, uuid[], date, integer, integer, text, text);

create or replace function public.get_hr_incentive_requests(
  p_period_code text default null,
  p_statuses text[] default null,
  p_contract_codes text[] default null,
  p_worker_search text default null,
  p_type_ids uuid[] default null,
  p_service_date_until date default null,
  p_limit integer default null,
  p_offset integer default 0,
  p_sort_column text default null,
  p_sort_direction text default 'desc'
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
  amount_source text,
  manual_amount numeric,
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
  declared_rest_day boolean,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_worker_search, '')));
  normalized_contract_codes text[];
  normalized_type_ids uuid[];
  normalized_statuses text[];
  include_all_statuses boolean := false;
  normalized_sort_column text := lower(trim(coalesce(p_sort_column, '')));
  normalized_sort_direction text := case
    when lower(trim(coalesce(p_sort_direction, 'desc'))) = 'asc' then 'asc'
    else 'desc'
  end;
  resolved_limit integer := nullif(greatest(coalesce(p_limit, 0), 0), 0);
  resolved_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para ver incentivos';
  end if;

  select coalesce(array_agg(distinct trimmed_value), '{}'::text[])
    into normalized_contract_codes
  from (
    select trim(raw_value) as trimmed_value
    from unnest(coalesce(p_contract_codes, '{}'::text[])) as raw_value
    where trim(coalesce(raw_value, '')) <> ''
  ) sanitized_contracts;

  select coalesce(array_agg(distinct raw_value), '{}'::uuid[])
    into normalized_type_ids
  from unnest(coalesce(p_type_ids, '{}'::uuid[])) as raw_value
  where raw_value is not null;

  select coalesce(array_agg(distinct upper(trimmed_value)), '{}'::text[])
    into normalized_statuses
  from (
    select trim(raw_value) as trimmed_value
    from unnest(coalesce(p_statuses, '{}'::text[])) as raw_value
    where trim(coalesce(raw_value, '')) <> ''
  ) sanitized_statuses;

  include_all_statuses := 'A' = any(normalized_statuses);

  return query
  with filtered_requests as (
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
      hir.amount_source,
      hir.manual_amount,
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
      select hira.approver_name
      from public.hr_incentive_request_approvals hira
      where hira.incentive_request_id = hir.id
        and hira.status = 'pending'
      order by hira.step_order asc, hira.created_at asc, hira.id asc
      limit 1
    ) pending_approval on true
    where (
        p_period_code is null
        or trim(coalesce(p_period_code, '')) = ''
        or hir.period_code = trim(p_period_code)
      )
      and (
        p_service_date_until is null
        or hir.service_date::date <= p_service_date_until
      )
      and (
        cardinality(normalized_contract_codes) = 0
        or hir.selected_contract_code = any(normalized_contract_codes)
      )
      and (
        cardinality(normalized_type_ids) = 0
        or hir.incentive_type_id = any(normalized_type_ids)
      )
      and (
        cardinality(normalized_statuses) = 0
        or include_all_statuses
        or upper(hir.status) = any(normalized_statuses)
      )
      and (
        normalized_search = ''
        or lower(
          concat_ws(
            ' ',
            hir.employee_full_name,
            coalesce(hir.employee_document_number, ''),
            coalesce(hir.employee_job_title, ''),
            coalesce(hir.employee_union_name, ''),
            coalesce(hir.selected_contract_code, ''),
            coalesce(hir.selected_area_name, ''),
            coalesce(hir.incentive_type_name, '')
          )
        ) like '%' || normalized_search || '%'
      )
  ),
  counted_requests as (
    select fr.*, count(*) over () as total_count
    from filtered_requests fr
  ),
  ordered_requests as (
    select *
    from counted_requests fr
    order by
      case when normalized_sort_column = 'folio' and normalized_sort_direction = 'asc' then fr.folio end asc nulls last,
      case when normalized_sort_column = 'folio' and normalized_sort_direction = 'desc' then fr.folio end desc nulls last,
      case when normalized_sort_column = 'trabajador' and normalized_sort_direction = 'asc' then fr.employee_full_name end asc nulls last,
      case when normalized_sort_column = 'trabajador' and normalized_sort_direction = 'desc' then fr.employee_full_name end desc nulls last,
      case when normalized_sort_column = 'incentivo' and normalized_sort_direction = 'asc' then fr.incentive_type_name end asc nulls last,
      case when normalized_sort_column = 'incentivo' and normalized_sort_direction = 'desc' then fr.incentive_type_name end desc nulls last,
      case when normalized_sort_column = 'contrato' and normalized_sort_direction = 'asc' then
        coalesce(fr.selected_area_name, '') || ' ' || coalesce(fr.selected_contract_code, '')
      end asc nulls last,
      case when normalized_sort_column = 'contrato' and normalized_sort_direction = 'desc' then
        coalesce(fr.selected_area_name, '') || ' ' || coalesce(fr.selected_contract_code, '')
      end desc nulls last,
      case when normalized_sort_column = 'fecha' and normalized_sort_direction = 'asc' then fr.service_date end asc nulls last,
      case when normalized_sort_column = 'fecha' and normalized_sort_direction = 'desc' then fr.service_date end desc nulls last,
      case when normalized_sort_column = 'monto' and normalized_sort_direction = 'asc' then fr.calculated_amount end asc nulls last,
      case when normalized_sort_column = 'monto' and normalized_sort_direction = 'desc' then fr.calculated_amount end desc nulls last,
      case when normalized_sort_column = 'estado' and normalized_sort_direction = 'asc' then
        case fr.status
          when 'F' then 1
          when 'C' then 2
          when 'P' then 3
          when 'E' then 4
          when 'R' then 5
          else 99
        end
      end asc nulls last,
      case when normalized_sort_column = 'estado' and normalized_sort_direction = 'desc' then
        case fr.status
          when 'F' then 1
          when 'C' then 2
          when 'P' then 3
          when 'E' then 4
          when 'R' then 5
          else 99
        end
      end desc nulls last,
      case when normalized_sort_column not in ('folio', 'trabajador', 'incentivo', 'contrato', 'fecha', 'monto', 'estado') then fr.created_at end desc,
      case when normalized_sort_column not in ('folio', 'trabajador', 'incentivo', 'contrato', 'fecha', 'monto', 'estado') then fr.folio end desc,
      fr.id desc
    offset resolved_offset
    limit resolved_limit
  )
  select *
  from ordered_requests;
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
      'calculation_basis', hir.calculation_basis,
      'rate_rule_amount', hir.rate_rule_amount,
      'amount_source', hir.amount_source,
      'manual_amount', hir.manual_amount,
      'calculated_amount', hir.calculated_amount,
      'requester_name', coalesce(requester_profile.full_name, requester_profile.email, 'Usuario no disponible'),
      'requester_email', requester_profile.email,
      'current_step_code', current_approval.step_code,
      'current_step_name', current_approval.step_name,
      'current_approver_name', current_approval.approver_name,
      'cancelled_at', hir.cancelled_at,
      'cancellation_comment', hir.cancellation_comment,
      'created_at', hir.created_at,
      'updated_at', hir.updated_at,
      'declared_rest_day', hir.declared_rest_day
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
        order by hira.step_order asc, hira.created_at asc, hira.id asc
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
          'actor_name', coalesce(actor_profile.full_name, actor_profile.email, 'Sistema'),
          'comment', hih.comment,
          'metadata', hih.metadata,
          'created_at', hih.created_at
        )
        order by hih.created_at asc, hih.id asc
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
    order by hira.step_order asc, hira.created_at asc, hira.id asc
    limit 1
  ) current_approval on true
  where hir.id = p_request_id;

  if request_payload is null then
    raise exception 'No existe el incentivo indicado';
  end if;

  return request_payload;
end;
$function$;

grant execute on function public.add_hr_incentive_type(text, text, text, boolean, boolean) to authenticated;
grant execute on function public.set_hr_incentive_type_manual_amount_option(uuid, boolean) to authenticated;
grant execute on function public.calculate_hr_incentive_preview(text, uuid, text, numeric, date, numeric) to authenticated;
grant execute on function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean, numeric) to authenticated;

notify pgrst, 'reload schema';

commit;
