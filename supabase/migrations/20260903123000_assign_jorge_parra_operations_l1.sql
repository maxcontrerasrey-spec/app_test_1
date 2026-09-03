begin;

do $$
declare
  v_target_user_id uuid;
  v_assigning_user_id uuid;
  v_contract_count integer;
begin
  select p.id
    into v_target_user_id
  from public.profiles p
  where lower(trim(p.email)) = 'jorge.parra@busesjm.com'
    and p.status = 'active'
  limit 1;

  if v_target_user_id is null then
    raise exception 'No se encontro un perfil activo para Jorge Parra';
  end if;

  select count(*)
    into v_contract_count
  from public.buk_contract_mappings bcm
  where lower(trim(coalesce(bcm.contract_admin_name, ''))) = lower('Jorge Parra Jimenez');

  if v_contract_count = 0 then
    raise exception 'Jorge Parra no tiene mapeos contractuales; se cancela la asignacion de rol';
  end if;

  select p.id
    into v_assigning_user_id
  from public.profiles p
  where lower(trim(p.email)) = 'maximiliano.contreras@busesjm.com'
    and p.status = 'active'
  limit 1;

  if v_assigning_user_id is null then
    raise exception 'No se encontro un administrador activo para auditar la asignacion';
  end if;

  insert into public.user_roles (user_id, role_code, assigned_by)
  values (v_target_user_id, 'operaciones_l_1', v_assigning_user_id)
  on conflict (user_id, role_code) do nothing;
end;
$$;

notify pgrst, 'reload schema';

commit;
