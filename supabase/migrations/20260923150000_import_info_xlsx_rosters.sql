-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; preserve imported assignments and correct through a later audited migration.
-- Source: /Users/maximilianocontrerasrey/Desktop/info.xlsx received on 2026-09-23.
-- Reconciliation: 45 source rows; 44 unambiguous active BUK matches loaded.
-- Excluded: 10.528.715-1 with two active BUK fichas at reconciliation time.

begin;

create temporary table tmp_info_xlsx_roster_source (
  document_number text not null,
  source_name text not null,
  expected_area text not null,
  cycle_label text not null,
  start_date date not null
) on commit drop;

insert into tmp_info_xlsx_roster_source (document_number, source_name, expected_area, cycle_label, start_date)
values
  ('10.864.096-0', 'Mario Roberto Pizarro Fernández', 'SIERRA GORDA - OPERACION (7608159002:0001)', '4X3', date '2026-09-07'),
  ('13.296.245-6', 'Tania Alejandra Guzman Munita', 'RECURSOS HUMANOS JM (0000000109:0001)', '5X2', date '2026-09-07'),
  ('18.853.192-k', 'Vannia Arlette But Pacheco', 'RECURSOS HUMANOS ZONA NORTE (0000000109:0001)', '5X2', date '2026-09-07'),
  ('15.969.698-7', 'Viviana Natali Contreras Araya', 'RECURSOS HUMANOS ZONA NORTE (0000000109:0001)', '5X2', date '2026-09-07'),
  ('18.973.354-2', 'Pamela Andrea Herrera Contreras', 'CONTABILIDAD JM (0000000106:0001)', '5X2', date '2026-09-07'),
  ('12.621.958-k', 'Carlos Alberto Bastias Burgos', 'CONTABILIDAD JM (0000000106:0001)', '5X2', date '2026-09-07'),
  ('16.706.352-7', 'Giannina Lissette Cuadro Bustos', 'CONTABILIDAD JM (0000000106:0001)', '5X2', date '2026-09-07'),
  ('19.176.738-1', 'Thania Andrea Villagran Latoja', 'INDIRECTOS ZONA I CONSORCIO ANDINO (0000000158:0005)', '5X2', date '2026-09-07'),
  ('9.717.231-5', 'Hector Ivan Perez Navarro', 'RECURSOS HUMANOS JM (0000000109:0001)', '5X2', date '2026-09-07'),
  ('17.778.298-k', 'Gloria Francisca Diaz Ascencio', 'RECURSOS HUMANOS JM (0000000109:0001)', '5X2', date '2026-09-07'),
  ('18.973.655-k', 'Eugenia Marisel Moya Contreras', 'TESORERIA JM (0000000108:0001)', '5X2', date '2026-09-07'),
  ('20.320.808-1', 'Miguel Angel Rivera Muñoz', 'CONTABILIDAD JM (0000000106:0001)', '5X2', date '2026-09-07'),
  ('19.268.016-6', 'Fernanda Rosario Alfaro Saldívar', 'ABASTECIMIENTO JM (0000000102:0001)', '5X2', date '2026-09-07'),
  ('19.449.158-1', 'Javiera Alejandra Godoy Donoso', 'ABASTECIMIENTO JM (0000000102:0001)', '5X2', date '2026-09-07'),
  ('19.788.391-k', 'Martin Alfonso Contreras Herrera', 'ABASTECIMIENTO JM (0000000102:0001)', '5X2', date '2026-09-07'),
  ('21.945.988-2', 'Macarena Constanza Ruiz Lazcano', 'RECURSOS HUMANOS JM (0000000109:0001)', '5X2', date '2026-09-07'),
  ('10.821.203-9', 'Leonardo Andres Mechasqui Montenegro', 'ADMINISTRACION CALAMA (0000000101:0001)', '5X2', date '2026-09-07'),
  ('15.061.698-0', 'Angel Patricio Reinoso Reinoso', 'RECURSOS HUMANOS JM (0000000109:0001)', '5X2', date '2026-09-07'),
  ('19.083.632-0', 'Sebastián Enrique Vega Rivera', 'RECURSOS HUMANOS JM (0000000109:0001)', '5X2', date '2026-09-07'),
  ('26.554.229-8', 'Dariana Carolina Sánchez Borrero', 'RECURSOS HUMANOS JM (0000000109:0001)', '5X2', date '2026-09-07'),
  ('17.994.581-9', 'Braulio Sebastian Canelo Gonzalez', 'ADMINISTRACION CALAMA (0000000101:0001)', '5X2', date '2026-09-07'),
  ('9.029.526-8', 'Carlos Alberto Molina Guarachi', 'INDIRECTOS ZONA II (0000000159:0001)', '5X2', date '2026-09-07'),
  ('17.547.180-4', 'Diego Nicolás Sandoval Gómez', 'COMERCIAL JM (0000000104:0001)', '5X2', date '2026-09-07'),
  ('18.840.314-k', 'Valentina Macarena Arce Quevedo', 'COMERCIAL JM (0000000104:0001)', '5X2', date '2026-09-07'),
  ('10.528.715-1', 'Daniel Rodrigo Carvajal Bucarey', 'RECURSOS HUMANOS JM (0000000109:0001)', '5X2', date '2026-09-07'),
  ('9.249.626-0', 'Gilberto Leonardo Urtubia Carvajal', 'RECURSOS HUMANOS JM (0000000109:0001)', '5X2', date '2026-09-07'),
  ('15.325.100-2', 'Guillermo Andres Milla Miranda', 'RECURSOS HUMANOS ZONA NORTE (0000000109:0001)', '5X2', date '2026-09-07'),
  ('21.536.950-1', 'Diego David Moreno Navarro', 'MANTENCION JM (9957547002:0001)', '5X2', date '2026-09-07'),
  ('15.602.476-7', 'Eduardo Andrés Caro Piérola', 'MANTENCION CALAMA JM (9957547001:0001)', '4X3', date '2026-09-07'),
  ('26.453.548-4', 'Andres Felipe Bedoya Sanchez', 'BODEGA JM (0000000103:0001)', '5X2', date '2026-09-07'),
  ('19.131.153-1', 'Carolina Paz Lira Garrido', 'FACTURACION Y COBRANZA JM (0000000105:0001)', '5X2', date '2026-09-07'),
  ('16.550.260-4', 'Cristian Andres Donoso Guajardo', 'ABASTECIMIENTO JM (0000000102:0001)', '5X2', date '2026-09-07'),
  ('17.952.824-k', 'Rodrigo Gonzalo Puentes Araya', 'CONTABILIDAD JM (0000000106:0001)', '5X2', date '2026-09-07'),
  ('11.877.197-4', 'Eduardo Orlando Mariqueo Herrera', 'VALPARAISO (7850277002:0001)', '5X2', date '2026-09-07'),
  ('18.346.826-k', 'Alejandra Andrea Aravena Narbona', 'CONTABILIDAD JM (0000000106:0001)', '5X2', date '2026-09-07'),
  ('14.279.238-9', 'Jorge Fernando Parra Jimenez', 'INDIRECTOS ZONA I (0000000158:0001)', '5X2', date '2026-09-07'),
  ('17.164.580-8', 'Victor Angel Manuel Guerrero Gutierrez', 'VALPARAISO (7850277002:0001)', '5X2', date '2026-09-07'),
  ('15.061.896-7', 'Alexi Enrique Mura Ortiz', 'DMC CENTINELA (7672704001:0001)', '4X3', date '2026-09-07'),
  ('17.829.106-8', 'Oscar Jonnathan Concha Mirabal', 'INDIRECTOS ZONA II (0000000159:0001)', '5X2', date '2026-09-07'),
  ('17.655.635-8', 'Ivan Alejandro Cortés Lugo', 'INDIRECTO ZONA II CNN (0000000159:0004)', '5X2', date '2026-09-07'),
  ('14.109.067-4', 'Laura Cinthya Lopez Amaya', 'ADMINISTRACION CALAMA (0000000101:0001)', '5X2', date '2026-09-07'),
  ('20.088.596-1', 'Paola Belén Cisternas Jeria', 'INDIRECTOS ZONA I CONSORCIO ANDINO (0000000158:0005)', '5X2', date '2026-09-07'),
  ('10.376.112-3', 'Margarita Estelvina Corvalan Vergara', 'ADMINISTRACION (0000000101:0001)', '5X2', date '2026-09-07'),
  ('17.164.008-3', 'Cristopher Julianno Villarroel Aguilar', 'TECNOLOGIA E INFORMACIÓN JM (0000000112:0001)', '5X2', date '2026-09-07'),
  ('16.467.245-k', 'Andrés Giancarlo Barraza Mera', 'NEWREST CENTINELA (9665191008:0001)', '5X2', date '2026-09-07');

create temporary table tmp_info_xlsx_roster_resolved on commit drop as
select
  e.buk_employee_id,
  e.document_type,
  e.document_number,
  e.full_name,
  e.job_title,
  e.contract_code,
  e.area_name,
  s.cycle_label,
  s.start_date
from tmp_info_xlsx_roster_source s
join public.employees e
  on upper(regexp_replace(coalesce(e.document_number, ''), '[^0-9K]', '', 'g'))
     = upper(regexp_replace(s.document_number, '[^0-9K]', '', 'g'))
 and trim(e.area_name) = trim(s.expected_area)
 and e.is_active
where not exists (
  select 1
  from public.employees duplicate
  where duplicate.is_active
    and upper(regexp_replace(coalesce(duplicate.document_number, ''), '[^0-9K]', '', 'g'))
        = upper(regexp_replace(s.document_number, '[^0-9K]', '', 'g'))
    and duplicate.buk_employee_id <> e.buk_employee_id
);

do $assert$
declare
  source_count integer;
  resolved_count integer;
begin
  select count(*) into source_count from tmp_info_xlsx_roster_source;
  select count(*) into resolved_count from tmp_info_xlsx_roster_resolved;

  if source_count <> 45 or resolved_count <> 44 then
    raise exception 'Conciliación info.xlsx inesperada: source=%, resolved=%; carga abortada', source_count, resolved_count;
  end if;

  if exists (
    select 1
    from tmp_info_xlsx_roster_resolved incoming
    join public.hr_worker_rosters existing
      on existing.employee_buk_employee_id = incoming.buk_employee_id
     and existing.start_date = incoming.start_date
     and (existing.invalidated_at is null or existing.invalidated_effective_date is null or existing.invalidated_effective_date > incoming.start_date)
     and (existing.pattern_id <> (
       select pattern.id from public.hr_shift_patterns pattern
       where pattern.code = case incoming.cycle_label when '4X3' then '4x3_ordinaria' when '5X2' then '5x2_ordinaria' end
     ) or trim(existing.area_name) <> trim(incoming.area_name))
  ) then
    raise exception 'La carga tiene una pauta existente incompatible en la misma fecha';
  end if;

  if exists (
    select 1
    from tmp_info_xlsx_roster_resolved incoming
    join public.hr_worker_rosters existing
      on existing.employee_buk_employee_id = incoming.buk_employee_id
     and existing.invalidated_at is null
     and daterange(existing.start_date, coalesce(existing.end_date, 'infinity'::date), '[]')
         && daterange(incoming.start_date, 'infinity'::date, '[]')
     and existing.start_date <> incoming.start_date
  ) then
    raise exception 'La carga tiene solapamiento con una pauta vigente existente';
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
  incoming.buk_employee_id,
  coalesce(incoming.document_type, 'rut'),
  incoming.document_number,
  incoming.full_name,
  incoming.job_title,
  incoming.contract_code,
  incoming.area_name,
  pattern.id,
  incoming.start_date,
  null,
  'Carga masiva desde info.xlsx recibido el 2026-09-23; conciliado por RUT, ficha BUK activa y área exacta. Filas no homologadas excluidas por seguridad.',
  null
from tmp_info_xlsx_roster_resolved incoming
join public.hr_shift_patterns pattern
  on pattern.code = case incoming.cycle_label
    when '4X3' then '4x3_ordinaria'
    when '5X2' then '5x2_ordinaria'
  end
where not exists (
  select 1
  from public.hr_worker_rosters existing
  where existing.employee_buk_employee_id = incoming.buk_employee_id
    and existing.start_date = incoming.start_date
);

do $assert$
declare
  imported_count integer;
begin
  select count(*) into imported_count
  from public.hr_worker_rosters wr
  where wr.start_date = date '2026-09-07'
    and wr.notes like '%info.xlsx recibido el 2026-09-23%';

  if imported_count <> 44 then
    raise exception 'La verificación de carga info.xlsx esperaba 44 filas y encontró %', imported_count;
  end if;
end;
$assert$;

commit;
