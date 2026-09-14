-- EEES-DB-005: approved
-- owner: Human Resources / Operations
-- rollback: forward-only; restore the prior summary contract in a subsequent migration if required.
-- purpose: keep roster KPI and bulk calendar on the same worker universe.
begin;

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
  normalized_contract text := lower(trim(coalesce(p_contract_filter, '')));
  normalized_area text := lower(trim(coalesce(p_area_filter, '')));
begin
  if not public.user_can_view_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar el resumen de jornadas';
  end if;

  return (
    with active_workers as (
      select distinct on (e.buk_employee_id)
        e.buk_employee_id,
        nullif(trim(e.contract_code), '') as contract_code,
        nullif(trim(e.area_name), '') as area_name,
        public.extract_buk_employee_exit_date(e.raw_payload) as exit_date,
        public.build_active_employee_search_text(
          e.full_name,
          e.document_number,
          e.job_title,
          e.contract_code,
          coalesce(e.area_name, e.contract_code),
          e.raw_payload
        ) as search_text
      from public.employees e
      where e.is_active = true
         or public.extract_buk_employee_exit_date(e.raw_payload) >= month_start
      order by
        e.buk_employee_id,
        e.is_active desc,
        e.updated_at desc nulls last,
        e.created_at desc nulls last
    ),
    filtered_workers as (
      select aw.buk_employee_id
      from active_workers aw
      where (
        normalized_search = ''
        or aw.search_text like '%' || normalized_search || '%'
      )
      and (
        normalized_contract = ''
        or lower(coalesce(aw.contract_code, '')) like '%' || normalized_contract || '%'
      )
      and (
        normalized_area = ''
        or lower(coalesce(aw.area_name, aw.contract_code, '')) = normalized_area
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

revoke all on function public.get_hr_roster_calendar_summary(date, text, text, text) from public, anon, authenticated;
grant execute on function public.get_hr_roster_calendar_summary(date, text, text, text) to authenticated;
notify pgrst, 'reload schema';
commit;
