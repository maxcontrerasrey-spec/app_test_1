-- EEES-DB-005: approved
-- owner: Recursos Humanos / Gobierno de remuneraciones
-- rollback: forward-only; desactivar configuración nueva mediante una migración posterior, preservando historial.

begin;

alter table public.hr_rent_structures
  add column if not exists authorized_headcount integer not null default 0;

alter table public.hr_rent_structure_lines
  add column if not exists section_code text;

alter table public.hr_rent_structure_lines
  add column if not exists calculation_mode text not null default 'fixed';

update public.hr_rent_structure_lines
set section_code = case
  when concept_type in ('no_imponible', 'total_no_imponible') then 'no_imponible'
  when concept_type in ('total_haberes', 'liquido') then 'summary'
  else 'imponible'
end
where section_code is null;

alter table public.hr_rent_structure_lines
  alter column section_code set default 'imponible';

alter table public.hr_rent_structure_lines
  alter column section_code set not null;

alter table public.hr_rent_structure_lines
  drop constraint if exists hr_rent_structure_lines_concept_type_check;

alter table public.hr_rent_structure_lines
  add constraint hr_rent_structure_lines_concept_type_check
  check (concept_type in ('base', 'imponible', 'no_imponible', 'legal_discount', 'total_imponible', 'total_no_imponible', 'total_haberes', 'liquido'));

alter table public.hr_rent_structure_lines
  add constraint hr_rent_structure_lines_section_code_check
  check (section_code in ('imponible', 'no_imponible', 'legal_discount', 'summary'));

alter table public.hr_rent_structure_lines
  add constraint hr_rent_structure_lines_calculation_mode_check
  check (calculation_mode in ('fixed', 'legal_rate'));

create table if not exists public.hr_rent_legal_parameters (
  id uuid primary key default gen_random_uuid(),
  parameter_code text not null,
  parameter_name text not null,
  rate numeric(8,6) not null check (rate >= 0 and rate <= 1),
  cap_uf numeric(8,2),
  uf_value_clp numeric(14,2),
  effective_from date not null,
  effective_to date,
  source_url text not null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint hr_rent_legal_parameters_dates check (effective_to is null or effective_to >= effective_from),
  constraint hr_rent_legal_parameters_caps check ((cap_uf is null and uf_value_clp is null) or (cap_uf is not null and uf_value_clp is not null)),
  unique (parameter_code, effective_from)
);

create index if not exists idx_hr_rent_legal_parameters_lookup
  on public.hr_rent_legal_parameters (parameter_code, effective_from desc, is_active);

insert into public.hr_rent_legal_parameters
  (parameter_code, parameter_name, rate, cap_uf, uf_value_clp, effective_from, source_url, notes)
values
  ('afp_base', 'Cotización obligatoria AFP', 0.10, 90.00, 41008.10, date '2026-09-01', 'https://www.spensiones.cl/portal/compendio/596/fo-article-7389.pdf', '10% de la remuneración imponible; comisión AFP referencial separada.'),
  ('afp_commission_reference', 'Comisión AFP referencial Habitat', 0.0127, 90.00, 41008.10, date '2026-09-01', 'https://www.spensiones.cl/portal/institucional/594/w3-article-2815.html', 'Escenario referencial. Debe reemplazarse por la AFP real del trabajador para una liquidación individual.'),
  ('health', 'Salud legal', 0.07, 90.00, 41008.10, date '2026-09-01', 'https://www.superdesalud.gob.cl/preguntas-frecuentes/cual-es-la-cotizacion-legal-para-salud-y-en-que-plazo-deben-ser-declaradas-y-pagadas/', '7% de la remuneración imponible con tope legal.'),
  ('unemployment_indefinite_employee', 'Seguro de cesantía trabajador indefinido', 0.006, 135.20, 41008.10, date '2026-09-01', 'https://www.afc.cl/empleadores/pagos-y-dudas-sobre-cotizaciones/cotizaciones-cuanto-y-como-se-paga/', '0,6% a cargo del trabajador con contrato indefinido.'),
  ('unemployment_fixed_employee', 'Seguro de cesantía trabajador plazo fijo', 0.00, 135.20, 41008.10, date '2026-09-01', 'https://www.afc.cl/app/uploads/2025/05/4_AFC_diptico_2025-web.pdf', 'En contrato a plazo fijo el aporte es de cargo del empleador.'),
  ('unemployment_employer', 'Seguro de cesantía empleador', 0.024, 135.20, 41008.10, date '2026-09-01', 'https://www.afc.cl/empleadores/pagos-y-dudas-sobre-cotizaciones/cotizaciones-cuanto-y-como-se-paga/', 'Se conserva como parámetro informativo de costo empresa; no se resta del líquido estimado.')
on conflict (parameter_code, effective_from) do update
set parameter_name = excluded.parameter_name,
    rate = excluded.rate,
    cap_uf = excluded.cap_uf,
    uf_value_clp = excluded.uf_value_clp,
    effective_to = excluded.effective_to,
    source_url = excluded.source_url,
    notes = excluded.notes,
    is_active = true;

create table if not exists public.hr_rent_structure_audit (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid not null references public.hr_rent_structures(id) on delete restrict,
  action text not null check (action in ('create', 'update')),
  snapshot jsonb not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_hr_rent_structure_audit_structure_date
  on public.hr_rent_structure_audit (structure_id, changed_at desc);

alter table public.hr_rent_legal_parameters enable row level security;
alter table public.hr_rent_structure_audit enable row level security;

drop policy if exists hr_rent_legal_parameters_no_direct_access on public.hr_rent_legal_parameters;
create policy hr_rent_legal_parameters_no_direct_access on public.hr_rent_legal_parameters
for all to authenticated using (false) with check (false);
drop policy if exists hr_rent_structure_audit_no_direct_access on public.hr_rent_structure_audit;
create policy hr_rent_structure_audit_no_direct_access on public.hr_rent_structure_audit
for all to authenticated using (false) with check (false);

revoke all on public.hr_rent_legal_parameters from public, anon, authenticated;
revoke all on public.hr_rent_structure_audit from public, anon, authenticated;

create or replace function public.user_can_manage_hr_rent_structures(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id is not null and (
    public.user_is_admin(target_user_id)
    or public.user_has_role(target_user_id, 'gerencia')
    or public.user_has_role(target_user_id, 'director_eje')
    or public.user_has_role(target_user_id, 'director_op')
    or public.user_has_role(target_user_id, 'gerente_general')
  );
$$;

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
      ), params as (
        select parameter_code, rate, cap_uf, uf_value_clp
        from public.hr_rent_legal_parameters
        where is_active = true and effective_from <= month_start and (effective_to is null or effective_to >= month_start)
      ), legal as (
        select 'legal_afp'::text as id, 'AFP obligatoria (10% + comisión referencial)'::text as concept_name, round(least(t.imponible, coalesce((select cap_uf * uf_value_clp from params where parameter_code = 'afp_base'), t.imponible)) * (select rate from params where parameter_code = 'afp_base') + least(t.imponible, coalesce((select cap_uf * uf_value_clp from params where parameter_code = 'afp_commission_reference'), t.imponible)) * (select rate from params where parameter_code = 'afp_commission_reference'), 0)::numeric as amount, 10 as sort_order from totals t
        union all select 'legal_health', 'Salud obligatoria (7%)', round(least(t.imponible, coalesce(p.cap_uf * p.uf_value_clp, t.imponible)) * p.rate, 0)::numeric, 20 from totals t join params p on p.parameter_code = 'health'
        union all select 'legal_unemployment', 'Seguro de cesantía (referencial indefinido)', round(least(t.imponible, coalesce(p.cap_uf * p.uf_value_clp, t.imponible)) * p.rate, 0)::numeric, 30 from totals t join params p on p.parameter_code = 'unemployment_indefinite_employee'
      ), structure_data as (
        select structure_row.id, structure_row.job_position_id, structure_row.authorized_headcount, structure_row.monthly_budget, structure_row.currency_code,
          (select jsonb_agg(jsonb_build_object('id', c.id, 'concept_code', c.concept_code, 'concept_name', c.concept_name, 'concept_type', c.concept_type, 'section_code', c.section_code, 'calculation_mode', c.calculation_mode, 'amount', c.amount, 'sort_order', c.sort_order) order by c.sort_order, c.concept_name) from configured c) as configured_lines,
          (select jsonb_agg(jsonb_build_object('id', l.id, 'concept_code', l.id, 'concept_name', l.concept_name, 'concept_type', 'legal_discount', 'section_code', 'legal_discount', 'calculation_mode', 'legal_rate', 'amount', l.amount, 'sort_order', l.sort_order) order by l.sort_order) from legal l) as legal_lines,
          (select imponible from totals) as imponible, (select no_imponible from totals) as no_imponible, (select coalesce(sum(amount), 0) from legal) as legal_total
        from public.hr_rent_structures structure_row
        where structure_row.contract_id = p_contract_id and structure_row.job_position_id = p_job_position_id and structure_row.is_active = true
        limit 1
      )
      select jsonb_build_object(
        'id', s.id, 'job_position_id', s.job_position_id, 'authorized_headcount', s.authorized_headcount,
        'monthly_budget', s.monthly_budget, 'currency_code', s.currency_code,
        'lines', coalesce(s.configured_lines, '[]'::jsonb) || coalesce(s.legal_lines, '[]'::jsonb),
        'totals', jsonb_build_object('imponible', s.imponible, 'no_imponible', s.no_imponible, 'haberes', s.imponible + s.no_imponible, 'legal_discounts', s.legal_total, 'liquido_estimated', greatest(s.imponible + s.no_imponible - s.legal_total, 0)),
        'legal_assumptions', jsonb_build_array('AFP: 10% + comisión referencial Habitat 1,27%', 'Salud: 7% con tope legal parametrizado', 'Cesantía: 0,6% referencial para contrato indefinido')
      ) from structure_data s
    ), '{}'::jsonb)
  );
end;
$function$;

create or replace function public.save_hr_rent_structure_config(
  p_contract_id bigint,
  p_job_position_id bigint,
  p_authorized_headcount integer,
  p_lines jsonb
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
  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' then
    raise exception 'La estructura de conceptos debe ser una lista';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) item where coalesce(nullif(trim(item->>'concept_code'), ''), '') = '' or coalesce(nullif(trim(item->>'concept_name'), ''), '') = '' or (item->>'section_code') not in ('imponible','no_imponible')) then
    raise exception 'Cada concepto configurable requiere código, nombre y sección válida';
  end if;

  select id into target_structure_id from public.hr_rent_structures where contract_id = p_contract_id and job_position_id = p_job_position_id for update;
  action_name := case when target_structure_id is null then 'create' else 'update' end;
  insert into public.hr_rent_structures (contract_id, job_position_id, authorized_headcount, is_active)
  values (p_contract_id, p_job_position_id, p_authorized_headcount, true)
  on conflict (contract_id, job_position_id) do update set authorized_headcount = excluded.authorized_headcount, is_active = true, updated_at = timezone('utc', now())
  returning id into target_structure_id;

  update public.hr_rent_structure_lines as existing_line set is_active = false, updated_at = timezone('utc', now()) where existing_line.structure_id = target_structure_id and existing_line.section_code in ('imponible','no_imponible');
  insert into public.hr_rent_structure_lines (structure_id, concept_code, concept_name, concept_type, section_code, calculation_mode, amount, sort_order, is_active)
  select target_structure_id, trim(item->>'concept_code'), trim(item->>'concept_name'), case when item->>'section_code' = 'no_imponible' then 'no_imponible' else 'imponible' end, item->>'section_code', 'fixed', greatest(coalesce((item->>'amount')::numeric, 0), 0), greatest(coalesce((item->>'sort_order')::integer, 100), 0), true
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) item
  on conflict (structure_id, concept_code) do update set concept_name = excluded.concept_name, concept_type = excluded.concept_type, section_code = excluded.section_code, calculation_mode = excluded.calculation_mode, amount = excluded.amount, sort_order = excluded.sort_order, is_active = true, updated_at = timezone('utc', now());

  select jsonb_build_object('contract_id', p_contract_id, 'job_position_id', p_job_position_id, 'authorized_headcount', p_authorized_headcount, 'lines', coalesce(jsonb_agg(line_row.payload order by line_row.sort_order), '[]'::jsonb)) into snapshot
  from (select line.sort_order, jsonb_build_object('concept_code', line.concept_code, 'concept_name', line.concept_name, 'section_code', line.section_code, 'amount', line.amount, 'sort_order', line.sort_order) payload from public.hr_rent_structure_lines line where line.structure_id = target_structure_id and line.is_active and line.section_code in ('imponible','no_imponible')) line_row;
  insert into public.hr_rent_structure_audit (structure_id, action, snapshot, changed_by) values (target_structure_id, action_name, snapshot, current_user_id);
  return target_structure_id;
end;
$function$;

revoke all on function public.get_hr_rent_structure_control(bigint, bigint, date) from public, anon;
grant execute on function public.get_hr_rent_structure_control(bigint, bigint, date) to authenticated;
revoke all on function public.save_hr_rent_structure_config(bigint, bigint, integer, jsonb) from public, anon;
grant execute on function public.save_hr_rent_structure_config(bigint, bigint, integer, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
