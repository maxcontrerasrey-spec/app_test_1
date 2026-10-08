-- EEES-DB-005: approved
-- owner: Atlas Operations / requested by product owner
-- rollback: disable ATLAS_ROUTE_INTELLIGENCE_MODE, stop the Edge Function, then revoke the new RPCs; retain audit rows and profile snapshots.
begin;

create table public.atlas_ops_vehicle_routing_profiles (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null unique references public.atlas_ops_vehicles(id) on delete restrict,
  vehicle_type text check (vehicle_type is null or vehicle_type in ('BUS','MINIBUS','VAN','OTHER')),
  passenger_capacity integer check (passenger_capacity is null or passenger_capacity between 1 and 300),
  length_m numeric(6,2) check (length_m is null or length_m between 1 and 30),
  width_m numeric(5,2) check (width_m is null or width_m between 0.5 and 5),
  height_m numeric(5,2) check (height_m is null or height_m between 0.5 and 6),
  wheelbase_m numeric(6,2) check (wheelbase_m is null or wheelbase_m between 0.5 and 20),
  turning_radius_m numeric(6,2) check (turning_radius_m is null or turning_radius_m between 0.5 and 30),
  gross_weight_kg integer check (gross_weight_kg is null or gross_weight_kg between 100 and 100000),
  allow_uturn boolean,
  narrow_road_tolerance text check (narrow_road_tolerance is null or narrow_road_tolerance in ('LOW','MEDIUM','HIGH')),
  operational_tags text[] not null default '{}',
  source text not null default 'admin_entry' check (source in ('admin_entry','manufacturer_spec','fleet_document','other')),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint atlas_ops_vehicle_routing_profile_verified_check check (
    verified_at is null or (vehicle_type is not null and length_m is not null and width_m is not null and height_m is not null and turning_radius_m is not null)
  )
);

create table public.atlas_ops_route_intelligence_runs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (idempotency_key ~ '^[a-f0-9]{64}$'),
  candidate_hash text not null check (candidate_hash ~ '^[a-f0-9]{64}$'),
  service_template_id bigint references public.atlas_ops_service_templates(id) on delete set null,
  contract_id bigint references public.contracts(id) on delete set null,
  service_route_id uuid references public.atlas_ops_service_routes(id) on delete set null,
  vehicle_id uuid references public.atlas_ops_vehicles(id) on delete set null,
  vehicle_profile_snapshot jsonb not null default '{}'::jsonb check (octet_length(vehicle_profile_snapshot::text) <= 8000),
  restriction_snapshot jsonb not null default '[]'::jsonb check (octet_length(restriction_snapshot::text) <= 24000),
  mode text not null check (mode = 'SHADOW'),
  provider text not null check (provider in ('openai','deterministic')),
  model text not null check (model in ('gpt-6-luna','deterministic-v1')),
  agent_version text not null,
  prompt_version text not null,
  maneuver_analyzer_version text not null,
  risk_rules_version text not null,
  decision text not null check (decision in ('APPROVE','WARNING','REJECT','INSUFFICIENT_EVIDENCE','ERROR')),
  risk_score numeric(5,2) check (risk_score is null or risk_score between 0 and 100),
  summary text not null check (length(summary) <= 1200),
  maneuver_count integer not null check (maneuver_count between 0 and 500),
  candidate_maneuver_count integer not null check (candidate_maneuver_count between 0 and 500),
  audited_maneuver_count integer not null check (audited_maneuver_count between 0 and 100),
  maneuver_results jsonb not null default '[]'::jsonb check (octet_length(maneuver_results::text) <= 64000),
  latency_ms integer not null check (latency_ms between 0 and 120000),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost_usd numeric(12,8) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  error_category text check (error_category is null or error_category in ('OPENAI_UNAVAILABLE','OPENAI_TIMEOUT','OPENAI_INVALID_OUTPUT','PROFILE_LOOKUP_FAILED','RESTRICTION_LOOKUP_FAILED','PERSISTENCE_FAILED')),
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index atlas_ops_route_intelligence_runs_route_idx on public.atlas_ops_route_intelligence_runs(service_route_id, created_at desc);
create index atlas_ops_route_intelligence_runs_template_idx on public.atlas_ops_route_intelligence_runs(service_template_id, created_at desc);
create index atlas_ops_route_intelligence_runs_decision_idx on public.atlas_ops_route_intelligence_runs(decision, created_at desc);

create table public.atlas_ops_route_intelligence_feedback (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.atlas_ops_route_intelligence_runs(id) on delete restrict,
  feedback_type text not null check (feedback_type in ('ACCEPT_AI','OVERRIDE_FEASIBLE','OVERRIDE_NOT_FEASIBLE','INSUFFICIENT_INFORMATION')),
  reason text not null default '' check (length(reason) <= 2000),
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint atlas_ops_route_feedback_reason_check check (feedback_type = 'ACCEPT_AI' or length(trim(reason)) > 0)
);

create index atlas_ops_route_intelligence_feedback_run_idx on public.atlas_ops_route_intelligence_feedback(run_id, created_at);

create table public.atlas_ops_route_operational_restrictions (
  id uuid primary key default gen_random_uuid(),
  contract_id bigint references public.contracts(id) on delete restrict,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_m integer not null default 100 check (radius_m between 5 and 5000),
  maneuver_type text check (maneuver_type is null or maneuver_type in ('LEFT','RIGHT','UTURN','STRAIGHT','ROUNDABOUT','MERGE','EXIT','OTHER')),
  vehicle_type text check (vehicle_type is null or vehicle_type in ('BUS','MINIBUS','VAN','OTHER')),
  restriction_level text not null check (restriction_level in ('INFO','CAUTION','BLOCKED')),
  valid_from timestamptz,
  valid_until timestamptz,
  reason text not null check (length(trim(reason)) between 5 and 1200),
  source text not null check (source in ('DRIVER','COORDINATOR','OPERATIONS','CLIENT','MAP','AI_SUGGESTION')),
  confidence numeric(4,3) not null default 0.500 check (confidence between 0 and 1),
  status text not null default 'PROPOSED' check (status in ('PROPOSED','VALIDATED','REJECTED','EXPIRED')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  validated_by uuid references public.profiles(id) on delete restrict,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_ops_route_restriction_validation_check check (
    (status = 'VALIDATED' and validated_by is not null and validated_at is not null)
    or (status <> 'VALIDATED' and validated_by is null and validated_at is null)
  ),
  constraint atlas_ops_route_restriction_time_check check (valid_until is null or valid_from is null or valid_until > valid_from)
);

create table public.atlas_ops_route_restriction_events (
  id uuid primary key default gen_random_uuid(),
  restriction_id uuid not null references public.atlas_ops_route_operational_restrictions(id) on delete restrict,
  action text not null check (action in ('PROPOSED','VALIDATED','REJECTED','EXPIRED')),
  reason text not null default '' check (length(reason) <= 1200),
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index atlas_ops_route_restrictions_active_contract_idx on public.atlas_ops_route_operational_restrictions(contract_id, status, valid_until);
create index atlas_ops_route_restrictions_point_idx on public.atlas_ops_route_operational_restrictions(latitude, longitude) where status = 'VALIDATED';
create index atlas_ops_route_restriction_events_idx on public.atlas_ops_route_restriction_events(restriction_id, created_at);

alter table public.atlas_ops_vehicle_routing_profiles enable row level security;
alter table public.atlas_ops_route_intelligence_runs enable row level security;
alter table public.atlas_ops_route_intelligence_feedback enable row level security;
alter table public.atlas_ops_route_operational_restrictions enable row level security;
alter table public.atlas_ops_route_restriction_events enable row level security;
revoke all on public.atlas_ops_vehicle_routing_profiles, public.atlas_ops_route_intelligence_runs, public.atlas_ops_route_intelligence_feedback, public.atlas_ops_route_operational_restrictions, public.atlas_ops_route_restriction_events from public, anon, authenticated;
grant select on public.atlas_ops_vehicle_routing_profiles, public.atlas_ops_route_intelligence_runs, public.atlas_ops_route_intelligence_feedback, public.atlas_ops_route_operational_restrictions, public.atlas_ops_route_restriction_events to authenticated;
create policy atlas_ops_vehicle_routing_profiles_select on public.atlas_ops_vehicle_routing_profiles for select to authenticated using (public.atlas_ops_is_current_super_admin());
create policy atlas_ops_route_intelligence_runs_select on public.atlas_ops_route_intelligence_runs for select to authenticated using (public.atlas_ops_is_current_super_admin());
create policy atlas_ops_route_intelligence_feedback_select on public.atlas_ops_route_intelligence_feedback for select to authenticated using (public.atlas_ops_is_current_super_admin());
create policy atlas_ops_route_restrictions_select on public.atlas_ops_route_operational_restrictions for select to authenticated using (public.atlas_ops_is_current_super_admin());
create policy atlas_ops_route_restriction_events_select on public.atlas_ops_route_restriction_events for select to authenticated using (public.atlas_ops_is_current_super_admin());
create trigger atlas_ops_route_intelligence_runs_immutable before update or delete on public.atlas_ops_route_intelligence_runs
for each row execute function public.atlas_ops_reject_event_mutation();
create trigger atlas_ops_route_intelligence_feedback_immutable before update or delete on public.atlas_ops_route_intelligence_feedback
for each row execute function public.atlas_ops_reject_event_mutation();
create trigger atlas_ops_route_restriction_events_immutable before update or delete on public.atlas_ops_route_restriction_events
for each row execute function public.atlas_ops_reject_event_mutation();

create or replace function public.atlas_ops_record_route_restriction(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public
as $function$
declare actor uuid := auth.uid(); restriction_key uuid;
begin
  if actor is null or not public.atlas_ops_is_current_super_admin() then raise exception 'Solo un superadministrador puede proponer restricciones de ruta.'; end if;
  if octet_length(p_payload::text) > 5000 then raise exception 'La restricción excede los límites.'; end if;
  if nullif(p_payload->>'contract_id','') is not null and not exists(select 1 from public.contracts c where c.id=(p_payload->>'contract_id')::bigint and c.is_active) then
    raise exception 'Contrato no encontrado o inactivo.';
  end if;
  insert into public.atlas_ops_route_operational_restrictions(
    contract_id,latitude,longitude,radius_m,maneuver_type,vehicle_type,restriction_level,valid_from,valid_until,reason,source,confidence,status,created_by
  ) values (
    nullif(p_payload->>'contract_id','')::bigint,(p_payload->>'latitude')::double precision,(p_payload->>'longitude')::double precision,
    coalesce(nullif(p_payload->>'radius_m','')::integer,100),nullif(p_payload->>'maneuver_type',''),nullif(p_payload->>'vehicle_type',''),
    coalesce(nullif(p_payload->>'restriction_level',''),'CAUTION'),nullif(p_payload->>'valid_from','')::timestamptz,nullif(p_payload->>'valid_until','')::timestamptz,
    trim(p_payload->>'reason'),coalesce(nullif(p_payload->>'source',''),'COORDINATOR'),coalesce(nullif(p_payload->>'confidence','')::numeric,0.5),'PROPOSED',actor
  ) returning id into restriction_key;
  insert into public.atlas_ops_route_restriction_events(restriction_id,action,reason,actor_user_id)
  values(restriction_key,'PROPOSED',trim(p_payload->>'reason'),actor);
  return restriction_key;
end;
$function$;
revoke all on function public.atlas_ops_record_route_restriction(jsonb) from public, anon;
grant execute on function public.atlas_ops_record_route_restriction(jsonb) to authenticated;

create or replace function public.atlas_ops_resolve_route_restriction(p_restriction_id uuid, p_status text, p_reason text)
returns uuid language plpgsql security definer set search_path = public
as $function$
declare actor uuid := auth.uid(); restriction_key uuid;
begin
  if actor is null or not public.atlas_ops_is_current_super_admin() then raise exception 'Solo un superadministrador puede validar restricciones de ruta.'; end if;
  if p_status not in ('VALIDATED','REJECTED','EXPIRED') or length(coalesce(p_reason,'')) > 1200 or (p_status <> 'VALIDATED' and length(trim(coalesce(p_reason,''))) < 5) then
    raise exception 'La resolución de restricción no es válida.';
  end if;
  update public.atlas_ops_route_operational_restrictions set status=p_status,
    validated_by=case when p_status='VALIDATED' then actor else null end,
    validated_at=case when p_status='VALIDATED' then now() else null end, updated_at=now()
  where id=p_restriction_id and status='PROPOSED' returning id into restriction_key;
  if restriction_key is null then raise exception 'La restricción no existe o ya fue resuelta.'; end if;
  insert into public.atlas_ops_route_restriction_events(restriction_id,action,reason,actor_user_id)
  values(restriction_key,p_status,coalesce(p_reason,''),actor);
  return restriction_key;
end;
$function$;
revoke all on function public.atlas_ops_resolve_route_restriction(uuid,text,text) from public, anon;
grant execute on function public.atlas_ops_resolve_route_restriction(uuid,text,text) to authenticated;

create or replace function public.atlas_ops_save_vehicle(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public
as $function$
declare actor uuid := auth.uid(); vehicle_key uuid := nullif(p_payload->>'id','')::uuid; result_id uuid;
begin
  if actor is null or not public.atlas_ops_is_current_super_admin() then raise exception 'Solo un superadministrador puede mantener el padrón de vehículos.'; end if;
  if vehicle_key is null then
    insert into public.atlas_ops_vehicles(code, plate, vehicle_type, client_label, brand, model, year)
    values (upper(trim(p_payload->>'code')), nullif(trim(p_payload->>'plate'),''), nullif(trim(p_payload->>'vehicle_type'),''),
            nullif(trim(p_payload->>'client_label'),''), nullif(trim(p_payload->>'brand'),''), nullif(trim(p_payload->>'model'),''), nullif(trim(p_payload->>'year'),''))
    returning id into result_id;
  else
    update public.atlas_ops_vehicles set code = upper(trim(p_payload->>'code')), plate = nullif(trim(p_payload->>'plate'),''),
      vehicle_type = nullif(trim(p_payload->>'vehicle_type'),''), client_label = nullif(trim(p_payload->>'client_label'),''),
      brand = nullif(trim(p_payload->>'brand'),''), model = nullif(trim(p_payload->>'model'),''), year = nullif(trim(p_payload->>'year'),''),
      is_active = coalesce((p_payload->>'is_active')::boolean,true), updated_at = now()
    where id = vehicle_key returning id into result_id;
    if result_id is null then raise exception 'Vehículo no encontrado.'; end if;
  end if;

  if nullif(p_payload->>'routing_vehicle_type','') is not null
    or nullif(p_payload->>'length_m','') is not null
    or nullif(p_payload->>'width_m','') is not null
    or nullif(p_payload->>'height_m','') is not null
    or nullif(p_payload->>'turning_radius_m','') is not null then
    insert into public.atlas_ops_vehicle_routing_profiles(
      vehicle_id, vehicle_type, passenger_capacity, length_m, width_m, height_m, wheelbase_m,
      turning_radius_m, gross_weight_kg, allow_uturn, narrow_road_tolerance, source, verified_at, verified_by, updated_at
    ) values (
      result_id, nullif(p_payload->>'routing_vehicle_type',''), nullif(p_payload->>'passenger_capacity','')::integer,
      nullif(p_payload->>'length_m','')::numeric, nullif(p_payload->>'width_m','')::numeric, nullif(p_payload->>'height_m','')::numeric,
      nullif(p_payload->>'wheelbase_m','')::numeric, nullif(p_payload->>'turning_radius_m','')::numeric,
      nullif(p_payload->>'gross_weight_kg','')::integer,
      case when p_payload ? 'allow_uturn' and p_payload->>'allow_uturn' in ('true','false') then (p_payload->>'allow_uturn')::boolean else null end,
      nullif(p_payload->>'narrow_road_tolerance',''), coalesce(nullif(p_payload->>'routing_profile_source',''),'admin_entry'),
      case when coalesce((p_payload->>'routing_profile_verified')::boolean,false)
        and nullif(p_payload->>'routing_vehicle_type','') is not null and nullif(p_payload->>'length_m','') is not null
        and nullif(p_payload->>'width_m','') is not null and nullif(p_payload->>'height_m','') is not null
        and nullif(p_payload->>'turning_radius_m','') is not null then now() else null end,
      case when coalesce((p_payload->>'routing_profile_verified')::boolean,false)
        and nullif(p_payload->>'routing_vehicle_type','') is not null and nullif(p_payload->>'length_m','') is not null
        and nullif(p_payload->>'width_m','') is not null and nullif(p_payload->>'height_m','') is not null
        and nullif(p_payload->>'turning_radius_m','') is not null then actor else null end,
      now()
    ) on conflict (vehicle_id) do update set
      vehicle_type=excluded.vehicle_type, passenger_capacity=excluded.passenger_capacity, length_m=excluded.length_m,
      width_m=excluded.width_m, height_m=excluded.height_m, wheelbase_m=excluded.wheelbase_m,
      turning_radius_m=excluded.turning_radius_m, gross_weight_kg=excluded.gross_weight_kg,
      allow_uturn=excluded.allow_uturn, narrow_road_tolerance=excluded.narrow_road_tolerance,
      source=excluded.source, verified_at=excluded.verified_at, verified_by=excluded.verified_by, updated_at=now();
  end if;
  return result_id;
end;
$function$;
revoke all on function public.atlas_ops_save_vehicle(jsonb) from public, anon;
grant execute on function public.atlas_ops_save_vehicle(jsonb) to authenticated;

create or replace function public.atlas_ops_record_route_intelligence_run(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public
as $function$
declare
  actor uuid := auth.uid(); template_key bigint := nullif(p_payload->>'service_template_id','')::bigint;
  route_key uuid := nullif(p_payload->>'service_route_id','')::uuid; vehicle_key uuid := nullif(p_payload->>'vehicle_id','')::uuid;
  contract_key bigint; run_key uuid; idem text := p_payload->>'idempotency_key';
begin
  if actor is null or not public.atlas_ops_is_current_super_admin() then raise exception 'Solo un superadministrador puede registrar auditorías de ruta.'; end if;
  if p_payload->>'mode' <> 'SHADOW' or p_payload->>'provider' not in ('openai','deterministic') then raise exception 'Modo o proveedor de auditoría no válido.'; end if;
  if octet_length(p_payload::text) > 90000 or jsonb_typeof(p_payload->'maneuver_results') <> 'array' then raise exception 'La evidencia de auditoría excede los límites.'; end if;
  if template_key is not null then
    select t.contract_id into contract_key from public.atlas_ops_service_templates t join public.contracts c on c.id=t.contract_id and c.is_active where t.id=template_key and t.is_active;
    if contract_key is null then raise exception 'Servicio base no encontrado o inactivo.'; end if;
  end if;
  if route_key is not null and not exists(select 1 from public.atlas_ops_service_routes r where r.id=route_key and r.service_template_id=template_key) then
    raise exception 'La ruta no pertenece al servicio base seleccionado.';
  end if;
  if vehicle_key is not null and not exists(select 1 from public.atlas_ops_vehicles v where v.id=vehicle_key and v.is_active) then raise exception 'Vehículo no encontrado o inactivo.'; end if;
  if idem !~ '^[a-f0-9]{64}$' or (p_payload->>'candidate_hash') !~ '^[a-f0-9]{64}$' then raise exception 'Huella de auditoría no válida.'; end if;
  insert into public.atlas_ops_route_intelligence_runs(
    idempotency_key,candidate_hash,service_template_id,contract_id,service_route_id,vehicle_id,vehicle_profile_snapshot,restriction_snapshot,
    mode,provider,model,agent_version,prompt_version,maneuver_analyzer_version,risk_rules_version,decision,risk_score,
    summary,maneuver_count,candidate_maneuver_count,audited_maneuver_count,maneuver_results,latency_ms,input_tokens,
    output_tokens,estimated_cost_usd,error_category,actor_user_id
  ) values (
    idem,p_payload->>'candidate_hash',template_key,contract_key,route_key,vehicle_key,coalesce(p_payload->'vehicle_profile_snapshot','{}'::jsonb),coalesce(p_payload->'restriction_snapshot','[]'::jsonb),
    'SHADOW',p_payload->>'provider',p_payload->>'model',p_payload->>'agent_version',p_payload->>'prompt_version',
    p_payload->>'maneuver_analyzer_version',p_payload->>'risk_rules_version',p_payload->>'decision',
    nullif(p_payload->>'risk_score','')::numeric,left(p_payload->>'summary',1200),
    (p_payload->>'maneuver_count')::integer,(p_payload->>'candidate_maneuver_count')::integer,(p_payload->>'audited_maneuver_count')::integer,
    p_payload->'maneuver_results',(p_payload->>'latency_ms')::integer,nullif(p_payload->>'input_tokens','')::integer,
    nullif(p_payload->>'output_tokens','')::integer,nullif(p_payload->>'estimated_cost_usd','')::numeric,
    nullif(p_payload->>'error_category',''),actor
  ) on conflict (idempotency_key) do nothing returning id into run_key;
  if run_key is null then select id into run_key from public.atlas_ops_route_intelligence_runs where idempotency_key=idem; end if;
  return run_key;
end;
$function$;
revoke all on function public.atlas_ops_record_route_intelligence_run(jsonb) from public, anon;
grant execute on function public.atlas_ops_record_route_intelligence_run(jsonb) to authenticated;

create or replace function public.atlas_ops_record_route_intelligence_feedback(p_run_id uuid, p_feedback_type text, p_reason text)
returns uuid language plpgsql security definer set search_path = public
as $function$
declare actor uuid := auth.uid(); feedback_key uuid;
begin
  if actor is null or not public.atlas_ops_is_current_super_admin() then raise exception 'Solo un superadministrador puede registrar feedback de ruta.'; end if;
  if p_feedback_type not in ('ACCEPT_AI','OVERRIDE_FEASIBLE','OVERRIDE_NOT_FEASIBLE','INSUFFICIENT_INFORMATION')
     or length(coalesce(p_reason,'')) > 2000 or (p_feedback_type <> 'ACCEPT_AI' and length(trim(coalesce(p_reason,''))) = 0) then
    raise exception 'El feedback de ruta no es válido.';
  end if;
  if not exists(select 1 from public.atlas_ops_route_intelligence_runs where id=p_run_id) then raise exception 'Auditoría de ruta no encontrada.'; end if;
  insert into public.atlas_ops_route_intelligence_feedback(run_id,feedback_type,reason,actor_user_id)
  values(p_run_id,p_feedback_type,coalesce(p_reason,''),actor) returning id into feedback_key;
  return feedback_key;
end;
$function$;
revoke all on function public.atlas_ops_record_route_intelligence_feedback(uuid,text,text) from public, anon;
grant execute on function public.atlas_ops_record_route_intelligence_feedback(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
