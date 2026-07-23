do $$
declare
  updated_contracts integer := 0;
  updated_mappings integer := 0;
  final_record record;
begin
  update public.contracts c
  set
    contract_number = '0000000168:0001',
    updated_at = timezone('utc', now())
  where c.id = 92
    and c.code = 'CONT-092'
    and c.contract_name = 'ZONA II CONTRATISTAS'
    and c.contract_number = '0000000168:0004';

  get diagnostics updated_contracts = row_count;

  update public.buk_contract_mappings bcm
  set
    contract_number = '0000000168:0001',
    buk_area_code = '721',
    company_name = public.resolve_known_company_name(null, '0000000168:0001'),
    updated_at = timezone('utc', now())
  where bcm.contract_id = 92
    and bcm.contract_name = 'ZONA II CONTRATISTAS'
    and bcm.buk_area_name_normalized = public.normalize_buk_area_name('ZONA II CONTRATISTAS')
    and bcm.contract_number = '0000000168:0004';

  get diagnostics updated_mappings = row_count;

  if updated_contracts <> 1 then
    raise exception 'Expected to restore 1 CONT-092 contract row to JM branch, updated %', updated_contracts;
  end if;

  if updated_mappings <> 1 then
    raise exception 'Expected to restore 1 ZONA II CONTRATISTAS BUK mapping row to JM branch, updated %', updated_mappings;
  end if;

  select
    c.contract_number,
    bcm.contract_number as mapping_contract_number,
    bcm.buk_area_code,
    bcm.company_name
  into final_record
  from public.contracts c
  join public.buk_contract_mappings bcm
    on bcm.contract_id = c.id
  where c.id = 92
    and c.code = 'CONT-092';

  if final_record.contract_number <> '0000000168:0001'
     or final_record.mapping_contract_number <> '0000000168:0001'
     or final_record.buk_area_code <> '721'
     or final_record.company_name is distinct from public.resolve_known_company_name(null, '0000000168:0001') then
    raise exception 'CONT-092 JM BUK mapping verification failed after restore';
  end if;
end $$;
