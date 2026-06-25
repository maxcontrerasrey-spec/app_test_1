begin;

create or replace function public.sync_recruitment_case_status(
  p_case_id uuid,
  p_actor_user_id uuid default auth.uid()
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  case_record public.recruitment_cases%rowtype;
  request_record public.hiring_requests%rowtype;
  case_metrics record;
  next_status text;
  next_filled_vacancies integer;
  should_reopen_request boolean := false;
  now_utc timestamptz := timezone('utc', now());
begin
  select *
    into case_record
    from public.recruitment_cases rc
   where rc.id = p_case_id
   for update;

  if case_record.id is null then
    raise exception 'No existe el caso de reclutamiento';
  end if;

  if case_record.hiring_request_id is not null then
    select *
      into request_record
      from public.hiring_requests hr
     where hr.id = case_record.hiring_request_id
     for update;
  end if;

  select *
    into case_metrics
    from public.get_recruitment_case_effective_metrics(p_case_id)
    limit 1;

  next_filled_vacancies := coalesce(case_metrics.effective_filled_vacancies, 0);
  should_reopen_request :=
    request_record.id is not null
    and request_record.status = 'closed'
    and coalesce(case_metrics.available_vacancies, 0) > 0
    and (
      case_record.status = 'cancelled'
      or case_record.close_reason is not null
      or case_record.closed_at is not null
    );

  next_status :=
    case
      when not should_reopen_request
        and case_record.close_reason is not null
        and case_record.closed_at is not null
        then case_record.status
      when next_filled_vacancies >= case_record.requested_vacancies then 'filled'
      when next_filled_vacancies > 0 then 'partially_filled'
      when coalesce(case_metrics.ready_candidate_count, 0) > 0 then 'ready_to_hire'
      when coalesce(case_metrics.effective_active_candidates, 0) > 0 then 'screening'
      else 'open'
    end;

  if should_reopen_request then
    update public.hiring_requests hr
       set status = 'approved',
           current_step_code = null,
           rejected_at = null,
           final_decided_by = null,
           updated_at = now_utc
     where hr.id = request_record.id;

    insert into public.hiring_request_audit_log (
      hiring_request_id,
      actor_user_id,
      action_type,
      metadata
    )
    values (
      request_record.id,
      coalesce(p_actor_user_id, case_record.opened_by),
      'approved',
      jsonb_build_object(
        'action', 'auto_reopened_due_to_capacity_release',
        'previous_status', request_record.status,
        'status_changed_to', 'approved',
        'recruitment_case_id', case_record.id,
        'available_vacancies', coalesce(case_metrics.available_vacancies, 0),
        'effective_filled_vacancies', next_filled_vacancies
      )
    );
  end if;

  update public.recruitment_cases rc
     set filled_vacancies = next_filled_vacancies,
         status = next_status,
         close_reason = case when should_reopen_request then null else rc.close_reason end,
         closed_at = case when should_reopen_request then null else rc.closed_at end,
         closed_by = case when should_reopen_request then null else rc.closed_by end,
         target_close_date = case when should_reopen_request then null else rc.target_close_date end,
         updated_at = now_utc
   where rc.id = p_case_id;

  if case_record.status is distinct from next_status
     or case_record.filled_vacancies is distinct from next_filled_vacancies
     or should_reopen_request then
    insert into public.recruitment_case_audit_log (
      recruitment_case_id,
      actor_user_id,
      action_type,
      old_values,
      new_values,
      metadata
    )
    values (
      p_case_id,
      coalesce(p_actor_user_id, case_record.opened_by),
      'case_status_synced',
      jsonb_build_object(
        'status', case_record.status,
        'filled_vacancies', case_record.filled_vacancies,
        'close_reason', case_record.close_reason,
        'closed_at', case_record.closed_at,
        'closed_by', case_record.closed_by,
        'hiring_request_status', request_record.status
      ),
      jsonb_build_object(
        'status', next_status,
        'filled_vacancies', next_filled_vacancies,
        'close_reason', case when should_reopen_request then null else case_record.close_reason end,
        'closed_at', case when should_reopen_request then null else case_record.closed_at end,
        'closed_by', case when should_reopen_request then null else case_record.closed_by end,
        'hiring_request_status', case when should_reopen_request then 'approved' else request_record.status end
      ),
      jsonb_build_object(
        'ready_candidates', coalesce(case_metrics.ready_candidate_count, 0),
        'active_candidates', coalesce(case_metrics.active_candidate_count, 0),
        'pending_mobility_count', coalesce(case_metrics.pending_mobility_count, 0),
        'approved_mobility_count', coalesce(case_metrics.approved_mobility_count, 0),
        'effective_active_candidates', coalesce(case_metrics.effective_active_candidates, 0),
        'available_vacancies', coalesce(case_metrics.available_vacancies, 0),
        'request_reopened', should_reopen_request
      )
    );
  end if;

  return next_status;
end;
$function$;

create or replace function public.close_hiring_request(
  p_request_id uuid,
  p_comment text default null
)
returns table (
  request_id uuid,
  request_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  request_record public.hiring_requests%rowtype;
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
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

  if request_record.status in ('rejected', 'closed') then
    raise exception 'La solicitud ya se encuentra en un estado final';
  end if;

  if not public.user_can_close_hiring_request(current_user_id, p_request_id) then
    raise exception 'El usuario no esta autorizado para cerrar esta solicitud';
  end if;

  if exists (
    select 1
      from public.recruitment_cases rc
      join public.recruitment_case_candidates rcc
        on rcc.recruitment_case_id = rc.id
     where rc.hiring_request_id = p_request_id
       and rc.status not in ('filled', 'closed_unfilled', 'cancelled')
       and rcc.stage_code not in ('hired', 'rejected', 'withdrawn')
  ) then
    raise exception 'No se puede cerrar: Existen candidatos activos en este folio. Debes trasladarlos a otro proceso o descartarlos antes de poder cerrar el folio.';
  end if;

  if exists (
    select 1
      from public.recruitment_cases rc
      join public.internal_mobility_requests imr
        on imr.recruitment_case_id = rc.id
     where rc.hiring_request_id = p_request_id
       and (
         imr.status in ('pending_area_manager', 'pending_contracts_control')
         or (imr.status = 'approved' and coalesce(imr.hr_execution_status, 'pending') = 'pending')
       )
  ) then
    raise exception 'No se puede cerrar: Existen movilidades internas activas reservando cupos en este folio. Debes resolverlas antes de cerrar el folio.';
  end if;

  update public.hiring_requests hr
     set status = 'closed',
         current_step_code = null,
         rejected_at = timezone('utc', now()),
         final_decided_by = current_user_id,
         updated_at = timezone('utc', now())
   where hr.id = p_request_id;

  update public.hiring_request_approvals hra
     set status = 'rejected',
         decision_by = current_user_id,
         decision_comment = coalesce(normalized_comment, 'Folio cerrado manualmente'),
         decided_at = timezone('utc', now()),
         locked_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   where hra.hiring_request_id = p_request_id
     and hra.status = 'pending';

  update public.recruitment_cases rc
     set status = 'cancelled',
         close_reason = coalesce(normalized_comment, 'Folio de origen cerrado manualmente'),
         closed_at = timezone('utc', now()),
         closed_by = current_user_id,
         target_close_date = timezone('utc', now())::date,
         updated_at = timezone('utc', now())
   where rc.hiring_request_id = p_request_id
     and rc.status not in ('filled', 'closed_unfilled', 'cancelled');

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
      'previous_status', request_record.status,
      'status_changed_to', 'closed'
    )
  );

  return query
  select request_record.id, 'closed'::text;
end;
$$;

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

  if normalized_status not in ('pending', 'executed', 'rejected') then
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
    raise exception 'Solo las movilidades aprobadas admiten gestión RRHH';
  end if;

  if request_record.hr_execution_status = normalized_status
     and not (normalized_status = 'rejected' and request_record.status <> 'rejected') then
    return query
    select
      request_record.id,
      request_record.hr_execution_status,
      request_record.hr_execution_updated_at,
      request_record.hr_execution_executed_at;
    return;
  end if;

  update public.internal_mobility_requests imr
     set status = case
           when normalized_status = 'rejected' then 'rejected'
           else imr.status
         end,
         hr_execution_status = normalized_status,
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
         rejected_at = case
           when normalized_status = 'rejected' then coalesce(imr.rejected_at, now_utc)
           else imr.rejected_at
         end,
         final_decided_by = case
           when normalized_status = 'rejected' then current_user_id
           else imr.final_decided_by
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
    case when normalized_status = 'rejected' then 'rejected' else 'hr_execution_updated' end,
    jsonb_build_object(
      'status', request_record.status,
      'rejected_at', request_record.rejected_at,
      'final_decided_by', request_record.final_decided_by,
      'hr_execution_status', request_record.hr_execution_status,
      'hr_execution_updated_at', request_record.hr_execution_updated_at,
      'hr_execution_executed_at', request_record.hr_execution_executed_at
    ),
    jsonb_build_object(
      'status', case when normalized_status = 'rejected' then 'rejected' else request_record.status end,
      'rejected_at', case when normalized_status = 'rejected' then coalesce(request_record.rejected_at, now_utc) else request_record.rejected_at end,
      'final_decided_by', case when normalized_status = 'rejected' then current_user_id else request_record.final_decided_by end,
      'hr_execution_status', normalized_status,
      'hr_execution_updated_at', now_utc,
      'hr_execution_executed_at', case when normalized_status = 'executed' then now_utc else null end
    ),
    jsonb_build_object(
      'updated_by', current_user_id,
      'updated_phase', 'rrhh_execution'
    )
  );

  if request_record.recruitment_case_id is not null then
    perform public.sync_recruitment_case_status(request_record.recruitment_case_id, current_user_id);
  end if;

  return query
  select
    request_record.id,
    normalized_status,
    now_utc,
    case when normalized_status = 'executed' then now_utc else null end;
end;
$function$;

notify pgrst, 'reload schema';

commit;
