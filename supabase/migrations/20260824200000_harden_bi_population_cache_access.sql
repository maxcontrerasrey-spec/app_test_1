-- EEES-DB-005: approved
-- owner: Business Intelligence
-- rollback: restaurar el helper previo solo mediante una migracion forward-only.
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
  normalized_contract_labels text[] := coalesce((
    select array_agg(public.normalize_buk_area_name(value))
    from unnest(public.normalize_bi_text_array(p_contract_codes)) as value
  ), '{}'::text[]);
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
      or cached.area_name = any(normalized_contracts)
      or public.normalize_buk_area_name(cached.area_name) = any(normalized_contract_labels)
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
      or coalesce(nullif(trim(snapshot.area_name), ''), 'SIN AREA')
        = any(normalized_contracts)
      or public.normalize_buk_area_name(
        coalesce(nullif(trim(snapshot.area_name), ''), 'SIN AREA')
      ) = any(normalized_contract_labels)
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

notify pgrst, 'reload schema';
commit;
