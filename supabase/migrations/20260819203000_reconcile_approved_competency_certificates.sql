begin;

create or replace function public.decide_competency_legal_approval(
  certificate_id_input uuid,
  decision_input text,
  rejection_reason_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  certificate_record record;
  normalized_decision text := lower(trim(coalesce(decision_input, '')));
begin
  if normalized_decision not in ('approved', 'rejected') then
    raise exception 'Decision legal invalida';
  end if;

  select cc.*, cls.full_name as signer_name
    into certificate_record
  from public.competency_certificates cc
  join public.competency_legal_signers cls on cls.id = cc.legal_signer_id
  where cc.id = certificate_id_input
    and cc.legal_signature_required = true
  for update;

  if certificate_record.id is null then
    raise exception 'Certificado no requiere aprobacion legal';
  end if;
  if not public.user_can_approve_competency_legal_signature(certificate_record.legal_signer_id) then
    raise exception 'Solo el Representante Legal asignado o un administrador puede decidir esta aprobacion';
  end if;
  if certificate_record.legal_approval_status <> 'pending' then
    raise exception 'La aprobacion legal ya fue resuelta';
  end if;
  if normalized_decision = 'rejected' and nullif(trim(coalesce(rejection_reason_input, '')), '') is null then
    raise exception 'Debes indicar el motivo del rechazo legal';
  end if;

  update public.competency_certificates
  set legal_approval_status = normalized_decision,
      certificate_status = case when normalized_decision = 'approved' then 'queued' else 'rejected' end,
      competency_status = case when normalized_decision = 'rejected' then 'revoked' else competency_status end,
      legal_approved_by = current_user_id,
      legal_approved_at = timezone('utc', now()),
      legal_rejection_reason = case when normalized_decision = 'rejected' then nullif(trim(rejection_reason_input), '') else null end,
      updated_at = timezone('utc', now())
  where id = certificate_id_input;

  perform public.log_competency_event(
    certificate_record.request_id,
    certificate_id_input,
    case when normalized_decision = 'approved' then 'legal_signature_approved' else 'legal_signature_rejected' end,
    case when normalized_decision = 'approved' then 'Firma legal aprobada' else 'Firma legal rechazada' end,
    jsonb_build_object('decision', normalized_decision, 'signer_name', certificate_record.signer_name, 'reason', rejection_reason_input)
  );

  return jsonb_build_object(
    'certificate_id', certificate_id_input,
    'request_id', certificate_record.request_id,
    'status', normalized_decision,
    'certificate_status', case when normalized_decision = 'approved' then 'queued' else 'rejected' end
  );
end;
$function$;

create or replace function public.get_competency_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  can_admin boolean := false;
begin
  if not public.user_can_access_competencies(current_user_id) then
    raise exception 'Sin permisos para ver certificaciones de competencias';
  end if;
  can_admin := public.user_can_admin_competencies(current_user_id);
  return jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'total', count(*),
        'generated', count(*) filter (where cc.certificate_status in ('generated', 'uploaded_to_buk')),
        'pending_buk', count(*) filter (where cc.buk_upload_status in ('pending', 'queued', 'failed')),
        'failed', count(*) filter (where cc.certificate_status = 'generation_failed' or cc.buk_upload_status = 'failed'),
        'expiring_30', count(*) filter (where cc.valid_until between current_date and current_date + interval '30 days'),
        'expired', count(*) filter (where cc.valid_until < current_date)
      )
      from public.competency_requests cr
      join public.competency_certificates cc on cc.request_id = cr.id
      join public.competency_instructors ci on ci.id = cr.instructor_id
      where can_admin or cr.created_by = current_user_id or ci.user_id = current_user_id
    ),
    'recent', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'request_id', cr.id,
        'certificate_id', cc.id,
        'folio', cc.folio,
        'worker_full_name', cr.worker_full_name,
        'worker_document_number', cr.worker_document_number,
        'worker_buk_employee_id', cr.worker_buk_employee_id,
        'instructor_name', ci.full_name,
        'model_summary', cr.model_summary,
        'certificate_status', cc.certificate_status,
        'competency_status', cc.competency_status,
        'legal_approval_status', cc.legal_approval_status,
        'buk_upload_status', cc.buk_upload_status,
        'issued_at', cc.issued_at,
        'valid_until', cc.valid_until,
        'pdf_path', cc.pdf_path,
        'created_at', cr.created_at
      ) order by cr.created_at desc), '[]'::jsonb)
      from (
        select cr.*
        from public.competency_requests cr
        join public.competency_instructors ci on ci.id = cr.instructor_id
        where can_admin or cr.created_by = current_user_id or ci.user_id = current_user_id
        order by cr.created_at desc
        limit 50
      ) cr
      join public.competency_instructors ci on ci.id = cr.instructor_id
      join public.competency_certificates cc on cc.request_id = cr.id
    )
  );
end;
$function$;

notify pgrst, 'reload schema';
commit;
