-- EEES-DB-005: approved
-- owner: Recursos Humanos / Gobierno de remuneraciones
-- verificación: falla de forma atómica si el alcance productivo no coincide con la regla aprobada.

begin;

do $verification$
declare
  superadmin_user_id uuid;
  control_contracts_user_id uuid;
  read_only_manager_user_id uuid;
begin
  if not exists (
    select 1
    from public.role_module_access access_row
    where access_row.role_code = 'control_contratos'
      and access_row.module_code = 'control_estructuras_renta'
      and access_row.can_view = true
  ) then
    raise exception 'Control de Contratos no tiene acceso al módulo de estructuras de renta';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_hr_rent_structure_control(bigint,bigint)',
    'EXECUTE'
  ) then
    raise exception 'authenticated no puede consultar estructuras de renta';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.save_hr_rent_structure_config(bigint,bigint,integer,jsonb,text,text,text,numeric,text,boolean)',
    'EXECUTE'
  ) then
    raise exception 'authenticated no puede invocar la firma protegida de guardado';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.save_hr_rent_structure_config(bigint,bigint,integer,jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.save_hr_rent_structure_config(bigint,bigint,integer,jsonb,text,text,text,numeric,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.save_hr_rent_structure_config_before_config_scope(bigint,bigint,integer,jsonb,text,text,text,numeric,text,boolean)',
    'EXECUTE'
  ) then
    raise exception 'Existe una firma heredada de guardado todavía ejecutable';
  end if;

  select profile_row.id
  into superadmin_user_id
  from public.profiles profile_row
  where profile_row.is_super_admin = true
  order by profile_row.id
  limit 1;

  if superadmin_user_id is null then
    raise exception 'No existe un superadministrador para verificar el alcance';
  end if;

  perform set_config('request.jwt.claim.sub', superadmin_user_id::text, true);
  if not public.current_user_can_configure_hr_rent_structures() then
    raise exception 'El superadministrador no quedó autorizado para configurar rentas';
  end if;

  select role_row.user_id
  into control_contracts_user_id
  from public.user_roles role_row
  where role_row.role_code = 'control_contratos'
  order by role_row.user_id
  limit 1;

  if control_contracts_user_id is null then
    raise exception 'No existe un usuario de Control de Contratos para verificar el alcance';
  end if;

  perform set_config('request.jwt.claim.sub', control_contracts_user_id::text, true);
  if not public.current_user_can_configure_hr_rent_structures() then
    raise exception 'Control de Contratos no quedó autorizado para configurar rentas';
  end if;

  select role_row.user_id
  into read_only_manager_user_id
  from public.user_roles role_row
  join public.profiles profile_row on profile_row.id = role_row.user_id
  where role_row.role_code in ('gerencia', 'director_eje', 'director_op', 'gerente_general')
    and profile_row.is_super_admin = false
    and not public.user_has_role(role_row.user_id, 'control_contratos')
  order by role_row.user_id
  limit 1;

  if read_only_manager_user_id is null then
    raise exception 'No existe un gerente ordinario para verificar el acceso de solo lectura';
  end if;

  perform set_config('request.jwt.claim.sub', read_only_manager_user_id::text, true);
  if public.current_user_can_configure_hr_rent_structures() then
    raise exception 'Un gerente ordinario conserva acceso indebido a configuración';
  end if;

  if not public.user_can_manage_hr_rent_structures(read_only_manager_user_id) then
    raise exception 'El gerente ordinario perdió el acceso de lectura';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
end;
$verification$;

commit;
