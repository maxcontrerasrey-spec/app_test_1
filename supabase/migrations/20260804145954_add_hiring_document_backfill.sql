begin;

alter table public.recruitment_hiring_documents
  add column if not exists source_snapshot_purged_at timestamptz null;

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
      'company_name', coalesce(
        mapping.company_name,
        public.resolve_known_company_name(null::bigint, hr.contract_number),
        'Buses JM'
      ),
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
        'uploaded',
          exists (
            select 1
            from public.candidate_documents cd
            where cd.document_type_id = dt.id
              and cd.candidate_profile_id = rcc.candidate_profile_id
              and cd.recruitment_case_id = rcc.recruitment_case_id
              and nullif(trim(coalesce(cd.file_path, '')), '') is not null
          )
          or exists (
            select 1
            from public.buk_sync_jobs history_job
            cross join lateral jsonb_array_elements(
              case
                when jsonb_typeof(history_job.result_snapshot -> 'documents') = 'array'
                  then history_job.result_snapshot -> 'documents'
                else '[]'::jsonb
              end
            ) uploaded_document
            left join lateral (
              select payload_document
              from jsonb_array_elements(
                case
                  when jsonb_typeof(history_job.payload_snapshot -> 'documents') = 'array'
                    then history_job.payload_snapshot -> 'documents'
                  else '[]'::jsonb
                end
              ) payload_document
              where payload_document ->> 'id' = uploaded_document ->> 'sourceDocumentId'
              limit 1
            ) source_document on true
            where history_job.recruitment_case_candidate_id = rcc.id
              and case
                when uploaded_document ->> 'status' ~ '^[0-9]{3}$'
                  then (uploaded_document ->> 'status')::integer
                else 0
              end between 200 and 299
              and (
                source_document.payload_document ->> 'document_type_id' = dt.id::text
                or lower(trim(coalesce(
                  source_document.payload_document ->> 'document_name',
                  uploaded_document ->> 'sourceDocumentName',
                  ''
                ))) = lower(trim(dt.name))
              )
          )
      )
      order by dt.created_at asc, dt.name asc
    ) as items
    from public.document_types dt
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

  if candidate_record.stage_code = 'ready_for_hire' and job_record.status <> 'processing' then
    raise exception 'La Solicitud futura solo puede generarse dentro de Generar en BUK desde Personal a Contratar';
  end if;

  if candidate_record.stage_code = 'hired' and not public.is_effective_buk_generation_success(
    job_record.status,
    job_record.buk_employee_id,
    job_record.result_snapshot
  ) then
    raise exception 'El backfill solo admite Personal contratado con generación BUK efectiva';
  end if;

  if candidate_record.stage_code not in ('ready_for_hire', 'hired') then
    raise exception 'La Solicitud no puede generarse antes de Personal a Contratar';
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

  if exists (
    select 1
    from public.recruitment_hiring_documents previous_document
    where previous_document.recruitment_case_candidate_id = p_case_candidate_id
  ) then
    raise exception 'Existe una Solicitud histórica no activa que requiere revisión manual';
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
      'snapshot_version', existing_record.snapshot_version,
      'origin', case when candidate_record.stage_code = 'hired'
        then 'historical_backfill'
        else 'generate_in_buk'
      end
    ),
    job_record.requested_by
  );

  return to_jsonb(existing_record);
end;
$function$;

create or replace function public.get_recruitment_hiring_document_backfill_candidates(
  p_candidate_ids uuid[] default null,
  p_limit integer default 10
)
returns table (
  recruitment_case_candidate_id uuid,
  buk_sync_job_id uuid,
  buk_employee_id text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    rcc.id,
    effective_job.id,
    trim(effective_job.buk_employee_id)
  from public.recruitment_case_candidates rcc
  join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
  join public.hiring_requests hr on hr.id = rc.hiring_request_id
  join public.candidate_worker_files cwf on cwf.recruitment_case_candidate_id = rcc.id
  join lateral (
    select bsj.id, bsj.buk_employee_id, bsj.finished_at, bsj.created_at
    from public.buk_sync_jobs bsj
    where bsj.recruitment_case_candidate_id = rcc.id
      and public.is_effective_buk_generation_success(
        bsj.status,
        bsj.buk_employee_id,
        bsj.result_snapshot
      )
    order by coalesce(bsj.finished_at, bsj.created_at) desc, bsj.id desc
    limit 1
  ) effective_job on true
  where rcc.stage_code = 'hired'
    and rcc.document_validation_status = 'approved'
    and rcc.document_validated_by is not null
    and rcc.document_validated_at is not null
    and (p_candidate_ids is null or rcc.id = any(p_candidate_ids))
    and (
      not exists (
        select 1
        from public.recruitment_hiring_documents any_document
        where any_document.recruitment_case_candidate_id = rcc.id
      )
      or exists (
        select 1
        from public.recruitment_hiring_documents retryable_document
        where retryable_document.recruitment_case_candidate_id = rcc.id
          and retryable_document.document_status = 'active'
          and retryable_document.buk_upload_status in ('pending', 'failed')
      )
    )
  order by coalesce(effective_job.finished_at, effective_job.created_at) asc, rcc.id asc
  limit least(greatest(coalesce(p_limit, 10), 1), 25);
$function$;

revoke all on function public.build_recruitment_hiring_document_snapshot(uuid)
  from public, anon, authenticated;
revoke all on function public.ensure_recruitment_hiring_document(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.get_recruitment_hiring_document_backfill_candidates(uuid[], integer)
  from public, anon, authenticated;

grant execute on function public.build_recruitment_hiring_document_snapshot(uuid) to service_role;
grant execute on function public.ensure_recruitment_hiring_document(uuid, uuid) to service_role;
grant execute on function public.get_recruitment_hiring_document_backfill_candidates(uuid[], integer)
  to service_role;

grant usage, select on sequence public.recruitment_hiring_document_audit_log_id_seq
  to service_role;

notify pgrst, 'reload schema';

commit;
