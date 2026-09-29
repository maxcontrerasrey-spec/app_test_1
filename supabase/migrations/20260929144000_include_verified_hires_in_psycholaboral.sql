-- EEES-DB-005: approved
-- owner: Human Resources and Recruitment
-- rollback: forward-only; restore the previous population rule in a later migration if required.
-- A verified hired worker remains eligible for a pending Psycholaboral test
-- even when the source recruitment case has already reached filled.

begin;

do $migration$
declare
  function_definition text;
  previous_fragment constant text := 'or a.id is not null';
  next_fragment constant text := 'or a.id is not null or (rcc.stage_code=''hired'' and public.psycholaboral_candidate_has_eligible_process(rcc.id))';
  replaced_count integer := 0;
begin
  for function_definition in
    select pg_get_functiondef(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_psycholaboral_candidates_page', 'get_psycholaboral_status_summary')
  loop
    if position(previous_fragment in function_definition) = 0 then
      raise exception 'No se encontró el guard de assessment esperado en una RPC psicolaboral';
    end if;

    execute replace(function_definition, previous_fragment, next_fragment);
    replaced_count := replaced_count + 1;
  end loop;

  if replaced_count <> 2 then
    raise exception 'Se esperaba corregir 2 RPC psicolaborales y se corrigieron %', replaced_count;
  end if;
end;
$migration$;

revoke all on function public.get_psycholaboral_candidates_page(text, text, integer, integer) from public, anon;
grant execute on function public.get_psycholaboral_candidates_page(text, text, integer, integer) to authenticated;
revoke all on function public.get_psycholaboral_status_summary(text) from public, anon;
grant execute on function public.get_psycholaboral_status_summary(text) to authenticated;

notify pgrst, 'reload schema';
commit;
