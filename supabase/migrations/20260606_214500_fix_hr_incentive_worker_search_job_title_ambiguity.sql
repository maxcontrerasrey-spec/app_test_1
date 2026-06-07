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
      coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
      coalesce(
        nullif(trim(e.job_title), ''),
        nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
        nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
        nullif(trim(e.raw_payload ->> 'job_title'), '')
      ) as resolved_job_title,
      nullif(trim(e.contract_code), '') as contract_code,
      nullif(trim(e.area_name), '') as area_name
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
        aw.full_name,
        coalesce(aw.document_number, ''),
        coalesce(aw.resolved_job_title, ''),
        coalesce(aw.contract_code, ''),
        coalesce(aw.area_name, '')
      )
    ) like '%' || normalized_search || '%'
  order by aw.full_name
  limit safe_limit;
end;
$function$;

notify pgrst, 'reload schema';
