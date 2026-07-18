-- Initial DMH accreditation roster load from the live BUK active employee snapshot.
-- CONT-028 / CODELCO DMH maps to the BUK area below; using CECO 10114 alone would
-- also include Aramark, Sotraser and other DMH-adjacent contracts.
do $$
declare
  actor_id uuid;
  dmh_site_id uuid;
  worker_record record;
  loaded_workers integer := 0;
begin
  select p.id
    into actor_id
  from public.profiles p
  where p.status = 'active'
    and p.is_super_admin = true
  order by p.created_at asc
  limit 1;

  if actor_id is null then
    raise exception 'No active super admin profile found to audit the DMH accreditation load';
  end if;

  perform set_config('request.jwt.claim.sub', actor_id::text, true);

  select s.id
    into dmh_site_id
  from public.accreditation_sites s
  where s.code = 'codelco_dmh'
    and s.is_active = true;

  if dmh_site_id is null then
    raise exception 'Active accreditation site codelco_dmh was not found';
  end if;

  for worker_record in
    select distinct on (e.buk_employee_id)
      e.buk_employee_id
    from public.employees_active_current e
    where e.area_name = 'SERVICIO CODELCO DMH (6170400006:0004)'
      and nullif(trim(e.buk_employee_id), '') is not null
    order by e.buk_employee_id, e.updated_at desc nulls last, e.created_at desc nulls last
  loop
    perform public.generate_worker_requirements(worker_record.buk_employee_id, dmh_site_id, false);
    loaded_workers := loaded_workers + 1;
  end loop;

  insert into public.accreditation_audit_log (
    site_id,
    event_type,
    event_summary,
    payload,
    actor_id
  )
  values (
    dmh_site_id,
    'dmh_contract_028_initial_load',
    'Carga inicial de trabajadores BUK contrato 028 DMH',
    jsonb_build_object(
      'buk_area_name', 'SERVICIO CODELCO DMH (6170400006:0004)',
      'contract_code', 'CONT-028',
      'loaded_workers', loaded_workers,
      'source', 'employees_active_current'
    ),
    actor_id
  );
end;
$$;

notify pgrst, 'reload schema';
