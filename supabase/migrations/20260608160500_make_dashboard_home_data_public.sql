begin;

-- ============================================================
-- FIX: Permitir que "Folios en curso" y "Cumpleaños" sean
--      visibles para TODOS los usuarios en el Dashboard.
-- ============================================================

-- 1. Remover validacion de permisos de modulos en cumpleaños
create or replace function public.get_upcoming_birthdays(p_limit integer default 3)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  safe_limit integer := greatest(1, least(coalesce(p_limit, 3), 12));
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  return coalesce((
    with upcoming_birthdays as (
      select
        e.id,
        e.buk_employee_id,
        e.full_name,
        e.job_title,
        e.birth_date,
        case
          when make_date(
            extract(year from current_date)::integer,
            extract(month from e.birth_date)::integer,
            least(
              extract(day from e.birth_date)::integer,
              extract(
                day from (
                  date_trunc(
                    'month',
                    make_date(
                      extract(year from current_date)::integer,
                      extract(month from e.birth_date)::integer,
                      1
                    )::timestamp
                  ) + interval '1 month - 1 day'
                )
              )::integer
            )
          ) >= current_date then
            make_date(
              extract(year from current_date)::integer,
              extract(month from e.birth_date)::integer,
              least(
                extract(day from e.birth_date)::integer,
                extract(
                  day from (
                    date_trunc(
                      'month',
                      make_date(
                        extract(year from current_date)::integer,
                        extract(month from e.birth_date)::integer,
                        1
                      )::timestamp
                    ) + interval '1 month - 1 day'
                  )
                )::integer
              )
            )
          else
            make_date(
              extract(year from current_date)::integer + 1,
              extract(month from e.birth_date)::integer,
              least(
                extract(day from e.birth_date)::integer,
                extract(
                  day from (
                    date_trunc(
                      'month',
                      make_date(
                        extract(year from current_date)::integer + 1,
                        extract(month from e.birth_date)::integer,
                        1
                      )::timestamp
                    ) + interval '1 month - 1 day'
                  )
                )::integer
              )
            )
        end as next_birthday
      from public.employees_active_current e
      where e.birth_date is not null
    )
    select jsonb_agg(
      jsonb_build_object(
        'id', employee_row.id,
        'buk_employee_id', employee_row.buk_employee_id,
        'full_name', employee_row.full_name,
        'job_title', employee_row.job_title,
        'birth_date', employee_row.birth_date,
        'birthday_label', to_char(employee_row.birth_date, 'DD "de" TMMonth'),
        'days_until', (employee_row.next_birthday - current_date)::integer
      )
      order by
        (employee_row.next_birthday - current_date)::integer asc,
        extract(month from employee_row.birth_date),
        extract(day from employee_row.birth_date),
        employee_row.full_name
    )
    from (
      select *
      from upcoming_birthdays
      order by
        (next_birthday - current_date)::integer asc,
        extract(month from birth_date),
        extract(day from birth_date),
        full_name
      limit safe_limit
    ) employee_row
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.get_upcoming_birthdays(integer) from public, anon;
grant execute on function public.get_upcoming_birthdays(integer) to authenticated;

-- 2. En el Dashboard Home, extraer active_cases sin filtrar por permisos de reclutamiento
create or replace function public.get_dashboard_home_bundle(
  p_birthdays_limit integer default 6
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  active_folios jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select coalesce(
    jsonb_agg(case_row.payload order by case_row.sort_opened_at desc),
    '[]'::jsonb
  )
  into active_folios
  from (
    select
      jsonb_build_object(
        'id', rc.id,
        'case_code', rc.case_code,
        'status', rc.status,
        'requested_vacancies', rc.requested_vacancies,
        'filled_vacancies', rc.filled_vacancies,
        'title', rc.title,
        'contract_name', rc.contract_name,
        'job_position_name', rc.job_position_name,
        'cost_center_code', rc.cost_center_code,
        'cost_center_name', rc.cost_center_name,
        'requested_entry_date', rc.requested_entry_date,
        'target_close_date', rc.target_close_date,
        'opened_at', rc.opened_at,
        'requester_name', hr.requester_name,
        'requester_email', hr.requester_email,
        'hiring_request_status', hr.status,
        'can_close_request', public.user_can_close_hiring_request(current_user_id, hr.id),
        'owner_name', owner_profile.full_name,
        'owner_user_id', owner_assignment.user_id,
        'candidate_count', coalesce(candidate_stats.candidate_count, 0),
        'ready_candidates', coalesce(candidate_stats.ready_candidates, 0),
        'hired_candidates', coalesce(candidate_stats.hired_candidates, 0)
      ) as payload,
      rc.opened_at as sort_opened_at
    from public.recruitment_cases rc
    join public.hiring_requests hr
      on hr.id = rc.hiring_request_id
    left join lateral (
      select rca.user_id
      from public.recruitment_case_assignments rca
      where rca.recruitment_case_id = rc.id
        and rca.is_primary = true
      order by rca.id asc
      limit 1
    ) as owner_assignment on true
    left join public.profiles owner_profile
      on owner_profile.id = owner_assignment.user_id
    left join lateral (
      select
        count(*) filter (where rcc.stage_code not in ('rejected', 'withdrawn', 'hired', 'ready_for_hire')) as candidate_count,
        count(*) filter (where rcc.stage_code = 'ready_for_hire') as ready_candidates,
        count(*) filter (where rcc.stage_code = 'hired') as hired_candidates
      from public.recruitment_case_candidates rcc
      where rcc.recruitment_case_id = rc.id
    ) as candidate_stats on true
    where rc.status in ('open', 'ready_to_hire')
    order by rc.opened_at desc
    limit 25
  ) as case_row;

  return jsonb_build_object(
    'tasks_data',
    coalesce(public.get_dashboard_tasks(current_user_id)::jsonb, '[]'::jsonb),
    'approval_tracking_data',
    coalesce(public.get_dashboard_approval_tracking()::jsonb, '[]'::jsonb),
    'active_folios_data',
    active_folios,
    'birthdays_data',
    coalesce(
      public.get_upcoming_birthdays(greatest(coalesce(p_birthdays_limit, 6), 1)),
      '[]'::jsonb
    )
  );
end;
$function$;

revoke all on function public.get_dashboard_home_bundle(integer) from public, anon;
grant execute on function public.get_dashboard_home_bundle(integer) to authenticated;

notify pgrst, 'reload schema';

commit;
