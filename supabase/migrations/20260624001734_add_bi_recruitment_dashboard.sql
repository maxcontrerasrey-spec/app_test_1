begin;

create or replace function public.get_bi_recruitment_pipeline(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  case_status text,
  stage_code text,
  contract_name text,
  job_position_name text,
  candidate_count bigint,
  selected_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_contracts text[] := public.normalize_bi_text_array(p_contract_codes);
  normalized_contract_labels text[] := (
    select coalesce(
      array_agg(public.normalize_buk_area_name(value)),
      '{}'::text[]
    )
    from unnest(normalized_contracts) as value
  );
  normalized_jobs text[] := public.normalize_bi_text_array(p_job_titles);
  period_context record;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  select * into period_context from public.get_bi_period_context(p_period_code);

  return query
  with filtered_cases as (
    select
      rc.id,
      rc.status,
      coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO') as contract_name,
      coalesce(nullif(trim(rc.job_position_name), ''), 'SIN CARGO') as job_position_name
    from public.recruitment_cases rc
    join public.hiring_requests hr
      on hr.id = rc.hiring_request_id
    where coalesce(rc.requested_entry_date, hr.submitted_at::date, rc.created_at::date)
        between period_context.month_start and period_context.month_end
      and public.user_can_view_hiring_request_process_summary(
        current_user_id,
        hr.requester_id,
        hr.cost_center_code
      )
      and (
        coalesce(array_length(normalized_contracts, 1), 0) = 0
        or coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO') = any(normalized_contracts)
        or public.normalize_buk_area_name(coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO')) = any(normalized_contract_labels)
      )
      and (
        coalesce(array_length(normalized_jobs, 1), 0) = 0
        or coalesce(nullif(trim(rc.job_position_name), ''), 'SIN CARGO') = any(normalized_jobs)
      )
  )
  select
    fc.status as case_status,
    rcc.stage_code,
    fc.contract_name,
    fc.job_position_name,
    count(*)::bigint as candidate_count,
    count(*) filter (where rcc.is_selected = true)::bigint as selected_count
  from public.recruitment_case_candidates rcc
  join filtered_cases fc
    on fc.id = rcc.recruitment_case_id
  group by fc.status, rcc.stage_code, fc.contract_name, fc.job_position_name
  order by candidate_count desc, fc.contract_name asc, fc.job_position_name asc, rcc.stage_code asc;
end;
$function$;

create or replace function public.get_bi_hiring_velocity(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  contract_name text,
  month_start date,
  year_month text,
  hired_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_contracts text[] := public.normalize_bi_text_array(p_contract_codes);
  normalized_contract_labels text[] := (
    select coalesce(
      array_agg(public.normalize_buk_area_name(value)),
      '{}'::text[]
    )
    from unnest(normalized_contracts) as value
  );
  normalized_jobs text[] := public.normalize_bi_text_array(p_job_titles);
  period_context record;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  select * into period_context from public.get_bi_period_context(p_period_code);

  return query
  with filtered_cases as (
    select
      rc.id,
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
      and (
        coalesce(array_length(normalized_contracts, 1), 0) = 0
        or coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO') = any(normalized_contracts)
        or public.normalize_buk_area_name(coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO')) = any(normalized_contract_labels)
      )
      and (
        coalesce(array_length(normalized_jobs, 1), 0) = 0
        or coalesce(nullif(trim(rc.job_position_name), ''), 'SIN CARGO') = any(normalized_jobs)
      )
  )
  select
    fc.contract_name,
    date_trunc('month', rcc.hired_at)::date as month_start,
    to_char(rcc.hired_at, 'YYYY-MM') as year_month,
    count(*)::bigint as hired_count
  from public.recruitment_case_candidates rcc
  join filtered_cases fc
    on fc.id = rcc.recruitment_case_id
  where rcc.hired_at is not null
    and rcc.hired_at::date between period_context.month_start and period_context.month_end
  group by fc.contract_name, date_trunc('month', rcc.hired_at)::date, to_char(rcc.hired_at, 'YYYY-MM')
  order by month_start asc, fc.contract_name asc;
end;
$function$;

create or replace function public.get_bi_recruitment_dashboard(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_contracts text[] := public.normalize_bi_text_array(p_contract_codes);
  normalized_contract_labels text[] := (
    select coalesce(
      array_agg(public.normalize_buk_area_name(value)),
      '{}'::text[]
    )
    from unnest(normalized_contracts) as value
  );
  normalized_jobs text[] := public.normalize_bi_text_array(p_job_titles);
  period_context record;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  select * into period_context from public.get_bi_period_context(p_period_code);

  return (
    with filtered_requests as (
      select
        hr.id,
        hr.folio,
        hr.status,
        hr.requester_id,
        hr.cost_center_code,
        coalesce(nullif(trim(hr.contract_name), ''), 'SIN CONTRATO') as contract_name,
        coalesce(nullif(trim(hr.job_position_name), ''), 'SIN CARGO') as job_position_name,
        coalesce(hr.submitted_at, hr.created_at) as submitted_at,
        hr.created_at,
        hr.approved_at
      from public.hiring_requests hr
      where coalesce(hr.submitted_at::date, hr.created_at::date)
          between period_context.month_start and period_context.month_end
        and public.user_can_view_hiring_request_process_summary(
          current_user_id,
          hr.requester_id,
          hr.cost_center_code
        )
        and (
          coalesce(array_length(normalized_contracts, 1), 0) = 0
          or coalesce(nullif(trim(hr.contract_name), ''), 'SIN CONTRATO') = any(normalized_contracts)
          or public.normalize_buk_area_name(coalesce(nullif(trim(hr.contract_name), ''), 'SIN CONTRATO')) = any(normalized_contract_labels)
        )
        and (
          coalesce(array_length(normalized_jobs, 1), 0) = 0
          or coalesce(nullif(trim(hr.job_position_name), ''), 'SIN CARGO') = any(normalized_jobs)
        )
    ),
    filtered_cases as (
      select
        rc.id,
        rc.case_code,
        rc.status,
        coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO') as contract_name,
        coalesce(nullif(trim(rc.job_position_name), ''), 'SIN CARGO') as job_position_name,
        rc.requested_vacancies,
        rc.opened_at,
        rc.created_at,
        rc.hiring_request_id
      from public.recruitment_cases rc
      join public.hiring_requests hr
        on hr.id = rc.hiring_request_id
      where coalesce(rc.requested_entry_date, hr.submitted_at::date, rc.created_at::date)
          between period_context.month_start and period_context.month_end
        and public.user_can_view_hiring_request_process_summary(
          current_user_id,
          hr.requester_id,
          hr.cost_center_code
        )
        and (
          coalesce(array_length(normalized_contracts, 1), 0) = 0
          or coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO') = any(normalized_contracts)
          or public.normalize_buk_area_name(coalesce(nullif(trim(rc.contract_name), ''), 'SIN CONTRATO')) = any(normalized_contract_labels)
        )
        and (
          coalesce(array_length(normalized_jobs, 1), 0) = 0
          or coalesce(nullif(trim(rc.job_position_name), ''), 'SIN CARGO') = any(normalized_jobs)
        )
    ),
    filtered_candidates as (
      select
        rcc.id,
        rcc.recruitment_case_id,
        rcc.stage_code,
        rcc.is_selected,
        rcc.created_at,
        rcc.hired_at
      from public.recruitment_case_candidates rcc
      join filtered_cases fc
        on fc.id = rcc.recruitment_case_id
    ),
    filtered_approvals as (
      select
        hra.id,
        hra.hiring_request_id,
        hra.step_code,
        coalesce(nullif(trim(hra.step_name), ''), case
          when hra.step_code = 'contracts_control' then 'Control de contratos'
          when hra.step_code = 'area_manager' then 'Gerencia de área'
          else hra.step_code
        end) as step_name,
        coalesce(nullif(trim(hra.approver_name), ''), 'Sin asignar') as approver_name,
        hra.status,
        hra.created_at,
        hra.decided_at
      from public.hiring_request_approvals hra
      join filtered_requests fr
        on fr.id = hra.hiring_request_id
    ),
    filtered_mobility as (
      select
        imr.id,
        imr.status,
        imr.hr_execution_status,
        imr.requester_id,
        imr.destination_cost_center_code,
        coalesce(nullif(trim(imr.destination_area_name), ''), 'SIN CONTRATO') as contract_name,
        coalesce(nullif(trim(imr.destination_job_title), ''), 'SIN CARGO') as job_position_name,
        coalesce(imr.submitted_at, imr.created_at) as submitted_at,
        imr.approved_at,
        imr.hr_execution_executed_at
      from public.internal_mobility_requests imr
      where coalesce(imr.submitted_at::date, imr.created_at::date)
          between period_context.month_start and period_context.month_end
        and public.user_can_view_internal_mobility_request_summary(
          current_user_id,
          imr.requester_id,
          imr.destination_cost_center_code
        )
        and (
          coalesce(array_length(normalized_contracts, 1), 0) = 0
          or coalesce(nullif(trim(imr.destination_area_name), ''), 'SIN CONTRATO') = any(normalized_contracts)
          or public.normalize_buk_area_name(coalesce(nullif(trim(imr.destination_area_name), ''), 'SIN CONTRATO')) = any(normalized_contract_labels)
        )
        and (
          coalesce(array_length(normalized_jobs, 1), 0) = 0
          or coalesce(nullif(trim(imr.destination_job_title), ''), 'SIN CARGO') = any(normalized_jobs)
        )
    ),
    recruitment_summary as (
      select
        (select count(*)::bigint from filtered_requests fr where fr.status not in ('approved', 'rejected', 'closed', 'cancelled')) as open_folios,
        (select count(*)::bigint from filtered_cases fc where fc.status in ('open', 'sourcing', 'screening', 'ready_to_hire', 'partially_filled')) as open_cases,
        (select coalesce(sum(fc.requested_vacancies), 0)::bigint from filtered_cases fc where fc.status in ('open', 'sourcing', 'screening', 'ready_to_hire', 'partially_filled')) as requested_vacancies,
        (select count(*)::bigint from filtered_candidates fc where fc.stage_code not in ('hired', 'rejected', 'withdrawn')) as candidates_in_progress,
        (select count(*)::bigint from filtered_candidates fc where fc.stage_code = 'ready_for_hire') as ready_candidates,
        (select count(*)::bigint from filtered_candidates fc where fc.hired_at is not null) as hired_candidates,
        (
          select round(avg(extract(epoch from (fc.hired_at - fc.created_at)) / 86400.0)::numeric, 2)
          from filtered_candidates fc
          where fc.hired_at is not null
        ) as avg_days_to_hire,
        (
          select round(avg(extract(epoch from (fa.decided_at - fa.created_at)) / 3600.0)::numeric, 2)
          from filtered_approvals fa
          where fa.decided_at is not null
        ) as avg_approval_hours,
        (select count(*)::bigint from filtered_approvals fa where fa.status = 'pending') as pending_approvals
    ),
    mobility_summary as (
      select
        count(*)::bigint as total_requests,
        count(*) filter (where fm.status = 'approved' and fm.hr_execution_status = 'pending')::bigint as pending_execution,
        count(*) filter (where fm.status = 'approved' and fm.hr_execution_status = 'executed')::bigint as executed_requests,
        count(*) filter (where fm.status = 'rejected')::bigint as rejected_requests,
        round(avg(extract(epoch from (fm.approved_at - fm.submitted_at)) / 3600.0)::numeric, 2)
          filter (where fm.approved_at is not null) as avg_approval_hours,
        round(avg(extract(epoch from (fm.hr_execution_executed_at - fm.approved_at)) / 3600.0)::numeric, 2)
          filter (where fm.hr_execution_executed_at is not null and fm.approved_at is not null) as avg_execution_hours
      from filtered_mobility fm
    ),
    cases_by_status as (
      select
        case
          when fc.status = 'open' then 'Abiertos'
          when fc.status = 'sourcing' then 'Búsqueda'
          when fc.status = 'screening' then 'Screening'
          when fc.status = 'ready_to_hire' then 'Listos para contratar'
          when fc.status = 'partially_filled' then 'Cobertura parcial'
          when fc.status = 'filled' then 'Cubiertos'
          when fc.status = 'closed_unfilled' then 'Cerrados sin cobertura'
          when fc.status = 'cancelled' then 'Cancelados'
          else coalesce(fc.status, 'Sin estado')
        end as label,
        count(*)::bigint as value
      from filtered_cases fc
      group by 1
      order by value desc, label asc
    ),
    candidates_by_stage as (
      select
        case
          when fc.stage_code = 'lead' then 'Lead'
          when fc.stage_code = 'who_pending' then 'Who pendiente'
          when fc.stage_code = 'who_approved' then 'Who aprobado'
          when fc.stage_code = 'in_process' then 'En proceso'
          when fc.stage_code = 'medical_exams' then 'Exámenes médicos'
          when fc.stage_code = 'document_review' then 'Revisión documental'
          when fc.stage_code = 'ready_for_hire' then 'Listos para contratar'
          when fc.stage_code = 'hired' then 'Contratados'
          when fc.stage_code = 'rejected' then 'Rechazados'
          when fc.stage_code = 'withdrawn' then 'Retirados'
          else coalesce(fc.stage_code, 'Sin etapa')
        end as label,
        count(*)::bigint as value
      from filtered_candidates fc
      group by 1
      order by value desc, label asc
    ),
    approvals_by_step as (
      select
        fa.step_code,
        fa.step_name,
        count(*)::bigint as total_items,
        count(*) filter (where fa.status = 'pending')::bigint as pending_items,
        count(*) filter (where fa.decided_at is not null)::bigint as decided_items,
        round(avg(extract(epoch from (fa.decided_at - fa.created_at)) / 3600.0)::numeric, 2)
          filter (where fa.decided_at is not null) as avg_hours
      from filtered_approvals fa
      group by fa.step_code, fa.step_name
      order by avg_hours desc nulls last, total_items desc, fa.step_name asc
    ),
    approval_owners as (
      select
        fa.approver_name as label,
        count(*)::bigint as total_items,
        count(*) filter (where fa.status = 'pending')::bigint as pending_items,
        round(avg(extract(epoch from (fa.decided_at - fa.created_at)) / 3600.0)::numeric, 2)
          filter (where fa.decided_at is not null) as avg_hours
      from filtered_approvals fa
      group by fa.approver_name
      order by avg_hours desc nulls last, total_items desc, fa.approver_name asc
      limit 10
    ),
    mobility_by_status as (
      select
        case
          when fm.status = 'approved' and fm.hr_execution_status = 'pending' then 'Pendiente ejecución RRHH'
          when fm.status = 'approved' and fm.hr_execution_status = 'executed' then 'Ejecutadas'
          when fm.status = 'rejected' then 'Rechazadas'
          when fm.status = 'pending_contracts_control' then 'Pendiente control contratos'
          when fm.status = 'pending_area_manager' then 'Pendiente gerencia'
          else coalesce(fm.status, 'Sin estado')
        end as label,
        count(*)::bigint as value
      from filtered_mobility fm
      group by 1
      order by value desc, label asc
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
        to_char(wb.bucket_start, 'DD Mon') as bucket_label,
        count(distinct fr.id) filter (
          where fr.submitted_at::date >= wb.bucket_start
            and fr.submitted_at::date < wb.bucket_start + interval '7 days'
        )::bigint as opened_folios,
        count(distinct fc.id) filter (
          where coalesce(fc.opened_at::date, fc.created_at::date) >= wb.bucket_start
            and coalesce(fc.opened_at::date, fc.created_at::date) < wb.bucket_start + interval '7 days'
        )::bigint as opened_cases,
        count(distinct cand.id) filter (
          where cand.hired_at::date >= wb.bucket_start
            and cand.hired_at::date < wb.bucket_start + interval '7 days'
        )::bigint as hired_candidates,
        count(distinct fm.id) filter (
          where fm.submitted_at::date >= wb.bucket_start
            and fm.submitted_at::date < wb.bucket_start + interval '7 days'
        )::bigint as submitted_mobilities,
        count(distinct fm.id) filter (
          where fm.approved_at::date >= wb.bucket_start
            and fm.approved_at::date < wb.bucket_start + interval '7 days'
        )::bigint as approved_mobilities,
        count(distinct fm.id) filter (
          where fm.hr_execution_executed_at::date >= wb.bucket_start
            and fm.hr_execution_executed_at::date < wb.bucket_start + interval '7 days'
        )::bigint as executed_mobilities
      from weekly_buckets wb
      left join filtered_requests fr on true
      left join filtered_cases fc on true
      left join filtered_candidates cand on true
      left join filtered_mobility fm on true
      group by wb.bucket_start
      order by wb.bucket_start asc
    )
    select jsonb_build_object(
      'summary',
      jsonb_build_object(
        'openFolios', coalesce((select open_folios from recruitment_summary), 0),
        'openCases', coalesce((select open_cases from recruitment_summary), 0),
        'requestedVacancies', coalesce((select requested_vacancies from recruitment_summary), 0),
        'candidatesInProgress', coalesce((select candidates_in_progress from recruitment_summary), 0),
        'readyCandidates', coalesce((select ready_candidates from recruitment_summary), 0),
        'hiredCandidates', coalesce((select hired_candidates from recruitment_summary), 0),
        'pendingApprovals', coalesce((select pending_approvals from recruitment_summary), 0),
        'avgDaysToHire', (select avg_days_to_hire from recruitment_summary),
        'avgApprovalHours', (select avg_approval_hours from recruitment_summary),
        'mobilityRequests', coalesce((select total_requests from mobility_summary), 0),
        'mobilityPendingExecution', coalesce((select pending_execution from mobility_summary), 0),
        'mobilityExecuted', coalesce((select executed_requests from mobility_summary), 0),
        'mobilityRejected', coalesce((select rejected_requests from mobility_summary), 0),
        'avgMobilityApprovalHours', (select avg_approval_hours from mobility_summary),
        'avgMobilityExecutionHours', (select avg_execution_hours from mobility_summary)
      ),
      'casesByStatus',
      coalesce((
        select jsonb_agg(jsonb_build_object('label', cbs.label, 'value', cbs.value) order by cbs.value desc, cbs.label asc)
        from cases_by_status cbs
      ), '[]'::jsonb),
      'candidatesByStage',
      coalesce((
        select jsonb_agg(jsonb_build_object('label', cbs.label, 'value', cbs.value) order by cbs.value desc, cbs.label asc)
        from candidates_by_stage cbs
      ), '[]'::jsonb),
      'approvalsByStep',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'stepCode', abs.step_code,
            'stepName', abs.step_name,
            'totalItems', abs.total_items,
            'pendingItems', abs.pending_items,
            'decidedItems', abs.decided_items,
            'avgHours', abs.avg_hours
          )
          order by abs.avg_hours desc nulls last, abs.total_items desc, abs.step_name asc
        )
        from approvals_by_step abs
      ), '[]'::jsonb),
      'approvalOwners',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'label', ao.label,
            'totalItems', ao.total_items,
            'pendingItems', ao.pending_items,
            'avgHours', ao.avg_hours
          )
          order by ao.avg_hours desc nulls last, ao.total_items desc, ao.label asc
        )
        from approval_owners ao
      ), '[]'::jsonb),
      'mobilityByStatus',
      coalesce((
        select jsonb_agg(jsonb_build_object('label', mbs.label, 'value', mbs.value) order by mbs.value desc, mbs.label asc)
        from mobility_by_status mbs
      ), '[]'::jsonb),
      'timeline',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'bucketStart', rt.bucket_start,
            'bucketLabel', rt.bucket_label,
            'openedFolios', rt.opened_folios,
            'openedCases', rt.opened_cases,
            'hiredCandidates', rt.hired_candidates,
            'submittedMobilities', rt.submitted_mobilities,
            'approvedMobilities', rt.approved_mobilities,
            'executedMobilities', rt.executed_mobilities
          )
          order by rt.bucket_start asc
        )
        from recruitment_timeline rt
      ), '[]'::jsonb)
    )
  );
end;
$function$;

revoke all on function public.get_bi_recruitment_dashboard(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_recruitment_dashboard(text, text[], text[]) to authenticated;

commit;
