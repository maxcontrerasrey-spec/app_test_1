-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; the ready_for_hire bucket must never include hired candidates.
begin;

do $migration$
declare
  v_definition text;
  v_old_fragment text := $$and rcc.stage_code in ('ready_for_hire', 'hired')$$;
  v_new_fragment text := $$and rcc.stage_code = normalized_stage_code$$;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'get_recruitment_personnel_page_bucket'
     and pg_get_function_identity_arguments(p.oid) = 'p_search text, p_limit integer, p_offset integer, p_stage_code text';

  if v_definition is null then
    raise exception 'No existe la RPC get_recruitment_personnel_page_bucket';
  end if;

  if position(v_old_fragment in v_definition) > 0 then
    v_definition := replace(v_definition, v_old_fragment, v_new_fragment);
    execute v_definition;
  elsif position(v_new_fragment in v_definition) = 0 then
    raise exception 'La RPC de personal no tiene el contrato esperado; se detiene la migracion';
  end if;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
