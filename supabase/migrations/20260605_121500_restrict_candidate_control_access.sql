begin;

insert into public.app_capabilities (code, name, description)
values (
  'candidate_control_access',
  'Acceso a Control de candidatos',
  'Permite ver y operar el subflujo Control de candidatos dentro de Control de Contrataciones.'
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  updated_at = timezone('utc', now());

insert into public.role_capabilities (role_code, capability_code)
values ('reclutamiento', 'candidate_control_access')
on conflict (role_code, capability_code) do nothing;

create or replace function public.user_can_access_candidate_control(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select public.user_is_admin(target_user_id)
      or public.user_has_capability(target_user_id, 'candidate_control_access');
$function$;

create or replace function public.assert_candidate_control_access(target_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if target_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_candidate_control(target_user_id) then
    raise exception 'Sin permisos para acceder a Control de candidatos';
  end if;
end;
$function$;

drop function if exists public.find_candidate_profile_by_rut(text);
drop function if exists public.update_candidate_driver_license(uuid, text, date);
drop function if exists public.update_candidate_interview_notes(uuid, text);
drop function if exists public.add_candidate_to_recruitment_case(uuid, text, text, text, text);
drop function if exists public.get_candidate_checklist(uuid);
drop function if exists public.upload_candidate_document(uuid, uuid, text, date);
drop function if exists public.review_candidate_document(uuid, text, text);
drop function if exists public.advance_recruitment_candidate_stage(uuid, text, text);
drop function if exists public.request_candidate_stage_who(uuid, text, jsonb);
drop function if exists public.get_recruitment_case_detail(uuid);
drop function if exists public.get_recruitment_control_dashboard_v2();
drop function if exists public.upsert_candidate_person_profile(
  uuid, text, text, text, text, text, text, date, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, text, date, text, date, text, text, text,
  text, text, text, text
);
drop function if exists public.upsert_candidate_worker_file(
  uuid, text, text, date, text, numeric, text, text, date, date, date, text, text, text, text, text,
  text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text, text, text,
  integer, integer, integer, text, date
);
drop function if exists public.get_candidate_buk_profile(uuid);

create or replace function public.find_candidate_profile_by_rut(
  p_national_id text
)
returns table (
  id uuid,
  national_id text,
  full_name text,
  email text,
  phone text
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

  perform public.assert_candidate_control_access(current_user_id);

  return query
  select cp.id, cp.national_id, cp.full_name, cp.email, cp.phone
    from public.candidate_profiles cp
   where cp.national_id = trim(p_national_id)
   limit 1;
end;
$function$;

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

  perform public.assert_candidate_control_access(current_user_id);

  select exists (
    select 1
      from public.recruitment_case_candidates rcc
      join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
     where rcc.candidate_profile_id = p_profile_id
       and public.user_can_manage_recruitment_case(current_user_id, rc.id)
  ) into has_access;

  if not has_access and public.user_is_admin(current_user_id) then
    has_access := true;
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

create or replace function public.update_candidate_interview_notes(
  p_case_candidate_id uuid,
  p_notes text
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

  perform public.assert_candidate_control_access(current_user_id);

  select * into candidate_rec
    from public.recruitment_case_candidates
   where id = p_case_candidate_id;

  if candidate_rec.id is null then
    raise exception 'Candidato no encontrado';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, candidate_rec.recruitment_case_id) then
    raise exception 'Sin permisos para editar este candidato';
  end if;

  update public.recruitment_case_candidates
  set
    interview_notes = nullif(trim(p_notes), ''),
    updated_at = timezone('utc', now())
  where id = p_case_candidate_id;

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    new_values
  )
  values (
    candidate_rec.recruitment_case_id,
    p_case_candidate_id,
    current_user_id,
    'candidate_interview_notes_updated',
    jsonb_build_object('interview_notes', nullif(trim(p_notes), ''))
  );
end;
$function$;

create or replace function public.add_candidate_to_recruitment_case(
  p_case_id uuid,
  p_national_id text,
  p_full_name text,
  p_email text default null,
  p_phone text default null
)
returns table (
  case_candidate_id uuid,
  candidate_profile_id uuid
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  case_record public.recruitment_cases%rowtype;
  profile_id uuid;
  created_case_candidate_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  if not public.user_can_manage_recruitment_case(current_user_id, p_case_id) then
    raise exception 'Sin permisos para actualizar este caso';
  end if;

  select *
    into case_record
    from public.recruitment_cases rc
   where rc.id = p_case_id
   for update;

  if case_record.id is null then
    raise exception 'No existe el caso indicado';
  end if;

  if case_record.status in ('filled', 'closed_unfilled', 'cancelled') then
    raise exception 'El caso ya no acepta candidatos nuevos';
  end if;

  if nullif(trim(coalesce(p_national_id, '')), '') is null then
    raise exception 'El identificador del candidato es obligatorio';
  end if;

  if nullif(trim(coalesce(p_full_name, '')), '') is null then
    raise exception 'El nombre del candidato es obligatorio';
  end if;

  insert into public.candidate_profiles (
    national_id,
    full_name,
    email,
    phone
  )
  values (
    trim(p_national_id),
    trim(p_full_name),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), '')
  )
  on conflict (national_id) do update
  set
    full_name = excluded.full_name,
    email = coalesce(excluded.email, public.candidate_profiles.email),
    phone = coalesce(excluded.phone, public.candidate_profiles.phone),
    updated_at = timezone('utc', now())
  returning id into profile_id;

  insert into public.recruitment_case_candidates (
    recruitment_case_id,
    candidate_profile_id,
    stage_code,
    stage_entered_at,
    suitability_status,
    is_selected,
    created_by
  )
  values (
    p_case_id,
    profile_id,
    'lead',
    timezone('utc', now()),
    'unknown',
    false,
    current_user_id
  )
  on conflict (recruitment_case_id, candidate_profile_id) do nothing
  returning id into created_case_candidate_id;

  if created_case_candidate_id is null then
    select rcc.id
      into created_case_candidate_id
      from public.recruitment_case_candidates rcc
     where rcc.recruitment_case_id = p_case_id
       and rcc.candidate_profile_id = profile_id;
  else
    insert into public.recruitment_case_candidate_stage_history (
      recruitment_case_candidate_id,
      from_stage,
      to_stage,
      changed_by,
      reason_code,
      comment
    )
    values (
      created_case_candidate_id,
      null,
      'lead',
      current_user_id,
      'candidate_added',
      null
    );

    insert into public.recruitment_case_audit_log (
      recruitment_case_id,
      recruitment_case_candidate_id,
      actor_user_id,
      action_type,
      new_values,
      metadata
    )
    values (
      p_case_id,
      created_case_candidate_id,
      current_user_id,
      'candidate_added',
      jsonb_build_object(
        'candidate_profile_id', profile_id,
        'stage_code', 'lead'
      ),
      jsonb_build_object(
        'national_id', trim(p_national_id),
        'full_name', trim(p_full_name)
      )
    );
  end if;

  perform public.sync_recruitment_case_status(p_case_id, current_user_id);

  return query
  select created_case_candidate_id, profile_id;
end;
$function$;

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

  perform public.assert_candidate_control_access(current_user_id);

  select * into candidate_rec from public.recruitment_case_candidates where id = p_case_candidate_id;

  if candidate_rec.id is null then
    raise exception 'Candidato no encontrado';
  end if;

  if not public.user_can_view_recruitment_case(current_user_id, candidate_rec.recruitment_case_id) then
    raise exception 'Sin permisos para ver el caso de este candidato';
  end if;

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

  select
    count(*) filter (where dt.is_critical and coalesce(cd.status, 'pending') = 'pending'),
    count(*) filter (where dt.is_critical and coalesce(cd.status, 'pending') = 'rejected'),
    count(*) filter (where dt.is_critical and coalesce(cd.status, 'pending') = 'expired'),
    count(*) filter (where coalesce(cd.status, 'pending') = 'pending'),
    count(*) filter (where coalesce(cd.status, 'pending') = 'uploaded'),
    count(*) filter (where not dt.is_critical and coalesce(cd.status, 'pending') = 'rejected')
  into
    pending_critical, rejected_critical, expired_critical, pending_mandatory, uploaded_unreviewed, observed_non_critical
  from public.document_types dt
  left join public.candidate_documents cd
    on cd.document_type_id = dt.id
    and cd.candidate_profile_id = candidate_rec.candidate_profile_id
    and cd.recruitment_case_id = candidate_rec.recruitment_case_id
  where dt.active = true;

  if (pending_critical + rejected_critical + expired_critical) > 0 then
    if rejected_critical = 0 and expired_critical = 0 and uploaded_unreviewed = 0 and pending_mandatory = (select count(*) from public.document_types where active = true) then
      semaphore_color := 'gray';
    else
      semaphore_color := 'red';
    end if;
  elsif uploaded_unreviewed > 0 or observed_non_critical > 0 then
    semaphore_color := 'yellow';
  elsif pending_mandatory > 0 then
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

  perform public.assert_candidate_control_access(current_user_id);

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

  perform public.assert_candidate_control_access(current_user_id);

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
     and p_to_stage not in ('medical_exams', 'rejected', 'withdrawn') then
    raise exception 'Desde Who Aprobado solo puedes mover a Exámenes Médicos o cerrar la participación';
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

  if candidate_record.stage_code = 'who_approved'
     and p_to_stage = 'medical_exams'
     and not exists (
       select 1
       from public.candidate_stage_approvals csa
       where csa.recruitment_case_candidate_id = candidate_record.id
         and csa.stage_code = 'who_pending'
         and csa.status = 'approved'
     ) then
    raise exception 'No existe aprobación Who resuelta para avanzar a Exámenes Médicos';
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

create or replace function public.request_candidate_stage_who(
  p_case_candidate_id uuid,
  p_comment text default null,
  p_causes jsonb default '[]'::jsonb
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
  normalized_causes jsonb := public.normalize_candidate_who_causes(p_causes);
  next_case_status text;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para solicitar aprobación Who';
  end if;

  if candidate_record.stage_code <> 'lead' then
    raise exception 'La aprobación Who solo puede solicitarse desde la etapa Lead';
  end if;

  update public.candidate_stage_approvals csa
     set status = 'cancelled',
         updated_at = timezone('utc', now())
   where csa.recruitment_case_candidate_id = candidate_record.id
     and csa.stage_code = 'who_pending'
     and csa.status = 'pending';

  insert into public.candidate_stage_approvals (
    recruitment_case_candidate_id,
    stage_code,
    status,
    requested_by,
    requested_at,
    comment,
    causes,
    created_at,
    updated_at
  )
  values (
    candidate_record.id,
    'who_pending',
    'pending',
    current_user_id,
    timezone('utc', now()),
    normalized_comment,
    normalized_causes,
    timezone('utc', now()),
    timezone('utc', now())
  );

  update public.recruitment_case_candidates rcc
     set stage_code = 'who_pending',
         stage_entered_at = timezone('utc', now()),
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
    'who_pending',
    current_user_id,
    'who_requested',
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
    'candidate_stage_approval_requested',
    jsonb_build_object(
      'stage_code', candidate_record.stage_code
    ),
    jsonb_build_object(
      'stage_code', 'who_pending'
    ),
    jsonb_build_object(
      'comment', normalized_comment,
      'causes', normalized_causes
    )
  );

  next_case_status := public.sync_recruitment_case_status(candidate_record.recruitment_case_id, current_user_id);

  return query
  select candidate_record.recruitment_case_id, 'who_pending'::text, next_case_status;
end;
$function$;

create or replace function public.get_recruitment_case_detail(
  p_case_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  case_payload jsonb;
  assignments_payload jsonb := '[]'::jsonb;
  candidates_payload jsonb := '[]'::jsonb;
  audit_payload jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  if not public.user_can_view_recruitment_case(current_user_id, p_case_id) then
    raise exception 'Sin permisos para ver este caso';
  end if;

  select jsonb_build_object(
    'id', rc.id,
    'case_code', rc.case_code,
    'status', rc.status,
    'requested_vacancies', rc.requested_vacancies,
    'filled_vacancies', rc.filled_vacancies,
    'title', rc.title,
    'contract_name', rc.contract_name,
    'job_position_name', rc.job_position_name,
    'cost_center_code', rc.cost_center_code,
    'cost_center_name', rc.cost_center_name,
    'requested_entry_date', rc.requested_entry_date,
    'target_close_date', rc.target_close_date,
    'opened_at', rc.opened_at,
    'close_reason', rc.close_reason,
    'hiring_request', jsonb_build_object(
      'id', hr.id,
      'folio', hr.folio,
      'requester_name', hr.requester_name,
      'requester_email', hr.requester_email,
      'start_date', hr.start_date,
      'end_date', hr.end_date,
      'shift_name', hr.shift_name,
      'salary_offer', hr.salary_offer,
      'campamento', hr.campamento,
      'pasajes', hr.pasajes,
      'travel_methodology', hr.travel_methodology,
      'other_benefits', hr.other_benefits,
      'approval_summary', case
        when latest_approval.id is null then null
        else jsonb_build_object(
          'step_name', latest_approval.step_name,
          'status', latest_approval.status,
          'decision_comment', latest_approval.decision_comment,
          'decided_at', latest_approval.decided_at,
          'decided_by_name', latest_approval.decided_by_name
        )
      end
    )
  )
  into case_payload
  from public.recruitment_cases rc
  join public.hiring_requests hr
    on hr.id = rc.hiring_request_id
  left join lateral (
    select
      hra.id,
      hra.step_name,
      hra.status,
      hra.decision_comment,
      hra.decided_at,
      decision_profile.full_name as decided_by_name
    from public.hiring_request_approvals hra
    left join public.profiles decision_profile
      on decision_profile.id = hra.decision_by
    where hra.hiring_request_id = hr.id
      and hra.status in ('approved', 'rejected')
    order by coalesce(hra.decided_at, hra.updated_at, hra.created_at) desc, hra.id desc
    limit 1
  ) latest_approval on true
  where rc.id = p_case_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rca.id,
        'user_id', rca.user_id,
        'assignment_role', rca.assignment_role,
        'is_primary', rca.is_primary,
        'assigned_at', rca.assigned_at,
        'full_name', p.full_name,
        'email', p.email
      )
      order by rca.is_primary desc, rca.id asc
    ),
    '[]'::jsonb
  )
  into assignments_payload
  from public.recruitment_case_assignments rca
  join public.profiles p
    on p.id = rca.user_id
  where rca.recruitment_case_id = p_case_id;

  select coalesce(
    jsonb_agg(candidate_row.payload order by candidate_row.sort_created_at asc),
    '[]'::jsonb
  )
  into candidates_payload
  from (
    select
      jsonb_build_object(
        'id', rcc.id,
        'candidate_profile_id', cp.id,
        'national_id', cp.national_id,
        'full_name', cp.full_name,
        'email', cp.email,
        'phone', cp.phone,
        'birth_date', cp.birth_date,
        'nationality', cp.nationality,
        'marital_status', cp.marital_status,
        'address_line', cp.address_line,
        'district_or_commune', cp.district_or_commune,
        'current_city', cp.current_city,
        'region', cp.region,
        'emergency_contact_name', cp.emergency_contact_name,
        'emergency_contact_phone', cp.emergency_contact_phone,
        'emergency_contact_relationship', cp.emergency_contact_relationship,
        'inclusion_notes', cp.inclusion_notes,
        'firefighter_status', cp.firefighter_status,
        'shirt_size', cp.shirt_size,
        'pants_size', cp.pants_size,
        'shoe_size', cp.shoe_size,
        'bank_name', cp.bank_name,
        'bank_account_type', cp.bank_account_type,
        'bank_account_number', cp.bank_account_number,
        'afp_name', cp.afp_name,
        'health_provider', cp.health_provider,
        'driver_license_number', cp.driver_license_number,
        'driver_license_class', cp.driver_license_class,
        'driver_license_expiry', cp.driver_license_expiry,
        'interview_notes', rcc.interview_notes,
        'stage_code', rcc.stage_code,
        'stage_entered_at', rcc.stage_entered_at,
        'suitability_status', rcc.suitability_status,
        'is_selected', rcc.is_selected,
        'hired_at', rcc.hired_at,
        'created_at', rcc.created_at,
        'worker_file', (
          select case
            when cwf.id is null then null
            else jsonb_build_object(
              'id', cwf.id,
              'project_name', cwf.project_name,
              'company_entry_date', cwf.company_entry_date,
              'shift_name', cwf.shift_name,
              'advance_amount', cwf.advance_amount,
              'contract_notes', cwf.contract_notes,
              'created_at', cwf.created_at,
              'updated_at', cwf.updated_at
            )
          end
          from public.candidate_worker_files cwf
          where cwf.recruitment_case_candidate_id = rcc.id
          limit 1
        ),
        'who_approval', (
          select jsonb_build_object(
            'id', csa.id,
            'status', csa.status,
            'requested_by', csa.requested_by,
            'requested_by_name', requested_profile.full_name,
            'requested_at', csa.requested_at,
            'approved_by', csa.approved_by,
            'approved_by_name', approved_profile.full_name,
            'approved_at', csa.approved_at,
            'comment', csa.comment,
            'causes', csa.causes
          )
          from public.candidate_stage_approvals csa
          left join public.profiles requested_profile
            on requested_profile.id = csa.requested_by
          left join public.profiles approved_profile
            on approved_profile.id = csa.approved_by
          where csa.recruitment_case_candidate_id = rcc.id
            and csa.stage_code = 'who_pending'
          order by coalesce(csa.approved_at, csa.requested_at) desc, csa.id desc
          limit 1
        ),
        'stage_history', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', sh.id,
              'from_stage', sh.from_stage,
              'to_stage', sh.to_stage,
              'changed_by', sh.changed_by,
              'reason_code', sh.reason_code,
              'comment', sh.comment,
              'created_at', sh.created_at
            )
            order by sh.created_at desc
          )
          from public.recruitment_case_candidate_stage_history sh
          where sh.recruitment_case_candidate_id = rcc.id
        ), '[]'::jsonb)
      ) as payload,
      rcc.created_at as sort_created_at
    from public.recruitment_case_candidates rcc
    join public.candidate_profiles cp
      on cp.id = rcc.candidate_profile_id
    where rcc.recruitment_case_id = p_case_id
  ) as candidate_row;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', al.id,
        'action_type', al.action_type,
        'actor_user_id', al.actor_user_id,
        'actor_name', actor_profile.full_name,
        'old_values', al.old_values,
        'new_values', al.new_values,
        'metadata', al.metadata,
        'created_at', al.created_at
      )
      order by al.created_at desc
    ),
    '[]'::jsonb
  )
  into audit_payload
  from public.recruitment_case_audit_log al
  left join public.profiles actor_profile
    on actor_profile.id = al.actor_user_id
  where al.recruitment_case_id = p_case_id
  limit 40;

  return jsonb_build_object(
    'case', case_payload,
    'assignments', assignments_payload,
    'candidates', candidates_payload,
    'audit', audit_payload
  );
end;
$function$;

create or replace function public.get_recruitment_control_dashboard_v2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  can_access_candidate_control boolean := false;
  summary jsonb := '{}'::jsonb;
  pending_approvals jsonb := '[]'::jsonb;
  active_cases jsonb := '[]'::jsonb;
  candidate_control jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'control_contrataciones') then
    raise exception 'Sin permisos para ver control de contrataciones';
  end if;

  can_access_candidate_control := public.user_can_access_candidate_control(current_user_id);

  select jsonb_build_object(
    'pending_contracts_control', count(*) filter (where hra.step_code = 'contracts_control' and hra.status = 'pending'),
    'active_cases', count(*) filter (where rc.status not in ('filled', 'closed_unfilled', 'cancelled')),
    'ready_to_hire_cases', count(*) filter (where rc.status = 'ready_to_hire'),
    'filled_cases', count(*) filter (where rc.status = 'filled'),
    'total_cases', count(*)
  )
  into summary
  from public.recruitment_cases rc
  left join public.hiring_request_approvals hra
    on hra.hiring_request_id = rc.hiring_request_id
   and hra.step_code = 'contracts_control'
   and hra.status = 'pending'
  where public.user_can_access_recruitment_case(current_user_id, rc.id);

  select coalesce(
    jsonb_agg(queue_row.payload order by queue_row.sort_created_at asc, queue_row.sort_id asc),
    '[]'::jsonb
  )
  into pending_approvals
  from (
    select
      jsonb_build_object(
        'id', hra.id,
        'step_code', hra.step_code,
        'step_name', hra.step_name,
        'hiring_request_id', hra.hiring_request_id,
        'approver_user_id', hra.approver_user_id,
        'approver_name', hra.approver_name,
        'approver_email', hra.approver_email,
        'created_at', hra.created_at,
        'hiring_requests', jsonb_build_object(
          'folio', hr.folio,
          'status', hr.status,
          'requester_name', hr.requester_name,
          'requester_email', hr.requester_email,
          'contract_name', hr.contract_name,
          'contract_number', hr.contract_number,
          'job_position_name', hr.job_position_name,
          'vacancies', hr.vacancies,
          'requested_entry_date', hr.requested_entry_date,
          'start_date', hr.start_date,
          'end_date', hr.end_date,
          'shift_name', hr.shift_name,
          'salary_offer', hr.salary_offer,
          'campamento', hr.campamento,
          'pasajes', hr.pasajes,
          'other_benefits', hr.other_benefits
        )
      ) as payload,
      hra.created_at as sort_created_at,
      hra.id as sort_id
    from public.hiring_request_approvals hra
    join public.hiring_requests hr
      on hr.id = hra.hiring_request_id
    where hra.step_code = 'contracts_control'
      and hra.status = 'pending'
      and (
        public.user_is_admin(current_user_id)
        or hra.approver_user_id = current_user_id
        or public.user_has_role(current_user_id, 'control_contratos')
      )
    order by hra.created_at asc, hra.id asc
    limit 20
  ) as queue_row;

  select coalesce(
    jsonb_agg(case_row.payload order by case_row.sort_opened_at desc),
    '[]'::jsonb
  )
  into active_cases
  from (
    select
      jsonb_build_object(
        'id', rc.id,
        'case_code', rc.case_code,
        'status', rc.status,
        'requested_vacancies', rc.requested_vacancies,
        'filled_vacancies', rc.filled_vacancies,
        'title', rc.title,
        'contract_name', rc.contract_name,
        'job_position_name', rc.job_position_name,
        'cost_center_code', rc.cost_center_code,
        'cost_center_name', rc.cost_center_name,
        'requested_entry_date', rc.requested_entry_date,
        'target_close_date', rc.target_close_date,
        'opened_at', rc.opened_at,
        'requester_name', hr.requester_name,
        'requester_email', hr.requester_email,
        'owner_name', owner_profile.full_name,
        'owner_user_id', owner_assignment.user_id,
        'candidate_count', coalesce(candidate_stats.candidate_count, 0),
        'ready_candidates', coalesce(candidate_stats.ready_candidates, 0),
        'hired_candidates', coalesce(candidate_stats.hired_candidates, 0)
      ) as payload,
      rc.opened_at as sort_opened_at
    from public.recruitment_cases rc
    join public.hiring_requests hr
      on hr.id = rc.hiring_request_id
    left join lateral (
      select
        rca.user_id
      from public.recruitment_case_assignments rca
      where rca.recruitment_case_id = rc.id
        and rca.is_primary = true
      order by rca.id asc
      limit 1
    ) as owner_assignment on true
    left join public.profiles owner_profile
      on owner_profile.id = owner_assignment.user_id
    left join lateral (
      select
        count(*) filter (where rcc.stage_code not in ('rejected', 'withdrawn', 'hired', 'ready_for_hire')) as candidate_count,
        count(*) filter (where rcc.stage_code = 'ready_for_hire') as ready_candidates,
        count(*) filter (where rcc.stage_code = 'hired') as hired_candidates
      from public.recruitment_case_candidates rcc
      where rcc.recruitment_case_id = rc.id
    ) as candidate_stats on true
    where public.user_can_access_recruitment_case(current_user_id, rc.id)
    order by rc.opened_at desc
    limit 40
  ) as case_row;

  if can_access_candidate_control then
    select coalesce(
      jsonb_agg(candidate_row.payload order by candidate_row.sort_stage_entered_at desc, candidate_row.sort_created_at desc),
      '[]'::jsonb
    )
    into candidate_control
    from (
      select
        jsonb_build_object(
          'id', rcc.id,
          'candidate_profile_id', cp.id,
          'recruitment_case_id', rc.id,
          'case_code', rc.case_code,
          'folio', hr.folio,
          'case_status', rc.status,
          'national_id', cp.national_id,
          'full_name', cp.full_name,
          'email', cp.email,
          'phone', cp.phone,
          'driver_license_number', cp.driver_license_number,
          'driver_license_class', cp.driver_license_class,
          'driver_license_expiry', cp.driver_license_expiry,
          'interview_notes', rcc.interview_notes,
          'stage_code', rcc.stage_code,
          'stage_entered_at', rcc.stage_entered_at,
          'suitability_status', rcc.suitability_status,
          'is_selected', rcc.is_selected,
          'contract_name', rc.contract_name,
          'job_position_name', rc.job_position_name,
          'cost_center_code', rc.cost_center_code,
          'cost_center_name', rc.cost_center_name,
          'owner_name', owner_profile.full_name,
          'active_process_count', coalesce(active_process_stats.active_process_count, 0),
          'contract_locked_case_id', contract_lock.recruitment_case_id,
          'contract_locked_case_code', contract_lock.case_code,
          'contract_locked_folio', contract_lock.folio,
          'contract_locked_stage_code', contract_lock.stage_code,
          'is_contract_path_blocked', (contract_lock.case_candidate_id is not null)
        ) as payload,
        rcc.stage_entered_at as sort_stage_entered_at,
        rcc.created_at as sort_created_at
      from public.recruitment_case_candidates rcc
      join public.candidate_profiles cp
        on cp.id = rcc.candidate_profile_id
      join public.recruitment_cases rc
        on rc.id = rcc.recruitment_case_id
      join public.hiring_requests hr
        on hr.id = rc.hiring_request_id
      left join lateral (
        select
          rca.user_id
        from public.recruitment_case_assignments rca
        where rca.recruitment_case_id = rc.id
          and rca.is_primary = true
        order by rca.id asc
        limit 1
      ) as owner_assignment on true
      left join public.profiles owner_profile
        on owner_profile.id = owner_assignment.user_id
      left join lateral (
        select count(*) as active_process_count
        from public.recruitment_case_candidates sibling_rcc
        join public.recruitment_cases sibling_rc
          on sibling_rc.id = sibling_rcc.recruitment_case_id
        where sibling_rcc.candidate_profile_id = cp.id
          and sibling_rcc.stage_code not in ('rejected', 'withdrawn')
          and sibling_rc.status not in ('filled', 'closed_unfilled', 'cancelled')
      ) as active_process_stats on true
      left join lateral (
        select *
        from public.find_active_candidate_contract_lock(cp.id, rcc.id)
      ) as contract_lock on true
      where public.user_can_access_recruitment_case(current_user_id, rc.id)
        and rc.status not in ('filled', 'closed_unfilled', 'cancelled')
      order by rcc.stage_entered_at desc, rcc.created_at desc
      limit 120
    ) as candidate_row;
  end if;

  return jsonb_build_object(
    'summary', summary,
    'pending_approvals', pending_approvals,
    'active_cases', active_cases,
    'candidate_control', candidate_control
  );
end;
$function$;

create or replace function public.upsert_candidate_person_profile(
  p_case_candidate_id uuid,
  p_document_type text default null,
  p_document_number text default null,
  p_first_name text default null,
  p_last_name text default null,
  p_second_last_name text default null,
  p_gender text default null,
  p_birth_date date default null,
  p_nationality text default null,
  p_marital_status text default null,
  p_company_email text default null,
  p_personal_email text default null,
  p_private_phone text default null,
  p_office_phone text default null,
  p_country text default null,
  p_address_line text default null,
  p_district_or_commune text default null,
  p_current_city text default null,
  p_region text default null,
  p_street_name text default null,
  p_street_number text default null,
  p_apartment_or_office text default null,
  p_education_title text default null,
  p_education_institution text default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_phone text default null,
  p_emergency_contact_relationship text default null,
  p_disability_status text default null,
  p_disability_notice_date date default null,
  p_invalidity_status text default null,
  p_invalidity_notice_date date default null,
  p_inclusion_notes text default null,
  p_labor_inclusion text default null,
  p_firefighter_status text default null,
  p_foreign_worker text default null,
  p_shirt_size text default null,
  p_pants_size text default null,
  p_shoe_size text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  profile_before public.candidate_profiles%rowtype;
  profile_after public.candidate_profiles%rowtype;
  normalized_document_number text := nullif(trim(coalesce(p_document_number, '')), '');
  normalized_first_name text := nullif(trim(coalesce(p_first_name, '')), '');
  normalized_last_name text := nullif(trim(coalesce(p_last_name, '')), '');
  normalized_second_last_name text := nullif(trim(coalesce(p_second_last_name, '')), '');
  normalized_full_name text := nullif(
    concat_ws(' ', normalized_first_name, normalized_last_name, normalized_second_last_name),
    ''
  );
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para editar la ficha del candidato';
  end if;

  select *
    into profile_before
    from public.candidate_profiles cp
   where cp.id = candidate_record.candidate_profile_id
   for update;

  update public.candidate_profiles cp
     set document_type = nullif(trim(coalesce(p_document_type, '')), ''),
         national_id = coalesce(normalized_document_number, cp.national_id),
         first_name = normalized_first_name,
         last_name = normalized_last_name,
         second_last_name = normalized_second_last_name,
         full_name = coalesce(normalized_full_name, cp.full_name),
         gender = nullif(trim(coalesce(p_gender, '')), ''),
         birth_date = p_birth_date,
         nationality = nullif(trim(coalesce(p_nationality, '')), ''),
         marital_status = nullif(trim(coalesce(p_marital_status, '')), ''),
         email = nullif(trim(coalesce(p_company_email, '')), ''),
         personal_email = nullif(trim(coalesce(p_personal_email, '')), ''),
         phone = nullif(trim(coalesce(p_private_phone, '')), ''),
         office_phone = nullif(trim(coalesce(p_office_phone, '')), ''),
         country = nullif(trim(coalesce(p_country, '')), ''),
         address_line = nullif(trim(coalesce(p_address_line, '')), ''),
         district_or_commune = nullif(trim(coalesce(p_district_or_commune, '')), ''),
         current_city = nullif(trim(coalesce(p_current_city, '')), ''),
         region = nullif(trim(coalesce(p_region, '')), ''),
         street_name = nullif(trim(coalesce(p_street_name, '')), ''),
         street_number = nullif(trim(coalesce(p_street_number, '')), ''),
         apartment_or_office = nullif(trim(coalesce(p_apartment_or_office, '')), ''),
         education_title = nullif(trim(coalesce(p_education_title, '')), ''),
         education_institution = nullif(trim(coalesce(p_education_institution, '')), ''),
         emergency_contact_name = nullif(trim(coalesce(p_emergency_contact_name, '')), ''),
         emergency_contact_phone = nullif(trim(coalesce(p_emergency_contact_phone, '')), ''),
         emergency_contact_relationship = nullif(trim(coalesce(p_emergency_contact_relationship, '')), ''),
         disability_status = nullif(trim(coalesce(p_disability_status, '')), ''),
         disability_notice_date = p_disability_notice_date,
         invalidity_status = nullif(trim(coalesce(p_invalidity_status, '')), ''),
         invalidity_notice_date = p_invalidity_notice_date,
         inclusion_notes = nullif(trim(coalesce(p_inclusion_notes, '')), ''),
         labor_inclusion = nullif(trim(coalesce(p_labor_inclusion, '')), ''),
         firefighter_status = nullif(trim(coalesce(p_firefighter_status, '')), ''),
         foreign_worker = nullif(trim(coalesce(p_foreign_worker, '')), ''),
         shirt_size = nullif(trim(coalesce(p_shirt_size, '')), ''),
         pants_size = nullif(trim(coalesce(p_pants_size, '')), ''),
         shoe_size = nullif(trim(coalesce(p_shoe_size, '')), '')
   where cp.id = candidate_record.candidate_profile_id
   returning * into profile_after;

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
    'candidate_person_profile_updated',
    to_jsonb(profile_before),
    to_jsonb(profile_after),
    jsonb_build_object(
      'candidate_profile_id', candidate_record.candidate_profile_id,
      'profile_scope', 'buk_personal_profile'
    )
  );
end;
$function$;

create or replace function public.upsert_candidate_worker_file(
  p_case_candidate_id uuid,
  p_employee_code text default null,
  p_project_name text default null,
  p_company_entry_date date default null,
  p_shift_name text default null,
  p_advance_amount numeric default null,
  p_contract_notes text default null,
  p_private_role text default null,
  p_afc_start_date date default null,
  p_seniority_recognition_date date default null,
  p_progressive_vacation_start_date date default null,
  p_payment_method text default null,
  p_bank_name text default null,
  p_bank_account_type text default null,
  p_bank_account_number text default null,
  p_bank_branch_code text default null,
  p_vale_vista_type text default null,
  p_pension_regime text default null,
  p_contribution_fund text default null,
  p_afp_collection_entity text default null,
  p_increase_quote_one_percent text default null,
  p_health_provider text default null,
  p_health_plan_uf numeric default null,
  p_health_plan_pesos numeric default null,
  p_health_plan_percentage numeric default null,
  p_afc_regime text default null,
  p_retired_status text default null,
  p_retirement_regime text default null,
  p_account_two_fund text default null,
  p_account_two_plan text default null,
  p_currency text default null,
  p_simple_load_count integer default null,
  p_maternal_load_count integer default null,
  p_invalid_load_count integer default null,
  p_family_allowance_section text default null,
  p_personal_data_update_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  worker_before public.candidate_worker_files%rowtype;
  worker_after public.candidate_worker_files%rowtype;
  normalized_employee_code text := nullif(trim(coalesce(p_employee_code, '')), '');
  normalized_project_name text := nullif(trim(coalesce(p_project_name, '')), '');
  normalized_shift_name text := nullif(trim(coalesce(p_shift_name, '')), '');
  normalized_contract_notes text := nullif(trim(coalesce(p_contract_notes, '')), '');
  normalized_private_role text := nullif(trim(coalesce(p_private_role, '')), '');
  normalized_payment_method text := nullif(trim(coalesce(p_payment_method, '')), '');
  normalized_bank_name text := nullif(trim(coalesce(p_bank_name, '')), '');
  normalized_bank_account_type text := nullif(trim(coalesce(p_bank_account_type, '')), '');
  normalized_bank_account_number text := nullif(trim(coalesce(p_bank_account_number, '')), '');
  normalized_bank_branch_code text := nullif(trim(coalesce(p_bank_branch_code, '')), '');
  normalized_vale_vista_type text := nullif(trim(coalesce(p_vale_vista_type, '')), '');
  normalized_pension_regime text := nullif(trim(coalesce(p_pension_regime, '')), '');
  normalized_contribution_fund text := nullif(trim(coalesce(p_contribution_fund, '')), '');
  normalized_afp_collection_entity text := nullif(trim(coalesce(p_afp_collection_entity, '')), '');
  normalized_increase_quote_one_percent text := nullif(trim(coalesce(p_increase_quote_one_percent, '')), '');
  normalized_health_provider text := nullif(trim(coalesce(p_health_provider, '')), '');
  normalized_afc_regime text := nullif(trim(coalesce(p_afc_regime, '')), '');
  normalized_retired_status text := nullif(trim(coalesce(p_retired_status, '')), '');
  normalized_retirement_regime text := nullif(trim(coalesce(p_retirement_regime, '')), '');
  normalized_account_two_fund text := nullif(trim(coalesce(p_account_two_fund, '')), '');
  normalized_account_two_plan text := nullif(trim(coalesce(p_account_two_plan, '')), '');
  normalized_currency text := nullif(trim(coalesce(p_currency, '')), '');
  normalized_family_allowance_section text := nullif(trim(coalesce(p_family_allowance_section, '')), '');
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para editar la ficha del trabajador';
  end if;

  select *
    into worker_before
    from public.candidate_worker_files cwf
   where cwf.recruitment_case_candidate_id = candidate_record.id
   for update;

  if normalized_employee_code is null
     and normalized_project_name is null
     and p_company_entry_date is null
     and normalized_shift_name is null
     and p_advance_amount is null
     and normalized_contract_notes is null
     and normalized_private_role is null
     and p_afc_start_date is null
     and p_seniority_recognition_date is null
     and p_progressive_vacation_start_date is null
     and normalized_payment_method is null
     and normalized_bank_name is null
     and normalized_bank_account_type is null
     and normalized_bank_account_number is null
     and normalized_bank_branch_code is null
     and normalized_vale_vista_type is null
     and normalized_pension_regime is null
     and normalized_contribution_fund is null
     and normalized_afp_collection_entity is null
     and normalized_increase_quote_one_percent is null
     and normalized_health_provider is null
     and p_health_plan_uf is null
     and p_health_plan_pesos is null
     and p_health_plan_percentage is null
     and normalized_afc_regime is null
     and normalized_retired_status is null
     and normalized_retirement_regime is null
     and normalized_account_two_fund is null
     and normalized_account_two_plan is null
     and normalized_currency is null
     and p_simple_load_count is null
     and p_maternal_load_count is null
     and p_invalid_load_count is null
     and normalized_family_allowance_section is null
     and p_personal_data_update_date is null then
    if worker_before.id is not null then
      delete from public.candidate_worker_files
       where recruitment_case_candidate_id = candidate_record.id;

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
        'candidate_worker_file_cleared',
        to_jsonb(worker_before),
        null,
        jsonb_build_object(
          'candidate_profile_id', candidate_record.candidate_profile_id,
          'profile_scope', 'buk_worker_profile'
        )
      );
    end if;

    return;
  end if;

  insert into public.candidate_worker_files (
    recruitment_case_candidate_id,
    employee_code,
    project_name,
    company_entry_date,
    shift_name,
    advance_amount,
    contract_notes,
    private_role,
    afc_start_date,
    seniority_recognition_date,
    progressive_vacation_start_date,
    payment_method,
    bank_name,
    bank_account_type,
    bank_account_number,
    bank_branch_code,
    vale_vista_type,
    pension_regime,
    contribution_fund,
    afp_collection_entity,
    increase_quote_one_percent,
    health_provider,
    health_plan_uf,
    health_plan_pesos,
    health_plan_percentage,
    afc_regime,
    retired_status,
    retirement_regime,
    account_two_fund,
    account_two_plan,
    currency,
    simple_load_count,
    maternal_load_count,
    invalid_load_count,
    family_allowance_section,
    personal_data_update_date
  )
  values (
    candidate_record.id,
    normalized_employee_code,
    normalized_project_name,
    p_company_entry_date,
    normalized_shift_name,
    p_advance_amount,
    normalized_contract_notes,
    normalized_private_role,
    p_afc_start_date,
    p_seniority_recognition_date,
    p_progressive_vacation_start_date,
    normalized_payment_method,
    normalized_bank_name,
    normalized_bank_account_type,
    normalized_bank_account_number,
    normalized_bank_branch_code,
    normalized_vale_vista_type,
    normalized_pension_regime,
    normalized_contribution_fund,
    normalized_afp_collection_entity,
    normalized_increase_quote_one_percent,
    normalized_health_provider,
    p_health_plan_uf,
    p_health_plan_pesos,
    p_health_plan_percentage,
    normalized_afc_regime,
    normalized_retired_status,
    normalized_retirement_regime,
    normalized_account_two_fund,
    normalized_account_two_plan,
    normalized_currency,
    p_simple_load_count,
    p_maternal_load_count,
    p_invalid_load_count,
    normalized_family_allowance_section,
    p_personal_data_update_date
  )
  on conflict (recruitment_case_candidate_id)
  do update
     set employee_code = excluded.employee_code,
         project_name = excluded.project_name,
         company_entry_date = excluded.company_entry_date,
         shift_name = excluded.shift_name,
         advance_amount = excluded.advance_amount,
         contract_notes = excluded.contract_notes,
         private_role = excluded.private_role,
         afc_start_date = excluded.afc_start_date,
         seniority_recognition_date = excluded.seniority_recognition_date,
         progressive_vacation_start_date = excluded.progressive_vacation_start_date,
         payment_method = excluded.payment_method,
         bank_name = excluded.bank_name,
         bank_account_type = excluded.bank_account_type,
         bank_account_number = excluded.bank_account_number,
         bank_branch_code = excluded.bank_branch_code,
         vale_vista_type = excluded.vale_vista_type,
         pension_regime = excluded.pension_regime,
         contribution_fund = excluded.contribution_fund,
         afp_collection_entity = excluded.afp_collection_entity,
         increase_quote_one_percent = excluded.increase_quote_one_percent,
         health_provider = excluded.health_provider,
         health_plan_uf = excluded.health_plan_uf,
         health_plan_pesos = excluded.health_plan_pesos,
         health_plan_percentage = excluded.health_plan_percentage,
         afc_regime = excluded.afc_regime,
         retired_status = excluded.retired_status,
         retirement_regime = excluded.retirement_regime,
         account_two_fund = excluded.account_two_fund,
         account_two_plan = excluded.account_two_plan,
         currency = excluded.currency,
         simple_load_count = excluded.simple_load_count,
         maternal_load_count = excluded.maternal_load_count,
         invalid_load_count = excluded.invalid_load_count,
         family_allowance_section = excluded.family_allowance_section,
         personal_data_update_date = excluded.personal_data_update_date,
         updated_at = timezone('utc', now())
  returning * into worker_after;

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
    case when worker_before.id is null then 'candidate_worker_file_created' else 'candidate_worker_file_updated' end,
    case when worker_before.id is null then null else to_jsonb(worker_before) end,
    to_jsonb(worker_after),
    jsonb_build_object(
      'candidate_profile_id', candidate_record.candidate_profile_id,
      'profile_scope', 'buk_worker_profile'
    )
  );
end;
$function$;

create or replace function public.get_candidate_buk_profile(
  p_case_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  candidate_profile public.candidate_profiles%rowtype;
  worker_file public.candidate_worker_files%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  if not public.user_can_view_recruitment_case(current_user_id, candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para ver la ficha BUK de este candidato';
  end if;

  select *
    into candidate_profile
    from public.candidate_profiles cp
   where cp.id = candidate_record.candidate_profile_id;

  select *
    into worker_file
    from public.candidate_worker_files cwf
   where cwf.recruitment_case_candidate_id = candidate_record.id;

  return jsonb_build_object(
    'case_candidate_id', candidate_record.id,
    'candidate_profile_id', candidate_profile.id,
    'document_type', candidate_profile.document_type,
    'document_number', candidate_profile.national_id,
    'first_name', candidate_profile.first_name,
    'last_name', candidate_profile.last_name,
    'second_last_name', candidate_profile.second_last_name,
    'full_name', candidate_profile.full_name,
    'gender', candidate_profile.gender,
    'birth_date', candidate_profile.birth_date,
    'nationality', candidate_profile.nationality,
    'marital_status', candidate_profile.marital_status,
    'email', candidate_profile.email,
    'personal_email', candidate_profile.personal_email,
    'phone', candidate_profile.phone,
    'office_phone', candidate_profile.office_phone,
    'country', candidate_profile.country,
    'address_line', candidate_profile.address_line,
    'region', candidate_profile.region,
    'district_or_commune', candidate_profile.district_or_commune,
    'current_city', candidate_profile.current_city,
    'street_name', candidate_profile.street_name,
    'street_number', candidate_profile.street_number,
    'apartment_or_office', candidate_profile.apartment_or_office,
    'education_title', candidate_profile.education_title,
    'education_institution', candidate_profile.education_institution,
    'emergency_contact_name', candidate_profile.emergency_contact_name,
    'emergency_contact_phone', candidate_profile.emergency_contact_phone,
    'emergency_contact_relationship', candidate_profile.emergency_contact_relationship,
    'disability_status', candidate_profile.disability_status,
    'disability_notice_date', candidate_profile.disability_notice_date,
    'invalidity_status', candidate_profile.invalidity_status,
    'invalidity_notice_date', candidate_profile.invalidity_notice_date,
    'inclusion_notes', candidate_profile.inclusion_notes,
    'labor_inclusion', candidate_profile.labor_inclusion,
    'firefighter_status', candidate_profile.firefighter_status,
    'foreign_worker', candidate_profile.foreign_worker,
    'shirt_size', candidate_profile.shirt_size,
    'pants_size', candidate_profile.pants_size,
    'shoe_size', candidate_profile.shoe_size,
    'worker_file', case
      when worker_file.id is null then jsonb_build_object(
        'id', null,
        'employee_code', null,
        'project_name', null,
        'company_entry_date', null,
        'shift_name', null,
        'advance_amount', null,
        'contract_notes', null,
        'private_role', null,
        'afc_start_date', null,
        'seniority_recognition_date', null,
        'progressive_vacation_start_date', null,
        'payment_method', null,
        'bank_name', null,
        'bank_account_type', null,
        'bank_account_number', null,
        'bank_branch_code', null,
        'vale_vista_type', null,
        'pension_regime', null,
        'contribution_fund', null,
        'afp_collection_entity', null,
        'increase_quote_one_percent', null,
        'health_provider', null,
        'health_plan_uf', null,
        'health_plan_pesos', null,
        'health_plan_percentage', null,
        'afc_regime', null,
        'retired_status', null,
        'retirement_regime', null,
        'account_two_fund', null,
        'account_two_plan', null,
        'currency', null,
        'simple_load_count', null,
        'maternal_load_count', null,
        'invalid_load_count', null,
        'family_allowance_section', null,
        'personal_data_update_date', null
      )
      else jsonb_build_object(
        'id', worker_file.id,
        'employee_code', worker_file.employee_code,
        'project_name', worker_file.project_name,
        'company_entry_date', worker_file.company_entry_date,
        'shift_name', worker_file.shift_name,
        'advance_amount', worker_file.advance_amount,
        'contract_notes', worker_file.contract_notes,
        'private_role', worker_file.private_role,
        'afc_start_date', worker_file.afc_start_date,
        'seniority_recognition_date', worker_file.seniority_recognition_date,
        'progressive_vacation_start_date', worker_file.progressive_vacation_start_date,
        'payment_method', worker_file.payment_method,
        'bank_name', worker_file.bank_name,
        'bank_account_type', worker_file.bank_account_type,
        'bank_account_number', worker_file.bank_account_number,
        'bank_branch_code', worker_file.bank_branch_code,
        'vale_vista_type', worker_file.vale_vista_type,
        'pension_regime', worker_file.pension_regime,
        'contribution_fund', worker_file.contribution_fund,
        'afp_collection_entity', worker_file.afp_collection_entity,
        'increase_quote_one_percent', worker_file.increase_quote_one_percent,
        'health_provider', worker_file.health_provider,
        'health_plan_uf', worker_file.health_plan_uf,
        'health_plan_pesos', worker_file.health_plan_pesos,
        'health_plan_percentage', worker_file.health_plan_percentage,
        'afc_regime', worker_file.afc_regime,
        'retired_status', worker_file.retired_status,
        'retirement_regime', worker_file.retirement_regime,
        'account_two_fund', worker_file.account_two_fund,
        'account_two_plan', worker_file.account_two_plan,
        'currency', worker_file.currency,
        'simple_load_count', worker_file.simple_load_count,
        'maternal_load_count', worker_file.maternal_load_count,
        'invalid_load_count', worker_file.invalid_load_count,
        'family_allowance_section', worker_file.family_allowance_section,
        'personal_data_update_date', worker_file.personal_data_update_date
      )
    end
  );
end;
$function$;

revoke all on function public.user_can_access_candidate_control(uuid) from public, anon;
grant execute on function public.user_can_access_candidate_control(uuid) to authenticated;

revoke all on function public.assert_candidate_control_access(uuid) from public, anon;
grant execute on function public.assert_candidate_control_access(uuid) to authenticated;

revoke all on function public.find_candidate_profile_by_rut(text) from public, anon;
grant execute on function public.find_candidate_profile_by_rut(text) to authenticated;

revoke all on function public.update_candidate_driver_license(uuid, text, date) from public, anon;
grant execute on function public.update_candidate_driver_license(uuid, text, date) to authenticated;

revoke all on function public.update_candidate_interview_notes(uuid, text) from public, anon;
grant execute on function public.update_candidate_interview_notes(uuid, text) to authenticated;

revoke all on function public.add_candidate_to_recruitment_case(uuid, text, text, text, text) from public, anon;
grant execute on function public.add_candidate_to_recruitment_case(uuid, text, text, text, text) to authenticated;

revoke all on function public.get_candidate_checklist(uuid) from public, anon;
grant execute on function public.get_candidate_checklist(uuid) to authenticated;

revoke all on function public.upload_candidate_document(uuid, uuid, text, date) from public, anon;
grant execute on function public.upload_candidate_document(uuid, uuid, text, date) to authenticated;

revoke all on function public.review_candidate_document(uuid, text, text) from public, anon;
grant execute on function public.review_candidate_document(uuid, text, text) to authenticated;

revoke all on function public.advance_recruitment_candidate_stage(uuid, text, text) from public, anon;
grant execute on function public.advance_recruitment_candidate_stage(uuid, text, text) to authenticated;

revoke all on function public.request_candidate_stage_who(uuid, text, jsonb) from public, anon;
grant execute on function public.request_candidate_stage_who(uuid, text, jsonb) to authenticated;

revoke all on function public.get_recruitment_case_detail(uuid) from public, anon;
grant execute on function public.get_recruitment_case_detail(uuid) to authenticated;

revoke all on function public.get_recruitment_control_dashboard_v2() from public, anon;
grant execute on function public.get_recruitment_control_dashboard_v2() to authenticated;

revoke all on function public.upsert_candidate_person_profile(uuid, text, text, text, text, text, text, date, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, date, text, date, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.upsert_candidate_person_profile(uuid, text, text, text, text, text, text, date, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, date, text, date, text, text, text, text, text, text, text) to authenticated;

revoke all on function public.upsert_candidate_worker_file(uuid, text, text, date, text, numeric, text, text, date, date, date, text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text, text, text, integer, integer, integer, text, date) from public, anon;
grant execute on function public.upsert_candidate_worker_file(uuid, text, text, date, text, numeric, text, text, date, date, date, text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text, text, text, integer, integer, integer, text, date) to authenticated;

revoke all on function public.get_candidate_buk_profile(uuid) from public, anon;
grant execute on function public.get_candidate_buk_profile(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
