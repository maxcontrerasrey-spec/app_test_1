begin;

create sequence if not exists public.recruitment_hiring_document_folio_seq;

create table if not exists public.recruitment_hiring_documents (
  id uuid primary key default gen_random_uuid(),
  recruitment_case_candidate_id uuid not null references public.recruitment_case_candidates(id) on delete restrict,
  recruitment_case_id uuid not null references public.recruitment_cases(id) on delete restrict,
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete restrict,
  buk_sync_job_id uuid null references public.buk_sync_jobs(id) on delete set null,
  version_no smallint not null default 1 check (version_no > 0),
  folio text not null unique,
  verification_token uuid not null unique default gen_random_uuid(),
  template_code text not null default 'F-RH-010',
  template_version text not null default '1',
  template_date date not null default date '2018-03-12',
  document_status text not null default 'active'
    check (document_status in ('active', 'revoked', 'replaced', 'annulled')),
  generation_status text not null default 'pending'
    check (generation_status in ('pending', 'generated', 'failed')),
  source_snapshot jsonb not null check (jsonb_typeof(source_snapshot) = 'object'),
  source_snapshot_sha256 text not null check (source_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  snapshot_version smallint not null default 1 check (snapshot_version > 0),
  public_validation_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(public_validation_payload) = 'object'),
  public_validation_updated_at timestamptz null,
  pdf_file_name text null,
  pdf_sha256 text null check (pdf_sha256 is null or pdf_sha256 ~ '^[a-f0-9]{64}$'),
  pdf_size_bytes bigint null check (pdf_size_bytes is null or pdf_size_bytes > 0),
  issued_at timestamptz null,
  generated_by uuid null references public.profiles(id) on delete set null,
  validated_by uuid not null references public.profiles(id) on delete restrict,
  validated_at timestamptz not null,
  buk_employee_id text null,
  buk_folder_name text not null default 'Postulación',
  buk_folder_id text null,
  buk_document_id text null,
  buk_document_url text null,
  buk_document_name text null,
  buk_upload_status text not null default 'pending'
    check (buk_upload_status in ('pending', 'processing', 'success', 'failed', 'reconciliation_required')),
  buk_upload_attempts integer not null default 0 check (buk_upload_attempts >= 0),
  buk_upload_started_at timestamptz null,
  buk_uploaded_at timestamptz null,
  buk_last_error text null,
  revoked_at timestamptz null,
  revoked_by uuid null references public.profiles(id) on delete set null,
  revoke_reason text null,
  replaced_by_document_id uuid null references public.recruitment_hiring_documents(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint recruitment_hiring_documents_candidate_version_key
    unique (recruitment_case_candidate_id, version_no),
  constraint recruitment_hiring_documents_generated_metadata_check
    check (
      generation_status <> 'generated'
      or (
        pdf_file_name is not null
        and pdf_sha256 is not null
        and pdf_size_bytes is not null
        and issued_at is not null
      )
    ),
  constraint recruitment_hiring_documents_buk_success_check
    check (
      buk_upload_status <> 'success'
      or (
        nullif(trim(coalesce(buk_employee_id, '')), '') is not null
        and buk_uploaded_at is not null
      )
    )
);

create unique index if not exists idx_recruitment_hiring_documents_active_candidate
  on public.recruitment_hiring_documents (recruitment_case_candidate_id)
  where document_status = 'active';

create index if not exists idx_recruitment_hiring_documents_buk_status
  on public.recruitment_hiring_documents (buk_upload_status, updated_at);

drop trigger if exists trg_recruitment_hiring_documents_set_updated_at
  on public.recruitment_hiring_documents;
create trigger trg_recruitment_hiring_documents_set_updated_at
before update on public.recruitment_hiring_documents
for each row execute function public.set_updated_at();

create table if not exists public.recruitment_hiring_document_audit_log (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.recruitment_hiring_documents(id) on delete restrict,
  buk_sync_job_id uuid null references public.buk_sync_jobs(id) on delete set null,
  event_type text not null,
  event_summary text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  actor_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_recruitment_hiring_document_audit_document
  on public.recruitment_hiring_document_audit_log (document_id, created_at desc);

alter table public.recruitment_hiring_documents enable row level security;
alter table public.recruitment_hiring_document_audit_log enable row level security;

drop policy if exists recruitment_hiring_documents_no_direct_access
  on public.recruitment_hiring_documents;
create policy recruitment_hiring_documents_no_direct_access
on public.recruitment_hiring_documents
for all
to authenticated
using (false)
with check (false);

drop policy if exists recruitment_hiring_document_audit_no_direct_access
  on public.recruitment_hiring_document_audit_log;
create policy recruitment_hiring_document_audit_no_direct_access
on public.recruitment_hiring_document_audit_log
for all
to authenticated
using (false)
with check (false);

create or replace function public.mask_recruitment_hiring_document_number(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $function$
  with normalized as (
    select regexp_replace(coalesce(p_value, ''), '[^0-9Kk]', '', 'g') as value
  )
  select case
    when length(value) < 4 then '***'
    else '***.***.' || right(value, 4)
  end
  from normalized;
$function$;

create or replace function public.build_recruitment_hiring_document_snapshot(
  p_case_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  snapshot jsonb;
begin
  select jsonb_build_object(
    'snapshot_version', 1,
    'source', jsonb_build_object(
      'case_candidate_id', rcc.id,
      'recruitment_case_id', rc.id,
      'candidate_profile_id', cp.id,
      'hiring_request_id', hr.id,
      'case_code', rc.case_code,
      'request_folio', hr.folio
    ),
    'document', jsonb_build_object(
      'template_code', 'F-RH-010',
      'template_version', '1',
      'template_date', '2018-03-12',
      'ready_for_hire_at', coalesce(ready_history.ready_at, rcc.stage_entered_at)
    ),
    'requester', jsonb_build_object(
      'full_name', hr.requester_name,
      'job_title', coalesce(hr.requester_job_title, hr.requester_position)
    ),
    'worker', jsonb_build_object(
      'full_name', cp.full_name,
      'document_number', cp.national_id,
      'job_title', coalesce(hr.requested_position_name, hr.job_position_name, rc.job_position_name)
    ),
    'employment', jsonb_build_object(
      'company_name', coalesce(mapping.company_name, public.resolve_known_company_name(null::bigint, hr.contract_number), 'Buses JM'),
      'contract_name', coalesce(hr.contract_name, rc.contract_name),
      'contract_number', hr.contract_number,
      'shift_name', coalesce(cwf.shift_name, hr.shift_name),
      'entry_date', coalesce(cwf.company_entry_date, hr.requested_entry_date, rc.requested_entry_date),
      'net_salary', hr.salary_offer
    ),
    'validation', jsonb_build_object(
      'validated_by', rcc.document_validated_by,
      'validated_at', rcc.document_validated_at,
      'full_name', validator.full_name,
      'job_title', validator.job_title
    ),
    'documents', coalesce(documents.items, '[]'::jsonb)
  )
  into snapshot
  from public.recruitment_case_candidates rcc
  join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
  join public.hiring_requests hr on hr.id = rc.hiring_request_id
  join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
  join public.candidate_worker_files cwf on cwf.recruitment_case_candidate_id = rcc.id
  join public.profiles validator on validator.id = rcc.document_validated_by
  left join lateral (
    select h.created_at as ready_at
    from public.recruitment_case_candidate_stage_history h
    where h.recruitment_case_candidate_id = rcc.id
      and h.to_stage = 'ready_for_hire'
    order by h.created_at desc
    limit 1
  ) ready_history on true
  left join lateral (
    select bcm.company_name
    from public.buk_contract_mappings bcm
    where (
      bcm.contract_id = coalesce(rc.contract_id, hr.contract_id)
      or bcm.contract_number = hr.contract_number
    )
      and bcm.is_operational = true
    order by
      (bcm.contract_id = coalesce(rc.contract_id, hr.contract_id)) desc,
      bcm.is_one_to_one desc,
      bcm.id asc
    limit 1
  ) mapping on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'document_type_id', dt.id,
        'name', dt.name,
        'uploaded', cd.id is not null
          and nullif(trim(coalesce(cd.file_path, '')), '') is not null
      )
      order by dt.created_at asc, dt.name asc
    ) as items
    from public.document_types dt
    left join public.candidate_documents cd
      on cd.document_type_id = dt.id
     and cd.candidate_profile_id = rcc.candidate_profile_id
     and cd.recruitment_case_id = rcc.recruitment_case_id
    where dt.active = true
      and (
        (public.is_driver_job_position(rc.job_position_name) and dt.applies_to_driver)
        or (
          not public.is_driver_job_position(rc.job_position_name)
          and dt.applies_to_other
        )
      )
  ) documents on true
  where rcc.id = p_case_candidate_id
    and rcc.stage_code in ('ready_for_hire', 'hired')
    and rcc.document_validation_status = 'approved'
    and rcc.document_validated_by is not null
    and rcc.document_validated_at is not null;

  if snapshot is null then
    raise exception 'El candidato no cumple el contrato para generar la Solicitud de Contratación';
  end if;

  return snapshot;
end;
$function$;

create or replace function public.ensure_recruitment_hiring_document(
  p_case_candidate_id uuid,
  p_buk_sync_job_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  existing_record public.recruitment_hiring_documents%rowtype;
  candidate_record public.recruitment_case_candidates%rowtype;
  job_record public.buk_sync_jobs%rowtype;
  snapshot jsonb;
  snapshot_hash text;
  next_folio text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_case_candidate_id::text, 0));

  select * into candidate_record
  from public.recruitment_case_candidates rcc
  where rcc.id = p_case_candidate_id;

  select * into job_record
  from public.buk_sync_jobs bsj
  where bsj.id = p_buk_sync_job_id
    and bsj.recruitment_case_candidate_id = p_case_candidate_id;

  if candidate_record.id is null or job_record.id is null then
    raise exception 'No existe el candidato o job BUK asociado a la Solicitud de Contratación';
  end if;

  select * into existing_record
  from public.recruitment_hiring_documents rhd
  where rhd.recruitment_case_candidate_id = p_case_candidate_id
    and rhd.document_status = 'active'
  order by rhd.version_no desc
  limit 1
  for update;

  if existing_record.id is not null then
    if existing_record.buk_sync_job_id is distinct from p_buk_sync_job_id then
      update public.recruitment_hiring_documents
      set buk_sync_job_id = p_buk_sync_job_id
      where id = existing_record.id
      returning * into existing_record;
    end if;
    return to_jsonb(existing_record);
  end if;

  snapshot := public.build_recruitment_hiring_document_snapshot(p_case_candidate_id);
  snapshot_hash := encode(extensions.digest(convert_to(snapshot::text, 'UTF8'), 'sha256'), 'hex');
  next_folio := format(
    'SC-%s-%s',
    to_char(timezone('America/Santiago', now()), 'YYYY'),
    lpad(nextval('public.recruitment_hiring_document_folio_seq')::text, 6, '0')
  );

  insert into public.recruitment_hiring_documents (
    recruitment_case_candidate_id,
    recruitment_case_id,
    candidate_profile_id,
    buk_sync_job_id,
    folio,
    source_snapshot,
    source_snapshot_sha256,
    validated_by,
    validated_at
  ) values (
    p_case_candidate_id,
    candidate_record.recruitment_case_id,
    candidate_record.candidate_profile_id,
    p_buk_sync_job_id,
    next_folio,
    snapshot,
    snapshot_hash,
    candidate_record.document_validated_by,
    candidate_record.document_validated_at
  )
  returning * into existing_record;

  insert into public.recruitment_hiring_document_audit_log (
    document_id,
    buk_sync_job_id,
    event_type,
    event_summary,
    payload,
    actor_id
  ) values (
    existing_record.id,
    p_buk_sync_job_id,
    'snapshot_frozen',
    'Snapshot de Solicitud de Contratación reservado para generación',
    jsonb_build_object(
      'folio', existing_record.folio,
      'source_snapshot_sha256', existing_record.source_snapshot_sha256,
      'snapshot_version', existing_record.snapshot_version
    ),
    job_record.requested_by
  );

  return to_jsonb(existing_record);
end;
$function$;

create or replace function public.verify_recruitment_hiring_document(
  lookup_text text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  normalized_lookup text := trim(coalesce(lookup_text, ''));
  document_record public.recruitment_hiring_documents%rowtype;
  public_snapshot jsonb;
  is_authentic boolean := false;
  is_current boolean := false;
  live_status text := 'not_found';
begin
  if length(normalized_lookup) < 32 or length(normalized_lookup) > 40 then
    return jsonb_build_object(
      'found', false,
      'document_kind', 'hiring_request',
      'is_authentic', false,
      'is_current', false,
      'status', 'not_found'
    );
  end if;

  select * into document_record
  from public.recruitment_hiring_documents rhd
  where rhd.verification_token::text = normalized_lookup
  limit 1;

  if document_record.id is null then
    return jsonb_build_object(
      'found', false,
      'document_kind', 'hiring_request',
      'is_authentic', false,
      'is_current', false,
      'status', 'not_found'
    );
  end if;

  public_snapshot := coalesce(document_record.public_validation_payload, '{}'::jsonb);
  is_authentic := document_record.generation_status = 'generated'
    and document_record.pdf_sha256 is not null;
  is_current := is_authentic
    and document_record.document_status = 'active'
    and document_record.buk_upload_status = 'success';
  live_status := case
    when document_record.document_status in ('revoked', 'annulled') then 'revoked'
    when document_record.document_status = 'replaced' then 'replaced'
    when document_record.buk_upload_status = 'reconciliation_required' then 'reconciliation_required'
    when is_current then 'valid'
    when is_authentic then 'pending_buk'
    else 'not_generated'
  end;

  return public_snapshot || jsonb_build_object(
    'found', true,
    'document_kind', 'hiring_request',
    'is_authentic', is_authentic,
    'is_current', is_current,
    'status', live_status,
    'verified_at', timezone('utc', now()),
    'snapshot_updated_at', document_record.public_validation_updated_at,
    'document', coalesce(public_snapshot->'document', '{}'::jsonb)
      || jsonb_build_object(
        'folio', document_record.folio,
        'template_code', document_record.template_code,
        'template_version', document_record.template_version,
        'issued_at', document_record.issued_at,
        'pdf_sha256', document_record.pdf_sha256,
        'buk_registered', document_record.buk_upload_status = 'success',
        'buk_uploaded_at', document_record.buk_uploaded_at
      )
  );
end;
$function$;

revoke all on table public.recruitment_hiring_documents
  from public, anon, authenticated;
revoke all on table public.recruitment_hiring_document_audit_log
  from public, anon, authenticated;
revoke all on sequence public.recruitment_hiring_document_folio_seq
  from public, anon, authenticated;

grant select, insert, update on table public.recruitment_hiring_documents to service_role;
grant select, insert on table public.recruitment_hiring_document_audit_log to service_role;
grant usage, select on sequence public.recruitment_hiring_document_folio_seq to service_role;

revoke all on function public.mask_recruitment_hiring_document_number(text)
  from public, anon, authenticated;
revoke all on function public.build_recruitment_hiring_document_snapshot(uuid)
  from public, anon, authenticated;
revoke all on function public.ensure_recruitment_hiring_document(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.verify_recruitment_hiring_document(text)
  from public, anon, authenticated;

grant execute on function public.mask_recruitment_hiring_document_number(text) to service_role;
grant execute on function public.build_recruitment_hiring_document_snapshot(uuid) to service_role;
grant execute on function public.ensure_recruitment_hiring_document(uuid, uuid) to service_role;
grant execute on function public.verify_recruitment_hiring_document(text) to service_role;

-- Corrige drift productivo: estas helpers internas son consumidas por Edge con service_role.
revoke all on function public.build_competency_certificate_public_snapshot(uuid)
  from public, anon, authenticated;
revoke all on function public.refresh_competency_certificate_public_snapshot(uuid)
  from public, anon, authenticated;
revoke all on function public.verify_competency_certificate(text)
  from public, anon, authenticated;

grant execute on function public.refresh_competency_certificate_public_snapshot(uuid) to service_role;
grant execute on function public.verify_competency_certificate(text) to service_role;

notify pgrst, 'reload schema';

commit;
