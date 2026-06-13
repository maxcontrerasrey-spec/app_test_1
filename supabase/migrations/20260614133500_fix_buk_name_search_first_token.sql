create or replace function public.build_buk_employee_name_search_key(
  p_full_name text,
  p_raw_payload jsonb default '{}'::jsonb
)
returns text
language plpgsql
immutable
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

notify pgrst, 'reload schema';
