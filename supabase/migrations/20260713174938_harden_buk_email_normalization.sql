begin;

create or replace function public.normalize_candidate_buk_email(
  p_email text
)
returns text
language sql
stable
set search_path = public
as $function$
  select case
    when normalized_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
      then normalized_email
    else null
  end
  from (
    select nullif(
      regexp_replace(
        lower(trim(coalesce(p_email, ''))),
        ',([a-z]{2,})$',
        '.\1',
        'i'
      ),
      ''
    ) as normalized_email
  ) normalized;
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
    'email', public.normalize_candidate_buk_email(candidate_profile.email),
    'personal_email', public.normalize_candidate_buk_email(candidate_profile.personal_email),
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

create or replace function public.get_candidate_buk_sync_payload(
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
  case_record public.recruitment_cases%rowtype;
  profile_record public.candidate_profiles%rowtype;
  worker_record public.candidate_worker_files%rowtype;
  documents_payload jsonb := '[]'::jsonb;
  effective_employee_code text := null;
  effective_private_role text := null;
  effective_increase_quote_one_percent text := null;
  effective_afc_regime text := null;
  effective_retirement_regime text := null;
  effective_health_plan_uf numeric := null;
  effective_health_plan_percentage numeric := null;
  health_plan_required boolean := false;
  successful_buk_employee_id text := null;
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
    public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id)
    or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_record.id)
  ) then
    raise exception 'Sin permisos para generar este candidato en BUK';
  end if;

  select nullif(trim(coalesce(bsj.buk_employee_id, '')), '')
    into successful_buk_employee_id
    from public.buk_sync_jobs bsj
   where bsj.recruitment_case_candidate_id = candidate_record.id
     and bsj.status = 'success'
     and nullif(trim(coalesce(bsj.buk_employee_id, '')), '') is not null
   order by coalesce(bsj.finished_at, bsj.created_at) desc, bsj.id desc
   limit 1;

  if candidate_record.stage_code not in ('ready_for_hire', 'hired')
     or successful_buk_employee_id is not null then
    raise exception 'El candidato debe seguir pendiente de generación efectiva en BUK antes de generar';
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
  effective_health_plan_uf := public.resolve_candidate_buk_health_plan_uf(
    worker_record.health_provider,
    worker_record.health_plan_uf
  );
  effective_health_plan_percentage := public.resolve_candidate_buk_health_plan_percentage(
    worker_record.health_provider,
    worker_record.health_plan_percentage
  );

  if nullif(trim(coalesce(profile_record.document_type, '')), '') is null
     or nullif(trim(coalesce(profile_record.national_id, '')), '') is null
     or nullif(trim(coalesce(profile_record.first_name, '')), '') is null
     or nullif(trim(coalesce(profile_record.last_name, '')), '') is null
     or nullif(trim(coalesce(profile_record.gender, '')), '') is null
     or nullif(trim(coalesce(profile_record.nationality, '')), '') is null
     or profile_record.birth_date is null
     or nullif(trim(coalesce(profile_record.marital_status, '')), '') is null
     or public.normalize_candidate_buk_email(profile_record.personal_email) is null
     or nullif(trim(coalesce(profile_record.address_line, '')), '') is null
     or nullif(trim(coalesce(profile_record.region, '')), '') is null
     or nullif(trim(coalesce(profile_record.district_or_commune, '')), '') is null then
    raise exception 'La ficha personal BUK del candidato aún está incompleta o contiene un email inválido';
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
       and effective_health_plan_uf is null
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

update public.candidate_profiles cp
   set email = public.normalize_candidate_buk_email(cp.email),
       personal_email = public.normalize_candidate_buk_email(cp.personal_email),
       updated_at = timezone('utc', now())
 where cp.national_id = '143853489'
   and lower(cp.full_name) = lower('Felipe Andrés Monterrey Monterrey');

update public.buk_sync_jobs bsj
   set status = 'pending',
       error_message = null,
       started_at = null,
       finished_at = null,
       result_snapshot = '{}'::jsonb,
       updated_at = timezone('utc', now())
  from public.recruitment_case_candidates rcc
  join public.candidate_profiles cp
    on cp.id = rcc.candidate_profile_id
 where bsj.recruitment_case_candidate_id = rcc.id
   and rcc.stage_code = 'ready_for_hire'
   and bsj.status = 'processing'
   and bsj.buk_employee_id is null
   and cp.national_id in ('108671394', '102291379', '95614663');

update public.buk_sync_jobs bsj
   set status = 'pending',
       error_message = null,
       started_at = null,
       finished_at = null,
       payload_snapshot = jsonb_set(
         jsonb_set(
           bsj.payload_snapshot,
           '{profile,email}',
           to_jsonb(public.normalize_candidate_buk_email(cp.email)),
           true
         ),
         '{profile,personal_email}',
         to_jsonb(public.normalize_candidate_buk_email(cp.personal_email)),
         true
       ),
       result_snapshot = '{}'::jsonb,
       updated_at = timezone('utc', now())
  from public.recruitment_case_candidates rcc
  join public.candidate_profiles cp
    on cp.id = rcc.candidate_profile_id
where bsj.recruitment_case_candidate_id = rcc.id
   and rcc.stage_code = 'ready_for_hire'
   and bsj.status = 'error'
   and bsj.buk_employee_id is null
   and cp.national_id = '143853489'
   and bsj.id = (
     select latest_bsj.id
       from public.buk_sync_jobs latest_bsj
      where latest_bsj.recruitment_case_candidate_id = bsj.recruitment_case_candidate_id
        and latest_bsj.status = 'error'
        and latest_bsj.buk_employee_id is null
      order by latest_bsj.created_at desc, latest_bsj.id desc
      limit 1
   );

update public.buk_sync_jobs bsj
   set status = 'error',
       error_message = coalesce(error_message, 'Job BUK historico conservado como fallido tras normalizacion de email'),
       updated_at = timezone('utc', now())
  from public.recruitment_case_candidates rcc
  join public.candidate_profiles cp
    on cp.id = rcc.candidate_profile_id
 where bsj.recruitment_case_candidate_id = rcc.id
   and bsj.status = 'pending'
   and bsj.buk_employee_id is null
   and cp.national_id = '143853489'
   and bsj.id <> (
     select latest_bsj.id
       from public.buk_sync_jobs latest_bsj
      where latest_bsj.recruitment_case_candidate_id = bsj.recruitment_case_candidate_id
        and latest_bsj.buk_employee_id is null
      order by latest_bsj.created_at desc, latest_bsj.id desc
      limit 1
   );

revoke all on function public.normalize_candidate_buk_email(text) from public, anon, authenticated;
grant execute on function public.normalize_candidate_buk_email(text) to service_role;

revoke all on function public.get_candidate_buk_profile(uuid) from public, anon, authenticated;
grant execute on function public.get_candidate_buk_profile(uuid) to authenticated, service_role;

revoke all on function public.get_candidate_buk_sync_payload(uuid) from public, anon, authenticated;
grant execute on function public.get_candidate_buk_sync_payload(uuid) to service_role;

notify pgrst, 'reload schema';

commit;
