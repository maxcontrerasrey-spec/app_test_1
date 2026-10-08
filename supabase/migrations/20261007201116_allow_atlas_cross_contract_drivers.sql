-- EEES-DB-005: approved
-- owner: Operaciones / Control Tower
-- rollback: forward-only; reponer una validación de negocio solo mediante migración posterior aprobada.

begin;

-- El despacho queda limitado al contrato asignado al usuario; los recursos operacionales
-- (conductores y vehiculos) se consultan globalmente por planificadores autorizados.
create or replace function public.atlas_ops_can_edit_contract(requested_user_id uuid, requested_contract_id bigint)
returns boolean language plpgsql stable security definer set search_path = public
as $function$
begin
  if requested_user_id is null or requested_contract_id is null or auth.uid() is null
     or auth.uid() <> requested_user_id then return false; end if;
  if public.atlas_ops_is_current_super_admin() then
    return exists(select 1 from public.contracts c where c.id = requested_contract_id and c.is_active);
  end if;
  return exists(
    select 1 from public.atlas_ops_contract_editors ce
    join public.contracts c on c.id = ce.contract_id
    where ce.user_id = requested_user_id and ce.contract_id = requested_contract_id
      and ce.is_active and c.is_active
  );
end;
$function$;

create or replace function public.atlas_ops_can_access_global_resources(requested_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select requested_user_id is not null and auth.uid() = requested_user_id
    and (public.atlas_ops_is_current_super_admin() or exists(
      select 1 from public.atlas_ops_contract_editors ce
      join public.contracts c on c.id = ce.contract_id
      where ce.user_id = requested_user_id and ce.is_active and c.is_active
    ))
$$;
revoke all on function public.atlas_ops_can_access_global_resources(uuid) from public, anon;
grant execute on function public.atlas_ops_can_access_global_resources(uuid) to authenticated;

drop policy if exists atlas_ops_contract_editors_select on public.atlas_ops_contract_editors;
create policy atlas_ops_contract_editors_select on public.atlas_ops_contract_editors
  for select to authenticated using (user_id = (select auth.uid()) or public.atlas_ops_is_current_super_admin());

drop policy if exists atlas_ops_vehicles_select on public.atlas_ops_vehicles;
create policy atlas_ops_vehicles_select on public.atlas_ops_vehicles
  for select to authenticated using (public.atlas_ops_can_access_global_resources((select auth.uid())));

-- La busqueda devuelve candidatos globales, nunca restringidos por contrato de origen.
create or replace function public.atlas_ops_search_drivers(p_search text, p_service_date date, p_limit integer default 12)
returns table (
  buk_employee_id text, full_name text, document_number text, document_type text, job_title text,
  contract_code text, area_name text, display_label text, roster_base_status text,
  roster_effective_status text, is_working_day boolean, is_rest_day boolean
)
language plpgsql security definer set search_path = public
as $function$
declare
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_digits text := public.build_employee_document_digits(p_search, '{}'::jsonb);
  safe_limit integer := least(greatest(coalesce(p_limit, 12), 1), 30);
begin
  if not public.atlas_ops_can_access_global_resources(auth.uid()) then
    raise exception 'Sin permiso para consultar recursos operacionales.';
  end if;
  if length(normalized_search) < 2 and length(normalized_digits) < 4 then return; end if;
  return query
  with matched as (
    select e.buk_employee_id, e.full_name,
      coalesce(nullif(trim(e.document_number), ''), nullif(trim(e.raw_payload->>'document_number'), ''), nullif(trim(e.raw_payload->>'rut'), '')) as resolved_document,
      coalesce(nullif(trim(e.document_type), ''), nullif(trim(e.raw_payload->>'document_type'), ''), 'rut') as resolved_document_type,
      public.resolve_active_employee_job_title(e.raw_payload, e.job_title) as resolved_job_title,
      nullif(trim(e.contract_code), '') as resolved_contract_code,
      nullif(trim(e.area_name), '') as resolved_area_name,
      public.build_active_employee_search_text(e.full_name, e.document_number, e.job_title, e.contract_code, e.area_name, e.raw_payload) as search_text,
      public.build_employee_document_digits(e.document_number, e.raw_payload) as document_digits,
      rs.base_status as roster_base_status, rs.effective_status as roster_effective_status,
      rs.is_working_day, rs.is_rest_day
    from public.employees e
    cross join lateral public.resolve_hr_roster_day_status(e.buk_employee_id, coalesce(p_service_date, current_date)) rs
    where e.is_active = true
  ), eligible as (
    select *, case
      when normalized_search <> '' and search_text like normalized_search || '%' then 0
      when normalized_digits <> '' and document_digits like normalized_digits || '%' then 1
      else 2 end as search_rank
    from matched
    where (normalized_search <> '' and search_text like '%' || normalized_search || '%')
       or (normalized_digits <> '' and document_digits like '%' || normalized_digits || '%')
  )
  select e.buk_employee_id, e.full_name, e.resolved_document, e.resolved_document_type, e.resolved_job_title,
    e.resolved_contract_code, e.resolved_area_name,
    concat_ws(' | ', coalesce(e.resolved_document, 'Sin RUT'), coalesce(e.resolved_job_title, 'Sin cargo'), e.full_name,
      coalesce(e.resolved_area_name, e.resolved_contract_code, 'Sin contrato')),
    e.roster_base_status, e.roster_effective_status, e.is_working_day, e.is_rest_day
  from eligible e order by e.search_rank, e.full_name limit safe_limit;
end;
$function$;
revoke all on function public.atlas_ops_search_drivers(text, date, integer) from public, anon;
grant execute on function public.atlas_ops_search_drivers(text, date, integer) to authenticated;

-- El contrato seleccionado define el servicio, no el contrato de origen BUK del trabajador.
-- La elegibilidad sigue dependiendo de identidad BUK activa y jornada válida.
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
  ) then
    raise exception 'El servicio no está activo en el contrato indicado.';
  end if;
  if route_key is not null and not exists (
    select 1 from public.atlas_ops_service_routes r
    where r.id = route_key and r.service_template_id = template_key and r.is_active
  ) then
    raise exception 'La ruta no está activa para el servicio base indicado.';
  end if;
  if template_key is not null
     and exists (select 1 from public.atlas_ops_service_routes r where r.service_template_id = template_key and r.is_active)
     and route_key is null then
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
  if vehicle_key is not null and not exists (
    select 1 from public.atlas_ops_vehicles v where v.id = vehicle_key and v.is_active
  ) then
    raise exception 'El vehículo no está activo.';
  end if;
  if driver_key is not null then
    select e.buk_employee_id, e.full_name, e.document_number
    into driver_row
    from public.employees e
    where e.buk_employee_id = driver_key and e.is_active = true;
    if not found then raise exception 'La ficha BUK exacta no está activa.'; end if;
    if not exists (
      select 1
      from public.resolve_hr_roster_day_status(driver_key, (start_at at time zone 'America/Santiago')::date) rs
      where coalesce(rs.is_working_day, false) and not coalesce(rs.is_rest_day, false)
    ) then
      raise exception 'La jornada BUK no habilita este conductor para la fecha del servicio.';
    end if;
  end if;

  insert into public.atlas_ops_dispatches(
    service_template_id, route_id, contract_id, service_date, shift, planned_start_at, planned_end_at,
    origin_label, destination_label, instructions, driver_buk_employee_id, driver_name_snapshot, driver_document_snapshot,
    vehicle_id, planning_status, created_by, updated_by
  ) values (
    template_key, route_key, contract_key, (start_at at time zone 'America/Santiago')::date, trim(p_payload->>'shift'),
    start_at, end_at, nullif(trim(origin_key), ''), nullif(trim(destination_key), ''),
    nullif(trim(p_payload->>'instructions'), ''), driver_key,
    case when driver_key is null then null else driver_row.full_name end,
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
    where mt.contract_id = contract_key and mt.is_active
      and (mt.service_template_id = template_key or mt.service_template_id is null)
    order by mt.service_template_id desc nulls last, mt.version desc
    on conflict (dispatch_id, code) do nothing;
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
  if actor is null or not public.atlas_ops_can_edit_contract(actor, d.contract_id) then
    raise exception 'Sin permisos para modificar este servicio.';
  end if;
  if p_transition = 'ready' then
    if d.planning_status not in ('draft','planning') or d.service_template_id is null
       or d.driver_buk_employee_id is null or d.vehicle_id is null or d.planned_start_at is null then
      raise exception 'El servicio requiere plantilla, conductor, vehículo y horario antes de quedar listo.';
    end if;
    if not exists (
      select 1 from public.employees e
      where e.buk_employee_id = d.driver_buk_employee_id and e.is_active
    ) then
      raise exception 'La ficha BUK del conductor ya no está activa.';
    end if;
    if not exists (
      select 1 from public.resolve_hr_roster_day_status(d.driver_buk_employee_id, d.service_date) rs
      where coalesce(rs.is_working_day, false) and not coalesce(rs.is_rest_day, false)
    ) then
      raise exception 'La jornada BUK ya no habilita este conductor para la fecha del servicio.';
    end if;
    if not exists (select 1 from public.atlas_ops_vehicles v where v.id = d.vehicle_id and v.is_active) then
      raise exception 'El vehículo ya no está activo.';
    end if;
    update public.atlas_ops_dispatches set planning_status = 'ready', updated_by = actor where id = d.id;
  elsif p_transition = 'publish' then
    if d.planning_status <> 'ready' then raise exception 'Solo se pueden publicar servicios listos.'; end if;
    if exists (
      select 1 from public.atlas_ops_dispatches other
      where other.id <> d.id and other.service_date = d.service_date
        and other.planning_status in ('ready','published')
        and d.planned_start_at < coalesce(other.planned_end_at, other.planned_start_at + interval '1 day')
        and other.planned_start_at < coalesce(d.planned_end_at, d.planned_start_at + interval '1 day')
        and (other.driver_buk_employee_id = d.driver_buk_employee_id or other.vehicle_id = d.vehicle_id)
    ) then
      raise exception 'Existe un conflicto horario de conductor o vehículo.';
    end if;
    update public.atlas_ops_dispatches set planning_status = 'published', published_at = now(), updated_by = actor where id = d.id;
  elsif p_transition = 'cancel' then
    if d.planning_status = 'cancelled' or d.execution_status in ('completed','failed') then
      raise exception 'Transición de cancelación no permitida.';
    end if;
    update public.atlas_ops_dispatches set planning_status = 'cancelled', updated_by = actor where id = d.id;
  elsif p_transition = 'start' then
    if d.planning_status <> 'published' or d.acknowledged_at is null or d.execution_status <> 'not_started' then
      raise exception 'El servicio debe estar publicado y confirmado.';
    end if;
    update public.atlas_ops_dispatches set execution_status = 'in_progress', updated_by = actor where id = d.id;
  elsif p_transition = 'complete' then
    if d.execution_status <> 'in_progress' then raise exception 'Solo se puede completar un servicio en ejecución.'; end if;
    update public.atlas_ops_dispatches set execution_status = 'completed', updated_by = actor where id = d.id;
  else
    raise exception 'Transición de servicio desconocida.';
  end if;
  insert into public.atlas_ops_dispatch_events(dispatch_id, event_type, source, actor_user_id, payload)
  values (d.id, 'dispatch.' || p_transition, 'coordinator', actor, '{}'::jsonb);
end;
$function$;
revoke all on function public.atlas_ops_transition_dispatch(uuid, text) from public, anon;
grant execute on function public.atlas_ops_transition_dispatch(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
