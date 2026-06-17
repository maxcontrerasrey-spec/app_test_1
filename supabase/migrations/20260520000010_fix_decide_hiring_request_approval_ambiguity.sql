begin;

create or replace function public.decide_hiring_request_approval_v2(
  p_approval_id bigint,
  p_decision text,
  p_comment text default null
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
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision invalida';
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

  if approval_record.approver_user_id is null or (approval_record.approver_user_id <> current_user_id and not public.user_is_admin(current_user_id)) then
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
        'approval_status', approval_record.status
      ),
      jsonb_build_object(
        'request_status', 'rejected',
        'current_step_code', null,
        'approval_status', 'rejected'
      ),
      jsonb_build_object(
        'step_code', approval_record.step_code,
        'comment', normalized_comment
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
        'approval_status', approval_record.status
      ),
      jsonb_build_object(
        'request_status', 'pending_contracts_control',
        'current_step_code', 'contracts_control',
        'approval_status', 'approved'
      ),
      jsonb_build_object(
        'step_code', approval_record.step_code,
        'comment', normalized_comment
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
      'approval_status', approval_record.status
    ),
    jsonb_build_object(
      'request_status', 'approved',
      'current_step_code', null,
      'approval_status', 'approved'
    ),
    jsonb_build_object(
      'step_code', approval_record.step_code,
      'comment', normalized_comment
    )
  );

  return query
  select request_record.id, 'approved'::text, approval_record.step_code;
end;
$function$;

grant execute on function public.decide_hiring_request_approval_v2(bigint, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
