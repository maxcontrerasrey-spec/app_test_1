begin;

do $$
declare
  aramark_sierra_count integer;
  sierra_ops_count integer;
  codelco_dmh_count integer;
  sotraser_dmh_count integer;
  aramark_dmh_count integer;
  mario_dmh_count integer;
  affected_count integer;
begin
  select count(*)
    into aramark_sierra_count
  from public.buk_contract_mappings bcm
  where bcm.contract_id = 18
    and bcm.contract_number = '7611769630:0001'
    and public.normalize_buk_area_name(bcm.contract_name) = public.normalize_buk_area_name('ARAMARK SIERRA GORDA INTERNO')
    and lower(trim(coalesce(bcm.contract_admin_name, ''))) = lower('Mario Pizarro Fernandez');

  if aramark_sierra_count <> 1 then
    raise exception 'Guard failed: expected ARAMARK SIERRA GORDA INTERNO assigned to Mario once, found %', aramark_sierra_count;
  end if;

  select count(*)
    into sierra_ops_count
  from public.buk_contract_mappings bcm
  where bcm.contract_id = 81
    and bcm.contract_number = '7608159002:0001'
    and public.normalize_buk_area_name(bcm.contract_name) = public.normalize_buk_area_name('SIERRA GORDA OPERACIONES')
    and lower(trim(coalesce(bcm.contract_admin_name, ''))) = lower('Mario Pizarro Fernandez');

  if sierra_ops_count <> 1 then
    raise exception 'Guard failed: expected SIERRA GORDA OPERACIONES assigned to Mario once, found %', sierra_ops_count;
  end if;

  select count(*)
    into codelco_dmh_count
  from public.buk_contract_mappings bcm
  where bcm.contract_id = 28
    and bcm.contract_number = '6170400006:0001'
    and public.normalize_buk_area_name(bcm.contract_name) = public.normalize_buk_area_name('CODELCO DMH')
    and lower(trim(coalesce(bcm.contract_admin_name, ''))) = lower('Jose Orellana Paez');

  if codelco_dmh_count <> 1 then
    raise exception 'Guard failed: expected CODELCO DMH assigned to Jose Orellana once, found %', codelco_dmh_count;
  end if;

  select count(*)
    into sotraser_dmh_count
  from public.buk_contract_mappings bcm
  where bcm.contract_id = 84
    and bcm.contract_number = '7805700001:0001'
    and public.normalize_buk_area_name(bcm.contract_name) = public.normalize_buk_area_name('SOTRASER - DMH')
    and lower(trim(coalesce(bcm.contract_admin_name, ''))) = lower('Angel Guerra Basso');

  if sotraser_dmh_count <> 1 then
    raise exception 'Guard failed: expected SOTRASER - DMH assigned to Angel Guerra once, found %', sotraser_dmh_count;
  end if;

  select count(*)
    into aramark_dmh_count
  from public.buk_contract_mappings bcm
  where bcm.contract_id = 15
    and bcm.contract_number = '7611769628:0001'
    and public.normalize_buk_area_name(bcm.contract_name) = public.normalize_buk_area_name('ARAMARK MINISTRO HALES INTERNO')
    and lower(trim(coalesce(bcm.contract_admin_name, ''))) = lower('Angel Guerra Basso');

  if aramark_dmh_count <> 1 then
    raise exception 'Guard failed: expected ARAMARK MINISTRO HALES INTERNO assigned to Angel Guerra once, found %', aramark_dmh_count;
  end if;

  update public.buk_contract_mappings bcm
  set
    contract_admin_name = 'Angel Guerra Basso',
    updated_at = timezone('utc', now())
  where bcm.contract_id = 18
    and bcm.contract_number = '7611769630:0001'
    and public.normalize_buk_area_name(bcm.contract_name) = public.normalize_buk_area_name('ARAMARK SIERRA GORDA INTERNO')
    and lower(trim(coalesce(bcm.contract_admin_name, ''))) = lower('Mario Pizarro Fernandez');

  get diagnostics affected_count = row_count;

  if affected_count <> 1 then
    raise exception 'Expected to reassign exactly one ARAMARK SIERRA GORDA INTERNO mapping to Angel, affected %', affected_count;
  end if;

  select count(*)
    into mario_dmh_count
  from public.buk_contract_mappings bcm
  where lower(trim(coalesce(bcm.contract_admin_name, ''))) = lower('Mario Pizarro Fernandez')
    and (
      public.normalize_buk_area_name(coalesce(bcm.contract_name, '')) like '%DMH%'
      or public.normalize_buk_area_name(coalesce(bcm.buk_area_name, '')) like '%DMH%'
      or public.normalize_buk_area_name(coalesce(bcm.contract_name, '')) like '%MINISTRO%HALES%'
      or public.normalize_buk_area_name(coalesce(bcm.buk_area_name, '')) like '%MINISTRO%HALES%'
    );

  if mario_dmh_count <> 0 then
    raise exception 'Guard failed: Mario Pizarro still has DMH/Ministro Hales mappings: %', mario_dmh_count;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
