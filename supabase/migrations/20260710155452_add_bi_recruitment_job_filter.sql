begin;

drop function if exists public.get_bi_recruitment_dashboard(text, text[], text[]);
drop function if exists public.get_bi_recruitment_dashboard(text, text[], text[], text[]);

create function public.get_bi_recruitment_dashboard(
  p_period_code text default null,
  p_management_names text[] default null,
  p_contract_names text[] default null,
  p_job_position_names text[] default null
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
  normalized_jobs text[] := public.normalize_bi_text_array(p_job_position_names);
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
        coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO') as contract_name,
        coalesce(nullif(trim(rc.job_position_name), ''), 'SIN CARGO') as job_position_name
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
        and (
          coalesce(array_length(normalized_jobs, 1), 0) = 0
          or ac.job_position_name = any(normalized_jobs)
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
        and (
          coalesce(array_length(normalized_jobs, 1), 0) = 0
          or vc.job_position_name = any(normalized_jobs)
        )
    ),
    candidate_metrics as (
      select
        rcc.recruitment_case_id,
        count(*) filter (
          where rcc.stage_code not in ('hired', 'rejected', 'withdrawn')
        )::bigint as in_progress_count,
        count(*) filter (where rcc.stage_code = 'ready_for_hire')::bigint as ready_count,
        count(*) filter (where rcc.stage_code = 'hired')::bigint as hired_count
      from public.recruitment_case_candidates rcc
      join filtered_cases fc
        on fc.id = rcc.recruitment_case_id
      group by rcc.recruitment_case_id
    ),
    mobility_case_metrics as (
      select
        imr.recruitment_case_id,
        count(*) filter (where imr.status = 'approved')::bigint as approved_count
      from public.internal_mobility_requests imr
      join filtered_cases fc
        on fc.id = imr.recruitment_case_id
      group by imr.recruitment_case_id
    ),
    current_candidates as (
      select
        rcc.id,
        rcc.stage_code,
        rcc.stage_entered_at,
        rcc.hired_at,
        rcc.created_at,
        fc.contract_name
      from public.recruitment_case_candidates rcc
      join filtered_cases fc
        on fc.id = rcc.recruitment_case_id
      where rcc.stage_code not in ('hired', 'rejected', 'withdrawn')
    ),
    filtered_mobility as (
      select
        imr.id,
        imr.status,
        imr.hr_execution_status,
        coalesce(imr.submitted_at, imr.created_at) as submitted_at,
        imr.hr_execution_executed_at,
        coalesce(
          nullif(trim(vc.management_name), ''),
          nullif(trim(imr.destination_cost_center_name), ''),
          'SIN GERENCIA'
        ) as management_name,
        coalesce(nullif(trim(imr.destination_area_name), ''), 'SIN CONTRATO') as contract_name,
        coalesce(
          nullif(trim(vc.job_position_name), ''),
          nullif(trim(imr.destination_job_title), ''),
          'SIN CARGO'
        ) as job_position_name
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
          coalesce(array_length(normalized_jobs, 1), 0) = 0
          or coalesce(
            nullif(trim(vc.job_position_name), ''),
            nullif(trim(imr.destination_job_title), ''),
            'SIN CARGO'
          ) = any(normalized_jobs)
        )
        and (
          nullif(trim(coalesce(p_period_code, '')), '') is null
          or coalesce(imr.submitted_at::date, imr.created_at::date)
            between period_context.month_start and period_context.month_end
        )
    ),
    recruitment_summary as (
      select
        count(*)::bigint as open_folios,
        count(*)::bigint as open_cases,
        coalesce(sum(fc.requested_vacancies), 0)::bigint as requested_vacancies,
        coalesce(
          sum(coalesce(cm.hired_count, 0) + coalesce(mm.approved_count, 0)),
          0
        )::bigint
          as filled_vacancies,
        coalesce(sum(coalesce(cm.hired_count, 0)), 0)::bigint as filled_hired_candidates,
        coalesce(sum(coalesce(mm.approved_count, 0)), 0)::bigint as filled_mobility_approved,
        coalesce(sum(cm.in_progress_count), 0)::bigint as candidates_in_progress,
        coalesce(sum(cm.ready_count), 0)::bigint as ready_candidates
      from filtered_cases fc
      left join candidate_metrics cm
        on cm.recruitment_case_id = fc.id
      left join mobility_case_metrics mm
        on mm.recruitment_case_id = fc.id
    ),
    mobility_summary as (
      select
        count(*)::bigint as total_requests,
        count(*) filter (
          where fm.status = 'approved' and fm.hr_execution_status = 'executed'
        )::bigint as executed_requests,
        count(*) filter (
          where fm.status = 'approved' and fm.hr_execution_status = 'pending'
        )::bigint as pending_execution,
        count(*) filter (
          where fm.status in ('pending_area_manager', 'pending_contracts_control')
        )::bigint as pending_approval
      from filtered_mobility fm
    ),
    cases_by_status as (
      select
        case
          when fc.status = 'open' then 'Abiertos'
          when fc.status = 'sourcing' then 'Busqueda'
          when fc.status = 'screening' then 'Screening'
          when fc.status = 'ready_to_hire' then 'Listos para contratar'
          when fc.status = 'partially_filled' then 'Cobertura parcial'
          else fc.status
        end as label,
        count(*)::bigint as value
      from filtered_cases fc
      group by 1
    ),
    candidates_by_stage as (
      select
        case
          when cc.stage_code = 'lead' then 'Lead'
          when cc.stage_code = 'who_pending' then 'Who pendiente'
          when cc.stage_code = 'who_approved' then 'Who aprobado'
          when cc.stage_code = 'in_process' then 'En proceso'
          when cc.stage_code = 'medical_exams' then 'Examenes medicos'
          when cc.stage_code = 'document_review' then 'Revision documental'
          when cc.stage_code = 'ready_for_hire' then 'Listos para contratar'
          else cc.stage_code
        end as label,
        count(*)::bigint as value
      from current_candidates cc
      group by 1
    ),
    vacancies_by_contract as (
      select
        fc.contract_name as label,
        sum(fc.requested_vacancies)::bigint as requested,
        sum(
          coalesce(cm.hired_count, 0) + coalesce(mm.approved_count, 0)
        )::bigint as filled
      from filtered_cases fc
      left join candidate_metrics cm
        on cm.recruitment_case_id = fc.id
      left join mobility_case_metrics mm
        on mm.recruitment_case_id = fc.id
      group by fc.contract_name
    ),
    mobility_by_status as (
      select
        case
          when fm.status = 'approved' and fm.hr_execution_status = 'executed'
            then 'Ejecutadas'
          when fm.status = 'approved' and fm.hr_execution_status = 'pending'
            then 'Pendiente ejecucion RRHH'
          when fm.status = 'pending_contracts_control'
            then 'Pendiente control contratos'
          when fm.status = 'pending_area_manager'
            then 'Pendiente gerencia'
          when fm.status = 'rejected'
            then 'Rechazadas'
          else coalesce(fm.status, 'Sin estado')
        end as label,
        count(*)::bigint as value
      from filtered_mobility fm
      group by 1
    ),
    weekly_buckets as (
      select generate_series(
        period_context.month_start::timestamp,
        period_context.month_end::timestamp,
        interval '7 days'
      )::date as bucket_start
    ),
    recruitment_timeline as (
      select
        wb.bucket_start,
        to_char(wb.bucket_start, 'DD/MM') as bucket_label,
        (
          select count(*)::bigint
          from filtered_all_cases fac
          where fac.opened_at::date >= wb.bucket_start
            and fac.opened_at::date < wb.bucket_start + 7
        ) as opened_folios,
        (
          select count(*)::bigint
          from public.recruitment_case_candidates rcc
          join filtered_all_cases fac
            on fac.id = rcc.recruitment_case_id
          where rcc.stage_code = 'ready_for_hire'
            and rcc.stage_entered_at::date >= wb.bucket_start
            and rcc.stage_entered_at::date < wb.bucket_start + 7
        ) as ready_candidates,
        (
          select count(*)::bigint
          from public.recruitment_case_candidates rcc
          join filtered_all_cases fac
            on fac.id = rcc.recruitment_case_id
          where rcc.hired_at::date >= wb.bucket_start
            and rcc.hired_at::date < wb.bucket_start + 7
        ) as hired_candidates,
        (
          select count(*)::bigint
          from filtered_mobility fm
          where fm.hr_execution_executed_at::date >= wb.bucket_start
            and fm.hr_execution_executed_at::date < wb.bucket_start + 7
        ) as executed_mobilities
      from weekly_buckets wb
    ),
    management_options as (
      select distinct ac.management_name as value
      from active_cases ac
      where (
          coalesce(array_length(normalized_contracts, 1), 0) = 0
          or ac.contract_name = any(normalized_contracts)
        )
        and (
          coalesce(array_length(normalized_jobs, 1), 0) = 0
          or ac.job_position_name = any(normalized_jobs)
        )
    ),
    contract_options as (
      select distinct ac.contract_name as value
      from active_cases ac
      where (
          coalesce(array_length(normalized_managements, 1), 0) = 0
          or ac.management_name = any(normalized_managements)
        )
        and (
          coalesce(array_length(normalized_jobs, 1), 0) = 0
          or ac.job_position_name = any(normalized_jobs)
        )
    ),
    job_options as (
      select distinct ac.job_position_name as value
      from active_cases ac
      where (
          coalesce(array_length(normalized_managements, 1), 0) = 0
          or ac.management_name = any(normalized_managements)
        )
        and (
          coalesce(array_length(normalized_contracts, 1), 0) = 0
          or ac.contract_name = any(normalized_contracts)
        )
    )
    select jsonb_build_object(
      'filterOptions',
      jsonb_build_object(
        'managements',
        coalesce((
          select jsonb_agg(mo.value order by mo.value)
          from management_options mo
        ), '[]'::jsonb),
        'contracts',
        coalesce((
          select jsonb_agg(co.value order by co.value)
          from contract_options co
        ), '[]'::jsonb),
        'jobs',
        coalesce((
          select jsonb_agg(jo.value order by jo.value)
          from job_options jo
        ), '[]'::jsonb)
      ),
      'summary',
      jsonb_build_object(
        'openFolios', coalesce((select open_folios from recruitment_summary), 0),
        'openCases', coalesce((select open_cases from recruitment_summary), 0),
        'requestedVacancies', coalesce((select requested_vacancies from recruitment_summary), 0),
        'filledVacancies', coalesce((select filled_vacancies from recruitment_summary), 0),
        'filledHiredCandidates', coalesce((select filled_hired_candidates from recruitment_summary), 0),
        'filledMobilityApproved', coalesce((select filled_mobility_approved from recruitment_summary), 0),
        'candidatesInProgress', coalesce((select candidates_in_progress from recruitment_summary), 0),
        'readyCandidates', coalesce((select ready_candidates from recruitment_summary), 0),
        'mobilityRequests', coalesce((select total_requests from mobility_summary), 0),
        'mobilityExecuted', coalesce((select executed_requests from mobility_summary), 0),
        'mobilityPendingExecution', coalesce((select pending_execution from mobility_summary), 0),
        'mobilityPendingApproval', coalesce((select pending_approval from mobility_summary), 0)
      ),
      'casesByStatus',
      coalesce((
        select jsonb_agg(
          jsonb_build_object('label', cbs.label, 'value', cbs.value)
          order by cbs.value desc, cbs.label
        )
        from cases_by_status cbs
      ), '[]'::jsonb),
      'candidatesByStage',
      coalesce((
        select jsonb_agg(
          jsonb_build_object('label', cbs.label, 'value', cbs.value)
          order by cbs.value desc, cbs.label
        )
        from candidates_by_stage cbs
      ), '[]'::jsonb),
      'vacanciesByContract',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'label', vbc.label,
            'requested', vbc.requested,
            'filled', vbc.filled
          )
          order by vbc.requested desc, vbc.label
        )
        from vacancies_by_contract vbc
      ), '[]'::jsonb),
      'mobilityByStatus',
      coalesce((
        select jsonb_agg(
          jsonb_build_object('label', mbs.label, 'value', mbs.value)
          order by mbs.value desc, mbs.label
        )
        from mobility_by_status mbs
      ), '[]'::jsonb),
      'timeline',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'bucketStart', rt.bucket_start,
            'bucketLabel', rt.bucket_label,
            'openedFolios', rt.opened_folios,
            'readyCandidates', rt.ready_candidates,
            'hiredCandidates', rt.hired_candidates,
            'executedMobilities', rt.executed_mobilities
          )
          order by rt.bucket_start
        )
        from recruitment_timeline rt
      ), '[]'::jsonb)
    )
  );
end;
$function$;

revoke all on function public.get_bi_recruitment_dashboard(text, text[], text[], text[])
  from public, anon;
grant execute on function public.get_bi_recruitment_dashboard(text, text[], text[], text[])
  to authenticated;

drop function if exists public.get_bi_recruitment_daily_timeline(text, text[], text[]);
drop function if exists public.get_bi_recruitment_daily_timeline(text, text[], text[], text[]);

create function public.get_bi_recruitment_daily_timeline(
  p_period_code text default null,
  p_management_names text[] default null,
  p_contract_names text[] default null,
  p_job_position_names text[] default null
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
  normalized_jobs text[] := public.normalize_bi_text_array(p_job_position_names);
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
        coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO') as contract_name,
        coalesce(nullif(trim(rc.job_position_name), ''), 'SIN CARGO') as job_position_name
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
        and (
          coalesce(array_length(normalized_jobs, 1), 0) = 0
          or ac.job_position_name = any(normalized_jobs)
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
        and (
          coalesce(array_length(normalized_jobs, 1), 0) = 0
          or vc.job_position_name = any(normalized_jobs)
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
        coalesce(nullif(trim(imr.destination_area_name), ''), 'SIN CONTRATO') as contract_name,
        coalesce(
          nullif(trim(vc.job_position_name), ''),
          nullif(trim(imr.destination_job_title), ''),
          'SIN CARGO'
        ) as job_position_name
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
          coalesce(array_length(normalized_jobs, 1), 0) = 0
          or coalesce(
            nullif(trim(vc.job_position_name), ''),
            nullif(trim(imr.destination_job_title), ''),
            'SIN CARGO'
          ) = any(normalized_jobs)
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

revoke all on function public.get_bi_recruitment_daily_timeline(text, text[], text[], text[])
  from public, anon;
grant execute on function public.get_bi_recruitment_daily_timeline(text, text[], text[], text[])
  to authenticated;

commit;
