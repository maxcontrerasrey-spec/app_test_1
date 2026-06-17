begin;

alter table public.internal_mobility_requests
  add column if not exists hr_execution_status text not null default 'pending',
  add column if not exists hr_execution_updated_at timestamptz,
  add column if not exists hr_execution_updated_by uuid references public.profiles (id) on delete set null,
  add column if not exists hr_execution_executed_at timestamptz,
  add column if not exists hr_execution_executed_by uuid references public.profiles (id) on delete set null;

alter table public.internal_mobility_requests
  drop constraint if exists internal_mobility_requests_hr_execution_status_check;

alter table public.internal_mobility_requests
  add constraint internal_mobility_requests_hr_execution_status_check
  check (hr_execution_status in ('pending', 'executed'));

create index if not exists idx_internal_mobility_requests_hr_execution_queue
  on public.internal_mobility_requests (status, hr_execution_status, approved_at desc, created_at desc);

alter table public.internal_mobility_request_audit_log
  drop constraint if exists internal_mobility_request_audit_log_action_type_check;

alter table public.internal_mobility_request_audit_log
  add constraint internal_mobility_request_audit_log_action_type_check
  check (action_type in ('submitted', 'approval_created', 'approved', 'rejected', 'hr_execution_updated'));

create or replace function public.user_can_manage_internal_mobility_hr_execution(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    target_user_id is not null
    and (
      public.user_is_admin(target_user_id)
      or public.user_has_role(target_user_id, 'administrativo')
    );
$function$;

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
  select
    target_user_id is not null
    and (
      public.user_is_admin(target_user_id)
      or public.user_has_role(target_user_id, 'administrativo')
      or public.user_has_role(target_user_id, 'reclutamiento')
      or public.user_has_role(target_user_id, 'control_contratos')
      or public.user_has_role(target_user_id, 'director_eje')
      or public.user_has_role(target_user_id, 'gerente_general')
      or public.user_has_role(target_user_id, 'director_op')
      or (
        public.user_has_role(target_user_id, 'gerencia')
        and exists (
          select 1
          from public.cost_center_approvers cca
          where cca.cost_center_code = destination_cost_center_code
            and cca.approver_user_id = target_user_id
            and cca.is_active = true
        )
      )
      or (
        not public.user_has_role(target_user_id, 'gerencia')
        and requester_user_id = target_user_id
      )
    );
$function$;

create or replace function public.set_internal_mobility_hr_execution_status(
  p_request_id uuid,
  p_status text
)
returns table (
  request_id uuid,
  hr_execution_status text,
  hr_execution_updated_at timestamptz,
  hr_execution_executed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  request_record public.internal_mobility_requests%rowtype;
  normalized_status text := nullif(trim(coalesce(p_status, '')), '');
  now_utc timestamptz := timezone('utc', now());
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if normalized_status not in ('pending', 'executed') then
    raise exception 'Estado de ejecución RRHH inválido';
  end if;

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para operar movilidad interna';
  end if;

  if not public.user_can_manage_internal_mobility_hr_execution(current_user_id) then
    raise exception 'Solo RRHH administrativo o administradores pueden actualizar la ejecución';
  end if;

  select *
    into request_record
    from public.internal_mobility_requests imr
   where imr.id = p_request_id
   for update;

  if request_record.id is null then
    raise exception 'No existe la solicitud indicada';
  end if;

  if request_record.status <> 'approved' then
    raise exception 'Solo las movilidades aprobadas admiten ejecución RRHH';
  end if;

  if request_record.hr_execution_status = normalized_status then
    return query
    select
      request_record.id,
      request_record.hr_execution_status,
      request_record.hr_execution_updated_at,
      request_record.hr_execution_executed_at;
    return;
  end if;

  update public.internal_mobility_requests imr
     set hr_execution_status = normalized_status,
         hr_execution_updated_at = now_utc,
         hr_execution_updated_by = current_user_id,
         hr_execution_executed_at = case
           when normalized_status = 'executed' then now_utc
           else null
         end,
         hr_execution_executed_by = case
           when normalized_status = 'executed' then current_user_id
           else null
         end,
         updated_at = now_utc
   where imr.id = request_record.id;

  insert into public.internal_mobility_request_audit_log (
    internal_mobility_request_id,
    actor_user_id,
    action_type,
    old_values,
    new_values,
    metadata
  )
  values (
    request_record.id,
    current_user_id,
    'hr_execution_updated',
    jsonb_build_object(
      'hr_execution_status', request_record.hr_execution_status,
      'hr_execution_updated_at', request_record.hr_execution_updated_at,
      'hr_execution_executed_at', request_record.hr_execution_executed_at
    ),
    jsonb_build_object(
      'hr_execution_status', normalized_status,
      'hr_execution_updated_at', now_utc,
      'hr_execution_executed_at', case when normalized_status = 'executed' then now_utc else null end
    ),
    jsonb_build_object(
      'updated_by', current_user_id,
      'updated_phase', 'rrhh_execution'
    )
  );

  return query
  select
    request_record.id,
    normalized_status,
    now_utc,
    case when normalized_status = 'executed' then now_utc else null end;
end;
$function$;

drop function if exists public.get_internal_mobility_requests();
create or replace function public.get_internal_mobility_requests()
returns table (
  request_id uuid,
  folio text,
  status text,
  hr_execution_status text,
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
  hr_execution_updated_at timestamptz,
  hr_execution_updated_by_name text,
  hr_execution_executed_at timestamptz,
  hr_execution_executed_by_name text,
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

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para ver solicitudes de movilidad interna';
  end if;

  return query
  select
    imr.id,
    imr.folio,
    imr.status,
    imr.hr_execution_status,
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
    imr.hr_execution_updated_at,
    hr_execution_updater.full_name,
    imr.hr_execution_executed_at,
    hr_execution_executor.full_name,
    imr.created_at,
    imr.submitted_at,
    imr.approved_at,
    imr.rejected_at
  from public.internal_mobility_requests imr
  left join public.profiles hr_execution_updater
    on hr_execution_updater.id = imr.hr_execution_updated_by
  left join public.profiles hr_execution_executor
    on hr_execution_executor.id = imr.hr_execution_executed_by
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
  order by
    case
      when imr.status = 'approved' and imr.hr_execution_status = 'pending' then 0
      when imr.status = 'approved' and imr.hr_execution_status = 'executed' then 1
      when imr.status = 'pending_contracts_control' then 2
      when imr.status = 'pending_area_manager' then 3
      when imr.status = 'rejected' then 4
      else 5
    end,
    coalesce(imr.approved_at, imr.created_at) desc,
    imr.created_at desc
  limit 200;
end;
$function$;

create or replace function public.get_internal_mobility_request_detail(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  detail_payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_view_internal_mobility_request(current_user_id, p_request_id) then
    raise exception 'Sin permisos para ver esta solicitud';
  end if;

  select jsonb_build_object(
    'request',
    jsonb_build_object(
      'id', imr.id,
      'folio', imr.folio,
      'status', imr.status,
      'hr_execution_status', imr.hr_execution_status,
      'requester_name', imr.requester_name,
      'requester_job_title', imr.requester_job_title,
      'requester_email', imr.requester_email,
      'employee_buk_employee_id', imr.employee_buk_employee_id,
      'employee_document_number', imr.employee_document_number,
      'employee_document_type', imr.employee_document_type,
      'employee_full_name', imr.employee_full_name,
      'current_job_title', imr.current_job_title,
      'current_contract_code', imr.current_contract_code,
      'current_area_name', imr.current_area_name,
      'current_area_code', imr.current_area_code,
      'current_company_name', imr.current_company_name,
      'current_shift_name', imr.current_shift_name,
      'recruitment_case_id', imr.recruitment_case_id,
      'hiring_request_id', imr.hiring_request_id,
      'recruitment_case_code', imr.recruitment_case_code,
      'source_folio', imr.source_folio,
      'destination_job_title', imr.destination_job_title,
      'destination_contract_id', imr.destination_contract_id,
      'destination_contract_code', imr.destination_contract_code,
      'destination_contract_number', imr.destination_contract_number,
      'destination_area_name', imr.destination_area_name,
      'destination_area_code', imr.destination_area_code,
      'destination_cost_center_code', imr.destination_cost_center_code,
      'destination_cost_center_name', imr.destination_cost_center_name,
      'destination_company_name', imr.destination_company_name,
      'destination_shift_id', imr.destination_shift_id,
      'destination_shift_name', imr.destination_shift_name,
      'requires_termination', imr.requires_termination,
      'motive', imr.motive,
      'current_step_code', imr.current_step_code,
      'submitted_at', imr.submitted_at,
      'approved_at', imr.approved_at,
      'rejected_at', imr.rejected_at,
      'hr_execution_updated_at', imr.hr_execution_updated_at,
      'hr_execution_updated_by', imr.hr_execution_updated_by,
      'hr_execution_updated_by_name', hr_execution_updater.full_name,
      'hr_execution_executed_at', imr.hr_execution_executed_at,
      'hr_execution_executed_by', imr.hr_execution_executed_by,
      'hr_execution_executed_by_name', hr_execution_executor.full_name,
      'created_at', imr.created_at,
      'updated_at', imr.updated_at
    ),
    'approvals',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', imra.id,
          'step_code', imra.step_code,
          'step_name', imra.step_name,
          'step_order', imra.step_order,
          'approver_user_id', imra.approver_user_id,
          'approver_name', imra.approver_name,
          'approver_email', imra.approver_email,
          'status', imra.status,
          'decision_comment', imra.decision_comment,
          'decided_at', imra.decided_at,
          'created_at', imra.created_at
        )
        order by imra.step_order asc, imra.created_at asc
      )
      from public.internal_mobility_request_approvals imra
      where imra.internal_mobility_request_id = imr.id
    ), '[]'::jsonb),
    'audit_log',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', imral.id,
          'action_type', imral.action_type,
          'actor_user_id', imral.actor_user_id,
          'actor_name', actor_profile.full_name,
          'created_at', imral.created_at,
          'old_values', imral.old_values,
          'new_values', imral.new_values,
          'metadata', imral.metadata
        )
        order by imral.created_at desc, imral.id desc
      )
      from public.internal_mobility_request_audit_log imral
      left join public.profiles actor_profile
        on actor_profile.id = imral.actor_user_id
      where imral.internal_mobility_request_id = imr.id
    ), '[]'::jsonb)
  )
  into detail_payload
  from public.internal_mobility_requests imr
  left join public.profiles hr_execution_updater
    on hr_execution_updater.id = imr.hr_execution_updated_by
  left join public.profiles hr_execution_executor
    on hr_execution_executor.id = imr.hr_execution_executed_by
  where imr.id = p_request_id;

  if detail_payload is null then
    raise exception 'No existe la solicitud indicada';
  end if;

  return detail_payload;
end;
$function$;

revoke all on function public.user_can_manage_internal_mobility_hr_execution(uuid) from public, anon;
grant execute on function public.user_can_manage_internal_mobility_hr_execution(uuid) to authenticated;

revoke all on function public.set_internal_mobility_hr_execution_status(uuid, text) from public, anon;
grant execute on function public.set_internal_mobility_hr_execution_status(uuid, text) to authenticated;

revoke all on function public.get_internal_mobility_requests() from public, anon;
grant execute on function public.get_internal_mobility_requests() to authenticated;

revoke all on function public.get_internal_mobility_request_detail(uuid) from public, anon;
grant execute on function public.get_internal_mobility_request_detail(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
