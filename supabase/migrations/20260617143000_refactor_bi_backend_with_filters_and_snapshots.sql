begin;

update public.app_modules
set
  route = '/recursos-humanos/acreditacion',
  updated_at = timezone('utc', now())
where code = 'acreditacion_personas'
  and route <> '/recursos-humanos/acreditacion';

do $$
begin
  create extension if not exists pg_cron schema extensions;
exception
  when others then
    raise notice 'No fue posible habilitar pg_cron: %', sqlerrm;
end
$$;

create table if not exists public.buk_employees_daily_snapshot (
  snapshot_date date not null,
  buk_employee_id text not null,
  full_name text not null,
  email text,
  job_title text,
  contract_code text,
  area_name text,
  area_code text,
  document_number text,
  document_type text,
  birth_date date,
  hire_date date,
  city_name text,
  region_name text,
  status text,
  is_active boolean not null default true,
  raw_payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default timezone('utc', now()),
  primary key (snapshot_date, buk_employee_id)
);

create index if not exists idx_buk_employee_snapshot_date_active
  on public.buk_employees_daily_snapshot (snapshot_date desc, is_active);

create index if not exists idx_buk_employee_snapshot_contract
  on public.buk_employees_daily_snapshot (snapshot_date desc, contract_code, area_name);

create index if not exists idx_buk_employee_snapshot_job
  on public.buk_employees_daily_snapshot (snapshot_date desc, job_title);

create index if not exists idx_buk_employee_snapshot_city
  on public.buk_employees_daily_snapshot (snapshot_date desc, region_name, city_name);

alter table public.buk_employees_daily_snapshot enable row level security;

drop policy if exists "buk_employee_snapshot_select_authenticated" on public.buk_employees_daily_snapshot;
create policy "buk_employee_snapshot_select_authenticated"
on public.buk_employees_daily_snapshot
for select
to authenticated
using (
  public.user_can_access_module(auth.uid(), 'bi_analytics')
  or public.user_is_admin(auth.uid())
);

grant select on public.buk_employees_daily_snapshot to authenticated;

create or replace function public.current_request_has_service_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

create or replace function public.user_can_access_bi_analytics(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_can_access_module(p_user_id, 'bi_analytics')
    or public.user_is_admin(p_user_id);
$$;

create or replace function public.normalize_bi_text_array(p_values text[])
returns text[]
language sql
immutable
as $$
  select coalesce(
    array_agg(trim(value))
      filter (where nullif(trim(coalesce(value, '')), '') is not null),
    '{}'::text[]
  )
  from unnest(coalesce(p_values, '{}'::text[])) as value;
$$;

create or replace function public.parse_bi_date_text(p_value text)
returns date
language plpgsql
immutable
as $function$
declare
  raw_value text := nullif(trim(coalesce(p_value, '')), '');
  iso_match text[];
  slash_match text[];
begin
  if raw_value is null then
    return null;
  end if;

  iso_match := regexp_match(raw_value, '^(\d{4})-(\d{2})-(\d{2})');
  if iso_match is not null then
    return make_date(iso_match[1]::integer, iso_match[2]::integer, iso_match[3]::integer);
  end if;

  slash_match := regexp_match(raw_value, '^(\d{2})\/(\d{2})\/(\d{4})$');
  if slash_match is not null then
    return make_date(slash_match[3]::integer, slash_match[2]::integer, slash_match[1]::integer);
  end if;

  return null;
end;
$function$;

create or replace function public.extract_buk_employee_hire_date(p_raw_payload jsonb)
returns date
language sql
stable
as $$
  select public.parse_bi_date_text(
    coalesce(
      nullif(trim(coalesce(p_raw_payload ->> 'hire_date', '')), ''),
      nullif(trim(coalesce(p_raw_payload ->> 'hired_at', '')), ''),
      nullif(trim(coalesce(p_raw_payload ->> 'active_since', '')), ''),
      nullif(trim(coalesce(p_raw_payload ->> 'company_entry_date', '')), ''),
      nullif(trim(coalesce(p_raw_payload ->> 'start_date', '')), ''),
      nullif(trim(coalesce(p_raw_payload #>> '{current_job,start_date}', '')), ''),
      nullif(trim(coalesce(p_raw_payload #>> '{current_job,active_since}', '')), ''),
      nullif(trim(coalesce(p_raw_payload #>> '{current_job,company_entry_date}', '')), ''),
      nullif(trim(coalesce(p_raw_payload #>> '{current_job,custom_attributes,Fecha de ingreso}', '')), ''),
      nullif(trim(coalesce(p_raw_payload #>> '{current_job,custom_attributes,Fecha Ingreso}', '')), '')
    )
  );
$$;

create or replace function public.extract_buk_employee_city_name(p_raw_payload jsonb)
returns text
language sql
stable
as $$
  select nullif(trim(coalesce(
    p_raw_payload ->> 'current_city',
    p_raw_payload ->> 'city',
    p_raw_payload ->> 'district_or_commune',
    p_raw_payload #>> '{current_address,city}',
    p_raw_payload #>> '{current_address,commune}',
    p_raw_payload #>> '{address,city}',
    p_raw_payload #>> '{address,commune}',
    p_raw_payload #>> '{address,district}',
    p_raw_payload #>> '{personal_information,city}',
    p_raw_payload #>> '{personal_information,commune}',
    p_raw_payload #>> '{current_job,location,name}'
  )), '');
$$;

create or replace function public.extract_buk_employee_region_name(p_raw_payload jsonb)
returns text
language sql
stable
as $$
  select nullif(trim(coalesce(
    p_raw_payload ->> 'region',
    p_raw_payload #>> '{current_address,region}',
    p_raw_payload #>> '{address,region}',
    p_raw_payload #>> '{personal_information,region}',
    p_raw_payload #>> '{current_job,location,region}',
    p_raw_payload #>> '{current_job,location,parent_name}'
  )), '');
$$;

create or replace function public.normalize_bi_period_code(p_period_code text default null)
returns text
language plpgsql
stable
as $function$
declare
  normalized text := regexp_replace(coalesce(p_period_code, ''), '\D', '', 'g');
begin
  if normalized ~ '^\d{6}$' then
    return normalized;
  end if;

  return to_char(current_date, 'YYYYMM');
end;
$function$;

create or replace function public.get_bi_period_context(p_period_code text default null)
returns table (
  period_code text,
  month_start date,
  month_end date,
  is_current_period boolean,
  reference_date date
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  resolved_period text := public.normalize_bi_period_code(p_period_code);
  resolved_month_start date;
  resolved_month_end date;
  resolved_is_current boolean;
  latest_snapshot_date date;
begin
  resolved_month_start := to_date(resolved_period || '01', 'YYYYMMDD');
  resolved_month_end := (resolved_month_start + interval '1 month - 1 day')::date;
  resolved_is_current := resolved_period = to_char(current_date, 'YYYYMM');

  select max(snapshot.snapshot_date)
    into latest_snapshot_date
  from public.buk_employees_daily_snapshot snapshot
  where snapshot.snapshot_date between resolved_month_start and resolved_month_end;

  return query
  select
    resolved_period,
    resolved_month_start,
    resolved_month_end,
    resolved_is_current,
    coalesce(
      latest_snapshot_date,
      case when resolved_is_current then current_date else resolved_month_end end
    );
end;
$function$;

create or replace function public.capture_buk_employee_daily_snapshot(p_snapshot_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  target_snapshot_date date := coalesce(p_snapshot_date, current_date);
  inserted_count integer := 0;
begin
  if not public.current_request_has_service_role()
     and not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para capturar snapshot diario BUK';
  end if;

  insert into public.buk_employees_daily_snapshot (
    snapshot_date,
    buk_employee_id,
    full_name,
    email,
    job_title,
    contract_code,
    area_name,
    area_code,
    document_number,
    document_type,
    birth_date,
    hire_date,
    city_name,
    region_name,
    status,
    is_active,
    raw_payload
  )
  select
    target_snapshot_date,
    e.buk_employee_id,
    e.full_name,
    e.email,
    coalesce(
      nullif(trim(e.job_title), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
      nullif(trim(e.raw_payload ->> 'job_title'), '')
    ) as job_title,
    nullif(trim(e.contract_code), '') as contract_code,
    nullif(trim(e.area_name), '') as area_name,
    nullif(trim(e.area_code), '') as area_code,
    nullif(trim(e.document_number), '') as document_number,
    coalesce(nullif(trim(e.document_type), ''), 'rut') as document_type,
    e.birth_date,
    public.extract_buk_employee_hire_date(e.raw_payload) as hire_date,
    public.extract_buk_employee_city_name(e.raw_payload) as city_name,
    public.extract_buk_employee_region_name(e.raw_payload) as region_name,
    e.status,
    e.is_active,
    e.raw_payload
  from public.employees e
  on conflict (snapshot_date, buk_employee_id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    job_title = excluded.job_title,
    contract_code = excluded.contract_code,
    area_name = excluded.area_name,
    area_code = excluded.area_code,
    document_number = excluded.document_number,
    document_type = excluded.document_type,
    birth_date = excluded.birth_date,
    hire_date = excluded.hire_date,
    city_name = excluded.city_name,
    region_name = excluded.region_name,
    status = excluded.status,
    is_active = excluded.is_active,
    raw_payload = excluded.raw_payload,
    captured_at = timezone('utc', now());

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'capture-buk-employee-daily-snapshot';
    exception
      when undefined_table then
        null;
    end;

    perform cron.schedule(
      'capture-buk-employee-daily-snapshot',
      '59 23 * * *',
      $cron$select public.capture_buk_employee_daily_snapshot();$cron$
    );
  end if;
exception
  when others then
    raise notice 'No fue posible programar pg_cron para snapshot BUK: %', sqlerrm;
end
$$;

create or replace function public.get_bi_employee_population(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  period_code text,
  reference_date date,
  buk_employee_id text,
  full_name text,
  contract_code text,
  area_name text,
  job_title text,
  birth_date date,
  hire_date date,
  city_name text,
  region_name text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  period_context record;
  normalized_contracts text[] := public.normalize_bi_text_array(p_contract_codes);
  normalized_jobs text[] := public.normalize_bi_text_array(p_job_titles);
begin
  select * into period_context
  from public.get_bi_period_context(p_period_code);

  if period_context.is_current_period then
    return query
    select
      period_context.period_code,
      period_context.reference_date,
      e.buk_employee_id,
      e.full_name,
      coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO') as contract_code,
      coalesce(nullif(trim(e.area_name), ''), 'SIN AREA') as area_name,
      coalesce(
        nullif(trim(e.job_title), ''),
        nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
        nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
        nullif(trim(e.raw_payload ->> 'job_title'), ''),
        'SIN CARGO'
      ) as job_title,
      e.birth_date,
      public.extract_buk_employee_hire_date(e.raw_payload) as hire_date,
      coalesce(public.extract_buk_employee_city_name(e.raw_payload), 'SIN CIUDAD') as city_name,
      coalesce(public.extract_buk_employee_region_name(e.raw_payload), 'SIN REGION') as region_name
    from public.employees_active_current e
    where (
      coalesce(array_length(normalized_contracts, 1), 0) = 0
      or coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO') = any(normalized_contracts)
    )
      and (
        coalesce(array_length(normalized_jobs, 1), 0) = 0
        or coalesce(
          nullif(trim(e.job_title), ''),
          nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
          nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
          nullif(trim(e.raw_payload ->> 'job_title'), ''),
          'SIN CARGO'
        ) = any(normalized_jobs)
      );
  else
    return query
    with latest_snapshot as (
      select max(snapshot.snapshot_date) as snapshot_date
      from public.buk_employees_daily_snapshot snapshot
      where snapshot.snapshot_date between period_context.month_start and period_context.month_end
    )
    select
      period_context.period_code,
      period_context.reference_date,
      snapshot.buk_employee_id,
      snapshot.full_name,
      coalesce(nullif(trim(snapshot.contract_code), ''), 'SIN CONTRATO') as contract_code,
      coalesce(nullif(trim(snapshot.area_name), ''), 'SIN AREA') as area_name,
      coalesce(nullif(trim(snapshot.job_title), ''), 'SIN CARGO') as job_title,
      snapshot.birth_date,
      snapshot.hire_date,
      coalesce(nullif(trim(snapshot.city_name), ''), 'SIN CIUDAD') as city_name,
      coalesce(nullif(trim(snapshot.region_name), ''), 'SIN REGION') as region_name
    from public.buk_employees_daily_snapshot snapshot
    join latest_snapshot ls
      on ls.snapshot_date = snapshot.snapshot_date
    where snapshot.is_active = true
      and (
        coalesce(array_length(normalized_contracts, 1), 0) = 0
        or coalesce(nullif(trim(snapshot.contract_code), ''), 'SIN CONTRATO') = any(normalized_contracts)
      )
      and (
        coalesce(array_length(normalized_jobs, 1), 0) = 0
        or coalesce(nullif(trim(snapshot.job_title), ''), 'SIN CARGO') = any(normalized_jobs)
      );
  end if;
end;
$function$;

create or replace function public.get_bi_recruitment_contract_filter_candidates(p_contract_codes text[] default null)
returns text[]
language sql
immutable
as $$
  select public.normalize_bi_text_array(p_contract_codes);
$$;

create or replace function public.get_bi_workforce_overview(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  total_active_employees bigint,
  total_contracts bigint,
  on_vacation_today bigint,
  on_medical_leave_today bigint,
  other_absences_today bigint,
  hired_this_month bigint,
  open_recruitment_cases bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_contracts text[] := public.normalize_bi_text_array(p_contract_codes);
  normalized_jobs text[] := public.normalize_bi_text_array(p_job_titles);
  period_context record;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  select * into period_context
  from public.get_bi_period_context(p_period_code);

  return query
  with population as (
    select * from public.get_bi_employee_population(p_period_code, p_contract_codes, p_job_titles)
  ),
  absences_today as (
    select
      hre.exception_type,
      count(distinct hre.employee_buk_employee_id) as total_persons
    from public.hr_roster_exceptions hre
    join population p
      on p.buk_employee_id = hre.employee_buk_employee_id
    where hre.exception_date = period_context.reference_date
      and hre.is_active = true
    group by hre.exception_type
  ),
  recruitment_cases_filtered as (
    select rc.id
    from public.recruitment_cases rc
    where rc.status = 'open'
      and (
        coalesce(array_length(normalized_contracts, 1), 0) = 0
        or coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO') = any(normalized_contracts)
      )
      and (
        coalesce(array_length(normalized_jobs, 1), 0) = 0
        or coalesce(nullif(trim(rc.job_position_name), ''), 'SIN CARGO') = any(normalized_jobs)
      )
  )
  select
    count(*)::bigint as total_active_employees,
    count(distinct p.contract_code)::bigint as total_contracts,
    coalesce((select total_persons from absences_today where exception_type = 'vacation'), 0)::bigint as on_vacation_today,
    coalesce((select total_persons from absences_today where exception_type = 'medical_leave'), 0)::bigint as on_medical_leave_today,
    coalesce((
      select sum(total_persons)
      from absences_today
      where exception_type in ('absent', 'administrative_leave', 'union_leave')
    ), 0)::bigint as other_absences_today,
    count(*) filter (
      where p.hire_date between period_context.month_start and period_context.month_end
    )::bigint as hired_this_month,
    (select count(*)::bigint from recruitment_cases_filtered) as open_recruitment_cases
  from population p;
end;
$function$;

create or replace function public.get_bi_headcount_by_contract(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  contract_code text,
  area_name text,
  headcount bigint,
  with_birth_date bigint,
  avg_age numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  period_context record;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  select * into period_context
  from public.get_bi_period_context(p_period_code);

  return query
  with population as (
    select * from public.get_bi_employee_population(p_period_code, p_contract_codes, p_job_titles)
  )
  select
    p.contract_code,
    p.area_name,
    count(*)::bigint as headcount,
    count(*) filter (where p.birth_date is not null)::bigint as with_birth_date,
    round(
      avg(extract(year from age(period_context.reference_date, p.birth_date)))
        filter (where p.birth_date is not null),
      1
    ) as avg_age
  from population p
  group by p.contract_code, p.area_name
  order by headcount desc, p.contract_code asc, p.area_name asc;
end;
$function$;

create or replace function public.get_bi_headcount_by_job_title(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  contract_code text,
  job_title text,
  headcount bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  return query
  with population as (
    select * from public.get_bi_employee_population(p_period_code, p_contract_codes, p_job_titles)
  )
  select
    p.contract_code,
    p.job_title,
    count(*)::bigint as headcount
  from population p
  group by p.contract_code, p.job_title
  order by headcount desc, p.contract_code asc, p.job_title asc;
end;
$function$;

create or replace function public.get_bi_headcount_by_city(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  region_name text,
  city_name text,
  headcount bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  return query
  with population as (
    select * from public.get_bi_employee_population(p_period_code, p_contract_codes, p_job_titles)
  )
  select
    p.region_name,
    p.city_name,
    count(*)::bigint as headcount
  from population p
  group by p.region_name, p.city_name
  order by headcount desc, p.region_name asc, p.city_name asc;
end;
$function$;

create or replace function public.get_bi_age_distribution(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  contract_code text,
  age_range text,
  headcount bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  period_context record;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  select * into period_context from public.get_bi_period_context(p_period_code);

  return query
  with population as (
    select * from public.get_bi_employee_population(p_period_code, p_contract_codes, p_job_titles)
  )
  select
    p.contract_code,
    case
      when p.birth_date is null then 'Desconocido'
      when extract(year from age(period_context.reference_date, p.birth_date)) < 20 then '< 20'
      when extract(year from age(period_context.reference_date, p.birth_date)) < 30 then '20–29'
      when extract(year from age(period_context.reference_date, p.birth_date)) < 40 then '30–39'
      when extract(year from age(period_context.reference_date, p.birth_date)) < 50 then '40–49'
      when extract(year from age(period_context.reference_date, p.birth_date)) < 60 then '50–59'
      else '60+'
    end as age_range,
    count(*)::bigint as headcount
  from population p
  group by
    p.contract_code,
    case
      when p.birth_date is null then 'Desconocido'
      when extract(year from age(period_context.reference_date, p.birth_date)) < 20 then '< 20'
      when extract(year from age(period_context.reference_date, p.birth_date)) < 30 then '20–29'
      when extract(year from age(period_context.reference_date, p.birth_date)) < 40 then '30–39'
      when extract(year from age(period_context.reference_date, p.birth_date)) < 50 then '40–49'
      when extract(year from age(period_context.reference_date, p.birth_date)) < 60 then '50–59'
      else '60+'
    end
  order by p.contract_code asc, age_range asc;
end;
$function$;

create or replace function public.get_bi_exceptions_today(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  contract_code text,
  area_name text,
  exception_type text,
  exception_source text,
  total_persons bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  period_context record;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  select * into period_context from public.get_bi_period_context(p_period_code);

  return query
  with population as (
    select * from public.get_bi_employee_population(p_period_code, p_contract_codes, p_job_titles)
  )
  select
    p.contract_code,
    p.area_name,
    hre.exception_type,
    coalesce(hre.exception_source, 'manual') as exception_source,
    count(distinct hre.employee_buk_employee_id)::bigint as total_persons
  from public.hr_roster_exceptions hre
  join population p
    on p.buk_employee_id = hre.employee_buk_employee_id
  where hre.exception_date = period_context.reference_date
    and hre.is_active = true
  group by
    p.contract_code,
    p.area_name,
    hre.exception_type,
    coalesce(hre.exception_source, 'manual')
  order by total_persons desc, p.contract_code asc, p.area_name asc;
end;
$function$;

create or replace function public.get_bi_presence_summary_today(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  contract_code text,
  headcount bigint,
  absent_today bigint,
  present_today bigint,
  presence_pct numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  period_context record;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  select * into period_context from public.get_bi_period_context(p_period_code);

  return query
  with population as (
    select * from public.get_bi_employee_population(p_period_code, p_contract_codes, p_job_titles)
  ),
  absent as (
    select
      p.contract_code,
      count(distinct hre.employee_buk_employee_id)::bigint as absent_total
    from public.hr_roster_exceptions hre
    join population p
      on p.buk_employee_id = hre.employee_buk_employee_id
    where hre.exception_date = period_context.reference_date
      and hre.is_active = true
      and hre.exception_type in ('vacation', 'medical_leave', 'absent', 'administrative_leave', 'union_leave')
    group by p.contract_code
  )
  select
    p.contract_code,
    count(*)::bigint as headcount,
    coalesce(a.absent_total, 0)::bigint as absent_today,
    (count(*)::bigint - coalesce(a.absent_total, 0))::bigint as present_today,
    case
      when count(*) > 0 then round(((count(*) - coalesce(a.absent_total, 0))::numeric / count(*)::numeric) * 100, 1)
      else 0
    end as presence_pct
  from population p
  left join absent a
    on a.contract_code = p.contract_code
  group by p.contract_code, a.absent_total
  order by headcount desc, p.contract_code asc;
end;
$function$;

create or replace function public.get_bi_exceptions_monthly(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  contract_code text,
  month_start date,
  year_month text,
  exception_type text,
  exception_source text,
  total_days bigint,
  unique_employees bigint,
  fte_headcount_equivalent numeric,
  headcount_base bigint,
  absenteeism_pct numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  period_context record;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  select * into period_context from public.get_bi_period_context(p_period_code);

  return query
  with population as (
    select * from public.get_bi_employee_population(p_period_code, p_contract_codes, p_job_titles)
  ),
  base_headcount as (
    select
      p.contract_code,
      count(*)::bigint as headcount_base
    from population p
    group by p.contract_code
  ),
  monthly_absence_days_by_employee as (
    select
      p.contract_code,
      hre.employee_buk_employee_id,
      count(*)::integer as total_absence_days
    from public.hr_roster_exceptions hre
    join population p
      on p.buk_employee_id = hre.employee_buk_employee_id
    where hre.is_active = true
      and hre.exception_date between period_context.month_start and period_context.month_end
      and hre.exception_type in ('vacation', 'medical_leave', 'absent', 'administrative_leave', 'union_leave')
    group by p.contract_code, hre.employee_buk_employee_id
  ),
  equivalent_headcount as (
    select
      bh.contract_code,
      round(
        coalesce(sum(greatest(0, 30 - mad.total_absence_days)::numeric / 30), bh.headcount_base::numeric),
        4
      ) as fte_headcount_equivalent,
      bh.headcount_base,
      round(
        case
          when bh.headcount_base > 0 then
            (1 - (coalesce(sum(greatest(0, 30 - mad.total_absence_days)::numeric / 30), bh.headcount_base::numeric) / bh.headcount_base::numeric)) * 100
          else 0
        end,
        2
      ) as absenteeism_pct
    from base_headcount bh
    left join monthly_absence_days_by_employee mad
      on mad.contract_code = bh.contract_code
    group by bh.contract_code, bh.headcount_base
  ),
  grouped_exceptions as (
    select
      p.contract_code,
      period_context.month_start as month_start,
      to_char(period_context.month_start, 'YYYY-MM') as year_month,
      hre.exception_type,
      coalesce(hre.exception_source, 'manual') as exception_source,
      count(*)::bigint as total_days,
      count(distinct hre.employee_buk_employee_id)::bigint as unique_employees
    from public.hr_roster_exceptions hre
    join population p
      on p.buk_employee_id = hre.employee_buk_employee_id
    where hre.is_active = true
      and hre.exception_date between period_context.month_start and period_context.month_end
    group by
      p.contract_code,
      period_context.month_start,
      to_char(period_context.month_start, 'YYYY-MM'),
      hre.exception_type,
      coalesce(hre.exception_source, 'manual')
  )
  select
    ge.contract_code,
    ge.month_start,
    ge.year_month,
    ge.exception_type,
    ge.exception_source,
    ge.total_days,
    ge.unique_employees,
    eh.fte_headcount_equivalent,
    eh.headcount_base,
    eh.absenteeism_pct
  from grouped_exceptions ge
  join equivalent_headcount eh
    on eh.contract_code = ge.contract_code
  order by ge.month_start asc, ge.contract_code asc, ge.exception_type asc;
end;
$function$;

create or replace function public.get_bi_vacation_forecast(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  contract_code text,
  exception_date date,
  year_month text,
  vacationing_employees bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  period_context record;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  select * into period_context from public.get_bi_period_context(p_period_code);

  return query
  with population as (
    select * from public.get_bi_employee_population(p_period_code, p_contract_codes, p_job_titles)
  )
  select
    p.contract_code,
    hre.exception_date,
    to_char(hre.exception_date, 'YYYY-MM') as year_month,
    count(distinct hre.employee_buk_employee_id)::bigint as vacationing_employees
  from public.hr_roster_exceptions hre
  join population p
    on p.buk_employee_id = hre.employee_buk_employee_id
  where hre.is_active = true
    and hre.exception_type = 'vacation'
    and hre.exception_date between period_context.month_start and period_context.month_end
  group by p.contract_code, hre.exception_date, to_char(hre.exception_date, 'YYYY-MM')
  order by hre.exception_date asc, p.contract_code asc;
end;
$function$;

create or replace function public.get_bi_medical_leave_by_area(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  contract_code text,
  area_name text,
  month_start date,
  year_month text,
  medical_leave_days bigint,
  unique_employees bigint,
  fte_headcount_equivalent numeric,
  headcount_base bigint,
  absenteeism_pct numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  period_context record;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  select * into period_context from public.get_bi_period_context(p_period_code);

  return query
  with population as (
    select * from public.get_bi_employee_population(p_period_code, p_contract_codes, p_job_titles)
  ),
  base_headcount as (
    select
      p.contract_code,
      count(*)::bigint as headcount_base
    from population p
    group by p.contract_code
  ),
  monthly_absence_days_by_employee as (
    select
      p.contract_code,
      hre.employee_buk_employee_id,
      count(*)::integer as total_absence_days
    from public.hr_roster_exceptions hre
    join population p
      on p.buk_employee_id = hre.employee_buk_employee_id
    where hre.is_active = true
      and hre.exception_date between period_context.month_start and period_context.month_end
      and hre.exception_type in ('vacation', 'medical_leave', 'absent', 'administrative_leave', 'union_leave')
    group by p.contract_code, hre.employee_buk_employee_id
  ),
  equivalent_headcount as (
    select
      bh.contract_code,
      round(
        coalesce(sum(greatest(0, 30 - mad.total_absence_days)::numeric / 30), bh.headcount_base::numeric),
        4
      ) as fte_headcount_equivalent,
      bh.headcount_base,
      round(
        case
          when bh.headcount_base > 0 then
            (1 - (coalesce(sum(greatest(0, 30 - mad.total_absence_days)::numeric / 30), bh.headcount_base::numeric) / bh.headcount_base::numeric)) * 100
          else 0
        end,
        2
      ) as absenteeism_pct
    from base_headcount bh
    left join monthly_absence_days_by_employee mad
      on mad.contract_code = bh.contract_code
    group by bh.contract_code, bh.headcount_base
  )
  select
    p.contract_code,
    p.area_name,
    period_context.month_start,
    to_char(period_context.month_start, 'YYYY-MM') as year_month,
    count(*)::bigint as medical_leave_days,
    count(distinct hre.employee_buk_employee_id)::bigint as unique_employees,
    eh.fte_headcount_equivalent,
    eh.headcount_base,
    eh.absenteeism_pct
  from public.hr_roster_exceptions hre
  join population p
    on p.buk_employee_id = hre.employee_buk_employee_id
  join equivalent_headcount eh
    on eh.contract_code = p.contract_code
  where hre.is_active = true
    and hre.exception_type = 'medical_leave'
    and hre.exception_date between period_context.month_start and period_context.month_end
  group by
    p.contract_code,
    p.area_name,
    period_context.month_start,
    to_char(period_context.month_start, 'YYYY-MM'),
    eh.fte_headcount_equivalent,
    eh.headcount_base,
    eh.absenteeism_pct
  order by medical_leave_days desc, p.contract_code asc, p.area_name asc;
end;
$function$;

create or replace function public.get_bi_recruitment_pipeline(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  case_status text,
  stage_code text,
  contract_name text,
  job_position_name text,
  candidate_count bigint,
  selected_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_contracts text[] := public.normalize_bi_text_array(p_contract_codes);
  normalized_jobs text[] := public.normalize_bi_text_array(p_job_titles);
  period_context record;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  select * into period_context from public.get_bi_period_context(p_period_code);

  return query
  select
    rc.status as case_status,
    rcc.stage_code,
    coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO') as contract_name,
    coalesce(nullif(trim(rc.job_position_name), ''), 'SIN CARGO') as job_position_name,
    count(*)::bigint as candidate_count,
    count(*) filter (where rcc.is_selected = true)::bigint as selected_count
  from public.recruitment_case_candidates rcc
  join public.recruitment_cases rc
    on rc.id = rcc.recruitment_case_id
  where coalesce(rc.requested_entry_date, rc.created_at::date, rcc.created_at::date)
      between period_context.month_start and period_context.month_end
    and (
      coalesce(array_length(normalized_contracts, 1), 0) = 0
      or coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO') = any(normalized_contracts)
    )
    and (
      coalesce(array_length(normalized_jobs, 1), 0) = 0
      or coalesce(nullif(trim(rc.job_position_name), ''), 'SIN CARGO') = any(normalized_jobs)
    )
  group by
    rc.status,
    rcc.stage_code,
    coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO'),
    coalesce(nullif(trim(rc.job_position_name), ''), 'SIN CARGO')
  order by candidate_count desc, contract_name asc, job_position_name asc, rcc.stage_code asc;
end;
$function$;

create or replace function public.get_bi_hiring_velocity(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  contract_name text,
  month_start date,
  year_month text,
  hired_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_contracts text[] := public.normalize_bi_text_array(p_contract_codes);
  normalized_jobs text[] := public.normalize_bi_text_array(p_job_titles);
  period_context record;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  select * into period_context from public.get_bi_period_context(p_period_code);

  return query
  select
    coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO') as contract_name,
    date_trunc('month', rcc.hired_at)::date as month_start,
    to_char(rcc.hired_at, 'YYYY-MM') as year_month,
    count(*)::bigint as hired_count
  from public.recruitment_case_candidates rcc
  join public.recruitment_cases rc
    on rc.id = rcc.recruitment_case_id
  where rcc.hired_at is not null
    and rcc.hired_at::date between period_context.month_start and period_context.month_end
    and (
      coalesce(array_length(normalized_contracts, 1), 0) = 0
      or coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO') = any(normalized_contracts)
    )
    and (
      coalesce(array_length(normalized_jobs, 1), 0) = 0
      or coalesce(nullif(trim(rc.job_position_name), ''), 'SIN CARGO') = any(normalized_jobs)
    )
  group by
    coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO'),
    date_trunc('month', rcc.hired_at)::date,
    to_char(rcc.hired_at, 'YYYY-MM')
  order by month_start asc, contract_name asc;
end;
$function$;

revoke all on function public.current_request_has_service_role() from public, anon, authenticated;
revoke all on function public.user_can_access_bi_analytics(uuid) from public, anon;
grant execute on function public.user_can_access_bi_analytics(uuid) to authenticated;

revoke all on function public.normalize_bi_text_array(text[]) from public, anon, authenticated;
revoke all on function public.parse_bi_date_text(text) from public, anon, authenticated;
revoke all on function public.extract_buk_employee_hire_date(jsonb) from public, anon, authenticated;
revoke all on function public.extract_buk_employee_city_name(jsonb) from public, anon, authenticated;
revoke all on function public.extract_buk_employee_region_name(jsonb) from public, anon, authenticated;
revoke all on function public.normalize_bi_period_code(text) from public, anon, authenticated;

revoke all on function public.get_bi_period_context(text) from public, anon;
grant execute on function public.get_bi_period_context(text) to authenticated;

revoke all on function public.capture_buk_employee_daily_snapshot(date) from public, anon, authenticated;
grant execute on function public.capture_buk_employee_daily_snapshot(date) to authenticated, service_role;

revoke all on function public.get_bi_employee_population(text, text[], text[]) from public, anon, authenticated;
revoke all on function public.get_bi_recruitment_contract_filter_candidates(text[]) from public, anon, authenticated;

revoke all on function public.get_bi_workforce_overview(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_workforce_overview(text, text[], text[]) to authenticated;

revoke all on function public.get_bi_headcount_by_contract(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_headcount_by_contract(text, text[], text[]) to authenticated;

revoke all on function public.get_bi_headcount_by_job_title(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_headcount_by_job_title(text, text[], text[]) to authenticated;

revoke all on function public.get_bi_headcount_by_city(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_headcount_by_city(text, text[], text[]) to authenticated;

revoke all on function public.get_bi_age_distribution(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_age_distribution(text, text[], text[]) to authenticated;

revoke all on function public.get_bi_exceptions_today(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_exceptions_today(text, text[], text[]) to authenticated;

revoke all on function public.get_bi_presence_summary_today(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_presence_summary_today(text, text[], text[]) to authenticated;

revoke all on function public.get_bi_exceptions_monthly(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_exceptions_monthly(text, text[], text[]) to authenticated;

revoke all on function public.get_bi_vacation_forecast(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_vacation_forecast(text, text[], text[]) to authenticated;

revoke all on function public.get_bi_medical_leave_by_area(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_medical_leave_by_area(text, text[], text[]) to authenticated;

revoke all on function public.get_bi_recruitment_pipeline(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_recruitment_pipeline(text, text[], text[]) to authenticated;

revoke all on function public.get_bi_hiring_velocity(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_hiring_velocity(text, text[], text[]) to authenticated;

notify pgrst, 'reload schema';

commit;
