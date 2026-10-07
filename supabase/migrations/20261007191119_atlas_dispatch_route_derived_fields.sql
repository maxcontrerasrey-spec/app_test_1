-- EEES-DB-005: approved
-- owner: Atlas Operations
-- rollback: revert frontend first, then restore the previous atlas_ops_create_dispatch definition from the migration history.
-- Derive dispatch endpoints and estimated completion from the selected saved route.
begin;

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

  if route_key is not null then
    select r.planning_duration_seconds into route_duration
    from public.atlas_ops_service_routes r
    where r.id = route_key and r.service_template_id = template_key and r.is_active;

    select stop.label into origin_key
    from public.atlas_ops_service_route_stops stop
    where stop.route_id = route_key
    order by stop.stop_order asc
    limit 1;

    select stop.label into destination_key
    from public.atlas_ops_service_route_stops stop
    where stop.route_id = route_key
    order by stop.stop_order desc
    limit 1;

    if route_duration > 0 then
      end_at := start_at + make_interval(secs => route_duration);
    end if;
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
    start_at, end_at, nullif(trim(origin_key), ''), nullif(trim(destination_key), ''),
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
notify pgrst, 'reload schema';

commit;
