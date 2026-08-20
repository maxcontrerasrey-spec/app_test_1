begin;

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
          ' ', cp.full_name, cp.national_id, rc.case_code, hr.folio,
          rc.contract_name, rc.job_position_name, rc.cost_center_name,
          rc.cost_center_code, owner_profile.full_name
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
        'case_code', case when normalized_stage_filter = 'without_folio' then null else rc.case_code end,
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
    join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
    join public.hiring_requests hr on hr.id = rc.hiring_request_id
    join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
    left join lateral (
      select rca.user_id
      from public.recruitment_case_assignments rca
      where rca.recruitment_case_id = rc.id and rca.is_primary = true
      order by rca.id asc
      limit 1
    ) as owner_assignment on true
    left join public.profiles owner_profile on owner_profile.id = owner_assignment.user_id
    left join lateral (
      select count(*) as active_process_count
      from public.recruitment_case_candidates rcc_active
      join public.recruitment_cases rc_active on rc_active.id = rcc_active.recruitment_case_id
      where rcc_active.candidate_profile_id = rcc.candidate_profile_id
        and rcc_active.stage_code not in ('hired', 'rejected', 'withdrawn')
        and rc_active.status not in ('filled', 'closed_unfilled', 'cancelled')
    ) as active_processes on true
    left join lateral (
      select *
      from public.find_active_candidate_contract_lock(rcc.candidate_profile_id, rcc.id)
      limit 1
    ) as contract_lock on true
    where public.user_can_access_recruitment_case(current_user_id, rc.id)
  ),
  filtered as (
    select *
    from candidate_rows candidate_row
    where (
        -- A non-empty search is global across case/stage status. The chips
        -- still control the unfiltered board, while search must locate a
        -- candidate even when the case is already covered.
        cardinality(search_terms) > 0
        or (
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
            normalized_stage_filter = 'without_folio'
            and candidate_row.case_status in ('filled', 'closed_unfilled')
            and candidate_row.stage_code not in ('hired', 'rejected', 'withdrawn')
          )
          or (
            normalized_stage_filter not in ('active', 'discarded', 'without_folio')
            and candidate_row.stage_code = normalized_stage_filter
          )
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
    select ordered_rows.payload, row_number() over () as row_order
    from (
      select filtered.payload
      from filtered
      order by filtered.sort_case_status_priority asc,
        filtered.sort_case_opened_at desc,
        filtered.sort_stage_rank asc,
        filtered.sort_candidate_created_at asc,
        filtered.stable_id asc
      limit safe_limit offset safe_offset
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

notify pgrst, 'reload schema';
commit;
