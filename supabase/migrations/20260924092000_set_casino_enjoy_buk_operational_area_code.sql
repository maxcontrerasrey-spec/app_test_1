-- EEES-DB-005: approved
-- owner: Engineering and Human Resources
-- rollback: forward-only; correct the mapping through a subsequent audited migration.
-- La ficha BUK confirma 728 como el centro de costos/area operacional consumida por la API.

begin;

do $$
declare
  contract_id_value bigint;
  mapping_record public.buk_contract_mappings%rowtype;
begin
  select c.id
    into contract_id_value
    from public.contracts c
   where c.contract_number = '9959890001:0001'
     and upper(trim(c.contract_name)) = 'CASINO ENJOY'
     and c.is_active = true;

  if contract_id_value is null then
    raise exception 'No existe el contrato activo CASINO ENJOY (9959890001:0001)';
  end if;

  select bcm.*
    into mapping_record
    from public.buk_contract_mappings bcm
   where bcm.contract_id = contract_id_value
     and bcm.contract_number = '9959890001:0001'
     and upper(trim(bcm.contract_name)) = 'CASINO ENJOY'
   for update;

  if mapping_record.id is null then
    raise exception 'No existe el mapping BUK de CASINO ENJOY asociado al contrato activo';
  end if;

  if mapping_record.is_operational is distinct from true then
    raise exception 'El mapping BUK de CASINO ENJOY no está marcado como operativo';
  end if;

  update public.buk_contract_mappings
     set buk_area_name = 'CASINO ENJOY',
         buk_area_code = '728',
         is_operational = true,
         is_one_to_one = true,
         updated_at = timezone('utc', now())
   where id = mapping_record.id;

  if not exists (
    select 1
      from public.buk_contract_mappings bcm
     where bcm.id = mapping_record.id
       and bcm.contract_id = contract_id_value
       and bcm.contract_number = '9959890001:0001'
       and upper(trim(bcm.contract_name)) = 'CASINO ENJOY'
       and bcm.buk_area_name = 'CASINO ENJOY'
       and bcm.buk_area_code = '728'
       and bcm.is_operational = true
       and bcm.is_one_to_one = true
  ) then
    raise exception 'El mapping BUK de CASINO ENJOY no quedó configurado con el área operacional 728';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
