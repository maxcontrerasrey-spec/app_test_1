begin;

drop function if exists public.get_bi_recruitment_dashboard(text, text[], text[]);

create function public.get_bi_recruitment_dashboard(
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
          when fc.status = 'sourcing' then 'Búsqueda'
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
          when cc.stage_code = 'medical_exams' then 'Exámenes médicos'
          when cc.stage_code = 'document_review' then 'Revisión documental'
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
            then 'Pendiente ejecución RRHH'
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
      where coalesce(array_length(normalized_contracts, 1), 0) = 0
         or ac.contract_name = any(normalized_contracts)
    ),
    contract_options as (
      select distinct ac.contract_name as value
      from active_cases ac
      where coalesce(array_length(normalized_managements, 1), 0) = 0
         or ac.management_name = any(normalized_managements)
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
        ), '[]'::jsonb)
      ),
      'summary',
      jsonb_build_object(
        'openFolios', coalesce((select open_folios from recruitment_summary), 0),
        'openCases', coalesce((select open_cases from recruitment_summary), 0),
        'requestedVacancies', coalesce((select requested_vacancies from recruitment_summary), 0),
        'filledVacancies', coalesce((select filled_vacancies from recruitment_summary), 0),
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

revoke all on function public.get_bi_recruitment_dashboard(text, text[], text[])
  from public, anon;
grant execute on function public.get_bi_recruitment_dashboard(text, text[], text[])
  to authenticated;

create or replace function public.get_dashboard_operational_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  today_cl date := timezone('America/Santiago', now())::date;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  return (
    with visible_hiring_scope as (
      select distinct
        hr.cost_center_code,
        hr.contract_number
      from public.hiring_requests hr
      where public.user_can_view_hiring_request_process_summary(
        current_user_id,
        hr.requester_id,
        hr.cost_center_code
      )
    ),
    assigned_ceco_scope as (
      select distinct regexp_replace(trim(cca.cost_center_code), '\.0+$', '', 'g')
        as normalized_ceco
      from public.cost_center_approvers cca
      where cca.approver_user_id = current_user_id
        and cca.is_active = true
    ),
    broad_access as (
      select
        public.user_is_admin(current_user_id)
        or public.user_has_role(current_user_id, 'administrativo')
        or public.user_has_role(current_user_id, 'reclutamiento')
        or public.user_has_role(current_user_id, 'control_contratos')
        or public.user_has_role(current_user_id, 'director_eje')
        or public.user_has_role(current_user_id, 'gerente_general')
        or public.user_has_role(current_user_id, 'director_op') as enabled
    ),
    workforce_ceco_scope as (
      select distinct regexp_replace(trim(coalesce(e.contract_code, '')), '\.0+$', '', 'g')
        as normalized_ceco
      from public.employees_active_current e
      cross join broad_access ba
      where ba.enabled

      union

      select normalized_ceco
      from assigned_ceco_scope

      union

      select distinct regexp_replace(trim(vhs.cost_center_code), '\.0+$', '', 'g')
      from visible_hiring_scope vhs
    ),
    incentive_contract_scope as (
      select distinct c.code as contract_code
      from public.contracts c
      cross join broad_access ba
      where c.is_active = true
        and ba.enabled

      union

      select distinct c.code
      from public.contracts c
      join assigned_ceco_scope acs
        on acs.normalized_ceco = regexp_replace(trim(c.cost_center_code), '\.0+$', '', 'g')
      where c.is_active = true

      union

      select distinct c.code
      from visible_hiring_scope vhs
      join public.contracts c
        on c.contract_number = vhs.contract_number
       and c.is_active = true
    ),
    visible_cases as (
      select
        rc.id,
        rc.status,
        rc.requested_vacancies
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
      where vc.status in ('open', 'sourcing', 'screening', 'ready_to_hire', 'partially_filled')
    ),
    active_candidate_metrics as (
      select
        rcc.recruitment_case_id,
        count(*) filter (
          where rcc.stage_code not in ('hired', 'rejected', 'withdrawn')
        )::bigint as in_progress_candidates,
        count(*) filter (where rcc.stage_code = 'hired')::bigint as hired_candidates
      from public.recruitment_case_candidates rcc
      join active_cases ac
        on ac.id = rcc.recruitment_case_id
      group by rcc.recruitment_case_id
    ),
    recruitment_summary as (
      select
        count(*)::bigint as open_processes,
        coalesce(sum(ac.requested_vacancies), 0)::bigint as requested_vacancies,
        coalesce(sum(acm.in_progress_candidates), 0)::bigint as in_progress_candidates,
        coalesce(sum(acm.hired_candidates), 0)::bigint as hired_candidates,
        count(*) filter (where ac.status = 'ready_to_hire')::bigint as ready_to_hire_cases,
        (select count(*)::bigint from visible_cases vc where vc.status = 'filled') as filled_cases
      from active_cases ac
      left join active_candidate_metrics acm
        on acm.recruitment_case_id = ac.id
    ),
    visible_population as (
      select e.buk_employee_id
      from public.employees_active_current e
      where exists (
        select 1
        from workforce_ceco_scope wcs
        where wcs.normalized_ceco = regexp_replace(
          trim(coalesce(e.contract_code, '')),
          '\.0+$',
          '',
          'g'
        )
      )
    ),
    workforce_absences_today as (
      select
        count(distinct hre.employee_buk_employee_id) filter (
          where hre.exception_type = 'vacation'
        )::bigint as vacations_today,
        count(distinct hre.employee_buk_employee_id) filter (
          where hre.exception_type = 'medical_leave'
        )::bigint as medical_leaves_today,
        count(distinct hre.employee_buk_employee_id) filter (
          where hre.exception_type in (
            'vacation',
            'medical_leave',
            'absent',
            'administrative_leave',
            'union_leave'
          )
        )::bigint as absent_people_today
      from public.hr_roster_exceptions hre
      join visible_population vp
        on vp.buk_employee_id = hre.employee_buk_employee_id
      where hre.exception_date = today_cl
        and hre.is_active = true
    ),
    workforce_summary as (
      select
        count(*)::bigint as total_employees,
        coalesce(max(wat.medical_leaves_today), 0)::bigint as medical_leaves_today,
        coalesce(max(wat.vacations_today), 0)::bigint as vacations_today,
        case
          when count(*) = 0 then 0::numeric
          else round(
            (coalesce(max(wat.absent_people_today), 0)::numeric / count(*)::numeric) * 100,
            1
          )
        end as absenteeism_pct
      from visible_population vp
      cross join workforce_absences_today wat
    ),
    incentives_summary as (
      select
        count(*) filter (where hir.status <> 'R')::bigint as total_generated,
        count(*) filter (where hir.status in ('P', 'E'))::bigint as pending_approval,
        count(*) filter (where hir.status = 'F')::bigint as approved,
        coalesce(
          sum(hir.calculated_amount) filter (where hir.status <> 'R'),
          0
        )::numeric(14,2) as total_amount
      from public.hr_incentive_requests hir
      where exists (
        select 1
        from incentive_contract_scope ics
        where ics.contract_code = hir.selected_contract_code
      )
    )
    select jsonb_build_object(
      'recruitment',
      jsonb_build_object(
        'open_processes', coalesce((select open_processes from recruitment_summary), 0),
        'requested_vacancies', coalesce((select requested_vacancies from recruitment_summary), 0),
        'in_progress_candidates', coalesce((select in_progress_candidates from recruitment_summary), 0),
        'hired_candidates', coalesce((select hired_candidates from recruitment_summary), 0),
        'ready_to_hire_cases', coalesce((select ready_to_hire_cases from recruitment_summary), 0),
        'filled_cases', coalesce((select filled_cases from recruitment_summary), 0)
      ),
      'workforce',
      jsonb_build_object(
        'total_employees', coalesce((select total_employees from workforce_summary), 0),
        'medical_leaves_today', coalesce((select medical_leaves_today from workforce_summary), 0),
        'vacations_today', coalesce((select vacations_today from workforce_summary), 0),
        'absenteeism_pct', coalesce((select absenteeism_pct from workforce_summary), 0)
      ),
      'incentives',
      jsonb_build_object(
        'total_generated', coalesce((select total_generated from incentives_summary), 0),
        'pending_approval', coalesce((select pending_approval from incentives_summary), 0),
        'approved', coalesce((select approved from incentives_summary), 0),
        'total_amount', coalesce((select total_amount from incentives_summary), 0)
      )
    )
  );
end;
$function$;

revoke all on function public.get_dashboard_operational_summary() from public, anon;
grant execute on function public.get_dashboard_operational_summary() to authenticated;

create index if not exists idx_recruitment_cases_active_opened
  on public.recruitment_cases (opened_at, status)
  where status in ('open', 'sourcing', 'screening', 'ready_to_hire', 'partially_filled');

create index if not exists idx_recruitment_candidates_case_stage
  on public.recruitment_case_candidates (recruitment_case_id, stage_code);

create index if not exists idx_recruitment_candidates_hired_at
  on public.recruitment_case_candidates (hired_at)
  where hired_at is not null;

create index if not exists idx_internal_mobility_case_status
  on public.internal_mobility_requests (recruitment_case_id, status);

create index if not exists idx_internal_mobility_submitted_at
  on public.internal_mobility_requests (submitted_at);

create index if not exists idx_internal_mobility_executed_at
  on public.internal_mobility_requests (hr_execution_executed_at)
  where hr_execution_executed_at is not null;

notify pgrst, 'reload schema';

commit;
