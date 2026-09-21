-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; conservar asignaciones y corregir mediante migracion posterior.
-- DAND 4x4 y 7x7 rotativos requieren el periodo completo A-descanso-B-descanso.
begin;

update public.hr_shift_patterns
set resting_days = 12,
    updated_at = timezone('utc', now())
where code in ('dand_4x4_a', 'dand_4x4_c');

update public.hr_shift_patterns
set resting_days = 21,
    updated_at = timezone('utc', now())
where code in ('dand_7x7_a', 'dand_7x7_c');

notify pgrst, 'reload schema';
commit;
