begin;

do $$
declare
  candidate_record record;
  document_record record;
  actor_user_id uuid;
begin
  select
    rcc.id as case_candidate_id,
    rcc.recruitment_case_id,
    rcc.candidate_profile_id,
    rcc.document_validation_status,
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
    raise notice 'Hector Villagra candidate was not found; skipping document repair.';
    return;
  end if;

  select cd.*
  into document_record
  from public.candidate_documents cd
  join public.document_types dt
    on dt.id = cd.document_type_id
  where cd.recruitment_case_id = candidate_record.recruitment_case_id
    and cd.candidate_profile_id = candidate_record.candidate_profile_id
    and lower(dt.name) = lower('Cédula de identidad')
  limit 1;

  if document_record.id is null then
    raise notice 'Hector Villagra identity document row was not found; skipping document repair.';
    return;
  end if;

  if document_record.file_path is not null
     and not exists (
       select 1
       from storage.objects so
       where so.bucket_id = 'candidate-docs'
         and so.name = document_record.file_path
     ) then
    select coalesce(bsj.requested_by, rcc.created_by)
    into actor_user_id
    from public.recruitment_case_candidates rcc
    left join public.buk_sync_jobs bsj
      on bsj.recruitment_case_candidate_id = rcc.id
    where rcc.id = candidate_record.case_candidate_id
    order by bsj.created_at desc nulls last
    limit 1;

    update public.candidate_documents cd
       set status = 'pending',
           file_path = null,
           reviewed_by = null,
           reviewed_at = null,
           reviewer_notes = 'Archivo ausente en Supabase Storage detectado durante generación BUK. Requiere nueva carga.',
           updated_at = timezone('utc', now())
     where cd.id = document_record.id;

    update public.recruitment_case_candidates rcc
       set document_validation_status = 'pending',
           document_validated_by = null,
           document_validated_at = null,
           document_validation_comment = 'Cédula de identidad requiere nueva carga: el archivo aprobado no existe en Storage.',
           updated_at = timezone('utc', now())
     where rcc.id = candidate_record.case_candidate_id;

    update public.buk_sync_jobs bsj
       set status = 'error',
           error_message = 'No es posible generar en BUK: Cédula de identidad no existe en Storage. Vuelve a cargar y aprobar el documento.',
           result_snapshot = jsonb_set(
             coalesce(bsj.result_snapshot, '{}'::jsonb),
             '{error}',
             to_jsonb('No es posible generar en BUK: Cédula de identidad no existe en Storage. Vuelve a cargar y aprobar el documento.'::text),
             true
           ),
           finished_at = coalesce(bsj.finished_at, timezone('utc', now())),
           updated_at = timezone('utc', now())
     where bsj.recruitment_case_candidate_id = candidate_record.case_candidate_id
       and bsj.buk_employee_id is null
       and bsj.status in ('pending', 'processing', 'error');

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
        'document_validation_status', candidate_record.document_validation_status,
        'document_status', document_record.status,
        'file_path', document_record.file_path
      ),
      jsonb_build_object(
        'document_validation_status', 'pending',
        'document_status', 'pending',
        'file_path', null
      ),
      jsonb_build_object(
        'source', 'guard_buk_sync_missing_candidate_document_files',
        'reason', 'approved_document_missing_storage_object',
        'document_id', document_record.id,
        'document_name', 'Cédula de identidad'
      )
    );
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
