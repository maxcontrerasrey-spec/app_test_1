begin;

do $$
declare
  target_case_candidate_id uuid := 'ef4064a2-d076-4258-9691-2d270e3c7d0b';
  target_profile_id uuid := '4a38a8ce-5bf9-44c2-a769-7b2d26197eaf';
  target_case_id uuid := 'aa097f7f-17e6-4c2d-baec-9673a8ea5f31';
  target_case_code text := 'RC-0054';
  target_full_name text := 'Rodolfo Francisco González Ortiz';
  target_actor_user_id uuid := '0de4ef6f-3e52-4bab-8042-ab04ea7763ae';
  correction_comment text := 'Corrección auditada de rechazo WHO emitido por error. Antecedentes aprobados.';
  reactivation_comment text := 'Reapertura auditada para corregir rechazo WHO emitido por error.';
  now_utc timestamptz := timezone('utc', now());
  candidate_record public.recruitment_case_candidates%rowtype;
  profile_record public.candidate_profiles%rowtype;
  case_record public.recruitment_cases%rowtype;
  rejected_approval public.candidate_stage_approvals%rowtype;
  repaired_approval_id bigint;
begin
  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = target_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise notice 'Skipping Rodolfo WHO repair: target candidate % not found in this environment', target_case_candidate_id;
    return;
  end if;

  if candidate_record.candidate_profile_id <> target_profile_id then
    raise exception 'El candidato objetivo no corresponde al perfil esperado';
  end if;

  if candidate_record.recruitment_case_id <> target_case_id then
    raise exception 'El candidato objetivo no corresponde al caso esperado';
  end if;

  if candidate_record.stage_code = 'who_approved'
     and exists (
       select 1
         from public.candidate_stage_approvals csa
        where csa.recruitment_case_candidate_id = target_case_candidate_id
          and csa.stage_code = 'who_pending'
          and csa.status = 'approved'
     ) then
    raise notice 'Skipping Rodolfo WHO repair: target candidate % is already repaired', target_case_candidate_id;
    return;
  end if;

  if candidate_record.stage_code <> 'rejected' then
    raise exception 'La reparación WHO exige que el candidato siga en etapa terminal rejected';
  end if;

  select *
    into profile_record
    from public.candidate_profiles cp
   where cp.id = target_profile_id
   for update;

  if profile_record.id is null or profile_record.full_name <> target_full_name then
    raise exception 'El perfil objetivo no coincide con el candidato esperado';
  end if;

  select *
    into case_record
    from public.recruitment_cases rc
   where rc.id = target_case_id
   for update;

  if case_record.id is null or case_record.case_code <> target_case_code then
    raise exception 'El caso objetivo no coincide con la reparación WHO esperada';
  end if;

  select *
    into rejected_approval
    from public.candidate_stage_approvals csa
   where csa.recruitment_case_candidate_id = target_case_candidate_id
     and csa.stage_code = 'who_pending'
     and csa.status = 'rejected'
   order by csa.approved_at desc nulls last, csa.id desc
   limit 1
   for update;

  if rejected_approval.id is null then
    raise notice 'Skipping Rodolfo WHO repair: prior rejected WHO approval not found for candidate %', target_case_candidate_id;
    return;
  end if;

  if rejected_approval.approved_by <> target_actor_user_id then
    raise exception 'El rechazo WHO previo no fue emitido por el usuario esperado para esta corrección';
  end if;

  if exists (
    select 1
      from public.candidate_stage_approvals csa
     where csa.recruitment_case_candidate_id = target_case_candidate_id
       and csa.stage_code = 'who_pending'
       and csa.status = 'approved'
  ) then
    raise notice 'Skipping Rodolfo WHO repair: approved WHO resolution already exists for candidate %', target_case_candidate_id;
    return;
  end if;

  update public.recruitment_case_candidates rcc
     set stage_code = 'lead',
         stage_entered_at = now_utc,
         rejection_reason = null,
         withdrawal_reason = null,
         is_selected = false,
         hired_at = null,
         updated_at = now_utc
   where rcc.id = target_case_candidate_id;

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id,
    from_stage,
    to_stage,
    changed_by,
    reason_code,
    comment,
    created_at
  )
  values (
    target_case_candidate_id,
    'rejected',
    'lead',
    target_actor_user_id,
    'candidate_reactivated_who_correction',
    reactivation_comment,
    now_utc
  );

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    old_values,
    new_values,
    metadata,
    created_at
  )
  values (
    target_case_id,
    target_case_candidate_id,
    target_actor_user_id,
    'candidate_stage_changed',
    jsonb_build_object(
      'stage_code', 'rejected',
      'rejection_reason', candidate_record.rejection_reason
    ),
    jsonb_build_object(
      'stage_code', 'lead',
      'rejection_reason', null
    ),
    jsonb_build_object(
      'reason_code', 'candidate_reactivated_who_correction',
      'source', 'versioned_repair',
      'original_who_approval_id', rejected_approval.id,
      'original_who_rejection_comment', rejected_approval.comment
    ),
    now_utc
  );

  update public.recruitment_case_candidates rcc
     set stage_code = 'who_pending',
         stage_entered_at = now_utc,
         updated_at = now_utc
   where rcc.id = target_case_candidate_id;

  insert into public.candidate_stage_approvals (
    recruitment_case_candidate_id,
    stage_code,
    status,
    requested_by,
    requested_at,
    comment,
    causes,
    created_at,
    updated_at
  )
  values (
    target_case_candidate_id,
    'who_pending',
    'pending',
    rejected_approval.requested_by,
    now_utc,
    correction_comment,
    rejected_approval.causes,
    now_utc,
    now_utc
  )
  returning id into repaired_approval_id;

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id,
    from_stage,
    to_stage,
    changed_by,
    reason_code,
    comment,
    created_at
  )
  values (
    target_case_candidate_id,
    'lead',
    'who_pending',
    target_actor_user_id,
    'who_requested_repair',
    correction_comment,
    now_utc
  );

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    old_values,
    new_values,
    metadata,
    created_at
  )
  values (
    target_case_id,
    target_case_candidate_id,
    target_actor_user_id,
    'candidate_stage_approval_requested',
    jsonb_build_object(
      'stage_code', 'lead'
    ),
    jsonb_build_object(
      'approval_id', repaired_approval_id,
      'status', 'pending',
      'stage_code', 'who_pending'
    ),
    jsonb_build_object(
      'comment', correction_comment,
      'causes', rejected_approval.causes,
      'repair_of_approval_id', rejected_approval.id,
      'source', 'versioned_repair'
    ),
    now_utc
  );

  update public.candidate_stage_approvals csa
     set status = 'approved',
         approved_by = target_actor_user_id,
         approved_at = now_utc,
         updated_at = now_utc
   where csa.id = repaired_approval_id;

  update public.recruitment_case_candidates rcc
     set stage_code = 'who_approved',
         stage_entered_at = now_utc,
         updated_at = now_utc
   where rcc.id = target_case_candidate_id;

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id,
    from_stage,
    to_stage,
    changed_by,
    reason_code,
    comment,
    created_at
  )
  values (
    target_case_candidate_id,
    'who_pending',
    'who_approved',
    target_actor_user_id,
    'who_approved',
    correction_comment,
    now_utc
  );

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    old_values,
    new_values,
    metadata,
    created_at
  )
  values (
    target_case_id,
    target_case_candidate_id,
    target_actor_user_id,
    'candidate_stage_approval_approved',
    jsonb_build_object(
      'approval_id', repaired_approval_id,
      'status', 'pending',
      'stage_code', 'who_pending'
    ),
    jsonb_build_object(
      'approval_id', repaired_approval_id,
      'status', 'approved',
      'stage_code', 'who_pending',
      'approved_at', now_utc
    ),
    jsonb_build_object(
      'comment', correction_comment,
      'repair_of_approval_id', rejected_approval.id,
      'source', 'versioned_repair'
    ),
    now_utc
  );

  perform public.sync_recruitment_case_status(target_case_id, target_actor_user_id);
end
$$;

notify pgrst, 'reload schema';

commit;
