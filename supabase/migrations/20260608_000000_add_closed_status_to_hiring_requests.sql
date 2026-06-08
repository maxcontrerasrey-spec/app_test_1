begin;

-- 1. Modificar la restricción de estado en la tabla hiring_requests
alter table public.hiring_requests
  drop constraint if exists hiring_requests_status_check;

alter table public.hiring_requests
  add constraint hiring_requests_status_check
  check (status in ('pending_area_manager', 'pending_contracts_control', 'approved', 'rejected', 'closed'));

-- 2. Modificar la restricción de action_type en hiring_request_audit_log
alter table public.hiring_request_audit_log
  drop constraint if exists hiring_request_audit_log_action_type_check;

alter table public.hiring_request_audit_log
  add constraint hiring_request_audit_log_action_type_check
  check (action_type in ('submitted', 'approval_created', 'approved', 'rejected', 'closed'));

-- 3. Crear función RPC para cerrar el folio
create or replace function public.close_hiring_request(
  p_request_id uuid,
  p_comment text default null
)
returns table (
  hiring_request_id uuid,
  request_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  request_record public.hiring_requests%rowtype;
  area_manager_record public.cost_center_approvers%rowtype;
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
  has_permission boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select *
    into request_record
    from public.hiring_requests
   where id = p_request_id
   for update;

  if request_record.id is null then
    raise exception 'No existe la solicitud';
  end if;

  if request_record.status in ('approved', 'rejected', 'closed') then
    raise exception 'La solicitud ya se encuentra en un estado final';
  end if;

  -- Permisos:
  -- 1. Es el solicitante original
  if request_record.requester_id = current_user_id then
    has_permission := true;
  end if;

  -- 2. Es admin o reclutamiento (can_access_module 'control_contrataciones')
  if not has_permission and public.user_can_access_module(current_user_id, 'control_contrataciones') then
    has_permission := true;
  end if;

  -- 3. Es el gerente de área correspondiente
  if not has_permission then
    select *
      into area_manager_record
      from public.cost_center_approvers
     where cost_center_code = request_record.cost_center_code
       and approver_user_id = current_user_id
       and is_active = true;

    if area_manager_record.id is not null then
      has_permission := true;
    end if;
  end if;

  if not has_permission then
    raise exception 'El usuario no esta autorizado para cerrar esta solicitud';
  end if;

  -- Actualizar estado
  update public.hiring_requests hr
     set status = 'closed',
         current_step_code = null,
         rejected_at = timezone('utc', now()), -- Lo consideramos fecha de fin para efectos de control
         final_decided_by = current_user_id,
         updated_at = timezone('utc', now())
   where hr.id = p_request_id;

  -- También cancelar aprobaciones pendientes
  update public.hiring_request_approvals
     set status = 'rejected',
         decision_by = current_user_id,
         decision_comment = coalesce(normalized_comment, 'Folio cerrado manualmente'),
         decided_at = timezone('utc', now()),
         locked_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   where hiring_request_id = p_request_id
     and status = 'pending';

  -- Si el folio ya tenía un caso de reclutamiento activo, lo cancelamos
  update public.recruitment_cases
     set status = 'cancelled',
         close_reason = coalesce(normalized_comment, 'Folio de origen cerrado manualmente'),
         closed_at = timezone('utc', now()),
         closed_by = current_user_id,
         target_close_date = timezone('utc', now())::date,
         updated_at = timezone('utc', now())
   where hiring_request_id = p_request_id
     and status not in ('filled', 'closed_unfilled', 'cancelled');

  -- Registrar en auditoría
  insert into public.hiring_request_audit_log (
    hiring_request_id,
    actor_user_id,
    action_type,
    metadata
  ) values (
    p_request_id,
    current_user_id,
    'closed',
    jsonb_build_object(
      'action', 'close_request',
      'comment', normalized_comment,
      'status_changed_to', 'closed'
    )
  );

  return query select request_record.id, 'closed'::text;
end;
$$;

revoke all on function public.close_hiring_request(uuid, text) from public, anon;
grant execute on function public.close_hiring_request(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
