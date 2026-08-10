begin;

do $$
declare
  mapping_count integer;
  contract_id_value bigint;
begin
  select id into contract_id_value
  from public.contracts
  where contract_number = '5906986003:0001'
    and contract_name = 'ACCIONA - TRANQUE TALABRE'
    and is_active = true;

  if contract_id_value is null then
    raise exception 'No existe el contrato activo ACCIONA - TRANQUE TALABRE (5906986003:0001)';
  end if;

  select count(*) into mapping_count
  from public.buk_contract_mappings
  where contract_number = '5906986003:0001';

  if mapping_count <> 1 then
    raise exception
      'El contrato ACCIONA - TRANQUE TALABRE debe tener un unico mapping BUK; encontrados %',
      mapping_count;
  end if;

  update public.buk_contract_mappings
  set contract_id = contract_id_value,
      contract_name = 'ACCIONA - TRANQUE TALABRE',
      buk_area_name = 'ACCIONA - TRANQUE TALABRE',
      buk_area_code = '5906986003:0001',
      is_operational = true,
      is_one_to_one = true,
      updated_at = timezone('utc', now())
  where contract_number = '5906986003:0001';

  if not exists (
    select 1
    from public.buk_contract_mappings
    where contract_id = contract_id_value
      and contract_number = '5906986003:0001'
      and buk_area_name = 'ACCIONA - TRANQUE TALABRE'
      and buk_area_code = '5906986003:0001'
      and is_operational = true
      and is_one_to_one = true
  ) then
    raise exception 'El mapping BUK de ACCIONA - TRANQUE TALABRE no quedo configurado correctamente';
  end if;
end;
$$;

commit;
