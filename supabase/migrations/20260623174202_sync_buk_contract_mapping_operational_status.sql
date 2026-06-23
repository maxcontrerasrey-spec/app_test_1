create temp table tmp_buk_contract_mapping_operational_sync (
  contract_number text not null,
  contract_name text not null,
  cost_unit text not null,
  cost_unit_name text not null,
  cost_center_code text not null,
  buk_area_name text not null,
  cost_center_name text not null,
  manager_name text null,
  contract_admin_name text null,
  is_operational boolean not null
) on commit drop;

insert into tmp_buk_contract_mapping_operational_sync (
  contract_number,
  contract_name,
  cost_unit,
  cost_unit_name,
  cost_center_code,
  buk_area_name,
  cost_center_name,
  manager_name,
  contract_admin_name,
  is_operational
)
values
  ('0000000102:0001', 'ABASTECIMIENTO', '100', 'ADMINISTRACION', '10104', 'ABASTECIMIENTO JM', 'GERENCIA FINANZAS', 'Raul Lopez Guerra', 'Jose Luis Sierra', true),
  ('5906986003:0001', 'ACCIONA - TRANQUE TALABRE', '106', 'SERV CONTRATISTAS CALAMA', '10114', 'ACCIONA - TRANQUE TALABRE', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', true),
  ('7801797801:0001', 'ACCIONA OSSA PIZZAROTTI CAMBIO TURNO', '109', 'SERV ESPECIALES', '10113', 'ACCIONA OSSA PIZZAROTTI CAMBIO DE TURNO', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez', true),
  ('5906986002:0001', 'ACCIONA TALABRE', '115', 'SERV CAMBIO DE TURNO', '10116', 'ACCIONA TALABRE', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('0000000101:0001', 'ADMINISTRACION', '100', 'ADMINISTRACION', '10100', 'ADMINISTRACION', 'GERENCIA GENERAL', 'Guillermo Zañartu Apara', 'Juan Carlos Navea', true),
  ('0000000159:0001', 'INDIRECTOS ZONA II', '159', 'INDIRECTOS ZONA II', '10114', 'ADMINISTRACION CALAMA', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Maximiliano Contreras Rey', true),
  ('8832580001:0001', 'FUNDICION ALTONORTE', '125', 'SERV ALTONORTE', '10116', 'ALTO NORTE', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Javier Plaza Cerda', true),
  ('6170400001:0001', 'CODELCO ANDINA', '101', 'CODELCO ANDINA', '10113', 'ANDINA', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Cristian Jimenez Jimenez', false),
  ('7611769635:0001', 'ARAMARK - CAMPUS CODELCO', '107', 'SERV ARAMARK', '10114', 'ARAMARK - CAMPUS CODELCO', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', true),
  ('7611769636:0001', 'ARAMARK - DCH', '107', 'SERV ARAMARK', '10114', 'ARAMARK - DCH', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', true),
  ('7611769634:0001', 'ARAMARK - EL ABRA', '107', 'SERV ARAMARK', '10114', 'ARAMARK - EL ABRA', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', true),
  ('7611769633:0001', 'ARAMARK - PRET', '107', 'SERV ARAMARK', '10114', 'ARAMARK - PRET', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', true),
  ('7611769609:0001', 'ARAMARK CAMPAMENTO ZONA NORTE', '115', 'SERV CAMBIO DE TURNO', '10116', 'ARAMARK CAMPAMENTO ZONA NORTE', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('7611769626:0001', 'ARAMARK CAMPAMENTO ZONA NORTE INTERNO', '107', 'SERV ARAMARK', '10114', 'ARAMARK CAMPAMENTO ZONA NORTE INTERNO', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', true),
  ('7611769632:0001', 'ARAMARK DSAL', '115', 'SERV CAMBIO DE TURNO', '10116', 'ARAMARK DSAL', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('7611769614:0001', 'ARAMARK ESCONDIDA', '115', 'SERV CAMBIO DE TURNO', '10116', 'ARAMARK ESCONDIDA', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('7611769625:0001', 'ARAMARK GABY', '115', 'SERV CAMBIO DE TURNO', '10116', 'ARAMARK GABY', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('7611769627:0001', 'ARAMARK GABY INTERNO', '107', 'SERV ARAMARK', '10114', 'ARAMARK GABY INTERNO', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', true),
  ('7611769628:0001', 'ARAMARK MINISTRO HALES INTERNO', '107', 'SERV ARAMARK', '10114', 'ARAMARK MINISTRO HALES INTERNO', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', true),
  ('7611769612:0001', 'ARAMARK QUEBRADA BLANCA', '115', 'SERV CAMBIO DE TURNO', '10116', 'ARAMARK QUEBRADA BLANCA', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('7611769602:0001', 'ARAMARK SIERRA GORDA', '115', 'SERV CAMBIO DE TURNO', '10116', 'ARAMARK SIERRA GORDA', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('7611769630:0001', 'ARAMARK SIERRA GORDA INTERNO', '107', 'SERV ARAMARK', '10114', 'ARAMARK SIERRA GORDA INTERNO', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', true),
  ('7611769624:0001', 'ARAMARK SPENCE OPERACIONES', '115', 'SERV CAMBIO DE TURNO', '10114', 'ARAMARK SPENCE', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', false),
  ('761176912:0001', 'ARAMARK VP ANDINA', '109', 'SERV ESPECIALES', '10113', 'ARAMARK VP ANDINA', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez', true),
  ('7642593601:0001', 'ASIB - SIERRA GORDA', '115', 'SERV CAMBIO DE TURNO', '10116', 'ASIB - SIERRA GORDA', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('7811932003:0001', 'AURA - DAND', '102', 'SERV ANDINA CONTRATISTAS', '10113', 'AURA - DAND', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Isac Arratia Carcamo', true),
  ('7605030115:0001', 'BERLIAM - DRT CHANCADO SECUNDARIO', '121', 'SERV FERROVIAL', '10114', 'BERLIAM - DRT CHANCADO SECUNDARIO', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', true),
  ('7605030110:0001', 'BERLIAM DRT CHANCADO', '121', 'SERV FERROVIAL', '10114', 'BERLIAM DRT CHANCADO', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', true),
  ('7605030114:0001', 'BERLIAM DGM MAQ', '121', 'SERV FERROVIAL', '10114', 'BERLIAM MAQUINARIA DGM', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', false),
  ('7605030113:0001', 'BERLIAM ZALDIVAR', '121', 'SERV FERROVIAL', '10116', 'BERLIAM ZALDIVAR', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Javier Plaza Cerda', true),
  ('0000000103:0001', 'BODEGA', '100', 'ADMINISTRACION', '10104', 'BODEGA JM', 'GERENCIA FINANZAS', 'Raul Lopez Guerra', 'Jose Luis Sierra', true),
  ('0000000103:0001', 'BODEGA', '100', 'ADMINISTRACION', '10104', 'BODEGA ZONA NORTE', 'GERENCIA FINANZAS', 'Raul Lopez Guerra', 'Jose Luis Sierra', true),
  ('7605030105:0001', 'BERLIAM MEL COLOSO', '121', 'SERV FERROVIAL', '10116', 'BROADSPECTRUM MEL COLOSO', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Javier Plaza Cerda', false),
  ('6170400011:0001', 'CODELCO - DSAL', '170', 'CODELCO - DSAL', '10113', 'CODELCO - DSAL', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Marcelo Villarroel Gutierrez', true),
  ('6170400008:0001', 'CODELCO ANDINA 2022', '154', 'SERV CODELCO ANDINA', '10113', 'CODELCO ANDINA 2022', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Isac Arratia Carcamo', true),
  ('6170400010:0001', 'CODELCO DRT', '163', 'CODELCO DRT', '10114', 'CODELCO DRT', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Carlos Villagran Suarez', true),
  ('6170400009:0001', 'CODELCO VP ANDINA 2022', '155', 'SERV CODELCO ANDINA VP', '10113', 'CODELCO VP ANDINA 2022', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Marcelo Villarroel Gutierrez', true),
  ('6170400007:0001', 'CODELCO VP CHUQUI PMCHS', '152', 'SERV CODELCO - EECC PMCHS', '10114', 'CODELCO VP CHUQUI', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Ricardo Mella Osorio', true),
  ('0000000104:0001', 'COMERCIAL', '100', 'ADMINISTRACION', '10102', 'COMERCIAL JM', 'GERENCIA COMERCIAL', 'Alan Brain Biggemann', 'Alan Brain Biggemann', true),
  ('9687083002:0001', 'COMTECSA - PMCHS', '152', 'SERV CODELCO - EECC PMCHS', '10114', 'COMTECSA - PMCHS', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Ricardo Mella Osorio', true),
  ('7752259301:0001', 'SANTA ISADORA SQM', '115', 'SERV CAMBIO DE TURNO', '10116', 'CONSTRUCTORA SANTA ISADORA - SQM', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('0000000106:0001', 'CONTABILIDAD', '100', 'ADMINISTRACION', '10104', 'CONTABILIDAD JM', 'GERENCIA FINANZAS', 'Raul Lopez Guerra', 'Rodrigo Puentes Araya', true),
  ('0000000107:0001', 'CONTROL FLOTA', '100', 'ADMINISTRACION', '10115', 'CONTROL FLOTA JM', 'CONTROL FLOTA', 'Juan Carlos Navea', 'Juan Carlos Navea', true),
  ('7672704001:0001', 'DMC CENTINELA', '165', 'SERV MINERA CENTINELA', '10116', 'DMC CENTINELA', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('7952723001:0001', 'EMIN - MEL', '166', 'CONTRATISTAS ANTOFAGASTA', '10116', 'EMIN - MEL', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Javier Plaza Cerda', true),
  ('7604187102:0001', 'ENAEX ANDINA 2024', '102', 'SERV ANDINA CONTRATISTAS', '10113', 'ENAEX ANDINA', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Isac Arratia Carcamo', true),
  ('0000000105:0001', 'FACTURACION Y COBRANZAS', '100', 'ADMINISTRACION', '10104', 'FACTURACION Y COBRANZA JM', 'GERENCIA FINANZAS', 'Raul Lopez Guerra', 'Carolina Lira Garrido', true),
  ('9148900001:0001', 'FINNING ARMADO DAND', '102', 'SERV ANDINA CONTRATISTAS', '10113', 'FINNING ARMADO DAND', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Isac Arratia Carcamo', true),
  ('9148900002:0001', 'FINNING MARC DAND', '102', 'SERV ANDINA CONTRATISTAS', '10113', 'FINNING MARC DAND', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Isac Arratia Carcamo', true),
  ('7776182307:0001', 'FLIX ALGARROBO', '164', 'SERV FLIX', '10113', 'FLIX ALGARROBO', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez', false),
  ('7776182302:0001', 'FLIX LA SERENA', '164', 'SERV FLIX', '10113', 'FLIX LA SERENA', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez', true),
  ('7776182304:0001', 'FLIX QUINTERO', '164', 'SERV FLIX', '10113', 'FLIX QUINTERO', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez', true),
  ('7776182308:0001', 'FLIX SAN ANTONIO', '164', 'SERV FLIX', '10113', 'FLIX SAN ANTONIO', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez', true),
  ('7776182305:0001', 'FLIX SAN FELIPE', '164', 'SERV FLIX', '10113', 'FLIX SAN FELIPE', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez', false),
  ('7776182303:0001', 'FLIX SANTIAGO', '164', 'SERV FLIX', '10113', 'FLIX SANTIAGO', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez', true),
  ('7776182306:0001', 'FLIX VALPARAÍSO', '164', 'SERV FLIX', '10113', 'FLIX VALPARAISO', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez', true),
  ('7776182301:0001', 'FLIX VIÑA DEL MAR', '164', 'SERV FLIX', '10113', 'FLIX VIÑA DEL MAR', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez', true),
  ('8555590001:0001', 'FLUOR - EL ABRA', '106', 'SERV CONTRATISTAS CALAMA', '10114', 'FLUOR - EL ABRA', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', true),
  ('7676154701:0001', 'FLUOR SALFA CENTINELA', '169', 'FLUOR SALFA CENTINELA', '10116', 'FLUOR-SALFA CENTINELA', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Jose Irribarren Sepulveda', true),
  ('7718974002:0001', 'ICL CATODOS DCH', '106', 'SERV CONTRATISTAS CALAMA', '10114', 'ICV DMH CHUQUI', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', false),
  ('7973088001:0001', 'INCOLUR VP ANDINA', '109', 'SERV ESPECIALES', '10113', 'INCOLUR VP ANDINA', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez', true),
  ('0000000159:0004', 'INDIRECTOS ZONA II', '459', 'INDIRECTOS ZONA II', '40114', 'INDIRECTO ZONA II CNN', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Maximiliano Contreras Rey', true),
  ('0000000159:0002', 'INDIRECTOS ZONA II', '259', 'INDIRECTOS ZONA II', '20114', 'INDIRECTO ZONA II SIMSA', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Maximiliano Contreras Rey', true),
  ('0000000158:0001', 'INDIRECTOS ZONA I', '158', 'INDIRECTOS ZONA I', '10113', 'INDIRECTOS ZONA I', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Cristian Jimenez Jimenez', true),
  ('0000000158:0005', 'INDIRECTOS ZONA I', '558', 'INDIRECTOS ZONA I', '50113', 'INDIRECTOS ZONA I CONSORCIO ANDINO', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Cristian Jimenez Jimenez', true),
  ('0000000159:0001', 'INDIRECTOS ZONA II', '159', 'INDIRECTOS ZONA II', '10114', 'INDIRECTOS ZONA II', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Maximiliano Contreras Rey', true),
  ('0000000167:0001', 'INDIRECTOS ZONA III', '167', 'INDIRECTOS ZONA III', '10116', 'INDIRECTOS ZONA III', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Luciano Fischer Ballerini', true),
  ('7850277001:0001', 'JM SERV ESPECIALES', '109', 'SERV ESPECIALES', '10113', 'JM SERVICIOS ESPECIALES', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez', true),
  ('9957547009:0001', 'MANTENCION ANTOFAGASTA', '160', 'MANTENCION ANTOFAGASTA', '10106', 'MANTENCION ANTOFAGASTA JM', 'GERENCIA MANTENIMIENTO', 'Rodrigo Galdames', 'Rodrigo Galdames', true),
  ('9957547001:0001', 'MANTENCION CALAMA', '122', 'MANTENCION CALAMA', '10111', 'MANTENCION CALAMA', 'GERENCIA MANTENIMIENTO', 'Rodrigo Galdames', 'Rodrigo Galdames', true),
  ('9957547001:0004', 'MANTENCION CALAMA', '422', 'MANTENCION CALAMA', '40106', 'MANTENCION CALAMA CNN', 'GERENCIA MANTENIMIENTO', 'Rodrigo Galdames', 'Rodrigo Galdames', true),
  ('9957547001:0001', 'MANTENCION CALAMA', '122', 'MANTENCION CALAMA', '10106', 'MANTENCION CALAMA JM', 'GERENCIA MANTENIMIENTO', 'Rodrigo Galdames', 'Rodrigo Galdames', true),
  ('9957547010:0001', 'MANTENCION IQUIQUE', '161', 'MANTENCION IQUIQUE', '10106', 'MANTENCION IQUIQUE JM', 'GERENCIA MANTENIMIENTO', 'Rodrigo Galdames', 'Rodrigo Galdames', true),
  ('9957547002:0001', 'MANTENCION LOS ANDES', '108', 'MANTENCION LOS ANDES', '10106', 'MANTENCION JM', 'GERENCIA MANTENIMIENTO', 'Rodrigo Galdames', 'Rodrigo Galdames', true),
  ('9665191006:0001', 'NEWREST CASERONES', '115', 'SERV CAMBIO DE TURNO', '10116', 'Newrest - Caserones', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('9665191013:0001', 'NEWREST - FRANKE', '115', 'SERV CAMBIO DE TURNO', '10116', 'NEWREST - FRANKE', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('9665191012:0001', 'NEWREST - QB PUERTO TECK', '115', 'SERV CAMBIO DE TURNO', '10116', 'NEWREST - QB PUERTO TECK', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('9665191007:0001', 'NEWREST ANTUCOYA', '115', 'SERV CAMBIO DE TURNO', '10116', 'NEWREST ANTUCOYA', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('9665191008:0001', 'NEWREST CENTINELA', '115', 'SERV CAMBIO DE TURNO', '10116', 'NEWREST CENTINELA', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('9665191003:0001', 'NEWREST COLLAHUASI', '115', 'SERV CAMBIO DE TURNO', '10116', 'NEWREST COLLAHUASI', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('9665191005:0001', 'NEWREST CONCENTRADORA CENTINELA', '115', 'SERV CAMBIO DE TURNO', '10116', 'NEWREST CONCENTRADORA CENTINELA', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('9665191010:0001', 'NEWREST - DAND', '102', 'SERV ANDINA CONTRATISTAS', '10113', 'NEWREST DAND', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez', true),
  ('9665191009:0001', 'NEWREST MUELLE', '115', 'SERV CAMBIO DE TURNO', '10116', 'NEWREST MUELLE', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('9665191004:0001', 'NEWREST ZALDIVAR', '115', 'SERV CAMBIO DE TURNO', '10116', 'NEWREST ZALDIVAR', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('7842341001:0001', 'NOATUM - EL ABRA', '106', 'SERV CONTRATISTAS CALAMA', '10114', 'NOATUM - EL ABRA', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('0000000111:0001', 'PREVENCION DE RIESGOS', '100', 'ADMINISTRACION', '10110', 'PREVENCION DE RIESGOS JM', 'GERENCIA PREVENCION DE RIESGOS', 'Manuel Parra Soto', 'Manuel Parra Soto', true),
  ('8486500001:0001', 'RYQ PMCHS', '152', 'SERV CODELCO - EECC PMCHS', '10114', 'R y Q PMCHS', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Ricardo Mella Osorio', true),
  ('0000000109:0004', 'RECURSOS HUMANOS', '400', 'ADMINISTRACION', '40111', 'RECURSOS HUMANOS CNN', 'GERENCIA RECURSOS HUMANOS', 'Andres Madrid Maureira', 'Andres Madrid Maureira', true),
  ('0000000109:0001', 'RECURSOS HUMANOS', '100', 'ADMINISTRACION', '10111', 'RECURSOS HUMANOS JM', 'GERENCIA RECURSOS HUMANOS', 'Andres Madrid Maureira', 'Andres Madrid Maureira', true),
  ('0000000109:0006', 'RECURSOS HUMANOS', '600', 'ADMINISTRACION', '60111', 'RECURSOS HUMANOS PLAZA VIEJA', 'GERENCIA RECURSOS HUMANOS', 'Andres Madrid Maureira', 'Andres Madrid Maureira', true),
  ('0000000109:0001', 'RECURSOS HUMANOS', '100', 'ADMINISTRACION', '10111', 'RECURSOS HUMANOS ZONA NORTE', 'GERENCIA RECURSOS HUMANOS', 'Andres Madrid Maureira', 'Andres Madrid Maureira', true),
  ('6170400006:0001', 'CODELCO DMH', '128', 'SERV CODELCO DMH', '10114', 'SERVICIO CODELCO DMH', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Jose Orellana Paez', true),
  ('7608159002:0001', 'SIERRA GORDA OPERACIONES', '110', 'SERV SIERRA GORDA', '10116', 'SIERRA GORDA - OPERACION', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Angel Guerra Basso', true),
  ('7680816001:0001', 'SIGMA - DAND', '102', 'SERV ANDINA CONTRATISTAS', '10113', 'SIGMA - DAND', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Marcelo Villarroel Gutierrez', true),
  ('9462300001:0001', 'SODEXO SQM', '115', 'SERV CAMBIO DE TURNO', '10116', 'SODEXO SQM', 'GERENCIA OPERACIONES ZONA III (NORTE COSTA)', 'Luciano Fischer Ballerini', 'Andres Barraza Mera', true),
  ('7805700001:0001', 'SOTRASER - DMH', '106', 'SERV CONTRATISTAS CALAMA', '10114', 'SOTRASER-DMH', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', true),
  ('7654304601:0001', 'SYNCORE - TALABRE', '106', 'SERV CONTRATISTAS CALAMA', '10114', 'SYNCORE - TALABRE', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', false),
  ('0000000112:0001', 'TECNOLOGIA E INFORMACION', '100', 'ADMINISTRACION', '10104', 'TECNOLOGIA E INFORMACIÓN JM', 'GERENCIA FINANZAS', 'Raul Lopez Guerra', 'Maria Jesus Lagos Minardi', true),
  ('7627009901:0001', 'TEPSAC DAND', '102', 'SERV ANDINA CONTRATISTAS', '10113', 'TEPSAC DAND', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Isac Arratia Carcamo', true),
  ('0000000108:0001', 'TESORERIA', '100', 'ADMINISTRACION', '10104', 'TESORERIA JM', 'GERENCIA FINANZAS', 'Raul Lopez Guerra', 'Marcos Jara Arenas', true),
  ('7850277002:0001', 'INTERURBANO VALPARAISO', '150', 'SERV PASAJEROS', '10113', 'VALPARAISO', 'GERENCIA OPERACIONES ZONA I (CENTRO)', 'Cristian Jimenez Jimenez', 'Jorge Parra Jimenez', true),
  ('9695370002:0001', 'XTREME MINING PMCHS', '152', 'SERV CODELCO - EECC PMCHS', '10114', 'XTREME MINING PMCHS', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Ricardo Mella Osorio', true),
  ('0000000168:0001', 'ZONA II CONTRATISTAS', '168', 'INDIRECTOS ZONA II', '10114', 'ZONA II CONTRATISTAS', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Maximiliano Contreras Rey', true),
  ('7606991001:0001', 'SERCOING - DRT', '106', 'SERV CONTRATISTAS CALAMA', '10114', 'SERCOING - DRT', 'GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)', 'Maximiliano Contreras Rey', 'Oscar Poblete Celedon', true)
;

update public.buk_contract_mappings bcm
set contract_number = src.contract_number,
    contract_name = src.contract_name,
    cost_unit = src.cost_unit,
    cost_unit_name = src.cost_unit_name,
    cost_center_code = src.cost_center_code,
    buk_area_name = src.buk_area_name,
    cost_center_name = src.cost_center_name,
    manager_name = src.manager_name,
    contract_admin_name = src.contract_admin_name,
    is_operational = src.is_operational,
    updated_at = timezone('utc', now())
from tmp_buk_contract_mapping_operational_sync src
where bcm.buk_area_name_normalized = public.normalize_buk_area_name(src.buk_area_name);

insert into public.buk_contract_mappings (
  contract_number,
  contract_name,
  cost_unit,
  cost_unit_name,
  cost_center_code,
  buk_area_name,
  cost_center_name,
  manager_name,
  contract_admin_name,
  is_one_to_one,
  is_operational,
  contract_id
)
select
  src.contract_number,
  src.contract_name,
  src.cost_unit,
  src.cost_unit_name,
  src.cost_center_code,
  src.buk_area_name,
  src.cost_center_name,
  src.manager_name,
  src.contract_admin_name,
  true,
  src.is_operational,
  contract_match.id
from tmp_buk_contract_mapping_operational_sync src
left join lateral (
  select c.id
  from public.contracts c
  where c.is_active = true
    and c.contract_name = src.contract_name
    and c.cost_center_code = src.cost_center_code
  order by c.id asc
  limit 1
) contract_match on true
where not exists (
  select 1
  from public.buk_contract_mappings bcm
  where bcm.buk_area_name_normalized = public.normalize_buk_area_name(src.buk_area_name)
);

update public.buk_contract_mappings bcm
set is_operational = false,
    updated_at = timezone('utc', now())
where bcm.is_operational = true
  and not exists (
    select 1
    from tmp_buk_contract_mapping_operational_sync src
    where bcm.buk_area_name_normalized = public.normalize_buk_area_name(src.buk_area_name)
  );
