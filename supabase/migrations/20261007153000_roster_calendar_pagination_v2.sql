-- EEES-DB-005: approved
-- owner: Human Resources / Operations
-- rollback: additive v2 RPCs only; revert the frontend to the unchanged legacy bulk RPC.
-- scope: bounded worker pages and global roster faceting without changing schedule semantics.
begin;

-- Private set-based scope shared by the summary and paged calendar RPCs. It is intentionally
-- not exposed through PostgREST; public wrappers authorize the caller before invoking it.
create or replace function private.get_hr_roster_worker_cycle_scope_v2(
  p_start_date date,
  p_end_date date,
  p_search text,
  p_contract_filter text,
  p_area_filter text,
  p_contract_admin_filter text
)
returns table (
  buk_employee_id text,
  full_name text,
  document_number text,
  document_type text,
  job_title text,
  contract_code text,
  area_name text,
  exit_date date,
  cycle_label text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $function$
with normalized_filters as materialized (
  select
    lower(trim(coalesce(p_search, ''))) as normalized_search,
    lower(trim(coalesce(p_contract_filter, ''))) as normalized_contract,
    lower(trim(coalesce(p_area_filter, ''))) as normalized_area,
    lower(trim(coalesce(p_contract_admin_filter, ''))) as normalized_contract_admin
), active_workers as materialized (
  select distinct on (e.buk_employee_id)
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
    nullif(trim(e.area_name), '') as area_name,
    e.buk_exit_date as exit_date,
    public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key
  from public.employees e
  where (
      (e.is_active = true and (e.buk_exit_date is null or e.buk_exit_date >= p_start_date))
      or e.buk_exit_date >= p_start_date
    )
    and coalesce(lower(trim(e.raw_payload ->> 'private_role')), 'false') not in ('true', '1', 'yes', 'si', 'sí')
  order by e.buk_employee_id, e.is_active desc, e.updated_at desc nulls last, e.created_at desc nulls last
), filtered_workers as materialized (
  select aw.*
  from active_workers aw
  cross join normalized_filters nf
  where (nf.normalized_search = '' or lower(concat_ws(
      ' ', aw.name_search_key, aw.full_name, aw.document_number, aw.job_title, aw.contract_code, aw.area_name
    )) like '%' || nf.normalized_search || '%')
    and (nf.normalized_contract = '' or public.normalize_buk_contract_code(aw.contract_code)
      like '%' || public.normalize_buk_contract_code(nf.normalized_contract) || '%')
    and (nf.normalized_area = '' or public.normalize_buk_area_name(coalesce(aw.area_name, aw.contract_code, ''))
      = public.normalize_buk_area_name(nf.normalized_area))
    and (
      nf.normalized_contract_admin = ''
      or exists (
        select 1
        from public.buk_contract_mappings bcm
        where bcm.is_operational = true
          and bcm.is_one_to_one = true
          and bcm.contract_id is not null
          and lower(trim(coalesce(bcm.contract_admin_name, ''))) = nf.normalized_contract_admin
          and bcm.buk_area_name_normalized = public.normalize_buk_area_name(coalesce(aw.area_name, aw.contract_code, ''))
      )
    )
), assignment_intervals as materialized (
  select
    fw.buk_employee_id,
    wr.id as assignment_id,
    wr.start_date as assignment_start_date,
    wr.created_at as assignment_created_at,
    hp.name as pattern_name,
    greatest(wr.start_date, p_start_date) as interval_start,
    least(
      coalesce(wr.end_date, p_end_date),
      p_end_date,
      case
        when wr.invalidated_at is not null
          then coalesce(wr.invalidated_effective_date - 1, p_start_date - 1)
        else p_end_date
      end
    ) as interval_end
  from filtered_workers fw
  join public.hr_worker_rosters wr on wr.employee_buk_employee_id = fw.buk_employee_id
  join public.hr_shift_patterns hp on hp.id = wr.pattern_id
  where wr.start_date <= p_end_date
    and coalesce(wr.end_date, 'infinity'::date) >= p_start_date
    and (
      (wr.invalidated_at is not null and wr.invalidated_effective_date is not null)
      or (
        wr.invalidated_at is null
        and public.hr_roster_assignment_matches_current_buk(
          wr.contract_code, wr.area_name, fw.contract_code, fw.area_name
        )
      )
    )
), valid_assignment_intervals as materialized (
  select * from assignment_intervals where interval_start <= interval_end
), interval_boundaries as (
  select buk_employee_id, interval_start as boundary_date from valid_assignment_intervals
  union
  select buk_employee_id, interval_end + 1 as boundary_date from valid_assignment_intervals
), interval_segments as (
  select
    buk_employee_id,
    boundary_date as segment_start,
    lead(boundary_date) over (partition by buk_employee_id order by boundary_date) - 1 as segment_end
  from interval_boundaries
), resolved_segments as (
  select distinct on (s.buk_employee_id, s.segment_start)
    s.buk_employee_id,
    a.pattern_name
  from interval_segments s
  join valid_assignment_intervals a
    on a.buk_employee_id = s.buk_employee_id
   and a.interval_start <= s.segment_start
   and a.interval_end >= s.segment_start
  where s.segment_end is not null
  order by s.buk_employee_id, s.segment_start, a.assignment_start_date desc, a.assignment_created_at desc
), worker_cycles as (
  select distinct
    rs.buk_employee_id,
    coalesce(
      upper(regexp_replace(matches.cycle_match[1], '\s+', '', 'g')),
      rs.pattern_name
    ) as cycle_label
  from resolved_segments rs
  cross join lateral (
    select regexp_match(rs.pattern_name, '([0-9]+\s*[xX]\s*[0-9]+(\s*\+\s*[0-9]+)?)') as cycle_match
  ) matches
  where nullif(trim(rs.pattern_name), '') is not null
)
select
  fw.buk_employee_id,
  fw.full_name,
  fw.document_number,
  fw.document_type,
  fw.job_title,
  fw.contract_code,
  fw.area_name,
  fw.exit_date,
  wc.cycle_label
from filtered_workers fw
left join worker_cycles wc on wc.buk_employee_id = fw.buk_employee_id;
$function$;

revoke all on function private.get_hr_roster_worker_cycle_scope_v2(date, date, text, text, text, text)
  from public, anon, authenticated, service_role;

create or replace function public.get_hr_roster_calendar_scope_summary_v2(
  p_start_date date,
  p_end_date date,
  p_search text default null,
  p_contract_filter text default null,
  p_area_filter text default null,
  p_contract_admin_filter text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  current_user_id uuid := auth.uid();
  range_start date := coalesce(p_start_date, current_date);
  range_end date := coalesce(p_end_date, range_start);
  projection_horizon_end date := (date_trunc('month', current_date)::date + interval '7 months' - interval '1 day')::date;
  normalized_contract text := trim(coalesce(p_contract_filter, ''));
  normalized_area text := trim(coalesce(p_area_filter, ''));
  normalized_contract_admin text := trim(coalesce(p_contract_admin_filter, ''));
begin
  if not public.user_can_view_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar el resumen de jornadas';
  end if;
  if range_end < range_start then raise exception 'El periodo de jornadas no puede terminar antes de comenzar'; end if;
  if range_end > projection_horizon_end then raise exception 'La proyección de jornadas solo permite consultar hasta el cierre de los próximos 6 meses'; end if;
  if range_end - range_start > 184 then raise exception 'El periodo de jornadas no puede superar 6 meses'; end if;
  if normalized_contract = '' and normalized_area = '' and normalized_contract_admin = '' then
    raise exception 'Selecciona un contrato, área o administrador para consultar la nómina';
  end if;

  return (
    with worker_cycles as materialized (
      select *
      from private.get_hr_roster_worker_cycle_scope_v2(
        range_start, range_end, p_search, p_contract_filter, p_area_filter, p_contract_admin_filter
      )
    ), worker_counts as (
      select
        count(distinct wc.buk_employee_id)::integer as total_workers,
        count(distinct wc.buk_employee_id) filter (where wc.cycle_label is not null)::integer as assigned_workers
      from worker_cycles wc
    ), pattern_counts as (
      select wc.cycle_label as cycle, count(*)::integer as worker_count
      from worker_cycles wc
      where wc.cycle_label is not null
      group by wc.cycle_label
      union all
      select '__no_pattern__'::text, (counts.total_workers - counts.assigned_workers)::integer
      from worker_counts counts
      where counts.total_workers > counts.assigned_workers
    )
    select jsonb_build_object(
      'range', jsonb_build_object('start_date', range_start, 'end_date', range_end),
      'total_workers', counts.total_workers,
      'assigned_count', counts.assigned_workers,
      'pending_count', counts.total_workers - counts.assigned_workers,
      'patterns', coalesce((
        select jsonb_agg(jsonb_build_object('cycle', pc.cycle, 'count', pc.worker_count))
        from pattern_counts pc
      ), '[]'::jsonb)
    )
    from worker_counts counts
  );
end;
$function$;

revoke all on function public.get_hr_roster_calendar_scope_summary_v2(date, date, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.get_hr_roster_calendar_scope_summary_v2(date, date, text, text, text, text)
  to authenticated;

create or replace function public.get_hr_roster_bulk_calendar_page_v2(
  p_start_date date,
  p_end_date date,
  p_search text default null,
  p_contract_filter text default null,
  p_area_filter text default null,
  p_contract_admin_filter text default null,
  p_cycle_filter text default null,
  p_page integer default 1,
  p_page_size integer default 50,
  p_after_full_name text default null,
  p_after_buk_employee_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  current_user_id uuid := auth.uid();
  range_start date := coalesce(p_start_date, current_date);
  range_end date := coalesce(p_end_date, range_start);
  projection_horizon_end date := (date_trunc('month', current_date)::date + interval '7 months' - interval '1 day')::date;
  normalized_contract text := trim(coalesce(p_contract_filter, ''));
  normalized_area text := trim(coalesce(p_area_filter, ''));
  normalized_contract_admin text := trim(coalesce(p_contract_admin_filter, ''));
  normalized_cycle_filter text := trim(coalesce(p_cycle_filter, ''));
  requested_page integer := coalesce(p_page, 1);
  page_limit integer;
begin
  if not public.user_can_view_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar jornadas';
  end if;
  if range_end < range_start then raise exception 'El periodo de jornadas no puede terminar antes de comenzar'; end if;
  if range_end > projection_horizon_end then raise exception 'La proyección de jornadas solo permite consultar hasta el cierre de los próximos 6 meses'; end if;
  if range_end - range_start > 184 then raise exception 'El periodo de jornadas no puede superar 6 meses'; end if;
  if normalized_contract = '' and normalized_area = '' and normalized_contract_admin = '' then
    raise exception 'Selecciona un contrato, área o administrador para consultar la nómina';
  end if;
  if requested_page < 1 or requested_page > 10000 then raise exception 'La página de jornadas está fuera del rango permitido'; end if;
  if (p_after_full_name is null) <> (p_after_buk_employee_id is null) then
    raise exception 'El cursor de jornadas está incompleto';
  end if;

  page_limit := least(greatest(coalesce(p_page_size, 50), 1), 50);
  return (
    with worker_cycles as materialized (
      select *
      from private.get_hr_roster_worker_cycle_scope_v2(
        range_start, range_end, p_search, p_contract_filter, p_area_filter, p_contract_admin_filter
      )
    ), filtered_workers as materialized (
      select distinct on (wc.buk_employee_id)
        wc.buk_employee_id,
        wc.full_name,
        wc.document_number,
        wc.document_type,
        wc.job_title,
        wc.contract_code,
        wc.area_name,
        wc.exit_date
      from worker_cycles wc
      where normalized_cycle_filter = ''
        or (
          normalized_cycle_filter = '__no_pattern__'
          and not exists (
            select 1
            from worker_cycles assigned
            where assigned.buk_employee_id = wc.buk_employee_id
              and assigned.cycle_label is not null
          )
        )
        or (
          normalized_cycle_filter <> '__no_pattern__'
          and exists (
            select 1
            from worker_cycles assigned
            where assigned.buk_employee_id = wc.buk_employee_id
              and assigned.cycle_label = normalized_cycle_filter
          )
        )
      order by wc.buk_employee_id, wc.cycle_label nulls first
    ), page_workers as materialized (
      select fw.*, row_number() over (order by fw.full_name, fw.buk_employee_id) as page_row
      from (
        select filtered.*
        from filtered_workers filtered
        where p_after_full_name is null
          or (filtered.full_name, filtered.buk_employee_id) > (p_after_full_name, p_after_buk_employee_id)
        order by filtered.full_name, filtered.buk_employee_id
        limit page_limit + 1
      ) fw
    ), selected_page_workers as materialized (
      select * from page_workers where page_row <= page_limit
    ), worker_count as (
      select count(*)::integer as total_workers from filtered_workers
    ), worker_days as (
      select
        pw.buk_employee_id, pw.full_name, pw.document_number, pw.document_type, pw.job_title,
        pw.contract_code, pw.area_name, pw.exit_date, gs.day_date::date as day_date,
        assignment.assignment_id, assignment.pattern_id, assignment.pattern_name,
        assignment.working_days, assignment.resting_days, assignment.cycle_length,
        assignment.assignment_start_date, assignment.assignment_end_date,
        case when assignment.assignment_id is null then null else mod((gs.day_date::date - assignment.assignment_start_date), assignment.cycle_length) + 1 end as cycle_day,
        case when assignment.assignment_id is null then 'unassigned' when mod((gs.day_date::date - assignment.assignment_start_date), assignment.cycle_length) < assignment.working_days then 'working' else 'resting' end as base_status,
        case when pw.exit_date is not null and gs.day_date::date >= pw.exit_date then 'termination' when exception.exception_type is null and assignment.assignment_id is null then null when exception.exception_type = 'extra_shift' then 'extra_shift' when exception.exception_type = 'training' then 'training' else exception.exception_type end as exception_type,
        case when pw.exit_date is not null and gs.day_date::date >= pw.exit_date then 'Salida' when exception.exception_type is null then null else public.get_hr_roster_exception_type_label(exception.exception_type) end as exception_label,
        case when pw.exit_date is not null and gs.day_date::date >= pw.exit_date then format('Fecha de salida BUK: %s', to_char(pw.exit_date, 'DD/MM/YYYY')) else exception.notes end as exception_notes,
        case when pw.exit_date is not null and gs.day_date::date >= pw.exit_date then false else assignment.assignment_id is not null and mod((gs.day_date::date - assignment.assignment_start_date), assignment.cycle_length) < assignment.working_days end as is_working_day,
        case when pw.exit_date is not null and gs.day_date::date >= pw.exit_date then false else assignment.assignment_id is not null and mod((gs.day_date::date - assignment.assignment_start_date), assignment.cycle_length) >= assignment.working_days end as is_rest_day
      from selected_page_workers pw
      cross join lateral generate_series(range_start, range_end, interval '1 day') gs(day_date)
      left join lateral (
        select
          wr.id as assignment_id,
          hp.id as pattern_id,
          hp.name as pattern_name,
          hp.working_days,
          hp.resting_days,
          hp.cycle_length,
          wr.start_date as assignment_start_date,
          case
            when wr.invalidated_effective_date is null then wr.end_date
            else least(coalesce(wr.end_date, wr.invalidated_effective_date - 1), wr.invalidated_effective_date - 1)
          end as assignment_end_date
        from public.hr_worker_rosters wr
        join public.hr_shift_patterns hp on hp.id = wr.pattern_id
        where wr.employee_buk_employee_id = pw.buk_employee_id
          and wr.start_date <= gs.day_date::date
          and coalesce(wr.end_date, 'infinity'::date) >= gs.day_date::date
          and public.hr_roster_assignment_applies_on_buk_date(
            wr.contract_code, wr.area_name, wr.invalidated_at, wr.invalidated_effective_date,
            pw.contract_code, pw.area_name, gs.day_date::date
          )
        order by wr.start_date desc, wr.created_at desc
        limit 1
      ) assignment on true
      left join lateral (
        select hre.exception_type, hre.notes
        from public.hr_roster_exceptions hre
        where hre.employee_buk_employee_id = pw.buk_employee_id
          and hre.exception_date = gs.day_date::date
          and hre.is_active = true
        limit 1
      ) exception on true
    ), worker_payloads as (
      select wd.buk_employee_id, wd.full_name,
        jsonb_build_object(
          'buk_employee_id', wd.buk_employee_id,
          'full_name', wd.full_name,
          'document_number', wd.document_number,
          'document_type', wd.document_type,
          'job_title', wd.job_title,
          'contract_code', wd.contract_code,
          'area_name', wd.area_name,
          'exit_date', wd.exit_date,
          'summary', jsonb_build_object(
            'working_days', count(*) filter (where wd.base_status = 'working'),
            'resting_days', count(*) filter (where wd.base_status = 'resting'),
            'exception_days', count(*) filter (where wd.exception_type is not null),
            'unassigned_days', count(*) filter (where wd.base_status = 'unassigned')
          ),
          'days', jsonb_agg(jsonb_build_object(
            'date', wd.day_date,
            'assignment_id', wd.assignment_id,
            'pattern_id', wd.pattern_id,
            'pattern_name', wd.pattern_name,
            'cycle_day', wd.cycle_day,
            'base_status', wd.base_status,
            'effective_status', case when wd.exception_type = 'termination' then 'medical_leave' when wd.exception_type is not null then wd.exception_type else wd.base_status end,
            'exception_type', wd.exception_type,
            'exception_label', wd.exception_label,
            'exception_notes', wd.exception_notes,
            'is_working_day', wd.is_working_day,
            'is_rest_day', wd.is_rest_day
          ) order by wd.day_date)
        ) as payload
      from worker_days wd
      group by wd.buk_employee_id, wd.full_name, wd.document_number, wd.document_type, wd.job_title, wd.contract_code, wd.area_name, wd.exit_date
    )
    select jsonb_build_object(
      'range', jsonb_build_object('start_date', range_start, 'end_date', range_end),
      'page', requested_page,
      'page_size', page_limit,
      'total_workers', (select total_workers from worker_count),
      'has_more', (select count(*) > page_limit from page_workers),
      'next_cursor', (
        select jsonb_build_object('full_name', spw.full_name, 'buk_employee_id', spw.buk_employee_id)
        from selected_page_workers spw
        order by spw.page_row desc
        limit 1
      ),
      'workers', coalesce((
        select jsonb_agg(wp.payload order by wp.full_name, wp.buk_employee_id)
        from worker_payloads wp
      ), '[]'::jsonb)
    )
  );
end;
$function$;

revoke all on function public.get_hr_roster_bulk_calendar_page_v2(date, date, text, text, text, text, text, integer, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.get_hr_roster_bulk_calendar_page_v2(date, date, text, text, text, text, text, integer, integer, text, text)
  to authenticated;

notify pgrst, 'reload schema';
commit;
