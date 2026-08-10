begin;

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(p.oid)
    into function_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'submit_public_dsal_buk_worker_file'
     and p.proargtypes::text = '25 3802'
   limit 1;

  if function_definition is null then
    raise exception 'No existe la funcion publica de envio de ficha BUK para reparar';
  end if;

  if position('#variable_conflict use_variable' in function_definition) = 0 then
    function_definition := replace(
      function_definition,
      'as $function$\ndeclare',
      'as $function$\n#variable_conflict use_variable\ndeclare'
    );
    execute function_definition;
  end if;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
