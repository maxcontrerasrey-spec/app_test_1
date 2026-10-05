-- EEES-DB-005: approved
-- owner: Atlas Operations, implementation requested by product owner
-- rollback: revert frontend source value before reverting the check and writer function.
begin;

alter table public.atlas_ops_service_route_stops
  drop constraint atlas_ops_service_route_stops_location_source_check,
  add constraint atlas_ops_service_route_stops_location_source_check
    check (location_source in ('tomtom', 'map_pin', 'preset'));

create or replace function public.atlas_ops_save_service_route(
  p_service_template_id bigint,
  p_prefix text,
  p_stops jsonb,
  p_distance_meters integer,
  p_duration_seconds integer
) returns uuid language plpgsql security definer set search_path = public
as $function$
declare
  actor uuid := auth.uid();
  template_name text;
  prefix_value text := trim(coalesce(p_prefix, ''));
  prefix_normalized text;
  service_code text;
  route_code_value text;
  next_version integer;
  route_id_value uuid;
  stop_item jsonb;
  stop_count integer;
  stop_index integer := 0;
  stop_label text;
  stop_lat double precision;
  stop_lng double precision;
  provider_id text;
  source_value text;
begin
  if actor is null or not public.atlas_ops_is_current_super_admin() then
    raise exception 'Atlas Operations está habilitado solo para superadministración.';
  end if;
  if p_service_template_id is null then raise exception 'Selecciona un servicio base.'; end if;
  if length(prefix_value) not between 1 and 40 then raise exception 'El prefijo debe tener entre 1 y 40 caracteres.'; end if;
  if p_stops is null or jsonb_typeof(p_stops) <> 'array' then raise exception 'Las paradas deben enviarse como una lista.'; end if;
  stop_count := jsonb_array_length(p_stops);
  if stop_count < 2 or stop_count > 151 then raise exception 'La ruta debe tener entre 2 y 151 puntos.'; end if;

  select t.name into template_name from public.atlas_ops_service_templates t
    where t.id = p_service_template_id and t.is_active for update;
  if template_name is null then raise exception 'El servicio base seleccionado no existe o está inactivo.'; end if;

  prefix_normalized := upper(regexp_replace(regexp_replace(translate(lower(prefix_value), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', '_', 'g'), '^_|_$', '', 'g'));
  if prefix_normalized = '' then raise exception 'El prefijo debe incluir letras o números.'; end if;
  service_code := upper(regexp_replace(regexp_replace(translate(lower(template_name), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', '_', 'g'), '^_|_$', '', 'g'));
  route_code_value := service_code || '_' || prefix_normalized;
  select coalesce(max(r.version), 0) + 1 into next_version
    from public.atlas_ops_service_routes r where r.service_template_id = p_service_template_id and r.prefix_key = prefix_normalized;
  update public.atlas_ops_service_routes set is_active = false
    where service_template_id = p_service_template_id and prefix_key = prefix_normalized and is_active;
  insert into public.atlas_ops_service_routes(
    service_template_id, prefix, prefix_key, route_code, version,
    planning_distance_meters, planning_duration_seconds, created_by
  ) values (
    p_service_template_id, prefix_value, prefix_normalized, route_code_value, next_version,
    p_distance_meters, p_duration_seconds, actor
  ) returning id into route_id_value;

  for stop_item in select value from jsonb_array_elements(p_stops) loop
    stop_label := trim(coalesce(stop_item->>'label', ''));
    stop_lat := nullif(stop_item->>'lat', '')::double precision;
    stop_lng := nullif(stop_item->>'lng', '')::double precision;
    provider_id := nullif(trim(coalesce(stop_item->>'providerPlaceId', '')), '');
    source_value := case stop_item->>'source' when 'map_pin' then 'map_pin' when 'preset' then 'preset' else 'tomtom' end;
    if length(stop_label) not between 1 and 240 or stop_lat is null or stop_lng is null
      or stop_lat not between -90 and 90 or stop_lng not between -180 and 180 then
      raise exception 'La parada % no contiene etiqueta y coordenadas válidas.', stop_index + 1;
    end if;
    insert into public.atlas_ops_service_route_stops(route_id, stop_order, label, latitude, longitude, provider_place_id, location_source)
    values (route_id_value, stop_index, stop_label, stop_lat, stop_lng, provider_id, source_value);
    stop_index := stop_index + 1;
  end loop;
  return route_id_value;
end;
$function$;

revoke all on function public.atlas_ops_save_service_route(bigint, text, jsonb, integer, integer) from public, anon;
grant execute on function public.atlas_ops_save_service_route(bigint, text, jsonb, integer, integer) to authenticated;

notify pgrst, 'reload schema';

commit;
