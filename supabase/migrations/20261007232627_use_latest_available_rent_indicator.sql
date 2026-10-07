-- EEES-DB-005: approved
-- owner: Recursos Humanos / Gobierno de remuneraciones
-- rollback: forward-only; resolve the latest complete stored indicator for the requested month.

begin;

create or replace function public.get_hr_rent_structure_detail_variant_base(
  p_contract_id bigint,
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
        where indicator.period_month <= month_start
        order by indicator.period_month desc
        limit 1
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
    -- This helper is consumed only for one selected structure. The position
    -- catalog comes from the control RPC and does not belong in this detail read.
    'positions', '[]'::jsonb,
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
        left join lateral (
          select indicator_row.*
          from public.hr_rent_monthly_indicators indicator_row
          where indicator_row.period_month <= month_start
          order by indicator_row.period_month desc
          limit 1
        ) indicator on true
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
        'requested_month', to_char(month_start, 'YYYY-MM'),
        'indicator_period', to_char(s.indicator_period, 'YYYY-MM'),
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
          'pension_health_base', s.pension_health_base,
          'unemployment_base', s.unemployment_base,
          'legal_discounts', case when s.indicator_period is null or s.commission_rate is null then null else s.legal_total end,
          'liquido_estimated', case when s.indicator_period is null or s.commission_rate is null then null else greatest(s.imponible + s.no_imponible - s.legal_total, 0) end
        ),
        'legal_assumptions', case
          when s.indicator_period is null then jsonb_build_array('No existe un indicador legal disponible para el mes seleccionado ni para uno anterior.')
          when s.commission_rate is null then jsonb_build_array('No existe una comisión vigente para la AFP seleccionada.')
          else jsonb_build_array(
            concat(coalesce(s.afp_name, s.afp_code), ': 10% + ', trim(to_char(s.commission_rate * 100, 'FM990D00')), '% de comisión'),
            concat('Salud: 7% legal', case when s.health_mode = 'fonasa' then ' · Fonasa' else ' + adicional de plan cuando corresponde' end),
            concat('Cesantía: ', case when s.unemployment_contract_type = 'indefinite' then '0,6% trabajador indefinido' else '0% trabajador a plazo fijo/obra' end),
            concat('UF de cierre del período ', to_char(s.indicator_period, 'MM/YYYY'), ': $', trim(to_char(s.uf_month_end_clp, 'FM999G999G999D00')))
          )
        end
      ) from structure_data s
    ), '{}'::jsonb)
  );
end;
$function$;

revoke all on function public.get_hr_rent_structure_detail_variant_base(bigint, bigint, uuid, date)
  from public, anon, authenticated;
notify pgrst, 'reload schema';

commit;
