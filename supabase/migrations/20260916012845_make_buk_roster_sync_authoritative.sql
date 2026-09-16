-- EEES-DB-005: approved
-- owner: Human Resources / Integrations
-- rollback: forward-only; disable the authoritative finalizer and restore prior roster resolvers in a subsequent audited migration while retaining sync audit history.
begin;

create table if not exists public.buk_employee_sync_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  expected_count integer check (expected_count is null or expected_count >= 0),
  seen_count integer check (seen_count is null or seen_count >= 0),
  active_count integer check (active_count is null or active_count >= 0),
  deactivated_count integer not null default 0 check (deactivated_count >= 0),
  invalidated_roster_count integer not null default 0 check (invalidated_roster_count >= 0),
  unmapped_area_count integer not null default 0 check (unmapped_area_count >= 0),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists uq_buk_employee_sync_runs_running
  on public.buk_employee_sync_runs (status)
  where status = 'running';

alter table public.buk_employee_sync_runs enable row level security;

drop policy if exists "buk_employee_sync_runs_roster_read" on public.buk_employee_sync_runs;
create policy "buk_employee_sync_runs_roster_read"
on public.buk_employee_sync_runs
for select
to authenticated
using (public.user_can_view_hr_roster((select auth.uid())));

revoke all on table public.buk_employee_sync_runs from public, anon, authenticated;
grant select on table public.buk_employee_sync_runs to authenticated;

alter table public.employees
  add column if not exists last_seen_buk_sync_id uuid references public.buk_employee_sync_runs (id) on delete set null,
  add column if not exists last_seen_buk_at timestamptz,
  add column if not exists buk_missing_from_source_at timestamptz;

create table if not exists public.buk_employee_sync_staging (
  sync_run_id uuid not null references public.buk_employee_sync_runs (id) on delete cascade,
  buk_employee_id text not null,
  full_name text not null,
  email text,
  job_title text,
  contract_code text,
  area_name text,
  area_code text,
  document_number text,
  document_type text,
  birth_date date,
  status text,
  is_active boolean not null,
  raw_payload jsonb not null default '{}'::jsonb,
  staged_at timestamptz not null default timezone('utc', now()),
  primary key (sync_run_id, buk_employee_id)
);

alter table public.buk_employee_sync_staging enable row level security;
revoke all on table public.buk_employee_sync_staging from public, anon, authenticated;
grant select, insert, update, delete on table public.buk_employee_sync_staging to service_role;

create index if not exists idx_employees_last_seen_buk_sync
  on public.employees (last_seen_buk_sync_id, buk_employee_id);

alter table public.hr_worker_rosters
  add column if not exists invalidated_at timestamptz,
  add column if not exists invalidated_effective_date date,
  add column if not exists invalidated_reason text,
  add column if not exists invalidated_sync_run_id uuid references public.buk_employee_sync_runs (id) on delete set null;

create index if not exists idx_hr_worker_rosters_current_valid
  on public.hr_worker_rosters (employee_buk_employee_id, start_date desc, end_date)
  where invalidated_at is null;

create table if not exists public.buk_employee_roster_sync_events (
  id bigint generated always as identity primary key,
  sync_run_id uuid references public.buk_employee_sync_runs (id) on delete set null,
  buk_employee_id text not null,
  change_type text not null
    check (change_type in ('created', 'profile_changed', 'activated', 'deactivated', 'contract_or_area_changed')),
  previous_state jsonb not null default '{}'::jsonb,
  current_state jsonb not null default '{}'::jsonb,
  invalidated_roster_count integer not null default 0 check (invalidated_roster_count >= 0),
  occurred_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_buk_employee_roster_sync_events_run
  on public.buk_employee_roster_sync_events (sync_run_id, occurred_at desc);

create index if not exists idx_buk_employee_roster_sync_events_worker
  on public.buk_employee_roster_sync_events (buk_employee_id, occurred_at desc);

alter table public.buk_employee_roster_sync_events enable row level security;
revoke all on table public.buk_employee_roster_sync_events from public, anon, authenticated;

create or replace function public.normalize_buk_contract_code(p_contract_code text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when lower(trim(coalesce(p_contract_code, ''))) ~ '^[0-9]+(\.0+|\.)$'
      then regexp_replace(lower(trim(coalesce(p_contract_code, ''))), '(\.0+|\.)$', '')
    else lower(trim(coalesce(p_contract_code, '')))
  end;
$$;

revoke all on function public.normalize_buk_contract_code(text) from public, anon;
grant execute on function public.normalize_buk_contract_code(text) to authenticated, service_role;

create or replace function public.hr_roster_assignment_matches_current_buk(
  p_assignment_contract_code text,
  p_assignment_area_name text,
  p_current_contract_code text,
  p_current_area_name text
)
returns boolean
language sql
immutable
parallel safe
as $$
  select public.normalize_buk_contract_code(p_assignment_contract_code)
           = public.normalize_buk_contract_code(p_current_contract_code)
     and public.normalize_buk_area_name(p_assignment_area_name)
           = public.normalize_buk_area_name(p_current_area_name);
$$;

revoke all on function public.hr_roster_assignment_matches_current_buk(text, text, text, text)
  from public, anon;
grant execute on function public.hr_roster_assignment_matches_current_buk(text, text, text, text)
  to authenticated, service_role;

create or replace function public.hr_roster_assignment_applies_on_buk_date(
  p_assignment_contract_code text,
  p_assignment_area_name text,
  p_invalidated_at timestamptz,
  p_invalidated_effective_date date,
  p_current_contract_code text,
  p_current_area_name text,
  p_target_date date
)
returns boolean
language sql
immutable
parallel safe
as $$
  select case
    when p_invalidated_at is not null then
      p_invalidated_effective_date is not null
      and p_target_date < p_invalidated_effective_date
    else public.hr_roster_assignment_matches_current_buk(
      p_assignment_contract_code,
      p_assignment_area_name,
      p_current_contract_code,
      p_current_area_name
    )
  end;
$$;

revoke all on function public.hr_roster_assignment_applies_on_buk_date(text, text, timestamptz, date, text, text, date)
  from public, anon;
grant execute on function public.hr_roster_assignment_applies_on_buk_date(text, text, timestamptz, date, text, text, date)
  to authenticated, service_role;

create or replace function public.reconcile_hr_roster_after_buk_employee_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  previous_state jsonb;
  current_state jsonb;
  resolved_change_type text;
  invalidated_count integer := 0;
  effective_date date := (timezone('America/Santiago', now()))::date;
  current_private_role boolean := coalesce(lower(trim(new.raw_payload ->> 'private_role')), 'false') in ('true', '1', 'yes', 'si', 'sí');
  event_sync_run_id uuid := coalesce(
    nullif(current_setting('app.buk_employee_sync_run_id', true), '')::uuid,
    new.last_seen_buk_sync_id
  );
begin
  previous_state := case when tg_op = 'INSERT' then '{}'::jsonb else jsonb_build_object(
    'is_active', old.is_active,
    'status', old.status,
    'contract_code', old.contract_code,
    'area_name', old.area_name,
    'job_title', old.job_title,
    'private_role', coalesce(lower(trim(old.raw_payload ->> 'private_role')), 'false')
  ) end;

  current_state := jsonb_build_object(
    'is_active', new.is_active,
    'status', new.status,
    'contract_code', new.contract_code,
    'area_name', new.area_name,
    'job_title', new.job_title,
    'private_role', coalesce(lower(trim(new.raw_payload ->> 'private_role')), 'false')
  );

  if tg_op = 'UPDATE' and previous_state = current_state then
    return new;
  end if;

  resolved_change_type := case
    when tg_op = 'INSERT' then 'created'
    when old.is_active is distinct from new.is_active and new.is_active is true then 'activated'
    when old.is_active is distinct from new.is_active and new.is_active is false then 'deactivated'
    when public.normalize_buk_contract_code(old.contract_code) is distinct from public.normalize_buk_contract_code(new.contract_code)
      or public.normalize_buk_area_name(old.area_name) is distinct from public.normalize_buk_area_name(new.area_name)
      then 'contract_or_area_changed'
    else 'profile_changed'
  end;

  update public.hr_worker_rosters wr
     set invalidated_at = timezone('utc', now()),
         invalidated_effective_date = effective_date,
         invalidated_reason = case
           when new.is_active is not true then 'buk_worker_inactive_or_missing'
           when current_private_role then 'buk_private_role_excluded'
           else 'buk_contract_or_area_changed'
         end,
         invalidated_sync_run_id = event_sync_run_id,
         updated_at = timezone('utc', now())
   where wr.employee_buk_employee_id = new.buk_employee_id
     and wr.invalidated_at is null
     and coalesce(wr.end_date, 'infinity'::date) >= effective_date
     and (
       new.is_active is not true
       or current_private_role
       or not public.hr_roster_assignment_matches_current_buk(
         wr.contract_code,
         wr.area_name,
         new.contract_code,
         new.area_name
       )
     );

  get diagnostics invalidated_count = row_count;

  insert into public.buk_employee_roster_sync_events (
    sync_run_id,
    buk_employee_id,
    change_type,
    previous_state,
    current_state,
    invalidated_roster_count
  ) values (
    event_sync_run_id,
    new.buk_employee_id,
    resolved_change_type,
    previous_state,
    current_state,
    invalidated_count
  );

  return new;
end;
$function$;

revoke all on function public.reconcile_hr_roster_after_buk_employee_change() from public, anon, authenticated;

drop trigger if exists trg_employees_reconcile_hr_roster on public.employees;
create trigger trg_employees_reconcile_hr_roster
after insert or update of full_name, job_title, contract_code, area_name, status, is_active, raw_payload
on public.employees
for each row
execute function public.reconcile_hr_roster_after_buk_employee_change();

create or replace function public.start_buk_employee_sync(p_metadata jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  result_id uuid;
begin
  delete from public.buk_employee_sync_staging s
  using public.buk_employee_sync_runs r
  where s.sync_run_id = r.id
    and r.status = 'running'
    and r.started_at < timezone('utc', now()) - interval '2 hours';

  update public.buk_employee_sync_runs
     set status = 'failed',
         completed_at = timezone('utc', now()),
         error_message = 'Corrida abandonada: superó dos horas sin finalizar.',
         updated_at = timezone('utc', now())
   where status = 'running'
     and started_at < timezone('utc', now()) - interval '2 hours';

  if exists (select 1 from public.buk_employee_sync_runs where status = 'running') then
    raise exception 'Ya existe una sincronización BUK de trabajadores en ejecución';
  end if;

  insert into public.buk_employee_sync_runs (metadata)
  values (coalesce(p_metadata, '{}'::jsonb))
  returning id into result_id;

  return result_id;
end;
$function$;

revoke all on function public.start_buk_employee_sync(jsonb) from public, anon, authenticated;
grant execute on function public.start_buk_employee_sync(jsonb) to service_role;

create or replace function public.fail_buk_employee_sync(
  p_sync_run_id uuid,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  delete from public.buk_employee_sync_staging
   where sync_run_id = p_sync_run_id;

  update public.buk_employee_sync_runs
     set status = 'failed',
         completed_at = timezone('utc', now()),
         error_message = left(coalesce(nullif(trim(p_error_message), ''), 'Error no especificado'), 1000),
         updated_at = timezone('utc', now())
   where id = p_sync_run_id
     and status = 'running';
end;
$function$;

revoke all on function public.fail_buk_employee_sync(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_buk_employee_sync(uuid, text) to service_role;

create or replace function public.finalize_buk_employee_sync(
  p_sync_run_id uuid,
  p_expected_count integer,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  run_row public.buk_employee_sync_runs%rowtype;
  seen_workers integer;
  active_workers integer;
  deactivated_workers integer := 0;
  invalidated_rosters integer := 0;
  unmapped_areas integer := 0;
  completed_at_value timestamptz := timezone('utc', now());
begin
  if p_expected_count is null or p_expected_count <= 0 then
    raise exception 'La sincronización BUK no puede finalizar con un universo vacío';
  end if;

  select *
    into run_row
  from public.buk_employee_sync_runs
  where id = p_sync_run_id
  for update;

  if run_row.id is null then
    raise exception 'La corrida BUK indicada no existe';
  end if;
  if run_row.status <> 'running' then
    raise exception 'La corrida BUK indicada ya está en estado %', run_row.status;
  end if;

  select count(*)::integer
    into seen_workers
  from public.buk_employee_sync_staging s
  where s.sync_run_id = p_sync_run_id;

  if seen_workers <> p_expected_count then
    raise exception 'La corrida BUK está incompleta: se esperaban % trabajadores y se persistieron %', p_expected_count, seen_workers;
  end if;

  perform set_config('app.buk_employee_sync_run_id', p_sync_run_id::text, true);

  insert into public.employees (
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
    last_seen_buk_sync_id,
    last_seen_buk_at,
    buk_missing_from_source_at,
    updated_at
  )
  select
    s.buk_employee_id,
    s.full_name,
    s.email,
    s.job_title,
    s.contract_code,
    s.area_name,
    s.area_code,
    s.document_number,
    s.document_type,
    s.birth_date,
    s.status,
    s.is_active,
    s.raw_payload,
    p_sync_run_id,
    completed_at_value,
    null,
    completed_at_value
  from public.buk_employee_sync_staging s
  where s.sync_run_id = p_sync_run_id
  on conflict (buk_employee_id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    job_title = excluded.job_title,
    contract_code = excluded.contract_code,
    area_name = excluded.area_name,
    area_code = excluded.area_code,
    document_number = excluded.document_number,
    document_type = excluded.document_type,
    birth_date = excluded.birth_date,
    status = excluded.status,
    is_active = excluded.is_active,
    raw_payload = excluded.raw_payload,
    last_seen_buk_sync_id = excluded.last_seen_buk_sync_id,
    last_seen_buk_at = excluded.last_seen_buk_at,
    buk_missing_from_source_at = null,
    updated_at = excluded.updated_at;

  update public.employees e
     set buk_missing_from_source_at = null
   where e.last_seen_buk_sync_id = p_sync_run_id
     and e.buk_missing_from_source_at is not null;

  update public.employees e
     set is_active = false,
         status = 'missing_from_buk',
         buk_missing_from_source_at = completed_at_value,
         updated_at = completed_at_value
   where e.last_seen_buk_sync_id is distinct from p_sync_run_id
     and e.is_active = true;

  get diagnostics deactivated_workers = row_count;

  select count(*)::integer
    into active_workers
  from public.employees e
  where e.last_seen_buk_sync_id = p_sync_run_id
    and e.is_active = true;

  select coalesce(sum(ev.invalidated_roster_count), 0)::integer
    into invalidated_rosters
  from public.buk_employee_roster_sync_events ev
  where ev.sync_run_id = p_sync_run_id;

  select count(distinct public.normalize_buk_area_name(e.area_name))::integer
    into unmapped_areas
  from public.employees e
  where e.last_seen_buk_sync_id = p_sync_run_id
    and e.is_active = true
    and coalesce(lower(trim(e.raw_payload ->> 'private_role')), 'false') not in ('true', '1', 'yes', 'si', 'sí')
    and not exists (
      select 1
      from public.buk_contract_mappings m
      join public.contracts c on c.id = m.contract_id and c.is_active = true
      where m.is_operational = true
        and m.buk_area_name_normalized = public.normalize_buk_area_name(e.area_name)
    );

  update public.buk_employee_sync_runs
     set status = 'completed',
         completed_at = completed_at_value,
         expected_count = p_expected_count,
         seen_count = seen_workers,
         active_count = active_workers,
         deactivated_count = deactivated_workers,
         invalidated_roster_count = invalidated_rosters,
         unmapped_area_count = unmapped_areas,
         metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
         error_message = null,
         updated_at = completed_at_value
   where id = p_sync_run_id;

  delete from public.buk_employee_sync_staging
   where sync_run_id = p_sync_run_id;

  return jsonb_build_object(
    'sync_run_id', p_sync_run_id,
    'status', 'completed',
    'seen_count', seen_workers,
    'active_count', active_workers,
    'deactivated_count', deactivated_workers,
    'invalidated_roster_count', invalidated_rosters,
    'unmapped_area_count', unmapped_areas,
    'completed_at', completed_at_value
  );
end;
$function$;

revoke all on function public.finalize_buk_employee_sync(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_buk_employee_sync(uuid, integer, jsonb) to service_role;

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
set search_path = public, pg_temp
as $function$
declare
  employee_row record;
  assignment_row record;
  exception_row record;
  cycle_index integer;
  resolved_base_status text;
  resolved_effective_status text;
begin
  select
    e.is_active,
    e.contract_code,
    e.area_name,
    coalesce(lower(trim(e.raw_payload ->> 'private_role')), 'false') as private_role,
    public.extract_buk_employee_exit_date(e.raw_payload) as exit_date
  into employee_row
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
    case
      when wr.invalidated_effective_date is null then wr.end_date
      else least(coalesce(wr.end_date, wr.invalidated_effective_date - 1), wr.invalidated_effective_date - 1)
    end as effective_end_date
  into assignment_row
  from public.hr_worker_rosters wr
  join public.hr_shift_patterns hp on hp.id = wr.pattern_id
  where wr.employee_buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
    and wr.start_date <= p_target_date
    and coalesce(wr.end_date, 'infinity'::date) >= p_target_date
    and public.hr_roster_assignment_applies_on_buk_date(
      wr.contract_code,
      wr.area_name,
      wr.invalidated_at,
      wr.invalidated_effective_date,
      employee_row.contract_code,
      employee_row.area_name,
      p_target_date
    )
  order by wr.start_date desc, wr.created_at desc
  limit 1;

  if assignment_row.assignment_id is null then
    return query select
      null::uuid, null::uuid, null::text, null::integer, null::integer, null::integer,
      null::date, null::date, null::integer, 'unassigned'::text,
      case when employee_row.exit_date is not null and p_target_date >= employee_row.exit_date then 'medical_leave' else 'unassigned' end,
      case when employee_row.exit_date is not null and p_target_date >= employee_row.exit_date then 'termination' else exception_row.exception_type end,
      case when employee_row.exit_date is not null and p_target_date >= employee_row.exit_date then 'Salida' else null end,
      case when employee_row.exit_date is not null and p_target_date >= employee_row.exit_date then format('Fecha de salida BUK: %s', to_char(employee_row.exit_date, 'DD/MM/YYYY')) else exception_row.notes end,
      false, false;
    return;
  end if;

  cycle_index := mod((p_target_date - assignment_row.start_date), assignment_row.cycle_length);
  resolved_base_status := case when cycle_index < assignment_row.working_days then 'working' else 'resting' end;

  if employee_row.exit_date is not null and p_target_date >= employee_row.exit_date then
    return query select
      assignment_row.assignment_id, assignment_row.pattern_id, assignment_row.pattern_name,
      assignment_row.working_days, assignment_row.resting_days, assignment_row.cycle_length,
      assignment_row.start_date, assignment_row.effective_end_date, cycle_index + 1,
      resolved_base_status, 'medical_leave'::text, 'termination'::text, 'Salida'::text,
      format('Fecha de salida BUK: %s', to_char(employee_row.exit_date, 'DD/MM/YYYY')), false, false;
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
    assignment_row.start_date, assignment_row.effective_end_date, cycle_index + 1,
    resolved_base_status, resolved_effective_status, exception_row.exception_type,
    case when exception_row.exception_type is null then null else public.get_hr_roster_exception_type_label(exception_row.exception_type) end,
    exception_row.notes, resolved_base_status = 'working', resolved_base_status = 'resting';
end;
$function$;

revoke all on function public.resolve_hr_roster_day_status(text, date) from public, anon;
grant execute on function public.resolve_hr_roster_day_status(text, date) to authenticated, service_role;

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
set search_path = public, pg_temp
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_row record;
  pattern_row record;
  result_id uuid;
begin
  if not public.user_can_manage_hr_roster_assignments(current_user_id) then raise exception 'Sin permisos para asignar pautas'; end if;
  if p_start_date is null then raise exception 'Debe indicar la fecha de inicio de la pauta'; end if;
  if p_end_date is not null and p_end_date < p_start_date then raise exception 'La fecha de término no puede ser menor a la fecha de inicio'; end if;

  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
    coalesce(nullif(trim(e.job_title), ''), nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''), nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''), nullif(trim(e.raw_payload ->> 'job_title'), '')) as job_title,
    nullif(trim(e.contract_code), '') as contract_code,
    nullif(trim(e.area_name), '') as area_name,
    coalesce(lower(trim(e.raw_payload ->> 'private_role')), 'false') as private_role
  into worker_row
  from public.employees_active_current e
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_row.buk_employee_id is null then raise exception 'Trabajador BUK no encontrado para asignar pauta'; end if;
  if worker_row.private_role in ('true', '1', 'yes', 'si', 'sí') then raise exception 'Los trabajadores con Rol privado no pertenecen al módulo de Jornadas'; end if;

  select hp.id, hp.is_active into pattern_row from public.hr_shift_patterns hp where hp.id = p_pattern_id;
  if pattern_row.id is null then raise exception 'La pauta seleccionada no existe'; end if;
  if pattern_row.is_active is not true then raise exception 'La pauta seleccionada está inactiva'; end if;

  update public.hr_worker_rosters
     set end_date = p_start_date - 1,
         updated_at = timezone('utc', now())
   where employee_buk_employee_id = worker_row.buk_employee_id
     and invalidated_at is null
     and start_date < p_start_date
     and coalesce(end_date, 'infinity'::date) >= p_start_date;

  if exists (
    select 1
    from public.hr_worker_rosters wr
    where wr.employee_buk_employee_id = worker_row.buk_employee_id
      and wr.invalidated_at is null
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
    assigned_by,
    invalidated_at,
    invalidated_effective_date,
    invalidated_reason,
    invalidated_sync_run_id
  ) values (
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
    current_user_id,
    null,
    null,
    null,
    null
  )
  on conflict (employee_buk_employee_id, start_date) do update set
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
    invalidated_at = null,
    invalidated_effective_date = null,
    invalidated_reason = null,
    invalidated_sync_run_id = null,
    updated_at = timezone('utc', now())
  returning id into result_id;

  return result_id;
end;
$function$;

revoke all on function public.assign_hr_worker_roster(text, uuid, date, date, text) from public, anon, authenticated;
grant execute on function public.assign_hr_worker_roster(text, uuid, date, date, text) to authenticated;

create or replace function public.get_worker_schedule(
  p_buk_employee_id text,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  current_user_id uuid := auth.uid();
  resolved_start date := coalesce(p_start_date, current_date);
  resolved_end date := coalesce(p_end_date, coalesce(p_start_date, current_date));
  projection_horizon_end date := (date_trunc('month', current_date)::date + interval '7 months' - interval '1 day')::date;
  worker_row record;
begin
  if not public.user_can_view_hr_roster(current_user_id) then raise exception 'Sin permisos para consultar jornadas'; end if;
  if resolved_end < resolved_start then raise exception 'El rango solicitado no es válido'; end if;
  if resolved_start > projection_horizon_end or resolved_end > projection_horizon_end then raise exception 'La proyección de jornadas solo permite consultar hasta el cierre de los próximos 6 meses'; end if;

  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
    coalesce(nullif(trim(e.job_title), ''), nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''), nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''), nullif(trim(e.raw_payload ->> 'job_title'), '')) as job_title,
    nullif(trim(e.contract_code), '') as contract_code,
    nullif(trim(e.area_name), '') as area_name,
    public.extract_buk_employee_exit_date(e.raw_payload) as exit_date
  into worker_row
  from public.employees_active_current e
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
    and coalesce(lower(trim(e.raw_payload ->> 'private_role')), 'false') not in ('true', '1', 'yes', 'si', 'sí')
  limit 1;

  if worker_row.buk_employee_id is null then raise exception 'Trabajador BUK no encontrado o sin ficha activa'; end if;

  return jsonb_build_object(
    'worker', jsonb_build_object(
      'buk_employee_id', worker_row.buk_employee_id,
      'full_name', worker_row.full_name,
      'document_number', worker_row.document_number,
      'document_type', worker_row.document_type,
      'job_title', worker_row.job_title,
      'contract_code', worker_row.contract_code,
      'area_name', worker_row.area_name,
      'exit_date', worker_row.exit_date
    ),
    'range', jsonb_build_object('start_date', resolved_start, 'end_date', resolved_end),
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
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', wr.id,
        'pattern_id', hp.id,
        'pattern_name', hp.name,
        'pattern_code', hp.code,
        'working_days', hp.working_days,
        'resting_days', hp.resting_days,
        'cycle_length', hp.cycle_length,
        'start_date', wr.start_date,
        'end_date', case
          when wr.invalidated_effective_date is null then wr.end_date
          else least(coalesce(wr.end_date, wr.invalidated_effective_date - 1), wr.invalidated_effective_date - 1)
        end,
        'notes', wr.notes,
        'contract_code', wr.contract_code,
        'area_name', wr.area_name,
        'created_at', wr.created_at
      ) order by wr.start_date desc)
      from public.hr_worker_rosters wr
      join public.hr_shift_patterns hp on hp.id = wr.pattern_id
      where wr.employee_buk_employee_id = worker_row.buk_employee_id
        and wr.start_date <= resolved_end
        and coalesce(wr.end_date, 'infinity'::date) >= resolved_start
        and public.hr_roster_assignment_applies_on_buk_date(
          wr.contract_code,
          wr.area_name,
          wr.invalidated_at,
          wr.invalidated_effective_date,
          worker_row.contract_code,
          worker_row.area_name,
          greatest(wr.start_date, resolved_start)
        )
    ), '[]'::jsonb),
    'exceptions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', hre.id,
        'exception_date', hre.exception_date,
        'exception_type', hre.exception_type,
        'exception_label', public.get_hr_roster_exception_type_label(hre.exception_type),
        'exception_source', hre.exception_source,
        'notes', hre.notes,
        'is_active', hre.is_active,
        'created_at', hre.created_at
      ) order by hre.exception_date asc)
      from public.hr_roster_exceptions hre
      where hre.employee_buk_employee_id = worker_row.buk_employee_id
        and hre.is_active = true
        and hre.exception_date between resolved_start and resolved_end
    ), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', gs.day_date::date,
        'assignment_id', rs.assignment_id,
        'pattern_id', rs.pattern_id,
        'pattern_name', rs.pattern_name,
        'cycle_day', rs.cycle_day,
        'base_status', rs.base_status,
        'effective_status', rs.effective_status,
        'exception_type', rs.exception_type,
        'exception_label', rs.exception_label,
        'exception_source', hre.exception_source,
        'exception_notes', rs.exception_notes,
        'is_working_day', rs.is_working_day,
        'is_rest_day', rs.is_rest_day
      ) order by gs.day_date asc)
      from generate_series(resolved_start, resolved_end, interval '1 day') as gs(day_date)
      cross join lateral public.resolve_hr_roster_day_status(worker_row.buk_employee_id, gs.day_date::date) rs
      left join lateral (
        select hx.exception_source
        from public.hr_roster_exceptions hx
        where hx.employee_buk_employee_id = worker_row.buk_employee_id
          and hx.exception_date = gs.day_date::date
          and hx.is_active = true
        limit 1
      ) hre on true
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_worker_schedule(text, date, date) from public, anon, authenticated;
grant execute on function public.get_worker_schedule(text, date, date) to authenticated;

create or replace function public.get_hr_roster_bulk_calendar(
  p_start_date date default current_date,
  p_end_date date default current_date,
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
  range_start date := coalesce(p_start_date, current_date);
  range_end date := coalesce(p_end_date, range_start);
  projection_horizon_end date := (date_trunc('month', current_date)::date + interval '7 months' - interval '1 day')::date;
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_contract text := lower(trim(coalesce(p_contract_filter, '')));
  normalized_area text := lower(trim(coalesce(p_area_filter, '')));
begin
  if not public.user_can_view_hr_roster(current_user_id) then raise exception 'Sin permisos para consultar jornadas'; end if;
  if range_end < range_start then raise exception 'El periodo de jornadas no puede terminar antes de comenzar'; end if;
  if range_end > projection_horizon_end then raise exception 'La proyección de jornadas solo permite consultar hasta el cierre de los próximos 6 meses'; end if;
  if range_end - range_start > 184 then raise exception 'El periodo de jornadas no puede superar 6 meses'; end if;

  return jsonb_build_object(
    'range', jsonb_build_object('start_date', range_start, 'end_date', range_end),
    'workers', coalesce((
      with active_workers as (
        select distinct on (e.buk_employee_id)
          e.buk_employee_id,
          e.full_name,
          coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
          coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
          coalesce(nullif(trim(e.job_title), ''), nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''), nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''), nullif(trim(e.raw_payload ->> 'job_title'), '')) as job_title,
          nullif(trim(e.contract_code), '') as contract_code,
          nullif(trim(e.area_name), '') as area_name,
          public.extract_buk_employee_exit_date(e.raw_payload) as exit_date,
          public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key
        from public.employees e
        where (e.is_active = true or public.extract_buk_employee_exit_date(e.raw_payload) >= range_start)
          and coalesce(lower(trim(e.raw_payload ->> 'private_role')), 'false') not in ('true', '1', 'yes', 'si', 'sí')
        order by e.buk_employee_id, e.is_active desc, e.updated_at desc nulls last, e.created_at desc nulls last
      ), filtered_workers as (
        select aw.*
        from active_workers aw
        where (normalized_search = '' or lower(concat_ws(' ', aw.name_search_key, aw.full_name, aw.document_number, aw.job_title, aw.contract_code, aw.area_name)) like '%' || normalized_search || '%')
          and (normalized_contract = '' or public.normalize_buk_contract_code(aw.contract_code) like '%' || public.normalize_buk_contract_code(normalized_contract) || '%')
          and (normalized_area = '' or public.normalize_buk_area_name(coalesce(aw.area_name, aw.contract_code, '')) = public.normalize_buk_area_name(normalized_area))
      ), worker_days as (
        select
          fw.buk_employee_id, fw.full_name, fw.document_number, fw.document_type, fw.job_title,
          fw.contract_code, fw.area_name, fw.exit_date, gs.day_date::date as day_date,
          assignment.assignment_id, assignment.pattern_id, assignment.pattern_name,
          assignment.working_days, assignment.resting_days, assignment.cycle_length,
          assignment.assignment_start_date, assignment.assignment_end_date,
          case when assignment.assignment_id is null then null else mod((gs.day_date::date - assignment.assignment_start_date), assignment.cycle_length) + 1 end as cycle_day,
          case when assignment.assignment_id is null then 'unassigned' when mod((gs.day_date::date - assignment.assignment_start_date), assignment.cycle_length) < assignment.working_days then 'working' else 'resting' end as base_status,
          case when fw.exit_date is not null and gs.day_date::date >= fw.exit_date then 'termination' when exception.exception_type is null and assignment.assignment_id is null then null when exception.exception_type = 'extra_shift' then 'extra_shift' when exception.exception_type = 'training' then 'training' else exception.exception_type end as exception_type,
          case when fw.exit_date is not null and gs.day_date::date >= fw.exit_date then 'Salida' when exception.exception_type is null then null else public.get_hr_roster_exception_type_label(exception.exception_type) end as exception_label,
          case when fw.exit_date is not null and gs.day_date::date >= fw.exit_date then format('Fecha de salida BUK: %s', to_char(fw.exit_date, 'DD/MM/YYYY')) else exception.notes end as exception_notes,
          case when fw.exit_date is not null and gs.day_date::date >= fw.exit_date then false else assignment.assignment_id is not null and mod((gs.day_date::date - assignment.assignment_start_date), assignment.cycle_length) < assignment.working_days end as is_working_day,
          case when fw.exit_date is not null and gs.day_date::date >= fw.exit_date then false else assignment.assignment_id is not null and mod((gs.day_date::date - assignment.assignment_start_date), assignment.cycle_length) >= assignment.working_days end as is_rest_day
        from filtered_workers fw
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
          where wr.employee_buk_employee_id = fw.buk_employee_id
            and wr.start_date <= gs.day_date::date
            and coalesce(wr.end_date, 'infinity'::date) >= gs.day_date::date
            and public.hr_roster_assignment_applies_on_buk_date(
              wr.contract_code,
              wr.area_name,
              wr.invalidated_at,
              wr.invalidated_effective_date,
              fw.contract_code,
              fw.area_name,
              gs.day_date::date
            )
          order by wr.start_date desc, wr.created_at desc
          limit 1
        ) assignment on true
        left join lateral (
          select hre.exception_type, hre.notes
          from public.hr_roster_exceptions hre
          where hre.employee_buk_employee_id = fw.buk_employee_id
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
      select jsonb_agg(wp.payload order by wp.full_name) from worker_payloads wp
    ), '[]'::jsonb)
  );
end;
$function$;

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
  if not public.user_can_view_hr_roster(current_user_id) then raise exception 'Sin permisos para consultar el resumen de jornadas'; end if;

  return (
    with active_workers as (
      select distinct on (e.buk_employee_id)
        e.buk_employee_id,
        nullif(trim(e.contract_code), '') as contract_code,
        nullif(trim(e.area_name), '') as area_name,
        public.extract_buk_employee_exit_date(e.raw_payload) as exit_date,
        public.build_active_employee_search_text(e.full_name, e.document_number, e.job_title, e.contract_code, coalesce(e.area_name, e.contract_code), e.raw_payload) as search_text
      from public.employees e
      where (e.is_active = true or public.extract_buk_employee_exit_date(e.raw_payload) >= month_start)
        and coalesce(lower(trim(e.raw_payload ->> 'private_role')), 'false') not in ('true', '1', 'yes', 'si', 'sí')
      order by e.buk_employee_id, e.is_active desc, e.updated_at desc nulls last, e.created_at desc nulls last
    ), filtered_workers as (
      select aw.*
      from active_workers aw
      where (normalized_search = '' or aw.search_text like '%' || normalized_search || '%')
        and (normalized_contract = '' or public.normalize_buk_contract_code(aw.contract_code) like '%' || public.normalize_buk_contract_code(normalized_contract) || '%')
        and (normalized_area = '' or public.normalize_buk_area_name(coalesce(aw.area_name, aw.contract_code, '')) = public.normalize_buk_area_name(normalized_area))
    ), assigned_workers as (
      select distinct fw.buk_employee_id
      from filtered_workers fw
      join public.hr_worker_rosters wr
        on wr.employee_buk_employee_id = fw.buk_employee_id
      where wr.start_date <= month_end
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
    )
    select jsonb_build_object(
      'month_start', month_start,
      'month_end', month_end,
      'assigned_count', (select count(*) from assigned_workers),
      'pending_count', (select count(*) from filtered_workers fw where not exists (select 1 from assigned_workers aw where aw.buk_employee_id = fw.buk_employee_id)),
      'total_count', (select count(*) from filtered_workers)
    )
  );
end;
$function$;

revoke all on function public.get_hr_roster_bulk_calendar(date, date, text, text, text) from public, anon, authenticated;
grant execute on function public.get_hr_roster_bulk_calendar(date, date, text, text, text) to authenticated;
revoke all on function public.get_hr_roster_calendar_summary(date, text, text, text) from public, anon, authenticated;
grant execute on function public.get_hr_roster_calendar_summary(date, text, text, text) to authenticated;

-- Existing incompatible assignments are preserved but become operational only before this migration date.
update public.hr_worker_rosters wr
   set invalidated_at = timezone('utc', now()),
       invalidated_effective_date = (timezone('America/Santiago', now()))::date,
       invalidated_reason = case
         when e.is_active is not true then 'buk_worker_inactive_or_missing'
         when coalesce(lower(trim(e.raw_payload ->> 'private_role')), 'false') in ('true', '1', 'yes', 'si', 'sí') then 'buk_private_role_excluded'
         else 'buk_contract_or_area_changed'
       end,
       updated_at = timezone('utc', now())
  from public.employees e
 where e.buk_employee_id = wr.employee_buk_employee_id
   and wr.invalidated_at is null
   and coalesce(wr.end_date, 'infinity'::date) >= (timezone('America/Santiago', now()))::date
   and (
     e.is_active is not true
     or coalesce(lower(trim(e.raw_payload ->> 'private_role')), 'false') in ('true', '1', 'yes', 'si', 'sí')
     or not public.hr_roster_assignment_matches_current_buk(wr.contract_code, wr.area_name, e.contract_code, e.area_name)
   );

do $do$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'buk_employee_sync_runs'
     ) then
    alter publication supabase_realtime add table public.buk_employee_sync_runs;
  end if;
end;
$do$;

notify pgrst, 'reload schema';
commit;
