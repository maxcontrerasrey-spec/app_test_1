begin;

create index if not exists idx_internal_mobility_requests_destination_contract_id
  on public.internal_mobility_requests (destination_contract_id);

create index if not exists idx_internal_mobility_requests_submitted_by
  on public.internal_mobility_requests (submitted_by);

create index if not exists idx_internal_mobility_requests_final_decided_by
  on public.internal_mobility_requests (final_decided_by);

create or replace function public.normalize_recruitment_search_text(p_value text)
returns text
language sql
immutable
set search_path = public
as $function$
  select trim(
    regexp_replace(
      translate(
        lower(coalesce(p_value, '')),
        'áàäâãéèëêíìïîóòöôõúùüûñç',
        'aaaaaeeeeiiiiooooouuuunc'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$function$;

create or replace function public.get_recruitment_control_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  can_access_candidate_control boolean := false;
  pending_approval_count bigint := 0;
  active_case_count bigint := 0;
  ready_case_count bigint := 0;
  filled_case_count bigint := 0;
  total_case_count bigint := 0;
  candidates_in_progress_count bigint := 0;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  can_access_candidate_control := public.user_can_access_candidate_control(current_user_id);

  select count(*)
    into pending_approval_count
  from public.hiring_request_approvals hra
  join public.hiring_requests hr
    on hr.id = hra.hiring_request_id
  where hra.step_code in ('area_manager', 'contracts_control')
    and hra.status = 'pending'
    and hr.status not in ('closed', 'rejected')
    and (
      public.user_is_admin(current_user_id)
      or public.user_has_role(current_user_id, 'reclutamiento')
      or hra.approver_user_id = current_user_id
      or (
        hra.step_code = 'contracts_control'
        and public.user_has_role(current_user_id, 'control_contratos')
      )
    );

  select
    count(*) filter (where rc.status not in ('filled', 'closed_unfilled', 'cancelled')),
    count(*) filter (where rc.status = 'ready_to_hire'),
    count(*) filter (where rc.status = 'filled'),
    count(*)
  into
    active_case_count,
    ready_case_count,
    filled_case_count,
    total_case_count
  from public.recruitment_cases rc
  join public.hiring_requests hr
    on hr.id = rc.hiring_request_id
  where public.user_can_view_hiring_request_process_summary(
    current_user_id,
    hr.requester_id,
    hr.cost_center_code
  );

  if can_access_candidate_control then
    select count(*)
      into candidates_in_progress_count
    from public.recruitment_case_candidates rcc
    join public.recruitment_cases rc
      on rc.id = rcc.recruitment_case_id
    where public.user_can_access_recruitment_case(current_user_id, rc.id)
      and rc.status not in ('filled', 'closed_unfilled', 'cancelled')
      and rcc.stage_code not in ('hired', 'rejected', 'withdrawn');
  end if;

  return jsonb_build_object(
    'pending_contracts_control', pending_approval_count,
    'pending_approval_count', pending_approval_count,
    'active_cases', active_case_count,
    'ready_to_hire_cases', ready_case_count,
    'filled_cases', filled_case_count,
    'total_cases', total_case_count,
    'candidates_in_progress', candidates_in_progress_count
  );
end;
$function$;

create or replace function public.get_recruitment_pending_approvals_page(
  p_limit integer default 50,
  p_offset integer default 0
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
  items jsonb := '[]'::jsonb;
  total_count bigint := 0;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  with filtered as (
    select
      hra.id,
      jsonb_build_object(
        'id', hra.id,
        'step_code', hra.step_code,
        'step_name', hra.step_name,
        'hiring_request_id', hra.hiring_request_id,
        'approver_user_id', hra.approver_user_id,
        'approver_name', hra.approver_name,
        'approver_email', hra.approver_email,
        'created_at', hra.created_at,
        'hiring_requests', jsonb_build_object(
          'folio', hr.folio,
          'status', hr.status,
          'requester_name', hr.requester_name,
          'requester_email', hr.requester_email,
          'contract_name', hr.contract_name,
          'contract_number', hr.contract_number,
          'job_position_name', hr.job_position_name,
          'vacancies', hr.vacancies,
          'requested_entry_date', hr.requested_entry_date,
          'start_date', hr.start_date,
          'end_date', hr.end_date,
          'shift_name', hr.shift_name,
          'salary_offer', hr.salary_offer,
          'campamento', hr.campamento,
          'pasajes', hr.pasajes,
          'travel_methodology', hr.travel_methodology,
          'other_benefits', hr.other_benefits
        )
      ) as payload,
      hra.created_at
    from public.hiring_request_approvals hra
    join public.hiring_requests hr
      on hr.id = hra.hiring_request_id
    where hra.step_code in ('area_manager', 'contracts_control')
      and hra.status = 'pending'
      and hr.status not in ('closed', 'rejected')
      and (
        public.user_is_admin(current_user_id)
        or public.user_has_role(current_user_id, 'reclutamiento')
        or hra.approver_user_id = current_user_id
        or (
          hra.step_code = 'contracts_control'
          and public.user_has_role(current_user_id, 'control_contratos')
        )
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
      order by filtered.created_at asc, filtered.id asc
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

create or replace function public.get_recruitment_processes_page(
  p_search text default null,
  p_status_filter text default null,
  p_sort_column text default null,
  p_sort_direction text default 'asc',
  p_limit integer default 50,
  p_offset integer default 0
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
  normalized_filter text := nullif(trim(coalesce(p_status_filter, '')), '');
  normalized_sort_column text := lower(nullif(trim(coalesce(p_sort_column, '')), ''));
  normalized_sort_direction text := case when lower(coalesce(p_sort_direction, 'asc')) = 'desc' then 'desc' else 'asc' end;
  items jsonb := '[]'::jsonb;
  total_count bigint := 0;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if normalized_search <> '' then
    search_terms := regexp_split_to_array(normalized_search, '\s+');
  end if;

  if normalized_sort_column not in (
    'case_code',
    'status',
    'job_position_name',
    'contract_name',
    'vacancies',
    'candidate_count',
    'requester_name'
  ) then
    normalized_sort_column := null;
  end if;

  with case_union as (
    select
      rc.id::text as stable_id,
      rc.case_code,
      rc.status::text as row_status,
      rc.job_position_name,
      rc.contract_name,
      coalesce(case_metrics.effective_active_candidates, 0)::integer as candidate_count,
      coalesce(case_metrics.effective_filled_vacancies, 0)::integer as filled_vacancies,
      rc.requested_vacancies::integer as requested_vacancies,
      hr.requester_name,
      rc.opened_at as sort_opened_at,
      public.normalize_recruitment_search_text(
        concat_ws(
          ' ',
          rc.case_code,
          hr.folio,
          rc.title,
          rc.contract_name,
          rc.job_position_name,
          rc.cost_center_name,
          rc.cost_center_code,
          hr.requester_name,
          hr.requester_email,
          owner_profile.full_name,
          hr.shift_name,
          hr.travel_methodology,
          hr.other_benefits
        )
      ) as search_haystack,
      jsonb_build_object(
        'id', rc.id,
        'source_type', 'case',
        'hiring_request_id', hr.id,
        'folio', hr.folio,
        'case_code', rc.case_code,
        'status', rc.status,
        'requested_vacancies', rc.requested_vacancies,
        'filled_vacancies', coalesce(case_metrics.effective_filled_vacancies, 0),
        'title', rc.title,
        'contract_name', rc.contract_name,
        'job_position_name', rc.job_position_name,
        'cost_center_code', rc.cost_center_code,
        'cost_center_name', rc.cost_center_name,
        'requested_entry_date', rc.requested_entry_date,
        'target_close_date', rc.target_close_date,
        'opened_at', rc.opened_at,
        'requester_name', hr.requester_name,
        'requester_email', hr.requester_email,
        'hiring_request_status', hr.status,
        'can_close_request', public.user_can_close_hiring_request(current_user_id, hr.id),
        'owner_name', owner_profile.full_name,
        'owner_user_id', owner_assignment.user_id,
        'candidate_count', coalesce(case_metrics.effective_active_candidates, 0),
        'ready_candidates', coalesce(case_metrics.ready_candidate_count, 0),
        'hired_candidates', coalesce(case_metrics.effective_filled_vacancies, 0),
        'mobility_active_count', coalesce(case_metrics.pending_mobility_count, 0),
        'mobility_approved_count', coalesce(case_metrics.approved_mobility_count, 0),
        'start_date', hr.start_date,
        'end_date', hr.end_date,
        'shift_name', hr.shift_name,
        'turno', hr.shift_name,
        'salary_offer', hr.salary_offer,
        'salary', hr.salary_offer,
        'campamento', hr.campamento,
        'pasajes', hr.pasajes,
        'travel_methodology', hr.travel_methodology,
        'other_benefits', hr.other_benefits,
        'approval_summary', case
          when latest_approval.id is null then null
          else jsonb_build_object(
            'step_name', latest_approval.step_name,
            'status', latest_approval.status,
            'decision_comment', latest_approval.decision_comment,
            'decided_at', latest_approval.decided_at,
            'decided_by_name', latest_approval.decided_by_name
          )
        end
      ) as payload
    from public.recruitment_cases rc
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
    left join lateral public.get_recruitment_case_effective_metrics(rc.id) as case_metrics on true
    left join lateral (
      select
        hra.id,
        hra.step_name,
        hra.status,
        hra.decision_comment,
        hra.decided_at,
        decision_profile.full_name as decided_by_name
      from public.hiring_request_approvals hra
      left join public.profiles decision_profile
        on decision_profile.id = hra.decision_by
      where hra.hiring_request_id = hr.id
      order by coalesce(hra.decided_at, hra.created_at) desc, hra.id desc
      limit 1
    ) as latest_approval on true
    where public.user_can_view_hiring_request_process_summary(
      current_user_id,
      hr.requester_id,
      hr.cost_center_code
    )

    union all

    select
      hr.id::text as stable_id,
      coalesce(hr.folio, 'Sin folio') as case_code,
      'cancelled' as row_status,
      hr.job_position_name,
      hr.contract_name,
      0 as candidate_count,
      0 as filled_vacancies,
      coalesce(hr.vacancies, 0)::integer as requested_vacancies,
      hr.requester_name,
      coalesce(hr.rejected_at, hr.updated_at, hr.submitted_at, hr.created_at) as sort_opened_at,
      public.normalize_recruitment_search_text(
        concat_ws(
          ' ',
          hr.folio,
          hr.job_position_name,
          hr.contract_name,
          hr.cost_center_name,
          hr.cost_center_code,
          hr.requester_name,
          hr.requester_email,
          hr.shift_name,
          hr.travel_methodology,
          hr.other_benefits
        )
      ) as search_haystack,
      jsonb_build_object(
        'id', hr.id,
        'source_type', 'request',
        'hiring_request_id', hr.id,
        'folio', hr.folio,
        'case_code', coalesce(hr.folio, 'Sin folio'),
        'status', 'cancelled',
        'requested_vacancies', coalesce(hr.vacancies, 0),
        'filled_vacancies', 0,
        'title', coalesce(hr.folio, 'Borrador') || ' - ' || hr.job_position_name,
        'contract_name', hr.contract_name,
        'job_position_name', hr.job_position_name,
        'cost_center_code', hr.cost_center_code,
        'cost_center_name', hr.cost_center_name,
        'requested_entry_date', hr.requested_entry_date,
        'target_close_date', null,
        'opened_at', coalesce(hr.rejected_at, hr.updated_at, hr.submitted_at, hr.created_at),
        'requester_name', hr.requester_name,
        'requester_email', hr.requester_email,
        'hiring_request_status', hr.status,
        'can_close_request', false,
        'owner_name', null,
        'owner_user_id', null,
        'candidate_count', 0,
        'ready_candidates', 0,
        'hired_candidates', 0,
        'mobility_active_count', 0,
        'mobility_approved_count', 0,
        'start_date', hr.start_date,
        'end_date', hr.end_date,
        'shift_name', hr.shift_name,
        'turno', hr.shift_name,
        'salary_offer', hr.salary_offer,
        'salary', hr.salary_offer,
        'campamento', hr.campamento,
        'pasajes', hr.pasajes,
        'travel_methodology', hr.travel_methodology,
        'other_benefits', hr.other_benefits,
        'approval_summary', case
          when latest_approval.id is null then null
          else jsonb_build_object(
            'step_name', latest_approval.step_name,
            'status', latest_approval.status,
            'decision_comment', latest_approval.decision_comment,
            'decided_at', latest_approval.decided_at,
            'decided_by_name', latest_approval.decided_by_name
          )
        end
      ) as payload
    from public.hiring_requests hr
    left join public.recruitment_cases rc
      on rc.hiring_request_id = hr.id
    left join lateral (
      select
        hra.id,
        hra.step_name,
        hra.status,
        hra.decision_comment,
        hra.decided_at,
        decision_profile.full_name as decided_by_name
      from public.hiring_request_approvals hra
      left join public.profiles decision_profile
        on decision_profile.id = hra.decision_by
      where hra.hiring_request_id = hr.id
      order by coalesce(hra.decided_at, hra.created_at) desc, hra.id desc
      limit 1
    ) as latest_approval on true
    where rc.id is null
      and hr.status in ('rejected', 'closed')
      and public.user_can_view_hiring_request_process_summary(
        current_user_id,
        hr.requester_id,
        hr.cost_center_code
      )
  ),
  filtered as (
    select *
    from case_union cu
    where (
        (
          normalized_filter is null
          and cu.row_status in ('open', 'sourcing', 'screening', 'ready_to_hire', 'partially_filled')
        )
        or (normalized_filter = 'cancelled' and cu.row_status in ('cancelled', 'closed_unfilled'))
        or (normalized_filter is not null and normalized_filter <> 'cancelled' and cu.row_status = normalized_filter)
      )
      and (
        cardinality(search_terms) = 0
        or not exists (
          select 1
          from unnest(search_terms) as term(value)
          where cu.search_haystack not like '%' || term.value || '%'
        )
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
        case when normalized_sort_column = 'case_code' and normalized_sort_direction = 'asc' then filtered.case_code end asc nulls last,
        case when normalized_sort_column = 'case_code' and normalized_sort_direction = 'desc' then filtered.case_code end desc nulls last,
        case when normalized_sort_column = 'status' and normalized_sort_direction = 'asc' then filtered.row_status end asc nulls last,
        case when normalized_sort_column = 'status' and normalized_sort_direction = 'desc' then filtered.row_status end desc nulls last,
        case when normalized_sort_column = 'job_position_name' and normalized_sort_direction = 'asc' then filtered.job_position_name end asc nulls last,
        case when normalized_sort_column = 'job_position_name' and normalized_sort_direction = 'desc' then filtered.job_position_name end desc nulls last,
        case when normalized_sort_column = 'contract_name' and normalized_sort_direction = 'asc' then filtered.contract_name end asc nulls last,
        case when normalized_sort_column = 'contract_name' and normalized_sort_direction = 'desc' then filtered.contract_name end desc nulls last,
        case when normalized_sort_column = 'vacancies' and normalized_sort_direction = 'asc' then filtered.requested_vacancies end asc nulls last,
        case when normalized_sort_column = 'vacancies' and normalized_sort_direction = 'desc' then filtered.requested_vacancies end desc nulls last,
        case when normalized_sort_column = 'candidate_count' and normalized_sort_direction = 'asc' then filtered.candidate_count end asc nulls last,
        case when normalized_sort_column = 'candidate_count' and normalized_sort_direction = 'desc' then filtered.candidate_count end desc nulls last,
        case when normalized_sort_column = 'requester_name' and normalized_sort_direction = 'asc' then filtered.requester_name end asc nulls last,
        case when normalized_sort_column = 'requester_name' and normalized_sort_direction = 'desc' then filtered.requester_name end desc nulls last,
        filtered.sort_opened_at desc,
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

create or replace function public.get_recruitment_candidates_page(
  p_search text default null,
  p_stage_filter text default 'active',
  p_limit integer default 50,
  p_offset integer default 0
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
  normalized_stage_filter text := coalesce(nullif(trim(p_stage_filter), ''), 'active');
  items jsonb := '[]'::jsonb;
  total_count bigint := 0;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_candidate_control(current_user_id) then
    return jsonb_build_object('items', '[]'::jsonb, 'total_count', 0);
  end if;

  if normalized_search <> '' then
    search_terms := regexp_split_to_array(normalized_search, '\s+');
  end if;

  with candidate_rows as (
    select
      rcc.id::text as stable_id,
      rc.status as case_status,
      rcc.stage_code,
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
      case
        when rc.status = 'ready_to_hire' then 0
        when rc.status = 'screening' then 1
        when rc.status = 'open' then 2
        when rc.status = 'sourcing' then 3
        when rc.status = 'partially_filled' then 4
        when rc.status = 'filled' then 5
        else 6
      end as sort_case_status_priority,
      rc.opened_at as sort_case_opened_at,
      case rcc.stage_code
        when 'ready_for_hire' then 0
        when 'document_review' then 1
        when 'medical_exams' then 2
        when 'who_pending' then 3
        when 'who_approved' then 4
        when 'lead' then 5
        when 'hired' then 6
        else 7
      end as sort_stage_rank,
      rcc.created_at as sort_candidate_created_at,
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
        'active_process_count', coalesce(active_processes.active_process_count, 0),
        'contract_locked_case_id', contract_lock.recruitment_case_id,
        'contract_locked_case_code', contract_lock.case_code,
        'contract_locked_folio', contract_lock.folio,
        'contract_locked_stage_code', contract_lock.stage_code,
        'is_contract_path_blocked', contract_lock.case_candidate_id is not null,
        'interview_notes', rcc.interview_notes
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
      select count(*) as active_process_count
      from public.recruitment_case_candidates rcc_active
      join public.recruitment_cases rc_active
        on rc_active.id = rcc_active.recruitment_case_id
      where rcc_active.candidate_profile_id = rcc.candidate_profile_id
        and rcc_active.stage_code not in ('hired', 'rejected', 'withdrawn')
        and rc_active.status not in ('filled', 'closed_unfilled', 'cancelled')
    ) as active_processes on true
    left join lateral (
      select *
      from public.find_active_candidate_contract_lock(
        rcc.candidate_profile_id,
        rcc.id
      )
      limit 1
    ) as contract_lock on true
    where public.user_can_access_recruitment_case(current_user_id, rc.id)
  ),
  filtered as (
    select *
    from candidate_rows candidate_row
    where (
        (
          normalized_stage_filter = 'active'
          and candidate_row.case_status not in ('filled', 'closed_unfilled', 'cancelled')
          and candidate_row.stage_code not in ('hired', 'rejected', 'withdrawn')
        )
        or (
          normalized_stage_filter = 'discarded'
          and candidate_row.stage_code in ('rejected', 'withdrawn')
        )
        or (
          normalized_stage_filter not in ('active', 'discarded')
          and candidate_row.stage_code = normalized_stage_filter
        )
      )
      and (
        cardinality(search_terms) = 0
        or not exists (
          select 1
          from unnest(search_terms) as term(value)
          where candidate_row.search_haystack not like '%' || term.value || '%'
        )
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
        filtered.sort_case_status_priority asc,
        filtered.sort_case_opened_at desc,
        filtered.sort_stage_rank asc,
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
  items jsonb := '[]'::jsonb;
  total_count bigint := 0;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_candidate_control(current_user_id) then
    return jsonb_build_object('items', '[]'::jsonb, 'total_count', 0);
  end if;

  if normalized_search <> '' then
    search_terms := regexp_split_to_array(normalized_search, '\s+');
  end if;

  with hired_rows as (
    select
      rcc.id::text as stable_id,
      rc.opened_at as sort_case_opened_at,
      coalesce(rcc.hired_at, rcc.updated_at, rcc.created_at) as sort_hired_at,
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
        'hired_at', rcc.hired_at
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
    where public.user_can_access_recruitment_case(current_user_id, rc.id)
      and rcc.stage_code = 'hired'
  ),
  filtered as (
    select *
    from hired_rows hired_row
    where cardinality(search_terms) = 0
       or not exists (
        select 1
        from unnest(search_terms) as term(value)
        where hired_row.search_haystack not like '%' || term.value || '%'
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
        filtered.sort_case_opened_at desc,
        filtered.sort_hired_at desc,
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

create or replace function public.get_recruitment_active_case_options(
  p_search text default null,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 500), 1), 500);
  normalized_search text := public.normalize_recruitment_search_text(p_search);
  search_terms text[] := array[]::text[];
  items jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_candidate_control(current_user_id) then
    return '[]'::jsonb;
  end if;

  if normalized_search <> '' then
    search_terms := regexp_split_to_array(normalized_search, '\s+');
  end if;

  with option_rows as (
    select
      rc.id::text as stable_id,
      rc.opened_at,
      public.normalize_recruitment_search_text(
        concat_ws(
          ' ',
          rc.case_code,
          hr.folio,
          rc.title,
          rc.contract_name,
          rc.job_position_name,
          rc.cost_center_name,
          rc.cost_center_code
        )
      ) as search_haystack,
      jsonb_build_object(
        'id', rc.id,
        'source_type', 'case',
        'hiring_request_id', hr.id,
        'folio', hr.folio,
        'case_code', rc.case_code,
        'status', rc.status,
        'requested_vacancies', rc.requested_vacancies,
        'filled_vacancies', coalesce(case_metrics.effective_filled_vacancies, 0),
        'title', rc.title,
        'contract_name', rc.contract_name,
        'job_position_name', rc.job_position_name,
        'cost_center_code', rc.cost_center_code,
        'cost_center_name', rc.cost_center_name,
        'requested_entry_date', rc.requested_entry_date,
        'target_close_date', rc.target_close_date,
        'opened_at', rc.opened_at,
        'requester_name', hr.requester_name,
        'requester_email', hr.requester_email,
        'hiring_request_status', hr.status,
        'can_close_request', false,
        'owner_name', owner_profile.full_name,
        'owner_user_id', owner_assignment.user_id,
        'candidate_count', coalesce(case_metrics.effective_active_candidates, 0),
        'ready_candidates', coalesce(case_metrics.ready_candidate_count, 0),
        'hired_candidates', coalesce(case_metrics.effective_filled_vacancies, 0),
        'mobility_active_count', coalesce(case_metrics.pending_mobility_count, 0),
        'mobility_approved_count', coalesce(case_metrics.approved_mobility_count, 0),
        'start_date', hr.start_date,
        'end_date', hr.end_date,
        'shift_name', hr.shift_name,
        'turno', hr.shift_name,
        'salary_offer', hr.salary_offer,
        'salary', hr.salary_offer,
        'campamento', hr.campamento,
        'pasajes', hr.pasajes,
        'travel_methodology', hr.travel_methodology,
        'other_benefits', hr.other_benefits,
        'approval_summary', null
      ) as payload
    from public.recruitment_cases rc
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
    left join lateral public.get_recruitment_case_effective_metrics(rc.id) as case_metrics on true
    where rc.status not in ('filled', 'closed_unfilled', 'cancelled')
      and public.user_can_view_hiring_request_process_summary(
        current_user_id,
        hr.requester_id,
        hr.cost_center_code
      )
      and coalesce(case_metrics.available_vacancies, rc.requested_vacancies - rc.filled_vacancies) > 0
      and (
        cardinality(search_terms) = 0
        or not exists (
          select 1
          from unnest(search_terms) as term(value)
          where public.normalize_recruitment_search_text(
            concat_ws(
              ' ',
              rc.case_code,
              hr.folio,
              rc.title,
              rc.contract_name,
              rc.job_position_name,
              rc.cost_center_name,
              rc.cost_center_code
            )
          ) not like '%' || term.value || '%'
        )
      )
  ),
  ordered_options as (
    select
      ordered_rows.payload,
      row_number() over () as row_order
    from (
      select option_rows.payload
      from option_rows
      order by option_rows.opened_at desc, option_rows.stable_id asc
      limit safe_limit
    ) ordered_rows
  )
  select coalesce(jsonb_agg(ordered_options.payload order by ordered_options.row_order), '[]'::jsonb)
  into items
  from ordered_options;

  return coalesce(items, '[]'::jsonb);
end;
$function$;

create or replace function public.recompute_buk_contract_mapping_one_to_one(p_contract_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  active_mapping_count integer := 0;
begin
  if p_contract_id is null then
    return;
  end if;

  select count(*)
    into active_mapping_count
  from public.buk_contract_mappings bcm
  where bcm.is_operational = true
    and bcm.contract_id = p_contract_id;

  update public.buk_contract_mappings bcm
  set
    is_one_to_one = (active_mapping_count = 1),
    updated_at = timezone('utc', now())
  where bcm.contract_id = p_contract_id
    and bcm.is_operational = true
    and bcm.is_one_to_one is distinct from (active_mapping_count = 1);

  update public.buk_contract_mappings bcm
  set
    is_one_to_one = false,
    updated_at = timezone('utc', now())
  where bcm.contract_id = p_contract_id
    and bcm.is_operational is distinct from true
    and bcm.is_one_to_one is distinct from false;
end;
$function$;

create or replace function public.trg_recompute_buk_contract_mapping_one_to_one()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recompute_buk_contract_mapping_one_to_one(old.contract_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recompute_buk_contract_mapping_one_to_one(new.contract_id);

    if new.contract_id is null
       and new.is_one_to_one is distinct from false then
      update public.buk_contract_mappings
      set
        is_one_to_one = false,
        updated_at = timezone('utc', now())
      where id = new.id;
    end if;
  end if;

  return coalesce(new, old);
end;
$function$;

with operational_contract_usage as (
  select
    bcm.contract_id,
    count(*) as mapping_count
  from public.buk_contract_mappings bcm
  where bcm.is_operational = true
    and bcm.contract_id is not null
  group by bcm.contract_id
)
update public.buk_contract_mappings bcm
set
  is_one_to_one = (ocu.mapping_count = 1),
  updated_at = timezone('utc', now())
from operational_contract_usage ocu
where bcm.is_operational = true
  and bcm.contract_id = ocu.contract_id
  and bcm.is_one_to_one is distinct from (ocu.mapping_count = 1);

update public.buk_contract_mappings bcm
set
  is_one_to_one = false,
  updated_at = timezone('utc', now())
where (
    bcm.contract_id is null
    or bcm.is_operational is distinct from true
  )
  and bcm.is_one_to_one is distinct from false;

drop trigger if exists trg_buk_contract_mapping_one_to_one_guard on public.buk_contract_mappings;
create trigger trg_buk_contract_mapping_one_to_one_guard
after insert or update of contract_id, is_operational, is_one_to_one or delete
on public.buk_contract_mappings
for each row
execute function public.trg_recompute_buk_contract_mapping_one_to_one();

create or replace function public.trg_internal_mobility_pending_email_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status = 'pending'
     and new.step_code in ('area_manager', 'contracts_control')
     and (
       tg_op = 'INSERT'
       or (
         tg_op = 'UPDATE'
         and old.status is distinct from new.status
       )
     ) then
    perform public.enqueue_internal_mobility_pending_approval_email(new.id);
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_internal_mobility_pending_email_dispatch
  on public.internal_mobility_request_approvals;

create trigger trg_internal_mobility_pending_email_dispatch
after insert or update of status
on public.internal_mobility_request_approvals
for each row
when (new.status = 'pending')
execute function public.trg_internal_mobility_pending_email_dispatch();

revoke all on function public.normalize_recruitment_search_text(text) from public, anon;
grant execute on function public.normalize_recruitment_search_text(text) to authenticated;

revoke all on function public.get_recruitment_control_summary() from public, anon;
grant execute on function public.get_recruitment_control_summary() to authenticated;

revoke all on function public.get_recruitment_pending_approvals_page(integer, integer) from public, anon;
grant execute on function public.get_recruitment_pending_approvals_page(integer, integer) to authenticated;

revoke all on function public.get_recruitment_processes_page(text, text, text, text, integer, integer) from public, anon;
grant execute on function public.get_recruitment_processes_page(text, text, text, text, integer, integer) to authenticated;

revoke all on function public.get_recruitment_candidates_page(text, text, integer, integer) from public, anon;
grant execute on function public.get_recruitment_candidates_page(text, text, integer, integer) to authenticated;

revoke all on function public.get_recruitment_personnel_to_hire_page(text, integer, integer) from public, anon;
grant execute on function public.get_recruitment_personnel_to_hire_page(text, integer, integer) to authenticated;

revoke all on function public.get_recruitment_active_case_options(text, integer) from public, anon;
grant execute on function public.get_recruitment_active_case_options(text, integer) to authenticated;

revoke all on function public.recompute_buk_contract_mapping_one_to_one(bigint) from public, anon, authenticated;
revoke all on function public.trg_recompute_buk_contract_mapping_one_to_one() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
