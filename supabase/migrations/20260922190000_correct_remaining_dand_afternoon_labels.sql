-- EEES-DB-005: approved
-- owner: Plataforma
-- rollback: forward-only; restaurar la nomenclatura anterior requeriria una migracion posterior aprobada.
-- Motivo: las pautas rotativas DAND aun conservaban B para el turno tarde.
begin;

update public.hr_shift_patterns
set
  name = replace(name, 'B', 'C'),
  description = replace(description, ' B', ' C'),
  workday_labels = array(
    select case when label = 'B' then 'C' else label end
    from unnest(workday_labels) as labels(label)
  ),
  updated_at = timezone('utc', now())
where code like 'dand_%'
  and (
    'B' = any(workday_labels)
    or name like '%B%'
    or description like '% B%'
  );

do $$
begin
  if exists (
    select 1
    from public.hr_shift_patterns
    where code like 'dand_%'
      and (
        'B' = any(workday_labels)
        or name like '%B%'
        or description like '% B%'
      )
  ) then
    raise exception 'Persisten etiquetas B en pautas DAND';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
