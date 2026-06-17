-- Migration: Add update_candidate_driver_license security definer RPC
-- Created At: 2026-05-22

create or replace function public.update_candidate_driver_license(
  p_profile_id uuid,
  p_license_class text,
  p_license_expiry date
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  has_access boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  -- check if user can manage at least one active recruitment case where this candidate is assigned
  select exists (
    select 1 
      from public.recruitment_case_candidates rcc
      join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
     where rcc.candidate_profile_id = p_profile_id
       and public.user_can_manage_recruitment_case(current_user_id, rc.id)
  ) into has_access;

  -- if not, check if user is admin
  if not has_access then
    select exists (
      select 1 
        from public.user_roles ur
        join public.app_roles ar on ar.id = ur.role_id
       where ur.user_id = current_user_id
         and ar.code = 'admin'
    ) into has_access;
  end if;

  if not has_access then
    raise exception 'Sin permisos para editar este perfil de candidato';
  end if;

  update public.candidate_profiles
  set
    driver_license_class = nullif(trim(p_license_class), ''),
    driver_license_expiry = p_license_expiry
  where id = p_profile_id;
end;
$function$;

-- Revoke all direct permissions to public/anon
revoke all on function public.update_candidate_driver_license(uuid, text, date) from public, anon;

-- Grant execution to authenticated users
grant execute on function public.update_candidate_driver_license(uuid, text, date) to authenticated;
begin;

-- 1. ENUMS AND TABLES

do $$ begin
  create type public.candidate_document_status as enum (
    'pending',
    'uploaded',
    'approved',
    'rejected',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_critical boolean not null default false,
  requires_expiry_date boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.candidate_documents (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  recruitment_case_id uuid not null references public.recruitment_cases(id) on delete cascade,
  document_type_id uuid not null references public.document_types(id) on delete restrict,
  status public.candidate_document_status not null default 'pending',
  file_path text,
  issue_date date,
  expiry_date date,
  uploaded_by uuid references auth.users(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (recruitment_case_id, candidate_profile_id, document_type_id)
);

create index if not exists idx_candidate_documents_case_candidate on public.candidate_documents(recruitment_case_id, candidate_profile_id);
create index if not exists idx_candidate_documents_status on public.candidate_documents(status);

-- Enable RLS
alter table public.document_types enable row level security;
alter table public.candidate_documents enable row level security;

-- 2. RLS POLICIES

-- document_types: Read for authenticated, Write only for admin
drop policy if exists "document_types_select" on public.document_types;
create policy "document_types_select"
on public.document_types for select
to authenticated
using (true);

drop policy if exists "document_types_admin_all" on public.document_types;
create policy "document_types_admin_all"
on public.document_types for all
to authenticated
using (public.user_is_admin(auth.uid()));

-- candidate_documents: Read/Write scoped to recruitment case access
drop policy if exists "candidate_documents_select_scoped" on public.candidate_documents;
create policy "candidate_documents_select_scoped"
on public.candidate_documents for select
to authenticated
using (public.user_can_view_recruitment_case(auth.uid(), recruitment_case_id));

drop policy if exists "candidate_documents_insert_scoped" on public.candidate_documents;
create policy "candidate_documents_insert_scoped"
on public.candidate_documents for insert
to authenticated
with check (public.user_can_manage_recruitment_case(auth.uid(), recruitment_case_id));

drop policy if exists "candidate_documents_update_scoped" on public.candidate_documents;
create policy "candidate_documents_update_scoped"
on public.candidate_documents for update
to authenticated
using (public.user_can_manage_recruitment_case(auth.uid(), recruitment_case_id));


-- 3. MASTER CATALOG SEEDING
insert into public.document_types (name, is_critical, requires_expiry_date) values
  ('Cédula de identidad', true, true),
  ('Currículum Vitae (CV)', false, false),
  ('Certificado de antecedentes', true, true),
  ('Licencia de conducir', true, true),
  ('Hoja de vida del conductor', true, false),
  ('Certificado de estudios', false, false),
  ('Certificados laborales', false, false),
  ('Exámenes preocupacionales', true, true),
  ('Certificaciones técnicas', false, false),
  ('Referencias laborales', false, false)
on conflict do nothing;


-- 4. RPCS PARA GESTION DOCUMENTAL Y SEMAFORO

create or replace function public.get_candidate_checklist(
  p_case_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_rec public.recruitment_case_candidates%rowtype;
  checklist_docs jsonb;
  semaphore_color text;
  pending_critical integer;
  rejected_critical integer;
  expired_critical integer;
  pending_mandatory integer;
  uploaded_unreviewed integer;
  observed_non_critical integer;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select * into candidate_rec from public.recruitment_case_candidates where id = p_case_candidate_id;
  
  if candidate_rec.id is null then
    raise exception 'Candidato no encontrado';
  end if;

  if not public.user_can_view_recruitment_case(current_user_id, candidate_rec.recruitment_case_id) then
    raise exception 'Sin permisos para ver el caso de este candidato';
  end if;

  -- Para el MVP, todos los documentos del catálogo aplican a todos los cargos.
  -- En una fase posterior se puede filtrar por job_position_document_requirements.
  
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', cd.id,
      'document_type_id', dt.id,
      'name', dt.name,
      'is_critical', dt.is_critical,
      'requires_expiry_date', dt.requires_expiry_date,
      'status', coalesce(cd.status, 'pending'),
      'file_path', cd.file_path,
      'expiry_date', cd.expiry_date,
      'reviewed_at', cd.reviewed_at,
      'reviewer_notes', cd.reviewer_notes
    ) order by dt.is_critical desc, dt.name asc
  ), '[]'::jsonb)
  into checklist_docs
  from public.document_types dt
  left join public.candidate_documents cd 
    on cd.document_type_id = dt.id 
    and cd.candidate_profile_id = candidate_rec.candidate_profile_id
    and cd.recruitment_case_id = candidate_rec.recruitment_case_id
  where dt.active = true;

  -- Calcular el color del semáforo
  select
    count(*) filter (where dt.is_critical and coalesce(cd.status, 'pending') = 'pending'),
    count(*) filter (where dt.is_critical and coalesce(cd.status, 'pending') = 'rejected'),
    count(*) filter (where dt.is_critical and coalesce(cd.status, 'pending') = 'expired'),
    count(*) filter (where coalesce(cd.status, 'pending') = 'pending'),
    count(*) filter (where coalesce(cd.status, 'pending') = 'uploaded'),
    count(*) filter (where not dt.is_critical and coalesce(cd.status, 'pending') = 'rejected') -- We treat rejected non-critical as 'observed' for MVP semantics
  into 
    pending_critical, rejected_critical, expired_critical, pending_mandatory, uploaded_unreviewed, observed_non_critical
  from public.document_types dt
  left join public.candidate_documents cd 
    on cd.document_type_id = dt.id 
    and cd.candidate_profile_id = candidate_rec.candidate_profile_id
    and cd.recruitment_case_id = candidate_rec.recruitment_case_id
  where dt.active = true;

  if (pending_critical + rejected_critical + expired_critical) > 0 then
    -- Si solo son pendientes críticos y no hay rechazados/vencidos ni cargados, quizás es el estado inicial
    if rejected_critical = 0 and expired_critical = 0 and uploaded_unreviewed = 0 and pending_mandatory = (select count(*) from public.document_types where active = true) then
      semaphore_color := 'gray';
    else
      semaphore_color := 'red';
    end if;
  elsif uploaded_unreviewed > 0 or observed_non_critical > 0 then
    semaphore_color := 'yellow';
  elsif pending_mandatory > 0 then
    -- Faltan obligatorios no críticos
    semaphore_color := 'yellow';
  else
    semaphore_color := 'green';
  end if;

  return jsonb_build_object(
    'semaphore', semaphore_color,
    'documents', checklist_docs
  );
end;
$function$;

create or replace function public.upload_candidate_document(
  p_case_candidate_id uuid,
  p_document_type_id uuid,
  p_file_path text,
  p_expiry_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_rec public.recruitment_case_candidates%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select * into candidate_rec from public.recruitment_case_candidates where id = p_case_candidate_id;
  
  if candidate_rec.id is null then
    raise exception 'Candidato no encontrado';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, candidate_rec.recruitment_case_id) then
    raise exception 'Sin permisos para cargar documentos en este caso';
  end if;

  insert into public.candidate_documents (
    candidate_profile_id,
    recruitment_case_id,
    document_type_id,
    file_path,
    expiry_date,
    status,
    uploaded_by,
    updated_at
  ) values (
    candidate_rec.candidate_profile_id,
    candidate_rec.recruitment_case_id,
    p_document_type_id,
    p_file_path,
    p_expiry_date,
    'uploaded',
    current_user_id,
    timezone('utc', now())
  ) on conflict (recruitment_case_id, candidate_profile_id, document_type_id) do update set
    file_path = excluded.file_path,
    expiry_date = excluded.expiry_date,
    status = 'uploaded',
    uploaded_by = excluded.uploaded_by,
    reviewed_at = null,
    reviewed_by = null,
    reviewer_notes = null,
    updated_at = timezone('utc', now());

  -- Generar evento de auditoría documental
  insert into public.recruitment_case_audit_log (
    recruitment_case_id, recruitment_case_candidate_id, actor_user_id, action_type, metadata
  ) values (
    candidate_rec.recruitment_case_id, p_case_candidate_id, current_user_id, 'document_uploaded', jsonb_build_object('document_type_id', p_document_type_id)
  );
end;
$function$;


create or replace function public.review_candidate_document(
  p_document_id uuid,
  p_status text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  doc_rec public.candidate_documents%rowtype;
  dt_rec public.document_types%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Estado de revisión inválido';
  end if;

  select * into doc_rec from public.candidate_documents where id = p_document_id;
  if doc_rec.id is null then
    raise exception 'Documento no encontrado';
  end if;

  select * into dt_rec from public.document_types where id = doc_rec.document_type_id;

  if not public.user_can_manage_recruitment_case(current_user_id, doc_rec.recruitment_case_id) then
    raise exception 'Sin permisos para gestionar este caso';
  end if;

  -- Regla de negocio: Si es crítico, solo alguien con rol compliance o admin puede revisarlo
  if dt_rec.is_critical then
    if not (public.user_is_admin(current_user_id) or public.user_has_role(current_user_id, 'compliance_documental')) then
      raise exception 'Solo Compliance Documental o Admin puede aprobar/rechazar documentos críticos';
    end if;
  end if;

  update public.candidate_documents
  set
    status = p_status::public.candidate_document_status,
    reviewed_by = current_user_id,
    reviewed_at = timezone('utc', now()),
    reviewer_notes = p_notes,
    updated_at = timezone('utc', now())
  where id = p_document_id;

  insert into public.recruitment_case_audit_log (
    recruitment_case_id, recruitment_case_candidate_id, actor_user_id, action_type, metadata
  ) values (
    doc_rec.recruitment_case_id, doc_rec.candidate_profile_id, current_user_id, 'document_reviewed', jsonb_build_object('document_id', p_document_id, 'status', p_status)
  );
end;
$function$;


-- 5. ENDURECER ADVANCE STAGE CON BLOQUEO DOCUMENTAL

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
  semaphore_data jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_to_stage not in ('lead', 'contacted', 'screening', 'shortlisted', 'documents_pending', 'ready_for_hire', 'hired', 'rejected', 'withdrawn') then
    raise exception 'Etapa invalida';
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
    raise exception 'El candidato ya se encuentra en esa etapa';
  end if;

  if p_to_stage in ('ready_for_hire', 'hired') then
    
    -- BLOQUEO 1: Bloqueo Contractual Transversal
    select *
      into conflicting_contract_lock
      from public.find_active_candidate_contract_lock(
        candidate_record.candidate_profile_id,
        candidate_record.id
      );

    if conflicting_contract_lock.case_candidate_id is not null then
      raise exception
        'El candidato ya avanza a contrato en % (%)',
        coalesce(conflicting_contract_lock.case_code, 'otro folio'),
        coalesce(conflicting_contract_lock.folio, 'sin folio');
    end if;

    -- BLOQUEO 2: Semáforo Documental
    semaphore_data := public.get_candidate_checklist(p_case_candidate_id);
    if semaphore_data->>'semaphore' != 'green' then
      raise exception 'Bloqueo Documental: El semáforo no está verde. No se puede avanzar a contratación sin los documentos críticos aprobados.';
    end if;

  end if;

  update public.recruitment_case_candidates rcc
     set stage_code = p_to_stage,
         stage_entered_at = timezone('utc', now()),
         is_selected = case
           when p_to_stage in ('ready_for_hire', 'hired') then true
           when p_to_stage in ('rejected', 'withdrawn') then false
           else rcc.is_selected
         end,
         hired_at = case
           when p_to_stage = 'hired' then timezone('utc', now())
           else rcc.hired_at
         end,
         rejection_reason = case when p_to_stage = 'rejected' then normalized_comment else rcc.rejection_reason end,
         withdrawal_reason = case when p_to_stage = 'withdrawn' then normalized_comment else rcc.withdrawal_reason end,
         suitability_status = case
           when p_to_stage in ('ready_for_hire', 'hired') then 'fit'
           when p_to_stage in ('rejected', 'withdrawn') then 'blocked'
           else rcc.suitability_status
         end,
         updated_at = timezone('utc', now())
   where rcc.id = p_case_candidate_id;

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id,
    from_stage,
    to_stage,
    changed_by,
    reason_code,
    comment
  )
  values (
    p_case_candidate_id,
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
    new_values
  )
  values (
    candidate_record.recruitment_case_id,
    p_case_candidate_id,
    current_user_id,
    'candidate_stage_changed',
    jsonb_build_object('stage_code', candidate_record.stage_code),
    jsonb_build_object('stage_code', p_to_stage, 'comment', normalized_comment)
  );

  -- Sincronizar estado del caso si avanzó a hired
  if p_to_stage = 'hired' then
    perform public.sync_recruitment_case_status(candidate_record.recruitment_case_id);
  end if;

  select rc.id, rcc.stage_code, rc.status
    into recruitment_case_id, stage_code, case_status
    from public.recruitment_case_candidates rcc
    join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
   where rcc.id = p_case_candidate_id;

  return next;
  return;
end;
$function$;

-- Grant execution permissions
grant execute on function public.get_candidate_checklist(uuid) to authenticated;
grant execute on function public.upload_candidate_document(uuid, uuid, text, date) to authenticated;
grant execute on function public.review_candidate_document(uuid, text, text) to authenticated;
grant execute on function public.advance_recruitment_candidate_stage(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
