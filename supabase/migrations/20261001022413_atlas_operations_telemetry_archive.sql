-- EEES-DB-005: approved
-- owner: User-authorized production release of Atlas GPS retention and Control Tower telemetry.
-- rollback: Revert the app and disable ingestion secrets; retain R2 objects, latest-position snapshots, and geofence records. Schema rollback requires a reviewed data-preserving migration.
begin;

create table public.atlas_ops_vehicle_positions (
  vehicle_id uuid primary key references public.atlas_ops_vehicles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  speed_kph double precision check (speed_kph between 0 and 350),
  heading_degrees double precision check (heading_degrees between 0 and 360),
  ignition boolean,
  odometer_km double precision check (odometer_km >= 0),
  accuracy_m double precision check (accuracy_m >= 0),
  observed_at timestamptz not null,
  provider text not null check (provider in ('tracktec', 'mock')),
  external_event_id text not null,
  updated_at timestamptz not null default now()
);
create index atlas_ops_vehicle_positions_observed_idx
  on public.atlas_ops_vehicle_positions(observed_at desc);
alter table public.atlas_ops_vehicle_positions enable row level security;
revoke all on public.atlas_ops_vehicle_positions from public, anon, authenticated;
grant select on public.atlas_ops_vehicle_positions to authenticated;
create policy atlas_ops_vehicle_positions_superadmin_select
  on public.atlas_ops_vehicle_positions for select to authenticated
  using (public.atlas_ops_is_current_super_admin());

alter table public.atlas_ops_geofence_events
  add column external_event_id text,
  add column provider text,
  add column latitude double precision,
  add column longitude double precision,
  add column accuracy_m double precision;
update public.atlas_ops_geofence_events ge
set external_event_id = te.external_event_id,
    provider = te.provider,
    latitude = te.latitude,
    longitude = te.longitude,
    accuracy_m = te.accuracy_m
from public.atlas_ops_telemetry_events te
where te.id = ge.telemetry_event_id;
alter table public.atlas_ops_geofence_events
  alter column external_event_id set not null,
  alter column provider set not null,
  alter column latitude set not null,
  alter column longitude set not null,
  alter column telemetry_event_id drop not null;
alter table public.atlas_ops_geofence_events
  drop constraint atlas_ops_geofence_events_telemetry_event_id_fkey;
alter table public.atlas_ops_geofence_events
  add constraint atlas_ops_geofence_events_telemetry_event_id_fkey
  foreign key (telemetry_event_id) references public.atlas_ops_telemetry_events(id) on delete set null;
alter table public.atlas_ops_geofence_events
  drop constraint atlas_ops_geofence_events_geofence_id_telemetry_event_id_key;
alter table public.atlas_ops_geofence_events
  add constraint atlas_ops_geofence_events_geofence_provider_event_unique
  unique (geofence_id, provider, external_event_id);
create index atlas_ops_geofence_events_debounce_idx
  on public.atlas_ops_geofence_events(geofence_id, vehicle_id, occurred_at desc);

create index atlas_ops_telemetry_archive_cleanup_idx
  on public.atlas_ops_telemetry_events(provider, raw_reference)
  where raw_reference is not null;

create or replace function public.atlas_ops_apply_geofences()
returns trigger language plpgsql security definer set search_path = public
as $function$
declare
  fence record;
  prior record;
  current_m double precision;
  prior_m double precision;
  transition_name text;
  dispatch_key uuid;
  milestone_row record;
begin
  if new.vehicle_id is null then return new; end if;

  select p.latitude, p.longitude into prior
  from public.atlas_ops_vehicle_positions p
  where p.vehicle_id = new.vehicle_id and p.observed_at < new.observed_at;

  if found then
    for fence in select * from public.atlas_ops_geofences where is_active loop
      if new.accuracy_m is not null and new.accuracy_m > fence.jitter_buffer_meters * 2 then continue; end if;
      current_m := 6371000 * 2 * asin(sqrt(
        power(sin(radians(new.latitude-fence.center_latitude)/2),2) +
        cos(radians(fence.center_latitude))*cos(radians(new.latitude))*power(sin(radians(new.longitude-fence.center_longitude)/2),2)
      ));
      prior_m := 6371000 * 2 * asin(sqrt(
        power(sin(radians(prior.latitude-fence.center_latitude)/2),2) +
        cos(radians(fence.center_latitude))*cos(radians(prior.latitude))*power(sin(radians(prior.longitude-fence.center_longitude)/2),2)
      ));
      transition_name := null;
      if prior_m >= fence.radius_meters + fence.jitter_buffer_meters and current_m <= fence.radius_meters - fence.jitter_buffer_meters then transition_name := 'enter';
      elsif prior_m <= fence.radius_meters - fence.jitter_buffer_meters and current_m >= fence.radius_meters + fence.jitter_buffer_meters then transition_name := 'exit';
      end if;
      if transition_name is null then continue; end if;
      if exists (
        select 1 from public.atlas_ops_geofence_events ge
        where ge.geofence_id=fence.id and ge.vehicle_id=new.vehicle_id
          and ge.occurred_at > new.observed_at - make_interval(secs => fence.min_transition_seconds)
      ) then continue; end if;

      insert into public.atlas_ops_geofence_events(
        geofence_id, telemetry_event_id, external_event_id, provider, vehicle_id, transition,
        occurred_at, latitude, longitude, accuracy_m
      ) values (
        fence.id, new.id, new.external_event_id, new.provider, new.vehicle_id, transition_name,
        new.observed_at, new.latitude, new.longitude, new.accuracy_m
      ) on conflict do nothing;
      if not found then continue; end if;

      select d.id into dispatch_key from public.atlas_ops_dispatches d
      where d.vehicle_id = new.vehicle_id and d.contract_id = fence.contract_id
        and d.planning_status = 'published' and d.service_date = (new.observed_at at time zone 'America/Santiago')::date
      order by d.planned_start_at desc limit 1;
      if dispatch_key is null then continue; end if;
      insert into public.atlas_ops_dispatch_events(dispatch_id,event_type,source,occurred_at,payload)
      values (dispatch_key,'geofence.'||transition_name,new.provider,new.observed_at,
        jsonb_build_object('geofence_id',fence.id,'geofence_code',fence.code,
          'external_event_id',new.external_event_id,'latitude',new.latitude,'longitude',new.longitude));
      if fence.geofence_type = 'workshop' and transition_name = 'exit' then
        select * into milestone_row from public.atlas_ops_dispatch_milestones
        where dispatch_id=dispatch_key and code='WORKSHOP_EXIT' and status='pending' limit 1;
        if found then
          update public.atlas_ops_dispatch_milestones set status='completed',actual_at=new.observed_at where id=milestone_row.id;
          insert into public.atlas_ops_dispatch_events(dispatch_id,milestone_id,event_type,source,occurred_at,payload)
          values(dispatch_key,milestone_row.id,'milestone.completed',new.provider,new.observed_at,
            jsonb_build_object('evidence','geofence','external_event_id',new.external_event_id,
              'latitude',new.latitude,'longitude',new.longitude));
        end if;
      end if;
    end loop;
  end if;

  insert into public.atlas_ops_vehicle_positions(
    vehicle_id, latitude, longitude, speed_kph, heading_degrees, ignition,
    odometer_km, accuracy_m, observed_at, provider, external_event_id, updated_at
  ) values (
    new.vehicle_id, new.latitude, new.longitude, new.speed_kph, new.heading_degrees,
    new.ignition, new.odometer_km, new.accuracy_m, new.observed_at,
    new.provider, new.external_event_id, now()
  ) on conflict (vehicle_id) do update set
    latitude = excluded.latitude, longitude = excluded.longitude,
    speed_kph = excluded.speed_kph, heading_degrees = excluded.heading_degrees,
    ignition = excluded.ignition, odometer_km = excluded.odometer_km,
    accuracy_m = excluded.accuracy_m, observed_at = excluded.observed_at,
    provider = excluded.provider, external_event_id = excluded.external_event_id,
    updated_at = now()
  where excluded.observed_at > public.atlas_ops_vehicle_positions.observed_at;
  return new;
end;
$function$;

drop trigger atlas_ops_telemetry_geofence on public.atlas_ops_telemetry_events;
create trigger atlas_ops_telemetry_geofence after insert on public.atlas_ops_telemetry_events
for each row execute function public.atlas_ops_apply_geofences();

create or replace function public.atlas_ops_ingest_tracktec_positions(
  p_events jsonb, p_archive_reference text, p_payload_digest text
) returns jsonb language plpgsql security definer set search_path = public
as $function$
declare
  item jsonb;
  binding record;
  inserted_id uuid;
  vehicle_ids uuid[] := '{}'::uuid[];
  inserted_count integer := 0;
  unmatched_count integer := 0;
  positions jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Ingestion solo server-side.'; end if;
  if jsonb_typeof(p_events) is distinct from 'array'
     or p_archive_reference is null or p_payload_digest is null then
    raise exception 'Lote de telemetría inválido.';
  end if;
  if jsonb_array_length(p_events) not between 1 and 1000
     or p_archive_reference !~ '^atlas-operations/telemetry/v1/[0-9]{4}/[0-9]{2}/[0-9]{2}/[a-f0-9]{64}\.jsonl\.gz$'
     or p_payload_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'Lote de telemetría inválido.';
  end if;

  for item in select value from jsonb_array_elements(p_events) loop
    select b.id, b.vehicle_id into binding
    from public.atlas_ops_telemetry_vehicle_bindings b
    where b.provider='tracktec' and b.external_vehicle_id=item->>'external_vehicle_id' and b.is_active;
    inserted_id := null;
    insert into public.atlas_ops_telemetry_events(
      provider, external_event_id, external_vehicle_id, binding_id, vehicle_id,
      observed_at, latitude, longitude, speed_kph, heading_degrees, ignition,
      odometer_km, accuracy_m, event_type, raw_reference, payload_digest, processing_status
    ) values (
      'tracktec', item->>'external_event_id', item->>'external_vehicle_id', binding.id, binding.vehicle_id,
      (item->>'observed_at')::timestamptz, (item->>'latitude')::double precision,
      (item->>'longitude')::double precision, nullif(item->>'speed_kph','')::double precision,
      nullif(item->>'heading_degrees','')::double precision, nullif(item->>'ignition','')::boolean,
      nullif(item->>'odometer_km','')::double precision, nullif(item->>'accuracy_m','')::double precision,
      item->>'event_type', p_archive_reference, p_payload_digest,
      case when binding.vehicle_id is null then 'unmatched' else 'processed' end
    ) on conflict (provider, external_event_id) do nothing
    returning id into inserted_id;
    if inserted_id is not null then
      inserted_count := inserted_count + 1;
      if binding.vehicle_id is null then unmatched_count := unmatched_count + 1;
      elsif not (binding.vehicle_id = any(vehicle_ids)) then vehicle_ids := array_append(vehicle_ids, binding.vehicle_id);
      end if;
    end if;
  end loop;

  if cardinality(vehicle_ids) > 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'vehicle_id', p.vehicle_id, 'latitude', p.latitude, 'longitude', p.longitude,
      'speed_kph', p.speed_kph, 'heading_degrees', p.heading_degrees,
      'ignition', p.ignition, 'observed_at', p.observed_at
    )), '[]'::jsonb) into positions
    from public.atlas_ops_vehicle_positions p where p.vehicle_id = any(vehicle_ids);
    perform realtime.send(jsonb_build_object('positions', positions), 'positions.updated', 'atlas-ops:positions', true);
  end if;
  return jsonb_build_object('inserted', inserted_count, 'unmatched', unmatched_count);
end;
$function$;
revoke all on function public.atlas_ops_ingest_tracktec_positions(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.atlas_ops_ingest_tracktec_positions(jsonb, text, text) to service_role;

create or replace function public.atlas_ops_purge_archived_telemetry(p_external_event_ids text[], p_archive_reference text)
returns integer language plpgsql security definer set search_path = public
as $function$
declare deleted_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Limpieza solo server-side.'; end if;
  if p_archive_reference is null or p_external_event_ids is null
     or p_archive_reference !~ '^atlas-operations/telemetry/v1/[0-9]{4}/[0-9]{2}/[0-9]{2}/[a-f0-9]{64}\.jsonl\.gz$'
     or cardinality(p_external_event_ids) not between 1 and 1000 then
    raise exception 'Referencia de archivado inválida.';
  end if;
  delete from public.atlas_ops_telemetry_events
  where provider='tracktec' and raw_reference=p_archive_reference
    and external_event_id = any(p_external_event_ids);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;
revoke all on function public.atlas_ops_purge_archived_telemetry(text[], text) from public, anon, authenticated;
grant execute on function public.atlas_ops_purge_archived_telemetry(text[], text) to service_role;

drop policy if exists atlas_ops_positions_broadcast_superadmin on realtime.messages;
create policy atlas_ops_positions_broadcast_superadmin
  on realtime.messages for select to authenticated
  using (
    extension = 'broadcast' and realtime.topic() = 'atlas-ops:positions'
    and public.atlas_ops_is_current_super_admin()
  );

do $$
begin
  begin alter publication supabase_realtime drop table public.atlas_ops_telemetry_events; exception when undefined_object then null; end;
end $$;

notify pgrst, 'reload schema';
commit;
