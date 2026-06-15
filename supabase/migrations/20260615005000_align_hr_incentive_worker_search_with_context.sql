begin;

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
  operable_workers as (
    select distinct on (e.buk_employee_id)
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
      c.code as contract_code,
      bcm.buk_area_name as area_name,
      public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key
    from public.employees_active_current e
    join public.buk_contract_mappings bcm
      on bcm.buk_area_name_normalized = public.normalize_buk_area_name(e.area_name)
     and bcm.is_operational = true
     and bcm.is_one_to_one = true
     and bcm.contract_id is not null
    join public.contracts c
      on c.id = bcm.contract_id
     and c.is_active = true
    join eligible_titles et
      on upper(
        trim(
          coalesce(
            nullif(trim(e.job_title), ''),
            nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
            nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
            nullif(trim(e.raw_payload ->> 'job_title'), '')
          )
        )
      ) = et.normalized_job_title
    order by e.buk_employee_id, e.updated_at desc nulls last, e.created_at desc nulls last
  )
  select
    ow.buk_employee_id,
    ow.full_name,
    ow.document_number,
    ow.resolved_job_title as job_title,
    ow.contract_code,
    ow.area_name,
    concat_ws(
      ' | ',
      coalesce(ow.document_number, 'Sin RUT'),
      coalesce(ow.resolved_job_title, 'Sin cargo'),
      ow.full_name,
      coalesce(ow.area_name, ow.contract_code, 'Sin contrato')
    ) as display_label
  from operable_workers ow
  where
    normalized_search = ''
    or lower(
      concat_ws(
        ' ',
        ow.name_search_key,
        ow.full_name,
        coalesce(ow.document_number, ''),
        coalesce(ow.resolved_job_title, ''),
        coalesce(ow.contract_code, ''),
        coalesce(ow.area_name, '')
      )
    ) like '%' || normalized_search || '%'
  order by
    case
      when normalized_search <> '' and ow.name_search_key like normalized_search || '%' then 0
      when normalized_search <> '' and lower(ow.full_name) like normalized_search || '%' then 1
      else 2
    end,
    ow.full_name
  limit safe_limit;
end;
$function$;

notify pgrst, 'reload schema';

commit;
