-- Selección cruzada de gerencia para toda la analítica de dotación.
-- Se conserva la firma anterior y se agrega una sobrecarga de cuatro
-- parámetros para no romper consumidores existentes.

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
language sql
stable
security definer
set search_path = public
as $function$
  with normalized_managements as (
    select public.normalize_bi_text_array(p_management_names) as names
  )
  select population.*
  from public.get_bi_employee_population(p_period_code, p_contract_codes, p_job_titles) population
  cross join normalized_managements
  where cardinality(normalized_managements.names) = 0
     or exists (
       select 1
       from public.buk_contract_mappings mapping
       where mapping.buk_area_name_normalized = public.normalize_buk_area_name(population.area_name)
         and coalesce(nullif(trim(mapping.cost_center_name), ''), 'SIN GERENCIA') = any(normalized_managements.names)
     )
     or (
       not exists (
         select 1
         from public.buk_contract_mappings mapping
         where mapping.buk_area_name_normalized = public.normalize_buk_area_name(population.area_name)
       )
       and 'SIN GERENCIA' = any(normalized_managements.names)
     );
$function$;

revoke all on function public.get_bi_employee_population(text, text[], text[], text[]) from public, anon, authenticated;
grant execute on function public.get_bi_employee_population(text, text[], text[], text[]) to authenticated;

do $$
declare
  v_name text;
  v_source text;
  v_old_header text;
  v_new_header text;
begin
  foreach v_name in array array[
    'get_bi_workforce_overview',
    'get_bi_headcount_by_contract',
    'get_bi_headcount_by_management',
    'get_bi_headcount_by_job_title',
    'get_bi_headcount_by_city',
    'get_bi_headcount_by_region',
    'get_bi_age_distribution',
    'get_bi_exceptions_today',
    'get_bi_presence_summary_today',
    'get_bi_exceptions_monthly'
  ]
  loop
    v_source := pg_get_functiondef(to_regprocedure(format('public.%s(text,text[],text[])', v_name)));
    v_old_header := format(
      'FUNCTION public.%s(p_period_code text DEFAULT NULL::text, p_contract_codes text[] DEFAULT NULL::text[], p_job_titles text[] DEFAULT NULL::text[])',
      v_name
    );
    v_new_header := format(
      'FUNCTION public.%s(p_period_code text, p_contract_codes text[], p_job_titles text[], p_management_names text[])',
      v_name
    );
    if position(v_old_header in v_source) = 0 then
      raise exception 'No se encontró la firma esperada para %', v_name;
    end if;
    v_source := replace(v_source, v_old_header, v_new_header);
    v_source := replace(
      v_source,
      'public.get_bi_employee_population(p_period_code, p_contract_codes, p_job_titles)',
      'public.get_bi_employee_population(p_period_code, p_contract_codes, p_job_titles, p_management_names)'
    );
    execute v_source;
    execute format('revoke all on function public.%s(text, text[], text[], text[]) from public, anon', v_name);
    execute format('grant execute on function public.%s(text, text[], text[], text[]) to authenticated', v_name);
  end loop;
end;
$$;

create or replace function public.get_bi_recruitment_pipeline(
  p_period_code text,
  p_contract_codes text[],
  p_job_titles text[],
  p_management_names text[]
)
returns table (
  case_status text,
  stage_code text,
  contract_name text,
  job_position_name text,
  candidate_count bigint,
  selected_count bigint
)
language sql
stable
security definer
set search_path = public
as $function$
  with normalized_managements as (
    select public.normalize_bi_text_array(p_management_names) as names
  )
  select pipeline.*
  from public.get_bi_recruitment_pipeline(p_period_code, p_contract_codes, p_job_titles) pipeline
  cross join normalized_managements
  where cardinality(normalized_managements.names) = 0
     or exists (
       select 1
       from public.buk_contract_mappings mapping
       where mapping.buk_area_name_normalized = public.normalize_buk_area_name(pipeline.contract_name)
         and coalesce(nullif(trim(mapping.cost_center_name), ''), 'SIN GERENCIA') = any(normalized_managements.names)
     )
     or (
       not exists (
         select 1
         from public.buk_contract_mappings mapping
         where mapping.buk_area_name_normalized = public.normalize_buk_area_name(pipeline.contract_name)
       )
       and 'SIN GERENCIA' = any(normalized_managements.names)
     );
$function$;

revoke all on function public.get_bi_recruitment_pipeline(text, text[], text[], text[]) from public, anon;
grant execute on function public.get_bi_recruitment_pipeline(text, text[], text[], text[]) to authenticated;

notify pgrst, 'reload schema';
