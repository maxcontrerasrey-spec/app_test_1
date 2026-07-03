begin;

create or replace function public.finalize_buk_sync_job_existing_active_employee(
  p_job_id uuid,
  p_existing_buk_employee_id text,
  p_result_snapshot jsonb default '{}'::jsonb
)
returns table (
  recruitment_case_candidate_id uuid,
  recruitment_case_id uuid,
  case_status text,
  request_status text,
  stage_code text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  job_record public.buk_sync_jobs%rowtype;
  candidate_record public.recruitment_case_candidates%rowtype;
  case_record public.recruitment_cases%rowtype;
  request_record public.hiring_requests%rowtype;
  actor_user_id uuid := null;
  next_case_status text := null;
  next_request_status text := null;
  normalized_employee_id text := nullif(trim(coalesce(p_existing_buk_employee_id, '')), '');
  close_comment text := 'El trabajador ya existe activo en BUK; se anula la pedida ERP para evitar duplicidad contractual.';
  has_pending_mobility boolean := false;
  should_close_request boolean := false;
  now_utc timestamptz := timezone('utc', now());
begin
  select *
    into job_record
    from public.buk_sync_jobs bsj
   where bsj.id = p_job_id
   for update;

  if job_record.id is null then
    raise exception 'No existe el job BUK';
  end if;

  if normalized_employee_id is null then
    raise exception 'Debe indicar el identificador activo existente en BUK';
  end if;

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = job_record.recruitment_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'No existe el candidato asociado al job BUK';
  end if;

  if candidate_record.stage_code not in ('ready_for_hire', 'hired') then
    raise exception 'El candidato asociado al job BUK ya no se encuentra en una etapa contratable';
  end if;

  select *
    into case_record
    from public.recruitment_cases rc
   where rc.id = candidate_record.recruitment_case_id
   for update;

  if case_record.id is null then
    raise exception 'No existe el caso asociado al job BUK';
  end if;

  if case_record.hiring_request_id is not null then
    select *
      into request_record
      from public.hiring_requests hr
     where hr.id = case_record.hiring_request_id
     for update;
  end if;

  actor_user_id := coalesce(job_record.requested_by, case_record.opened_by, case_record.created_by);

  update public.buk_sync_jobs bsj
     set status = 'success',
         buk_employee_id = normalized_employee_id,
         result_snapshot = coalesce(p_result_snapshot, '{}'::jsonb),
         error_message = null,
         finished_at = now_utc
   where bsj.id = job_record.id;

  update public.recruitment_case_candidates rcc
     set stage_code = 'withdrawn',
         stage_entered_at = now_utc,
         hired_at = null,
         withdrawal_reason = close_comment,
         updated_at = now_utc
   where rcc.id = candidate_record.id;

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id,
    from_stage,
    to_stage,
    changed_by,
    reason_code,
    comment
  )
  values (
    candidate_record.id,
    candidate_record.stage_code,
    'withdrawn',
    actor_user_id,
    'buk_active_duplicate_cancelled_request',
    close_comment
  );

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    old_values,
    new_values,
    metadata
  )
  values (
    candidate_record.recruitment_case_id,
    candidate_record.id,
    actor_user_id,
    'candidate_stage_changed',
    jsonb_build_object(
      'stage_code', candidate_record.stage_code,
      'hired_at', candidate_record.hired_at,
      'withdrawal_reason', candidate_record.withdrawal_reason
    ),
    jsonb_build_object(
      'stage_code', 'withdrawn',
      'hired_at', null,
      'withdrawal_reason', close_comment
    ),
    jsonb_build_object(
      'reason_code', 'buk_active_duplicate_cancelled_request',
      'buk_sync_job_id', job_record.id,
      'buk_employee_id', normalized_employee_id
    )
  );

  if actor_user_id is not null
     and not exists (
       select 1
         from public.candidate_document_cleanup_jobs cdcj
        where cdcj.recruitment_case_candidate_id = candidate_record.id
          and cdcj.status in ('pending', 'processing')
     ) then
    insert into public.candidate_document_cleanup_jobs (
      recruitment_case_candidate_id,
      recruitment_case_id,
      candidate_profile_id,
      terminal_stage,
      requested_by,
      status,
      result_snapshot
    )
    values (
      candidate_record.id,
      candidate_record.recruitment_case_id,
      candidate_record.candidate_profile_id,
      'withdrawn',
      actor_user_id,
      'pending',
      jsonb_build_object(
        'queued_at', now_utc,
        'queued_stage', 'withdrawn',
        'queued_by_system', true,
        'source', 'finalize_buk_sync_job_existing_active_employee'
      )
    );
  end if;

  next_case_status := public.sync_recruitment_case_status(
    candidate_record.recruitment_case_id,
    actor_user_id
  );

  select exists (
    select 1
      from public.internal_mobility_requests imr
     where imr.recruitment_case_id = candidate_record.recruitment_case_id
       and (
         imr.status in ('pending_area_manager', 'pending_contracts_control')
         or (imr.status = 'approved' and coalesce(imr.hr_execution_status, 'pending') = 'pending')
       )
  )
  into has_pending_mobility;

  should_close_request :=
    request_record.id is not null
    and request_record.status not in ('rejected', 'closed')
    and not has_pending_mobility
    and not exists (
      select 1
        from public.recruitment_case_candidates sibling
       where sibling.recruitment_case_id = candidate_record.recruitment_case_id
         and sibling.id <> candidate_record.id
         and sibling.stage_code not in ('rejected', 'withdrawn')
    );

  if should_close_request then
    update public.hiring_requests hr
       set status = 'closed',
           current_step_code = null,
           rejected_at = now_utc,
           final_decided_by = actor_user_id,
           updated_at = now_utc
     where hr.id = request_record.id;

    update public.hiring_request_approvals hra
       set status = 'rejected',
           decision_by = actor_user_id,
           decision_comment = close_comment,
           decided_at = now_utc,
           locked_at = now_utc,
           updated_at = now_utc
     where hra.hiring_request_id = request_record.id
       and hra.status = 'pending';

    update public.recruitment_cases rc
       set status = 'cancelled',
           close_reason = close_comment,
           closed_at = now_utc,
           closed_by = actor_user_id,
           target_close_date = now_utc::date,
           updated_at = now_utc
     where rc.id = case_record.id;

    insert into public.recruitment_case_audit_log (
      recruitment_case_id,
      recruitment_case_candidate_id,
      actor_user_id,
      action_type,
      old_values,
      new_values,
      metadata
    )
    values (
      case_record.id,
      candidate_record.id,
      actor_user_id,
      'case_status_synced',
      jsonb_build_object(
        'status', next_case_status,
        'close_reason', case_record.close_reason,
        'closed_at', case_record.closed_at,
        'closed_by', case_record.closed_by
      ),
      jsonb_build_object(
        'status', 'cancelled',
        'close_reason', close_comment,
        'closed_at', now_utc,
        'closed_by', actor_user_id
      ),
      jsonb_build_object(
        'reason_code', 'close_request_due_to_existing_active_buk_employee',
        'buk_sync_job_id', job_record.id,
        'buk_employee_id', normalized_employee_id
      )
    );

    insert into public.hiring_request_audit_log (
      hiring_request_id,
      actor_user_id,
      action_type,
      metadata
    )
    values (
      request_record.id,
      actor_user_id,
      'closed',
      jsonb_build_object(
        'action', 'close_request_due_to_existing_active_buk_employee',
        'comment', close_comment,
        'previous_status', request_record.status,
        'status_changed_to', 'closed',
        'recruitment_case_id', case_record.id,
        'recruitment_case_candidate_id', candidate_record.id,
        'buk_employee_id', normalized_employee_id
      )
    );

    next_case_status := 'cancelled';
    next_request_status := 'closed';
  else
    next_request_status := request_record.status;
  end if;

  return query
  select
    candidate_record.id,
    candidate_record.recruitment_case_id,
    next_case_status,
    next_request_status,
    'withdrawn'::text;
end;
$function$;

revoke all on function public.finalize_buk_sync_job_existing_active_employee(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.finalize_buk_sync_job_existing_active_employee(uuid, text, jsonb)
to service_role;

notify pgrst, 'reload schema';

commit;
