-- Phase-one access boundary: driver RPCs stay unavailable until driver release is authorized.
-- EEES-DB-005: approved
-- owner: Explicit user authorization to release Atlas Operations only to active superadmins.
-- rollback: Restore the prior driver RPC bodies only after an explicit access-scope decision; this migration creates no rows.
begin;

create or replace function public.atlas_ops_driver_acknowledge(p_dispatch_id uuid)
returns void language plpgsql security definer set search_path = public
as $function$
declare d public.atlas_ops_dispatches%rowtype; buk_id text;
begin
  if not public.atlas_ops_is_current_super_admin() then raise exception 'Atlas Operations está habilitado solo para superadministración.'; end if;
  select a.buk_employee_id into buk_id from public.atlas_ops_driver_accounts a
  where a.user_id = auth.uid() and a.is_active;
  if buk_id is null then raise exception 'La cuenta no tiene una identidad de conductor vinculada.'; end if;
  select * into d from public.atlas_ops_dispatches where id = p_dispatch_id and driver_buk_employee_id = buk_id for update;
  if not found or d.planning_status <> 'published' then raise exception 'Servicio publicado no encontrado para este conductor.'; end if;
  if d.acknowledged_at is null then
    update public.atlas_ops_dispatches set acknowledged_at = now(), updated_by = auth.uid() where id = d.id;
    insert into public.atlas_ops_dispatch_events(dispatch_id, event_type, source, actor_user_id)
    values (d.id, 'driver.acknowledged', 'driver', auth.uid());
  end if;
end;
$function$;
revoke all on function public.atlas_ops_driver_acknowledge(uuid) from public, anon;
grant execute on function public.atlas_ops_driver_acknowledge(uuid) to authenticated;

create or replace function public.atlas_ops_driver_mark_milestone(p_dispatch_id uuid, p_milestone_code text)
returns void language plpgsql security definer set search_path = public
as $function$
declare buk_id text; d public.atlas_ops_dispatches%rowtype; m public.atlas_ops_dispatch_milestones%rowtype;
begin
  if not public.atlas_ops_is_current_super_admin() then raise exception 'Atlas Operations está habilitado solo para superadministración.'; end if;
  select a.buk_employee_id into buk_id from public.atlas_ops_driver_accounts a
  where a.user_id = auth.uid() and a.is_active;
  if buk_id is null then raise exception 'La cuenta no tiene una identidad de conductor vinculada.'; end if;
  select * into d from public.atlas_ops_dispatches where id=p_dispatch_id and driver_buk_employee_id=buk_id for update;
  if not found or d.planning_status <> 'published' or d.execution_status not in ('not_started','in_progress') then raise exception 'Servicio activo no encontrado para este conductor.'; end if;
  select * into m from public.atlas_ops_dispatch_milestones where dispatch_id=d.id and code=upper(trim(p_milestone_code)) for update;
  if not found or m.status <> 'pending' then raise exception 'Hito pendiente no encontrado.'; end if;
  update public.atlas_ops_dispatch_milestones set status='completed', actual_at=now() where id=m.id;
  insert into public.atlas_ops_dispatch_events(dispatch_id,milestone_id,event_type,source,actor_user_id)
  values(d.id,m.id,'milestone.completed','driver',auth.uid());
end;
$function$;
revoke all on function public.atlas_ops_driver_mark_milestone(uuid, text) from public, anon;
grant execute on function public.atlas_ops_driver_mark_milestone(uuid, text) to authenticated;

create or replace function public.atlas_ops_driver_get_dispatches()
returns table(
  id uuid, service_date date, shift text, planned_start_at timestamptz, origin_label text, destination_label text,
  instructions text, acknowledged_at timestamptz, service_name text, vehicle_code text, plate text
) language plpgsql security definer set search_path = public
as $function$
declare buk_id text;
begin
  if not public.atlas_ops_is_current_super_admin() then raise exception 'Atlas Operations está habilitado solo para superadministración.'; end if;
  select a.buk_employee_id into buk_id from public.atlas_ops_driver_accounts a
  where a.user_id = auth.uid() and a.is_active;
  if buk_id is null then raise exception 'La cuenta no tiene una identidad de conductor vinculada.'; end if;
  return query select d.id, d.service_date, d.shift, d.planned_start_at, d.origin_label, d.destination_label,
    d.instructions, d.acknowledged_at, t.name, v.code, v.plate
  from public.atlas_ops_dispatches d
  left join public.atlas_ops_service_templates t on t.id=d.service_template_id
  left join public.atlas_ops_vehicles v on v.id=d.vehicle_id
  where d.driver_buk_employee_id = buk_id
    and d.planning_status = 'published'
    and d.service_date >= current_date - 1
  order by d.planned_start_at;
end;
$function$;
revoke all on function public.atlas_ops_driver_get_dispatches() from public, anon;
grant execute on function public.atlas_ops_driver_get_dispatches() to authenticated;

create or replace function public.atlas_ops_driver_report_incident(
  p_dispatch_id uuid, p_category text, p_severity text, p_description text
)
returns uuid language plpgsql security definer set search_path = public
as $function$
declare buk_id text; d public.atlas_ops_dispatches%rowtype; incident_id uuid;
begin
  if not public.atlas_ops_is_current_super_admin() then raise exception 'Atlas Operations está habilitado solo para superadministración.'; end if;
  select a.buk_employee_id into buk_id from public.atlas_ops_driver_accounts a
  where a.user_id = auth.uid() and a.is_active;
  if buk_id is null then raise exception 'La cuenta no tiene una identidad de conductor vinculada.'; end if;
  select * into d from public.atlas_ops_dispatches where id = p_dispatch_id and driver_buk_employee_id = buk_id for update;
  if not found or d.planning_status <> 'published' or d.execution_status in ('completed','failed','suspended') then
    raise exception 'Servicio activo no encontrado para este conductor.';
  end if;
  insert into public.atlas_ops_incidents(dispatch_id, category, severity, description, reported_by, source)
  values (d.id, nullif(trim(p_category), ''), p_severity, trim(p_description), auth.uid(), 'driver')
  returning id into incident_id;
  if not exists (select 1 from public.atlas_ops_alerts a where a.dispatch_id=d.id and a.alert_type='incident' and a.status='open') then
    insert into public.atlas_ops_alerts(dispatch_id, alert_type, message)
    values (d.id, 'incident', 'Incidencia reportada por el conductor');
  end if;
  insert into public.atlas_ops_dispatch_events(dispatch_id, event_type, source, actor_user_id, payload)
  values (d.id, 'incident.reported', 'driver', auth.uid(), jsonb_build_object('incident_id', incident_id, 'category', p_category, 'severity', p_severity));
  return incident_id;
end;
$function$;
revoke all on function public.atlas_ops_driver_report_incident(uuid, text, text, text) from public, anon;
grant execute on function public.atlas_ops_driver_report_incident(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
