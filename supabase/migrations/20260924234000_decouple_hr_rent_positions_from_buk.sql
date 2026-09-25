-- EEES-DB-005: approved
-- owner: Recursos Humanos / Gobierno de remuneraciones
-- rollback: forward-only; reponer la fuente anterior mediante una migración posterior.

begin;

create table if not exists public.hr_rent_contract_positions (
  contract_id bigint not null references public.contracts(id) on delete restrict,
  job_position_id bigint not null references public.job_positions(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (contract_id, job_position_id)
);

insert into public.hr_rent_contract_positions (contract_id, job_position_id)
select distinct access_row.contract_id, access_row.job_position_id
from public.buk_job_position_contract_access access_row
join public.contracts contract_row on contract_row.id = access_row.contract_id
where access_row.is_active = true
  and contract_row.is_active = true
  and contract_row.contract_name ilike '%DSAL%'
on conflict (contract_id, job_position_id) do update
set is_active = true,
    updated_at = timezone('utc', now());

alter table public.hr_rent_contract_positions enable row level security;

drop policy if exists hr_rent_contract_positions_no_direct_access on public.hr_rent_contract_positions;
create policy hr_rent_contract_positions_no_direct_access
on public.hr_rent_contract_positions
for all to authenticated
using (false)
with check (false);

revoke all on public.hr_rent_contract_positions from public, anon, authenticated;

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
  contracts_payload jsonb := '[]'::jsonb;
  positions_payload jsonb := '[]'::jsonb;
  afps_payload jsonb := '[]'::jsonb;
  structure_payload jsonb := '{}'::jsonb;
begin
  if current_user_id is null or not public.user_can_manage_hr_rent_structures(current_user_id) then
    raise exception 'Sin permisos para consultar estructuras de renta';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', contract_row.id,
    'code', contract_row.code,
    'contract_number', contract_row.contract_number,
    'contract_name', contract_row.contract_name
  ) order by case when contract_row.contract_name ilike 'CODELCO%DSAL%' then 0 else 1 end, contract_row.contract_name), '[]'::jsonb)
  into contracts_payload
  from public.contracts contract_row
  where contract_row.is_active = true
    and exists (
      select 1
      from public.hr_rent_contract_positions relation_row
      where relation_row.contract_id = contract_row.id
        and relation_row.is_active = true
    );

  if p_contract_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', position_row.id,
      'code', position_row.code,
      'name', position_row.name,
      'has_structure', position_row.structure_id is not null,
      'authorized_headcount', coalesce(position_row.authorized_headcount, 0),
      'monthly_budget', position_row.monthly_budget,
      'currency_code', position_row.currency_code
    ) order by position_row.name), '[]'::jsonb)
    into positions_payload
    from (
      select job_position.id, job_position.code, job_position.name,
        structure_row.id as structure_id,
        structure_row.authorized_headcount,
        structure_row.monthly_budget,
        coalesce(structure_row.currency_code, 'CLP') as currency_code
      from public.hr_rent_contract_positions relation_row
      join public.job_positions job_position
        on job_position.id = relation_row.job_position_id
       and job_position.is_active = true
      left join public.hr_rent_structures structure_row
        on structure_row.contract_id = relation_row.contract_id
       and structure_row.job_position_id = relation_row.job_position_id
       and structure_row.is_active = true
      where relation_row.contract_id = p_contract_id
        and relation_row.is_active = true
    ) position_row;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', afp.afp_code,
    'name', afp.afp_name,
    'commission_rate', afp.commission_rate
  ) order by afp.afp_name), '[]'::jsonb)
  into afps_payload
  from (
    select distinct on (rate_row.afp_code)
      rate_row.afp_code, rate_row.afp_name, rate_row.commission_rate
    from public.hr_rent_afp_rates rate_row
    where rate_row.is_active
      and rate_row.effective_from <= current_date
      and (rate_row.effective_to is null or rate_row.effective_to >= current_date)
    order by rate_row.afp_code, rate_row.effective_from desc
  ) afp;

  if p_contract_id is not null and p_job_position_id is not null then
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
      select scenario.*, totals.imponible, totals.no_imponible,
        least(totals.imponible, scenario.pension_health_cap_uf * scenario.uf_month_end_clp) as pension_health_base,
        least(totals.imponible, scenario.unemployment_cap_uf * scenario.uf_month_end_clp) as unemployment_base
      from scenario cross join totals
    ), amounts as (
      select calculated.*,
        round(calculated.pension_health_base * (calculated.mandatory_pension_rate + calculated.commission_rate), 0)::numeric as afp_amount,
        round(calculated.pension_health_base * calculated.health_rate, 0)::numeric as health_legal_amount,
        case calculated.health_mode
          when 'isapre_uf' then greatest(round(calculated.pension_health_base * calculated.health_rate, 0), round(calculated.health_plan_value * calculated.uf_month_end_clp, 0))
          when 'isapre_pesos' then greatest(round(calculated.pension_health_base * calculated.health_rate, 0), round(calculated.health_plan_value, 0))
          when 'isapre_percentage' then greatest(round(calculated.pension_health_base * calculated.health_rate, 0), round(calculated.pension_health_base * calculated.health_plan_value / 100, 0))
          else round(calculated.pension_health_base * calculated.health_rate, 0)
        end::numeric as health_total_amount,
        round(calculated.unemployment_base * case when calculated.unemployment_contract_type = 'indefinite' then calculated.unemployment_indefinite_rate else 0 end, 0)::numeric as unemployment_amount
      from calculated
    ), legal as (
      select 'legal_afp'::text as id,
        coalesce(amounts.afp_name, 'AFP') || ' · cotización obligatoria' as concept_name,
        amounts.afp_amount as amount,
        concat(trim(to_char((amounts.mandatory_pension_rate + amounts.commission_rate) * 100, 'FM990D00')), '% sobre imponible') as detail,
        10 as sort_order
      from amounts where amounts.commission_rate is not null and amounts.uf_month_end_clp is not null
      union all
      select 'legal_health', 'Cotización de salud', amounts.health_legal_amount,
        concat(trim(to_char(amounts.health_rate * 100, 'FM990D00')), '% sobre imponible'), 20
      from amounts where amounts.commission_rate is not null and amounts.uf_month_end_clp is not null
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
        case when amounts.unemployment_contract_type = 'indefinite'
          then concat(trim(to_char(amounts.unemployment_indefinite_rate * 100, 'FM990D00')), '% trabajador')
          else 'Sin descuento al trabajador'
        end, 30
      from amounts where amounts.commission_rate is not null and amounts.uf_month_end_clp is not null
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
      'id', data.id,
      'job_position_id', data.job_position_id,
      'authorized_headcount', data.authorized_headcount,
      'monthly_budget', data.monthly_budget,
      'currency_code', data.currency_code,
      'calculation_available', data.uf_month_end_clp is not null and data.commission_rate is not null,
      'legal_scenario', jsonb_build_object(
        'afp_code', data.afp_code,
        'afp_name', coalesce(data.afp_name, data.afp_code),
        'afp_commission_rate', data.commission_rate,
        'health_mode', data.health_mode,
        'health_provider_name', data.health_provider_name,
        'health_plan_value', data.health_plan_value,
        'unemployment_contract_type', data.unemployment_contract_type
      ),
      'lines', coalesce(data.configured_lines, '[]'::jsonb) || coalesce(data.legal_lines, '[]'::jsonb),
      'totals', jsonb_build_object(
        'imponible', data.imponible,
        'no_imponible', data.no_imponible,
        'haberes', data.imponible + data.no_imponible,
        'pension_health_base', data.pension_health_base,
        'unemployment_base', data.unemployment_base,
        'legal_discounts', case when data.uf_month_end_clp is null or data.commission_rate is null then null else data.legal_total end,
        'liquido_estimated', case when data.uf_month_end_clp is null or data.commission_rate is null then null else greatest(data.imponible + data.no_imponible - data.legal_total, 0) end,
        'authorized_payroll', (data.imponible + data.no_imponible) * data.authorized_headcount
      ),
      'legal_assumptions', jsonb_build_array(
        concat(coalesce(data.afp_name, data.afp_code), ': 10% obligatorio + ', trim(to_char(data.commission_rate * 100, 'FM990D00')), '% de comisión'),
        concat('Salud: ', trim(to_char(data.health_rate * 100, 'FM990D00')), '% legal'),
        concat('Cesantía: ', case when data.unemployment_contract_type = 'indefinite' then '0,6% trabajador' else 'sin descuento al trabajador' end)
      )
    )
    into structure_payload
    from structure_data data;

    structure_payload := coalesce(structure_payload, '{}'::jsonb);
  end if;

  return jsonb_build_object(
    'can_configure', public.user_can_manage_hr_rent_structures(current_user_id),
    'legal_catalog', jsonb_build_object('afps', afps_payload),
    'contracts', contracts_payload,
    'positions', positions_payload,
    'structure', structure_payload
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
    select 1
    from public.hr_rent_contract_positions relation_row
    where relation_row.contract_id = p_contract_id
      and relation_row.job_position_id = p_job_position_id
      and relation_row.is_active = true
  ) then
    raise exception 'El cargo no está asociado al contrato seleccionado';
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
  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' then
    raise exception 'La estructura de conceptos debe ser una lista';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) item
    where coalesce(nullif(trim(item->>'concept_code'), ''), '') = ''
      or coalesce(nullif(trim(item->>'concept_name'), ''), '') = ''
      or (item->>'section_code') not in ('imponible', 'no_imponible')
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

  update public.hr_rent_structure_lines existing_line
  set is_active = false, updated_at = timezone('utc', now())
  where existing_line.structure_id = target_structure_id
    and existing_line.section_code in ('imponible', 'no_imponible');

  insert into public.hr_rent_structure_lines (
    structure_id, concept_code, concept_name, concept_type, section_code,
    calculation_mode, amount, sort_order, is_active
  )
  select target_structure_id,
    trim(item->>'concept_code'),
    trim(item->>'concept_name'),
    case when item->>'section_code' = 'no_imponible' then 'no_imponible' else 'imponible' end,
    item->>'section_code',
    'fixed',
    greatest(coalesce((item->>'amount')::numeric, 0), 0),
    greatest(coalesce((item->>'sort_order')::integer, 100), 0),
    true
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
      and line.section_code in ('imponible', 'no_imponible')
  ) line_row;

  insert into public.hr_rent_structure_audit (structure_id, action, snapshot, changed_by)
  values (target_structure_id, action_name, snapshot, current_user_id);

  return target_structure_id;
end;
$function$;

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
revoke all on function public.save_hr_rent_structure_config(bigint, bigint, integer, jsonb, text, text, text, numeric, text) from public, anon;
grant execute on function public.save_hr_rent_structure_config(bigint, bigint, integer, jsonb, text, text, text, numeric, text) to authenticated;

notify pgrst, 'reload schema';

commit;
