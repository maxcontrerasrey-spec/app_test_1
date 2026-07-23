do $$
declare
  target_roster_id uuid;
  affected_count integer;
begin
  if exists (
    select 1
    from public.hr_worker_rosters wr
    join public.hr_shift_patterns sp
      on sp.id = wr.pattern_id
    where wr.employee_buk_employee_id = '41804'
      and lower(wr.employee_full_name) = lower('Mario Roberto Pizarro Fernández')
      and regexp_replace(coalesce(wr.employee_document_number, ''), '[^0-9kK]+', '', 'g') = '108640960'
      and sp.name = '4X3 Ordinaria'
      and sp.working_days = 4
      and sp.resting_days = 3
      and wr.start_date = date '2026-07-20'
      and wr.end_date = date '2026-07-27'
  ) then
    raise notice 'La asignacion 4X3 de Mario Pizarro ya esta anclada en 2026-07-20';
    return;
  end if;

  if not exists (
    select 1
    from public.hr_worker_rosters wr
    where wr.employee_buk_employee_id = '41804'
  ) then
    raise notice 'Mario Pizarro BUK 41804 no existe en hr_worker_rosters; no-op para ambientes sin datos productivos';
    return;
  end if;

  if (
    select count(*)
    from public.hr_worker_rosters wr
    join public.hr_shift_patterns sp
      on sp.id = wr.pattern_id
    where wr.employee_buk_employee_id = '41804'
      and sp.working_days = 4
      and sp.resting_days = 3
      and daterange(wr.start_date, coalesce(wr.end_date, 'infinity'::date), '[]')
          && daterange(date '2026-07-20', date '2026-07-27', '[]')
  ) <> 1 then
    raise exception 'La correccion de Mario Pizarro no es segura: existe mas de una pauta 4X3 superpuesta';
  end if;

  select wr.id
    into target_roster_id
  from public.hr_worker_rosters wr
  join public.hr_shift_patterns sp
    on sp.id = wr.pattern_id
  where wr.employee_buk_employee_id = '41804'
    and lower(wr.employee_full_name) = lower('Mario Roberto Pizarro Fernández')
    and regexp_replace(coalesce(wr.employee_document_number, ''), '[^0-9kK]+', '', 'g') = '108640960'
    and sp.name = '4X3 Ordinaria'
    and sp.working_days = 4
    and sp.resting_days = 3
    and wr.start_date = date '2026-07-22'
    and wr.end_date = date '2026-07-27';

  if target_roster_id is null then
    raise exception 'No se encontro la asignacion 4X3 esperada de Mario Pizarro anclada en 2026-07-22';
  end if;

  update public.hr_worker_rosters
  set
    start_date = date '2026-07-20',
    notes = concat_ws(
      E'\n',
      nullif(notes, ''),
      'Correccion operativa: ciclo 4X3 inicia el 2026-07-20; carga original quedo en 2026-07-22.'
    ),
    updated_at = timezone('utc', now())
  where id = target_roster_id;

  get diagnostics affected_count = row_count;

  if affected_count <> 1 then
    raise exception 'La correccion de Mario Pizarro debia afectar 1 fila, afecto %', affected_count;
  end if;
end $$;
