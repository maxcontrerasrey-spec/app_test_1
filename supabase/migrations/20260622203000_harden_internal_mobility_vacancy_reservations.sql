begin;

create or replace function public.get_recruitment_case_effective_metrics(
  p_case_id uuid
)
returns table (
  requested_vacancies integer,
  hired_candidate_count integer,
  ready_candidate_count integer,
  active_candidate_count integer,
  pending_mobility_count integer,
  approved_mobility_count integer,
  effective_filled_vacancies integer,
  effective_active_candidates integer,
  available_vacancies integer
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    rc.requested_vacancies,
    coalesce(candidate_stats.hired_candidate_count, 0) as hired_candidate_count,
    coalesce(candidate_stats.ready_candidate_count, 0) as ready_candidate_count,
    coalesce(candidate_stats.active_candidate_count, 0) as active_candidate_count,
    coalesce(mobility_stats.pending_mobility_count, 0) as pending_mobility_count,
    coalesce(mobility_stats.approved_mobility_count, 0) as approved_mobility_count,
    coalesce(candidate_stats.hired_candidate_count, 0) + coalesce(mobility_stats.approved_mobility_count, 0) as effective_filled_vacancies,
    coalesce(candidate_stats.active_candidate_count, 0) + coalesce(mobility_stats.pending_mobility_count, 0) as effective_active_candidates,
    greatest(
      rc.requested_vacancies - (
        coalesce(candidate_stats.hired_candidate_count, 0)
        + coalesce(mobility_stats.pending_mobility_count, 0)
        + coalesce(mobility_stats.approved_mobility_count, 0)
      ),
      0
    ) as available_vacancies
  from public.recruitment_cases rc
  left join lateral (
    select
      count(*) filter (where rcc.stage_code = 'hired') as hired_candidate_count,
      count(*) filter (where rcc.stage_code = 'ready_for_hire') as ready_candidate_count,
      count(*) filter (where rcc.stage_code not in ('rejected', 'withdrawn', 'hired', 'ready_for_hire')) as active_candidate_count
    from public.recruitment_case_candidates rcc
    where rcc.recruitment_case_id = rc.id
  ) as candidate_stats on true
  left join lateral (
    select
      count(*) filter (
        where imr.status in ('pending_area_manager', 'pending_contracts_control')
      ) as pending_mobility_count,
      count(*) filter (where imr.status = 'approved') as approved_mobility_count
    from public.internal_mobility_requests imr
    where imr.recruitment_case_id = rc.id
  ) as mobility_stats on true
  where rc.id = p_case_id;
$function$;

create or replace function public.internal_mobility_request_has_reserved_slot(
  p_request_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  with target_request as (
    select
      imr.id,
      imr.recruitment_case_id
    from public.internal_mobility_requests imr
    where imr.id = p_request_id
      and imr.recruitment_case_id is not null
  ),
  candidate_capacity as (
    select
      greatest(
        rc.requested_vacancies - coalesce(candidate_stats.hired_candidate_count, 0),
        0
      ) as mobility_capacity
    from target_request tr
    join public.recruitment_cases rc
      on rc.id = tr.recruitment_case_id
    left join lateral (
      select
        count(*) filter (where rcc.stage_code = 'hired') as hired_candidate_count
      from public.recruitment_case_candidates rcc
      where rcc.recruitment_case_id = rc.id
    ) as candidate_stats on true
  ),
  reservation_queue as (
    select
      imr.id,
      row_number() over (
        order by
          coalesce(imr.submitted_at, imr.created_at) asc,
          imr.created_at asc,
          imr.id asc
      ) as reservation_rank
    from target_request tr
    join public.internal_mobility_requests imr
      on imr.recruitment_case_id = tr.recruitment_case_id
    where imr.status in ('pending_area_manager', 'pending_contracts_control', 'approved')
  )
  select coalesce((
    select rq.reservation_rank <= cc.mobility_capacity
    from target_request tr
    join reservation_queue rq
      on rq.id = tr.id
    cross join candidate_capacity cc
  ), false);
$function$;

create or replace function public.decide_internal_mobility_request_approval(
  p_approval_id bigint,
  p_decision text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  approval_record public.internal_mobility_request_approvals%rowtype;
  request_record public.internal_mobility_requests%rowtype;
  contracts_control_record public.workflow_approvers%rowtype;
  next_approval_id bigint;
  now_utc timestamptz := timezone('utc', now());
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision invalida';
  end if;

  select *
    into approval_record
    from public.internal_mobility_request_approvals imra
   where imra.id = p_approval_id
   for update;

  if approval_record.id is null then
    raise exception 'No existe la aprobación indicada';
  end if;

  if approval_record.status <> 'pending' then
    raise exception 'La aprobación seleccionada ya fue resuelta';
  end if;

  if approval_record.step_code not in ('area_manager', 'contracts_control') then
    raise exception 'La etapa indicada no admite decisiones manuales';
  end if;

  if approval_record.approver_user_id is null
     or (approval_record.approver_user_id <> current_user_id and not public.user_is_admin(current_user_id)) then
    raise exception 'Solo el aprobador asignado puede decidir esta solicitud';
  end if;

  select *
    into request_record
    from public.internal_mobility_requests imr
   where imr.id = approval_record.internal_mobility_request_id
   for update;

  if request_record.id is null then
    raise exception 'No existe la solicitud asociada';
  end if;

  if request_record.current_step_code is distinct from approval_record.step_code then
    raise exception 'La solicitud ya no se encuentra en esta etapa';
  end if;

  if p_decision = 'approved'
     and approval_record.step_code = 'contracts_control'
     and request_record.recruitment_case_id is not null
     and not public.internal_mobility_request_has_reserved_slot(request_record.id) then
    raise exception 'El folio ya no tiene un cupo reservado para esta movilidad. Rechaza la solicitud o reasignala a otro folio.';
  end if;

  update public.internal_mobility_request_approvals imra
     set status = p_decision,
         decision_by = current_user_id,
         decision_comment = nullif(trim(coalesce(p_comment, '')), ''),
         decided_at = now_utc,
         locked_at = now_utc,
         updated_at = now_utc
   where imra.id = approval_record.id;

  if p_decision = 'rejected' then
    update public.internal_mobility_requests imr
       set status = 'rejected',
           current_step_code = null,
           rejected_at = now_utc,
           approved_at = null,
           final_decided_by = current_user_id,
           updated_at = now_utc
     where imr.id = request_record.id;

    insert into public.internal_mobility_request_audit_log (
      internal_mobility_request_id,
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
        'approval_status', approval_record.status,
        'request_status', request_record.status,
        'current_step_code', request_record.current_step_code
      ),
      jsonb_build_object(
        'approval_status', 'rejected',
        'request_status', 'rejected',
        'current_step_code', null,
        'step_code', approval_record.step_code,
        'comment', nullif(trim(coalesce(p_comment, '')), '')
      ),
      jsonb_build_object('decided_by', current_user_id)
    );

    if request_record.recruitment_case_id is not null then
      perform public.sync_recruitment_case_status(request_record.recruitment_case_id, current_user_id);
    end if;

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
      raise exception 'Control de Contratos aún no tiene usuario vinculado en la plataforma';
    end if;

    if not exists (
      select 1
      from public.profiles p
      where p.id = contracts_control_record.approver_user_id
        and p.status = 'active'
    ) then
      raise exception 'El usuario configurado para Control de Contratos no tiene una cuenta activa';
    end if;

    insert into public.internal_mobility_request_approvals (
      internal_mobility_request_id,
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
      now_utc,
      now_utc
    )
    on conflict (internal_mobility_request_id, step_code) do update
    set approver_user_id = excluded.approver_user_id,
        approver_name = excluded.approver_name,
        approver_email = excluded.approver_email,
        status = 'pending',
        decision_by = null,
        decision_comment = null,
        decided_at = null,
        locked_at = null,
        updated_at = now_utc
    returning id into next_approval_id;

    update public.internal_mobility_requests imr
       set status = 'pending_contracts_control',
           current_step_code = 'contracts_control',
           final_decided_by = null,
           approved_at = null,
           rejected_at = null,
           updated_at = now_utc
     where imr.id = request_record.id;

    insert into public.internal_mobility_request_audit_log (
      internal_mobility_request_id,
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
        'approval_status', approval_record.status,
        'request_status', request_record.status,
        'current_step_code', request_record.current_step_code
      ),
      jsonb_build_object(
        'approval_status', 'approved',
        'request_status', 'pending_contracts_control',
        'current_step_code', 'contracts_control',
        'step_code', approval_record.step_code,
        'comment', nullif(trim(coalesce(p_comment, '')), '')
      ),
      jsonb_build_object('decided_by', current_user_id)
    );

    insert into public.internal_mobility_request_audit_log (
      internal_mobility_request_id,
      approval_id,
      actor_user_id,
      action_type,
      new_values,
      metadata
    )
    select
      request_record.id,
      imra.id,
      current_user_id,
      'approval_created',
      jsonb_build_object(
        'step_code', imra.step_code,
        'step_name', imra.step_name,
        'approver_user_id', imra.approver_user_id,
        'approver_name', imra.approver_name,
        'approver_email', imra.approver_email,
        'status', imra.status
      ),
      jsonb_build_object('created_by_flow', 'decide_internal_mobility_request_approval')
    from public.internal_mobility_request_approvals imra
    where imra.id = next_approval_id;

    return;
  end if;

  update public.internal_mobility_requests imr
     set status = 'approved',
         current_step_code = null,
         approved_at = now_utc,
         rejected_at = null,
         final_decided_by = current_user_id,
         updated_at = now_utc
   where imr.id = request_record.id;

  insert into public.internal_mobility_request_audit_log (
    internal_mobility_request_id,
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
      'approval_status', approval_record.status,
      'request_status', request_record.status,
      'current_step_code', request_record.current_step_code
    ),
    jsonb_build_object(
      'approval_status', 'approved',
      'request_status', 'approved',
      'current_step_code', null,
      'step_code', approval_record.step_code,
      'comment', nullif(trim(coalesce(p_comment, '')), '')
    ),
    jsonb_build_object('decided_by', current_user_id)
  );

  if request_record.recruitment_case_id is not null then
    perform public.sync_recruitment_case_status(request_record.recruitment_case_id, current_user_id);
  end if;

  perform public.enqueue_internal_mobility_recruitment_handoff_email(request_record.id);
end;
$function$;

revoke all on function public.internal_mobility_request_has_reserved_slot(uuid) from public, anon;
grant execute on function public.internal_mobility_request_has_reserved_slot(uuid) to authenticated;

commit;
