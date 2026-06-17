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

  if not (
    public.user_is_admin(current_user_id)
    or public.user_can_access_module(current_user_id, 'control_contrataciones')
    or public.user_can_access_module(current_user_id, 'operaciones')
    or public.user_can_access_module(current_user_id, 'certificados')
    or public.user_can_access_module(current_user_id, 'seguimiento_certificados')
    or public.user_can_access_module(current_user_id, 'solicitud_contrataciones')
  ) then
    raise exception 'Sin permisos para ver cumpleanos';
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
