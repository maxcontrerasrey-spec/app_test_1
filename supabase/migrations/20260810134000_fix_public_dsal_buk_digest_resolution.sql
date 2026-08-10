begin;

do $migration$
declare
  function_definition text;
begin
  if to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'No existe extensions.digest(bytea,text); no se puede reparar el hash de ficha BUK';
  end if;

  for function_definition in
    select pg_get_functiondef(p.oid)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'start_public_dsal_buk_worker_file',
         'submit_public_dsal_buk_worker_file'
       )
       and p.proargtypes::text in ('25 25', '25 3802')
  loop
    if position('extensions.digest(' in function_definition) = 0 then
      function_definition := replace(function_definition, 'digest(', 'extensions.digest(');
      execute function_definition;
    end if;
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
