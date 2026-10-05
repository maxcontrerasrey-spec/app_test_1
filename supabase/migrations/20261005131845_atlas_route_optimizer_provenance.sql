-- EEES-DB-005: approved
-- owner: Atlas Operations, implementation requested by product owner
-- rollback: revert the frontend and proxy first; retain metadata columns and old route versions, and revoke only the new RPC if rollback is required.
-- Atlas route optimization provenance. Existing route versions remain intact.
begin;

alter table public.atlas_ops_service_routes
  drop constraint atlas_ops_service_routes_planning_provider_check,
  add constraint atlas_ops_service_routes_planning_provider_check
    check (planning_provider in ('tomtom', 'valhalla')),
  add column optimization_method text not null default 'manual_order'
    check (optimization_method in ('manual_order', 'valhalla_matrix_open_path_v1')),
  add column optimization_matrix_duration_seconds integer
    check (optimization_matrix_duration_seconds is null or optimization_matrix_duration_seconds >= 0),
  add column input_order_matrix_duration_seconds integer
    check (input_order_matrix_duration_seconds is null or input_order_matrix_duration_seconds >= 0);

create or replace function public.atlas_ops_save_optimized_service_route(
  p_service_template_id bigint,
  p_prefix text,
  p_stops jsonb,
  p_distance_meters integer,
  p_duration_seconds integer,
  p_optimization_matrix_duration_seconds integer,
  p_input_order_matrix_duration_seconds integer
) returns uuid language plpgsql security definer set search_path = public
as $function$
declare
  actor uuid := auth.uid();
  route_key uuid;
begin
  if actor is null or not public.atlas_ops_is_current_super_admin() then
    raise exception 'Atlas Operations está habilitado solo para superadministración.';
  end if;
  if p_optimization_matrix_duration_seconds is null or p_optimization_matrix_duration_seconds < 0
    or p_input_order_matrix_duration_seconds is not null and p_input_order_matrix_duration_seconds < 0 then
    raise exception 'Las métricas de optimización no son válidas.';
  end if;
  route_key := public.atlas_ops_save_service_route(
    p_service_template_id, p_prefix, p_stops, p_distance_meters, p_duration_seconds
  );
  update public.atlas_ops_service_routes
    set planning_provider = 'valhalla',
        optimization_method = 'valhalla_matrix_open_path_v1',
        optimization_matrix_duration_seconds = p_optimization_matrix_duration_seconds,
        input_order_matrix_duration_seconds = p_input_order_matrix_duration_seconds
    where id = route_key and created_by = actor;
  if not found then raise exception 'No fue posible registrar la procedencia de la ruta.'; end if;
  return route_key;
end;
$function$;

revoke all on function public.atlas_ops_save_optimized_service_route(bigint, text, jsonb, integer, integer, integer, integer) from public, anon;
grant execute on function public.atlas_ops_save_optimized_service_route(bigint, text, jsonb, integer, integer, integer, integer) to authenticated;

notify pgrst, 'reload schema';

commit;
