create table if not exists public.candidate_document_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  recruitment_case_candidate_id uuid not null references public.recruitment_case_candidates(id) on delete cascade,
  recruitment_case_id uuid not null references public.recruitment_cases(id) on delete cascade,
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  terminal_stage text not null check (terminal_stage in ('rejected', 'withdrawn')),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'processing', 'success', 'error')),
  attempts integer not null default 0 check (attempts >= 0),
  error_message text null,
  result_snapshot jsonb not null default '{}'::jsonb,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_candidate_document_cleanup_jobs_status_created
  on public.candidate_document_cleanup_jobs (status, created_at asc);

create unique index if not exists idx_candidate_document_cleanup_jobs_active_candidate
  on public.candidate_document_cleanup_jobs (recruitment_case_candidate_id)
  where status in ('pending', 'processing');

drop trigger if exists trg_candidate_document_cleanup_jobs_set_updated_at
  on public.candidate_document_cleanup_jobs;
create trigger trg_candidate_document_cleanup_jobs_set_updated_at
before update on public.candidate_document_cleanup_jobs
for each row execute function public.set_updated_at();

alter table public.candidate_document_cleanup_jobs enable row level security;

drop policy if exists candidate_document_cleanup_jobs_no_direct_access
  on public.candidate_document_cleanup_jobs;
create policy candidate_document_cleanup_jobs_no_direct_access
on public.candidate_document_cleanup_jobs
for all
to authenticated
using (false)
with check (false);

create or replace function public.enqueue_candidate_document_cleanup(
  p_case_candidate_id uuid
)
returns table (
  job_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  existing_job public.candidate_document_cleanup_jobs%rowtype;
  new_job_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'Candidato no encontrado para limpieza documental';
  end if;

  if candidate_record.stage_code not in ('rejected', 'withdrawn') then
    raise exception 'La limpieza documental solo aplica a candidatos rechazados o retirados';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para limpiar documentos de este candidato';
  end if;

  select *
    into existing_job
    from public.candidate_document_cleanup_jobs cdcj
   where cdcj.recruitment_case_candidate_id = candidate_record.id
     and cdcj.status in ('pending', 'processing')
   limit 1
   for update;

  if existing_job.id is not null then
    job_id := existing_job.id;
    status := existing_job.status;
    return next;
    return;
  end if;

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
    candidate_record.stage_code,
    current_user_id,
    'pending',
    jsonb_build_object(
      'queued_at', timezone('utc', now()),
      'queued_stage', candidate_record.stage_code
    )
  )
  returning id into new_job_id;

  job_id := new_job_id;
  status := 'pending';
  return next;
end;
$function$;

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
    if candidate_record.document_validation_status <> 'approved'
       or candidate_record.document_validated_by is null
       or candidate_record.document_validated_at is null then
      raise exception 'Debes aprobar la revisión documental antes de dejar al candidato listo para contratar';
    end if;

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

  if p_to_stage in ('rejected', 'withdrawn') then
    perform public.enqueue_candidate_document_cleanup(candidate_record.id);
  end if;

  next_case_status := public.sync_recruitment_case_status(candidate_record.recruitment_case_id, current_user_id);

  return query
  select candidate_record.recruitment_case_id, p_to_stage, next_case_status;
end;
$function$;

revoke all on function public.enqueue_candidate_document_cleanup(uuid) from public, anon;
grant execute on function public.enqueue_candidate_document_cleanup(uuid) to authenticated;

revoke all on table public.candidate_document_cleanup_jobs from public, anon, authenticated;

notify pgrst, 'reload schema';
