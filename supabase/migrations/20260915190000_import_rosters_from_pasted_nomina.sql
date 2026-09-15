-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; conservar asignaciones y corregir mediante migracion posterior.
-- Fuente: nomina pegada recibida el 2026-09-15; solo se cargan identidades BUK vigentes
-- y areas cuyo nombre comienza con el contrato informado.
begin;

with source_rows (document_number, expected_area, cycle_label, start_date) as (
values
    ('12.107.685-3', 'ACCIONA - TRANQUE TALABRE', '10X5+5', date '2026-09-04'),
    ('12.952.814-1', 'ACCIONA - TRANQUE TALABRE', '10X5+5', date '2026-09-04'),
    ('20.399.599-7', 'ACCIONA - TRANQUE TALABRE', '8X6', date '2026-09-08'),
    ('17.214.273-7', 'ACCIONA - TRANQUE TALABRE', '8X6', date '2026-09-15'),
    ('19.131.564-2', 'ACCIONA - TRANQUE TALABRE', '10X5+5', date '2026-09-14'),
    ('13.916.506-3', 'ACCIONA - TRANQUE TALABRE', '10X5+5', date '2026-09-04'),
    ('12.363.162-5', 'ACCIONA - TRANQUE TALABRE', '10X5+5', date '2026-09-14'),
    ('12.531.219-5', 'ACCIONA - TRANQUE TALABRE', '10X5+5', date '2026-09-14'),
    ('17.017.328-7', 'ACCIONA - TRANQUE TALABRE', '10X5+5', date '2026-09-04'),
    ('13.149.154-9', 'ACCIONA - TRANQUE TALABRE', '10X5+5', date '2026-09-04'),
    ('9.419.230-7', 'ACCIONA - TRANQUE TALABRE', '10X5+5', date '2026-09-04'),
    ('11.684.437-0', 'ACCIONA - TRANQUE TALABRE', '10X5+5', date '2026-09-14'),
    ('17.778.746-9', 'ACCIONA - TRANQUE TALABRE', '10X5+5', date '2026-09-14'),
    ('11.210.336-8', 'ACCIONA - TRANQUE TALABRE', '10X5+5', date '2026-09-14'),
    ('8.796.675-5', 'ACCIONA - TRANQUE TALABRE', '10X5+5', date '2026-09-14'),
    ('10.670.705-7', 'ACCIONA - TRANQUE TALABRE', '10X5+5', date '2026-09-04'),
    ('11.478.221-1', 'ARAMARK - DCH', '10X5+5', date '2026-09-12'),
    ('12.445.976-1', 'ARAMARK - DCH', '10X5+5', date '2026-09-22'),
    ('16.711.152-1', 'ARAMARK - DCH', '10X5+5', date '2026-09-12'),
    ('15.928.729-7', 'ARAMARK - DCH', '10X5+5', date '2026-09-22'),
    ('17.036.100-8', 'ARAMARK - DCH', '10X5+5', date '2026-09-22'),
    ('9.361.762-2', 'ARAMARK - DCH', '10X5+5', date '2026-09-22'),
    ('14.425.075-3', 'ARAMARK - DCH', '10X5+5', date '2026-09-12'),
    ('11.795.791-8', 'ARAMARK - DCH', '10X5+5', date '2026-09-12'),
    ('14.118.043-6', 'ARAMARK - DCH', '10X5+5', date '2026-09-22'),
    ('12.996.086-8', 'ARAMARK - DCH', '10X5+5', date '2026-09-12'),
    ('11.895.711-3', 'ARAMARK - DCH', '10X5+5', date '2026-09-12'),
    ('14.368.241-2', 'ARAMARK - DCH', '10X5+5', date '2026-09-22'),
    ('10.249.265-k', 'ARAMARK - EL ABRA', '10X5+5', date '2026-09-15'),
    ('10.244.913-4', 'ARAMARK - EL ABRA', '10X5+5', date '2026-09-15'),
    ('11.869.962-9', 'ARAMARK - EL ABRA', '10X5+5', date '2026-09-15'),
    ('11.825.938-6', 'ARAMARK - EL ABRA', '10X5+5', date '2026-09-05'),
    ('11.311.274-3', 'ARAMARK - EL ABRA', '10X5+5', date '2026-09-05'),
    ('10.939.450-5', 'ARAMARK - EL ABRA', '10X5+5', date '2026-09-05'),
    ('9.609.093-5', 'ARAMARK - EL ABRA', '10X5+5', date '2026-09-15'),
    ('10.229.137-9', 'ARAMARK - EL ABRA', '10X5+5', date '2026-09-05'),
    ('10.087.800-3', 'ARAMARK - PRET', '14X14', date '2026-09-09'),
    ('12.286.947-4', 'ARAMARK - PRET', '14X14', date '2026-09-23'),
    ('10.040.744-2', 'ARAMARK CAMPAMENTO ZONA NORTE INTERNO', '14X14', date '2026-09-10'),
    ('14.347.933-1', 'ARAMARK CAMPAMENTO ZONA NORTE INTERNO', '14X14', date '2026-09-10'),
    ('10.281.427-4', 'ARAMARK CAMPAMENTO ZONA NORTE INTERNO', '14X14', date '2026-09-24'),
    ('8.842.437-9', 'ARAMARK CAMPAMENTO ZONA NORTE INTERNO', '14X14', date '2026-09-24'),
    ('12.556.745-2', 'ARAMARK CAMPAMENTO ZONA NORTE INTERNO', '14X14', date '2026-09-10'),
    ('10.836.121-2', 'ARAMARK CAMPAMENTO ZONA NORTE INTERNO', '14X14', date '2026-09-24'),
    ('15.237.484-4', 'ARAMARK GABY INTERNO', '10X10', date '2026-09-13'),
    ('9.273.028-k', 'ARAMARK GABY INTERNO', '10X10', date '2026-09-13'),
    ('11.728.384-4', 'ARAMARK GABY INTERNO', '10X10', date '2026-09-03'),
    ('8.824.577-6', 'ARAMARK GABY INTERNO', '10X10', date '2026-09-03'),
    ('9.887.780-0', 'ARAMARK MINISTRO HALES INTERNO', '10X5+5', date '2026-09-12'),
    ('13.620.256-1', 'ARAMARK MINISTRO HALES INTERNO', '10X5+5', date '2026-09-12'),
    ('12.582.321-1', 'ARAMARK MINISTRO HALES INTERNO', '10X5+5', date '2026-09-02'),
    ('14.588.104-8', 'ARAMARK SIERRA GORDA INTERNO', '10X10', date '2026-09-20'),
    ('10.210.099-9', 'ARAMARK SIERRA GORDA INTERNO', '10X10', date '2026-09-15'),
    ('9.178.608-7', 'ARAMARK SIERRA GORDA INTERNO', '10X10', date '2026-09-05'),
    ('11.930.680-9', 'BERLIAM - DRT CHANCADO SECUNDARIO', '4X3', date '2026-09-07'),
    ('12.702.825-7', 'BERLIAM - DRT CHANCADO SECUNDARIO', '10X5+5', date '2026-09-20'),
    ('11.819.667-8', 'BERLIAM - DRT CHANCADO SECUNDARIO', '10X5+5', date '2026-09-20'),
    ('10.277.434-5', 'BERLIAM - DRT CHANCADO SECUNDARIO', '4X3', date '2026-09-07'),
    ('10.988.719-6', 'BERLIAM - DRT CHANCADO SECUNDARIO', '10X5+5', date '2026-09-10'),
    ('13.173.301-1', 'BERLIAM - DRT CHANCADO SECUNDARIO', '4X3', date '2026-09-07'),
    ('9.172.313-1', 'BERLIAM - DRT CHANCADO SECUNDARIO', '10X5+5', date '2026-09-10'),
    ('15.049.599-7', 'BERLIAM - DRT CHANCADO SECUNDARIO', '10X5+5', date '2026-09-20'),
    ('9.922.453-3', 'BERLIAM DRT CHANCADO', '4X3', date '2026-09-07'),
    ('14.437.680-3', 'BERLIAM DRT CHANCADO', '10X5+5', date '2026-09-20'),
    ('7.979.576-3', 'BERLIAM DRT CHANCADO', '4X3', date '2026-09-07'),
    ('15.104.915-k', 'BERLIAM DRT CHANCADO', '10X5+5', date '2026-09-10'),
    ('13.073.104-k', 'BERLIAM DRT CHANCADO', '10X5+5', date '2026-09-20'),
    ('10.774.278-6', 'BERLIAM DRT CHANCADO', '10X5+5', date '2026-09-10'),
    ('10.759.321-7', 'BERLIAM DRT CHANCADO', '10X5+5', date '2026-09-20'),
    ('13.010.683-8', 'BERLIAM DRT CHANCADO', '4X3', date '2026-09-07'),
    ('22.512.550-3', 'BERLIAM DRT CHANCADO', '10X5+5', date '2026-09-10'),
    ('23.943.655-2', 'BERLIAM DRT CHANCADO', '4X3', date '2026-09-07'),
    ('25.997.331-7', 'BERLIAM DRT CHANCADO', '10X5+5', date '2026-09-20'),
    ('15.760.492-9', 'BERLIAM DRT CHANCADO', '10X5+5', date '2026-09-20'),
    ('14.184.034-7', 'BERLIAM DRT CHANCADO', '10X5+5', date '2026-09-10'),
    ('9.822.912-4', 'FLUOR - EL ABRA', '10X5+5', date '2026-09-11'),
    ('18.077.022-4', 'FLUOR - EL ABRA', '10X5+5', date '2026-09-22'),
    ('13.186.889-8', 'FLUOR - EL ABRA', '10X5+5', date '2026-09-12'),
    ('9.375.661-4', 'FLUOR - EL ABRA', '10X5+5', date '2026-09-22'),
    ('8.090.162-3', 'FLUOR - EL ABRA', '10X5+5', date '2026-09-12'),
    ('18.409.531-9', 'FLUOR - EL ABRA', '10X5+5', date '2026-09-12'),
    ('9.573.894-k', 'FLUOR - EL ABRA', '10X5+5', date '2026-09-22'),
    ('20.089.359-k', 'FLUOR - EL ABRA', '10X5+5', date '2026-09-12'),
    ('15.761.349-9', 'FLUOR - EL ABRA', '10X5+5', date '2026-09-12'),
    ('14.036.195-k', 'NOATUM - EL ABRA', '10X5+5', date '2026-09-21'),
    ('12.133.445-3', 'NOATUM - EL ABRA', '10X5+5', date '2026-09-11'),
    ('14.581.123-6', 'NOATUM - EL ABRA', '10X5+5', date '2026-09-21'),
    ('15.629.546-9', 'SERCOING - DRT', '10X5+5', date '2026-09-12'),
    ('11.929.961-6', 'SERCOING - DRT', '10X5+5', date '2026-09-22'),
    ('24.954.346-2', 'SOTRASER-DMH', '10X5+5', date '2026-09-18'),
    ('14.647.384-9', 'SOTRASER-DMH', '10X5+5', date '2026-09-08'),
    ('13.175.263-6', 'SOTRASER-DMH', '10X5+5', date '2026-09-08'),
    ('15.016.806-6', 'SOTRASER-DMH', '10X5+5', date '2026-09-18')
), resolved as (
  select
    s.*,
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_type, 'rut') as document_type,
    e.document_number as current_document_number,
    coalesce(nullif(trim(e.job_title), ''), nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''), nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''), nullif(trim(e.raw_payload ->> 'job_title'), '')) as job_title,
    nullif(trim(e.contract_code), '') as contract_code,
    nullif(trim(e.area_name), '') as area_name,
    p.id as pattern_id
  from source_rows s
  join public.employees_active_current e
    on upper(regexp_replace(coalesce(e.document_number, ''), '[^0-9K]', '', 'g'))
       = upper(regexp_replace(s.document_number, '[^0-9K]', '', 'g'))
   and lower(trim(coalesce(e.area_name, ''))) like lower(trim(s.expected_area)) || '%'
  join public.hr_shift_patterns p
    on upper(regexp_replace(p.name, '[^0-9X+]', '', 'g'))
       = upper(regexp_replace(s.cycle_label, '[^0-9X+]', '', 'g'))
   and p.is_active
)
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
  r.buk_employee_id,
  r.document_type,
  r.current_document_number,
  r.full_name,
  r.job_title,
  r.contract_code,
  r.area_name,
  r.pattern_id,
  r.start_date,
  null,
  'Importacion de turnos desde nomina recibida el 2026-09-15.',
  null
from resolved r
where not exists (
  select 1
  from public.hr_worker_rosters existing
  where existing.employee_buk_employee_id = r.buk_employee_id
    and existing.start_date = r.start_date
);

commit;
