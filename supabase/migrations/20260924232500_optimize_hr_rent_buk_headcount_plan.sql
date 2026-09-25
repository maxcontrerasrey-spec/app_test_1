-- EEES-DB-005: approved
-- owner: Recursos Humanos / Gobierno de remuneraciones
-- rollback: forward-only; restaurar la configuración del planificador mediante una migración posterior.

begin;

-- employees_active_current tiene una cardinalidad estimada muy inferior a la real.
-- El nested loop resultante deserializa el payload BUK por cada cargo; el hash join
-- evalúa cada trabajador una sola vez y mantiene la identidad activa autoritativa.
alter function public.get_hr_rent_structure_control(bigint, bigint)
  set enable_nestloop = off;

alter function public.get_hr_rent_structure_control(bigint, bigint, date)
  set enable_nestloop = off;

notify pgrst, 'reload schema';

commit;
