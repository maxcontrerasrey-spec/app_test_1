begin;

create or replace function public.is_affirmative_buk_value(p_value text)
returns boolean
language sql
immutable
as $function$
  select translate(lower(trim(coalesce(p_value, ''))), 'áéíóú', 'aeiou') in ('si', 'true', 'yes');
$function$;

create or replace function public.worker_health_provider_requires_plan(p_health_provider text)
returns boolean
language sql
immutable
as $function$
  select case
    when nullif(trim(coalesce(p_health_provider, '')), '') is null then false
    when translate(lower(trim(coalesce(p_health_provider, ''))), 'áéíóú', 'aeiou')
      in ('fonasa', 'mutual', 'no cotiza salud', 'no cotiza')
      then false
    else true
  end;
$function$;

create or replace function public.resolve_candidate_worker_employee_code(
  p_case_candidate_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  target_candidate public.recruitment_case_candidates%rowtype;
  target_profile public.candidate_profiles%rowtype;
  normalized_national_id text := null;
  next_sequence integer := 1;
begin
  select *
    into target_candidate
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id;

  if target_candidate.id is null then
    return 'F1';
  end if;

  select *
    into target_profile
    from public.candidate_profiles cp
   where cp.id = target_candidate.candidate_profile_id;

  normalized_national_id := upper(
    regexp_replace(coalesce(target_profile.national_id, ''), '[^0-9A-Za-z]', '', 'g')
  );

  select coalesce(
    max(substring(cwf.employee_code from '^F([0-9]+)$')::integer),
    0
  ) + 1
    into next_sequence
    from public.candidate_worker_files cwf
    join public.recruitment_case_candidates rcc
      on rcc.id = cwf.recruitment_case_candidate_id
    join public.candidate_profiles cp
      on cp.id = rcc.candidate_profile_id
   where cwf.employee_code ~ '^F[0-9]+$'
     and (
       rcc.candidate_profile_id = target_candidate.candidate_profile_id
       or (
         normalized_national_id <> ''
         and upper(regexp_replace(coalesce(cp.national_id, ''), '[^0-9A-Za-z]', '', 'g')) =
           normalized_national_id
       )
     );

  return 'F' || next_sequence::text;
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
    case
      when public.worker_health_provider_requires_plan(normalized_health_provider)
        then p_health_plan_uf
      else null
    end,
    case
      when public.worker_health_provider_requires_plan(normalized_health_provider)
        then p_health_plan_pesos
      else null
    end,
    case
      when public.worker_health_provider_requires_plan(normalized_health_provider)
        then p_health_plan_percentage
      else null
    end,
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

  suggested_employee_code := public.resolve_candidate_worker_employee_code(candidate_record.id);

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
        'health_plan_uf', case
          when public.worker_health_provider_requires_plan(worker_file.health_provider)
            then worker_file.health_plan_uf
          else null
        end,
        'health_plan_pesos', case
          when public.worker_health_provider_requires_plan(worker_file.health_provider)
            then worker_file.health_plan_pesos
          else null
        end,
        'health_plan_percentage', case
          when public.worker_health_provider_requires_plan(worker_file.health_provider)
            then worker_file.health_plan_percentage
          else null
        end,
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
  effective_employee_code text := null;
  effective_private_role text := null;
  effective_increase_quote_one_percent text := null;
  effective_afc_regime text := null;
  effective_retirement_regime text := null;
  health_plan_required boolean := false;
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

  effective_employee_code := coalesce(
    nullif(trim(coalesce(worker_record.employee_code, '')), ''),
    public.resolve_candidate_worker_employee_code(candidate_record.id)
  );
  effective_private_role := coalesce(
    nullif(trim(coalesce(worker_record.private_role, '')), ''),
    'No'
  );
  effective_increase_quote_one_percent := coalesce(
    nullif(trim(coalesce(worker_record.increase_quote_one_percent, '')), ''),
    'No'
  );
  effective_afc_regime := coalesce(
    nullif(trim(coalesce(worker_record.afc_regime, '')), ''),
    'Menos de 11 Años'
  );
  effective_retirement_regime := case
    when public.is_affirmative_buk_value(worker_record.retired_status)
      then nullif(trim(coalesce(worker_record.retirement_regime, '')), '')
    else null
  end;
  health_plan_required := public.worker_health_provider_requires_plan(worker_record.health_provider);

  if nullif(trim(coalesce(profile_record.document_type, '')), '') is null
     or nullif(trim(coalesce(profile_record.national_id, '')), '') is null
     or nullif(trim(coalesce(profile_record.first_name, '')), '') is null
     or nullif(trim(coalesce(profile_record.last_name, '')), '') is null
     or nullif(trim(coalesce(profile_record.gender, '')), '') is null
     or nullif(trim(coalesce(profile_record.nationality, '')), '') is null
     or profile_record.birth_date is null
     or nullif(trim(coalesce(profile_record.marital_status, '')), '') is null
     or nullif(trim(coalesce(profile_record.personal_email, '')), '') is null
     or nullif(trim(coalesce(profile_record.address_line, '')), '') is null
     or nullif(trim(coalesce(profile_record.region, '')), '') is null
     or nullif(trim(coalesce(profile_record.district_or_commune, '')), '') is null then
    raise exception 'La ficha personal BUK del candidato aún está incompleta';
  end if;

  if worker_record.id is null
     or effective_employee_code is null
     or worker_record.company_entry_date is null
     or effective_private_role is null
     or nullif(trim(coalesce(worker_record.payment_method, '')), '') is null
     or nullif(trim(coalesce(worker_record.payment_period, '')), '') is null
     or nullif(trim(coalesce(worker_record.pension_regime, '')), '') is null
     or effective_increase_quote_one_percent is null
     or nullif(trim(coalesce(worker_record.health_provider, '')), '') is null
     or effective_afc_regime is null
     or (
       public.is_affirmative_buk_value(worker_record.retired_status)
       and effective_retirement_regime is null
     )
     or (
       health_plan_required
       and worker_record.health_plan_uf is null
       and worker_record.health_plan_pesos is null
       and worker_record.health_plan_percentage is null
     ) then
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
  health_plan_required boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  select *
    into candidate_rec
    from public.recruitment_case_candidates
   where id = p_case_candidate_id;

  if candidate_rec.id is null then
    raise exception 'Candidato no encontrado';
  end if;

  if not public.user_can_view_recruitment_case(current_user_id, candidate_rec.recruitment_case_id) then
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
       and worker_rec.health_plan_uf is null
       and worker_rec.health_plan_pesos is null
       and worker_rec.health_plan_percentage is null
        then 'Plan Isapre (UF, Pesos o Porcentual)'
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

notify pgrst, 'reload schema';

commit;
