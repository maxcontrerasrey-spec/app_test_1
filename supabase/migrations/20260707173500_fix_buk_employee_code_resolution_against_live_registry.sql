begin;

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
  latest_job_code text := null;
  max_worker_file_sequence integer := 0;
  max_buk_employee_sequence integer := 0;
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

  select latest.code_value
    into latest_job_code
    from (
      select
        coalesce(
          nullif(trim(coalesce(bsj.payload_snapshot -> 'profile' ->> 'suggested_employee_code', '')), ''),
          nullif(trim(coalesce(bsj.payload_snapshot -> 'profile' -> 'worker_file' ->> 'employee_code', '')), '')
        ) as code_value,
        coalesce(bsj.finished_at, bsj.started_at, bsj.created_at) as sort_at
      from public.buk_sync_jobs bsj
      where bsj.recruitment_case_candidate_id = p_case_candidate_id
    ) latest
   where latest.code_value ~ '^F[0-9]+$'
   order by latest.sort_at desc nulls last
   limit 1;

  if latest_job_code is not null then
    return latest_job_code;
  end if;

  select coalesce(
    max(substring(cwf.employee_code from '^F([0-9]+)$')::integer),
    0
  )
    into max_worker_file_sequence
    from public.candidate_worker_files cwf
    join public.recruitment_case_candidates rcc
      on rcc.id = cwf.recruitment_case_candidate_id
    join public.candidate_profiles cp
      on cp.id = rcc.candidate_profile_id
   where cwf.employee_code ~ '^F[0-9]+$'
     and rcc.id <> target_candidate.id
     and (
       rcc.candidate_profile_id = target_candidate.candidate_profile_id
       or (
         normalized_national_id <> ''
         and upper(regexp_replace(coalesce(cp.national_id, ''), '[^0-9A-Za-z]', '', 'g')) =
           normalized_national_id
       )
     );

  if normalized_national_id <> '' then
    select coalesce(
      max(substring(trim(e.raw_payload ->> 'code_sheet') from '^F([0-9]+)$')::integer),
      0
    )
      into max_buk_employee_sequence
      from public.employees e
     where nullif(trim(coalesce(e.raw_payload ->> 'code_sheet', '')), '') ~ '^F[0-9]+$'
       and normalized_national_id in (
         upper(regexp_replace(coalesce(e.document_number, ''), '[^0-9A-Za-z]', '', 'g')),
         upper(regexp_replace(coalesce(e.raw_payload ->> 'document_number', ''), '[^0-9A-Za-z]', '', 'g')),
         upper(regexp_replace(coalesce(e.raw_payload ->> 'rut', ''), '[^0-9A-Za-z]', '', 'g'))
       );
  end if;

  next_sequence := greatest(max_worker_file_sequence, max_buk_employee_sequence, 0) + 1;

  return 'F' || next_sequence::text;
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
        'employee_code', coalesce(suggested_employee_code, worker_file.employee_code),
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

with candidate_codes as (
  select
    cwf.id,
    public.resolve_candidate_worker_employee_code(cwf.recruitment_case_candidate_id) as resolved_employee_code
  from public.candidate_worker_files cwf
  join public.recruitment_case_candidates rcc
    on rcc.id = cwf.recruitment_case_candidate_id
  where rcc.stage_code in ('ready_for_hire', 'hired')
     or exists (
       select 1
       from public.buk_sync_jobs bsj
       where bsj.recruitment_case_candidate_id = cwf.recruitment_case_candidate_id
     )
)
update public.candidate_worker_files cwf
   set employee_code = candidate_codes.resolved_employee_code,
       updated_at = timezone('utc', now())
  from candidate_codes
 where cwf.id = candidate_codes.id
   and candidate_codes.resolved_employee_code is not null
   and nullif(trim(coalesce(cwf.employee_code, '')), '') is distinct from candidate_codes.resolved_employee_code;

notify pgrst, 'reload schema';

commit;
