begin;

-- 1. Ampliar el CHECK constraint del audit log para incluir los nuevos tipos de acción
do $$ begin
  if exists (
    select 1 from pg_constraint
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
        'candidate_stage_approval_approved',
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
end $$;

-- 2. Función de traslado de candidatos entre folios
create or replace function public.transfer_candidate_to_case(
  p_case_candidate_id uuid,
  p_target_case_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  source_candidate_record public.recruitment_case_candidates%rowtype;
  target_case_record public.recruitment_cases%rowtype;
  normalized_comment text;
  doc_conflict_count integer;
begin
  current_user_id := auth.uid();
  normalized_comment := nullif(trim(coalesce(p_comment, '')), '');

  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  -- Bloquear y cargar candidato origen
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

  -- El candidato no puede estar en una etapa terminal
  if source_candidate_record.stage_code in ('hired', 'rejected', 'withdrawn') then
    raise exception 'No se puede trasladar un candidato en etapa terminal (contratado, rechazado o desistido)';
  end if;

  -- Validar permisos sobre el caso de origen
  if not public.user_can_manage_recruitment_case(current_user_id, source_candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para gestionar el caso de origen';
  end if;

  -- Bloquear y cargar caso destino
  select *
    into target_case_record
    from public.recruitment_cases
   where id = p_target_case_id
   for update;

  if target_case_record.id is null then
    raise exception 'No existe el folio destino';
  end if;

  -- Validar permisos sobre el caso de destino
  if not public.user_can_manage_recruitment_case(current_user_id, p_target_case_id) then
    raise exception 'Sin permisos para gestionar el folio destino';
  end if;

  if target_case_record.status in ('filled', 'closed_unfilled', 'cancelled') then
    raise exception 'El folio destino ya se encuentra cerrado o cancelado';
  end if;

  -- Validar que el candidato no exista ya en el folio destino
  if exists (
    select 1
    from public.recruitment_case_candidates
    where recruitment_case_id = p_target_case_id
      and candidate_profile_id = source_candidate_record.candidate_profile_id
  ) then
    raise exception 'El candidato ya se encuentra postulando al folio destino';
  end if;

  -- Validar que los documentos no generen conflicto de unicidad en el folio destino
  -- (chequeo defensivo: recruitment_case_id + candidate_profile_id + document_type_id debe ser único)
  select count(*)
    into doc_conflict_count
    from public.candidate_documents cd_src
   where cd_src.recruitment_case_id = source_candidate_record.recruitment_case_id
     and cd_src.candidate_profile_id = source_candidate_record.candidate_profile_id
     and exists (
       select 1 from public.candidate_documents cd_dst
        where cd_dst.recruitment_case_id = p_target_case_id
          and cd_dst.candidate_profile_id = source_candidate_record.candidate_profile_id
          and cd_dst.document_type_id = cd_src.document_type_id
     );

  if doc_conflict_count > 0 then
    raise exception 'Existen % documento(s) con conflicto de unicidad en el folio destino. No se puede trasladar automáticamente.', doc_conflict_count;
  end if;

  -- Trasladar documentos al folio destino
  update public.candidate_documents
     set recruitment_case_id = p_target_case_id,
         updated_at = timezone('utc', now())
   where recruitment_case_id = source_candidate_record.recruitment_case_id
     and candidate_profile_id = source_candidate_record.candidate_profile_id;

  -- Mover al candidato al folio destino
  update public.recruitment_case_candidates
     set recruitment_case_id = p_target_case_id,
         updated_at = timezone('utc', now())
   where id = p_case_candidate_id;

  -- Auditoría en caso ORIGEN (salió) — usar el ID original del caso
  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    metadata
  ) values (
    source_candidate_record.recruitment_case_id,
    p_case_candidate_id,
    current_user_id,
    'candidate_transferred_out',
    jsonb_build_object(
      'target_case_id', p_target_case_id,
      'target_case_code', target_case_record.case_code,
      'comment', normalized_comment
    )
  );

  -- Auditoría en caso DESTINO (entró)
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
      'source_case_id', source_candidate_record.recruitment_case_id,
      'comment', normalized_comment
    )
  );

end;
$$;

revoke all on function public.transfer_candidate_to_case(uuid, uuid, text) from public, anon;
grant execute on function public.transfer_candidate_to_case(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
