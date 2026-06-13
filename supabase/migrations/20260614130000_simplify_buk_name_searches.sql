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
  resolved_first_name text := nullif(trim(coalesce(
    normalized_payload ->> 'first_name',
    normalized_payload ->> 'given_name',
    normalized_payload ->> 'name',
    case when part_count >= 1 then name_parts[1] else null end
  )), '');
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

create or replace function public.search_hr_incentive_eligible_workers(
  p_search text default null,
  p_limit integer default 20
)
returns table (
  buk_employee_id text,
  full_name text,
  document_number text,
  job_title text,
  contract_code text,
  area_name text,
  display_label text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  safe_limit integer := greatest(1, least(coalesce(p_limit, 20), 30));
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para consultar trabajadores elegibles';
  end if;

  return query
  with eligible_titles as (
    select upper(trim(jt.job_title)) as normalized_job_title
    from public.hr_incentive_allowed_job_titles jt
    where jt.is_active = true
  ),
  active_workers as (
    select
      e.buk_employee_id,
      e.full_name,
      e.raw_payload,
      coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
      coalesce(
        nullif(trim(e.job_title), ''),
        nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
        nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
        nullif(trim(e.raw_payload ->> 'job_title'), '')
      ) as resolved_job_title,
      nullif(trim(e.contract_code), '') as contract_code,
      nullif(trim(e.area_name), '') as area_name,
      public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key
    from public.employees_active_current e
  )
  select
    aw.buk_employee_id,
    aw.full_name,
    aw.document_number,
    aw.resolved_job_title as job_title,
    aw.contract_code,
    aw.area_name,
    concat_ws(
      ' | ',
      coalesce(aw.document_number, 'Sin RUT'),
      coalesce(aw.resolved_job_title, 'Sin cargo'),
      aw.full_name,
      coalesce(aw.area_name, aw.contract_code, 'Sin contrato')
    ) as display_label
  from active_workers aw
  join eligible_titles et
    on upper(trim(coalesce(aw.resolved_job_title, ''))) = et.normalized_job_title
  where
    normalized_search = ''
    or lower(
      concat_ws(
        ' ',
        aw.name_search_key,
        aw.full_name,
        coalesce(aw.document_number, ''),
        coalesce(aw.resolved_job_title, ''),
        coalesce(aw.contract_code, ''),
        coalesce(aw.area_name, '')
      )
    ) like '%' || normalized_search || '%'
  order by
    case
      when normalized_search <> '' and aw.name_search_key like normalized_search || '%' then 0
      when normalized_search <> '' and lower(aw.full_name) like normalized_search || '%' then 1
      else 2
    end,
    aw.full_name
  limit safe_limit;
end;
$function$;

create or replace function public.search_internal_mobility_workers(
  p_search text,
  p_limit integer default 12
)
returns table (
  buk_employee_id text,
  full_name text,
  document_number text,
  job_title text,
  contract_code text,
  area_name text,
  company_name text,
  display_label text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_digits text := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
  safe_limit integer := greatest(1, least(coalesce(p_limit, 12), 25));
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para buscar trabajadores';
  end if;

  if length(normalized_search) < 2 and length(normalized_digits) < 4 then
    return;
  end if;

  return query
  with active_workers as (
    select
      e.buk_employee_id,
      e.full_name,
      e.raw_payload,
      coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
      public.resolve_active_employee_job_title(e.raw_payload, e.job_title) as resolved_job_title,
      nullif(trim(e.contract_code), '') as contract_code,
      nullif(trim(e.area_name), '') as area_name,
      public.resolve_active_employee_company_name(e.raw_payload, e.area_name) as resolved_company_name,
      public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key
    from public.employees_active_current e
  )
  select
    aw.buk_employee_id,
    aw.full_name,
    aw.document_number,
    aw.resolved_job_title as job_title,
    aw.contract_code,
    aw.area_name,
    aw.resolved_company_name as company_name,
    concat_ws(
      ' · ',
      aw.full_name,
      aw.document_number,
      aw.resolved_job_title,
      aw.area_name
    ) as display_label
  from active_workers aw
  where (
      normalized_search <> ''
      and (
        lower(
          concat_ws(
            ' ',
            aw.name_search_key,
            aw.full_name,
            coalesce(aw.resolved_job_title, ''),
            coalesce(aw.area_name, ''),
            coalesce(aw.contract_code, '')
          )
        ) like '%' || normalized_search || '%'
      )
    )
    or (
      normalized_digits <> ''
      and regexp_replace(coalesce(aw.document_number, ''), '\D', '', 'g') like '%' || normalized_digits || '%'
    )
  order by
    case
      when normalized_search <> '' and aw.name_search_key like normalized_search || '%' then 0
      when normalized_search <> '' and lower(aw.full_name) like normalized_search || '%' then 1
      else 2
    end,
    aw.full_name asc
  limit safe_limit;
end;
$function$;

create or replace function public.search_hr_roster_workers(
  p_search text default null,
  p_limit integer default 12
)
returns table (
  buk_employee_id text,
  full_name text,
  document_number text,
  document_type text,
  job_title text,
  contract_code text,
  area_name text,
  display_label text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  safe_limit integer := least(greatest(coalesce(p_limit, 12), 1), 50);
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar trabajadores de jornadas';
  end if;

  return query
  with active_workers as (
    select distinct on (e.buk_employee_id)
      e.buk_employee_id,
      e.full_name,
      e.raw_payload,
      coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
      coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
      coalesce(
        nullif(trim(e.job_title), ''),
        nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
        nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
        nullif(trim(e.raw_payload ->> 'job_title'), '')
      ) as resolved_job_title,
      nullif(trim(e.contract_code), '') as contract_code,
      nullif(trim(e.area_name), '') as area_name,
      public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key
    from public.employees_active_current e
    order by e.buk_employee_id, e.updated_at desc nulls last, e.created_at desc nulls last
  )
  select
    aw.buk_employee_id,
    aw.full_name,
    aw.document_number,
    aw.document_type,
    aw.resolved_job_title as job_title,
    aw.contract_code,
    aw.area_name,
    concat_ws(
      ' | ',
      coalesce(aw.document_number, 'Sin RUT'),
      coalesce(aw.resolved_job_title, 'Sin cargo'),
      aw.full_name,
      coalesce(aw.area_name, aw.contract_code, 'Sin contrato')
    ) as display_label
  from active_workers aw
  where normalized_search = ''
    or lower(
      concat_ws(
        ' ',
        aw.name_search_key,
        aw.full_name,
        coalesce(aw.document_number, ''),
        coalesce(aw.resolved_job_title, ''),
        coalesce(aw.contract_code, ''),
        coalesce(aw.area_name, '')
      )
    ) like '%' || normalized_search || '%'
  order by
    case
      when normalized_search <> '' and aw.name_search_key like normalized_search || '%' then 0
      when normalized_search <> '' and lower(aw.full_name) like normalized_search || '%' then 1
      else 2
    end,
    aw.full_name
  limit safe_limit;
end;
$function$;

notify pgrst, 'reload schema';
