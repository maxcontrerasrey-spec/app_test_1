begin;

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
  current_user_id uuid := auth.uid();
  source_candidate_record public.recruitment_case_candidates%rowtype;
  target_case_record public.recruitment_cases%rowtype;
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  -- Bloquear candidato
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

  -- Validar permisos sobre el caso de origen
  if not public.user_can_manage_recruitment_case(current_user_id, source_candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para gestionar el caso de origen';
  end if;

  -- Bloquear caso destino
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

  -- Realizar traslado de documentos
  -- (Solo traslada los que no generen conflicto, aunque si no estaba en el folio destino, no debería haber conflicto)
  update public.candidate_documents
     set recruitment_case_id = p_target_case_id,
         updated_at = timezone('utc', now())
   where recruitment_case_id = source_candidate_record.recruitment_case_id
     and candidate_profile_id = source_candidate_record.candidate_profile_id;

  -- Mover al candidato (cambia la foreign key)
  update public.recruitment_case_candidates
     set recruitment_case_id = p_target_case_id,
         updated_at = timezone('utc', now())
   where id = p_case_candidate_id;

  -- Auditoría en caso origen (salió)
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

  -- Auditoría en caso destino (entró)
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
