-- EEES-DB-005: approved
-- owner: Human Resources / Operations
-- rollback: forward-only; volver a invocar el calendario mensual existente mediante una migración posterior.
begin;

create or replace function public.get_hr_roster_bulk_calendar(
  p_start_date date default current_date,
  p_end_date date default current_date,
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
  range_start date := coalesce(p_start_date, current_date);
  range_end date := coalesce(p_end_date, range_start);
  projection_horizon_end date := (date_trunc('month', current_date)::date + interval '7 months' - interval '1 day')::date;
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_contract text := lower(trim(coalesce(p_contract_filter, '')));
  normalized_area text := lower(trim(coalesce(p_area_filter, '')));
begin
  if not public.user_can_view_hr_roster(current_user_id) then raise exception 'Sin permisos para consultar jornadas'; end if;
  if range_end < range_start then raise exception 'El periodo de jornadas no puede terminar antes de comenzar'; end if;
  if range_end > projection_horizon_end then raise exception 'La proyección de jornadas solo permite consultar hasta el cierre de los próximos 6 meses'; end if;
  if range_end - range_start > 184 then raise exception 'El periodo de jornadas no puede superar 6 meses'; end if;

  return jsonb_build_object(
    'range', jsonb_build_object('start_date', range_start, 'end_date', range_end),
    'workers', coalesce((
      with active_workers as (
        select distinct on (e.buk_employee_id)
          e.buk_employee_id,
          e.full_name,
          coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
          coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
          coalesce(nullif(trim(e.job_title), ''), nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''), nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''), nullif(trim(e.raw_payload ->> 'job_title'), '')) as job_title,
          nullif(trim(e.contract_code), '') as contract_code,
          nullif(trim(e.area_name), '') as area_name,
          public.extract_buk_employee_exit_date(e.raw_payload) as exit_date,
          public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key
        from public.employees e
        where e.is_active = true or public.extract_buk_employee_exit_date(e.raw_payload) >= range_start
        order by e.buk_employee_id, e.is_active desc, e.updated_at desc nulls last, e.created_at desc nulls last
      ), filtered_workers as (
        select aw.* from active_workers aw
        where (normalized_search = '' or lower(concat_ws(' ', aw.name_search_key, aw.full_name, aw.document_number, aw.job_title, aw.contract_code, aw.area_name)) like '%' || normalized_search || '%')
          and (normalized_contract = '' or lower(coalesce(aw.contract_code, '')) like '%' || normalized_contract || '%')
          and (normalized_area = '' or lower(coalesce(aw.area_name, aw.contract_code, '')) = normalized_area)
      ), worker_days as (
        select fw.*, gs.day_date::date as day_date, rs.*
        from filtered_workers fw
        cross join lateral generate_series(range_start, range_end, interval '1 day') gs(day_date)
        cross join lateral public.resolve_hr_roster_day_status(fw.buk_employee_id, gs.day_date::date) rs
      )
      select jsonb_agg(wp.payload order by wp.full_name)
      from (
        select wd.full_name, jsonb_build_object(
          'buk_employee_id', wd.buk_employee_id, 'full_name', wd.full_name, 'document_number', wd.document_number,
          'document_type', wd.document_type, 'job_title', wd.job_title, 'contract_code', wd.contract_code,
          'area_name', wd.area_name, 'exit_date', wd.exit_date,
          'summary', jsonb_build_object('working_days', count(*) filter (where wd.base_status = 'working'), 'resting_days', count(*) filter (where wd.base_status = 'resting'), 'exception_days', count(*) filter (where wd.exception_type is not null), 'unassigned_days', count(*) filter (where wd.base_status = 'unassigned')),
          'days', jsonb_agg(jsonb_build_object('date', wd.day_date, 'assignment_id', wd.assignment_id, 'pattern_id', wd.pattern_id, 'pattern_name', wd.pattern_name, 'cycle_day', wd.cycle_day, 'base_status', wd.base_status, 'effective_status', wd.effective_status, 'exception_type', wd.exception_type, 'exception_label', wd.exception_label, 'exception_notes', wd.exception_notes, 'is_working_day', wd.is_working_day, 'is_rest_day', wd.is_rest_day) order by wd.day_date)
        ) as payload
        from worker_days wd
        group by wd.buk_employee_id, wd.full_name, wd.document_number, wd.document_type, wd.job_title, wd.contract_code, wd.area_name, wd.exit_date
      ) wp
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_hr_roster_bulk_calendar(date, date, text, text, text) from public, anon, authenticated;
grant execute on function public.get_hr_roster_bulk_calendar(date, date, text, text, text) to authenticated;
notify pgrst, 'reload schema';
commit;
