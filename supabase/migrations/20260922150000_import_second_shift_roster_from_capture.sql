-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; preserve assignments and correct through a later migration.
-- Source: second roster capture received on 2026-09-22. Four rows were intentionally
-- excluded because BUK could not provide a current unambiguous contract/identity.

begin;

create temporary table tmp_second_roster_capture (
  document_number text not null,
  expected_area text not null,
  cycle_label text not null,
  start_date date not null
) on commit drop;

insert into tmp_second_roster_capture (document_number, expected_area, cycle_label, start_date)
values
  ('13.575.811-6', 'ARAMARK CAMPAMENTO ZONA NORTE', '5X5', date '2026-09-06'),
  ('15.085.041-k', 'ARAMARK CAMPAMENTO ZONA NORTE', '5X5', date '2026-09-06'),
  ('11.660.518-k', 'ARAMARK CAMPAMENTO ZONA NORTE', '5X5', date '2026-09-01'),
  ('13.333.369-k', 'ARAMARK CAMPAMENTO ZONA NORTE', '10X10', date '2026-09-05'),
  ('10.059.400-5', 'ARAMARK ESCONDIDA', '5X5', date '2026-09-06'),
  ('8.382.288-0', 'ARAMARK SIERRA GORDA', '10X10', date '2026-09-01'),
  ('11.517.448-7', 'ARAMARK SIERRA GORDA', '5X5', date '2026-09-06'),
  ('11.667.950-7', 'NEWREST - QB PUERTO TECK', '5X2', date '2026-09-06'),
  ('19.977.654-1', 'NEWREST - QB PUERTO TECK', '5X2', date '2026-09-06'),
  ('12.477.322-9', 'NEWREST - QB PUERTO TECK', '10X10', date '2026-09-01'),
  ('15.419.964-0', 'NEWREST - QB PUERTO TECK', '10X10', date '2026-09-09'),
  ('10.441.844-9', 'NEWREST CENTINELA', '10X10', date '2026-09-02'),
  ('9.506.063-3', 'NEWREST CENTINELA', '10X10', date '2026-09-01'),
  ('13.385.772-9', 'NEWREST CENTINELA', '10X10', date '2026-09-05'),
  ('7.548.988-9', 'NEWREST COLLAHUASI', '5X5', date '2026-09-01'),
  ('8.869.184-9', 'NEWREST ZALDIVAR', '10X10', date '2026-09-05'),
  ('12.817.199-1', 'SODEXO SQM', '10X10', date '2026-09-01'),
  ('11.959.900-8', 'SODEXO SQM', '10X10', date '2026-09-01'),
  ('14.513.787-k', 'SODEXO SQM', '10X10', date '2026-09-01'),
  ('19.736.293-6', 'MANTENCION IQUIQUE JM', '6X1', date '2026-09-01');

insert into public.hr_shift_patterns (
  code, name, description, working_days, resting_days, color_hex, is_active
)
values (
  '5x5', '5X5', 'Pauta de 5 días trabajados y 5 días de descanso', 5, 5, '#E0ECFF', true
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    working_days = excluded.working_days,
    resting_days = excluded.resting_days,
    color_hex = excluded.color_hex,
    is_active = true,
    updated_at = timezone('utc', now());

do $assert$
declare
  matched_count integer;
begin
  select count(*)
    into matched_count
  from tmp_second_roster_capture s
  join public.employees_active_current e
    on upper(regexp_replace(coalesce(e.document_number, ''), '[^0-9K]', '', 'g'))
       = upper(regexp_replace(s.document_number, '[^0-9K]', '', 'g'))
   and lower(trim(coalesce(e.area_name, ''))) like lower(trim(s.expected_area)) || '%'
  join public.hr_shift_patterns p
    on p.code = case upper(s.cycle_label)
      when '5X5' then '5x5'
      when '10X10' then '10x10'
      when '5X2' then '5x2_ordinaria'
      when '6X1' then '6x1'
    end
   and p.is_active;

  if matched_count <> (select count(*) from tmp_second_roster_capture) then
    raise exception 'La segunda nómina no pudo validarse completamente: % de % filas coinciden con BUK/pauta', matched_count, (select count(*) from tmp_second_roster_capture);
  end if;

  if exists (
    select 1
    from tmp_second_roster_capture s
    join public.employees_active_current e
      on upper(regexp_replace(coalesce(e.document_number, ''), '[^0-9K]', '', 'g'))
         = upper(regexp_replace(s.document_number, '[^0-9K]', '', 'g'))
    join public.hr_worker_rosters wr
      on wr.employee_buk_employee_id = e.buk_employee_id
     and wr.start_date = s.start_date
  ) then
    raise exception 'La segunda nómina contiene una asignación existente para la misma persona y fecha';
  end if;
end;
$assert$;

-- Close only an open previous assignment for the same worker, preserving history
-- and preventing an overlapping active range when a new cycle begins.
update public.hr_worker_rosters wr
set end_date = s.start_date - 1,
    updated_at = timezone('utc', now())
from tmp_second_roster_capture s
join public.employees_active_current e
  on upper(regexp_replace(coalesce(e.document_number, ''), '[^0-9K]', '', 'g'))
     = upper(regexp_replace(s.document_number, '[^0-9K]', '', 'g'))
 and lower(trim(coalesce(e.area_name, ''))) like lower(trim(s.expected_area)) || '%'
where wr.employee_buk_employee_id = e.buk_employee_id
  and wr.start_date < s.start_date
  and (wr.end_date is null or wr.end_date >= s.start_date);

insert into public.hr_worker_rosters (
  employee_buk_employee_id,
  employee_document_type,
  employee_document_number,
  employee_full_name,
  employee_job_title,
  contract_code,
  area_name,
  pattern_id,
  start_date,
  end_date,
  notes,
  assigned_by
)
select
  e.buk_employee_id,
  coalesce(e.document_type, 'rut'),
  e.document_number,
  e.full_name,
  coalesce(nullif(trim(e.job_title), ''), nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''), nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''), nullif(trim(e.raw_payload ->> 'job_title'), '')),
  nullif(trim(e.contract_code), ''),
  nullif(trim(e.area_name), ''),
  p.id,
  s.start_date,
  null,
  'Carga de segunda nómina de turnos recibida el 2026-09-22.',
  null
from tmp_second_roster_capture s
join public.employees_active_current e
  on upper(regexp_replace(coalesce(e.document_number, ''), '[^0-9K]', '', 'g'))
     = upper(regexp_replace(s.document_number, '[^0-9K]', '', 'g'))
 and lower(trim(coalesce(e.area_name, ''))) like lower(trim(s.expected_area)) || '%'
join public.hr_shift_patterns p
  on p.code = case upper(s.cycle_label)
    when '5X5' then '5x5'
    when '10X10' then '10x10'
    when '5X2' then '5x2_ordinaria'
    when '6X1' then '6x1'
  end
 and p.is_active;

commit;
