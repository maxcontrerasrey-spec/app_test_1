begin;

-- Actualizamos el RPC get_dashboard_approval_tracking para excluir folios cerrados o cancelados
create or replace function public.get_dashboard_approval_tracking()
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  result json;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select coalesce(json_agg(t order by t.created_at asc), '[]'::json) into result
  from (
    select
      'tracking_' || hr.id as id,
      'approval' as type,
      hra.id as approval_id,
      hr.id as hiring_request_id,
      coalesce(hr.folio, 'Borrador') as folio,
      null::uuid as case_candidate_id,
      null::text as candidate_name,
      hr.job_position_name,
      hr.contract_name,
      hr.cost_center_code,
      hr.vacancies as requested_vacancies,
      hr.requester_name,
      hr.requester_email,
      hr.status as status_code,
      case
        when hr.status = 'pending_area_manager' then 'Pendiente gerente de area'
        when hr.status = 'pending_contracts_control' then 'Pendiente control contratos'
        else 'Pendiente'
      end as status_label,
      hra.step_code as current_step_code,
      hra.step_name as current_step_name,
      hra.approver_name as current_approver_name,
      hra.approver_email as current_approver_email,
      hra.created_at,
      hr.requested_entry_date as requested_income_date,
      hr.start_date as contract_start_date,
      hr.end_date as contract_end_date,
      hr.shift_name as shift_code,
      hr.salary_offer as salary_liquid,
      hr.campamento as camp_required,
      hr.pasajes as flight_tickets_required,
      hr.travel_methodology,
      hr.other_benefits,
      null::text as approval_comment,
      null::text as requested_by_name,
      null::jsonb as who_causes
    from public.hiring_requests hr
    left join public.hiring_request_approvals hra
      on hra.hiring_request_id = hr.id
      and hra.status = 'pending'
    where hr.status not in ('approved', 'rejected', 'canceled', 'cancelled', 'withdrawn', 'closed')
      and hr.requester_id = current_user_id
  ) t;

  return result;
end;
$function$;

revoke all on function public.get_dashboard_approval_tracking() from public, anon;
grant execute on function public.get_dashboard_approval_tracking() to authenticated;

notify pgrst, 'reload schema';

commit;
