begin;

alter table public.candidate_document_cleanup_jobs
  drop constraint if exists candidate_document_cleanup_jobs_terminal_stage_check;

alter table public.candidate_document_cleanup_jobs
  add constraint candidate_document_cleanup_jobs_terminal_stage_check
  check (terminal_stage in ('rejected', 'withdrawn', 'hired'));

create or replace function public.finalize_buk_sync_job_success(
  p_job_id uuid,
  p_buk_employee_id text,
  p_result_snapshot jsonb default '{}'::jsonb
)
returns table (
  recruitment_case_candidate_id uuid,
  recruitment_case_id uuid,
  case_status text,
  stage_code text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  job_record public.buk_sync_jobs%rowtype;
  candidate_record public.recruitment_case_candidates%rowtype;
  actor_user_id uuid := null;
  next_case_status text := null;
  now_utc timestamptz := timezone('utc', now());
  uploaded_document_ids text[] := '{}';
  all_file_documents_uploaded boolean := false;
begin
  select *
    into job_record
    from public.buk_sync_jobs bsj
   where bsj.id = p_job_id
   for update;

  if job_record.id is null then
    raise exception 'No existe el job BUK';
  end if;

  if nullif(trim(coalesce(p_buk_employee_id, '')), '') is null then
    raise exception 'Debe indicar el identificador del empleado generado en BUK';
  end if;

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = job_record.recruitment_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'No existe el candidato asociado al job BUK';
  end if;

  actor_user_id := job_record.requested_by;

  update public.buk_sync_jobs bsj
     set status = 'success',
         buk_employee_id = trim(p_buk_employee_id),
         result_snapshot = coalesce(p_result_snapshot, '{}'::jsonb),
         error_message = null,
         finished_at = now_utc
   where bsj.id = job_record.id;

  if candidate_record.stage_code not in ('ready_for_hire', 'hired') then
    raise exception 'El candidato asociado al job BUK ya no se encuentra en una etapa contratable';
  end if;

  if candidate_record.stage_code <> 'hired' then
    update public.recruitment_case_candidates rcc
       set stage_code = 'hired',
           stage_entered_at = now_utc,
           hired_at = coalesce(rcc.hired_at, now_utc),
           updated_at = now_utc
     where rcc.id = candidate_record.id;

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
      candidate_record.stage_code,
      'hired',
      actor_user_id,
      'buk_sync_success',
      'Contratación confirmada tras generación exitosa en BUK'
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
      actor_user_id,
      'candidate_hired',
      jsonb_build_object(
        'stage_code', candidate_record.stage_code
      ),
      jsonb_build_object(
        'stage_code', 'hired',
        'hired_at', now_utc
      ),
      jsonb_build_object(
        'buk_sync_job_id', job_record.id,
        'buk_employee_id', trim(p_buk_employee_id)
      )
    );
  end if;

  select coalesce(array_agg(nullif(trim(document_entry->>'sourceDocumentId'), '')), '{}')
    into uploaded_document_ids
    from jsonb_array_elements(coalesce(p_result_snapshot->'documents', '[]'::jsonb)) as document_entry
   where nullif(trim(document_entry->>'sourceDocumentId'), '') is not null;

  select
    exists (
      select 1
        from public.candidate_documents cd
       where cd.recruitment_case_id = candidate_record.recruitment_case_id
         and cd.candidate_profile_id = candidate_record.candidate_profile_id
    )
    and not exists (
      select 1
        from public.candidate_documents cd
       where cd.recruitment_case_id = candidate_record.recruitment_case_id
         and cd.candidate_profile_id = candidate_record.candidate_profile_id
         and nullif(trim(coalesce(cd.file_path, '')), '') is not null
         and cd.id::text <> all(uploaded_document_ids)
    )
    and cardinality(uploaded_document_ids) > 0
    into all_file_documents_uploaded;

  if actor_user_id is not null
     and all_file_documents_uploaded
     and not exists (
       select 1
         from public.candidate_document_cleanup_jobs cdcj
        where cdcj.recruitment_case_candidate_id = candidate_record.id
          and cdcj.status in ('pending', 'processing')
     ) then
    insert into public.candidate_document_cleanup_jobs (
      recruitment_case_candidate_id,
      recruitment_case_id,
      candidate_profile_id,
      terminal_stage,
      requested_by,
      status,
      result_snapshot
    )
    values (
      candidate_record.id,
      candidate_record.recruitment_case_id,
      candidate_record.candidate_profile_id,
      'hired',
      actor_user_id,
      'pending',
      jsonb_build_object(
        'queued_at', now_utc,
        'queued_stage', 'hired',
        'queued_by_system', true,
        'source', 'finalize_buk_sync_job_success',
        'buk_sync_job_id', job_record.id,
        'buk_employee_id', trim(p_buk_employee_id),
        'uploaded_document_ids', uploaded_document_ids
      )
    );
  end if;

  next_case_status := public.sync_recruitment_case_status(
    candidate_record.recruitment_case_id,
    actor_user_id
  );

  return query
  select
    candidate_record.id,
    candidate_record.recruitment_case_id,
    next_case_status,
    'hired'::text;
end;
$function$;

revoke all on function public.finalize_buk_sync_job_success(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.finalize_buk_sync_job_success(uuid, text, jsonb)
to service_role;

notify pgrst, 'reload schema';

commit;
