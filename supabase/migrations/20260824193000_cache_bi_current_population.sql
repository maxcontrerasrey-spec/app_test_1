-- EEES-DB-005: approved
-- owner: Business Intelligence
-- rollback: retirar cache, cron y helper mediante una migracion forward-only.
begin;

create materialized view if not exists public.bi_employee_population_current_cache as
select
  employee.buk_employee_id,
  employee.full_name,
  coalesce(nullif(trim(employee.contract_code), ''), 'SIN CONTRATO') as contract_code,
  coalesce(nullif(trim(employee.area_name), ''), 'SIN AREA') as area_name,
  coalesce(
    nullif(trim(employee.job_title), ''),
    nullif(trim(employee.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
    nullif(trim(employee.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
    nullif(trim(employee.raw_payload ->> 'job_title'), ''),
    'SIN CARGO'
  ) as job_title,
  employee.birth_date,
  public.extract_buk_employee_hire_date(employee.raw_payload) as hire_date,
  coalesce(public.extract_buk_employee_city_name(employee.raw_payload), 'SIN CIUDAD') as city_name,
  coalesce(public.extract_buk_employee_region_name(employee.raw_payload), 'SIN REGION') as region_name,
  coalesce(nullif(trim(mapping.cost_center_name), ''), 'SIN GERENCIA') as management_name
from public.employees_active_current employee
left join public.buk_contract_mappings mapping
  on mapping.buk_area_name_normalized = public.normalize_buk_area_name(employee.area_name)
with no data;

create unique index if not exists bi_employee_population_current_cache_employee_uidx
  on public.bi_employee_population_current_cache (buk_employee_id);
create index if not exists bi_employee_population_current_cache_dimensions_idx
  on public.bi_employee_population_current_cache (management_name, contract_code, job_title);

refresh materialized view public.bi_employee_population_current_cache;

revoke all on public.bi_employee_population_current_cache from public, anon, authenticated;

create or replace function public.refresh_bi_employee_population_current_cache()
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  refresh materialized view concurrently public.bi_employee_population_current_cache;
end;
$function$;

revoke all on function public.refresh_bi_employee_population_current_cache()
  from public, anon, authenticated;
grant execute on function public.refresh_bi_employee_population_current_cache()
  to service_role;

do $schedule$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'refresh-bi-employee-population-current-cache';

    perform cron.schedule(
      'refresh-bi-employee-population-current-cache',
      '* * * * *',
      'select public.refresh_bi_employee_population_current_cache();'
    );
  end if;
exception
  when undefined_table or invalid_schema_name then
    raise notice 'pg_cron no disponible; la cache BI queda disponible para refresco operativo';
end
$schedule$;

create or replace function public.get_bi_employee_population(
  p_period_code text,
  p_contract_codes text[],
  p_job_titles text[],
  p_management_names text[]
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
  context record;
  normalized_contracts text[] := public.normalize_bi_text_array(p_contract_codes);
  normalized_jobs text[] := public.normalize_bi_text_array(p_job_titles);
  normalized_managements text[] := public.normalize_bi_text_array(p_management_names);
begin
  select * into context
  from public.get_bi_period_context(p_period_code);

  if context.is_current_period then
    return query
    select
      context.period_code,
      context.reference_date,
      cached.buk_employee_id,
      cached.full_name,
      cached.contract_code,
      cached.area_name,
      cached.job_title,
      cached.birth_date,
      cached.hire_date,
      cached.city_name,
      cached.region_name
    from public.bi_employee_population_current_cache cached
    where (
      cardinality(normalized_contracts) = 0
      or cached.contract_code = any(normalized_contracts)
    )
      and (
        cardinality(normalized_jobs) = 0
        or cached.job_title = any(normalized_jobs)
      )
      and (
        cardinality(normalized_managements) = 0
        or cached.management_name = any(normalized_managements)
      );
    return;
  end if;

  return query
  select
    context.period_code,
    context.reference_date,
    snapshot.buk_employee_id,
    snapshot.full_name,
    coalesce(nullif(trim(snapshot.contract_code), ''), 'SIN CONTRATO'),
    coalesce(nullif(trim(snapshot.area_name), ''), 'SIN AREA'),
    coalesce(nullif(trim(snapshot.job_title), ''), 'SIN CARGO'),
    snapshot.birth_date,
    snapshot.hire_date,
    coalesce(nullif(trim(snapshot.city_name), ''), 'SIN CIUDAD'),
    coalesce(nullif(trim(snapshot.region_name), ''), 'SIN REGION')
  from public.buk_employees_daily_snapshot snapshot
  left join public.buk_contract_mappings mapping
    on mapping.buk_area_name_normalized = public.normalize_buk_area_name(snapshot.area_name)
  where snapshot.snapshot_date = (
      select max(candidate.snapshot_date)
      from public.buk_employees_daily_snapshot candidate
      where candidate.snapshot_date between context.month_start and context.month_end
    )
    and snapshot.is_active = true
    and (
      cardinality(normalized_contracts) = 0
      or coalesce(nullif(trim(snapshot.contract_code), ''), 'SIN CONTRATO')
        = any(normalized_contracts)
    )
    and (
      cardinality(normalized_jobs) = 0
      or coalesce(nullif(trim(snapshot.job_title), ''), 'SIN CARGO')
        = any(normalized_jobs)
    )
    and (
      cardinality(normalized_managements) = 0
      or coalesce(nullif(trim(mapping.cost_center_name), ''), 'SIN GERENCIA')
        = any(normalized_managements)
    );
end;
$function$;

revoke all on function public.get_bi_employee_population(text, text[], text[], text[])
  from public, anon, authenticated;
grant execute on function public.get_bi_employee_population(text, text[], text[], text[])
  to authenticated;

notify pgrst, 'reload schema';
commit;
