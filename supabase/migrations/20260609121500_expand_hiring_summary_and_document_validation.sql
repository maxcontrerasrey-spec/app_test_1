begin;

insert into public.role_module_access (role_code, module_code, can_view)
values
  ('control_contratos', 'control_contrataciones', true),
  ('director_eje', 'control_contrataciones', true),
  ('gerente_general', 'control_contrataciones', true),
  ('director_op', 'control_contrataciones', true),
  ('gerencia', 'control_contrataciones', true),
  ('operaciones_l_1', 'control_contrataciones', true),
  ('administrativo', 'control_contrataciones', true)
on conflict (role_code, module_code) do update
set can_view = true;

create or replace function public.user_can_view_recruitment_process_summary(
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
    or public.user_has_role(target_user_id, 'control_contratos')
    or public.user_has_role(target_user_id, 'director_eje')
    or public.user_has_role(target_user_id, 'gerente_general')
    or public.user_has_role(target_user_id, 'director_op')
    or public.user_has_role(target_user_id, 'gerencia')
    or public.user_has_role(target_user_id, 'operaciones_l_1')
    or public.user_has_role(target_user_id, 'administrativo')
    or exists (
      select 1
      from public.recruitment_case_assignments rca
      where rca.recruitment_case_id = target_case_id
        and rca.user_id = target_user_id
    );
$function$;

revoke all on function public.user_can_view_recruitment_process_summary(uuid, uuid) from public, anon;
grant execute on function public.user_can_view_recruitment_process_summary(uuid, uuid) to authenticated;

create or replace function public.is_driver_job_position(
  p_job_position_name text
)
returns boolean
language sql
immutable
set search_path = public
as $function$
  select coalesce(lower(trim(p_job_position_name)), '') ~ '(conductor|chofer)';
$function$;

alter table if exists public.document_types
  add column if not exists applies_to_driver boolean not null default true,
  add column if not exists applies_to_other boolean not null default true,
  add column if not exists required_for_driver boolean not null default false,
  add column if not exists required_for_other boolean not null default false;

alter table if exists public.recruitment_case_candidates
  add column if not exists document_validation_status text not null default 'pending',
  add column if not exists document_validated_by uuid null references public.profiles(id),
  add column if not exists document_validated_at timestamptz null,
  add column if not exists document_validation_comment text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recruitment_case_candidates_document_validation_status_check'
      and conrelid = 'public.recruitment_case_candidates'::regclass
  ) then
    alter table public.recruitment_case_candidates
      add constraint recruitment_case_candidates_document_validation_status_check
      check (document_validation_status in ('pending', 'approved'));
  end if;
end $$;

create temporary table tmp_desired_documents (
  name text primary key,
  applies_to_driver boolean not null,
  applies_to_other boolean not null,
  required_for_driver boolean not null,
  required_for_other boolean not null,
  requires_expiry_date boolean not null,
  legacy_names text[] not null
) on commit drop;

insert into tmp_desired_documents (
  name,
  applies_to_driver,
  applies_to_other,
  required_for_driver,
  required_for_other,
  requires_expiry_date,
  legacy_names
)
values
  ('Currículum', true, true, true, true, false, array['Currículum Vitae (CV)']::text[]),
  ('Certificado de Antecedentes para fines especiales', true, true, true, true, true, array['Certificado de antecedentes']::text[]),
  ('Copia de Fotocopia de cédula de identidad', true, true, true, true, true, array['Cédula de identidad']::text[]),
  ('Certificado de estudios (Licencia media, Título)', true, true, false, false, false, array['Certificado de estudios']::text[]),
  ('Finiquito último trabajo', true, true, false, false, false, array['Certificados laborales', 'Referencias laborales']::text[]),
  ('Certificado de AFP', true, true, true, true, false, array[]::text[]),
  ('Certificado de Organismo de salud', true, true, false, false, false, array[]::text[]),
  ('Certificado de miembro activo de Bomberos de Chile', true, true, false, false, false, array[]::text[]),
  ('Certificado de Residencia', true, true, true, true, false, array[]::text[]),
  ('Copia de Licencia de conducir vigente por ambos lados', true, false, true, false, true, array['Licencia de conducir']::text[]),
  ('Hoja de vida del conductor', true, false, true, false, true, array['Hoja de vida del conductor']::text[]),
  ('Examen de Drogas', true, true, true, true, true, array[]::text[]),
  ('Examen Teórico de Instructor', true, false, true, false, true, array['Certificaciones técnicas']::text[]),
  ('Examen Práctico de Instructor', true, false, true, false, true, array[]::text[]),
  ('Informe Evaluación Psicolaboral', true, true, true, true, false, array[]::text[]),
  ('Examen Preocupacional', true, false, true, false, true, array['Exámenes preocupacionales']::text[]);

with
matched_legacy as (
  select
    dt.id,
    dd.name,
    dd.applies_to_driver,
    dd.applies_to_other,
    dd.required_for_driver,
    dd.required_for_other,
    dd.requires_expiry_date,
    row_number() over (partition by dd.name order by dt.created_at asc, dt.id asc) as rn
  from tmp_desired_documents dd
  join public.document_types dt
    on dt.name = any(dd.legacy_names)
),
matched_exact as (
  select
    dt.id,
    dd.name,
    dd.applies_to_driver,
    dd.applies_to_other,
    dd.required_for_driver,
    dd.required_for_other,
    dd.requires_expiry_date,
    row_number() over (partition by dd.name order by dt.created_at asc, dt.id asc) as rn
  from tmp_desired_documents dd
  join public.document_types dt
    on dt.name = dd.name
),
targets as (
  select * from matched_exact where rn = 1
  union
  select *
  from matched_legacy ml
  where ml.rn = 1
    and not exists (
      select 1
      from matched_exact me
      where me.name = ml.name
        and me.rn = 1
    )
)
update public.document_types dt
set
  name = targets.name,
  active = true,
  is_critical = targets.required_for_driver or targets.required_for_other,
  requires_expiry_date = targets.requires_expiry_date,
  applies_to_driver = targets.applies_to_driver,
  applies_to_other = targets.applies_to_other,
  required_for_driver = targets.required_for_driver,
  required_for_other = targets.required_for_other
from targets
where dt.id = targets.id;

insert into public.document_types (
  name,
  is_critical,
  requires_expiry_date,
  active,
  applies_to_driver,
  applies_to_other,
  required_for_driver,
  required_for_other
)
select
  dd.name,
  dd.required_for_driver or dd.required_for_other,
  dd.requires_expiry_date,
  true,
  dd.applies_to_driver,
  dd.applies_to_other,
  dd.required_for_driver,
  dd.required_for_other
from tmp_desired_documents dd
where not exists (
  select 1
  from public.document_types dt
  where dt.name = dd.name
);

update public.document_types dt
set
  active = false,
  applies_to_driver = false,
  applies_to_other = false,
  required_for_driver = false,
  required_for_other = false,
  is_critical = false
where dt.name not in (
  'Currículum',
  'Certificado de Antecedentes para fines especiales',
  'Copia de Fotocopia de cédula de identidad',
  'Certificado de estudios (Licencia media, Título)',
  'Finiquito último trabajo',
  'Certificado de AFP',
  'Certificado de Organismo de salud',
  'Certificado de miembro activo de Bomberos de Chile',
  'Certificado de Residencia',
  'Copia de Licencia de conducir vigente por ambos lados',
  'Hoja de vida del conductor',
  'Examen de Drogas',
  'Examen Teórico de Instructor',
  'Examen Práctico de Instructor',
  'Informe Evaluación Psicolaboral',
  'Examen Preocupacional'
);

create or replace function public.reset_candidate_document_validation(
  p_case_candidate_id uuid,
  p_actor_user_id uuid default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  candidate_record public.recruitment_case_candidates%rowtype;
  had_approved_validation boolean := false;
begin
  if p_case_candidate_id is null then
    return;
  end if;

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    return;
  end if;

  had_approved_validation := candidate_record.document_validation_status = 'approved';

  if candidate_record.stage_code in ('hired', 'rejected', 'withdrawn') then
    return;
  end if;

  if candidate_record.document_validation_status = 'pending'
     and candidate_record.document_validated_by is null
     and candidate_record.document_validated_at is null
     and candidate_record.document_validation_comment is null then
    return;
  end if;

  update public.recruitment_case_candidates
  set
    document_validation_status = 'pending',
    document_validated_by = null,
    document_validated_at = null,
    document_validation_comment = null,
    updated_at = timezone('utc', now())
  where id = candidate_record.id;

  if had_approved_validation and p_actor_user_id is not null then
    insert into public.recruitment_case_audit_log (
      recruitment_case_id,
      recruitment_case_candidate_id,
      actor_user_id,
      action_type,
      metadata
    )
    values (
      candidate_record.recruitment_case_id,
      candidate_record.id,
      p_actor_user_id,
      'candidate_document_validation_reset',
      jsonb_build_object(
        'reason', p_reason,
        'previous_status', 'approved'
      )
    );
  end if;
end;
$function$;

create or replace function public.trg_reset_candidate_document_validation_from_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  affected_case_id uuid := coalesce(new.recruitment_case_id, old.recruitment_case_id);
  affected_profile_id uuid := coalesce(new.candidate_profile_id, old.candidate_profile_id);
  affected_candidate_id uuid;
  actor_user_id uuid := auth.uid();
begin
  for affected_candidate_id in
    select rcc.id
    from public.recruitment_case_candidates rcc
    where rcc.recruitment_case_id = affected_case_id
      and rcc.candidate_profile_id = affected_profile_id
  loop
    perform public.reset_candidate_document_validation(
      affected_candidate_id,
      actor_user_id,
      'candidate_document_changed'
    );
  end loop;

  return null;
end;
$function$;

create or replace function public.trg_reset_candidate_document_validation_from_worker_file()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform public.reset_candidate_document_validation(
    coalesce(new.recruitment_case_candidate_id, old.recruitment_case_candidate_id),
    auth.uid(),
    'candidate_worker_file_changed'
  );

  return null;
end;
$function$;

create or replace function public.trg_reset_candidate_document_validation_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  affected_candidate_id uuid;
begin
  for affected_candidate_id in
    select rcc.id
    from public.recruitment_case_candidates rcc
    where rcc.candidate_profile_id = new.id
  loop
    perform public.reset_candidate_document_validation(
      affected_candidate_id,
      auth.uid(),
      'candidate_profile_changed'
    );
  end loop;

  return null;
end;
$function$;

drop trigger if exists trg_reset_candidate_document_validation_from_documents on public.candidate_documents;
create trigger trg_reset_candidate_document_validation_from_documents
after insert or update or delete on public.candidate_documents
for each row execute function public.trg_reset_candidate_document_validation_from_documents();

drop trigger if exists trg_reset_candidate_document_validation_from_worker_file on public.candidate_worker_files;
create trigger trg_reset_candidate_document_validation_from_worker_file
after insert or update or delete on public.candidate_worker_files
for each row execute function public.trg_reset_candidate_document_validation_from_worker_file();

drop trigger if exists trg_reset_candidate_document_validation_from_profile on public.candidate_profiles;
create trigger trg_reset_candidate_document_validation_from_profile
after update on public.candidate_profiles
for each row execute function public.trg_reset_candidate_document_validation_from_profile();

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
  case_rec public.recruitment_cases%rowtype;
  profile_rec public.candidate_profiles%rowtype;
  worker_rec public.candidate_worker_files%rowtype;
  checklist_docs jsonb;
  semaphore_color text;
  is_driver boolean := false;
  pending_required integer := 0;
  rejected_required integer := 0;
  expired_required integer := 0;
  uploaded_unreviewed integer := 0;
  observed_optional integer := 0;
  required_documents_total integer := 0;
  required_documents_approved integer := 0;
  missing_person_fields text[] := '{}'::text[];
  missing_worker_fields text[] := '{}'::text[];
  validated_by_name text := null;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  select *
    into candidate_rec
    from public.recruitment_case_candidates
   where id = p_case_candidate_id;

  if candidate_rec.id is null then
    raise exception 'Candidato no encontrado';
  end if;

  if not public.user_can_view_recruitment_case(current_user_id, candidate_rec.recruitment_case_id) then
    raise exception 'Sin permisos para ver el caso de este candidato';
  end if;

  select *
    into case_rec
    from public.recruitment_cases
   where id = candidate_rec.recruitment_case_id;

  select *
    into profile_rec
    from public.candidate_profiles
   where id = candidate_rec.candidate_profile_id;

  select *
    into worker_rec
    from public.candidate_worker_files
   where recruitment_case_candidate_id = candidate_rec.id
   limit 1;

  is_driver := public.is_driver_job_position(case_rec.job_position_name);

  missing_person_fields := array_remove(array[
    case when nullif(trim(coalesce(profile_rec.document_type, '')), '') is null then 'Tipo de documento' end,
    case when nullif(trim(coalesce(profile_rec.national_id, '')), '') is null then 'Número de documento' end,
    case when nullif(trim(coalesce(profile_rec.last_name, '')), '') is null then 'Apellido' end,
    case when nullif(trim(coalesce(profile_rec.first_name, '')), '') is null then 'Nombre' end,
    case when nullif(trim(coalesce(profile_rec.gender, '')), '') is null then 'Sexo' end,
    case when nullif(trim(coalesce(profile_rec.nationality, '')), '') is null then 'Nacionalidad' end,
    case when profile_rec.birth_date is null then 'Fecha de nacimiento' end,
    case when nullif(trim(coalesce(profile_rec.marital_status, '')), '') is null then 'Estado civil' end,
    case when nullif(trim(coalesce(profile_rec.address_line, '')), '') is null then 'Dirección' end,
    case when nullif(trim(coalesce(profile_rec.region, '')), '') is null then 'Región' end,
    case when nullif(trim(coalesce(profile_rec.district_or_commune, '')), '') is null then 'Comuna' end
  ], null);

  missing_worker_fields := array_remove(array[
    case when nullif(trim(coalesce(worker_rec.employee_code, '')), '') is null then 'Código de ficha' end,
    case when worker_rec.company_entry_date is null then 'Ingreso compañía' end,
    case when nullif(trim(coalesce(worker_rec.private_role, '')), '') is null then 'Rol privado' end,
    case when nullif(trim(coalesce(worker_rec.payment_method, '')), '') is null then 'Forma de pago' end,
    case when nullif(trim(coalesce(worker_rec.pension_regime, '')), '') is null then 'Régimen previsional' end,
    case when nullif(trim(coalesce(worker_rec.increase_quote_one_percent, '')), '') is null then 'Aumentar cotización 1%' end,
    case when nullif(trim(coalesce(worker_rec.health_provider, '')), '') is null then 'Fonasa / Isapre' end,
    case when nullif(trim(coalesce(worker_rec.afc_regime, '')), '') is null then 'AFC' end,
    case when nullif(trim(coalesce(worker_rec.retirement_regime, '')), '') is null then 'Régimen jubilación' end
  ], null);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', cd.id,
      'document_type_id', dt.id,
      'name', dt.name,
      'is_critical', case when is_driver then dt.required_for_driver else dt.required_for_other end,
      'is_required', case when is_driver then dt.required_for_driver else dt.required_for_other end,
      'requires_expiry_date', dt.requires_expiry_date,
      'status', coalesce(cd.status, 'pending'),
      'file_path', cd.file_path,
      'expiry_date', cd.expiry_date,
      'reviewed_at', cd.reviewed_at,
      'reviewer_notes', cd.reviewer_notes
    )
    order by
      case when is_driver then dt.required_for_driver else dt.required_for_other end desc,
      dt.name asc
  ), '[]'::jsonb)
  into checklist_docs
  from public.document_types dt
  left join public.candidate_documents cd
    on cd.document_type_id = dt.id
   and cd.candidate_profile_id = candidate_rec.candidate_profile_id
   and cd.recruitment_case_id = candidate_rec.recruitment_case_id
  where dt.active = true
    and (
      (is_driver and dt.applies_to_driver)
      or ((not is_driver) and dt.applies_to_other)
    );

  select
    count(*) filter (
      where (case when is_driver then dt.required_for_driver else dt.required_for_other end)
    ),
    count(*) filter (
      where (case when is_driver then dt.required_for_driver else dt.required_for_other end)
        and coalesce(cd.status, 'pending') = 'approved'
    ),
    count(*) filter (
      where (case when is_driver then dt.required_for_driver else dt.required_for_other end)
        and coalesce(cd.status, 'pending') = 'pending'
    ),
    count(*) filter (
      where (case when is_driver then dt.required_for_driver else dt.required_for_other end)
        and coalesce(cd.status, 'pending') = 'rejected'
    ),
    count(*) filter (
      where (case when is_driver then dt.required_for_driver else dt.required_for_other end)
        and coalesce(cd.status, 'pending') = 'expired'
    ),
    count(*) filter (
      where coalesce(cd.status, 'pending') = 'uploaded'
    ),
    count(*) filter (
      where not (case when is_driver then dt.required_for_driver else dt.required_for_other end)
        and coalesce(cd.status, 'pending') = 'rejected'
    )
  into
    required_documents_total,
    required_documents_approved,
    pending_required,
    rejected_required,
    expired_required,
    uploaded_unreviewed,
    observed_optional
  from public.document_types dt
  left join public.candidate_documents cd
    on cd.document_type_id = dt.id
   and cd.candidate_profile_id = candidate_rec.candidate_profile_id
   and cd.recruitment_case_id = candidate_rec.recruitment_case_id
  where dt.active = true
    and (
      (is_driver and dt.applies_to_driver)
      or ((not is_driver) and dt.applies_to_other)
    );

  if (pending_required + rejected_required + expired_required) > 0 then
    if required_documents_approved = 0 and uploaded_unreviewed = 0 and pending_required = required_documents_total then
      semaphore_color := 'gray';
    else
      semaphore_color := 'red';
    end if;
  elsif uploaded_unreviewed > 0 or observed_optional > 0 then
    semaphore_color := 'yellow';
  else
    semaphore_color := 'green';
  end if;

  if candidate_rec.document_validated_by is not null then
    select p.full_name
      into validated_by_name
      from public.profiles p
     where p.id = candidate_rec.document_validated_by;
  end if;

  return jsonb_build_object(
    'semaphore', semaphore_color,
    'candidate_group', case when is_driver then 'conductor' else 'otros' end,
    'worker_file_complete', coalesce(array_length(missing_person_fields, 1), 0) = 0
      and coalesce(array_length(missing_worker_fields, 1), 0) = 0,
    'missing_person_fields', to_jsonb(missing_person_fields),
    'missing_worker_fields', to_jsonb(missing_worker_fields),
    'required_documents_total', required_documents_total,
    'required_documents_approved', required_documents_approved,
    'document_validation', jsonb_build_object(
      'status', candidate_rec.document_validation_status,
      'validated_by', candidate_rec.document_validated_by,
      'validated_by_name', validated_by_name,
      'validated_at', candidate_rec.document_validated_at,
      'comment', candidate_rec.document_validation_comment
    ),
    'documents', checklist_docs
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
  candidate_record public.recruitment_case_candidates%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  if p_status not in ('approved', 'rejected') then
    raise exception 'Estado de revisión inválido';
  end if;

  select *
    into doc_rec
    from public.candidate_documents
   where id = p_document_id;

  if doc_rec.id is null then
    raise exception 'Documento no encontrado';
  end if;

  select *
    into dt_rec
    from public.document_types
   where id = doc_rec.document_type_id;

  if not public.user_can_manage_recruitment_case(current_user_id, doc_rec.recruitment_case_id) then
    raise exception 'Sin permisos para gestionar este caso';
  end if;

  if dt_rec.is_critical then
    if not (
      public.user_is_admin(current_user_id)
      or public.user_has_role(current_user_id, 'compliance_documental')
      or public.user_has_role(current_user_id, 'reclutamiento')
    ) then
      raise exception 'Solo Reclutamiento, Compliance Documental o Admin puede aprobar/rechazar documentos obligatorios';
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

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.recruitment_case_id = doc_rec.recruitment_case_id
     and rcc.candidate_profile_id = doc_rec.candidate_profile_id
   order by rcc.created_at desc
   limit 1;

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    metadata
  )
  values (
    doc_rec.recruitment_case_id,
    candidate_record.id,
    current_user_id,
    'document_reviewed',
    jsonb_build_object(
      'document_id', p_document_id,
      'status', p_status
    )
  );
end;
$function$;

create or replace function public.approve_candidate_documentation(
  p_case_candidate_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  checklist_data jsonb;
  missing_person_fields text[];
  missing_worker_fields text[];
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
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
    raise exception 'Candidato no encontrado';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para validar este candidato';
  end if;

  checklist_data := public.get_candidate_checklist(p_case_candidate_id);
  missing_person_fields := coalesce(
    array(select jsonb_array_elements_text(coalesce(checklist_data -> 'missing_person_fields', '[]'::jsonb))),
    '{}'::text[]
  );
  missing_worker_fields := coalesce(
    array(select jsonb_array_elements_text(coalesce(checklist_data -> 'missing_worker_fields', '[]'::jsonb))),
    '{}'::text[]
  );

  if coalesce((checklist_data ->> 'worker_file_complete')::boolean, false) = false then
    raise exception 'La ficha del candidato sigue incompleta. Pendientes personales: %. Pendientes contractuales: %.',
      coalesce(array_to_string(missing_person_fields, ', '), 'ninguno'),
      coalesce(array_to_string(missing_worker_fields, ', '), 'ninguno');
  end if;

  if coalesce(checklist_data ->> 'semaphore', 'red') <> 'green' then
    raise exception 'La documentación obligatoria aún no está completamente aprobada';
  end if;

  update public.recruitment_case_candidates
  set
    document_validation_status = 'approved',
    document_validated_by = current_user_id,
    document_validated_at = timezone('utc', now()),
    document_validation_comment = normalized_comment,
    updated_at = timezone('utc', now())
  where id = candidate_record.id;

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    metadata
  )
  values (
    candidate_record.recruitment_case_id,
    candidate_record.id,
    current_user_id,
    'candidate_documentation_approved',
    jsonb_build_object(
      'comment', normalized_comment
    )
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
    if candidate_record.document_validation_status <> 'approved'
       or candidate_record.document_validated_by is null
       or candidate_record.document_validated_at is null then
      raise exception 'Debes aprobar la revisión documental antes de dejar al candidato listo para contratar';
    end if;

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
  has_full_access boolean;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_view_recruitment_process_summary(current_user_id, p_case_id) then
    raise exception 'Sin permisos para ver este proceso de contratación';
  end if;

  has_full_access := public.user_can_access_candidate_control(current_user_id)
                     and public.user_can_view_recruitment_case(current_user_id, p_case_id);

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

  if case_payload is null then
    raise exception 'Caso no encontrado';
  end if;

  if has_full_access then
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
          'stage_code', rcc.stage_code,
          'stage_entered_at', rcc.stage_entered_at,
          'suitability_status', rcc.suitability_status,
          'is_selected', rcc.is_selected,
          'hired_at', rcc.hired_at,
          'created_at', rcc.created_at,
          'interview_notes', rcc.interview_notes,
          'document_validation_status', rcc.document_validation_status,
          'document_validated_by', rcc.document_validated_by,
          'document_validated_by_name', validation_profile.full_name,
          'document_validated_at', rcc.document_validated_at,
          'document_validation_comment', rcc.document_validation_comment,
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
      left join public.profiles validation_profile
        on validation_profile.id = rcc.document_validated_by
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
    where al.recruitment_case_id = p_case_id;
  end if;

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
  personnel_to_hire jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'control_contrataciones') then
    raise exception 'Sin permisos para ver control de contrataciones';
  end if;

  can_access_candidate_control := public.user_can_access_candidate_control(current_user_id);

  select jsonb_build_object(
    'pending_contracts_control', count(*) filter (
      where hra.step_code = 'contracts_control' and hra.status = 'pending'
    ),
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
  where public.user_can_view_recruitment_process_summary(current_user_id, rc.id);

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
          'travel_methodology', hr.travel_methodology,
          'other_benefits', hr.other_benefits
        )
      ) as payload,
      hra.created_at as sort_created_at,
      hra.id as sort_id
    from public.hiring_request_approvals hra
    join public.hiring_requests hr
      on hr.id = hra.hiring_request_id
    where hra.step_code in ('area_manager', 'contracts_control')
      and hra.status = 'pending'
      and hr.status not in ('closed', 'rejected')
      and (
        public.user_is_admin(current_user_id)
        or public.user_has_role(current_user_id, 'reclutamiento')
        or hra.approver_user_id = current_user_id
        or (
          hra.step_code = 'contracts_control'
          and public.user_has_role(current_user_id, 'control_contratos')
        )
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
        'hiring_request_status', hr.status,
        'can_close_request', public.user_can_close_hiring_request(current_user_id, hr.id),
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
      select rca.user_id
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
        count(*) filter (
          where rcc.stage_code not in ('rejected', 'withdrawn', 'hired', 'ready_for_hire')
        ) as candidate_count,
        count(*) filter (where rcc.stage_code = 'ready_for_hire') as ready_candidates,
        count(*) filter (where rcc.stage_code = 'hired') as hired_candidates
      from public.recruitment_case_candidates rcc
      where rcc.recruitment_case_id = rc.id
    ) as candidate_stats on true
    where public.user_can_view_recruitment_process_summary(current_user_id, rc.id)
    order by rc.opened_at desc
    limit 50
  ) as case_row;

  if can_access_candidate_control then
    select coalesce(
      jsonb_agg(
        candidate_row.payload
        order by
          candidate_row.sort_case_status_priority asc,
          candidate_row.sort_case_opened_at desc,
          candidate_row.sort_stage_rank asc,
          candidate_row.sort_candidate_created_at asc
      ),
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
          'stage_code', rcc.stage_code,
          'stage_entered_at', rcc.stage_entered_at,
          'suitability_status', rcc.suitability_status,
          'is_selected', rcc.is_selected,
          'contract_name', rc.contract_name,
          'job_position_name', rc.job_position_name,
          'cost_center_code', rc.cost_center_code,
          'cost_center_name', rc.cost_center_name,
          'owner_name', owner_profile.full_name,
          'active_process_count', coalesce(active_processes.active_process_count, 0),
          'contract_locked_case_id', contract_lock.case_id,
          'contract_locked_case_code', contract_lock.case_code,
          'contract_locked_folio', contract_lock.folio,
          'contract_locked_stage_code', contract_lock.stage_code,
          'is_contract_path_blocked', contract_lock.case_candidate_id is not null,
          'interview_notes', rcc.interview_notes
        ) as payload,
        case
          when rc.status = 'ready_to_hire' then 0
          when rc.status = 'screening' then 1
          when rc.status = 'open' then 2
          when rc.status = 'sourcing' then 3
          when rc.status = 'partially_filled' then 4
          when rc.status = 'filled' then 5
          else 6
        end as sort_case_status_priority,
        rc.opened_at as sort_case_opened_at,
        case rcc.stage_code
          when 'ready_for_hire' then 0
          when 'document_review' then 1
          when 'medical_exams' then 2
          when 'who_pending' then 3
          when 'who_approved' then 4
          when 'lead' then 5
          when 'hired' then 6
          else 7
        end as sort_stage_rank,
        rcc.created_at as sort_candidate_created_at
      from public.recruitment_case_candidates rcc
      join public.recruitment_cases rc
        on rc.id = rcc.recruitment_case_id
      join public.hiring_requests hr
        on hr.id = rc.hiring_request_id
      join public.candidate_profiles cp
        on cp.id = rcc.candidate_profile_id
      left join lateral (
        select rca.user_id
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
        from public.recruitment_case_candidates rcc_active
        join public.recruitment_cases rc_active
          on rc_active.id = rcc_active.recruitment_case_id
        where rcc_active.candidate_profile_id = rcc.candidate_profile_id
          and rcc_active.stage_code not in ('hired', 'rejected', 'withdrawn')
          and rc_active.status not in ('filled', 'closed_unfilled', 'cancelled')
      ) as active_processes on true
      left join lateral (
        select *
        from public.find_active_candidate_contract_lock(
          rcc.candidate_profile_id,
          rcc.id
        )
        limit 1
      ) as contract_lock on true
      where public.user_can_access_recruitment_case(current_user_id, rc.id)
        and (
          (
            rc.status not in ('filled', 'closed_unfilled', 'cancelled')
            and rcc.stage_code not in ('hired', 'rejected', 'withdrawn')
          )
          or (
            rc.status = 'cancelled'
            and hr.status = 'closed'
            and rcc.stage_code in ('rejected', 'withdrawn')
          )
        )
    ) as candidate_row;

    select coalesce(
      jsonb_agg(
        hired_row.payload
        order by
          hired_row.sort_case_opened_at desc,
          hired_row.sort_hired_at desc,
          hired_row.sort_candidate_created_at asc
      ),
      '[]'::jsonb
    )
      into personnel_to_hire
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
          'stage_code', rcc.stage_code,
          'stage_entered_at', rcc.stage_entered_at,
          'suitability_status', rcc.suitability_status,
          'is_selected', rcc.is_selected,
          'contract_name', rc.contract_name,
          'job_position_name', rc.job_position_name,
          'cost_center_code', rc.cost_center_code,
          'cost_center_name', rc.cost_center_name,
          'owner_name', owner_profile.full_name,
          'active_process_count', 0,
          'contract_locked_case_id', null,
          'contract_locked_case_code', null,
          'contract_locked_folio', null,
          'contract_locked_stage_code', null,
          'is_contract_path_blocked', false,
          'interview_notes', rcc.interview_notes,
          'hired_at', rcc.hired_at
        ) as payload,
        rc.opened_at as sort_case_opened_at,
        coalesce(rcc.hired_at, rcc.updated_at, rcc.created_at) as sort_hired_at,
        rcc.created_at as sort_candidate_created_at
      from public.recruitment_case_candidates rcc
      join public.recruitment_cases rc
        on rc.id = rcc.recruitment_case_id
      join public.hiring_requests hr
        on hr.id = rc.hiring_request_id
      join public.candidate_profiles cp
        on cp.id = rcc.candidate_profile_id
      left join lateral (
        select rca.user_id
          from public.recruitment_case_assignments rca
         where rca.recruitment_case_id = rc.id
           and rca.is_primary = true
         order by rca.id asc
         limit 1
      ) as owner_assignment on true
      left join public.profiles owner_profile
        on owner_profile.id = owner_assignment.user_id
      where public.user_can_access_recruitment_case(current_user_id, rc.id)
        and rcc.stage_code = 'hired'
    ) as hired_row;
  end if;

  return jsonb_build_object(
    'summary', coalesce(summary, '{}'::jsonb),
    'pending_approvals', coalesce(pending_approvals, '[]'::jsonb),
    'active_cases', coalesce(active_cases, '[]'::jsonb),
    'candidate_control', coalesce(candidate_control, '[]'::jsonb),
    'personnel_to_hire', coalesce(personnel_to_hire, '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.is_driver_job_position(text) from public, anon;
grant execute on function public.is_driver_job_position(text) to authenticated;

revoke all on function public.reset_candidate_document_validation(uuid, uuid, text) from public, anon;
grant execute on function public.reset_candidate_document_validation(uuid, uuid, text) to authenticated;

revoke all on function public.get_candidate_checklist(uuid) from public, anon;
grant execute on function public.get_candidate_checklist(uuid) to authenticated;

revoke all on function public.review_candidate_document(uuid, text, text) from public, anon;
grant execute on function public.review_candidate_document(uuid, text, text) to authenticated;

revoke all on function public.approve_candidate_documentation(uuid, text) from public, anon;
grant execute on function public.approve_candidate_documentation(uuid, text) to authenticated;

revoke all on function public.advance_recruitment_candidate_stage(uuid, text, text) from public, anon;
grant execute on function public.advance_recruitment_candidate_stage(uuid, text, text) to authenticated;

revoke all on function public.get_recruitment_case_detail(uuid) from public, anon;
grant execute on function public.get_recruitment_case_detail(uuid) to authenticated;

revoke all on function public.get_recruitment_control_dashboard_v2() from public, anon;
grant execute on function public.get_recruitment_control_dashboard_v2() to authenticated;

notify pgrst, 'reload schema';

commit;
