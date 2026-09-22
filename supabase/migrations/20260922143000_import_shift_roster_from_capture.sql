-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; preserve assignments and correct through a later migration.
-- Source: roster capture received on 2026-09-22; identities are matched by RUT
-- against active BUK employees and area prefixes are checked before insertion.

begin;

create temporary table tmp_roster_capture (
  document_number text not null,
  expected_area text not null,
  cycle_label text not null,
  start_date date not null
) on commit drop;

insert into tmp_roster_capture (document_number, expected_area, cycle_label, start_date)
values
  ('20.654.308-6', 'ARAMARK CAMPAMENTO ZONA NORTE', '10X5', date '2026-09-07'),
  ('9.270.338-k', 'ARAMARK CAMPAMENTO ZONA NORTE', '10X5', date '2026-09-12'),
  ('26.067.393-9', 'ARAMARK CAMPAMENTO ZONA NORTE', '10X5', date '2026-09-09'),
  ('11.943.360-6', 'ARAMARK CAMPAMENTO ZONA NORTE', '10X5', date '2026-09-04'),
  ('11.854.981-3', 'ARAMARK ESCONDIDA', '10X5+5', date '2026-09-15'),
  ('10.981.544-6', 'ARAMARK ESCONDIDA', '5X2', date '2026-09-01'),
  ('26.919.032-9', 'ARAMARK ESCONDIDA', '10X5', date '2026-09-08'),
  ('12.607.419-0', 'ARAMARK ESCONDIDA', '10X5', date '2026-09-07'),
  ('27.441.708-0', 'ARAMARK ESCONDIDA', '10X5', date '2026-09-14'),
  ('12.170.492-7', 'ARAMARK ESCONDIDA', '10X5', date '2026-09-07'),
  ('10.272.710-k', 'ARAMARK ESCONDIDA', '10X5', date '2026-09-07'),
  ('11.908.664-7', 'ARAMARK ESCONDIDA', '10X5', date '2026-09-14'),
  ('15.058.590-2', 'ARAMARK ESCONDIDA', '10X5+5', date '2026-09-20'),
  ('16.465.998-4', 'ARAMARK ESCONDIDA', '10X5+5', date '2026-09-14'),
  ('21.791.491-4', 'ARAMARK ESCONDIDA', '10X5+5', date '2026-09-04'),
  ('12.836.409-9', 'ARAMARK GABY', '10X5+5', date '2026-09-12'),
  ('13.862.253-3', 'ARAMARK GABY', '10X5+5', date '2026-09-12'),
  ('13.213.579-7', 'ARAMARK SIERRA GORDA', '10X5', date '2026-09-09'),
  ('14.102.282-2', 'ARAMARK SPENCE', '10X10', date '2026-09-14'),
  ('14.102.887-1', 'NEWREST ANTUCOYA', '10X5', date '2026-09-03'),
  ('16.924.630-0', 'NEWREST ANTUCOYA', '10X5', date '2026-09-12'),
  ('10.300.633-3', 'NEWREST ANTUCOYA', '10X5', date '2026-09-17'),
  ('11.464.893-0', 'NEWREST CENTINELA', '10X5', date '2026-09-09'),
  ('10.783.186-k', 'NEWREST CENTINELA', '10X10', date '2026-09-04'),
  ('13.019.348-k', 'NEWREST CENTINELA', '10X5+5', date '2026-09-05'),
  ('9.506.063-3', 'NEWREST CENTINELA', '10X5+5', date '2026-08-31'),
  ('10.839.576-1', 'NEWREST CENTINELA', '10X10', date '2026-09-04'),
  ('13.156.464-3', 'NEWREST CENTINELA', '10X10', date '2026-09-14'),
  ('16.224.701-8', 'NEWREST CONCENTRADORA CENTINELA', '10X5', date '2026-09-09'),
  ('10.351.655-2', 'NEWREST ZALDIVAR', '10X5', date '2026-09-02'),
  ('14.426.110-0', 'NEWREST ZALDIVAR', '14X14', date '2026-08-24'),
  ('12.901.836-4', 'NEWREST ZALDIVAR', '14X14', date '2026-09-07'),
  ('17.124.237-1', 'NEWREST ZALDIVAR', '10X5', date '2026-09-07'),
  ('22.113.114-2', 'SODEXO SQM', '10X5', date '2026-09-04'),
  ('7.774.869-5', 'SODEXO SQM', '10X5', date '2026-09-04');

insert into public.hr_shift_patterns (
  code, name, description, working_days, resting_days, color_hex, is_active
)
values (
  '10x5', '10X5', 'Pauta de 10 días trabajados y 5 días de descanso', 10, 5, '#E0ECFF', true
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
  from tmp_roster_capture s
  join public.employees_active_current e
    on upper(regexp_replace(coalesce(e.document_number, ''), '[^0-9K]', '', 'g'))
       = upper(regexp_replace(s.document_number, '[^0-9K]', '', 'g'))
   and lower(trim(coalesce(e.area_name, ''))) like lower(trim(s.expected_area)) || '%'
  join public.hr_shift_patterns p
    on p.code = case upper(s.cycle_label)
      when '10X5' then '10x5'
      when '10X5+5' then '10x5_5'
      when '5X2' then '5x2_ordinaria'
      when '10X10' then '10x10'
      when '14X14' then '14x14'
    end
   and p.is_active;

  if matched_count <> (select count(*) from tmp_roster_capture) then
    raise exception 'La nómina no pudo validarse completamente: % de % filas coinciden con BUK/pauta', matched_count, (select count(*) from tmp_roster_capture);
  end if;
end;
$assert$;

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
  'Carga de turnos desde nómina recibida el 2026-09-22.',
  null
from tmp_roster_capture s
join public.employees_active_current e
  on upper(regexp_replace(coalesce(e.document_number, ''), '[^0-9K]', '', 'g'))
     = upper(regexp_replace(s.document_number, '[^0-9K]', '', 'g'))
 and lower(trim(coalesce(e.area_name, ''))) like lower(trim(s.expected_area)) || '%'
join public.hr_shift_patterns p
  on p.code = case upper(s.cycle_label)
    when '10X5' then '10x5'
    when '10X5+5' then '10x5_5'
    when '5X2' then '5x2_ordinaria'
    when '10X10' then '10x10'
    when '14X14' then '14x14'
  end
 and p.is_active
where not exists (
  select 1
  from public.hr_worker_rosters existing
  where existing.employee_buk_employee_id = e.buk_employee_id
    and existing.start_date = s.start_date
);

commit;
