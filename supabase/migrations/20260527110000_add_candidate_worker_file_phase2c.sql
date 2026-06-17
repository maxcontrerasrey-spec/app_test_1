begin;

alter table if exists public.candidate_profiles
  add column if not exists birth_date date,
  add column if not exists nationality text,
  add column if not exists marital_status text,
  add column if not exists address_line text,
  add column if not exists district_or_commune text,
  add column if not exists region text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists emergency_contact_relationship text,
  add column if not exists inclusion_notes text,
  add column if not exists firefighter_status text,
  add column if not exists shirt_size text,
  add column if not exists pants_size text,
  add column if not exists shoe_size text,
  add column if not exists bank_name text,
  add column if not exists bank_account_type text,
  add column if not exists bank_account_number text,
  add column if not exists afp_name text,
  add column if not exists health_provider text;

create table if not exists public.candidate_worker_files (
  id uuid primary key default gen_random_uuid(),
  recruitment_case_candidate_id uuid not null unique references public.recruitment_case_candidates(id) on delete cascade,
  project_name text null,
  company_entry_date date null,
  shift_name text null,
  advance_amount numeric(12,2) null,
  contract_notes text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.candidate_worker_files enable row level security;

drop trigger if exists trg_candidate_worker_files_set_updated_at on public.candidate_worker_files;
create trigger trg_candidate_worker_files_set_updated_at
before update on public.candidate_worker_files
for each row execute function public.set_updated_at();

drop policy if exists "candidate_worker_files_select_scoped" on public.candidate_worker_files;
create policy "candidate_worker_files_select_scoped"
on public.candidate_worker_files
for select
to authenticated
using (
  exists (
    select 1
    from public.recruitment_case_candidates rcc
    where rcc.id = candidate_worker_files.recruitment_case_candidate_id
      and public.user_can_view_recruitment_case(auth.uid(), rcc.recruitment_case_id)
  )
);

create or replace function public.upsert_candidate_person_profile(
  p_case_candidate_id uuid,
  p_birth_date date default null,
  p_nationality text default null,
  p_marital_status text default null,
  p_address_line text default null,
  p_district_or_commune text default null,
  p_current_city text default null,
  p_region text default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_phone text default null,
  p_emergency_contact_relationship text default null,
  p_inclusion_notes text default null,
  p_firefighter_status text default null,
  p_shirt_size text default null,
  p_pants_size text default null,
  p_shoe_size text default null,
  p_bank_name text default null,
  p_bank_account_type text default null,
  p_bank_account_number text default null,
  p_afp_name text default null,
  p_health_provider text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  profile_before public.candidate_profiles%rowtype;
  profile_after public.candidate_profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
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
    raise exception 'Sin permisos para editar la ficha del candidato';
  end if;

  select *
    into profile_before
    from public.candidate_profiles cp
   where cp.id = candidate_record.candidate_profile_id
   for update;

  update public.candidate_profiles cp
     set birth_date = p_birth_date,
         nationality = nullif(trim(coalesce(p_nationality, '')), ''),
         marital_status = nullif(trim(coalesce(p_marital_status, '')), ''),
         address_line = nullif(trim(coalesce(p_address_line, '')), ''),
         district_or_commune = nullif(trim(coalesce(p_district_or_commune, '')), ''),
         current_city = nullif(trim(coalesce(p_current_city, '')), ''),
         region = nullif(trim(coalesce(p_region, '')), ''),
         emergency_contact_name = nullif(trim(coalesce(p_emergency_contact_name, '')), ''),
         emergency_contact_phone = nullif(trim(coalesce(p_emergency_contact_phone, '')), ''),
         emergency_contact_relationship = nullif(trim(coalesce(p_emergency_contact_relationship, '')), ''),
         inclusion_notes = nullif(trim(coalesce(p_inclusion_notes, '')), ''),
         firefighter_status = nullif(trim(coalesce(p_firefighter_status, '')), ''),
         shirt_size = nullif(trim(coalesce(p_shirt_size, '')), ''),
         pants_size = nullif(trim(coalesce(p_pants_size, '')), ''),
         shoe_size = nullif(trim(coalesce(p_shoe_size, '')), ''),
         bank_name = nullif(trim(coalesce(p_bank_name, '')), ''),
         bank_account_type = nullif(trim(coalesce(p_bank_account_type, '')), ''),
         bank_account_number = nullif(trim(coalesce(p_bank_account_number, '')), ''),
         afp_name = nullif(trim(coalesce(p_afp_name, '')), ''),
         health_provider = nullif(trim(coalesce(p_health_provider, '')), '')
   where cp.id = candidate_record.candidate_profile_id
   returning * into profile_after;

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
    'candidate_person_profile_updated',
    jsonb_build_object(
      'birth_date', profile_before.birth_date,
      'nationality', profile_before.nationality,
      'marital_status', profile_before.marital_status,
      'address_line', profile_before.address_line,
      'district_or_commune', profile_before.district_or_commune,
      'current_city', profile_before.current_city,
      'region', profile_before.region,
      'emergency_contact_name', profile_before.emergency_contact_name,
      'emergency_contact_phone', profile_before.emergency_contact_phone,
      'emergency_contact_relationship', profile_before.emergency_contact_relationship,
      'inclusion_notes', profile_before.inclusion_notes,
      'firefighter_status', profile_before.firefighter_status,
      'shirt_size', profile_before.shirt_size,
      'pants_size', profile_before.pants_size,
      'shoe_size', profile_before.shoe_size,
      'bank_name', profile_before.bank_name,
      'bank_account_type', profile_before.bank_account_type,
      'bank_account_number', profile_before.bank_account_number,
      'afp_name', profile_before.afp_name,
      'health_provider', profile_before.health_provider
    ),
    jsonb_build_object(
      'birth_date', profile_after.birth_date,
      'nationality', profile_after.nationality,
      'marital_status', profile_after.marital_status,
      'address_line', profile_after.address_line,
      'district_or_commune', profile_after.district_or_commune,
      'current_city', profile_after.current_city,
      'region', profile_after.region,
      'emergency_contact_name', profile_after.emergency_contact_name,
      'emergency_contact_phone', profile_after.emergency_contact_phone,
      'emergency_contact_relationship', profile_after.emergency_contact_relationship,
      'inclusion_notes', profile_after.inclusion_notes,
      'firefighter_status', profile_after.firefighter_status,
      'shirt_size', profile_after.shirt_size,
      'pants_size', profile_after.pants_size,
      'shoe_size', profile_after.shoe_size,
      'bank_name', profile_after.bank_name,
      'bank_account_type', profile_after.bank_account_type,
      'bank_account_number', profile_after.bank_account_number,
      'afp_name', profile_after.afp_name,
      'health_provider', profile_after.health_provider
    ),
    jsonb_build_object(
      'candidate_profile_id', candidate_record.candidate_profile_id
    )
  );
end;
$function$;

create or replace function public.upsert_candidate_worker_file(
  p_case_candidate_id uuid,
  p_project_name text default null,
  p_company_entry_date date default null,
  p_shift_name text default null,
  p_advance_amount numeric default null,
  p_contract_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  worker_before public.candidate_worker_files%rowtype;
  worker_after public.candidate_worker_files%rowtype;
  normalized_project_name text := nullif(trim(coalesce(p_project_name, '')), '');
  normalized_shift_name text := nullif(trim(coalesce(p_shift_name, '')), '');
  normalized_contract_notes text := nullif(trim(coalesce(p_contract_notes, '')), '');
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
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
    raise exception 'Sin permisos para editar la ficha del trabajador';
  end if;

  select *
    into worker_before
    from public.candidate_worker_files cwf
   where cwf.recruitment_case_candidate_id = candidate_record.id
   for update;

  if normalized_project_name is null
     and p_company_entry_date is null
     and normalized_shift_name is null
     and p_advance_amount is null
     and normalized_contract_notes is null then
    if worker_before.id is not null then
      delete from public.candidate_worker_files
       where recruitment_case_candidate_id = candidate_record.id;

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
        'candidate_worker_file_cleared',
        jsonb_build_object(
          'project_name', worker_before.project_name,
          'company_entry_date', worker_before.company_entry_date,
          'shift_name', worker_before.shift_name,
          'advance_amount', worker_before.advance_amount,
          'contract_notes', worker_before.contract_notes
        ),
        null,
        jsonb_build_object('candidate_profile_id', candidate_record.candidate_profile_id)
      );
    end if;

    return;
  end if;

  insert into public.candidate_worker_files (
    recruitment_case_candidate_id,
    project_name,
    company_entry_date,
    shift_name,
    advance_amount,
    contract_notes
  )
  values (
    candidate_record.id,
    normalized_project_name,
    p_company_entry_date,
    normalized_shift_name,
    p_advance_amount,
    normalized_contract_notes
  )
  on conflict (recruitment_case_candidate_id)
  do update
     set project_name = excluded.project_name,
         company_entry_date = excluded.company_entry_date,
         shift_name = excluded.shift_name,
         advance_amount = excluded.advance_amount,
         contract_notes = excluded.contract_notes,
         updated_at = timezone('utc', now())
  returning * into worker_after;

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
    case when worker_before.id is null then 'candidate_worker_file_created' else 'candidate_worker_file_updated' end,
    case
      when worker_before.id is null then null
      else jsonb_build_object(
        'project_name', worker_before.project_name,
        'company_entry_date', worker_before.company_entry_date,
        'shift_name', worker_before.shift_name,
        'advance_amount', worker_before.advance_amount,
        'contract_notes', worker_before.contract_notes
      )
    end,
    jsonb_build_object(
      'project_name', worker_after.project_name,
      'company_entry_date', worker_after.company_entry_date,
      'shift_name', worker_after.shift_name,
      'advance_amount', worker_after.advance_amount,
      'contract_notes', worker_after.contract_notes
    ),
    jsonb_build_object('candidate_profile_id', candidate_record.candidate_profile_id)
  );
end;
$function$;

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
      'travel_methodology', hr.travel_methodology,
      'other_benefits', hr.other_benefits,
      'approval_summary', case
        when latest_approval.id is null then null
        else jsonb_build_object(
          'step_name', latest_approval.step_name,
          'status', latest_approval.status,
          'decision_comment', latest_approval.decision_comment,
          'decided_at', latest_approval.decided_at,
          'decided_by_name', latest_approval.decided_by_name
        )
      end
    )
  )
  into case_payload
  from public.recruitment_cases rc
  join public.hiring_requests hr
    on hr.id = rc.hiring_request_id
  left join lateral (
    select
      hra.id,
      hra.step_name,
      hra.status,
      hra.decision_comment,
      hra.decided_at,
      decision_profile.full_name as decided_by_name
    from public.hiring_request_approvals hra
    left join public.profiles decision_profile
      on decision_profile.id = hra.decision_by
    where hra.hiring_request_id = hr.id
      and hra.status in ('approved', 'rejected')
    order by coalesce(hra.decided_at, hra.updated_at, hra.created_at) desc, hra.id desc
    limit 1
  ) latest_approval on true
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
        'birth_date', cp.birth_date,
        'nationality', cp.nationality,
        'marital_status', cp.marital_status,
        'address_line', cp.address_line,
        'district_or_commune', cp.district_or_commune,
        'current_city', cp.current_city,
        'region', cp.region,
        'emergency_contact_name', cp.emergency_contact_name,
        'emergency_contact_phone', cp.emergency_contact_phone,
        'emergency_contact_relationship', cp.emergency_contact_relationship,
        'inclusion_notes', cp.inclusion_notes,
        'firefighter_status', cp.firefighter_status,
        'shirt_size', cp.shirt_size,
        'pants_size', cp.pants_size,
        'shoe_size', cp.shoe_size,
        'bank_name', cp.bank_name,
        'bank_account_type', cp.bank_account_type,
        'bank_account_number', cp.bank_account_number,
        'afp_name', cp.afp_name,
        'health_provider', cp.health_provider,
        'driver_license_number', cp.driver_license_number,
        'driver_license_class', cp.driver_license_class,
        'driver_license_expiry', cp.driver_license_expiry,
        'interview_notes', rcc.interview_notes,
        'stage_code', rcc.stage_code,
        'stage_entered_at', rcc.stage_entered_at,
        'suitability_status', rcc.suitability_status,
        'is_selected', rcc.is_selected,
        'hired_at', rcc.hired_at,
        'created_at', rcc.created_at,
        'worker_file', (
          select case
            when cwf.id is null then null
            else jsonb_build_object(
              'id', cwf.id,
              'project_name', cwf.project_name,
              'company_entry_date', cwf.company_entry_date,
              'shift_name', cwf.shift_name,
              'advance_amount', cwf.advance_amount,
              'contract_notes', cwf.contract_notes,
              'created_at', cwf.created_at,
              'updated_at', cwf.updated_at
            )
          end
          from public.candidate_worker_files cwf
          where cwf.recruitment_case_candidate_id = rcc.id
          limit 1
        ),
        'who_approval', (
          select jsonb_build_object(
            'id', csa.id,
            'status', csa.status,
            'requested_by', csa.requested_by,
            'requested_by_name', requested_profile.full_name,
            'requested_at', csa.requested_at,
            'approved_by', csa.approved_by,
            'approved_by_name', approved_profile.full_name,
            'approved_at', csa.approved_at,
            'comment', csa.comment,
            'causes', csa.causes
          )
          from public.candidate_stage_approvals csa
          left join public.profiles requested_profile
            on requested_profile.id = csa.requested_by
          left join public.profiles approved_profile
            on approved_profile.id = csa.approved_by
          where csa.recruitment_case_candidate_id = rcc.id
            and csa.stage_code = 'who_pending'
          order by coalesce(csa.approved_at, csa.requested_at) desc, csa.id desc
          limit 1
        ),
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

revoke all on function public.upsert_candidate_person_profile(uuid, date, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.upsert_candidate_person_profile(uuid, date, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

revoke all on function public.upsert_candidate_worker_file(uuid, text, date, text, numeric, text) from public, anon;
grant execute on function public.upsert_candidate_worker_file(uuid, text, date, text, numeric, text) to authenticated;

revoke all on function public.get_recruitment_case_detail(uuid) from public, anon;
grant execute on function public.get_recruitment_case_detail(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
