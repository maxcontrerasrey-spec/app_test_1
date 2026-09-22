-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; restaurar la lectura individual mediante una migración posterior si cambia el contrato de catálogo.
-- Motivo: la migración DAND de 2026-09-21 redefinió la RPC y omitió operational_areas.
begin;

create or replace function public.get_hr_roster_setup_catalogs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para administrar jornadas y turnos';
  end if;

  return jsonb_build_object(
    'patterns',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', hp.id,
          'code', hp.code,
          'name', hp.name,
          'description', hp.description,
          'working_days', hp.working_days,
          'resting_days', hp.resting_days,
          'cycle_length', hp.cycle_length,
          'color_hex', hp.color_hex,
          'workday_labels', hp.workday_labels,
          'is_active', hp.is_active,
          'created_at', hp.created_at
        )
        order by hp.is_active desc, hp.name
      )
      from public.hr_shift_patterns hp
    ), '[]'::jsonb),
    'exception_types',
    jsonb_build_array(
      jsonb_build_object('value', 'vacation', 'label', public.get_hr_roster_exception_type_label('vacation')),
      jsonb_build_object('value', 'medical_leave', 'label', public.get_hr_roster_exception_type_label('medical_leave')),
      jsonb_build_object('value', 'absent', 'label', public.get_hr_roster_exception_type_label('absent')),
      jsonb_build_object('value', 'extra_shift', 'label', public.get_hr_roster_exception_type_label('extra_shift')),
      jsonb_build_object('value', 'training', 'label', public.get_hr_roster_exception_type_label('training')),
      jsonb_build_object('value', 'administrative_leave', 'label', public.get_hr_roster_exception_type_label('administrative_leave')),
      jsonb_build_object('value', 'union_leave', 'label', public.get_hr_roster_exception_type_label('union_leave'))
    ),
    'operational_areas',
    coalesce((
      with active_workers as (
        select distinct on (e.buk_employee_id)
          nullif(trim(coalesce(e.area_name, e.contract_code)), '') as operational_scope
        from public.employees_active_current e
        where nullif(trim(coalesce(e.area_name, e.contract_code)), '') is not null
        order by e.buk_employee_id, e.updated_at desc nulls last, e.created_at desc nulls last
      )
      select jsonb_agg(
        jsonb_build_object(
          'value', scope.operational_scope,
          'label', scope.operational_scope
        )
        order by scope.operational_scope
      )
      from (
        select distinct aw.operational_scope
        from active_workers aw
      ) scope
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_hr_roster_setup_catalogs() from public, anon, authenticated;
grant execute on function public.get_hr_roster_setup_catalogs() to authenticated;

notify pgrst, 'reload schema';
commit;
