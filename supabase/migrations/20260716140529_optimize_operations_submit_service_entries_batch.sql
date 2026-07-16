begin;

create or replace function public.resolve_operations_driver_candidates(
  p_buk_employee_id text,
  p_document_digits text,
  p_search text
)
returns table (
  buk_employee_id text,
  full_name text,
  document_number text,
  raw_payload jsonb,
  area_name text,
  document_type text,
  updated_at timestamptz,
  created_at timestamptz,
  job_title text,
  contract_code text
)
language plpgsql
stable
set search_path = public
as $function$
begin
  if nullif(trim(coalesce(p_buk_employee_id, '')), '') is not null then
    return query
    select
      e.buk_employee_id,
      e.full_name,
      e.document_number,
      e.raw_payload,
      e.area_name,
      e.document_type,
      e.updated_at,
      e.created_at,
      e.job_title,
      e.contract_code
    from public.employees e
    where e.is_active = true
      and e.buk_employee_id = nullif(trim(p_buk_employee_id), '')
    order by e.updated_at desc nulls last, e.created_at desc nulls last, e.buk_employee_id desc;
    return;
  end if;

  return query
  select
    e.buk_employee_id,
    e.full_name,
    e.document_number,
    e.raw_payload,
    e.area_name,
    e.document_type,
    e.updated_at,
    e.created_at,
    e.job_title,
    e.contract_code
  from public.employees_active_current e
  where (
    nullif(trim(coalesce(p_document_digits, '')), '') is not null
    and public.build_employee_document_digits(e.document_number, e.raw_payload) = nullif(trim(p_document_digits), '')
  )
  or (
    nullif(trim(coalesce(p_search, '')), '') is not null
    and public.build_active_employee_search_text(
      e.full_name,
      e.document_number,
      e.job_title,
      e.contract_code,
      e.area_name,
      e.raw_payload
    ) like '%' || p_search || '%'
  );
end;
$function$;

revoke all on function public.resolve_operations_driver_candidates(text, text, text) from public, anon, authenticated;

do $$
declare
  function_definition text;
  patched_definition text;
  needle text := 'from public.employees_active_current e
          where';
  replacement text := 'from public.resolve_operations_driver_candidates(entry_driver_buk_employee_id, entry_driver_document_digits, entry_driver_search) e
          where';
begin
  select pg_get_functiondef('public.submit_service_entries_batch(jsonb)'::regprocedure)
    into function_definition;

  if function_definition is null then
    raise exception 'submit_service_entries_batch(jsonb) no existe.';
  end if;

  patched_definition := replace(function_definition, needle, replacement);

  if patched_definition = function_definition then
    raise exception 'No se encontro el patron esperado para optimizar submit_service_entries_batch(jsonb).';
  end if;

  if (
    length(function_definition) - length(replace(function_definition, needle, ''))
  ) / length(needle) <> 2 then
    raise exception 'Se esperaba optimizar exactamente 2 resoluciones de conductor en submit_service_entries_batch(jsonb).';
  end if;

  execute patched_definition;
end;
$$;

revoke all on function public.submit_service_entries_batch(jsonb) from public, anon;
grant execute on function public.submit_service_entries_batch(jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
