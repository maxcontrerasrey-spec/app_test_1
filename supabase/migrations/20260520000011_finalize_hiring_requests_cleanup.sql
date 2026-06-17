begin;

do $$
declare
  target record;
begin
  for target in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_hiring_request',
        'create_hiring_request_v2',
        'decide_hiring_request_approval',
        'refresh_hiring_request_status',
        'handle_hiring_request_approval_change'
      )
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from authenticated',
      target.schema_name,
      target.function_name,
      target.identity_args
    );

    execute format(
      'drop function if exists %I.%I(%s)',
      target.schema_name,
      target.function_name,
      target.identity_args
    );
  end loop;
end $$;

drop trigger if exists trg_hiring_request_approvals_refresh_status on public.hiring_request_approvals;
drop table if exists public.hiring_approval_configs;

create or replace function public.get_hiring_control_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  summary jsonb := '{}'::jsonb;
  pending_contracts_control jsonb := '[]'::jsonb;
  recent_requests jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'control_contrataciones') then
    raise exception 'Sin permisos para ver control de contrataciones';
  end if;

  select jsonb_build_object(
    'pending_area_manager', count(*) filter (where hr.status = 'pending_area_manager'),
    'pending_contracts_control', count(*) filter (where hr.status = 'pending_contracts_control'),
    'approved', count(*) filter (where hr.status = 'approved'),
    'rejected', count(*) filter (where hr.status = 'rejected'),
    'total', count(*)
  )
  into summary
  from public.hiring_requests hr;

  select coalesce(
    jsonb_agg(queue_row.payload order by queue_row.sort_created_at asc, queue_row.sort_id asc),
    '[]'::jsonb
  )
  into pending_contracts_control
  from (
    select
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
          'other_benefits', hr.other_benefits,
          'cost_center_code', hr.cost_center_code,
          'cost_center_name', hr.cost_center_name
        )
      ) as payload,
      hra.created_at as sort_created_at,
      hra.id as sort_id
    from public.hiring_request_approvals hra
    join public.hiring_requests hr
      on hr.id = hra.hiring_request_id
    where hra.step_code = 'contracts_control'
      and hra.status = 'pending'
    order by hra.created_at asc, hra.id asc
    limit 20
  ) as queue_row;

  select coalesce(
    jsonb_agg(request_row.payload order by request_row.sort_submitted_at desc, request_row.sort_created_at desc),
    '[]'::jsonb
  )
  into recent_requests
  from (
    select
      jsonb_build_object(
        'id', hr.id,
        'folio', hr.folio,
        'status', hr.status,
        'current_step_code', hr.current_step_code,
        'requester_name', hr.requester_name,
        'requester_email', hr.requester_email,
        'contract_name', hr.contract_name,
        'contract_number', hr.contract_number,
        'job_position_name', hr.job_position_name,
        'vacancies', hr.vacancies,
        'cost_center_code', hr.cost_center_code,
        'cost_center_name', hr.cost_center_name,
        'shift_name', hr.shift_name,
        'salary_offer', hr.salary_offer,
        'campamento', hr.campamento,
        'pasajes', hr.pasajes,
        'other_benefits', hr.other_benefits,
        'requested_entry_date', hr.requested_entry_date,
        'start_date', hr.start_date,
        'end_date', hr.end_date,
        'submitted_at', hr.submitted_at,
        'created_at', hr.created_at,
        'approved_at', hr.approved_at,
        'rejected_at', hr.rejected_at,
        'area_manager_status', area_step.status,
        'area_manager_approver_name', area_step.approver_name,
        'area_manager_decided_at', area_step.decided_at,
        'contracts_control_status', contracts_step.status,
        'contracts_control_approver_name', contracts_step.approver_name,
        'contracts_control_decided_at', contracts_step.decided_at
      ) as payload,
      coalesce(hr.submitted_at, hr.created_at) as sort_submitted_at,
      hr.created_at as sort_created_at
    from public.hiring_requests hr
    left join lateral (
      select
        hra.status,
        hra.approver_name,
        hra.decided_at
      from public.hiring_request_approvals hra
      where hra.hiring_request_id = hr.id
        and hra.step_code = 'area_manager'
      order by hra.id desc
      limit 1
    ) as area_step on true
    left join lateral (
      select
        hra.status,
        hra.approver_name,
        hra.decided_at
      from public.hiring_request_approvals hra
      where hra.hiring_request_id = hr.id
        and hra.step_code = 'contracts_control'
      order by hra.id desc
      limit 1
    ) as contracts_step on true
    order by coalesce(hr.submitted_at, hr.created_at) desc, hr.created_at desc
    limit 30
  ) as request_row;

  return jsonb_build_object(
    'summary', summary,
    'pending_contracts_control', pending_contracts_control,
    'recent_requests', recent_requests
  );
end;
$function$;

grant execute on function public.get_hiring_control_dashboard() to authenticated;

notify pgrst, 'reload schema';

commit;
