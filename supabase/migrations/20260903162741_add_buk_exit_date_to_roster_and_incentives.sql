-- EEES-DB-005: approved
-- owner: Human Resources / Operations
-- rollback: forward-only; restaurar la resolución anterior mediante una migración posterior si cambia el contrato de fecha de salida BUK.
begin;

create or replace function public.extract_buk_employee_exit_date(p_raw_payload jsonb)
returns date
language sql
stable
as $$
  select public.parse_bi_date_text(
    coalesce(
      nullif(trim(coalesce(p_raw_payload ->> 'active_until', '')), ''),
      nullif(trim(coalesce(p_raw_payload #>> '{current_job,end_date}', '')), ''),
      nullif(trim(coalesce(p_raw_payload #>> '{current_job,active_until}', '')), ''),
      nullif(trim(coalesce(p_raw_payload ->> 'termination_date', '')), ''),
      nullif(trim(coalesce(p_raw_payload ->> 'end_date', '')), ''),
      nullif(trim(coalesce(p_raw_payload #>> '{current_job,custom_attributes,Fecha de salida}', '')), ''),
      nullif(trim(coalesce(p_raw_payload #>> '{current_job,custom_attributes,Fecha de término}', '')), ''),
      nullif(trim(coalesce(p_raw_payload #>> '{current_job,custom_attributes,Fecha termino}', '')), '')
    )
  );
$$;

revoke all on function public.extract_buk_employee_exit_date(jsonb) from public, anon, authenticated;
grant execute on function public.extract_buk_employee_exit_date(jsonb) to authenticated;

create or replace function public.resolve_hr_roster_day_status(
  p_buk_employee_id text,
  p_target_date date
)
returns table (
  assignment_id uuid,
  pattern_id uuid,
  pattern_name text,
  working_days integer,
  resting_days integer,
  cycle_length integer,
  assignment_start_date date,
  assignment_end_date date,
  cycle_day integer,
  base_status text,
  effective_status text,
  exception_type text,
  exception_label text,
  exception_notes text,
  is_working_day boolean,
  is_rest_day boolean
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  assignment_row record;
  exception_row record;
  exit_date date;
  cycle_index integer;
  resolved_base_status text;
  resolved_effective_status text;
begin
  select public.extract_buk_employee_exit_date(e.raw_payload)
    into exit_date
  from public.employees e
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  order by e.updated_at desc nulls last, e.created_at desc nulls last
  limit 1;

  select hre.exception_type, hre.notes
    into exception_row
  from public.hr_roster_exceptions hre
  where hre.employee_buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
    and hre.exception_date = p_target_date
    and hre.is_active = true
  limit 1;

  select
    wr.id as assignment_id,
    hp.id as pattern_id,
    hp.name as pattern_name,
    hp.working_days,
    hp.resting_days,
    hp.cycle_length,
    wr.start_date,
    wr.end_date
  into assignment_row
  from public.hr_worker_rosters wr
  join public.hr_shift_patterns hp on hp.id = wr.pattern_id
  where wr.employee_buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
    and wr.start_date <= p_target_date
    and coalesce(wr.end_date, 'infinity'::date) >= p_target_date
  order by wr.start_date desc, wr.created_at desc
  limit 1;

  if assignment_row.assignment_id is null then
    return query select
      null::uuid, null::uuid, null::text, null::integer, null::integer, null::integer,
      null::date, null::date, null::integer, 'unassigned'::text,
      case when exit_date is not null and p_target_date >= exit_date then 'medical_leave' else 'unassigned' end,
      case when exit_date is not null and p_target_date >= exit_date then 'termination' else exception_row.exception_type end,
      case when exit_date is not null and p_target_date >= exit_date then 'Salida' else null end,
      case when exit_date is not null and p_target_date >= exit_date then format('Fecha de salida BUK: %s', to_char(exit_date, 'DD/MM/YYYY')) else exception_row.notes end,
      false, false;
    return;
  end if;

  cycle_index := mod((p_target_date - assignment_row.start_date), assignment_row.cycle_length);
  resolved_base_status := case when cycle_index < assignment_row.working_days then 'working' else 'resting' end;

  if exit_date is not null and p_target_date >= exit_date then
    return query select
      assignment_row.assignment_id, assignment_row.pattern_id, assignment_row.pattern_name,
      assignment_row.working_days, assignment_row.resting_days, assignment_row.cycle_length,
      assignment_row.start_date, assignment_row.end_date, cycle_index + 1,
      resolved_base_status, 'medical_leave'::text, 'termination'::text, 'Salida'::text,
      format('Fecha de salida BUK: %s', to_char(exit_date, 'DD/MM/YYYY')), false, false;
    return;
  end if;

  resolved_effective_status := case
    when exception_row.exception_type is null then resolved_base_status
    when exception_row.exception_type = 'extra_shift' then 'extra_shift'
    when exception_row.exception_type = 'training' then 'training'
    else exception_row.exception_type
  end;

  return query select
    assignment_row.assignment_id, assignment_row.pattern_id, assignment_row.pattern_name,
    assignment_row.working_days, assignment_row.resting_days, assignment_row.cycle_length,
    assignment_row.start_date, assignment_row.end_date, cycle_index + 1,
    resolved_base_status, resolved_effective_status, exception_row.exception_type,
    case when exception_row.exception_type is null then null else public.get_hr_roster_exception_type_label(exception_row.exception_type) end,
    exception_row.notes, resolved_base_status = 'working', resolved_base_status = 'resting';
end;
$function$;

create or replace function public.get_hr_roster_bulk_calendar(
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
  projection_horizon_end date := (date_trunc('month', current_date)::date + interval '7 months' - interval '1 day')::date;
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_contract text := lower(trim(coalesce(p_contract_filter, '')));
  normalized_area text := lower(trim(coalesce(p_area_filter, '')));
begin
  if not public.user_can_view_hr_roster(current_user_id) then raise exception 'Sin permisos para consultar jornadas'; end if;
  if month_end > projection_horizon_end then raise exception 'La proyección de jornadas solo permite consultar hasta el cierre de los próximos 6 meses'; end if;

  return jsonb_build_object(
    'range', jsonb_build_object('start_date', month_start, 'end_date', month_end),
    'workers', coalesce((
      with active_workers as (
        select distinct on (e.buk_employee_id)
          e.buk_employee_id, e.full_name,
          coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
          coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
          coalesce(nullif(trim(e.job_title), ''), nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''), nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''), nullif(trim(e.raw_payload ->> 'job_title'), '')) as job_title,
          nullif(trim(e.contract_code), '') as contract_code,
          nullif(trim(e.area_name), '') as area_name,
          public.extract_buk_employee_exit_date(e.raw_payload) as exit_date,
          public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key
        from public.employees e
        where e.is_active = true or public.extract_buk_employee_exit_date(e.raw_payload) >= month_start
        order by e.buk_employee_id, e.is_active desc, e.updated_at desc nulls last, e.created_at desc nulls last
      ), filtered_workers as (
        select aw.* from active_workers aw
        where (normalized_search = '' or lower(concat_ws(' ', aw.name_search_key, aw.full_name, aw.document_number, aw.job_title, aw.contract_code, aw.area_name)) like '%' || normalized_search || '%')
          and (normalized_contract = '' or lower(coalesce(aw.contract_code, '')) like '%' || normalized_contract || '%')
          and (normalized_area = '' or lower(coalesce(aw.area_name, aw.contract_code, '')) = normalized_area)
      ), worker_days as (
        select fw.*, gs.day_date::date as day_date, rs.*
        from filtered_workers fw
        cross join lateral generate_series(month_start, month_end, interval '1 day') gs(day_date)
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

revoke all on function public.get_hr_roster_bulk_calendar(date, text, text, text) from public, anon, authenticated;
grant execute on function public.get_hr_roster_bulk_calendar(date, text, text, text) to authenticated;
notify pgrst, 'reload schema';
commit;
