-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; preserve the original start date in notes and correct through a later audited migration.
-- Source: production audit requested on 2026-09-23. Fixed 4X3/5X2 cycles must start on Monday.

begin;

create temporary table tmp_fixed_cycle_monday_corrections (
  roster_id uuid primary key,
  employee_buk_employee_id text not null,
  original_start_date date not null,
  corrected_start_date date not null
) on commit drop;

insert into tmp_fixed_cycle_monday_corrections (
  roster_id,
  employee_buk_employee_id,
  original_start_date,
  corrected_start_date
)
select
  wr.id,
  wr.employee_buk_employee_id,
  wr.start_date,
  (wr.start_date - (extract(isodow from wr.start_date)::integer - 1))::date
from public.hr_worker_rosters wr
join public.hr_shift_patterns hp on hp.id = wr.pattern_id
where hp.is_active
  and hp.working_days in (4, 5)
  and hp.resting_days in (3, 2)
  and wr.invalidated_at is null
  and (wr.end_date is null or wr.end_date >= (now() at time zone 'America/Santiago')::date)
  and (wr.invalidated_effective_date is null or wr.invalidated_effective_date > (now() at time zone 'America/Santiago')::date)
  and extract(isodow from wr.start_date) <> 1;

do $assert$
begin
  if exists (
    select 1
    from tmp_fixed_cycle_monday_corrections c
    join public.hr_worker_rosters other
      on other.employee_buk_employee_id = c.employee_buk_employee_id
     and other.start_date = c.corrected_start_date
     and other.id <> c.roster_id
  ) then
    raise exception 'No se puede normalizar inicio lunes: existe otra pauta con el mismo trabajador y fecha corregida';
  end if;

  if exists (
    select 1
    from tmp_fixed_cycle_monday_corrections c
    join public.hr_worker_rosters other
      on other.employee_buk_employee_id = c.employee_buk_employee_id
     and other.id <> c.roster_id
     and other.invalidated_at is null
     and (other.end_date is null or other.end_date >= (now() at time zone 'America/Santiago')::date)
     and (other.invalidated_effective_date is null or other.invalidated_effective_date > (now() at time zone 'America/Santiago')::date)
     and daterange(other.start_date, coalesce(other.end_date, 'infinity'::date), '[]')
         && daterange(c.corrected_start_date, coalesce((select end_date from public.hr_worker_rosters where id = c.roster_id), 'infinity'::date), '[]')
  ) then
    raise exception 'No se puede normalizar inicio lunes: la fecha corregida solapa otra pauta vigente';
  end if;
end;
$assert$;

update public.hr_worker_rosters wr
set start_date = c.corrected_start_date,
    notes = concat_ws(
      E'\n',
      nullif(wr.notes, ''),
      format(
        'Normalización operativa 4X3/5X2: inicio ajustado de %s a lunes %s; solicitud 2026-09-23; migración 20260923140000.',
        c.original_start_date,
        c.corrected_start_date
      )
    )
from tmp_fixed_cycle_monday_corrections c
where wr.id = c.roster_id;

do $assert$
begin
  if exists (
    select 1
    from public.hr_worker_rosters wr
    join public.hr_shift_patterns hp on hp.id = wr.pattern_id
    where hp.is_active
      and hp.working_days in (4, 5)
      and hp.resting_days in (3, 2)
      and wr.invalidated_at is null
      and (wr.end_date is null or wr.end_date >= (now() at time zone 'America/Santiago')::date)
      and (wr.invalidated_effective_date is null or wr.invalidated_effective_date > (now() at time zone 'America/Santiago')::date)
      and extract(isodow from wr.start_date) <> 1
  ) then
    raise exception 'Persisten asignaciones vigentes 4X3/5X2 con inicio distinto de lunes';
  end if;
end;
$assert$;

create or replace function public.validate_hr_worker_roster_fixed_cycle_start()
returns trigger
language plpgsql
as $function$
declare
  pattern_row record;
begin
  select hp.working_days, hp.resting_days, hp.is_active
    into pattern_row
  from public.hr_shift_patterns hp
  where hp.id = new.pattern_id;

  if coalesce(pattern_row.is_active, false)
     and pattern_row.working_days in (4, 5)
     and pattern_row.resting_days in (3, 2)
     and extract(isodow from new.start_date) <> 1 then
    raise exception 'Las jornadas 4X3 y 5X2 deben iniciar el lunes; fecha recibida: %', new.start_date
      using errcode = '23514',
            hint = 'Ajuste start_date al lunes de la semana correspondiente antes de guardar la pauta.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_hr_worker_rosters_fixed_cycle_start on public.hr_worker_rosters;
create trigger trg_hr_worker_rosters_fixed_cycle_start
before insert or update of pattern_id, start_date on public.hr_worker_rosters
for each row execute function public.validate_hr_worker_roster_fixed_cycle_start();

notify pgrst, 'reload schema';

commit;
