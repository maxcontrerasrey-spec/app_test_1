-- EEES-DB-005: approved
-- owner: Explicit user request to prevent saving route proposals pending human review.
-- rollback: Restore the previous audit-bound save RPC; retain all feedback and audit rows.
begin;

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
  if audit_row.requires_human_review and not exists (
    select 1 from public.atlas_ops_route_intelligence_feedback f
    where f.run_id = p_route_intelligence_run_id and f.actor_user_id = actor
      and f.feedback_type in ('ACCEPT_AI','OVERRIDE_FEASIBLE')
  ) then
    raise exception 'Registra una revisión humana positiva antes de guardar esta ruta.';
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

notify pgrst, 'reload schema';
commit;
