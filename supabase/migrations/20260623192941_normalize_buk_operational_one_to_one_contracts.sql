with target_mappings as (
  select
    bcm.id,
    bcm.contract_number,
    bcm.buk_area_name,
    bcm.cost_unit,
    bcm.cost_unit_name,
    bcm.cost_center_code,
    bcm.cost_center_name
  from public.buk_contract_mappings bcm
  where bcm.is_operational = true
    and bcm.is_one_to_one = false
    and bcm.contract_id is not null
    and nullif(trim(coalesce(bcm.buk_area_name, '')), '') is not null
),
existing_exact_contracts as (
  select
    tm.id as mapping_id,
    c.id as contract_id
  from target_mappings tm
  join public.contracts c
    on c.contract_number = tm.contract_number
   and c.contract_name = tm.buk_area_name
),
max_code as (
  select coalesce(max((substring(code from 'CONT-(\d+)$'))::integer), 0) as value
  from public.contracts
),
missing_exact_contracts as (
  select distinct
    tm.contract_number,
    tm.buk_area_name as contract_name,
    tm.cost_unit,
    tm.cost_unit_name,
    tm.cost_center_code,
    tm.cost_center_name
  from target_mappings tm
  left join existing_exact_contracts eec
    on eec.mapping_id = tm.id
  where eec.mapping_id is null
),
numbered_missing_contracts as (
  select
    mec.*,
    row_number() over (
      order by mec.contract_number, mec.contract_name, mec.cost_center_code
    ) as row_number
  from missing_exact_contracts mec
),
inserted_contracts as (
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
    'CONT-' || lpad((mc.value + nmc.row_number)::text, 3, '0'),
    nmc.contract_number,
    nmc.contract_name,
    nmc.cost_unit,
    nmc.cost_unit_name,
    nmc.cost_center_code,
    nmc.cost_center_name,
    true
  from numbered_missing_contracts nmc
  cross join max_code mc
  returning id, contract_number, contract_name
),
resolved_contracts as (
  select
    c.id,
    c.contract_number,
    c.contract_name
  from public.contracts c
  join (
    select contract_number, buk_area_name as contract_name
    from target_mappings
    union
    select contract_number, contract_name
    from inserted_contracts
  ) target_contracts
    on target_contracts.contract_number = c.contract_number
   and target_contracts.contract_name = c.contract_name
)
update public.contracts c
set
  cost_unit = tm.cost_unit,
  cost_unit_name = tm.cost_unit_name,
  cost_center_code = tm.cost_center_code,
  cost_center_name = tm.cost_center_name,
  is_active = true,
  updated_at = timezone('utc', now())
from target_mappings tm
where c.contract_number = tm.contract_number
  and c.contract_name = tm.buk_area_name
  and (
    c.cost_unit is distinct from tm.cost_unit
    or c.cost_unit_name is distinct from tm.cost_unit_name
    or c.cost_center_code is distinct from tm.cost_center_code
    or c.cost_center_name is distinct from tm.cost_center_name
    or c.is_active is distinct from true
  );

with target_mappings as (
  select
    bcm.id,
    bcm.contract_number,
    bcm.buk_area_name
  from public.buk_contract_mappings bcm
  where bcm.is_operational = true
    and bcm.contract_id is not null
    and nullif(trim(coalesce(bcm.buk_area_name, '')), '') is not null
),
resolved_contracts as (
  select
    c.id,
    c.contract_number,
    c.contract_name
  from public.contracts c
  join (
    select distinct contract_number, buk_area_name as contract_name
    from target_mappings
  ) tc
    on tc.contract_number = c.contract_number
   and tc.contract_name = c.contract_name
)
update public.buk_contract_mappings bcm
set
  contract_id = rc.id,
  updated_at = timezone('utc', now())
from resolved_contracts rc
where bcm.is_operational = true
  and bcm.contract_number = rc.contract_number
  and bcm.buk_area_name = rc.contract_name
  and bcm.contract_id is distinct from rc.id;

with operational_contract_usage as (
  select
    bcm.contract_id,
    count(*) as mapping_count
  from public.buk_contract_mappings bcm
  where bcm.is_operational = true
    and bcm.contract_id is not null
  group by bcm.contract_id
)
update public.buk_contract_mappings bcm
set
  is_one_to_one = (ocu.mapping_count = 1),
  updated_at = timezone('utc', now())
from operational_contract_usage ocu
where bcm.is_operational = true
  and bcm.contract_id = ocu.contract_id
  and bcm.is_one_to_one is distinct from (ocu.mapping_count = 1);

update public.buk_contract_mappings bcm
set
  is_one_to_one = false,
  updated_at = timezone('utc', now())
where bcm.is_operational = true
  and bcm.contract_id is null
  and bcm.is_one_to_one is distinct from false;
