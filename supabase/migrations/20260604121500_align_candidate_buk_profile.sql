begin;

alter table if exists public.candidate_profiles
  add column if not exists document_type text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists second_last_name text,
  add column if not exists gender text,
  add column if not exists personal_email text,
  add column if not exists office_phone text,
  add column if not exists country text,
  add column if not exists street_name text,
  add column if not exists street_number text,
  add column if not exists apartment_or_office text,
  add column if not exists education_title text,
  add column if not exists education_institution text,
  add column if not exists disability_status text,
  add column if not exists disability_notice_date date,
  add column if not exists invalidity_status text,
  add column if not exists invalidity_notice_date date,
  add column if not exists labor_inclusion text,
  add column if not exists foreign_worker text;

alter table if exists public.candidate_worker_files
  add column if not exists employee_code text,
  add column if not exists private_role text,
  add column if not exists afc_start_date date,
  add column if not exists seniority_recognition_date date,
  add column if not exists progressive_vacation_start_date date,
  add column if not exists payment_method text,
  add column if not exists bank_name text,
  add column if not exists bank_account_type text,
  add column if not exists bank_account_number text,
  add column if not exists bank_branch_code text,
  add column if not exists vale_vista_type text,
  add column if not exists pension_regime text,
  add column if not exists contribution_fund text,
  add column if not exists afp_collection_entity text,
  add column if not exists increase_quote_one_percent text,
  add column if not exists health_provider text,
  add column if not exists health_plan_uf numeric(12,2),
  add column if not exists health_plan_pesos numeric(12,2),
  add column if not exists health_plan_percentage numeric(6,2),
  add column if not exists afc_regime text,
  add column if not exists retired_status text,
  add column if not exists retirement_regime text,
  add column if not exists account_two_fund text,
  add column if not exists account_two_plan text,
  add column if not exists currency text,
  add column if not exists simple_load_count integer,
  add column if not exists maternal_load_count integer,
  add column if not exists invalid_load_count integer,
  add column if not exists family_allowance_section text,
  add column if not exists personal_data_update_date date;

drop function if exists public.upsert_candidate_person_profile(
  uuid,
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
  text,
  text,
  text,
  text,
  text,
  text,
  text
);

drop function if exists public.upsert_candidate_worker_file(
  uuid,
  text,
  date,
  text,
  numeric,
  text
);

create or replace function public.upsert_candidate_person_profile(
  p_case_candidate_id uuid,
  p_document_type text default null,
  p_document_number text default null,
  p_first_name text default null,
  p_last_name text default null,
  p_second_last_name text default null,
  p_gender text default null,
  p_birth_date date default null,
  p_nationality text default null,
  p_marital_status text default null,
  p_company_email text default null,
  p_personal_email text default null,
  p_private_phone text default null,
  p_office_phone text default null,
  p_country text default null,
  p_address_line text default null,
  p_district_or_commune text default null,
  p_current_city text default null,
  p_region text default null,
  p_street_name text default null,
  p_street_number text default null,
  p_apartment_or_office text default null,
  p_education_title text default null,
  p_education_institution text default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_phone text default null,
  p_emergency_contact_relationship text default null,
  p_disability_status text default null,
  p_disability_notice_date date default null,
  p_invalidity_status text default null,
  p_invalidity_notice_date date default null,
  p_inclusion_notes text default null,
  p_labor_inclusion text default null,
  p_firefighter_status text default null,
  p_foreign_worker text default null,
  p_shirt_size text default null,
  p_pants_size text default null,
  p_shoe_size text default null
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
  normalized_document_number text := nullif(trim(coalesce(p_document_number, '')), '');
  normalized_first_name text := nullif(trim(coalesce(p_first_name, '')), '');
  normalized_last_name text := nullif(trim(coalesce(p_last_name, '')), '');
  normalized_second_last_name text := nullif(trim(coalesce(p_second_last_name, '')), '');
  normalized_full_name text := nullif(
    concat_ws(' ', normalized_first_name, normalized_last_name, normalized_second_last_name),
    ''
  );
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
     set document_type = nullif(trim(coalesce(p_document_type, '')), ''),
         national_id = coalesce(normalized_document_number, cp.national_id),
         first_name = normalized_first_name,
         last_name = normalized_last_name,
         second_last_name = normalized_second_last_name,
         full_name = coalesce(normalized_full_name, cp.full_name),
         gender = nullif(trim(coalesce(p_gender, '')), ''),
         birth_date = p_birth_date,
         nationality = nullif(trim(coalesce(p_nationality, '')), ''),
         marital_status = nullif(trim(coalesce(p_marital_status, '')), ''),
         email = nullif(trim(coalesce(p_company_email, '')), ''),
         personal_email = nullif(trim(coalesce(p_personal_email, '')), ''),
         phone = nullif(trim(coalesce(p_private_phone, '')), ''),
         office_phone = nullif(trim(coalesce(p_office_phone, '')), ''),
         country = nullif(trim(coalesce(p_country, '')), ''),
         address_line = nullif(trim(coalesce(p_address_line, '')), ''),
         district_or_commune = nullif(trim(coalesce(p_district_or_commune, '')), ''),
         current_city = nullif(trim(coalesce(p_current_city, '')), ''),
         region = nullif(trim(coalesce(p_region, '')), ''),
         street_name = nullif(trim(coalesce(p_street_name, '')), ''),
         street_number = nullif(trim(coalesce(p_street_number, '')), ''),
         apartment_or_office = nullif(trim(coalesce(p_apartment_or_office, '')), ''),
         education_title = nullif(trim(coalesce(p_education_title, '')), ''),
         education_institution = nullif(trim(coalesce(p_education_institution, '')), ''),
         emergency_contact_name = nullif(trim(coalesce(p_emergency_contact_name, '')), ''),
         emergency_contact_phone = nullif(trim(coalesce(p_emergency_contact_phone, '')), ''),
         emergency_contact_relationship = nullif(trim(coalesce(p_emergency_contact_relationship, '')), ''),
         disability_status = nullif(trim(coalesce(p_disability_status, '')), ''),
         disability_notice_date = p_disability_notice_date,
         invalidity_status = nullif(trim(coalesce(p_invalidity_status, '')), ''),
         invalidity_notice_date = p_invalidity_notice_date,
         inclusion_notes = nullif(trim(coalesce(p_inclusion_notes, '')), ''),
         labor_inclusion = nullif(trim(coalesce(p_labor_inclusion, '')), ''),
         firefighter_status = nullif(trim(coalesce(p_firefighter_status, '')), ''),
         foreign_worker = nullif(trim(coalesce(p_foreign_worker, '')), ''),
         shirt_size = nullif(trim(coalesce(p_shirt_size, '')), ''),
         pants_size = nullif(trim(coalesce(p_pants_size, '')), ''),
         shoe_size = nullif(trim(coalesce(p_shoe_size, '')), '')
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
    to_jsonb(profile_before),
    to_jsonb(profile_after),
    jsonb_build_object(
      'candidate_profile_id', candidate_record.candidate_profile_id,
      'profile_scope', 'buk_personal_profile'
    )
  );
end;
$function$;

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
  on conflict (recruitment_case_candidate_id)
  do update
     set employee_code = excluded.employee_code,
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
    case when worker_before.id is null then null else to_jsonb(worker_before) end,
    to_jsonb(worker_after),
    jsonb_build_object(
      'candidate_profile_id', candidate_record.candidate_profile_id,
      'profile_scope', 'buk_worker_profile'
    )
  );
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

revoke all on function public.upsert_candidate_person_profile(uuid, text, text, text, text, text, text, date, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, date, text, date, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.upsert_candidate_person_profile(uuid, text, text, text, text, text, text, date, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, date, text, date, text, text, text, text, text, text, text) to authenticated;

revoke all on function public.upsert_candidate_worker_file(uuid, text, text, date, text, numeric, text, text, date, date, date, text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text, text, text, integer, integer, integer, text, date) from public, anon;
grant execute on function public.upsert_candidate_worker_file(uuid, text, text, date, text, numeric, text, text, date, date, date, text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text, text, text, integer, integer, integer, text, date) to authenticated;

revoke all on function public.get_candidate_buk_profile(uuid) from public, anon;
grant execute on function public.get_candidate_buk_profile(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
