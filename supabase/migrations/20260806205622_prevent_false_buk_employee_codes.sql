begin;

create table if not exists private.buk_employee_code_reservations (
  id uuid primary key default gen_random_uuid(),
  recruitment_case_candidate_id uuid not null unique
    references public.recruitment_case_candidates(id) on delete cascade,
  identity_key text not null check (identity_key <> ''),
  sequence_number integer not null check (sequence_number > 0),
  employee_code text generated always as ('F' || sequence_number::text) stored,
  status text not null default 'reserved'
    check (status in ('reserved', 'confirmed', 'released')),
  buk_employee_id text null,
  source text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  confirmed_at timestamptz null,
  released_at timestamptz null,
  check (
    (status = 'confirmed' and buk_employee_id is not null and confirmed_at is not null)
    or status <> 'confirmed'
  )
);

create unique index if not exists uq_buk_employee_code_reservations_active_code
  on private.buk_employee_code_reservations(identity_key, sequence_number)
  where status <> 'released';

create index if not exists idx_buk_employee_code_reservations_identity
  on private.buk_employee_code_reservations(identity_key, status);

alter table private.buk_employee_code_reservations enable row level security;
revoke all on table private.buk_employee_code_reservations from public, anon, authenticated;

alter table public.candidate_worker_files
  drop constraint if exists candidate_worker_files_employee_code_format_check;

alter table public.candidate_worker_files
  add constraint candidate_worker_files_employee_code_format_check
  check (
    employee_code is null
    or trim(employee_code) ~ '^F[1-9][0-9]*$'
  );

create or replace function private.normalize_buk_employee_identity(
  p_document_number text
)
returns text
language sql
immutable
strict
set search_path = ''
as $function$
  select upper(regexp_replace(trim(p_document_number), '[^0-9A-Za-z]', '', 'g'));
$function$;

revoke all on function private.normalize_buk_employee_identity(text)
  from public, anon, authenticated, service_role;

create or replace function private.reserve_candidate_buk_employee_code(
  p_case_candidate_id uuid,
  p_source text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  normalized_identity text;
  reservation_row private.buk_employee_code_reservations%rowtype;
  max_buk_sequence integer := 0;
  max_reserved_sequence integer := 0;
  next_sequence integer := 1;
  now_utc timestamptz := pg_catalog.timezone('utc', pg_catalog.now());
begin
  select private.normalize_buk_employee_identity(cp.national_id)
    into normalized_identity
    from public.recruitment_case_candidates rcc
    join public.candidate_profiles cp
      on cp.id = rcc.candidate_profile_id
   where rcc.id = p_case_candidate_id;

  if coalesce(normalized_identity, '') = '' then
    raise exception 'El candidato no tiene un documento válido para reservar su código de ficha';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('buk-sheet:' || normalized_identity, 0)
  );

  select reservation.*
    into reservation_row
    from private.buk_employee_code_reservations reservation
   where reservation.recruitment_case_candidate_id = p_case_candidate_id
   for update;

  if reservation_row.id is not null and reservation_row.status <> 'released' then
    return pg_catalog.jsonb_build_object(
      'reservation_id', reservation_row.id,
      'employee_code', reservation_row.employee_code,
      'status', reservation_row.status,
      'buk_employee_id', reservation_row.buk_employee_id,
      'created_at', reservation_row.created_at
    );
  end if;

  select coalesce(
    max(substring(trim(e.raw_payload ->> 'code_sheet') from '^F([1-9][0-9]*)$')::integer),
    0
  )
    into max_buk_sequence
    from public.employees e
   where private.normalize_buk_employee_identity(
           coalesce(
             nullif(trim(e.document_number), ''),
             nullif(trim(e.raw_payload ->> 'document_number'), ''),
             nullif(trim(e.raw_payload ->> 'rut'), '')
           )
         ) = normalized_identity
     and nullif(trim(e.raw_payload ->> 'code_sheet'), '') ~ '^F[1-9][0-9]*$';

  select coalesce(max(reservation.sequence_number), 0)
    into max_reserved_sequence
    from private.buk_employee_code_reservations reservation
   where reservation.identity_key = normalized_identity
     and reservation.status <> 'released'
     and reservation.recruitment_case_candidate_id <> p_case_candidate_id;

  next_sequence := greatest(max_buk_sequence, max_reserved_sequence, 0) + 1;

  if reservation_row.id is null then
    insert into private.buk_employee_code_reservations (
      recruitment_case_candidate_id,
      identity_key,
      sequence_number,
      status,
      source,
      evidence,
      created_by
    )
    values (
      p_case_candidate_id,
      normalized_identity,
      next_sequence,
      'reserved',
      coalesce(nullif(trim(p_source), ''), 'unspecified'),
      pg_catalog.jsonb_build_object('reserved_at', now_utc),
      auth.uid()
    )
    returning * into reservation_row;
  else
    update private.buk_employee_code_reservations reservation
       set identity_key = normalized_identity,
           sequence_number = next_sequence,
           status = 'reserved',
           buk_employee_id = null,
           source = coalesce(nullif(trim(p_source), ''), 'unspecified'),
           evidence = coalesce(reservation.evidence, '{}'::jsonb)
             || pg_catalog.jsonb_build_object('rereserved_at', now_utc),
           updated_at = now_utc,
           confirmed_at = null,
           released_at = null
     where reservation.id = reservation_row.id
     returning * into reservation_row;
  end if;

  update public.candidate_worker_files worker_file
     set employee_code = reservation_row.employee_code,
         updated_at = now_utc
   where worker_file.recruitment_case_candidate_id = p_case_candidate_id
     and worker_file.employee_code is distinct from reservation_row.employee_code;

  return pg_catalog.jsonb_build_object(
    'reservation_id', reservation_row.id,
    'employee_code', reservation_row.employee_code,
    'status', reservation_row.status,
    'buk_employee_id', reservation_row.buk_employee_id,
    'created_at', reservation_row.created_at
  );
end;
$function$;

revoke all on function private.reserve_candidate_buk_employee_code(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.resolve_candidate_worker_employee_code(
  p_case_candidate_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  normalized_identity text;
  reserved_code text;
  max_buk_sequence integer := 0;
  max_reserved_sequence integer := 0;
begin
  select reservation.employee_code
    into reserved_code
    from private.buk_employee_code_reservations reservation
   where reservation.recruitment_case_candidate_id = p_case_candidate_id
     and reservation.status <> 'released';

  if reserved_code is not null then
    return reserved_code;
  end if;

  select private.normalize_buk_employee_identity(cp.national_id)
    into normalized_identity
    from public.recruitment_case_candidates rcc
    join public.candidate_profiles cp
      on cp.id = rcc.candidate_profile_id
   where rcc.id = p_case_candidate_id;

  if coalesce(normalized_identity, '') = '' then
    return 'F1';
  end if;

  select coalesce(
    max(substring(trim(e.raw_payload ->> 'code_sheet') from '^F([1-9][0-9]*)$')::integer),
    0
  )
    into max_buk_sequence
    from public.employees e
   where private.normalize_buk_employee_identity(
           coalesce(
             nullif(trim(e.document_number), ''),
             nullif(trim(e.raw_payload ->> 'document_number'), ''),
             nullif(trim(e.raw_payload ->> 'rut'), '')
           )
         ) = normalized_identity
     and nullif(trim(e.raw_payload ->> 'code_sheet'), '') ~ '^F[1-9][0-9]*$';

  select coalesce(max(reservation.sequence_number), 0)
    into max_reserved_sequence
    from private.buk_employee_code_reservations reservation
   where reservation.identity_key = normalized_identity
     and reservation.status <> 'released';

  return 'F' || (greatest(max_buk_sequence, max_reserved_sequence, 0) + 1)::text;
end;
$function$;

revoke all on function public.resolve_candidate_worker_employee_code(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.enforce_buk_employee_code_reservation_on_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  reservation jsonb;
  reserved_code text;
begin
  reservation := private.reserve_candidate_buk_employee_code(
    new.recruitment_case_candidate_id,
    'buk_sync_job_insert'
  );
  reserved_code := reservation ->> 'employee_code';

  new.payload_snapshot := pg_catalog.jsonb_set(
    coalesce(new.payload_snapshot, '{}'::jsonb),
    '{profile,reserved_employee_code}',
    pg_catalog.to_jsonb(reserved_code),
    true
  );
  new.payload_snapshot := pg_catalog.jsonb_set(
    new.payload_snapshot,
    '{profile,suggested_employee_code}',
    pg_catalog.to_jsonb(reserved_code),
    true
  );
  new.payload_snapshot := pg_catalog.jsonb_set(
    new.payload_snapshot,
    '{profile,worker_file,employee_code}',
    pg_catalog.to_jsonb(reserved_code),
    true
  );
  new.payload_snapshot := pg_catalog.jsonb_set(
    new.payload_snapshot,
    '{employee_code_reservation}',
    reservation,
    true
  );

  return new;
end;
$function$;

revoke all on function private.enforce_buk_employee_code_reservation_on_job()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_buk_sync_jobs_reserve_employee_code on public.buk_sync_jobs;
create trigger trg_buk_sync_jobs_reserve_employee_code
before insert on public.buk_sync_jobs
for each row
execute function private.enforce_buk_employee_code_reservation_on_job();

create or replace function public.reconcile_buk_employee_code_reservation(
  p_job_id uuid,
  p_observed_codes text[],
  p_matching_reserved_employee_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  job_row public.buk_sync_jobs%rowtype;
  reservation_row private.buk_employee_code_reservations%rowtype;
  reservation_snapshot jsonb;
  normalized_identity text;
  observed_max_sequence integer := 0;
  local_max_sequence integer := 0;
  other_reserved_max_sequence integer := 0;
  base_max_sequence integer := 0;
  next_sequence integer;
  now_utc timestamptz := pg_catalog.timezone('utc', pg_catalog.now());
begin
  select job.*
    into job_row
    from public.buk_sync_jobs job
   where job.id = p_job_id
   for update;

  if job_row.id is null or job_row.status not in ('pending', 'processing') then
    raise exception 'El job BUK no está disponible para reconciliar su código de ficha';
  end if;

  reservation_snapshot := private.reserve_candidate_buk_employee_code(
    job_row.recruitment_case_candidate_id,
    'buk_live_preflight'
  );

  select reservation.*
    into reservation_row
    from private.buk_employee_code_reservations reservation
   where reservation.recruitment_case_candidate_id = job_row.recruitment_case_candidate_id
   for update;

  normalized_identity := reservation_row.identity_key;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('buk-sheet:' || normalized_identity, 0)
  );

  select coalesce(max(substring(code_value from '^F([1-9][0-9]*)$')::integer), 0)
    into observed_max_sequence
    from (
      select upper(trim(observed_code)) as code_value
      from unnest(coalesce(p_observed_codes, '{}'::text[])) observed_code
    ) observed
   where observed.code_value ~ '^F[1-9][0-9]*$';

  select coalesce(
    max(substring(trim(e.raw_payload ->> 'code_sheet') from '^F([1-9][0-9]*)$')::integer),
    0
  )
    into local_max_sequence
    from public.employees e
   where private.normalize_buk_employee_identity(
           coalesce(
             nullif(trim(e.document_number), ''),
             nullif(trim(e.raw_payload ->> 'document_number'), ''),
             nullif(trim(e.raw_payload ->> 'rut'), '')
           )
         ) = normalized_identity
     and nullif(trim(e.raw_payload ->> 'code_sheet'), '') ~ '^F[1-9][0-9]*$';

  select coalesce(max(reservation.sequence_number), 0)
    into other_reserved_max_sequence
    from private.buk_employee_code_reservations reservation
   where reservation.identity_key = normalized_identity
     and reservation.status <> 'released'
     and reservation.recruitment_case_candidate_id <> job_row.recruitment_case_candidate_id;

  base_max_sequence := greatest(
    observed_max_sequence,
    local_max_sequence,
    other_reserved_max_sequence,
    0
  );

  if reservation_row.status = 'confirmed'
     and nullif(trim(coalesce(p_matching_reserved_employee_id, '')), '') is null then
    raise exception 'La reserva confirmada no fue encontrada en la consulta BUK viva';
  end if;

  if nullif(trim(coalesce(p_matching_reserved_employee_id, '')), '') is not null then
    if not exists (
      select 1
      from unnest(coalesce(p_observed_codes, '{}'::text[])) observed_code
      where upper(trim(observed_code)) = reservation_row.employee_code
    ) then
      raise exception 'La ficha BUK asociada al retry no coincide con el código reservado';
    end if;
  elsif reservation_row.sequence_number <= base_max_sequence then
    next_sequence := base_max_sequence + 1;

    update private.buk_employee_code_reservations reservation
       set sequence_number = next_sequence,
           source = 'buk_live_preflight',
           evidence = coalesce(reservation.evidence, '{}'::jsonb)
             || pg_catalog.jsonb_build_object(
               'reconciled_at', now_utc,
               'previous_employee_code', reservation_row.employee_code,
               'observed_codes', coalesce(p_observed_codes, '{}'::text[])
             ),
           updated_at = now_utc
     where reservation.id = reservation_row.id
     returning * into reservation_row;
  end if;

  update public.candidate_worker_files worker_file
     set employee_code = reservation_row.employee_code,
         updated_at = now_utc
   where worker_file.recruitment_case_candidate_id = job_row.recruitment_case_candidate_id
     and worker_file.employee_code is distinct from reservation_row.employee_code;

  job_row.payload_snapshot := pg_catalog.jsonb_set(
    coalesce(job_row.payload_snapshot, '{}'::jsonb),
    '{profile,reserved_employee_code}',
    pg_catalog.to_jsonb(reservation_row.employee_code),
    true
  );
  job_row.payload_snapshot := pg_catalog.jsonb_set(
    job_row.payload_snapshot,
    '{profile,suggested_employee_code}',
    pg_catalog.to_jsonb(reservation_row.employee_code),
    true
  );
  job_row.payload_snapshot := pg_catalog.jsonb_set(
    job_row.payload_snapshot,
    '{profile,worker_file,employee_code}',
    pg_catalog.to_jsonb(reservation_row.employee_code),
    true
  );

  reservation_snapshot := pg_catalog.jsonb_build_object(
    'reservation_id', reservation_row.id,
    'employee_code', reservation_row.employee_code,
    'status', reservation_row.status,
    'buk_employee_id', reservation_row.buk_employee_id,
    'created_at', reservation_row.created_at,
    'live_preflight_at', now_utc
  );
  job_row.payload_snapshot := pg_catalog.jsonb_set(
    job_row.payload_snapshot,
    '{employee_code_reservation}',
    reservation_snapshot,
    true
  );

  update public.buk_sync_jobs job
     set payload_snapshot = job_row.payload_snapshot,
         updated_at = now_utc
   where job.id = job_row.id;

  return reservation_snapshot;
end;
$function$;

revoke all on function public.reconcile_buk_employee_code_reservation(uuid, text[], text)
  from public, anon, authenticated;
grant execute on function public.reconcile_buk_employee_code_reservation(uuid, text[], text)
  to service_role;

create or replace function public.confirm_buk_employee_code_reservation(
  p_job_id uuid,
  p_buk_employee_id text,
  p_verified_employee_code text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  job_row public.buk_sync_jobs%rowtype;
  reservation_row private.buk_employee_code_reservations%rowtype;
  now_utc timestamptz := pg_catalog.timezone('utc', pg_catalog.now());
begin
  select job.*
    into job_row
    from public.buk_sync_jobs job
   where job.id = p_job_id
   for update;

  if job_row.id is null or job_row.status <> 'processing' then
    raise exception 'El job BUK no está en procesamiento para confirmar su código de ficha';
  end if;

  select reservation.*
    into reservation_row
    from private.buk_employee_code_reservations reservation
   where reservation.recruitment_case_candidate_id = job_row.recruitment_case_candidate_id
     and reservation.status <> 'released'
   for update;

  if reservation_row.id is null
     or reservation_row.employee_code <> trim(coalesce(p_verified_employee_code, ''))
     or nullif(trim(coalesce(p_buk_employee_id, '')), '') is null then
    raise exception 'BUK no confirmó exactamente el código de ficha reservado';
  end if;

  update private.buk_employee_code_reservations reservation
     set status = 'confirmed',
         buk_employee_id = trim(p_buk_employee_id),
         source = 'buk_get_verified',
         evidence = coalesce(reservation.evidence, '{}'::jsonb)
           || pg_catalog.jsonb_build_object(
             'verified_at', now_utc,
             'verified_employee_code', trim(p_verified_employee_code),
             'buk_employee_id', trim(p_buk_employee_id)
           ),
         updated_at = now_utc,
         confirmed_at = coalesce(reservation.confirmed_at, now_utc),
         released_at = null
   where reservation.id = reservation_row.id
   returning * into reservation_row;

  return pg_catalog.jsonb_build_object(
    'reservation_id', reservation_row.id,
    'employee_code', reservation_row.employee_code,
    'status', reservation_row.status,
    'buk_employee_id', reservation_row.buk_employee_id,
    'confirmed_at', reservation_row.confirmed_at
  );
end;
$function$;

revoke all on function public.confirm_buk_employee_code_reservation(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.confirm_buk_employee_code_reservation(uuid, text, text)
  to service_role;

create or replace function public.release_buk_employee_code_reservation(
  p_job_id uuid,
  p_reason text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  job_row public.buk_sync_jobs%rowtype;
  now_utc timestamptz := pg_catalog.timezone('utc', pg_catalog.now());
begin
  select job.*
    into job_row
    from public.buk_sync_jobs job
   where job.id = p_job_id
   for update;

  if job_row.id is null or job_row.status <> 'processing' then
    raise exception 'El job BUK no está en procesamiento para liberar su código de ficha';
  end if;

  update private.buk_employee_code_reservations reservation
     set status = 'released',
         source = 'buk_existing_active_duplicate',
         evidence = coalesce(reservation.evidence, '{}'::jsonb)
           || pg_catalog.jsonb_build_object(
             'released_at', now_utc,
             'reason', coalesce(nullif(trim(p_reason), ''), 'unspecified')
           ),
         updated_at = now_utc,
         released_at = now_utc
   where reservation.recruitment_case_candidate_id = job_row.recruitment_case_candidate_id
     and reservation.status = 'reserved';
end;
$function$;

revoke all on function public.release_buk_employee_code_reservation(uuid, text)
  from public, anon, authenticated;
grant execute on function public.release_buk_employee_code_reservation(uuid, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
