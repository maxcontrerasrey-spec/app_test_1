begin;

create or replace function public.user_can_view_internal_mobility_request_summary(
  target_user_id uuid,
  requester_user_id uuid,
  destination_cost_center_code text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select public.user_can_view_hiring_request_process_summary(
    target_user_id,
    requester_user_id,
    destination_cost_center_code
  );
$function$;

create or replace function public.user_can_read_internal_mobility_requests(
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    target_user_id is not null
    and (
      public.user_can_access_module(target_user_id, 'movilidad_interna')
      or public.user_can_access_candidate_control(target_user_id)
    );
$function$;

create or replace function public.get_internal_mobility_requests()
returns table (
  request_id uuid,
  folio text,
  status text,
  requester_name text,
  requester_email text,
  employee_full_name text,
  employee_document_number text,
  current_job_title text,
  current_area_name text,
  current_company_name text,
  current_shift_name text,
  recruitment_case_code text,
  source_folio text,
  destination_job_title text,
  destination_area_name text,
  destination_shift_name text,
  destination_cost_center_code text,
  destination_cost_center_name text,
  destination_company_name text,
  requires_termination boolean,
  motive text,
  current_step_name text,
  current_approver_name text,
  created_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_read_internal_mobility_requests(current_user_id) then
    raise exception 'Sin permisos para ver solicitudes de movilidad interna';
  end if;

  return query
  select
    imr.id,
    imr.folio,
    imr.status,
    imr.requester_name,
    imr.requester_email,
    imr.employee_full_name,
    imr.employee_document_number,
    imr.current_job_title,
    imr.current_area_name,
    imr.current_company_name,
    imr.current_shift_name,
    imr.recruitment_case_code,
    imr.source_folio,
    imr.destination_job_title,
    imr.destination_area_name,
    imr.destination_shift_name,
    imr.destination_cost_center_code,
    imr.destination_cost_center_name,
    imr.destination_company_name,
    imr.requires_termination,
    imr.motive,
    current_approval.step_name,
    current_approval.approver_name,
    imr.created_at,
    imr.submitted_at,
    imr.approved_at,
    imr.rejected_at
  from public.internal_mobility_requests imr
  left join lateral (
    select
      imra.step_name,
      imra.approver_name
    from public.internal_mobility_request_approvals imra
    where imra.internal_mobility_request_id = imr.id
      and imra.status = 'pending'
      and imra.step_code = imr.current_step_code
    limit 1
  ) current_approval on true
  where public.user_can_view_internal_mobility_request_summary(
    current_user_id,
    imr.requester_id,
    imr.destination_cost_center_code
  )
  order by imr.created_at desc
  limit 200;
end;
$function$;

revoke all on function public.user_can_view_internal_mobility_request_summary(uuid, uuid, text) from public, anon;
grant execute on function public.user_can_view_internal_mobility_request_summary(uuid, uuid, text) to authenticated;

revoke all on function public.user_can_read_internal_mobility_requests(uuid) from public, anon;
grant execute on function public.user_can_read_internal_mobility_requests(uuid) to authenticated;

revoke all on function public.get_internal_mobility_requests() from public, anon;
grant execute on function public.get_internal_mobility_requests() to authenticated;

notify pgrst, 'reload schema';

commit;
