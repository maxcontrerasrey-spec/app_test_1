begin;

create extension if not exists pgcrypto;

create table if not exists public.recruitment_public_buk_form_sessions (
  id uuid primary key default gen_random_uuid(),
  recruitment_case_candidate_id uuid not null references public.recruitment_case_candidates(id) on delete cascade,
  token_hash text not null unique,
  verification_email text not null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

alter table public.recruitment_public_buk_form_sessions enable row level security;
revoke all on table public.recruitment_public_buk_form_sessions from public, anon, authenticated;

create index if not exists recruitment_public_buk_form_sessions_candidate_idx
  on public.recruitment_public_buk_form_sessions(recruitment_case_candidate_id, expires_at);

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
  left join public.candidate_worker_files cwf
    on cwf.recruitment_case_candidate_id = rcc.id
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
    select 1
      from public.recruitment_public_buk_form_sessions s
     where s.recruitment_case_candidate_id = candidate_record.case_candidate_id
       and s.created_at > timezone('utc', now()) - interval '15 minutes'
  ) then
    raise exception 'Ya existe una sesión activa. Espera unos minutos e inténtalo nuevamente';
  end if;

  insert into public.recruitment_public_buk_form_sessions (
    recruitment_case_candidate_id,
    token_hash,
    verification_email,
    expires_at
  )
  values (
    candidate_record.case_candidate_id,
    encode(digest(convert_to(session_token, 'utf8'), 'sha256'), 'hex'),
    normalized_email,
    timezone('utc', now()) + interval '30 minutes'
  )
  returning id into session_id;

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

create or replace function public.submit_public_dsal_buk_worker_file(
  p_session_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  session_record public.recruitment_public_buk_form_sessions%rowtype;
  candidate_record public.recruitment_case_candidates%rowtype;
  profile_before public.candidate_profiles%rowtype;
  profile_after public.candidate_profiles%rowtype;
  worker_before public.candidate_worker_files%rowtype;
  worker_after public.candidate_worker_files%rowtype;
  case_record public.recruitment_cases%rowtype;
  request_record public.hiring_requests%rowtype;
  token_hash text := encode(digest(convert_to(trim(coalesce(p_session_token, '')), 'utf8'), 'sha256'), 'hex');
  email text := lower(trim(coalesce(p_payload ->> 'personal_email', '')));
  phone_digits text := regexp_replace(coalesce(p_payload ->> 'phone', ''), '[^0-9]', '', 'g');
  street_name text := nullif(regexp_replace(trim(coalesce(p_payload ->> 'street_name', '')), '\s+', ' ', 'g'), '');
  street_number text := nullif(regexp_replace(trim(coalesce(p_payload ->> 'street_number', '')), '^#+\s*', ''), '');
  current_city text := nullif(initcap(regexp_replace(lower(trim(coalesce(p_payload ->> 'current_city', ''))), '\s+', ' ', 'g')), '');
  district_or_commune text := nullif(initcap(regexp_replace(lower(trim(coalesce(p_payload ->> 'district_or_commune', ''))), '\s+', ' ', 'g')), '');
  region text := nullif(trim(coalesce(p_payload ->> 'region', '')), '');
  derived_address_line text;
  health_provider text := nullif(trim(coalesce(p_payload ->> 'health_provider', '')), '');
  health_provider_normalized text := lower(coalesce(health_provider, ''));
  health_plan_uf numeric := case
    when coalesce(p_payload ->> 'health_plan_uf', '') ~ '^\s*[0-9]+([.,][0-9]+)?\s*$'
      then replace(trim(p_payload ->> 'health_plan_uf'), ',', '.')::numeric
    else null
  end;
  payment_method text := nullif(trim(coalesce(p_payload ->> 'payment_method', '')), '');
  payment_period text := nullif(trim(coalesce(p_payload ->> 'payment_period', '')), '');
  pension_regime text := nullif(trim(coalesce(p_payload ->> 'pension_regime', '')), '');
  retired_status text := nullif(trim(coalesce(p_payload ->> 'retired_status', '')), '');
  normalized_first_name text;
  normalized_last_name text;
  normalized_second_last_name text;
begin
  if p_payload is null or token_hash = encode(digest(convert_to('', 'utf8'), 'sha256'), 'hex') then
    raise exception 'La sesión del formulario no es válida';
  end if;

  select * into session_record
    from public.recruitment_public_buk_form_sessions s
   where s.token_hash = token_hash
   for update;

  if session_record.id is null
     or session_record.used_at is not null
     or session_record.expires_at <= timezone('utc', now()) then
    raise exception 'La sesión del formulario expiró. Solicita una nueva sesión';
  end if;

  select * into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = session_record.recruitment_case_candidate_id
   for update;

  if candidate_record.id is null
     or candidate_record.stage_code in ('rejected', 'withdrawn', 'hired')
     or candidate_record.hired_at is not null
     or not exists (
       select 1 from public.recruitment_precandidates rp
        where rp.approved_case_candidate_id = candidate_record.id
          and rp.status = 'approved'
     ) then
    raise exception 'El candidato ya no está habilitado para completar la ficha';
  end if;

  select * into case_record from public.recruitment_cases rc where rc.id = candidate_record.recruitment_case_id;
  select * into request_record from public.hiring_requests hr where hr.id = case_record.hiring_request_id;

  if email <> session_record.verification_email
     or email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El correo personal no coincide con la verificación inicial';
  end if;

  if phone_digits !~ '^[0-9]{8}$' then
    raise exception 'El teléfono debe contener 8 dígitos después de +56 9';
  end if;

  if street_name is null or current_city is null or district_or_commune is null or region is null then
    raise exception 'Completa calle, comuna, ciudad y región';
  end if;

  if nullif(trim(coalesce(p_payload ->> 'birth_date', '')), '') is null
     or nullif(trim(coalesce(p_payload ->> 'gender', '')), '') is null
     or nullif(trim(coalesce(p_payload ->> 'nationality', '')), '') is null
     or nullif(trim(coalesce(p_payload ->> 'marital_status', '')), '') is null
     or nullif(trim(coalesce(p_payload ->> 'shirt_size', '')), '') is null
     or nullif(trim(coalesce(p_payload ->> 'pants_size', '')), '') is null
     or nullif(trim(coalesce(p_payload ->> 'shoe_size', '')), '') is null
     or nullif(trim(coalesce(p_payload ->> 'payment_method', '')), '') is null
     or nullif(trim(coalesce(p_payload ->> 'payment_period', '')), '') is null
     or nullif(trim(coalesce(p_payload ->> 'pension_regime', '')), '') is null
     or nullif(trim(coalesce(p_payload ->> 'health_provider', '')), '') is null then
    raise exception 'Completa todos los campos obligatorios de la ficha BUK';
  end if;

  if health_provider_normalized not in ('fonasa', 'mutual', 'no cotiza salud', 'no cotiza')
     and (health_plan_uf is null or health_plan_uf <= 0) then
    raise exception 'Para Isapre debes indicar el plan en UF';
  end if;

  derived_address_line := concat_ws(', ', street_name, case when street_number is not null then '#' || street_number end);

  select * into profile_before from public.candidate_profiles cp where cp.id = candidate_record.candidate_profile_id for update;
  normalized_first_name := coalesce(profile_before.first_name, nullif(initcap(trim(p_payload ->> 'first_name')), ''));
  normalized_last_name := coalesce(profile_before.last_name, nullif(initcap(trim(p_payload ->> 'last_name')), ''));
  normalized_second_last_name := coalesce(profile_before.second_last_name, nullif(initcap(trim(p_payload ->> 'second_last_name')), ''));

  update public.candidate_profiles cp set
    first_name = normalized_first_name,
    last_name = normalized_last_name,
    second_last_name = normalized_second_last_name,
    full_name = concat_ws(' ', normalized_first_name, normalized_last_name, normalized_second_last_name),
    gender = nullif(trim(p_payload ->> 'gender'), ''),
    birth_date = nullif(trim(p_payload ->> 'birth_date'), '')::date,
    nationality = nullif(trim(p_payload ->> 'nationality'), ''),
    marital_status = nullif(trim(p_payload ->> 'marital_status'), ''),
    personal_email = email,
    phone = '+569' || right(phone_digits, 8),
    address_line = derived_address_line,
    street_name = street_name,
    street_number = street_number,
    apartment_or_office = nullif(trim(p_payload ->> 'apartment_or_office'), ''),
    district_or_commune = district_or_commune,
    current_city = current_city,
    region = region,
    emergency_contact_name = nullif(initcap(trim(p_payload ->> 'emergency_contact_name')), ''),
    emergency_contact_phone = nullif(trim(p_payload ->> 'emergency_contact_phone'), ''),
    emergency_contact_relationship = nullif(initcap(trim(p_payload ->> 'emergency_contact_relationship')), ''),
    firefighter_status = nullif(trim(p_payload ->> 'firefighter_status'), ''),
    foreign_worker = nullif(trim(p_payload ->> 'foreign_worker'), ''),
    shirt_size = nullif(trim(p_payload ->> 'shirt_size'), ''),
    pants_size = nullif(trim(p_payload ->> 'pants_size'), ''),
    shoe_size = nullif(trim(p_payload ->> 'shoe_size'), ''),
    updated_at = timezone('utc', now())
  where cp.id = candidate_record.candidate_profile_id
  returning * into profile_after;

  select * into worker_before from public.candidate_worker_files cwf where cwf.recruitment_case_candidate_id = candidate_record.id for update;

  insert into public.candidate_worker_files (
    recruitment_case_candidate_id, project_name, company_entry_date, shift_name, private_role,
    payment_method, payment_period, bank_name, bank_account_type, bank_account_number,
    pension_regime, contribution_fund, health_provider, health_plan_uf, health_plan_pesos,
    health_plan_percentage, increase_quote_one_percent, afc_regime, retired_status, retirement_regime
  ) values (
    candidate_record.id,
    coalesce(worker_before.project_name, case_record.contract_name),
    coalesce(worker_before.company_entry_date, case_record.requested_entry_date, request_record.start_date),
    coalesce(worker_before.shift_name, request_record.shift_name),
    coalesce(worker_before.private_role, 'No'),
    payment_method,
    payment_period,
    nullif(trim(coalesce(p_payload ->> 'bank_name', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'bank_account_type', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'bank_account_number', '')), ''),
    pension_regime,
    nullif(trim(coalesce(p_payload ->> 'contribution_fund', '')), ''),
    health_provider,
    case when health_provider_normalized not in ('fonasa', 'mutual', 'no cotiza salud', 'no cotiza') then health_plan_uf end,
    null,
    case when health_provider_normalized = 'fonasa' then 7 else null end,
    coalesce(worker_before.increase_quote_one_percent, 'No'),
    coalesce(worker_before.afc_regime, 'Menos de 11 Años'),
    retired_status,
    case when lower(coalesce(retired_status, '')) in ('si', 'sí', 'true', 'yes') then nullif(trim(p_payload ->> 'retirement_regime'), '') end
  )
  on conflict (recruitment_case_candidate_id) do update set
    payment_method = excluded.payment_method,
    payment_period = excluded.payment_period,
    bank_name = excluded.bank_name,
    bank_account_type = excluded.bank_account_type,
    bank_account_number = excluded.bank_account_number,
    pension_regime = excluded.pension_regime,
    contribution_fund = excluded.contribution_fund,
    health_provider = excluded.health_provider,
    health_plan_uf = excluded.health_plan_uf,
    health_plan_pesos = excluded.health_plan_pesos,
    health_plan_percentage = excluded.health_plan_percentage,
    retired_status = excluded.retired_status,
    retirement_regime = excluded.retirement_regime,
    updated_at = timezone('utc', now())
  returning * into worker_after;

  insert into public.recruitment_case_audit_log (
    recruitment_case_id, recruitment_case_candidate_id, actor_user_id, action_type, old_values, new_values, metadata
  ) values (
    candidate_record.recruitment_case_id,
    candidate_record.id,
    null,
    'candidate_public_buk_worker_file_updated',
    jsonb_build_object('profile', to_jsonb(profile_before), 'worker_file', to_jsonb(worker_before)),
    jsonb_build_object('profile', to_jsonb(profile_after), 'worker_file', to_jsonb(worker_after)),
    jsonb_build_object('source', 'public_dsal_buk_form', 'session_id', session_record.id)
  );

  update public.recruitment_public_buk_form_sessions
     set used_at = timezone('utc', now()), last_seen_at = timezone('utc', now())
   where id = session_record.id;

  return jsonb_build_object('submitted', true, 'case_candidate_id', candidate_record.id);
end;
$function$;

revoke all on function public.start_public_dsal_buk_worker_file(text, text) from public, authenticated;
grant execute on function public.start_public_dsal_buk_worker_file(text, text) to anon;
revoke all on function public.submit_public_dsal_buk_worker_file(text, jsonb) from public, authenticated;
grant execute on function public.submit_public_dsal_buk_worker_file(text, jsonb) to anon;

notify pgrst, 'reload schema';
commit;
