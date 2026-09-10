begin;

do $$
declare
  target_contract_id bigint;
  conflicting_contract record;
begin
  select c.*
    into conflicting_contract
  from public.contracts c
  where c.code = 'CONT-112'
    and not (
      c.contract_number = '9959890001:0001'
      and upper(trim(c.contract_name)) = 'CASINO ENJOY'
    )
  limit 1;

  if conflicting_contract.id is not null then
    raise exception
      'No se puede crear CASINO ENJOY: CONT-112 ya esta usado por contrato id %, numero %, nombre %',
      conflicting_contract.id,
      conflicting_contract.contract_number,
      conflicting_contract.contract_name;
  end if;

  if exists (
    select 1
    from public.contracts c
    where c.contract_number = '9959890001:0001'
      and upper(trim(c.contract_name)) <> 'CASINO ENJOY'
  ) then
    raise exception 'No se puede crear CASINO ENJOY: el numero 9959890001:0001 ya pertenece a otro contrato';
  end if;

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
  values (
    'CONT-112',
    '9959890001:0001',
    'CASINO ENJOY',
    '109',
    'SERV ESPECIALES',
    '10113',
    'GERENCIA OPERACIONES ZONA I (CENTRO)',
    true
  )
  on conflict (contract_number, contract_name)
  do update set
    cost_unit = excluded.cost_unit,
    cost_unit_name = excluded.cost_unit_name,
    cost_center_code = excluded.cost_center_code,
    cost_center_name = excluded.cost_center_name,
    is_active = true,
    updated_at = timezone('utc', now())
  returning id into target_contract_id;

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
    is_operational,
    contract_id,
    company_name,
    buk_area_code
  )
  values (
    '9959890001:0001',
    'CASINO ENJOY',
    '109',
    'SERV ESPECIALES',
    '10113',
    'CASINO ENJOY',
    'GERENCIA OPERACIONES ZONA I (CENTRO)',
    'Cristian Jimenez Jimenez',
    'Jorge Parra Jimenez',
    true,
    true,
    target_contract_id,
    'Buses JM Pullman S.A.',
    null
  )
  on conflict on constraint buk_contract_mappings_buk_area_name_normalized_key
  do update set
    contract_number = excluded.contract_number,
    contract_name = excluded.contract_name,
    cost_unit = excluded.cost_unit,
    cost_unit_name = excluded.cost_unit_name,
    cost_center_code = excluded.cost_center_code,
    cost_center_name = excluded.cost_center_name,
    manager_name = excluded.manager_name,
    contract_admin_name = excluded.contract_admin_name,
    is_one_to_one = true,
    is_operational = true,
    contract_id = target_contract_id,
    company_name = excluded.company_name,
    updated_at = timezone('utc', now());

  if not exists (
    select 1
    from public.buk_contract_mappings bcm
    where bcm.contract_id = target_contract_id
      and bcm.contract_number = '9959890001:0001'
      and bcm.contract_name = 'CASINO ENJOY'
      and bcm.buk_area_name = 'CASINO ENJOY'
      and bcm.cost_unit = '109'
      and bcm.cost_unit_name = 'SERV ESPECIALES'
      and bcm.cost_center_code = '10113'
      and bcm.cost_center_name = 'GERENCIA OPERACIONES ZONA I (CENTRO)'
      and bcm.manager_name = 'Cristian Jimenez Jimenez'
      and bcm.contract_admin_name = 'Jorge Parra Jimenez'
      and bcm.company_name = 'Buses JM Pullman S.A.'
      and bcm.is_one_to_one = true
      and bcm.is_operational = true
  ) then
    raise exception 'El mapping operativo de CASINO ENJOY no quedo configurado correctamente';
  end if;
end;
$$;

commit;
