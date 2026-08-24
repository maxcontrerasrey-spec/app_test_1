-- EEES-DB-005: approved
-- owner: Business Intelligence
-- rollback: restaurar get_bi_employee_population mediante una migracion forward-only.
begin;

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

  return query
  with current_population as materialized (
    select
      context.period_code,
      context.reference_date,
      ranked.buk_employee_id,
      ranked.full_name,
      coalesce(nullif(trim(ranked.contract_code), ''), 'SIN CONTRATO') as contract_code,
      coalesce(nullif(trim(ranked.area_name), ''), 'SIN AREA') as area_name,
      coalesce(
        nullif(trim(ranked.job_title), ''),
        nullif(trim(ranked.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
        nullif(trim(ranked.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
        nullif(trim(ranked.raw_payload ->> 'job_title'), ''),
        'SIN CARGO'
      ) as job_title,
      ranked.birth_date,
      public.extract_buk_employee_hire_date(ranked.raw_payload) as hire_date,
      coalesce(public.extract_buk_employee_city_name(ranked.raw_payload), 'SIN CIUDAD') as city_name,
      coalesce(public.extract_buk_employee_region_name(ranked.raw_payload), 'SIN REGION') as region_name
    from (
      select
        employee.*,
        row_number() over (
          partition by
            coalesce(nullif(trim(employee.document_type), ''), 'buk')
            || ':'
            || coalesce(
              nullif(regexp_replace(coalesce(employee.document_number, ''), '\D', '', 'g'), ''),
              employee.buk_employee_id
            )
          order by
            employee.updated_at desc nulls last,
            employee.created_at desc nulls last,
            employee.buk_employee_id desc
        ) as identity_rank
      from public.employees employee
      where employee.is_active = true
    ) ranked
    where context.is_current_period
      and ranked.identity_rank = 1
  ),
  historical_population as materialized (
    select
      context.period_code,
      context.reference_date,
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
    where not context.is_current_period
      and snapshot.snapshot_date = (
        select max(candidate.snapshot_date)
        from public.buk_employees_daily_snapshot candidate
        where candidate.snapshot_date between context.month_start and context.month_end
      )
      and snapshot.is_active = true
  ),
  filtered_population as materialized (
    select source.*
    from (
      select * from current_population
      union all
      select * from historical_population
    ) source
    where (
      cardinality(normalized_contracts) = 0
      or source.contract_code = any(normalized_contracts)
    )
      and (
        cardinality(normalized_jobs) = 0
        or source.job_title = any(normalized_jobs)
      )
  )
  select
    population.period_code,
    population.reference_date,
    population.buk_employee_id,
    population.full_name,
    population.contract_code,
    population.area_name,
    population.job_title,
    population.birth_date,
    population.hire_date,
    population.city_name,
    population.region_name
  from filtered_population population
  left join public.buk_contract_mappings mapping
    on mapping.buk_area_name_normalized = public.normalize_buk_area_name(population.area_name)
  where cardinality(normalized_managements) = 0
     or coalesce(nullif(trim(mapping.cost_center_name), ''), 'SIN GERENCIA')
        = any(normalized_managements);
end;
$function$;

revoke all on function public.get_bi_employee_population(text, text[], text[], text[])
  from public, anon, authenticated;
grant execute on function public.get_bi_employee_population(text, text[], text[], text[])
  to authenticated;

notify pgrst, 'reload schema';
commit;
