-- EEES-DB-005: approved
-- owner: Product owner request for the external ERP security and scalability audit.
-- rollback: revert the frontend to the compatible v1 RPC while retaining v2 and its authenticated-only grant; remove v2 only through a later reviewed migration after checking deployed consumers.

begin;

create or replace function public.get_recruitment_processes_page_v2(
  p_search text default null,
  p_status_filter text default null,
  p_sort_column text default null,
  p_sort_direction text default 'asc',
  p_limit integer default 50,
  p_offset integer default 0,
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  current_user_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  filters_json jsonb := coalesce(p_filters, '{}'::jsonb);
  filter_key text;
  shift_filter text[] := array[]::text[];
  contract_filter text[] := array[]::text[];
  pasajes_filter text[] := array[]::text[];
  campamento_filter text[] := array[]::text[];
  filter_options jsonb := jsonb_build_object('shifts', '[]'::jsonb, 'contracts', '[]'::jsonb);
  status_counts jsonb := jsonb_build_object('active', 0, 'filled', 0, 'cancelled', 0);
  normalized_search text := public.normalize_recruitment_search_text(p_search);
  search_terms text[] := array[]::text[];
  normalized_filter text := nullif(trim(coalesce(p_status_filter, '')), '');
  normalized_sort_column text := lower(nullif(trim(coalesce(p_sort_column, '')), ''));
  normalized_sort_direction text := case
    when lower(coalesce(p_sort_direction, 'asc')) = 'desc' then 'desc'
    else 'asc'
  end;
  items jsonb := '[]'::jsonb;
  summary jsonb := jsonb_build_object(
    'activeCases', 0,
    'requestedVacancies', 0,
    'inProgressCandidates', 0,
    'readyToHireCases', 0,
    'filledCases', 0,
    'hiredCandidates', 0
  );
  total_count bigint := 0;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_filters is not null and jsonb_typeof(p_filters) <> 'object' then
    raise exception 'Filtros de procesos invalidos.';
  end if;

  if exists (
    select 1 from jsonb_object_keys(filters_json) as supplied(key)
    where supplied.key not in ('shift', 'contract', 'pasajes', 'campamento')
  ) then
    raise exception 'Filtro de procesos no reconocido.';
  end if;

  foreach filter_key in array array['shift', 'contract', 'pasajes', 'campamento'] loop
    if filters_json ? filter_key then
      if jsonb_typeof(filters_json -> filter_key) is distinct from 'array' then
        raise exception 'Filtro de procesos invalido.';
      end if;

      if jsonb_array_length(filters_json -> filter_key) > 100 then
        raise exception 'Filtro de procesos invalido.';
      end if;
    end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements_text(coalesce(filters_json -> 'pasajes', '[]'::jsonb)) as option_value(value)
    where lower(trim(option_value.value)) not in ('si', 'no')
  ) or exists (
    select 1 from jsonb_array_elements_text(coalesce(filters_json -> 'campamento', '[]'::jsonb)) as option_value(value)
    where lower(trim(option_value.value)) not in ('si', 'no')
  ) then
    raise exception 'Filtro booleano de procesos invalido.';
  end if;

  shift_filter := array(select distinct lower(trim(option_value.value)) from jsonb_array_elements_text(coalesce(filters_json -> 'shift', '[]'::jsonb)) as option_value(value) where trim(option_value.value) <> '');
  contract_filter := array(select distinct lower(trim(option_value.value)) from jsonb_array_elements_text(coalesce(filters_json -> 'contract', '[]'::jsonb)) as option_value(value) where trim(option_value.value) <> '');
  pasajes_filter := array(select distinct lower(trim(option_value.value)) from jsonb_array_elements_text(coalesce(filters_json -> 'pasajes', '[]'::jsonb)) as option_value(value) where trim(option_value.value) <> '');
  campamento_filter := array(select distinct lower(trim(option_value.value)) from jsonb_array_elements_text(coalesce(filters_json -> 'campamento', '[]'::jsonb)) as option_value(value) where trim(option_value.value) <> '');

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
    'requester_name',
    'opened_at'
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
      hr.shift_name as shift_filter_value,
      hr.pasajes as pasajes_filter_value,
      hr.campamento as campamento_filter_value,
      hr.folio as folio_filter_value,
      coalesce(case_metrics.effective_active_candidates, 0)::integer as candidate_count,
      coalesce(case_metrics.pending_mobility_count, 0)::integer as mobility_active_count,
      coalesce(case_metrics.effective_filled_vacancies, 0)::integer as filled_vacancies,
      coalesce(case_metrics.ready_candidate_count, 0)::integer as ready_candidates,
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
          hr.cost_unit,
          hr.cost_unit_name,
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
      order by
        case
          when hr.status = 'approved' and hra.status = 'approved' then 0
          when hr.status = 'approved' then 1
          else 0
        end asc,
        coalesce(hra.decided_at, hra.created_at) desc,
        hra.id desc
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
      hr.shift_name as shift_filter_value,
      hr.pasajes as pasajes_filter_value,
      hr.campamento as campamento_filter_value,
      hr.folio as folio_filter_value,
      0 as candidate_count,
      0 as mobility_active_count,
      0 as filled_vacancies,
      0 as ready_candidates,
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
          hr.cost_unit,
          hr.cost_unit_name,
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
  searched as (
    select *
    from case_union cu
    where (
        (
          normalized_filter is null
          and cu.row_status in ('open', 'sourcing', 'screening', 'ready_to_hire', 'partially_filled')
        )
        or (normalized_filter = 'cancelled' and cu.row_status in ('cancelled', 'closed_unfilled'))
        or (normalized_filter is not null and normalized_filter <> 'cancelled' and cu.row_status = normalized_filter)
        or normalized_filter = 'all'
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
  filter_options as (
    select jsonb_build_object(
      'shifts', coalesce((
        select jsonb_agg(jsonb_build_object('value', option_rows.value, 'label', option_rows.value) order by option_rows.value)
        from (select distinct trim(searched.shift_filter_value) as value from searched where nullif(trim(searched.shift_filter_value), '') is not null) as option_rows
      ), '[]'::jsonb),
      'contracts', coalesce((
        select jsonb_agg(jsonb_build_object('value', option_rows.value, 'label', option_rows.value) order by option_rows.value)
        from (select distinct trim(searched.contract_name) as value from searched where nullif(trim(searched.contract_name), '') is not null) as option_rows
      ), '[]'::jsonb)
    ) as value
  ),
  status_counts as (
    select jsonb_build_object(
      'active', count(*) filter (where row_status in ('open', 'sourcing', 'screening', 'ready_to_hire', 'partially_filled')),
      'filled', count(*) filter (where row_status = 'filled'),
      'cancelled', count(*) filter (where row_status in ('cancelled', 'closed_unfilled'))
    ) as value
    from searched
  ),
  filtered as (
    select *
    from searched cu
    where (cardinality(shift_filter) = 0 or lower(trim(coalesce(cu.shift_filter_value, ''))) = any(shift_filter))
      and (cardinality(contract_filter) = 0 or lower(trim(coalesce(cu.contract_name, ''))) = any(contract_filter))
      and (cardinality(pasajes_filter) = 0 or (cu.pasajes_filter_value is true and 'si' = any(pasajes_filter)) or (cu.pasajes_filter_value is false and 'no' = any(pasajes_filter)))
      and (cardinality(campamento_filter) = 0 or (cu.campamento_filter_value is true and 'si' = any(campamento_filter)) or (cu.campamento_filter_value is false and 'no' = any(campamento_filter)))
  ),
  totals as (
    select count(*) as value from filtered
  ),
  filtered_summary as (
    select jsonb_build_object(
      'activeCases', count(*)::integer,
      'requestedVacancies', coalesce(sum(filtered.requested_vacancies), 0)::integer,
      'inProgressCandidates',
        coalesce(sum(greatest(filtered.candidate_count - filtered.mobility_active_count, 0)), 0)::integer,
      'readyToHireCases', count(*) filter (where filtered.ready_candidates > 0)::integer,
      'filledCases',
        count(*) filter (
          where filtered.requested_vacancies > 0
            and filtered.filled_vacancies >= filtered.requested_vacancies
        )::integer,
      'hiredCandidates', coalesce(sum(filtered.filled_vacancies), 0)::integer
    ) as value
    from filtered
  ),
  ordered_page as (
    select
      ordered_rows.payload,
      row_number() over () as row_order
    from (
      select filtered.payload
      from filtered
      order by
        case when normalized_search <> '' and (public.normalize_recruitment_search_text(filtered.case_code) = normalized_search or public.normalize_recruitment_search_text(filtered.folio_filter_value) = normalized_search) then 0 else 1 end asc,
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
        case when normalized_sort_column = 'opened_at' and normalized_sort_direction = 'asc' then filtered.sort_opened_at end asc nulls last,
        case when normalized_sort_column = 'opened_at' and normalized_sort_direction = 'desc' then filtered.sort_opened_at end desc nulls last,
        filtered.sort_opened_at desc,
        filtered.stable_id asc
      limit safe_limit
      offset safe_offset
    ) ordered_rows
  )
  select
    coalesce(jsonb_agg(ordered_page.payload order by ordered_page.row_order), '[]'::jsonb),
    (select value from totals),
    (select value from filtered_summary),
    (select value from filter_options),
    (select value from status_counts)
  into items, total_count, summary, filter_options, status_counts
  from ordered_page;

  return jsonb_build_object(
    'items', coalesce(items, '[]'::jsonb),
    'total_count', coalesce(total_count, 0),
    'summary', coalesce(summary, jsonb_build_object(
      'activeCases', 0,
      'requestedVacancies', 0,
      'inProgressCandidates', 0,
      'readyToHireCases', 0,
      'filledCases', 0,
      'hiredCandidates', 0
    )),
    'filter_options', coalesce(filter_options, jsonb_build_object('shifts', '[]'::jsonb, 'contracts', '[]'::jsonb)),
    'status_counts', coalesce(status_counts, jsonb_build_object('active', 0, 'filled', 0, 'cancelled', 0))
  );
end;
$function$;

alter function public.get_recruitment_processes_page(text, text, text, text, integer, integer)
  set search_path = pg_catalog, public, pg_temp;

revoke all on function public.get_recruitment_processes_page_v2(text, text, text, text, integer, integer, jsonb) from public, anon;
grant execute on function public.get_recruitment_processes_page_v2(text, text, text, text, integer, integer, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
