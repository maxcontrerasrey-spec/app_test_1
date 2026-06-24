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
  normalized_contract_labels text[] := coalesce((
    select array_agg(public.normalize_buk_area_name(value))
    from unnest(public.normalize_bi_text_array(p_contract_codes)) as value
  ), '{}'::text[]);
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
      or public.normalize_buk_area_name(coalesce(nullif(trim(e.area_name), ''), 'SIN AREA')) = any(normalized_contract_labels)
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
        or public.normalize_buk_area_name(coalesce(nullif(trim(snapshot.area_name), ''), 'SIN AREA')) = any(normalized_contract_labels)
      )
      and (
        coalesce(array_length(normalized_jobs, 1), 0) = 0
        or coalesce(nullif(trim(snapshot.job_title), ''), 'SIN CARGO') = any(normalized_jobs)
      );
  end if;
end;
$function$;

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
  normalized_contract_labels text[] := coalesce((
    select array_agg(public.normalize_buk_area_name(value))
    from unnest(public.normalize_bi_text_array(p_contract_codes)) as value
  ), '{}'::text[]);
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
        or public.normalize_buk_area_name(coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO')) = any(normalized_contract_labels)
      )
      and (
        coalesce(array_length(normalized_jobs, 1), 0) = 0
        or coalesce(nullif(trim(rc.job_position_name), ''), 'SIN CARGO') = any(normalized_jobs)
      )
  )
  select
    count(*)::bigint as total_active_employees,
    count(distinct p.area_name)::bigint as total_contracts,
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

drop function if exists public.get_bi_headcount_by_job_title(text, text[], text[]);

create function public.get_bi_headcount_by_job_title(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  contract_code text,
  area_name text,
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
    min(p.contract_code) as contract_code,
    p.area_name,
    p.job_title,
    count(*)::bigint as headcount
  from population p
  group by p.area_name, p.job_title
  order by headcount desc, p.area_name asc, p.job_title asc;
end;
$function$;

drop function if exists public.get_bi_age_distribution(text, text[], text[]);

create function public.get_bi_age_distribution(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  contract_code text,
  area_name text,
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
    min(p.contract_code) as contract_code,
    p.area_name,
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
    p.area_name,
    case
      when p.birth_date is null then 'Desconocido'
      when extract(year from age(period_context.reference_date, p.birth_date)) < 20 then '< 20'
      when extract(year from age(period_context.reference_date, p.birth_date)) < 30 then '20–29'
      when extract(year from age(period_context.reference_date, p.birth_date)) < 40 then '30–39'
      when extract(year from age(period_context.reference_date, p.birth_date)) < 50 then '40–49'
      when extract(year from age(period_context.reference_date, p.birth_date)) < 60 then '50–59'
      else '60+'
    end
  order by p.area_name asc, age_range asc;
end;
$function$;

revoke all on function public.get_bi_headcount_by_job_title(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_headcount_by_job_title(text, text[], text[]) to authenticated;

revoke all on function public.get_bi_age_distribution(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_age_distribution(text, text[], text[]) to authenticated;
