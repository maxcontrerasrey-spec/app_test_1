begin;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  buk_employee_id text not null unique,
  full_name text not null,
  email text null,
  job_title text null,
  contract_code text null,
  area_name text null,
  area_code text null,
  document_number text null,
  document_type text null,
  birth_date date null,
  status text null,
  is_active boolean not null default true,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.employees
  add column if not exists email text null,
  add column if not exists job_title text null,
  add column if not exists contract_code text null,
  add column if not exists area_name text null,
  add column if not exists area_code text null,
  add column if not exists document_number text null,
  add column if not exists document_type text null,
  add column if not exists birth_date date null,
  add column if not exists status text null,
  add column if not exists is_active boolean not null default true,
  add column if not exists raw_payload jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists idx_employees_is_active_birth_date
  on public.employees (is_active, birth_date);

drop trigger if exists trg_employees_set_updated_at on public.employees;
create trigger trg_employees_set_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

grant select on public.employees to authenticated;

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
      from public.employees e
      where e.is_active = true
        and e.birth_date is not null
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
