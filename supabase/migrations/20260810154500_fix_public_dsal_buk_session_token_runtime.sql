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
     and p.proname = 'start_public_dsal_buk_worker_file'
     and p.proargtypes::text = '25 25'
   limit 1;

  if function_definition is null then
    raise exception 'No existe la función pública de ficha BUK para reparar';
  end if;

  function_definition := replace(
    function_definition,
    'session_token text := encode(digest(gen_random_uuid()::text || clock_timestamp()::text, ''sha256''), ''hex'');',
    'session_token text := gen_random_uuid()::text;'
  );
  execute function_definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
