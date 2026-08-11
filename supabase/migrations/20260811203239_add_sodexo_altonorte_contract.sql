begin;

do $$
declare
  target_contract_id bigint;
  conflicting_contract record;
begin
  select c.*
  into conflicting_contract
  from public.contracts c
  where c.code = 'CONT-111'
    and not (
      c.contract_number = '9462300005:0001'
      and upper(c.contract_name) = 'SODEXO - ALTONORTE'
    )
  limit 1;

  if conflicting_contract.id is not null then
    raise exception
      'No se puede crear SODEXO - ALTONORTE: CONT-111 ya esta usado por contrato id %, numero %, nombre %',
      conflicting_contract.id,
      conflicting_contract.contract_number,
      conflicting_contract.contract_name;
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
    'CONT-111',
    '9462300005:0001',
    'SODEXO - ALTONORTE',
    '115',
    'SERV CAMBIO DE TURNO',
    '10116',
    'GERENCIA OPERACIONES ZONA III (NORTE COSTA)',
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

  if target_contract_id is null then
    select id
    into target_contract_id
    from public.contracts
    where contract_number = '9462300005:0001'
      and contract_name = 'SODEXO - ALTONORTE';
  end if;

  if target_contract_id is null then
    raise exception 'No fue posible resolver el contrato SODEXO - ALTONORTE despues del upsert';
  end if;

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
    '9462300005:0001',
    'SODEXO - ALTONORTE',
    '115',
    'SERV CAMBIO DE TURNO',
    '10116',
    'SODEXO - ALTONORTE',
    'GERENCIA OPERACIONES ZONA III (NORTE COSTA)',
    'Luciano Fischer Ballerini',
    'Javier Plaza Cerda',
    true,
    true,
    target_contract_id,
    null,
    '726'
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
    buk_area_code = excluded.buk_area_code,
    updated_at = timezone('utc', now());

  if not exists (
    select 1
    from public.buk_contract_mappings bcm
    where bcm.contract_id = target_contract_id
      and bcm.contract_number = '9462300005:0001'
      and bcm.contract_name = 'SODEXO - ALTONORTE'
      and bcm.buk_area_name = 'SODEXO - ALTONORTE'
      and bcm.buk_area_code = '726'
      and bcm.cost_unit = '115'
      and bcm.cost_unit_name = 'SERV CAMBIO DE TURNO'
      and bcm.cost_center_code = '10116'
      and bcm.cost_center_name = 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)'
      and bcm.manager_name = 'Luciano Fischer Ballerini'
      and bcm.contract_admin_name = 'Javier Plaza Cerda'
      and bcm.is_one_to_one = true
      and bcm.is_operational = true
  ) then
    raise exception 'El mapping BUK de SODEXO - ALTONORTE no quedo configurado correctamente';
  end if;
end;
$$;

commit;
