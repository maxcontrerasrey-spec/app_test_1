-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; restaurar la nomenclatura anterior mediante una migración posterior si negocio la redefine.
-- Motivo: la convención definitiva DAND usa C para turno tarde.
begin;

update public.hr_shift_patterns
set
  name = replace(name, ' · B', ' · C'),
  description = replace(replace(description, 'tarde (B)', 'tarde (C)'), ' B,', ' C,'),
  workday_labels = array(
    select case when label = 'B' then 'C' else label end
    from unnest(workday_labels) as labels(label)
  ),
  updated_at = timezone('utc', now())
where code in ('dand_4x3_c', 'dand_4x4_c', 'dand_6x1_c', 'dand_7x7_c');

notify pgrst, 'reload schema';
commit;
