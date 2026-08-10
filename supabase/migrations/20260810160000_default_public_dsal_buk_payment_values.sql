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
    raise exception 'No existe la función pública de ficha BUK para ajustar valores por defecto';
  end if;

  function_definition := replace(
    function_definition,
    'payment_method text := nullif(trim(coalesce(p_payload ->> ''payment_method'', '''')), '''');',
    'payment_method text := coalesce(nullif(trim(coalesce(p_payload ->> ''payment_method'', '''')), ''''), ''Transferencia Bancaria'');'
  );
  function_definition := replace(
    function_definition,
    'payment_period text := nullif(trim(coalesce(p_payload ->> ''payment_period'', '''')), '''');',
    'payment_period text := coalesce(nullif(trim(coalesce(p_payload ->> ''payment_period'', '''')), ''''), ''Mensual'');'
  );
  execute function_definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
