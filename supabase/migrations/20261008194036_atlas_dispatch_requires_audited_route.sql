-- EEES-DB-005: approved
-- owner: Atlas Operations / route intelligence integrity
-- rollback: restore atlas_ops_guard_dispatch_route from 20261002130716 only after removing route use from dispatch workflows.
-- Do not dispatch or publish an active route unless its exact saved stops have a usable OpenAI audit.
begin;

create or replace function public.atlas_ops_route_has_usable_ai_audit(p_route_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.atlas_ops_service_routes r
    join public.atlas_ops_route_intelligence_runs ai on ai.id = r.route_intelligence_run_id
    where r.id = p_route_id
      and r.is_active
      and ai.provider = 'openai'
      and ai.mode = 'SHADOW'
      and ai.decision not in ('ERROR', 'REJECT')
      and not ai.requires_replan
      and ai.audited_maneuver_count > 0
      and jsonb_typeof(ai.maneuver_results) = 'array'
      and jsonb_array_length(case when jsonb_typeof(ai.maneuver_results) = 'array' then ai.maneuver_results else '[]'::jsonb end) = ai.audited_maneuver_count
      and not exists (
        select 1 from jsonb_array_elements(
          case when jsonb_typeof(ai.maneuver_results) = 'array' then ai.maneuver_results else '[]'::jsonb end
        ) as maneuver
        where maneuver->>'decision' = 'REJECT'
          or maneuver->>'recommendedAction' in ('BLOCK_MANEUVER', 'REQUEST_ALTERNATIVE')
      )
      and (
        (
          not ai.requires_human_review
          and ai.decision <> 'INSUFFICIENT_EVIDENCE'
          and not exists (
            select 1 from jsonb_array_elements(
              case when jsonb_typeof(ai.maneuver_results) = 'array' then ai.maneuver_results else '[]'::jsonb end
            ) as maneuver
            where maneuver->>'decision' = 'INSUFFICIENT_EVIDENCE'
              or maneuver->>'recommendedAction' in ('HUMAN_REVIEW', 'PENALIZE_SEGMENT')
          )
        )
        or exists (
          select 1 from public.atlas_ops_route_intelligence_feedback f
          where f.run_id = ai.id and f.feedback_type in ('ACCEPT_AI', 'OVERRIDE_FEASIBLE')
        )
      )
      and ai.route_snapshot->>'plannedVehicleType' = public.atlas_ops_route_vehicle_category(r.planned_vehicle_type)
      and ai.route_snapshot->'stops' = (
        select jsonb_agg(jsonb_build_object('lat', s.latitude, 'lng', s.longitude) order by s.stop_order)
        from public.atlas_ops_service_route_stops s
        where s.route_id = r.id
      )
  );
$function$;
revoke all on function public.atlas_ops_route_has_usable_ai_audit(uuid) from public, anon, authenticated;

create or replace function public.atlas_ops_guard_dispatch_route()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.route_id is not null and not exists (
    select 1 from public.atlas_ops_service_routes r
    where r.id = new.route_id and r.service_template_id = new.service_template_id and r.is_active
  ) then
    raise exception 'La ruta debe estar activa y pertenecer al servicio base seleccionado.';
  end if;

  if new.route_id is not null and not public.atlas_ops_route_has_usable_ai_audit(new.route_id) then
    raise exception 'La ruta requiere una auditoría IA válida vinculada a sus paradas antes de despachar. Vuelve a planificarla y guardarla.';
  end if;

  if new.planning_status in ('ready', 'published') and new.service_template_id is not null
    and exists (select 1 from public.atlas_ops_service_routes r where r.service_template_id = new.service_template_id and r.is_active)
    and (new.route_id is null or not public.atlas_ops_route_has_usable_ai_audit(new.route_id)) then
    raise exception 'Selecciona una ruta activa con auditoría IA válida antes de dejar el servicio listo.';
  end if;
  return new;
end;
$function$;
revoke all on function public.atlas_ops_guard_dispatch_route() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
