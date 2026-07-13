begin;

create or replace function public.authorize_candidate_document_removal(
  p_case_candidate_id uuid,
  p_document_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  candidate_record public.recruitment_case_candidates%rowtype;
  document_record public.candidate_documents%rowtype;
  document_type_record public.document_types%rowtype;
begin
  if p_actor_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id;

  if candidate_record.id is null then
    raise exception 'Candidato no encontrado';
  end if;

  if candidate_record.stage_code = 'hired' then
    raise exception 'Los documentos de candidatos contratados quedan resguardados en BUK y no pueden modificarse desde el ERP';
  end if;

  if candidate_record.stage_code in ('rejected', 'withdrawn') then
    raise exception 'No se pueden modificar documentos de candidatos cerrados';
  end if;

  if not (
    public.user_can_manage_recruitment_case(p_actor_user_id, candidate_record.recruitment_case_id)
    or public.user_can_manage_recruitment_personnel_candidate(p_actor_user_id, candidate_record.id)
  ) then
    raise exception 'Sin permisos para eliminar documentos en este caso';
  end if;

  select *
    into document_record
    from public.candidate_documents cd
   where cd.id = p_document_id
     and cd.recruitment_case_id = candidate_record.recruitment_case_id
     and cd.candidate_profile_id = candidate_record.candidate_profile_id;

  if document_record.id is null then
    raise exception 'Documento no encontrado para este candidato';
  end if;

  select *
    into document_type_record
    from public.document_types dt
   where dt.id = document_record.document_type_id;

  return jsonb_build_object(
    'document_id', document_record.id,
    'document_type_id', document_record.document_type_id,
    'document_name', document_type_record.name,
    'file_path', document_record.file_path,
    'stage_code', candidate_record.stage_code
  );
end;
$function$;

create or replace function public.remove_candidate_document_record(
  p_case_candidate_id uuid,
  p_document_id uuid,
  p_actor_user_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  candidate_record public.recruitment_case_candidates%rowtype;
  document_record public.candidate_documents%rowtype;
  document_type_record public.document_types%rowtype;
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if p_actor_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'Candidato no encontrado';
  end if;

  if candidate_record.stage_code = 'hired' then
    raise exception 'Los documentos de candidatos contratados quedan resguardados en BUK y no pueden modificarse desde el ERP';
  end if;

  if candidate_record.stage_code in ('rejected', 'withdrawn') then
    raise exception 'No se pueden modificar documentos de candidatos cerrados';
  end if;

  if not (
    public.user_can_manage_recruitment_case(p_actor_user_id, candidate_record.recruitment_case_id)
    or public.user_can_manage_recruitment_personnel_candidate(p_actor_user_id, candidate_record.id)
  ) then
    raise exception 'Sin permisos para eliminar documentos en este caso';
  end if;

  select *
    into document_record
    from public.candidate_documents cd
   where cd.id = p_document_id
     and cd.recruitment_case_id = candidate_record.recruitment_case_id
     and cd.candidate_profile_id = candidate_record.candidate_profile_id
   for update;

  if document_record.id is null then
    raise exception 'Documento no encontrado para este candidato';
  end if;

  select *
    into document_type_record
    from public.document_types dt
   where dt.id = document_record.document_type_id;

  delete from public.candidate_documents
   where id = document_record.id;

  update public.recruitment_case_candidates rcc
     set document_validation_status = 'pending',
         document_validated_by = null,
         document_validated_at = null,
         document_validation_comment = coalesce(
           normalized_reason,
           format('Documento eliminado o reemplazado: %s.', coalesce(document_type_record.name, 'documento'))
         ),
         stage_code = case
           when candidate_record.stage_code = 'ready_for_hire' then 'document_review'
           else rcc.stage_code
         end,
         stage_entered_at = case
           when candidate_record.stage_code = 'ready_for_hire' then timezone('utc', now())
           else rcc.stage_entered_at
         end,
         updated_at = timezone('utc', now())
   where rcc.id = candidate_record.id;

  if candidate_record.stage_code = 'ready_for_hire' then
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
      'ready_for_hire',
      'document_review',
      p_actor_user_id,
      'document_removed',
      coalesce(normalized_reason, 'Documento eliminado o reemplazado en control documental.')
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
      p_actor_user_id,
      'candidate_stage_changed',
      jsonb_build_object(
        'stage_code', 'ready_for_hire',
        'document_validation_status', candidate_record.document_validation_status
      ),
      jsonb_build_object(
        'stage_code', 'document_review',
        'document_validation_status', 'pending'
      ),
      jsonb_build_object(
        'reason_code', 'document_removed',
        'document_id', document_record.id,
        'document_type_id', document_record.document_type_id
      )
    );
  end if;

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
    p_actor_user_id,
    'candidate_document_validation_reset',
    jsonb_build_object(
      'document_id', document_record.id,
      'document_type_id', document_record.document_type_id,
      'document_name', document_type_record.name,
      'document_status', document_record.status,
      'file_path', document_record.file_path,
      'expiry_date', document_record.expiry_date
    ),
    jsonb_build_object(
      'document_removed', true,
      'document_validation_status', 'pending'
    ),
    jsonb_build_object(
      'source', 'remove_candidate_document_record',
      'reason', coalesce(normalized_reason, 'manual_document_removal')
    )
  );

  perform public.sync_recruitment_case_status(candidate_record.recruitment_case_id, p_actor_user_id);

  return jsonb_build_object(
    'document_id', document_record.id,
    'document_type_id', document_record.document_type_id,
    'document_name', document_type_record.name,
    'file_path', document_record.file_path,
    'stage_changed', candidate_record.stage_code = 'ready_for_hire'
  );
end;
$function$;

revoke all on function public.remove_candidate_document_record(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.authorize_candidate_document_removal(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_candidate_document_record(uuid, uuid, uuid, text) to service_role;
grant execute on function public.authorize_candidate_document_removal(uuid, uuid, uuid) to service_role;

notify pgrst, 'reload schema';

commit;
