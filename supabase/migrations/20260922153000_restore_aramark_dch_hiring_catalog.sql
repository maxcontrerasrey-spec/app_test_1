-- EEES-DB-005: approved
-- owner: Recruitment / BUK integration
-- rollback: forward-only; preserve the BUK mapping row and restore through a later
-- mapping correction if the provider changes the area relationship again.
-- Cause: SCHWAGER DCH was attached to the same ERP contract as ARAMARK - DCH,
-- making the one-to-one guard hide the contract from hiring catalogues.

begin;

do $assert$
declare
  aramark_count integer;
  schwager_count integer;
begin
  select count(*) into aramark_count
  from public.buk_contract_mappings
  where public.normalize_buk_area_name(buk_area_name) = public.normalize_buk_area_name('ARAMARK - DCH')
    and contract_id = 100;

  select count(*) into schwager_count
  from public.buk_contract_mappings
  where public.normalize_buk_area_name(buk_area_name) = public.normalize_buk_area_name('SCHWAGER DCH')
    and contract_id = 100;

  if aramark_count <> 1 or schwager_count > 1 then
    raise exception 'Se esperaba un mapeo único ARAMARK - DCH y como máximo un mapeo SCHWAGER DCH asociado al contrato 100; encontrados: %, %', aramark_count, schwager_count;
  end if;
end;
$assert$;

-- SCHWAGER DCH has a different BUK contract number and no ERP contract master
-- of its own. Keep its row for audit/worker reconciliation, but do not treat it
-- as an ARAMARK hiring destination.
update public.buk_contract_mappings
set contract_id = null,
    is_operational = false,
    is_one_to_one = false,
    updated_at = timezone('utc', now())
where public.normalize_buk_area_name(buk_area_name) = public.normalize_buk_area_name('SCHWAGER DCH')
  and contract_id = 100;

select public.recompute_buk_contract_mapping_one_to_one(100);

do $assert$
declare
  aramark_one_to_one boolean;
  aramark_operational boolean;
  schwager_contract_id bigint;
  active_access_count integer;
begin
  select is_one_to_one, is_operational
    into aramark_one_to_one, aramark_operational
  from public.buk_contract_mappings
  where public.normalize_buk_area_name(buk_area_name) = public.normalize_buk_area_name('ARAMARK - DCH')
    and contract_id = 100;

  select contract_id into schwager_contract_id
  from public.buk_contract_mappings
  where public.normalize_buk_area_name(buk_area_name) = public.normalize_buk_area_name('SCHWAGER DCH');

  select count(*) into active_access_count
  from public.buk_job_position_contract_access
  where contract_id = 100 and is_active;

  if aramark_one_to_one is not true or aramark_operational is not true then
    raise exception 'ARAMARK - DCH no quedó operativo y uno-a-uno';
  end if;
  if schwager_contract_id is not null then
    raise exception 'SCHWAGER DCH todavía conserva asociación con el contrato ERP';
  end if;
  if active_access_count <> 0 then
    raise exception 'Las habilitaciones cargo-contrato deben reconstruirse desde BUK, pero quedaron % filas activas previas', active_access_count;
  end if;
end;
$assert$;

commit;
