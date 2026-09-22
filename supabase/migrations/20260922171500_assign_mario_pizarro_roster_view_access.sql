-- EEES-DB-005: approved
-- owner: Plataforma
-- rollback: forward-only; retirar el rol mediante una migración posterior con aprobación explícita.
-- Motivo: Mario Pizarro administra Sierra Gorda y requiere consulta de Jornadas, sin capacidad de asignar pautas.
begin;

do $$
declare
  v_target_user_id uuid;
  v_assigning_user_id uuid;
begin
  select p.id
    into v_target_user_id
  from public.profiles p
  where lower(trim(p.email)) = 'mario.pizarro@busesjm.com'
    and p.status = 'active';

  if v_target_user_id is null then
    raise exception 'No se encontro un perfil activo para Mario Pizarro';
  end if;

  if not exists (
    select 1
    from public.buk_contract_mappings bcm
    where lower(trim(coalesce(bcm.contract_admin_name, ''))) = 'mario pizarro fernandez'
      and upper(trim(coalesce(bcm.contract_name, ''))) = 'SIERRA GORDA OPERACIONES'
  ) then
    raise exception 'No se encontro el mapeo de Sierra Gorda para Mario Pizarro';
  end if;

  select p.id
    into v_assigning_user_id
  from public.profiles p
  where p.is_super_admin = true
    and p.status = 'active'
  order by p.created_at
  limit 1;

  insert into public.user_roles (user_id, role_code, assigned_by)
  values (v_target_user_id, 'operaciones_l_1', v_assigning_user_id)
  on conflict (user_id, role_code) do nothing;
end;
$$;

notify pgrst, 'reload schema';

commit;
