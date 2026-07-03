begin;

create or replace function public.user_can_access_recruitment_personnel(
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    target_user_id is not null
    and (
      public.user_is_admin(target_user_id)
      or public.user_has_role(target_user_id, 'reclutamiento')
      or public.user_has_role(target_user_id, 'administrativo')
      or public.user_has_role(target_user_id, 'jefe_administrativo')
    );
$function$;

create or replace function public.user_can_manage_recruitment_personnel_candidate(
  target_user_id uuid,
  target_case_candidate_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    public.user_can_access_recruitment_personnel(target_user_id)
    and exists (
      select 1
      from public.recruitment_case_candidates rcc
      where rcc.id = target_case_candidate_id
        and rcc.stage_code in ('ready_for_hire', 'hired')
    );
$function$;

delete from public.role_capabilities
where role_code in ('administrativo', 'jefe_administrativo')
  and capability_code = 'candidate_control_access';

create or replace function public.update_candidate_driver_license(
  p_profile_id uuid,
  p_license_class text,
  p_license_expiry date
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  has_access boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select exists (
    select 1
      from public.recruitment_case_candidates rcc
      join public.recruitment_cases rc
        on rc.id = rcc.recruitment_case_id
     where rcc.candidate_profile_id = p_profile_id
       and (
         public.user_can_manage_recruitment_case(current_user_id, rc.id)
         or public.user_can_manage_recruitment_personnel_candidate(current_user_id, rcc.id)
       )
  )
    into has_access;

  if not has_access and public.user_is_admin(current_user_id) then
    has_access := true;
  end if;

  if not has_access then
    raise exception 'Sin permisos para editar este perfil de candidato';
  end if;

  update public.candidate_profiles
  set
    driver_license_class = nullif(trim(p_license_class), ''),
    driver_license_expiry = p_license_expiry
  where id = p_profile_id;
end;
$function$;

create or replace function public.update_candidate_interview_notes(
  p_case_candidate_id uuid,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_rec public.recruitment_case_candidates%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select *
    into candidate_rec
    from public.recruitment_case_candidates
   where id = p_case_candidate_id;

  if candidate_rec.id is null then
    raise exception 'Candidato no encontrado';
  end if;

  if not (
    public.user_can_manage_recruitment_case(current_user_id, candidate_rec.recruitment_case_id)
    or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_rec.id)
  ) then
    raise exception 'Sin permisos para editar este candidato';
  end if;

  update public.recruitment_case_candidates
  set
    interview_notes = nullif(trim(p_notes), ''),
    updated_at = timezone('utc', now())
  where id = p_case_candidate_id;

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    new_values
  )
  values (
    candidate_rec.recruitment_case_id,
    p_case_candidate_id,
    current_user_id,
    'candidate_interview_notes_updated',
    jsonb_build_object('interview_notes', nullif(trim(p_notes), ''))
  );
end;
$function$;

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

  if not (
    public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id)
    or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_record.id)
  ) then
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
  effective_employee_code text := null;
  effective_private_role text := null;
  effective_afc_start_date date := null;
  effective_seniority_recognition_date date := null;
  effective_progressive_vacation_start_date date := null;
  effective_vale_vista_type text := null;
  effective_afp_collection_entity text := null;
  effective_increase_quote_one_percent text := null;
  effective_afc_regime text := null;
  effective_retirement_regime text := null;
  effective_health_plan_uf numeric := null;
  effective_health_plan_percentage numeric := null;
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

  if not (
    public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id)
    or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_record.id)
  ) then
    raise exception 'Sin permisos para editar la ficha del trabajador';
  end if;

  select *
    into worker_before
    from public.candidate_worker_files cwf
   where cwf.recruitment_case_candidate_id = candidate_record.id
   for update;

  effective_employee_code := coalesce(
    normalized_employee_code,
    public.resolve_candidate_worker_employee_code(candidate_record.id)
  );
  effective_private_role := coalesce(normalized_private_role, 'No');
  effective_afc_start_date := coalesce(p_afc_start_date, p_company_entry_date);
  effective_seniority_recognition_date := coalesce(
    p_seniority_recognition_date,
    p_company_entry_date
  );
  effective_progressive_vacation_start_date := coalesce(
    p_progressive_vacation_start_date,
    p_company_entry_date
  );
  effective_vale_vista_type := case
    when translate(lower(trim(coalesce(normalized_payment_method, ''))), 'áéíóú', 'aeiou') =
      'vale vista' then normalized_vale_vista_type
    else null
  end;
  effective_afp_collection_entity := coalesce(
    normalized_afp_collection_entity,
    case
      when translate(lower(trim(coalesce(normalized_pension_regime, ''))), 'áéíóú', 'aeiou') =
        'afp' then normalized_contribution_fund
      else null
    end
  );
  effective_increase_quote_one_percent := coalesce(normalized_increase_quote_one_percent, 'No');
  effective_afc_regime := coalesce(normalized_afc_regime, 'Menos de 11 Años');

  if public.is_affirmative_buk_value(normalized_retired_status) then
    effective_retirement_regime := normalized_retirement_regime;
    if effective_retirement_regime is null then
      raise exception 'Debes indicar el régimen jubilación cuando Jubilado es Sí';
    end if;
  else
    effective_retirement_regime := null;
  end if;

  effective_health_plan_uf := public.resolve_candidate_buk_health_plan_uf(
    normalized_health_provider,
    p_health_plan_uf
  );
  effective_health_plan_percentage := public.resolve_candidate_buk_health_plan_percentage(
    normalized_health_provider,
    p_health_plan_percentage
  );

  if public.worker_health_provider_requires_plan(normalized_health_provider)
     and effective_health_plan_uf is null then
    raise exception 'Debes indicar Plan Isapre UF cuando Fonasa / Isapre corresponde a Isapre';
  end if;

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
    effective_employee_code,
    normalized_project_name,
    p_company_entry_date,
    normalized_shift_name,
    p_advance_amount,
    normalized_contract_notes,
    effective_private_role,
    effective_afc_start_date,
    effective_seniority_recognition_date,
    effective_progressive_vacation_start_date,
    normalized_payment_method,
    normalized_payment_period,
    normalized_bank_name,
    normalized_bank_account_type,
    normalized_bank_account_number,
    normalized_bank_branch_code,
    effective_vale_vista_type,
    normalized_pension_regime,
    normalized_contribution_fund,
    effective_afp_collection_entity,
    effective_increase_quote_one_percent,
    normalized_health_provider,
    effective_health_plan_uf,
    null,
    effective_health_plan_percentage,
    effective_afc_regime,
    normalized_retired_status,
    effective_retirement_regime,
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
  suggested_employee_code text := null;
  effective_health_plan_uf numeric := null;
  effective_health_plan_percentage numeric := null;
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

  if not (
    (
      public.user_can_access_candidate_control(current_user_id)
      and public.user_can_view_recruitment_case(current_user_id, candidate_record.recruitment_case_id)
    )
    or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_record.id)
  ) then
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

  suggested_employee_code := public.resolve_candidate_worker_employee_code(candidate_record.id);
  effective_health_plan_uf := public.resolve_candidate_buk_health_plan_uf(
    worker_file.health_provider,
    worker_file.health_plan_uf
  );
  effective_health_plan_percentage := public.resolve_candidate_buk_health_plan_percentage(
    worker_file.health_provider,
    worker_file.health_plan_percentage
  );

  return jsonb_build_object(
    'case_candidate_id', candidate_record.id,
    'candidate_profile_id', candidate_profile.id,
    'suggested_employee_code', suggested_employee_code,
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
        'employee_code', suggested_employee_code,
        'project_name', null,
        'company_entry_date', null,
        'shift_name', null,
        'advance_amount', null,
        'contract_notes', null,
        'private_role', 'No',
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
        'increase_quote_one_percent', 'No',
        'health_provider', null,
        'health_plan_uf', null,
        'health_plan_pesos', null,
        'health_plan_percentage', null,
        'afc_regime', 'Menos de 11 Años',
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
        'employee_code', coalesce(worker_file.employee_code, suggested_employee_code),
        'project_name', worker_file.project_name,
        'company_entry_date', worker_file.company_entry_date,
        'shift_name', worker_file.shift_name,
        'advance_amount', worker_file.advance_amount,
        'contract_notes', worker_file.contract_notes,
        'private_role', coalesce(worker_file.private_role, 'No'),
        'afc_start_date', coalesce(worker_file.afc_start_date, worker_file.company_entry_date),
        'seniority_recognition_date', coalesce(
          worker_file.seniority_recognition_date,
          worker_file.company_entry_date
        ),
        'progressive_vacation_start_date', coalesce(
          worker_file.progressive_vacation_start_date,
          worker_file.company_entry_date
        ),
        'payment_method', worker_file.payment_method,
        'payment_period', worker_file.payment_period,
        'bank_name', worker_file.bank_name,
        'bank_account_type', worker_file.bank_account_type,
        'bank_account_number', worker_file.bank_account_number,
        'bank_branch_code', worker_file.bank_branch_code,
        'vale_vista_type', case
          when translate(lower(trim(coalesce(worker_file.payment_method, ''))), 'áéíóú', 'aeiou') =
            'vale vista' then worker_file.vale_vista_type
          else null
        end,
        'pension_regime', worker_file.pension_regime,
        'contribution_fund', worker_file.contribution_fund,
        'afp_collection_entity', coalesce(
          worker_file.afp_collection_entity,
          case
            when translate(lower(trim(coalesce(worker_file.pension_regime, ''))), 'áéíóú', 'aeiou') =
              'afp' then worker_file.contribution_fund
            else null
          end
        ),
        'increase_quote_one_percent', coalesce(worker_file.increase_quote_one_percent, 'No'),
        'health_provider', worker_file.health_provider,
        'health_plan_uf', effective_health_plan_uf,
        'health_plan_pesos', null,
        'health_plan_percentage', effective_health_plan_percentage,
        'afc_regime', coalesce(worker_file.afc_regime, 'Menos de 11 Años'),
        'retired_status', worker_file.retired_status,
        'retirement_regime', case
          when public.is_affirmative_buk_value(worker_file.retired_status)
            then worker_file.retirement_regime
          else null
        end,
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

create or replace function public.get_candidate_checklist(
  p_case_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_rec public.recruitment_case_candidates%rowtype;
  case_rec public.recruitment_cases%rowtype;
  profile_rec public.candidate_profiles%rowtype;
  worker_rec public.candidate_worker_files%rowtype;
  checklist_docs jsonb;
  semaphore_color text;
  is_driver boolean := false;
  pending_required integer := 0;
  rejected_required integer := 0;
  expired_required integer := 0;
  uploaded_unreviewed integer := 0;
  observed_optional integer := 0;
  required_documents_total integer := 0;
  required_documents_approved integer := 0;
  missing_person_fields text[] := '{}'::text[];
  missing_worker_fields text[] := '{}'::text[];
  validated_by_name text := null;
  effective_employee_code text := null;
  effective_private_role text := null;
  effective_increase_quote_one_percent text := null;
  effective_afc_regime text := null;
  effective_retirement_regime text := null;
  effective_health_plan_uf numeric := null;
  health_plan_required boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select *
    into candidate_rec
    from public.recruitment_case_candidates
   where id = p_case_candidate_id;

  if candidate_rec.id is null then
    raise exception 'Candidato no encontrado';
  end if;

  if not (
    (
      public.user_can_access_candidate_control(current_user_id)
      and public.user_can_view_recruitment_case(current_user_id, candidate_rec.recruitment_case_id)
    )
    or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_rec.id)
  ) then
    raise exception 'Sin permisos para ver el caso de este candidato';
  end if;

  select *
    into case_rec
    from public.recruitment_cases
   where id = candidate_rec.recruitment_case_id;

  select *
    into profile_rec
    from public.candidate_profiles
   where id = candidate_rec.candidate_profile_id;

  select *
    into worker_rec
    from public.candidate_worker_files
   where recruitment_case_candidate_id = candidate_rec.id
   limit 1;

  is_driver := public.is_driver_job_position(case_rec.job_position_name);
  effective_employee_code := coalesce(
    nullif(trim(coalesce(worker_rec.employee_code, '')), ''),
    public.resolve_candidate_worker_employee_code(candidate_rec.id)
  );
  effective_private_role := coalesce(
    nullif(trim(coalesce(worker_rec.private_role, '')), ''),
    'No'
  );
  effective_increase_quote_one_percent := coalesce(
    nullif(trim(coalesce(worker_rec.increase_quote_one_percent, '')), ''),
    'No'
  );
  effective_afc_regime := coalesce(
    nullif(trim(coalesce(worker_rec.afc_regime, '')), ''),
    'Menos de 11 Años'
  );
  effective_retirement_regime := case
    when public.is_affirmative_buk_value(worker_rec.retired_status)
      then nullif(trim(coalesce(worker_rec.retirement_regime, '')), '')
    else null
  end;
  health_plan_required := public.worker_health_provider_requires_plan(worker_rec.health_provider);
  effective_health_plan_uf := public.resolve_candidate_buk_health_plan_uf(
    worker_rec.health_provider,
    worker_rec.health_plan_uf
  );

  missing_person_fields := array_remove(array[
    case when nullif(trim(coalesce(profile_rec.document_type, '')), '') is null then 'Tipo de documento' end,
    case when nullif(trim(coalesce(profile_rec.national_id, '')), '') is null then 'Número de documento' end,
    case when nullif(trim(coalesce(profile_rec.last_name, '')), '') is null then 'Apellido' end,
    case when nullif(trim(coalesce(profile_rec.first_name, '')), '') is null then 'Nombre' end,
    case when nullif(trim(coalesce(profile_rec.gender, '')), '') is null then 'Sexo' end,
    case when nullif(trim(coalesce(profile_rec.nationality, '')), '') is null then 'Nacionalidad' end,
    case when profile_rec.birth_date is null then 'Fecha de nacimiento' end,
    case when nullif(trim(coalesce(profile_rec.marital_status, '')), '') is null then 'Estado civil' end,
    case when nullif(trim(coalesce(profile_rec.personal_email, '')), '') is null then 'Email personal' end,
    case when nullif(trim(coalesce(profile_rec.address_line, '')), '') is null then 'Dirección' end,
    case when nullif(trim(coalesce(profile_rec.region, '')), '') is null then 'Región' end,
    case when nullif(trim(coalesce(profile_rec.district_or_commune, '')), '') is null then 'Comuna' end
  ], null);

  missing_worker_fields := array_remove(array[
    case when effective_employee_code is null then 'Código de ficha' end,
    case when worker_rec.company_entry_date is null then 'Ingreso compañía' end,
    case when effective_private_role is null then 'Rol privado' end,
    case when nullif(trim(coalesce(worker_rec.payment_method, '')), '') is null then 'Forma de pago' end,
    case when nullif(trim(coalesce(worker_rec.payment_period, '')), '') is null then 'Periodo de pago' end,
    case when nullif(trim(coalesce(worker_rec.pension_regime, '')), '') is null then 'Régimen previsional' end,
    case when effective_increase_quote_one_percent is null then 'Aumentar cotización 1%' end,
    case when nullif(trim(coalesce(worker_rec.health_provider, '')), '') is null then 'Fonasa / Isapre' end,
    case when effective_afc_regime is null then 'AFC' end,
    case
      when public.is_affirmative_buk_value(worker_rec.retired_status)
       and effective_retirement_regime is null then 'Régimen jubilación'
    end,
    case
      when health_plan_required
       and effective_health_plan_uf is null
        then 'Plan Isapre UF'
    end
  ], null);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', cd.id,
      'document_type_id', dt.id,
      'name', dt.name,
      'is_critical', case when is_driver then dt.required_for_driver else dt.required_for_other end,
      'is_required', case when is_driver then dt.required_for_driver else dt.required_for_other end,
      'requires_expiry_date', dt.requires_expiry_date,
      'status', coalesce(cd.status, 'pending'),
      'file_path', cd.file_path,
      'expiry_date', cd.expiry_date,
      'reviewed_at', cd.reviewed_at,
      'reviewer_notes', cd.reviewer_notes
    )
    order by
      case when is_driver then dt.required_for_driver else dt.required_for_other end desc,
      dt.name asc
  ), '[]'::jsonb)
  into checklist_docs
  from public.document_types dt
  left join public.candidate_documents cd
    on cd.document_type_id = dt.id
   and cd.candidate_profile_id = candidate_rec.candidate_profile_id
   and cd.recruitment_case_id = candidate_rec.recruitment_case_id
  where dt.active = true
    and (
      (is_driver and dt.applies_to_driver)
      or ((not is_driver) and dt.applies_to_other)
    );

  select
    count(*) filter (
      where (case when is_driver then dt.required_for_driver else dt.required_for_other end)
    ),
    count(*) filter (
      where (case when is_driver then dt.required_for_driver else dt.required_for_other end)
        and coalesce(cd.status, 'pending') = 'approved'
    ),
    count(*) filter (
      where (case when is_driver then dt.required_for_driver else dt.required_for_other end)
        and coalesce(cd.status, 'pending') = 'pending'
    ),
    count(*) filter (
      where (case when is_driver then dt.required_for_driver else dt.required_for_other end)
        and coalesce(cd.status, 'pending') = 'rejected'
    ),
    count(*) filter (
      where (case when is_driver then dt.required_for_driver else dt.required_for_other end)
        and coalesce(cd.status, 'pending') = 'expired'
    ),
    count(*) filter (
      where coalesce(cd.status, 'pending') = 'uploaded'
    ),
    count(*) filter (
      where not (case when is_driver then dt.required_for_driver else dt.required_for_other end)
        and coalesce(cd.status, 'pending') = 'rejected'
    )
  into
    required_documents_total,
    required_documents_approved,
    pending_required,
    rejected_required,
    expired_required,
    uploaded_unreviewed,
    observed_optional
  from public.document_types dt
  left join public.candidate_documents cd
    on cd.document_type_id = dt.id
   and cd.candidate_profile_id = candidate_rec.candidate_profile_id
   and cd.recruitment_case_id = candidate_rec.recruitment_case_id
  where dt.active = true
    and (
      (is_driver and dt.applies_to_driver)
      or ((not is_driver) and dt.applies_to_other)
    );

  if (pending_required + rejected_required + expired_required) > 0 then
    if required_documents_approved = 0 and uploaded_unreviewed = 0 and pending_required = required_documents_total then
      semaphore_color := 'gray';
    else
      semaphore_color := 'red';
    end if;
  elsif uploaded_unreviewed > 0 or observed_optional > 0 then
    semaphore_color := 'yellow';
  else
    semaphore_color := 'green';
  end if;

  if candidate_rec.document_validated_by is not null then
    select p.full_name
      into validated_by_name
      from public.profiles p
     where p.id = candidate_rec.document_validated_by;
  end if;

  return jsonb_build_object(
    'semaphore', semaphore_color,
    'candidate_group', case when is_driver then 'conductor' else 'otros' end,
    'worker_file_complete', coalesce(array_length(missing_person_fields, 1), 0) = 0
      and coalesce(array_length(missing_worker_fields, 1), 0) = 0,
    'missing_person_fields', to_jsonb(missing_person_fields),
    'missing_worker_fields', to_jsonb(missing_worker_fields),
    'required_documents_total', required_documents_total,
    'required_documents_approved', required_documents_approved,
    'document_validation', jsonb_build_object(
      'status', candidate_rec.document_validation_status,
      'validated_by', candidate_rec.document_validated_by,
      'validated_by_name', validated_by_name,
      'validated_at', candidate_rec.document_validated_at,
      'comment', candidate_rec.document_validation_comment
    ),
    'documents', checklist_docs
  );
end;
$function$;

create or replace function public.upload_candidate_document(
  p_case_candidate_id uuid,
  p_document_type_id uuid,
  p_file_path text,
  p_expiry_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_rec public.recruitment_case_candidates%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select *
    into candidate_rec
    from public.recruitment_case_candidates
   where id = p_case_candidate_id;

  if candidate_rec.id is null then
    raise exception 'Candidato no encontrado';
  end if;

  if not (
    public.user_can_manage_recruitment_case(current_user_id, candidate_rec.recruitment_case_id)
    or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_rec.id)
  ) then
    raise exception 'Sin permisos para cargar documentos en este caso';
  end if;

  insert into public.candidate_documents (
    candidate_profile_id,
    recruitment_case_id,
    document_type_id,
    file_path,
    expiry_date,
    status,
    uploaded_by,
    updated_at
  )
  values (
    candidate_rec.candidate_profile_id,
    candidate_rec.recruitment_case_id,
    p_document_type_id,
    p_file_path,
    p_expiry_date,
    'uploaded',
    current_user_id,
    timezone('utc', now())
  )
  on conflict (recruitment_case_id, candidate_profile_id, document_type_id) do update
  set
    file_path = excluded.file_path,
    expiry_date = excluded.expiry_date,
    status = 'uploaded',
    uploaded_by = excluded.uploaded_by,
    reviewed_at = null,
    reviewed_by = null,
    reviewer_notes = null,
    updated_at = timezone('utc', now());

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    metadata
  )
  values (
    candidate_rec.recruitment_case_id,
    p_case_candidate_id,
    current_user_id,
    'document_uploaded',
    jsonb_build_object('document_type_id', p_document_type_id)
  );
end;
$function$;

drop function if exists public.review_candidate_document(uuid, text, text);
drop function if exists public.review_candidate_document(uuid, text, text, uuid);

create or replace function public.review_candidate_document(
  p_document_id uuid,
  p_status text,
  p_notes text default null,
  p_case_candidate_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  doc_rec public.candidate_documents%rowtype;
  dt_rec public.document_types%rowtype;
  candidate_record public.recruitment_case_candidates%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Estado de revisión inválido';
  end if;

  select *
    into doc_rec
    from public.candidate_documents
   where id = p_document_id;

  if doc_rec.id is null then
    raise exception 'Documento no encontrado';
  end if;

  select *
    into dt_rec
    from public.document_types
   where id = doc_rec.document_type_id;

  if p_case_candidate_id is null then
    raise exception 'Se requiere identificar al candidato del caso para auditar la revisión documental';
  end if;

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'Candidato no encontrado';
  end if;

  if candidate_record.recruitment_case_id <> doc_rec.recruitment_case_id
     or candidate_record.candidate_profile_id <> doc_rec.candidate_profile_id then
    raise exception 'El documento no pertenece al candidato indicado';
  end if;

  if not (
    public.user_can_manage_recruitment_case(current_user_id, doc_rec.recruitment_case_id)
    or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_record.id)
  ) then
    raise exception 'Sin permisos para gestionar este caso';
  end if;

  if dt_rec.is_critical then
    if not (
      public.user_is_admin(current_user_id)
      or public.user_has_role(current_user_id, 'compliance_documental')
      or public.user_has_role(current_user_id, 'reclutamiento')
      or public.user_has_role(current_user_id, 'administrativo')
      or public.user_has_role(current_user_id, 'jefe_administrativo')
    ) then
      raise exception 'Solo Reclutamiento, Compliance Documental, RRHH administrativo o Admin puede aprobar/rechazar documentos obligatorios';
    end if;
  end if;

  update public.candidate_documents
  set
    status = p_status::public.candidate_document_status,
    reviewed_by = current_user_id,
    reviewed_at = timezone('utc', now()),
    reviewer_notes = p_notes,
    updated_at = timezone('utc', now())
  where id = p_document_id;

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    metadata
  )
  values (
    doc_rec.recruitment_case_id,
    candidate_record.id,
    current_user_id,
    'document_reviewed',
    jsonb_build_object(
      'document_id', p_document_id,
      'status', p_status
    )
  );
end;
$function$;

revoke all on function public.review_candidate_document(uuid, text, text, uuid) from public, anon;
grant execute on function public.review_candidate_document(uuid, text, text, uuid) to authenticated;

create or replace function public.approve_candidate_documentation(
  p_case_candidate_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  checklist_data jsonb;
  missing_person_fields text[];
  missing_worker_fields text[];
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
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
    raise exception 'Candidato no encontrado';
  end if;

  if not (
    public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id)
    or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_record.id)
  ) then
    raise exception 'Sin permisos para validar este candidato';
  end if;

  checklist_data := public.get_candidate_checklist(p_case_candidate_id);
  missing_person_fields := coalesce(
    array(select jsonb_array_elements_text(coalesce(checklist_data -> 'missing_person_fields', '[]'::jsonb))),
    '{}'::text[]
  );
  missing_worker_fields := coalesce(
    array(select jsonb_array_elements_text(coalesce(checklist_data -> 'missing_worker_fields', '[]'::jsonb))),
    '{}'::text[]
  );

  if coalesce((checklist_data ->> 'worker_file_complete')::boolean, false) = false then
    raise exception 'La ficha del candidato sigue incompleta. Pendientes personales: %. Pendientes contractuales: %.',
      coalesce(array_to_string(missing_person_fields, ', '), 'ninguno'),
      coalesce(array_to_string(missing_worker_fields, ', '), 'ninguno');
  end if;

  if coalesce(checklist_data ->> 'semaphore', 'red') <> 'green' then
    raise exception 'La documentación obligatoria aún no está completamente aprobada';
  end if;

  update public.recruitment_case_candidates
  set
    document_validation_status = 'approved',
    document_validated_by = current_user_id,
    document_validated_at = timezone('utc', now()),
    document_validation_comment = normalized_comment,
    updated_at = timezone('utc', now())
  where id = candidate_record.id;

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    metadata
  )
  values (
    candidate_record.recruitment_case_id,
    candidate_record.id,
    current_user_id,
    'candidate_documentation_approved',
    jsonb_build_object(
      'comment', normalized_comment
    )
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
  has_candidate_control_access boolean := false;
  has_personnel_access boolean := false;
  has_full_access boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_view_recruitment_process_summary(current_user_id, p_case_id) then
    raise exception 'Sin permisos para ver este proceso de contratación';
  end if;

  has_candidate_control_access :=
    public.user_can_access_candidate_control(current_user_id)
    and public.user_can_view_recruitment_case(current_user_id, p_case_id);

  select exists (
    select 1
    from public.recruitment_case_candidates rcc
    where rcc.recruitment_case_id = p_case_id
      and public.user_can_manage_recruitment_personnel_candidate(current_user_id, rcc.id)
  )
    into has_personnel_access;

  has_full_access := has_candidate_control_access or has_personnel_access;

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
    order by
      case
        when hr.status = 'approved' and hra.status = 'approved' then 0
        when hr.status = 'approved' then 1
        else 0
      end asc,
      coalesce(hra.decided_at, hra.updated_at, hra.created_at) desc,
      hra.id desc
    limit 1
  ) latest_approval on true
  where rc.id = p_case_id;

  if case_payload is null then
    raise exception 'Caso no encontrado';
  end if;

  if has_full_access then
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
          'stage_code', rcc.stage_code,
          'stage_entered_at', rcc.stage_entered_at,
          'suitability_status', rcc.suitability_status,
          'is_selected', rcc.is_selected,
          'hired_at', rcc.hired_at,
          'created_at', rcc.created_at,
          'interview_notes', rcc.interview_notes,
          'document_validation_status', rcc.document_validation_status,
          'document_validated_by', rcc.document_validated_by,
          'document_validated_by_name', validation_profile.full_name,
          'document_validated_at', rcc.document_validated_at,
          'document_validation_comment', rcc.document_validation_comment,
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
      left join public.profiles validation_profile
        on validation_profile.id = rcc.document_validated_by
      where rcc.recruitment_case_id = p_case_id
        and (
          has_candidate_control_access
          or public.user_can_manage_recruitment_personnel_candidate(current_user_id, rcc.id)
        )
    ) as candidate_row;
  end if;

  if has_candidate_control_access then
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
    where al.recruitment_case_id = p_case_id;
  end if;

  return jsonb_build_object(
    'case', case_payload,
    'assignments', assignments_payload,
    'candidates', candidates_payload,
    'audit', audit_payload
  );
end;
$function$;

create or replace function public.get_recruitment_personnel_page_bucket(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0,
  p_stage_code text default 'ready_for_hire'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  normalized_search text := public.normalize_recruitment_search_text(p_search);
  search_terms text[] := array[]::text[];
  normalized_stage_code text := coalesce(nullif(trim(p_stage_code), ''), 'ready_for_hire');
  items jsonb := '[]'::jsonb;
  total_count bigint := 0;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_recruitment_personnel(current_user_id) then
    return jsonb_build_object('items', '[]'::jsonb, 'total_count', 0);
  end if;

  if normalized_stage_code not in ('ready_for_hire', 'hired') then
    raise exception 'Bucket de personal inválido';
  end if;

  if normalized_search <> '' then
    search_terms := regexp_split_to_array(normalized_search, '\s+');
  end if;

  with personnel_rows as (
    select
      rcc.id::text as stable_id,
      rc.opened_at as sort_case_opened_at,
      case
        when normalized_stage_code = 'hired'
          then coalesce(successful_buk_job.generated_at, rcc.hired_at, rcc.updated_at, rcc.created_at)
        else coalesce(rcc.stage_entered_at, rcc.updated_at, rcc.created_at)
      end as sort_bucket_at,
      rcc.created_at as sort_candidate_created_at,
      public.normalize_recruitment_search_text(
        concat_ws(
          ' ',
          cp.full_name,
          cp.national_id,
          rc.case_code,
          hr.folio,
          rc.contract_name,
          rc.job_position_name,
          rc.cost_center_name,
          rc.cost_center_code,
          owner_profile.full_name
        )
      ) as search_haystack,
      jsonb_build_object(
        'id', rcc.id,
        'candidate_profile_id', cp.id,
        'recruitment_case_id', rc.id,
        'case_code', rc.case_code,
        'folio', hr.folio,
        'case_status', rc.status,
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
        'contract_name', rc.contract_name,
        'job_position_name', rc.job_position_name,
        'cost_center_code', rc.cost_center_code,
        'cost_center_name', rc.cost_center_name,
        'owner_name', owner_profile.full_name,
        'active_process_count', 0,
        'contract_locked_case_id', null,
        'contract_locked_case_code', null,
        'contract_locked_folio', null,
        'contract_locked_stage_code', null,
        'is_contract_path_blocked', false,
        'interview_notes', rcc.interview_notes,
        'hired_at', rcc.hired_at,
        'buk_generated_at', successful_buk_job.generated_at,
        'buk_employee_id', successful_buk_job.buk_employee_id,
        'has_buk_generation_success', successful_buk_job.id is not null
      ) as payload
    from public.recruitment_case_candidates rcc
    join public.recruitment_cases rc
      on rc.id = rcc.recruitment_case_id
    join public.hiring_requests hr
      on hr.id = rc.hiring_request_id
    join public.candidate_profiles cp
      on cp.id = rcc.candidate_profile_id
    left join lateral (
      select rca.user_id
      from public.recruitment_case_assignments rca
      where rca.recruitment_case_id = rc.id
        and rca.is_primary = true
      order by rca.id asc
      limit 1
    ) as owner_assignment on true
    left join public.profiles owner_profile
      on owner_profile.id = owner_assignment.user_id
    left join lateral (
      select
        bsj.id,
        trim(bsj.buk_employee_id) as buk_employee_id,
        coalesce(bsj.finished_at, bsj.created_at) as generated_at
      from public.buk_sync_jobs bsj
      where bsj.recruitment_case_candidate_id = rcc.id
        and bsj.status = 'success'
        and nullif(trim(coalesce(bsj.buk_employee_id, '')), '') is not null
      order by coalesce(bsj.finished_at, bsj.created_at) desc, bsj.id desc
      limit 1
    ) as successful_buk_job on true
    where public.user_can_manage_recruitment_personnel_candidate(current_user_id, rcc.id)
      and rcc.stage_code in ('ready_for_hire', 'hired')
      and (
        (
          normalized_stage_code = 'ready_for_hire'
          and successful_buk_job.id is null
        )
        or (
          normalized_stage_code = 'hired'
          and successful_buk_job.id is not null
        )
      )
  ),
  filtered as (
    select *
    from personnel_rows personnel_row
    where cardinality(search_terms) = 0
       or not exists (
        select 1
        from unnest(search_terms) as term(value)
        where personnel_row.search_haystack not like '%' || term.value || '%'
      )
  ),
  totals as (
    select count(*) as value from filtered
  ),
  ordered_page as (
    select
      ordered_rows.payload,
      row_number() over () as row_order
    from (
      select filtered.payload
      from filtered
      order by
        filtered.sort_bucket_at desc,
        filtered.sort_case_opened_at desc,
        filtered.sort_candidate_created_at asc,
        filtered.stable_id asc
      limit safe_limit
      offset safe_offset
    ) ordered_rows
  )
  select
    coalesce(jsonb_agg(ordered_page.payload order by ordered_page.row_order), '[]'::jsonb),
    (select value from totals)
  into items, total_count
  from ordered_page;

  return jsonb_build_object(
    'items', coalesce(items, '[]'::jsonb),
    'total_count', coalesce(total_count, 0)
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

  if not public.user_can_generate_buk_candidates(current_user_id) then
    raise exception 'Solo RRHH administrativo puede generar candidatos en BUK';
  end if;

  if not public.user_can_access_recruitment_personnel(current_user_id) then
    raise exception 'Sin permisos para operar Personal a Contratar';
  end if;

  for candidate_row in
    select distinct rcc.id, rcc.recruitment_case_id, rcc.candidate_profile_id
    from public.recruitment_case_candidates rcc
    join unnest(coalesce(p_candidate_ids, '{}'::uuid[])) as selected_candidate_id
      on selected_candidate_id = rcc.id
  loop
    if not (
      public.user_can_manage_recruitment_case(current_user_id, candidate_row.recruitment_case_id)
      or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_row.id)
    ) then
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

notify pgrst, 'reload schema';

commit;
