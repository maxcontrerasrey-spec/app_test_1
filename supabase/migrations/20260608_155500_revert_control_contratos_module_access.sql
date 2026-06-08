begin;

-- ============================================================
-- FIX: Revertir acceso de control_contratos al módulo y a los
-- casos de reclutamiento.
--
-- Modelo correcto: control_contratos opera IGUAL que un gerente
-- de área — solo ve sus aprobaciones en "Tareas Pendientes" del
-- Dashboard de inicio. No necesita acceso al módulo de Control
-- de Contrataciones ni a los casos de reclutamiento.
--
-- Cambios:
-- 1) Revertir user_can_view_recruitment_case (quitar control_contratos)
-- 2) Quitar control_contratos de role_module_access para control_contrataciones
-- 3) Hacer get_dashboard_home_bundle tolerante cuando el usuario
--    no tiene acceso al módulo de control (evitar crash del Dashboard)
-- ============================================================

-- 1. Revertir user_can_view_recruitment_case: solo admin, reclutamiento o asignado
create or replace function public.user_can_view_recruitment_case(
  target_user_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    public.user_is_admin(target_user_id)
    or public.user_has_role(target_user_id, 'reclutamiento')
    or exists (
      select 1
      from public.recruitment_case_assignments rca
      where rca.recruitment_case_id = target_case_id
        and rca.user_id = target_user_id
    );
$function$;

revoke all on function public.user_can_view_recruitment_case(uuid, uuid) from public, anon;
grant execute on function public.user_can_view_recruitment_case(uuid, uuid) to authenticated;

-- 2. Quitar acceso al módulo control_contrataciones para el rol control_contratos
delete from public.role_module_access
 where role_code = 'control_contratos'
   and module_code = 'control_contrataciones';

-- 3. Hacer get_dashboard_home_bundle tolerante:
--    si el usuario no tiene acceso al módulo, simplemente devolver
--    payload vacío en vez de lanzar excepción.
create or replace function public.get_dashboard_home_bundle(
  p_birthdays_limit integer default 6
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  control_payload jsonb := '{}'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  -- Solo cargar datos del módulo si el usuario tiene acceso
  if public.user_can_access_module(current_user_id, 'control_contrataciones') then
    control_payload := coalesce(public.get_recruitment_control_dashboard_v2()::jsonb, '{}'::jsonb);
  end if;

  return jsonb_build_object(
    'tasks_data',
    coalesce(public.get_dashboard_tasks(current_user_id)::jsonb, '[]'::jsonb),
    'approval_tracking_data',
    coalesce(public.get_dashboard_approval_tracking()::jsonb, '[]'::jsonb),
    'active_folios_data',
    coalesce(control_payload -> 'active_cases', '[]'::jsonb),
    'birthdays_data',
    coalesce(
      public.get_upcoming_birthdays(greatest(coalesce(p_birthdays_limit, 6), 1)),
      '[]'::jsonb
    )
  );
end;
$function$;

revoke all on function public.get_dashboard_home_bundle(integer) from public, anon;
grant execute on function public.get_dashboard_home_bundle(integer) to authenticated;

notify pgrst, 'reload schema';

commit;
