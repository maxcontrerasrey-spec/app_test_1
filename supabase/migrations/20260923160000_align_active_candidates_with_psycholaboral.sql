-- EEES-DB-005: approved
-- owner: Recruitment and Psychological Assessment
-- rollback: forward-only; restore the previous population rule through a later audited migration if required.
-- Source: production audit of Aliro Andres Monrroy Monrroy, RC-0173, on 2026-09-23.
-- Rule: a non-terminal case with an active candidate is visible in Psycholaboral even without an assessment.

begin;

do $migration$
declare
  function_definition text;
  previous_fragment constant text := 'rcc.stage_code not in (''hired'',''rejected'',''withdrawn'')';
  next_fragment constant text := 'rcc.stage_code not in (''rejected'',''withdrawn'')';
begin
  for function_definition in
    select pg_get_functiondef(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_psycholaboral_candidates_page', 'get_psycholaboral_status_summary')
  loop
    if position(previous_fragment in function_definition) = 0 then
      raise exception 'No se encontró el guard de población psicolaboral esperado';
    end if;

    execute replace(function_definition, previous_fragment, next_fragment);
  end loop;
end;
$migration$;

revoke all on function public.get_psycholaboral_candidates_page(text, text, integer, integer) from public, anon;
grant execute on function public.get_psycholaboral_candidates_page(text, text, integer, integer) to authenticated;
revoke all on function public.get_psycholaboral_status_summary(text) from public, anon;
grant execute on function public.get_psycholaboral_status_summary(text) to authenticated;

notify pgrst, 'reload schema';

commit;
