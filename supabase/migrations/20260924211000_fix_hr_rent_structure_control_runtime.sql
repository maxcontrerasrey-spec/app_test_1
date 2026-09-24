-- EEES-DB-005: approved
-- owner: Recursos Humanos / Gobierno de remuneraciones
-- rollback: forward-only; reemplazar la función por una migración posterior si cambia el contrato.

begin;

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.get_hr_rent_structure_control(bigint,bigint,date)'::regprocedure)
    into function_definition;
  function_definition := replace(
    function_definition,
    'coalesce(p.cap_uf * p.uf_value_clp, t.imponible)',
    '(select cap_uf * uf_value_clp from params where parameter_code = ''afp_base'')'
  );
  execute function_definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
