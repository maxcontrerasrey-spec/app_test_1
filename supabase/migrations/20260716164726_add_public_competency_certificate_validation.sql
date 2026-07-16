begin;

alter table public.competency_certificates
  add column if not exists public_validation_payload jsonb not null default '{}'::jsonb,
  add column if not exists public_validation_updated_at timestamptz;

alter table public.competency_certificates
  drop constraint if exists competency_certificates_public_validation_payload_object;

alter table public.competency_certificates
  add constraint competency_certificates_public_validation_payload_object
  check (jsonb_typeof(public_validation_payload) = 'object');

create index if not exists idx_competency_certificates_public_folio_lookup
  on public.competency_certificates (upper(folio));

create or replace function public.build_competency_certificate_public_snapshot(certificate_id_input uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  snapshot jsonb;
begin
  if certificate_id_input is null then
    return '{}'::jsonb;
  end if;

  select jsonb_build_object(
    'certificate', jsonb_build_object(
      'folio', cc.folio,
      'template_code', cc.template_code,
      'template_version', cc.template_version,
      'certificate_status', cc.certificate_status,
      'competency_status', cc.competency_status,
      'issued_at', cc.issued_at,
      'valid_from', cc.valid_from,
      'valid_until', cc.valid_until,
      'pdf_sha256', cc.pdf_sha256,
      'buk_registered', cc.buk_upload_status = 'success' and cc.buk_uploaded_at is not null,
      'buk_uploaded_at', cc.buk_uploaded_at
    ),
    'worker', jsonb_build_object(
      'full_name', cr.worker_full_name,
      'document_number', cr.worker_document_number,
      'job_title', cr.worker_job_title
    ),
    'instructor', jsonb_build_object(
      'full_name', ci.full_name,
      'document_number', ci.document_number,
      'profile_code', ci.profile_code
    ),
    'training', jsonb_build_object(
      'training_date', cr.training_date
    ),
    'equipment', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'brand_name', ceb.name,
          'type_name', cet.name,
          'model_name', cem.name
        )
        order by ceb.name, cet.name, cem.name
      )
      from public.competency_request_models crm
      join public.competency_equipment_models cem on cem.id = crm.model_id
      join public.competency_equipment_brands ceb on ceb.id = cem.brand_id
      join public.competency_equipment_types cet on cet.id = cem.type_id
      where crm.request_id = cr.id
    ), '[]'::jsonb),
    'snapshot_version', 1
  )
  into snapshot
  from public.competency_certificates cc
  join public.competency_requests cr on cr.id = cc.request_id
  join public.competency_instructors ci on ci.id = cr.instructor_id
  where cc.id = certificate_id_input;

  return coalesce(snapshot, '{}'::jsonb);
end;
$function$;

create or replace function public.refresh_competency_certificate_public_snapshot(certificate_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  snapshot jsonb;
begin
  snapshot := public.build_competency_certificate_public_snapshot(certificate_id_input);

  if snapshot = '{}'::jsonb then
    raise exception 'Certificado no encontrado para snapshot publico';
  end if;

  update public.competency_certificates
  set public_validation_payload = snapshot,
      public_validation_updated_at = timezone('utc', now())
  where id = certificate_id_input;

  return snapshot;
end;
$function$;

create or replace function public.verify_competency_certificate(lookup_text text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  normalized_lookup text := trim(coalesce(lookup_text, ''));
  certificate_record record;
  snapshot jsonb;
  certificate_payload jsonb;
  certificate_valid_until date;
  is_current boolean := false;
  is_authentic boolean := false;
begin
  if length(normalized_lookup) < 6 or length(normalized_lookup) > 120 then
    return jsonb_build_object(
      'found', false,
      'is_authentic', false,
      'is_current', false,
      'status', 'not_found'
    );
  end if;

  select
    cc.id,
    cc.folio,
    cc.certificate_status,
    cc.competency_status,
    cc.revoked_at,
    cc.valid_until,
    cc.public_validation_payload,
    cc.public_validation_updated_at
  into certificate_record
  from public.competency_certificates cc
  where cc.verification_token::text = normalized_lookup
     or upper(cc.folio) = upper(normalized_lookup)
  limit 1;

  if certificate_record.id is null then
    return jsonb_build_object(
      'found', false,
      'is_authentic', false,
      'is_current', false,
      'status', 'not_found'
    );
  end if;

  snapshot := nullif(certificate_record.public_validation_payload, '{}'::jsonb);
  if snapshot is null then
    snapshot := public.build_competency_certificate_public_snapshot(certificate_record.id);
  end if;

  certificate_payload := coalesce(snapshot->'certificate', '{}'::jsonb);
  certificate_valid_until := coalesce(
    nullif(certificate_payload->>'valid_until', '')::date,
    certificate_record.valid_until
  );

  is_authentic := certificate_record.certificate_status in ('generated', 'uploaded_to_buk', 'buk_upload_failed', 'expired', 'revoked', 'replaced', 'annulled');
  is_current := certificate_record.certificate_status in ('generated', 'uploaded_to_buk')
    and certificate_record.competency_status = 'enabled'
    and certificate_record.revoked_at is null
    and certificate_valid_until is not null
    and certificate_valid_until >= current_date;

  return jsonb_build_object(
    'found', true,
    'is_authentic', is_authentic,
    'is_current', is_current,
    'status', case
      when certificate_record.revoked_at is not null or certificate_record.certificate_status in ('revoked', 'annulled') then 'revoked'
      when certificate_record.certificate_status = 'replaced' then 'replaced'
      when certificate_valid_until is not null and certificate_valid_until < current_date then 'expired'
      when is_current then 'valid'
      else certificate_record.certificate_status
    end,
    'verified_at', timezone('utc', now()),
    'snapshot_updated_at', certificate_record.public_validation_updated_at,
    'certificate', certificate_payload,
    'worker', coalesce(snapshot->'worker', '{}'::jsonb),
    'instructor', coalesce(snapshot->'instructor', '{}'::jsonb),
    'training', coalesce(snapshot->'training', '{}'::jsonb),
    'equipment', coalesce(snapshot->'equipment', '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.build_competency_certificate_public_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.refresh_competency_certificate_public_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.verify_competency_certificate(text) from public, anon, authenticated;

grant execute on function public.refresh_competency_certificate_public_snapshot(uuid) to service_role;
grant execute on function public.verify_competency_certificate(text) to service_role;

notify pgrst, 'reload schema';

commit;
