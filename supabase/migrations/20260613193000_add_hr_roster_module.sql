begin;

insert into public.app_modules (code, name, route, description, sort_order, is_active)
values (
  'jornadas_turnos',
  'Jornadas y Turnos',
  '/roster',
  'Gestion operacional de pautas, turnos, descansos y excepciones por trabajador.',
  55,
  true
)
on conflict (code) do update
set
  name = excluded.name,
  route = excluded.route,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = timezone('utc', now());

with desired_modules (role_code, module_code) as (
  values
    ('admin', 'jornadas_turnos'),
    ('control_contratos', 'jornadas_turnos'),
    ('operaciones', 'jornadas_turnos'),
    ('operaciones_l_1', 'jornadas_turnos'),
    ('operaciones_l_2', 'jornadas_turnos'),
    ('gerencia', 'jornadas_turnos'),
    ('director_eje', 'jornadas_turnos'),
    ('director_op', 'jornadas_turnos'),
    ('gerente_general', 'jornadas_turnos'),
    ('administrativo', 'jornadas_turnos')
)
insert into public.role_module_access (role_code, module_code, can_view)
select dm.role_code, dm.module_code, true
from desired_modules dm
join public.app_roles ar
  on ar.code = dm.role_code
join public.app_modules am
  on am.code = dm.module_code
on conflict (role_code, module_code) do update
set can_view = excluded.can_view;

alter table public.hr_incentive_types
  add column if not exists requires_rest_day boolean not null default false;

create table if not exists public.hr_shift_patterns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  working_days integer not null check (working_days > 0),
  resting_days integer not null check (resting_days >= 0),
  cycle_length integer generated always as (working_days + resting_days) stored,
  color_hex text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint hr_shift_patterns_code_format check (code = lower(code))
);

create table if not exists public.hr_worker_rosters (
  id uuid primary key default gen_random_uuid(),
  employee_buk_employee_id text not null,
  employee_document_type text not null default 'rut',
  employee_document_number text,
  employee_full_name text not null,
  employee_job_title text,
  contract_code text,
  area_name text,
  pattern_id uuid not null references public.hr_shift_patterns (id) on delete restrict,
  start_date date not null,
  end_date date,
  notes text,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint hr_worker_rosters_date_range check (end_date is null or end_date >= start_date),
  unique (employee_buk_employee_id, start_date)
);

create table if not exists public.hr_roster_exceptions (
  id uuid primary key default gen_random_uuid(),
  employee_buk_employee_id text not null,
  employee_document_type text not null default 'rut',
  employee_document_number text,
  employee_full_name text not null,
  exception_date date not null,
  exception_type text not null
    check (
      exception_type in (
        'vacation',
        'medical_leave',
        'absent',
        'extra_shift',
        'training',
        'administrative_leave',
        'union_leave'
      )
    ),
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (employee_buk_employee_id, exception_date)
);

create index if not exists idx_hr_shift_patterns_active
  on public.hr_shift_patterns (is_active, name);

create index if not exists idx_hr_worker_rosters_employee_dates
  on public.hr_worker_rosters (employee_buk_employee_id, start_date desc, end_date);

create index if not exists idx_hr_roster_exceptions_employee_date
  on public.hr_roster_exceptions (employee_buk_employee_id, exception_date desc)
  where is_active = true;

drop trigger if exists trg_hr_shift_patterns_set_updated_at on public.hr_shift_patterns;
create trigger trg_hr_shift_patterns_set_updated_at
before update on public.hr_shift_patterns
for each row
execute function public.set_updated_at();

drop trigger if exists trg_hr_worker_rosters_set_updated_at on public.hr_worker_rosters;
create trigger trg_hr_worker_rosters_set_updated_at
before update on public.hr_worker_rosters
for each row
execute function public.set_updated_at();

drop trigger if exists trg_hr_roster_exceptions_set_updated_at on public.hr_roster_exceptions;
create trigger trg_hr_roster_exceptions_set_updated_at
before update on public.hr_roster_exceptions
for each row
execute function public.set_updated_at();

create or replace function public.user_can_manage_hr_roster(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_can_access_module(target_user_id, 'jornadas_turnos')
    or public.user_is_admin(target_user_id);
$$;

alter table public.hr_shift_patterns enable row level security;
alter table public.hr_worker_rosters enable row level security;
alter table public.hr_roster_exceptions enable row level security;

drop policy if exists "hr_shift_patterns_select_authenticated" on public.hr_shift_patterns;
create policy "hr_shift_patterns_select_authenticated"
on public.hr_shift_patterns
for select
to authenticated
using (public.user_can_manage_hr_roster(auth.uid()));

drop policy if exists "hr_worker_rosters_select_authenticated" on public.hr_worker_rosters;
create policy "hr_worker_rosters_select_authenticated"
on public.hr_worker_rosters
for select
to authenticated
using (public.user_can_manage_hr_roster(auth.uid()));

drop policy if exists "hr_roster_exceptions_select_authenticated" on public.hr_roster_exceptions;
create policy "hr_roster_exceptions_select_authenticated"
on public.hr_roster_exceptions
for select
to authenticated
using (public.user_can_manage_hr_roster(auth.uid()));

grant select on public.hr_shift_patterns to authenticated;
grant select on public.hr_worker_rosters to authenticated;
grant select on public.hr_roster_exceptions to authenticated;

create or replace function public.get_hr_roster_exception_type_label(p_exception_type text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(p_exception_type, '')))
    when 'vacation' then 'Vacaciones'
    when 'medical_leave' then 'Licencia médica'
    when 'absent' then 'Inasistencia'
    when 'extra_shift' then 'Turno extra'
    when 'training' then 'Capacitación'
    when 'administrative_leave' then 'Permiso administrativo'
    when 'union_leave' then 'Permiso sindical'
    else 'Sin clasificar'
  end;
$$;

create or replace function public.search_hr_roster_workers(
  p_search text default null,
  p_limit integer default 12
)
returns table (
  buk_employee_id text,
  full_name text,
  document_number text,
  document_type text,
  job_title text,
  contract_code text,
  area_name text,
  display_label text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  safe_limit integer := least(greatest(coalesce(p_limit, 12), 1), 50);
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar trabajadores de jornadas';
  end if;

  return query
  with active_workers as (
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
      ) as resolved_job_title,
      nullif(trim(e.contract_code), '') as contract_code,
      nullif(trim(e.area_name), '') as area_name
    from public.employees_active_current e
    order by e.buk_employee_id, e.updated_at desc nulls last, e.created_at desc nulls last
  )
  select
    aw.buk_employee_id,
    aw.full_name,
    aw.document_number,
    aw.document_type,
    aw.resolved_job_title as job_title,
    aw.contract_code,
    aw.area_name,
    concat_ws(
      ' | ',
      coalesce(aw.document_number, 'Sin RUT'),
      coalesce(aw.resolved_job_title, 'Sin cargo'),
      aw.full_name,
      coalesce(aw.area_name, aw.contract_code, 'Sin contrato')
    ) as display_label
  from active_workers aw
  where normalized_search = ''
    or lower(
      concat_ws(
        ' ',
        aw.full_name,
        coalesce(aw.document_number, ''),
        coalesce(aw.resolved_job_title, ''),
        coalesce(aw.contract_code, ''),
        coalesce(aw.area_name, '')
      )
    ) like '%' || normalized_search || '%'
  order by aw.full_name
  limit safe_limit;
end;
$function$;

create or replace function public.get_hr_roster_setup_catalogs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para administrar jornadas y turnos';
  end if;

  return jsonb_build_object(
    'patterns',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', hp.id,
          'code', hp.code,
          'name', hp.name,
          'description', hp.description,
          'working_days', hp.working_days,
          'resting_days', hp.resting_days,
          'cycle_length', hp.cycle_length,
          'color_hex', hp.color_hex,
          'is_active', hp.is_active,
          'created_at', hp.created_at
        )
        order by hp.is_active desc, hp.name
      )
      from public.hr_shift_patterns hp
    ), '[]'::jsonb),
    'exception_types',
    jsonb_build_array(
      jsonb_build_object('value', 'vacation', 'label', public.get_hr_roster_exception_type_label('vacation')),
      jsonb_build_object('value', 'medical_leave', 'label', public.get_hr_roster_exception_type_label('medical_leave')),
      jsonb_build_object('value', 'absent', 'label', public.get_hr_roster_exception_type_label('absent')),
      jsonb_build_object('value', 'extra_shift', 'label', public.get_hr_roster_exception_type_label('extra_shift')),
      jsonb_build_object('value', 'training', 'label', public.get_hr_roster_exception_type_label('training')),
      jsonb_build_object('value', 'administrative_leave', 'label', public.get_hr_roster_exception_type_label('administrative_leave')),
      jsonb_build_object('value', 'union_leave', 'label', public.get_hr_roster_exception_type_label('union_leave'))
    )
  );
end;
$function$;

create or replace function public.upsert_hr_shift_pattern(
  p_pattern_id uuid default null,
  p_code text default null,
  p_name text default null,
  p_working_days integer default null,
  p_resting_days integer default null,
  p_description text default null,
  p_color_hex text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := trim(coalesce(p_name, ''));
  normalized_code text := lower(trim(coalesce(p_code, '')));
  result_id uuid;
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para administrar pautas';
  end if;

  if normalized_name = '' then
    raise exception 'Debe indicar un nombre para la pauta';
  end if;

  if coalesce(p_working_days, 0) <= 0 then
    raise exception 'Los días de trabajo deben ser mayores a 0';
  end if;

  if coalesce(p_resting_days, -1) < 0 then
    raise exception 'Los días de descanso no pueden ser negativos';
  end if;

  if normalized_code = '' then
    normalized_code := regexp_replace(lower(normalized_name), '[^a-z0-9]+', '_', 'g');
    normalized_code := trim(both '_' from normalized_code);
  end if;

  if normalized_code = '' then
    raise exception 'No fue posible generar un código de pauta válido';
  end if;

  if p_pattern_id is not null then
    update public.hr_shift_patterns
    set
      code = normalized_code,
      name = normalized_name,
      description = nullif(trim(coalesce(p_description, '')), ''),
      working_days = p_working_days,
      resting_days = p_resting_days,
      color_hex = nullif(trim(coalesce(p_color_hex, '')), ''),
      is_active = true,
      updated_at = timezone('utc', now())
    where id = p_pattern_id
    returning id into result_id;
  else
    insert into public.hr_shift_patterns (
      code,
      name,
      description,
      working_days,
      resting_days,
      color_hex,
      created_by
    )
    values (
      normalized_code,
      normalized_name,
      nullif(trim(coalesce(p_description, '')), ''),
      p_working_days,
      p_resting_days,
      nullif(trim(coalesce(p_color_hex, '')), ''),
      current_user_id
    )
    on conflict (code)
    do update
      set
        name = excluded.name,
        description = excluded.description,
        working_days = excluded.working_days,
        resting_days = excluded.resting_days,
        color_hex = excluded.color_hex,
        is_active = true,
        updated_at = timezone('utc', now())
    returning id into result_id;
  end if;

  if result_id is null then
    raise exception 'No fue posible guardar la pauta';
  end if;

  return result_id;
end;
$function$;

create or replace function public.set_hr_shift_pattern_status(
  p_pattern_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para administrar pautas';
  end if;

  update public.hr_shift_patterns
  set
    is_active = coalesce(p_is_active, false),
    updated_at = timezone('utc', now())
  where id = p_pattern_id;
end;
$function$;

create or replace function public.assign_hr_worker_roster(
  p_buk_employee_id text,
  p_pattern_id uuid,
  p_start_date date,
  p_end_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_row record;
  pattern_row record;
  result_id uuid;
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para asignar pautas';
  end if;

  if p_start_date is null then
    raise exception 'Debe indicar la fecha de inicio de la pauta';
  end if;

  if p_end_date is not null and p_end_date < p_start_date then
    raise exception 'La fecha de término no puede ser menor a la fecha de inicio';
  end if;

  select
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
    nullif(trim(e.area_name), '') as area_name
  into worker_row
  from public.employees_active_current e
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_row.buk_employee_id is null then
    raise exception 'Trabajador BUK no encontrado para asignar pauta';
  end if;

  select hp.id, hp.is_active
  into pattern_row
  from public.hr_shift_patterns hp
  where hp.id = p_pattern_id;

  if pattern_row.id is null then
    raise exception 'La pauta seleccionada no existe';
  end if;

  if pattern_row.is_active is not true then
    raise exception 'La pauta seleccionada está inactiva';
  end if;

  update public.hr_worker_rosters
  set
    end_date = p_start_date - 1,
    updated_at = timezone('utc', now())
  where employee_buk_employee_id = worker_row.buk_employee_id
    and start_date < p_start_date
    and coalesce(end_date, 'infinity'::date) >= p_start_date;

  if exists (
    select 1
    from public.hr_worker_rosters wr
    where wr.employee_buk_employee_id = worker_row.buk_employee_id
      and daterange(wr.start_date, coalesce(wr.end_date, 'infinity'::date), '[]')
          && daterange(p_start_date, coalesce(p_end_date, 'infinity'::date), '[]')
  ) then
    raise exception 'Ya existe una asignación de pauta que se superpone con el rango indicado';
  end if;

  insert into public.hr_worker_rosters (
    employee_buk_employee_id,
    employee_document_type,
    employee_document_number,
    employee_full_name,
    employee_job_title,
    contract_code,
    area_name,
    pattern_id,
    start_date,
    end_date,
    notes,
    assigned_by
  )
  values (
    worker_row.buk_employee_id,
    worker_row.document_type,
    worker_row.document_number,
    worker_row.full_name,
    worker_row.job_title,
    worker_row.contract_code,
    worker_row.area_name,
    p_pattern_id,
    p_start_date,
    p_end_date,
    nullif(trim(coalesce(p_notes, '')), ''),
    current_user_id
  )
  on conflict (employee_buk_employee_id, start_date)
  do update
    set
      employee_document_type = excluded.employee_document_type,
      employee_document_number = excluded.employee_document_number,
      employee_full_name = excluded.employee_full_name,
      employee_job_title = excluded.employee_job_title,
      contract_code = excluded.contract_code,
      area_name = excluded.area_name,
      pattern_id = excluded.pattern_id,
      end_date = excluded.end_date,
      notes = excluded.notes,
      assigned_by = excluded.assigned_by,
      updated_at = timezone('utc', now())
  returning id into result_id;

  return result_id;
end;
$function$;

create or replace function public.upsert_hr_roster_exception(
  p_exception_id uuid default null,
  p_buk_employee_id text default null,
  p_exception_date date default null,
  p_exception_type text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_row record;
  normalized_exception_type text := lower(trim(coalesce(p_exception_type, '')));
  result_id uuid;
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para administrar excepciones';
  end if;

  if p_exception_date is null then
    raise exception 'Debe indicar la fecha de la excepción';
  end if;

  if normalized_exception_type not in (
    'vacation',
    'medical_leave',
    'absent',
    'extra_shift',
    'training',
    'administrative_leave',
    'union_leave'
  ) then
    raise exception 'El tipo de excepción no es válido';
  end if;

  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type
  into worker_row
  from public.employees_active_current e
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_row.buk_employee_id is null then
    raise exception 'Trabajador BUK no encontrado para registrar excepción';
  end if;

  if p_exception_id is not null then
    update public.hr_roster_exceptions
    set
      employee_buk_employee_id = worker_row.buk_employee_id,
      employee_document_type = worker_row.document_type,
      employee_document_number = worker_row.document_number,
      employee_full_name = worker_row.full_name,
      exception_date = p_exception_date,
      exception_type = normalized_exception_type,
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      is_active = true,
      updated_at = timezone('utc', now())
    where id = p_exception_id
    returning id into result_id;
  else
    insert into public.hr_roster_exceptions (
      employee_buk_employee_id,
      employee_document_type,
      employee_document_number,
      employee_full_name,
      exception_date,
      exception_type,
      notes,
      created_by
    )
    values (
      worker_row.buk_employee_id,
      worker_row.document_type,
      worker_row.document_number,
      worker_row.full_name,
      p_exception_date,
      normalized_exception_type,
      nullif(trim(coalesce(p_notes, '')), ''),
      current_user_id
    )
    on conflict (employee_buk_employee_id, exception_date)
    do update
      set
        employee_document_type = excluded.employee_document_type,
        employee_document_number = excluded.employee_document_number,
        employee_full_name = excluded.employee_full_name,
        exception_type = excluded.exception_type,
        notes = excluded.notes,
        is_active = true,
        updated_at = timezone('utc', now())
    returning id into result_id;
  end if;

  return result_id;
end;
$function$;

create or replace function public.set_hr_roster_exception_status(
  p_exception_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para administrar excepciones';
  end if;

  update public.hr_roster_exceptions
  set
    is_active = coalesce(p_is_active, false),
    updated_at = timezone('utc', now())
  where id = p_exception_id;
end;
$function$;

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
  cycle_index integer;
  resolved_base_status text;
  resolved_effective_status text;
begin
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
  join public.hr_shift_patterns hp
    on hp.id = wr.pattern_id
  where wr.employee_buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
    and wr.start_date <= p_target_date
    and coalesce(wr.end_date, 'infinity'::date) >= p_target_date
  order by wr.start_date desc, wr.created_at desc
  limit 1;

  if assignment_row.assignment_id is null then
    return query
    select
      null::uuid,
      null::uuid,
      null::text,
      null::integer,
      null::integer,
      null::integer,
      null::date,
      null::date,
      null::integer,
      'unassigned'::text,
      'unassigned'::text,
      null::text,
      null::text,
      null::text,
      false,
      false;
    return;
  end if;

  cycle_index := mod((p_target_date - assignment_row.start_date), assignment_row.cycle_length);
  resolved_base_status := case
    when cycle_index < assignment_row.working_days then 'working'
    else 'resting'
  end;

  select
    hre.exception_type,
    hre.notes
  into exception_row
  from public.hr_roster_exceptions hre
  where hre.employee_buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
    and hre.exception_date = p_target_date
    and hre.is_active = true
  limit 1;

  resolved_effective_status := case
    when exception_row.exception_type is null then resolved_base_status
    when exception_row.exception_type = 'extra_shift' then 'extra_shift'
    when exception_row.exception_type = 'training' then 'training'
    else exception_row.exception_type
  end;

  return query
  select
    assignment_row.assignment_id,
    assignment_row.pattern_id,
    assignment_row.pattern_name,
    assignment_row.working_days,
    assignment_row.resting_days,
    assignment_row.cycle_length,
    assignment_row.start_date,
    assignment_row.end_date,
    cycle_index + 1,
    resolved_base_status,
    resolved_effective_status,
    exception_row.exception_type,
    case
      when exception_row.exception_type is null then null
      else public.get_hr_roster_exception_type_label(exception_row.exception_type)
    end,
    exception_row.notes,
    resolved_base_status = 'working',
    resolved_base_status = 'resting';
end;
$function$;

create or replace function public.get_worker_schedule(
  p_buk_employee_id text,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  resolved_start date := coalesce(p_start_date, current_date);
  resolved_end date := coalesce(p_end_date, coalesce(p_start_date, current_date));
  worker_row record;
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar jornadas';
  end if;

  if resolved_end < resolved_start then
    raise exception 'El rango solicitado no es válido';
  end if;

  select
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
    nullif(trim(e.area_name), '') as area_name
  into worker_row
  from public.employees_active_current e
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_row.buk_employee_id is null then
    raise exception 'Trabajador BUK no encontrado';
  end if;

  return jsonb_build_object(
    'worker', jsonb_build_object(
      'buk_employee_id', worker_row.buk_employee_id,
      'full_name', worker_row.full_name,
      'document_number', worker_row.document_number,
      'document_type', worker_row.document_type,
      'job_title', worker_row.job_title,
      'contract_code', worker_row.contract_code,
      'area_name', worker_row.area_name
    ),
    'range', jsonb_build_object(
      'start_date', resolved_start,
      'end_date', resolved_end
    ),
    'summary', (
      with resolved_days as (
        select rs.*
        from generate_series(resolved_start, resolved_end, interval '1 day') as gs(day_date)
        cross join lateral public.resolve_hr_roster_day_status(worker_row.buk_employee_id, gs.day_date::date) rs
      )
      select jsonb_build_object(
        'working_days', count(*) filter (where rd.base_status = 'working'),
        'resting_days', count(*) filter (where rd.base_status = 'resting'),
        'exception_days', count(*) filter (where rd.exception_type is not null),
        'unassigned_days', count(*) filter (where rd.base_status = 'unassigned')
      )
      from resolved_days rd
    ),
    'assignments',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', wr.id,
          'pattern_id', hp.id,
          'pattern_name', hp.name,
          'pattern_code', hp.code,
          'working_days', hp.working_days,
          'resting_days', hp.resting_days,
          'cycle_length', hp.cycle_length,
          'start_date', wr.start_date,
          'end_date', wr.end_date,
          'notes', wr.notes,
          'contract_code', wr.contract_code,
          'area_name', wr.area_name,
          'created_at', wr.created_at
        )
        order by wr.start_date desc
      )
      from public.hr_worker_rosters wr
      join public.hr_shift_patterns hp
        on hp.id = wr.pattern_id
      where wr.employee_buk_employee_id = worker_row.buk_employee_id
        and daterange(wr.start_date, coalesce(wr.end_date, 'infinity'::date), '[]')
          && daterange(resolved_start, resolved_end, '[]')
    ), '[]'::jsonb),
    'exceptions',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', hre.id,
          'exception_date', hre.exception_date,
          'exception_type', hre.exception_type,
          'exception_label', public.get_hr_roster_exception_type_label(hre.exception_type),
          'notes', hre.notes,
          'is_active', hre.is_active,
          'created_at', hre.created_at
        )
        order by hre.exception_date asc
      )
      from public.hr_roster_exceptions hre
      where hre.employee_buk_employee_id = worker_row.buk_employee_id
        and hre.is_active = true
        and hre.exception_date between resolved_start and resolved_end
    ), '[]'::jsonb),
    'days',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', gs.day_date::date,
          'assignment_id', rs.assignment_id,
          'pattern_id', rs.pattern_id,
          'pattern_name', rs.pattern_name,
          'cycle_day', rs.cycle_day,
          'base_status', rs.base_status,
          'effective_status', rs.effective_status,
          'exception_type', rs.exception_type,
          'exception_label', rs.exception_label,
          'exception_notes', rs.exception_notes,
          'is_working_day', rs.is_working_day,
          'is_rest_day', rs.is_rest_day
        )
        order by gs.day_date asc
      )
      from generate_series(resolved_start, resolved_end, interval '1 day') as gs(day_date)
      cross join lateral public.resolve_hr_roster_day_status(worker_row.buk_employee_id, gs.day_date::date) rs
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.set_hr_incentive_type_roster_requirement(
  p_type_id uuid,
  p_requires_rest_day boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para administrar incentivos';
  end if;

  update public.hr_incentive_types
  set
    requires_rest_day = coalesce(p_requires_rest_day, false),
    updated_at = timezone('utc', now())
  where id = p_type_id;
end;
$function$;

create or replace function public.get_hr_incentive_setup_catalogs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para administrar incentivos';
  end if;

  return jsonb_build_object(
    'buk_job_titles',
    coalesce((
      with active_job_titles as (
        select distinct
          coalesce(
            nullif(trim(e.job_title), ''),
            nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
            nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
            nullif(trim(e.raw_payload ->> 'job_title'), '')
          ) as resolved_job_title
        from public.employees_active_current e
      )
      select jsonb_agg(ajt.resolved_job_title order by upper(ajt.resolved_job_title), ajt.resolved_job_title)
      from active_job_titles ajt
      where ajt.resolved_job_title is not null
    ), '[]'::jsonb),
    'buk_unions',
    coalesce((
      with active_unions as (
        select distinct public.get_hr_incentive_union_name(e.raw_payload) as union_name
        from public.employees_active_current e
      )
      select jsonb_agg(au.union_name order by upper(au.union_name), au.union_name)
      from active_unions au
      where au.union_name is not null
    ), '[]'::jsonb),
    'buk_union_statuses',
    coalesce((
      with active_union_statuses as (
        select distinct public.get_hr_incentive_union_status(e.raw_payload) as union_status
        from public.employees_active_current e
      )
      select jsonb_agg(
        jsonb_build_object(
          'value', aus.union_status,
          'label', public.get_hr_incentive_union_status_label(aus.union_status)
        )
        order by case aus.union_status
          when 'unionized' then 0
          when 'non_unionized' then 1
          else 2
        end
      )
      from active_union_statuses aus
      where aus.union_status is not null
    ), '[]'::jsonb),
    'allowed_job_titles',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', jt.id,
          'job_title', jt.job_title,
          'is_active', jt.is_active,
          'created_at', jt.created_at
        )
        order by jt.is_active desc, jt.job_title
      )
      from public.hr_incentive_allowed_job_titles jt
    ), '[]'::jsonb),
    'incentive_types',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', it.id,
          'code', it.code,
          'name', it.name,
          'calculation_basis', it.calculation_basis,
          'requires_replacement', it.requires_replacement,
          'requires_rest_day', it.requires_rest_day,
          'is_active', it.is_active,
          'created_at', it.created_at
        )
        order by it.is_active desc, it.name
      )
      from public.hr_incentive_types it
    ), '[]'::jsonb),
    'rate_rules',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', rr.id,
          'incentive_type_id', rr.incentive_type_id,
          'incentive_type_name', it.name,
          'contract_code', rr.contract_code,
          'job_title', rr.job_title,
          'union_name', rr.union_name,
          'union_status', rr.union_status,
          'amount', rr.amount,
          'priority', rr.priority,
          'valid_from', rr.valid_from,
          'valid_to', rr.valid_to,
          'is_active', rr.is_active,
          'created_at', rr.created_at
        )
        order by rr.is_active desc, it.name, rr.priority asc, rr.contract_code nulls last, rr.job_title nulls last, rr.union_name nulls last, rr.union_status nulls last
      )
      from public.hr_incentive_rate_rules rr
      join public.hr_incentive_types it
        on it.id = rr.incentive_type_id
    ), '[]'::jsonb)
  );
end;
$function$;

drop function if exists public.resolve_hr_incentive_rate_rule(uuid, text, text, text, text, date);
create or replace function public.resolve_hr_incentive_rate_rule(
  p_incentive_type_id uuid,
  p_job_title text,
  p_contract_code text,
  p_union_name text,
  p_union_status text,
  p_service_date date
)
returns table (
  incentive_type_id uuid,
  incentive_type_name text,
  calculation_basis text,
  requires_replacement boolean,
  requires_rest_day boolean,
  rate_rule_id uuid,
  rate_rule_amount numeric,
  matched_contract_code text,
  matched_job_title text,
  matched_union_name text,
  matched_union_status text,
  matched_priority integer
)
language plpgsql
security definer
set search_path = public
as $function$
begin
  return query
  select
    it.id,
    it.name,
    it.calculation_basis,
    it.requires_replacement,
    it.requires_rest_day,
    rr.id,
    rr.amount,
    rr.contract_code,
    rr.job_title,
    rr.union_name,
    rr.union_status,
    rr.priority
  from public.hr_incentive_types it
  join public.hr_incentive_rate_rules rr
    on rr.incentive_type_id = it.id
  where it.id = p_incentive_type_id
    and it.is_active = true
    and rr.is_active = true
    and (rr.valid_from is null or rr.valid_from <= p_service_date)
    and (rr.valid_to is null or rr.valid_to >= p_service_date)
    and (rr.contract_code is null or rr.contract_code = nullif(trim(coalesce(p_contract_code, '')), ''))
    and (
      rr.job_title is null
      or upper(trim(rr.job_title)) = upper(trim(coalesce(p_job_title, '')))
    )
    and (
      rr.union_name is null
      or upper(trim(rr.union_name)) = upper(trim(coalesce(p_union_name, '')))
    )
    and (
      rr.union_status is null
      or rr.union_status = coalesce(nullif(trim(coalesce(p_union_status, '')), ''), 'unknown')
    )
  order by
    case when rr.contract_code is not null then 0 else 1 end,
    case when rr.job_title is not null then 0 else 1 end,
    case when rr.union_name is not null then 0 else 1 end,
    case when rr.union_status is not null then 0 else 1 end,
    rr.priority asc,
    rr.updated_at desc nulls last
  limit 1;
end;
$function$;

create or replace function public.calculate_hr_incentive_preview(
  p_buk_employee_id text,
  p_incentive_type_id uuid,
  p_selected_contract_code text,
  p_duration_hours numeric default null,
  p_service_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_payload jsonb;
  worker_job_title text;
  worker_union_name text;
  worker_union_status text;
  resolved_service_date date := coalesce(p_service_date, current_date);
  rule_row record;
  calculated_amount numeric(12,2);
  roster_day_row record;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para calcular incentivos';
  end if;

  worker_payload := public.get_hr_incentive_worker_context(p_buk_employee_id);
  worker_job_title := worker_payload -> 'worker' ->> 'job_title';
  worker_union_name := worker_payload -> 'worker' ->> 'union_name';
  worker_union_status := worker_payload -> 'worker' ->> 'union_status';

  select *
    into rule_row
  from public.resolve_hr_incentive_rate_rule(
    p_incentive_type_id,
    worker_job_title,
    p_selected_contract_code,
    worker_union_name,
    worker_union_status,
    resolved_service_date
  );

  if rule_row.incentive_type_id is null then
    raise exception 'No existe una regla de monto activa para la combinación seleccionada';
  end if;

  if rule_row.requires_rest_day then
    select *
      into roster_day_row
    from public.resolve_hr_roster_day_status(p_buk_employee_id, resolved_service_date);

    if roster_day_row.base_status is distinct from 'resting' then
      raise exception
        'El incentivo seleccionado exige que el trabajador esté en descanso según su pauta operativa para la fecha %',
        to_char(resolved_service_date, 'DD/MM/YYYY');
    end if;
  end if;

  if rule_row.calculation_basis = 'per_hour' then
    if p_duration_hours is null or p_duration_hours <= 0 then
      raise exception 'Debe indicar una duración válida para calcular el incentivo';
    end if;

    calculated_amount := round((rule_row.rate_rule_amount * p_duration_hours)::numeric, 2);
  else
    calculated_amount := round(rule_row.rate_rule_amount::numeric, 2);
  end if;

  return jsonb_build_object(
    'worker', worker_payload -> 'worker',
    'rule', jsonb_build_object(
      'rate_rule_id', rule_row.rate_rule_id,
      'incentive_type_id', rule_row.incentive_type_id,
      'incentive_type_name', rule_row.incentive_type_name,
      'calculation_basis', rule_row.calculation_basis,
      'requires_replacement', rule_row.requires_replacement,
      'requires_rest_day', rule_row.requires_rest_day,
      'rate_rule_amount', rule_row.rate_rule_amount,
      'matched_contract_code', rule_row.matched_contract_code,
      'matched_job_title', rule_row.matched_job_title,
      'matched_union_name', rule_row.matched_union_name,
      'matched_union_status', rule_row.matched_union_status,
      'priority', rule_row.matched_priority
    ),
    'roster_validation',
    case
      when rule_row.requires_rest_day then jsonb_build_object(
        'requires_rest_day', true,
        'base_status', roster_day_row.base_status,
        'effective_status', roster_day_row.effective_status,
        'exception_type', roster_day_row.exception_type,
        'pattern_name', roster_day_row.pattern_name,
        'is_rest_day', roster_day_row.base_status = 'resting'
      )
      else jsonb_build_object(
        'requires_rest_day', false
      )
    end,
    'duration_hours', p_duration_hours,
    'service_date', resolved_service_date,
    'selected_contract_code', p_selected_contract_code,
    'calculated_amount', calculated_amount
  );
end;
$function$;

create or replace function public.create_hr_incentive_request(
  p_buk_employee_id text,
  p_incentive_type_id uuid,
  p_selected_contract_code text,
  p_selected_area_name text,
  p_selected_area_code text default null,
  p_service_date timestamptz default null,
  p_duration_hours numeric default null,
  p_motive text default null,
  p_description text default null,
  p_replacement_buk_employee_id text default null
)
returns table (
  request_id uuid,
  folio bigint,
  status text,
  calculated_amount numeric,
  period_code text,
  entry_lag_days integer,
  is_out_of_deadline boolean,
  is_contract_mismatch boolean
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_payload jsonb;
  replacement_payload jsonb;
  worker_data jsonb;
  preview_payload jsonb;
  rule_data jsonb;
  approver_context_row record;
  new_request_id uuid;
  new_folio bigint;
  resolved_now timestamptz := timezone('utc', now());
  resolved_service_at timestamptz := coalesce(p_service_date, resolved_now);
  resolved_period_code text := public.resolve_hr_incentive_period_code(coalesce(p_service_date, resolved_now));
  resolved_entry_lag_days integer := public.resolve_hr_incentive_entry_lag_days(
    resolved_now,
    coalesce(p_service_date, resolved_now)
  );
  resolved_is_out_of_deadline boolean := false;
  resolved_is_contract_mismatch boolean := false;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para registrar incentivos';
  end if;

  if nullif(trim(coalesce(p_selected_contract_code, '')), '') is null then
    raise exception 'Debe seleccionar el contrato/área aplicable';
  end if;

  if nullif(trim(coalesce(p_selected_area_name, '')), '') is null then
    raise exception 'Debe indicar el nombre del contrato/área aplicable';
  end if;

  if resolved_entry_lag_days > 7 then
    raise exception
      'No se pueden registrar incentivos con más de 7 días hacia atrás. Fecha mínima permitida: %',
      to_char(
        timezone('America/Santiago', resolved_now)::date - 7,
        'DD/MM/YYYY'
      );
  end if;

  resolved_is_out_of_deadline := resolved_entry_lag_days > 2;

  worker_payload := public.get_hr_incentive_worker_context(p_buk_employee_id);
  worker_data := worker_payload -> 'worker';
  resolved_is_contract_mismatch := public.resolve_hr_incentive_contract_mismatch(
    worker_data ->> 'primary_contract_code',
    trim(p_selected_contract_code)
  );

  preview_payload := public.calculate_hr_incentive_preview(
    p_buk_employee_id,
    p_incentive_type_id,
    p_selected_contract_code,
    p_duration_hours,
    resolved_service_at::date
  );
  rule_data := preview_payload -> 'rule';
  select *
  into approver_context_row
  from public.resolve_hr_incentive_contract_approvers(trim(p_selected_contract_code));

  if coalesce((rule_data ->> 'requires_replacement')::boolean, false) then
    if nullif(trim(coalesce(p_replacement_buk_employee_id, '')), '') is null then
      raise exception 'El tipo de incentivo seleccionado exige trabajador reemplazado';
    end if;

    replacement_payload := public.get_hr_incentive_worker_context(
      p_replacement_buk_employee_id
    ) -> 'worker';
  end if;

  insert into public.hr_incentive_requests as hir (
    employee_buk_employee_id,
    employee_document_type,
    employee_document_number,
    employee_full_name,
    employee_job_title,
    employee_union_name,
    employee_union_status,
    employee_union_joined_at,
    primary_contract_code,
    primary_area_name,
    selected_contract_code,
    selected_area_name,
    selected_area_code,
    incentive_type_id,
    incentive_type_name,
    requires_replacement,
    replacement_buk_employee_id,
    replacement_document_number,
    replacement_full_name,
    motive,
    description,
    service_date,
    duration_hours,
    period_code,
    calculation_basis,
    rate_rule_id,
    rate_rule_amount,
    calculated_amount,
    entry_lag_days,
    is_out_of_deadline,
    is_contract_mismatch,
    status,
    created_by
  )
  values (
    worker_data ->> 'buk_employee_id',
    coalesce(worker_data ->> 'document_type', 'rut'),
    worker_data ->> 'document_number',
    worker_data ->> 'full_name',
    worker_data ->> 'job_title',
    nullif(worker_data ->> 'union_name', ''),
    coalesce(worker_data ->> 'union_status', 'unknown'),
    nullif(worker_data ->> 'union_joined_at', '')::date,
    worker_data ->> 'primary_contract_code',
    worker_data ->> 'primary_area_name',
    trim(p_selected_contract_code),
    trim(p_selected_area_name),
    nullif(trim(coalesce(p_selected_area_code, '')), ''),
    p_incentive_type_id,
    rule_data ->> 'incentive_type_name',
    coalesce((rule_data ->> 'requires_replacement')::boolean, false),
    nullif(trim(coalesce(p_replacement_buk_employee_id, '')), ''),
    nullif(trim(coalesce(replacement_payload ->> 'document_number', '')), ''),
    nullif(trim(coalesce(replacement_payload ->> 'full_name', '')), ''),
    nullif(trim(coalesce(p_motive, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''),
    resolved_service_at,
    p_duration_hours,
    resolved_period_code,
    rule_data ->> 'calculation_basis',
    (rule_data ->> 'rate_rule_id')::uuid,
    (rule_data ->> 'rate_rule_amount')::numeric,
    (preview_payload ->> 'calculated_amount')::numeric,
    resolved_entry_lag_days,
    resolved_is_out_of_deadline,
    resolved_is_contract_mismatch,
    'P',
    current_user_id
  )
  returning hir.id, hir.folio into new_request_id, new_folio;

  insert into public.hr_incentive_request_approvals (
    incentive_request_id,
    step_code,
    step_name,
    step_order,
    approver_user_id,
    approver_name,
    approver_email,
    status,
    created_at,
    updated_at
  )
  values (
    new_request_id,
    'contract_admin',
    'Administrador de contrato',
    1,
    approver_context_row.contract_admin_user_id,
    approver_context_row.contract_admin_name,
    approver_context_row.contract_admin_email,
    'pending',
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.hr_incentive_request_history (
    incentive_request_id,
    action_type,
    actor_user_id,
    metadata
  )
  values (
    new_request_id,
    'created',
    current_user_id,
    jsonb_build_object(
      'selected_contract_code', trim(p_selected_contract_code),
      'selected_area_name', trim(p_selected_area_name),
      'selected_area_code', nullif(trim(coalesce(p_selected_area_code, '')), ''),
      'duration_hours', p_duration_hours,
      'employee_union_name', nullif(worker_data ->> 'union_name', ''),
      'employee_union_status', coalesce(worker_data ->> 'union_status', 'unknown'),
      'calculated_amount', (preview_payload ->> 'calculated_amount')::numeric,
      'period_code', resolved_period_code,
      'entry_lag_days', resolved_entry_lag_days,
      'is_out_of_deadline', resolved_is_out_of_deadline,
      'is_contract_mismatch', resolved_is_contract_mismatch,
      'roster_validation', preview_payload -> 'roster_validation'
    )
  );

  insert into public.hr_incentive_request_history (
    incentive_request_id,
    action_type,
    actor_user_id,
    metadata
  )
  values (
    new_request_id,
    'approval_created',
    current_user_id,
    jsonb_build_object(
      'step_code', 'contract_admin',
      'step_name', 'Administrador de contrato',
      'approver_user_id', approver_context_row.contract_admin_user_id,
      'approver_name', approver_context_row.contract_admin_name,
      'approver_email', approver_context_row.contract_admin_email,
      'status', 'pending',
      'period_code', resolved_period_code,
      'is_out_of_deadline', resolved_is_out_of_deadline,
      'is_contract_mismatch', resolved_is_contract_mismatch
    )
  );

  return query
  select
    new_request_id,
    new_folio,
    'P'::text,
    (preview_payload ->> 'calculated_amount')::numeric,
    resolved_period_code,
    resolved_entry_lag_days,
    resolved_is_out_of_deadline,
    resolved_is_contract_mismatch;
end;
$function$;

revoke all on function public.user_can_manage_hr_roster(uuid) from public, anon, authenticated;
revoke all on function public.get_hr_roster_exception_type_label(text) from public, anon, authenticated;
revoke all on function public.search_hr_roster_workers(text, integer) from public, anon, authenticated;
revoke all on function public.get_hr_roster_setup_catalogs() from public, anon, authenticated;
revoke all on function public.upsert_hr_shift_pattern(uuid, text, text, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.set_hr_shift_pattern_status(uuid, boolean) from public, anon, authenticated;
revoke all on function public.assign_hr_worker_roster(text, uuid, date, date, text) from public, anon, authenticated;
revoke all on function public.upsert_hr_roster_exception(uuid, text, date, text, text) from public, anon, authenticated;
revoke all on function public.set_hr_roster_exception_status(uuid, boolean) from public, anon, authenticated;
revoke all on function public.resolve_hr_roster_day_status(text, date) from public, anon, authenticated;
revoke all on function public.get_worker_schedule(text, date, date) from public, anon, authenticated;
revoke all on function public.set_hr_incentive_type_roster_requirement(uuid, boolean) from public, anon, authenticated;

grant execute on function public.user_can_manage_hr_roster(uuid) to authenticated;
grant execute on function public.get_hr_roster_exception_type_label(text) to authenticated;
grant execute on function public.search_hr_roster_workers(text, integer) to authenticated;
grant execute on function public.get_hr_roster_setup_catalogs() to authenticated;
grant execute on function public.upsert_hr_shift_pattern(uuid, text, text, integer, integer, text, text) to authenticated;
grant execute on function public.set_hr_shift_pattern_status(uuid, boolean) to authenticated;
grant execute on function public.assign_hr_worker_roster(text, uuid, date, date, text) to authenticated;
grant execute on function public.upsert_hr_roster_exception(uuid, text, date, text, text) to authenticated;
grant execute on function public.set_hr_roster_exception_status(uuid, boolean) to authenticated;
grant execute on function public.resolve_hr_roster_day_status(text, date) to authenticated;
grant execute on function public.get_worker_schedule(text, date, date) to authenticated;
grant execute on function public.set_hr_incentive_type_roster_requirement(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
