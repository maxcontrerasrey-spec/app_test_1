-- Migration: add_buk_bi_analytics_views
-- Description: Creates materialized-style views for BI dashboards powered by
--   BUK employee data, roster exceptions, and recruitment pipeline.
--   All views use security_invoker = true and follow project conventions.

begin;

-- ============================================================================
-- VIEW 1: buk_bi_headcount_by_contract
-- Headcount activo agrupado por contrato/faena. Base para gráficos de dotación.
-- ============================================================================
create or replace view public.buk_bi_headcount_by_contract
with (security_invoker = true) as
select
  coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO') as contract_code,
  coalesce(nullif(trim(e.area_name), ''), 'SIN AREA') as area_name,
  count(*) as headcount,
  count(*) filter (where e.birth_date is not null) as with_birth_date,
  round(avg(
    extract(year from age(current_date, e.birth_date))
  ) filter (where e.birth_date is not null), 1) as avg_age
from public.employees_active_current e
group by
  coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO'),
  coalesce(nullif(trim(e.area_name), ''), 'SIN AREA');

grant select on public.buk_bi_headcount_by_contract to authenticated;

-- ============================================================================
-- VIEW 2: buk_bi_headcount_by_job_title
-- Distribución por cargo. Útil para pirámide organizacional.
-- ============================================================================
create or replace view public.buk_bi_headcount_by_job_title
with (security_invoker = true) as
select
  coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO') as contract_code,
  coalesce(nullif(trim(e.job_title), ''), 'SIN CARGO') as job_title,
  count(*) as headcount
from public.employees_active_current e
group by
  coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO'),
  coalesce(nullif(trim(e.job_title), ''), 'SIN CARGO');

grant select on public.buk_bi_headcount_by_job_title to authenticated;

-- ============================================================================
-- VIEW 3: buk_bi_age_distribution
-- Distribución etaria en rangos de 10 años. Base para gráfico de barras demográfico.
-- ============================================================================
create or replace view public.buk_bi_age_distribution
with (security_invoker = true) as
select
  coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO') as contract_code,
  case
    when e.birth_date is null then 'Desconocido'
    when extract(year from age(current_date, e.birth_date)) < 20 then '< 20'
    when extract(year from age(current_date, e.birth_date)) < 30 then '20–29'
    when extract(year from age(current_date, e.birth_date)) < 40 then '30–39'
    when extract(year from age(current_date, e.birth_date)) < 50 then '40–49'
    when extract(year from age(current_date, e.birth_date)) < 60 then '50–59'
    else '60+'
  end as age_range,
  count(*) as headcount
from public.employees_active_current e
group by
  coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO'),
  case
    when e.birth_date is null then 'Desconocido'
    when extract(year from age(current_date, e.birth_date)) < 20 then '< 20'
    when extract(year from age(current_date, e.birth_date)) < 30 then '20–29'
    when extract(year from age(current_date, e.birth_date)) < 40 then '30–39'
    when extract(year from age(current_date, e.birth_date)) < 50 then '40–49'
    when extract(year from age(current_date, e.birth_date)) < 60 then '50–59'
    else '60+'
  end;

grant select on public.buk_bi_age_distribution to authenticated;

-- ============================================================================
-- VIEW 4: buk_bi_exceptions_today
-- Snapshot del día: quién está de vacaciones, licencia, ausente, etc. HOY.
-- ============================================================================
create or replace view public.buk_bi_exceptions_today
with (security_invoker = true) as
select
  coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO') as contract_code,
  coalesce(nullif(trim(e.area_name), ''), 'SIN AREA') as area_name,
  hre.exception_type,
  coalesce(hre.exception_source, 'manual') as exception_source,
  count(*) as total_persons
from public.hr_roster_exceptions hre
join public.employees_active_current e
  on e.buk_employee_id = hre.employee_buk_employee_id
where hre.exception_date = current_date
  and hre.is_active = true
group by
  coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO'),
  coalesce(nullif(trim(e.area_name), ''), 'SIN AREA'),
  hre.exception_type,
  coalesce(hre.exception_source, 'manual');

grant select on public.buk_bi_exceptions_today to authenticated;

-- ============================================================================
-- VIEW 5: buk_bi_presence_summary_today
-- Resumen ejecutivo del día: headcount, presentes, ausentes, % presencia.
-- ============================================================================
create or replace view public.buk_bi_presence_summary_today
with (security_invoker = true) as
with active_headcount as (
  select
    coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO') as contract_code,
    count(*) as total_active
  from public.employees_active_current e
  group by coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO')
),
today_absent as (
  select
    coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO') as contract_code,
    count(distinct hre.employee_buk_employee_id) as total_absent
  from public.hr_roster_exceptions hre
  join public.employees_active_current e
    on e.buk_employee_id = hre.employee_buk_employee_id
  where hre.exception_date = current_date
    and hre.is_active = true
    and hre.exception_type in ('vacation', 'medical_leave', 'absent', 'administrative_leave', 'union_leave')
  group by coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO')
)
select
  ah.contract_code,
  ah.total_active as headcount,
  coalesce(ta.total_absent, 0) as absent_today,
  ah.total_active - coalesce(ta.total_absent, 0) as present_today,
  case
    when ah.total_active > 0
    then round(
      (ah.total_active - coalesce(ta.total_absent, 0))::numeric / ah.total_active * 100,
      1
    )
    else 0
  end as presence_pct
from active_headcount ah
left join today_absent ta on ta.contract_code = ah.contract_code;

grant select on public.buk_bi_presence_summary_today to authenticated;

-- ============================================================================
-- VIEW 6: buk_bi_exceptions_monthly
-- Días perdidos por tipo de excepción agrupados por mes. Ideal para tendencias.
-- ============================================================================
create or replace view public.buk_bi_exceptions_monthly
with (security_invoker = true) as
select
  coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO') as contract_code,
  date_trunc('month', hre.exception_date)::date as month_start,
  to_char(hre.exception_date, 'YYYY-MM') as year_month,
  hre.exception_type,
  coalesce(hre.exception_source, 'manual') as exception_source,
  count(*) as total_days,
  count(distinct hre.employee_buk_employee_id) as unique_employees
from public.hr_roster_exceptions hre
join public.employees_active_current e
  on e.buk_employee_id = hre.employee_buk_employee_id
where hre.is_active = true
group by
  coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO'),
  date_trunc('month', hre.exception_date)::date,
  to_char(hre.exception_date, 'YYYY-MM'),
  hre.exception_type,
  coalesce(hre.exception_source, 'manual');

grant select on public.buk_bi_exceptions_monthly to authenticated;

-- ============================================================================
-- VIEW 7: buk_bi_vacation_forecast
-- Proyección de vacaciones programadas. Permite visualizar picos futuros de merma.
-- ============================================================================
create or replace view public.buk_bi_vacation_forecast
with (security_invoker = true) as
select
  coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO') as contract_code,
  hre.exception_date,
  to_char(hre.exception_date, 'YYYY-MM') as year_month,
  count(*) as vacationing_employees
from public.hr_roster_exceptions hre
join public.employees_active_current e
  on e.buk_employee_id = hre.employee_buk_employee_id
where hre.is_active = true
  and hre.exception_type = 'vacation'
  and hre.exception_date >= current_date
group by
  coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO'),
  hre.exception_date,
  to_char(hre.exception_date, 'YYYY-MM');

grant select on public.buk_bi_vacation_forecast to authenticated;

-- ============================================================================
-- VIEW 8: buk_bi_medical_leave_by_area
-- Licencias médicas acumuladas por área/contrato. Detectar focos de ausentismo.
-- ============================================================================
create or replace view public.buk_bi_medical_leave_by_area
with (security_invoker = true) as
select
  coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO') as contract_code,
  coalesce(nullif(trim(e.area_name), ''), 'SIN AREA') as area_name,
  date_trunc('month', hre.exception_date)::date as month_start,
  to_char(hre.exception_date, 'YYYY-MM') as year_month,
  count(*) as medical_leave_days,
  count(distinct hre.employee_buk_employee_id) as unique_employees
from public.hr_roster_exceptions hre
join public.employees_active_current e
  on e.buk_employee_id = hre.employee_buk_employee_id
where hre.is_active = true
  and hre.exception_type = 'medical_leave'
group by
  coalesce(nullif(trim(e.contract_code), ''), 'SIN CONTRATO'),
  coalesce(nullif(trim(e.area_name), ''), 'SIN AREA'),
  date_trunc('month', hre.exception_date)::date,
  to_char(hre.exception_date, 'YYYY-MM');

grant select on public.buk_bi_medical_leave_by_area to authenticated;

-- ============================================================================
-- VIEW 9: buk_bi_recruitment_pipeline
-- Estado del pipeline de reclutamiento: cuántos candidatos en cada etapa.
-- ============================================================================
create or replace view public.buk_bi_recruitment_pipeline
with (security_invoker = true) as
select
  rc.status as case_status,
  rcc.stage_code,
  coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO') as contract_name,
  coalesce(nullif(trim(rc.job_position_name), ''), 'SIN CARGO') as job_position_name,
  count(*) as candidate_count,
  count(*) filter (where rcc.is_selected = true) as selected_count
from public.recruitment_case_candidates rcc
join public.recruitment_cases rc
  on rc.id = rcc.recruitment_case_id
group by
  rc.status,
  rcc.stage_code,
  coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO'),
  coalesce(nullif(trim(rc.job_position_name), ''), 'SIN CARGO');

grant select on public.buk_bi_recruitment_pipeline to authenticated;

-- ============================================================================
-- VIEW 10: buk_bi_hiring_velocity
-- Velocidad de contratación: cuántos hired por mes. Ideal para medir eficiencia.
-- ============================================================================
create or replace view public.buk_bi_hiring_velocity
with (security_invoker = true) as
select
  coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO') as contract_name,
  date_trunc('month', rcc.hired_at)::date as month_start,
  to_char(rcc.hired_at, 'YYYY-MM') as year_month,
  count(*) as hired_count
from public.recruitment_case_candidates rcc
join public.recruitment_cases rc
  on rc.id = rcc.recruitment_case_id
where rcc.hired_at is not null
group by
  coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO'),
  date_trunc('month', rcc.hired_at)::date,
  to_char(rcc.hired_at, 'YYYY-MM');

grant select on public.buk_bi_hiring_velocity to authenticated;

-- ============================================================================
-- VIEW 11: buk_bi_workforce_overview
-- Vista ejecutiva KPI: resumen total de toda la fuerza laboral para tarjetas.
-- ============================================================================
create or replace view public.buk_bi_workforce_overview
with (security_invoker = true) as
select
  (select count(*) from public.employees_active_current) as total_active_employees,
  (select count(distinct e.contract_code)
   from public.employees_active_current e
   where nullif(trim(e.contract_code), '') is not null) as total_contracts,
  (select count(*)
   from public.hr_roster_exceptions hre
   where hre.exception_date = current_date
     and hre.is_active = true
     and hre.exception_type = 'vacation') as on_vacation_today,
  (select count(*)
   from public.hr_roster_exceptions hre
   where hre.exception_date = current_date
     and hre.is_active = true
     and hre.exception_type = 'medical_leave') as on_medical_leave_today,
  (select count(*)
   from public.hr_roster_exceptions hre
   where hre.exception_date = current_date
     and hre.is_active = true
     and hre.exception_type in ('absent', 'administrative_leave', 'union_leave')) as other_absences_today,
  (select count(*)
   from public.recruitment_case_candidates rcc
   where rcc.stage_code = 'hired'
     and rcc.hired_at >= date_trunc('month', current_date)) as hired_this_month,
  (select count(*)
   from public.recruitment_cases rc
   where rc.status = 'open') as open_recruitment_cases;

grant select on public.buk_bi_workforce_overview to authenticated;

notify pgrst, 'reload schema';

commit;
