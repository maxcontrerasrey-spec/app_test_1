begin;

insert into public.app_modules (code, name, route, description, sort_order, is_active)
values (
  'acreditacion_personas',
  'Acreditacion de Personas',
  '/acreditacion',
  'Gestion documental y estado de acreditacion operacional por trabajador y faena.',
  58,
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
    ('admin', 'acreditacion_personas'),
    ('control_contratos', 'acreditacion_personas'),
    ('operaciones', 'acreditacion_personas'),
    ('operaciones_l_1', 'acreditacion_personas'),
    ('operaciones_l_2', 'acreditacion_personas'),
    ('gerencia', 'acreditacion_personas'),
    ('director_eje', 'acreditacion_personas'),
    ('director_op', 'acreditacion_personas'),
    ('gerente_general', 'acreditacion_personas'),
    ('administrativo', 'acreditacion_personas')
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

create table if not exists public.accreditation_sites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  site_type text not null default 'contract'
    check (site_type in ('contract', 'cost_center', 'project', 'site', 'other')),
  contract_code text,
  area_code text,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accreditation_sites_code_format check (code = lower(code))
);

create table if not exists public.accreditation_requirements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null default 'general',
  description text,
  is_mandatory boolean not null default true,
  requires_expiry_date boolean not null default false,
  alert_days_before_expiry integer not null default 30 check (alert_days_before_expiry >= 0),
  blocks_accreditation boolean not null default true,
  validity_days integer check (validity_days is null or validity_days > 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accreditation_requirements_code_format check (code = lower(code))
);

create table if not exists public.accreditation_matrix (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.accreditation_sites (id) on delete cascade,
  requirement_id uuid not null references public.accreditation_requirements (id) on delete cascade,
  job_title text,
  job_title_key text generated always as (coalesce(nullif(lower(trim(job_title)), ''), '*')) stored,
  sort_order integer not null default 0,
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (site_id, requirement_id, job_title_key)
);

create table if not exists public.worker_accreditations (
  id uuid primary key default gen_random_uuid(),
  employee_buk_employee_id text not null,
  site_id uuid not null references public.accreditation_sites (id) on delete cascade,
  employee_document_type text not null default 'rut',
  employee_document_number text,
  employee_full_name text not null,
  employee_job_title text,
  contract_code text,
  area_name text,
  accreditation_status text not null default 'pending'
    check (accreditation_status in ('pending', 'approved', 'expiring_soon', 'expired')),
  accreditation_expiry_date date,
  required_documents_total integer not null default 0,
  approved_documents_total integer not null default 0,
  pending_documents_total integer not null default 0,
  expired_documents_total integer not null default 0,
  blocking_documents_total integer not null default 0,
  last_calculated_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (employee_buk_employee_id, site_id)
);

create table if not exists public.worker_document_tracking (
  id uuid primary key default gen_random_uuid(),
  worker_accreditation_id uuid not null references public.worker_accreditations (id) on delete cascade,
  employee_buk_employee_id text not null,
  site_id uuid not null references public.accreditation_sites (id) on delete cascade,
  requirement_id uuid not null references public.accreditation_requirements (id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'submitted', 'approved', 'rejected', 'expired')),
  issue_date date,
  expiry_date date,
  buk_document_id text,
  buk_document_name text,
  buk_document_url text,
  uploaded_at timestamptz,
  uploaded_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewer_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (worker_accreditation_id, requirement_id)
);

create table if not exists public.accreditation_audit_log (
  id bigint generated by default as identity primary key,
  worker_accreditation_id uuid references public.worker_accreditations (id) on delete cascade,
  worker_document_tracking_id uuid references public.worker_document_tracking (id) on delete cascade,
  site_id uuid references public.accreditation_sites (id) on delete cascade,
  employee_buk_employee_id text,
  event_type text not null,
  event_summary text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_accreditation_sites_active
  on public.accreditation_sites (is_active, name);

create index if not exists idx_accreditation_requirements_active
  on public.accreditation_requirements (is_active, category, name);

create index if not exists idx_accreditation_matrix_site_job
  on public.accreditation_matrix (site_id, job_title_key, is_active, sort_order);

create index if not exists idx_worker_accreditations_status
  on public.worker_accreditations (site_id, accreditation_status, accreditation_expiry_date);

create index if not exists idx_worker_accreditations_employee
  on public.worker_accreditations (employee_buk_employee_id, site_id);

create index if not exists idx_worker_document_tracking_worker
  on public.worker_document_tracking (worker_accreditation_id, status, expiry_date);

create index if not exists idx_worker_document_tracking_employee
  on public.worker_document_tracking (employee_buk_employee_id, site_id, requirement_id);

create index if not exists idx_accreditation_audit_log_lookup
  on public.accreditation_audit_log (employee_buk_employee_id, site_id, created_at desc);

drop trigger if exists trg_accreditation_sites_set_updated_at on public.accreditation_sites;
create trigger trg_accreditation_sites_set_updated_at
before update on public.accreditation_sites
for each row
execute function public.set_updated_at();

drop trigger if exists trg_accreditation_requirements_set_updated_at on public.accreditation_requirements;
create trigger trg_accreditation_requirements_set_updated_at
before update on public.accreditation_requirements
for each row
execute function public.set_updated_at();

drop trigger if exists trg_accreditation_matrix_set_updated_at on public.accreditation_matrix;
create trigger trg_accreditation_matrix_set_updated_at
before update on public.accreditation_matrix
for each row
execute function public.set_updated_at();

drop trigger if exists trg_worker_accreditations_set_updated_at on public.worker_accreditations;
create trigger trg_worker_accreditations_set_updated_at
before update on public.worker_accreditations
for each row
execute function public.set_updated_at();

drop trigger if exists trg_worker_document_tracking_set_updated_at on public.worker_document_tracking;
create trigger trg_worker_document_tracking_set_updated_at
before update on public.worker_document_tracking
for each row
execute function public.set_updated_at();

create or replace function public.user_can_manage_accreditation(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_can_access_module(p_user_id, 'acreditacion_personas')
    or public.user_is_admin(p_user_id);
$$;

create or replace function public.log_accreditation_event(
  p_worker_accreditation_id uuid,
  p_worker_document_tracking_id uuid,
  p_site_id uuid,
  p_employee_buk_employee_id text,
  p_event_type text,
  p_event_summary text,
  p_payload jsonb default '{}'::jsonb
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
  insert into public.accreditation_audit_log (
    worker_accreditation_id,
    worker_document_tracking_id,
    site_id,
    employee_buk_employee_id,
    event_type,
    event_summary,
    payload,
    actor_id
  )
  values (
    p_worker_accreditation_id,
    p_worker_document_tracking_id,
    p_site_id,
    p_employee_buk_employee_id,
    trim(coalesce(p_event_type, 'event')),
    trim(coalesce(p_event_summary, 'Evento de acreditacion')),
    coalesce(p_payload, '{}'::jsonb),
    current_user_id
  )
  returning id into created_log_id;

  return created_log_id;
end;
$function$;

create or replace function public.ensure_worker_accreditation(
  p_buk_employee_id text,
  p_site_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_row record;
  existing_id uuid;
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para gestionar acreditaciones';
  end if;

  select
    e.buk_employee_id,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    e.full_name,
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

  if worker_row is null then
    raise exception 'Trabajador activo no encontrado en BUK';
  end if;

  insert into public.worker_accreditations (
    employee_buk_employee_id,
    site_id,
    employee_document_type,
    employee_document_number,
    employee_full_name,
    employee_job_title,
    contract_code,
    area_name,
    created_by
  )
  values (
    worker_row.buk_employee_id,
    p_site_id,
    worker_row.document_type,
    worker_row.document_number,
    worker_row.full_name,
    worker_row.job_title,
    worker_row.contract_code,
    worker_row.area_name,
    current_user_id
  )
  on conflict (employee_buk_employee_id, site_id) do update
  set
    employee_document_type = excluded.employee_document_type,
    employee_document_number = excluded.employee_document_number,
    employee_full_name = excluded.employee_full_name,
    employee_job_title = excluded.employee_job_title,
    contract_code = excluded.contract_code,
    area_name = excluded.area_name,
    updated_at = timezone('utc', now())
  returning id into existing_id;

  return existing_id;
end;
$function$;

create or replace function public.generate_worker_requirements(
  p_buk_employee_id text,
  p_site_id uuid,
  p_force_refresh boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  resolved_worker_accreditation_id uuid;
  worker_job_title text;
  inserted_count integer := 0;
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para generar requisitos de acreditacion';
  end if;

  resolved_worker_accreditation_id := public.ensure_worker_accreditation(p_buk_employee_id, p_site_id);

  select employee_job_title
    into worker_job_title
  from public.worker_accreditations
  where id = resolved_worker_accreditation_id;

  if coalesce(p_force_refresh, false) then
    delete from public.worker_document_tracking
    where worker_document_tracking.worker_accreditation_id = resolved_worker_accreditation_id;
  end if;

  with matched_rules as (
    select distinct on (am.requirement_id)
      am.requirement_id,
      am.site_id,
      am.sort_order
    from public.accreditation_matrix am
    join public.accreditation_requirements ar
      on ar.id = am.requirement_id
    where am.site_id = p_site_id
      and am.is_active = true
      and ar.is_active = true
      and (
        am.job_title is null
        or nullif(lower(trim(am.job_title)), '') = nullif(lower(trim(coalesce(worker_job_title, ''))), '')
      )
    order by am.requirement_id, case when am.job_title is null then 1 else 0 end, am.sort_order asc, am.created_at asc
  )
  insert into public.worker_document_tracking (
    worker_accreditation_id,
    employee_buk_employee_id,
    site_id,
    requirement_id,
    status
  )
  select
    resolved_worker_accreditation_id,
    trim(coalesce(p_buk_employee_id, '')),
    p_site_id,
    mr.requirement_id,
    'pending'
  from matched_rules mr
  on conflict (worker_accreditation_id, requirement_id) do nothing;

  get diagnostics inserted_count = row_count;

  perform public.log_accreditation_event(
    resolved_worker_accreditation_id,
    null,
    p_site_id,
    trim(coalesce(p_buk_employee_id, '')),
    'requirements_generated',
    case
      when coalesce(p_force_refresh, false) then 'Requisitos regenerados para el trabajador'
      else 'Requisitos generados para el trabajador'
    end,
    jsonb_build_object(
      'force_refresh', coalesce(p_force_refresh, false),
      'inserted_count', inserted_count,
      'job_title', worker_job_title
    )
  );

  perform public.recalculate_accreditation_status(p_buk_employee_id, p_site_id);

  return resolved_worker_accreditation_id;
end;
$function$;

create or replace function public.recalculate_accreditation_status(
  p_buk_employee_id text,
  p_site_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  resolved_worker_accreditation_id uuid;
  total_required integer := 0;
  approved_total integer := 0;
  pending_total integer := 0;
  expired_total integer := 0;
  blocking_total integer := 0;
  blocking_open_total integer := 0;
  next_expiry date := null;
  min_alert_days integer := 30;
  next_status text := 'pending';
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para recalcular acreditaciones';
  end if;

  resolved_worker_accreditation_id := public.ensure_worker_accreditation(p_buk_employee_id, p_site_id);

  update public.worker_document_tracking wdt
  set status = 'expired'
  from public.accreditation_requirements ar
  where wdt.worker_accreditation_id = resolved_worker_accreditation_id
    and ar.id = wdt.requirement_id
    and wdt.status = 'approved'
    and ar.requires_expiry_date = true
    and wdt.expiry_date is not null
    and wdt.expiry_date < current_date;

  select
    count(*) filter (where ar.is_mandatory and ar.is_active),
    count(*) filter (where wdt.status = 'approved'),
    count(*) filter (where wdt.status in ('pending', 'submitted', 'rejected')),
    count(*) filter (where wdt.status = 'expired'),
    count(*) filter (where ar.blocks_accreditation and ar.is_active),
    count(*) filter (
      where ar.blocks_accreditation
        and ar.is_active
        and (
          wdt.status <> 'approved'
          or (ar.requires_expiry_date and wdt.expiry_date is not null and wdt.expiry_date < current_date)
          or (ar.requires_expiry_date and wdt.expiry_date is null)
        )
    ),
    min(wdt.expiry_date) filter (
      where ar.blocks_accreditation
        and ar.requires_expiry_date
        and wdt.status = 'approved'
        and wdt.expiry_date is not null
    ),
    min(ar.alert_days_before_expiry) filter (
      where ar.blocks_accreditation
        and ar.requires_expiry_date
        and ar.is_active
    )
  into
    total_required,
    approved_total,
    pending_total,
    expired_total,
    blocking_total,
    blocking_open_total,
    next_expiry,
    min_alert_days
  from public.worker_document_tracking wdt
  join public.accreditation_requirements ar
    on ar.id = wdt.requirement_id
  where wdt.worker_accreditation_id = resolved_worker_accreditation_id;

  if total_required = 0 then
    next_status := 'pending';
  elsif expired_total > 0 or (next_expiry is not null and next_expiry < current_date) then
    next_status := 'expired';
  elsif blocking_open_total > 0 then
    next_status := 'pending';
  elsif next_expiry is not null and next_expiry <= current_date + make_interval(days => coalesce(min_alert_days, 30)) then
    next_status := 'expiring_soon';
  else
    next_status := 'approved';
  end if;

  update public.worker_accreditations
  set
    accreditation_status = next_status,
    accreditation_expiry_date = next_expiry,
    required_documents_total = coalesce(total_required, 0),
    approved_documents_total = coalesce(approved_total, 0),
    pending_documents_total = coalesce(pending_total, 0),
    expired_documents_total = coalesce(expired_total, 0),
    blocking_documents_total = coalesce(blocking_total, 0),
    last_calculated_at = timezone('utc', now())
  where id = resolved_worker_accreditation_id;

  perform public.log_accreditation_event(
    resolved_worker_accreditation_id,
    null,
    p_site_id,
    trim(coalesce(p_buk_employee_id, '')),
    'status_recalculated',
    'Estado de acreditacion recalculado',
    jsonb_build_object(
      'status', next_status,
      'required_documents_total', total_required,
      'approved_documents_total', approved_total,
      'pending_documents_total', pending_total,
      'expired_documents_total', expired_total,
      'blocking_documents_total', blocking_total,
      'accreditation_expiry_date', next_expiry
    )
  );

  return jsonb_build_object(
    'worker_accreditation_id', resolved_worker_accreditation_id,
    'status', next_status,
    'accreditation_expiry_date', next_expiry,
    'required_documents_total', total_required,
    'approved_documents_total', approved_total,
    'pending_documents_total', pending_total,
    'expired_documents_total', expired_total,
    'blocking_documents_total', blocking_total
  );
end;
$function$;

create or replace function public.upsert_accreditation_site(
  p_site_id uuid,
  p_code text,
  p_name text,
  p_site_type text default 'contract',
  p_contract_code text default null,
  p_area_code text default null,
  p_description text default null,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  saved_id uuid;
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para configurar faenas de acreditacion';
  end if;

  insert into public.accreditation_sites (
    id,
    code,
    name,
    site_type,
    contract_code,
    area_code,
    description,
    is_active,
    created_by
  )
  values (
    coalesce(p_site_id, gen_random_uuid()),
    lower(trim(coalesce(p_code, ''))),
    trim(coalesce(p_name, '')),
    coalesce(nullif(trim(p_site_type), ''), 'contract'),
    nullif(trim(coalesce(p_contract_code, '')), ''),
    nullif(trim(coalesce(p_area_code, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_is_active, true),
    current_user_id
  )
  on conflict (id) do update
  set
    code = excluded.code,
    name = excluded.name,
    site_type = excluded.site_type,
    contract_code = excluded.contract_code,
    area_code = excluded.area_code,
    description = excluded.description,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now())
  returning id into saved_id;

  perform public.log_accreditation_event(
    null,
    null,
    saved_id,
    null,
    'site_upserted',
    'Faena de acreditacion guardada',
    jsonb_build_object('site_id', saved_id, 'code', lower(trim(coalesce(p_code, ''))))
  );

  return saved_id;
end;
$function$;

create or replace function public.upsert_accreditation_requirement(
  p_requirement_id uuid,
  p_code text,
  p_name text,
  p_category text default 'general',
  p_description text default null,
  p_is_mandatory boolean default true,
  p_requires_expiry_date boolean default false,
  p_alert_days_before_expiry integer default 30,
  p_blocks_accreditation boolean default true,
  p_validity_days integer default null,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  saved_id uuid;
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para configurar requisitos de acreditacion';
  end if;

  insert into public.accreditation_requirements (
    id,
    code,
    name,
    category,
    description,
    is_mandatory,
    requires_expiry_date,
    alert_days_before_expiry,
    blocks_accreditation,
    validity_days,
    is_active,
    created_by
  )
  values (
    coalesce(p_requirement_id, gen_random_uuid()),
    lower(trim(coalesce(p_code, ''))),
    trim(coalesce(p_name, '')),
    coalesce(nullif(trim(p_category), ''), 'general'),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_is_mandatory, true),
    coalesce(p_requires_expiry_date, false),
    greatest(coalesce(p_alert_days_before_expiry, 30), 0),
    coalesce(p_blocks_accreditation, true),
    p_validity_days,
    coalesce(p_is_active, true),
    current_user_id
  )
  on conflict (id) do update
  set
    code = excluded.code,
    name = excluded.name,
    category = excluded.category,
    description = excluded.description,
    is_mandatory = excluded.is_mandatory,
    requires_expiry_date = excluded.requires_expiry_date,
    alert_days_before_expiry = excluded.alert_days_before_expiry,
    blocks_accreditation = excluded.blocks_accreditation,
    validity_days = excluded.validity_days,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now())
  returning id into saved_id;

  perform public.log_accreditation_event(
    null,
    null,
    null,
    null,
    'requirement_upserted',
    'Requisito de acreditacion guardado',
    jsonb_build_object('requirement_id', saved_id, 'code', lower(trim(coalesce(p_code, ''))))
  );

  return saved_id;
end;
$function$;

create or replace function public.upsert_accreditation_matrix_rule(
  p_rule_id uuid,
  p_site_id uuid,
  p_requirement_id uuid,
  p_job_title text default null,
  p_sort_order integer default 0,
  p_notes text default null,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  saved_id uuid;
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para configurar la matriz de acreditacion';
  end if;

  insert into public.accreditation_matrix (
    id,
    site_id,
    requirement_id,
    job_title,
    sort_order,
    notes,
    is_active,
    created_by
  )
  values (
    coalesce(p_rule_id, gen_random_uuid()),
    p_site_id,
    p_requirement_id,
    nullif(trim(coalesce(p_job_title, '')), ''),
    coalesce(p_sort_order, 0),
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(p_is_active, true),
    current_user_id
  )
  on conflict (id) do update
  set
    site_id = excluded.site_id,
    requirement_id = excluded.requirement_id,
    job_title = excluded.job_title,
    sort_order = excluded.sort_order,
    notes = excluded.notes,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now())
  returning id into saved_id;

  perform public.log_accreditation_event(
    null,
    null,
    p_site_id,
    null,
    'matrix_rule_upserted',
    'Regla de matriz de acreditacion guardada',
    jsonb_build_object(
      'rule_id', saved_id,
      'site_id', p_site_id,
      'requirement_id', p_requirement_id,
      'job_title', nullif(trim(coalesce(p_job_title, '')), '')
    )
  );

  return saved_id;
end;
$function$;

create or replace function public.upsert_worker_accreditation_document(
  p_buk_employee_id text,
  p_site_id uuid,
  p_requirement_id uuid,
  p_status text default 'submitted',
  p_issue_date date default null,
  p_expiry_date date default null,
  p_buk_document_id text default null,
  p_buk_document_name text default null,
  p_buk_document_url text default null,
  p_reviewer_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  resolved_worker_accreditation_id uuid;
  saved_id uuid;
  normalized_status text := lower(trim(coalesce(p_status, 'submitted')));
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para registrar documentos de acreditacion';
  end if;

  if normalized_status not in ('pending', 'submitted', 'approved', 'rejected', 'expired') then
    raise exception 'Estado documental invalido para acreditacion';
  end if;

  resolved_worker_accreditation_id := public.generate_worker_requirements(p_buk_employee_id, p_site_id, false);

  insert into public.worker_document_tracking (
    worker_accreditation_id,
    employee_buk_employee_id,
    site_id,
    requirement_id,
    status,
    issue_date,
    expiry_date,
    buk_document_id,
    buk_document_name,
    buk_document_url,
    uploaded_at,
    uploaded_by,
    reviewed_at,
    reviewed_by,
    reviewer_notes,
    metadata
  )
  values (
    resolved_worker_accreditation_id,
    trim(coalesce(p_buk_employee_id, '')),
    p_site_id,
    p_requirement_id,
    normalized_status,
    p_issue_date,
    p_expiry_date,
    nullif(trim(coalesce(p_buk_document_id, '')), ''),
    nullif(trim(coalesce(p_buk_document_name, '')), ''),
    nullif(trim(coalesce(p_buk_document_url, '')), ''),
    timezone('utc', now()),
    current_user_id,
    case when normalized_status in ('approved', 'rejected') then timezone('utc', now()) else null end,
    case when normalized_status in ('approved', 'rejected') then current_user_id else null end,
    nullif(trim(coalesce(p_reviewer_notes, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (worker_accreditation_id, requirement_id) do update
  set
    status = excluded.status,
    issue_date = excluded.issue_date,
    expiry_date = excluded.expiry_date,
    buk_document_id = excluded.buk_document_id,
    buk_document_name = excluded.buk_document_name,
    buk_document_url = excluded.buk_document_url,
    uploaded_at = excluded.uploaded_at,
    uploaded_by = excluded.uploaded_by,
    reviewed_at = excluded.reviewed_at,
    reviewed_by = excluded.reviewed_by,
    reviewer_notes = excluded.reviewer_notes,
    metadata = excluded.metadata,
    updated_at = timezone('utc', now())
  returning id into saved_id;

  perform public.log_accreditation_event(
    resolved_worker_accreditation_id,
    saved_id,
    p_site_id,
    trim(coalesce(p_buk_employee_id, '')),
    'document_upserted',
    'Documento de acreditacion registrado o actualizado',
    jsonb_build_object(
      'requirement_id', p_requirement_id,
      'status', normalized_status,
      'buk_document_id', nullif(trim(coalesce(p_buk_document_id, '')), ''),
      'buk_document_name', nullif(trim(coalesce(p_buk_document_name, '')), '')
    )
  );

  perform public.recalculate_accreditation_status(p_buk_employee_id, p_site_id);

  return saved_id;
end;
$function$;

create or replace function public.get_accreditation_setup_catalogs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para consultar configuracion de acreditacion';
  end if;

  return jsonb_build_object(
    'sites',
    (
      select coalesce(jsonb_agg(site_row order by site_row->>'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', s.id,
          'code', s.code,
          'name', s.name,
          'site_type', s.site_type,
          'contract_code', s.contract_code,
          'area_code', s.area_code,
          'description', s.description,
          'is_active', s.is_active
        ) as site_row
        from public.accreditation_sites s
      ) ranked_sites
    ),
    'requirements',
    (
      select coalesce(jsonb_agg(requirement_row order by requirement_row->>'category', requirement_row->>'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', r.id,
          'code', r.code,
          'name', r.name,
          'category', r.category,
          'description', r.description,
          'is_mandatory', r.is_mandatory,
          'requires_expiry_date', r.requires_expiry_date,
          'alert_days_before_expiry', r.alert_days_before_expiry,
          'blocks_accreditation', r.blocks_accreditation,
          'validity_days', r.validity_days,
          'is_active', r.is_active
        ) as requirement_row
        from public.accreditation_requirements r
      ) ranked_requirements
    ),
    'matrix_rules',
    (
      select coalesce(jsonb_agg(rule_row order by (rule_row->>'site_name'), (rule_row->>'sort_order')::integer, rule_row->>'requirement_name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', m.id,
          'site_id', m.site_id,
          'site_name', s.name,
          'requirement_id', m.requirement_id,
          'requirement_name', r.name,
          'job_title', m.job_title,
          'sort_order', m.sort_order,
          'notes', m.notes,
          'is_active', m.is_active
        ) as rule_row
        from public.accreditation_matrix m
        join public.accreditation_sites s
          on s.id = m.site_id
        join public.accreditation_requirements r
          on r.id = m.requirement_id
      ) ranked_rules
    ),
    'buk_job_titles',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('value', job_title, 'label', job_title)
          order by job_title
        ),
        '[]'::jsonb
      )
      from (
        select distinct
          coalesce(
            nullif(trim(e.job_title), ''),
            nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
            nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
            nullif(trim(e.raw_payload ->> 'job_title'), '')
          ) as job_title
        from public.employees_active_current e
      ) active_job_titles
      where job_title is not null
        and job_title <> ''
    )
  );
end;
$function$;

create or replace function public.search_accreditation_workers(
  p_search text default null,
  p_site_id uuid default null,
  p_status text default null,
  p_limit integer default 50
)
returns table (
  worker_accreditation_id uuid,
  buk_employee_id text,
  full_name text,
  document_number text,
  document_type text,
  job_title text,
  contract_code text,
  area_name text,
  site_id uuid,
  site_name text,
  accreditation_status text,
  accreditation_expiry_date date,
  required_documents_total integer,
  approved_documents_total integer,
  pending_documents_total integer,
  expired_documents_total integer,
  roster_pattern_name text,
  roster_start_date date
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para consultar trabajadores acreditados';
  end if;

  return query
  with target_site as (
    select s.id, s.name
    from public.accreditation_sites s
    where s.id = p_site_id
  ),
  active_workers as (
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
      ) as job_title,
      nullif(trim(e.contract_code), '') as contract_code,
      nullif(trim(e.area_name), '') as area_name
    from public.employees_active_current e
    order by e.buk_employee_id, e.updated_at desc nulls last, e.created_at desc nulls last
  ),
  roster_active as (
    select distinct on (wr.employee_buk_employee_id)
      wr.employee_buk_employee_id,
      sp.name as pattern_name,
      wr.start_date
    from public.hr_worker_rosters wr
    join public.hr_shift_patterns sp
      on sp.id = wr.pattern_id
    where wr.start_date <= current_date
      and (wr.end_date is null or wr.end_date >= current_date)
    order by wr.employee_buk_employee_id, wr.start_date desc, wr.created_at desc
  )
  select
    wa.id,
    aw.buk_employee_id,
    aw.full_name,
    aw.document_number,
    aw.document_type,
    aw.job_title,
    aw.contract_code,
    aw.area_name,
    coalesce(wa.site_id, ts.id),
    coalesce(s.name, ts.name),
    coalesce(wa.accreditation_status, 'pending'),
    wa.accreditation_expiry_date,
    coalesce(wa.required_documents_total, 0),
    coalesce(wa.approved_documents_total, 0),
    coalesce(wa.pending_documents_total, 0),
    coalesce(wa.expired_documents_total, 0),
    ra.pattern_name,
    ra.start_date
  from active_workers aw
  left join target_site ts
    on true
  left join public.worker_accreditations wa
    on wa.employee_buk_employee_id = aw.buk_employee_id
    and (p_site_id is null or wa.site_id = p_site_id)
  left join public.accreditation_sites s
    on s.id = wa.site_id
  left join roster_active ra
    on ra.employee_buk_employee_id = aw.buk_employee_id
  where (p_site_id is not null or wa.id is not null)
    and (p_status is null or trim(p_status) = '' or coalesce(wa.accreditation_status, 'pending') = trim(p_status))
    and (
      normalized_search = ''
      or lower(
        concat_ws(
          ' ',
          aw.full_name,
          coalesce(aw.document_number, ''),
          coalesce(aw.job_title, ''),
          coalesce(aw.contract_code, ''),
          coalesce(aw.area_name, ''),
          coalesce(s.name, ts.name, '')
        )
      ) like '%' || normalized_search || '%'
    )
  order by
    case coalesce(wa.accreditation_status, 'pending')
      when 'expired' then 0
      when 'pending' then 1
      when 'expiring_soon' then 2
      else 3
    end,
    wa.accreditation_expiry_date nulls last,
    aw.full_name asc
  limit safe_limit;
end;
$function$;

create or replace function public.get_worker_accreditation_profile(
  p_buk_employee_id text,
  p_site_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  resolved_worker_accreditation_id uuid;
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para consultar el perfil de acreditacion';
  end if;

  resolved_worker_accreditation_id := public.generate_worker_requirements(p_buk_employee_id, p_site_id, false);

  perform public.recalculate_accreditation_status(p_buk_employee_id, p_site_id);

  return (
    with roster_context as (
      select jsonb_build_object(
        'pattern_name', sp.name,
        'pattern_code', sp.code,
        'start_date', wr.start_date,
        'end_date', wr.end_date
      ) as payload
      from public.hr_worker_rosters wr
      join public.hr_shift_patterns sp
        on sp.id = wr.pattern_id
      where wr.employee_buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
        and wr.start_date <= current_date
        and (wr.end_date is null or wr.end_date >= current_date)
      order by wr.start_date desc, wr.created_at desc
      limit 1
    ),
    today_exceptions as (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'exception_date', hre.exception_date,
            'exception_type', hre.exception_type,
            'notes', hre.notes,
            'is_active', hre.is_active
          )
          order by hre.exception_date desc
        ),
        '[]'::jsonb
      ) as payload
      from public.hr_roster_exceptions hre
      where hre.employee_buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
        and hre.is_active = true
        and hre.exception_date between current_date - 7 and current_date + 7
    ),
    document_rows as (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'document_tracking_id', wdt.id,
            'requirement_id', ar.id,
            'requirement_code', ar.code,
            'requirement_name', ar.name,
            'category', ar.category,
            'description', ar.description,
            'is_mandatory', ar.is_mandatory,
            'requires_expiry_date', ar.requires_expiry_date,
            'alert_days_before_expiry', ar.alert_days_before_expiry,
            'blocks_accreditation', ar.blocks_accreditation,
            'status', wdt.status,
            'issue_date', wdt.issue_date,
            'expiry_date', wdt.expiry_date,
            'buk_document_id', wdt.buk_document_id,
            'buk_document_name', wdt.buk_document_name,
            'buk_document_url', wdt.buk_document_url,
            'reviewed_at', wdt.reviewed_at,
            'reviewer_notes', wdt.reviewer_notes,
            'metadata', wdt.metadata
          )
          order by ar.category asc, ar.name asc
        ),
        '[]'::jsonb
      ) as payload
      from public.worker_document_tracking wdt
      join public.accreditation_requirements ar
        on ar.id = wdt.requirement_id
      where wdt.worker_accreditation_id = resolved_worker_accreditation_id
    ),
    audit_rows as (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', aal.id,
            'event_type', aal.event_type,
            'event_summary', aal.event_summary,
            'payload', aal.payload,
            'actor_id', aal.actor_id,
            'created_at', aal.created_at,
            'actor_name', p.full_name
          )
          order by aal.created_at desc
        ),
        '[]'::jsonb
      ) as payload
      from public.accreditation_audit_log aal
      left join public.profiles p
        on p.id = aal.actor_id
      where aal.worker_accreditation_id = resolved_worker_accreditation_id
    )
    select jsonb_build_object(
      'worker',
      jsonb_build_object(
        'worker_accreditation_id', wa.id,
        'buk_employee_id', wa.employee_buk_employee_id,
        'full_name', wa.employee_full_name,
        'document_number', wa.employee_document_number,
        'document_type', wa.employee_document_type,
        'job_title', wa.employee_job_title,
        'contract_code', wa.contract_code,
        'area_name', wa.area_name,
        'site_id', wa.site_id,
        'site_name', s.name,
        'site_code', s.code,
        'accreditation_status', wa.accreditation_status,
        'accreditation_expiry_date', wa.accreditation_expiry_date,
        'required_documents_total', wa.required_documents_total,
        'approved_documents_total', wa.approved_documents_total,
        'pending_documents_total', wa.pending_documents_total,
        'expired_documents_total', wa.expired_documents_total
      ),
      'roster_context', (select payload from roster_context),
      'recent_roster_exceptions', (select payload from today_exceptions),
      'documents', (select payload from document_rows),
      'audit_log', (select payload from audit_rows)
    )
    from public.worker_accreditations wa
    join public.accreditation_sites s
      on s.id = wa.site_id
    where wa.id = resolved_worker_accreditation_id
  );
end;
$function$;

create or replace function public.get_accreditation_dashboard(
  p_site_id uuid default null,
  p_job_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_job_title text := nullif(lower(trim(coalesce(p_job_title, ''))), '');
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para consultar el dashboard de acreditaciones';
  end if;

  return (
    with scoped as (
      select
        wa.*,
        s.name as site_name
      from public.worker_accreditations wa
      join public.accreditation_sites s
        on s.id = wa.site_id
      where (p_site_id is null or wa.site_id = p_site_id)
        and (
          normalized_job_title is null
          or nullif(lower(trim(coalesce(wa.employee_job_title, ''))), '') = normalized_job_title
        )
    ),
    summary as (
      select jsonb_build_object(
        'total_workers', count(*),
        'approved', count(*) filter (where accreditation_status = 'approved'),
        'expiring_soon', count(*) filter (where accreditation_status = 'expiring_soon'),
        'pending', count(*) filter (where accreditation_status = 'pending'),
        'expired', count(*) filter (where accreditation_status = 'expired'),
        'expiring_in_7_days', count(*) filter (where accreditation_expiry_date between current_date and current_date + 7),
        'expiring_in_15_days', count(*) filter (where accreditation_expiry_date between current_date and current_date + 15),
        'expiring_in_30_days', count(*) filter (where accreditation_expiry_date between current_date and current_date + 30)
      ) as payload
      from scoped
    ),
    by_site as (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'site_id', site_id,
            'site_name', site_name,
            'total_workers', total_workers,
            'approved', approved,
            'pending', pending,
            'expired', expired,
            'expiring_soon', expiring_soon
          )
          order by site_name
        ),
        '[]'::jsonb
      ) as payload
      from (
        select
          site_id,
          site_name,
          count(*) as total_workers,
          count(*) filter (where accreditation_status = 'approved') as approved,
          count(*) filter (where accreditation_status = 'pending') as pending,
          count(*) filter (where accreditation_status = 'expired') as expired,
          count(*) filter (where accreditation_status = 'expiring_soon') as expiring_soon
        from scoped
        group by site_id, site_name
      ) grouped_sites
    ),
    expiring_workers as (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'worker_accreditation_id', id,
            'buk_employee_id', employee_buk_employee_id,
            'full_name', employee_full_name,
            'job_title', employee_job_title,
            'site_name', site_name,
            'status', accreditation_status,
            'accreditation_expiry_date', accreditation_expiry_date
          )
          order by accreditation_expiry_date asc nulls last, employee_full_name asc
        ),
        '[]'::jsonb
      ) as payload
      from (
        select *
        from scoped
        where accreditation_expiry_date is not null
          and accreditation_expiry_date <= current_date + 30
        order by accreditation_expiry_date asc nulls last, employee_full_name asc
        limit 15
      ) rows_to_expire
    )
    select jsonb_build_object(
      'summary', (select payload from summary),
      'by_site', (select payload from by_site),
      'expiring_workers', (select payload from expiring_workers)
    )
  );
end;
$function$;

alter table public.accreditation_sites enable row level security;
alter table public.accreditation_requirements enable row level security;
alter table public.accreditation_matrix enable row level security;
alter table public.worker_accreditations enable row level security;
alter table public.worker_document_tracking enable row level security;
alter table public.accreditation_audit_log enable row level security;

drop policy if exists "accreditation_sites_select_authenticated" on public.accreditation_sites;
create policy "accreditation_sites_select_authenticated"
on public.accreditation_sites
for select
to authenticated
using (public.user_can_manage_accreditation(auth.uid()));

drop policy if exists "accreditation_requirements_select_authenticated" on public.accreditation_requirements;
create policy "accreditation_requirements_select_authenticated"
on public.accreditation_requirements
for select
to authenticated
using (public.user_can_manage_accreditation(auth.uid()));

drop policy if exists "accreditation_matrix_select_authenticated" on public.accreditation_matrix;
create policy "accreditation_matrix_select_authenticated"
on public.accreditation_matrix
for select
to authenticated
using (public.user_can_manage_accreditation(auth.uid()));

drop policy if exists "worker_accreditations_select_authenticated" on public.worker_accreditations;
create policy "worker_accreditations_select_authenticated"
on public.worker_accreditations
for select
to authenticated
using (public.user_can_manage_accreditation(auth.uid()));

drop policy if exists "worker_document_tracking_select_authenticated" on public.worker_document_tracking;
create policy "worker_document_tracking_select_authenticated"
on public.worker_document_tracking
for select
to authenticated
using (public.user_can_manage_accreditation(auth.uid()));

drop policy if exists "accreditation_audit_log_select_authenticated" on public.accreditation_audit_log;
create policy "accreditation_audit_log_select_authenticated"
on public.accreditation_audit_log
for select
to authenticated
using (public.user_can_manage_accreditation(auth.uid()));

grant select on public.accreditation_sites to authenticated;
grant select on public.accreditation_requirements to authenticated;
grant select on public.accreditation_matrix to authenticated;
grant select on public.worker_accreditations to authenticated;
grant select on public.worker_document_tracking to authenticated;
grant select on public.accreditation_audit_log to authenticated;

revoke all on function public.user_can_manage_accreditation(uuid) from public, anon;
grant execute on function public.user_can_manage_accreditation(uuid) to authenticated;

revoke all on function public.log_accreditation_event(uuid, uuid, uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.log_accreditation_event(uuid, uuid, uuid, text, text, text, jsonb) to authenticated;

revoke all on function public.ensure_worker_accreditation(text, uuid) from public, anon;
grant execute on function public.ensure_worker_accreditation(text, uuid) to authenticated;

revoke all on function public.generate_worker_requirements(text, uuid, boolean) from public, anon;
grant execute on function public.generate_worker_requirements(text, uuid, boolean) to authenticated;

revoke all on function public.recalculate_accreditation_status(text, uuid) from public, anon;
grant execute on function public.recalculate_accreditation_status(text, uuid) to authenticated;

revoke all on function public.upsert_accreditation_site(uuid, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.upsert_accreditation_site(uuid, text, text, text, text, text, text, boolean) to authenticated;

revoke all on function public.upsert_accreditation_requirement(uuid, text, text, text, text, boolean, boolean, integer, boolean, integer, boolean) from public, anon;
grant execute on function public.upsert_accreditation_requirement(uuid, text, text, text, text, boolean, boolean, integer, boolean, integer, boolean) to authenticated;

revoke all on function public.upsert_accreditation_matrix_rule(uuid, uuid, uuid, text, integer, text, boolean) from public, anon;
grant execute on function public.upsert_accreditation_matrix_rule(uuid, uuid, uuid, text, integer, text, boolean) to authenticated;

revoke all on function public.upsert_worker_accreditation_document(text, uuid, uuid, text, date, date, text, text, text, text, jsonb) from public, anon;
grant execute on function public.upsert_worker_accreditation_document(text, uuid, uuid, text, date, date, text, text, text, text, jsonb) to authenticated;

revoke all on function public.get_accreditation_setup_catalogs() from public, anon;
grant execute on function public.get_accreditation_setup_catalogs() to authenticated;

revoke all on function public.search_accreditation_workers(text, uuid, text, integer) from public, anon;
grant execute on function public.search_accreditation_workers(text, uuid, text, integer) to authenticated;

revoke all on function public.get_worker_accreditation_profile(text, uuid) from public, anon;
grant execute on function public.get_worker_accreditation_profile(text, uuid) to authenticated;

revoke all on function public.get_accreditation_dashboard(uuid, text) from public, anon;
grant execute on function public.get_accreditation_dashboard(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
