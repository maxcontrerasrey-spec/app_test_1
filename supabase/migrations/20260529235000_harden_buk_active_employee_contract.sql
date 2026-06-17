begin;

create index if not exists idx_employees_identity_active_updated
  on public.employees (document_type, document_number, is_active, updated_at desc, created_at desc);

create or replace view public.employees_active_current as
with ranked_employees as (
  select
    e.*,
    row_number() over (
      partition by coalesce(nullif(trim(e.document_type), ''), 'buk')
        || ':'
        || coalesce(
          nullif(regexp_replace(coalesce(e.document_number, ''), '\D', '', 'g'), ''),
          e.buk_employee_id
        )
      order by
        case when e.is_active then 0 else 1 end,
        e.updated_at desc nulls last,
        e.created_at desc nulls last,
        e.buk_employee_id desc
    ) as identity_rank
  from public.employees e
)
select
  id,
  buk_employee_id,
  full_name,
  email,
  job_title,
  contract_code,
  area_name,
  area_code,
  document_number,
  document_type,
  birth_date,
  status,
  is_active,
  raw_payload,
  created_at,
  updated_at
from ranked_employees
where is_active = true
  and identity_rank = 1;

grant select on public.employees_active_current to authenticated;

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
    select jsonb_agg(
      jsonb_build_object(
        'id', employee_row.id,
        'buk_employee_id', employee_row.buk_employee_id,
        'full_name', employee_row.full_name,
        'job_title', employee_row.job_title,
        'birth_date', employee_row.birth_date,
        'birthday_label', to_char(employee_row.birth_date, 'DD "de" TMMonth'),
        'days_until', employee_row.days_until
      )
      order by employee_row.days_until asc, extract(month from employee_row.birth_date), extract(day from employee_row.birth_date), employee_row.full_name
    )
    from (
      select
        e.id,
        e.buk_employee_id,
        e.full_name,
        e.job_title,
        e.birth_date,
        (
          (
            case
              when make_date(
                extract(year from current_date)::integer,
                extract(month from e.birth_date)::integer,
                least(
                  extract(day from e.birth_date)::integer,
                  extract(day from (date_trunc('month', make_date(extract(year from current_date)::integer, extract(month from e.birth_date)::integer, 1) + interval '1 month - 1 day')))::integer
                )
              ) >= current_date then
                make_date(
                  extract(year from current_date)::integer,
                  extract(month from e.birth_date)::integer,
                  least(
                    extract(day from e.birth_date)::integer,
                    extract(day from (date_trunc('month', make_date(extract(year from current_date)::integer, extract(month from e.birth_date)::integer, 1) + interval '1 month - 1 day')))::integer
                  )
                )
              else
                make_date(
                  extract(year from current_date)::integer + 1,
                  extract(month from e.birth_date)::integer,
                  least(
                    extract(day from e.birth_date)::integer,
                    extract(day from (date_trunc('month', make_date(extract(year from current_date)::integer + 1, extract(month from e.birth_date)::integer, 1) + interval '1 month - 1 day')))::integer
                  )
                )
            end
          ) - current_date
        )::integer as days_until
      from public.employees_active_current e
      where e.birth_date is not null
      order by 6 asc, extract(month from e.birth_date), extract(day from e.birth_date), e.full_name
      limit safe_limit
    ) employee_row
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.get_upcoming_birthdays(integer) from public, anon;
grant execute on function public.get_upcoming_birthdays(integer) to authenticated;

notify pgrst, 'reload schema';

commit;
