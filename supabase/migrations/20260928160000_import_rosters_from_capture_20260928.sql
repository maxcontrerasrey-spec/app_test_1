-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; preserve assignments and correct through a later audited migration.
-- Source: /Users/maximilianocontrerasrey/Desktop/Captura de pantalla 2026-09-28 a las 3.29.29 p. m..png
-- Scope: 28 rows reconciled by RUT and exact active BUK area before insertion.
-- Excluded after live reconciliation:
--   row 14 / 13.727.780-6: no active BUK record;
--   row 15 / 8.846.165-7: active BUK record belongs to ARAMARK MINISTRO HALES INTERNO,
--   not to the ACCIONA - TRANQUE TALABRE area shown in the source capture.

begin;

create temporary table tmp_roster_capture_20260928 (
  row_number integer primary key,
  document_number text not null,
  source_name text not null,
  expected_job_title text not null,
  expected_area text not null,
  expected_administrator text not null,
  cycle_label text not null,
  start_date date not null
) on commit drop;

insert into tmp_roster_capture_20260928 (
  row_number,
  document_number,
  source_name,
  expected_job_title,
  expected_area,
  expected_administrator,
  cycle_label,
  start_date
)
values
  (1, '17.654.389-2', 'Katerin Marcela Perez Ortega', 'EXPERTO EN PREVENCIÓN DE RIESGOS', 'INDIRECTOS ZONA II (0000000159:0001)', 'Andres Barraza Mera', '5X2', date '2026-08-31'),
  (2, '17.974.529-1', 'Cristopher Williams Quispe Charcas', 'PREVENCIONISTA DE RIESGOS', 'ZONA II CONTRATISTAS (0000000168:0001)', 'Andres Barraza Mera', '5X2', date '2026-08-31'),
  (3, '12.582.307-6', 'Liliana Paola Garcia Cordero', 'PREVENCIONISTA DE RIESGOS', 'INDIRECTOS ZONA II (0000000159:0001)', 'Andres Barraza Mera', '5X2', date '2026-08-31'),
  (4, '18.535.886-0', 'María Jesús Henríquez Mella', 'PREVENCIONISTA DE RIESGOS', 'INDIRECTO ZONA II CNN (0000000159:0004)', 'Andres Barraza Mera', '5X2', date '2026-08-31'),
  (5, '15.982.173-0', 'Sigifredo Mauricio Zuleta Lobos', 'INGENIERO AMBIENTAL', 'CODELCO VP CHUQUI (6170400007:0001)', 'Ricardo Mella Osorio', '4X3', date '2026-08-31'),
  (6, '9.738.745-1', 'Moises Antonio Sánchez Becerra', 'CONDUCTOR DE TAXI BUS', 'COMTECSA - PMCHS (9687083002:0001)', 'Ricardo Mella Osorio', '14X14', date '2026-09-02'),
  (7, '17.654.922-k', 'Marcela Andrea Quispe Santos', 'ADMINISTRATIVO RRHH', 'ADMINISTRACION CALAMA (0000000101:0001)', 'Andres Barraza Mera', '5X2', date '2026-09-07'),
  (8, '17.017.208-6', 'Madeline Marcela Martínez Cruz', 'ADMINISTRATIVO RRHH', 'RECURSOS HUMANOS ZONA NORTE (0000000109:0001)', 'Francisco Cordero Villagra', '5X2', date '2026-09-07'),
  (9, '20.133.662-7', 'Polett Estefania Sanchez Garcia', 'ASISTENTE DE RRHH', 'RECURSOS HUMANOS CNN (0000000109:0004)', 'Francisco Cordero Villagra', '5X2', date '2026-09-07'),
  (10, '15.710.910-3', 'Katterine Veronica Del Rosario Tapia Del Castillo', 'ENCARGADO DE RRHH', 'RECURSOS HUMANOS ZONA NORTE (0000000109:0001)', 'Francisco Cordero Villagra', '5X2', date '2026-09-07'),
  (11, '19.538.465-7', 'Carla Soledad Rojas Miranda', 'EXPEDITOR', 'RECURSOS HUMANOS ZONA NORTE (0000000109:0001)', 'Francisco Cordero Villagra', '5X2', date '2026-09-07'),
  (12, '17.094.238-8', 'Roberto Ismael Flores Vega', 'PREVENCIONISTA DE RIESGOS', 'INDIRECTOS ZONA II (0000000159:0001)', 'Andres Barraza Mera', '10X10', date '2026-09-15'),
  (13, '17.981.527-3', 'Ricardo Agustín Torres Herrera', 'PREVENCIONISTA DE RIESGOS', 'ACCIONA - TRANQUE TALABRE (5906986003:0001)', 'Angel Guerra Basso', '7X7', date '2026-09-15'),
  (14, '13.727.780-6', 'Roman Aaron Garces Isla', 'CONDUCTOR DE BUS', 'COMTECSA - PMCHS (9687083002:0001)', 'Ricardo Mella Osorio', '14X14', date '2026-09-16'),
  (15, '8.846.165-7', 'Manuel Rogelio Briceño Soumastres', 'CONDUCTOR DE TAXI BUS', 'ACCIONA - TRANQUE TALABRE (5906986003:0001)', 'Angel Guerra Basso', '10X5+5', date '2026-09-22'),
  (16, '17.037.158-5', 'Wilson Andres Mery Zuleta', 'CONDUCTOR DE TAXI BUS', 'ACCIONA - TRANQUE TALABRE (5906986003:0001)', 'Angel Guerra Basso', '10X5+5', date '2026-09-22'),
  (17, '16.259.353-6', 'Alvaro Humberto Butron Bernal', 'PREVENCIONISTA DE RIESGOS', 'ACCIONA - TRANQUE TALABRE (5906986003:0001)', 'Angel Guerra Basso', '7X7', date '2026-09-22'),
  (18, '14.091.608-0', 'Herny Rafael Letelier Peña', 'CONDUCTOR DE BUS', 'ARAMARK GABY INTERNO (7611769627:0001)', 'Angel Guerra Basso', '10X10', date '2026-09-23'),
  (19, '16.475.120-1', 'Dondero Ricardo Jorge Campos Morales', 'PREVENCIONISTA DE RIESGOS', 'CODELCO VP CHUQUI (6170400007:0001)', 'Ricardo Mella Osorio', '14X14', date '2026-09-23'),
  (20, '9.136.134-5', 'Fernando Gilberto Riquelme Naranjo', 'CONDUCTOR DE FURGON', 'ADMINISTRACION CALAMA (0000000101:0001)', 'Andres Barraza Mera', '10X5+5', date '2026-09-29'),
  (21, '19.205.595-4', 'Eduardo Enrique Pizarro Estay', 'COORDINADOR DE SERVICIOS', 'INDIRECTOS ZONA II (0000000159:0001)', 'Andres Barraza Mera', '8X6', date '2026-09-29'),
  (22, '16.333.448-8', 'Eduardo Andrés Ahumada Cataldo', 'MECANICO', 'CODELCO DRT (6170400010:0004)', 'Carlos Villagran Suarez', '7X7', date '2026-09-30'),
  (23, '19.469.615-9', 'Constanza Sinara Salinas Caneo', 'SUPERVISOR DE OPERACIONES', 'CODELCO DRT (6170400010:0004)', 'Carlos Villagran Suarez', '7X7', date '2026-09-30'),
  (24, '10.934.540-7', 'Jose Luis Umaña Contreras', 'CONDUCTOR DE BUS', 'ARAMARK GABY INTERNO (7611769627:0001)', 'Angel Guerra Basso', '10X10', date '2026-10-03'),
  (25, '9.140.699-3', 'Eduardo Patricio Araya Adonis', 'COORDINADOR DE SERVICIOS', 'ADMINISTRACION CALAMA (0000000101:0001)', 'Andres Barraza Mera', '8X6', date '2026-10-06'),
  (26, '23.856.370-4', 'Wilfredo Nestor Llamoca Barraza', 'CONDUCTOR DE FURGON', 'ADMINISTRACION CALAMA (0000000101:0001)', 'Andres Barraza Mera', '10X5+5', date '2026-10-09'),
  (27, '14.357.916-6', 'Alejandro Andres Cortez Henriquez', 'CONDUCTOR DE BUS', 'FLUOR - EL ABRA (8555590001:0001)', 'Angel Guerra Basso', '10X5+5', date '2026-10-12'),
  (28, '17.419.344-4', 'Miguel Alejandro Riquelme Cabezas', 'CONDUCTOR DE BUS', 'ARAMARK - EL ABRA (7611769634:0001)', 'Angel Guerra Basso', '10X5+5', date '2026-10-15');

create temporary table tmp_roster_exclusions_20260928 (
  row_number integer primary key,
  reason text not null
) on commit drop;

insert into tmp_roster_exclusions_20260928 (row_number, reason)
values
  (14, 'Sin ficha BUK activa al 2026-09-28.'),
  (15, 'La ficha BUK activa pertenece a ARAMARK MINISTRO HALES INTERNO (7611769628:0001), no al contrato ACCIONA informado.');

create temporary table tmp_roster_resolved_20260928 on commit drop as
select
  source.row_number,
  source.document_number as source_document_number,
  source.source_name,
  source.expected_job_title,
  source.expected_area,
  source.expected_administrator,
  source.cycle_label,
  source.start_date,
  employee.buk_employee_id,
  coalesce(employee.document_type, 'rut') as document_type,
  employee.document_number,
  employee.full_name,
  coalesce(
    nullif(trim(employee.job_title), ''),
    nullif(trim(employee.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
    nullif(trim(employee.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
    nullif(trim(employee.raw_payload ->> 'job_title'), '')
  ) as job_title,
  nullif(trim(employee.contract_code), '') as contract_code,
  nullif(trim(employee.area_name), '') as area_name,
  pattern.id as pattern_id,
  pattern.name as pattern_name
from tmp_roster_capture_20260928 source
left join tmp_roster_exclusions_20260928 exclusion on exclusion.row_number = source.row_number
join public.employees employee
  on upper(regexp_replace(coalesce(employee.document_number, ''), '[^0-9K]', '', 'g'))
     = upper(regexp_replace(source.document_number, '[^0-9K]', '', 'g'))
 and trim(employee.area_name) = trim(source.expected_area)
 and employee.is_active = true
join public.hr_shift_patterns pattern
  on (
    pattern.code = case source.cycle_label
      when '5X2' then '5x2_ordinaria'
      when '4X3' then '4x3_ordinaria'
      when '14X14' then '14x14'
      when '10X10' then '10x10'
      when '7X7' then '7x7'
      when '10X5+5' then '10x5_5'
      else '__no_canonical_pattern__'
    end
    or (
      source.cycle_label = '8X6'
      and upper(regexp_replace(pattern.name, '[^0-9X+]', '', 'g')) = '8X6'
    )
  )
 and pattern.is_active = true
where coalesce(lower(trim(employee.raw_payload ->> 'private_role')), 'false')
  not in ('true', '1', 'yes', 'si', 'sí')
  and exclusion.row_number is null;

do $assert$
declare
  mismatch_detail text;
begin
  if (select count(*) from tmp_roster_capture_20260928) <> 28 then
    raise exception 'La captura de Jornadas debe contener exactamente 28 filas';
  end if;

  select string_agg(
    format(
      '#%s %s (%s): coincidencias BUK/pauta=%s; fichas activas=%s',
      source.row_number,
      source.source_name,
      source.document_number,
      coalesce(matches.match_count, 0),
      coalesce((
        select string_agg(
          format('%s | %s | %s', employee.buk_employee_id, employee.area_name, employee.job_title),
          ' / ' order by employee.buk_employee_id
        )
        from public.employees employee
        where employee.is_active = true
          and upper(regexp_replace(coalesce(employee.document_number, ''), '[^0-9K]', '', 'g'))
              = upper(regexp_replace(source.document_number, '[^0-9K]', '', 'g'))
      ), 'sin ficha activa')
    ),
    '; ' order by source.row_number
  )
  into mismatch_detail
  from tmp_roster_capture_20260928 source
  left join tmp_roster_exclusions_20260928 exclusion on exclusion.row_number = source.row_number
  left join (
    select resolved.row_number, count(*) as match_count
    from tmp_roster_resolved_20260928 resolved
    group by resolved.row_number
  ) matches on matches.row_number = source.row_number
  where exclusion.row_number is null
    and coalesce(matches.match_count, 0) <> 1;

  if mismatch_detail is not null then
    raise exception 'No fue posible conciliar toda la captura: %', mismatch_detail;
  end if;

  select string_agg(
    format('#%s %s: cargo BUK "%s" versus captura "%s"', resolved.row_number, resolved.source_name, resolved.job_title, resolved.expected_job_title),
    '; ' order by resolved.row_number
  )
  into mismatch_detail
  from tmp_roster_resolved_20260928 resolved
  where lower(trim(coalesce(resolved.job_title, ''))) <> lower(trim(resolved.expected_job_title));

  if mismatch_detail is not null then
    raise exception 'Existen cargos BUK distintos a la captura: %', mismatch_detail;
  end if;

  select string_agg(
    format('#%s %s: pauta existente %s', resolved.row_number, resolved.source_name, existing_pattern.name),
    '; ' order by resolved.row_number
  )
  into mismatch_detail
  from tmp_roster_resolved_20260928 resolved
  join public.hr_worker_rosters existing
    on existing.employee_buk_employee_id = resolved.buk_employee_id
   and existing.start_date = resolved.start_date
  join public.hr_shift_patterns existing_pattern on existing_pattern.id = existing.pattern_id
  where existing.pattern_id <> resolved.pattern_id
     or trim(coalesce(existing.area_name, '')) <> trim(resolved.area_name);

  if mismatch_detail is not null then
    raise exception 'Existe una asignación incompatible en la misma fecha: %', mismatch_detail;
  end if;

  select string_agg(
    format('#%s %s: pauta futura desde %s', resolved.row_number, resolved.source_name, existing.start_date),
    '; ' order by resolved.row_number
  )
  into mismatch_detail
  from tmp_roster_resolved_20260928 resolved
  join public.hr_worker_rosters existing
    on existing.employee_buk_employee_id = resolved.buk_employee_id
   and existing.start_date > resolved.start_date
   and existing.invalidated_at is null
   and coalesce(existing.end_date, 'infinity'::date) >= resolved.start_date;

  if mismatch_detail is not null then
    raise exception 'La carga se superpone con asignaciones futuras: %', mismatch_detail;
  end if;
end;
$assert$;

update public.hr_worker_rosters existing
set end_date = resolved.start_date - 1,
    updated_at = timezone('utc', now())
from tmp_roster_resolved_20260928 resolved
where existing.employee_buk_employee_id = resolved.buk_employee_id
  and existing.start_date < resolved.start_date
  and existing.invalidated_at is null
  and coalesce(existing.end_date, 'infinity'::date) >= resolved.start_date;

update public.hr_worker_rosters existing
set invalidated_at = null,
    invalidated_effective_date = null,
    invalidated_reason = null,
    invalidated_sync_run_id = null,
    updated_at = timezone('utc', now())
from tmp_roster_resolved_20260928 resolved
where existing.employee_buk_employee_id = resolved.buk_employee_id
  and existing.start_date = resolved.start_date
  and existing.pattern_id = resolved.pattern_id
  and trim(coalesce(existing.area_name, '')) = trim(resolved.area_name)
  and existing.invalidated_at is not null;

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
  resolved.buk_employee_id,
  resolved.document_type,
  resolved.document_number,
  resolved.full_name,
  resolved.job_title,
  resolved.contract_code,
  resolved.area_name,
  resolved.pattern_id,
  resolved.start_date,
  null,
  'Carga de Jornadas desde captura recibida el 2026-09-28; conciliada por RUT, ficha BUK activa, área exacta, cargo y pauta.',
  null
from tmp_roster_resolved_20260928 resolved
where not exists (
  select 1
  from public.hr_worker_rosters existing
  where existing.employee_buk_employee_id = resolved.buk_employee_id
    and existing.start_date = resolved.start_date
);

do $verify$
declare
  verified_count integer;
  mismatch_detail text;
begin
  select count(*)
  into verified_count
  from tmp_roster_resolved_20260928 resolved
  join public.hr_worker_rosters roster
    on roster.employee_buk_employee_id = resolved.buk_employee_id
   and roster.start_date = resolved.start_date
   and roster.pattern_id = resolved.pattern_id
   and trim(coalesce(roster.area_name, '')) = trim(resolved.area_name)
   and roster.invalidated_at is null
   and roster.end_date is null;

  if verified_count <> 26 then
    select string_agg(
      format('#%s %s (%s)', resolved.row_number, resolved.source_name, resolved.source_document_number),
      '; ' order by resolved.row_number
    )
    into mismatch_detail
    from tmp_roster_resolved_20260928 resolved
    where not exists (
      select 1
      from public.hr_worker_rosters roster
      where roster.employee_buk_employee_id = resolved.buk_employee_id
        and roster.start_date = resolved.start_date
        and roster.pattern_id = resolved.pattern_id
        and trim(coalesce(roster.area_name, '')) = trim(resolved.area_name)
        and roster.invalidated_at is null
        and roster.end_date is null
    );

    raise exception 'La verificación final esperaba 26 asignaciones conciliadas y encontró %; faltantes: %', verified_count, mismatch_detail;
  end if;
end;
$verify$;

commit;
