-- EEES-DB-005: approved
-- owner: Recursos Humanos / Gobierno de remuneraciones
-- rollback: forward-only; restaurar el contrato RPC anterior mediante una migración posterior.

begin;

create or replace function public.get_hr_rent_structure_control(
  p_contract_id bigint default null,
  p_job_position_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not public.user_can_manage_hr_rent_structures(current_user_id) then
    raise exception 'Sin permisos para consultar estructuras de renta';
  end if;

  return jsonb_build_object(
    'can_configure', public.user_can_manage_hr_rent_structures(current_user_id),
    'legal_catalog', jsonb_build_object(
      'afps', coalesce((
        select jsonb_agg(jsonb_build_object(
          'code', afp.afp_code,
          'name', afp.afp_name,
          'commission_rate', afp.commission_rate
        ) order by afp.afp_name)
        from (
          select distinct on (rate_row.afp_code)
            rate_row.afp_code, rate_row.afp_name, rate_row.commission_rate
          from public.hr_rent_afp_rates rate_row
          where rate_row.is_active
            and rate_row.effective_from <= current_date
            and (rate_row.effective_to is null or rate_row.effective_to >= current_date)
          order by rate_row.afp_code, rate_row.effective_from desc
        ) afp
      ), '[]'::jsonb)
    ),
    'contracts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', contract_row.id,
        'code', contract_row.code,
        'contract_number', contract_row.contract_number,
        'contract_name', contract_row.contract_name
      ) order by
        case when contract_row.contract_name ilike 'CODELCO%DSAL%' then 0 else 1 end,
        contract_row.contract_name)
      from (
        select distinct c.id, c.code, c.contract_number,
          coalesce(nullif(trim(bcm.buk_area_name), ''), c.contract_name) as contract_name
        from public.contracts c
        join public.buk_contract_mappings bcm on bcm.contract_id = c.id
          and bcm.is_operational = true
          and bcm.is_one_to_one = true
        where c.is_active = true
          and (c.contract_name ilike '%DSAL%' or bcm.buk_area_name ilike '%DSAL%')
      ) contract_row
    ), '[]'::jsonb),
    'positions', coalesce((
      with position_rows as (
        select
          jp.id,
          jp.code,
          jp.name,
          hrs.id as structure_id,
          hrs.authorized_headcount,
          hrs.monthly_budget,
          coalesce(hrs.currency_code, 'CLP') as currency_code,
          count(distinct employee.buk_employee_id)::integer as contracted_count
        from public.buk_job_position_contract_access access_row
        join public.job_positions jp
          on jp.id = access_row.job_position_id
         and jp.is_active = true
        left join public.hr_rent_structures hrs
          on hrs.contract_id = access_row.contract_id
         and hrs.job_position_id = jp.id
         and hrs.is_active = true
        left join public.employees_active_current employee
          on case
               when (employee.raw_payload #>> '{current_job,role,id}') ~ '^[0-9]+$'
                 then (employee.raw_payload #>> '{current_job,role,id}')::bigint
               else null
             end = access_row.buk_role_id
         and case
               when (employee.raw_payload #>> '{current_job,area_id}') ~ '^[0-9]+$'
                 then (employee.raw_payload #>> '{current_job,area_id}')::bigint
               else null
             end = access_row.buk_area_id
        where access_row.contract_id = p_contract_id
          and access_row.is_active = true
        group by jp.id, jp.code, jp.name, hrs.id, hrs.authorized_headcount,
          hrs.monthly_budget, hrs.currency_code
      )
      select jsonb_agg(jsonb_build_object(
        'id', position_row.id,
        'code', position_row.code,
        'name', position_row.name,
        'has_structure', position_row.structure_id is not null,
        'authorized_headcount', coalesce(position_row.authorized_headcount, 0),
        'monthly_budget', position_row.monthly_budget,
        'currency_code', position_row.currency_code,
        'contracted_count', position_row.contracted_count,
        'balance', case
          when position_row.structure_id is null then null
          else coalesce(position_row.authorized_headcount, 0) - position_row.contracted_count
        end,
        'coverage', case
          when coalesce(position_row.authorized_headcount, 0) = 0 then null
          else round(position_row.contracted_count::numeric / position_row.authorized_headcount, 4)
        end
      ) order by position_row.name)
      from position_rows position_row
    ), '[]'::jsonb),
    'structure', coalesce((
      with configured as (
        select line.id, line.concept_code, line.concept_name, line.concept_type,
          line.section_code, line.calculation_mode, line.amount, line.sort_order
        from public.hr_rent_structures structure_row
        join public.hr_rent_structure_lines line
          on line.structure_id = structure_row.id
         and line.is_active = true
        where structure_row.contract_id = p_contract_id
          and structure_row.job_position_id = p_job_position_id
          and structure_row.is_active = true
      ), totals as (
        select
          coalesce(sum(amount) filter (where section_code = 'imponible'), 0)::numeric as imponible,
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
          indicator.unemployment_indefinite_rate
        from public.hr_rent_structures structure_row
        left join lateral (
          select rate_row.afp_name, rate_row.commission_rate
          from public.hr_rent_afp_rates rate_row
          where rate_row.afp_code = structure_row.afp_code
            and rate_row.is_active
            and rate_row.effective_from <= current_date
            and (rate_row.effective_to is null or rate_row.effective_to >= current_date)
          order by rate_row.effective_from desc
          limit 1
        ) afp on true
        left join lateral (
          select indicator_row.*
          from public.hr_rent_monthly_indicators indicator_row
          where indicator_row.period_month <= date_trunc('month', current_date)::date
          order by indicator_row.period_month desc
          limit 1
        ) indicator on true
        where structure_row.contract_id = p_contract_id
          and structure_row.job_position_id = p_job_position_id
          and structure_row.is_active = true
        limit 1
      ), calculated as (
        select scenario.*,
          totals.imponible,
          totals.no_imponible,
          least(totals.imponible, scenario.pension_health_cap_uf * scenario.uf_month_end_clp) as pension_health_base,
          least(totals.imponible, scenario.unemployment_cap_uf * scenario.uf_month_end_clp) as unemployment_base
        from scenario cross join totals
      ), amounts as (
        select calculated.*,
          round(calculated.pension_health_base * (calculated.mandatory_pension_rate + calculated.commission_rate), 0)::numeric as afp_amount,
          round(calculated.pension_health_base * calculated.health_rate, 0)::numeric as health_legal_amount,
          case calculated.health_mode
            when 'isapre_uf' then greatest(
              round(calculated.pension_health_base * calculated.health_rate, 0),
              round(calculated.health_plan_value * calculated.uf_month_end_clp, 0)
            )
            when 'isapre_pesos' then greatest(
              round(calculated.pension_health_base * calculated.health_rate, 0),
              round(calculated.health_plan_value, 0)
            )
            when 'isapre_percentage' then greatest(
              round(calculated.pension_health_base * calculated.health_rate, 0),
              round(calculated.pension_health_base * calculated.health_plan_value / 100, 0)
            )
            else round(calculated.pension_health_base * calculated.health_rate, 0)
          end::numeric as health_total_amount,
          round(calculated.unemployment_base * case
            when calculated.unemployment_contract_type = 'indefinite'
              then calculated.unemployment_indefinite_rate
            else 0
          end, 0)::numeric as unemployment_amount
        from calculated
      ), legal as (
        select 'legal_afp'::text as id,
          coalesce(amounts.afp_name, 'AFP') || ' · cotización obligatoria' as concept_name,
          amounts.afp_amount as amount,
          concat(trim(to_char((amounts.mandatory_pension_rate + amounts.commission_rate) * 100, 'FM990D00')), '% sobre imponible') as detail,
          10 as sort_order
        from amounts
        where amounts.commission_rate is not null and amounts.uf_month_end_clp is not null
        union all
        select 'legal_health', 'Cotización de salud', amounts.health_legal_amount,
          concat(trim(to_char(amounts.health_rate * 100, 'FM990D00')), '% sobre imponible'), 20
        from amounts
        where amounts.commission_rate is not null and amounts.uf_month_end_clp is not null
        union all
        select 'legal_health_additional', 'Adicional plan de salud',
          greatest(amounts.health_total_amount - amounts.health_legal_amount, 0),
          concat(amounts.health_provider_name, ' · plan configurado'), 25
        from amounts
        where amounts.commission_rate is not null
          and amounts.uf_month_end_clp is not null
          and amounts.health_total_amount > amounts.health_legal_amount
        union all
        select 'legal_unemployment', 'Seguro de cesantía', amounts.unemployment_amount,
          case
            when amounts.unemployment_contract_type = 'indefinite'
              then concat(trim(to_char(amounts.unemployment_indefinite_rate * 100, 'FM990D00')), '% trabajador')
            else 'Sin descuento al trabajador'
          end, 30
        from amounts
        where amounts.commission_rate is not null and amounts.uf_month_end_clp is not null
      ), structure_data as (
        select amounts.*,
          (select jsonb_agg(jsonb_build_object(
            'id', configured.id,
            'concept_code', configured.concept_code,
            'concept_name', configured.concept_name,
            'concept_type', configured.concept_type,
            'section_code', configured.section_code,
            'calculation_mode', configured.calculation_mode,
            'amount', configured.amount,
            'sort_order', configured.sort_order
          ) order by configured.sort_order, configured.concept_name) from configured) as configured_lines,
          (select jsonb_agg(jsonb_build_object(
            'id', legal.id,
            'concept_code', legal.id,
            'concept_name', legal.concept_name,
            'concept_type', 'legal_discount',
            'section_code', 'legal_discount',
            'calculation_mode', 'legal_rate',
            'amount', legal.amount,
            'detail', legal.detail,
            'sort_order', legal.sort_order
          ) order by legal.sort_order) from legal) as legal_lines,
          (select coalesce(sum(legal.amount), 0) from legal) as legal_total
        from amounts
      )
      select jsonb_build_object(
        'id', structure_data.id,
        'job_position_id', structure_data.job_position_id,
        'authorized_headcount', structure_data.authorized_headcount,
        'monthly_budget', structure_data.monthly_budget,
        'currency_code', structure_data.currency_code,
        'calculation_available', structure_data.uf_month_end_clp is not null
          and structure_data.commission_rate is not null,
        'legal_scenario', jsonb_build_object(
          'afp_code', structure_data.afp_code,
          'afp_name', coalesce(structure_data.afp_name, structure_data.afp_code),
          'afp_commission_rate', structure_data.commission_rate,
          'health_mode', structure_data.health_mode,
          'health_provider_name', structure_data.health_provider_name,
          'health_plan_value', structure_data.health_plan_value,
          'unemployment_contract_type', structure_data.unemployment_contract_type
        ),
        'lines', coalesce(structure_data.configured_lines, '[]'::jsonb)
          || coalesce(structure_data.legal_lines, '[]'::jsonb),
        'totals', jsonb_build_object(
          'imponible', structure_data.imponible,
          'no_imponible', structure_data.no_imponible,
          'haberes', structure_data.imponible + structure_data.no_imponible,
          'pension_health_base', structure_data.pension_health_base,
          'unemployment_base', structure_data.unemployment_base,
          'legal_discounts', case
            when structure_data.uf_month_end_clp is null or structure_data.commission_rate is null then null
            else structure_data.legal_total
          end,
          'liquido_estimated', case
            when structure_data.uf_month_end_clp is null or structure_data.commission_rate is null then null
            else greatest(structure_data.imponible + structure_data.no_imponible - structure_data.legal_total, 0)
          end,
          'authorized_payroll', (structure_data.imponible + structure_data.no_imponible)
            * structure_data.authorized_headcount
        ),
        'legal_assumptions', case
          when structure_data.uf_month_end_clp is null then
            jsonb_build_array('No existen parámetros legales vigentes para calcular la estimación.')
          when structure_data.commission_rate is null then
            jsonb_build_array('No existe una comisión vigente para la AFP configurada.')
          else jsonb_build_array(
            concat(coalesce(structure_data.afp_name, structure_data.afp_code), ': 10% obligatorio + ', trim(to_char(structure_data.commission_rate * 100, 'FM990D00')), '% de comisión'),
            concat('Salud: ', trim(to_char(structure_data.health_rate * 100, 'FM990D00')), '% legal', case when structure_data.health_mode = 'fonasa' then ' · Fonasa' else ' + adicional del plan configurado' end),
            concat('Cesantía: ', case when structure_data.unemployment_contract_type = 'indefinite' then '0,6% trabajador' else 'sin descuento al trabajador' end)
          )
        end
      )
      from structure_data
    ), '{}'::jsonb)
  );
end;
$function$;

-- Compatibilidad transitoria para pestañas que todavía conserven el bundle anterior.
-- El argumento de fecha se ignora porque esta vista define una estructura permanente por cargo.
drop function public.get_hr_rent_structure_control(bigint, bigint, date);

create or replace function public.get_hr_rent_structure_control(
  p_contract_id bigint,
  p_job_position_id bigint,
  p_month date
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select public.get_hr_rent_structure_control(p_contract_id, p_job_position_id);
$function$;

revoke all on function public.get_hr_rent_structure_control(bigint, bigint) from public, anon;
grant execute on function public.get_hr_rent_structure_control(bigint, bigint) to authenticated;
revoke all on function public.get_hr_rent_structure_control(bigint, bigint, date) from public, anon;
grant execute on function public.get_hr_rent_structure_control(bigint, bigint, date) to authenticated;

notify pgrst, 'reload schema';

commit;
