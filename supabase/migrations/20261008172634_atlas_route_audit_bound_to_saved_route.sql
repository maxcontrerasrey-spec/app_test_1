-- EEES-DB-005: approved
-- owner: Atlas Operations / requested by product owner
-- rollback: redeploy the previous frontend and Edge Functions; preserve append-only audit history.
begin;

alter table public.atlas_ops_route_intelligence_runs
  add column route_snapshot jsonb,
  add column requires_replan boolean not null default false,
  add column requires_human_review boolean not null default true,
  add constraint atlas_ops_route_intelligence_route_snapshot_size check (
    route_snapshot is null or octet_length(route_snapshot::text) <= 30000
  ),
  drop constraint if exists atlas_ops_route_intelligence_runs_error_category_check;

alter table public.atlas_ops_route_intelligence_runs
  add constraint atlas_ops_route_intelligence_runs_error_category_check check (
    error_category is null or error_category in (
      'OPENAI_UNAVAILABLE','OPENAI_TIMEOUT','OPENAI_INVALID_OUTPUT','OPENAI_RATE_LIMITED','OPENAI_SERVER_ERROR',
      'PROFILE_LOOKUP_FAILED','RESTRICTION_LOOKUP_FAILED','PERSISTENCE_FAILED'
    )
  );

alter table public.atlas_ops_service_routes
  add column route_intelligence_run_id uuid references public.atlas_ops_route_intelligence_runs(id) on delete restrict,
  drop constraint if exists atlas_ops_service_routes_optimization_method_check;

alter table public.atlas_ops_service_routes
  add constraint atlas_ops_service_routes_optimization_method_check
  check (optimization_method in ('manual_order','valhalla_matrix_open_path_v1','valhalla_matrix_open_path_v2'));

create unique index atlas_ops_service_routes_route_intelligence_run_uidx
  on public.atlas_ops_service_routes(route_intelligence_run_id)
  where route_intelligence_run_id is not null;

create or replace function public.atlas_ops_record_route_intelligence_run(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public
as $function$
declare
  actor uuid := nullif(p_payload->>'actor_user_id','')::uuid; template_key bigint := nullif(p_payload->>'service_template_id','')::bigint;
  route_key uuid := nullif(p_payload->>'service_route_id','')::uuid; vehicle_key uuid := nullif(p_payload->>'vehicle_id','')::uuid;
  contract_key bigint; run_key uuid; idem text := p_payload->>'idempotency_key';
begin
  if coalesce(auth.role(),'') <> 'service_role' or actor is null or not exists (
    select 1 from public.profiles p where p.id=actor and p.status='active' and p.is_super_admin=true
  ) then raise exception 'Solo la auditoría de servidor de un superadministrador activo puede registrar resultados.'; end if;
  if p_payload->>'mode' <> 'SHADOW' or p_payload->>'provider' not in ('openai','deterministic') then raise exception 'Modo o proveedor de auditoría no válido.'; end if;
  if octet_length(p_payload::text) > 90000 or jsonb_typeof(p_payload->'maneuver_results') <> 'array'
    or jsonb_typeof(p_payload->'route_snapshot') <> 'object' then raise exception 'La evidencia de auditoría excede los límites.'; end if;
  if template_key is not null then
    select t.contract_id into contract_key from public.atlas_ops_service_templates t join public.contracts c on c.id=t.contract_id and c.is_active where t.id=template_key and t.is_active;
    if contract_key is null then raise exception 'Servicio base no encontrado o inactivo.'; end if;
  end if;
  if route_key is not null and not exists(select 1 from public.atlas_ops_service_routes r where r.id=route_key and r.service_template_id=template_key) then
    raise exception 'La ruta no pertenece al servicio base seleccionado.';
  end if;
  if vehicle_key is not null and not exists(select 1 from public.atlas_ops_vehicles v where v.id=vehicle_key and v.is_active) then raise exception 'Vehículo no encontrado o inactivo.'; end if;
  if idem !~ '^[a-f0-9]{64}$' or (p_payload->>'candidate_hash') !~ '^[a-f0-9]{64}$' then raise exception 'Huella de auditoría no válida.'; end if;
  if jsonb_typeof(p_payload->'route_snapshot'->'stops') is distinct from 'array'
    or nullif(p_payload->'route_snapshot'->>'plannedVehicleType','') is null
    or coalesce(p_payload->>'provider','') <> 'openai' then
    raise exception 'La auditoría debe corresponder a una ruta completa revisada por OpenAI.';
  end if;
  if jsonb_array_length(p_payload->'route_snapshot'->'stops') not between 2 and 151 then
    raise exception 'La auditoría debe contener todas las paradas del recorrido.';
  end if;
  insert into public.atlas_ops_route_intelligence_runs(
    idempotency_key,candidate_hash,route_snapshot,requires_replan,requires_human_review,
    service_template_id,contract_id,service_route_id,vehicle_id,vehicle_profile_snapshot,restriction_snapshot,
    mode,provider,model,agent_version,prompt_version,maneuver_analyzer_version,risk_rules_version,decision,risk_score,
    summary,maneuver_count,candidate_maneuver_count,audited_maneuver_count,maneuver_results,latency_ms,input_tokens,
    output_tokens,estimated_cost_usd,error_category,actor_user_id
  ) values (
    idem,p_payload->>'candidate_hash',p_payload->'route_snapshot',coalesce((p_payload->>'requires_replan')::boolean,false),
    coalesce((p_payload->>'requires_human_review')::boolean,true),template_key,contract_key,route_key,vehicle_key,
    coalesce(p_payload->'vehicle_profile_snapshot','{}'::jsonb),coalesce(p_payload->'restriction_snapshot','[]'::jsonb),
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

create or replace function public.atlas_ops_save_optimized_service_route(
  p_service_template_id bigint,
  p_prefix text,
  p_stops jsonb,
  p_distance_meters integer,
  p_duration_seconds integer,
  p_optimization_matrix_duration_seconds integer,
  p_input_order_matrix_duration_seconds integer,
  p_planned_vehicle_type text,
  p_route_intelligence_run_id uuid
) returns uuid language plpgsql security definer set search_path = public
as $function$
declare
  actor uuid := auth.uid(); audit_row public.atlas_ops_route_intelligence_runs%rowtype;
  submitted_stops jsonb; canonical_vehicle_type text; saved_route_id uuid;
begin
  if actor is null or not public.atlas_ops_is_current_super_admin() then
    raise exception 'Atlas Operations está habilitado solo para superadministración.';
  end if;
  canonical_vehicle_type := public.atlas_ops_route_vehicle_category(p_planned_vehicle_type);
  if canonical_vehicle_type is null then raise exception 'Selecciona Bus, Taxibus o Minibus para calcular el recorrido.'; end if;
  select * into audit_row from public.atlas_ops_route_intelligence_runs where id=p_route_intelligence_run_id for share;
  if not found or audit_row.actor_user_id <> actor or audit_row.provider <> 'openai' or audit_row.mode <> 'SHADOW'
    or audit_row.decision in ('ERROR','REJECT') or audit_row.requires_replan or audit_row.audited_maneuver_count < 1
    or audit_row.route_snapshot is null then
    raise exception 'Se requiere una auditoría OpenAI persistida y utilizable para esta ruta.';
  end if;
  if audit_row.service_template_id is distinct from p_service_template_id
    or audit_row.route_snapshot->>'plannedVehicleType' is distinct from canonical_vehicle_type
    or (audit_row.route_snapshot->>'distanceMeters')::integer is distinct from p_distance_meters
    or (audit_row.route_snapshot->>'durationSeconds')::integer is distinct from p_duration_seconds
    or (audit_row.route_snapshot->>'matrixDurationSeconds')::integer is distinct from p_optimization_matrix_duration_seconds
    or nullif(audit_row.route_snapshot->>'inputOrderMatrixDurationSeconds','')::integer is distinct from p_input_order_matrix_duration_seconds then
    raise exception 'La ruta o sus métricas cambiaron después de la evaluación IA; vuelve a proponerla.';
  end if;
  if jsonb_typeof(p_stops) is distinct from 'array' then
    raise exception 'Las paradas de la ruta no son válidas.';
  end if;
  if jsonb_array_length(p_stops) not between 2 and 151 then raise exception 'Las paradas de la ruta no son válidas.'; end if;
  select jsonb_agg(jsonb_build_object('lat',(value->>'lat')::numeric,'lng',(value->>'lng')::numeric) order by ordinality)
    into submitted_stops from jsonb_array_elements(p_stops) with ordinality;
  if submitted_stops is distinct from audit_row.route_snapshot->'stops' then
    raise exception 'Las paradas cambiaron después de la evaluación IA; vuelve a proponer el recorrido.';
  end if;
  saved_route_id := public.atlas_ops_save_optimized_service_route(
    p_service_template_id,p_prefix,p_stops,p_distance_meters,p_duration_seconds,
    p_optimization_matrix_duration_seconds,p_input_order_matrix_duration_seconds,p_planned_vehicle_type
  );
  update public.atlas_ops_service_routes set route_intelligence_run_id=p_route_intelligence_run_id,
    optimization_method='valhalla_matrix_open_path_v2'
    where id=saved_route_id and created_by=actor;
  if not found then raise exception 'No fue posible vincular la auditoría IA a la ruta guardada.'; end if;
  return saved_route_id;
end;
$function$;

-- Older public entry points would otherwise bypass the audit-bound signature.
revoke all on function public.atlas_ops_save_optimized_service_route(bigint,text,jsonb,integer,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.atlas_ops_save_optimized_service_route(bigint,text,jsonb,integer,integer,integer,integer,text) from public, anon, authenticated;
revoke all on function public.atlas_ops_save_service_route(bigint,text,jsonb,integer,integer) from public, anon, authenticated;
revoke all on function public.atlas_ops_save_optimized_service_route(bigint,text,jsonb,integer,integer,integer,integer,text,uuid) from public, anon;
grant execute on function public.atlas_ops_save_optimized_service_route(bigint,text,jsonb,integer,integer,integer,integer,text,uuid) to authenticated;
revoke all on function public.atlas_ops_record_route_intelligence_run(jsonb) from public, anon, authenticated;
grant execute on function public.atlas_ops_record_route_intelligence_run(jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
