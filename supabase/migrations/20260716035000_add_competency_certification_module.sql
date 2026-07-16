begin;

insert into public.app_modules (code, name, route, description, sort_order, is_active)
values
  ('certificados', 'Competencias de Conductores', '/certificados', 'Emision trazable de certificados de competencias de conductores.', 59, true),
  ('seguimiento_certificados', 'Seguimiento de Competencias', '/seguimiento-certificados', 'Seguimiento de certificados de competencias emitidos.', 60, true)
on conflict (code) do update
set name = excluded.name,
    route = excluded.route,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = timezone('utc', now());

insert into public.app_roles (code, name, description, is_active)
values
  ('certificaciones', 'Certificaciones', 'Gestion documental y certificacion de competencias.', true),
  ('instructor', 'Instructor', 'Operacion de certificacion de competencias de conductores.', true)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true,
    updated_at = timezone('utc', now());

with desired_access(role_code, module_code) as (
  values
    ('admin', 'certificados'),
    ('admin', 'seguimiento_certificados'),
    ('certificaciones', 'certificados'),
    ('certificaciones', 'seguimiento_certificados'),
    ('instructor', 'certificados'),
    ('instructor', 'seguimiento_certificados')
)
insert into public.role_module_access (role_code, module_code, can_view)
select da.role_code, da.module_code, true
from desired_access da
join public.app_roles ar on ar.code = da.role_code and ar.is_active = true
join public.app_modules am on am.code = da.module_code and am.is_active = true
on conflict (role_code, module_code) do update
set can_view = true;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'competency_documents',
  'competency_documents',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create sequence if not exists public.competency_certificate_folio_seq;

create table if not exists public.competency_equipment_brands (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint competency_equipment_brands_code_format check (code = lower(code))
);

create table if not exists public.competency_equipment_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint competency_equipment_types_code_format check (code = lower(code))
);

create table if not exists public.competency_equipment_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.competency_equipment_brands(id) on delete restrict,
  type_id uuid not null references public.competency_equipment_types(id) on delete restrict,
  code text not null unique,
  name text not null,
  legacy_code text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint competency_equipment_models_code_format check (code = lower(code))
);

create table if not exists public.competency_instructors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  buk_employee_id text,
  full_name text not null,
  document_number text not null,
  profile_code text not null,
  signature_label text,
  signature_bucket text,
  signature_path text,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended', 'expired')),
  valid_from date not null default current_date,
  valid_until date,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (document_number)
);

create table if not exists public.competency_requests (
  id uuid primary key default gen_random_uuid(),
  request_status text not null default 'submitted'
    check (request_status in ('draft', 'pending_evaluation', 'ready_for_submission', 'submitted', 'processing', 'completed', 'rejected', 'cancelled')),
  worker_buk_employee_id text not null,
  worker_document_number text not null,
  worker_document_type text not null default 'rut',
  worker_full_name text not null,
  worker_job_title text,
  worker_area_name text,
  worker_contract_code text,
  instructor_id uuid not null references public.competency_instructors(id) on delete restrict,
  training_date date not null,
  training_start_time time,
  training_end_time time,
  training_location text,
  training_modality text not null default 'teorico-practica',
  training_type text not null default 'teorico-practica',
  notes text,
  model_summary text not null,
  catalog_version text not null default 'legacy-csv-rev01',
  submitted_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.competency_request_models (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.competency_requests(id) on delete cascade,
  model_id uuid not null references public.competency_equipment_models(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (request_id, model_id)
);

create table if not exists public.competency_evaluations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.competency_requests(id) on delete cascade,
  attempt_number integer not null default 1 check (attempt_number > 0),
  theoretical_score numeric(5,2) not null check (theoretical_score >= 0 and theoretical_score <= 100),
  practical_score numeric(5,2) not null check (practical_score >= 0 and practical_score <= 100),
  final_score numeric(5,2) not null check (final_score >= 0 and final_score <= 100),
  evaluation_status text not null check (evaluation_status in ('pending', 'failed', 'approved', 'annulled')),
  file_bucket text not null default 'competency_documents',
  file_path text not null,
  file_original_name text not null,
  file_mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  file_sha256 text not null,
  declaration_accepted boolean not null default false,
  evaluated_at timestamptz not null default timezone('utc', now()),
  approved_at timestamptz,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (request_id, attempt_number),
  constraint competency_evaluations_hash_format check (file_sha256 ~ '^[a-f0-9]{64}$')
);

create table if not exists public.competency_certificates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.competency_requests(id) on delete restrict,
  folio text not null unique default (
    'COMP-' || to_char(timezone('America/Santiago', now()), 'YYYY') || '-' ||
    lpad(nextval('public.competency_certificate_folio_seq')::text, 6, '0')
  ),
  verification_token uuid not null unique default gen_random_uuid(),
  template_code text not null default 'F-OPE-068',
  template_version text not null default '00',
  template_source text not null default 'certificado_tipo_rev02.docx',
  issued_at timestamptz,
  valid_from date,
  valid_until date,
  certificate_status text not null default 'not_generated'
    check (certificate_status in ('not_generated', 'queued', 'generating', 'generated', 'generation_failed', 'uploaded_to_buk', 'buk_upload_failed', 'revoked', 'expired', 'replaced', 'annulled')),
  competency_status text not null default 'pending'
    check (competency_status in ('pending', 'enabled', 'suspended', 'revoked', 'expired')),
  pdf_bucket text not null default 'competency_documents',
  pdf_path text,
  pdf_file_name text,
  pdf_sha256 text,
  pdf_size_bytes bigint,
  buk_upload_status text not null default 'pending'
    check (buk_upload_status in ('pending', 'queued', 'success', 'failed', 'skipped')),
  buk_folder_name text not null default 'Competencias',
  buk_folder_id text,
  buk_document_id text,
  buk_document_url text,
  buk_uploaded_at timestamptz,
  buk_attempt_count integer not null default 0,
  buk_last_error text,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  revocation_reason text,
  replaced_by_certificate_id uuid references public.competency_certificates(id) on delete set null,
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint competency_certificates_pdf_hash_format check (pdf_sha256 is null or pdf_sha256 ~ '^[a-f0-9]{64}$')
);

create table if not exists public.competency_audit_log (
  id bigint generated by default as identity primary key,
  request_id uuid references public.competency_requests(id) on delete cascade,
  certificate_id uuid references public.competency_certificates(id) on delete cascade,
  event_type text not null,
  event_summary text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_competency_requests_worker
  on public.competency_requests(worker_buk_employee_id, created_at desc);
create index if not exists idx_competency_requests_instructor
  on public.competency_requests(instructor_id, request_status, created_at desc);
create index if not exists idx_competency_certificates_status
  on public.competency_certificates(certificate_status, buk_upload_status, valid_until);
create index if not exists idx_competency_audit_log_request
  on public.competency_audit_log(request_id, created_at desc);
create index if not exists idx_competency_models_brand_type
  on public.competency_equipment_models(brand_id, type_id, is_active, name);

drop trigger if exists trg_competency_equipment_brands_set_updated_at on public.competency_equipment_brands;
create trigger trg_competency_equipment_brands_set_updated_at
before update on public.competency_equipment_brands
for each row execute function public.set_updated_at();

drop trigger if exists trg_competency_equipment_types_set_updated_at on public.competency_equipment_types;
create trigger trg_competency_equipment_types_set_updated_at
before update on public.competency_equipment_types
for each row execute function public.set_updated_at();

drop trigger if exists trg_competency_equipment_models_set_updated_at on public.competency_equipment_models;
create trigger trg_competency_equipment_models_set_updated_at
before update on public.competency_equipment_models
for each row execute function public.set_updated_at();

drop trigger if exists trg_competency_instructors_set_updated_at on public.competency_instructors;
create trigger trg_competency_instructors_set_updated_at
before update on public.competency_instructors
for each row execute function public.set_updated_at();

drop trigger if exists trg_competency_requests_set_updated_at on public.competency_requests;
create trigger trg_competency_requests_set_updated_at
before update on public.competency_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_competency_certificates_set_updated_at on public.competency_certificates;
create trigger trg_competency_certificates_set_updated_at
before update on public.competency_certificates
for each row execute function public.set_updated_at();

alter table public.competency_equipment_brands enable row level security;
alter table public.competency_equipment_types enable row level security;
alter table public.competency_equipment_models enable row level security;
alter table public.competency_instructors enable row level security;
alter table public.competency_requests enable row level security;
alter table public.competency_request_models enable row level security;
alter table public.competency_evaluations enable row level security;
alter table public.competency_certificates enable row level security;
alter table public.competency_audit_log enable row level security;

create or replace function public.user_can_access_competencies(requested_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if requested_user_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> requested_user_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return public.user_is_admin(requested_user_id)
      or public.user_can_access_module(requested_user_id, 'certificados')
      or public.user_can_access_module(requested_user_id, 'seguimiento_certificados')
      or public.user_has_role(requested_user_id, 'certificaciones')
      or public.user_has_role(requested_user_id, 'instructor');
end;
$function$;

create or replace function public.user_can_admin_competencies(requested_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if requested_user_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> requested_user_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return public.user_is_admin(requested_user_id)
      or public.user_has_role(requested_user_id, 'certificaciones');
end;
$function$;

create or replace function public.user_can_manage_competency_request(requested_request_id uuid, requested_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if requested_request_id is null or requested_user_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> requested_user_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  if public.user_can_admin_competencies(requested_user_id) then
    return true;
  end if;

  return exists (
    select 1
    from public.competency_requests cr
    join public.competency_instructors ci on ci.id = cr.instructor_id
    where cr.id = requested_request_id
      and (cr.created_by = requested_user_id or ci.user_id = requested_user_id)
  );
end;
$function$;

create or replace function public.log_competency_event(
  request_id_input uuid,
  certificate_id_input uuid,
  event_type_input text,
  event_summary_input text,
  payload_input jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  created_log_id bigint;
begin
  insert into public.competency_audit_log (
    request_id,
    certificate_id,
    event_type,
    event_summary,
    payload,
    actor_id
  )
  values (
    request_id_input,
    certificate_id_input,
    trim(coalesce(event_type_input, 'event')),
    trim(coalesce(event_summary_input, 'Evento de certificacion de competencias')),
    coalesce(payload_input, '{}'::jsonb),
    current_user_id
  )
  returning id into created_log_id;

  return created_log_id;
end;
$function$;

drop policy if exists "competency_catalogs_select_authorized" on public.competency_equipment_brands;
create policy "competency_catalogs_select_authorized"
on public.competency_equipment_brands for select
to authenticated
using (public.user_can_access_competencies((select auth.uid())));

drop policy if exists "competency_types_select_authorized" on public.competency_equipment_types;
create policy "competency_types_select_authorized"
on public.competency_equipment_types for select
to authenticated
using (public.user_can_access_competencies((select auth.uid())));

drop policy if exists "competency_models_select_authorized" on public.competency_equipment_models;
create policy "competency_models_select_authorized"
on public.competency_equipment_models for select
to authenticated
using (public.user_can_access_competencies((select auth.uid())));

drop policy if exists "competency_instructors_select_authorized" on public.competency_instructors;
create policy "competency_instructors_select_authorized"
on public.competency_instructors for select
to authenticated
using (
  public.user_can_admin_competencies((select auth.uid()))
  or user_id = (select auth.uid())
  or public.user_has_role((select auth.uid()), 'instructor')
);

drop policy if exists "competency_requests_select_scoped" on public.competency_requests;
create policy "competency_requests_select_scoped"
on public.competency_requests for select
to authenticated
using (public.user_can_manage_competency_request(id, (select auth.uid())));

drop policy if exists "competency_request_models_select_scoped" on public.competency_request_models;
create policy "competency_request_models_select_scoped"
on public.competency_request_models for select
to authenticated
using (
  exists (
    select 1 from public.competency_requests cr
    where cr.id = competency_request_models.request_id
      and public.user_can_manage_competency_request(cr.id, (select auth.uid()))
  )
);

drop policy if exists "competency_evaluations_select_scoped" on public.competency_evaluations;
create policy "competency_evaluations_select_scoped"
on public.competency_evaluations for select
to authenticated
using (public.user_can_manage_competency_request(request_id, (select auth.uid())));

drop policy if exists "competency_certificates_select_scoped" on public.competency_certificates;
create policy "competency_certificates_select_scoped"
on public.competency_certificates for select
to authenticated
using (public.user_can_manage_competency_request(request_id, (select auth.uid())));

drop policy if exists "competency_audit_log_select_scoped" on public.competency_audit_log;
create policy "competency_audit_log_select_scoped"
on public.competency_audit_log for select
to authenticated
using (
  public.user_can_admin_competencies((select auth.uid()))
  or public.user_can_manage_competency_request(request_id, (select auth.uid()))
);

revoke all on public.competency_equipment_brands from public, anon;
revoke all on public.competency_equipment_types from public, anon;
revoke all on public.competency_equipment_models from public, anon;
revoke all on public.competency_instructors from public, anon;
revoke all on public.competency_requests from public, anon;
revoke all on public.competency_request_models from public, anon;
revoke all on public.competency_evaluations from public, anon;
revoke all on public.competency_certificates from public, anon;
revoke all on public.competency_audit_log from public, anon;

grant select on public.competency_equipment_brands to authenticated;
grant select on public.competency_equipment_types to authenticated;
grant select on public.competency_equipment_models to authenticated;
grant select on public.competency_instructors to authenticated;
grant select on public.competency_requests to authenticated;
grant select on public.competency_request_models to authenticated;
grant select on public.competency_evaluations to authenticated;
grant select on public.competency_certificates to authenticated;
grant select on public.competency_audit_log to authenticated;

revoke insert, update, delete on public.competency_equipment_brands from authenticated;
revoke insert, update, delete on public.competency_equipment_types from authenticated;
revoke insert, update, delete on public.competency_equipment_models from authenticated;
revoke insert, update, delete on public.competency_instructors from authenticated;
revoke insert, update, delete on public.competency_requests from authenticated;
revoke insert, update, delete on public.competency_request_models from authenticated;
revoke insert, update, delete on public.competency_evaluations from authenticated;
revoke insert, update, delete on public.competency_certificates from authenticated;
revoke insert, update, delete on public.competency_audit_log from authenticated;

revoke all on function public.user_can_access_competencies(uuid) from public, anon;
revoke all on function public.user_can_admin_competencies(uuid) from public, anon;
revoke all on function public.user_can_manage_competency_request(uuid, uuid) from public, anon;
revoke all on function public.log_competency_event(uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.user_can_access_competencies(uuid) to authenticated;
grant execute on function public.user_can_admin_competencies(uuid) to authenticated;
grant execute on function public.user_can_manage_competency_request(uuid, uuid) to authenticated;

with source_brands(code, name, sort_order) as (
  values
    ('iveco', 'IVECO', 10),
    ('maxus', 'MAXUS', 20),
    ('mercedes-benz', 'MERCEDES BENZ', 30),
    ('scania', 'SCANIA', 40),
    ('volare', 'VOLARE', 50),
    ('volvo', 'VOLVO', 60),
    ('yutong', 'YUTONG', 70),
    ('zhong-tong', 'ZHONG TONG', 80)
)
insert into public.competency_equipment_brands (code, name, sort_order, is_active)
select code, name, sort_order, true from source_brands
on conflict (code) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = timezone('utc', now());

with source_types(code, name, sort_order) as (
  values
    ('minibus', 'MINIBUS', 10),
    ('bus-1-piso', 'BUS 1 PISO', 20),
    ('bus-2-pisos', 'BUS 2 PISOS', 30),
    ('taxibus', 'TAXIBUS', 40)
)
insert into public.competency_equipment_types (code, name, sort_order, is_active)
select code, name, sort_order, true from source_types
on conflict (code) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = timezone('utc', now());

with source_models(legacy_code, brand_code, type_code, model_code, model_name) as (
  values
    ('VEH-001', 'iveco', 'minibus', 'iveco-daily-50-170-4x2', 'DAILY 50 - 170 4X2'),
    ('VEH-002', 'maxus', 'minibus', 'maxus-e-delibery-9', 'E DELIBERY 9'),
    ('VEH-003', 'mercedes-benz', 'bus-1-piso', 'mercedes-benz-o500-rs-oc500-rf-bus-1', 'O500 RS - OC500 RF'),
    ('VEH-004', 'mercedes-benz', 'bus-1-piso', 'mercedes-benz-o500-rs-d-bus-1', 'O500 RS-D'),
    ('VEH-005', 'mercedes-benz', 'bus-2-pisos', 'mercedes-benz-o500-rs-oc500-rf-bus-2', 'O500 RS - OC500 RF'),
    ('VEH-006', 'mercedes-benz', 'bus-2-pisos', 'mercedes-benz-o500-rs-d-bus-2', 'O500 RS-D'),
    ('VEH-007', 'mercedes-benz', 'minibus', 'mercedes-benz-sprinter-315-415-515-517-4x2', 'SPRINTER 315 - 415 - 515 - 517 4X2'),
    ('VEH-008', 'mercedes-benz', 'minibus', 'mercedes-benz-sprinter-315-415-515-517-4x4', 'SPRINTER 315 - 415 - 515 - 517 4X4'),
    ('VEH-009', 'mercedes-benz', 'taxibus', 'mercedes-benz-lo915-lo916', 'LO915 - LO916'),
    ('VEH-010', 'scania', 'bus-1-piso', 'scania-k-360-ib-bus-1', 'K 360 IB'),
    ('VEH-011', 'scania', 'bus-1-piso', 'scania-k-410cb', 'K 410CB'),
    ('VEH-012', 'scania', 'bus-2-pisos', 'scania-k-360-ib-bus-2', 'K 360 IB'),
    ('VEH-013', 'scania', 'bus-2-pisos', 'scania-k-440-ib', 'K 440 IB'),
    ('VEH-014', 'volare', 'taxibus', 'volare-fly-w9-agrale-ma-9-2', 'Fly W9 Agrale MA 9.2'),
    ('VEH-015', 'volare', 'taxibus', 'volare-v8l-4x4', 'V8L 4X4'),
    ('VEH-016', 'volvo', 'bus-2-pisos', 'volvo-b-420r-b-430r', 'B 420R - B 430R'),
    ('VEH-017', 'volvo', 'bus-2-pisos', 'volvo-b-450r', 'B 450R'),
    ('VEH-018', 'yutong', 'taxibus', 'yutong-c9-zk6709h', 'C9 ZK6709H'),
    ('VEH-019', 'zhong-tong', 'bus-1-piso', 'zhong-tong-zt-lck6129ev', 'ZT LCK6129EV')
)
insert into public.competency_equipment_models (brand_id, type_id, code, name, legacy_code, is_active)
select b.id, t.id, sm.model_code, sm.model_name, sm.legacy_code, true
from source_models sm
join public.competency_equipment_brands b on b.code = sm.brand_code
join public.competency_equipment_types t on t.code = sm.type_code
on conflict (code) do update
set brand_id = excluded.brand_id,
    type_id = excluded.type_id,
    name = excluded.name,
    legacy_code = excluded.legacy_code,
    is_active = true,
    updated_at = timezone('utc', now());

with source_instructors(full_name, document_number, profile_code, signature_label) as (
  values
    ('Marcelo Camilo Barrera Acevedo', '13.364.290-0', 'P-8549-2359-004-V01', 'Marcelo Barrera A.'),
    ('Daniel Rodrigo Carvajal Bucarey', '10.528.715-1', 'P-8549-2359-004-V01', 'Daniel Carvajal B.'),
    ('Fernando Rodrigo Maza Roman', '12.476.744-k', 'P-8549-2359-004-V01', 'Fernando Maza R.'),
    ('Gilberto Leonardo Urtubia Carvajal', '9.249.626-0', 'P-8549-2359-004-V01', 'Gilerto Urtubia C.'),
    ('Milla Miranda Guillermo Andres', '15.325.100-2', 'P-8549-2359-004-V01', 'Guillermo Milla M.')
)
insert into public.competency_instructors (full_name, document_number, profile_code, signature_label, status, metadata)
select full_name, document_number, profile_code, signature_label, 'active', jsonb_build_object('source', 'legacy_csv')
from source_instructors
on conflict (document_number) do update
set full_name = excluded.full_name,
    profile_code = excluded.profile_code,
    signature_label = excluded.signature_label,
    status = 'active',
    updated_at = timezone('utc', now());

create or replace function public.get_competency_catalogs()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_access_competencies(current_user_id) then
    raise exception 'Sin permisos para acceder a certificacion de competencias';
  end if;

  return jsonb_build_object(
    'brands', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id,
        'code', code,
        'name', name,
        'sort_order', sort_order
      ) order by sort_order, name), '[]'::jsonb)
      from public.competency_equipment_brands
      where is_active = true
    ),
    'types', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id,
        'code', code,
        'name', name,
        'sort_order', sort_order
      ) order by sort_order, name), '[]'::jsonb)
      from public.competency_equipment_types
      where is_active = true
    ),
    'models', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id,
        'code', m.code,
        'name', m.name,
        'brand_id', m.brand_id,
        'type_id', m.type_id,
        'brand_name', b.name,
        'type_name', t.name
      ) order by b.sort_order, t.sort_order, m.name), '[]'::jsonb)
      from public.competency_equipment_models m
      join public.competency_equipment_brands b on b.id = m.brand_id
      join public.competency_equipment_types t on t.id = m.type_id
      where m.is_active = true and b.is_active = true and t.is_active = true
    ),
    'instructors', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id,
        'user_id', user_id,
        'full_name', full_name,
        'document_number', document_number,
        'profile_code', profile_code,
        'signature_label', signature_label,
        'status', status
      ) order by full_name), '[]'::jsonb)
      from public.competency_instructors
      where status = 'active'
        and (
          public.user_can_admin_competencies(current_user_id)
          or user_id = current_user_id
        )
    ),
    'permissions', jsonb_build_object(
      'can_admin', public.user_can_admin_competencies(current_user_id),
      'can_access', true
    )
  );
end;
$function$;

create or replace function public.search_competency_workers(search_text text default null, result_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := public.normalize_recruitment_search_text(coalesce(search_text, ''));
  document_digits text := regexp_replace(coalesce(search_text, ''), '\D', '', 'g');
  safe_limit integer := least(greatest(coalesce(result_limit, 20), 1), 50);
begin
  if not public.user_can_access_competencies(current_user_id) then
    raise exception 'Sin permisos para buscar trabajadores';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'buk_employee_id', e.buk_employee_id,
      'full_name', e.full_name,
      'document_number', coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut'),
      'document_type', coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut'),
      'job_title', coalesce(nullif(trim(e.job_title), ''), e.raw_payload -> 'current_job' -> 'role' ->> 'name'),
      'area_name', e.area_name,
      'contract_code', e.contract_code,
      'display_label', concat_ws(' · ', e.full_name, coalesce(e.document_number, e.raw_payload ->> 'rut'), e.job_title, e.area_name)
    ) order by e.full_name), '[]'::jsonb)
    from (
      select distinct on (e.buk_employee_id)
        e.*
      from public.employees_active_current e
      where e.buk_employee_id is not null
        and nullif(trim(coalesce(e.full_name, '')), '') is not null
        and (
          normalized_search = ''
          or public.build_active_employee_search_text(
            e.full_name,
            e.document_number,
            e.job_title,
            e.contract_code,
            e.area_name,
            e.raw_payload
          ) like '%' || normalized_search || '%'
          or (
            length(document_digits) >= 4
            and public.build_employee_document_digits(e.document_number, e.raw_payload) like '%' || document_digits || '%'
          )
          or e.buk_employee_id ilike '%' || coalesce(search_text, '') || '%'
        )
      order by e.buk_employee_id, e.updated_at desc nulls last, e.created_at desc nulls last
      limit safe_limit
    ) e
  );
end;
$function$;

create or replace function public.create_competency_request(request_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  requested_instructor_id uuid := nullif(request_payload->>'instructorId', '')::uuid;
  selected_model_ids uuid[] := '{}';
  worker_record record;
  instructor_record record;
  created_request_id uuid;
  created_certificate_id uuid;
  created_folio text;
  created_token uuid;
  model_summary text;
  theoretical_score numeric(5,2) := coalesce(nullif(request_payload->>'theoreticalScore', '')::numeric, 0);
  practical_score numeric(5,2) := coalesce(nullif(request_payload->>'practicalScore', '')::numeric, 0);
  final_score numeric(5,2) := coalesce(nullif(request_payload->>'finalScore', '')::numeric, 0);
  training_date_value date := nullif(request_payload->>'trainingDate', '')::date;
  evaluation_date_value timestamptz := coalesce(nullif(request_payload->>'evaluationDate', '')::timestamptz, timezone('utc', now()));
  file_path_value text := trim(coalesce(request_payload->>'evaluationFilePath', ''));
  file_name_value text := trim(coalesce(request_payload->>'evaluationFileName', ''));
  file_mime_value text := trim(coalesce(request_payload->>'evaluationMimeType', ''));
  file_hash_value text := lower(trim(coalesce(request_payload->>'evaluationSha256', '')));
  file_size_value bigint := coalesce(nullif(request_payload->>'evaluationSizeBytes', '')::bigint, 0);
begin
  if not public.user_can_access_competencies(current_user_id) then
    raise exception 'Sin permisos para crear certificaciones de competencias';
  end if;

  if jsonb_typeof(request_payload) <> 'object' then
    raise exception 'Payload invalido';
  end if;

  if requested_instructor_id is null then
    raise exception 'Instructor requerido';
  end if;

  select * into instructor_record
  from public.competency_instructors
  where id = requested_instructor_id
    and status = 'active';

  if instructor_record.id is null then
    raise exception 'Instructor activo no encontrado';
  end if;

  if (instructor_record.user_id is null or instructor_record.user_id <> current_user_id)
     and not public.user_can_admin_competencies(current_user_id) then
    raise exception 'No puedes certificar en nombre de otro instructor';
  end if;

  select
    e.buk_employee_id,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    e.full_name,
    coalesce(nullif(trim(e.job_title), ''), e.raw_payload -> 'current_job' -> 'role' ->> 'name') as job_title,
    e.area_name,
    e.contract_code
  into worker_record
  from public.employees_active_current e
  where e.buk_employee_id = trim(coalesce(request_payload->>'workerBukEmployeeId', ''))
  limit 1;

  if worker_record.buk_employee_id is null then
    raise exception 'Trabajador activo no encontrado en BUK sincronizado';
  end if;

  if nullif(trim(coalesce(worker_record.document_number, '')), '') is null then
    raise exception 'El trabajador no tiene RUT/documento valido';
  end if;

  select array_agg(value::uuid)
    into selected_model_ids
  from jsonb_array_elements_text(coalesce(request_payload->'modelIds', '[]'::jsonb)) value;

  if selected_model_ids is null or array_length(selected_model_ids, 1) is null then
    raise exception 'Debes seleccionar al menos un modelo de equipo';
  end if;

  if exists (
    select 1
    from unnest(selected_model_ids) selected_model_id
    left join public.competency_equipment_models m
      on m.id = selected_model_id and m.is_active = true
    where m.id is null
  ) then
    raise exception 'Uno o mas modelos seleccionados no son validos';
  end if;

  if final_score <> 100 or theoretical_score <> 100 or practical_score <> 100 then
    raise exception 'La certificacion exige evaluacion teorica, practica y final al 100%%';
  end if;

  if coalesce(nullif(request_payload->>'declarationAccepted', '')::boolean, false) is not true then
    raise exception 'Debes aceptar la declaracion de evaluacion antes de generar el certificado';
  end if;

  if file_path_value = '' or file_name_value = '' or file_size_value <= 0 then
    raise exception 'Debes cargar la evaluacion respaldada antes de generar el certificado';
  end if;

  if file_mime_value not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'Solo se permiten evaluaciones PDF, JPG o PNG';
  end if;

  if file_hash_value !~ '^[a-f0-9]{64}$' then
    raise exception 'Hash SHA-256 de evaluacion invalido';
  end if;

  if file_path_value not like 'evaluations/' || current_user_id::text || '/%' then
    raise exception 'Ruta de evaluacion fuera del alcance del usuario';
  end if;

  if not exists (
    select 1
    from storage.objects so
    where so.bucket_id = 'competency_documents'
      and so.name = file_path_value
  ) then
    raise exception 'No se encontro el archivo de evaluacion cargado';
  end if;

  if training_date_value is null then
    raise exception 'Fecha de capacitacion requerida';
  end if;

  select string_agg(concat(b.name, ' ', t.name, ' ', m.name), ', ' order by b.name, t.name, m.name)
    into model_summary
  from public.competency_equipment_models m
  join public.competency_equipment_brands b on b.id = m.brand_id
  join public.competency_equipment_types t on t.id = m.type_id
  where m.id = any(selected_model_ids);

  if exists (
    select 1
    from public.competency_requests cr
    join public.competency_request_models crm on crm.request_id = cr.id
    join public.competency_certificates cc on cc.request_id = cr.id
    where cr.worker_buk_employee_id = worker_record.buk_employee_id
      and crm.model_id = any(selected_model_ids)
      and cc.competency_status = 'enabled'
      and cc.valid_until >= current_date
      and cc.certificate_status in ('generated', 'uploaded_to_buk')
  ) then
    raise exception 'Ya existe una competencia vigente para el trabajador y al menos uno de los modelos seleccionados';
  end if;

  insert into public.competency_requests (
    request_status,
    worker_buk_employee_id,
    worker_document_number,
    worker_document_type,
    worker_full_name,
    worker_job_title,
    worker_area_name,
    worker_contract_code,
    instructor_id,
    training_date,
    training_start_time,
    training_end_time,
    training_location,
    training_modality,
    training_type,
    notes,
    model_summary,
    created_by,
    updated_by
  )
  values (
    'submitted',
    worker_record.buk_employee_id,
    worker_record.document_number,
    worker_record.document_type,
    worker_record.full_name,
    worker_record.job_title,
    worker_record.area_name,
    worker_record.contract_code,
    requested_instructor_id,
    training_date_value,
    nullif(request_payload->>'trainingStartTime', '')::time,
    nullif(request_payload->>'trainingEndTime', '')::time,
    nullif(trim(coalesce(request_payload->>'trainingLocation', '')), ''),
    coalesce(nullif(trim(coalesce(request_payload->>'trainingModality', '')), ''), 'teorico-practica'),
    coalesce(nullif(trim(coalesce(request_payload->>'trainingType', '')), ''), 'teorico-practica'),
    nullif(trim(coalesce(request_payload->>'notes', '')), ''),
    model_summary,
    current_user_id,
    current_user_id
  )
  returning id into created_request_id;

  insert into public.competency_request_models (request_id, model_id)
  select created_request_id, model_id
  from unnest(selected_model_ids) model_id;

  insert into public.competency_evaluations (
    request_id,
    attempt_number,
    theoretical_score,
    practical_score,
    final_score,
    evaluation_status,
    file_path,
    file_original_name,
    file_mime_type,
    file_size_bytes,
    file_sha256,
    declaration_accepted,
    evaluated_at,
    approved_at,
    uploaded_by
  )
  values (
    created_request_id,
    1,
    theoretical_score,
    practical_score,
    final_score,
    'approved',
    file_path_value,
    file_name_value,
    file_mime_value,
    file_size_value,
    file_hash_value,
    true,
    evaluation_date_value,
    timezone('utc', now()),
    current_user_id
  );

  insert into public.competency_certificates (request_id)
  values (created_request_id)
  returning id, folio, verification_token into created_certificate_id, created_folio, created_token;

  perform public.log_competency_event(
    created_request_id,
    created_certificate_id,
    'request_submitted',
    'Solicitud de certificacion creada con evaluacion aprobada al 100%',
    jsonb_build_object(
      'worker_buk_employee_id', worker_record.buk_employee_id,
      'instructor_id', requested_instructor_id,
      'model_count', array_length(selected_model_ids, 1),
      'folio', created_folio
    )
  );

  return jsonb_build_object(
    'request_id', created_request_id,
    'certificate_id', created_certificate_id,
    'folio', created_folio,
    'verification_token', created_token
  );
end;
$function$;

create or replace function public.get_competency_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  can_admin boolean := false;
begin
  if not public.user_can_access_competencies(current_user_id) then
    raise exception 'Sin permisos para ver certificaciones de competencias';
  end if;

  can_admin := public.user_can_admin_competencies(current_user_id);

  return jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'total', count(*),
        'generated', count(*) filter (where cc.certificate_status in ('generated', 'uploaded_to_buk')),
        'pending_buk', count(*) filter (where cc.buk_upload_status in ('pending', 'queued', 'failed')),
        'failed', count(*) filter (where cc.certificate_status = 'generation_failed' or cc.buk_upload_status = 'failed'),
        'expiring_30', count(*) filter (where cc.valid_until between current_date and current_date + interval '30 days'),
        'expired', count(*) filter (where cc.valid_until < current_date)
      )
      from public.competency_requests cr
      join public.competency_certificates cc on cc.request_id = cr.id
      join public.competency_instructors ci on ci.id = cr.instructor_id
      where can_admin or cr.created_by = current_user_id or ci.user_id = current_user_id
    ),
    'recent', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'request_id', cr.id,
        'certificate_id', cc.id,
        'folio', cc.folio,
        'worker_full_name', cr.worker_full_name,
        'worker_document_number', cr.worker_document_number,
        'worker_buk_employee_id', cr.worker_buk_employee_id,
        'instructor_name', ci.full_name,
        'model_summary', cr.model_summary,
        'certificate_status', cc.certificate_status,
        'competency_status', cc.competency_status,
        'buk_upload_status', cc.buk_upload_status,
        'issued_at', cc.issued_at,
        'valid_until', cc.valid_until,
        'pdf_path', cc.pdf_path,
        'created_at', cr.created_at
      ) order by cr.created_at desc), '[]'::jsonb)
      from (
        select cr.*
        from public.competency_requests cr
        join public.competency_instructors ci on ci.id = cr.instructor_id
        where can_admin or cr.created_by = current_user_id or ci.user_id = current_user_id
        order by cr.created_at desc
        limit 50
      ) cr
      join public.competency_instructors ci on ci.id = cr.instructor_id
      join public.competency_certificates cc on cc.request_id = cr.id
    )
  );
end;
$function$;

revoke all on function public.get_competency_catalogs() from public, anon;
revoke all on function public.search_competency_workers(text, integer) from public, anon;
revoke all on function public.create_competency_request(jsonb) from public, anon;
revoke all on function public.get_competency_dashboard() from public, anon;
grant execute on function public.get_competency_catalogs() to authenticated;
grant execute on function public.search_competency_workers(text, integer) to authenticated;
grant execute on function public.create_competency_request(jsonb) to authenticated;
grant execute on function public.get_competency_dashboard() to authenticated;

drop policy if exists "competency_documents_evaluation_insert_own" on storage.objects;
create policy "competency_documents_evaluation_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'competency_documents'
  and name like ('evaluations/' || (select auth.uid())::text || '/%')
  and public.user_can_access_competencies((select auth.uid()))
);

drop policy if exists "competency_documents_select_scoped" on storage.objects;
create policy "competency_documents_select_scoped"
on storage.objects for select
to authenticated
using (
  bucket_id = 'competency_documents'
  and (
    public.user_can_admin_competencies((select auth.uid()))
    or exists (
      select 1
      from public.competency_evaluations ce
      join public.competency_requests cr on cr.id = ce.request_id
      join public.competency_instructors ci on ci.id = cr.instructor_id
      where ce.file_path = storage.objects.name
        and (cr.created_by = (select auth.uid()) or ci.user_id = (select auth.uid()))
    )
    or exists (
      select 1
      from public.competency_certificates cc
      join public.competency_requests cr on cr.id = cc.request_id
      join public.competency_instructors ci on ci.id = cr.instructor_id
      where cc.pdf_path = storage.objects.name
        and (cr.created_by = (select auth.uid()) or ci.user_id = (select auth.uid()))
    )
  )
);

notify pgrst, 'reload schema';

commit;
