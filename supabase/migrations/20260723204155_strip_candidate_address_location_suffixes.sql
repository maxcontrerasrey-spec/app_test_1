begin;

create or replace function pg_temp.strip_candidate_address_location_suffix(
  p_value text,
  p_current_city text,
  p_district_or_commune text
)
returns text
language plpgsql
as $function$
declare
  normalized text := nullif(regexp_replace(trim(coalesce(p_value, '')), '\s+', ' ', 'g'), '');
  location_value text;
  suffix_value text;
begin
  foreach location_value in array array[
    nullif(regexp_replace(trim(coalesce(p_current_city, '')), '\s+', ' ', 'g'), ''),
    nullif(regexp_replace(trim(coalesce(p_district_or_commune, '')), '\s+', ' ', 'g'), '')
  ]
  loop
    if normalized is null or location_value is null then
      continue;
    end if;

    foreach suffix_value in array array[', ' || location_value, ',' || location_value]
    loop
      if right(lower(normalized), length(suffix_value)) = lower(suffix_value) then
        normalized = nullif(trim(left(normalized, length(normalized) - length(suffix_value))), '');
        exit;
      end if;
    end loop;
  end loop;

  return normalized;
end;
$function$;

with normalized_candidates as (
  select
    cp.id,
    pg_temp.strip_candidate_address_location_suffix(
      cp.street_name,
      cp.current_city,
      cp.district_or_commune
    ) as next_street_name,
    nullif(regexp_replace(trim(coalesce(cp.street_number, '')), '^#+\s*', ''), '') as next_street_number,
    pg_temp.strip_candidate_address_location_suffix(
      cp.address_line,
      cp.current_city,
      cp.district_or_commune
    ) as next_address_fallback
  from public.candidate_profiles cp
),
calculated_candidates as (
  select
    nc.id,
    nc.next_street_name,
    nullif(
      coalesce(
        nullif(
          concat_ws(
            ', ',
            nc.next_street_name,
            case
              when nc.next_street_number is not null then '#' || nc.next_street_number
              else null
            end
          ),
          ''
        ),
        nc.next_address_fallback
      ),
      ''
    ) as next_address_line
  from normalized_candidates nc
)
update public.candidate_profiles cp
   set street_name = cc.next_street_name,
       address_line = cc.next_address_line
  from calculated_candidates cc
 where cc.id = cp.id
   and (
     cp.street_name is distinct from cc.next_street_name
     or cp.address_line is distinct from cc.next_address_line
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
  normalized_current_city text := nullif(
    initcap(regexp_replace(lower(trim(coalesce(p_current_city, ''))), '\s+', ' ', 'g')),
    ''
  );
  normalized_district_or_commune text := nullif(trim(coalesce(p_district_or_commune, '')), '');
  normalized_street_name text := nullif(
    regexp_replace(trim(coalesce(p_street_name, '')), '\s+', ' ', 'g'),
    ''
  );
  normalized_street_number text := nullif(
    regexp_replace(trim(coalesce(p_street_number, '')), '^#+\s*', ''),
    ''
  );
  derived_address_line text;
  location_value text;
  suffix_value text;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if normalized_current_city is null then
    raise exception 'Ciudad es obligatoria';
  end if;

  foreach location_value in array array[normalized_current_city, normalized_district_or_commune]
  loop
    if normalized_street_name is null or location_value is null then
      continue;
    end if;

    foreach suffix_value in array array[', ' || location_value, ',' || location_value]
    loop
      if right(lower(normalized_street_name), length(suffix_value)) = lower(suffix_value) then
        normalized_street_name = nullif(
          trim(left(normalized_street_name, length(normalized_street_name) - length(suffix_value))),
          ''
        );
        exit;
      end if;
    end loop;
  end loop;

  derived_address_line := nullif(
    concat_ws(
      ', ',
      normalized_street_name,
      case
        when normalized_street_number is not null then '#' || normalized_street_number
        else null
      end
    ),
    ''
  );

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
         address_line = derived_address_line,
         district_or_commune = normalized_district_or_commune,
         current_city = normalized_current_city,
         region = nullif(trim(coalesce(p_region, '')), ''),
         street_name = normalized_street_name,
         street_number = normalized_street_number,
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
      'profile_scope', 'buk_personal_profile',
      'address_line_source', 'derived_from_street_number',
      'address_location_suffix_guard', true
    )
  );
end;
$function$;

revoke all on function public.upsert_candidate_person_profile(
  uuid, text, text, text, text, text, text, date, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, text, text, text, text,
  date, text, date, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.upsert_candidate_person_profile(
  uuid, text, text, text, text, text, text, date, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, text, text, text, text,
  date, text, date, text, text, text, text, text, text, text
) to authenticated;

notify pgrst, 'reload schema';

commit;
