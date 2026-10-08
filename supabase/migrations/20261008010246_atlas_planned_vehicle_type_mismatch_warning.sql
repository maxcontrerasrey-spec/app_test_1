-- EEES-DB-005: approved
-- owner: Atlas Operations / requested by product owner
-- rollback: revert the frontend; retain the nullable route metadata and the read-only mismatch fields.
begin;

alter table public.atlas_ops_service_routes
  add column planned_vehicle_type text
    check (planned_vehicle_type is null or length(trim(planned_vehicle_type)) between 1 and 80);

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
  if p_planned_vehicle_type is null or length(trim(p_planned_vehicle_type)) not between 1 and 80 then
    raise exception 'Selecciona un tipo de vehículo disponible en la flota.';
  end if;
  select min(trim(v.vehicle_type)) into canonical_vehicle_type
  from public.atlas_ops_vehicles v
  where v.is_active and v.vehicle_type is not null
    and lower(trim(v.vehicle_type)) = lower(trim(p_planned_vehicle_type));
  if canonical_vehicle_type is null then
    raise exception 'El tipo de vehículo ya no está disponible en la flota activa.';
  end if;
  if p_optimization_matrix_duration_seconds is null or p_optimization_matrix_duration_seconds < 0
    or p_input_order_matrix_duration_seconds is not null and p_input_order_matrix_duration_seconds < 0 then
    raise exception 'Las métricas de optimización no son válidas.';
  end if;
  route_key := public.atlas_ops_save_service_route(
    p_service_template_id, p_prefix, p_stops, p_distance_meters, p_duration_seconds
  );
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

create or replace view public.atlas_ops_control_tower
with (security_invoker = true)
as
select d.id, d.contract_id, c.code as contract_code, d.service_date, d.shift, d.planned_start_at, d.acknowledged_at,
       t.name as service_name, d.driver_name_snapshot, d.vehicle_id, v.code as vehicle_code, v.plate,
       d.planning_status, d.execution_status,
       case when exists (select 1 from public.atlas_ops_alerts a where a.dispatch_id = d.id and a.status in ('open','acknowledged') and a.alert_type = 'critical') then 'critical'
            when exists (select 1 from public.atlas_ops_incidents i where i.dispatch_id=d.id and i.status in ('open','investigating') and i.severity='critical') then 'critical'
            when exists (select 1 from public.atlas_ops_alerts a where a.dispatch_id = d.id and a.status in ('open','acknowledged') and a.alert_type = 'at_risk') then 'at_risk'
            when exists (select 1 from public.atlas_ops_incidents i where i.dispatch_id=d.id and i.status in ('open','investigating') and i.severity='high') then 'at_risk'
            when exists (select 1 from public.atlas_ops_alerts a where a.dispatch_id = d.id and a.status in ('open','acknowledged') and a.alert_type = 'attention') then 'attention'
            when exists (select 1 from public.atlas_ops_dispatch_milestones m where m.dispatch_id=d.id and m.required and m.status='pending' and now()>=m.critical_at) then 'critical'
            when exists (select 1 from public.atlas_ops_dispatch_milestones m where m.dispatch_id=d.id and m.required and m.status='pending' and now()>=coalesce(m.warning_at,m.critical_at)) then 'attention'
            else 'green' end as risk_status,
       v.vehicle_type, v.brand, v.model, v.year, d.driver_buk_employee_id,
       roster.is_working_day as driver_is_working_day, roster.is_rest_day as driver_is_rest_day, roster.effective_status as driver_roster_status,
       r.planned_vehicle_type,
       coalesce(r.planned_vehicle_type is not null and v.vehicle_type is not null
         and lower(trim(r.planned_vehicle_type)) <> lower(trim(v.vehicle_type)), false) as vehicle_type_mismatch
from public.atlas_ops_dispatches d
join public.contracts c on c.id = d.contract_id
left join public.atlas_ops_service_templates t on t.id = d.service_template_id
left join public.atlas_ops_vehicles v on v.id = d.vehicle_id
left join public.atlas_ops_service_routes r on r.id = d.route_id
left join lateral public.resolve_hr_roster_day_status(d.driver_buk_employee_id, d.service_date) roster on true;
revoke all on public.atlas_ops_control_tower from public, anon;
grant select on public.atlas_ops_control_tower to authenticated;

notify pgrst, 'reload schema';
commit;
