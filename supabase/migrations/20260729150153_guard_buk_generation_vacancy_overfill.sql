begin;

create or replace function public.get_recruitment_case_buk_capacity_snapshot(
  p_case_id uuid,
  p_excluded_candidate_id uuid default null,
  p_include_pending_jobs boolean default true
)
returns table (
  requested_vacancies integer,
  occupied_vacancies integer,
  available_vacancies integer,
  candidate_occupied_vacancies integer,
  mobility_reserved_vacancies integer
)
language sql
stable
security definer
set search_path = public
as $function$
  with target_case as (
    select rc.id, rc.requested_vacancies
    from public.recruitment_cases rc
    where rc.id = p_case_id
  ),
  candidate_occupancy as (
    select count(distinct rcc.id)::integer as occupied_count
    from public.recruitment_case_candidates rcc
    where rcc.recruitment_case_id = p_case_id
      and (p_excluded_candidate_id is null or rcc.id <> p_excluded_candidate_id)
      and (
        rcc.stage_code = 'hired'
        or exists (
          select 1
          from public.buk_sync_jobs bsj
          where bsj.recruitment_case_candidate_id = rcc.id
            and public.is_effective_buk_generation_success(
              bsj.status,
              bsj.buk_employee_id,
              bsj.result_snapshot
            )
        )
        or exists (
          select 1
          from public.buk_sync_jobs bsj
          where bsj.recruitment_case_candidate_id = rcc.id
            and (
              bsj.status = 'processing'
              or (p_include_pending_jobs and bsj.status = 'pending')
            )
        )
      )
  ),
  mobility_occupancy as (
    select count(*)::integer as occupied_count
    from public.internal_mobility_requests imr
    where imr.recruitment_case_id = p_case_id
      and (
        imr.status in ('pending_area_manager', 'pending_contracts_control')
        or (
          imr.status = 'approved'
          and coalesce(imr.hr_execution_status, 'pending') in ('pending', 'executed')
        )
      )
  )
  select
    tc.requested_vacancies,
    (coalesce(co.occupied_count, 0) + coalesce(mo.occupied_count, 0))::integer as occupied_vacancies,
    greatest(
      tc.requested_vacancies - (coalesce(co.occupied_count, 0) + coalesce(mo.occupied_count, 0)),
      0
    )::integer as available_vacancies,
    coalesce(co.occupied_count, 0)::integer as candidate_occupied_vacancies,
    coalesce(mo.occupied_count, 0)::integer as mobility_reserved_vacancies
  from target_case tc
  cross join candidate_occupancy co
  cross join mobility_occupancy mo;
$function$;

revoke all on function public.get_recruitment_case_buk_capacity_snapshot(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.get_recruitment_case_buk_capacity_snapshot(uuid, uuid, boolean)
  to authenticated, service_role;

create or replace function public.claim_buk_sync_jobs(
  p_limit integer default 10,
  p_job_ids uuid[] default null
)
returns table (
  id uuid,
  recruitment_case_candidate_id uuid,
  status text,
  attempts integer,
  payload_snapshot jsonb,
  result_snapshot jsonb
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  normalized_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
  stale_cutoff timestamptz := timezone('utc', now()) - interval '15 minutes';
begin
  return query
  with candidate_pool as (
    select
      bsj.id,
      bsj.recruitment_case_candidate_id,
      rcc.recruitment_case_id,
      bsj.created_at
    from public.buk_sync_jobs bsj
    join public.recruitment_case_candidates rcc
      on rcc.id = bsj.recruitment_case_candidate_id
    where rcc.stage_code = 'ready_for_hire'
      and (
        (
          p_job_ids is not null
          and bsj.id = any (p_job_ids)
          and (
            bsj.status in ('pending', 'error')
            or (
              bsj.status = 'processing'
              and bsj.finished_at is null
              and bsj.started_at is not null
              and bsj.started_at < stale_cutoff
            )
          )
        )
        or (
          p_job_ids is null
          and (
            bsj.status = 'pending'
            or (
              bsj.status = 'processing'
              and bsj.finished_at is null
              and bsj.started_at is not null
              and bsj.started_at < stale_cutoff
            )
          )
        )
      )
      and not exists (
        select 1
        from public.buk_sync_jobs success_job
        where success_job.recruitment_case_candidate_id = bsj.recruitment_case_candidate_id
          and public.is_effective_buk_generation_success(
            success_job.status,
            success_job.buk_employee_id,
            success_job.result_snapshot
          )
      )
    for update of bsj skip locked
  ),
  case_capacity as (
    select
      cp.recruitment_case_id,
      greatest(
        rc.requested_vacancies
        - coalesce(candidate_occupancy.occupied_count, 0)
        - coalesce(mobility_occupancy.occupied_count, 0),
        0
      )::integer as available_for_pool
    from (select distinct recruitment_case_id from candidate_pool) cp
    join public.recruitment_cases rc
      on rc.id = cp.recruitment_case_id
    left join lateral (
      select count(distinct rcc.id)::integer as occupied_count
      from public.recruitment_case_candidates rcc
      where rcc.recruitment_case_id = cp.recruitment_case_id
        and not exists (
          select 1
          from candidate_pool pool
          where pool.recruitment_case_candidate_id = rcc.id
        )
        and (
          rcc.stage_code = 'hired'
          or exists (
            select 1
            from public.buk_sync_jobs bsj
            where bsj.recruitment_case_candidate_id = rcc.id
              and public.is_effective_buk_generation_success(
                bsj.status,
                bsj.buk_employee_id,
                bsj.result_snapshot
              )
          )
          or exists (
            select 1
            from public.buk_sync_jobs bsj
            where bsj.recruitment_case_candidate_id = rcc.id
              and bsj.status in ('pending', 'processing')
          )
        )
    ) as candidate_occupancy on true
    left join lateral (
      select count(*)::integer as occupied_count
      from public.internal_mobility_requests imr
      where imr.recruitment_case_id = cp.recruitment_case_id
        and (
          imr.status in ('pending_area_manager', 'pending_contracts_control')
          or (
            imr.status = 'approved'
            and coalesce(imr.hr_execution_status, 'pending') in ('pending', 'executed')
          )
        )
    ) as mobility_occupancy on true
  ),
  ranked_pool as (
    select
      cp.id,
      cp.recruitment_case_candidate_id,
      cp.recruitment_case_id,
      cc.available_for_pool,
      row_number() over (
        partition by cp.recruitment_case_id
        order by cp.created_at asc, cp.id asc
      )::integer as case_queue_position
    from candidate_pool cp
    join case_capacity cc
      on cc.recruitment_case_id = cp.recruitment_case_id
  ),
  blocked_jobs as (
    update public.buk_sync_jobs bsj
       set status = 'error',
           finished_at = timezone('utc', now()),
           error_message = 'No hay cupos disponibles para generar este candidato en BUK.',
           result_snapshot = coalesce(bsj.result_snapshot, '{}'::jsonb)
             || jsonb_build_object(
               'vacancyGuard',
               jsonb_build_object(
                 'blockedAt', timezone('utc', now()),
                 'source', 'claim_buk_sync_jobs',
                 'availableForPool', ranked_pool.available_for_pool,
                 'caseQueuePosition', ranked_pool.case_queue_position
               )
             )
      from ranked_pool
     where bsj.id = ranked_pool.id
       and ranked_pool.case_queue_position > ranked_pool.available_for_pool
     returning bsj.id
  ),
  selected_jobs as (
    select ranked_pool.id
    from ranked_pool
    where ranked_pool.case_queue_position <= ranked_pool.available_for_pool
    order by ranked_pool.recruitment_case_id, ranked_pool.case_queue_position, ranked_pool.id
    limit normalized_limit
  ),
  updated_jobs as (
    update public.buk_sync_jobs bsj
       set status = 'processing',
           attempts = bsj.attempts + 1,
           started_at = timezone('utc', now()),
           error_message = null,
           result_snapshot = case
             when bsj.status = 'processing' then
               coalesce(bsj.result_snapshot, '{}'::jsonb)
               || jsonb_build_object(
                 'staleProcessingRecovery',
                 jsonb_build_object(
                   'reclaimedAt', timezone('utc', now()),
                   'previousStartedAt', bsj.started_at,
                   'previousAttempts', bsj.attempts,
                   'source', 'claim_buk_sync_jobs'
                 )
               )
             else bsj.result_snapshot
           end
      from selected_jobs sj
     where bsj.id = sj.id
     returning
       bsj.id,
       bsj.recruitment_case_candidate_id,
       bsj.status,
       bsj.attempts,
       bsj.payload_snapshot,
       bsj.result_snapshot
  )
  select
    updated_jobs.id,
    updated_jobs.recruitment_case_candidate_id,
    updated_jobs.status,
    updated_jobs.attempts,
    updated_jobs.payload_snapshot,
    updated_jobs.result_snapshot
  from updated_jobs;
end;
$function$;

revoke all on function public.claim_buk_sync_jobs(integer, uuid[])
  from public, anon, authenticated;

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
  stale_cutoff timestamptz := timezone('utc', now()) - interval '15 minutes';
  capacity_record record;
  batch_reserved_by_case jsonb := '{}'::jsonb;
  batch_reserved_for_case integer := 0;
  remaining_capacity integer := 0;
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
    select *
    from (
      select distinct on (rcc.id)
        rcc.id,
        rcc.recruitment_case_id,
        rcc.candidate_profile_id,
        rcc.stage_code,
        rc.case_code,
        input_candidate.input_order
      from unnest(coalesce(p_candidate_ids, '{}'::uuid[])) with ordinality
        as input_candidate(candidate_id, input_order)
      join public.recruitment_case_candidates rcc
        on rcc.id = input_candidate.candidate_id
      join public.recruitment_cases rc
        on rc.id = rcc.recruitment_case_id
      order by rcc.id, input_candidate.input_order
    ) deduplicated_candidates
    order by deduplicated_candidates.input_order
  loop
    if not (
      public.user_can_manage_recruitment_case(current_user_id, candidate_row.recruitment_case_id)
      or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_row.id)
    ) then
      raise exception 'Sin permisos para encolar el candidato %', candidate_row.id;
    end if;

    if candidate_row.stage_code <> 'ready_for_hire' then
      raise exception 'El candidato % debe estar Listo para contratar antes de generar en BUK', candidate_row.id;
    end if;

    select *
      into existing_job
      from public.buk_sync_jobs bsj
     where bsj.recruitment_case_candidate_id = candidate_row.id
       and bsj.status in ('pending', 'processing')
     order by bsj.created_at desc
     limit 1
     for update;

    if existing_job.id is not null then
      if existing_job.status = 'processing'
         and existing_job.finished_at is null
         and existing_job.started_at is not null
         and existing_job.started_at < stale_cutoff then
        update public.buk_sync_jobs bsj
           set status = 'pending',
               error_message = null,
               result_snapshot = coalesce(bsj.result_snapshot, '{}'::jsonb)
                 || jsonb_build_object(
                   'staleProcessingRecovery',
                   jsonb_build_object(
                     'requeuedAt', timezone('utc', now()),
                     'previousStartedAt', bsj.started_at,
                     'previousAttempts', bsj.attempts,
                     'source', 'enqueue_buk_generation'
                   )
                 )
         where bsj.id = existing_job.id
         returning * into existing_job;
      end if;

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

    perform 1
    from public.recruitment_cases rc
    where rc.id = candidate_row.recruitment_case_id
    for update;

    select *
      into capacity_record
      from public.get_recruitment_case_buk_capacity_snapshot(
        candidate_row.recruitment_case_id,
        candidate_row.id,
        true
      );

    if capacity_record.requested_vacancies is null then
      raise exception 'No existe el caso de reclutamiento asociado al candidato %', candidate_row.id;
    end if;

    batch_reserved_for_case := coalesce(
      (batch_reserved_by_case ->> candidate_row.recruitment_case_id::text)::integer,
      0
    );
    remaining_capacity := capacity_record.available_vacancies - batch_reserved_for_case;

    if remaining_capacity <= 0 then
      raise exception
        'No hay cupos disponibles para generar en BUK en el caso %. Cupos solicitados: %, ocupados/reservados: %.',
        candidate_row.case_code,
        capacity_record.requested_vacancies,
        capacity_record.occupied_vacancies + batch_reserved_for_case;
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

    batch_reserved_by_case := batch_reserved_by_case
      || jsonb_build_object(candidate_row.recruitment_case_id::text, batch_reserved_for_case + 1);

    job_id := new_job_id;
    recruitment_case_candidate_id := candidate_row.id;
    status := 'pending';
    return next;
  end loop;
end;
$function$;

revoke all on function public.enqueue_buk_generation(uuid[]) from public, anon;
grant execute on function public.enqueue_buk_generation(uuid[]) to authenticated;

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
        'has_buk_generation_success', successful_buk_job.id is not null,
        'requested_vacancies', coalesce(capacity_snapshot.requested_vacancies, rc.requested_vacancies),
        'buk_occupied_vacancies', coalesce(capacity_snapshot.occupied_vacancies, 0),
        'buk_available_vacancies', coalesce(capacity_snapshot.available_vacancies, 0),
        'buk_generation_blocked', normalized_stage_code = 'ready_for_hire'
          and coalesce(capacity_snapshot.available_vacancies, 0) <= 0,
        'buk_generation_block_reason', case
          when normalized_stage_code = 'ready_for_hire'
           and coalesce(capacity_snapshot.available_vacancies, 0) <= 0
            then format(
              'Caso sin cupos disponibles: %s solicitados, %s ocupados/reservados.',
              coalesce(capacity_snapshot.requested_vacancies, rc.requested_vacancies),
              coalesce(capacity_snapshot.occupied_vacancies, 0)
            )
          else null
        end
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
    left join lateral (
      select *
      from public.get_recruitment_case_buk_capacity_snapshot(
        rcc.recruitment_case_id,
        rcc.id,
        true
      )
    ) as capacity_snapshot on true
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

create or replace function public.get_recruitment_personnel_to_hire_page(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language sql
security definer
set search_path = public
as $function$
  select public.get_recruitment_personnel_page_bucket(
    p_search,
    p_limit,
    p_offset,
    'ready_for_hire'
  );
$function$;

create or replace function public.get_recruitment_contracted_personnel_page(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language sql
security definer
set search_path = public
as $function$
  select public.get_recruitment_personnel_page_bucket(
    p_search,
    p_limit,
    p_offset,
    'hired'
  );
$function$;

revoke all on function public.get_recruitment_personnel_page_bucket(text, integer, integer, text)
  from public, anon;
revoke all on function public.get_recruitment_personnel_to_hire_page(text, integer, integer)
  from public, anon;
revoke all on function public.get_recruitment_contracted_personnel_page(text, integer, integer)
  from public, anon;
grant execute on function public.get_recruitment_personnel_to_hire_page(text, integer, integer)
  to authenticated;
grant execute on function public.get_recruitment_contracted_personnel_page(text, integer, integer)
  to authenticated;

notify pgrst, 'reload schema';

commit;
