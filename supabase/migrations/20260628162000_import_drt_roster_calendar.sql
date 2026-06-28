-- Source audit snapshot: data/seed/hr_roster_drt_20260628.json
-- Reconciliation snapshot: data/seed/hr_roster_drt_20260628.audit.json

create temp table tmp_drt_roster_source (
  document_number text not null,
  source_job_title text not null,
  cycle_label text not null,
  start_date date not null
) on commit drop;

insert into tmp_drt_roster_source (
  document_number,
  source_job_title,
  cycle_label,
  start_date
)
values
  ('10.087.336-2', 'CONDUCTOR DE BUS', '7X7', '2026-06-03'::date),
  ('11.721.561-k', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('12.703.451-6', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('10.624.004-3', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('18.350.826-1', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('12.817.132-0', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('12.348.347-2', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('11.672.667-k', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('14.447.473-2', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('10.470.708-4', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('15.056.288-0', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('9.049.676-k', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('13.535.834-7', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('10.235.039-1', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('7.388.986-3', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('18.050.900-3', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('15.544.419-3', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('16.042.779-5', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('7.237.575-0', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('9.853.410-5', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('10.504.389-9', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('11.966.811-5', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('12.726.257-8', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('14.467.357-3', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('8.780.535-2', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('11.160.977-2', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('21.613.258-0', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('10.038.213-k', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('13.744.703-7', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('10.926.645-0', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('17.711.977-6', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('14.558.338-1', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('13.647.815-k', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('11.469.798-2', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-03'::date),
  ('17.514.323-8', 'MECANICO ESPECIALISTA', '7X7', '2026-06-03'::date),
  ('16.770.897-8', 'PREVENCIONISTA DE RIESGOS', '7X7', '2026-06-03'::date),
  ('17.246.002-k', 'SUPERVISOR DE TERRENO', '7X7', '2026-06-03'::date),
  ('13.418.208-3', 'SUPERVISOR DE TERRENO', '7X7', '2026-06-03'::date),
  ('9.870.090-0', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('13.626.760-4', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('14.423.071-k', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('14.549.804-k', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('11.325.768-7', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('14.526.701-3', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('10.415.136-1', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('14.288.552-2', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('13.562.821-2', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('8.918.457-6', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('10.484.482-0', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('13.329.284-5', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('14.296.600-k', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('15.769.480-4', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('17.017.328-7', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('12.348.547-5', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('11.720.738-2', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('24.419.516-4', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('22.273.698-6', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('14.238.283-0', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('10.200.520-1', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('13.185.166-9', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('11.944.709-7', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('22.272.221-7', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('16.881.454-2', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('18.016.965-2', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('8.054.582-7', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('11.748.040-2', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('12.895.168-7', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('11.724.567-5', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('10.531.635-6', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('11.383.199-5', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-19'::date),
  ('10.676.789-0', 'CONDUCTOR DE FURGON', '10X5+5', '2026-06-19'::date),
  ('11.333.813-k', 'CONDUCTOR DE FURGON', '10X5+5', '2026-06-19'::date),
  ('12.219.295-4', 'CONDUCTOR DE FURGON', '10X5+5', '2026-06-19'::date),
  ('13.415.289-3', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-19'::date),
  ('9.738.566-1', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-19'::date),
  ('8.432.487-6', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-19'::date),
  ('18.485.781-2', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-19'::date),
  ('14.111.537-5', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-19'::date),
  ('12.213.620-5', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-19'::date),
  ('15.028.408-2', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-19'::date),
  ('17.988.755-k', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-19'::date),
  ('10.387.928-0', 'CONDUCTOR DE BUS', '4X3', '2026-06-01'::date),
  ('17.003.986-6', 'JEFE DE OPERACIONES', '7X7', '2026-06-05'::date),
  ('12.850.518-0', 'CONDUCTOR DE BUS', '7X7', '2026-06-10'::date),
  ('13.751.443-5', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('22.674.602-1', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('8.995.927-6', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('12.581.606-1', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('12.944.082-1', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('17.974.790-1', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('10.676.614-2', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('15.084.323-5', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('15.981.752-0', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('13.216.795-8', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('12.838.747-1', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('15.817.325-5', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('12.347.746-4', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('15.259.095-4', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('17.898.004-1', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('11.505.880-0', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('14.255.261-2', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('11.570.449-4', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('7.807.995-9', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('15.499.419-k', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('11.120.272-9', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('14.706.925-1', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('12.945.127-0', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('13.513.106-7', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('24.541.639-3', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('15.768.433-7', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('11.899.247-4', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('14.472.935-8', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('23.813.072-7', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('11.383.746-2', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('10.242.793-9', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date),
  ('17.092.964-0', 'MECANICO', '7X7', '2026-06-10'::date),
  ('13.362.310-8', 'SUPERVISOR DE TERRENO', '7X7', '2026-06-10'::date),
  ('13.431.424-9', 'SUPERVISOR DE TERRENO', '7X7', '2026-06-10'::date),
  ('15.950.851-k', 'JEFE DE OPERACIONES', '7X7', '2026-06-10'::date),
  ('14.559.833-8', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('19.778.442-3', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('12.952.814-1', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('8.619.231-4', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('14.236.608-8', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('10.704.969-k', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('12.876.938-2', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('12.718.254-k', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('12.107.685-3', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('8.907.872-5', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('14.622.667-1', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('15.013.992-9', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('14.194.122-4', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('14.561.027-3', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('9.390.333-1', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('10.309.536-0', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('10.149.520-5', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('11.333.057-0', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('14.267.426-2', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('13.231.061-0', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('14.417.119-5', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('8.977.294-k', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('10.227.565-9', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('13.357.074-8', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('15.015.736-6', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('12.439.767-7', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('10.117.619-3', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('25.445.393-5', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('14.333.830-4', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('10.983.384-3', 'CONDUCTOR DE BUS', '10X5+5', '2026-06-09'::date),
  ('13.418.065-k', 'CONDUCTOR DE FURGON', '10X5+5', '2026-06-09'::date),
  ('17.530.349-9', 'CONDUCTOR DE FURGON', '10X5+5', '2026-06-09'::date),
  ('11.721.396-k', 'CONDUCTOR DE FURGON', '10X5+5', '2026-06-09'::date),
  ('10.988.879-6', 'CONDUCTOR DE FURGON', '10X5+5', '2026-06-09'::date),
  ('23.565.833-k', 'CONDUCTOR DE MINI BUS', '10X5+5', '2026-06-09'::date),
  ('22.417.168-4', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-09'::date),
  ('10.847.661-3', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-09'::date),
  ('8.879.476-1', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-09'::date),
  ('17.646.540-9', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-09'::date),
  ('12.671.176-k', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-09'::date),
  ('12.701.076-5', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-09'::date),
  ('14.432.464-1', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-09'::date),
  ('10.016.179-6', 'CONDUCTOR DE TAXI BUS', '10X5+5', '2026-06-09'::date),
  ('6.632.607-1', 'CONDUCTOR DE BUS', '4X3', '2026-06-01'::date),
  ('15.969.544-1', 'CONDUCTOR DE BUS', '4X3', '2026-06-01'::date),
  ('7.119.357-8', 'CONDUCTOR DE BUS', '4X3', '2026-06-01'::date),
  ('11.819.266-4', 'CONDUCTOR DE BUS', '4X3', '2026-06-01'::date),
  ('13.529.964-2', 'CONDUCTOR DE BUS', '4X3', '2026-06-01'::date),
  ('9.458.785-9', 'CONDUCTOR DE BUS', '4X3', '2026-06-01'::date),
  ('11.505.383-3', 'CONDUCTOR DE BUS', '4X3', '2026-06-01'::date),
  ('7.148.100-k', 'CONDUCTOR DE TAXI BUS', '4X3', '2026-06-01'::date),
  ('13.364.290-0', 'INSTRUCTOR DE SERVICIOS', '4X3', '2026-06-01'::date),
  ('15.982.173-0', 'JEFE DE PREVENCIÓN DE RIESGOS', '4X3', '2026-06-01'::date),
  ('13.569.356-1', 'SUB GERENTE DE CONTRATOS', '4X3', '2026-06-01'::date),
  ('9.937.379-2', 'CONDUCTOR DE TAXI BUS', '5X2', '2026-06-01'::date),
  ('18.400.266-3', 'ADMINISTRATIVO RRHH', '5X2', '2026-06-01'::date),
  ('11.399.397-9', 'JEFE DE RRHH', '5X2', '2026-06-01'::date),
  ('10.421.699-4', 'CONDUCTOR DE TAXI BUS', '7X7', '2026-06-10'::date)
;

create temp table tmp_drt_roster_cycle_map (
  cycle_label text primary key,
  pattern_code text not null
) on commit drop;

insert into tmp_drt_roster_cycle_map (cycle_label, pattern_code)
values
  ('10X5+5', '10x5_5'),
  ('4X3', '4x3_ordinaria'),
  ('5X2', '5x2_ordinaria'),
  ('7X7', '7x7')
;

insert into public.hr_shift_patterns (
  code,
  name,
  working_days,
  resting_days,
  description,
  color_hex,
  is_active,
  created_by
)
values
  ('10x5_5', '10X5+5', 10, 10, 'Pauta DRT 10X5+5', '#E0ECFF', true, null),
  ('4x3_ordinaria', '4X3 Ordinaria', 4, 3, 'Pauta ordinaria 4X3', '#D8E4FF', true, null),
  ('5x2_ordinaria', '5X2', 5, 2, 'Pauta ordinaria 5X2', '#DCEFE6', true, null),
  ('7x7', 'Excepcional 7X7', 7, 7, 'Pauta excepcional 7X7', '#FEE5D0', true, null)
on conflict (code)
do update
set
  name = excluded.name,
  working_days = excluded.working_days,
  resting_days = excluded.resting_days,
  description = excluded.description,
  color_hex = excluded.color_hex,
  is_active = true,
  updated_at = timezone('utc', now());

create temp table tmp_drt_roster_matched on commit drop as
select
  e.buk_employee_id,
  e.full_name,
  e.document_number,
  coalesce(nullif(trim(e.job_title), ''), nullif(trim(s.source_job_title), '')) as job_title,
  e.contract_code,
  e.area_name,
  p.id as pattern_id,
  s.start_date
from tmp_drt_roster_source s
join public.employees_active_current e
  on regexp_replace(lower(coalesce(e.document_number, '')), '[^0-9k]+', '', 'g')
    = regexp_replace(lower(s.document_number), '[^0-9k]+', '', 'g')
join tmp_drt_roster_cycle_map cm
  on cm.cycle_label = s.cycle_label
join public.hr_shift_patterns p
  on p.code = cm.pattern_code
where e.area_name ilike '%CODELCO DRT%';

do $$
declare
  v_source_count integer;
  v_matched_count integer;
  v_missing_count integer;
  v_extra_count integer;
begin
  select count(*) into v_source_count from tmp_drt_roster_source;
  select count(*) into v_matched_count from tmp_drt_roster_matched;
  select count(*) into v_missing_count
  from tmp_drt_roster_source s
  where not exists (
    select 1
    from tmp_drt_roster_matched m
    where regexp_replace(lower(coalesce(m.document_number, '')), '[^0-9k]+', '', 'g')
      = regexp_replace(lower(s.document_number), '[^0-9k]+', '', 'g')
  );
  select count(*) into v_extra_count
  from public.employees_active_current e
  where e.area_name ilike '%CODELCO DRT%'
    and not exists (
      select 1
      from tmp_drt_roster_source s
      where regexp_replace(lower(s.document_number), '[^0-9k]+', '', 'g')
        = regexp_replace(lower(coalesce(e.document_number, '')), '[^0-9k]+', '', 'g')
    );

  if v_matched_count = 0 then
    raise exception 'La carga DRT no encontró trabajadores activos en CODELCO DRT';
  end if;

  raise notice 'Carga DRT jornadas: source=% matched=% missing=% extra_active=%',
    v_source_count,
    v_matched_count,
    v_missing_count,
    v_extra_count;
end $$;

update public.hr_worker_rosters wr
set
  end_date = m.start_date - 1,
  updated_at = timezone('utc', now())
from tmp_drt_roster_matched m
where wr.employee_buk_employee_id = m.buk_employee_id
  and wr.start_date < m.start_date
  and coalesce(wr.end_date, 'infinity'::date) >= m.start_date;

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
  m.buk_employee_id,
  'rut',
  m.document_number,
  m.full_name,
  m.job_title,
  m.contract_code,
  m.area_name,
  m.pattern_id,
  m.start_date,
  null,
  null,
  null
from tmp_drt_roster_matched m
on conflict (employee_buk_employee_id, start_date)
do update
set
  employee_document_type = excluded.employee_document_type,
  employee_document_number = excluded.employee_document_number,
  employee_full_name = excluded.employee_full_name,
  employee_job_title = excluded.employee_job_title,
  contract_code = excluded.contract_code,
  area_name = excluded.area_name,
  pattern_id = excluded.pattern_id,
  end_date = excluded.end_date,
  notes = excluded.notes,
  assigned_by = excluded.assigned_by,
  updated_at = timezone('utc', now());
