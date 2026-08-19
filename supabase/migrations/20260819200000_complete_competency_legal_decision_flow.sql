begin;

alter table public.competency_certificates
  drop constraint if exists competency_certificates_certificate_status_check;
alter table public.competency_certificates
  add constraint competency_certificates_certificate_status_check
  check (certificate_status in ('not_generated', 'queued', 'generating', 'generated', 'generation_failed', 'uploaded_to_buk', 'buk_upload_failed', 'revoked', 'rejected', 'expired', 'replaced', 'annulled'));

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
      certificate_status = case when normalized_decision = 'rejected' then 'rejected' else certificate_status end,
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
    'certificate_status', case when normalized_decision = 'rejected' then 'rejected' else certificate_record.certificate_status end
  );
end;
$function$;

notify pgrst, 'reload schema';

commit;
