begin;

create or replace function public.sync_hr_roster_exceptions_from_buk_batch(
  p_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  entry_count integer;
  synced_count integer := 0;
  cleared_count integer := 0;
  affected_count integer := 0;
begin
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'El lote de excepciones BUK debe ser un arreglo JSON';
  end if;

  entry_count := jsonb_array_length(p_entries);
  if entry_count > 5000 then
    raise exception 'El lote de excepciones BUK supera el máximo de 5000 filas';
  end if;

  if entry_count = 0 then
    return jsonb_build_object('received', 0, 'synced', 0, 'cleared', 0);
  end if;

  drop table if exists pg_temp.buk_roster_exception_sync_input;
  create temporary table buk_roster_exception_sync_input (
    buk_employee_id text not null,
    exception_date date not null,
    exception_type text not null,
    notes text,
    employee_document_type text,
    employee_document_number text,
    employee_full_name text,
    primary key (buk_employee_id, exception_date)
  ) on commit drop;

  insert into buk_roster_exception_sync_input (
    buk_employee_id,
    exception_date,
    exception_type,
    notes
  )
  select
    trim(coalesce(entry.buk_employee_id, '')),
    entry.exception_date,
    lower(trim(coalesce(entry.exception_type, ''))),
    nullif(trim(coalesce(entry.notes, '')), '')
  from jsonb_to_recordset(p_entries) as entry (
    buk_employee_id text,
    exception_date date,
    exception_type text,
    notes text
  );

  if exists (
    select 1
    from buk_roster_exception_sync_input input
    where input.buk_employee_id = ''
       or input.exception_date is null
       or input.exception_type not in ('', 'vacation', 'medical_leave')
  ) then
    raise exception 'El lote contiene una excepción BUK inválida';
  end if;

  update buk_roster_exception_sync_input input
  set
    employee_document_type = coalesce(employee.document_type, employee.raw_payload ->> 'document_type', 'rut'),
    employee_document_number = coalesce(
      employee.document_number,
      employee.raw_payload ->> 'document_number',
      employee.raw_payload ->> 'rut'
    ),
    employee_full_name = employee.full_name
  from public.employees_active_current employee
  where employee.buk_employee_id = input.buk_employee_id
    and input.exception_type <> '';

  if exists (
    select 1
    from buk_roster_exception_sync_input input
    where input.exception_type <> ''
      and input.employee_full_name is null
  ) then
    raise exception 'Trabajador BUK no encontrado para sincronizar excepción';
  end if;

  update public.hr_roster_exceptions existing
  set
    exception_type = existing.superseded_exception_type,
    exception_source = coalesce(existing.superseded_exception_source, 'manual'),
    notes = existing.superseded_notes,
    created_by = existing.superseded_created_by,
    superseded_exception_type = null,
    superseded_exception_source = null,
    superseded_notes = null,
    superseded_created_by = null,
    is_active = true,
    updated_at = timezone('utc', now())
  from buk_roster_exception_sync_input input
  where existing.employee_buk_employee_id = input.buk_employee_id
    and existing.exception_date = input.exception_date
    and input.exception_type = ''
    and existing.exception_source = 'buk'
    and existing.superseded_exception_type is not null;
  get diagnostics affected_count = row_count;
  cleared_count := cleared_count + affected_count;

  update public.hr_roster_exceptions existing
  set
    is_active = false,
    superseded_exception_type = null,
    superseded_exception_source = null,
    superseded_notes = null,
    superseded_created_by = null,
    updated_at = timezone('utc', now())
  from buk_roster_exception_sync_input input
  where existing.employee_buk_employee_id = input.buk_employee_id
    and existing.exception_date = input.exception_date
    and input.exception_type = ''
    and existing.exception_source = 'buk'
    and existing.superseded_exception_type is null;
  get diagnostics affected_count = row_count;
  cleared_count := cleared_count + affected_count;

  insert into public.hr_roster_exceptions (
    employee_buk_employee_id,
    employee_document_type,
    employee_document_number,
    employee_full_name,
    exception_date,
    exception_type,
    exception_source,
    notes,
    created_by,
    is_active
  )
  select
    input.buk_employee_id,
    input.employee_document_type,
    input.employee_document_number,
    input.employee_full_name,
    input.exception_date,
    input.exception_type,
    'buk',
    input.notes,
    null,
    true
  from buk_roster_exception_sync_input input
  where input.exception_type <> ''
  on conflict (employee_buk_employee_id, exception_date) do update
  set
    employee_document_type = excluded.employee_document_type,
    employee_document_number = excluded.employee_document_number,
    employee_full_name = excluded.employee_full_name,
    exception_type = excluded.exception_type,
    exception_source = 'buk',
    superseded_exception_type = case
      when hr_roster_exceptions.exception_source <> 'buk' then hr_roster_exceptions.exception_type
      else hr_roster_exceptions.superseded_exception_type
    end,
    superseded_exception_source = case
      when hr_roster_exceptions.exception_source <> 'buk' then hr_roster_exceptions.exception_source
      else hr_roster_exceptions.superseded_exception_source
    end,
    superseded_notes = case
      when hr_roster_exceptions.exception_source <> 'buk' then hr_roster_exceptions.notes
      else hr_roster_exceptions.superseded_notes
    end,
    superseded_created_by = case
      when hr_roster_exceptions.exception_source <> 'buk' then hr_roster_exceptions.created_by
      else hr_roster_exceptions.superseded_created_by
    end,
    notes = excluded.notes,
    is_active = true,
    updated_at = timezone('utc', now());
  get diagnostics synced_count = row_count;

  return jsonb_build_object(
    'received', entry_count,
    'synced', synced_count,
    'cleared', cleared_count
  );
end;
$function$;

revoke all on function public.sync_hr_roster_exceptions_from_buk_batch(jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_hr_roster_exceptions_from_buk_batch(jsonb)
  to service_role;

notify pgrst, 'reload schema';

commit;
