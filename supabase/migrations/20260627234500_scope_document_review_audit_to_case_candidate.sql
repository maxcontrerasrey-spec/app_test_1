drop function if exists public.review_candidate_document(uuid, text, text);
drop function if exists public.review_candidate_document(uuid, text, text, uuid);

create or replace function public.review_candidate_document(
  p_document_id uuid,
  p_status text,
  p_notes text default null,
  p_case_candidate_id uuid default null
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

  if p_case_candidate_id is null then
    raise exception 'Se requiere identificar al candidato del caso para auditar la revisión documental';
  end if;

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'Candidato no encontrado';
  end if;

  if candidate_record.recruitment_case_id <> doc_rec.recruitment_case_id
     or candidate_record.candidate_profile_id <> doc_rec.candidate_profile_id then
    raise exception 'El documento no pertenece al candidato indicado';
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

revoke all on function public.review_candidate_document(uuid, text, text, uuid) from public, anon;
grant execute on function public.review_candidate_document(uuid, text, text, uuid) to authenticated;
