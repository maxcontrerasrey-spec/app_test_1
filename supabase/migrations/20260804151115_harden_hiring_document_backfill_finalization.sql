begin;

create or replace function public.finalize_recruitment_hiring_document_buk_success(
  p_document_id uuid,
  p_buk_sync_job_id uuid,
  p_buk_employee_id text,
  p_checkpoint jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  document_record public.recruitment_hiring_documents%rowtype;
  normalized_employee_id text := nullif(trim(coalesce(p_buk_employee_id, '')), '');
  uploaded_at timestamptz;
begin
  if normalized_employee_id is null then
    raise exception 'La ficha BUK es obligatoria para cerrar la Solicitud';
  end if;

  select * into document_record
  from public.recruitment_hiring_documents rhd
  where rhd.id = p_document_id
  for update;

  if document_record.id is null then
    raise exception 'No existe la Solicitud de Contratación';
  end if;

  if document_record.buk_sync_job_id is distinct from p_buk_sync_job_id then
    raise exception 'El job BUK no coincide con la Solicitud de Contratación';
  end if;

  if document_record.buk_upload_status = 'success' then
    if document_record.buk_employee_id is distinct from normalized_employee_id then
      raise exception 'La Solicitud ya está asociada a otra ficha BUK';
    end if;
    return to_jsonb(document_record);
  end if;

  if document_record.buk_upload_status <> 'processing' then
    raise exception 'La Solicitud no posee un claim BUK activo';
  end if;

  uploaded_at := coalesce(
    nullif(p_checkpoint ->> 'bukUploadedAt', '')::timestamptz,
    timezone('utc', now())
  );

  update public.recruitment_hiring_documents
  set buk_employee_id = normalized_employee_id,
      buk_folder_id = nullif(p_checkpoint ->> 'bukEmployeeFolderId', ''),
      buk_document_id = nullif(p_checkpoint ->> 'bukDocumentId', ''),
      buk_document_url = nullif(p_checkpoint ->> 'bukDocumentUrl', ''),
      buk_document_name = coalesce(
        nullif(p_checkpoint ->> 'bukDocumentName', ''),
        document_record.buk_document_name
      ),
      buk_upload_status = 'success',
      buk_uploaded_at = uploaded_at,
      buk_last_error = null,
      source_snapshot = jsonb_build_object(
        'snapshot_version', document_record.snapshot_version,
        'purged', true,
        'original_sha256', document_record.source_snapshot_sha256
      ),
      source_snapshot_purged_at = uploaded_at
  where id = document_record.id
  returning * into document_record;

  insert into public.recruitment_hiring_document_audit_log (
    document_id,
    buk_sync_job_id,
    event_type,
    event_summary,
    payload,
    actor_id
  ) values (
    document_record.id,
    p_buk_sync_job_id,
    'buk_uploaded',
    'Solicitud de Contratación generada y cargada en BUK',
    jsonb_build_object(
      'folio', document_record.folio,
      'pdf_sha256', document_record.pdf_sha256,
      'buk_document_id', document_record.buk_document_id,
      'buk_folder_id', document_record.buk_folder_id,
      'transport', p_checkpoint ->> 'transport',
      'origin', coalesce(p_checkpoint ->> 'origin', 'generate_in_buk')
    ),
    document_record.generated_by
  );

  return to_jsonb(document_record);
end;
$function$;

alter table public.recruitment_hiring_documents
  drop constraint if exists recruitment_hiring_documents_success_snapshot_purged_check;
alter table public.recruitment_hiring_documents
  add constraint recruitment_hiring_documents_success_snapshot_purged_check
  check (
    buk_upload_status <> 'success'
    or (
      source_snapshot_purged_at is not null
      and source_snapshot ->> 'purged' = 'true'
    )
  );

revoke all on function public.finalize_recruitment_hiring_document_buk_success(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_recruitment_hiring_document_buk_success(uuid, uuid, text, jsonb)
  to service_role;

revoke all on sequence public.recruitment_hiring_document_audit_log_id_seq
  from public, anon, authenticated;
grant usage, select on sequence public.recruitment_hiring_document_audit_log_id_seq
  to service_role;

notify pgrst, 'reload schema';

commit;
