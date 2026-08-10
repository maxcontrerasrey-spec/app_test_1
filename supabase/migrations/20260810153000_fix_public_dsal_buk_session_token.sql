begin;

create or replace function public.start_public_dsal_buk_worker_file(
  p_national_id text,
  p_personal_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  normalized_national_id text := public.normalize_dsal_precandidate_rut(p_national_id);
  normalized_email text := lower(trim(coalesce(p_personal_email, '')));
  candidate_record record;
  session_token text := gen_random_uuid()::text;
  session_id uuid;
begin
  if not public.is_valid_dsal_precandidate_rut(normalized_national_id)
     or normalized_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'No encontramos un candidato DSAL aprobado con esos datos';
  end if;

  select
    rcc.id as case_candidate_id,
    rcc.recruitment_case_id,
    cp.id as candidate_profile_id,
    cp.national_id,
    cp.full_name,
    cp.first_name,
    cp.last_name,
    cp.second_last_name,
    cp.gender,
    cp.birth_date,
    cp.nationality,
    cp.marital_status,
    cp.personal_email,
    cp.phone,
    cp.address_line,
    cp.region,
    cp.district_or_commune,
    cp.current_city,
    cp.street_name,
    cp.street_number,
    cp.apartment_or_office,
    cp.emergency_contact_name,
    cp.emergency_contact_phone,
    cp.emergency_contact_relationship,
    cp.firefighter_status,
    cp.foreign_worker,
    cp.shirt_size,
    cp.pants_size,
    cp.shoe_size,
    cp.bank_name,
    cp.bank_account_type,
    cp.bank_account_number,
    cp.afp_name,
    cp.health_provider,
    cwf.payment_method,
    cwf.payment_period,
    cwf.bank_name as worker_bank_name,
    cwf.bank_account_type as worker_bank_account_type,
    cwf.bank_account_number as worker_bank_account_number,
    cwf.pension_regime,
    cwf.contribution_fund,
    cwf.health_provider as worker_health_provider,
    cwf.health_plan_uf,
    cwf.retired_status,
    cwf.retirement_regime
    into candidate_record
  from public.recruitment_case_candidates rcc
  join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
  join public.recruitment_precandidates rp
    on rp.approved_case_candidate_id = rcc.id
   and rp.status = 'approved'
  left join public.candidate_worker_files cwf on cwf.recruitment_case_candidate_id = rcc.id
  where regexp_replace(upper(coalesce(cp.national_id, '')), '[^0-9K]', '', 'g') = normalized_national_id
    and lower(coalesce(cp.personal_email, '')) = normalized_email
    and rcc.stage_code not in ('rejected', 'withdrawn', 'hired')
    and rcc.hired_at is null
  order by rp.reviewed_at desc nulls last, rp.updated_at desc
  limit 1;

  if candidate_record.case_candidate_id is null then
    raise exception 'No encontramos un candidato DSAL aprobado con esos datos';
  end if;

  if exists (
    select 1 from public.recruitment_public_buk_form_sessions s
     where s.recruitment_case_candidate_id = candidate_record.case_candidate_id
       and s.created_at > timezone('utc', now()) - interval '15 minutes'
  ) then
    raise exception 'Ya existe una sesión activa. Espera unos minutos e inténtalo nuevamente';
  end if;

  insert into public.recruitment_public_buk_form_sessions (
    recruitment_case_candidate_id, token_hash, verification_email, expires_at
  ) values (
    candidate_record.case_candidate_id,
    encode(digest(convert_to(session_token, 'utf8'), 'sha256'), 'hex'),
    normalized_email,
    timezone('utc', now()) + interval '30 minutes'
  ) returning id into session_id;

  return jsonb_build_object(
    'session_token', session_token,
    'expires_at', timezone('utc', now()) + interval '30 minutes',
    'candidate', jsonb_build_object(
      'case_candidate_id', candidate_record.case_candidate_id,
      'national_id', candidate_record.national_id,
      'full_name', candidate_record.full_name,
      'first_name', candidate_record.first_name,
      'last_name', candidate_record.last_name,
      'second_last_name', candidate_record.second_last_name,
      'gender', candidate_record.gender,
      'birth_date', candidate_record.birth_date,
      'nationality', candidate_record.nationality,
      'marital_status', candidate_record.marital_status,
      'personal_email', candidate_record.personal_email,
      'phone', candidate_record.phone,
      'address_line', candidate_record.address_line,
      'region', candidate_record.region,
      'district_or_commune', candidate_record.district_or_commune,
      'current_city', candidate_record.current_city,
      'street_name', candidate_record.street_name,
      'street_number', candidate_record.street_number,
      'apartment_or_office', candidate_record.apartment_or_office,
      'emergency_contact_name', candidate_record.emergency_contact_name,
      'emergency_contact_phone', candidate_record.emergency_contact_phone,
      'emergency_contact_relationship', candidate_record.emergency_contact_relationship,
      'firefighter_status', candidate_record.firefighter_status,
      'foreign_worker', candidate_record.foreign_worker,
      'shirt_size', candidate_record.shirt_size,
      'pants_size', candidate_record.pants_size,
      'shoe_size', candidate_record.shoe_size,
      'bank_name', coalesce(candidate_record.worker_bank_name, candidate_record.bank_name),
      'bank_account_type', coalesce(candidate_record.worker_bank_account_type, candidate_record.bank_account_type),
      'bank_account_number', coalesce(candidate_record.worker_bank_account_number, candidate_record.bank_account_number),
      'pension_regime', candidate_record.pension_regime,
      'contribution_fund', candidate_record.contribution_fund,
      'health_provider', coalesce(candidate_record.worker_health_provider, candidate_record.health_provider),
      'health_plan_uf', candidate_record.health_plan_uf,
      'payment_method', candidate_record.payment_method,
      'payment_period', candidate_record.payment_period,
      'retired_status', candidate_record.retired_status,
      'retirement_regime', candidate_record.retirement_regime
    )
  );
end;
$function$;

revoke all on function public.start_public_dsal_buk_worker_file(text, text) from public, authenticated;
grant execute on function public.start_public_dsal_buk_worker_file(text, text) to anon;
notify pgrst, 'reload schema';
commit;
