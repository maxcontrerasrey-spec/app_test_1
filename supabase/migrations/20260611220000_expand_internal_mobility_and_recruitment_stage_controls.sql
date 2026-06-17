begin;

insert into public.shifts (code, name, is_active)
values
  ('10X5+5', '10X5+5', true),
  ('6X3+1', '6X3+1', true),
  ('6X1', '6X1', true)
on conflict (code) do update
set
  name = excluded.name,
  is_active = true,
  updated_at = timezone('utc', now());

insert into public.role_capabilities (role_code, capability_code)
values ('gerente_general', 'candidate_control_access')
on conflict (role_code, capability_code) do nothing;

alter table public.internal_mobility_requests
  alter column current_company_name drop not null;

alter table public.internal_mobility_requests
  add column if not exists current_shift_name text,
  add column if not exists destination_shift_id bigint references public.shifts (id) on delete set null,
  add column if not exists destination_shift_name text;

create index if not exists idx_internal_mobility_requests_destination_shift_id
  on public.internal_mobility_requests (destination_shift_id);

update public.internal_mobility_requests imr
set destination_shift_name = coalesce(
  imr.destination_shift_name,
  shift_record.name
)
from public.shifts shift_record
where imr.destination_shift_id = shift_record.id
  and imr.destination_shift_name is null;

create or replace function public.extract_buk_company_id(p_payload jsonb)
returns bigint
language sql
immutable
as $function$
  select case
    when coalesce(
      p_payload ->> 'company_id',
      p_payload -> 'company' ->> 'id',
      p_payload -> 'company' ->> 'company_id',
      p_payload -> 'current_job' ->> 'company_id',
      p_payload -> 'current_job' -> 'company' ->> 'id',
      p_payload -> 'current_job' -> 'company' ->> 'company_id',
      p_payload -> 'employee' ->> 'company_id',
      p_payload -> 'employee' -> 'company' ->> 'id'
    ) ~ '^\d+$' then
      coalesce(
        p_payload ->> 'company_id',
        p_payload -> 'company' ->> 'id',
        p_payload -> 'company' ->> 'company_id',
        p_payload -> 'current_job' ->> 'company_id',
        p_payload -> 'current_job' -> 'company' ->> 'id',
        p_payload -> 'current_job' -> 'company' ->> 'company_id',
        p_payload -> 'employee' ->> 'company_id',
        p_payload -> 'employee' -> 'company' ->> 'id'
      )::bigint
    else null
  end;
$function$;

create or replace function public.extract_buk_shift_name(p_payload jsonb)
returns text
language sql
immutable
as $function$
  select nullif(
    trim(
      coalesce(
        p_payload ->> 'shift_name',
        p_payload ->> 'shift',
        p_payload -> 'current_job' ->> 'shift_name',
        p_payload -> 'current_job' ->> 'shift',
        p_payload -> 'current_job' -> 'schedule' ->> 'name',
        p_payload -> 'current_job' -> 'schedule' ->> 'shift_name',
        p_payload -> 'employee' ->> 'shift_name'
      )
    ),
    ''
  );
$function$;

create or replace function public.resolve_buk_company_name_by_company_id(p_company_id bigint)
returns text
language sql
stable
security definer
set search_path = public
as $function$
  with ranked_companies as (
    select
      public.extract_buk_company_name(e.raw_payload) as company_name,
      count(*) as row_count,
      max(coalesce(e.updated_at, e.created_at, '-infinity'::timestamptz)) as latest_activity_at,
      row_number() over (
        order by
          count(*) desc,
          max(coalesce(e.updated_at, e.created_at, '-infinity'::timestamptz)) desc,
          public.extract_buk_company_name(e.raw_payload) asc
      ) as row_rank
    from public.employees e
    where p_company_id is not null
      and public.extract_buk_company_id(e.raw_payload) = p_company_id
      and nullif(trim(coalesce(public.extract_buk_company_name(e.raw_payload), '')), '') is not null
    group by public.extract_buk_company_name(e.raw_payload)
  )
  select rc.company_name
  from ranked_companies rc
  where rc.row_rank = 1;
$function$;

create or replace function public.resolve_candidate_worker_shift_name(
  p_document_number text
)
returns text
language sql
stable
security definer
set search_path = public
as $function$
  select cwf.shift_name
  from public.candidate_worker_files cwf
  join public.recruitment_case_candidates rcc
    on rcc.id = cwf.recruitment_case_candidate_id
  join public.candidate_profiles cp
    on cp.id = rcc.candidate_profile_id
  where nullif(trim(coalesce(cwf.shift_name, '')), '') is not null
    and upper(regexp_replace(coalesce(cp.national_id, ''), '[^0-9A-Za-z]', '', 'g')) =
      upper(regexp_replace(coalesce(p_document_number, ''), '[^0-9A-Za-z]', '', 'g'))
  order by coalesce(cwf.updated_at, cwf.created_at) desc, cwf.id desc
  limit 1;
$function$;

create or replace function public.resolve_active_employee_company_name(
  p_payload jsonb,
  p_area_name text default null
)
returns text
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(
    public.extract_buk_company_name(p_payload),
    public.resolve_buk_company_name_by_company_id(public.extract_buk_company_id(p_payload)),
    public.resolve_buk_area_company_name(p_area_name)
  );
$function$;

create or replace function public.resolve_active_employee_shift_name(
  p_payload jsonb,
  p_document_number text default null
)
returns text
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(
    public.extract_buk_shift_name(p_payload),
    public.resolve_candidate_worker_shift_name(p_document_number)
  );
$function$;

create or replace function public.user_can_view_recruitment_case(
  target_user_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    public.user_is_admin(target_user_id)
    or public.user_has_role(target_user_id, 'reclutamiento')
    or exists (
      select 1
      from public.recruitment_case_assignments rca
      where rca.recruitment_case_id = target_case_id
        and rca.user_id = target_user_id
    )
    or (
      public.user_has_capability(target_user_id, 'can_approve_who_stage')
      and exists (
        select 1
        from public.recruitment_case_candidates rcc
        join public.candidate_stage_approvals csa
          on csa.recruitment_case_candidate_id = rcc.id
         and csa.stage_code = 'who_pending'
         and csa.status = 'pending'
        where rcc.recruitment_case_id = target_case_id
      )
    );
$function$;

create or replace function public.user_can_access_recruitment_case(
  target_user_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select public.user_can_view_recruitment_case(target_user_id, target_case_id);
$function$;

drop policy if exists "candidate_stage_approvals_select_scoped" on public.candidate_stage_approvals;
create policy "candidate_stage_approvals_select_scoped"
on public.candidate_stage_approvals
for select
to authenticated
using (
  exists (
    select 1
    from public.recruitment_case_candidates rcc
    where rcc.id = candidate_stage_approvals.recruitment_case_candidate_id
      and public.user_can_view_recruitment_case((select auth.uid()), rcc.recruitment_case_id)
  )
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'recruitment_case_candidates_stage_code_check'
      and conrelid = 'public.recruitment_case_candidates'::regclass
  ) then
    alter table public.recruitment_case_candidates
      drop constraint recruitment_case_candidates_stage_code_check;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'recruitment_case_candidates_stage_check'
      and conrelid = 'public.recruitment_case_candidates'::regclass
  ) then
    alter table public.recruitment_case_candidates
      drop constraint recruitment_case_candidates_stage_check;
  end if;
end
$$;

alter table public.recruitment_case_candidates
  add constraint recruitment_case_candidates_stage_code_check
  check (
    stage_code in (
      'lead',
      'who_pending',
      'who_approved',
      'in_process',
      'medical_exams',
      'document_review',
      'ready_for_hire',
      'hired',
      'rejected',
      'withdrawn'
    )
  );

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'recruitment_case_audit_log_action_type_check'
      and conrelid = 'public.recruitment_case_audit_log'::regclass
  ) then
    alter table public.recruitment_case_audit_log
      drop constraint recruitment_case_audit_log_action_type_check;
  end if;

  alter table public.recruitment_case_audit_log
    add constraint recruitment_case_audit_log_action_type_check
    check (
      action_type in (
        'case_opened',
        'owner_assigned',
        'candidate_added',
        'candidate_stage_changed',
        'candidate_hired',
        'case_status_synced',
        'candidate_stage_approval_requested',
        'candidate_stage_approval_pending',
        'candidate_stage_approval_approved',
        'candidate_stage_approval_rejected',
        'candidate_person_profile_updated',
        'candidate_worker_file_created',
        'candidate_worker_file_updated',
        'candidate_worker_file_cleared',
        'document_uploaded',
        'document_reviewed',
        'candidate_transferred_out',
        'candidate_transferred_in'
      )
    );
end
$$;

drop function if exists public.advance_recruitment_candidate_stage(uuid, text, text);
create or replace function public.advance_recruitment_candidate_stage(
  p_case_candidate_id uuid,
  p_to_stage text,
  p_comment text default null
)
returns table (
  recruitment_case_id uuid,
  stage_code text,
  case_status text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
  next_case_status text;
  conflicting_contract_lock record;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  if p_to_stage not in (
    'lead',
    'who_pending',
    'who_approved',
    'in_process',
    'medical_exams',
    'document_review',
    'ready_for_hire',
    'hired',
    'rejected',
    'withdrawn'
  ) then
    raise exception 'Etapa invalida';
  end if;

  if p_to_stage = 'who_pending' then
    raise exception 'La etapa Who debe solicitarse con request_candidate_stage_who';
  end if;

  if p_to_stage in ('rejected', 'withdrawn') and normalized_comment is null then
    raise exception 'Debe proporcionar un motivo para descartar al candidato';
  end if;

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para actualizar este candidato';
  end if;

  if candidate_record.stage_code in ('hired', 'rejected', 'withdrawn') then
    raise exception 'El candidato ya se encuentra en una etapa terminal';
  end if;

  if candidate_record.stage_code = p_to_stage then
    raise exception 'El candidato ya se encuentra en esta etapa';
  end if;

  if candidate_record.stage_code = 'lead'
     and p_to_stage not in ('rejected', 'withdrawn') then
    raise exception 'Desde Lead solo puedes enviar a Who o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'who_pending'
     and p_to_stage not in ('rejected', 'withdrawn') then
    raise exception 'El candidato no puede avanzar hasta que la aprobación Who sea resuelta';
  end if;

  if candidate_record.stage_code = 'who_approved'
     and p_to_stage not in ('in_process', 'rejected', 'withdrawn') then
    raise exception 'Desde Who Aprobado solo puedes mover a En Proceso o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'in_process'
     and p_to_stage not in ('medical_exams', 'rejected', 'withdrawn') then
    raise exception 'Desde En Proceso solo puedes mover a Exámenes Médicos o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'medical_exams'
     and p_to_stage not in ('document_review', 'rejected', 'withdrawn') then
    raise exception 'Desde Exámenes Médicos solo puedes mover a Revisión Documental o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'document_review'
     and p_to_stage not in ('ready_for_hire', 'rejected', 'withdrawn') then
    raise exception 'Desde Revisión Documental solo puedes mover a Listo para contratar o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'ready_for_hire'
     and p_to_stage not in ('hired', 'rejected', 'withdrawn') then
    raise exception 'Desde Listo para contratar solo puedes contratar o cerrar la participación';
  end if;

  if p_to_stage = 'medical_exams'
     and candidate_record.stage_code <> 'in_process' then
    raise exception 'El candidato debe pasar por En Proceso antes de Exámenes Médicos';
  end if;

  if p_to_stage in ('in_process', 'medical_exams')
     and not exists (
       select 1
       from public.candidate_stage_approvals csa
       where csa.recruitment_case_candidate_id = candidate_record.id
         and csa.stage_code = 'who_pending'
         and csa.status = 'approved'
     ) then
    raise exception 'No existe aprobación Who resuelta para este candidato';
  end if;

  if p_to_stage = 'ready_for_hire' then
    select *
      into conflicting_contract_lock
      from public.find_active_candidate_contract_lock(
        candidate_record.candidate_profile_id,
        candidate_record.id
      )
      limit 1;

    if conflicting_contract_lock.case_candidate_id is not null then
      raise exception 'El candidato mantiene una ruta contractual activa y no puede quedar listo para contratar';
    end if;
  end if;

  update public.recruitment_case_candidates rcc
     set stage_code = p_to_stage,
         stage_entered_at = timezone('utc', now()),
         hired_at = case when p_to_stage = 'hired' then timezone('utc', now()) else rcc.hired_at end,
         rejection_reason = case when p_to_stage = 'rejected' then normalized_comment else rcc.rejection_reason end,
         withdrawal_reason = case when p_to_stage = 'withdrawn' then normalized_comment else rcc.withdrawal_reason end,
         updated_at = timezone('utc', now())
   where rcc.id = candidate_record.id;

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id,
    from_stage,
    to_stage,
    changed_by,
    reason_code,
    comment
  )
  values (
    candidate_record.id,
    candidate_record.stage_code,
    p_to_stage,
    current_user_id,
    'manual_transition',
    normalized_comment
  );

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    old_values,
    new_values,
    metadata
  )
  values (
    candidate_record.recruitment_case_id,
    candidate_record.id,
    current_user_id,
    case when p_to_stage = 'hired' then 'candidate_hired' else 'candidate_stage_changed' end,
    jsonb_build_object(
      'stage_code', candidate_record.stage_code
    ),
    jsonb_build_object(
      'stage_code', p_to_stage
    ),
    jsonb_build_object(
      'comment', normalized_comment
    )
  );

  next_case_status := public.sync_recruitment_case_status(candidate_record.recruitment_case_id, current_user_id);

  return query
  select candidate_record.recruitment_case_id, p_to_stage, next_case_status;
end;
$function$;

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
    'shift_catalog',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'code', s.code,
          'name', s.name,
          'active', s.is_active
        )
        order by s.name asc
      )
      from public.shifts s
      where s.is_active = true
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
    public.resolve_active_employee_company_name(e.raw_payload, e.area_name) as company_name,
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
    public.resolve_active_employee_company_name(e.raw_payload, e.area_name) as current_company_name,
    public.resolve_active_employee_shift_name(
      e.raw_payload,
      coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut')
    ) as current_shift_name,
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
      'current_shift_name', worker_record.current_shift_name,
      'matched_destination_contract_id', worker_record.matched_destination_contract_id,
      'matched_destination_contract_code', worker_record.matched_destination_contract_code,
      'matched_destination_area_name', worker_record.matched_destination_area_name,
      'matched_destination_company_name', worker_record.matched_destination_company_name
    )
  );
end;
$function$;

drop function if exists public.submit_internal_mobility_request(text, bigint, text, text, boolean);
create or replace function public.submit_internal_mobility_request(
  p_buk_employee_id text,
  p_destination_contract_id bigint,
  p_destination_job_title text,
  p_destination_shift_id bigint,
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
  destination_shift_record public.shifts%rowtype;
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

  if p_destination_shift_id is null then
    raise exception 'Debe seleccionar el turno destino';
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
    public.resolve_active_employee_company_name(e.raw_payload, e.area_name) as current_company_name,
    public.resolve_active_employee_shift_name(
      e.raw_payload,
      coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut')
    ) as current_shift_name
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

  select *
    into destination_shift_record
    from public.shifts s
   where s.id = p_destination_shift_id
     and s.is_active = true
   limit 1;

  if destination_shift_record.id is null then
    raise exception 'Turno destino invalido o inactivo';
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
    worker_record.current_company_name is not null
    and worker_record.current_company_name is distinct from destination_record.company_name;

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
    current_shift_name,
    destination_job_title,
    destination_contract_id,
    destination_contract_code,
    destination_contract_number,
    destination_area_name,
    destination_area_code,
    destination_cost_center_code,
    destination_cost_center_name,
    destination_company_name,
    destination_shift_id,
    destination_shift_name,
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
    worker_record.current_shift_name,
    trim(p_destination_job_title),
    destination_record.contract_id,
    destination_record.contract_code,
    destination_record.contract_number,
    destination_record.area_name,
    destination_record.area_code,
    destination_record.cost_center_code,
    destination_record.cost_center_name,
    destination_record.company_name,
    destination_shift_record.id,
    destination_shift_record.name,
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
    'current_shift_name', worker_record.current_shift_name,
    'destination_job_title', trim(p_destination_job_title),
    'destination_contract_id', destination_record.contract_id,
    'destination_contract_code', destination_record.contract_code,
    'destination_contract_number', destination_record.contract_number,
    'destination_area_name', destination_record.area_name,
    'destination_area_code', destination_record.area_code,
    'destination_cost_center_code', destination_record.cost_center_code,
    'destination_cost_center_name', destination_record.cost_center_name,
    'destination_company_name', destination_record.company_name,
    'destination_shift_id', destination_shift_record.id,
    'destination_shift_name', destination_shift_record.name,
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

drop function if exists public.get_internal_mobility_requests();
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
  current_shift_name text,
  destination_job_title text,
  destination_area_name text,
  destination_shift_name text,
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
    imr.current_shift_name,
    imr.destination_job_title,
    imr.destination_area_name,
    imr.destination_shift_name,
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
      'current_shift_name', imr.current_shift_name,
      'destination_job_title', imr.destination_job_title,
      'destination_contract_id', imr.destination_contract_id,
      'destination_contract_code', imr.destination_contract_code,
      'destination_contract_number', imr.destination_contract_number,
      'destination_area_name', imr.destination_area_name,
      'destination_area_code', imr.destination_area_code,
      'destination_cost_center_code', imr.destination_cost_center_code,
      'destination_cost_center_name', imr.destination_cost_center_name,
      'destination_company_name', imr.destination_company_name,
      'destination_shift_id', imr.destination_shift_id,
      'destination_shift_name', imr.destination_shift_name,
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

revoke all on function public.user_can_view_recruitment_case(uuid, uuid) from public, anon;
grant execute on function public.user_can_view_recruitment_case(uuid, uuid) to authenticated;

revoke all on function public.user_can_access_recruitment_case(uuid, uuid) from public, anon;
grant execute on function public.user_can_access_recruitment_case(uuid, uuid) to authenticated;

revoke all on function public.get_internal_mobility_setup_catalogs() from public, anon;
grant execute on function public.get_internal_mobility_setup_catalogs() to authenticated;

revoke all on function public.search_internal_mobility_workers(text, integer) from public, anon;
grant execute on function public.search_internal_mobility_workers(text, integer) to authenticated;

revoke all on function public.get_internal_mobility_worker_context(text) from public, anon;
grant execute on function public.get_internal_mobility_worker_context(text) to authenticated;

revoke all on function public.submit_internal_mobility_request(text, bigint, text, bigint, text, boolean) from public, anon;
grant execute on function public.submit_internal_mobility_request(text, bigint, text, bigint, text, boolean) to authenticated;

revoke all on function public.get_internal_mobility_requests() from public, anon;
grant execute on function public.get_internal_mobility_requests() to authenticated;

revoke all on function public.get_internal_mobility_request_detail(uuid) from public, anon;
grant execute on function public.get_internal_mobility_request_detail(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
