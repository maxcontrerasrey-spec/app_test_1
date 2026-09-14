-- Libro3.xlsx: distribución de responsables contractuales.
-- Actualiza las áreas existentes y crea únicamente las 3 áreas BUK faltantes.
-- Metadatos copiados desde el área productiva más similar, según instrucción de negocio:
-- NEWREST ANTUCOYA SIMSA <- NEWREST ANTUCOYA.
-- SERVICIOS ESPECIALES INTERURBANO <- JM SERVICIOS ESPECIALES.
-- SCHWAGER DCH <- ARAMARK - DCH.
-- La distribución de responsables proviene del Excel; INDIRECTOS ZONA III queda en Luciano Fischer.
begin;

create temp table tmp_contract_distribution (
  buk_area_name text primary key,
  manager_name text not null,
  contract_admin_name text not null
) on commit drop;

insert into tmp_contract_distribution (buk_area_name, manager_name, contract_admin_name) values
  ('CODELCO DRT', 'Andres Barraza Mera', 'Carlos Villagran Suarez'),
  ('FLUOR - EL ABRA', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('ACCIONA - TRANQUE TALABRE', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('CODELCO - DSAL', 'Cristian Jimenez Jimenez', 'Marcelo Villarroel Gutierrez'),
  ('NEWREST CENTINELA', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('SERVICIO CODELCO DMH', 'Andres Barraza Mera', 'Jose Orellana Paez'),
  ('CODELCO ANDINA 2022', 'Cristian Jimenez Jimenez', 'Isac Arratia Carcamo'),
  ('ARAMARK ESCONDIDA', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('INDIRECTOS ZONA II', 'Andres Barraza Mera', 'Andres Barraza Mera'),
  ('SIERRA GORDA - OPERACION', 'Luciano Fischer Ballerini', 'Mario Pizarro Fernandez'),
  ('ARAMARK SIERRA GORDA INTERNO', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('BERLIAM DRT CHANCADO', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('CODELCO VP CHUQUI', 'Andres Barraza Mera', 'Ricardo Mella Osorio'),
  ('BERLIAM - DRT CHANCADO SECUNDARIO', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('SIGMA - DAND', 'Cristian Jimenez Jimenez', 'Isac Arratia Carcamo'),
  ('ARAMARK SIERRA GORDA', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('ARAMARK - EL ABRA', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('ARAMARK - DCH', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('ARAMARK CAMPAMENTO ZONA NORTE', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('MANTENCION JM', 'Rodrigo Galdames', 'Rodrigo Galdames'),
  ('VALPARAISO', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez'),
  ('RECURSOS HUMANOS JM', 'Andres Madrid Maureira', 'Andres Madrid Maureira'),
  ('INDIRECTOS ZONA III', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('SERCOING - DRT', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('ALTO NORTE', 'Luciano Fischer Ballerini', 'Javier Plaza Cerda'),
  ('AURA - DAND', 'Cristian Jimenez Jimenez', 'Isac Arratia Carcamo'),
  ('NEWREST ZALDIVAR', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('FLIX VALPARAISO', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez'),
  ('JM SERVICIOS ESPECIALES', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez'),
  ('ARAMARK MINISTRO HALES INTERNO', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('FLUOR-SALFA CENTINELA', 'Luciano Fischer Ballerini', 'Jose Irribarren Sepulveda'),
  ('FLIX LA SERENA', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez'),
  ('ADMINISTRACION', 'Guillermo Zañartu Apara', 'Maria Jesus Lagos Minardi'),
  ('ARAMARK SPENCE', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('ARAMARK CAMPAMENTO ZONA NORTE INTERNO', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('MANTENCION CALAMA JM', 'Rodrigo Galdames', 'Rodrigo Galdames'),
  ('NOATUM - EL ABRA', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('FINNING MARC DAND', 'Cristian Jimenez Jimenez', 'Isac Arratia Carcamo'),
  ('ABASTECIMIENTO JM', 'Raul Lopez Guerra', 'Jose Luis Sierra'),
  ('NEWREST ANTUCOYA', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('ENAEX ANDINA', 'Cristian Jimenez Jimenez', 'Isac Arratia Carcamo'),
  ('FACTURACION Y COBRANZA JM', 'Raul Lopez Guerra', 'Raul Lopez Guerra'),
  ('CONTABILIDAD JM', 'Raul Lopez Guerra', 'Raul Lopez Guerra'),
  ('SERVICIOS ESPECIALES INTERURBANO', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez'),
  ('ADMINISTRACION CALAMA', 'Andres Barraza Mera', 'Andres Barraza Mera'),
  ('BERLIAM ZALDIVAR', 'Luciano Fischer Ballerini', 'Javier Plaza Cerda'),
  ('DMC CENTINELA', 'Luciano Fischer Ballerini', 'Jose Irribarren Sepulveda'),
  ('SCHWAGER DCH', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('COMERCIAL JM', 'Alan Brain Biggemann', 'Alan Brain Biggemann'),
  ('NEWREST ANTUCOYA SIMSA', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('BODEGA JM', 'Raul Lopez Guerra', 'Jose Luis Sierra'),
  ('FLIX SANTIAGO', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez'),
  ('TEPSAC DAND', 'Cristian Jimenez Jimenez', 'Isac Arratia Carcamo'),
  ('FLIX VIÑA DEL MAR', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez'),
  ('MANTENCION CALAMA CNN', 'Rodrigo Galdames', 'Rodrigo Galdames'),
  ('SOTRASER-DMH', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('RECURSOS HUMANOS ZONA NORTE', 'Andres Madrid Maureira', 'Francisco Cordero Villagra'),
  ('NEWREST CONCENTRADORA CENTINELA', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('MANTENCION ANTOFAGASTA JM', 'Rodrigo Galdames', 'Rodrigo Galdames'),
  ('NEWREST - FRANKE', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('RECURSOS HUMANOS PLAZA VIEJA', 'Andres Madrid Maureira', 'Solange Troncoso Gajardo'),
  ('SK SALARES NORTE', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('FLIX QUINTERO', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez'),
  ('Newrest - Caserones', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('INDIRECTOS ZONA I CONSORCIO ANDINO', 'Cristian Jimenez Jimenez', 'Cristian Jimenez Jimenez'),
  ('ARAMARK DSAL', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('PREVENCION DE RIESGOS JM', 'Manuel Parra Soto', 'Manuel Parra Soto'),
  ('CONTROL FLOTA JM', 'Diego Lazcano', 'Juan Carlos Navea Vasquez'),
  ('INDIRECTO ZONA II CNN', 'Andres Barraza Mera', 'Andres Barraza Mera'),
  ('EMIN - MEL', 'Luciano Fischer Ballerini', 'Javier Plaza Cerda'),
  ('ICV DMH CHUQUI', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('NEWREST MUELLE', 'Luciano Fischer Ballerini', 'Javier Plaza Cerda'),
  ('ARAMARK GABY', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('CODELCO VP ANDINA 2022', 'Cristian Jimenez Jimenez', 'Cristian Jimenez Jimenez'),
  ('XTREME MINING PMCHS', 'Andres Barraza Mera', 'Ricardo Mella Osorio'),
  ('NEWREST - QB PUERTO TECK', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('MANTENCION IQUIQUE JM', 'Rodrigo Galdames', 'Rodrigo Galdames'),
  ('R y Q PMCHS', 'Andres Barraza Mera', 'Ricardo Mella Osorio'),
  ('COMTECSA - PMCHS', 'Andres Barraza Mera', 'Ricardo Mella Osorio'),
  ('FLIX SAN ANTONIO', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez'),
  ('ARAMARK GABY INTERNO', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('NEWREST COLLAHUASI', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('SODEXO SQM', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('ARAMARK - PRET', 'Andres Barraza Mera', 'Angel Guerra Basso'),
  ('NEWREST DAND', 'Cristian Jimenez Jimenez', 'Cristian Jimenez Jimenez'),
  ('ARAMARK QUEBRADA BLANCA', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini'),
  ('BODEGA ZONA NORTE', 'Raul Lopez Guerra', 'Jose Luis Sierra'),
  ('MANTENCION CALAMA', 'Rodrigo Galdames', 'Rodrigo Galdames'),
  ('TESORERIA JM', 'Raul Lopez Guerra', 'Raul Lopez Guerra'),
  ('ANDINA', 'Cristian Jimenez Jimenez', 'Cristian Jimenez Jimenez'),
  ('INDIRECTOS ZONA I', 'Cristian Jimenez Jimenez', 'Cristian Jimenez Jimenez'),
  ('ZONA II CONTRATISTAS', 'Andres Barraza Mera', 'Andres Barraza Mera'),
  ('RECURSOS HUMANOS CNN', 'Andres Madrid Maureira', 'Francisco Cordero Villagra'),
  ('FINNING ARMADO DAND', 'Cristian Jimenez Jimenez', 'Cristian Jimenez Jimenez'),
  ('TECNOLOGIA E INFORMACIÓN JM', 'Raul Lopez Guerra', 'Maria Jesus Lagos Minardi');

create temp table tmp_contract_distribution_sources (
  target_area_name text primary key,
  source_area_name text not null
) on commit drop;

insert into tmp_contract_distribution_sources (target_area_name, source_area_name) values
  ('NEWREST ANTUCOYA SIMSA', 'NEWREST ANTUCOYA'),
  ('SERVICIOS ESPECIALES INTERURBANO', 'JM SERVICIOS ESPECIALES'),
  ('SCHWAGER DCH', 'ARAMARK - DCH');

do $$
declare
  missing_source_count integer;
begin
  select count(*) into missing_source_count
  from tmp_contract_distribution_sources src
  left join public.buk_contract_mappings bcm
    on bcm.buk_area_name_normalized = public.normalize_buk_area_name(src.source_area_name)
  where bcm.id is null;

  if missing_source_count > 0 then
    raise exception 'Falta el área fuente para % registros derivados', missing_source_count;
  end if;
end;
$$;

update public.buk_contract_mappings bcm
set manager_name = src.manager_name,
    contract_admin_name = src.contract_admin_name,
    updated_at = timezone('utc', now())
from tmp_contract_distribution src
where bcm.buk_area_name_normalized = public.normalize_buk_area_name(src.buk_area_name)
  and (bcm.manager_name is distinct from src.manager_name
       or bcm.contract_admin_name is distinct from src.contract_admin_name);

insert into public.buk_contract_mappings (
  contract_number, contract_name, cost_unit, cost_unit_name, cost_center_code,
  buk_area_name, cost_center_name, manager_name, contract_admin_name,
  is_one_to_one, is_operational, contract_id
)
select
  source.contract_number, source.contract_name, source.cost_unit, source.cost_unit_name,
  source.cost_center_code, target.buk_area_name, source.cost_center_name,
  target.manager_name, target.contract_admin_name, source.is_one_to_one,
  source.is_operational, source.contract_id
from tmp_contract_distribution_sources map
join public.buk_contract_mappings source
  on source.buk_area_name_normalized = public.normalize_buk_area_name(map.source_area_name)
join tmp_contract_distribution target
  on target.buk_area_name = map.target_area_name
where not exists (
  select 1 from public.buk_contract_mappings existing
  where existing.buk_area_name_normalized = public.normalize_buk_area_name(target.buk_area_name)
);

do $$
declare
  missing_target_count integer;
begin
  select count(*) into missing_target_count
  from tmp_contract_distribution src
  left join public.buk_contract_mappings bcm
    on bcm.buk_area_name_normalized = public.normalize_buk_area_name(src.buk_area_name)
  where bcm.id is null;

  if missing_target_count > 0 then
    raise exception 'La distribución dejó % áreas sin mapeo autoritativo', missing_target_count;
  end if;
end;
$$;

commit;
