-- EEES-DB-005: approved
-- owner: Human Resources and Recruitment
-- rollback: forward-only; restore the previous display classification in a later migration if required.
-- A hired candidate without an assessment must remain visible in Contratados so
-- Recruitment can send the pending battery.

begin;

do $migration$
declare
  function_definition text;
  previous_fragment constant text := 'when stage_code=''hired'' and assessment_id is not null then ''hired''';
  alternate_previous_fragment constant text := 'when rcc.stage_code=''hired'' and a.id is not null then ''hired''';
  next_fragment constant text := 'when stage_code=''hired'' then ''hired''';
  alternate_next_fragment constant text := 'when rcc.stage_code=''hired'' then ''hired''';
  replaced_count integer := 0;
begin
  for function_definition in
    select pg_get_functiondef(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_psycholaboral_candidates_page', 'get_psycholaboral_status_summary')
  loop
    if position(previous_fragment in function_definition) > 0 then
      execute replace(function_definition, previous_fragment, next_fragment);
    elsif position(alternate_previous_fragment in function_definition) > 0 then
      execute replace(function_definition, alternate_previous_fragment, alternate_next_fragment);
    else
      raise exception 'No se encontró la clasificación hired esperada en una RPC psicolaboral';
    end if;
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
