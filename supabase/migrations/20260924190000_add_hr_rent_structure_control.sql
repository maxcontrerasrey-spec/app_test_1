-- EEES-DB-005: approved
-- owner: Recursos Humanos / Gobierno de remuneraciones
-- rollback: forward-only; desactivar el módulo y preservar las estructuras históricas.

begin;

insert into public.app_modules (code, name, route, description, sort_order, is_active)
values (
  'control_estructuras_renta',
  'Control Estructuras de Renta',
  '/recursos-humanos/estructuras-renta',
  'Consulta la estructura de renta y presupuesto por cargo habilitado en BUK.',
  66,
  true
)
on conflict (code) do update set
  name = excluded.name,
  route = excluded.route,
  description = excluded.description,
  is_active = excluded.is_active;

insert into public.role_module_access (role_code, module_code, can_view)
select role_code, 'control_estructuras_renta', true
from (values ('admin'), ('gerencia'), ('director_eje'), ('director_op'), ('gerente_general')) as allowed(role_code)
on conflict (role_code, module_code) do update set can_view = excluded.can_view;

create table if not exists public.hr_rent_structures (
  id uuid primary key default gen_random_uuid(),
  contract_id bigint not null references public.contracts(id) on delete restrict,
  job_position_id bigint not null references public.job_positions(id) on delete restrict,
  monthly_budget numeric(14,2) null check (monthly_budget is null or monthly_budget >= 0),
  currency_code text not null default 'CLP' check (currency_code = 'CLP'),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (contract_id, job_position_id)
);

create table if not exists public.hr_rent_structure_lines (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid not null references public.hr_rent_structures(id) on delete cascade,
  concept_code text not null,
  concept_name text not null,
  concept_type text not null check (concept_type in ('base', 'imponible', 'no_imponible', 'total_imponible', 'total_no_imponible', 'total_haberes', 'liquido')),
  amount numeric(14,2) not null check (amount >= 0),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (structure_id, concept_code)
);

create index if not exists idx_hr_rent_structures_contract_active
  on public.hr_rent_structures (contract_id, is_active, job_position_id);
create index if not exists idx_hr_rent_structure_lines_structure_order
  on public.hr_rent_structure_lines (structure_id, is_active, sort_order);

alter table public.hr_rent_structures enable row level security;
alter table public.hr_rent_structure_lines enable row level security;

drop policy if exists hr_rent_structures_no_direct_access on public.hr_rent_structures;
create policy hr_rent_structures_no_direct_access on public.hr_rent_structures
for all to authenticated using (false) with check (false);
drop policy if exists hr_rent_structure_lines_no_direct_access on public.hr_rent_structure_lines;
create policy hr_rent_structure_lines_no_direct_access on public.hr_rent_structure_lines
for all to authenticated using (false) with check (false);

revoke all on public.hr_rent_structures from public, anon, authenticated;
revoke all on public.hr_rent_structure_lines from public, anon, authenticated;

drop trigger if exists trg_hr_rent_structures_set_updated_at on public.hr_rent_structures;
create trigger trg_hr_rent_structures_set_updated_at
before update on public.hr_rent_structures
for each row execute function public.set_updated_at();
drop trigger if exists trg_hr_rent_structure_lines_set_updated_at on public.hr_rent_structure_lines;
create trigger trg_hr_rent_structure_lines_set_updated_at
before update on public.hr_rent_structure_lines
for each row execute function public.set_updated_at();

create or replace function public.get_hr_rent_structure_control(
  p_contract_id bigint default null,
  p_job_position_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not (
    public.user_is_admin(current_user_id)
    or public.user_has_role(current_user_id, 'gerencia')
    or public.user_has_role(current_user_id, 'director_eje')
    or public.user_has_role(current_user_id, 'director_op')
    or public.user_has_role(current_user_id, 'gerente_general')
  ) then
    raise exception 'Sin permisos para consultar estructuras de renta';
  end if;

  return jsonb_build_object(
    'contracts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', contract_row.id,
        'code', contract_row.code,
        'contract_number', contract_row.contract_number,
        'contract_name', contract_row.contract_name
      ) order by contract_row.contract_name)
      from (
        select distinct
          c.id,
          c.code,
          c.contract_number,
          coalesce(nullif(trim(bcm.buk_area_name), ''), c.contract_name) as contract_name
        from public.contracts c
        join public.buk_contract_mappings bcm
          on bcm.contract_id = c.id
         and bcm.is_operational = true
         and bcm.is_one_to_one = true
        where c.is_active = true
          and (c.contract_name ilike '%DSAL%' or bcm.buk_area_name ilike '%DSAL%')
      ) contract_row
    ), '[]'::jsonb),
    'positions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', position_row.id,
        'code', position_row.code,
        'name', position_row.name,
        'has_structure', hrs.id is not null,
        'monthly_budget', hrs.monthly_budget,
        'currency_code', hrs.currency_code
      ) order by position_row.name)
      from (
        select distinct access_row.contract_id, jp.id, jp.code, jp.name
        from public.buk_job_position_contract_access access_row
        join public.job_positions jp on jp.id = access_row.job_position_id and jp.is_active = true
        where access_row.contract_id = p_contract_id and access_row.is_active = true
      ) position_row
      left join public.hr_rent_structures hrs
        on hrs.contract_id = position_row.contract_id
       and hrs.job_position_id = position_row.id
       and hrs.is_active = true
      where position_row.contract_id = p_contract_id
    ), '[]'::jsonb),
    'structure', coalesce((
      select jsonb_build_object(
        'id', hrs.id,
        'job_position_id', hrs.job_position_id,
        'monthly_budget', hrs.monthly_budget,
        'currency_code', hrs.currency_code,
        'lines', coalesce((select jsonb_agg(jsonb_build_object(
          'id', line.id,
          'concept_code', line.concept_code,
          'concept_name', line.concept_name,
          'concept_type', line.concept_type,
          'amount', line.amount,
          'sort_order', line.sort_order
        ) order by line.sort_order, line.concept_name)
        from public.hr_rent_structure_lines line
        where line.structure_id = hrs.id and line.is_active = true), '[]'::jsonb)
      )
      from public.hr_rent_structures hrs
      where hrs.contract_id = p_contract_id
        and hrs.job_position_id = p_job_position_id
        and hrs.is_active = true
      limit 1
    ), '{}'::jsonb)
  );
end;
$function$;

revoke all on function public.get_hr_rent_structure_control(bigint, bigint) from public, anon;
grant execute on function public.get_hr_rent_structure_control(bigint, bigint) to authenticated;

notify pgrst, 'reload schema';
commit;
