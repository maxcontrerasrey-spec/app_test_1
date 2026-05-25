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
    select *
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
        0 as candidate_count,
        0 as ready_candidates,
        hr.requester_name,
        hr.requester_email,
        hra.status as status_code,
        'En Revision' as status_label,
        'Alta' as priority,
        hra.created_at,
        hr.requested_entry_date as requested_income_date,
        hr.start_date as contract_start_date,
        hr.end_date as contract_end_date,
        hr.shift_name as shift_code,
        hr.salary_offer as salary_liquid,
        hr.campamento as camp_required,
        hr.pasajes as flight_tickets_required,
        hr.other_benefits
      from public.hiring_request_approvals hra
      join public.hiring_requests hr
        on hr.id = hra.hiring_request_id
      where (hra.approver_user_id = p_user_id or public.user_is_admin(auth.uid()))
        and hra.status = 'pending'

      union all

      select
        'case_' || rc.id as id,
        'case' as type,
        null::bigint as approval_id,
        hr.id as hiring_request_id,
        coalesce(hr.folio, rc.case_code) as folio,
        rc.job_position_name,
        rc.contract_name,
        rc.cost_center_code,
        rc.requested_vacancies,
        coalesce(candidate_stats.candidate_count, 0) as candidate_count,
        coalesce(candidate_stats.ready_candidates, 0) as ready_candidates,
        hr.requester_name,
        hr.requester_email,
        rc.status as status_code,
        case rc.status
          when 'open' then 'Abierto'
          when 'sourcing' then 'En Búsqueda'
          when 'screening' then 'En Screening'
          when 'ready_to_hire' then 'Listo para Contratar'
          when 'partially_filled' then 'Cobertura Parcial'
          else 'En Proceso'
        end as status_label,
        'Normal' as priority,
        coalesce(rc.opened_at, rc.created_at) as created_at,
        hr.requested_entry_date as requested_income_date,
        hr.start_date as contract_start_date,
        hr.end_date as contract_end_date,
        hr.shift_name as shift_code,
        hr.salary_offer as salary_liquid,
        hr.campamento as camp_required,
        hr.pasajes as flight_tickets_required,
        hr.other_benefits
      from public.recruitment_cases rc
      join public.hiring_requests hr
        on hr.id = rc.hiring_request_id
      left join lateral (
        select
          count(*) filter (
            where rcc.stage_code not in ('rejected', 'withdrawn', 'hired', 'ready_for_hire')
          ) as candidate_count,
          count(*) filter (where rcc.stage_code = 'ready_for_hire') as ready_candidates
        from public.recruitment_case_candidates rcc
        where rcc.recruitment_case_id = rc.id
      ) as candidate_stats on true
      where public.user_can_view_recruitment_case(auth.uid(), rc.id)
        and rc.status not in ('filled', 'closed_unfilled', 'cancelled')
    ) task_rows
    order by
      case priority
        when 'Critica' then 1
        when 'Alta' then 2
        when 'Normal' then 3
        else 4
      end asc,
      created_at asc
    limit 20
  ) t;

  return result;
end;
$function$;

revoke all on function public.get_dashboard_tasks(uuid) from public, anon;
grant execute on function public.get_dashboard_tasks(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
