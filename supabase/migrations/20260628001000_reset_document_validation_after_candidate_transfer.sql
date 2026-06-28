create or replace function public.transfer_candidate_to_case(
  p_case_candidate_id uuid,
  p_target_case_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  source_candidate_record public.recruitment_case_candidates%rowtype;
  target_case_record public.recruitment_cases%rowtype;
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
  source_case_id uuid;
  doc_conflict_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  select *
    into source_candidate_record
    from public.recruitment_case_candidates
   where id = p_case_candidate_id
   for update;

  if source_candidate_record.id is null then
    raise exception 'No existe el candidato';
  end if;

  if source_candidate_record.recruitment_case_id = p_target_case_id then
    raise exception 'El candidato ya pertenece a este folio';
  end if;

  if source_candidate_record.stage_code in ('hired', 'rejected', 'withdrawn') then
    raise exception 'No se puede trasladar un candidato en etapa terminal (contratado, rechazado o desistido)';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, source_candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para gestionar el caso de origen';
  end if;

  select *
    into target_case_record
    from public.recruitment_cases
   where id = p_target_case_id
   for update;

  if target_case_record.id is null then
    raise exception 'No existe el folio destino';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, p_target_case_id) then
    raise exception 'Sin permisos para gestionar el folio destino';
  end if;

  if target_case_record.status in ('filled', 'closed_unfilled', 'cancelled') then
    raise exception 'El folio destino ya se encuentra cerrado o cancelado';
  end if;

  if exists (
    select 1
      from public.recruitment_case_candidates
     where recruitment_case_id = p_target_case_id
       and candidate_profile_id = source_candidate_record.candidate_profile_id
  ) then
    raise exception 'El candidato ya se encuentra postulando al folio destino';
  end if;

  select count(*)
    into doc_conflict_count
    from public.candidate_documents cd_src
   where cd_src.recruitment_case_id = source_candidate_record.recruitment_case_id
     and cd_src.candidate_profile_id = source_candidate_record.candidate_profile_id
     and exists (
       select 1
         from public.candidate_documents cd_dst
        where cd_dst.recruitment_case_id = p_target_case_id
          and cd_dst.candidate_profile_id = source_candidate_record.candidate_profile_id
          and cd_dst.document_type_id = cd_src.document_type_id
     );

  if doc_conflict_count > 0 then
    raise exception 'Existen % documento(s) con conflicto de unicidad en el folio destino. No se puede trasladar automáticamente.', doc_conflict_count;
  end if;

  source_case_id := source_candidate_record.recruitment_case_id;

  update public.candidate_documents
     set recruitment_case_id = p_target_case_id,
         updated_at = timezone('utc', now())
   where recruitment_case_id = source_case_id
     and candidate_profile_id = source_candidate_record.candidate_profile_id;

  update public.recruitment_case_candidates
     set recruitment_case_id = p_target_case_id,
         updated_at = timezone('utc', now())
   where id = p_case_candidate_id;

  perform public.reset_candidate_document_validation(
    p_case_candidate_id,
    current_user_id,
    'candidate_transferred_to_other_case'
  );

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    metadata
  ) values (
    source_case_id,
    p_case_candidate_id,
    current_user_id,
    'candidate_transferred_out',
    jsonb_build_object(
      'target_case_id', p_target_case_id,
      'target_case_code', target_case_record.case_code,
      'comment', normalized_comment
    )
  );

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    metadata
  ) values (
    p_target_case_id,
    p_case_candidate_id,
    current_user_id,
    'candidate_transferred_in',
    jsonb_build_object(
      'source_case_id', source_case_id,
      'comment', normalized_comment
    )
  );

  if source_case_id::text <= p_target_case_id::text then
    perform public.sync_recruitment_case_status(source_case_id, current_user_id);
    perform public.sync_recruitment_case_status(p_target_case_id, current_user_id);
  else
    perform public.sync_recruitment_case_status(p_target_case_id, current_user_id);
    perform public.sync_recruitment_case_status(source_case_id, current_user_id);
  end if;

  return;
end;
$function$;
