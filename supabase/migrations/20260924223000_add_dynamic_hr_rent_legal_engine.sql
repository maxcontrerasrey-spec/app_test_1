-- EEES-DB-005: approved
-- owner: Recursos Humanos / Gobierno de remuneraciones
-- rollback: forward-only; desactivar escenarios mediante una migración posterior y preservar auditoría.

begin;

alter table public.hr_rent_structures
  add column if not exists afp_code text not null default 'habitat',
  add column if not exists health_mode text not null default 'fonasa',
  add column if not exists health_provider_name text not null default 'Fonasa',
  add column if not exists health_plan_value numeric(14,4) not null default 0,
  add column if not exists unemployment_contract_type text not null default 'indefinite';

alter table public.hr_rent_structures
  drop constraint if exists hr_rent_structures_health_mode_check,
  add constraint hr_rent_structures_health_mode_check
    check (health_mode in ('fonasa', 'isapre_uf', 'isapre_pesos', 'isapre_percentage')),
  drop constraint if exists hr_rent_structures_health_plan_value_check,
  add constraint hr_rent_structures_health_plan_value_check check (health_plan_value >= 0),
  drop constraint if exists hr_rent_structures_unemployment_contract_type_check,
  add constraint hr_rent_structures_unemployment_contract_type_check
    check (unemployment_contract_type in ('indefinite', 'fixed_term'));

create table if not exists public.hr_rent_afp_rates (
  id uuid primary key default gen_random_uuid(),
  afp_code text not null,
  afp_name text not null,
  commission_rate numeric(8,6) not null check (commission_rate >= 0 and commission_rate <= 1),
  effective_from date not null,
  effective_to date,
  source_url text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint hr_rent_afp_rates_dates check (effective_to is null or effective_to >= effective_from),
  unique (afp_code, effective_from)
);

create index if not exists idx_hr_rent_afp_rates_lookup
  on public.hr_rent_afp_rates (afp_code, effective_from desc, is_active);

insert into public.hr_rent_afp_rates
  (afp_code, afp_name, commission_rate, effective_from, source_url)
values
  ('capital', 'AFP Capital', 0.0144, date '2026-01-01', 'https://www.spensiones.cl/portal/institucional/594/w3-article-2815.html'),
  ('cuprum', 'AFP Cuprum', 0.0144, date '2026-01-01', 'https://www.spensiones.cl/portal/institucional/594/w3-article-2815.html'),
  ('habitat', 'AFP Habitat', 0.0127, date '2026-01-01', 'https://www.spensiones.cl/portal/institucional/594/w3-article-2815.html'),
  ('modelo', 'AFP Modelo', 0.0058, date '2026-01-01', 'https://www.spensiones.cl/portal/institucional/594/w3-article-2815.html'),
  ('planvital', 'AFP PlanVital', 0.0116, date '2026-01-01', 'https://www.spensiones.cl/portal/institucional/594/w3-article-2815.html'),
  ('provida', 'AFP Provida', 0.0145, date '2026-01-01', 'https://www.spensiones.cl/portal/institucional/594/w3-article-2815.html'),
  ('uno', 'AFP Uno', 0.0046, date '2026-01-01', 'https://www.spensiones.cl/portal/institucional/594/w3-article-2815.html')
on conflict (afp_code, effective_from) do update
set afp_name = excluded.afp_name,
    commission_rate = excluded.commission_rate,
    effective_to = excluded.effective_to,
    source_url = excluded.source_url,
    is_active = true;

create table if not exists public.hr_rent_monthly_indicators (
  period_month date primary key check (period_month = date_trunc('month', period_month)::date),
  uf_month_end_clp numeric(14,2) not null check (uf_month_end_clp > 0),
  pension_health_cap_uf numeric(8,2) not null check (pension_health_cap_uf > 0),
  unemployment_cap_uf numeric(8,2) not null check (unemployment_cap_uf > 0),
  mandatory_pension_rate numeric(8,6) not null default 0.10 check (mandatory_pension_rate between 0 and 1),
  health_rate numeric(8,6) not null default 0.07 check (health_rate between 0 and 1),
  unemployment_indefinite_rate numeric(8,6) not null default 0.006 check (unemployment_indefinite_rate between 0 and 1),
  source_url text not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.hr_rent_monthly_indicators
  (period_month, uf_month_end_clp, pension_health_cap_uf, unemployment_cap_uf, source_url, notes)
values
  (date '2026-01-01', 39706.07, 89.90, 135.10, 'https://www.sii.cl/valores_y_fechas/uf/uf2026.htm', 'UF al 31-01-2026; topes transitorios de enero.'),
  (date '2026-02-01', 39790.63, 90.00, 135.20, 'https://www.sii.cl/valores_y_fechas/uf/uf2026.htm', 'UF al 28-02-2026; topes definitivos 2026.'),
  (date '2026-03-01', 39841.72, 90.00, 135.20, 'https://www.sii.cl/valores_y_fechas/uf/uf2026.htm', 'UF al 31-03-2026.'),
  (date '2026-04-01', 40120.20, 90.00, 135.20, 'https://www.sii.cl/valores_y_fechas/uf/uf2026.htm', 'UF al 30-04-2026.'),
  (date '2026-05-01', 40610.69, 90.00, 135.20, 'https://www.sii.cl/valores_y_fechas/uf/uf2026.htm', 'UF al 31-05-2026.'),
  (date '2026-06-01', 40820.31, 90.00, 135.20, 'https://www.sii.cl/valores_y_fechas/uf/uf2026.htm', 'UF al 30-06-2026.'),
  (date '2026-07-01', 40844.79, 90.00, 135.20, 'https://www.sii.cl/valores_y_fechas/uf/uf2026.htm', 'UF al 31-07-2026.'),
  (date '2026-08-01', 40873.77, 90.00, 135.20, 'https://www.sii.cl/valores_y_fechas/uf/uf2026.htm', 'UF al 31-08-2026; contrastada con liquidaciones BUK cerradas.'),
  (date '2026-09-01', 41057.20, 90.00, 135.20, 'https://www.sii.cl/valores_y_fechas/uf/uf2026.htm', 'UF al 30-09-2026.')
on conflict (period_month) do update
set uf_month_end_clp = excluded.uf_month_end_clp,
    pension_health_cap_uf = excluded.pension_health_cap_uf,
    unemployment_cap_uf = excluded.unemployment_cap_uf,
    mandatory_pension_rate = excluded.mandatory_pension_rate,
    health_rate = excluded.health_rate,
    unemployment_indefinite_rate = excluded.unemployment_indefinite_rate,
    source_url = excluded.source_url,
    notes = excluded.notes,
    updated_at = timezone('utc', now());

alter table public.hr_rent_afp_rates enable row level security;
alter table public.hr_rent_monthly_indicators enable row level security;

drop policy if exists hr_rent_afp_rates_no_direct_access on public.hr_rent_afp_rates;
create policy hr_rent_afp_rates_no_direct_access on public.hr_rent_afp_rates
for all to authenticated using (false) with check (false);
drop policy if exists hr_rent_monthly_indicators_no_direct_access on public.hr_rent_monthly_indicators;
create policy hr_rent_monthly_indicators_no_direct_access on public.hr_rent_monthly_indicators
for all to authenticated using (false) with check (false);

revoke all on public.hr_rent_afp_rates from public, anon, authenticated;
revoke all on public.hr_rent_monthly_indicators from public, anon, authenticated;

create or replace function public.get_hr_rent_structure_control(
  p_contract_id bigint default null,
  p_job_position_id bigint default null,
  p_month date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  current_user_id uuid := auth.uid();
  month_start date := date_trunc('month', coalesce(p_month, current_date))::date;
  month_end date := (date_trunc('month', coalesce(p_month, current_date)) + interval '1 month - 1 day')::date;
begin
  if current_user_id is null or not public.user_can_manage_hr_rent_structures(current_user_id) then
    raise exception 'Sin permisos para consultar estructuras de renta';
  end if;

  return jsonb_build_object(
    'can_configure', public.user_can_manage_hr_rent_structures(current_user_id),
    'month', to_char(month_start, 'YYYY-MM'),
    'legal_catalog', jsonb_build_object(
      'afps', coalesce((
        select jsonb_agg(jsonb_build_object(
          'code', rate_row.afp_code,
          'name', rate_row.afp_name,
          'commission_rate', rate_row.commission_rate
        ) order by rate_row.afp_name)
        from public.hr_rent_afp_rates rate_row
        where rate_row.is_active
          and rate_row.effective_from <= month_start
          and (rate_row.effective_to is null or rate_row.effective_to >= month_start)
      ), '[]'::jsonb),
      'indicator', (
        select jsonb_build_object(
          'period_month', indicator.period_month,
          'uf_month_end_clp', indicator.uf_month_end_clp,
          'pension_health_cap_uf', indicator.pension_health_cap_uf,
          'unemployment_cap_uf', indicator.unemployment_cap_uf
        )
        from public.hr_rent_monthly_indicators indicator
        where indicator.period_month = month_start
      )
    ),
    'contracts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', contract_row.id,
        'code', contract_row.code,
        'contract_number', contract_row.contract_number,
        'contract_name', contract_row.contract_name
      ) order by contract_row.contract_name)
      from (
        select distinct c.id, c.code, c.contract_number,
          coalesce(nullif(trim(bcm.buk_area_name), ''), c.contract_name) as contract_name
        from public.contracts c
        join public.buk_contract_mappings bcm on bcm.contract_id = c.id
          and bcm.is_operational = true and bcm.is_one_to_one = true
        where c.is_active = true
          and (c.contract_name ilike '%DSAL%' or bcm.buk_area_name ilike '%DSAL%')
      ) contract_row
    ), '[]'::jsonb),
    'positions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', position_row.id,
        'code', position_row.code,
        'name', position_row.name,
        'has_structure', position_row.structure_id is not null,
        'authorized_headcount', coalesce(position_row.authorized_headcount, 0),
        'monthly_budget', position_row.monthly_budget,
        'currency_code', position_row.currency_code,
        'contracted_count', position_row.contracted_count,
        'present_equivalent', position_row.present_equivalent,
        'balance', case when position_row.structure_id is null then null else coalesce(position_row.authorized_headcount, 0) - position_row.contracted_count end,
        'coverage', case when coalesce(position_row.authorized_headcount, 0) = 0 then null else round(position_row.present_equivalent / position_row.authorized_headcount, 4) end
      ) order by position_row.name)
      from (
        select distinct on (jp.id)
          jp.id, jp.code, jp.name, hrs.id as structure_id, hrs.authorized_headcount,
          hrs.monthly_budget, coalesce(hrs.currency_code, 'CLP') as currency_code,
          (
            select count(distinct e.buk_employee_id)::integer
            from public.buk_job_position_contract_access a
            join public.employees_active_current e on
              case when (e.raw_payload #>> '{current_job,role,id}') ~ '^[0-9]+$'
                then (e.raw_payload #>> '{current_job,role,id}')::bigint else null end = a.buk_role_id
              and case when (e.raw_payload #>> '{current_job,area_id}') ~ '^[0-9]+$'
                then (e.raw_payload #>> '{current_job,area_id}')::bigint else null end = a.buk_area_id
            where a.contract_id = p_contract_id and a.job_position_id = jp.id and a.is_active = true
          ) as contracted_count,
          (
            select round(coalesce(sum(case when day_status.effective_status in ('working', 'extra_shift', 'training') then 1 else 0 end), 0)::numeric / 30, 4)
            from public.buk_job_position_contract_access a
            join public.employees_active_current e on
              case when (e.raw_payload #>> '{current_job,role,id}') ~ '^[0-9]+$'
                then (e.raw_payload #>> '{current_job,role,id}')::bigint else null end = a.buk_role_id
              and case when (e.raw_payload #>> '{current_job,area_id}') ~ '^[0-9]+$'
                then (e.raw_payload #>> '{current_job,area_id}')::bigint else null end = a.buk_area_id
            cross join lateral generate_series(month_start, month_end, interval '1 day') calendar_day
            cross join lateral public.resolve_hr_roster_day_status(e.buk_employee_id, calendar_day::date) day_status
            where a.contract_id = p_contract_id and a.job_position_id = jp.id and a.is_active = true
          ) as present_equivalent
        from public.buk_job_position_contract_access access_row
        join public.job_positions jp on jp.id = access_row.job_position_id and jp.is_active = true
        left join public.hr_rent_structures hrs on hrs.contract_id = access_row.contract_id
          and hrs.job_position_id = jp.id and hrs.is_active = true
        where access_row.contract_id = p_contract_id and access_row.is_active = true
        order by jp.id, hrs.updated_at desc nulls last
      ) position_row
    ), '[]'::jsonb),
    'structure', coalesce((
      with configured as (
        select line.id, line.concept_code, line.concept_name, line.concept_type,
          line.section_code, line.calculation_mode, line.amount, line.sort_order
        from public.hr_rent_structures structure_row
        join public.hr_rent_structure_lines line on line.structure_id = structure_row.id and line.is_active = true
        where structure_row.contract_id = p_contract_id and structure_row.job_position_id = p_job_position_id and structure_row.is_active = true
      ), totals as (
        select coalesce(sum(amount) filter (where section_code = 'imponible'), 0)::numeric as imponible,
               coalesce(sum(amount) filter (where section_code = 'no_imponible'), 0)::numeric as no_imponible
        from configured
      ), scenario as (
        select structure_row.*,
          afp.afp_name,
          afp.commission_rate,
          indicator.uf_month_end_clp,
          indicator.pension_health_cap_uf,
          indicator.unemployment_cap_uf,
          indicator.mandatory_pension_rate,
          indicator.health_rate,
          indicator.unemployment_indefinite_rate,
          indicator.period_month as indicator_period
        from public.hr_rent_structures structure_row
        left join lateral (
          select rate_row.afp_name, rate_row.commission_rate
          from public.hr_rent_afp_rates rate_row
          where rate_row.afp_code = structure_row.afp_code
            and rate_row.is_active
            and rate_row.effective_from <= month_start
            and (rate_row.effective_to is null or rate_row.effective_to >= month_start)
          order by rate_row.effective_from desc
          limit 1
        ) afp on true
        left join public.hr_rent_monthly_indicators indicator on indicator.period_month = month_start
        where structure_row.contract_id = p_contract_id
          and structure_row.job_position_id = p_job_position_id
          and structure_row.is_active = true
        limit 1
      ), calculated as (
        select s.*,
          t.imponible,
          t.no_imponible,
          least(t.imponible, s.pension_health_cap_uf * s.uf_month_end_clp) as pension_health_base,
          least(t.imponible, s.unemployment_cap_uf * s.uf_month_end_clp) as unemployment_base
        from scenario s cross join totals t
      ), amounts as (
        select c.*,
          round(c.pension_health_base * (c.mandatory_pension_rate + c.commission_rate), 0)::numeric as afp_amount,
          round(c.pension_health_base * c.health_rate, 0)::numeric as health_legal_amount,
          case c.health_mode
            when 'isapre_uf' then greatest(round(c.pension_health_base * c.health_rate, 0), round(c.health_plan_value * c.uf_month_end_clp, 0))
            when 'isapre_pesos' then greatest(round(c.pension_health_base * c.health_rate, 0), round(c.health_plan_value, 0))
            when 'isapre_percentage' then greatest(round(c.pension_health_base * c.health_rate, 0), round(c.pension_health_base * c.health_plan_value / 100, 0))
            else round(c.pension_health_base * c.health_rate, 0)
          end::numeric as health_total_amount,
          round(c.unemployment_base * case when c.unemployment_contract_type = 'indefinite' then c.unemployment_indefinite_rate else 0 end, 0)::numeric as unemployment_amount
        from calculated c
      ), legal as (
        select 'legal_afp'::text as id,
          coalesce(a.afp_name, 'AFP') || ' · 10% + comisión' as concept_name,
          a.afp_amount as amount,
          concat('Base $', trim(to_char(a.pension_health_base, 'FM999G999G999')), ' · tasa ', trim(to_char((a.mandatory_pension_rate + a.commission_rate) * 100, 'FM990D00')), '%') as detail,
          10 as sort_order
        from amounts a where a.indicator_period is not null and a.commission_rate is not null
        union all
        select 'legal_health', 'Cotiz. Salud Obligatoria', a.health_legal_amount,
          concat('Base $', trim(to_char(a.pension_health_base, 'FM999G999G999')), ' · ', trim(to_char(a.health_rate * 100, 'FM990D00')), '%'), 20
        from amounts a where a.indicator_period is not null and a.commission_rate is not null
        union all
        select 'legal_health_additional', 'Adicional plan de salud', greatest(a.health_total_amount - a.health_legal_amount, 0),
          case a.health_mode
            when 'isapre_uf' then concat(trim(to_char(a.health_plan_value, 'FM990D000')), ' UF · ', a.health_provider_name)
            when 'isapre_pesos' then concat('$', trim(to_char(a.health_plan_value, 'FM999G999G999')), ' · ', a.health_provider_name)
            when 'isapre_percentage' then concat(trim(to_char(a.health_plan_value, 'FM990D00')), '% · ', a.health_provider_name)
            else 'Sin adicional'
          end, 25
        from amounts a
        where a.indicator_period is not null and a.commission_rate is not null
          and a.health_total_amount > a.health_legal_amount
        union all
        select 'legal_unemployment', 'Seguro de Cesantía', a.unemployment_amount,
          case when a.unemployment_contract_type = 'indefinite'
            then concat('Contrato indefinido · ', trim(to_char(a.unemployment_indefinite_rate * 100, 'FM990D00')), '%')
            else 'Plazo fijo/obra · aporte trabajador 0%'
          end, 30
        from amounts a where a.indicator_period is not null and a.commission_rate is not null
      ), structure_data as (
        select a.*,
          (select jsonb_agg(jsonb_build_object(
            'id', c.id, 'concept_code', c.concept_code, 'concept_name', c.concept_name,
            'concept_type', c.concept_type, 'section_code', c.section_code,
            'calculation_mode', c.calculation_mode, 'amount', c.amount, 'sort_order', c.sort_order
          ) order by c.sort_order, c.concept_name) from configured c) as configured_lines,
          (select jsonb_agg(jsonb_build_object(
            'id', l.id, 'concept_code', l.id, 'concept_name', l.concept_name,
            'concept_type', 'legal_discount', 'section_code', 'legal_discount',
            'calculation_mode', 'legal_rate', 'amount', l.amount, 'detail', l.detail, 'sort_order', l.sort_order
          ) order by l.sort_order) from legal l) as legal_lines,
          (select coalesce(sum(l.amount), 0) from legal l) as legal_total
        from amounts a
      )
      select jsonb_build_object(
        'id', s.id,
        'job_position_id', s.job_position_id,
        'authorized_headcount', s.authorized_headcount,
        'monthly_budget', s.monthly_budget,
        'currency_code', s.currency_code,
        'calculation_available', s.indicator_period is not null and s.commission_rate is not null,
        'legal_scenario', jsonb_build_object(
          'afp_code', s.afp_code,
          'afp_name', coalesce(s.afp_name, s.afp_code),
          'afp_commission_rate', s.commission_rate,
          'health_mode', s.health_mode,
          'health_provider_name', s.health_provider_name,
          'health_plan_value', s.health_plan_value,
          'unemployment_contract_type', s.unemployment_contract_type,
          'uf_month_end_clp', s.uf_month_end_clp,
          'pension_health_cap_uf', s.pension_health_cap_uf,
          'unemployment_cap_uf', s.unemployment_cap_uf
        ),
        'lines', coalesce(s.configured_lines, '[]'::jsonb) || coalesce(s.legal_lines, '[]'::jsonb),
        'totals', jsonb_build_object(
          'imponible', s.imponible,
          'no_imponible', s.no_imponible,
          'haberes', s.imponible + s.no_imponible,
          'legal_discounts', case when s.indicator_period is null or s.commission_rate is null then null else s.legal_total end,
          'liquido_estimated', case when s.indicator_period is null or s.commission_rate is null then null else greatest(s.imponible + s.no_imponible - s.legal_total, 0) end
        ),
        'legal_assumptions', case
          when s.indicator_period is null then jsonb_build_array('No existe un indicador legal cargado para el mes seleccionado.')
          when s.commission_rate is null then jsonb_build_array('No existe una comisión vigente para la AFP seleccionada.')
          else jsonb_build_array(
            concat(coalesce(s.afp_name, s.afp_code), ': 10% + ', trim(to_char(s.commission_rate * 100, 'FM990D00')), '% de comisión'),
            concat('Salud: 7% legal', case when s.health_mode = 'fonasa' then ' · Fonasa' else ' + adicional de plan cuando corresponde' end),
            concat('Cesantía: ', case when s.unemployment_contract_type = 'indefinite' then '0,6% trabajador indefinido' else '0% trabajador a plazo fijo/obra' end),
            concat('UF cierre ', to_char(month_start, 'MM/YYYY'), ': $', trim(to_char(s.uf_month_end_clp, 'FM999G999G999D00')))
          )
        end
      ) from structure_data s
    ), '{}'::jsonb)
  );
end;
$function$;

create or replace function public.save_hr_rent_structure_config(
  p_contract_id bigint,
  p_job_position_id bigint,
  p_authorized_headcount integer,
  p_lines jsonb,
  p_afp_code text,
  p_health_mode text,
  p_health_provider_name text,
  p_health_plan_value numeric,
  p_unemployment_contract_type text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  current_user_id uuid := auth.uid();
  target_structure_id uuid;
  action_name text;
  snapshot jsonb;
  normalized_afp text := lower(trim(coalesce(p_afp_code, '')));
  normalized_health_mode text := lower(trim(coalesce(p_health_mode, '')));
  normalized_contract_type text := lower(trim(coalesce(p_unemployment_contract_type, '')));
begin
  if current_user_id is null or not public.user_can_manage_hr_rent_structures(current_user_id) then
    raise exception 'Sin permisos para configurar estructuras de renta';
  end if;
  if p_authorized_headcount is null or p_authorized_headcount < 0 then
    raise exception 'Los cupos autorizados deben ser un entero mayor o igual a cero';
  end if;
  if not exists (
    select 1 from public.buk_job_position_contract_access a
    where a.contract_id = p_contract_id and a.job_position_id = p_job_position_id and a.is_active = true
  ) then
    raise exception 'El cargo no está habilitado por BUK para el contrato seleccionado';
  end if;
  if not exists (select 1 from public.hr_rent_afp_rates r where r.afp_code = normalized_afp and r.is_active) then
    raise exception 'Selecciona una AFP válida';
  end if;
  if normalized_health_mode not in ('fonasa', 'isapre_uf', 'isapre_pesos', 'isapre_percentage') then
    raise exception 'Selecciona una modalidad de salud válida';
  end if;
  if normalized_health_mode <> 'fonasa' and coalesce(p_health_plan_value, 0) <= 0 then
    raise exception 'El plan de Isapre debe ser mayor que cero';
  end if;
  if normalized_contract_type not in ('indefinite', 'fixed_term') then
    raise exception 'Selecciona un tipo de contrato válido';
  end if;
  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' then
    raise exception 'La estructura de conceptos debe ser una lista';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) item
    where coalesce(nullif(trim(item->>'concept_code'), ''), '') = ''
      or coalesce(nullif(trim(item->>'concept_name'), ''), '') = ''
      or (item->>'section_code') not in ('imponible','no_imponible')
  ) then
    raise exception 'Cada concepto configurable requiere código, nombre y sección válida';
  end if;

  select id into target_structure_id
  from public.hr_rent_structures
  where contract_id = p_contract_id and job_position_id = p_job_position_id
  for update;
  action_name := case when target_structure_id is null then 'create' else 'update' end;

  insert into public.hr_rent_structures (
    contract_id, job_position_id, authorized_headcount, afp_code, health_mode,
    health_provider_name, health_plan_value, unemployment_contract_type, is_active
  ) values (
    p_contract_id, p_job_position_id, p_authorized_headcount, normalized_afp, normalized_health_mode,
    case when normalized_health_mode = 'fonasa' then 'Fonasa' else trim(coalesce(p_health_provider_name, 'Isapre')) end,
    case when normalized_health_mode = 'fonasa' then 0 else p_health_plan_value end,
    normalized_contract_type, true
  )
  on conflict (contract_id, job_position_id) do update set
    authorized_headcount = excluded.authorized_headcount,
    afp_code = excluded.afp_code,
    health_mode = excluded.health_mode,
    health_provider_name = excluded.health_provider_name,
    health_plan_value = excluded.health_plan_value,
    unemployment_contract_type = excluded.unemployment_contract_type,
    is_active = true,
    updated_at = timezone('utc', now())
  returning id into target_structure_id;

  update public.hr_rent_structure_lines as existing_line
  set is_active = false, updated_at = timezone('utc', now())
  where existing_line.structure_id = target_structure_id
    and existing_line.section_code in ('imponible','no_imponible');

  insert into public.hr_rent_structure_lines (
    structure_id, concept_code, concept_name, concept_type, section_code,
    calculation_mode, amount, sort_order, is_active
  )
  select target_structure_id,
    trim(item->>'concept_code'),
    trim(item->>'concept_name'),
    case when item->>'section_code' = 'no_imponible' then 'no_imponible' else 'imponible' end,
    item->>'section_code', 'fixed',
    greatest(coalesce((item->>'amount')::numeric, 0), 0),
    greatest(coalesce((item->>'sort_order')::integer, 100), 0), true
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) item
  on conflict (structure_id, concept_code) do update set
    concept_name = excluded.concept_name,
    concept_type = excluded.concept_type,
    section_code = excluded.section_code,
    calculation_mode = excluded.calculation_mode,
    amount = excluded.amount,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = timezone('utc', now());

  select jsonb_build_object(
    'contract_id', p_contract_id,
    'job_position_id', p_job_position_id,
    'authorized_headcount', p_authorized_headcount,
    'legal_scenario', jsonb_build_object(
      'afp_code', normalized_afp,
      'health_mode', normalized_health_mode,
      'health_provider_name', case when normalized_health_mode = 'fonasa' then 'Fonasa' else trim(coalesce(p_health_provider_name, 'Isapre')) end,
      'health_plan_value', case when normalized_health_mode = 'fonasa' then 0 else p_health_plan_value end,
      'unemployment_contract_type', normalized_contract_type
    ),
    'lines', coalesce(jsonb_agg(line_row.payload order by line_row.sort_order), '[]'::jsonb)
  ) into snapshot
  from (
    select line.sort_order, jsonb_build_object(
      'concept_code', line.concept_code,
      'concept_name', line.concept_name,
      'section_code', line.section_code,
      'amount', line.amount,
      'sort_order', line.sort_order
    ) payload
    from public.hr_rent_structure_lines line
    where line.structure_id = target_structure_id
      and line.is_active
      and line.section_code in ('imponible','no_imponible')
  ) line_row;

  insert into public.hr_rent_structure_audit (structure_id, action, snapshot, changed_by)
  values (target_structure_id, action_name, snapshot, current_user_id);
  return target_structure_id;
end;
$function$;

revoke all on function public.get_hr_rent_structure_control(bigint, bigint, date) from public, anon;
grant execute on function public.get_hr_rent_structure_control(bigint, bigint, date) to authenticated;
revoke all on function public.save_hr_rent_structure_config(bigint, bigint, integer, jsonb, text, text, text, numeric, text) from public, anon;
grant execute on function public.save_hr_rent_structure_config(bigint, bigint, integer, jsonb, text, text, text, numeric, text) to authenticated;

notify pgrst, 'reload schema';
commit;
