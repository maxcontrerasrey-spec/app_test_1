-- EEES-DB-005: approved
-- owner: Recursos Humanos / Gobierno de remuneraciones
-- rollback: forward-only; conservar el cálculo pendiente mediante una migración posterior.

begin;

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.get_hr_rent_structure_control(bigint,bigint,date)'::regprocedure)
    into function_definition;
  function_definition := replace(
    function_definition,
    '''balance'', coalesce(position_row.authorized_headcount, 0) - position_row.contracted_count',
    '''balance'', case when position_row.structure_id is null then null else coalesce(position_row.authorized_headcount, 0) - position_row.contracted_count end'
  );
  execute function_definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
