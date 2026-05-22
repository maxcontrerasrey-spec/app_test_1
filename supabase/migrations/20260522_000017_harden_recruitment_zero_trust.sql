begin;

create or replace function public.user_can_view_recruitment_case(
  target_user_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    public.user_is_admin(target_user_id)
    or public.user_has_role(target_user_id, 'reclutamiento')
    or exists (
      select 1
      from public.recruitment_case_assignments rca
      where rca.recruitment_case_id = target_case_id
        and rca.user_id = target_user_id
    );
$function$;

create or replace function public.user_can_manage_recruitment_case(
  target_user_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    public.user_is_admin(target_user_id)
    or public.user_has_role(target_user_id, 'reclutamiento')
    or exists (
      select 1
      from public.recruitment_case_assignments rca
      where rca.recruitment_case_id = target_case_id
        and rca.user_id = target_user_id
        and rca.assignment_role in ('owner', 'recruiter')
    );
$function$;

create or replace function public.user_can_access_recruitment_case(
  target_user_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select public.user_can_view_recruitment_case(target_user_id, target_case_id);
$function$;

revoke all on function public.user_can_view_recruitment_case(uuid, uuid) from public, anon;
revoke all on function public.user_can_manage_recruitment_case(uuid, uuid) from public, anon;
revoke all on function public.user_can_access_recruitment_case(uuid, uuid) from public, anon;
grant execute on function public.user_can_view_recruitment_case(uuid, uuid) to authenticated;
grant execute on function public.user_can_manage_recruitment_case(uuid, uuid) to authenticated;
grant execute on function public.user_can_access_recruitment_case(uuid, uuid) to authenticated;

create or replace function public.get_recruitment_case_detail(
  p_case_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  case_payload jsonb;
  assignments_payload jsonb := '[]'::jsonb;
  candidates_payload jsonb := '[]'::jsonb;
  audit_payload jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_view_recruitment_case(current_user_id, p_case_id) then
    raise exception 'Sin permisos para ver este caso';
  end if;

  select jsonb_build_object(
    'id', rc.id,
    'case_code', rc.case_code,
    'status', rc.status,
    'requested_vacancies', rc.requested_vacancies,
    'filled_vacancies', rc.filled_vacancies,
    'title', rc.title,
    'contract_name', rc.contract_name,
    'job_position_name', rc.job_position_name,
    'cost_center_code', rc.cost_center_code,
    'cost_center_name', rc.cost_center_name,
    'requested_entry_date', rc.requested_entry_date,
    'target_close_date', rc.target_close_date,
    'opened_at', rc.opened_at,
    'close_reason', rc.close_reason,
    'hiring_request', jsonb_build_object(
      'id', hr.id,
      'folio', hr.folio,
      'requester_name', hr.requester_name,
      'requester_email', hr.requester_email,
      'start_date', hr.start_date,
      'end_date', hr.end_date,
      'shift_name', hr.shift_name,
      'salary_offer', hr.salary_offer,
      'campamento', hr.campamento,
      'pasajes', hr.pasajes,
      'other_benefits', hr.other_benefits
    )
  )
  into case_payload
  from public.recruitment_cases rc
  join public.hiring_requests hr
    on hr.id = rc.hiring_request_id
  where rc.id = p_case_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rca.id,
        'user_id', rca.user_id,
        'assignment_role', rca.assignment_role,
        'is_primary', rca.is_primary,
        'assigned_at', rca.assigned_at,
        'full_name', p.full_name,
        'email', p.email
      )
      order by rca.is_primary desc, rca.id asc
    ),
    '[]'::jsonb
  )
  into assignments_payload
  from public.recruitment_case_assignments rca
  join public.profiles p
    on p.id = rca.user_id
  where rca.recruitment_case_id = p_case_id;

  select coalesce(
    jsonb_agg(candidate_row.payload order by candidate_row.sort_created_at asc),
    '[]'::jsonb
  )
  into candidates_payload
  from (
    select
      jsonb_build_object(
        'id', rcc.id,
        'candidate_profile_id', cp.id,
        'national_id', cp.national_id,
        'full_name', cp.full_name,
        'email', cp.email,
        'phone', cp.phone,
        'driver_license_number', cp.driver_license_number,
        'driver_license_class', cp.driver_license_class,
        'driver_license_expiry', cp.driver_license_expiry,
        'stage_code', rcc.stage_code,
        'stage_entered_at', rcc.stage_entered_at,
        'suitability_status', rcc.suitability_status,
        'is_selected', rcc.is_selected,
        'hired_at', rcc.hired_at,
        'created_at', rcc.created_at,
        'stage_history', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', sh.id,
              'from_stage', sh.from_stage,
              'to_stage', sh.to_stage,
              'changed_by', sh.changed_by,
              'reason_code', sh.reason_code,
              'comment', sh.comment,
              'created_at', sh.created_at
            )
            order by sh.created_at desc
          )
          from public.recruitment_case_candidate_stage_history sh
          where sh.recruitment_case_candidate_id = rcc.id
        ), '[]'::jsonb)
      ) as payload,
      rcc.created_at as sort_created_at
    from public.recruitment_case_candidates rcc
    join public.candidate_profiles cp
      on cp.id = rcc.candidate_profile_id
    where rcc.recruitment_case_id = p_case_id
  ) as candidate_row;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', al.id,
        'action_type', al.action_type,
        'actor_user_id', al.actor_user_id,
        'actor_name', actor_profile.full_name,
        'old_values', al.old_values,
        'new_values', al.new_values,
        'metadata', al.metadata,
        'created_at', al.created_at
      )
      order by al.created_at desc
    ),
    '[]'::jsonb
  )
  into audit_payload
  from public.recruitment_case_audit_log al
  left join public.profiles actor_profile
    on actor_profile.id = al.actor_user_id
  where al.recruitment_case_id = p_case_id
  limit 40;

  return jsonb_build_object(
    'case', case_payload,
    'assignments', assignments_payload,
    'candidates', candidates_payload,
    'audit', audit_payload
  );
end;
$function$;

create or replace function public.add_candidate_to_recruitment_case(
  p_case_id uuid,
  p_national_id text,
  p_full_name text,
  p_email text default null,
  p_phone text default null
)
returns table (
  case_candidate_id uuid,
  candidate_profile_id uuid
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  case_record public.recruitment_cases%rowtype;
  profile_id uuid;
  created_case_candidate_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, p_case_id) then
    raise exception 'Sin permisos para actualizar este caso';
  end if;

  select *
    into case_record
    from public.recruitment_cases rc
   where rc.id = p_case_id
   for update;

  if case_record.id is null then
    raise exception 'No existe el caso indicado';
  end if;

  if case_record.status in ('filled', 'closed_unfilled', 'cancelled') then
    raise exception 'El caso ya no acepta candidatos nuevos';
  end if;

  if nullif(trim(coalesce(p_national_id, '')), '') is null then
    raise exception 'El identificador del candidato es obligatorio';
  end if;

  if nullif(trim(coalesce(p_full_name, '')), '') is null then
    raise exception 'El nombre del candidato es obligatorio';
  end if;

  insert into public.candidate_profiles (
    national_id,
    full_name,
    email,
    phone
  )
  values (
    trim(p_national_id),
    trim(p_full_name),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), '')
  )
  on conflict (national_id) do update
  set
    full_name = excluded.full_name,
    email = coalesce(excluded.email, public.candidate_profiles.email),
    phone = coalesce(excluded.phone, public.candidate_profiles.phone),
    updated_at = timezone('utc', now())
  returning id into profile_id;

  insert into public.recruitment_case_candidates (
    recruitment_case_id,
    candidate_profile_id,
    stage_code,
    stage_entered_at,
    suitability_status,
    is_selected,
    created_by
  )
  values (
    p_case_id,
    profile_id,
    'lead',
    timezone('utc', now()),
    'unknown',
    false,
    current_user_id
  )
  on conflict (recruitment_case_id, candidate_profile_id) do nothing
  returning id into created_case_candidate_id;

  if created_case_candidate_id is null then
    select rcc.id
      into created_case_candidate_id
      from public.recruitment_case_candidates rcc
     where rcc.recruitment_case_id = p_case_id
       and rcc.candidate_profile_id = profile_id;
  else
    insert into public.recruitment_case_candidate_stage_history (
      recruitment_case_candidate_id,
      from_stage,
      to_stage,
      changed_by,
      reason_code,
      comment
    )
    values (
      created_case_candidate_id,
      null,
      'lead',
      current_user_id,
      'candidate_added',
      null
    );

    insert into public.recruitment_case_audit_log (
      recruitment_case_id,
      recruitment_case_candidate_id,
      actor_user_id,
      action_type,
      new_values,
      metadata
    )
    values (
      p_case_id,
      created_case_candidate_id,
      current_user_id,
      'candidate_added',
      jsonb_build_object(
        'candidate_profile_id', profile_id,
        'full_name', trim(p_full_name),
        'stage_code', 'lead'
      ),
      jsonb_build_object('national_id', trim(p_national_id))
    );
  end if;

  perform public.sync_recruitment_case_status(p_case_id, current_user_id);

  return query
  select created_case_candidate_id, profile_id;
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

  if p_to_stage not in ('lead', 'contacted', 'screening', 'shortlisted', 'documents_pending', 'ready_for_hire', 'hired', 'rejected', 'withdrawn') then
    raise exception 'Etapa invalida';
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
    raise exception 'El candidato ya se encuentra en esa etapa';
  end if;

  if p_to_stage in ('ready_for_hire', 'hired') then
    select *
      into conflicting_contract_lock
      from public.find_active_candidate_contract_lock(
        candidate_record.candidate_profile_id,
        candidate_record.id
      );

    if conflicting_contract_lock.case_candidate_id is not null then
      raise exception
        'El candidato ya avanza a contrato en % (%)',
        coalesce(conflicting_contract_lock.case_code, 'otro folio'),
        coalesce(conflicting_contract_lock.folio, 'sin folio');
    end if;
  end if;

  update public.recruitment_case_candidates rcc
     set stage_code = p_to_stage,
         stage_entered_at = timezone('utc', now()),
         is_selected = case
           when p_to_stage in ('ready_for_hire', 'hired') then true
           when p_to_stage in ('rejected', 'withdrawn') then false
           else rcc.is_selected
         end,
         hired_at = case
           when p_to_stage = 'hired' then timezone('utc', now())
           else rcc.hired_at
         end,
         rejection_reason = case when p_to_stage = 'rejected' then normalized_comment else rcc.rejection_reason end,
         withdrawal_reason = case when p_to_stage = 'withdrawn' then normalized_comment else rcc.withdrawal_reason end,
         suitability_status = case
           when p_to_stage in ('ready_for_hire', 'hired') then 'fit'
           when p_to_stage in ('rejected', 'withdrawn') then 'blocked'
           else rcc.suitability_status
         end,
         updated_at = timezone('utc', now())
   where rcc.id = p_case_candidate_id;

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id,
    from_stage,
    to_stage,
    changed_by,
    reason_code,
    comment
  )
  values (
    p_case_candidate_id,
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
      'stage_code', candidate_record.stage_code,
      'is_selected', candidate_record.is_selected,
      'hired_at', candidate_record.hired_at
    ),
    jsonb_build_object(
      'stage_code', p_to_stage,
      'is_selected', case
        when p_to_stage in ('ready_for_hire', 'hired') then true
        when p_to_stage in ('rejected', 'withdrawn') then false
        else candidate_record.is_selected
      end,
      'hired_at', case
        when p_to_stage = 'hired' then timezone('utc', now())
        else candidate_record.hired_at
      end
    ),
    jsonb_build_object('comment', normalized_comment)
  );

  next_case_status := public.sync_recruitment_case_status(candidate_record.recruitment_case_id, current_user_id);

  return query
  select candidate_record.recruitment_case_id, p_to_stage, next_case_status;
end;
$function$;

alter table public.recruitment_case_audit_log force row level security;
alter table public.hiring_request_audit_log force row level security;
alter table public.recruitment_case_candidate_stage_history force row level security;

drop policy if exists "recruitment_cases_select_scoped" on public.recruitment_cases;
create policy "recruitment_cases_select_scoped"
on public.recruitment_cases
for select
to authenticated
using (public.user_can_view_recruitment_case(auth.uid(), id));

drop policy if exists "recruitment_case_assignments_select_scoped" on public.recruitment_case_assignments;
create policy "recruitment_case_assignments_select_scoped"
on public.recruitment_case_assignments
for select
to authenticated
using (public.user_can_view_recruitment_case(auth.uid(), recruitment_case_id));

drop policy if exists "candidate_profiles_select_scoped" on public.candidate_profiles;
create policy "candidate_profiles_select_scoped"
on public.candidate_profiles
for select
to authenticated
using (
  public.user_is_admin(auth.uid())
  or exists (
    select 1
    from public.recruitment_case_candidates rcc
    join public.recruitment_cases rc
      on rc.id = rcc.recruitment_case_id
    where rcc.candidate_profile_id = candidate_profiles.id
      and public.user_can_view_recruitment_case(auth.uid(), rc.id)
  )
);

drop policy if exists "recruitment_case_candidates_select_scoped" on public.recruitment_case_candidates;
create policy "recruitment_case_candidates_select_scoped"
on public.recruitment_case_candidates
for select
to authenticated
using (public.user_can_view_recruitment_case(auth.uid(), recruitment_case_id));

drop policy if exists "recruitment_case_candidate_stage_history_select_scoped" on public.recruitment_case_candidate_stage_history;
create policy "recruitment_case_candidate_stage_history_select_scoped"
on public.recruitment_case_candidate_stage_history
for select
to authenticated
using (
  exists (
    select 1
    from public.recruitment_case_candidates rcc
    where rcc.id = recruitment_case_candidate_id
      and public.user_can_view_recruitment_case(auth.uid(), rcc.recruitment_case_id)
  )
);

drop policy if exists "recruitment_case_audit_log_select_scoped" on public.recruitment_case_audit_log;
create policy "recruitment_case_audit_log_select_scoped"
on public.recruitment_case_audit_log
for select
to authenticated
using (public.user_can_view_recruitment_case(auth.uid(), recruitment_case_id));

revoke insert, update, delete on public.recruitment_case_audit_log from authenticated;
revoke insert, update, delete on public.hiring_request_audit_log from authenticated;
revoke insert, update, delete on public.recruitment_case_candidate_stage_history from authenticated;

revoke execute on function public.open_recruitment_case_from_hiring_request(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sync_recruitment_case_status(uuid, uuid) from public, anon, authenticated;

grant execute on function public.get_recruitment_case_detail(uuid) to authenticated;
grant execute on function public.add_candidate_to_recruitment_case(uuid, text, text, text, text) to authenticated;
grant execute on function public.advance_recruitment_candidate_stage(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
