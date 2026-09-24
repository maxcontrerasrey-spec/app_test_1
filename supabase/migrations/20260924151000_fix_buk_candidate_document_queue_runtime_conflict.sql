-- EEES-DB-005: approved
-- owner: Recruitment and HR Integrations
-- rollback: forward-only; preserve queue history and disable workers before any rollback plan.

begin;

-- The output column source_document_id is also a PL/pgSQL variable. Use the
-- named unique constraint so the conflict target cannot be resolved ambiguously.
create or replace function public.enqueue_buk_candidate_document_jobs(
  p_buk_sync_job_id uuid,
  p_buk_employee_id text,
  p_existing_documents jsonb default '[]'::jsonb
)
returns table (
  job_id uuid,
  source_document_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  source_job public.buk_sync_jobs%rowtype;
  document_item jsonb;
  uploaded_item jsonb;
  v_source_document_id uuid;
  queued_document_id uuid;
  normalized_employee_id text := nullif(trim(coalesce(p_buk_employee_id, '')), '');
begin
  if normalized_employee_id is null then
    raise exception 'La ficha BUK es obligatoria para encolar documentos';
  end if;

  select * into source_job
    from public.buk_sync_jobs
   where id = p_buk_sync_job_id
   for update;

  if source_job.id is null then
    raise exception 'No existe el job BUK para encolar documentos';
  end if;

  for document_item in
    select value
      from jsonb_array_elements(coalesce(source_job.payload_snapshot -> 'documents', '[]'::jsonb))
  loop
    v_source_document_id := nullif(document_item ->> 'id', '')::uuid;
    if v_source_document_id is null
       or nullif(trim(coalesce(document_item ->> 'file_path', '')), '') is null then
      continue;
    end if;

    select value into uploaded_item
      from jsonb_array_elements(
        case
          when jsonb_typeof(coalesce(p_existing_documents, '[]'::jsonb)) = 'array'
            and jsonb_array_length(
              case
                when jsonb_typeof(coalesce(p_existing_documents, '[]'::jsonb)) = 'array'
                  then coalesce(p_existing_documents, '[]'::jsonb)
                else '[]'::jsonb
              end
            ) > 0
            then p_existing_documents
          else coalesce(source_job.result_snapshot -> 'documents', '[]'::jsonb)
        end
      )
     where value ->> 'sourceDocumentId' = v_source_document_id::text
     limit 1;

    insert into public.buk_candidate_document_jobs (
      buk_sync_job_id,
      recruitment_case_candidate_id,
      candidate_profile_id,
      buk_employee_id,
      source_document_id,
      source_document_name,
      source_file_path,
      status,
      next_attempt_at,
      buk_document_id,
      buk_document_url,
      buk_employee_folder_id,
      buk_document_name,
      transport,
      response_snapshot,
      finished_at
    )
    values (
      source_job.id,
      source_job.recruitment_case_candidate_id,
      (source_job.payload_snapshot -> 'candidate' ->> 'candidate_profile_id')::uuid,
      normalized_employee_id,
      v_source_document_id,
      coalesce(nullif(trim(document_item ->> 'document_name'), ''), v_source_document_id::text),
      nullif(trim(document_item ->> 'file_path'), ''),
      case when uploaded_item is null then 'pending' else 'success' end,
      case when uploaded_item is null then timezone('utc', now()) else null end,
      nullif(trim(uploaded_item ->> 'bukDocumentId'), ''),
      nullif(trim(uploaded_item ->> 'bukDocumentUrl'), ''),
      nullif(trim(uploaded_item ->> 'bukEmployeeFolderId'), ''),
      nullif(trim(uploaded_item ->> 'bukDocumentName'), ''),
      nullif(trim(uploaded_item ->> 'transport'), ''),
      coalesce(uploaded_item -> 'response', '{}'::jsonb),
      case when uploaded_item is null then null else timezone('utc', now()) end
    )
    on conflict on constraint buk_candidate_document_jobs_buk_sync_job_id_source_document_key do update
      set buk_employee_id = excluded.buk_employee_id,
          source_document_name = excluded.source_document_name,
          source_file_path = excluded.source_file_path,
          next_attempt_at = case
            when public.buk_candidate_document_jobs.status = 'success' then public.buk_candidate_document_jobs.next_attempt_at
            else timezone('utc', now())
          end
     where public.buk_candidate_document_jobs.status <> 'success';

    select document_job.id, document_job.status
      into queued_document_id, status
      from public.buk_candidate_document_jobs document_job
     where document_job.buk_sync_job_id = source_job.id
       and document_job.source_document_id = v_source_document_id;

    job_id := queued_document_id;
    source_document_id := v_source_document_id;
    return next;
  end loop;
end;
$function$;

revoke all on function public.enqueue_buk_candidate_document_jobs(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.enqueue_buk_candidate_document_jobs(uuid, text, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
