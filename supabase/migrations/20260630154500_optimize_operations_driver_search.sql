begin;

create or replace function public.search_operations_drivers(
  p_search text default null,
  p_service_date date default current_date,
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
  display_label text,
  roster_base_status text,
  roster_effective_status text,
  is_working_day boolean,
  is_rest_day boolean
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_digits text := public.build_employee_document_digits(p_search, '{}'::jsonb);
  safe_limit integer := least(greatest(coalesce(p_limit, 12), 1), 30);
  resolved_service_date date := coalesce(p_service_date, current_date);
begin
  if not public.user_can_manage_operations(current_user_id) then
    raise exception 'Sin permisos para buscar conductores de operaciones';
  end if;

  if length(normalized_search) < 2 and length(normalized_digits) < 4 then
    return;
  end if;

  return query
  with matching_workers as (
    select
      e.buk_employee_id,
      e.full_name,
      e.raw_payload,
      coalesce(
        nullif(trim(coalesce(e.document_number, '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'document_number', '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'rut', '')), '')
      ) as document_number,
      coalesce(
        nullif(trim(coalesce(e.document_type, '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'document_type', '')), ''),
        'rut'
      ) as document_type,
      public.resolve_active_employee_job_title(e.raw_payload, e.job_title) as resolved_job_title,
      nullif(trim(e.contract_code), '') as contract_code,
      nullif(trim(e.area_name), '') as area_name,
      public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key,
      public.build_employee_document_digits(e.document_number, e.raw_payload) as document_digits,
      row_number() over (
        partition by public.build_active_employee_identity_key(
          e.document_type,
          e.document_number,
          e.buk_employee_id,
          e.raw_payload
        )
        order by e.updated_at desc nulls last, e.created_at desc nulls last, e.buk_employee_id desc
      ) as identity_rank
    from public.employees e
    where e.is_active = true
      and (
        (
          normalized_search <> ''
          and public.build_active_employee_search_text(
            e.full_name,
            e.document_number,
            e.job_title,
            e.contract_code,
            e.area_name,
            e.raw_payload
          ) like '%' || normalized_search || '%'
        )
        or (
          normalized_digits <> ''
          and public.build_employee_document_digits(e.document_number, e.raw_payload)
            like '%' || normalized_digits || '%'
        )
      )
  ),
  ranked_workers as (
    select
      mw.buk_employee_id,
      mw.full_name,
      mw.document_number,
      mw.document_type,
      mw.resolved_job_title,
      mw.contract_code,
      mw.area_name,
      mw.name_search_key,
      mw.document_digits,
      case
        when normalized_search <> '' and mw.name_search_key like normalized_search || '%' then 0
        when normalized_search <> '' and lower(mw.full_name) like normalized_search || '%' then 1
        when normalized_digits <> '' and mw.document_digits like normalized_digits || '%' then 2
        else 3
      end as search_rank
    from matching_workers mw
    where mw.identity_rank = 1
    order by
      case
        when normalized_search <> '' and mw.name_search_key like normalized_search || '%' then 0
        when normalized_search <> '' and lower(mw.full_name) like normalized_search || '%' then 1
        when normalized_digits <> '' and mw.document_digits like normalized_digits || '%' then 2
        else 3
      end,
      mw.full_name asc
    limit safe_limit
  )
  select
    rw.buk_employee_id,
    rw.full_name,
    rw.document_number,
    rw.document_type,
    rw.resolved_job_title as job_title,
    rw.contract_code,
    rw.area_name,
    concat_ws(
      ' | ',
      coalesce(rw.document_number, 'Sin RUT'),
      coalesce(rw.resolved_job_title, 'Sin cargo'),
      rw.full_name,
      coalesce(rw.area_name, rw.contract_code, 'Sin contrato')
    ) as display_label,
    rs.base_status as roster_base_status,
    rs.effective_status as roster_effective_status,
    rs.is_working_day,
    rs.is_rest_day
  from ranked_workers rw
  cross join lateral public.resolve_hr_roster_day_status(rw.buk_employee_id, resolved_service_date) rs
  order by rw.search_rank, rw.full_name asc;
end;
$function$;

commit;
