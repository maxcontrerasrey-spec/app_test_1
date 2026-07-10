begin;

create or replace function public.get_bi_recruitment_daily_timeline(
  p_period_code text default null,
  p_management_names text[] default null,
  p_contract_names text[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_managements text[] := public.normalize_bi_text_array(p_management_names);
  normalized_contracts text[] := public.normalize_bi_text_array(p_contract_names);
  period_context record;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  select *
    into period_context
    from public.get_bi_period_context(p_period_code);

  return (
    with visible_cases as (
      select
        rc.id,
        rc.hiring_request_id,
        rc.status,
        rc.requested_vacancies,
        rc.opened_at,
        coalesce(nullif(trim(rc.cost_center_name), ''), 'SIN GERENCIA') as management_name,
        coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO') as contract_name
      from public.recruitment_cases rc
      join public.hiring_requests hr
        on hr.id = rc.hiring_request_id
      where public.user_can_view_hiring_request_process_summary(
        current_user_id,
        hr.requester_id,
        hr.cost_center_code
      )
    ),
    active_cases as (
      select vc.*
      from visible_cases vc
      join public.hiring_requests hr
        on hr.id = vc.hiring_request_id
      where vc.status in ('open', 'sourcing', 'screening', 'ready_to_hire', 'partially_filled')
        and hr.status not in ('rejected', 'closed')
    ),
    filtered_cases as (
      select ac.*
      from active_cases ac
      where (
          coalesce(array_length(normalized_managements, 1), 0) = 0
          or ac.management_name = any(normalized_managements)
        )
        and (
          coalesce(array_length(normalized_contracts, 1), 0) = 0
          or ac.contract_name = any(normalized_contracts)
        )
    ),
    filtered_all_cases as (
      select vc.*
      from visible_cases vc
      where (
          coalesce(array_length(normalized_managements, 1), 0) = 0
          or vc.management_name = any(normalized_managements)
        )
        and (
          coalesce(array_length(normalized_contracts, 1), 0) = 0
          or vc.contract_name = any(normalized_contracts)
        )
    ),
    filtered_mobility as (
      select
        imr.id,
        imr.hr_execution_executed_at,
        coalesce(imr.submitted_at, imr.created_at) as submitted_at,
        coalesce(
          nullif(trim(vc.management_name), ''),
          nullif(trim(imr.destination_cost_center_name), ''),
          'SIN GERENCIA'
        ) as management_name,
        coalesce(nullif(trim(imr.destination_area_name), ''), 'SIN CONTRATO') as contract_name
      from public.internal_mobility_requests imr
      left join visible_cases vc
        on vc.id = imr.recruitment_case_id
      where public.user_can_view_internal_mobility_request_summary(
          current_user_id,
          imr.requester_id,
          imr.destination_cost_center_code
        )
        and (
          coalesce(array_length(normalized_managements, 1), 0) = 0
          or coalesce(
            nullif(trim(vc.management_name), ''),
            nullif(trim(imr.destination_cost_center_name), ''),
            'SIN GERENCIA'
          ) = any(normalized_managements)
        )
        and (
          coalesce(array_length(normalized_contracts, 1), 0) = 0
          or coalesce(nullif(trim(imr.destination_area_name), ''), 'SIN CONTRATO')
            = any(normalized_contracts)
        )
        and (
          nullif(trim(coalesce(p_period_code, '')), '') is null
          or coalesce(imr.submitted_at::date, imr.created_at::date)
            between period_context.month_start and period_context.month_end
        )
    ),
    requested_goal as (
      select coalesce(sum(fc.requested_vacancies), 0)::bigint as value
      from filtered_cases fc
    ),
    daily_buckets as (
      select generate_series(
        period_context.month_start::timestamp,
        period_context.month_end::timestamp,
        interval '1 day'
      )::date as bucket_start
    ),
    daily_timeline as (
      select
        db.bucket_start,
        to_char(db.bucket_start, 'DD/MM') as bucket_label,
        (
          select count(*)::bigint
          from filtered_all_cases fac
          where fac.opened_at::date = db.bucket_start
        ) as opened_folios,
        (
          select count(*)::bigint
          from public.recruitment_case_candidates rcc
          join filtered_all_cases fac
            on fac.id = rcc.recruitment_case_id
          where rcc.stage_code = 'ready_for_hire'
            and rcc.stage_entered_at::date = db.bucket_start
        ) as ready_candidates,
        (
          select count(*)::bigint
          from public.recruitment_case_candidates rcc
          join filtered_all_cases fac
            on fac.id = rcc.recruitment_case_id
          where rcc.hired_at::date = db.bucket_start
        ) as hired_candidates,
        (
          select count(*)::bigint
          from filtered_mobility fm
          where fm.hr_execution_executed_at::date = db.bucket_start
        ) as executed_mobilities,
        (select value from requested_goal) as requested_vacancies
      from daily_buckets db
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'bucketStart', dt.bucket_start,
          'bucketLabel', dt.bucket_label,
          'openedFolios', dt.opened_folios,
          'readyCandidates', dt.ready_candidates,
          'hiredCandidates', dt.hired_candidates,
          'executedMobilities', dt.executed_mobilities,
          'requestedVacancies', dt.requested_vacancies
        )
        order by dt.bucket_start
      ),
      '[]'::jsonb
    )
    from daily_timeline dt
  );
end;
$function$;

revoke all on function public.get_bi_recruitment_daily_timeline(text, text[], text[])
  from public, anon;
grant execute on function public.get_bi_recruitment_daily_timeline(text, text[], text[])
  to authenticated;

commit;
