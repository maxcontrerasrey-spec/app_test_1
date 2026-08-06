begin;

do $$
declare
  target_user_id uuid;
  target_profile_count integer;
  updated_approvers integer;
  updated_mappings integer;
begin
  select count(*)
  into target_profile_count
  from public.profiles p
  where lower(trim(p.email)) = 'andres.barraza@busesjm.com'
    and p.status = 'active';

  if target_profile_count <> 1 then
    raise exception 'Expected exactly one active profile for Andres Barraza, found %', target_profile_count;
  end if;

  select p.id
  into target_user_id
  from public.profiles p
  where lower(trim(p.email)) = 'andres.barraza@busesjm.com'
    and p.status = 'active';

  if not exists (
    select 1
    from public.app_roles ar
    where ar.code = 'gerencia'
      and ar.is_active = true
  ) or not exists (
    select 1
    from public.app_roles ar
    where ar.code = 'aprobador_folios'
      and ar.is_active = true
  ) then
    raise exception 'Required roles gerencia/aprobador_folios are not active';
  end if;

  update public.profiles p
  set
    job_title = 'Subgerente de Operaciones',
    updated_at = timezone('utc', now())
  where p.id = target_user_id;

  insert into public.user_roles (user_id, role_code, assigned_by)
  values
    (target_user_id, 'gerencia', null),
    (target_user_id, 'aprobador_folios', null)
  on conflict (user_id, role_code) do nothing;

  update public.cost_center_approvers cca
  set
    approver_user_id = target_user_id,
    approver_name = 'Andres Barraza Mera',
    approver_email = 'andres.barraza@busesjm.com',
    is_active = true,
    updated_at = timezone('utc', now())
  where cca.cost_center_code in ('10114', '20114', '40114')
    and upper(trim(cca.cost_center_name)) = 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)';

  get diagnostics updated_approvers = row_count;

  if updated_approvers <> 3 then
    raise exception 'Expected to reassign 3 Zona Norte 2 approver rows, updated %', updated_approvers;
  end if;

  update public.buk_contract_mappings bcm
  set
    manager_name = 'Andres Barraza Mera',
    updated_at = timezone('utc', now())
  where bcm.cost_center_code in ('10114', '20114', '40114');

  get diagnostics updated_mappings = row_count;

  if updated_mappings < 1 then
    raise exception 'Expected at least one Zona Norte 2 BUK contract mapping';
  end if;

  if exists (
    select 1
    from public.cost_center_approvers cca
    where cca.cost_center_code in ('10114', '20114', '40114')
      and upper(trim(cca.cost_center_name)) = 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)'
      and (
        cca.approver_user_id is distinct from target_user_id
        or lower(trim(coalesce(cca.approver_email, ''))) <> 'andres.barraza@busesjm.com'
        or cca.is_active is distinct from true
      )
  ) then
    raise exception 'Zona Norte 2 approver assignment did not converge';
  end if;

  if exists (
    select 1
    from public.buk_contract_mappings bcm
    where bcm.cost_center_code in ('10114', '20114', '40114')
      and lower(trim(coalesce(bcm.manager_name, ''))) <> lower('Andres Barraza Mera')
  ) then
    raise exception 'Zona Norte 2 BUK manager assignment did not converge';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
