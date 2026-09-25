-- EEES-DB-005: approved
-- owner: Recruitment and Psychological Assessment
-- rollback: forward-only; restore the previous checklist derivation through a later audited migration if required.
-- Rule: checklist reads must use persisted worker-file data and never scan the live BUK employee registry.

begin;

do $migration$
declare
  function_definition text;
  expensive_fragment constant text := $fragment$
  effective_employee_code := coalesce(
    nullif(trim(coalesce(worker_rec.employee_code, '')), ''),
    public.resolve_candidate_worker_employee_code(candidate_rec.id)
  );
$fragment$;
  fast_fragment constant text := $fragment$
  effective_employee_code := nullif(trim(coalesce(worker_rec.employee_code, '')), '');
$fragment$;
begin
  select pg_get_functiondef(p.oid)
    into function_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'get_candidate_checklist'
     and pg_get_function_identity_arguments(p.oid) = 'p_case_candidate_id uuid';

  if function_definition is null then
    raise exception 'No existe get_candidate_checklist(uuid) para optimizar';
  end if;

  if position(expensive_fragment in function_definition) = 0 then
    raise exception 'No se encontró la resolución BUK costosa esperada en get_candidate_checklist(uuid)';
  end if;

  execute replace(function_definition, expensive_fragment, fast_fragment);
end;
$migration$;

revoke all on function public.get_candidate_checklist(uuid) from public, anon;
grant execute on function public.get_candidate_checklist(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
