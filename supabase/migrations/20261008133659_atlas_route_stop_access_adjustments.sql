-- EEES-DB-005: approved
-- owner: Atlas Operations / requested by product owner
-- rollback: preserve the route's adjusted coordinates and remove only the optional provenance columns.
begin;

alter table public.atlas_ops_service_route_stops
  add column requested_latitude double precision,
  add column requested_longitude double precision,
  add column access_adjustment_meters integer,
  add constraint atlas_ops_service_route_stops_access_adjustment_check check (
    (requested_latitude is null and requested_longitude is null and access_adjustment_meters is null)
    or (
      requested_latitude is not null
      and requested_longitude is not null
      and access_adjustment_meters is not null
      and requested_latitude between -90 and 90
      and requested_longitude between -180 and 180
      and access_adjustment_meters between 1 and 20
    )
  );

create or replace function public.atlas_ops_save_optimized_service_route(
  p_service_template_id bigint,
  p_prefix text,
  p_stops jsonb,
  p_distance_meters integer,
  p_duration_seconds integer,
  p_optimization_matrix_duration_seconds integer,
  p_input_order_matrix_duration_seconds integer,
  p_planned_vehicle_type text
) returns uuid language plpgsql security definer set search_path = public
as $function$
declare
  actor uuid := auth.uid();
  route_key uuid;
  canonical_vehicle_type text;
begin
  if actor is null or not public.atlas_ops_is_current_super_admin() then
    raise exception 'Atlas Operations está habilitado solo para superadministración.';
  end if;
  canonical_vehicle_type := public.atlas_ops_route_vehicle_category(p_planned_vehicle_type);
  if canonical_vehicle_type is null then
    raise exception 'Selecciona Bus, Taxibus o Minibus para calcular el recorrido.';
  end if;
  if not exists (
    select 1 from public.atlas_ops_vehicles v
    where v.is_active and public.atlas_ops_route_vehicle_category(v.vehicle_type) = canonical_vehicle_type
  ) then
    raise exception 'La categoría de vehículo ya no está disponible en la flota activa.';
  end if;
  if p_optimization_matrix_duration_seconds is null or p_optimization_matrix_duration_seconds < 0
    or p_input_order_matrix_duration_seconds is not null and p_input_order_matrix_duration_seconds < 0 then
    raise exception 'Las métricas de optimización no son válidas.';
  end if;
  if jsonb_typeof(p_stops) <> 'array' then
    raise exception 'Las paradas de la ruta no son válidas.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_stops) as submitted(value)
    where (submitted.value ? 'requestedLat') <> (submitted.value ? 'requestedLng')
      or (submitted.value ? 'requestedLat') <> (submitted.value ? 'accessAdjustmentMeters')
      or submitted.value ? 'requestedLat' and (
        jsonb_typeof(submitted.value->'requestedLat') <> 'number'
        or jsonb_typeof(submitted.value->'requestedLng') <> 'number'
        or jsonb_typeof(submitted.value->'accessAdjustmentMeters') <> 'number'
        or (submitted.value->>'accessAdjustmentMeters')::integer not between 1 and 20
      )
  ) then
    raise exception 'El ajuste de acceso de una parada no es válido.';
  end if;
  route_key := public.atlas_ops_save_service_route(
    p_service_template_id, p_prefix, p_stops, p_distance_meters, p_duration_seconds
  );
  update public.atlas_ops_service_route_stops saved
    set requested_latitude = (submitted.value->>'requestedLat')::double precision,
        requested_longitude = (submitted.value->>'requestedLng')::double precision,
        access_adjustment_meters = (submitted.value->>'accessAdjustmentMeters')::integer
    from jsonb_array_elements(p_stops) with ordinality submitted(value, ordinality)
    where saved.route_id = route_key and saved.stop_order = submitted.ordinality::integer
      and submitted.value ? 'requestedLat';
  if exists (
    select 1
    from public.atlas_ops_service_route_stops saved
    where saved.route_id = route_key and saved.requested_latitude is not null
      and (
        2 * 6371000 * asin(sqrt(least(1,
          sin(radians(saved.latitude - saved.requested_latitude) / 2) ^ 2
          + cos(radians(saved.requested_latitude)) * cos(radians(saved.latitude))
            * sin(radians(saved.longitude - saved.requested_longitude) / 2) ^ 2
        ))) not between 3 and 20
        or abs(round(2 * 6371000 * asin(sqrt(least(1,
          sin(radians(saved.latitude - saved.requested_latitude) / 2) ^ 2
          + cos(radians(saved.requested_latitude)) * cos(radians(saved.latitude))
            * sin(radians(saved.longitude - saved.requested_longitude) / 2) ^ 2
        ))))::integer - saved.access_adjustment_meters) > 1
      )
  ) then
    raise exception 'La distancia del ajuste de acceso no coincide con sus coordenadas.';
  end if;
  update public.atlas_ops_service_routes
    set planning_provider = 'valhalla',
        optimization_method = 'valhalla_matrix_open_path_v1',
        optimization_matrix_duration_seconds = p_optimization_matrix_duration_seconds,
        input_order_matrix_duration_seconds = p_input_order_matrix_duration_seconds,
        planned_vehicle_type = canonical_vehicle_type
    where id = route_key and created_by = actor;
  if not found then raise exception 'No fue posible registrar los datos de la ruta.'; end if;
  return route_key;
end;
$function$;

revoke all on function public.atlas_ops_save_optimized_service_route(bigint, text, jsonb, integer, integer, integer, integer, text) from public, anon;
grant execute on function public.atlas_ops_save_optimized_service_route(bigint, text, jsonb, integer, integer, integer, integer, text) to authenticated;

notify pgrst, 'reload schema';

commit;
