begin;

do $function$
declare
  target_candidate_id constant uuid := '182ce6a3-1f4d-43f4-b5ae-041d32b6c99a';
  target_case_id constant uuid := '744cbf1d-8953-4285-8c41-7adab51ecd0e';
  target_profile_id constant uuid := '048c912a-8eb1-49dc-b051-2b690579d178';
  target_cleanup_job_id constant uuid := 'a163fbc9-29da-49c2-b38c-0318b7642a82';
  actor_user_id constant uuid := '74345f87-810f-49a8-9c0e-18aaf68602e8';
  candidate_record public.recruitment_case_candidates%rowtype;
  profile_record public.candidate_profiles%rowtype;
  case_record public.recruitment_cases%rowtype;
  uploaded_documents_count integer := 0;
begin
  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = target_candidate_id
   for update;

  select *
    into profile_record
    from public.candidate_profiles cp
   where cp.id = target_profile_id;

  select *
    into case_record
    from public.recruitment_cases rc
   where rc.id = target_case_id
   for update;

  if candidate_record.id is null
     or candidate_record.recruitment_case_id <> target_case_id
     or candidate_record.candidate_profile_id <> target_profile_id
     or candidate_record.stage_code <> 'withdrawn'
     or candidate_record.withdrawal_reason is distinct from 'Postulante desiste del proceso'
     or candidate_record.document_validation_status is distinct from 'pending' then
    raise exception 'Guard failed: Carlos Salazar case candidate is not in expected withdrawn/pending state.';
  end if;

  if profile_record.id is null
     or profile_record.national_id <> '150156335'
     or lower(profile_record.full_name) <> lower('Carlos Andrés Salazar Espinoza') then
    raise exception 'Guard failed: Carlos Salazar profile identity mismatch.';
  end if;

  if case_record.id is null
     or case_record.case_code <> 'RC-1978'
     or case_record.status <> 'ready_to_hire' then
    raise exception 'Guard failed: RC-1978 is not in expected state.';
  end if;

  if not exists (
    select 1
      from public.hiring_requests hr
     where hr.id = case_record.hiring_request_id
       and hr.folio = '1978'
  ) then
    raise exception 'Guard failed: hiring request folio 1978 mismatch.';
  end if;

  if not exists (
    select 1
      from public.candidate_stage_approvals csa
     where csa.recruitment_case_candidate_id = target_candidate_id
       and csa.stage_code = 'who_pending'
       and csa.status = 'approved'
  ) then
    raise exception 'Guard failed: approved Who record is required before returning to document review.';
  end if;

  select count(*)::integer
    into uploaded_documents_count
    from public.candidate_documents cd
   where cd.recruitment_case_id = target_case_id
     and cd.candidate_profile_id = target_profile_id
     and cd.status = 'uploaded';

  if uploaded_documents_count <> 16 then
    raise exception 'Guard failed: expected 16 uploaded documents, found %.', uploaded_documents_count;
  end if;

  if not exists (
    select 1
      from public.candidate_document_cleanup_jobs cdcj
     where cdcj.id = target_cleanup_job_id
       and cdcj.recruitment_case_candidate_id = target_candidate_id
       and cdcj.terminal_stage = 'withdrawn'
       and cdcj.status = 'pending'
  ) then
    raise exception 'Guard failed: pending cleanup job for withdrawn candidate was not found.';
  end if;

  update public.recruitment_case_candidates rcc
     set stage_code = 'document_review',
         stage_entered_at = timezone('utc', now()),
         withdrawal_reason = null,
         updated_at = timezone('utc', now())
   where rcc.id = target_candidate_id;

  delete from public.candidate_document_cleanup_jobs cdcj
   where cdcj.id = target_cleanup_job_id
     and cdcj.status = 'pending';

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id,
    from_stage,
    to_stage,
    changed_by,
    reason_code,
    comment
  )
  values (
    target_candidate_id,
    'withdrawn',
    'document_review',
    actor_user_id,
    'terminal_reopen_to_document_review',
    'Reparacion auditada: Carlos Salazar vuelve desde descartados a control documental por solicitud operacional.'
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
    target_case_id,
    target_candidate_id,
    actor_user_id,
    'candidate_stage_changed',
    jsonb_build_object(
      'stage_code', candidate_record.stage_code,
      'withdrawal_reason', candidate_record.withdrawal_reason,
      'document_validation_status', candidate_record.document_validation_status
    ),
    jsonb_build_object(
      'stage_code', 'document_review',
      'withdrawal_reason', null,
      'document_validation_status', 'pending'
    ),
    jsonb_build_object(
      'reason_code', 'terminal_reopen_to_document_review',
      'source', 'repair_carlos_salazar_to_document_review',
      'cleanup_job_deleted', target_cleanup_job_id,
      'uploaded_documents_count', uploaded_documents_count,
      'comment', 'Carlos Salazar vuelve a control documental; se cancela la limpieza documental pendiente del retiro.'
    )
  );

  perform public.sync_recruitment_case_status(target_case_id, actor_user_id);
end;
$function$;

notify pgrst, 'reload schema';

commit;
