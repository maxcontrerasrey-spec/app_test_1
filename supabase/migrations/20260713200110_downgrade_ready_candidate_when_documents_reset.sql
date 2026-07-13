begin;

create or replace function public.reset_candidate_document_validation(
  p_case_candidate_id uuid,
  p_actor_user_id uuid default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  candidate_record public.recruitment_case_candidates%rowtype;
  had_approved_validation boolean := false;
  effective_actor_user_id uuid;
  next_case_status text;
begin
  if p_case_candidate_id is null then
    return;
  end if;

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    return;
  end if;

  had_approved_validation := candidate_record.document_validation_status = 'approved';
  effective_actor_user_id := coalesce(p_actor_user_id, candidate_record.created_by);

  if candidate_record.stage_code in ('hired', 'rejected', 'withdrawn') then
    return;
  end if;

  if candidate_record.document_validation_status = 'pending'
     and candidate_record.document_validated_by is null
     and candidate_record.document_validated_at is null
     and candidate_record.document_validation_comment is null
     and candidate_record.stage_code <> 'ready_for_hire' then
    return;
  end if;

  update public.recruitment_case_candidates
  set
    document_validation_status = 'pending',
    document_validated_by = null,
    document_validated_at = null,
    document_validation_comment = null,
    stage_code = case
      when candidate_record.stage_code = 'ready_for_hire' then 'document_review'
      else stage_code
    end,
    stage_entered_at = case
      when candidate_record.stage_code = 'ready_for_hire' then timezone('utc', now())
      else stage_entered_at
    end,
    updated_at = timezone('utc', now())
  where id = candidate_record.id;

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
      effective_actor_user_id,
      'document_validation_reset',
      coalesce(p_reason, 'candidate_document_changed')
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
      effective_actor_user_id,
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
        'reason_code', 'document_validation_reset',
        'reason', p_reason
      )
    );
  end if;

  if had_approved_validation and effective_actor_user_id is not null then
    insert into public.recruitment_case_audit_log (
      recruitment_case_id,
      recruitment_case_candidate_id,
      actor_user_id,
      action_type,
      metadata
    )
    values (
      candidate_record.recruitment_case_id,
      candidate_record.id,
      effective_actor_user_id,
      'candidate_document_validation_reset',
      jsonb_build_object(
        'reason', p_reason,
        'previous_status', 'approved'
      )
    );
  end if;

  next_case_status := public.sync_recruitment_case_status(
    candidate_record.recruitment_case_id,
    effective_actor_user_id
  );
end;
$function$;

do $$
declare
  candidate_record record;
  afp_document_record record;
  actor_user_id uuid;
begin
  select
    rcc.id as case_candidate_id,
    rcc.recruitment_case_id,
    rcc.candidate_profile_id,
    rcc.stage_code,
    rcc.document_validation_status,
    rcc.created_by,
    cp.full_name,
    cp.national_id
  into candidate_record
  from public.recruitment_case_candidates rcc
  join public.candidate_profiles cp
    on cp.id = rcc.candidate_profile_id
  where cp.national_id = '102291379'
    and lower(cp.full_name) = lower('Héctor Guillermo Villagra Feris')
  order by rcc.created_at desc
  limit 1;

  if candidate_record.case_candidate_id is null then
    raise notice 'Hector Villagra candidate was not found; skipping stage and AFP repair.';
    return;
  end if;

  select coalesce(bsj.requested_by, candidate_record.created_by)
    into actor_user_id
    from public.buk_sync_jobs bsj
   where bsj.recruitment_case_candidate_id = candidate_record.case_candidate_id
   order by bsj.created_at desc
   limit 1;

  actor_user_id := coalesce(actor_user_id, candidate_record.created_by);

  if candidate_record.stage_code = 'ready_for_hire'
     and candidate_record.document_validation_status <> 'approved' then
    update public.recruitment_case_candidates rcc
       set stage_code = 'document_review',
           stage_entered_at = timezone('utc', now()),
           updated_at = timezone('utc', now())
     where rcc.id = candidate_record.case_candidate_id;

    insert into public.recruitment_case_candidate_stage_history (
      recruitment_case_candidate_id,
      from_stage,
      to_stage,
      changed_by,
      reason_code,
      comment
    )
    values (
      candidate_record.case_candidate_id,
      'ready_for_hire',
      'document_review',
      actor_user_id,
      'document_validation_reset',
      'Candidato removido de Listo para contratar por documentación pendiente.'
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
      candidate_record.case_candidate_id,
      actor_user_id,
      'candidate_stage_changed',
      jsonb_build_object(
        'stage_code', 'ready_for_hire',
        'document_validation_status', candidate_record.document_validation_status
      ),
      jsonb_build_object(
        'stage_code', 'document_review',
        'document_validation_status', candidate_record.document_validation_status
      ),
      jsonb_build_object(
        'source', 'downgrade_ready_candidate_when_documents_reset',
        'reason', 'ready_for_hire_requires_approved_documents'
      )
    );
  end if;

  select cd.*
    into afp_document_record
    from public.candidate_documents cd
    join public.document_types dt
      on dt.id = cd.document_type_id
   where cd.recruitment_case_id = candidate_record.recruitment_case_id
     and cd.candidate_profile_id = candidate_record.candidate_profile_id
     and lower(dt.name) = lower('Certificado de AFP')
   order by cd.created_at desc
   limit 1;

  if afp_document_record.id is not null then
    delete from public.candidate_documents cd
     where cd.id = afp_document_record.id;

    update public.recruitment_case_candidates rcc
       set document_validation_status = 'pending',
           document_validation_comment = coalesce(
             rcc.document_validation_comment,
             'Cédula de identidad requiere nueva carga: el archivo aprobado no existe en Storage.'
           ),
           updated_at = timezone('utc', now())
     where rcc.id = candidate_record.case_candidate_id;

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
      candidate_record.case_candidate_id,
      actor_user_id,
      'candidate_document_validation_reset',
      jsonb_build_object(
        'document_id', afp_document_record.id,
        'document_name', 'Certificado de AFP',
        'document_status', afp_document_record.status,
        'file_path', afp_document_record.file_path
      ),
      jsonb_build_object(
        'document_removed', true
      ),
      jsonb_build_object(
        'source', 'downgrade_ready_candidate_when_documents_reset',
        'reason', 'incorrect_afp_document_removed'
      )
    );
  end if;

  perform public.sync_recruitment_case_status(candidate_record.recruitment_case_id, actor_user_id);
end $$;

notify pgrst, 'reload schema';

commit;
