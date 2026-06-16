begin;

alter table if exists public.candidate_worker_files
  add column if not exists payment_period text;

create table if not exists public.buk_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  recruitment_case_candidate_id uuid not null references public.recruitment_case_candidates(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'success', 'error')),
  buk_employee_id text null,
  error_message text null,
  attempts integer not null default 0 check (attempts >= 0),
  payload_snapshot jsonb not null default '{}'::jsonb,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_buk_sync_jobs_candidate_created
  on public.buk_sync_jobs (recruitment_case_candidate_id, created_at desc);

create index if not exists idx_buk_sync_jobs_status_created
  on public.buk_sync_jobs (status, created_at asc);

create unique index if not exists idx_buk_sync_jobs_active_candidate
  on public.buk_sync_jobs (recruitment_case_candidate_id)
  where status in ('pending', 'processing');

drop trigger if exists trg_buk_sync_jobs_set_updated_at on public.buk_sync_jobs;
create trigger trg_buk_sync_jobs_set_updated_at
before update on public.buk_sync_jobs
for each row execute function public.set_updated_at();

alter table public.buk_sync_jobs enable row level security;

drop policy if exists buk_sync_jobs_no_direct_access on public.buk_sync_jobs;
create policy buk_sync_jobs_no_direct_access
on public.buk_sync_jobs
for all
to authenticated
using (false)
with check (false);

drop function if exists public.upsert_candidate_worker_file(
  uuid,
  text,
  text,
  date,
  text,
  numeric,
  text,
  text,
  date,
  date,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  text,
  date
);

create or replace function public.upsert_candidate_worker_file(
  p_case_candidate_id uuid,
  p_employee_code text default null,
  p_project_name text default null,
  p_company_entry_date date default null,
  p_shift_name text default null,
  p_advance_amount numeric default null,
  p_contract_notes text default null,
  p_private_role text default null,
  p_afc_start_date date default null,
  p_seniority_recognition_date date default null,
  p_progressive_vacation_start_date date default null,
  p_payment_method text default null,
  p_payment_period text default null,
  p_bank_name text default null,
  p_bank_account_type text default null,
  p_bank_account_number text default null,
  p_bank_branch_code text default null,
  p_vale_vista_type text default null,
  p_pension_regime text default null,
  p_contribution_fund text default null,
  p_afp_collection_entity text default null,
  p_increase_quote_one_percent text default null,
  p_health_provider text default null,
  p_health_plan_uf numeric default null,
  p_health_plan_pesos numeric default null,
  p_health_plan_percentage numeric default null,
  p_afc_regime text default null,
  p_retired_status text default null,
  p_retirement_regime text default null,
  p_account_two_fund text default null,
  p_account_two_plan text default null,
  p_currency text default null,
  p_simple_load_count integer default null,
  p_maternal_load_count integer default null,
  p_invalid_load_count integer default null,
  p_family_allowance_section text default null,
  p_personal_data_update_date date default null
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
  normalized_employee_code text := nullif(trim(coalesce(p_employee_code, '')), '');
  normalized_project_name text := nullif(trim(coalesce(p_project_name, '')), '');
  normalized_shift_name text := nullif(trim(coalesce(p_shift_name, '')), '');
  normalized_contract_notes text := nullif(trim(coalesce(p_contract_notes, '')), '');
  normalized_private_role text := nullif(trim(coalesce(p_private_role, '')), '');
  normalized_payment_method text := nullif(trim(coalesce(p_payment_method, '')), '');
  normalized_payment_period text := nullif(trim(coalesce(p_payment_period, '')), '');
  normalized_bank_name text := nullif(trim(coalesce(p_bank_name, '')), '');
  normalized_bank_account_type text := nullif(trim(coalesce(p_bank_account_type, '')), '');
  normalized_bank_account_number text := nullif(trim(coalesce(p_bank_account_number, '')), '');
  normalized_bank_branch_code text := nullif(trim(coalesce(p_bank_branch_code, '')), '');
  normalized_vale_vista_type text := nullif(trim(coalesce(p_vale_vista_type, '')), '');
  normalized_pension_regime text := nullif(trim(coalesce(p_pension_regime, '')), '');
  normalized_contribution_fund text := nullif(trim(coalesce(p_contribution_fund, '')), '');
  normalized_afp_collection_entity text := nullif(trim(coalesce(p_afp_collection_entity, '')), '');
  normalized_increase_quote_one_percent text := nullif(trim(coalesce(p_increase_quote_one_percent, '')), '');
  normalized_health_provider text := nullif(trim(coalesce(p_health_provider, '')), '');
  normalized_afc_regime text := nullif(trim(coalesce(p_afc_regime, '')), '');
  normalized_retired_status text := nullif(trim(coalesce(p_retired_status, '')), '');
  normalized_retirement_regime text := nullif(trim(coalesce(p_retirement_regime, '')), '');
  normalized_account_two_fund text := nullif(trim(coalesce(p_account_two_fund, '')), '');
  normalized_account_two_plan text := nullif(trim(coalesce(p_account_two_plan, '')), '');
  normalized_currency text := nullif(trim(coalesce(p_currency, '')), '');
  normalized_family_allowance_section text := nullif(trim(coalesce(p_family_allowance_section, '')), '');
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

  if normalized_employee_code is null
     and normalized_project_name is null
     and p_company_entry_date is null
     and normalized_shift_name is null
     and p_advance_amount is null
     and normalized_contract_notes is null
     and normalized_private_role is null
     and p_afc_start_date is null
     and p_seniority_recognition_date is null
     and p_progressive_vacation_start_date is null
     and normalized_payment_method is null
     and normalized_payment_period is null
     and normalized_bank_name is null
     and normalized_bank_account_type is null
     and normalized_bank_account_number is null
     and normalized_bank_branch_code is null
     and normalized_vale_vista_type is null
     and normalized_pension_regime is null
     and normalized_contribution_fund is null
     and normalized_afp_collection_entity is null
     and normalized_increase_quote_one_percent is null
     and normalized_health_provider is null
     and p_health_plan_uf is null
     and p_health_plan_pesos is null
     and p_health_plan_percentage is null
     and normalized_afc_regime is null
     and normalized_retired_status is null
     and normalized_retirement_regime is null
     and normalized_account_two_fund is null
     and normalized_account_two_plan is null
     and normalized_currency is null
     and p_simple_load_count is null
     and p_maternal_load_count is null
     and p_invalid_load_count is null
     and normalized_family_allowance_section is null
     and p_personal_data_update_date is null then
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
        to_jsonb(worker_before),
        null,
        jsonb_build_object(
          'candidate_profile_id', candidate_record.candidate_profile_id,
          'profile_scope', 'buk_worker_profile'
        )
      );
    end if;

    return;
  end if;

  insert into public.candidate_worker_files (
    recruitment_case_candidate_id,
    employee_code,
    project_name,
    company_entry_date,
    shift_name,
    advance_amount,
    contract_notes,
    private_role,
    afc_start_date,
    seniority_recognition_date,
    progressive_vacation_start_date,
    payment_method,
    payment_period,
    bank_name,
    bank_account_type,
    bank_account_number,
    bank_branch_code,
    vale_vista_type,
    pension_regime,
    contribution_fund,
    afp_collection_entity,
    increase_quote_one_percent,
    health_provider,
    health_plan_uf,
    health_plan_pesos,
    health_plan_percentage,
    afc_regime,
    retired_status,
    retirement_regime,
    account_two_fund,
    account_two_plan,
    currency,
    simple_load_count,
    maternal_load_count,
    invalid_load_count,
    family_allowance_section,
    personal_data_update_date
  )
  values (
    candidate_record.id,
    normalized_employee_code,
    normalized_project_name,
    p_company_entry_date,
    normalized_shift_name,
    p_advance_amount,
    normalized_contract_notes,
    normalized_private_role,
    p_afc_start_date,
    p_seniority_recognition_date,
    p_progressive_vacation_start_date,
    normalized_payment_method,
    normalized_payment_period,
    normalized_bank_name,
    normalized_bank_account_type,
    normalized_bank_account_number,
    normalized_bank_branch_code,
    normalized_vale_vista_type,
    normalized_pension_regime,
    normalized_contribution_fund,
    normalized_afp_collection_entity,
    normalized_increase_quote_one_percent,
    normalized_health_provider,
    p_health_plan_uf,
    p_health_plan_pesos,
    p_health_plan_percentage,
    normalized_afc_regime,
    normalized_retired_status,
    normalized_retirement_regime,
    normalized_account_two_fund,
    normalized_account_two_plan,
    normalized_currency,
    p_simple_load_count,
    p_maternal_load_count,
    p_invalid_load_count,
    normalized_family_allowance_section,
    p_personal_data_update_date
  )
  on conflict (recruitment_case_candidate_id) do update
  set
    employee_code = excluded.employee_code,
    project_name = excluded.project_name,
    company_entry_date = excluded.company_entry_date,
    shift_name = excluded.shift_name,
    advance_amount = excluded.advance_amount,
    contract_notes = excluded.contract_notes,
    private_role = excluded.private_role,
    afc_start_date = excluded.afc_start_date,
    seniority_recognition_date = excluded.seniority_recognition_date,
    progressive_vacation_start_date = excluded.progressive_vacation_start_date,
    payment_method = excluded.payment_method,
    payment_period = excluded.payment_period,
    bank_name = excluded.bank_name,
    bank_account_type = excluded.bank_account_type,
    bank_account_number = excluded.bank_account_number,
    bank_branch_code = excluded.bank_branch_code,
    vale_vista_type = excluded.vale_vista_type,
    pension_regime = excluded.pension_regime,
    contribution_fund = excluded.contribution_fund,
    afp_collection_entity = excluded.afp_collection_entity,
    increase_quote_one_percent = excluded.increase_quote_one_percent,
    health_provider = excluded.health_provider,
    health_plan_uf = excluded.health_plan_uf,
    health_plan_pesos = excluded.health_plan_pesos,
    health_plan_percentage = excluded.health_plan_percentage,
    afc_regime = excluded.afc_regime,
    retired_status = excluded.retired_status,
    retirement_regime = excluded.retirement_regime,
    account_two_fund = excluded.account_two_fund,
    account_two_plan = excluded.account_two_plan,
    currency = excluded.currency,
    simple_load_count = excluded.simple_load_count,
    maternal_load_count = excluded.maternal_load_count,
    invalid_load_count = excluded.invalid_load_count,
    family_allowance_section = excluded.family_allowance_section,
    personal_data_update_date = excluded.personal_data_update_date,
    updated_at = timezone('utc', now());

  select *
    into worker_after
    from public.candidate_worker_files cwf
   where cwf.recruitment_case_candidate_id = candidate_record.id;

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
    case when worker_before.id is null then null else to_jsonb(worker_before) end,
    to_jsonb(worker_after),
    jsonb_build_object(
      'candidate_profile_id', candidate_record.candidate_profile_id,
      'profile_scope', 'buk_worker_profile'
    )
  );

  return;
end;
$function$;

create or replace function public.get_candidate_buk_profile(
  p_case_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  candidate_profile public.candidate_profiles%rowtype;
  worker_file public.candidate_worker_files%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  if not public.user_can_view_recruitment_case(current_user_id, candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para ver la ficha BUK de este candidato';
  end if;

  select *
    into candidate_profile
    from public.candidate_profiles cp
   where cp.id = candidate_record.candidate_profile_id;

  select *
    into worker_file
    from public.candidate_worker_files cwf
   where cwf.recruitment_case_candidate_id = candidate_record.id;

  return jsonb_build_object(
    'case_candidate_id', candidate_record.id,
    'candidate_profile_id', candidate_profile.id,
    'document_type', candidate_profile.document_type,
    'document_number', candidate_profile.national_id,
    'first_name', candidate_profile.first_name,
    'last_name', candidate_profile.last_name,
    'second_last_name', candidate_profile.second_last_name,
    'full_name', candidate_profile.full_name,
    'gender', candidate_profile.gender,
    'birth_date', candidate_profile.birth_date,
    'nationality', candidate_profile.nationality,
    'marital_status', candidate_profile.marital_status,
    'email', candidate_profile.email,
    'personal_email', candidate_profile.personal_email,
    'phone', candidate_profile.phone,
    'office_phone', candidate_profile.office_phone,
    'country', candidate_profile.country,
    'address_line', candidate_profile.address_line,
    'region', candidate_profile.region,
    'district_or_commune', candidate_profile.district_or_commune,
    'current_city', candidate_profile.current_city,
    'street_name', candidate_profile.street_name,
    'street_number', candidate_profile.street_number,
    'apartment_or_office', candidate_profile.apartment_or_office,
    'education_title', candidate_profile.education_title,
    'education_institution', candidate_profile.education_institution,
    'emergency_contact_name', candidate_profile.emergency_contact_name,
    'emergency_contact_phone', candidate_profile.emergency_contact_phone,
    'emergency_contact_relationship', candidate_profile.emergency_contact_relationship,
    'disability_status', candidate_profile.disability_status,
    'disability_notice_date', candidate_profile.disability_notice_date,
    'invalidity_status', candidate_profile.invalidity_status,
    'invalidity_notice_date', candidate_profile.invalidity_notice_date,
    'inclusion_notes', candidate_profile.inclusion_notes,
    'labor_inclusion', candidate_profile.labor_inclusion,
    'firefighter_status', candidate_profile.firefighter_status,
    'foreign_worker', candidate_profile.foreign_worker,
    'shirt_size', candidate_profile.shirt_size,
    'pants_size', candidate_profile.pants_size,
    'shoe_size', candidate_profile.shoe_size,
    'worker_file', case
      when worker_file.id is null then jsonb_build_object(
        'id', null,
        'employee_code', null,
        'project_name', null,
        'company_entry_date', null,
        'shift_name', null,
        'advance_amount', null,
        'contract_notes', null,
        'private_role', null,
        'afc_start_date', null,
        'seniority_recognition_date', null,
        'progressive_vacation_start_date', null,
        'payment_method', null,
        'payment_period', null,
        'bank_name', null,
        'bank_account_type', null,
        'bank_account_number', null,
        'bank_branch_code', null,
        'vale_vista_type', null,
        'pension_regime', null,
        'contribution_fund', null,
        'afp_collection_entity', null,
        'increase_quote_one_percent', null,
        'health_provider', null,
        'health_plan_uf', null,
        'health_plan_pesos', null,
        'health_plan_percentage', null,
        'afc_regime', null,
        'retired_status', null,
        'retirement_regime', null,
        'account_two_fund', null,
        'account_two_plan', null,
        'currency', null,
        'simple_load_count', null,
        'maternal_load_count', null,
        'invalid_load_count', null,
        'family_allowance_section', null,
        'personal_data_update_date', null
      )
      else jsonb_build_object(
        'id', worker_file.id,
        'employee_code', worker_file.employee_code,
        'project_name', worker_file.project_name,
        'company_entry_date', worker_file.company_entry_date,
        'shift_name', worker_file.shift_name,
        'advance_amount', worker_file.advance_amount,
        'contract_notes', worker_file.contract_notes,
        'private_role', worker_file.private_role,
        'afc_start_date', worker_file.afc_start_date,
        'seniority_recognition_date', worker_file.seniority_recognition_date,
        'progressive_vacation_start_date', worker_file.progressive_vacation_start_date,
        'payment_method', worker_file.payment_method,
        'payment_period', worker_file.payment_period,
        'bank_name', worker_file.bank_name,
        'bank_account_type', worker_file.bank_account_type,
        'bank_account_number', worker_file.bank_account_number,
        'bank_branch_code', worker_file.bank_branch_code,
        'vale_vista_type', worker_file.vale_vista_type,
        'pension_regime', worker_file.pension_regime,
        'contribution_fund', worker_file.contribution_fund,
        'afp_collection_entity', worker_file.afp_collection_entity,
        'increase_quote_one_percent', worker_file.increase_quote_one_percent,
        'health_provider', worker_file.health_provider,
        'health_plan_uf', worker_file.health_plan_uf,
        'health_plan_pesos', worker_file.health_plan_pesos,
        'health_plan_percentage', worker_file.health_plan_percentage,
        'afc_regime', worker_file.afc_regime,
        'retired_status', worker_file.retired_status,
        'retirement_regime', worker_file.retirement_regime,
        'account_two_fund', worker_file.account_two_fund,
        'account_two_plan', worker_file.account_two_plan,
        'currency', worker_file.currency,
        'simple_load_count', worker_file.simple_load_count,
        'maternal_load_count', worker_file.maternal_load_count,
        'invalid_load_count', worker_file.invalid_load_count,
        'family_allowance_section', worker_file.family_allowance_section,
        'personal_data_update_date', worker_file.personal_data_update_date
      )
    end
  );
end;
$function$;

create or replace function public.get_candidate_buk_sync_payload(
  p_case_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  candidate_record public.recruitment_case_candidates%rowtype;
  case_record public.recruitment_cases%rowtype;
  profile_record public.candidate_profiles%rowtype;
  worker_record public.candidate_worker_files%rowtype;
  documents_payload jsonb := '[]'::jsonb;
begin
  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  if candidate_record.stage_code <> 'hired' then
    raise exception 'El candidato debe estar contratado para generar en BUK';
  end if;

  if candidate_record.document_validation_status <> 'approved' then
    raise exception 'La documentación del candidato debe estar aprobada para generar en BUK';
  end if;

  select *
    into case_record
    from public.recruitment_cases rc
   where rc.id = candidate_record.recruitment_case_id;

  select *
    into profile_record
    from public.candidate_profiles cp
   where cp.id = candidate_record.candidate_profile_id;

  select *
    into worker_record
    from public.candidate_worker_files cwf
   where cwf.recruitment_case_candidate_id = candidate_record.id;

  if nullif(trim(coalesce(profile_record.document_type, '')), '') is null
     or nullif(trim(coalesce(profile_record.national_id, '')), '') is null
     or nullif(trim(coalesce(profile_record.first_name, '')), '') is null
     or nullif(trim(coalesce(profile_record.last_name, '')), '') is null
     or nullif(trim(coalesce(profile_record.gender, '')), '') is null
     or nullif(trim(coalesce(profile_record.nationality, '')), '') is null
     or profile_record.birth_date is null
     or nullif(trim(coalesce(profile_record.marital_status, '')), '') is null
     or nullif(trim(coalesce(profile_record.address_line, '')), '') is null
     or nullif(trim(coalesce(profile_record.region, '')), '') is null
     or nullif(trim(coalesce(profile_record.district_or_commune, '')), '') is null then
    raise exception 'La ficha personal BUK del candidato aún está incompleta';
  end if;

  if worker_record.id is null
     or nullif(trim(coalesce(worker_record.employee_code, '')), '') is null
     or worker_record.company_entry_date is null
     or nullif(trim(coalesce(worker_record.private_role, '')), '') is null
     or nullif(trim(coalesce(worker_record.payment_method, '')), '') is null
     or nullif(trim(coalesce(worker_record.payment_period, '')), '') is null
     or nullif(trim(coalesce(worker_record.pension_regime, '')), '') is null
     or nullif(trim(coalesce(worker_record.increase_quote_one_percent, '')), '') is null
     or nullif(trim(coalesce(worker_record.health_provider, '')), '') is null
     or nullif(trim(coalesce(worker_record.afc_regime, '')), '') is null
     or nullif(trim(coalesce(worker_record.retirement_regime, '')), '') is null then
    raise exception 'La ficha contractual BUK del candidato aún está incompleta';
  end if;

  documents_payload := coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', cd.id,
        'document_type_id', cd.document_type_id,
        'document_name', dt.name,
        'file_path', cd.file_path,
        'status', cd.status,
        'expiry_date', cd.expiry_date
      )
      order by dt.name asc
    )
    from public.candidate_documents cd
    join public.document_types dt
      on dt.id = cd.document_type_id
    where cd.recruitment_case_id = candidate_record.recruitment_case_id
      and cd.candidate_profile_id = candidate_record.candidate_profile_id
      and cd.status = 'approved'
      and cd.file_path is not null
  ), '[]'::jsonb);

  return jsonb_build_object(
    'candidate',
    jsonb_build_object(
      'case_candidate_id', candidate_record.id,
      'recruitment_case_id', candidate_record.recruitment_case_id,
      'candidate_profile_id', candidate_record.candidate_profile_id,
      'stage_code', candidate_record.stage_code,
      'document_validation_status', candidate_record.document_validation_status,
      'hired_at', candidate_record.hired_at
    ),
    'case',
    jsonb_build_object(
      'id', case_record.id,
      'case_code', case_record.case_code,
      'contract_name', case_record.contract_name,
      'job_position_name', case_record.job_position_name,
      'requested_entry_date', case_record.requested_entry_date
    ),
    'profile',
    public.get_candidate_buk_profile(candidate_record.id),
    'documents',
    documents_payload
  );
end;
$function$;

create or replace function public.enqueue_buk_generation(
  p_candidate_ids uuid[]
)
returns table (
  job_id uuid,
  recruitment_case_candidate_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_row record;
  existing_job public.buk_sync_jobs%rowtype;
  new_job_id uuid;
  payload_snapshot jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  for candidate_row in
    select distinct rcc.id, rcc.recruitment_case_id, rcc.candidate_profile_id
    from public.recruitment_case_candidates rcc
    join unnest(coalesce(p_candidate_ids, '{}'::uuid[])) as selected_candidate_id
      on selected_candidate_id = rcc.id
  loop
    if not public.user_can_manage_recruitment_case(current_user_id, candidate_row.recruitment_case_id) then
      raise exception 'Sin permisos para encolar el candidato %', candidate_row.id;
    end if;

    select *
      into existing_job
      from public.buk_sync_jobs bsj
     where bsj.recruitment_case_candidate_id = candidate_row.id
       and bsj.status in ('pending', 'processing')
     limit 1
     for update;

    if existing_job.id is not null then
      job_id := existing_job.id;
      recruitment_case_candidate_id := candidate_row.id;
      status := existing_job.status;
      return next;
      continue;
    end if;

    select *
      into existing_job
      from public.buk_sync_jobs bsj
     where bsj.recruitment_case_candidate_id = candidate_row.id
       and bsj.status = 'success'
     order by bsj.created_at desc
     limit 1;

    if existing_job.id is not null and nullif(trim(coalesce(existing_job.buk_employee_id, '')), '') is not null then
      raise exception 'El candidato % ya fue generado previamente en BUK', candidate_row.id;
    end if;

    payload_snapshot := public.get_candidate_buk_sync_payload(candidate_row.id);

    insert into public.buk_sync_jobs (
      recruitment_case_candidate_id,
      requested_by,
      status,
      payload_snapshot
    )
    values (
      candidate_row.id,
      current_user_id,
      'pending',
      payload_snapshot
    )
    returning id into new_job_id;

    job_id := new_job_id;
    recruitment_case_candidate_id := candidate_row.id;
    status := 'pending';
    return next;
  end loop;
end;
$function$;

revoke all on function public.upsert_candidate_worker_file(
  uuid,
  text,
  text,
  date,
  text,
  numeric,
  text,
  text,
  date,
  date,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  text,
  date
) from public, anon;
grant execute on function public.upsert_candidate_worker_file(
  uuid,
  text,
  text,
  date,
  text,
  numeric,
  text,
  text,
  date,
  date,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  text,
  date
) to authenticated;

revoke all on function public.enqueue_buk_generation(uuid[]) from public, anon;
grant execute on function public.enqueue_buk_generation(uuid[]) to authenticated;

notify pgrst, 'reload schema';

commit;
