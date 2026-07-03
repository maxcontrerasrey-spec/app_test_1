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

  if not public.user_can_access_candidate_control(current_user_id) then
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
        and bsj.status = 'success'
        and nullif(trim(coalesce(bsj.buk_employee_id, '')), '') is not null
      order by coalesce(bsj.finished_at, bsj.created_at) desc, bsj.id desc
      limit 1
    ) as successful_buk_job on true
    where public.user_can_access_recruitment_case(current_user_id, rc.id)
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
