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
        nullif(trim(e.contract_code), '') as contract_code,
        nullif(trim(e.area_name), '') as area_name,
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
            coalesce(aw.contract_code, ''),
            coalesce(aw.area_name, '')
          )
        ) like '%' || normalized_search || '%'
      )
        and (
          normalized_contract = ''
          or lower(coalesce(aw.contract_code, '')) like '%' || normalized_contract || '%'
        )
        and (
          normalized_area = ''
          or lower(coalesce(aw.area_name, '')) like '%' || normalized_area || '%'
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
