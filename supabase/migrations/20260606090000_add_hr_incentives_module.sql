begin;

create table if not exists public.hr_incentive_allowed_job_titles (
  id uuid primary key default gen_random_uuid(),
  job_title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint hr_incentive_allowed_job_titles_unique unique (job_title)
);

create table if not exists public.hr_incentive_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  calculation_basis text not null default 'fixed'
    check (calculation_basis in ('fixed', 'per_hour')),
  requires_replacement boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint hr_incentive_types_code_format check (code = lower(code))
);

create table if not exists public.hr_incentive_rate_rules (
  id uuid primary key default gen_random_uuid(),
  incentive_type_id uuid not null references public.hr_incentive_types (id) on delete cascade,
  contract_code text null,
  job_title text null,
  amount numeric(12,2) not null check (amount >= 0),
  priority integer not null default 100,
  valid_from date null,
  valid_to date null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint hr_incentive_rate_rules_valid_range check (
    valid_to is null or valid_from is null or valid_to >= valid_from
  )
);

create table if not exists public.hr_incentive_requests (
  id uuid primary key default gen_random_uuid(),
  folio bigint generated always as identity unique,
  employee_buk_employee_id text not null,
  employee_document_type text not null default 'rut',
  employee_document_number text not null,
  employee_full_name text not null,
  employee_job_title text not null,
  primary_contract_code text null,
  primary_area_name text null,
  selected_contract_code text not null,
  selected_area_name text not null,
  selected_area_code text null,
  incentive_type_id uuid not null references public.hr_incentive_types (id),
  incentive_type_name text not null,
  requires_replacement boolean not null default false,
  replacement_buk_employee_id text null,
  replacement_document_number text null,
  replacement_full_name text null,
  motive text null,
  description text null,
  service_date timestamptz not null,
  duration_hours numeric(10,2) null check (duration_hours is null or duration_hours > 0),
  period_code text not null,
  calculation_basis text not null check (calculation_basis in ('fixed', 'per_hour')),
  rate_rule_id uuid null references public.hr_incentive_rate_rules (id),
  rate_rule_amount numeric(12,2) not null check (rate_rule_amount >= 0),
  calculated_amount numeric(12,2) not null check (calculated_amount >= 0),
  status text not null default 'P'
    check (status in ('P', 'E', 'R', 'F', 'C')),
  created_by uuid not null,
  cancelled_at timestamptz null,
  cancelled_by uuid null,
  cancellation_comment text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint hr_incentive_requests_period_code_format check (period_code ~ '^[0-9]{6}$')
);

create table if not exists public.hr_incentive_request_history (
  id bigint generated always as identity primary key,
  incentive_request_id uuid not null references public.hr_incentive_requests (id) on delete cascade,
  action_type text not null,
  actor_user_id uuid null,
  comment text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_hr_incentive_rate_rules_type_active
  on public.hr_incentive_rate_rules (incentive_type_id, is_active, priority);

create index if not exists idx_hr_incentive_requests_period_status
  on public.hr_incentive_requests (period_code, status, service_date desc);

create index if not exists idx_hr_incentive_requests_employee_document
  on public.hr_incentive_requests (employee_document_number, created_at desc);

drop trigger if exists trg_hr_incentive_allowed_job_titles_set_updated_at on public.hr_incentive_allowed_job_titles;
create trigger trg_hr_incentive_allowed_job_titles_set_updated_at
before update on public.hr_incentive_allowed_job_titles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_hr_incentive_types_set_updated_at on public.hr_incentive_types;
create trigger trg_hr_incentive_types_set_updated_at
before update on public.hr_incentive_types
for each row
execute function public.set_updated_at();

drop trigger if exists trg_hr_incentive_rate_rules_set_updated_at on public.hr_incentive_rate_rules;
create trigger trg_hr_incentive_rate_rules_set_updated_at
before update on public.hr_incentive_rate_rules
for each row
execute function public.set_updated_at();

drop trigger if exists trg_hr_incentive_requests_set_updated_at on public.hr_incentive_requests;
create trigger trg_hr_incentive_requests_set_updated_at
before update on public.hr_incentive_requests
for each row
execute function public.set_updated_at();

alter table public.hr_incentive_allowed_job_titles enable row level security;
alter table public.hr_incentive_types enable row level security;
alter table public.hr_incentive_rate_rules enable row level security;
alter table public.hr_incentive_requests enable row level security;
alter table public.hr_incentive_request_history enable row level security;

drop policy if exists hr_incentive_allowed_job_titles_no_direct_access on public.hr_incentive_allowed_job_titles;
create policy hr_incentive_allowed_job_titles_no_direct_access
on public.hr_incentive_allowed_job_titles
for all
to authenticated
using (false)
with check (false);

drop policy if exists hr_incentive_types_no_direct_access on public.hr_incentive_types;
create policy hr_incentive_types_no_direct_access
on public.hr_incentive_types
for all
to authenticated
using (false)
with check (false);

drop policy if exists hr_incentive_rate_rules_no_direct_access on public.hr_incentive_rate_rules;
create policy hr_incentive_rate_rules_no_direct_access
on public.hr_incentive_rate_rules
for all
to authenticated
using (false)
with check (false);

drop policy if exists hr_incentive_requests_no_direct_access on public.hr_incentive_requests;
create policy hr_incentive_requests_no_direct_access
on public.hr_incentive_requests
for all
to authenticated
using (false)
with check (false);

drop policy if exists hr_incentive_request_history_no_direct_access on public.hr_incentive_request_history;
create policy hr_incentive_request_history_no_direct_access
on public.hr_incentive_request_history
for all
to authenticated
using (false)
with check (false);

create or replace function public.user_can_manage_hr_incentives(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    p_user_id is not null
    and (
      public.user_is_admin(p_user_id)
      or public.user_can_access_module(p_user_id, 'recursos_humanos')
    );
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
          'amount', rr.amount,
          'priority', rr.priority,
          'valid_from', rr.valid_from,
          'valid_to', rr.valid_to,
          'is_active', rr.is_active,
          'created_at', rr.created_at
        )
        order by rr.is_active desc, it.name, rr.priority asc, rr.contract_code nulls last, rr.job_title nulls last
      )
      from public.hr_incentive_rate_rules rr
      join public.hr_incentive_types it
        on it.id = rr.incentive_type_id
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.add_hr_incentive_allowed_job_title(p_job_title text)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_job_title text := trim(coalesce(p_job_title, ''));
  result_id uuid;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para administrar incentivos';
  end if;

  if normalized_job_title = '' then
    raise exception 'Debe indicar un cargo BUK válido';
  end if;

  insert into public.hr_incentive_allowed_job_titles (job_title)
  values (normalized_job_title)
  on conflict (job_title)
  do update
     set is_active = true,
         updated_at = timezone('utc', now())
  returning id into result_id;

  return result_id;
end;
$function$;

create or replace function public.set_hr_incentive_allowed_job_title_status(
  p_job_title_id uuid,
  p_is_active boolean
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

  update public.hr_incentive_allowed_job_titles
     set is_active = p_is_active
   where id = p_job_title_id;

  if not found then
    raise exception 'Cargo elegible no encontrado';
  end if;
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
    requires_replacement
  )
  values (
    normalized_code,
    normalized_name,
    p_calculation_basis,
    coalesce(p_requires_replacement, false)
  )
  on conflict (code)
  do update
     set name = excluded.name,
         calculation_basis = excluded.calculation_basis,
         requires_replacement = excluded.requires_replacement,
         is_active = true,
         updated_at = timezone('utc', now())
  returning id into result_id;

  return result_id;
end;
$function$;

create or replace function public.set_hr_incentive_type_status(
  p_type_id uuid,
  p_is_active boolean
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
     set is_active = p_is_active
   where id = p_type_id;

  if not found then
    raise exception 'Tipo de incentivo no encontrado';
  end if;
end;
$function$;

create or replace function public.add_hr_incentive_rate_rule(
  p_incentive_type_id uuid,
  p_amount numeric,
  p_contract_code text default null,
  p_job_title text default null,
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
  result_id uuid;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para administrar incentivos';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'Debe indicar un monto válido para la regla';
  end if;

  if p_valid_from is not null and p_valid_to is not null and p_valid_to < p_valid_from then
    raise exception 'El rango de vigencia de la regla no es válido';
  end if;

  insert into public.hr_incentive_rate_rules (
    incentive_type_id,
    amount,
    contract_code,
    job_title,
    priority,
    valid_from,
    valid_to
  )
  values (
    p_incentive_type_id,
    p_amount,
    nullif(trim(coalesce(p_contract_code, '')), ''),
    nullif(trim(coalesce(p_job_title, '')), ''),
    coalesce(p_priority, 100),
    p_valid_from,
    p_valid_to
  )
  returning id into result_id;

  return result_id;
end;
$function$;

create or replace function public.set_hr_incentive_rate_rule_status(
  p_rule_id uuid,
  p_is_active boolean
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

  update public.hr_incentive_rate_rules
     set is_active = p_is_active
   where id = p_rule_id;

  if not found then
    raise exception 'Regla de monto no encontrada';
  end if;
end;
$function$;

create or replace function public.search_hr_incentive_eligible_workers(
  p_search text default null,
  p_limit integer default 20
)
returns table (
  buk_employee_id text,
  full_name text,
  document_number text,
  job_title text,
  contract_code text,
  area_name text,
  display_label text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  safe_limit integer := greatest(1, least(coalesce(p_limit, 20), 30));
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para consultar trabajadores elegibles';
  end if;

  return query
  with eligible_titles as (
    select upper(trim(job_title)) as job_title
    from public.hr_incentive_allowed_job_titles
    where is_active = true
  ),
  active_workers as (
    select
      e.buk_employee_id,
      e.full_name,
      coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
      coalesce(
        nullif(trim(e.job_title), ''),
        nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
        nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
        nullif(trim(e.raw_payload ->> 'job_title'), '')
      ) as resolved_job_title,
      nullif(trim(e.contract_code), '') as contract_code,
      nullif(trim(e.area_name), '') as area_name
    from public.employees_active_current e
  )
  select
    aw.buk_employee_id,
    aw.full_name,
    aw.document_number,
    aw.resolved_job_title as job_title,
    aw.contract_code,
    aw.area_name,
    concat_ws(
      ' | ',
      coalesce(aw.document_number, 'Sin RUT'),
      coalesce(aw.resolved_job_title, 'Sin cargo'),
      aw.full_name,
      coalesce(aw.area_name, aw.contract_code, 'Sin contrato')
    ) as display_label
  from active_workers aw
  join eligible_titles et
    on upper(trim(coalesce(aw.resolved_job_title, ''))) = et.job_title
  where
    normalized_search = ''
    or lower(
      concat_ws(
        ' ',
        aw.full_name,
        coalesce(aw.document_number, ''),
        coalesce(aw.resolved_job_title, ''),
        coalesce(aw.contract_code, ''),
        coalesce(aw.area_name, '')
      )
    ) like '%' || normalized_search || '%'
  order by aw.full_name
  limit safe_limit;
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

  return jsonb_build_object(
    'worker', jsonb_build_object(
      'buk_employee_id', worker_row.buk_employee_id,
      'full_name', worker_row.full_name,
      'document_number', worker_row.document_number,
      'document_type', worker_row.document_type,
      'job_title', worker_row.job_title,
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
  order by
    case when rr.contract_code is not null then 0 else 1 end,
    case when rr.job_title is not null then 0 else 1 end,
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
  resolved_service_date date := coalesce(p_service_date, current_date);
  rule_row record;
  calculated_amount numeric(12,2);
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para calcular incentivos';
  end if;

  worker_payload := public.get_hr_incentive_worker_context(p_buk_employee_id);
  worker_job_title := worker_payload -> 'worker' ->> 'job_title';

  select *
    into rule_row
  from public.resolve_hr_incentive_rate_rule(
    p_incentive_type_id,
    worker_job_title,
    p_selected_contract_code,
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
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para anular incentivos';
  end if;

  update public.hr_incentive_requests
     set status = 'C',
         cancelled_at = timezone('utc', now()),
         cancelled_by = current_user_id,
         cancellation_comment = nullif(trim(coalesce(p_comment, '')), '')
   where id = p_request_id
     and status <> 'C';

  if not found then
    raise exception 'Incentivo no encontrado o ya anulado';
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
    nullif(trim(coalesce(p_comment, '')), '')
  );
end;
$function$;

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
  employee_full_name text,
  employee_document_number text,
  replacement_full_name text,
  replacement_document_number text,
  motive text,
  description text,
  incentive_type_name text,
  calculated_amount numeric,
  period_code text,
  selected_area_name text,
  selected_contract_code text,
  created_at timestamptz,
  service_date timestamptz,
  duration_hours numeric,
  requester_name text,
  status text,
  current_flow_user text,
  cancellation_comment text
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
    ir.id,
    ir.folio,
    ir.employee_full_name,
    ir.employee_document_number,
    ir.replacement_full_name,
    ir.replacement_document_number,
    ir.motive,
    ir.description,
    ir.incentive_type_name,
    ir.calculated_amount,
    ir.period_code,
    ir.selected_area_name,
    ir.selected_contract_code,
    ir.created_at,
    ir.service_date,
    ir.duration_hours,
    coalesce(p.full_name, p.email, 'Usuario no disponible') as requester_name,
    ir.status,
    null::text as current_flow_user,
    ir.cancellation_comment
  from public.hr_incentive_requests ir
  left join public.profiles p
    on p.id = ir.created_by
  where
    (p_period_code is null or trim(p_period_code) = '' or ir.period_code = trim(p_period_code))
    and (normalized_status = 'A' or ir.status = normalized_status)
    and (p_contract_code is null or trim(p_contract_code) = '' or ir.selected_contract_code = trim(p_contract_code))
    and (p_type_id is null or ir.incentive_type_id = p_type_id)
    and (p_service_date_until is null or ir.service_date::date <= p_service_date_until)
    and (
      normalized_search = ''
      or lower(
        concat_ws(
          ' ',
          ir.employee_full_name,
          coalesce(ir.employee_document_number, ''),
          coalesce(ir.replacement_full_name, ''),
          coalesce(ir.selected_area_name, ''),
          coalesce(ir.selected_contract_code, ''),
          coalesce(ir.incentive_type_name, '')
        )
      ) like '%' || normalized_search || '%'
    )
  order by ir.created_at desc, ir.folio desc;
end;
$function$;

insert into public.hr_incentive_types (
  code,
  name,
  calculation_basis,
  requires_replacement
)
values
  ('sobretiempo', 'Por sobretiempo (compensacion Horas extras)', 'per_hour', false),
  ('reemplazo_licencia_medica', 'Por Reemplazo por licencia medica', 'fixed', true),
  ('reemplazo_vacaciones_permisos', 'Reemplazo por vacaciones y/o permisos', 'fixed', true),
  ('inasistencia_trabajador', 'Por Inasistencia del Trabajador', 'fixed', true),
  ('contingencia', 'Por Contingencia', 'fixed', false)
on conflict (code) do nothing;

revoke all on table public.hr_incentive_allowed_job_titles from public, anon, authenticated;
revoke all on table public.hr_incentive_types from public, anon, authenticated;
revoke all on table public.hr_incentive_rate_rules from public, anon, authenticated;
revoke all on table public.hr_incentive_requests from public, anon, authenticated;
revoke all on table public.hr_incentive_request_history from public, anon, authenticated;

revoke all on function public.user_can_manage_hr_incentives(uuid) from public, anon, authenticated;
revoke all on function public.get_hr_incentive_setup_catalogs() from public, anon, authenticated;
revoke all on function public.add_hr_incentive_allowed_job_title(text) from public, anon, authenticated;
revoke all on function public.set_hr_incentive_allowed_job_title_status(uuid, boolean) from public, anon, authenticated;
revoke all on function public.add_hr_incentive_type(text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.set_hr_incentive_type_status(uuid, boolean) from public, anon, authenticated;
revoke all on function public.add_hr_incentive_rate_rule(uuid, numeric, text, text, integer, date, date) from public, anon, authenticated;
revoke all on function public.set_hr_incentive_rate_rule_status(uuid, boolean) from public, anon, authenticated;
revoke all on function public.search_hr_incentive_eligible_workers(text, integer) from public, anon, authenticated;
revoke all on function public.get_hr_incentive_worker_context(text) from public, anon, authenticated;
revoke all on function public.resolve_hr_incentive_rate_rule(uuid, text, text, date) from public, anon, authenticated;
revoke all on function public.calculate_hr_incentive_preview(text, uuid, text, numeric, date) from public, anon, authenticated;
revoke all on function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text) from public, anon, authenticated;
revoke all on function public.cancel_hr_incentive_request(uuid, text) from public, anon, authenticated;
revoke all on function public.get_hr_incentive_requests(text, text, text, text, uuid, date) from public, anon, authenticated;

grant execute on function public.user_can_manage_hr_incentives(uuid) to authenticated;
grant execute on function public.get_hr_incentive_setup_catalogs() to authenticated;
grant execute on function public.add_hr_incentive_allowed_job_title(text) to authenticated;
grant execute on function public.set_hr_incentive_allowed_job_title_status(uuid, boolean) to authenticated;
grant execute on function public.add_hr_incentive_type(text, text, text, boolean) to authenticated;
grant execute on function public.set_hr_incentive_type_status(uuid, boolean) to authenticated;
grant execute on function public.add_hr_incentive_rate_rule(uuid, numeric, text, text, integer, date, date) to authenticated;
grant execute on function public.set_hr_incentive_rate_rule_status(uuid, boolean) to authenticated;
grant execute on function public.search_hr_incentive_eligible_workers(text, integer) to authenticated;
grant execute on function public.get_hr_incentive_worker_context(text) to authenticated;
grant execute on function public.resolve_hr_incentive_rate_rule(uuid, text, text, date) to authenticated;
grant execute on function public.calculate_hr_incentive_preview(text, uuid, text, numeric, date) to authenticated;
grant execute on function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text) to authenticated;
grant execute on function public.cancel_hr_incentive_request(uuid, text) to authenticated;
grant execute on function public.get_hr_incentive_requests(text, text, text, text, uuid, date) to authenticated;

notify pgrst, 'reload schema';

commit;
