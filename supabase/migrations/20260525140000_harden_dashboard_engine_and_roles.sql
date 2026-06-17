begin;

create or replace function public.get_dashboard_widgets_for_current_user()
returns setof public.dashboard_widgets
language sql
security definer
set search_path = public
as $function$
  with current_roles as (
    select array_agg(distinct ur.role_code) as role_codes
    from public.user_roles ur
    where ur.user_id = auth.uid()
  )
  select dw.*
  from public.dashboard_widgets dw
  cross join current_roles cr
  where dw.is_active = true
    and (
      coalesce(array_length(dw.allowed_roles, 1), 0) = 0
      or dw.allowed_roles && coalesce(cr.role_codes, '{}'::text[])
      or public.user_is_admin(auth.uid())
    )
  order by dw.default_position asc;
$function$;

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
        'Aprobacion Solicitud' as type,
        coalesce(hr.folio, 'Borrador') || ' - ' || hr.job_position_name as title,
        'Paso: ' || hra.step_name as subtitle,
        'pending' as status_code,
        'En Revision' as status_label,
        'Alta' as priority,
        hra.created_at
      from public.hiring_request_approvals hra
      join public.hiring_requests hr
        on hr.id = hra.hiring_request_id
      where (hra.approver_user_id = p_user_id or public.user_is_admin(p_user_id))
        and hra.status = 'pending'

      union all

      select
        'case_' || rca.id as id,
        'Reclutamiento' as type,
        rc.job_position_name as title,
        'Vacantes: ' || rc.requested_vacancies as subtitle,
        rc.status as status_code,
        'En Proceso' as status_label,
        'Normal' as priority,
        rca.assigned_at as created_at
      from public.recruitment_case_assignments rca
      join public.recruitment_cases rc
        on rc.id = rca.recruitment_case_id
      where rca.user_id = p_user_id
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

create or replace function public.get_dashboard_alerts(p_user_id uuid)
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
    raise exception 'Sin permisos para consultar alertas de otro usuario';
  end if;

  select coalesce(json_agg(a), '[]'::json) into result
  from (
    select *
    from (
      select
        'doc_exp_' || cd.id as id,
        'Acreditaciones Criticas' as title,
        dt.name || ' de ' || cp.full_name || ' vence el ' || to_char(cd.expiry_date, 'DD/MM/YYYY') as description,
        case
          when cd.expiry_date <= current_date + interval '7 days' then 'critical'
          else 'warning'
        end as severity,
        'certificaciones' as source,
        cd.created_at
      from public.candidate_documents cd
      join public.document_types dt
        on dt.id = cd.document_type_id
      join public.candidate_profiles cp
        on cp.id = cd.candidate_profile_id
      where cd.expiry_date is not null
        and cd.expiry_date <= current_date + interval '30 days'
        and cd.expiry_date >= current_date
        and cd.status = 'approved'
        and public.user_can_view_recruitment_case(auth.uid(), cd.recruitment_case_id)

      union all

      select
        'sla_rec_' || rc.id as id,
        'SLA Atrasado: Reclutamiento' as title,
        'El proceso para ' || rc.job_position_name || ' supero los 15 dias sin cambios.' as description,
        'warning' as severity,
        'reclutamiento' as source,
        rc.updated_at as created_at
      from public.recruitment_cases rc
      where rc.status = 'sourcing'
        and rc.updated_at <= current_date - interval '15 days'
        and public.user_can_view_recruitment_case(auth.uid(), rc.id)
    ) alert_rows
    order by
      case severity
        when 'critical' then 1
        when 'warning' then 2
        else 3
      end asc,
      created_at desc
    limit 10
  ) a;

  return result;
end;
$function$;

create or replace function public.get_dashboard_kpis(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_total_vacancies int;
  v_active_cases int;
  v_pending_approvals int;
  v_ready_to_hire_cases int;
  v_expiring_documents int;
  result json;
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado';
  end if;

  if auth.uid() <> p_user_id and not public.user_is_admin(auth.uid()) then
    raise exception 'Sin permisos para consultar indicadores de otro usuario';
  end if;

  select coalesce(sum(rc.requested_vacancies - rc.filled_vacancies), 0)
    into v_total_vacancies
  from public.recruitment_cases rc
  where rc.status not in ('filled', 'closed_unfilled', 'cancelled')
    and public.user_can_view_recruitment_case(auth.uid(), rc.id);

  select count(*)
    into v_active_cases
  from public.recruitment_cases rc
  where rc.status not in ('filled', 'closed_unfilled', 'cancelled')
    and public.user_can_view_recruitment_case(auth.uid(), rc.id);

  select count(*)
    into v_ready_to_hire_cases
  from public.recruitment_cases rc
  where rc.status = 'ready_to_hire'
    and public.user_can_view_recruitment_case(auth.uid(), rc.id);

  select count(*)
    into v_pending_approvals
  from public.hiring_request_approvals hra
  where hra.status = 'pending'
    and (hra.approver_user_id = p_user_id or public.user_is_admin(auth.uid()));

  select count(*)
    into v_expiring_documents
  from public.candidate_documents cd
  where cd.expiry_date is not null
    and cd.expiry_date <= current_date + interval '30 days'
    and cd.expiry_date >= current_date
    and cd.status = 'approved'
    and public.user_can_view_recruitment_case(auth.uid(), cd.recruitment_case_id);

  result := json_build_object(
    'total_vacancies', v_total_vacancies,
    'active_cases', v_active_cases,
    'pending_approvals', v_pending_approvals,
    'ready_to_hire_cases', v_ready_to_hire_cases,
    'expiring_documents', v_expiring_documents
  );

  return result;
end;
$function$;

revoke all on function public.get_dashboard_widgets_for_current_user() from public, anon;
revoke all on function public.get_dashboard_tasks(uuid) from public, anon;
revoke all on function public.get_dashboard_alerts(uuid) from public, anon;
revoke all on function public.get_dashboard_kpis(uuid) from public, anon;

grant execute on function public.get_dashboard_widgets_for_current_user() to authenticated;
grant execute on function public.get_dashboard_tasks(uuid) to authenticated;
grant execute on function public.get_dashboard_alerts(uuid) to authenticated;
grant execute on function public.get_dashboard_kpis(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
