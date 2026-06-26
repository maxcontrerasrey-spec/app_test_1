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

create or replace function public.get_hr_roster_calendar_summary(
  p_month date default current_date,
  p_search text default null,
  p_contract_filter text default null,
  p_area_filter text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  target_month date := coalesce(p_month, current_date);
  month_start date := date_trunc('month', target_month)::date;
  month_end date := (date_trunc('month', target_month) + interval '1 month - 1 day')::date;
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_scope text := lower(trim(coalesce(nullif(p_area_filter, ''), nullif(p_contract_filter, ''), '')));
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar el resumen de jornadas';
  end if;

  return (
    with active_workers as (
      select distinct on (e.buk_employee_id)
        e.buk_employee_id,
        e.full_name,
        e.raw_payload,
        coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
        coalesce(
          nullif(trim(e.job_title), ''),
          nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
          nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
          nullif(trim(e.raw_payload ->> 'job_title'), '')
        ) as resolved_job_title,
        nullif(trim(coalesce(e.area_name, e.contract_code)), '') as operational_scope,
        public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key
      from public.employees_active_current e
      order by e.buk_employee_id, e.updated_at desc nulls last, e.created_at desc nulls last
    ),
    filtered_workers as (
      select aw.buk_employee_id
      from active_workers aw
      where (
        normalized_search = ''
        or lower(
          concat_ws(
            ' ',
            aw.name_search_key,
            aw.full_name,
            coalesce(aw.document_number, ''),
            coalesce(aw.resolved_job_title, ''),
            coalesce(aw.operational_scope, '')
          )
        ) like '%' || normalized_search || '%'
      )
        and (
          normalized_scope = ''
          or lower(coalesce(aw.operational_scope, '')) = normalized_scope
        )
    ),
    assigned_workers as (
      select distinct wr.employee_buk_employee_id as buk_employee_id
      from public.hr_worker_rosters wr
      inner join filtered_workers fw
        on fw.buk_employee_id = wr.employee_buk_employee_id
      where wr.start_date <= month_end
        and coalesce(wr.end_date, 'infinity'::date) >= month_start
    )
    select jsonb_build_object(
      'month_start', month_start,
      'month_end', month_end,
      'assigned_count', (select count(*) from assigned_workers),
      'pending_count', (
        select count(*)
        from filtered_workers fw
        where not exists (
          select 1
          from assigned_workers aw
          where aw.buk_employee_id = fw.buk_employee_id
        )
      ),
      'total_count', (select count(*) from filtered_workers)
    )
  );
end;
$function$;

revoke all on function public.get_hr_roster_setup_catalogs() from public, anon, authenticated;
grant execute on function public.get_hr_roster_setup_catalogs() to authenticated;
revoke all on function public.get_hr_roster_calendar_summary(date, text, text, text) from public, anon, authenticated;
grant execute on function public.get_hr_roster_calendar_summary(date, text, text, text) to authenticated;

notify pgrst, 'reload schema';
