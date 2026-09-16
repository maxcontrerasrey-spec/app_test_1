-- EEES-DB-005: approved
-- owner: Human Resources / Operations
-- rollback: forward-only; restore the previous summary body in a later audited migration.
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
set search_path = public, pg_temp
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
    with filtered_workers as materialized (
      select
        e.buk_employee_id,
        nullif(trim(e.contract_code), '') as contract_code,
        nullif(trim(e.area_name), '') as area_name
      from public.employees e
      where (e.is_active = true or e.buk_exit_date >= month_start)
        and coalesce(lower(trim(e.raw_payload ->> 'private_role')), 'false') not in ('true', '1', 'yes', 'si', 'sí')
        and case
          when normalized_search = '' then true
          else public.build_active_employee_search_text(
            e.full_name,
            e.document_number,
            e.job_title,
            e.contract_code,
            coalesce(e.area_name, e.contract_code),
            e.raw_payload
          ) like '%' || normalized_search || '%'
        end
        and case
          when normalized_contract = '' then true
          else public.normalize_buk_contract_code(e.contract_code)
               like '%' || public.normalize_buk_contract_code(normalized_contract) || '%'
        end
        and case
          when normalized_area = '' then true
          else public.normalize_buk_area_name(coalesce(e.area_name, e.contract_code, ''))
               = public.normalize_buk_area_name(normalized_area)
        end
    ), worker_states as materialized (
      select
        fw.buk_employee_id,
        exists (
          select 1
          from public.hr_worker_rosters wr
          where wr.employee_buk_employee_id = fw.buk_employee_id
            and wr.start_date <= month_end
            and coalesce(wr.end_date, 'infinity'::date) >= month_start
            and public.hr_roster_assignment_applies_on_buk_date(
              wr.contract_code,
              wr.area_name,
              wr.invalidated_at,
              wr.invalidated_effective_date,
              fw.contract_code,
              fw.area_name,
              greatest(wr.start_date, month_start)
            )
        ) as is_assigned
      from filtered_workers fw
    )
    select jsonb_build_object(
      'month_start', month_start,
      'month_end', month_end,
      'assigned_count', count(*) filter (where ws.is_assigned),
      'pending_count', count(*) filter (where not ws.is_assigned),
      'total_count', count(*)
    )
    from worker_states ws
  );
end;
$function$;

revoke all on function public.get_hr_roster_calendar_summary(date, text, text, text) from public, anon, authenticated;
grant execute on function public.get_hr_roster_calendar_summary(date, text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
