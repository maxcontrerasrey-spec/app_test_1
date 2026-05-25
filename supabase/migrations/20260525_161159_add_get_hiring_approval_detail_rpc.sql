begin;

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
      'pasajes', hr.pasajes
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

revoke all on function public.get_hiring_approval_detail(bigint) from public, anon;
grant execute on function public.get_hiring_approval_detail(bigint) to authenticated;

notify pgrst, 'reload schema';

commit;
