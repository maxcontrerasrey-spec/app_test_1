begin;

-- 1. Nueva función find_candidate_profile_with_history_by_rut
drop function if exists public.find_candidate_profile_with_history_by_rut(text);
create or replace function public.find_candidate_profile_with_history_by_rut(
  p_national_id text
)
returns table (
  id uuid,
  national_id text,
  full_name text,
  email text,
  phone text,
  historical_rejections jsonb
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  profile_rec public.candidate_profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  select cp.* into profile_rec
    from public.candidate_profiles cp
   where cp.national_id = trim(p_national_id)
   limit 1;

  if profile_rec.id is null then
    return;
  end if;

  return query
  select
    profile_rec.id,
    profile_rec.national_id,
    profile_rec.full_name,
    profile_rec.email,
    profile_rec.phone,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'case_code', rc.case_code,
            'job_position', rc.job_position_name,
            'stage_code', rcc.stage_code,
            'rejection_reason', coalesce(rcc.rejection_reason, rcc.withdrawal_reason),
            'date', coalesce(rcc.updated_at, rcc.created_at)
          ) order by coalesce(rcc.updated_at, rcc.created_at) desc
        )
        from public.recruitment_case_candidates rcc
        join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
        where rcc.candidate_profile_id = profile_rec.id
          and rcc.stage_code in ('rejected', 'withdrawn')
      ),
      '[]'::jsonb
    );
end;
$function$;

-- 2. Actualizar advance_recruitment_candidate_stage
drop function if exists public.advance_recruitment_candidate_stage(uuid, text, text);
create or replace function public.advance_recruitment_candidate_stage(
  p_case_candidate_id uuid,
  p_to_stage text,
  p_comment text default null
)
returns table (
  recruitment_case_id uuid,
  stage_code text,
  case_status text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
  next_case_status text;
  conflicting_contract_lock record;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  if p_to_stage not in (
    'lead',
    'who_pending',
    'who_approved',
    'medical_exams',
    'document_review',
    'ready_for_hire',
    'hired',
    'rejected',
    'withdrawn'
  ) then
    raise exception 'Etapa invalida';
  end if;

  if p_to_stage = 'who_pending' then
    raise exception 'La etapa Who debe solicitarse con request_candidate_stage_who';
  end if;

  if p_to_stage in ('rejected', 'withdrawn') and normalized_comment is null then
    raise exception 'Debe proporcionar un motivo para descartar al candidato';
  end if;

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para actualizar este candidato';
  end if;

  if candidate_record.stage_code in ('hired', 'rejected', 'withdrawn') then
    raise exception 'El candidato ya se encuentra en una etapa terminal';
  end if;

  if candidate_record.stage_code = p_to_stage then
    raise exception 'El candidato ya se encuentra en esta etapa';
  end if;

  if candidate_record.stage_code = 'lead'
     and p_to_stage not in ('rejected', 'withdrawn') then
    raise exception 'Desde Lead solo puedes enviar a Who o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'who_pending'
     and p_to_stage not in ('rejected', 'withdrawn') then
    raise exception 'El candidato no puede avanzar hasta que la aprobación Who sea resuelta';
  end if;

  if candidate_record.stage_code = 'who_approved'
     and p_to_stage not in ('medical_exams', 'rejected', 'withdrawn') then
    raise exception 'Desde Who Aprobado solo puedes mover a Exámenes Médicos o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'medical_exams'
     and p_to_stage not in ('document_review', 'rejected', 'withdrawn') then
    raise exception 'Desde Exámenes Médicos solo puedes mover a Revisión Documental o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'document_review'
     and p_to_stage not in ('ready_for_hire', 'rejected', 'withdrawn') then
    raise exception 'Desde Revisión Documental solo puedes mover a Listo para contratar o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'ready_for_hire'
     and p_to_stage not in ('hired', 'rejected', 'withdrawn') then
    raise exception 'Desde Listo para contratar solo puedes contratar o cerrar la participación';
  end if;

  if candidate_record.stage_code = 'who_approved'
     and p_to_stage = 'medical_exams'
     and not exists (
       select 1
       from public.candidate_stage_approvals csa
       where csa.recruitment_case_candidate_id = candidate_record.id
         and csa.stage_code = 'who_pending'
         and csa.status = 'approved'
     ) then
    raise exception 'No existe aprobación Who resuelta para avanzar a Exámenes Médicos';
  end if;

  if p_to_stage = 'ready_for_hire' then
    select *
      into conflicting_contract_lock
      from public.find_active_candidate_contract_lock(
        candidate_record.candidate_profile_id,
        candidate_record.id
      )
      limit 1;

    if conflicting_contract_lock.case_candidate_id is not null then
      raise exception 'El candidato mantiene una ruta contractual activa y no puede quedar listo para contratar';
    end if;
  end if;

  update public.recruitment_case_candidates rcc
     set stage_code = p_to_stage,
         stage_entered_at = timezone('utc', now()),
         hired_at = case when p_to_stage = 'hired' then timezone('utc', now()) else rcc.hired_at end,
         rejection_reason = case when p_to_stage = 'rejected' then normalized_comment else rcc.rejection_reason end,
         withdrawal_reason = case when p_to_stage = 'withdrawn' then normalized_comment else rcc.withdrawal_reason end,
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
    p_to_stage,
    current_user_id,
    'manual_transition',
    normalized_comment
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
    current_user_id,
    case when p_to_stage = 'hired' then 'candidate_hired' else 'candidate_stage_changed' end,
    jsonb_build_object(
      'stage_code', candidate_record.stage_code
    ),
    jsonb_build_object(
      'stage_code', p_to_stage
    ),
    jsonb_build_object(
      'comment', normalized_comment
    )
  );

  next_case_status := public.sync_recruitment_case_status(candidate_record.recruitment_case_id, current_user_id);

  return query
  select candidate_record.recruitment_case_id, p_to_stage, next_case_status;
end;
$function$;

-- 3. Crear función reject_candidate_stage_who
drop function if exists public.reject_candidate_stage_who(uuid, text);
create or replace function public.reject_candidate_stage_who(
  p_case_candidate_id uuid,
  p_comment text default null
)
returns table (
  recruitment_case_id uuid,
  stage_code text,
  case_status text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  approval_record public.candidate_stage_approvals%rowtype;
  normalized_comment text := coalesce(nullif(trim(p_comment), ''), 'Rechazado por Gerencia por antecedentes Who');
  next_case_status text;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_has_capability(current_user_id, 'can_approve_who_stage') then
    raise exception 'Sin permisos para rechazar etapa Who';
  end if;

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  if candidate_record.stage_code <> 'who_pending' then
    raise exception 'El candidato no se encuentra pendiente de aprobación Who';
  end if;

  select *
    into approval_record
    from public.candidate_stage_approvals csa
   where csa.recruitment_case_candidate_id = candidate_record.id
     and csa.stage_code = 'who_pending'
     and csa.status = 'pending'
   order by csa.requested_at desc, csa.id desc
   limit 1
   for update;

  if approval_record.id is null then
    raise exception 'No existe una aprobación Who pendiente para este candidato';
  end if;

  update public.candidate_stage_approvals csa
     set status = 'rejected',
         approved_by = current_user_id,
         approved_at = timezone('utc', now()),
         comment = coalesce(normalized_comment, csa.comment),
         updated_at = timezone('utc', now())
   where csa.id = approval_record.id;

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
    current_user_id,
    'candidate_stage_approval_approved', -- Reusing this action type since we don't have candidate_stage_approval_rejected
    jsonb_build_object(
      'approval_id', approval_record.id,
      'status', 'pending',
      'stage_code', 'who_pending'
    ),
    jsonb_build_object(
      'approval_id', approval_record.id,
      'status', 'rejected',
      'stage_code', 'who_pending',
      'approved_at', timezone('utc', now())
    ),
    jsonb_build_object('comment', normalized_comment)
  );

  return query
  select * from public.advance_recruitment_candidate_stage(p_case_candidate_id, 'rejected', normalized_comment);
end;
$function$;

-- 4. Permisos
grant execute on function public.find_candidate_profile_with_history_by_rut(text) to authenticated;
grant execute on function public.advance_recruitment_candidate_stage(uuid, text, text) to authenticated;
grant execute on function public.reject_candidate_stage_who(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
