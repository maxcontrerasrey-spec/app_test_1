begin;

create or replace function public.get_dashboard_tasks(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  result json;
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado';
  end if;

  if auth.uid() <> p_user_id and not public.user_is_admin(auth.uid()) then
    raise exception 'Sin permisos para consultar tareas de otro usuario';
  end if;

  select coalesce(json_agg(t), '[]'::json) into result
  from (
    select
      'approval_' || hra.id as id,
      'approval' as type,
      hra.id as approval_id,
      hr.id as hiring_request_id,
      coalesce(hr.folio, 'Borrador') as folio,
      hr.job_position_name,
      hr.contract_name,
      hr.cost_center_code,
      hr.vacancies as requested_vacancies,
      hr.requester_name,
      hr.requester_email,
      hra.status as status_code,
      'En Revision' as status_label,
      'Alta' as priority,
      hra.step_code,
      hra.step_name,
      hra.created_at,
      hr.requested_entry_date as requested_income_date,
      hr.start_date as contract_start_date,
      hr.end_date as contract_end_date,
      hr.shift_name as shift_code,
      hr.salary_offer as salary_liquid,
      hr.campamento as camp_required,
      hr.pasajes as flight_tickets_required,
      hr.travel_methodology,
      hr.other_benefits
    from public.hiring_request_approvals hra
    join public.hiring_requests hr
      on hr.id = hra.hiring_request_id
    where hra.approver_user_id = p_user_id
      and hra.status = 'pending'
    order by hra.created_at asc
    limit 20
  ) t;

  return result;
end;
$function$;

create or replace function public.get_hiring_approval_detail(
  p_approval_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  approval_payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select jsonb_build_object(
    'id', hra.id,
    'step_code', hra.step_code,
    'step_name', hra.step_name,
    'approver_user_id', hra.approver_user_id,
    'created_at', hra.created_at,
    'hiring_requests', jsonb_build_object(
      'folio', hr.folio,
      'requester_name', hr.requester_name,
      'requester_email', hr.requester_email,
      'job_position_name', hr.job_position_name,
      'contract_name', hr.contract_name,
      'vacancies', hr.vacancies,
      'requested_entry_date', hr.requested_entry_date,
      'start_date', hr.start_date,
      'end_date', hr.end_date,
      'shift_name', hr.shift_name,
      'other_benefits', hr.other_benefits,
      'campamento', hr.campamento,
      'pasajes', hr.pasajes,
      'travel_methodology', hr.travel_methodology
    )
  )
  into approval_payload
  from public.hiring_request_approvals hra
  join public.hiring_requests hr
    on hr.id = hra.hiring_request_id
  where hra.id = p_approval_id
    and (
      public.user_is_admin(current_user_id)
      or hra.approver_user_id = current_user_id
      or hr.requester_id = current_user_id
      or public.user_has_role(current_user_id, 'reclutamiento')
      or public.user_has_role(current_user_id, 'control_contratos')
    );

  if approval_payload is null then
    raise exception 'No existe la aprobación solicitada o no tienes permisos para verla';
  end if;

  return approval_payload;
end;
$function$;

revoke all on function public.get_dashboard_tasks(uuid) from public, anon;
grant execute on function public.get_dashboard_tasks(uuid) to authenticated;

revoke all on function public.get_hiring_approval_detail(bigint) from public, anon;
grant execute on function public.get_hiring_approval_detail(bigint) to authenticated;

notify pgrst, 'reload schema';

commit;
