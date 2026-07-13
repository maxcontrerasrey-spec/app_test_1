begin;

do $$
declare
  target_candidate_id uuid := '9812e716-c706-4e6f-81ed-b3af80c7faa1';
  target_case_id uuid := 'ba824955-3974-4f4e-bd63-89306ad48a23';
  target_profile_id uuid := 'ad93f4ec-e57c-4ef0-9436-af45697fc673';
  latest_requested_by uuid;
  payload jsonb;
  existing_pending_job_id uuid;
  effective_job_id uuid;
begin
  select bsj.requested_by
    into latest_requested_by
    from public.buk_sync_jobs bsj
   where bsj.recruitment_case_candidate_id = target_candidate_id
   order by bsj.created_at desc, bsj.id desc
   limit 1;

  if latest_requested_by is null then
    raise exception 'No existe requested_by historico para reparar la generacion BUK de Barbara Borda';
  end if;

  if not exists (
    select 1
      from public.candidate_profiles cp
     where cp.id = target_profile_id
       and regexp_replace(coalesce(cp.national_id, ''), '[^0-9kK]', '', 'g') = '200933869'
       and cp.full_name ilike '%Borda%'
  ) then
    raise exception 'Guardrail: no coincide el perfil esperado de Barbara Borda';
  end if;

  if not exists (
    select 1
      from public.recruitment_case_candidates rcc
     where rcc.id = target_candidate_id
       and rcc.recruitment_case_id = target_case_id
       and rcc.candidate_profile_id = target_profile_id
       and rcc.stage_code = 'withdrawn'
  ) then
    raise exception 'Guardrail: el candidato no esta en el estado esperado para reparar Barbara Borda';
  end if;

  select bsj.id
    into effective_job_id
    from public.buk_sync_jobs bsj
   where bsj.recruitment_case_candidate_id = target_candidate_id
     and public.is_effective_buk_generation_success(
       bsj.status,
       bsj.buk_employee_id,
       bsj.result_snapshot
     )
   order by coalesce(bsj.finished_at, bsj.created_at) desc, bsj.id desc
   limit 1;

  if effective_job_id is not null then
    return;
  end if;

  update public.recruitment_case_candidates
     set stage_code = 'ready_for_hire',
         stage_entered_at = now(),
         updated_at = now()
   where id = target_candidate_id;

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id,
    from_stage,
    to_stage,
    changed_by,
    comment
  )
  values (
    target_candidate_id,
    'withdrawn',
    'ready_for_hire',
    latest_requested_by,
    'Reparacion auditada: ficha BUK activa creada por ERP quedo sin trabajo asociado y debe reprocesarse. source=repair_barbara_borda_buk_generation buk_employee_id=41907 previous_resolution=cancel_request_existing_active_buk_employee'
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
    target_case_id,
    target_candidate_id,
    latest_requested_by,
    'candidate_stage_changed',
    jsonb_build_object('stage_code', 'withdrawn'),
    jsonb_build_object('stage_code', 'ready_for_hire'),
    jsonb_build_object(
      'source', 'repair_barbara_borda_buk_generation',
      'buk_employee_id', '41907',
      'comment', 'Barbara Borda vuelve a cola de generacion BUK para completar trabajo faltante.'
    )
  );

  perform set_config('request.jwt.claim.sub', latest_requested_by::text, true);
  payload := public.get_candidate_buk_sync_payload(target_candidate_id);

  select bsj.id
    into existing_pending_job_id
    from public.buk_sync_jobs bsj
   where bsj.recruitment_case_candidate_id = target_candidate_id
     and bsj.status in ('pending', 'processing')
   order by bsj.created_at desc, bsj.id desc
   limit 1;

  if existing_pending_job_id is null then
    insert into public.buk_sync_jobs (
      recruitment_case_candidate_id,
      requested_by,
      status,
      payload_snapshot,
      result_snapshot
    )
    values (
      target_candidate_id,
      latest_requested_by,
      'pending',
      payload,
      jsonb_build_object(
        'repair', 'barbara_borda_reprocess_incomplete_active_buk_employee',
        'buk_employee_id', '41907'
      )
    );
  end if;

  perform public.sync_recruitment_case_status(target_case_id, latest_requested_by);
end $$;

commit;
