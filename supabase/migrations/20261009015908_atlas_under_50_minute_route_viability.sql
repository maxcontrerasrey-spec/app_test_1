-- EEES-DB-005: approved
-- owner: Atlas Operations / under-50-minute operational rule
-- rollback: restore the previous short-route human-feedback and usability predicates if the business threshold changes.
-- A complete route under 3000 seconds is usable without manual point edits; retain AI findings as auditable recommendations.
begin;

create or replace function public.atlas_ops_route_audit_needs_human_feedback(
  p_route_snapshot jsonb,
  p_requires_human_review boolean,
  p_decision text,
  p_requires_replan boolean,
  p_maneuver_results jsonb
) returns boolean
language sql
immutable
set search_path = pg_catalog
as $function$
  with evidence as (
    select
      jsonb_typeof(p_maneuver_results) = 'array' as results_are_valid,
      case when jsonb_typeof(p_route_snapshot->'durationSeconds') = 'number'
        then (p_route_snapshot->>'durationSeconds')::numeric < 3000 else false end as route_under_50_minutes,
      exists (
        select 1 from jsonb_array_elements(
          case when jsonb_typeof(p_maneuver_results) = 'array' then p_maneuver_results else '[]'::jsonb end
        ) as maneuver
        where maneuver->>'decision' in ('INSUFFICIENT_EVIDENCE', 'REJECT')
          or maneuver->>'recommendedAction' in ('HUMAN_REVIEW', 'BLOCK_MANEUVER', 'REQUEST_ALTERNATIVE', 'PENALIZE_SEGMENT')
      ) as has_route_finding
  )
  select case
    when not coalesce(results_are_valid, false) then true
    when route_under_50_minutes then false
    when p_decision in ('REJECT', 'INSUFFICIENT_EVIDENCE') or coalesce(p_requires_replan, true) or has_route_finding then true
    when coalesce(p_requires_human_review, true) then true
    else false
  end
  from evidence;
$function$;
revoke all on function public.atlas_ops_route_audit_needs_human_feedback(jsonb, boolean, text, boolean, jsonb) from public, anon, authenticated;

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
  submitted_stops jsonb; canonical_vehicle_type text; saved_route_id uuid; route_under_50_minutes boolean;
begin
  if actor is null or not public.atlas_ops_is_current_super_admin() then
    raise exception 'Atlas Operations está habilitado solo para superadministración.';
  end if;
  canonical_vehicle_type := public.atlas_ops_route_vehicle_category(p_planned_vehicle_type);
  if canonical_vehicle_type is null then raise exception 'Selecciona Bus, Taxibus o Minibus para calcular el recorrido.'; end if;
  select * into audit_row from public.atlas_ops_route_intelligence_runs where id=p_route_intelligence_run_id for share;
  route_under_50_minutes := coalesce(
    jsonb_typeof(audit_row.route_snapshot->'durationSeconds') = 'number'
      and (audit_row.route_snapshot->>'durationSeconds')::numeric < 3000,
    false
  );
  if not found or audit_row.actor_user_id <> actor or audit_row.provider <> 'openai' or audit_row.mode <> 'SHADOW'
    or audit_row.decision = 'ERROR'
    or (not route_under_50_minutes and (audit_row.decision in ('REJECT','INSUFFICIENT_EVIDENCE') or audit_row.requires_replan))
    or audit_row.audited_maneuver_count < 1 or audit_row.route_snapshot is null
    or audit_row.route_evidence_version <> 1 or audit_row.route_evidence_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(audit_row.maneuver_results) is distinct from 'array'
    or jsonb_array_length(case when jsonb_typeof(audit_row.maneuver_results) = 'array' then audit_row.maneuver_results else '[]'::jsonb end) <> audit_row.audited_maneuver_count
    or (not route_under_50_minutes and exists (
      select 1 from jsonb_array_elements(
        case when jsonb_typeof(audit_row.maneuver_results) = 'array' then audit_row.maneuver_results else '[]'::jsonb end
      ) as maneuver
      where maneuver->>'decision' = 'REJECT'
        or maneuver->>'recommendedAction' in ('BLOCK_MANEUVER','REQUEST_ALTERNATIVE')
    )) then
    raise exception 'Se requiere una auditoría OpenAI persistida y utilizable para esta ruta.';
  end if;
  if public.atlas_ops_route_audit_needs_human_feedback(
    audit_row.route_snapshot, audit_row.requires_human_review, audit_row.decision, audit_row.requires_replan, audit_row.maneuver_results
  ) then
    if not exists (
      select 1 from public.atlas_ops_route_intelligence_feedback f
      where f.run_id = p_route_intelligence_run_id and f.actor_user_id = actor
        and f.feedback_type in ('ACCEPT_AI','OVERRIDE_FEASIBLE')
    ) then
      raise exception 'Registra una revisión humana positiva antes de guardar esta ruta.';
    end if;
  end if;
  if audit_row.service_template_id is distinct from p_service_template_id
    or audit_row.route_snapshot->>'plannedVehicleType' is distinct from canonical_vehicle_type
    or (audit_row.route_snapshot->>'distanceMeters')::integer is distinct from p_distance_meters
    or (audit_row.route_snapshot->>'durationSeconds')::integer is distinct from p_duration_seconds
    or (audit_row.route_snapshot->>'matrixDurationSeconds')::integer is distinct from p_optimization_matrix_duration_seconds
    or nullif(audit_row.route_snapshot->>'inputOrderMatrixDurationSeconds','')::integer is distinct from p_input_order_matrix_duration_seconds then
    raise exception 'La ruta o sus métricas cambiaron después de la evaluación IA; vuelve a proponerla.';
  end if;
  if jsonb_typeof(p_stops) is distinct from 'array' then raise exception 'Las paradas de la ruta no son válidas.'; end if;
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
revoke all on function public.atlas_ops_save_optimized_service_route(bigint,text,jsonb,integer,integer,integer,integer,text,uuid) from public, anon;
grant execute on function public.atlas_ops_save_optimized_service_route(bigint,text,jsonb,integer,integer,integer,integer,text,uuid) to authenticated;

create or replace function public.atlas_ops_route_has_usable_ai_audit(p_route_id uuid)
returns boolean language sql stable security definer set search_path = public
as $function$
  select exists (
    select 1
    from public.atlas_ops_service_routes r
    join public.atlas_ops_route_intelligence_runs ai on ai.id = r.route_intelligence_run_id
    where r.id = p_route_id and r.is_active
      and ai.provider = 'openai' and ai.mode = 'SHADOW' and ai.decision <> 'ERROR'
      and ai.audited_maneuver_count > 0
      and jsonb_typeof(ai.maneuver_results) = 'array'
      and jsonb_array_length(case when jsonb_typeof(ai.maneuver_results) = 'array' then ai.maneuver_results else '[]'::jsonb end) = ai.audited_maneuver_count
      and ai.route_evidence_version = 1 and ai.route_evidence_hash ~ '^[a-f0-9]{64}$'
      and (
        (jsonb_typeof(ai.route_snapshot->'durationSeconds') = 'number' and (ai.route_snapshot->>'durationSeconds')::numeric < 3000)
        or (
          ai.decision not in ('REJECT','INSUFFICIENT_EVIDENCE') and not ai.requires_replan
          and not exists (
            select 1 from jsonb_array_elements(
              case when jsonb_typeof(ai.maneuver_results) = 'array' then ai.maneuver_results else '[]'::jsonb end
            ) as maneuver
            where maneuver->>'decision' = 'REJECT'
              or maneuver->>'recommendedAction' in ('BLOCK_MANEUVER','REQUEST_ALTERNATIVE')
          )
        )
      )
      and (
        not public.atlas_ops_route_audit_needs_human_feedback(
          ai.route_snapshot, ai.requires_human_review, ai.decision, ai.requires_replan, ai.maneuver_results
        )
        or exists (
          select 1 from public.atlas_ops_route_intelligence_feedback f
          where f.run_id = ai.id and f.feedback_type in ('ACCEPT_AI','OVERRIDE_FEASIBLE')
        )
      )
      and ai.route_snapshot->>'plannedVehicleType' = public.atlas_ops_route_vehicle_category(r.planned_vehicle_type)
      and ai.route_snapshot->'stops' = (
        select jsonb_agg(jsonb_build_object('lat', s.latitude, 'lng', s.longitude) order by s.stop_order)
        from public.atlas_ops_service_route_stops s where s.route_id = r.id
      )
  );
$function$;
revoke all on function public.atlas_ops_route_has_usable_ai_audit(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
