create or replace function public.get_worker_schedule(
  p_buk_employee_id text,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  resolved_start date := coalesce(p_start_date, current_date);
  resolved_end date := coalesce(p_end_date, coalesce(p_start_date, current_date));
  projection_horizon_end date := (
    date_trunc('month', current_date)::date
    + interval '7 months'
    - interval '1 day'
  )::date;
  worker_row record;
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar jornadas';
  end if;

  if resolved_end < resolved_start then
    raise exception 'El rango solicitado no es válido';
  end if;

  if resolved_start > projection_horizon_end or resolved_end > projection_horizon_end then
    raise exception 'La proyección de jornadas solo permite consultar hasta el cierre de los próximos 6 meses';
  end if;

  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
    coalesce(
      nullif(trim(e.job_title), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
      nullif(trim(e.raw_payload ->> 'job_title'), '')
    ) as job_title,
    nullif(trim(e.contract_code), '') as contract_code,
    nullif(trim(e.area_name), '') as area_name
  into worker_row
  from public.employees_active_current e
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_row.buk_employee_id is null then
    raise exception 'Trabajador BUK no encontrado o sin ficha activa';
  end if;

  return jsonb_build_object(
    'worker', jsonb_build_object(
      'buk_employee_id', worker_row.buk_employee_id,
      'full_name', worker_row.full_name,
      'document_number', worker_row.document_number,
      'document_type', worker_row.document_type,
      'job_title', worker_row.job_title,
      'contract_code', worker_row.contract_code,
      'area_name', worker_row.area_name
    ),
    'range', jsonb_build_object(
      'start_date', resolved_start,
      'end_date', resolved_end
    ),
    'summary', (
      with resolved_days as (
        select rs.*
        from generate_series(resolved_start, resolved_end, interval '1 day') as gs(day_date)
        cross join lateral public.resolve_hr_roster_day_status(worker_row.buk_employee_id, gs.day_date::date) rs
      )
      select jsonb_build_object(
        'working_days', count(*) filter (where rd.base_status = 'working'),
        'resting_days', count(*) filter (where rd.base_status = 'resting'),
        'exception_days', count(*) filter (where rd.exception_type is not null),
        'unassigned_days', count(*) filter (where rd.base_status = 'unassigned')
      )
      from resolved_days rd
    ),
    'assignments',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', wr.id,
          'pattern_id', hp.id,
          'pattern_name', hp.name,
          'pattern_code', hp.code,
          'working_days', hp.working_days,
          'resting_days', hp.resting_days,
          'cycle_length', hp.cycle_length,
          'start_date', wr.start_date,
          'end_date', wr.end_date,
          'notes', wr.notes,
          'contract_code', wr.contract_code,
          'area_name', wr.area_name,
          'created_at', wr.created_at
        )
        order by wr.start_date desc
      )
      from public.hr_worker_rosters wr
      join public.hr_shift_patterns hp
        on hp.id = wr.pattern_id
      where wr.employee_buk_employee_id = worker_row.buk_employee_id
        and daterange(wr.start_date, coalesce(wr.end_date, 'infinity'::date), '[]')
          && daterange(resolved_start, resolved_end, '[]')
    ), '[]'::jsonb),
    'exceptions',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', hre.id,
          'exception_date', hre.exception_date,
          'exception_type', hre.exception_type,
          'exception_label', public.get_hr_roster_exception_type_label(hre.exception_type),
          'notes', hre.notes,
          'is_active', hre.is_active,
          'created_at', hre.created_at
        )
        order by hre.exception_date asc
      )
      from public.hr_roster_exceptions hre
      where hre.employee_buk_employee_id = worker_row.buk_employee_id
        and hre.is_active = true
        and hre.exception_date between resolved_start and resolved_end
    ), '[]'::jsonb),
    'days',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', gs.day_date::date,
          'assignment_id', rs.assignment_id,
          'pattern_id', rs.pattern_id,
          'pattern_name', rs.pattern_name,
          'cycle_day', rs.cycle_day,
          'base_status', rs.base_status,
          'effective_status', rs.effective_status,
          'exception_type', rs.exception_type,
          'exception_label', rs.exception_label,
          'exception_notes', rs.exception_notes,
          'is_working_day', rs.is_working_day,
          'is_rest_day', rs.is_rest_day
        )
        order by gs.day_date asc
      )
      from generate_series(resolved_start, resolved_end, interval '1 day') as gs(day_date)
      cross join lateral public.resolve_hr_roster_day_status(worker_row.buk_employee_id, gs.day_date::date) rs
    ), '[]'::jsonb)
  );
end;
$function$;

notify pgrst, 'reload schema';
