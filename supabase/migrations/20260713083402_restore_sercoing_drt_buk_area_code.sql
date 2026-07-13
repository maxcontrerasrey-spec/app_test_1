do $$
declare
  mapping_record public.buk_contract_mappings%rowtype;
begin
  select *
  into mapping_record
  from public.buk_contract_mappings
  where contract_number = '7606991001:0001'
    and contract_name = 'SERCOING - DRT'
    and contract_id = 99
  for update;

  if not found then
    raise exception 'SERCOING - DRT BUK mapping not found with expected contract_number and contract_id';
  end if;

  if nullif(trim(mapping_record.cost_unit), '') is distinct from '106' then
    raise exception 'SERCOING - DRT has unexpected cost_unit: %', mapping_record.cost_unit;
  end if;

  if nullif(trim(mapping_record.buk_area_code), '') is not null
     and nullif(trim(mapping_record.buk_area_code), '') <> '106' then
    raise exception 'SERCOING - DRT already has unexpected buk_area_code: %', mapping_record.buk_area_code;
  end if;

  update public.buk_contract_mappings
  set buk_area_code = '106',
      updated_at = timezone('utc', now())
  where id = mapping_record.id;
end $$;
