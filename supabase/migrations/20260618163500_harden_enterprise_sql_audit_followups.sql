begin;

drop policy if exists "security_audit_logs_insert_self" on public.security_audit_logs;

create or replace function public.sync_hr_roster_exception_from_buk(
  p_buk_employee_id text,
  p_exception_date date,
  p_exception_type text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  request_claims text := coalesce(current_setting('request.jwt.claims', true), '');
  worker_row record;
  existing_row public.hr_roster_exceptions%rowtype;
  normalized_exception_type text := lower(trim(coalesce(p_exception_type, '')));
  has_internal_context boolean := request_claims = '';
  has_service_role_context boolean := public.current_request_has_service_role();
  result_id uuid;
begin
  if not has_internal_context
    and not has_service_role_context
    and not public.user_is_admin(current_user_id) then
    raise exception 'Sin permisos para sincronizar excepciones de BUK';
  end if;

  if p_exception_date is null then
    raise exception 'Debe indicar la fecha de la excepción BUK';
  end if;

  if normalized_exception_type <> ''
    and normalized_exception_type not in ('vacation', 'medical_leave') then
    raise exception 'BUK solo puede sincronizar vacaciones o licencia médica';
  end if;

  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type
  into worker_row
  from public.employees_active_current e
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_row.buk_employee_id is null then
    raise exception 'Trabajador BUK no encontrado para sincronizar excepción';
  end if;

  select *
    into existing_row
  from public.hr_roster_exceptions hre
  where hre.employee_buk_employee_id = worker_row.buk_employee_id
    and hre.exception_date = p_exception_date
  limit 1;

  if normalized_exception_type = '' then
    if existing_row.id is null or existing_row.exception_source <> 'buk' then
      return null;
    end if;

    if existing_row.superseded_exception_type is not null then
      update public.hr_roster_exceptions
      set
        exception_type = existing_row.superseded_exception_type,
        exception_source = coalesce(existing_row.superseded_exception_source, 'manual'),
        notes = existing_row.superseded_notes,
        created_by = existing_row.superseded_created_by,
        superseded_exception_type = null,
        superseded_exception_source = null,
        superseded_notes = null,
        superseded_created_by = null,
        is_active = true,
        updated_at = timezone('utc', now())
      where id = existing_row.id
      returning id into result_id;

      return result_id;
    end if;

    update public.hr_roster_exceptions
    set
      is_active = false,
      superseded_exception_type = null,
      superseded_exception_source = null,
      superseded_notes = null,
      superseded_created_by = null,
      updated_at = timezone('utc', now())
    where id = existing_row.id
    returning id into result_id;

    return result_id;
  end if;

  if existing_row.id is null then
    insert into public.hr_roster_exceptions (
      employee_buk_employee_id,
      employee_document_type,
      employee_document_number,
      employee_full_name,
      exception_date,
      exception_type,
      exception_source,
      notes,
      created_by
    )
    values (
      worker_row.buk_employee_id,
      worker_row.document_type,
      worker_row.document_number,
      worker_row.full_name,
      p_exception_date,
      normalized_exception_type,
      'buk',
      nullif(trim(coalesce(p_notes, '')), ''),
      null
    )
    returning id into result_id;

    return result_id;
  end if;

  update public.hr_roster_exceptions
  set
    employee_document_type = worker_row.document_type,
    employee_document_number = worker_row.document_number,
    employee_full_name = worker_row.full_name,
    exception_type = normalized_exception_type,
    exception_source = 'buk',
    superseded_exception_type = case
      when existing_row.exception_source <> 'buk' then existing_row.exception_type
      else existing_row.superseded_exception_type
    end,
    superseded_exception_source = case
      when existing_row.exception_source <> 'buk' then existing_row.exception_source
      else existing_row.superseded_exception_source
    end,
    superseded_notes = case
      when existing_row.exception_source <> 'buk' then existing_row.notes
      else existing_row.superseded_notes
    end,
    superseded_created_by = case
      when existing_row.exception_source <> 'buk' then existing_row.created_by
      else existing_row.superseded_created_by
    end,
    notes = nullif(trim(coalesce(p_notes, '')), ''),
    is_active = true,
    updated_at = timezone('utc', now())
  where id = existing_row.id
  returning id into result_id;

  return result_id;
end;
$function$;

revoke all on function public.sync_hr_roster_exception_from_buk(text, date, text, text) from public, anon, authenticated;
grant execute on function public.sync_hr_roster_exception_from_buk(text, date, text, text) to service_role;

notify pgrst, 'reload schema';

commit;
