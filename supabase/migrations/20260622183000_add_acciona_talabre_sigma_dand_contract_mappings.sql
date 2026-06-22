begin;

create temp table tmp_new_buk_contract_mapping_seed (
  contract_number text not null,
  contract_name text not null,
  cost_unit text not null,
  cost_unit_name text not null,
  cost_center_code text not null,
  buk_area_name text not null,
  cost_center_name text not null,
  manager_name text null,
  contract_admin_name text null,
  is_one_to_one boolean not null,
  is_operational boolean not null
) on commit drop;

insert into tmp_new_buk_contract_mapping_seed (
  contract_number,
  contract_name,
  cost_unit,
  cost_unit_name,
  cost_center_code,
  buk_area_name,
  cost_center_name,
  manager_name,
  contract_admin_name,
  is_one_to_one,
  is_operational
)
values
  (
    '5906986003:0001',
    'ACCIONA - TRANQUE TALABRE',
    '106',
    'SERV CONTRATISTAS CALAMA',
    '10114',
    'ACCIONA - TRANQUE TALABRE',
    'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)',
    'Maximiliano Contreras Rey',
    'Oscar Poblete Celedon',
    true,
    true
  ),
  (
    '7680816001:0001',
    'SIGMA - DAND',
    '102',
    'SERV ANDINA CONTRATISTAS',
    '10113',
    'SIGMA - DAND',
    'GERENCIA OPERACIONES ZONA I (CENTRO)',
    'Cristian Jimenez Jimenez',
    'Marcelo Villarroel Gutierrez',
    true,
    true
  );

update public.contracts c
set
  contract_name = s.contract_name,
  cost_unit = s.cost_unit,
  cost_unit_name = s.cost_unit_name,
  cost_center_code = s.cost_center_code,
  cost_center_name = s.cost_center_name,
  is_active = true,
  updated_at = timezone('utc', now())
from tmp_new_buk_contract_mapping_seed s
where c.contract_number = s.contract_number
  and (
    c.contract_name is distinct from s.contract_name
    or c.cost_unit is distinct from s.cost_unit
    or c.cost_unit_name is distinct from s.cost_unit_name
    or c.cost_center_code is distinct from s.cost_center_code
    or c.cost_center_name is distinct from s.cost_center_name
    or c.is_active is distinct from true
  );

with max_code as (
  select coalesce(max((substring(code from 'CONT-(\d+)$'))::integer), 0) as value
  from public.contracts
),
missing_contracts as (
  select distinct
    s.contract_number,
    s.contract_name,
    s.cost_unit,
    s.cost_unit_name,
    s.cost_center_code,
    s.cost_center_name
  from tmp_new_buk_contract_mapping_seed s
  left join public.contracts c
    on c.contract_number = s.contract_number
  where c.id is null
),
numbered_missing_contracts as (
  select
    mc.*,
    row_number() over (order by mc.contract_number) as row_number
  from missing_contracts mc
)
insert into public.contracts (
  code,
  contract_number,
  contract_name,
  cost_unit,
  cost_unit_name,
  cost_center_code,
  cost_center_name,
  is_active
)
select
  'CONT-' || lpad((max_code.value + nmc.row_number)::text, 3, '0'),
  nmc.contract_number,
  nmc.contract_name,
  nmc.cost_unit,
  nmc.cost_unit_name,
  nmc.cost_center_code,
  nmc.cost_center_name,
  true
from numbered_missing_contracts nmc
cross join max_code;

insert into public.buk_contract_mappings (
  contract_number,
  contract_name,
  cost_unit,
  cost_unit_name,
  cost_center_code,
  buk_area_name,
  cost_center_name,
  manager_name,
  contract_admin_name,
  is_one_to_one,
  is_operational
)
select
  s.contract_number,
  s.contract_name,
  s.cost_unit,
  s.cost_unit_name,
  s.cost_center_code,
  s.buk_area_name,
  s.cost_center_name,
  s.manager_name,
  s.contract_admin_name,
  s.is_one_to_one,
  s.is_operational
from tmp_new_buk_contract_mapping_seed s
on conflict (buk_area_name_normalized) do update
set
  contract_number = excluded.contract_number,
  contract_name = excluded.contract_name,
  cost_unit = excluded.cost_unit,
  cost_unit_name = excluded.cost_unit_name,
  cost_center_code = excluded.cost_center_code,
  cost_center_name = excluded.cost_center_name,
  manager_name = excluded.manager_name,
  contract_admin_name = excluded.contract_admin_name,
  is_one_to_one = excluded.is_one_to_one,
  is_operational = excluded.is_operational,
  updated_at = timezone('utc', now());

update public.buk_contract_mappings bcm
set
  contract_id = c.id,
  updated_at = timezone('utc', now())
from public.contracts c
where c.contract_number = bcm.contract_number
  and exists (
    select 1
    from tmp_new_buk_contract_mapping_seed s
    where s.contract_number = bcm.contract_number
  )
  and bcm.contract_id is distinct from c.id;

commit;
