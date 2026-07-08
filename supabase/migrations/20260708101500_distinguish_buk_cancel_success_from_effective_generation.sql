begin;

create or replace function public.is_effective_buk_generation_success(
  p_status text,
  p_buk_employee_id text,
  p_result_snapshot jsonb default '{}'::jsonb
)
returns boolean
language sql
immutable
as $function$
  select
    nullif(trim(coalesce(p_status, '')), '') = 'success'
    and nullif(trim(coalesce(p_buk_employee_id, '')), '') is not null
    and coalesce(p_result_snapshot #>> '{erpAction,action}', '') <> 'cancel_request_existing_active_buk_employee';
$function$;

create or replace function public.get_candidate_buk_sync_payload(
  p_case_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  case_record public.recruitment_cases%rowtype;
  profile_record public.candidate_profiles%rowtype;
  worker_record public.candidate_worker_files%rowtype;
  documents_payload jsonb := '[]'::jsonb;
  effective_employee_code text := null;
  effective_private_role text := null;
  effective_increase_quote_one_percent text := null;
  effective_afc_regime text := null;
  effective_retirement_regime text := null;
  effective_health_plan_uf numeric := null;
  effective_health_plan_percentage numeric := null;
  health_plan_required boolean := false;
  successful_buk_employee_id text := null;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  if not (
    public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id)
    or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_record.id)
  ) then
    raise exception 'Sin permisos para generar este candidato en BUK';
  end if;

  select nullif(trim(coalesce(bsj.buk_employee_id, '')), '')
    into successful_buk_employee_id
    from public.buk_sync_jobs bsj
   where bsj.recruitment_case_candidate_id = candidate_record.id
     and public.is_effective_buk_generation_success(
       bsj.status,
       bsj.buk_employee_id,
       bsj.result_snapshot
     )
   order by coalesce(bsj.finished_at, bsj.created_at) desc, bsj.id desc
   limit 1;

  if candidate_record.stage_code not in ('ready_for_hire', 'hired')
     or successful_buk_employee_id is not null then
    raise exception 'El candidato debe seguir pendiente de generación efectiva en BUK antes de generar';
  end if;

  if candidate_record.document_validation_status <> 'approved' then
    raise exception 'La documentación del candidato debe estar aprobada para generar en BUK';
  end if;

  select *
    into case_record
    from public.recruitment_cases rc
   where rc.id = candidate_record.recruitment_case_id;

  select *
    into profile_record
    from public.candidate_profiles cp
   where cp.id = candidate_record.candidate_profile_id;

  select *
    into worker_record
    from public.candidate_worker_files cwf
   where cwf.recruitment_case_candidate_id = candidate_record.id;

  effective_employee_code := coalesce(
    nullif(trim(coalesce(worker_record.employee_code, '')), ''),
    public.resolve_candidate_worker_employee_code(candidate_record.id)
  );
  effective_private_role := coalesce(
    nullif(trim(coalesce(worker_record.private_role, '')), ''),
    'No'
  );
  effective_increase_quote_one_percent := coalesce(
    nullif(trim(coalesce(worker_record.increase_quote_one_percent, '')), ''),
    'No'
  );
  effective_afc_regime := coalesce(
    nullif(trim(coalesce(worker_record.afc_regime, '')), ''),
    'Menos de 11 Años'
  );
  effective_retirement_regime := case
    when public.is_affirmative_buk_value(worker_record.retired_status)
      then nullif(trim(coalesce(worker_record.retirement_regime, '')), '')
    else null
  end;
  health_plan_required := public.worker_health_provider_requires_plan(worker_record.health_provider);
  effective_health_plan_uf := public.resolve_candidate_buk_health_plan_uf(
    worker_record.health_provider,
    worker_record.health_plan_uf
  );
  effective_health_plan_percentage := public.resolve_candidate_buk_health_plan_percentage(
    worker_record.health_provider,
    worker_record.health_plan_percentage
  );

  if nullif(trim(coalesce(profile_record.document_type, '')), '') is null
     or nullif(trim(coalesce(profile_record.national_id, '')), '') is null
     or nullif(trim(coalesce(profile_record.first_name, '')), '') is null
     or nullif(trim(coalesce(profile_record.last_name, '')), '') is null
     or nullif(trim(coalesce(profile_record.gender, '')), '') is null
     or nullif(trim(coalesce(profile_record.nationality, '')), '') is null
     or profile_record.birth_date is null
     or nullif(trim(coalesce(profile_record.marital_status, '')), '') is null
     or nullif(trim(coalesce(profile_record.personal_email, '')), '') is null
     or nullif(trim(coalesce(profile_record.address_line, '')), '') is null
     or nullif(trim(coalesce(profile_record.region, '')), '') is null
     or nullif(trim(coalesce(profile_record.district_or_commune, '')), '') is null then
    raise exception 'La ficha personal BUK del candidato aún está incompleta';
  end if;

  if worker_record.id is null
     or effective_employee_code is null
     or worker_record.company_entry_date is null
     or effective_private_role is null
     or nullif(trim(coalesce(worker_record.payment_method, '')), '') is null
     or nullif(trim(coalesce(worker_record.payment_period, '')), '') is null
     or nullif(trim(coalesce(worker_record.pension_regime, '')), '') is null
     or effective_increase_quote_one_percent is null
     or nullif(trim(coalesce(worker_record.health_provider, '')), '') is null
     or effective_afc_regime is null
     or (
       public.is_affirmative_buk_value(worker_record.retired_status)
       and effective_retirement_regime is null
     )
     or (
       health_plan_required
       and effective_health_plan_uf is null
     ) then
    raise exception 'La ficha contractual BUK del candidato aún está incompleta';
  end if;

  documents_payload := coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', cd.id,
        'document_type_id', cd.document_type_id,
        'document_name', dt.name,
        'file_path', cd.file_path,
        'status', cd.status,
        'expiry_date', cd.expiry_date
      )
      order by dt.name asc
    )
    from public.candidate_documents cd
    join public.document_types dt
      on dt.id = cd.document_type_id
    where cd.recruitment_case_id = candidate_record.recruitment_case_id
      and cd.candidate_profile_id = candidate_record.candidate_profile_id
      and cd.status = 'approved'
      and cd.file_path is not null
  ), '[]'::jsonb);

  return jsonb_build_object(
    'candidate',
    jsonb_build_object(
      'case_candidate_id', candidate_record.id,
      'recruitment_case_id', candidate_record.recruitment_case_id,
      'candidate_profile_id', candidate_record.candidate_profile_id,
      'stage_code', candidate_record.stage_code,
      'document_validation_status', candidate_record.document_validation_status,
      'hired_at', candidate_record.hired_at
    ),
    'case',
    jsonb_build_object(
      'id', case_record.id,
      'case_code', case_record.case_code,
      'contract_name', case_record.contract_name,
      'job_position_name', case_record.job_position_name,
      'requested_entry_date', case_record.requested_entry_date
    ),
    'profile',
    public.get_candidate_buk_profile(candidate_record.id),
    'documents',
    documents_payload
  );
end;
$function$;

create or replace function public.get_recruitment_personnel_page_bucket(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0,
  p_stage_code text default 'ready_for_hire'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  normalized_search text := public.normalize_recruitment_search_text(p_search);
  search_terms text[] := array[]::text[];
  normalized_stage_code text := coalesce(nullif(trim(p_stage_code), ''), 'ready_for_hire');
  items jsonb := '[]'::jsonb;
  total_count bigint := 0;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_recruitment_personnel(current_user_id) then
    return jsonb_build_object('items', '[]'::jsonb, 'total_count', 0);
  end if;

  if normalized_stage_code not in ('ready_for_hire', 'hired') then
    raise exception 'Bucket de personal inválido';
  end if;

  if normalized_search <> '' then
    search_terms := regexp_split_to_array(normalized_search, '\s+');
  end if;

  with personnel_rows as (
    select
      rcc.id::text as stable_id,
      rc.opened_at as sort_case_opened_at,
      case
        when normalized_stage_code = 'hired'
          then coalesce(successful_buk_job.generated_at, rcc.hired_at, rcc.updated_at, rcc.created_at)
        else coalesce(rcc.stage_entered_at, rcc.updated_at, rcc.created_at)
      end as sort_bucket_at,
      rcc.created_at as sort_candidate_created_at,
      public.normalize_recruitment_search_text(
        concat_ws(
          ' ',
          cp.full_name,
          cp.national_id,
          rc.case_code,
          hr.folio,
          rc.contract_name,
          rc.job_position_name,
          rc.cost_center_name,
          rc.cost_center_code,
          owner_profile.full_name
        )
      ) as search_haystack,
      jsonb_build_object(
        'id', rcc.id,
        'candidate_profile_id', cp.id,
        'recruitment_case_id', rc.id,
        'case_code', rc.case_code,
        'folio', hr.folio,
        'case_status', rc.status,
        'national_id', cp.national_id,
        'full_name', cp.full_name,
        'email', cp.email,
        'phone', cp.phone,
        'driver_license_number', cp.driver_license_number,
        'driver_license_class', cp.driver_license_class,
        'driver_license_expiry', cp.driver_license_expiry,
        'stage_code', rcc.stage_code,
        'stage_entered_at', rcc.stage_entered_at,
        'suitability_status', rcc.suitability_status,
        'is_selected', rcc.is_selected,
        'contract_name', rc.contract_name,
        'job_position_name', rc.job_position_name,
        'cost_center_code', rc.cost_center_code,
        'cost_center_name', rc.cost_center_name,
        'owner_name', owner_profile.full_name,
        'active_process_count', 0,
        'contract_locked_case_id', null,
        'contract_locked_case_code', null,
        'contract_locked_folio', null,
        'contract_locked_stage_code', null,
        'is_contract_path_blocked', false,
        'interview_notes', rcc.interview_notes,
        'hired_at', rcc.hired_at,
        'buk_generated_at', successful_buk_job.generated_at,
        'buk_employee_id', successful_buk_job.buk_employee_id,
        'has_buk_generation_success', successful_buk_job.id is not null
      ) as payload
    from public.recruitment_case_candidates rcc
    join public.recruitment_cases rc
      on rc.id = rcc.recruitment_case_id
    join public.hiring_requests hr
      on hr.id = rc.hiring_request_id
    join public.candidate_profiles cp
      on cp.id = rcc.candidate_profile_id
    left join lateral (
      select rca.user_id
      from public.recruitment_case_assignments rca
      where rca.recruitment_case_id = rc.id
        and rca.is_primary = true
      order by rca.id asc
      limit 1
    ) as owner_assignment on true
    left join public.profiles owner_profile
      on owner_profile.id = owner_assignment.user_id
    left join lateral (
      select
        bsj.id,
        trim(bsj.buk_employee_id) as buk_employee_id,
        coalesce(bsj.finished_at, bsj.created_at) as generated_at
      from public.buk_sync_jobs bsj
      where bsj.recruitment_case_candidate_id = rcc.id
        and public.is_effective_buk_generation_success(
          bsj.status,
          bsj.buk_employee_id,
          bsj.result_snapshot
        )
      order by coalesce(bsj.finished_at, bsj.created_at) desc, bsj.id desc
      limit 1
    ) as successful_buk_job on true
    where public.user_can_manage_recruitment_personnel_candidate(current_user_id, rcc.id)
      and rcc.stage_code in ('ready_for_hire', 'hired')
      and (
        (
          normalized_stage_code = 'ready_for_hire'
          and successful_buk_job.id is null
        )
        or (
          normalized_stage_code = 'hired'
          and successful_buk_job.id is not null
        )
      )
  ),
  filtered as (
    select *
    from personnel_rows personnel_row
    where cardinality(search_terms) = 0
       or not exists (
        select 1
        from unnest(search_terms) as term(value)
        where personnel_row.search_haystack not like '%' || term.value || '%'
      )
  ),
  totals as (
    select count(*) as value from filtered
  ),
  ordered_page as (
    select
      ordered_rows.payload,
      row_number() over () as row_order
    from (
      select filtered.payload
      from filtered
      order by
        filtered.sort_bucket_at desc,
        filtered.sort_case_opened_at desc,
        filtered.sort_candidate_created_at asc,
        filtered.stable_id asc
      limit safe_limit
      offset safe_offset
    ) ordered_rows
  )
  select
    coalesce(jsonb_agg(ordered_page.payload order by ordered_page.row_order), '[]'::jsonb),
    (select value from totals)
  into items, total_count
  from ordered_page;

  return jsonb_build_object(
    'items', coalesce(items, '[]'::jsonb),
    'total_count', coalesce(total_count, 0)
  );
end;
$function$;

create or replace function public.enqueue_buk_generation(
  p_candidate_ids uuid[]
)
returns table (
  job_id uuid,
  recruitment_case_candidate_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_row record;
  existing_job public.buk_sync_jobs%rowtype;
  new_job_id uuid;
  payload_snapshot jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_generate_buk_candidates(current_user_id) then
    raise exception 'Solo RRHH administrativo puede generar candidatos en BUK';
  end if;

  if not public.user_can_access_recruitment_personnel(current_user_id) then
    raise exception 'Sin permisos para operar Personal a Contratar';
  end if;

  for candidate_row in
    select distinct rcc.id, rcc.recruitment_case_id, rcc.candidate_profile_id
    from public.recruitment_case_candidates rcc
    join unnest(coalesce(p_candidate_ids, '{}'::uuid[])) as selected_candidate_id
      on selected_candidate_id = rcc.id
  loop
    if not (
      public.user_can_manage_recruitment_case(current_user_id, candidate_row.recruitment_case_id)
      or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_row.id)
    ) then
      raise exception 'Sin permisos para encolar el candidato %', candidate_row.id;
    end if;

    select *
      into existing_job
      from public.buk_sync_jobs bsj
     where bsj.recruitment_case_candidate_id = candidate_row.id
       and bsj.status in ('pending', 'processing')
     limit 1
     for update;

    if existing_job.id is not null then
      job_id := existing_job.id;
      recruitment_case_candidate_id := candidate_row.id;
      status := existing_job.status;
      return next;
      continue;
    end if;

    select *
      into existing_job
      from public.buk_sync_jobs bsj
     where bsj.recruitment_case_candidate_id = candidate_row.id
       and public.is_effective_buk_generation_success(
         bsj.status,
         bsj.buk_employee_id,
         bsj.result_snapshot
       )
     order by bsj.created_at desc
     limit 1;

    if existing_job.id is not null then
      raise exception 'El candidato % ya fue generado previamente en BUK', candidate_row.id;
    end if;

    payload_snapshot := public.get_candidate_buk_sync_payload(candidate_row.id);

    insert into public.buk_sync_jobs (
      recruitment_case_candidate_id,
      requested_by,
      status,
      payload_snapshot
    )
    values (
      candidate_row.id,
      current_user_id,
      'pending',
      payload_snapshot
    )
    returning id into new_job_id;

    job_id := new_job_id;
    recruitment_case_candidate_id := candidate_row.id;
    status := 'pending';
    return next;
  end loop;
end;
$function$;

create or replace function public.enqueue_personnel_to_hire_email(
  p_case_candidate_id uuid,
  p_is_reminder boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  candidate_record record;
  recipients jsonb := '[]'::jsonb;
  event_key text;
begin
  select
    rcc.id,
    rcc.stage_code,
    rcc.stage_entered_at,
    cp.full_name as candidate_name,
    cp.national_id as candidate_rut,
    rc.id as recruitment_case_id,
    rc.case_code,
    rc.contract_name,
    rc.job_position_name,
    rc.cost_center_code,
    rc.cost_center_name,
    hr.id as hiring_request_id,
    hr.folio,
    hr.requester_name,
    hr.requester_email,
    hr.requested_entry_date,
    owner_profile.full_name as owner_name
  into candidate_record
  from public.recruitment_case_candidates rcc
  join public.candidate_profiles cp
    on cp.id = rcc.candidate_profile_id
  join public.recruitment_cases rc
    on rc.id = rcc.recruitment_case_id
  join public.hiring_requests hr
    on hr.id = rc.hiring_request_id
  left join lateral (
    select rca.user_id
    from public.recruitment_case_assignments rca
    where rca.recruitment_case_id = rc.id
      and rca.is_primary = true
    order by rca.id asc
    limit 1
  ) as owner_assignment on true
  left join public.profiles owner_profile
    on owner_profile.id = owner_assignment.user_id
  where rcc.id = p_case_candidate_id
    and rcc.stage_code = 'ready_for_hire'
    and not exists (
      select 1
      from public.buk_sync_jobs bsj
      where bsj.recruitment_case_candidate_id = rcc.id
        and public.is_effective_buk_generation_success(
          bsj.status,
          bsj.buk_employee_id,
          bsj.result_snapshot
        )
    )
  limit 1;

  if candidate_record.id is null then
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
      lower(trim(p.email)) as email,
      coalesce(nullif(trim(p.full_name), ''), trim(p.email)) as name
    from public.profiles p
    join public.user_roles ur
      on ur.user_id = p.id
    where ur.role_code in ('administrativo', 'jefe_administrativo')
      and p.status = 'active'
      and nullif(trim(coalesce(p.email, '')), '') is not null
  ) as notification_recipient;

  if recipients = '[]'::jsonb then
    return;
  end if;

  event_key := case
    when p_is_reminder then format(
      'personnel-to-hire:%s:reminder:%s',
      candidate_record.id,
      to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS')
    )
    else format('personnel-to-hire:%s', candidate_record.id)
  end;

  perform public.queue_transactional_email_notification(
    event_key,
    'personnel_to_hire',
    jsonb_build_object(
      'kind', 'personnel_to_hire',
      'event_key', event_key,
      'is_reminder', p_is_reminder,
      'to', recipients,
      'candidate', jsonb_build_object(
        'id', candidate_record.id,
        'full_name', candidate_record.candidate_name,
        'rut', candidate_record.candidate_rut,
        'ready_for_hire_at', candidate_record.stage_entered_at
      ),
      'case', jsonb_build_object(
        'id', candidate_record.recruitment_case_id,
        'case_code', candidate_record.case_code
      ),
      'request', jsonb_build_object(
        'id', candidate_record.hiring_request_id,
        'folio', candidate_record.folio,
        'request_context', 'hiring',
        'module_label', 'Contratación',
        'requester_name', candidate_record.requester_name,
        'requester_email', candidate_record.requester_email,
        'contract_name', candidate_record.contract_name,
        'job_position_name', candidate_record.job_position_name,
        'cost_center_code', candidate_record.cost_center_code,
        'cost_center_name', candidate_record.cost_center_name,
        'requested_entry_date', candidate_record.requested_entry_date,
        'owner_name', candidate_record.owner_name
      ),
      'route', '/control-contrataciones'
    )
  );
end;
$function$;

create or replace function public.process_pending_approval_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  rec record;
begin
  for rec in
    select id
    from public.hiring_request_approvals
    where status = 'pending'
      and step_code in ('area_manager', 'contracts_control')
      and created_at < now() - interval '24 hours'
      and (
        last_reminder_sent_at is null
        or last_reminder_sent_at < now() - interval '24 hours'
      )
  loop
    perform public.enqueue_hiring_pending_approval_email(rec.id, true);
    update public.hiring_request_approvals
       set last_reminder_sent_at = now()
     where id = rec.id;
  end loop;

  for rec in
    select id
    from public.candidate_stage_approvals
    where status = 'pending'
      and stage_code = 'who_pending'
      and created_at < now() - interval '24 hours'
      and (
        last_reminder_sent_at is null
        or last_reminder_sent_at < now() - interval '24 hours'
      )
  loop
    perform public.enqueue_who_pending_approval_email(rec.id, true);
    update public.candidate_stage_approvals
       set last_reminder_sent_at = now()
     where id = rec.id;
  end loop;

  for rec in
    select rcc.id
    from public.recruitment_case_candidates rcc
    where rcc.stage_code = 'ready_for_hire'
      and rcc.ready_for_buk_notified_at < now() - interval '24 hours'
      and (
        rcc.ready_for_buk_last_reminder_sent_at is null
        or rcc.ready_for_buk_last_reminder_sent_at < now() - interval '24 hours'
      )
      and not exists (
        select 1
        from public.buk_sync_jobs bsj
        where bsj.recruitment_case_candidate_id = rcc.id
          and public.is_effective_buk_generation_success(
            bsj.status,
            bsj.buk_employee_id,
            bsj.result_snapshot
          )
      )
  loop
    perform public.enqueue_personnel_to_hire_email(rec.id, true);
    update public.recruitment_case_candidates
       set ready_for_buk_last_reminder_sent_at = now()
     where id = rec.id;
  end loop;
end;
$function$;

notify pgrst, 'reload schema';

commit;
