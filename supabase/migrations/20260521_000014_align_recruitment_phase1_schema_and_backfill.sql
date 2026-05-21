begin;

alter table if exists public.recruitment_cases
  add column if not exists requested_vacancies integer,
  add column if not exists filled_vacancies integer,
  add column if not exists title text,
  add column if not exists contract_id bigint references public.contracts (id) on delete restrict,
  add column if not exists contract_name text,
  add column if not exists job_position_id bigint references public.job_positions (id) on delete restrict,
  add column if not exists job_position_name text,
  add column if not exists cost_center_code text,
  add column if not exists cost_center_name text,
  add column if not exists requested_entry_date date,
  add column if not exists target_close_date date,
  add column if not exists opened_at timestamptz,
  add column if not exists opened_by uuid references public.profiles (id) on delete restrict,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles (id) on delete set null,
  add column if not exists close_reason text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table if exists public.recruitment_case_assignments
  add column if not exists assignment_role text,
  add column if not exists is_primary boolean default false,
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by uuid references public.profiles (id) on delete set null;

alter table if exists public.candidate_profiles
  add column if not exists driver_license_number text,
  add column if not exists driver_license_class text,
  add column if not exists driver_license_expiry date,
  add column if not exists current_city text,
  add column if not exists source text,
  add column if not exists status text default 'active',
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table if exists public.recruitment_case_candidates
  add column if not exists ranking_score numeric(5,2),
  add column if not exists suitability_status text default 'unknown',
  add column if not exists rejection_reason text,
  add column if not exists withdrawal_reason text,
  add column if not exists hired_at timestamptz,
  add column if not exists created_by uuid references public.profiles (id) on delete restrict,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table if exists public.recruitment_case_candidate_stage_history
  add column if not exists from_stage text,
  add column if not exists to_stage text,
  add column if not exists changed_by uuid references public.profiles (id) on delete restrict,
  add column if not exists reason_code text,
  add column if not exists comment text,
  add column if not exists created_at timestamptz;

alter table if exists public.recruitment_case_audit_log
  add column if not exists recruitment_case_candidate_id uuid references public.recruitment_case_candidates (id) on delete set null,
  add column if not exists actor_user_id uuid references public.profiles (id) on delete restrict,
  add column if not exists action_type text,
  add column if not exists old_values jsonb,
  add column if not exists new_values jsonb,
  add column if not exists metadata jsonb,
  add column if not exists created_at timestamptz;

update public.recruitment_cases rc
set
  requested_vacancies = coalesce(rc.requested_vacancies, hr.vacancies),
  filled_vacancies = coalesce(rc.filled_vacancies, 0),
  title = coalesce(rc.title, format('%s · %s', hr.job_position_name, hr.contract_name)),
  contract_id = coalesce(rc.contract_id, hr.contract_id),
  contract_name = coalesce(rc.contract_name, hr.contract_name),
  job_position_id = coalesce(rc.job_position_id, hr.job_position_id),
  job_position_name = coalesce(rc.job_position_name, hr.job_position_name),
  cost_center_code = coalesce(rc.cost_center_code, hr.cost_center_code),
  cost_center_name = coalesce(rc.cost_center_name, hr.cost_center_name),
  requested_entry_date = coalesce(rc.requested_entry_date, hr.requested_entry_date),
  target_close_date = coalesce(rc.target_close_date, hr.start_date),
  opened_at = coalesce(rc.opened_at, hr.approved_at, hr.submitted_at, hr.created_at, timezone('utc', now())),
  opened_by = coalesce(rc.opened_by, hr.final_decided_by, hr.submitted_by, hr.requester_id),
  created_at = coalesce(rc.created_at, hr.created_at, timezone('utc', now())),
  updated_at = coalesce(rc.updated_at, hr.updated_at, timezone('utc', now()))
from public.hiring_requests hr
where hr.id = rc.hiring_request_id;

update public.candidate_profiles
set
  status = coalesce(status, 'active'),
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()));

update public.recruitment_case_candidates
set
  suitability_status = coalesce(suitability_status, 'unknown'),
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()));

update public.recruitment_case_assignments
set
  assignment_role = coalesce(assignment_role, 'owner'),
  is_primary = coalesce(is_primary, false),
  assigned_at = coalesce(assigned_at, timezone('utc', now()));

update public.recruitment_case_candidate_stage_history
set
  created_at = coalesce(created_at, timezone('utc', now()));

update public.recruitment_case_audit_log
set
  created_at = coalesce(created_at, timezone('utc', now()));

create index if not exists idx_recruitment_cases_status_target_close_date
  on public.recruitment_cases (status, target_close_date);
create index if not exists idx_recruitment_cases_cost_center_status
  on public.recruitment_cases (cost_center_code, status);
create index if not exists idx_recruitment_case_assignments_case_id
  on public.recruitment_case_assignments (recruitment_case_id);
create index if not exists idx_recruitment_case_assignments_user_id
  on public.recruitment_case_assignments (user_id);
create index if not exists idx_candidate_profiles_full_name
  on public.candidate_profiles (full_name);
create index if not exists idx_recruitment_case_candidates_case_stage
  on public.recruitment_case_candidates (recruitment_case_id, stage_code);
create index if not exists idx_recruitment_case_candidates_profile_id
  on public.recruitment_case_candidates (candidate_profile_id);
create index if not exists idx_recruitment_case_candidate_stage_history_candidate_id
  on public.recruitment_case_candidate_stage_history (recruitment_case_candidate_id, created_at desc);
create index if not exists idx_recruitment_case_audit_log_case_id
  on public.recruitment_case_audit_log (recruitment_case_id, created_at desc);

drop trigger if exists trg_recruitment_cases_set_updated_at on public.recruitment_cases;
create trigger trg_recruitment_cases_set_updated_at
before update on public.recruitment_cases
for each row execute function public.set_updated_at();

drop trigger if exists trg_candidate_profiles_set_updated_at on public.candidate_profiles;
create trigger trg_candidate_profiles_set_updated_at
before update on public.candidate_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_recruitment_case_candidates_set_updated_at on public.recruitment_case_candidates;
create trigger trg_recruitment_case_candidates_set_updated_at
before update on public.recruitment_case_candidates
for each row execute function public.set_updated_at();

create or replace function public.open_recruitment_case_from_hiring_request(
  p_hiring_request_id uuid,
  p_opened_by uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  request_record public.hiring_requests%rowtype;
  existing_case_id uuid;
  owner_user_id uuid;
  created_case_id uuid;
begin
  select rc.id
    into existing_case_id
    from public.recruitment_cases rc
   where rc.hiring_request_id = p_hiring_request_id;

  if existing_case_id is not null then
    return existing_case_id;
  end if;

  select *
    into request_record
    from public.hiring_requests hr
   where hr.id = p_hiring_request_id
   for update;

  if request_record.id is null then
    raise exception 'No existe la solicitud origen';
  end if;

  if request_record.status <> 'approved' then
    raise exception 'Solo se pueden abrir casos desde solicitudes aprobadas';
  end if;

  owner_user_id := coalesce(
    p_opened_by,
    request_record.final_decided_by,
    request_record.submitted_by,
    request_record.requester_id
  );

  insert into public.recruitment_cases (
    hiring_request_id,
    case_code,
    status,
    requested_vacancies,
    filled_vacancies,
    title,
    contract_id,
    contract_name,
    job_position_id,
    job_position_name,
    cost_center_code,
    cost_center_name,
    requested_entry_date,
    target_close_date,
    opened_at,
    opened_by,
    created_at,
    updated_at
  )
  values (
    request_record.id,
    format('RC-%s', request_record.folio),
    'open',
    request_record.vacancies,
    0,
    format('%s · %s', request_record.job_position_name, request_record.contract_name),
    request_record.contract_id,
    request_record.contract_name,
    request_record.job_position_id,
    request_record.job_position_name,
    request_record.cost_center_code,
    request_record.cost_center_name,
    request_record.requested_entry_date,
    request_record.start_date,
    timezone('utc', now()),
    owner_user_id,
    timezone('utc', now()),
    timezone('utc', now())
  )
  returning id into created_case_id;

  insert into public.recruitment_case_assignments (
    recruitment_case_id,
    user_id,
    assignment_role,
    is_primary,
    assigned_at,
    assigned_by
  )
  values (
    created_case_id,
    owner_user_id,
    'owner',
    true,
    timezone('utc', now()),
    owner_user_id
  )
  on conflict (recruitment_case_id, user_id, assignment_role) do nothing;

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    actor_user_id,
    action_type,
    new_values,
    metadata
  )
  values (
    created_case_id,
    owner_user_id,
    'case_opened',
    jsonb_build_object(
      'case_code', format('RC-%s', request_record.folio),
      'status', 'open',
      'requested_vacancies', request_record.vacancies
    ),
    jsonb_build_object(
      'hiring_request_id', request_record.id,
      'folio', request_record.folio
    )
  );

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    actor_user_id,
    action_type,
    new_values,
    metadata
  )
  values (
    created_case_id,
    owner_user_id,
    'owner_assigned',
    jsonb_build_object(
      'user_id', owner_user_id,
      'assignment_role', 'owner',
      'is_primary', true
    ),
    jsonb_build_object('source', 'open_recruitment_case_from_hiring_request')
  );

  return created_case_id;
end;
$function$;

do $$
declare
  target_request_id uuid;
begin
  for target_request_id in
    select hr.id
    from public.hiring_requests hr
    left join public.recruitment_cases rc
      on rc.hiring_request_id = hr.id
    where hr.status = 'approved'
      and rc.id is null
  loop
    perform public.open_recruitment_case_from_hiring_request(target_request_id, null);
  end loop;
end $$;

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

  perform public.open_recruitment_case_from_hiring_request(request_record.id, current_user_id);

  return query
  select request_record.id, 'approved'::text, approval_record.step_code;
end;
$function$;

grant execute on function public.open_recruitment_case_from_hiring_request(uuid, uuid) to authenticated;
grant execute on function public.decide_hiring_request_approval_v2(bigint, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
