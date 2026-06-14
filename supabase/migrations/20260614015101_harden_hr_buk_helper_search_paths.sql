create or replace function public.build_buk_employee_name_search_key(
  p_full_name text,
  p_raw_payload jsonb default '{}'::jsonb
)
returns text
language plpgsql
immutable
set search_path = public
as $function$
declare
  normalized_full_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  normalized_payload jsonb := coalesce(p_raw_payload, '{}'::jsonb);
  name_parts text[] := case
    when normalized_full_name = '' then array[]::text[]
    else regexp_split_to_array(normalized_full_name, '\s+')
  end;
  part_count integer := coalesce(array_length(name_parts, 1), 0);
  raw_first_name text := nullif(trim(coalesce(
    normalized_payload ->> 'first_name',
    normalized_payload ->> 'given_name',
    normalized_payload ->> 'name',
    case when part_count >= 1 then name_parts[1] else null end
  )), '');
  resolved_first_name text := case
    when raw_first_name is null then null
    else split_part(raw_first_name, ' ', 1)
  end;
  resolved_last_name text := nullif(trim(coalesce(
    normalized_payload ->> 'last_name',
    normalized_payload ->> 'surname',
    normalized_payload ->> 'paternal_surname',
    normalized_payload ->> 'father_last_name',
    case
      when part_count >= 3 then name_parts[part_count - 1]
      when part_count = 2 then name_parts[2]
      else null
    end
  )), '');
  resolved_second_last_name text := nullif(trim(coalesce(
    normalized_payload ->> 'second_last_name',
    normalized_payload ->> 'second_surname',
    normalized_payload ->> 'maternal_surname',
    normalized_payload ->> 'mother_last_name',
    case when part_count >= 3 then name_parts[part_count] else null end
  )), '');
begin
  return lower(
    regexp_replace(
      trim(concat_ws(' ', resolved_first_name, resolved_last_name, resolved_second_last_name)),
      '\s+',
      ' ',
      'g'
    )
  );
end;
$function$;

create or replace function public.extract_buk_company_id(p_payload jsonb)
returns bigint
language sql
immutable
set search_path = public
as $function$
  select case
    when coalesce(
      p_payload ->> 'company_id',
      p_payload -> 'company' ->> 'id',
      p_payload -> 'company' ->> 'company_id',
      p_payload -> 'current_job' ->> 'company_id',
      p_payload -> 'current_job' -> 'company' ->> 'id',
      p_payload -> 'current_job' -> 'company' ->> 'company_id',
      p_payload -> 'employee' ->> 'company_id',
      p_payload -> 'employee' -> 'company' ->> 'id'
    ) ~ '^\d+$' then
      coalesce(
        p_payload ->> 'company_id',
        p_payload -> 'company' ->> 'id',
        p_payload -> 'company' ->> 'company_id',
        p_payload -> 'current_job' ->> 'company_id',
        p_payload -> 'current_job' -> 'company' ->> 'id',
        p_payload -> 'current_job' -> 'company' ->> 'company_id',
        p_payload -> 'employee' ->> 'company_id',
        p_payload -> 'employee' -> 'company' ->> 'id'
      )::bigint
    else null
  end;
$function$;

create or replace function public.extract_buk_company_name(p_payload jsonb)
returns text
language sql
immutable
set search_path = public
as $function$
  select nullif(
    trim(
      coalesce(
        p_payload -> 'company' ->> 'name',
        p_payload ->> 'company_name',
        p_payload ->> 'company',
        p_payload -> 'current_job' -> 'company' ->> 'name',
        p_payload -> 'current_job' ->> 'company_name',
        p_payload -> 'current_job' -> 'legal_entity' ->> 'name',
        p_payload -> 'current_job' ->> 'legal_entity_name',
        p_payload -> 'employee' -> 'company' ->> 'name'
      )
    ),
    ''
  );
$function$;

create or replace function public.extract_buk_contract_number_from_area_name(p_area_name text)
returns text
language sql
immutable
set search_path = public
as $function$
  select nullif(
    trim(
      coalesce(
        (regexp_match(coalesce(p_area_name, ''), '\(([^)]+)\)'))[1],
        ''
      )
    ),
    ''
  );
$function$;

create or replace function public.extract_buk_job_title(p_payload jsonb)
returns text
language sql
immutable
set search_path = public
as $function$
  select nullif(
    trim(
      coalesce(
        p_payload -> 'current_job' -> 'role' ->> 'name',
        p_payload -> 'current_job' ->> 'role_name',
        p_payload -> 'current_job' ->> 'job_title',
        p_payload -> 'jobs' -> 0 -> 'role' ->> 'name',
        p_payload -> 'jobs' -> 0 ->> 'role_name',
        p_payload -> 'jobs' -> 0 ->> 'job_title',
        p_payload ->> 'job_title',
        p_payload -> 'employee' ->> 'job_title'
      )
    ),
    ''
  );
$function$;

create or replace function public.extract_buk_shift_name(p_payload jsonb)
returns text
language sql
immutable
set search_path = public
as $function$
  select nullif(
    trim(
      coalesce(
        p_payload -> 'current_job' -> 'custom_attributes' ->> 'Jornada Laboral',
        p_payload -> 'jobs' -> 0 -> 'custom_attributes' ->> 'Jornada Laboral',
        p_payload ->> 'shift_name',
        p_payload ->> 'shift',
        p_payload -> 'current_job' ->> 'shift_name',
        p_payload -> 'current_job' ->> 'shift',
        p_payload -> 'current_job' -> 'schedule' ->> 'name',
        p_payload -> 'current_job' -> 'schedule' ->> 'shift_name',
        p_payload -> 'employee' ->> 'shift_name'
      )
    ),
    ''
  );
$function$;

create or replace function public.resolve_active_employee_job_title(
  p_payload jsonb,
  p_job_title text default null
)
returns text
language sql
immutable
set search_path = public
as $function$
  select coalesce(
    public.extract_buk_job_title(p_payload),
    nullif(trim(coalesce(p_job_title, '')), ''),
    'Sin cargo'
  );
$function$;

create or replace function public.resolve_known_company_name(
  p_company_id bigint default null,
  p_contract_number text default null
)
returns text
language sql
immutable
set search_path = public
as $function$
  with resolved_company_keys as (
    select
      p_company_id as company_id,
      case
        when split_part(coalesce(p_contract_number, ''), ':', 2) ~ '^\d+$'
          then split_part(p_contract_number, ':', 2)::bigint
        else null
      end as contract_company_code
  )
  select case
    when resolved_company_keys.company_id = 1 or resolved_company_keys.contract_company_code = 1
      then 'Buses JM Pullman S.A.'
    when resolved_company_keys.company_id = 3 or resolved_company_keys.contract_company_code = 2
      then 'Servicios Industriales Minardi S.A.'
    when resolved_company_keys.company_id = 4 or resolved_company_keys.contract_company_code = 4
      then 'Consorcio nuevo norte SPA'
    when resolved_company_keys.company_id = 5 or resolved_company_keys.contract_company_code = 5
      then 'Consorcio Andino SPA'
    when resolved_company_keys.company_id = 6 or resolved_company_keys.contract_company_code = 6
      then 'Transportes Plaza Vieja Spa'
    else null
  end
  from resolved_company_keys;
$function$;

notify pgrst, 'reload schema';
