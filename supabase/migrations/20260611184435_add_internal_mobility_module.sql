begin;

insert into public.app_modules (code, name, route, description, sort_order, is_active)
values (
  'movilidad_interna',
  'Movilidad Interna',
  '/movilidad-interna',
  'Solicitud y seguimiento de traslados internos de trabajadores activos.',
  15,
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
    ('admin', 'movilidad_interna'),
    ('reclutamiento', 'movilidad_interna'),
    ('control_contratos', 'movilidad_interna'),
    ('gerencia', 'movilidad_interna'),
    ('director_eje', 'movilidad_interna'),
    ('director_op', 'movilidad_interna'),
    ('gerente_general', 'movilidad_interna'),
    ('operaciones_l_1', 'movilidad_interna'),
    ('operaciones_l_2', 'movilidad_interna'),
    ('administrativo', 'movilidad_interna')
)
insert into public.role_module_access (role_code, module_code, can_view)
select dm.role_code, dm.module_code, true
from desired_modules dm
join public.app_modules am
  on am.code = dm.module_code
on conflict (role_code, module_code) do update
set can_view = true;

alter table public.buk_contract_mappings
  add column if not exists company_name text,
  add column if not exists buk_area_code text;

create or replace function public.extract_buk_company_name(p_payload jsonb)
returns text
language sql
immutable
as $function$
  select nullif(
    trim(
      coalesce(
        p_payload -> 'company' ->> 'name',
        p_payload ->> 'company_name',
        p_payload ->> 'company',
        p_payload -> 'current_job' -> 'company' ->> 'name',
        p_payload -> 'current_job' ->> 'company_name',
        p_payload -> 'current_job' -> 'legal_entity' ->> 'name',
        p_payload -> 'current_job' ->> 'legal_entity_name',
        p_payload -> 'employee' -> 'company' ->> 'name'
      )
    ),
    ''
  );
$function$;

create or replace function public.resolve_buk_area_code(p_area_name text)
returns text
language sql
stable
security definer
set search_path = public
as $function$
  with normalized_area as (
    select public.normalize_buk_area_name(p_area_name) as area_name_normalized
  ),
  ranked_codes as (
    select
      nullif(trim(e.area_code), '') as area_code,
      max(coalesce(e.updated_at, e.created_at, '-infinity'::timestamptz)) as latest_activity_at,
      count(*) as row_count,
      row_number() over (
        order by
          count(*) desc,
          max(coalesce(e.updated_at, e.created_at, '-infinity'::timestamptz)) desc,
          nullif(trim(e.area_code), '') asc
      ) as row_rank
    from public.employees e
    cross join normalized_area na
    where na.area_name_normalized is not null
      and public.normalize_buk_area_name(e.area_name) = na.area_name_normalized
      and nullif(trim(e.area_code), '') is not null
    group by nullif(trim(e.area_code), '')
  )
  select rc.area_code
  from ranked_codes rc
  where rc.row_rank = 1;
$function$;

create or replace function public.resolve_buk_area_company_name(p_area_name text)
returns text
language sql
stable
security definer
set search_path = public
as $function$
  with normalized_area as (
    select public.normalize_buk_area_name(p_area_name) as area_name_normalized
  ),
  ranked_companies as (
    select
      public.extract_buk_company_name(e.raw_payload) as company_name,
      max(coalesce(e.updated_at, e.created_at, '-infinity'::timestamptz)) as latest_activity_at,
      count(*) as row_count,
      row_number() over (
        order by
          count(*) desc,
          max(coalesce(e.updated_at, e.created_at, '-infinity'::timestamptz)) desc,
          public.extract_buk_company_name(e.raw_payload) asc
      ) as row_rank
    from public.employees e
    cross join normalized_area na
    where na.area_name_normalized is not null
      and public.normalize_buk_area_name(e.area_name) = na.area_name_normalized
      and nullif(trim(coalesce(public.extract_buk_company_name(e.raw_payload), '')), '') is not null
    group by public.extract_buk_company_name(e.raw_payload)
  )
  select rc.company_name
  from ranked_companies rc
  where rc.row_rank = 1;
$function$;

update public.buk_contract_mappings bcm
set
  company_name = coalesce(nullif(trim(bcm.company_name), ''), public.resolve_buk_area_company_name(bcm.buk_area_name)),
  buk_area_code = coalesce(nullif(trim(bcm.buk_area_code), ''), public.resolve_buk_area_code(bcm.buk_area_name))
where nullif(trim(coalesce(bcm.company_name, '')), '') is null
   or nullif(trim(coalesce(bcm.buk_area_code, '')), '') is null;

create sequence if not exists public.internal_mobility_folio_seq;

create table if not exists public.internal_mobility_requests (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  requester_id uuid not null references public.profiles (id) on delete restrict,
  requester_name text not null,
  requester_job_title text,
  requester_email text,
  employee_buk_employee_id text not null,
  employee_document_number text,
  employee_document_type text,
  employee_full_name text not null,
  current_job_title text,
  current_contract_code text,
  current_area_name text,
  current_area_code text,
  current_company_name text not null,
  destination_job_title text not null,
  destination_contract_id bigint not null references public.contracts (id) on delete restrict,
  destination_contract_code text,
  destination_contract_number text,
  destination_area_name text not null,
  destination_area_code text,
  destination_cost_center_code text,
  destination_cost_center_name text,
  destination_company_name text not null,
  requires_termination boolean not null default false,
  motive text not null,
  status text not null default 'pending_area_manager'
    check (status in ('pending_area_manager', 'pending_contracts_control', 'approved', 'rejected', 'closed')),
  current_step_code text
    check (current_step_code in ('area_manager', 'contracts_control')),
  submitted_at timestamptz not null default timezone('utc', now()),
  submitted_by uuid not null references public.profiles (id) on delete restrict,
  approved_at timestamptz,
  rejected_at timestamptz,
  final_decided_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.internal_mobility_request_approvals (
  id bigint generated by default as identity primary key,
  internal_mobility_request_id uuid not null references public.internal_mobility_requests (id) on delete cascade,
  step_code text not null
    check (step_code in ('requester_signature', 'area_manager', 'contracts_control')),
  step_name text not null,
  step_order smallint not null check (step_order between 1 and 3),
  approver_user_id uuid references public.profiles (id) on delete set null,
  approver_name text,
  approver_email text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  decision_by uuid references public.profiles (id) on delete set null,
  decision_comment text,
  decided_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint internal_mobility_request_approvals_unique_step unique (internal_mobility_request_id, step_code)
);

create table if not exists public.internal_mobility_request_snapshots (
  id bigint generated by default as identity primary key,
  internal_mobility_request_id uuid not null references public.internal_mobility_requests (id) on delete cascade,
  snapshot_type text not null
    check (snapshot_type in ('submitted')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.internal_mobility_request_audit_log (
  id bigint generated by default as identity primary key,
  internal_mobility_request_id uuid not null references public.internal_mobility_requests (id) on delete cascade,
  approval_id bigint references public.internal_mobility_request_approvals (id) on delete set null,
  actor_user_id uuid not null references public.profiles (id) on delete restrict,
  action_type text not null
    check (action_type in ('submitted', 'approval_created', 'approved', 'rejected')),
  old_values jsonb,
  new_values jsonb,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_internal_mobility_requests_requester_created_at
  on public.internal_mobility_requests (requester_id, created_at desc);
create index if not exists idx_internal_mobility_requests_status_created_at
  on public.internal_mobility_requests (status, created_at desc);
create index if not exists idx_internal_mobility_requests_destination_cost_center
  on public.internal_mobility_requests (destination_cost_center_code);
create index if not exists idx_internal_mobility_request_approvals_approver_status
  on public.internal_mobility_request_approvals (approver_user_id, status, created_at);
create index if not exists idx_internal_mobility_request_approvals_request_step
  on public.internal_mobility_request_approvals (internal_mobility_request_id, step_code, status);
create index if not exists idx_internal_mobility_request_snapshots_request_id
  on public.internal_mobility_request_snapshots (internal_mobility_request_id);
create index if not exists idx_internal_mobility_request_audit_log_request_id
  on public.internal_mobility_request_audit_log (internal_mobility_request_id, created_at desc);
create index if not exists idx_internal_mobility_request_audit_log_actor_id
  on public.internal_mobility_request_audit_log (actor_user_id);

drop trigger if exists trg_internal_mobility_requests_set_updated_at on public.internal_mobility_requests;
create trigger trg_internal_mobility_requests_set_updated_at
before update on public.internal_mobility_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_internal_mobility_request_approvals_set_updated_at on public.internal_mobility_request_approvals;
create trigger trg_internal_mobility_request_approvals_set_updated_at
before update on public.internal_mobility_request_approvals
for each row execute function public.set_updated_at();

create or replace function public.user_can_view_internal_mobility_request_summary(
  target_user_id uuid,
  requester_user_id uuid,
  destination_cost_center_code text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    target_user_id is not null
    and (
      public.user_is_admin(target_user_id)
      or public.user_has_role(target_user_id, 'reclutamiento')
      or public.user_has_role(target_user_id, 'control_contratos')
      or public.user_has_role(target_user_id, 'director_eje')
      or public.user_has_role(target_user_id, 'gerente_general')
      or public.user_has_role(target_user_id, 'director_op')
      or (
        public.user_has_role(target_user_id, 'gerencia')
        and exists (
          select 1
          from public.cost_center_approvers cca
          where cca.cost_center_code = destination_cost_center_code
            and cca.approver_user_id = target_user_id
            and cca.is_active = true
        )
      )
      or (
        not public.user_has_role(target_user_id, 'gerencia')
        and requester_user_id = target_user_id
      )
    );
$function$;

create or replace function public.user_can_view_internal_mobility_request(
  target_user_id uuid,
  target_request_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.internal_mobility_requests imr
    where imr.id = target_request_id
      and public.user_can_view_internal_mobility_request_summary(
        target_user_id,
        imr.requester_id,
        imr.destination_cost_center_code
      )
  );
$function$;

alter table public.internal_mobility_requests enable row level security;
alter table public.internal_mobility_request_approvals enable row level security;
alter table public.internal_mobility_request_snapshots enable row level security;
alter table public.internal_mobility_request_audit_log enable row level security;

drop policy if exists "internal_mobility_requests_select_authenticated" on public.internal_mobility_requests;
create policy "internal_mobility_requests_select_authenticated"
on public.internal_mobility_requests
for select
to authenticated
using (
  public.user_can_view_internal_mobility_request((select auth.uid()), id)
);

drop policy if exists "internal_mobility_request_approvals_select_authenticated" on public.internal_mobility_request_approvals;
create policy "internal_mobility_request_approvals_select_authenticated"
on public.internal_mobility_request_approvals
for select
to authenticated
using (
  approver_user_id = (select auth.uid())
  or exists (
    select 1
    from public.internal_mobility_requests imr
    where imr.id = internal_mobility_request_approvals.internal_mobility_request_id
      and public.user_can_view_internal_mobility_request_summary(
        (select auth.uid()),
        imr.requester_id,
        imr.destination_cost_center_code
      )
  )
);

drop policy if exists "internal_mobility_request_snapshots_select_authenticated" on public.internal_mobility_request_snapshots;
create policy "internal_mobility_request_snapshots_select_authenticated"
on public.internal_mobility_request_snapshots
for select
to authenticated
using (
  exists (
    select 1
    from public.internal_mobility_requests imr
    where imr.id = internal_mobility_request_snapshots.internal_mobility_request_id
      and public.user_can_view_internal_mobility_request_summary(
        (select auth.uid()),
        imr.requester_id,
        imr.destination_cost_center_code
      )
  )
);

drop policy if exists "internal_mobility_request_audit_log_select_authenticated" on public.internal_mobility_request_audit_log;
create policy "internal_mobility_request_audit_log_select_authenticated"
on public.internal_mobility_request_audit_log
for select
to authenticated
using (
  exists (
    select 1
    from public.internal_mobility_requests imr
    where imr.id = internal_mobility_request_audit_log.internal_mobility_request_id
      and public.user_can_view_internal_mobility_request_summary(
        (select auth.uid()),
        imr.requester_id,
        imr.destination_cost_center_code
      )
  )
);

grant select on public.internal_mobility_requests to authenticated;
grant select on public.internal_mobility_request_approvals to authenticated;
grant select on public.internal_mobility_request_snapshots to authenticated;
grant select on public.internal_mobility_request_audit_log to authenticated;

create or replace function public.get_internal_mobility_setup_catalogs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para ver movilidad interna';
  end if;

  return jsonb_build_object(
    'buk_job_titles',
    coalesce((
      select jsonb_agg(job_title_value order by job_title_value)
      from (
        select distinct nullif(trim(e.job_title), '') as job_title_value
        from public.employees_active_current e
        where nullif(trim(e.job_title), '') is not null
      ) job_titles
    ), '[]'::jsonb),
    'destinations',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'contract_id', bcm.contract_id,
          'contract_code', c.code,
          'contract_number', bcm.contract_number,
          'area_name', bcm.buk_area_name,
          'area_code', bcm.buk_area_code,
          'cost_center_code', bcm.cost_center_code,
          'cost_center_name', bcm.cost_center_name,
          'company_name', bcm.company_name,
          'label', concat_ws(' · ', c.code, bcm.buk_area_name, bcm.company_name)
        )
        order by bcm.buk_area_name asc
      )
      from public.buk_contract_mappings bcm
      join public.contracts c
        on c.id = bcm.contract_id
       and c.is_active = true
      where bcm.is_operational = true
        and bcm.is_one_to_one = true
        and bcm.contract_id is not null
        and nullif(trim(coalesce(bcm.company_name, '')), '') is not null
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.search_internal_mobility_workers(
  p_search text,
  p_limit integer default 12
)
returns table (
  buk_employee_id text,
  full_name text,
  document_number text,
  job_title text,
  contract_code text,
  area_name text,
  company_name text,
  display_label text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_digits text := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
  safe_limit integer := greatest(1, least(coalesce(p_limit, 12), 25));
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para buscar trabajadores';
  end if;

  if length(normalized_search) < 2 and length(normalized_digits) < 4 then
    return;
  end if;

  return query
  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(nullif(trim(e.job_title), ''), 'Sin cargo') as job_title,
    nullif(trim(e.contract_code), '') as contract_code,
    nullif(trim(e.area_name), '') as area_name,
    public.extract_buk_company_name(e.raw_payload) as company_name,
    concat_ws(
      ' · ',
      e.full_name,
      coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut'),
      nullif(trim(e.job_title), ''),
      nullif(trim(e.area_name), '')
    ) as display_label
  from public.employees_active_current e
  where (
      normalized_search <> ''
      and (
        lower(coalesce(e.full_name, '')) like '%' || normalized_search || '%'
        or lower(coalesce(e.job_title, '')) like '%' || normalized_search || '%'
        or lower(coalesce(e.area_name, '')) like '%' || normalized_search || '%'
        or lower(coalesce(e.contract_code, '')) like '%' || normalized_search || '%'
      )
    )
    or (
      normalized_digits <> ''
      and regexp_replace(coalesce(e.document_number, ''), '\D', '', 'g') like '%' || normalized_digits || '%'
    )
  order by e.full_name asc
  limit safe_limit;
end;
$function$;

create or replace function public.get_internal_mobility_worker_context(
  p_buk_employee_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_record record;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para consultar el trabajador';
  end if;

  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
    coalesce(nullif(trim(e.job_title), ''), 'Sin cargo') as current_job_title,
    coalesce(c.code, nullif(trim(e.contract_code), '')) as current_contract_code,
    coalesce(bcm.buk_area_name, nullif(trim(e.area_name), '')) as current_area_name,
    coalesce(bcm.buk_area_code, nullif(trim(e.area_code), '')) as current_area_code,
    public.extract_buk_company_name(e.raw_payload) as current_company_name,
    bcm.contract_id as matched_destination_contract_id,
    c.code as matched_destination_contract_code,
    bcm.buk_area_name as matched_destination_area_name,
    bcm.company_name as matched_destination_company_name
  into worker_record
  from public.employees_active_current e
  left join public.buk_contract_mappings bcm
    on bcm.buk_area_name_normalized = public.normalize_buk_area_name(e.area_name)
   and bcm.is_operational = true
   and bcm.is_one_to_one = true
   and bcm.contract_id is not null
  left join public.contracts c
    on c.id = bcm.contract_id
   and c.is_active = true
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_record.buk_employee_id is null then
    raise exception 'Trabajador activo no encontrado en BUK';
  end if;

  if nullif(trim(coalesce(worker_record.current_company_name, '')), '') is null then
    raise exception 'No fue posible resolver la empresa actual del trabajador';
  end if;

  return jsonb_build_object(
    'worker',
    jsonb_build_object(
      'buk_employee_id', worker_record.buk_employee_id,
      'full_name', worker_record.full_name,
      'document_number', worker_record.document_number,
      'document_type', worker_record.document_type,
      'current_job_title', worker_record.current_job_title,
      'current_contract_code', worker_record.current_contract_code,
      'current_area_name', worker_record.current_area_name,
      'current_area_code', worker_record.current_area_code,
      'current_company_name', worker_record.current_company_name,
      'matched_destination_contract_id', worker_record.matched_destination_contract_id,
      'matched_destination_contract_code', worker_record.matched_destination_contract_code,
      'matched_destination_area_name', worker_record.matched_destination_area_name,
      'matched_destination_company_name', worker_record.matched_destination_company_name
    )
  );
end;
$function$;

create or replace function public.submit_internal_mobility_request(
  p_buk_employee_id text,
  p_destination_contract_id bigint,
  p_destination_job_title text,
  p_motive text,
  p_requester_signed boolean default false
)
returns table (
  request_id uuid,
  folio text,
  status text,
  requires_termination boolean,
  current_company_name text,
  destination_company_name text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  requester_profile public.profiles%rowtype;
  worker_record record;
  destination_record record;
  area_manager_record public.cost_center_approvers%rowtype;
  area_manager_profile public.profiles%rowtype;
  created_request_id uuid;
  next_folio text;
  request_snapshot jsonb;
  should_require_termination boolean;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para crear solicitudes de movilidad interna';
  end if;

  if not coalesce(p_requester_signed, false) then
    raise exception 'La solicitud debe enviarse con firma del solicitante';
  end if;

  if nullif(trim(coalesce(p_buk_employee_id, '')), '') is null then
    raise exception 'Debe seleccionar un trabajador activo';
  end if;

  if nullif(trim(coalesce(p_destination_job_title, '')), '') is null then
    raise exception 'Debe seleccionar el cargo destino';
  end if;

  if nullif(trim(coalesce(p_motive, '')), '') is null then
    raise exception 'Debe ingresar el motivo del cambio';
  end if;

  select *
    into requester_profile
    from public.profiles
   where id = current_user_id
   for share;

  if requester_profile.id is null then
    raise exception 'No existe perfil para el usuario autenticado';
  end if;

  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
    coalesce(nullif(trim(e.job_title), ''), 'Sin cargo') as current_job_title,
    coalesce(c.code, nullif(trim(e.contract_code), '')) as current_contract_code,
    coalesce(bcm.buk_area_name, nullif(trim(e.area_name), '')) as current_area_name,
    coalesce(bcm.buk_area_code, nullif(trim(e.area_code), '')) as current_area_code,
    public.extract_buk_company_name(e.raw_payload) as current_company_name
  into worker_record
  from public.employees_active_current e
  left join public.buk_contract_mappings bcm
    on bcm.buk_area_name_normalized = public.normalize_buk_area_name(e.area_name)
   and bcm.is_operational = true
   and bcm.is_one_to_one = true
   and bcm.contract_id is not null
  left join public.contracts c
    on c.id = bcm.contract_id
   and c.is_active = true
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_record.buk_employee_id is null then
    raise exception 'Trabajador activo no encontrado';
  end if;

  if nullif(trim(coalesce(worker_record.current_company_name, '')), '') is null then
    raise exception 'No fue posible resolver la empresa actual del trabajador';
  end if;

  select
    bcm.contract_id,
    bcm.contract_number,
    c.code as contract_code,
    bcm.buk_area_name as area_name,
    bcm.buk_area_code as area_code,
    bcm.cost_center_code,
    bcm.cost_center_name,
    bcm.company_name
  into destination_record
  from public.buk_contract_mappings bcm
  join public.contracts c
    on c.id = bcm.contract_id
   and c.is_active = true
  where bcm.contract_id = p_destination_contract_id
    and bcm.is_operational = true
    and bcm.is_one_to_one = true
    and bcm.contract_id is not null
  order by bcm.buk_area_name
  limit 1;

  if destination_record.contract_id is null then
    raise exception 'Destino invalido o inactivo';
  end if;

  if nullif(trim(coalesce(destination_record.company_name, '')), '') is null then
    raise exception 'El destino seleccionado no tiene empresa configurada';
  end if;

  select *
    into area_manager_record
    from public.cost_center_approvers
   where cost_center_code = destination_record.cost_center_code
     and is_active = true
   for share;

  if area_manager_record.id is null then
    raise exception 'No existe gerente configurado para el centro de costo del destino';
  end if;

  if area_manager_record.approver_user_id is null then
    raise exception 'El gerente del destino aun no tiene usuario vinculado en la plataforma';
  end if;

  select *
    into area_manager_profile
    from public.profiles
   where id = area_manager_record.approver_user_id
     and status = 'active'
   for share;

  if area_manager_profile.id is null then
    raise exception 'El gerente del destino no tiene una cuenta activa';
  end if;

  should_require_termination :=
    worker_record.current_company_name is distinct from destination_record.company_name;

  next_folio := 'MI-' || lpad(nextval('public.internal_mobility_folio_seq')::text, 4, '0');

  insert into public.internal_mobility_requests (
    folio,
    requester_id,
    requester_name,
    requester_job_title,
    requester_email,
    employee_buk_employee_id,
    employee_document_number,
    employee_document_type,
    employee_full_name,
    current_job_title,
    current_contract_code,
    current_area_name,
    current_area_code,
    current_company_name,
    destination_job_title,
    destination_contract_id,
    destination_contract_code,
    destination_contract_number,
    destination_area_name,
    destination_area_code,
    destination_cost_center_code,
    destination_cost_center_name,
    destination_company_name,
    requires_termination,
    motive,
    status,
    current_step_code,
    submitted_at,
    submitted_by,
    created_at,
    updated_at
  )
  values (
    next_folio,
    current_user_id,
    coalesce(requester_profile.full_name, requester_profile.email),
    requester_profile.job_title,
    requester_profile.email,
    worker_record.buk_employee_id,
    worker_record.document_number,
    worker_record.document_type,
    worker_record.full_name,
    worker_record.current_job_title,
    worker_record.current_contract_code,
    worker_record.current_area_name,
    worker_record.current_area_code,
    worker_record.current_company_name,
    trim(p_destination_job_title),
    destination_record.contract_id,
    destination_record.contract_code,
    destination_record.contract_number,
    destination_record.area_name,
    destination_record.area_code,
    destination_record.cost_center_code,
    destination_record.cost_center_name,
    destination_record.company_name,
    should_require_termination,
    trim(p_motive),
    'pending_area_manager',
    'area_manager',
    timezone('utc', now()),
    current_user_id,
    timezone('utc', now()),
    timezone('utc', now())
  )
  returning id into created_request_id;

  request_snapshot := jsonb_build_object(
    'folio', next_folio,
    'requester_id', current_user_id,
    'requester_name', coalesce(requester_profile.full_name, requester_profile.email),
    'requester_job_title', requester_profile.job_title,
    'requester_email', requester_profile.email,
    'employee_buk_employee_id', worker_record.buk_employee_id,
    'employee_document_number', worker_record.document_number,
    'employee_document_type', worker_record.document_type,
    'employee_full_name', worker_record.full_name,
    'current_job_title', worker_record.current_job_title,
    'current_contract_code', worker_record.current_contract_code,
    'current_area_name', worker_record.current_area_name,
    'current_area_code', worker_record.current_area_code,
    'current_company_name', worker_record.current_company_name,
    'destination_job_title', trim(p_destination_job_title),
    'destination_contract_id', destination_record.contract_id,
    'destination_contract_code', destination_record.contract_code,
    'destination_contract_number', destination_record.contract_number,
    'destination_area_name', destination_record.area_name,
    'destination_area_code', destination_record.area_code,
    'destination_cost_center_code', destination_record.cost_center_code,
    'destination_cost_center_name', destination_record.cost_center_name,
    'destination_company_name', destination_record.company_name,
    'requires_termination', should_require_termination,
    'motive', trim(p_motive),
    'requester_signed', true
  );

  insert into public.internal_mobility_request_snapshots (
    internal_mobility_request_id,
    snapshot_type,
    payload,
    created_by
  )
  values (
    created_request_id,
    'submitted',
    request_snapshot,
    current_user_id
  );

  insert into public.internal_mobility_request_approvals (
    internal_mobility_request_id,
    step_code,
    step_name,
    step_order,
    approver_user_id,
    approver_name,
    approver_email,
    status,
    decision_by,
    decision_comment,
    decided_at,
    locked_at,
    created_at,
    updated_at
  )
  values (
    created_request_id,
    'requester_signature',
    'Firma solicitante',
    1,
    current_user_id,
    coalesce(requester_profile.full_name, requester_profile.email),
    requester_profile.email,
    'approved',
    current_user_id,
    null,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (internal_mobility_request_id, step_code) do nothing;

  insert into public.internal_mobility_request_approvals (
    internal_mobility_request_id,
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
    created_request_id,
    'area_manager',
    'Gerente de area',
    2,
    area_manager_record.approver_user_id,
    area_manager_record.approver_name,
    coalesce(area_manager_record.approver_email, area_manager_profile.email),
    'pending',
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.internal_mobility_request_audit_log (
    internal_mobility_request_id,
    actor_user_id,
    action_type,
    new_values,
    metadata
  )
  values (
    created_request_id,
    current_user_id,
    'submitted',
    request_snapshot,
    jsonb_build_object(
      'current_step_code', 'area_manager',
      'status', 'pending_area_manager'
    )
  );

  insert into public.internal_mobility_request_audit_log (
    internal_mobility_request_id,
    approval_id,
    actor_user_id,
    action_type,
    new_values,
    metadata
  )
  select
    created_request_id,
    imra.id,
    current_user_id,
    'approval_created',
    jsonb_build_object(
      'step_code', imra.step_code,
      'step_name', imra.step_name,
      'approver_user_id', imra.approver_user_id,
      'approver_name', imra.approver_name,
      'approver_email', imra.approver_email,
      'status', imra.status
    ),
    jsonb_build_object('created_by_flow', 'submit_internal_mobility_request')
  from public.internal_mobility_request_approvals imra
  where imra.internal_mobility_request_id = created_request_id
    and imra.step_code = 'area_manager';

  return query
  select
    created_request_id,
    next_folio,
    'pending_area_manager'::text,
    should_require_termination,
    worker_record.current_company_name::text,
    destination_record.company_name::text;
end;
$function$;

create or replace function public.decide_internal_mobility_request_approval(
  p_approval_id bigint,
  p_decision text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  approval_record public.internal_mobility_request_approvals%rowtype;
  request_record public.internal_mobility_requests%rowtype;
  contracts_control_record public.workflow_approvers%rowtype;
  next_approval_id bigint;
  now_utc timestamptz := timezone('utc', now());
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision invalida';
  end if;

  select *
    into approval_record
    from public.internal_mobility_request_approvals imra
   where imra.id = p_approval_id
   for update;

  if approval_record.id is null then
    raise exception 'No existe la aprobación indicada';
  end if;

  if approval_record.status <> 'pending' then
    raise exception 'La aprobación seleccionada ya fue resuelta';
  end if;

  if approval_record.step_code not in ('area_manager', 'contracts_control') then
    raise exception 'La etapa indicada no admite decisiones manuales';
  end if;

  if approval_record.approver_user_id is null
     or (approval_record.approver_user_id <> current_user_id and not public.user_is_admin(current_user_id)) then
    raise exception 'Solo el aprobador asignado puede decidir esta solicitud';
  end if;

  select *
    into request_record
    from public.internal_mobility_requests imr
   where imr.id = approval_record.internal_mobility_request_id
   for update;

  if request_record.id is null then
    raise exception 'No existe la solicitud asociada';
  end if;

  if request_record.current_step_code is distinct from approval_record.step_code then
    raise exception 'La solicitud ya no se encuentra en esta etapa';
  end if;

  update public.internal_mobility_request_approvals imra
     set status = p_decision,
         decision_by = current_user_id,
         decision_comment = nullif(trim(coalesce(p_comment, '')), ''),
         decided_at = now_utc,
         locked_at = now_utc,
         updated_at = now_utc
   where imra.id = approval_record.id;

  if p_decision = 'rejected' then
    update public.internal_mobility_requests imr
       set status = 'rejected',
           current_step_code = null,
           rejected_at = now_utc,
           approved_at = null,
           final_decided_by = current_user_id,
           updated_at = now_utc
     where imr.id = request_record.id;

    insert into public.internal_mobility_request_audit_log (
      internal_mobility_request_id,
      approval_id,
      actor_user_id,
      action_type,
      old_values,
      new_values,
      metadata
    )
    values (
      request_record.id,
      approval_record.id,
      current_user_id,
      'rejected',
      jsonb_build_object(
        'approval_status', approval_record.status,
        'request_status', request_record.status,
        'current_step_code', request_record.current_step_code
      ),
      jsonb_build_object(
        'approval_status', 'rejected',
        'request_status', 'rejected',
        'current_step_code', null,
        'step_code', approval_record.step_code,
        'comment', nullif(trim(coalesce(p_comment, '')), '')
      ),
      jsonb_build_object('decided_by', current_user_id)
    );

    return;
  end if;

  if approval_record.step_code = 'area_manager' then
    select *
      into contracts_control_record
      from public.workflow_approvers wa
     where wa.step_code = 'contracts_control'
       and wa.is_active = true
     for share;

    if contracts_control_record.step_code is null then
      raise exception 'No existe aprobador configurado para Control de Contratos';
    end if;

    if contracts_control_record.approver_user_id is null then
      raise exception 'Control de Contratos aun no tiene usuario vinculado en la plataforma';
    end if;

    if not exists (
      select 1
      from public.profiles p
      where p.id = contracts_control_record.approver_user_id
        and p.status = 'active'
    ) then
      raise exception 'El usuario configurado para Control de Contratos no tiene una cuenta activa';
    end if;

    insert into public.internal_mobility_request_approvals (
      internal_mobility_request_id,
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
      request_record.id,
      'contracts_control',
      'Control de contratos',
      3,
      contracts_control_record.approver_user_id,
      contracts_control_record.approver_name,
      contracts_control_record.approver_email,
      'pending',
      now_utc,
      now_utc
    )
    on conflict (internal_mobility_request_id, step_code) do update
    set approver_user_id = excluded.approver_user_id,
        approver_name = excluded.approver_name,
        approver_email = excluded.approver_email,
        status = 'pending',
        decision_by = null,
        decision_comment = null,
        decided_at = null,
        locked_at = null,
        updated_at = now_utc
    returning id into next_approval_id;

    update public.internal_mobility_requests imr
       set status = 'pending_contracts_control',
           current_step_code = 'contracts_control',
           final_decided_by = null,
           approved_at = null,
           rejected_at = null,
           updated_at = now_utc
     where imr.id = request_record.id;

    insert into public.internal_mobility_request_audit_log (
      internal_mobility_request_id,
      approval_id,
      actor_user_id,
      action_type,
      old_values,
      new_values,
      metadata
    )
    values (
      request_record.id,
      approval_record.id,
      current_user_id,
      'approved',
      jsonb_build_object(
        'approval_status', approval_record.status,
        'request_status', request_record.status,
        'current_step_code', request_record.current_step_code
      ),
      jsonb_build_object(
        'approval_status', 'approved',
        'request_status', 'pending_contracts_control',
        'current_step_code', 'contracts_control',
        'step_code', approval_record.step_code,
        'comment', nullif(trim(coalesce(p_comment, '')), '')
      ),
      jsonb_build_object('decided_by', current_user_id)
    );

    insert into public.internal_mobility_request_audit_log (
      internal_mobility_request_id,
      approval_id,
      actor_user_id,
      action_type,
      new_values,
      metadata
    )
    select
      request_record.id,
      imra.id,
      current_user_id,
      'approval_created',
      jsonb_build_object(
        'step_code', imra.step_code,
        'step_name', imra.step_name,
        'approver_user_id', imra.approver_user_id,
        'approver_name', imra.approver_name,
        'approver_email', imra.approver_email,
        'status', imra.status
      ),
      jsonb_build_object('created_by_flow', 'decide_internal_mobility_request_approval')
    from public.internal_mobility_request_approvals imra
    where imra.id = next_approval_id;

    return;
  end if;

  update public.internal_mobility_requests imr
     set status = 'approved',
         current_step_code = null,
         approved_at = now_utc,
         rejected_at = null,
         final_decided_by = current_user_id,
         updated_at = now_utc
   where imr.id = request_record.id;

  insert into public.internal_mobility_request_audit_log (
    internal_mobility_request_id,
    approval_id,
    actor_user_id,
    action_type,
    old_values,
    new_values,
    metadata
  )
  values (
    request_record.id,
    approval_record.id,
    current_user_id,
    'approved',
    jsonb_build_object(
      'approval_status', approval_record.status,
      'request_status', request_record.status,
      'current_step_code', request_record.current_step_code
    ),
    jsonb_build_object(
      'approval_status', 'approved',
      'request_status', 'approved',
      'current_step_code', null,
      'step_code', approval_record.step_code,
      'comment', nullif(trim(coalesce(p_comment, '')), '')
    ),
    jsonb_build_object('decided_by', current_user_id)
  );

  perform public.enqueue_internal_mobility_recruitment_handoff_email(request_record.id);
end;
$function$;

create or replace function public.get_internal_mobility_requests()
returns table (
  request_id uuid,
  folio text,
  status text,
  requester_name text,
  requester_email text,
  employee_full_name text,
  employee_document_number text,
  current_job_title text,
  current_area_name text,
  current_company_name text,
  destination_job_title text,
  destination_area_name text,
  destination_cost_center_code text,
  destination_cost_center_name text,
  destination_company_name text,
  requires_termination boolean,
  motive text,
  current_step_name text,
  current_approver_name text,
  created_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para ver solicitudes de movilidad interna';
  end if;

  return query
  select
    imr.id,
    imr.folio,
    imr.status,
    imr.requester_name,
    imr.requester_email,
    imr.employee_full_name,
    imr.employee_document_number,
    imr.current_job_title,
    imr.current_area_name,
    imr.current_company_name,
    imr.destination_job_title,
    imr.destination_area_name,
    imr.destination_cost_center_code,
    imr.destination_cost_center_name,
    imr.destination_company_name,
    imr.requires_termination,
    imr.motive,
    current_approval.step_name,
    current_approval.approver_name,
    imr.created_at,
    imr.submitted_at,
    imr.approved_at,
    imr.rejected_at
  from public.internal_mobility_requests imr
  left join lateral (
    select
      imra.step_name,
      imra.approver_name
    from public.internal_mobility_request_approvals imra
    where imra.internal_mobility_request_id = imr.id
      and imra.status = 'pending'
      and imra.step_code = imr.current_step_code
    limit 1
  ) current_approval on true
  where public.user_can_view_internal_mobility_request_summary(
    current_user_id,
    imr.requester_id,
    imr.destination_cost_center_code
  )
  order by imr.created_at desc
  limit 200;
end;
$function$;

create or replace function public.get_internal_mobility_request_detail(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  detail_payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_view_internal_mobility_request(current_user_id, p_request_id) then
    raise exception 'Sin permisos para ver esta solicitud';
  end if;

  select jsonb_build_object(
    'request',
    jsonb_build_object(
      'id', imr.id,
      'folio', imr.folio,
      'status', imr.status,
      'requester_name', imr.requester_name,
      'requester_job_title', imr.requester_job_title,
      'requester_email', imr.requester_email,
      'employee_buk_employee_id', imr.employee_buk_employee_id,
      'employee_document_number', imr.employee_document_number,
      'employee_document_type', imr.employee_document_type,
      'employee_full_name', imr.employee_full_name,
      'current_job_title', imr.current_job_title,
      'current_contract_code', imr.current_contract_code,
      'current_area_name', imr.current_area_name,
      'current_area_code', imr.current_area_code,
      'current_company_name', imr.current_company_name,
      'destination_job_title', imr.destination_job_title,
      'destination_contract_id', imr.destination_contract_id,
      'destination_contract_code', imr.destination_contract_code,
      'destination_contract_number', imr.destination_contract_number,
      'destination_area_name', imr.destination_area_name,
      'destination_area_code', imr.destination_area_code,
      'destination_cost_center_code', imr.destination_cost_center_code,
      'destination_cost_center_name', imr.destination_cost_center_name,
      'destination_company_name', imr.destination_company_name,
      'requires_termination', imr.requires_termination,
      'motive', imr.motive,
      'current_step_code', imr.current_step_code,
      'submitted_at', imr.submitted_at,
      'approved_at', imr.approved_at,
      'rejected_at', imr.rejected_at,
      'created_at', imr.created_at,
      'updated_at', imr.updated_at
    ),
    'approvals',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', imra.id,
          'step_code', imra.step_code,
          'step_name', imra.step_name,
          'step_order', imra.step_order,
          'approver_user_id', imra.approver_user_id,
          'approver_name', imra.approver_name,
          'approver_email', imra.approver_email,
          'status', imra.status,
          'decision_comment', imra.decision_comment,
          'decided_at', imra.decided_at,
          'created_at', imra.created_at
        )
        order by imra.step_order asc, imra.created_at asc
      )
      from public.internal_mobility_request_approvals imra
      where imra.internal_mobility_request_id = imr.id
    ), '[]'::jsonb),
    'audit_log',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', imral.id,
          'action_type', imral.action_type,
          'actor_user_id', imral.actor_user_id,
          'actor_name', actor_profile.full_name,
          'created_at', imral.created_at,
          'old_values', imral.old_values,
          'new_values', imral.new_values,
          'metadata', imral.metadata
        )
        order by imral.created_at desc, imral.id desc
      )
      from public.internal_mobility_request_audit_log imral
      left join public.profiles actor_profile
        on actor_profile.id = imral.actor_user_id
      where imral.internal_mobility_request_id = imr.id
    ), '[]'::jsonb)
  )
  into detail_payload
  from public.internal_mobility_requests imr
  where imr.id = p_request_id;

  if detail_payload is null then
    raise exception 'No existe la solicitud indicada';
  end if;

  return detail_payload;
end;
$function$;

create or replace function public.enqueue_internal_mobility_pending_approval_email(
  p_approval_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  approval_record record;
  event_key text;
begin
  select
    imra.id,
    imra.step_code,
    imra.step_name,
    imra.approver_user_id,
    imra.approver_name,
    imra.approver_email,
    imra.created_at,
    imr.id as mobility_request_id,
    imr.folio,
    imr.requester_name,
    imr.requester_email,
    imr.employee_full_name,
    imr.current_company_name,
    imr.destination_job_title,
    imr.destination_area_name,
    imr.destination_company_name,
    imr.requires_termination,
    imr.motive
  into approval_record
  from public.internal_mobility_request_approvals imra
  join public.internal_mobility_requests imr
    on imr.id = imra.internal_mobility_request_id
  where imra.id = p_approval_id
    and imra.status = 'pending'
    and imra.step_code in ('area_manager', 'contracts_control')
  limit 1;

  if approval_record.id is null then
    return;
  end if;

  if nullif(trim(coalesce(approval_record.approver_email, '')), '') is null then
    return;
  end if;

  event_key := format('mobility-approval-pending:%s', approval_record.id);

  perform public.queue_transactional_email_notification(
    event_key,
    'pending_approval',
    jsonb_build_object(
      'kind', 'pending_approval',
      'event_key', event_key,
      'to', jsonb_build_array(
        jsonb_build_object(
          'email', approval_record.approver_email,
          'name', coalesce(nullif(trim(approval_record.approver_name), ''), approval_record.approver_email)
        )
      ),
      'approval', jsonb_build_object(
        'id', approval_record.id,
        'step_code', approval_record.step_code,
        'step_name', approval_record.step_name,
        'created_at', approval_record.created_at
      ),
      'request', jsonb_build_object(
        'id', approval_record.mobility_request_id,
        'folio', approval_record.folio,
        'request_context', 'internal_mobility',
        'module_label', 'Movilidad Interna',
        'requester_name', approval_record.requester_name,
        'requester_email', approval_record.requester_email,
        'employee_name', approval_record.employee_full_name,
        'job_position_name', approval_record.destination_job_title,
        'contract_name', approval_record.destination_area_name,
        'current_company_name', approval_record.current_company_name,
        'destination_company_name', approval_record.destination_company_name,
        'requires_termination', approval_record.requires_termination,
        'motive', approval_record.motive
      ),
      'route', '/'
    )
  );
end;
$function$;

create or replace function public.enqueue_internal_mobility_recruitment_handoff_email(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  request_record record;
  recipients jsonb := '[]'::jsonb;
  event_key text;
begin
  select
    imr.id,
    imr.folio,
    imr.requester_name,
    imr.requester_email,
    imr.employee_full_name,
    imr.destination_job_title,
    imr.destination_area_name,
    imr.current_company_name,
    imr.destination_company_name,
    imr.requires_termination,
    imr.motive,
    imr.approved_at
  into request_record
  from public.internal_mobility_requests imr
  where imr.id = p_request_id
    and imr.status = 'approved'
  limit 1;

  if request_record.id is null then
    return;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'email', recruitment_recipient.email,
        'name', recruitment_recipient.name
      )
      order by recruitment_recipient.name, recruitment_recipient.email
    ),
    '[]'::jsonb
  )
  into recipients
  from (
    select distinct
      lower(trim(p.email)) as email,
      coalesce(nullif(trim(p.full_name), ''), trim(p.email)) as name
    from public.profiles p
    join public.user_roles ur
      on ur.user_id = p.id
     and ur.role_code = 'reclutamiento'
    join public.app_roles ar
      on ar.code = ur.role_code
     and ar.is_active = true
    where p.status = 'active'
      and nullif(trim(coalesce(p.email, '')), '') is not null
  ) as recruitment_recipient;

  if recipients = '[]'::jsonb then
    return;
  end if;

  event_key := format('mobility-recruitment-handoff:%s', request_record.id);

  perform public.queue_transactional_email_notification(
    event_key,
    'recruitment_handoff',
    jsonb_build_object(
      'kind', 'recruitment_handoff',
      'event_key', event_key,
      'to', recipients,
      'case', jsonb_build_object(
        'id', request_record.id,
        'case_code', request_record.folio,
        'opened_at', request_record.approved_at,
        'requested_vacancies', null
      ),
      'request', jsonb_build_object(
        'id', request_record.id,
        'folio', request_record.folio,
        'request_context', 'internal_mobility',
        'module_label', 'Movilidad Interna',
        'requester_name', request_record.requester_name,
        'requester_email', request_record.requester_email,
        'employee_name', request_record.employee_full_name,
        'job_position_name', request_record.destination_job_title,
        'contract_name', request_record.destination_area_name,
        'current_company_name', request_record.current_company_name,
        'destination_company_name', request_record.destination_company_name,
        'requires_termination', request_record.requires_termination,
        'motive', request_record.motive
      ),
      'route', '/movilidad-interna'
    )
  );
end;
$function$;

create or replace function public.trg_internal_mobility_pending_email_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'INSERT'
     and new.status = 'pending'
     and new.step_code in ('area_manager', 'contracts_control') then
    perform public.enqueue_internal_mobility_pending_approval_email(new.id);
  end if;

  return new;
end;
$function$;

create or replace function public.trg_internal_mobility_recruitment_handoff_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  return new;
end;
$function$;

drop trigger if exists trg_internal_mobility_pending_email_dispatch on public.internal_mobility_request_approvals;
create trigger trg_internal_mobility_pending_email_dispatch
after insert on public.internal_mobility_request_approvals
for each row
execute function public.trg_internal_mobility_pending_email_dispatch();

drop trigger if exists trg_internal_mobility_recruitment_handoff_dispatch on public.internal_mobility_request_approvals;

create or replace function public.get_dashboard_tasks(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  result json;
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado';
  end if;

  if auth.uid() <> p_user_id and not public.user_is_admin(auth.uid()) then
    raise exception 'Sin permisos para consultar tareas de otro usuario';
  end if;

  select coalesce(json_agg(t order by t.created_at asc), '[]'::json) into result
  from (
    select
      'approval_' || hra.id as id,
      'approval' as type,
      'solicitud_contrataciones'::text as module_code,
      hra.id as approval_id,
      hra.step_code,
      hra.step_name,
      hr.id as hiring_request_id,
      coalesce(hr.folio, 'Borrador') as folio,
      null::uuid as case_candidate_id,
      null::text as candidate_name,
      hr.job_position_name,
      hr.contract_name,
      hr.cost_center_code,
      hr.vacancies as requested_vacancies,
      hr.requester_name,
      hr.requester_email,
      hra.status as status_code,
      'En Revision' as status_label,
      'Alta' as priority,
      hra.created_at,
      hr.requested_entry_date as requested_income_date,
      hr.start_date as contract_start_date,
      hr.end_date as contract_end_date,
      hr.shift_name as shift_code,
      hr.salary_offer as salary_liquid,
      hr.campamento as camp_required,
      hr.pasajes as flight_tickets_required,
      hr.travel_methodology,
      hr.other_benefits,
      null::text as approval_comment,
      null::text as requested_by_name,
      null::jsonb as who_causes,
      null::text as employee_name,
      null::text as current_company_name,
      null::text as destination_company_name,
      null::text as source_job_title,
      null::text as source_area_name,
      null::text as destination_area_name,
      null::boolean as requires_termination,
      null::text as mobility_motive
    from public.hiring_request_approvals hra
    join public.hiring_requests hr
      on hr.id = hra.hiring_request_id
    where hra.approver_user_id = p_user_id
      and hra.status = 'pending'

    union all

    select
      'mobility_approval_' || imra.id as id,
      'approval' as type,
      'movilidad_interna'::text as module_code,
      imra.id as approval_id,
      imra.step_code,
      imra.step_name,
      null::uuid as hiring_request_id,
      imr.folio,
      null::uuid as case_candidate_id,
      null::text as candidate_name,
      imr.destination_job_title as job_position_name,
      imr.destination_area_name as contract_name,
      imr.destination_cost_center_code as cost_center_code,
      null::integer as requested_vacancies,
      imr.requester_name,
      imr.requester_email,
      imra.status as status_code,
      'En Revision' as status_label,
      'Alta' as priority,
      imra.created_at,
      null::date as requested_income_date,
      null::date as contract_start_date,
      null::date as contract_end_date,
      null::text as shift_code,
      null::numeric as salary_liquid,
      null::boolean as camp_required,
      null::boolean as flight_tickets_required,
      null::text as travel_methodology,
      null::text as other_benefits,
      null::text as approval_comment,
      null::text as requested_by_name,
      null::jsonb as who_causes,
      imr.employee_full_name as employee_name,
      imr.current_company_name,
      imr.destination_company_name,
      imr.current_job_title as source_job_title,
      imr.current_area_name as source_area_name,
      imr.destination_area_name,
      imr.requires_termination,
      imr.motive as mobility_motive
    from public.internal_mobility_request_approvals imra
    join public.internal_mobility_requests imr
      on imr.id = imra.internal_mobility_request_id
    where imra.approver_user_id = p_user_id
      and imra.status = 'pending'

    union all

    select
      'who_approval_' || csa.id as id,
      'who_approval' as type,
      'control_contrataciones'::text as module_code,
      null::bigint as approval_id,
      'who_pending' as step_code,
      'Aprobación Who' as step_name,
      rc.hiring_request_id,
      rc.case_code as folio,
      rcc.id as case_candidate_id,
      cp.full_name as candidate_name,
      rc.job_position_name,
      rc.contract_name,
      rc.cost_center_code,
      rc.requested_vacancies as requested_vacancies,
      hr.requester_name,
      hr.requester_email,
      csa.status as status_code,
      'Who Pendiente' as status_label,
      'Alta' as priority,
      csa.requested_at as created_at,
      rc.requested_entry_date as requested_income_date,
      hr.start_date as contract_start_date,
      hr.end_date as contract_end_date,
      hr.shift_name as shift_code,
      hr.salary_offer as salary_liquid,
      hr.campamento as camp_required,
      hr.pasajes as flight_tickets_required,
      hr.travel_methodology,
      hr.other_benefits,
      csa.comment as approval_comment,
      requester_profile.full_name as requested_by_name,
      csa.causes as who_causes,
      null::text as employee_name,
      null::text as current_company_name,
      null::text as destination_company_name,
      null::text as source_job_title,
      null::text as source_area_name,
      null::text as destination_area_name,
      null::boolean as requires_termination,
      null::text as mobility_motive
    from public.candidate_stage_approvals csa
    join public.recruitment_case_candidates rcc
      on rcc.id = csa.recruitment_case_candidate_id
    join public.recruitment_cases rc
      on rc.id = rcc.recruitment_case_id
    join public.candidate_profiles cp
      on cp.id = rcc.candidate_profile_id
    left join public.hiring_requests hr
      on hr.id = rc.hiring_request_id
    left join public.profiles requester_profile
      on requester_profile.id = csa.requested_by
    where csa.stage_code = 'who_pending'
      and csa.status = 'pending'
      and public.user_has_capability(p_user_id, 'can_approve_who_stage')
      and public.user_can_view_recruitment_case(p_user_id, rc.id)
  ) t;

  return result;
end;
$function$;

revoke all on function public.user_can_view_internal_mobility_request_summary(uuid, uuid, text) from public, anon;
grant execute on function public.user_can_view_internal_mobility_request_summary(uuid, uuid, text) to authenticated;

revoke all on function public.user_can_view_internal_mobility_request(uuid, uuid) from public, anon;
grant execute on function public.user_can_view_internal_mobility_request(uuid, uuid) to authenticated;

revoke all on function public.get_internal_mobility_setup_catalogs() from public, anon;
grant execute on function public.get_internal_mobility_setup_catalogs() to authenticated;

revoke all on function public.search_internal_mobility_workers(text, integer) from public, anon;
grant execute on function public.search_internal_mobility_workers(text, integer) to authenticated;

revoke all on function public.get_internal_mobility_worker_context(text) from public, anon;
grant execute on function public.get_internal_mobility_worker_context(text) to authenticated;

revoke all on function public.submit_internal_mobility_request(text, bigint, text, text, boolean) from public, anon;
grant execute on function public.submit_internal_mobility_request(text, bigint, text, text, boolean) to authenticated;

revoke all on function public.decide_internal_mobility_request_approval(bigint, text, text) from public, anon;
grant execute on function public.decide_internal_mobility_request_approval(bigint, text, text) to authenticated;

revoke all on function public.get_internal_mobility_requests() from public, anon;
grant execute on function public.get_internal_mobility_requests() to authenticated;

revoke all on function public.get_internal_mobility_request_detail(uuid) from public, anon;
grant execute on function public.get_internal_mobility_request_detail(uuid) to authenticated;

revoke all on function public.get_dashboard_tasks(uuid) from public, anon;
grant execute on function public.get_dashboard_tasks(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
