-- EEES-DB-005: approved
-- owner: Human Resources / Operations
-- rollback: forward-only; preserve roster history and BUK evidence.
begin;

create or replace function public.extract_buk_employee_exit_date(p_raw_payload jsonb)
returns date
language sql
immutable
parallel safe
as $$
  select public.parse_bi_date_text(
    coalesce(
      nullif(trim(coalesce(p_raw_payload #>> '{current_job,end_date}', '')), ''),
      nullif(trim(coalesce(p_raw_payload #>> '{current_job,active_until}', '')), ''),
      nullif(trim(coalesce(p_raw_payload #>> '{current_job,custom_attributes,Fecha de salida}', '')), ''),
      nullif(trim(coalesce(p_raw_payload #>> '{current_job,custom_attributes,Fecha de término}', '')), ''),
      nullif(trim(coalesce(p_raw_payload #>> '{current_job,custom_attributes,Fecha termino}', '')), ''),
      nullif(trim(coalesce(p_raw_payload ->> 'active_until', '')), ''),
      nullif(trim(coalesce(p_raw_payload ->> 'termination_date', '')), ''),
      nullif(trim(coalesce(p_raw_payload ->> 'end_date', '')), '')
    )
  );
$$;

revoke all on function public.extract_buk_employee_exit_date(jsonb) from public, anon, authenticated;
grant execute on function public.extract_buk_employee_exit_date(jsonb) to authenticated;

do $migration$
declare
  v_definition text;
  v_updated boolean := false;
  v_before text;
  v_after text;
  v_function record;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'search_hr_roster_workers'
     and pg_get_function_identity_arguments(p.oid) = 'p_search text, p_limit integer';

  if v_definition is null then
    raise exception 'No existe la RPC search_hr_roster_workers';
  end if;

  v_before := $$  from matching_workers mw
  where mw.identity_rank = 1$$;
  v_after := $$  from matching_workers mw
  join public.employees employee
    on employee.id = mw.employee_id
  where mw.identity_rank = 1
    and employee.is_active = true
    and (employee.buk_exit_date is null or employee.buk_exit_date >= current_date)$$;

  if position(v_before in v_definition) = 0 then
    raise exception 'search_hr_roster_workers no tiene el contrato esperado';
  end if;
  execute replace(v_definition, v_before, v_after);

  for v_function in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('get_hr_roster_calendar_summary', 'get_hr_roster_bulk_calendar')
  loop
    select pg_get_functiondef(v_function.oid) into v_definition;

    v_before := $$where (e.is_active = true or e.buk_exit_date >= month_start)$$;
    v_after := $$where ((e.is_active = true and (e.buk_exit_date is null or e.buk_exit_date >= month_start)) or e.buk_exit_date >= month_start)$$;
    if position(v_before in v_definition) > 0 then
      v_definition := replace(v_definition, v_before, v_after);
      v_updated := true;
    end if;

    v_before := $$where (e.is_active = true or e.buk_exit_date >= range_start)$$;
    v_after := $$where ((e.is_active = true and (e.buk_exit_date is null or e.buk_exit_date >= range_start)) or e.buk_exit_date >= range_start)$$;
    if position(v_before in v_definition) > 0 then
      v_definition := replace(v_definition, v_before, v_after);
      v_updated := true;
    end if;

    if v_definition <> pg_get_functiondef(v_function.oid) then
      execute v_definition;
    end if;
  end loop;

  if not v_updated then
    raise exception 'No se encontró el alcance de salida esperado en las RPC de Jornadas';
  end if;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
