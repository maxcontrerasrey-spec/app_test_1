begin;

create table if not exists public.buk_employee_snapshot_contingency_audits (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  source_file_name text not null,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  reason text not null check (char_length(trim(reason)) >= 10),
  source_row_count integer not null check (source_row_count > 0),
  matched_row_count integer not null check (matched_row_count >= 0),
  ambiguous_row_count integer not null check (ambiguous_row_count >= 0),
  inserted_row_count integer not null default 0 check (inserted_row_count >= 0),
  mapping_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  created_by text not null default current_user,
  unique (source_sha256)
);

alter table public.buk_employee_snapshot_contingency_audits enable row level security;
revoke all on public.buk_employee_snapshot_contingency_audits from public, anon, authenticated;
grant select, insert on public.buk_employee_snapshot_contingency_audits to service_role;

alter table public.buk_employees_daily_snapshot
  add column if not exists capture_mode text not null default 'scheduled'
    check (capture_mode in ('scheduled', 'contingency'));

alter table public.buk_employees_daily_snapshot
  add column if not exists contingency_audit_id uuid
    references public.buk_employee_snapshot_contingency_audits(id);

alter table public.buk_employees_daily_snapshot
  drop constraint if exists buk_employee_snapshot_capture_mode_audit_check;

alter table public.buk_employees_daily_snapshot
  add constraint buk_employee_snapshot_capture_mode_audit_check
  check (
    (capture_mode = 'scheduled' and contingency_audit_id is null)
    or (capture_mode = 'contingency' and contingency_audit_id is not null)
  );

create index if not exists idx_buk_employee_snapshot_contingency_audit
  on public.buk_employees_daily_snapshot (contingency_audit_id)
  where contingency_audit_id is not null;

create or replace function public.import_buk_employee_contingency_snapshot(
  p_snapshot_date date,
  p_source_file_name text,
  p_source_sha256 text,
  p_reason text,
  p_rows jsonb,
  p_mapping_summary jsonb default '{}'::jsonb
)
returns table (
  audit_id uuid,
  inserted_rows integer,
  capture_mode text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  request_claims text := coalesce(current_setting('request.jwt.claims', true), '');
  normalized_file_name text := nullif(trim(coalesce(p_source_file_name, '')), '');
  normalized_sha256 text := lower(trim(coalesce(p_source_sha256, '')));
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
  existing_audit public.buk_employee_snapshot_contingency_audits%rowtype;
  new_audit_id uuid;
  expected_rows integer;
  inserted_count integer;
begin
  if request_claims <> '' and not public.current_request_has_service_role() then
    raise exception 'Solo el servicio interno puede importar snapshots BUK contingentes';
  end if;

  if p_snapshot_date is null
     or p_snapshot_date <> (date_trunc('month', p_snapshot_date)::date + interval '1 month - 1 day')::date then
    raise exception 'El snapshot contingente debe usar el cierre del mes';
  end if;

  if p_snapshot_date >= date_trunc('month', current_date)::date then
    raise exception 'Solo se pueden importar períodos BUK cerrados';
  end if;

  if normalized_file_name is null
     or normalized_sha256 !~ '^[a-f0-9]{64}$'
     or normalized_reason is null
     or char_length(normalized_reason) < 10
     or jsonb_typeof(coalesce(p_rows, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_rows) = 0 then
    raise exception 'El lote contingente requiere archivo, hash, motivo y filas válidas';
  end if;

  select * into existing_audit
  from public.buk_employee_snapshot_contingency_audits audit
  where audit.source_sha256 = normalized_sha256;

  if existing_audit.id is not null then
    return query select existing_audit.id, existing_audit.inserted_row_count, 'contingency'::text;
    return;
  end if;

  if exists (
    select 1
    from public.buk_employees_daily_snapshot snapshot
    where snapshot.snapshot_date = p_snapshot_date
  ) then
    raise exception 'Ya existe un snapshot para el cierre %; no se sobrescribe historia', p_snapshot_date;
  end if;

  expected_rows := jsonb_array_length(p_rows);

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as row_data(
      snapshot_date date,
      buk_employee_id text,
      full_name text,
      email text,
      job_title text,
      contract_code text,
      area_name text,
      area_code text,
      document_number text,
      document_type text,
      birth_date date,
      hire_date date,
      city_name text,
      region_name text,
      status text,
      is_active boolean
    )
    where row_data.snapshot_date is distinct from p_snapshot_date
       or nullif(trim(coalesce(row_data.buk_employee_id, '')), '') is null
       or nullif(trim(coalesce(row_data.full_name, '')), '') is null
       or nullif(trim(coalesce(row_data.document_number, '')), '') is null
       or nullif(trim(coalesce(row_data.job_title, '')), '') is null
       or nullif(trim(coalesce(row_data.area_name, '')), '') is null
       or nullif(trim(coalesce(row_data.document_type, '')), '') is null
       or nullif(trim(coalesce(row_data.status, '')), '') is null
       or row_data.is_active is null
  ) then
    raise exception 'El lote contingente contiene filas incompletas o con fecha distinta al cierre';
  end if;

  if (select count(*) from (
    select row_data.buk_employee_id
    from jsonb_to_recordset(p_rows) as row_data(buk_employee_id text)
    group by row_data.buk_employee_id
    having count(*) > 1
  ) duplicate_ids) > 0 then
    raise exception 'El lote contingente contiene buk_employee_id duplicados';
  end if;

  insert into public.buk_employee_snapshot_contingency_audits (
    snapshot_date,
    source_file_name,
    source_sha256,
    reason,
    source_row_count,
    matched_row_count,
    ambiguous_row_count,
    mapping_summary
  ) values (
    p_snapshot_date,
    normalized_file_name,
    normalized_sha256,
    normalized_reason,
    expected_rows,
    coalesce((p_mapping_summary ->> 'matched_unique')::integer, expected_rows),
    coalesce((p_mapping_summary ->> 'ambiguous')::integer, 0),
    coalesce(p_mapping_summary, '{}'::jsonb)
  ) returning id into new_audit_id;

  insert into public.buk_employees_daily_snapshot (
    snapshot_date,
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
    hire_date,
    city_name,
    region_name,
    status,
    is_active,
    capture_mode,
    contingency_audit_id
  )
  select
    row_data.snapshot_date,
    row_data.buk_employee_id,
    row_data.full_name,
    row_data.email,
    row_data.job_title,
    nullif(trim(row_data.contract_code), ''),
    row_data.area_name,
    nullif(trim(row_data.area_code), ''),
    row_data.document_number,
    row_data.document_type,
    row_data.birth_date,
    row_data.hire_date,
    nullif(trim(row_data.city_name), ''),
    nullif(trim(row_data.region_name), ''),
    row_data.status,
    row_data.is_active,
    'contingency',
    new_audit_id
  from jsonb_to_recordset(p_rows) as row_data(
    snapshot_date date,
    buk_employee_id text,
    full_name text,
    email text,
    job_title text,
    contract_code text,
    area_name text,
    area_code text,
    document_number text,
    document_type text,
    birth_date date,
    hire_date date,
    city_name text,
    region_name text,
    status text,
    is_active boolean
  );

  get diagnostics inserted_count = row_count;
  if inserted_count <> expected_rows then
    raise exception 'El snapshot contingente insertó % de % filas', inserted_count, expected_rows;
  end if;

  update public.buk_employee_snapshot_contingency_audits
  set inserted_row_count = inserted_count
  where id = new_audit_id;

  return query select new_audit_id, inserted_count, 'contingency'::text;
end;
$function$;

revoke all on function public.import_buk_employee_contingency_snapshot(date, text, text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.import_buk_employee_contingency_snapshot(date, text, text, text, jsonb, jsonb)
  to service_role;

notify pgrst, 'reload schema';

commit;
