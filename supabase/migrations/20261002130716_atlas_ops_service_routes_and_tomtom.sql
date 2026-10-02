-- EEES-DB-005: approved
-- owner: Atlas Operations, implementation requested by the product owner
-- rollback: revert the frontend/function first; preserve route tables and route_id data, then disable only the new route guard if required.
-- Persist provider-neutral service routes while retaining TomTom planning snapshots.
begin;

create table public.atlas_ops_service_routes (
  id uuid primary key default gen_random_uuid(),
  service_template_id bigint not null references public.atlas_ops_service_templates(id) on delete cascade,
  prefix text not null check (length(prefix) between 1 and 40),
  prefix_key text not null,
  route_code text not null,
  version integer not null check (version > 0),
  is_active boolean not null default true,
  planning_provider text not null default 'tomtom' check (planning_provider = 'tomtom'),
  planning_distance_meters integer check (planning_distance_meters >= 0),
  planning_duration_seconds integer check (planning_duration_seconds >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (service_template_id, prefix_key, version)
);

create unique index atlas_ops_service_routes_one_active_prefix_idx
  on public.atlas_ops_service_routes(service_template_id, prefix_key) where is_active;
create index atlas_ops_service_routes_service_idx
  on public.atlas_ops_service_routes(service_template_id, is_active, created_at desc);

create table public.atlas_ops_service_route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.atlas_ops_service_routes(id) on delete cascade,
  stop_order smallint not null check (stop_order between 0 and 150),
  label text not null check (length(trim(label)) between 1 and 240),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  provider_place_id text check (provider_place_id is null or length(provider_place_id) <= 160),
  location_source text not null default 'tomtom' check (location_source in ('tomtom', 'map_pin')),
  created_at timestamptz not null default now(),
  unique (route_id, stop_order)
);

alter table public.atlas_ops_dispatches
  add column route_id uuid references public.atlas_ops_service_routes(id) on delete set null;
create index atlas_ops_dispatches_route_idx on public.atlas_ops_dispatches(route_id) where route_id is not null;

create or replace function public.atlas_ops_guard_dispatch_route()
returns trigger language plpgsql security definer set search_path = public
as $function$
begin
  if new.route_id is not null and not exists (
    select 1 from public.atlas_ops_service_routes r
    where r.id = new.route_id and r.service_template_id = new.service_template_id and r.is_active
  ) then raise exception 'La ruta debe estar activa y pertenecer al servicio base seleccionado.'; end if;

  if new.planning_status in ('ready', 'published') and new.service_template_id is not null
    and exists (select 1 from public.atlas_ops_service_routes r where r.service_template_id = new.service_template_id and r.is_active)
    and (new.route_id is null or not exists (select 1 from public.atlas_ops_service_routes r where r.id = new.route_id and r.is_active)) then
    raise exception 'Selecciona una ruta activa del servicio base antes de dejarlo listo.';
  end if;
  return new;
end;
$function$;
revoke all on function public.atlas_ops_guard_dispatch_route() from public, anon, authenticated;
create trigger atlas_ops_dispatch_route_guard
  before insert or update of route_id, service_template_id, planning_status on public.atlas_ops_dispatches
  for each row execute function public.atlas_ops_guard_dispatch_route();

create or replace function public.atlas_ops_create_dispatch(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public
as $function$
declare
  actor uuid := auth.uid();
  contract_key bigint := nullif(p_payload->>'contract_id','')::bigint;
  template_key bigint := nullif(p_payload->>'service_template_id','')::bigint;
  route_key uuid := nullif(p_payload->>'route_id','')::uuid;
  start_at timestamptz := nullif(p_payload->>'planned_start_at','')::timestamptz;
  end_at timestamptz := nullif(p_payload->>'planned_end_at','')::timestamptz;
  driver_key text := nullif(trim(p_payload->>'driver_buk_employee_id'),'');
  vehicle_key uuid := nullif(p_payload->>'vehicle_id','')::uuid;
  dispatch_key uuid;
  driver_row record;
begin
  if actor is null or not public.atlas_ops_can_edit_contract(actor, contract_key) then raise exception 'Sin permiso de edición para el contrato.'; end if;
  if start_at is null or nullif(trim(p_payload->>'shift'),'') is null then raise exception 'Fecha/hora y turno son obligatorios.'; end if;
  if template_key is not null and not exists (
    select 1 from public.atlas_ops_service_templates t where t.id = template_key and t.contract_id = contract_key and t.is_active
  ) then raise exception 'El servicio no está activo en el contrato indicado.'; end if;
  if route_key is not null and not exists (
    select 1 from public.atlas_ops_service_routes r where r.id = route_key and r.service_template_id = template_key and r.is_active
  ) then raise exception 'La ruta no está activa para el servicio base indicado.'; end if;
  if template_key is not null and exists (select 1 from public.atlas_ops_service_routes r where r.service_template_id = template_key and r.is_active) and route_key is null then
    raise exception 'Selecciona el recorrido del servicio base para este despacho.';
  end if;
  if vehicle_key is not null and not exists (select 1 from public.atlas_ops_vehicles v where v.id = vehicle_key and v.is_active) then
    raise exception 'El vehículo no está activo.';
  end if;
  if driver_key is not null then
    select e.buk_employee_id, e.full_name, e.document_number, e.is_active, e.contract_code
    into driver_row from public.employees e where e.buk_employee_id = driver_key and e.is_active = true;
    if not found then raise exception 'La ficha BUK exacta no está activa.'; end if;
    if driver_row.contract_code is distinct from (select c.code from public.contracts c where c.id = contract_key and c.is_active) then
      raise exception 'La ficha BUK activa no corresponde al contrato seleccionado.';
    end if;
    if not exists (
      select 1 from public.resolve_hr_roster_day_status(driver_key, (start_at at time zone 'America/Santiago')::date) rs
      where coalesce(rs.is_working_day, false) and not coalesce(rs.is_rest_day, false)
    ) then raise exception 'La jornada BUK no habilita este conductor para la fecha del servicio.'; end if;
  end if;

  insert into public.atlas_ops_dispatches(
    service_template_id, route_id, contract_id, service_date, shift, planned_start_at, planned_end_at,
    origin_label, destination_label, instructions, driver_buk_employee_id, driver_name_snapshot, driver_document_snapshot,
    vehicle_id, planning_status, created_by, updated_by
  ) values (
    template_key, route_key, contract_key, (start_at at time zone 'America/Santiago')::date, trim(p_payload->>'shift'),
    start_at, end_at, nullif(trim(p_payload->>'origin_label'), ''), nullif(trim(p_payload->>'destination_label'), ''),
    nullif(trim(p_payload->>'instructions'), ''), driver_key, case when driver_key is null then null else driver_row.full_name end,
    case when driver_key is null then null else driver_row.document_number end,
    vehicle_key, 'planning', actor, actor
  ) returning id into dispatch_key;

  insert into public.atlas_ops_dispatch_events(dispatch_id, event_type, source, actor_user_id, payload)
  values (dispatch_key, 'dispatch.created', 'coordinator', actor, jsonb_build_object('contract_id', contract_key, 'route_id', route_key));

  if template_key is not null then
    insert into public.atlas_ops_dispatch_milestones(
      dispatch_id, template_id, template_version, code, label, expected_at, warning_at, critical_at, required, source
    )
    select dispatch_key, mt.id, mt.version, mt.code, mt.label,
           start_at + make_interval(mins => mt.offset_minutes),
           start_at + make_interval(mins => mt.offset_minutes - mt.warning_before_minutes),
           start_at + make_interval(mins => mt.offset_minutes), mt.required, mt.source
    from public.atlas_ops_milestone_templates mt
    where mt.contract_id = contract_key and mt.is_active and (mt.service_template_id = template_key or mt.service_template_id is null)
    order by mt.service_template_id desc nulls last, mt.version desc
    on conflict (dispatch_id, code) do nothing;
  end if;
  return dispatch_key;
end;
$function$;
revoke all on function public.atlas_ops_create_dispatch(jsonb) from public, anon;
grant execute on function public.atlas_ops_create_dispatch(jsonb) to authenticated;

alter table public.atlas_ops_service_routes enable row level security;
alter table public.atlas_ops_service_route_stops enable row level security;
revoke all on public.atlas_ops_service_routes, public.atlas_ops_service_route_stops from public, anon, authenticated;
grant select on public.atlas_ops_service_routes, public.atlas_ops_service_route_stops to authenticated;
create policy atlas_ops_service_routes_superadmin_select on public.atlas_ops_service_routes
  for select to authenticated using (public.atlas_ops_is_current_super_admin());
create policy atlas_ops_service_route_stops_superadmin_select on public.atlas_ops_service_route_stops
  for select to authenticated using (
    exists (select 1 from public.atlas_ops_service_routes r where r.id = route_id and public.atlas_ops_is_current_super_admin())
  );

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
    source_value := case when stop_item->>'source' = 'map_pin' then 'map_pin' else 'tomtom' end;
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

drop function public.atlas_ops_driver_get_dispatches();
create function public.atlas_ops_driver_get_dispatches()
returns table(
  id uuid, service_date date, shift text, planned_start_at timestamptz, origin_label text, destination_label text,
  instructions text, acknowledged_at timestamptz, service_name text, vehicle_code text, plate text,
  route_id uuid, route_code text
) language plpgsql security definer set search_path = public
as $function$
declare buk_id text;
begin
  if not public.atlas_ops_is_current_super_admin() then raise exception 'Atlas Operations está habilitado solo para superadministración.'; end if;
  select a.buk_employee_id into buk_id from public.atlas_ops_driver_accounts a
  where a.user_id = auth.uid() and a.is_active;
  if buk_id is null then raise exception 'La cuenta no tiene una identidad de conductor vinculada.'; end if;
  return query select d.id, d.service_date, d.shift, d.planned_start_at, d.origin_label, d.destination_label,
    d.instructions, d.acknowledged_at, t.name, v.code, v.plate, d.route_id, r.route_code
  from public.atlas_ops_dispatches d
  left join public.atlas_ops_service_templates t on t.id=d.service_template_id
  left join public.atlas_ops_vehicles v on v.id=d.vehicle_id
  left join public.atlas_ops_service_routes r on r.id=d.route_id
  where d.driver_buk_employee_id = buk_id and d.planning_status = 'published' and d.service_date >= current_date - 1
  order by d.planned_start_at;
end;
$function$;
revoke all on function public.atlas_ops_driver_get_dispatches() from public, anon;
grant execute on function public.atlas_ops_driver_get_dispatches() to authenticated;

notify pgrst, 'reload schema';
commit;
