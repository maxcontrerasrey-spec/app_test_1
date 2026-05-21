begin;

create or replace function public.get_home_dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  my_requests jsonb := '[]'::jsonb;
  pending_approvals jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select coalesce(
    jsonb_agg(request_row.payload order by request_row.sort_submitted_at desc, request_row.sort_created_at desc),
    '[]'::jsonb
  )
  into my_requests
  from (
    select
      jsonb_build_object(
        'id', hr.id,
        'folio', hr.folio,
        'status', hr.status,
        'contract_name', hr.contract_name,
        'job_position_name', hr.job_position_name,
        'vacancies', hr.vacancies,
        'submitted_at', hr.submitted_at,
        'created_at', hr.created_at
      ) as payload,
      coalesce(hr.submitted_at, hr.created_at) as sort_submitted_at,
      hr.created_at as sort_created_at
    from public.hiring_requests hr
    where hr.requester_id = current_user_id
    order by coalesce(hr.submitted_at, hr.created_at) desc, hr.created_at desc
    limit 8
  ) as request_row;

  select coalesce(
    jsonb_agg(approval_row.payload order by approval_row.sort_created_at asc, approval_row.sort_id asc),
    '[]'::jsonb
  )
  into pending_approvals
  from (
    select
      jsonb_build_object(
        'id', hra.id,
        'step_code', hra.step_code,
        'step_name', hra.step_name,
        'hiring_request_id', hra.hiring_request_id,
        'approver_user_id', hra.approver_user_id,
        'hiring_requests', jsonb_build_object(
          'folio', hr.folio,
          'contract_name', hr.contract_name,
          'contract_number', hr.contract_number,
          'job_position_name', hr.job_position_name,
          'requester_name', hr.requester_name,
          'requester_email', hr.requester_email,
          'vacancies', hr.vacancies,
          'requested_entry_date', hr.requested_entry_date,
          'start_date', hr.start_date,
          'end_date', hr.end_date,
          'shift_name', hr.shift_name,
          'status', hr.status,
          'salary_offer', hr.salary_offer,
          'campamento', hr.campamento,
          'pasajes', hr.pasajes,
          'other_benefits', hr.other_benefits
        )
      ) as payload,
      hra.created_at as sort_created_at,
      hra.id as sort_id
    from public.hiring_request_approvals hra
    join public.hiring_requests hr
      on hr.id = hra.hiring_request_id
    where hra.approver_user_id = current_user_id
      and hra.status = 'pending'
      and hra.step_code <> 'requester_signature'
    order by hra.created_at asc, hra.id asc
    limit 8
  ) as approval_row;

  return jsonb_build_object(
    'my_requests', my_requests,
    'pending_approvals', pending_approvals
  );
end;
$function$;

grant execute on function public.get_home_dashboard_summary() to authenticated;

notify pgrst, 'reload schema';

commit;
