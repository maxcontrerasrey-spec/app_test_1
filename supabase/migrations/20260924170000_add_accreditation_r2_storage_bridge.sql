/*
-- EEES-DB-005: approved
-- owner: Recruitment and HR Integrations
-- rollback: forward-only; retain existing accreditation metadata and stop using the R2 bridge in the caller.

Preserves existing accreditation document RPC compatibility while allowing
Cloudflare R2 custody metadata to survive later BUK synchronization updates.
*/

begin;

-- R2 is the ERP custody layer for accreditation documents. The existing JSON
-- metadata column is used as a backwards-compatible bridge so the established
-- accreditation RPC contract and profile payload remain intact.

create or replace function public.upsert_worker_accreditation_document(
  p_buk_employee_id text,
  p_site_id uuid,
  p_requirement_id uuid,
  p_status text default 'submitted',
  p_issue_date date default null,
  p_expiry_date date default null,
  p_buk_document_id text default null,
  p_buk_document_name text default null,
  p_buk_document_url text default null,
  p_reviewer_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  resolved_worker_accreditation_id uuid;
  saved_id uuid;
  normalized_status text := lower(trim(coalesce(p_status, 'submitted')));
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para registrar documentos de acreditacion';
  end if;

  if normalized_status not in ('pending', 'submitted', 'approved', 'rejected', 'expired') then
    raise exception 'Estado documental invalido para acreditacion';
  end if;

  resolved_worker_accreditation_id := public.generate_worker_requirements(p_buk_employee_id, p_site_id, false);

  insert into public.worker_document_tracking (
    worker_accreditation_id,
    employee_buk_employee_id,
    site_id,
    requirement_id,
    status,
    issue_date,
    expiry_date,
    buk_document_id,
    buk_document_name,
    buk_document_url,
    uploaded_at,
    uploaded_by,
    reviewed_at,
    reviewed_by,
    reviewer_notes,
    metadata
  )
  values (
    resolved_worker_accreditation_id,
    trim(coalesce(p_buk_employee_id, '')),
    p_site_id,
    p_requirement_id,
    normalized_status,
    p_issue_date,
    p_expiry_date,
    nullif(trim(coalesce(p_buk_document_id, '')), ''),
    nullif(trim(coalesce(p_buk_document_name, '')), ''),
    nullif(trim(coalesce(p_buk_document_url, '')), ''),
    timezone('utc', now()),
    current_user_id,
    case when normalized_status in ('approved', 'rejected') then timezone('utc', now()) else null end,
    case when normalized_status in ('approved', 'rejected') then current_user_id else null end,
    nullif(trim(coalesce(p_reviewer_notes, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (worker_accreditation_id, requirement_id) do update
  set
    status = excluded.status,
    issue_date = excluded.issue_date,
    expiry_date = excluded.expiry_date,
    buk_document_id = coalesce(excluded.buk_document_id, worker_document_tracking.buk_document_id),
    buk_document_name = coalesce(excluded.buk_document_name, worker_document_tracking.buk_document_name),
    buk_document_url = coalesce(excluded.buk_document_url, worker_document_tracking.buk_document_url),
    uploaded_at = excluded.uploaded_at,
    uploaded_by = excluded.uploaded_by,
    reviewed_at = excluded.reviewed_at,
    reviewed_by = excluded.reviewed_by,
    reviewer_notes = excluded.reviewer_notes,
    metadata = coalesce(worker_document_tracking.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb),
    updated_at = timezone('utc', now())
  returning id into saved_id;

  perform public.log_accreditation_event(
    resolved_worker_accreditation_id,
    saved_id,
    p_site_id,
    trim(coalesce(p_buk_employee_id, '')),
    'document_upserted',
    'Documento de acreditacion registrado o actualizado',
    jsonb_build_object(
      'requirement_id', p_requirement_id,
      'status', normalized_status,
      'buk_document_id', nullif(trim(coalesce(p_buk_document_id, '')), ''),
      'buk_document_name', nullif(trim(coalesce(p_buk_document_name, '')), '')
    )
  );

  perform public.recalculate_accreditation_status(p_buk_employee_id, p_site_id);
  return saved_id;
end;
$function$;

revoke all on function public.upsert_worker_accreditation_document(text, uuid, uuid, text, date, date, text, text, text, text, jsonb) from public, anon;
grant execute on function public.upsert_worker_accreditation_document(text, uuid, uuid, text, date, date, text, text, text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
