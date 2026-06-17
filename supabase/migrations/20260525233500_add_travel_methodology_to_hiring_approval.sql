begin;

alter table if exists public.hiring_requests
  add column if not exists travel_methodology text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hiring_requests_travel_methodology_check'
      and conrelid = 'public.hiring_requests'::regclass
  ) then
    alter table public.hiring_requests
      add constraint hiring_requests_travel_methodology_check
      check (
        travel_methodology is null
        or travel_methodology in ('travel_allowance', 'company_purchase')
      );
  end if;
end $$;

drop function if exists public.decide_hiring_request_approval_v2(bigint, text, text);

create or replace function public.decide_hiring_request_approval_v2(
  p_approval_id bigint,
  p_decision text,
  p_comment text default null,
  p_travel_methodology text default null
)
returns table (
  hiring_request_id uuid,
  request_status text,
  decided_step text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  approval_record public.hiring_request_approvals%rowtype;
  request_record public.hiring_requests%rowtype;
  contracts_control_record public.workflow_approvers%rowtype;
  next_approval_id bigint;
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
  normalized_travel_methodology text := nullif(trim(coalesce(p_travel_methodology, '')), '');
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision invalida';
  end if;

  if normalized_travel_methodology is not null
     and normalized_travel_methodology not in ('travel_allowance', 'company_purchase') then
    raise exception 'Metodologia de pasajes invalida';
  end if;

  select *
    into approval_record
    from public.hiring_request_approvals hra
   where hra.id = p_approval_id
   for update;

  if approval_record.id is null then
    raise exception 'No existe la aprobacion solicitada';
  end if;

  if approval_record.status <> 'pending' then
    raise exception 'La aprobacion ya fue resuelta y no puede volver a decidirse';
  end if;

  if approval_record.step_code not in ('area_manager', 'contracts_control') then
    raise exception 'La etapa indicada no admite decision por esta via';
  end if;

  if approval_record.approver_user_id is null or approval_record.approver_user_id <> current_user_id then
    raise exception 'El usuario no esta autorizado para decidir esta aprobacion';
  end if;

  select *
    into request_record
    from public.hiring_requests hr
   where hr.id = approval_record.hiring_request_id
   for update;

  if request_record.id is null then
    raise exception 'No existe la solicitud asociada a la aprobacion';
  end if;

  if request_record.current_step_code is distinct from approval_record.step_code then
    raise exception 'La solicitud no se encuentra en la etapa actual de esta aprobacion';
  end if;

  if approval_record.step_code = 'area_manager'
     and request_record.status <> 'pending_area_manager' then
    raise exception 'La solicitud no esta pendiente de Gerente de Area';
  end if;

  if approval_record.step_code = 'contracts_control'
     and request_record.status <> 'pending_contracts_control' then
    raise exception 'La solicitud no esta pendiente de Control de Contratos';
  end if;

  if approval_record.step_code = 'contracts_control'
     and p_decision = 'approved'
     and coalesce(request_record.pasajes, false) = true
     and normalized_travel_methodology is null then
    raise exception 'Debes definir la metodologia de pasajes antes de aprobar';
  end if;

  update public.hiring_request_approvals hra
     set status = p_decision,
         decision_by = current_user_id,
         decision_comment = normalized_comment,
         decided_at = timezone('utc', now()),
         locked_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   where hra.id = approval_record.id
     and hra.status = 'pending';

  if p_decision = 'rejected' then
    update public.hiring_requests hr
       set status = 'rejected',
           current_step_code = null,
           rejected_at = timezone('utc', now()),
           final_decided_by = current_user_id,
           updated_at = timezone('utc', now())
     where hr.id = request_record.id;

    insert into public.hiring_request_audit_log (
      hiring_request_id,
      approval_id,
      actor_user_id,
      action_type,
      old_values,
      new_values,
      metadata
    )
    values (
      request_record.id,
      approval_record.id,
      current_user_id,
      'rejected',
      jsonb_build_object(
        'request_status', request_record.status,
        'current_step_code', request_record.current_step_code,
        'approval_status', approval_record.status,
        'travel_methodology', request_record.travel_methodology
      ),
      jsonb_build_object(
        'request_status', 'rejected',
        'current_step_code', null,
        'approval_status', 'rejected',
        'travel_methodology', request_record.travel_methodology
      ),
      jsonb_build_object(
        'step_code', approval_record.step_code,
        'comment', normalized_comment,
        'travel_methodology', request_record.travel_methodology
      )
    );

    return query
    select request_record.id, 'rejected'::text, approval_record.step_code;
    return;
  end if;

  if approval_record.step_code = 'area_manager' then
    select *
      into contracts_control_record
      from public.workflow_approvers wa
     where wa.step_code = 'contracts_control'
       and wa.is_active = true
     for share;

    if contracts_control_record.step_code is null then
      raise exception 'No existe aprobador configurado para Control de Contratos';
    end if;

    if contracts_control_record.approver_user_id is null then
      raise exception 'Control de Contratos aun no tiene usuario vinculado en la plataforma';
    end if;

    if not exists (
      select 1
      from public.profiles p
      where p.id = contracts_control_record.approver_user_id
        and p.status = 'active'
    ) then
      raise exception 'El usuario configurado para Control de Contratos no tiene una cuenta activa';
    end if;

    if exists (
      select 1
      from public.hiring_request_approvals hra_existing
      where hra_existing.hiring_request_id = request_record.id
        and hra_existing.step_code = 'contracts_control'
    ) then
      raise exception 'La aprobacion de Control de Contratos ya existe para esta solicitud';
    end if;

    insert into public.hiring_request_approvals (
      hiring_request_id,
      step_code,
      step_name,
      step_order,
      approver_user_id,
      approver_name,
      approver_email,
      status,
      created_at,
      updated_at
    )
    values (
      request_record.id,
      'contracts_control',
      'Control de contratos',
      3,
      contracts_control_record.approver_user_id,
      contracts_control_record.approver_name,
      contracts_control_record.approver_email,
      'pending',
      timezone('utc', now()),
      timezone('utc', now())
    )
    returning id into next_approval_id;

    update public.hiring_requests hr
       set status = 'pending_contracts_control',
           current_step_code = 'contracts_control',
           updated_at = timezone('utc', now())
     where hr.id = request_record.id;

    insert into public.hiring_request_audit_log (
      hiring_request_id,
      approval_id,
      actor_user_id,
      action_type,
      old_values,
      new_values,
      metadata
    )
    values (
      request_record.id,
      approval_record.id,
      current_user_id,
      'approved',
      jsonb_build_object(
        'request_status', request_record.status,
        'current_step_code', request_record.current_step_code,
        'approval_status', approval_record.status,
        'travel_methodology', request_record.travel_methodology
      ),
      jsonb_build_object(
        'request_status', 'pending_contracts_control',
        'current_step_code', 'contracts_control',
        'approval_status', 'approved',
        'travel_methodology', request_record.travel_methodology
      ),
      jsonb_build_object(
        'step_code', approval_record.step_code,
        'comment', normalized_comment,
        'travel_methodology', request_record.travel_methodology
      )
    );

    insert into public.hiring_request_audit_log (
      hiring_request_id,
      approval_id,
      actor_user_id,
      action_type,
      new_values,
      metadata
    )
    values (
      request_record.id,
      next_approval_id,
      current_user_id,
      'approval_created',
      jsonb_build_object(
        'step_code', 'contracts_control',
        'step_name', 'Control de contratos',
        'approver_user_id', contracts_control_record.approver_user_id,
        'approver_name', contracts_control_record.approver_name,
        'approver_email', contracts_control_record.approver_email,
        'status', 'pending'
      ),
      jsonb_build_object('created_by_flow', 'decide_hiring_request_approval_v2')
    );

    return query
    select request_record.id, 'pending_contracts_control'::text, approval_record.step_code;
    return;
  end if;

  update public.hiring_requests hr
     set status = 'approved',
         current_step_code = null,
         approved_at = timezone('utc', now()),
         final_decided_by = current_user_id,
         travel_methodology = case
           when coalesce(request_record.pasajes, false) = true then normalized_travel_methodology
           else null
         end,
         updated_at = timezone('utc', now())
   where hr.id = request_record.id;

  insert into public.hiring_request_audit_log (
    hiring_request_id,
    approval_id,
    actor_user_id,
    action_type,
    old_values,
    new_values,
    metadata
  )
  values (
    request_record.id,
    approval_record.id,
    current_user_id,
    'approved',
    jsonb_build_object(
      'request_status', request_record.status,
      'current_step_code', request_record.current_step_code,
      'approval_status', approval_record.status,
      'travel_methodology', request_record.travel_methodology
    ),
    jsonb_build_object(
      'request_status', 'approved',
      'current_step_code', null,
      'approval_status', 'approved',
      'travel_methodology', case
        when coalesce(request_record.pasajes, false) = true then normalized_travel_methodology
        else null
      end
    ),
    jsonb_build_object(
      'step_code', approval_record.step_code,
      'comment', normalized_comment,
      'travel_methodology', case
        when coalesce(request_record.pasajes, false) = true then normalized_travel_methodology
        else null
      end
    )
  );

  perform public.open_recruitment_case_from_hiring_request(request_record.id, current_user_id);

  return query
  select request_record.id, 'approved'::text, approval_record.step_code;
end;
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
      hr.travel_methodology,
      hr.other_benefits
    from public.hiring_request_approvals hra
    join public.hiring_requests hr
      on hr.id = hra.hiring_request_id
    where (hra.approver_user_id = p_user_id or public.user_is_admin(auth.uid()))
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

revoke all on function public.decide_hiring_request_approval_v2(bigint, text, text, text) from public, anon;
grant execute on function public.decide_hiring_request_approval_v2(bigint, text, text, text) to authenticated;

revoke all on function public.get_dashboard_tasks(uuid) from public, anon;
grant execute on function public.get_dashboard_tasks(uuid) to authenticated;

revoke all on function public.get_hiring_approval_detail(bigint) from public, anon;
grant execute on function public.get_hiring_approval_detail(bigint) to authenticated;

notify pgrst, 'reload schema';

commit;
