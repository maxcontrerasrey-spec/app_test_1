-- EEES-DB-005: approved
-- owner: Operaciones / Control Tower
-- rollback: forward-only; restore hard roster eligibility only through a separately approved migration.
begin;

-- Jornada is advisory. Keep exact active BUK identity and active vehicle checks.
create or replace function public.atlas_ops_create_dispatch(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public
as $function$
declare
  actor uuid := auth.uid();
  contract_key bigint := nullif(p_payload->>'contract_id','')::bigint;
  template_key bigint := nullif(p_payload->>'service_template_id','')::bigint;
  route_key uuid := nullif(p_payload->>'route_id','')::uuid;
  start_at timestamptz := nullif(p_payload->>'planned_start_at','')::timestamptz;
  end_at timestamptz := null;
  route_duration integer;
  origin_key text;
  destination_key text;
  driver_key text := nullif(trim(p_payload->>'driver_buk_employee_id'),'');
  vehicle_key uuid := nullif(p_payload->>'vehicle_id','')::uuid;
  dispatch_key uuid;
  driver_row record;
begin
  if actor is null or not public.atlas_ops_can_edit_contract(actor, contract_key) then
    raise exception 'Sin permiso de edición para el contrato.';
  end if;
  if start_at is null or nullif(trim(p_payload->>'shift'),'') is null then
    raise exception 'Fecha/hora y turno son obligatorios.';
  end if;
  if template_key is not null and not exists (
    select 1 from public.atlas_ops_service_templates t
    where t.id = template_key and t.contract_id = contract_key and t.is_active
  ) then raise exception 'El servicio no está activo en el contrato indicado.'; end if;
  if route_key is not null and not exists (
    select 1 from public.atlas_ops_service_routes r
    where r.id = route_key and r.service_template_id = template_key and r.is_active
  ) then raise exception 'La ruta no está activa para el servicio base indicado.'; end if;
  if template_key is not null
     and exists (select 1 from public.atlas_ops_service_routes r where r.service_template_id = template_key and r.is_active)
     and route_key is null then raise exception 'Selecciona el recorrido del servicio base para este despacho.'; end if;
  if route_key is not null then
    select r.planning_duration_seconds into route_duration from public.atlas_ops_service_routes r
    where r.id = route_key and r.service_template_id = template_key and r.is_active;
    select stop.label into origin_key from public.atlas_ops_service_route_stops stop where stop.route_id = route_key order by stop.stop_order asc limit 1;
    select stop.label into destination_key from public.atlas_ops_service_route_stops stop where stop.route_id = route_key order by stop.stop_order desc limit 1;
    if route_duration > 0 then end_at := start_at + make_interval(secs => route_duration); end if;
  end if;
  if vehicle_key is not null and not exists (select 1 from public.atlas_ops_vehicles v where v.id = vehicle_key and v.is_active) then
    raise exception 'El vehículo no está activo.';
  end if;
  if driver_key is not null then
    select e.buk_employee_id, e.full_name, e.document_number into driver_row
    from public.employees e where e.buk_employee_id = driver_key and e.is_active = true;
    if not found then raise exception 'La ficha BUK exacta no está activa.'; end if;
  end if;
  insert into public.atlas_ops_dispatches(
    service_template_id, route_id, contract_id, service_date, shift, planned_start_at, planned_end_at,
    origin_label, destination_label, instructions, driver_buk_employee_id, driver_name_snapshot, driver_document_snapshot,
    vehicle_id, planning_status, created_by, updated_by
  ) values (
    template_key, route_key, contract_key, (start_at at time zone 'America/Santiago')::date, trim(p_payload->>'shift'),
    start_at, end_at, nullif(trim(origin_key), ''), nullif(trim(destination_key), ''), nullif(trim(p_payload->>'instructions'), ''),
    driver_key, case when driver_key is null then null else driver_row.full_name end,
    case when driver_key is null then null else driver_row.document_number end,
    vehicle_key, 'planning', actor, actor
  ) returning id into dispatch_key;
  insert into public.atlas_ops_dispatch_events(dispatch_id, event_type, source, actor_user_id, payload)
  values (dispatch_key, 'dispatch.created', 'coordinator', actor, jsonb_build_object('contract_id', contract_key, 'route_id', route_key));
  if template_key is not null then
    insert into public.atlas_ops_dispatch_milestones(dispatch_id, template_id, template_version, code, label, expected_at, warning_at, critical_at, required, source)
    select dispatch_key, mt.id, mt.version, mt.code, mt.label, start_at + make_interval(mins => mt.offset_minutes),
      start_at + make_interval(mins => mt.offset_minutes - mt.warning_before_minutes),
      start_at + make_interval(mins => mt.offset_minutes), mt.required, mt.source
    from public.atlas_ops_milestone_templates mt
    where mt.contract_id = contract_key and mt.is_active and (mt.service_template_id = template_key or mt.service_template_id is null)
    order by mt.service_template_id desc nulls last, mt.version desc on conflict (dispatch_id, code) do nothing;
  end if;
  return dispatch_key;
end;
$function$;
revoke all on function public.atlas_ops_create_dispatch(jsonb) from public, anon;
grant execute on function public.atlas_ops_create_dispatch(jsonb) to authenticated;

create or replace function public.atlas_ops_transition_dispatch(p_dispatch_id uuid, p_transition text)
returns void language plpgsql security definer set search_path = public
as $function$
declare
  d public.atlas_ops_dispatches%rowtype;
  actor uuid := auth.uid();
begin
  select * into d from public.atlas_ops_dispatches where id = p_dispatch_id for update;
  if not found then raise exception 'Servicio no encontrado.'; end if;
  if actor is null or not public.atlas_ops_can_edit_contract(actor, d.contract_id) then raise exception 'Sin permisos para modificar este servicio.'; end if;
  if p_transition = 'ready' then
    if d.planning_status not in ('draft','planning') or d.service_template_id is null or d.driver_buk_employee_id is null or d.vehicle_id is null or d.planned_start_at is null then
      raise exception 'El servicio requiere plantilla, conductor, vehículo y horario antes de quedar listo.';
    end if;
    if not exists (select 1 from public.employees e where e.buk_employee_id = d.driver_buk_employee_id and e.is_active) then
      raise exception 'La ficha BUK del conductor ya no está activa.';
    end if;
    if not exists (select 1 from public.atlas_ops_vehicles v where v.id = d.vehicle_id and v.is_active) then raise exception 'El vehículo ya no está activo.'; end if;
    update public.atlas_ops_dispatches set planning_status = 'ready', updated_by = actor, updated_at = now() where id = d.id;
  elsif p_transition = 'publish' then
    if d.planning_status <> 'ready' then raise exception 'Solo se pueden publicar servicios listos.'; end if;
    if exists (
      select 1 from public.atlas_ops_dispatches other where other.id <> d.id and other.service_date = d.service_date
        and other.planning_status in ('ready','published')
        and d.planned_start_at < coalesce(other.planned_end_at, other.planned_start_at + interval '1 day')
        and other.planned_start_at < coalesce(d.planned_end_at, d.planned_start_at + interval '1 day')
        and (other.driver_buk_employee_id = d.driver_buk_employee_id or other.vehicle_id = d.vehicle_id)
    ) then raise exception 'Existe un conflicto horario de conductor o vehículo.'; end if;
    update public.atlas_ops_dispatches set planning_status = 'published', published_at = now(), updated_by = actor, updated_at = now() where id = d.id;
  elsif p_transition = 'cancel' then
    if d.planning_status = 'cancelled' or d.execution_status in ('completed','failed') then raise exception 'Transición de cancelación no permitida.'; end if;
    update public.atlas_ops_dispatches set planning_status = 'cancelled', updated_by = actor, updated_at = now() where id = d.id;
  elsif p_transition = 'start' then
    if d.planning_status <> 'published' or d.acknowledged_at is null or d.execution_status <> 'not_started' then raise exception 'El servicio debe estar publicado y confirmado.'; end if;
    update public.atlas_ops_dispatches set execution_status = 'in_progress', updated_by = actor, updated_at = now() where id = d.id;
  elsif p_transition = 'complete' then
    if d.execution_status <> 'in_progress' then raise exception 'Solo se puede completar un servicio en ejecución.'; end if;
    update public.atlas_ops_dispatches set execution_status = 'completed', updated_by = actor, updated_at = now() where id = d.id;
  else raise exception 'Transición de servicio desconocida.';
  end if;
  insert into public.atlas_ops_dispatch_events(dispatch_id, event_type, source, actor_user_id, payload)
  values (d.id, 'dispatch.' || p_transition, 'coordinator', actor, '{}'::jsonb);
end;
$function$;
revoke all on function public.atlas_ops_transition_dispatch(uuid, text) from public, anon;
grant execute on function public.atlas_ops_transition_dispatch(uuid, text) to authenticated;

create or replace function public.atlas_ops_reassign_dispatch(
  p_dispatch_id uuid, p_driver_buk_employee_id text default null, p_vehicle_id uuid default null, p_reason text default null
)
returns void language plpgsql security definer set search_path = public
as $function$
declare
  actor uuid := auth.uid();
  d public.atlas_ops_dispatches%rowtype;
  old_driver jsonb;
  new_driver jsonb;
  old_vehicle jsonb;
  new_vehicle jsonb;
  driver_key text := nullif(trim(p_driver_buk_employee_id), '');
  vehicle_key uuid := p_vehicle_id;
  reason_text text := nullif(trim(p_reason), '');
  in_execution boolean;
  replace_driver boolean;
  replace_vehicle boolean;
begin
  if actor is null then raise exception 'Sesión requerida.'; end if;
  select * into d from public.atlas_ops_dispatches where id = p_dispatch_id for update;
  if not found then raise exception 'Servicio no encontrado.'; end if;
  if not public.atlas_ops_can_edit_contract(actor, d.contract_id) then raise exception 'Sin permisos para modificar este servicio.'; end if;
  if d.planning_status = 'cancelled' or d.execution_status in ('completed','failed') then raise exception 'No se pueden reasignar recursos de un servicio cerrado.'; end if;
  if driver_key = d.driver_buk_employee_id then driver_key := null; end if;
  if vehicle_key = d.vehicle_id then vehicle_key := null; end if;
  replace_driver := driver_key is not null;
  replace_vehicle := vehicle_key is not null;
  if driver_key is null and vehicle_key is null then raise exception 'Selecciona un conductor o vehículo de reemplazo.'; end if;
  if reason_text is null or length(reason_text) < 5 then raise exception 'Registra un motivo de al menos 5 caracteres.'; end if;
  in_execution := d.execution_status in ('in_progress','suspended');

  old_driver := case when d.driver_buk_employee_id is null then null else jsonb_build_object('buk_employee_id', d.driver_buk_employee_id, 'name', d.driver_name_snapshot, 'document', d.driver_document_snapshot) end;
  old_vehicle := case when d.vehicle_id is null then null else (select jsonb_build_object('id', v.id, 'code', v.code, 'plate', v.plate, 'type', v.vehicle_type, 'brand', v.brand, 'model', v.model, 'year', v.year) from public.atlas_ops_vehicles v where v.id = d.vehicle_id) end;

  if driver_key is not null then
    select jsonb_build_object('buk_employee_id', e.buk_employee_id, 'name', e.full_name, 'document', e.document_number) into new_driver
    from public.employees e where e.buk_employee_id = driver_key and e.is_active = true;
    if not found then raise exception 'La ficha BUK exacta del conductor de reemplazo no está activa.'; end if;
  else new_driver := old_driver; driver_key := d.driver_buk_employee_id; end if;
  if vehicle_key is not null then
    select jsonb_build_object('id', v.id, 'code', v.code, 'plate', v.plate, 'type', v.vehicle_type, 'brand', v.brand, 'model', v.model, 'year', v.year) into new_vehicle
    from public.atlas_ops_vehicles v where v.id = vehicle_key and v.is_active = true;
    if not found then raise exception 'El vehículo de reemplazo no está activo.'; end if;
  else new_vehicle := old_vehicle; vehicle_key := d.vehicle_id; end if;

  if d.planned_start_at is not null and exists (
    select 1 from public.atlas_ops_dispatches other where other.id <> d.id and other.service_date = d.service_date
      and other.planning_status in ('ready','published')
      and other.execution_status not in ('completed','failed')
      and d.planned_start_at < coalesce(other.planned_end_at, other.planned_start_at + interval '1 day')
      and other.planned_start_at < coalesce(d.planned_end_at, d.planned_start_at + interval '1 day')
      and ((replace_driver and other.driver_buk_employee_id = driver_key) or (replace_vehicle and other.vehicle_id = vehicle_key))
  ) then raise exception 'El recurso de reemplazo ya está asignado a otro servicio en ese horario.'; end if;

  update public.atlas_ops_dispatches set driver_buk_employee_id = driver_key,
    driver_name_snapshot = new_driver->>'name', driver_document_snapshot = new_driver->>'document',
    vehicle_id = vehicle_key, updated_by = actor, updated_at = now() where id = d.id;
  insert into public.atlas_ops_dispatch_events(dispatch_id, event_type, source, actor_user_id, payload)
  values (d.id, 'dispatch.resources_reassigned', 'coordinator', actor,
    jsonb_build_object('old_driver', old_driver, 'new_driver', new_driver, 'old_vehicle', old_vehicle, 'new_vehicle', new_vehicle,
      'reason', reason_text, 'contingency', in_execution));
end;
$function$;
revoke all on function public.atlas_ops_reassign_dispatch(uuid, text, uuid, text) from public, anon;
grant execute on function public.atlas_ops_reassign_dispatch(uuid, text, uuid, text) to authenticated;

-- Keep existing view columns in place and append assignment metadata for consumers.
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
       roster.is_working_day as driver_is_working_day, roster.is_rest_day as driver_is_rest_day, roster.effective_status as driver_roster_status
from public.atlas_ops_dispatches d
join public.contracts c on c.id = d.contract_id
left join public.atlas_ops_service_templates t on t.id = d.service_template_id
left join public.atlas_ops_vehicles v on v.id = d.vehicle_id
left join lateral public.resolve_hr_roster_day_status(d.driver_buk_employee_id, d.service_date) roster on true;
revoke all on public.atlas_ops_control_tower from public, anon;
grant select on public.atlas_ops_control_tower to authenticated;

notify pgrst, 'reload schema';
commit;
