begin;

insert into public.app_modules (code, name, route, description, sort_order, is_active)
values (
  'solicitud_sanciones',
  'Solicitud de Sanciones',
  '/recursos-humanos/sanciones',
  'Ingreso, gestion y cierre trazable de solicitudes de sanciones disciplinarias.',
  65,
  true
)
on conflict (code) do update
set name = excluded.name,
    route = excluded.route,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = timezone('utc', now());

with desired_access(role_code, module_code) as (
  values
    ('admin', 'solicitud_sanciones'),
    ('admin', 'recursos_humanos')
)
insert into public.role_module_access (role_code, module_code, can_view)
select da.role_code, da.module_code, true
from desired_access da
join public.app_roles ar on ar.code = da.role_code and ar.is_active = true
join public.app_modules am on am.code = da.module_code and am.is_active = true
on conflict (role_code, module_code) do update
set can_view = true;

delete from public.role_module_access
where module_code = 'solicitud_sanciones'
  and role_code <> 'admin';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hr-sanctions',
  'hr-sanctions',
  false,
  52428800,
  array['application/pdf', 'image/jpeg', 'image/png', 'video/mp4', 'video/quicktime']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.hr_sanction_causes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  regulatory_basis text not null default '',
  template_title text null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint hr_sanction_causes_code_format check (code = lower(code) and code ~ '^[a-z0-9_]+$')
);

create table if not exists public.hr_sanction_measures (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  requires_dt_filing boolean not null default false,
  requires_certified_mail_on_refusal boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint hr_sanction_measures_code_format check (code = lower(code) and code ~ '^[a-z0-9_]+$')
);

create table if not exists public.hr_sanction_requests (
  id uuid primary key default gen_random_uuid(),
  folio bigint generated always as identity unique,
  employee_buk_employee_id text not null,
  employee_document_type text not null default 'rut',
  employee_document_number text not null,
  employee_full_name text not null,
  employee_job_title text not null,
  employee_contract_code text null,
  employee_area_name text null,
  incident_place text not null,
  incident_at timestamptz not null,
  equipment_number text null,
  cause_id uuid not null references public.hr_sanction_causes(id),
  cause_name text not null,
  measure_id uuid not null references public.hr_sanction_measures(id),
  measure_name text not null,
  regulatory_basis text not null,
  description text not null,
  requester_user_id uuid not null,
  requester_name text not null,
  requester_email text null,
  status text not null default 'submitted'
    check (status in (
      'submitted',
      'under_review',
      'returned',
      'rejected',
      'issued',
      'pending_signature',
      'pending_certified_mail',
      'pending_dt_filing',
      'closed',
      'expired',
      'cancelled'
    )),
  current_owner text not null default 'rrll',
  due_at timestamptz not null,
  closed_at timestamptz null,
  closed_by uuid null,
  returned_reason text null,
  rejected_reason text null,
  buk_upload_status text not null default 'not_ready'
    check (buk_upload_status in ('not_ready', 'pending', 'uploaded', 'failed', 'not_applicable')),
  buk_document_id text null,
  buk_last_error text null,
  idempotency_key text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint hr_sanction_requests_description_length check (char_length(trim(description)) >= 20),
  constraint hr_sanction_requests_incident_place_length check (char_length(trim(incident_place)) >= 3),
  constraint hr_sanction_requests_idempotency_unique unique (requester_user_id, idempotency_key)
);

create table if not exists public.hr_sanction_documents (
  id uuid primary key default gen_random_uuid(),
  sanction_request_id uuid not null references public.hr_sanction_requests(id) on delete cascade,
  document_type text not null
    check (document_type in (
      'request_evidence',
      'qav_report',
      'image',
      'video',
      'signed_letter',
      'signature_refusal',
      'certified_mail_receipt',
      'dt_filing_receipt',
      'generated_letter',
      'other'
    )),
  bucket_id text not null default 'hr-sanctions',
  file_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  uploaded_by uuid not null,
  uploaded_at timestamptz not null default timezone('utc', now()),
  buk_document_id text null,
  buk_uploaded_at timestamptz null,
  constraint hr_sanction_documents_unique_path unique (bucket_id, file_path),
  constraint hr_sanction_documents_bucket_check check (bucket_id = 'hr-sanctions')
);

create table if not exists public.hr_sanction_request_history (
  id bigint generated always as identity primary key,
  sanction_request_id uuid not null references public.hr_sanction_requests(id) on delete cascade,
  action_type text not null,
  from_status text null,
  to_status text null,
  actor_user_id uuid null,
  comment text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_hr_sanction_requests_status_due
  on public.hr_sanction_requests (status, due_at, created_at desc);

create index if not exists idx_hr_sanction_requests_employee
  on public.hr_sanction_requests (employee_document_number, created_at desc);

create index if not exists idx_hr_sanction_requests_requester
  on public.hr_sanction_requests (requester_user_id, created_at desc);

create index if not exists idx_hr_sanction_documents_request
  on public.hr_sanction_documents (sanction_request_id, document_type);

drop trigger if exists trg_hr_sanction_causes_set_updated_at on public.hr_sanction_causes;
create trigger trg_hr_sanction_causes_set_updated_at
before update on public.hr_sanction_causes
for each row execute function public.set_updated_at();

drop trigger if exists trg_hr_sanction_measures_set_updated_at on public.hr_sanction_measures;
create trigger trg_hr_sanction_measures_set_updated_at
before update on public.hr_sanction_measures
for each row execute function public.set_updated_at();

drop trigger if exists trg_hr_sanction_requests_set_updated_at on public.hr_sanction_requests;
create trigger trg_hr_sanction_requests_set_updated_at
before update on public.hr_sanction_requests
for each row execute function public.set_updated_at();

alter table public.hr_sanction_causes enable row level security;
alter table public.hr_sanction_measures enable row level security;
alter table public.hr_sanction_requests enable row level security;
alter table public.hr_sanction_documents enable row level security;
alter table public.hr_sanction_request_history enable row level security;

revoke all on table public.hr_sanction_causes from anon, authenticated;
revoke all on table public.hr_sanction_measures from anon, authenticated;
revoke all on table public.hr_sanction_requests from anon, authenticated;
revoke all on table public.hr_sanction_documents from anon, authenticated;
revoke all on table public.hr_sanction_request_history from anon, authenticated;

drop policy if exists hr_sanction_causes_no_direct_access on public.hr_sanction_causes;
create policy hr_sanction_causes_no_direct_access
on public.hr_sanction_causes for all
to authenticated
using (false)
with check (false);

drop policy if exists hr_sanction_measures_no_direct_access on public.hr_sanction_measures;
create policy hr_sanction_measures_no_direct_access
on public.hr_sanction_measures for all
to authenticated
using (false)
with check (false);

drop policy if exists hr_sanction_requests_no_direct_access on public.hr_sanction_requests;
create policy hr_sanction_requests_no_direct_access
on public.hr_sanction_requests for all
to authenticated
using (false)
with check (false);

drop policy if exists hr_sanction_documents_no_direct_access on public.hr_sanction_documents;
create policy hr_sanction_documents_no_direct_access
on public.hr_sanction_documents for all
to authenticated
using (false)
with check (false);

drop policy if exists hr_sanction_request_history_no_direct_access on public.hr_sanction_request_history;
create policy hr_sanction_request_history_no_direct_access
on public.hr_sanction_request_history for all
to authenticated
using (false)
with check (false);

insert into public.hr_sanction_causes (
  code,
  name,
  description,
  regulatory_basis,
  template_title,
  sort_order,
  is_active
)
values
  ('equipment_damage', 'Daños al equipo', 'Daños materiales a activos de la empresa o terceros por conduccion deficiente o maniobra negligente.', 'RIOHS: Punto 40; Puntos 7 y 9; Puntos 15.2 y 15.3.', 'Carta Amonestación - Daños al equipo.doc', 10, true),
  ('speeding', 'Exceso de velocidad', 'Circulacion sobre limites permitidos por Ley de Transito o protocolos internos.', 'RIOHS: Art. 34 letra g; Punto 40 letra h.', 'Carta Amonestación - Exceso de Velocidad.doc', 20, true),
  ('smoking_bus', 'Fumar al interior del bus', 'Fumar al interior del bus con o sin pasajeros.', 'RIOHS: Art. 39 letra i.', 'Carta Amonestación - Fumar.doc', 30, true),
  ('no_show_shift', 'No presentarse al turno', 'No presentarse al servicio asignado ni informar oportunamente ausencia o impedimento.', 'RIOHS: Art. 40 letra a.', 'Carta Amonestacion - No presentarse a servicio asignado.doc', 40, true),
  ('drowsiness_manipulation', 'Somnolencia', 'Manipulacion o incumplimiento de controles de fatiga y somnolencia.', 'RIOHS: Art. 40 letra i.', 'Carta Amonestación - Somnolencia.doc', 50, true),
  ('phone_driving', 'Uso de teléfono durante conducción', 'Manipulacion, mensajeria o conversacion telefonica durante conduccion.', 'RIOHS: Art. 15.1 n°10; Art. 15.3 n°15 y n°36; Ley No Chat.', 'Carta Amonestación - Telefono.doc', 60, true),
  ('camera_manipulation', 'Manipulación o movimiento de cámara', 'Obstaculizacion o manipulacion deliberada de camaras instaladas en vehiculos.', 'RIOHS: Art. 39 letra p.', 'Carta Amonestacion_Camara.doc', 70, true),
  ('continuous_line_overtaking', 'Adelantamiento en línea continua', 'Adelantamiento en zona prohibida o linea continua.', 'Pendiente de confirmar articulo especifico del RIOHS o Ley de Transito.', null, 80, true),
  ('distracting_elements', 'Uso de elementos distractores', 'Uso de elementos no autorizados que distraen la conduccion u operacion segura.', 'Pendiente de confirmar articulo especifico del RIOHS o Ley de Transito.', null, 90, true)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    regulatory_basis = excluded.regulatory_basis,
    template_title = excluded.template_title,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now());

insert into public.hr_sanction_measures (
  code,
  name,
  requires_dt_filing,
  requires_certified_mail_on_refusal,
  sort_order,
  is_active
)
values
  ('re_instruction', 'Re instrucción', false, false, 10, true),
  ('life_record_only', 'Sólo registro en hoja de vida', false, false, 20, true),
  ('simple_written_warning', 'Amonestación escrita simple', false, false, 30, true),
  ('written_warning_dt', 'Amonestación escrita con copia a Dirección del Trabajo', true, true, 40, true),
  ('termination_request', 'Solicitud de finiquito', true, true, 50, true)
on conflict (code) do update
set name = excluded.name,
    requires_dt_filing = excluded.requires_dt_filing,
    requires_certified_mail_on_refusal = excluded.requires_certified_mail_on_refusal,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now());

create or replace function public.user_can_access_hr_sanctions(p_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(public.user_is_admin(p_actor_id), false)
    or coalesce(public.user_can_access_module(p_actor_id, 'solicitud_sanciones'), false);
$function$;

create or replace function public.user_can_manage_hr_sanctions(p_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(public.user_is_admin(p_actor_id), false)
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = p_actor_id
        and ur.role_code = 'admin'
    );
$function$;

create or replace function public.get_hr_sanction_setup_catalogs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_access_hr_sanctions(current_user_id) then
    raise exception 'Sin permisos para consultar catalogos de sanciones';
  end if;

  return jsonb_build_object(
    'causes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'code', c.code,
        'name', c.name,
        'description', c.description,
        'regulatory_basis', c.regulatory_basis,
        'template_title', c.template_title
      ) order by c.sort_order, c.name), '[]'::jsonb)
      from public.hr_sanction_causes c
      where c.is_active = true
    ),
    'measures', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id,
        'code', m.code,
        'name', m.name,
        'requires_dt_filing', m.requires_dt_filing,
        'requires_certified_mail_on_refusal', m.requires_certified_mail_on_refusal
      ) order by m.sort_order, m.name), '[]'::jsonb)
      from public.hr_sanction_measures m
      where m.is_active = true
    )
  );
end;
$function$;

create or replace function public.search_hr_sanction_workers(
  p_search text default null,
  p_limit integer default 20
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
  safe_limit integer := greatest(1, least(coalesce(p_limit, 20), 30));
begin
  if not public.user_can_access_hr_sanctions(current_user_id) then
    raise exception 'Sin permisos para consultar trabajadores para sanciones';
  end if;

  return query
  with active_workers as (
    select
      e.buk_employee_id,
      e.full_name,
      coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
      coalesce(nullif(trim(e.document_type), ''), 'rut') as document_type,
      coalesce(
        nullif(trim(e.job_title), ''),
        nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
        nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
        nullif(trim(e.raw_payload ->> 'job_title'), '')
      ) as resolved_job_title,
      nullif(trim(e.contract_code), '') as contract_code,
      nullif(trim(e.area_name), '') as area_name,
      public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key
    from public.employees_active_current e
    where e.buk_employee_id is not null
  )
  select
    aw.buk_employee_id,
    aw.full_name,
    aw.document_number,
    aw.document_type,
    aw.resolved_job_title,
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
     or lower(concat_ws(' ', aw.name_search_key, aw.full_name, aw.document_number, aw.resolved_job_title, aw.contract_code, aw.area_name)) like '%' || normalized_search || '%'
  order by aw.full_name asc
  limit safe_limit;
end;
$function$;

create or replace function public.create_hr_sanction_request(
  p_payload jsonb,
  p_idempotency_key text
)
returns table (
  request_id uuid,
  folio bigint,
  status text,
  due_at timestamptz,
  is_out_of_deadline boolean
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  actor_profile record;
  worker_row record;
  cause_row record;
  measure_row record;
  existing_row record;
  inserted_row record;
  normalized_idempotency text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  resolved_incident_at timestamptz;
  resolved_due_at timestamptz;
  incident_lag interval;
begin
  if not public.user_can_access_hr_sanctions(current_user_id) then
    raise exception 'Sin permisos para crear solicitudes de sancion';
  end if;

  if normalized_idempotency is null or char_length(normalized_idempotency) < 12 then
    raise exception 'Clave de idempotencia invalida';
  end if;

  select *
  into existing_row
  from public.hr_sanction_requests hsr
  where hsr.requester_user_id = current_user_id
    and hsr.idempotency_key = normalized_idempotency;

  if found then
    return query
    select existing_row.id, existing_row.folio, existing_row.status, existing_row.due_at, existing_row.incident_at < timezone('utc', now()) - interval '48 hours';
    return;
  end if;

  select p.full_name, p.email
  into actor_profile
  from public.profiles p
  where p.id = current_user_id;

  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(nullif(trim(e.document_type), ''), 'rut') as document_type,
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
  where e.buk_employee_id = nullif(trim(coalesce(p_payload ->> 'bukEmployeeId', '')), '')
  limit 1;

  if not found then
    raise exception 'Trabajador no encontrado o no disponible para sanciones';
  end if;

  select *
  into cause_row
  from public.hr_sanction_causes c
  where c.id = nullif(trim(coalesce(p_payload ->> 'causeId', '')), '')::uuid
    and c.is_active = true;

  if not found then
    raise exception 'Causal de sancion invalida';
  end if;

  select *
  into measure_row
  from public.hr_sanction_measures m
  where m.id = nullif(trim(coalesce(p_payload ->> 'measureId', '')), '')::uuid
    and m.is_active = true;

  if not found then
    raise exception 'Medida de sancion invalida';
  end if;

  resolved_incident_at := nullif(trim(coalesce(p_payload ->> 'incidentAt', '')), '')::timestamptz;
  resolved_due_at := resolved_incident_at + interval '48 hours';
  incident_lag := timezone('utc', now()) - resolved_incident_at;

  if resolved_incident_at > timezone('utc', now()) + interval '5 minutes' then
    raise exception 'La fecha de infraccion no puede estar en el futuro';
  end if;

  if char_length(trim(coalesce(p_payload ->> 'incidentPlace', ''))) < 3 then
    raise exception 'Debe indicar el lugar de la infraccion';
  end if;

  if char_length(trim(coalesce(p_payload ->> 'description', ''))) < 20 then
    raise exception 'Debe describir la infraccion con mayor detalle';
  end if;

  insert into public.hr_sanction_requests (
    employee_buk_employee_id,
    employee_document_type,
    employee_document_number,
    employee_full_name,
    employee_job_title,
    employee_contract_code,
    employee_area_name,
    incident_place,
    incident_at,
    equipment_number,
    cause_id,
    cause_name,
    measure_id,
    measure_name,
    regulatory_basis,
    description,
    requester_user_id,
    requester_name,
    requester_email,
    due_at,
    idempotency_key
  )
  values (
    worker_row.buk_employee_id,
    worker_row.document_type,
    worker_row.document_number,
    worker_row.full_name,
    worker_row.job_title,
    worker_row.contract_code,
    worker_row.area_name,
    trim(coalesce(p_payload ->> 'incidentPlace', '')),
    resolved_incident_at,
    nullif(trim(coalesce(p_payload ->> 'equipmentNumber', '')), ''),
    cause_row.id,
    cause_row.name,
    measure_row.id,
    measure_row.name,
    coalesce(nullif(trim(coalesce(p_payload ->> 'regulatoryBasis', '')), ''), cause_row.regulatory_basis),
    trim(coalesce(p_payload ->> 'description', '')),
    current_user_id,
    coalesce(nullif(trim(actor_profile.full_name), ''), 'Usuario ERP'),
    nullif(trim(actor_profile.email), ''),
    resolved_due_at,
    normalized_idempotency
  )
  returning * into inserted_row;

  insert into public.hr_sanction_request_history (
    sanction_request_id,
    action_type,
    to_status,
    actor_user_id,
    comment,
    metadata
  )
  values (
    inserted_row.id,
    'created',
    inserted_row.status,
    current_user_id,
    case
      when incident_lag > interval '48 hours' then 'Solicitud ingresada fuera del plazo ideal de 48 horas.'
      else null
    end,
    jsonb_build_object(
      'source', 'erp',
      'incidentLagHours', extract(epoch from incident_lag) / 3600,
      'sourceRequirement', 'RE Desarrollo Modulo Cartas de Amonestacion'
    )
  );

  return query
  select inserted_row.id, inserted_row.folio, inserted_row.status, inserted_row.due_at, incident_lag > interval '48 hours';
end;
$function$;

create or replace function public.register_hr_sanction_document(
  p_request_id uuid,
  p_document_type text,
  p_file_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  request_row record;
  inserted_id uuid;
begin
  if not public.user_can_access_hr_sanctions(current_user_id) then
    raise exception 'Sin permisos para registrar documentos de sancion';
  end if;

  select *
  into request_row
  from public.hr_sanction_requests hsr
  where hsr.id = p_request_id
    and (
      hsr.requester_user_id = current_user_id
      or public.user_can_manage_hr_sanctions(current_user_id)
    );

  if not found then
    raise exception 'Solicitud no encontrada o fuera de alcance';
  end if;

  if p_file_path not like ('evidence/' || current_user_id::text || '/%')
     and not public.user_can_manage_hr_sanctions(current_user_id) then
    raise exception 'Ruta de documento no autorizada';
  end if;

  insert into public.hr_sanction_documents (
    sanction_request_id,
    document_type,
    file_path,
    file_name,
    mime_type,
    file_size,
    uploaded_by
  )
  values (
    p_request_id,
    p_document_type,
    trim(p_file_path),
    trim(p_file_name),
    trim(p_mime_type),
    p_file_size,
    current_user_id
  )
  returning id into inserted_id;

  insert into public.hr_sanction_request_history (
    sanction_request_id,
    action_type,
    actor_user_id,
    metadata
  )
  values (
    p_request_id,
    'document_uploaded',
    current_user_id,
    jsonb_build_object('documentType', p_document_type, 'fileName', p_file_name)
  );

  return inserted_id;
end;
$function$;

create or replace function public.transition_hr_sanction_request(
  p_request_id uuid,
  p_next_status text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  request_row record;
  normalized_status text := trim(coalesce(p_next_status, ''));
begin
  if not public.user_can_manage_hr_sanctions(current_user_id) then
    raise exception 'Sin permisos para resolver solicitudes de sancion';
  end if;

  if normalized_status not in (
    'under_review',
    'returned',
    'rejected',
    'issued',
    'pending_signature',
    'pending_certified_mail',
    'pending_dt_filing',
    'closed',
    'expired',
    'cancelled'
  ) then
    raise exception 'Estado de sancion invalido';
  end if;

  select *
  into request_row
  from public.hr_sanction_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  update public.hr_sanction_requests
  set status = normalized_status,
      closed_at = case when normalized_status = 'closed' then timezone('utc', now()) else closed_at end,
      closed_by = case when normalized_status = 'closed' then current_user_id else closed_by end,
      returned_reason = case when normalized_status = 'returned' then nullif(trim(coalesce(p_comment, '')), '') else returned_reason end,
      rejected_reason = case when normalized_status = 'rejected' then nullif(trim(coalesce(p_comment, '')), '') else rejected_reason end,
      buk_upload_status = case
        when normalized_status in ('closed', 'pending_dt_filing') then 'pending'
        else buk_upload_status
      end
  where id = p_request_id;

  insert into public.hr_sanction_request_history (
    sanction_request_id,
    action_type,
    from_status,
    to_status,
    actor_user_id,
    comment
  )
  values (
    p_request_id,
    'status_changed',
    request_row.status,
    normalized_status,
    current_user_id,
    nullif(trim(coalesce(p_comment, '')), '')
  );
end;
$function$;

create or replace function public.get_hr_sanction_requests_page(
  p_status text default null,
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  can_manage boolean;
  normalized_status text := nullif(trim(coalesce(p_status, '')), '');
  normalized_search text := lower(trim(coalesce(p_search, '')));
  safe_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  safe_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if not public.user_can_access_hr_sanctions(current_user_id) then
    raise exception 'Sin permisos para consultar solicitudes de sancion';
  end if;

  can_manage := public.user_can_manage_hr_sanctions(current_user_id);

  return (
    with scoped as (
      select hsr.*
      from public.hr_sanction_requests hsr
      where (can_manage or hsr.requester_user_id = current_user_id)
        and (normalized_status is null or hsr.status = normalized_status)
        and (
          normalized_search = ''
          or lower(concat_ws(' ', hsr.folio::text, hsr.employee_full_name, hsr.employee_document_number, hsr.cause_name, hsr.measure_name, hsr.incident_place, hsr.equipment_number)) like '%' || normalized_search || '%'
        )
    ),
    page_rows as (
      select *
      from scoped
      order by created_at desc, folio desc
      limit safe_limit
      offset safe_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from scoped),
      'kpis', jsonb_build_object(
        'total', (select count(*) from scoped),
        'submitted', (select count(*) from scoped where status = 'submitted'),
        'under_review', (select count(*) from scoped where status = 'under_review'),
        'issued', (select count(*) from scoped where status = 'issued'),
        'pending_signature', (select count(*) from scoped where status = 'pending_signature'),
        'closed', (select count(*) from scoped where status = 'closed'),
        'overdue', (select count(*) from scoped where status not in ('closed', 'rejected', 'cancelled') and due_at < timezone('utc', now()))
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', pr.id,
          'folio', pr.folio,
          'employee_buk_employee_id', pr.employee_buk_employee_id,
          'employee_full_name', pr.employee_full_name,
          'employee_document_number', pr.employee_document_number,
          'employee_job_title', pr.employee_job_title,
          'employee_contract_code', pr.employee_contract_code,
          'employee_area_name', pr.employee_area_name,
          'incident_place', pr.incident_place,
          'incident_at', pr.incident_at,
          'equipment_number', pr.equipment_number,
          'cause_name', pr.cause_name,
          'measure_name', pr.measure_name,
          'status', pr.status,
          'due_at', pr.due_at,
          'created_at', pr.created_at,
          'requester_name', pr.requester_name,
          'buk_upload_status', pr.buk_upload_status,
          'documents_count', (
            select count(*)
            from public.hr_sanction_documents hsd
            where hsd.sanction_request_id = pr.id
          )
        ) order by pr.created_at desc, pr.folio desc)
        from page_rows pr
      ), '[]'::jsonb)
    )
  );
end;
$function$;

create or replace function public.get_hr_sanction_request_detail(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  can_manage boolean;
  request_row record;
begin
  if not public.user_can_access_hr_sanctions(current_user_id) then
    raise exception 'Sin permisos para consultar la solicitud de sancion';
  end if;

  can_manage := public.user_can_manage_hr_sanctions(current_user_id);

  select *
  into request_row
  from public.hr_sanction_requests hsr
  where hsr.id = p_request_id
    and (can_manage or hsr.requester_user_id = current_user_id);

  if not found then
    raise exception 'Solicitud no encontrada o fuera de alcance';
  end if;

  return jsonb_build_object(
    'request', to_jsonb(request_row),
    'documents', (
      select coalesce(jsonb_agg(to_jsonb(hsd) order by hsd.uploaded_at desc), '[]'::jsonb)
      from public.hr_sanction_documents hsd
      where hsd.sanction_request_id = p_request_id
    ),
    'history', (
      select coalesce(jsonb_agg(to_jsonb(hsh) order by hsh.created_at desc), '[]'::jsonb)
      from public.hr_sanction_request_history hsh
      where hsh.sanction_request_id = p_request_id
    )
  );
end;
$function$;

revoke all on function public.user_can_access_hr_sanctions(uuid) from public, anon, authenticated;
revoke all on function public.user_can_manage_hr_sanctions(uuid) from public, anon, authenticated;
revoke all on function public.get_hr_sanction_setup_catalogs() from public, anon, authenticated;
revoke all on function public.search_hr_sanction_workers(text, integer) from public, anon, authenticated;
revoke all on function public.create_hr_sanction_request(jsonb, text) from public, anon, authenticated;
revoke all on function public.register_hr_sanction_document(uuid, text, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.transition_hr_sanction_request(uuid, text, text) from public, anon, authenticated;
revoke all on function public.get_hr_sanction_requests_page(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.get_hr_sanction_request_detail(uuid) from public, anon, authenticated;

grant execute on function public.get_hr_sanction_setup_catalogs() to authenticated;
grant execute on function public.user_can_access_hr_sanctions(uuid) to authenticated;
grant execute on function public.user_can_manage_hr_sanctions(uuid) to authenticated;
grant execute on function public.search_hr_sanction_workers(text, integer) to authenticated;
grant execute on function public.create_hr_sanction_request(jsonb, text) to authenticated;
grant execute on function public.register_hr_sanction_document(uuid, text, text, text, text, bigint) to authenticated;
grant execute on function public.transition_hr_sanction_request(uuid, text, text) to authenticated;
grant execute on function public.get_hr_sanction_requests_page(text, text, integer, integer) to authenticated;
grant execute on function public.get_hr_sanction_request_detail(uuid) to authenticated;

drop policy if exists "hr_sanctions_insert_evidence_scoped" on storage.objects;
create policy "hr_sanctions_insert_evidence_scoped"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'hr-sanctions'
  and name like ('evidence/' || (select auth.uid())::text || '/%')
  and public.user_can_access_hr_sanctions((select auth.uid()))
);

drop policy if exists "hr_sanctions_select_scoped" on storage.objects;
create policy "hr_sanctions_select_scoped"
on storage.objects for select
to authenticated
using (
  bucket_id = 'hr-sanctions'
  and (
    public.user_can_manage_hr_sanctions((select auth.uid()))
    or exists (
      select 1
      from public.hr_sanction_documents hsd
      join public.hr_sanction_requests hsr on hsr.id = hsd.sanction_request_id
      where hsd.file_path = storage.objects.name
        and hsr.requester_user_id = (select auth.uid())
    )
  )
);

notify pgrst, 'reload schema';

commit;
