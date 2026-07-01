begin;

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
    case when p_to_stage = 'hired' then 'candidate_hired' else 'candidate_stage_changed' end,
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

notify pgrst, 'reload schema';

commit;
