begin;

do $$
declare
  function_record record;
begin
  for function_record in
    select
      p.oid::regprocedure as function_signature,
      pg_get_function_result(p.oid) as function_result
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'revoke all on function %s from public, anon',
      function_record.function_signature
    );

    if function_record.function_result <> 'trigger' then
      execute format(
        'grant execute on function %s to authenticated, service_role',
        function_record.function_signature
      );
    end if;
  end loop;
end $$;

alter default privileges in schema public
  revoke execute on functions from public;

notify pgrst, 'reload schema';

commit;
