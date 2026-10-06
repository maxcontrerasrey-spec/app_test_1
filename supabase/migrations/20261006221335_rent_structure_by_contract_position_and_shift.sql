-- EEES-DB-005: approved
-- owner: Recursos Humanos / Gobierno de remuneraciones
-- rollback: forward-only; do not merge shift-specific structures back into a shared cargo row.

begin;

alter table public.hr_rent_structures
  add column if not exists shift_id bigint references public.shifts(id) on delete restrict;

-- Preserve the existing profile only when its old many-to-many mapping is unambiguous.
update public.hr_rent_structures structure_row
set shift_id = mapping.shift_id,
    updated_at = timezone('utc', now())
from (
  select structure_id, min(shift_id) as shift_id
  from public.hr_rent_structure_shifts
  group by structure_id
  having count(*) = 1
) mapping
where structure_row.id = mapping.structure_id
  and structure_row.shift_id is null;

alter table public.hr_rent_structures
  drop constraint if exists hr_rent_structures_contract_id_job_position_id_key;

create unique index if not exists hr_rent_structures_contract_position_shift_uidx
  on public.hr_rent_structures (contract_id, job_position_id, shift_id)
  where shift_id is not null;

create unique index if not exists hr_rent_structures_contract_position_unclassified_uidx
  on public.hr_rent_structures (contract_id, job_position_id)
  where shift_id is null;

create index if not exists hr_rent_structures_contract_position_shift_idx
  on public.hr_rent_structures (contract_id, job_position_id, shift_id, is_active);

create table public.hr_rent_position_shifts (
  contract_id bigint not null,
  job_position_id bigint not null,
  shift_id bigint not null references public.shifts(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (contract_id, job_position_id, shift_id),
  foreign key (contract_id, job_position_id)
    references public.hr_rent_contract_positions(contract_id, job_position_id) on delete cascade
);

insert into public.hr_rent_position_shifts (contract_id, job_position_id, shift_id)
select distinct structure_row.contract_id, structure_row.job_position_id, structure_row.shift_id
from public.hr_rent_structures structure_row
join public.shifts shift_row on shift_row.id = structure_row.shift_id and shift_row.is_active
where structure_row.is_active and structure_row.shift_id is not null
on conflict do nothing;

create index hr_rent_position_shifts_shift_id_idx
  on public.hr_rent_position_shifts (shift_id);
alter table public.hr_rent_position_shifts enable row level security;
create policy hr_rent_position_shifts_no_direct_access
  on public.hr_rent_position_shifts for all to authenticated using (false) with check (false);
revoke all on public.hr_rent_position_shifts from public, anon, authenticated;

comment on column public.hr_rent_structures.shift_id is
  'Una estructura de renta corresponde a una jornada única del catálogo de Solicitudes de Contratación; el nombre visible proviene de public.shifts.name.';

-- Keep the established legal calculator while scoping its result to one jornada profile.
create or replace function public.get_hr_rent_structure_detail_variant_base(
  p_contract_id bigint default null,
  p_job_position_id bigint,
  p_structure_id uuid,
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
        where structure_row.id = p_structure_id and structure_row.contract_id = p_contract_id and structure_row.job_position_id = p_job_position_id and structure_row.is_active = true
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
        where structure_row.id = p_structure_id
          and structure_row.contract_id = p_contract_id
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

create or replace function public.get_hr_rent_structure_detail_variant(
  p_contract_id bigint default null,
  p_job_position_id bigint,
  p_structure_id uuid,
  p_month date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  payload jsonb;
  structure_payload jsonb;
  include_tax boolean := false;
  social_security_discounts numeric;
  taxable_base numeric;
  utm_value numeric;
  utm_period date;
  bracket_factor numeric;
  bracket_rebate_utm numeric;
  bracket_lower_utm numeric;
  bracket_upper_utm numeric;
  income_tax numeric := 0;
  tax_available boolean := true;
  tax_line jsonb;
begin
  payload := public.get_hr_rent_structure_detail_variant_base(p_contract_id, p_job_position_id, p_structure_id, p_month);
  structure_payload := payload -> 'structure';

  if coalesce(structure_payload ->> 'id', '') = '' then
    return payload;
  end if;

  select structure_row.include_income_tax
  into include_tax
  from public.hr_rent_structures structure_row
  where structure_row.id = (structure_payload ->> 'id')::uuid;

  social_security_discounts := nullif(structure_payload #>> '{totals,legal_discounts}', '')::numeric;
  taxable_base := case
    when social_security_discounts is null then null
    else greatest((structure_payload #>> '{totals,imponible}')::numeric - social_security_discounts, 0)
  end;

  if include_tax then
    select utm.value_clp, utm.period_month
    into utm_value, utm_period
    from public.hr_rent_utm_values utm
    where utm.period_month <= date_trunc('month', current_date)::date
    order by utm.period_month desc
    limit 1;

    if taxable_base is null or utm_value is null then
      tax_available := false;
      income_tax := null;
    elsif taxable_base = 0 then
      income_tax := 0;
    else
      select bracket.factor, bracket.rebate_utm, bracket.lower_bound_utm, bracket.upper_bound_utm
      into bracket_factor, bracket_rebate_utm, bracket_lower_utm, bracket_upper_utm
      from public.hr_rent_iusc_brackets bracket
      where bracket.is_active
        and bracket.effective_from <= current_date
        and (bracket.effective_to is null or bracket.effective_to >= current_date)
        and taxable_base / utm_value > bracket.lower_bound_utm
        and (bracket.upper_bound_utm is null or taxable_base / utm_value <= bracket.upper_bound_utm)
      order by bracket.effective_from desc, bracket.lower_bound_utm desc
      limit 1;

      if bracket_factor is null then
        tax_available := false;
        income_tax := null;
      else
        income_tax := greatest(round(taxable_base * bracket_factor - bracket_rebate_utm * utm_value, 0), 0);
      end if;
    end if;
  end if;

  structure_payload := jsonb_set(
    structure_payload,
    '{legal_scenario,include_income_tax}',
    to_jsonb(include_tax),
    true
  );
  structure_payload := jsonb_set(
    structure_payload,
    '{legal_scenario,iusc_utm_clp}',
    case when include_tax and utm_value is not null then to_jsonb(utm_value) else 'null'::jsonb end,
    true
  );
  structure_payload := jsonb_set(
    structure_payload,
    '{totals,taxable_base}',
    case when taxable_base is null then 'null'::jsonb else to_jsonb(taxable_base) end,
    true
  );
  structure_payload := jsonb_set(
    structure_payload,
    '{totals,income_tax}',
    case when income_tax is null then 'null'::jsonb else to_jsonb(income_tax) end,
    true
  );

  if include_tax then
    structure_payload := jsonb_set(
      structure_payload,
      '{calculation_available}',
      to_jsonb(coalesce((structure_payload ->> 'calculation_available')::boolean, false) and tax_available),
      true
    );

    if tax_available then
      tax_line := jsonb_build_object(
        'id', 'legal_income_tax',
        'concept_code', 'legal_income_tax',
        'concept_name', 'Impuesto Único de Segunda Categoría',
        'concept_type', 'legal_discount',
        'section_code', 'legal_discount',
        'calculation_mode', 'legal_rate',
        'amount', income_tax,
        'detail', case
          when coalesce(bracket_factor, 0) = 0 then 'Exento según tramo SII vigente'
          else concat(
            'Factor ', trim(to_char(bracket_factor * 100, 'FM990D00')), '% · rebaja ',
            trim(to_char(bracket_rebate_utm, 'FM990D00')), ' UTM'
          )
        end,
        'sort_order', 40
      );
      structure_payload := jsonb_set(
        structure_payload,
        '{lines}',
        coalesce(structure_payload -> 'lines', '[]'::jsonb) || jsonb_build_array(tax_line),
        true
      );
      structure_payload := jsonb_set(
        structure_payload,
        '{totals,legal_discounts}',
        to_jsonb(social_security_discounts + income_tax),
        true
      );
      structure_payload := jsonb_set(
        structure_payload,
        '{totals,liquido_estimated}',
        to_jsonb(greatest((structure_payload #>> '{totals,haberes}')::numeric - social_security_discounts - income_tax, 0)),
        true
      );
      structure_payload := jsonb_set(
        structure_payload,
        '{legal_assumptions}',
        coalesce(structure_payload -> 'legal_assumptions', '[]'::jsonb) || jsonb_build_array(
          concat('Impuesto único estimado con UTM ', to_char(utm_period, 'MM/YYYY'), ' de $', trim(to_char(utm_value, 'FM999G999G990')))
        ),
        true
      );
    end if;
  end if;

  return jsonb_set(payload, '{structure}', structure_payload, true);
end;
$function$;

create or replace function public.get_hr_rent_structure_variant_control(
  p_contract_id bigint default null,
  p_job_position_id bigint default null,
  p_shift_id bigint default null,
  p_structure_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  payload jsonb;
  position_items jsonb := '[]'::jsonb;
  shift_catalog jsonb := '[]'::jsonb;
  selected_structure jsonb := 'null'::jsonb;
  selected_structure_id uuid;
  selected_shift_id bigint;
  selected_shift_name text;
  selected_regime_code text;
begin
  payload := public.get_hr_rent_structure_control_before_shift_regime(
    p_contract_id, p_job_position_id
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', shift_row.id,
    'name', shift_row.name
  ) order by shift_row.name), '[]'::jsonb)
  into shift_catalog
  from public.shifts shift_row
  where shift_row.is_active = true;

  if p_contract_id is not null then
    select coalesce(jsonb_agg(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(position_item, '{authorized_headcount}', to_jsonb(stats.authorized_headcount), true),
              '{monthly_budget}', coalesce(to_jsonb(stats.monthly_budget), 'null'::jsonb), true
            ),
            '{has_structure}', to_jsonb(stats.structure_count > 0), true
          ),
          '{structure_variants}', stats.variants, true
        ),
        '{applicable_shift_ids}', stats.applicable_shift_ids, true
      )
      order by position_item ->> 'name'
    ), '[]'::jsonb)
    into position_items
    from jsonb_array_elements(coalesce(payload -> 'positions', '[]'::jsonb)) position_catalog(position_item)
    cross join lateral (
      select count(*)::integer as structure_count,
        coalesce(sum(structure_row.authorized_headcount), 0)::integer as authorized_headcount,
        sum(structure_row.monthly_budget) as monthly_budget,
        coalesce(jsonb_agg(jsonb_build_object(
          'id', structure_row.id,
          'shift_id', structure_row.shift_id,
          'shift_name', shift_row.name,
          'legal_regime_code', structure_row.legal_regime_code,
          'authorized_headcount', structure_row.authorized_headcount
        ) order by shift_row.name nulls first, structure_row.created_at, structure_row.id), '[]'::jsonb) as variants,
        coalesce((
          select jsonb_agg(position_shift.shift_id order by applied_shift.name)
          from public.hr_rent_position_shifts position_shift
          join public.shifts applied_shift on applied_shift.id = position_shift.shift_id
          where position_shift.contract_id = p_contract_id
            and position_shift.job_position_id = (position_item ->> 'id')::bigint
        ), '[]'::jsonb) as applicable_shift_ids
      from public.hr_rent_structures structure_row
      left join public.shifts shift_row on shift_row.id = structure_row.shift_id
      where structure_row.contract_id = p_contract_id
        and structure_row.job_position_id = (position_item ->> 'id')::bigint
        and structure_row.is_active = true
    ) stats;
    payload := jsonb_set(payload, '{positions}', position_items, true);
  end if;

  if p_contract_id is not null and p_job_position_id is not null then
    if p_structure_id is not null then
      select structure_row.id, structure_row.shift_id, shift_row.name, structure_row.legal_regime_code
      into selected_structure_id, selected_shift_id, selected_shift_name, selected_regime_code
      from public.hr_rent_structures structure_row
      left join public.shifts shift_row on shift_row.id = structure_row.shift_id
      where structure_row.id = p_structure_id
        and structure_row.contract_id = p_contract_id
        and structure_row.job_position_id = p_job_position_id
      and structure_row.is_active = true;
      if found and selected_shift_id is not null and p_shift_id is not null and selected_shift_id <> p_shift_id then
        raise exception 'La jornada seleccionada no corresponde a esta estructura';
      end if;
    elsif p_shift_id is not null then
      select structure_row.id, structure_row.shift_id, shift_row.name, structure_row.legal_regime_code
      into selected_structure_id, selected_shift_id, selected_shift_name, selected_regime_code
      from public.hr_rent_structures structure_row
      join public.shifts shift_row on shift_row.id = structure_row.shift_id
      where structure_row.contract_id = p_contract_id
        and structure_row.job_position_id = p_job_position_id
        and structure_row.shift_id = p_shift_id
        and structure_row.is_active = true;
    else
      select structure_row.id, structure_row.shift_id, shift_row.name, structure_row.legal_regime_code
      into selected_structure_id, selected_shift_id, selected_shift_name, selected_regime_code
      from public.hr_rent_structures structure_row
      left join public.shifts shift_row on shift_row.id = structure_row.shift_id
      where structure_row.contract_id = p_contract_id
        and structure_row.job_position_id = p_job_position_id
        and structure_row.shift_id is null
        and structure_row.is_active = true
      order by structure_row.created_at, structure_row.id
      limit 1;
    end if;

    if selected_structure_id is not null then
      selected_structure := public.get_hr_rent_structure_detail_variant(
        p_contract_id, p_job_position_id, selected_structure_id, current_date
      ) -> 'structure';
      selected_structure := jsonb_set(selected_structure, '{shift_id}', coalesce(to_jsonb(selected_shift_id), 'null'::jsonb), true);
      selected_structure := jsonb_set(selected_structure, '{shift_name}', coalesce(to_jsonb(selected_shift_name), 'null'::jsonb), true);
      selected_structure := jsonb_set(selected_structure, '{legal_regime_code}', coalesce(to_jsonb(selected_regime_code), 'null'::jsonb), true);
      selected_structure := jsonb_set(selected_structure, '{shift_ids}', case when selected_shift_id is null then '[]'::jsonb else jsonb_build_array(selected_shift_id) end, true);
      selected_structure := jsonb_set(selected_structure, '{shift_classification_pending}', to_jsonb(selected_shift_id is null or selected_regime_code is null), true);
    end if;
  end if;

  payload := jsonb_set(payload, '{structure}', selected_structure, true);
  payload := jsonb_set(payload, '{shift_catalog}', shift_catalog, true);
  return payload;
end;
$function$;

revoke all on function public.get_hr_rent_structure_detail_variant_base(bigint, bigint, uuid, date) from public, anon, authenticated;
revoke all on function public.get_hr_rent_structure_detail_variant(bigint, bigint, uuid, date) from public, anon, authenticated;
revoke all on function public.get_hr_rent_structure_variant_control(bigint, bigint, bigint, uuid) from public, anon;
grant execute on function public.get_hr_rent_structure_variant_control(bigint, bigint, bigint, uuid) to authenticated;

create or replace function public.save_hr_rent_structure_variant(
  p_contract_id bigint,
  p_job_position_id bigint,
  p_structure_id uuid,
  p_shift_id bigint,
  p_authorized_headcount integer,
  p_lines jsonb,
  p_afp_code text,
  p_health_mode text,
  p_health_provider_name text,
  p_health_plan_value numeric,
  p_unemployment_contract_type text,
  p_include_income_tax boolean,
  p_legal_regime_code text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  current_user_id uuid := auth.uid();
  target_structure_id uuid := p_structure_id;
  action_name text;
  normalized_afp text := lower(trim(coalesce(p_afp_code, '')));
  normalized_health_mode text := lower(trim(coalesce(p_health_mode, '')));
  normalized_contract_type text := lower(trim(coalesce(p_unemployment_contract_type, '')));
  normalized_health_provider text;
  normalized_health_plan numeric;
  snapshot jsonb;
begin
  if current_user_id is null or not public.current_user_can_configure_hr_rent_structures() then
    raise exception 'Sin permisos para configurar estructuras de renta';
  end if;
  if p_contract_id is null or p_job_position_id is null then
    raise exception 'Selecciona un contrato y un cargo';
  end if;
  if p_shift_id is null or not exists (
    select 1 from public.shifts shift_row where shift_row.id = p_shift_id and shift_row.is_active = true
  ) then
    raise exception 'Selecciona una jornada activa para esta estructura';
  end if;
  if not exists (
    select 1 from public.hr_rent_position_shifts applicable
    where applicable.contract_id = p_contract_id
      and applicable.job_position_id = p_job_position_id
      and applicable.shift_id = p_shift_id
  ) then
    raise exception 'Esta jornada no está habilitada para el cargo. Guarda primero las jornadas aplicables.';
  end if;
  if p_legal_regime_code is null or p_legal_regime_code not in ('art_25', 'ordinario') then
    raise exception 'Selecciona un régimen legal válido';
  end if;
  if p_authorized_headcount is null or p_authorized_headcount < 0 then
    raise exception 'Los cupos autorizados deben ser un entero mayor o igual a cero';
  end if;
  if not exists (
    select 1
    from public.hr_rent_contract_positions relation_row
    join public.buk_job_position_contract_access access_row
      on access_row.contract_id = relation_row.contract_id
     and access_row.job_position_id = relation_row.job_position_id
     and access_row.is_active = true
    join public.job_positions position_row
      on position_row.id = relation_row.job_position_id
     and position_row.is_active = true
    where relation_row.contract_id = p_contract_id
      and relation_row.job_position_id = p_job_position_id
      and relation_row.is_active = true
  ) then
    raise exception 'El cargo ya no está activo en BUK para el contrato seleccionado';
  end if;
  if not exists (select 1 from public.hr_rent_afp_rates rate_row where rate_row.afp_code = normalized_afp and rate_row.is_active) then
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
  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' or exists (
    select 1 from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) item
    where coalesce(nullif(trim(item->>'concept_code'), ''), '') = ''
      or coalesce(nullif(trim(item->>'concept_name'), ''), '') = ''
      or item->>'section_code' not in ('imponible', 'no_imponible')
  ) then
    raise exception 'Cada concepto configurable requiere código, nombre y sección válida';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_contract_id::text || ':' || p_job_position_id::text || ':rent-structure', 0
  ));

  if target_structure_id is not null then
    perform 1
    from public.hr_rent_structures structure_row
    where structure_row.id = target_structure_id
      and structure_row.contract_id = p_contract_id
      and structure_row.job_position_id = p_job_position_id
      and structure_row.is_active = true
    for update;
    if not found then
      raise exception 'La estructura seleccionada ya no está disponible';
    end if;
    if exists (
      select 1 from public.hr_rent_structures other_row
      where other_row.contract_id = p_contract_id
        and other_row.job_position_id = p_job_position_id
        and other_row.shift_id = p_shift_id
        and other_row.is_active = true
        and other_row.id <> target_structure_id
    ) then
      raise exception 'Ya existe una estructura para esa jornada; selecciónala para editarla';
    end if;
    action_name := 'update';
  else
    select structure_row.id into target_structure_id
    from public.hr_rent_structures structure_row
    where structure_row.contract_id = p_contract_id
      and structure_row.job_position_id = p_job_position_id
      and structure_row.shift_id = p_shift_id
      and structure_row.is_active = false
    for update;
    if target_structure_id is not null then
      action_name := 'update';
    end if;
    if exists (
      select 1 from public.hr_rent_structures other_row
      where other_row.contract_id = p_contract_id
        and other_row.job_position_id = p_job_position_id
        and other_row.shift_id = p_shift_id
        and other_row.is_active = true
    ) then
      raise exception 'Ya existe una estructura para esa jornada; selecciónala para editarla';
    end if;
    if target_structure_id is null then action_name := 'create'; end if;
  end if;

  normalized_health_provider := case when normalized_health_mode = 'fonasa' then 'Fonasa' else trim(coalesce(p_health_provider_name, 'Isapre')) end;
  normalized_health_plan := case when normalized_health_mode = 'fonasa' then 0 else p_health_plan_value end;

  if target_structure_id is null then
    insert into public.hr_rent_structures (
      contract_id, job_position_id, shift_id, authorized_headcount, afp_code,
      health_mode, health_provider_name, health_plan_value, unemployment_contract_type,
      include_income_tax, legal_regime_code, is_active
    ) values (
      p_contract_id, p_job_position_id, p_shift_id, p_authorized_headcount, normalized_afp,
      normalized_health_mode, normalized_health_provider, normalized_health_plan, normalized_contract_type,
      coalesce(p_include_income_tax, false), p_legal_regime_code, true
    ) returning id into target_structure_id;
  else
    update public.hr_rent_structures
    set shift_id = p_shift_id,
        authorized_headcount = p_authorized_headcount,
        afp_code = normalized_afp,
        health_mode = normalized_health_mode,
        health_provider_name = normalized_health_provider,
        health_plan_value = normalized_health_plan,
        unemployment_contract_type = normalized_contract_type,
        include_income_tax = coalesce(p_include_income_tax, false),
        legal_regime_code = p_legal_regime_code,
        is_active = true,
        updated_at = timezone('utc', now())
    where id = target_structure_id;
  end if;

  delete from public.hr_rent_structure_shifts link where link.structure_id = target_structure_id;
  insert into public.hr_rent_structure_shifts (structure_id, shift_id) values (target_structure_id, p_shift_id);

  update public.hr_rent_structure_lines line_row
  set is_active = false, updated_at = timezone('utc', now())
  where line_row.structure_id = target_structure_id
    and line_row.section_code in ('imponible', 'no_imponible');

  insert into public.hr_rent_structure_lines (
    structure_id, concept_code, concept_name, concept_type, section_code,
    calculation_mode, amount, sort_order, is_active
  )
  select target_structure_id, trim(item->>'concept_code'), trim(item->>'concept_name'),
    case when item->>'section_code' = 'no_imponible' then 'no_imponible' else 'imponible' end,
    item->>'section_code', 'fixed', greatest(coalesce((item->>'amount')::numeric, 0), 0),
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
    'structure_id', target_structure_id,
    'shift_id', p_shift_id,
    'shift_name', shift_row.name,
    'legal_regime_code', p_legal_regime_code,
    'authorized_headcount', p_authorized_headcount,
    'legal_scenario', jsonb_build_object(
      'afp_code', normalized_afp,
      'health_mode', normalized_health_mode,
      'health_provider_name', normalized_health_provider,
      'health_plan_value', normalized_health_plan,
      'unemployment_contract_type', normalized_contract_type,
      'include_income_tax', coalesce(p_include_income_tax, false)
    ),
    'lines', coalesce(jsonb_agg(jsonb_build_object(
      'concept_code', line_row.concept_code,
      'concept_name', line_row.concept_name,
      'section_code', line_row.section_code,
      'amount', line_row.amount,
      'sort_order', line_row.sort_order
    ) order by line_row.sort_order), '[]'::jsonb)
  ) into snapshot
  from public.shifts shift_row
  left join public.hr_rent_structure_lines line_row
    on line_row.structure_id = target_structure_id
   and line_row.is_active
   and line_row.section_code in ('imponible', 'no_imponible')
  where shift_row.id = p_shift_id
  group by shift_row.name;

  insert into public.hr_rent_structure_audit (structure_id, action, snapshot, changed_by)
  values (target_structure_id, action_name, snapshot, current_user_id);

  return target_structure_id;
exception when unique_violation then
  raise exception 'Ya existe una estructura para esa jornada; selecciónala para editarla';
end;
$function$;

revoke all on function public.save_hr_rent_structure_variant(bigint, bigint, uuid, bigint, integer, jsonb, text, text, text, numeric, text, boolean, text) from public, anon;
grant execute on function public.save_hr_rent_structure_variant(bigint, bigint, uuid, bigint, integer, jsonb, text, text, text, numeric, text, boolean, text) to authenticated;

create or replace function public.save_hr_rent_position_shifts(
  p_contract_id bigint,
  p_job_position_id bigint,
  p_shift_ids bigint[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  requested_count integer;
  active_count integer;
begin
  if auth.uid() is null or not public.current_user_can_configure_hr_rent_structures() then
    raise exception 'Sin permisos para configurar estructuras de renta';
  end if;
  if p_contract_id is null or p_job_position_id is null or not exists (
    select 1 from public.hr_rent_contract_positions relation_row
    join public.job_positions position_row
      on position_row.id = relation_row.job_position_id and position_row.is_active
    join public.buk_job_position_contract_access access_row
      on access_row.contract_id = relation_row.contract_id
     and access_row.job_position_id = relation_row.job_position_id
     and access_row.is_active
    where relation_row.contract_id = p_contract_id
      and relation_row.job_position_id = p_job_position_id
      and relation_row.is_active
  ) then
    raise exception 'El cargo ya no está activo en BUK para el contrato seleccionado';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_contract_id::text || ':' || p_job_position_id::text || ':rent-structure', 0
  ));
  select count(distinct shift_id)::integer into requested_count
  from unnest(coalesce(p_shift_ids, '{}'::bigint[])) as requested(shift_id);
  select count(*)::integer into active_count
  from public.shifts shift_row
  where shift_row.id = any(coalesce(p_shift_ids, '{}'::bigint[])) and shift_row.is_active;
  if requested_count <> cardinality(coalesce(p_shift_ids, '{}'::bigint[])) or active_count <> requested_count then
    raise exception 'Una o más jornadas seleccionadas no están activas o están duplicadas';
  end if;
  if exists (
    select 1 from public.hr_rent_structures structure_row
    where structure_row.contract_id = p_contract_id
      and structure_row.job_position_id = p_job_position_id
      and structure_row.is_active and structure_row.shift_id is not null
      and not (structure_row.shift_id = any(coalesce(p_shift_ids, '{}'::bigint[])))
  ) then
    raise exception 'No puedes quitar una jornada que ya tiene una estructura vigente';
  end if;

  delete from public.hr_rent_position_shifts applicable
  where applicable.contract_id = p_contract_id and applicable.job_position_id = p_job_position_id;
  insert into public.hr_rent_position_shifts (contract_id, job_position_id, shift_id)
  select p_contract_id, p_job_position_id, requested.shift_id
  from unnest(coalesce(p_shift_ids, '{}'::bigint[])) as requested(shift_id);
end;
$function$;

revoke all on function public.save_hr_rent_position_shifts(bigint, bigint, bigint[]) from public, anon;
grant execute on function public.save_hr_rent_position_shifts(bigint, bigint, bigint[]) to authenticated;

revoke all on function public.save_hr_rent_structure_config(bigint, bigint, integer, jsonb, text, text, text, numeric, text, boolean, bigint[], text) from public, anon, authenticated;
revoke all on function public.save_hr_rent_structure_config(bigint, bigint, integer, jsonb, text, text, text, numeric, text, boolean) from public, anon, authenticated;
revoke all on function public.save_hr_rent_structure_config(bigint, bigint, integer, jsonb, text, text, text, numeric, text) from public, anon, authenticated;
revoke all on function public.save_hr_rent_structure_config(bigint, bigint, integer, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
