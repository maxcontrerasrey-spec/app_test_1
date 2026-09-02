-- EEES-DB-005: approved
-- owner: Recruitment and Psychological Assessment
-- rollback: forward-only; restore the previous display derivation through a new migration if required.
begin;

do $migration$
declare definition text;
begin
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_psycholaboral_candidates_page'
    and pg_get_function_identity_arguments(p.oid) = 'p_search text, p_status text, p_limit integer, p_offset integer';
  if definition is null then raise exception 'No existe get_psycholaboral_candidates_page'; end if;
  definition := replace(definition, 'when execution_status = ''completed'' then ''completed''', 'when decision = ''approved'' then ''approved'' when execution_status = ''completed'' then ''completed''');
  definition := replace(definition, 'or display_status = p_status', 'or (p_status = ''approved'' and decision = ''approved'') or display_status = p_status');
  execute definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
