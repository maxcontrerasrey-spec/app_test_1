begin;

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
  effective_employee_code text := null;
  effective_private_role text := null;
  effective_increase_quote_one_percent text := null;
  effective_afc_regime text := null;
  effective_retirement_regime text := null;
  effective_health_plan_uf numeric := null;
  health_plan_required boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select *
    into candidate_rec
    from public.recruitment_case_candidates
   where id = p_case_candidate_id;

  if candidate_rec.id is null then
    raise exception 'Candidato no encontrado';
  end if;

  if not (
    (
      public.user_can_access_candidate_control(current_user_id)
      and public.user_can_view_recruitment_case(current_user_id, candidate_rec.recruitment_case_id)
    )
    or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_rec.id)
  ) then
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
  effective_employee_code := coalesce(
    nullif(trim(coalesce(worker_rec.employee_code, '')), ''),
    public.resolve_candidate_worker_employee_code(candidate_rec.id)
  );
  effective_private_role := coalesce(
    nullif(trim(coalesce(worker_rec.private_role, '')), ''),
    'No'
  );
  effective_increase_quote_one_percent := coalesce(
    nullif(trim(coalesce(worker_rec.increase_quote_one_percent, '')), ''),
    'No'
  );
  effective_afc_regime := coalesce(
    nullif(trim(coalesce(worker_rec.afc_regime, '')), ''),
    'Menos de 11 Años'
  );
  effective_retirement_regime := case
    when public.is_affirmative_buk_value(worker_rec.retired_status)
      then nullif(trim(coalesce(worker_rec.retirement_regime, '')), '')
    else null
  end;
  health_plan_required := public.worker_health_provider_requires_plan(worker_rec.health_provider);
  effective_health_plan_uf := public.resolve_candidate_buk_health_plan_uf(
    worker_rec.health_provider,
    worker_rec.health_plan_uf
  );

  missing_person_fields := array_remove(array[
    case when nullif(trim(coalesce(profile_rec.document_type, '')), '') is null then 'Tipo de documento' end,
    case when nullif(trim(coalesce(profile_rec.national_id, '')), '') is null then 'Número de documento' end,
    case when nullif(trim(coalesce(profile_rec.last_name, '')), '') is null then 'Apellido' end,
    case when nullif(trim(coalesce(profile_rec.first_name, '')), '') is null then 'Nombre' end,
    case when nullif(trim(coalesce(profile_rec.gender, '')), '') is null then 'Sexo' end,
    case when nullif(trim(coalesce(profile_rec.nationality, '')), '') is null then 'Nacionalidad' end,
    case when profile_rec.birth_date is null then 'Fecha de nacimiento' end,
    case when nullif(trim(coalesce(profile_rec.marital_status, '')), '') is null then 'Estado civil' end,
    case when nullif(trim(coalesce(profile_rec.personal_email, '')), '') is null then 'Email personal' end,
    case when nullif(trim(coalesce(profile_rec.address_line, '')), '') is null then 'Dirección' end,
    case when nullif(trim(coalesce(profile_rec.region, '')), '') is null then 'Región' end,
    case when nullif(trim(coalesce(profile_rec.district_or_commune, '')), '') is null then 'Comuna' end,
    case when nullif(trim(coalesce(profile_rec.current_city, '')), '') is null then 'Ciudad' end,
    case when nullif(trim(coalesce(profile_rec.shoe_size, '')), '') is null then 'Número calzado' end,
    case when nullif(trim(coalesce(profile_rec.pants_size, '')), '') is null then 'Talla pantalón' end,
    case when nullif(trim(coalesce(profile_rec.shirt_size, '')), '') is null then 'Talla polera' end
  ], null);

  missing_worker_fields := array_remove(array[
    case when effective_employee_code is null then 'Código de ficha' end,
    case when worker_rec.company_entry_date is null then 'Ingreso compañía' end,
    case when effective_private_role is null then 'Rol privado' end,
    case when nullif(trim(coalesce(worker_rec.payment_method, '')), '') is null then 'Forma de pago' end,
    case when nullif(trim(coalesce(worker_rec.payment_period, '')), '') is null then 'Periodo de pago' end,
    case when nullif(trim(coalesce(worker_rec.pension_regime, '')), '') is null then 'Régimen previsional' end,
    case when effective_increase_quote_one_percent is null then 'Aumentar cotización 1%' end,
    case when nullif(trim(coalesce(worker_rec.health_provider, '')), '') is null then 'Fonasa / Isapre' end,
    case when effective_afc_regime is null then 'AFC' end,
    case
      when public.is_affirmative_buk_value(worker_rec.retired_status)
       and effective_retirement_regime is null then 'Régimen jubilación'
    end,
    case
      when health_plan_required
       and effective_health_plan_uf is null
        then 'Plan Isapre UF'
    end
  ], null);

  with document_scope as (
    select
      dt.id as document_type_id,
      dt.name,
      dt.requires_expiry_date,
      case when is_driver then dt.required_for_driver else dt.required_for_other end as is_required,
      cd.id,
      coalesce(cd.status, 'pending'::public.candidate_document_status) as status,
      cd.file_path,
      cd.expiry_date,
      cd.reviewed_at,
      cd.reviewer_notes
    from public.document_types dt
    left join public.candidate_documents cd
      on cd.document_type_id = dt.id
     and cd.candidate_profile_id = candidate_rec.candidate_profile_id
     and cd.recruitment_case_id = candidate_rec.recruitment_case_id
    where dt.active = true
      and (
        (is_driver and dt.applies_to_driver)
        or ((not is_driver) and dt.applies_to_other)
      )
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'document_type_id', document_type_id,
        'name', name,
        'is_critical', is_required,
        'is_required', is_required,
        'requires_expiry_date', requires_expiry_date,
        'status', status,
        'file_path', file_path,
        'expiry_date', expiry_date,
        'reviewed_at', reviewed_at,
        'reviewer_notes', reviewer_notes
      )
      order by is_required desc, name asc
    ), '[]'::jsonb),
    count(*) filter (where is_required),
    count(*) filter (where is_required and status = 'approved'),
    count(*) filter (where is_required and status = 'pending'),
    count(*) filter (where is_required and status = 'rejected'),
    count(*) filter (where is_required and status = 'expired'),
    count(*) filter (where status = 'uploaded'),
    count(*) filter (where not is_required and status = 'rejected')
  into
    checklist_docs,
    required_documents_total,
    required_documents_approved,
    pending_required,
    rejected_required,
    expired_required,
    uploaded_unreviewed,
    observed_optional
  from document_scope;

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

revoke all on function public.get_candidate_checklist(uuid) from public, anon;
grant execute on function public.get_candidate_checklist(uuid) to authenticated;

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
  cancelled_who_approvals_count integer := 0;
  checklist_data jsonb;
  missing_ready_fields text[] := '{}'::text[];
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
    'medical_contraindication_resolution',
    'document_review',
    'ready_for_hire',
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
     and p_to_stage not in ('medical_contraindication_resolution', 'document_review', 'rejected', 'withdrawn') then
    raise exception 'Desde Exámenes Médicos puedes mover a Levantamiento de Contraindicación, Revisión Documental o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'medical_contraindication_resolution'
     and p_to_stage not in ('document_review', 'rejected', 'withdrawn') then
    raise exception 'Desde Levantamiento de Contraindicación solo puedes mover a Revisión Documental o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'document_review'
     and p_to_stage not in ('ready_for_hire', 'rejected', 'withdrawn') then
    raise exception 'Desde Revisión Documental solo puedes mover a Listo para contratar o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'ready_for_hire'
     and p_to_stage not in ('rejected', 'withdrawn') then
    raise exception 'Desde Listo para contratar solo puedes cerrar la participación; la contratación se completa al generar en BUK';
  end if;

  if p_to_stage = 'medical_exams'
     and candidate_record.stage_code <> 'in_process' then
    raise exception 'Debes mover el candidato a En Proceso antes de pasar a Exámenes Médicos';
  end if;

  if p_to_stage in ('in_process', 'medical_exams')
     and not exists (
       select 1
       from public.candidate_stage_approvals csa
       where csa.recruitment_case_candidate_id = candidate_record.id
         and csa.stage_code = 'who_pending'
         and csa.status = 'approved'
     ) then
    raise exception 'No existe aprobación Who resuelta para avanzar a la etapa seleccionada';
  end if;

  if p_to_stage = 'ready_for_hire' then
    checklist_data := public.get_candidate_checklist(p_case_candidate_id);
    missing_ready_fields := coalesce(
      array(select jsonb_array_elements_text(coalesce(checklist_data -> 'missing_person_fields', '[]'::jsonb))),
      '{}'::text[]
    ) || coalesce(
      array(select jsonb_array_elements_text(coalesce(checklist_data -> 'missing_worker_fields', '[]'::jsonb))),
      '{}'::text[]
    );

    if coalesce((checklist_data ->> 'worker_file_complete')::boolean, false) = false then
      raise exception 'No puedes dejar al candidato listo para contratar porque falta completar la ficha del candidato. Campos pendientes: %.',
        coalesce(array_to_string(missing_ready_fields, ', '), 'sin detalle');
    end if;

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
         hired_at = rcc.hired_at,
         rejection_reason = case when p_to_stage = 'rejected' then normalized_comment else rcc.rejection_reason end,
         withdrawal_reason = case when p_to_stage = 'withdrawn' then normalized_comment else rcc.withdrawal_reason end,
         updated_at = timezone('utc', now())
   where rcc.id = candidate_record.id;

  if p_to_stage in ('rejected', 'withdrawn') then
    update public.candidate_stage_approvals csa
       set status = 'cancelled',
           approved_by = current_user_id,
           approved_at = timezone('utc', now()),
           comment = coalesce(csa.comment, normalized_comment, 'Participación cerrada antes de resolver la aprobación Who'),
           updated_at = timezone('utc', now())
     where csa.recruitment_case_candidate_id = candidate_record.id
       and csa.stage_code = 'who_pending'
       and csa.status = 'pending';

    get diagnostics cancelled_who_approvals_count = row_count;
  end if;

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
    'candidate_stage_changed',
    jsonb_build_object(
      'stage_code', candidate_record.stage_code
    ),
    jsonb_build_object(
      'stage_code', p_to_stage
    ),
    jsonb_build_object(
      'comment', normalized_comment,
      'cancelled_who_approvals', cancelled_who_approvals_count
    )
  );

  if p_to_stage in ('rejected', 'withdrawn') then
    perform public.enqueue_candidate_document_cleanup(candidate_record.id);
  end if;

  next_case_status := public.sync_recruitment_case_status(candidate_record.recruitment_case_id, current_user_id);

  return query
  select candidate_record.recruitment_case_id, p_to_stage, next_case_status;
end;
$function$;

revoke all on function public.advance_recruitment_candidate_stage(uuid, text, text)
  from public, anon;
grant execute on function public.advance_recruitment_candidate_stage(uuid, text, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
