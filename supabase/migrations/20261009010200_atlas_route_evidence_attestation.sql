-- EEES-DB-005: approved
-- owner: Atlas Operations / route evidence provenance
-- rollback: disable route save/dispatch evidence triggers only after reverting Edge verification; keep provenance columns and audit history.
begin;

alter table public.atlas_ops_route_intelligence_runs
  add column route_evidence_version smallint not null default 0,
  add column route_evidence_hash text,
  add constraint atlas_ops_route_intelligence_evidence_version_check check (route_evidence_version in (0, 1)),
  add constraint atlas_ops_route_intelligence_evidence_hash_check check (
    (route_evidence_version = 0 and route_evidence_hash is null)
    or (route_evidence_version = 1 and route_evidence_hash is not null and route_evidence_hash ~ '^[a-f0-9]{64}$')
  );

create or replace function public.atlas_ops_record_route_intelligence_run(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public
as $function$
declare
  actor uuid := nullif(p_payload->>'actor_user_id','')::uuid; template_key bigint := nullif(p_payload->>'service_template_id','')::bigint;
  route_key uuid := nullif(p_payload->>'service_route_id','')::uuid; vehicle_key uuid := nullif(p_payload->>'vehicle_id','')::uuid;
  contract_key bigint; run_key uuid; idem text := p_payload->>'idempotency_key'; evidence_version smallint;
begin
  if coalesce(auth.role(),'') <> 'service_role' or actor is null or not exists (
    select 1 from public.profiles p where p.id=actor and p.status='active' and p.is_super_admin=true
  ) then raise exception 'Solo la auditoría de servidor de un superadministrador activo puede registrar resultados.'; end if;
  if p_payload->>'mode' <> 'SHADOW' or p_payload->>'provider' <> 'openai' then raise exception 'Modo o proveedor de auditoría no válido.'; end if;
  if octet_length(p_payload::text) > 90000 or jsonb_typeof(p_payload->'maneuver_results') <> 'array'
    or jsonb_typeof(p_payload->'route_snapshot') <> 'object' then raise exception 'La evidencia de auditoría excede los límites.'; end if;
  evidence_version := nullif(p_payload->>'route_evidence_version','')::smallint;
  if evidence_version is distinct from 1 or coalesce(p_payload->>'route_evidence_hash','') !~ '^[a-f0-9]{64}$' then
    raise exception 'La ruta no tiene una atestación de servidor válida.';
  end if;
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
    or jsonb_array_length(p_payload->'route_snapshot'->'stops') not between 2 and 151 then
    raise exception 'La auditoría debe contener una ruta completa revisada por OpenAI.';
  end if;
  insert into public.atlas_ops_route_intelligence_runs(
    idempotency_key,candidate_hash,route_snapshot,route_evidence_version,route_evidence_hash,requires_replan,requires_human_review,
    service_template_id,contract_id,service_route_id,vehicle_id,vehicle_profile_snapshot,restriction_snapshot,
    mode,provider,model,agent_version,prompt_version,maneuver_analyzer_version,risk_rules_version,decision,risk_score,
    summary,maneuver_count,candidate_maneuver_count,audited_maneuver_count,maneuver_results,latency_ms,input_tokens,
    output_tokens,estimated_cost_usd,error_category,actor_user_id
  ) values (
    idem,p_payload->>'candidate_hash',p_payload->'route_snapshot',evidence_version,p_payload->>'route_evidence_hash',coalesce((p_payload->>'requires_replan')::boolean,false),
    coalesce((p_payload->>'requires_human_review')::boolean,true),template_key,contract_key,route_key,vehicle_key,
    coalesce(p_payload->'vehicle_profile_snapshot','{}'::jsonb),coalesce(p_payload->'restriction_snapshot','[]'::jsonb),
    'SHADOW','openai',p_payload->>'model',p_payload->>'agent_version',p_payload->>'prompt_version',
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
revoke all on function public.atlas_ops_record_route_intelligence_run(jsonb) from public, anon, authenticated;
grant execute on function public.atlas_ops_record_route_intelligence_run(jsonb) to service_role;

create or replace function public.atlas_ops_route_has_attested_ai_evidence(p_route_id uuid)
returns boolean language sql stable security definer set search_path = public
as $function$
  select exists (
    select 1 from public.atlas_ops_service_routes r
    join public.atlas_ops_route_intelligence_runs ai on ai.id = r.route_intelligence_run_id
    where r.id = p_route_id and ai.route_evidence_version = 1 and ai.route_evidence_hash ~ '^[a-f0-9]{64}$'
  );
$function$;
revoke all on function public.atlas_ops_route_has_attested_ai_evidence(uuid) from public, anon, authenticated;

create or replace function public.atlas_ops_guard_route_evidence_link()
returns trigger language plpgsql security definer set search_path = public
as $function$
begin
  if new.route_intelligence_run_id is not null and not exists (
    select 1 from public.atlas_ops_route_intelligence_runs ai
    where ai.id = new.route_intelligence_run_id and ai.route_evidence_version = 1 and ai.route_evidence_hash ~ '^[a-f0-9]{64}$'
  ) then raise exception 'La ruta requiere evidencia firmada por el planificador.'; end if;
  return new;
end;
$function$;
revoke all on function public.atlas_ops_guard_route_evidence_link() from public, anon, authenticated;
drop trigger if exists atlas_ops_route_evidence_link_guard on public.atlas_ops_service_routes;
create trigger atlas_ops_route_evidence_link_guard before insert or update of route_intelligence_run_id on public.atlas_ops_service_routes
for each row execute function public.atlas_ops_guard_route_evidence_link();

create or replace function public.atlas_ops_guard_dispatch_attested_route()
returns trigger language plpgsql security definer set search_path = public
as $function$
begin
  if new.route_id is not null and not public.atlas_ops_route_has_attested_ai_evidence(new.route_id) then
    raise exception 'No se puede despachar una ruta sin evidencia firmada por el planificador.';
  end if;
  return new;
end;
$function$;
revoke all on function public.atlas_ops_guard_dispatch_attested_route() from public, anon, authenticated;
drop trigger if exists atlas_ops_dispatch_attested_route_guard on public.atlas_ops_dispatches;
create trigger atlas_ops_dispatch_attested_route_guard before insert or update of route_id on public.atlas_ops_dispatches
for each row execute function public.atlas_ops_guard_dispatch_attested_route();

notify pgrst, 'reload schema';
commit;
