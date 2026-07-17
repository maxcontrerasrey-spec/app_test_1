begin;

set check_function_bodies = off;

create index if not exists idx_competency_evaluations_request_hash
  on public.competency_evaluations (request_id, file_sha256);

create or replace function public.create_competency_request(request_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  requested_instructor_id uuid := nullif(request_payload->>'instructorId', '')::uuid;
  selected_model_ids uuid[] := '{}';
  worker_record record;
  instructor_record record;
  duplicate_record record;
  created_request_id uuid;
  created_certificate_id uuid;
  created_folio text;
  created_token uuid;
  model_summary text;
  duplicate_guard_key text;
  theoretical_score numeric(5,2) := coalesce(nullif(request_payload->>'theoreticalScore', '')::numeric, 0);
  practical_score numeric(5,2) := coalesce(nullif(request_payload->>'practicalScore', '')::numeric, 0);
  final_score numeric(5,2) := coalesce(nullif(request_payload->>'finalScore', '')::numeric, 0);
  training_date_value date := nullif(request_payload->>'trainingDate', '')::date;
  evaluation_date_value timestamptz := coalesce(nullif(request_payload->>'evaluationDate', '')::timestamptz, timezone('utc', now()));
  file_path_value text := trim(coalesce(request_payload->>'evaluationFilePath', ''));
  file_name_value text := trim(coalesce(request_payload->>'evaluationFileName', ''));
  file_mime_value text := trim(coalesce(request_payload->>'evaluationMimeType', ''));
  file_hash_value text := lower(trim(coalesce(request_payload->>'evaluationSha256', '')));
  file_size_value bigint := coalesce(nullif(request_payload->>'evaluationSizeBytes', '')::bigint, 0);
begin
  if not public.user_can_access_competencies(current_user_id) then
    raise exception 'Sin permisos para crear certificaciones de competencias';
  end if;

  if jsonb_typeof(request_payload) <> 'object' then
    raise exception 'Payload invalido';
  end if;

  if requested_instructor_id is null then
    raise exception 'Instructor requerido';
  end if;

  select * into instructor_record
  from public.competency_instructors
  where id = requested_instructor_id
    and status = 'active';

  if instructor_record.id is null then
    raise exception 'Instructor activo no encontrado';
  end if;

  if (instructor_record.user_id is null or instructor_record.user_id <> current_user_id)
     and not public.user_can_admin_competencies(current_user_id) then
    raise exception 'No puedes certificar en nombre de otro instructor';
  end if;

  select
    e.buk_employee_id,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    e.full_name,
    coalesce(nullif(trim(e.job_title), ''), e.raw_payload -> 'current_job' -> 'role' ->> 'name') as job_title,
    e.area_name,
    e.contract_code
  into worker_record
  from public.employees_active_current e
  where e.buk_employee_id = trim(coalesce(request_payload->>'workerBukEmployeeId', ''))
  limit 1;

  if worker_record.buk_employee_id is null then
    raise exception 'Trabajador activo no encontrado en BUK sincronizado';
  end if;

  if nullif(trim(coalesce(worker_record.document_number, '')), '') is null then
    raise exception 'El trabajador no tiene RUT/documento valido';
  end if;

  select array_agg(model_id order by model_id)
    into selected_model_ids
  from (
    select distinct value::uuid as model_id
    from jsonb_array_elements_text(coalesce(request_payload->'modelIds', '[]'::jsonb)) value
  ) selected_models;

  if selected_model_ids is null or array_length(selected_model_ids, 1) is null then
    raise exception 'Debes seleccionar al menos un modelo de equipo';
  end if;

  if exists (
    select 1
    from unnest(selected_model_ids) selected_model_id
    left join public.competency_equipment_models m
      on m.id = selected_model_id and m.is_active = true
    where m.id is null
  ) then
    raise exception 'Uno o mas modelos seleccionados no son validos';
  end if;

  if final_score <> 100 or theoretical_score <> 100 or practical_score <> 100 then
    raise exception 'La certificacion exige evaluacion teorica, practica y final al 100%%';
  end if;

  if coalesce(nullif(request_payload->>'declarationAccepted', '')::boolean, false) is not true then
    raise exception 'Debes aceptar la declaracion de evaluacion antes de generar el certificado';
  end if;

  if file_path_value = '' or file_name_value = '' or file_size_value <= 0 then
    raise exception 'Debes cargar la evaluacion respaldada antes de generar el certificado';
  end if;

  if file_mime_value not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'Solo se permiten evaluaciones PDF, JPG o PNG';
  end if;

  if file_hash_value !~ '^[a-f0-9]{64}$' then
    raise exception 'Hash SHA-256 de evaluacion invalido';
  end if;

  if file_path_value not like 'evaluations/' || current_user_id::text || '/%' then
    raise exception 'Ruta de evaluacion fuera del alcance del usuario';
  end if;

  if not exists (
    select 1
    from storage.objects so
    where so.bucket_id = 'competency_documents'
      and so.name = file_path_value
  ) then
    raise exception 'No se encontro el archivo de evaluacion cargado';
  end if;

  if training_date_value is null then
    raise exception 'Fecha de capacitacion requerida';
  end if;

  duplicate_guard_key := concat_ws(
    '|',
    'competency_request',
    worker_record.buk_employee_id,
    requested_instructor_id::text,
    training_date_value::text,
    array_to_string(selected_model_ids, ',')
  );

  perform pg_advisory_xact_lock(hashtextextended(duplicate_guard_key, 0));

  select
    cr.id as request_id,
    cc.id as certificate_id,
    cc.folio,
    cc.certificate_status,
    cc.buk_document_name,
    cc.created_at
  into duplicate_record
  from public.competency_requests cr
  join public.competency_certificates cc
    on cc.request_id = cr.id
  where cr.worker_buk_employee_id = worker_record.buk_employee_id
    and cr.instructor_id = requested_instructor_id
    and cr.training_date = training_date_value
    and cr.request_status not in ('rejected', 'cancelled')
    and cc.certificate_status not in ('generation_failed', 'revoked', 'expired', 'replaced', 'annulled')
    and cc.competency_status in ('pending', 'enabled')
    and (
      select array_agg(crm.model_id order by crm.model_id)
      from public.competency_request_models crm
      where crm.request_id = cr.id
    ) = selected_model_ids
  order by
    case when cc.certificate_status = 'uploaded_to_buk' then 0 else 1 end,
    cc.created_at desc
  limit 1;

  if duplicate_record.certificate_id is not null then
    raise exception 'Ya existe una certificacion equivalente para este trabajador, instructor, fecha y modelos. Folio vigente: %', duplicate_record.folio
      using detail = jsonb_build_object(
        'request_id', duplicate_record.request_id,
        'certificate_id', duplicate_record.certificate_id,
        'folio', duplicate_record.folio,
        'certificate_status', duplicate_record.certificate_status
      )::text;
  end if;

  select string_agg(concat(b.name, ' ', t.name, ' ', m.name), ', ' order by b.name, t.name, m.name)
    into model_summary
  from public.competency_equipment_models m
  join public.competency_equipment_brands b on b.id = m.brand_id
  join public.competency_equipment_types t on t.id = m.type_id
  where m.id = any(selected_model_ids);

  insert into public.competency_requests (
    request_status,
    worker_buk_employee_id,
    worker_document_number,
    worker_document_type,
    worker_full_name,
    worker_job_title,
    worker_area_name,
    worker_contract_code,
    instructor_id,
    training_date,
    training_start_time,
    training_end_time,
    training_location,
    training_modality,
    training_type,
    notes,
    model_summary,
    created_by,
    updated_by
  )
  values (
    'submitted',
    worker_record.buk_employee_id,
    worker_record.document_number,
    worker_record.document_type,
    worker_record.full_name,
    worker_record.job_title,
    worker_record.area_name,
    worker_record.contract_code,
    requested_instructor_id,
    training_date_value,
    nullif(request_payload->>'trainingStartTime', '')::time,
    nullif(request_payload->>'trainingEndTime', '')::time,
    nullif(trim(coalesce(request_payload->>'trainingLocation', '')), ''),
    coalesce(nullif(trim(coalesce(request_payload->>'trainingModality', '')), ''), 'teorico-practica'),
    coalesce(nullif(trim(coalesce(request_payload->>'trainingType', '')), ''), 'teorico-practica'),
    nullif(trim(coalesce(request_payload->>'notes', '')), ''),
    model_summary,
    current_user_id,
    current_user_id
  )
  returning id into created_request_id;

  insert into public.competency_request_models (request_id, model_id)
  select created_request_id, model_id
  from unnest(selected_model_ids) model_id;

  insert into public.competency_evaluations (
    request_id,
    attempt_number,
    theoretical_score,
    practical_score,
    final_score,
    evaluation_status,
    file_path,
    file_original_name,
    file_mime_type,
    file_size_bytes,
    file_sha256,
    declaration_accepted,
    evaluated_at,
    approved_at,
    uploaded_by
  )
  values (
    created_request_id,
    1,
    theoretical_score,
    practical_score,
    final_score,
    'approved',
    file_path_value,
    file_name_value,
    file_mime_value,
    file_size_value,
    file_hash_value,
    true,
    evaluation_date_value,
    timezone('utc', now()),
    current_user_id
  );

  insert into public.competency_certificates (request_id)
  values (created_request_id)
  returning id, folio, verification_token into created_certificate_id, created_folio, created_token;

  perform public.log_competency_event(
    created_request_id,
    created_certificate_id,
    'request_submitted',
    'Solicitud de certificacion creada con evaluacion aprobada al 100%',
    jsonb_build_object(
      'worker_buk_employee_id', worker_record.buk_employee_id,
      'instructor_id', requested_instructor_id,
      'model_count', array_length(selected_model_ids, 1),
      'folio', created_folio,
      'duplicate_guard_key_hash', md5(duplicate_guard_key)
    )
  );

  return jsonb_build_object(
    'request_id', created_request_id,
    'certificate_id', created_certificate_id,
    'folio', created_folio,
    'verification_token', created_token
  );
end;
$function$;

revoke all on function public.create_competency_request(jsonb) from public, anon;
grant execute on function public.create_competency_request(jsonb) to authenticated;

do $$
declare
  old_certificate_id constant uuid := '081857d9-ee9a-4db5-bf17-a2d388746cf5';
  new_certificate_id constant uuid := '5718a275-383e-47ae-b8a3-405eb42d04ae';
  old_request_id uuid;
begin
  if exists (
    select 1
    from public.competency_certificates old_cc
    join public.competency_certificates new_cc on new_cc.id = new_certificate_id
    where old_cc.id = old_certificate_id
      and old_cc.folio = '1707202611461152'
      and new_cc.folio = '1707202611471153'
  ) then
    update public.competency_certificates
    set certificate_status = 'replaced',
        competency_status = 'revoked',
        replaced_by_certificate_id = new_certificate_id,
        revocation_reason = 'Duplicado operacional reemplazado por folio 1707202611471153',
        buk_last_error = coalesce(buk_last_error, 'BUK conserva documento fisico; ERP reemplaza vigencia por duplicado operacional'),
        updated_at = timezone('utc', now())
    where id = old_certificate_id
    returning request_id into old_request_id;

    update public.competency_requests
    set request_status = 'cancelled',
        notes = concat_ws(
          E'\n',
          nullif(notes, ''),
          'Cancelada por duplicado operacional. Folio valido y reciente: 1707202611471153.'
        ),
        updated_at = timezone('utc', now())
    where id = old_request_id;

    perform public.log_competency_event(
      old_request_id,
      old_certificate_id,
      'certificate_replaced_duplicate',
      'Certificado duplicado reemplazado por folio vigente y reciente',
      jsonb_build_object(
        'replaced_by_certificate_id', new_certificate_id,
        'replaced_by_folio', '1707202611471153',
        'buk_delete_attempt', 'delete /employees/40022/docs/{file_id} returned 404'
      )
    );

    if to_regprocedure('public.refresh_competency_certificate_public_snapshot(uuid)') is not null then
      perform public.refresh_competency_certificate_public_snapshot(old_certificate_id);
      perform public.refresh_competency_certificate_public_snapshot(new_certificate_id);
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
