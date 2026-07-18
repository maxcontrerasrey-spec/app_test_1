-- Keep the people accreditation rollout focused on the single operational site selected for the pilot.
update public.accreditation_sites
set
  name = 'Codelco Division Ministro Hales',
  code = 'codelco_dmh',
  contract_code = null,
  area_code = null,
  is_active = true,
  updated_at = timezone('utc', now())
where code = 'codelco_dmh';

delete from public.accreditation_sites
where code <> 'codelco_dmh';

create or replace function public.search_accreditation_workers(
  p_search text default null,
  p_site_id uuid default null,
  p_status text default null,
  p_limit integer default 50
)
returns table (
  worker_accreditation_id uuid,
  buk_employee_id text,
  full_name text,
  document_number text,
  document_type text,
  job_title text,
  contract_code text,
  area_name text,
  site_id uuid,
  site_name text,
  accreditation_status text,
  accreditation_expiry_date date,
  required_documents_total integer,
  approved_documents_total integer,
  pending_documents_total integer,
  expired_documents_total integer,
  roster_pattern_name text,
  roster_start_date date
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para consultar trabajadores acreditados';
  end if;

  return query
  with target_site as (
    select s.id, s.name
    from public.accreditation_sites s
    where s.id = p_site_id
      and s.is_active = true
  ),
  active_workers as (
    select distinct on (e.buk_employee_id)
      e.buk_employee_id,
      e.full_name,
      coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
      coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
      coalesce(
        nullif(trim(e.job_title), ''),
        nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
        nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
        nullif(trim(e.raw_payload ->> 'job_title'), '')
      ) as job_title,
      nullif(trim(e.contract_code), '') as contract_code,
      nullif(trim(e.area_name), '') as area_name
    from public.employees_active_current e
    order by e.buk_employee_id, e.updated_at desc nulls last, e.created_at desc nulls last
  ),
  roster_active as (
    select distinct on (wr.employee_buk_employee_id)
      wr.employee_buk_employee_id,
      sp.name as pattern_name,
      wr.start_date
    from public.hr_worker_rosters wr
    join public.hr_shift_patterns sp
      on sp.id = wr.pattern_id
    where wr.start_date <= current_date
      and (wr.end_date is null or wr.end_date >= current_date)
    order by wr.employee_buk_employee_id, wr.start_date desc, wr.created_at desc
  )
  select
    wa.id,
    aw.buk_employee_id,
    aw.full_name,
    aw.document_number,
    aw.document_type,
    aw.job_title,
    aw.contract_code,
    aw.area_name,
    coalesce(wa.site_id, ts.id),
    coalesce(s.name, ts.name),
    coalesce(wa.accreditation_status, 'pending'),
    wa.accreditation_expiry_date,
    coalesce(wa.required_documents_total, 0),
    coalesce(wa.approved_documents_total, 0),
    coalesce(wa.pending_documents_total, 0),
    coalesce(wa.expired_documents_total, 0),
    ra.pattern_name,
    ra.start_date
  from active_workers aw
  left join target_site ts
    on true
  left join public.worker_accreditations wa
    on wa.employee_buk_employee_id = aw.buk_employee_id
    and (p_site_id is null or wa.site_id = p_site_id)
  left join public.accreditation_sites s
    on s.id = wa.site_id
  left join roster_active ra
    on ra.employee_buk_employee_id = aw.buk_employee_id
  where (
      wa.id is not null
      or (p_site_id is not null and ts.id is not null and normalized_search <> '')
    )
    and (
      p_status is null
      or trim(p_status) = ''
      or coalesce(wa.accreditation_status, 'pending') = trim(p_status)
    )
    and (
      normalized_search = ''
      or lower(
        concat_ws(
          ' ',
          aw.full_name,
          coalesce(aw.document_number, ''),
          coalesce(aw.job_title, ''),
          coalesce(aw.contract_code, ''),
          coalesce(aw.area_name, ''),
          coalesce(s.name, ts.name, '')
        )
      ) like '%' || normalized_search || '%'
    )
  order by
    case coalesce(wa.accreditation_status, 'pending')
      when 'expired' then 0
      when 'pending' then 1
      when 'expiring_soon' then 2
      else 3
    end,
    wa.accreditation_expiry_date nulls last,
    aw.full_name asc
  limit safe_limit;
end;
$function$;

revoke all on function public.search_accreditation_workers(text, uuid, text, integer) from public, anon;
grant execute on function public.search_accreditation_workers(text, uuid, text, integer) to authenticated;

notify pgrst, 'reload schema';
