begin;

alter table public.accreditation_requirements
  add column if not exists process_scope text;

update public.accreditation_requirements
set process_scope = 'accreditation'
where process_scope is null;

alter table public.accreditation_requirements
  alter column process_scope set default 'accreditation',
  alter column process_scope set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accreditation_requirements_process_scope_check'
      and conrelid = 'public.accreditation_requirements'::regclass
  ) then
    alter table public.accreditation_requirements
      add constraint accreditation_requirements_process_scope_check
      check (process_scope in ('accreditation', 'internal_license', 'both'));
  end if;
end;
$$;

create table if not exists public.accreditation_standards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  owner_name text,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accreditation_standards_code_format check (code = lower(code))
);

create table if not exists public.accreditation_standard_requirements (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null references public.accreditation_standards (id) on delete cascade,
  requirement_id uuid not null references public.accreditation_requirements (id) on delete cascade,
  sort_order integer not null default 0,
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (standard_id, requirement_id)
);

create table if not exists public.accreditation_site_standards (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.accreditation_sites (id) on delete cascade,
  standard_id uuid not null references public.accreditation_standards (id) on delete cascade,
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (site_id, standard_id)
);

create index if not exists idx_accreditation_requirements_scope
  on public.accreditation_requirements (process_scope, is_active, category, name);

create index if not exists idx_accreditation_standards_active
  on public.accreditation_standards (is_active, owner_name, name);

create index if not exists idx_accreditation_standard_requirements_standard
  on public.accreditation_standard_requirements (standard_id, is_active, sort_order);

create index if not exists idx_accreditation_site_standards_site
  on public.accreditation_site_standards (site_id, is_active);

drop trigger if exists trg_accreditation_standards_set_updated_at on public.accreditation_standards;
create trigger trg_accreditation_standards_set_updated_at
before update on public.accreditation_standards
for each row
execute function public.set_updated_at();

drop trigger if exists trg_accreditation_standard_requirements_set_updated_at on public.accreditation_standard_requirements;
create trigger trg_accreditation_standard_requirements_set_updated_at
before update on public.accreditation_standard_requirements
for each row
execute function public.set_updated_at();

drop trigger if exists trg_accreditation_site_standards_set_updated_at on public.accreditation_site_standards;
create trigger trg_accreditation_site_standards_set_updated_at
before update on public.accreditation_site_standards
for each row
execute function public.set_updated_at();

alter table public.accreditation_standards enable row level security;
alter table public.accreditation_standard_requirements enable row level security;
alter table public.accreditation_site_standards enable row level security;

drop policy if exists "accreditation_standards_select_authenticated" on public.accreditation_standards;
create policy "accreditation_standards_select_authenticated"
on public.accreditation_standards
for select
to authenticated
using (public.user_can_manage_accreditation((select auth.uid())));

drop policy if exists "accreditation_standard_requirements_select_authenticated" on public.accreditation_standard_requirements;
create policy "accreditation_standard_requirements_select_authenticated"
on public.accreditation_standard_requirements
for select
to authenticated
using (public.user_can_manage_accreditation((select auth.uid())));

drop policy if exists "accreditation_site_standards_select_authenticated" on public.accreditation_site_standards;
create policy "accreditation_site_standards_select_authenticated"
on public.accreditation_site_standards
for select
to authenticated
using (public.user_can_manage_accreditation((select auth.uid())));

revoke all on public.accreditation_standards from public, anon, authenticated;
revoke all on public.accreditation_standard_requirements from public, anon, authenticated;
revoke all on public.accreditation_site_standards from public, anon, authenticated;

create or replace function public.upsert_accreditation_standard(
  p_standard_id uuid default null,
  p_code text default null,
  p_name text default null,
  p_owner_name text default null,
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
  normalized_code text := lower(trim(coalesce(p_code, '')));
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para configurar estandares de acreditacion';
  end if;

  if normalized_code = '' then
    raise exception 'Debe indicar el codigo del estandar';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Debe indicar el nombre del estandar';
  end if;

  insert into public.accreditation_standards (
    id,
    code,
    name,
    owner_name,
    description,
    is_active,
    created_by
  )
  values (
    coalesce(p_standard_id, gen_random_uuid()),
    normalized_code,
    trim(coalesce(p_name, '')),
    nullif(trim(coalesce(p_owner_name, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_is_active, true),
    current_user_id
  )
  on conflict (code) do update
  set
    name = excluded.name,
    owner_name = excluded.owner_name,
    description = excluded.description,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now())
  returning id into saved_id;

  perform public.log_accreditation_event(
    null,
    null,
    null,
    null,
    'standard_upserted',
    'Estandar de acreditacion guardado',
    jsonb_build_object('standard_id', saved_id, 'code', normalized_code)
  );

  return saved_id;
end;
$function$;

create or replace function public.upsert_accreditation_standard_requirement(
  p_rule_id uuid default null,
  p_standard_id uuid default null,
  p_requirement_id uuid default null,
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
    raise exception 'Sin permisos para configurar requisitos de estandares';
  end if;

  if p_standard_id is null then
    raise exception 'Debe seleccionar el estandar';
  end if;

  if p_requirement_id is null then
    raise exception 'Debe seleccionar el requisito';
  end if;

  if not exists (
    select 1 from public.accreditation_standards s
    where s.id = p_standard_id
      and s.is_active = true
  ) then
    raise exception 'El estandar seleccionado no existe o esta inactivo';
  end if;

  if not exists (
    select 1 from public.accreditation_requirements r
    where r.id = p_requirement_id
      and r.is_active = true
  ) then
    raise exception 'El requisito seleccionado no existe o esta inactivo';
  end if;

  insert into public.accreditation_standard_requirements (
    id,
    standard_id,
    requirement_id,
    sort_order,
    notes,
    is_active,
    created_by
  )
  values (
    coalesce(p_rule_id, gen_random_uuid()),
    p_standard_id,
    p_requirement_id,
    coalesce(p_sort_order, 0),
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(p_is_active, true),
    current_user_id
  )
  on conflict (standard_id, requirement_id) do update
  set
    sort_order = excluded.sort_order,
    notes = excluded.notes,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now())
  returning id into saved_id;

  perform public.log_accreditation_event(
    null,
    null,
    null,
    null,
    'standard_requirement_upserted',
    'Requisito de estandar de acreditacion guardado',
    jsonb_build_object(
      'rule_id', saved_id,
      'standard_id', p_standard_id,
      'requirement_id', p_requirement_id
    )
  );

  return saved_id;
end;
$function$;

create or replace function public.upsert_accreditation_site_standard(
  p_rule_id uuid default null,
  p_site_id uuid default null,
  p_standard_id uuid default null,
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
    raise exception 'Sin permisos para asignar estandares a faenas';
  end if;

  if p_site_id is null then
    raise exception 'Debe seleccionar la faena';
  end if;

  if p_standard_id is null then
    raise exception 'Debe seleccionar el estandar';
  end if;

  if not exists (
    select 1 from public.accreditation_sites s
    where s.id = p_site_id
      and s.is_active = true
  ) then
    raise exception 'La faena seleccionada no existe o esta inactiva';
  end if;

  if not exists (
    select 1 from public.accreditation_standards s
    where s.id = p_standard_id
      and s.is_active = true
  ) then
    raise exception 'El estandar seleccionado no existe o esta inactivo';
  end if;

  insert into public.accreditation_site_standards (
    id,
    site_id,
    standard_id,
    notes,
    is_active,
    created_by
  )
  values (
    coalesce(p_rule_id, gen_random_uuid()),
    p_site_id,
    p_standard_id,
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(p_is_active, true),
    current_user_id
  )
  on conflict (site_id, standard_id) do update
  set
    notes = excluded.notes,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now())
  returning id into saved_id;

  perform public.log_accreditation_event(
    null,
    null,
    p_site_id,
    null,
    'site_standard_upserted',
    'Estandar asignado a faena',
    jsonb_build_object('rule_id', saved_id, 'site_id', p_site_id, 'standard_id', p_standard_id)
  );

  return saved_id;
end;
$function$;

drop function if exists public.upsert_accreditation_requirement(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  integer,
  boolean,
  integer,
  boolean
);

create or replace function public.upsert_accreditation_requirement(
  p_requirement_id uuid default null,
  p_code text default null,
  p_name text default null,
  p_category text default 'general',
  p_description text default null,
  p_is_mandatory boolean default true,
  p_requires_expiry_date boolean default false,
  p_alert_days_before_expiry integer default 30,
  p_blocks_accreditation boolean default true,
  p_validity_days integer default null,
  p_is_active boolean default true,
  p_process_scope text default 'accreditation'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  saved_id uuid;
  normalized_code text := lower(trim(coalesce(p_code, '')));
  normalized_scope text := lower(trim(coalesce(p_process_scope, 'accreditation')));
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para configurar requisitos de acreditacion';
  end if;

  if normalized_code = '' then
    raise exception 'Debe indicar el codigo del requisito';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Debe indicar el nombre del requisito';
  end if;

  if normalized_scope not in ('accreditation', 'internal_license', 'both') then
    raise exception 'Alcance invalido. Use: accreditation, internal_license o both';
  end if;

  if coalesce(p_alert_days_before_expiry, 30) < 0 then
    raise exception 'Los dias de alerta no pueden ser negativos';
  end if;

  if p_validity_days is not null and p_validity_days <= 0 then
    raise exception 'La vigencia debe ser positiva cuando se informa';
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
    process_scope,
    is_active,
    created_by
  )
  values (
    coalesce(p_requirement_id, gen_random_uuid()),
    normalized_code,
    trim(coalesce(p_name, '')),
    trim(coalesce(p_category, 'general')),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_is_mandatory, true),
    coalesce(p_requires_expiry_date, false),
    coalesce(p_alert_days_before_expiry, 30),
    coalesce(p_blocks_accreditation, true),
    p_validity_days,
    normalized_scope,
    coalesce(p_is_active, true),
    current_user_id
  )
  on conflict (code) do update
  set
    name = excluded.name,
    category = excluded.category,
    description = excluded.description,
    is_mandatory = excluded.is_mandatory,
    requires_expiry_date = excluded.requires_expiry_date,
    alert_days_before_expiry = excluded.alert_days_before_expiry,
    blocks_accreditation = excluded.blocks_accreditation,
    validity_days = excluded.validity_days,
    process_scope = excluded.process_scope,
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
    jsonb_build_object('requirement_id', saved_id, 'code', normalized_code, 'process_scope', normalized_scope)
  );

  return saved_id;
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

  with direct_rules as (
    select
      am.requirement_id,
      am.site_id,
      am.sort_order,
      case when am.job_title is null then 20 else 10 end as precedence
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
  ),
  standard_rules as (
    select
      asr.requirement_id,
      ass.site_id,
      asr.sort_order,
      30 as precedence
    from public.accreditation_site_standards ass
    join public.accreditation_standards ast
      on ast.id = ass.standard_id
    join public.accreditation_standard_requirements asr
      on asr.standard_id = ast.id
    join public.accreditation_requirements ar
      on ar.id = asr.requirement_id
    where ass.site_id = p_site_id
      and ass.is_active = true
      and ast.is_active = true
      and asr.is_active = true
      and ar.is_active = true
  ),
  matched_rules as (
    select distinct on (requirement_id)
      requirement_id,
      site_id,
      sort_order
    from (
      select * from direct_rules
      union all
      select * from standard_rules
    ) scoped_rules
    order by requirement_id, precedence asc, sort_order asc
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
      'job_title', worker_job_title,
      'source', 'matrix_and_standards'
    )
  );

  perform public.recalculate_accreditation_status(p_buk_employee_id, p_site_id);

  return resolved_worker_accreditation_id;
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
            'process_scope', ar.process_scope,
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
          order by ar.process_scope asc, ar.category asc, ar.name asc
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
      select coalesce(jsonb_agg(requirement_row order by requirement_row->>'process_scope', requirement_row->>'category', requirement_row->>'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', r.id,
          'code', r.code,
          'name', r.name,
          'category', r.category,
          'process_scope', r.process_scope,
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
    'standards',
    (
      select coalesce(jsonb_agg(standard_row order by standard_row->>'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', s.id,
          'code', s.code,
          'name', s.name,
          'owner_name', s.owner_name,
          'description', s.description,
          'is_active', s.is_active
        ) as standard_row
        from public.accreditation_standards s
      ) ranked_standards
    ),
    'standard_requirement_rules',
    (
      select coalesce(jsonb_agg(rule_row order by rule_row->>'standard_name', (rule_row->>'sort_order')::integer, rule_row->>'requirement_name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', asr.id,
          'standard_id', asr.standard_id,
          'standard_name', ast.name,
          'requirement_id', asr.requirement_id,
          'requirement_name', ar.name,
          'process_scope', ar.process_scope,
          'sort_order', asr.sort_order,
          'notes', asr.notes,
          'is_active', asr.is_active
        ) as rule_row
        from public.accreditation_standard_requirements asr
        join public.accreditation_standards ast
          on ast.id = asr.standard_id
        join public.accreditation_requirements ar
          on ar.id = asr.requirement_id
      ) ranked_standard_rules
    ),
    'site_standard_rules',
    (
      select coalesce(jsonb_agg(rule_row order by rule_row->>'site_name', rule_row->>'standard_name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', ass.id,
          'site_id', ass.site_id,
          'site_name', site.name,
          'standard_id', ass.standard_id,
          'standard_name', ast.name,
          'notes', ass.notes,
          'is_active', ass.is_active
        ) as rule_row
        from public.accreditation_site_standards ass
        join public.accreditation_sites site
          on site.id = ass.site_id
        join public.accreditation_standards ast
          on ast.id = ass.standard_id
      ) ranked_site_standard_rules
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
          'process_scope', r.process_scope,
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
    ),
    'contract_options',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'value', contract_code,
            'label', contract_label,
            'area_code', area_code
          )
          order by contract_label
        ),
        '[]'::jsonb
      )
      from (
        select distinct
          trim(c.code) as contract_code,
          trim(
            coalesce(nullif(c.contract_name, ''), nullif(c.cost_unit_name, ''), c.code)
          ) || ' · ' || trim(c.code) as contract_label,
          nullif(trim(c.cost_center_code), '') as area_code
        from public.contracts c
        where c.is_active = true
          and nullif(trim(c.code), '') is not null
      ) active_contracts
    ),
    'area_options',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'value', area_code,
            'label', area_label
          )
          order by area_label
        ),
        '[]'::jsonb
      )
      from (
        select distinct
          trim(c.cost_center_code) as area_code,
          trim(c.cost_center_code) || ' · ' || trim(
            coalesce(
              nullif(c.cost_center_name, ''),
              nullif(c.cost_unit_name, ''),
              nullif(c.contract_name, ''),
              c.cost_center_code
            )
          ) as area_label
        from public.contracts c
        where c.is_active = true
          and nullif(trim(c.cost_center_code), '') is not null
      ) active_areas
    ),
    'metadata',
    jsonb_build_object(
      'site_types',
      jsonb_build_array(
        jsonb_build_object('value', 'contract', 'label', 'Contrato', 'description', 'Faena o centro asociado a un contrato operativo.'),
        jsonb_build_object('value', 'cost_center', 'label', 'Centro de costo', 'description', 'Agrupador administrativo gobernado por centro de costo.'),
        jsonb_build_object('value', 'project', 'label', 'Proyecto', 'description', 'Faena temporal o frente operativo asociado a un proyecto.'),
        jsonb_build_object('value', 'site', 'label', 'Instalacion', 'description', 'Lugar fisico o recinto puntual de operacion.'),
        jsonb_build_object('value', 'other', 'label', 'Otro', 'description', 'Uso excepcional cuando no encaja en los tipos estandar.')
      ),
      'requirement_categories',
      jsonb_build_array(
        jsonb_build_object('value', 'general', 'label', 'General', 'description', 'Documento base aplicable transversalmente.'),
        jsonb_build_object('value', 'documental', 'label', 'Documental', 'description', 'Papeles legales o administrativos del trabajador.'),
        jsonb_build_object('value', 'seguridad', 'label', 'Seguridad', 'description', 'Exigencias de seguridad y prevencion de riesgos.'),
        jsonb_build_object('value', 'salud', 'label', 'Salud', 'description', 'Examenes o certificados medicos y ocupacionales.'),
        jsonb_build_object('value', 'operacional', 'label', 'Operacional', 'description', 'Habilitaciones exigidas por la faena o el cargo.'),
        jsonb_build_object('value', 'habilitante', 'label', 'Habilitante', 'description', 'Credenciales que sin ellas impiden prestar servicio.')
      ),
      'process_scopes',
      jsonb_build_array(
        jsonb_build_object('value', 'accreditation', 'label', 'Acreditacion ingreso', 'description', 'Requisito para entrar a dependencias de la faena.'),
        jsonb_build_object('value', 'internal_license', 'label', 'Licencia interna', 'description', 'Requisito para manejar u operar dentro de dependencias.'),
        jsonb_build_object('value', 'both', 'label', 'Ingreso y licencia interna', 'description', 'Requisito comun a ambos alcances.')
      ),
      'field_guides',
      jsonb_build_object(
        'site',
        jsonb_build_array(
          jsonb_build_object('key', 'code', 'label', 'Codigo', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_sites.code', 'description', 'Identificador unico interno de la faena o centro. Se reutiliza en filtros, trazabilidad y cruces operativos.'),
          jsonb_build_object('key', 'name', 'label', 'Nombre', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_sites.name', 'description', 'Nombre visible que vera el equipo en dashboard, buscadores y matrices.'),
          jsonb_build_object('key', 'site_type', 'label', 'Tipo', 'required', true, 'source', 'Catalogo controlado', 'target', 'accreditation_sites.site_type', 'description', 'Clasifica la faena para gobierno operativo. El valor viene de un catalogo fijo versionado en backend.'),
          jsonb_build_object('key', 'contract_code', 'label', 'Codigo contrato', 'required', false, 'source', 'Catalogo public.contracts', 'target', 'accreditation_sites.contract_code', 'description', 'Selecciona el contrato corporativo activo para evitar errores de digitacion y alinear acreditacion con dotacion.'),
          jsonb_build_object('key', 'area_code', 'label', 'Codigo area', 'required', false, 'source', 'Catalogo public.contracts.cost_center_code', 'target', 'accreditation_sites.area_code', 'description', 'Selecciona el CECO o codigo de area desde la estructura activa del repositorio para evitar variaciones manuales.'),
          jsonb_build_object('key', 'description', 'label', 'Descripcion', 'required', false, 'source', 'Carga manual', 'target', 'accreditation_sites.description', 'description', 'Contexto libre para aclarar alcance, mandante o notas operativas de la faena.')
        ),
        'requirement',
        jsonb_build_array(
          jsonb_build_object('key', 'code', 'label', 'Codigo', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_requirements.code', 'description', 'Identificador unico del requisito. Conviene estable y corto para auditoria y futuras integraciones.'),
          jsonb_build_object('key', 'name', 'label', 'Nombre', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_requirements.name', 'description', 'Nombre visible del documento o validacion exigida al trabajador.'),
          jsonb_build_object('key', 'category', 'label', 'Categoria', 'required', true, 'source', 'Catalogo sugerido', 'target', 'accreditation_requirements.category', 'description', 'Agrupa requisitos por dominio operativo. El catalogo sugerido viene del backend, pero queda persistido como texto estable.'),
          jsonb_build_object('key', 'process_scope', 'label', 'Alcance', 'required', true, 'source', 'Catalogo controlado', 'target', 'accreditation_requirements.process_scope', 'description', 'Distingue si el requisito habilita ingreso, licencia interna o ambos.'),
          jsonb_build_object('key', 'alert_days_before_expiry', 'label', 'Alerta dias', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_requirements.alert_days_before_expiry', 'description', 'Cuantos dias antes del vencimiento el requisito debe entrar en alerta. Solo impacta cuando el requisito usa fecha de vencimiento.'),
          jsonb_build_object('key', 'validity_days', 'label', 'Vigencia dias', 'required', false, 'source', 'Carga manual', 'target', 'accreditation_requirements.validity_days', 'description', 'Horizonte estandar de vigencia del documento si el negocio quiere gobernarlo por dias.'),
          jsonb_build_object('key', 'description', 'label', 'Descripcion', 'required', false, 'source', 'Carga manual', 'target', 'accreditation_requirements.description', 'description', 'Instruccion breve para el operador sobre que documento exacto debe pedir o revisar.'),
          jsonb_build_object('key', 'is_mandatory', 'label', 'Obligatorio', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_requirements.is_mandatory', 'description', 'Define si el requisito entra en el universo exigible de la acreditacion.'),
          jsonb_build_object('key', 'requires_expiry_date', 'label', 'Requiere vencimiento', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_requirements.requires_expiry_date', 'description', 'Activa control de fecha de expiracion y alertas por vencimiento.'),
          jsonb_build_object('key', 'blocks_accreditation', 'label', 'Bloquea acreditacion', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_requirements.blocks_accreditation', 'description', 'Si queda pendiente, rechazado o vencido, impide que la acreditacion del trabajador quede aprobada.')
        ),
        'matrix',
        jsonb_build_array(
          jsonb_build_object('key', 'site_id', 'label', 'Faena', 'required', true, 'source', 'Catalogo accreditation_sites', 'target', 'accreditation_matrix.site_id', 'description', 'Selecciona a que faena o centro se aplica la regla.'),
          jsonb_build_object('key', 'requirement_id', 'label', 'Requisito', 'required', true, 'source', 'Catalogo accreditation_requirements', 'target', 'accreditation_matrix.requirement_id', 'description', 'Selecciona que requisito sera exigido en esa faena o cargo.'),
          jsonb_build_object('key', 'job_title', 'label', 'Cargo exacto', 'required', false, 'source', 'BUK employees_active_current', 'target', 'accreditation_matrix.job_title', 'description', 'Cargo exacto obtenido desde trabajadores activos BUK. Si queda vacio, la regla aplica a toda la faena.'),
          jsonb_build_object('key', 'sort_order', 'label', 'Orden', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_matrix.sort_order', 'description', 'Orden interno para presentar o priorizar requisitos dentro de la misma faena.'),
          jsonb_build_object('key', 'notes', 'label', 'Notas', 'required', false, 'source', 'Carga manual', 'target', 'accreditation_matrix.notes', 'description', 'Contexto adicional de por que aplica la regla o como debe revisarse.')
        )
      )
    )
  );
end;
$function$;

with dmh_site as (
  insert into public.accreditation_sites (
    code,
    name,
    site_type,
    description,
    is_active
  )
  values (
    'codelco_dmh',
    'Codelco Division Ministro Hales',
    'site',
    'Faena Codelco regida inicialmente por Estandar de Control de Fatalidad 21 para ingreso.',
    true
  )
  on conflict (code) do update
  set
    name = excluded.name,
    site_type = excluded.site_type,
    description = excluded.description,
    is_active = true,
    updated_at = timezone('utc', now())
  returning id
),
ecf21_standard as (
  insert into public.accreditation_standards (
    code,
    name,
    owner_name,
    description,
    is_active
  )
  values (
    'codelco_ecf_21',
    'Estandar de Control de Fatalidad 21',
    'Codelco',
    'Estandar base de ingreso para divisiones Codelco informado por el negocio.',
    true
  )
  on conflict (code) do update
  set
    name = excluded.name,
    owner_name = excluded.owner_name,
    description = excluded.description,
    is_active = true,
    updated_at = timezone('utc', now())
  returning id
),
requirements_seed (code, name, category, process_scope, requires_expiry_date, alert_days_before_expiry, validity_days, sort_order) as (
  values
    ('cedula_identidad', 'Cedula identidad', 'documental', 'accreditation', true, 30, null::integer, 10),
    ('contrato_trabajo', 'Contrato de trabajo', 'documental', 'accreditation', false, 0, null::integer, 20),
    ('anexo_vinculacion', 'Anexo vinculacion', 'documental', 'accreditation', false, 0, null::integer, 30),
    ('examen_ocupacional', 'Examen ocupacional', 'salud', 'accreditation', true, 30, null::integer, 40),
    ('induccion_hombre_nuevo', 'Induccion Hombre Nuevo', 'seguridad', 'accreditation', true, 30, null::integer, 50),
    ('anexo_exclusividad', 'Anexo de exclusividad', 'documental', 'accreditation', false, 0, null::integer, 60),
    ('autorizacion_datos_sucal', 'Autorizacion de uso y almacenamiento de datos Sucal', 'documental', 'accreditation', false, 0, null::integer, 70),
    ('reglamento_interno', 'Reglamento Interno', 'documental', 'accreditation', false, 0, null::integer, 80),
    ('informacion_riesgos_laborales_irl', 'Informacion de Riesgos Laborales IRL', 'seguridad', 'accreditation', false, 0, null::integer, 90)
),
upserted_requirements as (
  insert into public.accreditation_requirements (
    code,
    name,
    category,
    process_scope,
    description,
    is_mandatory,
    requires_expiry_date,
    alert_days_before_expiry,
    blocks_accreditation,
    validity_days,
    is_active
  )
  select
    rs.code,
    rs.name,
    rs.category,
    rs.process_scope,
    'Requisito inicial DMH / ECF 21',
    true,
    rs.requires_expiry_date,
    rs.alert_days_before_expiry,
    true,
    rs.validity_days,
    true
  from requirements_seed rs
  on conflict (code) do update
  set
    name = excluded.name,
    category = excluded.category,
    process_scope = excluded.process_scope,
    description = excluded.description,
    is_mandatory = excluded.is_mandatory,
    requires_expiry_date = excluded.requires_expiry_date,
    alert_days_before_expiry = excluded.alert_days_before_expiry,
    blocks_accreditation = excluded.blocks_accreditation,
    validity_days = excluded.validity_days,
    is_active = true,
    updated_at = timezone('utc', now())
  returning id, code
),
linked_standard_requirements as (
  insert into public.accreditation_standard_requirements (
    standard_id,
    requirement_id,
    sort_order,
    notes,
    is_active
  )
  select
    (select id from ecf21_standard),
    ur.id,
    rs.sort_order,
    'Seed inicial DMH / ECF 21',
    true
  from upserted_requirements ur
  join requirements_seed rs
    on rs.code = ur.code
  on conflict (standard_id, requirement_id) do update
  set
    sort_order = excluded.sort_order,
    notes = excluded.notes,
    is_active = true,
    updated_at = timezone('utc', now())
  returning id
)
insert into public.accreditation_site_standards (
  site_id,
  standard_id,
  notes,
  is_active
)
values (
  (select id from dmh_site),
  (select id from ecf21_standard),
  'Asignacion inicial solicitada para Codelco Division Ministro Hales',
  true
)
on conflict (site_id, standard_id) do update
set
  notes = excluded.notes,
  is_active = true,
  updated_at = timezone('utc', now());

revoke all on function public.upsert_accreditation_standard(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.upsert_accreditation_standard(uuid, text, text, text, text, boolean) to authenticated;

revoke all on function public.upsert_accreditation_standard_requirement(uuid, uuid, uuid, integer, text, boolean) from public, anon;
grant execute on function public.upsert_accreditation_standard_requirement(uuid, uuid, uuid, integer, text, boolean) to authenticated;

revoke all on function public.upsert_accreditation_site_standard(uuid, uuid, uuid, text, boolean) from public, anon;
grant execute on function public.upsert_accreditation_site_standard(uuid, uuid, uuid, text, boolean) to authenticated;

revoke all on function public.upsert_accreditation_requirement(uuid, text, text, text, text, boolean, boolean, integer, boolean, integer, boolean, text) from public, anon;
grant execute on function public.upsert_accreditation_requirement(uuid, text, text, text, text, boolean, boolean, integer, boolean, integer, boolean, text) to authenticated;

revoke all on function public.generate_worker_requirements(text, uuid, boolean) from public, anon;
grant execute on function public.generate_worker_requirements(text, uuid, boolean) to authenticated;

revoke all on function public.get_worker_accreditation_profile(text, uuid) from public, anon;
grant execute on function public.get_worker_accreditation_profile(text, uuid) to authenticated;

revoke all on function public.get_accreditation_setup_catalogs() from public, anon;
grant execute on function public.get_accreditation_setup_catalogs() to authenticated;

notify pgrst, 'reload schema';

commit;
