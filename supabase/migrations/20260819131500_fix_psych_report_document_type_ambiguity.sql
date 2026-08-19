begin;

-- Fixes the automatic document-registration step after a psychologist validates
-- the report. The previous local variable document_type_id conflicted with the
-- candidate_documents.document_type_id column in the SELECT/INSERT/UPDATE flow.
create or replace function public.register_psycholaboral_report_document(
  p_assessment_id uuid,
  p_file_path text,
  p_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  assessment_rec record;
  v_document_type_id uuid;
  existing_rec record;
  stored boolean := false;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Solo el servicio psicolaboral puede registrar este documento';
  end if;

  select a.id, rcc.id as case_candidate_id, rcc.recruitment_case_id, rcc.candidate_profile_id
    into assessment_rec
    from private.psychometric_assessments a
    join public.recruitment_case_candidates rcc on rcc.id = a.recruitment_case_candidate_id
   where a.id = p_assessment_id;

  if assessment_rec.id is null then
    raise exception 'Evaluación psicolaboral no encontrada';
  end if;

  select dt.id into v_document_type_id
    from public.document_types dt
   where dt.active
     and dt.name = 'Informe Evaluación Psicolaboral'
   limit 1;

  if v_document_type_id is null then
    raise exception 'No existe el tipo documental Informe Evaluación Psicolaboral';
  end if;

  select cd.id, cd.file_path, cd.status
    into existing_rec
    from public.candidate_documents cd
   where cd.recruitment_case_id = assessment_rec.recruitment_case_id
     and cd.candidate_profile_id = assessment_rec.candidate_profile_id
     and cd.document_type_id = v_document_type_id
   for update;

  if existing_rec.id is null then
    insert into public.candidate_documents(
      candidate_profile_id, recruitment_case_id, document_type_id,
      status, file_path, uploaded_by, updated_at
    ) values (
      assessment_rec.candidate_profile_id, assessment_rec.recruitment_case_id,
      v_document_type_id, 'uploaded', p_file_path, null, timezone('utc', now())
    );
    stored := true;
  elsif existing_rec.file_path is null
     or existing_rec.file_path like 'psycholaboral-auto/%' then
    update public.candidate_documents cd
       set status = 'uploaded', file_path = p_file_path,
           expiry_date = null, uploaded_by = null,
           reviewed_by = null, reviewed_at = null, reviewer_notes = null,
           updated_at = timezone('utc', now())
     where cd.id = existing_rec.id;
    stored := true;
  end if;

  insert into public.recruitment_case_audit_log(
    recruitment_case_id, recruitment_case_candidate_id, actor_user_id,
    action_type, metadata
  ) values (
    assessment_rec.recruitment_case_id, assessment_rec.case_candidate_id, null,
    case when stored then 'document_uploaded' else 'psycholaboral_report_document_preserved' end,
    jsonb_build_object(
      'document_type_id', v_document_type_id,
      'source', 'psycholaboral_validated_report',
      'assessment_id', p_assessment_id,
      'file_path', p_file_path,
      'sha256', p_sha256,
      'stored', stored
    )
  );

  return jsonb_build_object(
    'stored', stored,
    'document_type_id', v_document_type_id,
    'existing_file_path', existing_rec.file_path
  );
end;
$$;

revoke all on function public.register_psycholaboral_report_document(uuid,text,text) from public, anon, authenticated;
grant execute on function public.register_psycholaboral_report_document(uuid,text,text) to service_role;

notify pgrst, 'reload schema';
commit;
