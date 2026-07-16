begin;

create or replace function public.search_competency_workers(search_text text default null, result_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := public.normalize_recruitment_search_text(coalesce(search_text, ''));
  document_digits text := regexp_replace(coalesce(search_text, ''), '\D', '', 'g');
  safe_limit integer := least(greatest(coalesce(result_limit, 20), 1), 50);
begin
  if not public.user_can_access_competencies(current_user_id) then
    raise exception 'Sin permisos para buscar trabajadores';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'buk_employee_id', e.buk_employee_id,
      'full_name', e.full_name,
      'document_number', coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut'),
      'document_type', coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut'),
      'job_title', coalesce(nullif(trim(e.job_title), ''), e.raw_payload -> 'current_job' -> 'role' ->> 'name'),
      'area_name', e.area_name,
      'contract_code', e.contract_code,
      'company_name', public.resolve_active_employee_company_name(e.raw_payload, e.area_name),
      'display_label', concat_ws(
        ' · ',
        e.full_name,
        coalesce(e.document_number, e.raw_payload ->> 'rut'),
        e.job_title,
        public.resolve_active_employee_company_name(e.raw_payload, e.area_name)
      )
    ) order by e.full_name), '[]'::jsonb)
    from (
      select distinct on (e.buk_employee_id)
        e.*
      from public.employees_active_current e
      where e.buk_employee_id is not null
        and nullif(trim(coalesce(e.full_name, '')), '') is not null
        and (
          normalized_search = ''
          or public.build_active_employee_search_text(
            e.full_name,
            e.document_number,
            e.job_title,
            e.contract_code,
            e.area_name,
            e.raw_payload
          ) like '%' || normalized_search || '%'
          or (
            length(document_digits) >= 4
            and public.build_employee_document_digits(e.document_number, e.raw_payload) like '%' || document_digits || '%'
          )
          or e.buk_employee_id ilike '%' || coalesce(search_text, '') || '%'
        )
      order by e.buk_employee_id, e.updated_at desc nulls last, e.created_at desc nulls last
      limit safe_limit
    ) e
  );
end;
$function$;

revoke all on function public.search_competency_workers(text, integer) from public, anon;
grant execute on function public.search_competency_workers(text, integer) to authenticated;

notify pgrst, 'reload schema';

commit;
