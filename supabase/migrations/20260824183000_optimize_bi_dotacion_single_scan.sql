-- EEES-DB-005: approved
-- owner: Business Intelligence
-- rollback: restaurar get_bi_dotacion_dashboard mediante una migracion forward-only.
begin;

create index if not exists idx_hr_roster_exceptions_active_date_employee
  on public.hr_roster_exceptions (exception_date, employee_buk_employee_id, exception_type)
  include (exception_source)
  where is_active = true;

create or replace function public.get_bi_dotacion_dashboard(
  p_period_code text,
  p_contract_codes text[],
  p_job_titles text[],
  p_management_names text[]
)
returns jsonb
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
  result jsonb;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  with
  period_context as materialized (
    select * from public.get_bi_period_context(p_period_code)
  ),
  population as materialized (
    select
      source.*,
      coalesce(nullif(trim(mapping.cost_center_name), ''), 'SIN GERENCIA') as management_name,
      public.normalize_bi_region_name(source.region_name) as normalized_region_name
    from public.get_bi_employee_population(
      p_period_code,
      p_contract_codes,
      p_job_titles,
      p_management_names
    ) source
    left join public.buk_contract_mappings mapping
      on mapping.buk_area_name_normalized = public.normalize_buk_area_name(source.area_name)
  ),
  today_exceptions as materialized (
    select
      p.contract_code,
      p.area_name,
      exception.exception_type,
      coalesce(exception.exception_source, 'manual') as exception_source,
      count(distinct exception.employee_buk_employee_id)::bigint as total_persons
    from public.hr_roster_exceptions exception
    join population p
      on p.buk_employee_id = exception.employee_buk_employee_id
    cross join period_context context
    where exception.exception_date = context.reference_date
      and exception.is_active = true
    group by p.contract_code, p.area_name, exception.exception_type,
      coalesce(exception.exception_source, 'manual')
  ),
  today_absent_by_contract as materialized (
    select
      p.contract_code,
      count(distinct exception.employee_buk_employee_id)::bigint as absent_total
    from public.hr_roster_exceptions exception
    join population p
      on p.buk_employee_id = exception.employee_buk_employee_id
    cross join period_context context
    where exception.exception_date = context.reference_date
      and exception.is_active = true
      and exception.exception_type in (
        'vacation', 'medical_leave', 'absent', 'administrative_leave', 'union_leave'
      )
    group by p.contract_code
  ),
  base_headcount as materialized (
    select p.contract_code, count(*)::bigint as headcount_base
    from population p
    group by p.contract_code
  ),
  monthly_absence_days_by_employee as materialized (
    select
      p.contract_code,
      exception.employee_buk_employee_id,
      count(*)::integer as total_absence_days
    from public.hr_roster_exceptions exception
    join population p
      on p.buk_employee_id = exception.employee_buk_employee_id
    cross join period_context context
    where exception.is_active = true
      and exception.exception_date between context.month_start and context.month_end
      and exception.exception_type in (
        'vacation', 'medical_leave', 'absent', 'administrative_leave', 'union_leave'
      )
    group by p.contract_code, exception.employee_buk_employee_id
  ),
  equivalent_headcount as materialized (
    select
      base.contract_code,
      round(
        coalesce(
          sum(greatest(0, 30 - absence.total_absence_days)::numeric / 30),
          base.headcount_base::numeric
        ),
        4
      ) as fte_headcount_equivalent,
      base.headcount_base,
      round(
        case
          when base.headcount_base > 0 then
            (1 - (
              coalesce(
                sum(greatest(0, 30 - absence.total_absence_days)::numeric / 30),
                base.headcount_base::numeric
              ) / base.headcount_base::numeric
            )) * 100
          else 0
        end,
        2
      ) as absenteeism_pct
    from base_headcount base
    left join monthly_absence_days_by_employee absence
      on absence.contract_code = base.contract_code
    group by base.contract_code, base.headcount_base
  ),
  grouped_monthly_exceptions as materialized (
    select
      p.contract_code,
      context.month_start,
      to_char(context.month_start, 'YYYY-MM') as year_month,
      exception.exception_type,
      coalesce(exception.exception_source, 'manual') as exception_source,
      count(*)::bigint as total_days,
      count(distinct exception.employee_buk_employee_id)::bigint as unique_employees
    from public.hr_roster_exceptions exception
    join population p
      on p.buk_employee_id = exception.employee_buk_employee_id
    cross join period_context context
    where exception.is_active = true
      and exception.exception_date between context.month_start and context.month_end
    group by p.contract_code, context.month_start,
      to_char(context.month_start, 'YYYY-MM'), exception.exception_type,
      coalesce(exception.exception_source, 'manual')
  ),
  recruitment_cases_filtered as materialized (
    select recruitment_case.id
    from public.recruitment_cases recruitment_case
    where recruitment_case.status = 'open'
      and (
        cardinality(normalized_contracts) = 0
        or coalesce(nullif(trim(recruitment_case.contract_name), ''), 'SIN CONTRATO') = any(normalized_contracts)
        or public.normalize_buk_area_name(
          coalesce(nullif(trim(recruitment_case.contract_name), ''), 'SIN CONTRATO')
        ) = any(normalized_contract_labels)
      )
      and (
        cardinality(normalized_jobs) = 0
        or coalesce(nullif(trim(recruitment_case.job_position_name), ''), 'SIN CARGO') = any(normalized_jobs)
      )
  )
  select jsonb_build_object(
    'overview', coalesce((
      select to_jsonb(overview)
      from (
        select
          count(*)::bigint as total_active_employees,
          count(distinct p.area_name)::bigint as total_contracts,
          coalesce((
            select sum(total_persons) from today_exceptions where exception_type = 'vacation'
          ), 0)::bigint as on_vacation_today,
          coalesce((
            select sum(total_persons) from today_exceptions where exception_type = 'medical_leave'
          ), 0)::bigint as on_medical_leave_today,
          coalesce((
            select sum(total_persons) from today_exceptions
            where exception_type in ('absent', 'administrative_leave', 'union_leave')
          ), 0)::bigint as other_absences_today,
          count(*) filter (
            where p.hire_date between context.month_start and context.month_end
          )::bigint as hired_this_month,
          (select count(*)::bigint from recruitment_cases_filtered) as open_recruitment_cases
        from population p
        cross join period_context context
      ) overview
    ), '{}'::jsonb),
    'headcountByContract', coalesce((
      select jsonb_agg(to_jsonb(row) order by row.headcount desc, row.contract_code, row.area_name)
      from (
        select
          p.contract_code,
          p.area_name,
          count(*)::bigint as headcount,
          count(*) filter (where p.birth_date is not null)::bigint as with_birth_date,
          round(avg(extract(year from age(context.reference_date, p.birth_date)))
            filter (where p.birth_date is not null), 1) as avg_age
        from population p
        cross join period_context context
        group by p.contract_code, p.area_name
      ) row
    ), '[]'::jsonb),
    'headcountByManagement', coalesce((
      select jsonb_agg(to_jsonb(row) order by row.headcount desc, row.management_name)
      from (
        select p.management_name, count(*)::bigint as headcount
        from population p
        group by p.management_name
      ) row
    ), '[]'::jsonb),
    'headcountByRegion', coalesce((
      select jsonb_agg(to_jsonb(row) order by row.headcount desc, row.region_name)
      from (
        select p.normalized_region_name as region_name, count(*)::bigint as headcount
        from population p
        group by p.normalized_region_name
      ) row
    ), '[]'::jsonb),
    'ageDistribution', coalesce((
      select jsonb_agg(to_jsonb(row) order by row.area_name, row.age_range)
      from (
        select
          min(p.contract_code) as contract_code,
          p.area_name,
          case
            when p.birth_date is null then 'Desconocido'
            when extract(year from age(context.reference_date, p.birth_date)) < 20 then '< 20'
            when extract(year from age(context.reference_date, p.birth_date)) < 30 then '20–29'
            when extract(year from age(context.reference_date, p.birth_date)) < 40 then '30–39'
            when extract(year from age(context.reference_date, p.birth_date)) < 50 then '40–49'
            when extract(year from age(context.reference_date, p.birth_date)) < 60 then '50–59'
            else '60+'
          end as age_range,
          count(*)::bigint as headcount
        from population p
        cross join period_context context
        group by p.area_name, case
          when p.birth_date is null then 'Desconocido'
          when extract(year from age(context.reference_date, p.birth_date)) < 20 then '< 20'
          when extract(year from age(context.reference_date, p.birth_date)) < 30 then '20–29'
          when extract(year from age(context.reference_date, p.birth_date)) < 40 then '30–39'
          when extract(year from age(context.reference_date, p.birth_date)) < 50 then '40–49'
          when extract(year from age(context.reference_date, p.birth_date)) < 60 then '50–59'
          else '60+'
        end
      ) row
    ), '[]'::jsonb),
    'exceptionsToday', coalesce((
      select jsonb_agg(to_jsonb(row) order by row.total_persons desc, row.contract_code, row.area_name)
      from today_exceptions row
    ), '[]'::jsonb),
    'presenceSummaryToday', coalesce((
      select jsonb_agg(to_jsonb(row) order by row.headcount desc, row.contract_code)
      from (
        select
          p.contract_code,
          count(*)::bigint as headcount,
          coalesce(absent.absent_total, 0)::bigint as absent_today,
          (count(*)::bigint - coalesce(absent.absent_total, 0))::bigint as present_today,
          case when count(*) > 0 then round(
            ((count(*) - coalesce(absent.absent_total, 0))::numeric / count(*)::numeric) * 100,
            1
          ) else 0 end as presence_pct
        from population p
        left join today_absent_by_contract absent on absent.contract_code = p.contract_code
        group by p.contract_code, absent.absent_total
      ) row
    ), '[]'::jsonb),
    'exceptionsMonthly', coalesce((
      select jsonb_agg(to_jsonb(row) order by row.month_start, row.contract_code, row.exception_type)
      from (
        select
          grouped.contract_code,
          grouped.month_start,
          grouped.year_month,
          grouped.exception_type,
          grouped.exception_source,
          grouped.total_days,
          grouped.unique_employees,
          equivalent.fte_headcount_equivalent,
          equivalent.headcount_base,
          equivalent.absenteeism_pct
        from grouped_monthly_exceptions grouped
        join equivalent_headcount equivalent on equivalent.contract_code = grouped.contract_code
      ) row
    ), '[]'::jsonb),
    'recruitmentPipeline', coalesce((
      select jsonb_agg(to_jsonb(row))
      from public.get_bi_recruitment_pipeline(
        p_period_code, p_contract_codes, p_job_titles, p_management_names
      ) row
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$function$;

revoke all on function public.get_bi_dotacion_dashboard(text, text[], text[], text[])
  from public, anon;
grant execute on function public.get_bi_dotacion_dashboard(text, text[], text[], text[])
  to authenticated;

notify pgrst, 'reload schema';
commit;
