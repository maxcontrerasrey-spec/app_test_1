begin;

do $function$
declare
  target_candidate_id constant uuid := '1da23c47-a178-4159-ad38-abf45a9b975b';
  source_cancel_job_id constant uuid := '6350098c-916c-44cb-8b8e-4657dd8c1c41';
  resolved_employee_code constant text := 'F2';
  candidate_record public.recruitment_case_candidates%rowtype;
  source_job_record public.buk_sync_jobs%rowtype;
  repaired_hired_at timestamptz := null;
  actor_user_id uuid := null;
  payload_snapshot jsonb := '{}'::jsonb;
  already_has_effective_success boolean := false;
  already_has_pending_job boolean := false;
begin
  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = target_candidate_id
   for update;

  if candidate_record.id is null then
    raise notice 'José Patricio Méndez Díaz: no existe el candidato %, se omite reparación.', target_candidate_id;
    return;
  end if;

  select *
    into source_job_record
    from public.buk_sync_jobs bsj
   where bsj.id = source_cancel_job_id
   for update;

  if source_job_record.id is null then
    raise exception 'No existe el job fuente % para reparar a José Patricio Méndez Díaz', source_cancel_job_id;
  end if;

  select coalesce(
    (
      select history.created_at
      from public.recruitment_case_candidate_stage_history history
      where history.recruitment_case_candidate_id = candidate_record.id
        and history.to_stage = 'hired'
      order by history.created_at desc, history.id desc
      limit 1
    ),
    candidate_record.hired_at,
    timezone('utc', now())
  )
  into repaired_hired_at;

  actor_user_id := coalesce(
    source_job_record.requested_by,
    candidate_record.created_by
  );

  if candidate_record.stage_code = 'withdrawn' then
    update public.recruitment_case_candidates rcc
       set stage_code = 'hired',
           stage_entered_at = repaired_hired_at,
           hired_at = repaired_hired_at,
           withdrawal_reason = null,
           updated_at = timezone('utc', now())
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
      'hired',
      actor_user_id,
      'buk_false_duplicate_repair',
      'Se revierte retiro erróneo por falso duplicado activo en BUK y se reencola generación efectiva sobre ficha F2.'
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
        'stage_code', 'hired',
        'hired_at', repaired_hired_at,
        'withdrawal_reason', null
      ),
      jsonb_build_object(
        'reason_code', 'buk_false_duplicate_repair',
        'source_buk_sync_job_id', source_job_record.id,
        'source_buk_employee_id', source_job_record.buk_employee_id,
        'reused_employee_code', resolved_employee_code
      )
    );
  end if;

  perform public.sync_recruitment_case_status(
    candidate_record.recruitment_case_id,
    actor_user_id
  );

  select exists (
    select 1
    from public.buk_sync_jobs bsj
    where bsj.recruitment_case_candidate_id = candidate_record.id
      and public.is_effective_buk_generation_success(
        bsj.status,
        bsj.buk_employee_id,
        bsj.result_snapshot
      )
  )
  into already_has_effective_success;

  select exists (
    select 1
    from public.buk_sync_jobs bsj
    where bsj.recruitment_case_candidate_id = candidate_record.id
      and bsj.status in ('pending', 'processing')
  )
  into already_has_pending_job;

  if already_has_effective_success or already_has_pending_job then
    return;
  end if;

  payload_snapshot := coalesce(source_job_record.payload_snapshot, '{}'::jsonb);
  payload_snapshot := jsonb_set(payload_snapshot, '{candidate,stage_code}', to_jsonb('hired'::text), true);
  payload_snapshot := jsonb_set(payload_snapshot, '{candidate,hired_at}', to_jsonb(repaired_hired_at), true);
  payload_snapshot := jsonb_set(payload_snapshot, '{profile,suggested_employee_code}', to_jsonb(resolved_employee_code), true);
  payload_snapshot := jsonb_set(payload_snapshot, '{profile,worker_file,employee_code}', to_jsonb(resolved_employee_code), true);
  payload_snapshot := jsonb_set(payload_snapshot, '{documents}', '[]'::jsonb, true);

  insert into public.buk_sync_jobs (
    recruitment_case_candidate_id,
    requested_by,
    status,
    payload_snapshot
  )
  values (
    candidate_record.id,
    actor_user_id,
    'pending',
    payload_snapshot
  );
end;
$function$;

notify pgrst, 'reload schema';

commit;
