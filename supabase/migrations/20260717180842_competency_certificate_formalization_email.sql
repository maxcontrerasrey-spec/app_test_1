begin;

alter table public.transactional_email_dispatches
  drop constraint if exists transactional_email_dispatches_event_type_check;

alter table public.transactional_email_dispatches
  add constraint transactional_email_dispatches_event_type_check
  check (
    event_type in (
      'pending_approval',
      'recruitment_handoff',
      'who_approval',
      'rejection',
      'personnel_to_hire',
      'competency_formalization'
    )
  );

create or replace function public.enqueue_competency_certificate_formalization_email(
  p_certificate_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  certificate_record record;
  recipients jsonb := '[]'::jsonb;
  event_key text;
begin
  select
    cc.id as certificate_id,
    cc.folio,
    cc.verification_token,
    cc.template_code,
    cc.template_version,
    cc.valid_from,
    cc.valid_until,
    cc.issued_at,
    cc.buk_document_url,
    cc.buk_document_name,
    cc.buk_uploaded_at,
    cr.id as request_id,
    cr.worker_full_name,
    cr.worker_document_number,
    cr.worker_job_title,
    cr.worker_area_name,
    cr.worker_contract_code,
    cr.training_date,
    cr.model_summary,
    ci.full_name as instructor_name,
    instructor_profile.email as instructor_email
  into certificate_record
  from public.competency_certificates cc
  join public.competency_requests cr
    on cr.id = cc.request_id
  join public.competency_instructors ci
    on ci.id = cr.instructor_id
  left join public.profiles instructor_profile
    on instructor_profile.id = ci.user_id
  where cc.id = p_certificate_id
    and cc.certificate_status = 'uploaded_to_buk'
    and cc.buk_upload_status = 'success'
    and cc.buk_uploaded_at is not null
    and cc.competency_status = 'enabled'
  limit 1;

  if certificate_record.certificate_id is null then
    return;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'email', notification_recipient.email,
        'name', notification_recipient.name
      )
      order by notification_recipient.name, notification_recipient.email
    ),
    '[]'::jsonb
  )
  into recipients
  from (
    select distinct
      lower(trim(recipient.email)) as email,
      coalesce(nullif(trim(recipient.name), ''), lower(trim(recipient.email))) as name
    from (
      select
        certificate_record.instructor_email as email,
        certificate_record.instructor_name as name
      union all
      select
        p.email,
        p.full_name
      from public.profiles p
      join public.user_roles ur
        on ur.user_id = p.id
      where ur.role_code in ('admin', 'certificaciones')
        and p.status = 'active'
    ) recipient
    where nullif(trim(coalesce(recipient.email, '')), '') is not null
  ) as notification_recipient;

  if recipients = '[]'::jsonb then
    return;
  end if;

  event_key := format('competency-formalization:%s', certificate_record.certificate_id);

  perform public.queue_transactional_email_notification(
    event_key,
    'competency_formalization',
    jsonb_build_object(
      'kind', 'competency_formalization',
      'event_key', event_key,
      'to', recipients,
      'certificate', jsonb_build_object(
        'id', certificate_record.certificate_id,
        'folio', certificate_record.folio,
        'verification_token', certificate_record.verification_token,
        'template_code', certificate_record.template_code,
        'template_version', certificate_record.template_version,
        'valid_from', certificate_record.valid_from,
        'valid_until', certificate_record.valid_until,
        'issued_at', certificate_record.issued_at,
        'buk_document_url', certificate_record.buk_document_url,
        'buk_document_name', certificate_record.buk_document_name,
        'buk_uploaded_at', certificate_record.buk_uploaded_at
      ),
      'worker', jsonb_build_object(
        'full_name', certificate_record.worker_full_name,
        'document_number', certificate_record.worker_document_number,
        'job_title', certificate_record.worker_job_title,
        'area_name', certificate_record.worker_area_name,
        'contract_code', certificate_record.worker_contract_code
      ),
      'training', jsonb_build_object(
        'training_date', certificate_record.training_date,
        'model_summary', certificate_record.model_summary
      ),
      'instructor', jsonb_build_object(
        'full_name', certificate_record.instructor_name
      ),
      'route', format('/verificar/competencia/%s', certificate_record.verification_token)
    )
  );
end;
$function$;

create or replace function public.trg_fn_competency_certificate_formalization()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.certificate_status = 'uploaded_to_buk'
     and new.buk_upload_status = 'success'
     and new.buk_uploaded_at is not null
     and new.competency_status = 'enabled'
     and (
       old.certificate_status is distinct from new.certificate_status
       or old.buk_upload_status is distinct from new.buk_upload_status
       or old.buk_uploaded_at is distinct from new.buk_uploaded_at
     ) then
    perform public.enqueue_competency_certificate_formalization_email(new.id);
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_competency_certificate_formalization on public.competency_certificates;
create trigger trg_competency_certificate_formalization
  after update on public.competency_certificates
  for each row
  execute function public.trg_fn_competency_certificate_formalization();

revoke all on function public.enqueue_competency_certificate_formalization_email(uuid)
  from public, anon, authenticated;
revoke all on function public.trg_fn_competency_certificate_formalization()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
