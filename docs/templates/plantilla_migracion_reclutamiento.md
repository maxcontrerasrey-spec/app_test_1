# Plantilla de migracion de reclutamiento

Este documento reemplaza la antigua plantilla Excel del repositorio. Mantiene el contrato funcional de migracion en un formato auditable, legible y versionable en texto.

## Origen

- Generado desde `scripts/generate-recruitment-migration-template.mjs`.
- Reutiliza los encabezados y listas BUK definidos en `src/modules/recruitment/lib/bukEmployeeTemplateData.json`.
- La relacion entre hojas se mantiene por `folio_externo`, `case_code_externo` y `rut_candidato`.

## Instrucciones

| Hoja | Campo / regla | Detalle |
| --- | --- | --- |
| General | Objetivo | Esta plantilla sirve para migrar folios ya en proceso al modulo productivo de reclutamiento sin perder trazabilidad. |
| General | Fecha original | La columna fecha_solicitud_original en la hoja Folios se debe completar siempre. Esa es la referencia para respetar la fecha original de solicitud. |
| General | Llaves de enlace | folio_externo enlaza Folios con Casos. case_code_externo enlaza Casos con Candidatos, Ficha_BUK y Documentos. |
| General | RUT candidato | rut_candidato debe venir con el mismo valor en Candidatos, Ficha_BUK y Documentos para consolidar la carga. |
| Folios | Una fila por folio | Usa un identificador estable en folio_externo. Si ya existe un folio historico, cargalo ahi. |
| Folios | Estado | estado_folio_actual debe usar solo valores de la hoja Catalogos_Migracion. |
| Casos | Una fila por caso operativo | Normalmente sera un caso por folio. Si el folio tiene caso activo, completa esta hoja. |
| Candidatos | Una fila por postulacion | Si un candidato participo en mas de un caso, debe repetirse una fila por cada case_code_externo. |
| Candidatos | WHO | Si tiene_hallazgos_who = no, who_status puede quedar vacio o usar auto_clear. Si tiene hallazgos, completa resumen, fechas y estado. |
| Ficha_BUK | Solo si ya existe ficha | Completa esta hoja para candidatos con ficha personal/laboral disponible. Los encabezados replican la plantilla BUK usada por RRHH. |
| Documentos | Estado documental | Esta hoja migra estado y referencia documental. Los archivos fisicos no viajan en el Excel; si falta algun PDF/imagen se cargara manualmente despues. |
| Documentos | Matriz vigente | Los documentos base ya vienen precargados en la hoja como referencia de obligatoriedad para otros vs conductor. |

## Folios

Una fila por folio operativo. Preserva la fecha original de solicitud y el estado vigente del folio.

- `folio_externo`
- `fecha_solicitud_original`
- `fecha_ingreso_solicitada`
- `solicitante_nombre`
- `solicitante_correo`
- `cargo`
- `contrato_buk`
- `centro_costo_codigo`
- `centro_costo_nombre`
- `vacantes`
- `fecha_inicio_contrato`
- `fecha_fin_contrato`
- `turno`
- `renta_liquida_ofrecida`
- `campamento`
- `pasajes`
- `metodologia_pasajes`
- `otros_beneficios`
- `estado_folio_actual`
- `comentario_folio`

## Casos

Una fila por caso operativo asociado al folio.

- `case_code_externo`
- `folio_externo`
- `estado_caso_actual`
- `vacantes_solicitadas`
- `vacantes_cubiertas`
- `owner_nombre`
- `owner_correo`
- `fecha_apertura_caso`
- `fecha_objetivo_cierre`
- `comentario_caso`

## Candidatos

Una fila por postulacion dentro del caso.

- `case_code_externo`
- `rut_candidato`
- `nombre_completo`
- `correo`
- `telefono`
- `etapa_actual`
- `fecha_ingreso_etapa`
- `suitability_status`
- `seleccionado`
- `tiene_hallazgos_who`
- `who_status`
- `who_fecha_solicitud`
- `who_resumen_causas`
- `who_comentario_solicitud`
- `who_aprobado_por`
- `who_fecha_aprobacion`
- `validacion_documental_status`
- `validado_documentalmente_por`
- `fecha_validacion_documental`
- `fecha_contratado`
- `observaciones_candidato`

## Ficha BUK

Replica exacta de la ficha personal/laboral usada para personal a contratar.

- `case_code_externo`
- `rut_candidato`
- `Tipo de Documento`
- `Número de Documento*`
- `Apellido*`
- `Segundo Apellido`
- `Nombre*`
- `Sexo*`
- `Nacionalidad*`
- `Fecha de Nacimiento*`
- `Estado Civil*`
- `Dirección*`
- `Región*`
- `Comuna*`
- `Ciudad`
- `Teléfono Particular`
- `Teléfono Oficina`
- `Email`
- `Email Personal`
- `País`
- `Calle`
- `Número de Calle`
- `Depto / Oficina`
- `Título`
- `Institución`
- `Código de Ficha*`
- `Ingreso Compañía*`
- `Rol Privado*`
- `Fecha de Inicio Cotización AFC`
- `Fecha Reconocimiento de Antigüedad`
- `Fecha Inicio Vacaciones Progresivas`
- `Forma de Pago*`
- `Banco`
- `Tipo de Cuenta`
- `Número de Cuenta`
- `Código de Sucursal`
- `Tipo Vale Vista`
- `Régimen Previsional*`
- `Fondo de Cotización`
- `AFP Recaudadora`
- `Aumentar la cotización en 1%*`
- `Fonasa/Isapre*`
- `Plan Isapre UF*`
- `Plan Isapre Pesos*`
- `Plan Isapre Porcentual*`
- `AFC*`
- `Jubilado`
- `Régimen Jubilacion*`
- `Cuenta 2`
- `Plan Cuenta 2`
- `Moneda`
- `En Situación de Discapacidad`
- `Fecha de notificación de Discapacidad`
- `En Situación de Invalidez`
- `Fecha de notificación de Invalidez`
- `Carga Simple`
- `Carga Maternal`
- `Carga Inválida`
- `Tramo de Asignación`
- `Actualización Datos Personales`
- `Inclusión Laboral`
- `Numero Calzado`
- `Talla Pantalón`
- `Talla Polera`
- `Trabajador extranjero`

## Documentos

Estado documental y referencias de respaldo por candidato.

- `case_code_externo`
- `rut_candidato`
- `documento`
- `aplica_a`
- `obligatorio_según_regla`
- `status_documento`
- `fecha_vencimiento`
- `referencia_archivo`
- `observaciones_documento`

## Matriz documental base

| Documento | Aplica a | Obligatorio |
| --- | --- | --- |
| Curriculum | otros | si |
| Curriculum | conductor | si |
| Certificado de Antecedentes | otros | si |
| Certificado de Antecedentes | conductor | si |
| Cedula de identidad | otros | si |
| Cedula de identidad | conductor | si |
| Certificado de estudios | otros | no |
| Certificado de estudios | conductor | no |
| Finiquito ultimo trabajo | otros | no |
| Finiquito ultimo trabajo | conductor | no |
| Certificado de AFP | otros | si |
| Certificado de AFP | conductor | si |
| Certificado de Organismo de salud | otros | no |
| Certificado de Organismo de salud | conductor | no |
| Certificado de miembro activo de Bomberos de Chile | otros | no |
| Certificado de miembro activo de Bomberos de Chile | conductor | no |
| Certificado de Residencia | otros | si |
| Certificado de Residencia | conductor | si |
| Licencia de conducir | otros | no |
| Licencia de conducir | conductor | si |
| Hoja de vida del conductor | otros | no |
| Hoja de vida del conductor | conductor | si |
| Examen de Drogas | otros | si |
| Examen de Drogas | conductor | si |
| Examen Teorico de Instructor | otros | no |
| Examen Teorico de Instructor | conductor | si |
| Examen Practico de Instructor | otros | no |
| Examen Practico de Instructor | conductor | si |
| Informe Evaluacion Psicolaboral | otros | si |
| Informe Evaluacion Psicolaboral | conductor | si |
| Examen Preocupacional | otros | no |
| Examen Preocupacional | conductor | si |
| Psicosensotecnico | otros | no |
| Psicosensotecnico | conductor | si |

## Catalogos de migracion

| Campo | Valores permitidos |
| --- | --- |
| estado_folio_actual | `pending_area_manager`, `pending_contracts_control`, `approved`, `rejected`, `closed` |
| estado_caso_actual | `open`, `sourcing`, `screening`, `ready_to_hire`, `partially_filled`, `filled`, `closed_unfilled`, `cancelled` |
| etapa_actual | `lead`, `who_pending`, `who_approved`, `medical_exams`, `document_review`, `ready_for_hire`, `hired`, `rejected`, `withdrawn` |
| suitability_status | `unknown`, `fit`, `risk`, `blocked` |
| seleccion_bool | `si`, `no` |
| hallazgos_who_bool | `si`, `no` |
| who_status | `(vacio)`, `pending`, `approved`, `rejected`, `cancelled`, `auto_clear` |
| validacion_documental_status | `(vacio)`, `pending`, `approved` |
| campamento_pasajes_bool | `si`, `no` |
| status_documento | `pending`, `uploaded`, `approved`, `rejected`, `expired`, `not_applicable` |

## Diccionario

| hoja | columna | requerido | descripcion |
| --- | --- | --- | --- |
| Folios | folio_externo | si | Identificador de negocio para enlazar el resto de hojas. |
| Folios | fecha_solicitud_original | si | Fecha original de solicitud que se debe preservar. |
| Folios | fecha_ingreso_solicitada | si | Fecha pedida para ingreso del trabajador. |
| Folios | solicitante_nombre | si | Nombre del solicitante del folio. |
| Folios | solicitante_correo | no | Correo del solicitante. |
| Folios | cargo | si | Cargo solicitado. |
| Folios | contrato_buk | si | Nombre del area/contrato segun BUK. |
| Folios | centro_costo_codigo | no | Codigo contable del centro de costo si ya existe. |
| Folios | centro_costo_nombre | no | Nombre contable del centro de costo. |
| Folios | vacantes | si | Cantidad de vacantes pedidas. |
| Folios | fecha_inicio_contrato | no | Inicio proyectado del contrato. |
| Folios | fecha_fin_contrato | no | Termino proyectado del contrato. |
| Folios | turno | no | Turno o jornada. |
| Folios | renta_liquida_ofrecida | no | Monto liquido ofrecido. |
| Folios | campamento | no | si/no. |
| Folios | pasajes | no | si/no. |
| Folios | metodologia_pasajes | no | Valor solo si pasajes = si. |
| Folios | otros_beneficios | no | Texto libre. |
| Folios | estado_folio_actual | si | Estado actual del folio. |
| Folios | comentario_folio | no | Observacion relevante para migracion. |
| Casos | case_code_externo | si | Identificador del caso para enlazar candidatos y fichas. |
| Casos | folio_externo | si | Debe existir en hoja Folios. |
| Casos | estado_caso_actual | si | Estado del caso operativo actual. |
| Casos | vacantes_solicitadas | si | Vacantes abiertas en el caso. |
| Casos | vacantes_cubiertas | no | Vacantes ya cubiertas. |
| Casos | owner_nombre | no | Responsable actual del caso. |
| Casos | owner_correo | no | Correo del owner si aplica. |
| Casos | fecha_apertura_caso | no | Fecha en que el caso empezo a operarse. |
| Casos | fecha_objetivo_cierre | no | Fecha objetivo de cierre. |
| Casos | comentario_caso | no | Contexto adicional. |
| Candidatos | case_code_externo | si | Debe existir en hoja Casos. |
| Candidatos | rut_candidato | si | RUT del candidato. |
| Candidatos | nombre_completo | si | Nombre completo visible. |
| Candidatos | correo | no | Correo del candidato. |
| Candidatos | telefono | no | Telefono del candidato. |
| Candidatos | etapa_actual | si | Etapa actual del pipeline. |
| Candidatos | fecha_ingreso_etapa | no | Fecha de entrada a la etapa actual. |
| Candidatos | suitability_status | no | unknown/fit/risk/blocked. |
| Candidatos | seleccionado | no | si/no. |
| Candidatos | tiene_hallazgos_who | no | si/no. |
| Candidatos | who_status | no | Estado de aprobacion WHO si existe. |
| Candidatos | who_fecha_solicitud | no | Fecha de solicitud WHO. |
| Candidatos | who_resumen_causas | no | Resumen de causas judiciales en texto estructurado. |
| Candidatos | who_comentario_solicitud | no | Comentario de envio a WHO. |
| Candidatos | who_aprobado_por | no | Nombre de quien aprobo WHO. |
| Candidatos | who_fecha_aprobacion | no | Fecha de aprobacion/rechazo WHO. |
| Candidatos | validacion_documental_status | no | pending/approved. |
| Candidatos | validado_documentalmente_por | no | Nombre del revisor documental. |
| Candidatos | fecha_validacion_documental | no | Fecha de validacion documental. |
| Candidatos | fecha_contratado | no | Solo si el candidato ya esta contratado. |
| Candidatos | observaciones_candidato | no | Texto libre. |
| Ficha_BUK | case_code_externo | si | Debe existir en hoja Casos. |
| Ficha_BUK | rut_candidato | si | Debe existir en hoja Candidatos. |
| Ficha_BUK | resto de columnas | segun disponibilidad | Replica exacta de la ficha BUK/nomina usada hoy por RRHH. |
| Documentos | case_code_externo | si | Debe existir en hoja Casos. |
| Documentos | rut_candidato | si | Debe existir en hoja Candidatos. |
| Documentos | documento | si | Nombre del documento segun matriz. |
| Documentos | aplica_a | si | otros o conductor. |
| Documentos | obligatorio_según_regla | si | si/no segun matriz vigente. |
| Documentos | status_documento | si | Estado actual del documento. |
| Documentos | fecha_vencimiento | no | Si aplica. |
| Documentos | referencia_archivo | no | Nombre o ruta de respaldo del archivo original. |
| Documentos | observaciones_documento | no | Texto libre. |

## Listas BUK

Las opciones siguientes salen del mismo contrato vivo que usa el ERP para la ficha de `Personal a Contratar`.

### Tipo de Documento

- `RUT`
- `Otro`
### Sexo*

- `M`
- `F`
### Nacionalidad*

- `Afgana`
- `Albanesa`
- `Alemana`
- `Andorrana`
- `Angoleña`
- `Anguila`
- `Antiguana`
- `Antártida`
- `Argelina`
- `Argentina`
- `Armenia`
- `Arubana`
- `Australiana`
- `Austriaca`
- `Azerbaiyana`
- `Bahameña`
- `Bahreiní`
- `Bangladesí`
- `Barbadense`
- `Belga`
- `Beliceña`
- `Beninesa`
- `Bermudeña`
- `Bhután`
- `Bielorrusa`
- `Birmana`
- `Boliviana`
- `Bosnia`
- `Botsuana`
- `Brasileña`
- `Británica`
- `Británico del Océano Índico, Territorio`
- `Bruneana`
- `Burkinesa`
- `Burundesa`
- `Búlgara`
- `Caboverdiana`
- `Camboyana`
- `Camerunesa`
- `Canadiense`
- `Ceilandesa`
- `Centroafricana`
- `Chadiana`
- `Checa`
- `Chilena`
- `China`
- `Chipriota`
- `Colombiana`
- `Comorense`
- `Congoleña`
- `Congoleño`
- `Costarricense`
- `Cristobaleña`
- `Croata`
- `Cubana`
- `Curasao`
- `Danesa`
- `Dominicana`
- `Dominiqués`
- `Ecuatoguineana`
- `Ecuatoriana`
- `Egipcia`
- `Emiratí`
- `Eritreoa`
- `Eslovaca`
- `Eslovena`
- `Española`
- `Estadounidense`
- `Estonia`
- `Etíope`
- `Filipina`
- `Finlandesa`
- `Fiyiana`
- `Francesa`
- `Gabonesa`
- `Gambiana`
- `Georgia del Sur e Islas Sandwitch del Sur`
- `Georgiana`
- `Ghanesa`
- `Gibraltareña`
- `Granadina`
- `Griega`
- `Groenlandesa`
- `Guadalupe`
- `Guam`
- `Guatemalteca`
- `Guayana Francesa`
- `Guernsey`
- `Guineana`
- `Guineana`
- `Guyanesa`
- `Haitiana`
- `Hondureña`
- `Hongkonés`
- `Húngara`
- `India`
- `Indonesia`
- `Iraní`
- `Iraquí`
- `Irlandesa`
- `Isla Bouvet`
- `Isla Norfolk`
- `Isla de Man`
- `Isla de Navidad`
- `Isla de San Martín (zona holandsea)`
- `Islandesa`
- `Islas BES (Caribe Neerlandés)`
- `Islas Caimán`
- `Islas Cocos (Keeling)`
- `Islas Cook`
- `Islas Falkland (Malvinas)`
- `Islas Feroe`
- `Islas Heard e Islas McDonald`
- `Islas Marianas del Norte`
- `Islas Vírgenes, Británicas`
- `Islas Vírgenes, de EEUU`
- `Islas menores exteriores de Estados Unidos`
- `Islas Äland`
- `Israelí`
- `Italiana`
- `Jamaicana`
- `Japonesa`
- `Jersey`
- `Jordana`
- `Kazaja`
- `Keniana`
- `Kirguisa`
- `Kiribatiana`
- `Kuwaití`
- `Laosiana`
- `Lesotense`
- `Letóna`
- `Libanesa`
- `Liberiana`
- `Libia`
- `Liechtensteiniana`
- `Lituana`
- `Luxemburguesa`
- `Macaense​`
- `Macedonia`
- `Malasia`
- `Malauí`
- `Maldiva`
- `Malgache`
- `Maliense`
- `Maltesa`
- `Marfileña`
- `Marroquí`
- `Marshalesa`
- `Martiniqués`
- `Mauriciana`
- `Mauritana`
- `Mayotte`
- `Mexicana`
- `Micronesia`
- `Moldava`
- `Monegasca`
- `Mongola`
- `Montenegrina`
- `Montserrat`
- `Mozambiqueña`
- `Namibia`
- `Nauruana`
- `Neerlandesa`
- `Neozelandesa`
- `Nepalesa`
- `Nicaragüense`
- `Nigeriana`
- `Nigerina`
- `Niuano`
- `Norcoreana`
- `Noruega`
- `Nueva Caledonia`
- `Omaní`
- `Pakistaní`
- `Palauana`
- `Palestina`
- `Panameña`
- `Papú`
- `Paraguaya`
- `Peruana`
- `Pitcairn`
- `Polaca`
- `Polinesia Francesa`
- `Portuguesa`
- `Puertorriqueña`
- `Qatarí`
- `Reunionesa`
- `Ruandesa`
- `Rumana`
- `Rusa`
- `Sahara Occidental`
- `Salomonense`
- `Salvadoreña`
- `Samoa Americana`
- `Samoana`
- `San Bartolomé`
- `San Martin`
- `San Pedro y Miquelon`
- `Sanmarinense`
- `Santa Elena, Ascensión y Tristán de Acuña`
- `Santalucense`
- `Santotomense`
- `Sanvicentina`
- `Saudita`
- `Senegalesa`
- `Serbia`
- `Seychellense`
- `Sierraleonesa`
- `Singapurense`
- `Siria`
- `Somalí`
- `Sudafricana`
- `Sudanesa`
- `Sueca`
- `Suiza`
- `Surcoreana`
- `Surinamesa`
- `Sursudanesa`
- `Svalbard y Jan Mayen`
- `Swazilandia`
- `Tailandesa`
- `Taiwanesa`
- `Tanzana`
- `Tayika`
- `Territorios Franc`
- `Timorense`
- `Togolesa`
- `Tokelau`
- `Tongana`
- `Trinitense`
- `Tunecina`
- `Turca`
- `Turcomana`
- `Turks y Caicos, Islas`
- `Tuvaluana`
- `Ucraniana`
- `Ugandesa`
- `Uruguaya`
- `Uzbeka`
- `Vanuatuense`
- `Vaticana`
- `Venezolana`
- `Vietnamita`
- `Wallis y Futuna`
- `Yemení`
- `Yibutiana`
- `Zambiana`
- `Zimbabuense`
### Estado Civil*

- `Soltero`
- `Casado`
- `Divorciado`
- `Viudo`
- `Acuerdo de Unión Civil`
### Región

- `I: de Tarapacá`
- `II: de Antofagasta`
- `III: de Atacama`
- `IV: de Coquimbo`
- `V: de Valparaíso`
- `VI: del Libertador Gral. Bernardo O'Higgins`
- `VII: del Maule`
- `VIII: del Biobío`
- `IX: de la Araucanía`
- `X: de Los Lagos`
- `XI: de Aysén del Gral. Carlos Ibáñez del Campo`
- `XII: de Magallanes y de la Antártica Chilena`
- `RM: Metropolitana de Santiago`
- `XIV: de Los Ríos`
- `XV: de Arica y Parinacota`
- `XVI: de Ñuble`
### Comuna

- `Natales`
- `Primavera`
- `Cabo de Hornos`
- `Iquique`
- `Alto Hospicio`
- `Pozo Almonte`
- `Camiña`
- `Colchane`
- `Huara`
- `Pica`
- `Antofagasta`
- `Mejillones`
- `Sierra Gorda`
- `Taltal`
- `Calama`
- `Ollagüe`
- `San Pedro de Atacama`
- `Tocopilla`
- `María Elena`
- `Copiapó`
- `Caldera`
- `Tierra Amarilla`
- `Chañaral`
- `Diego de Almagro`
- `Vallenar`
- `Alto del Carmen`
- `Freirina`
- `Huasco`
- `La Serena`
- `Coquimbo`
- `Andacollo`
- `La Higuera`
- `Paihuano`
- `Vicuña`
- `Illapel`
- `Canela`
- `Los Vilos`
- `Salamanca`
- `Ovalle`
- `Combarbalá`
- `Monte Patria`
- `Punitaqui`
- `Río Hurtado`
- `Valparaíso`
- `Casablanca`
- `Concón`
- `Juan Fernández`
- `Puchuncaví`
- `Quintero`
- `Viña del Mar`
- `Isla de Pascua`
- `Los Andes`
- `Calle Larga`
- `Rinconada`
- `San Esteban`
- `La Ligua`
- `Cabildo`
- `Papudo`
- `Petorca`
- `Zapallar`
- `Quillota`
- `La Calera`
- `Hijuelas`
- `La Cruz`
- `Nogales`
- `San Antonio`
- `Algarrobo`
- `Cartagena`
- `El Quisco`
- `El Tabo`
- `Santo Domingo`
- `San Felipe`
- `Catemu`
- `Llay Llay`
- `Panquehue`
- `Putaendo`
- `Santa María`
- `Quilpué`
- `Limache`
- `Olmué`
- `Villa Alemana`
- `Rancagua`
- `Codegua`
- `Coinco`
- `Coltauco`
- `Doñihue`
- `Graneros`
- `Las Cabras`
- `Machalí`
- `Malloa`
- `Mostazal`
- `Olivar`
- `Peumo`
- `Pichidegua`
- `Quinta de Tilcoco`
- `Rengo`
- `Requínoa`
- `San Vicente`
- `Pichilemu`
- `La Estrella`
- `Litueche`
- `Marchihue`
- `Navidad`
- `Paredones`
- `San Fernando`
- `Chépica`
- `Chimbarongo`
- `Lolol`
- `Nancagua`
- `Palmilla`
- `Peralillo`
- `Placilla`
- `Pumanque`
- `Santa Cruz`
- `Talca`
- `Constitución`
- `Curepto`
- `Empedrado`
- `Maule`
- `Pelarco`
- `Pencahue`
- `Río Claro`
- `San Clemente`
- `San Rafael`
- `Cauquenes`
- `Chanco`
- `Pelluhue`
- `Curicó`
- `Hualañé`
- `Licantén`
- `Molina`
- `Rauco`
- `Romeral`
- `Sagrada Familia`
- `Teno`
- `Vichuquén`
- `Linares`
- `Colbún`
- `Longaví`
- `Parral`
- `Retiro`
- `San Javier`
- `Villa Alegre`
- `Yerbas Buenas`
- `Concepción`
- `Coronel`
- `Chiguayante`
- `Florida`
- `Hualqui`
- `Lota`
- `Penco`
- `San Pedro de la Paz`
- `Santa Juana`
- `Talcahuano`
- `Tomé`
- `Hualpén`
- `Lebu`
- `Arauco`
- `Cañete`
- `Contulmo`
- `Curanilahue`
- `Los Álamos`
- `Tirúa`
- `Los Ángeles`
- `Antuco`
- `Cabrero`
- `Laja`
- `Mulchén`
- `Nacimiento`
- `Negrete`
- `Quilaco`
- `Quilleco`
- `San Rosendo`
- `Santa Bárbara`
- `Tucapel`
- `Yumbel`
- `Alto Biobío`
- `Temuco`
- `Carahue`
- `Cunco`
- `Curarrehue`
- `Freire`
- `Galvarino`
- `Gorbea`
- `Lautaro`
- `Loncoche`
- `Melipeuco`
- `Nueva Imperial`
- `Padre las Casas`
- `Perquenco`
- `Pitrufquén`
- `Pucón`
- `Saavedra`
- `Teodoro Schmidt`
- `Toltén`
- `Vilcún`
- `Villarrica`
- `Cholchol`
- `Angol`
- `Collipulli`
- `Curacautín`
- `Ercilla`
- `Lonquimay`
- `Los Sauces`
- `Lumaco`
- `Purén`
- `Renaico`
- `Traiguén`
- `Victoria`
- `Puerto Montt`
- `Calbuco`
- `Cochamó`
- `Fresia`
- `Frutillar`
- `Los Muermos`
- `Llanquihue`
- `Maullín`
- `Puerto Varas`
- `Castro`
- `Ancud`
- `Chonchi`
- `Curaco de Vélez`
- `Dalcahue`
- `Puqueldón`
- `Queilén`
- `Quellón`
- `Quemchi`
- `Quinchao`
- `Osorno`
- `Puerto Octay`
- `Purranque`
- `Puyehue`
- `Río Negro`
- `San Juan de la Costa`
- `San Pablo`
- `Chaitén`
- `Futaleufú`
- `Hualaihué`
- `Palena`
- `Coyhaique`
- `Lago Verde`
- `Aysén`
- `Cisnes`
- `Guaitecas`
- `Cochrane`
- `O'Higgins`
- `Tortel`
- `Chile Chico`
- `Río Ibáñez`
- `Punta Arenas`
- `Laguna Blanca`
- `Río Verde`
- `San Gregorio`
- `Antártica`
- `Porvenir`
- `Timaukel`
- `Torres del Paine`
- `Santiago`
- `Cerrillos`
- `Cerro Navia`
- `Conchalí`
- `El Bosque`
- `Estación Central`
- `Huechuraba`
- `Independencia`
- `La Cisterna`
- `La Florida`
- `La Granja`
- `La Pintana`
- `La Reina`
- `Las Condes`
- `Lo Barnechea`
- `Lo Espejo`
- `Lo Prado`
- `Macul`
- `Maipú`
- `Ñuñoa`
- `Pedro Aguirre Cerda`
- `Peñalolén`
- `Providencia`
- `Pudahuel`
- `Quilicura`
- `Quinta Normal`
- `Recoleta`
- `Renca`
- `San Joaquín`
- `San Miguel`
- `San Ramón`
- `Vitacura`
- `Puente Alto`
- `Pirque`
- `San José de Maipo`
- `Colina`
- `Lampa`
- `Tiltil`
- `San Bernardo`
- `Buin`
- `Calera de Tango`
- `Paine`
- `Melipilla`
- `Alhué`
- `Curacaví`
- `María Pinto`
- `San Pedro`
- `Talagante`
- `El Monte`
- `Isla de Maipo`
- `Padre Hurtado`
- `Peñaflor`
- `Valdivia`
- `Corral`
- `Lanco`
- `Los Lagos`
- `Máfil`
- `Mariquina`
- `Paillaco`
- `Panguipulli`
- `La Unión`
- `Futrono`
- `Lago Ranco`
- `Río Bueno`
- `Arica`
- `Camarones`
- `Putre`
- `General Lagos`
- `Chillán`
- `Bulnes`
- `Chillán Viejo`
- `El Carmen`
- `Pemuco`
- `Pinto`
- `Quillón`
- `San Ignacio`
- `Yungay`
- `Cobquecura`
- `Coelemu`
- `Ninhue`
- `Portezuelo`
- `Quirihue`
- `Ránquil`
- `Treguaco`
- `Coihueco`
- `Ñiquén`
- `San Carlos`
- `San Fabián`
- `San Nicolás`
### Rol Privado*

- `Sí`
- `No`
### Forma de Pago*

- `Cheque`
- `Servipag`
- `Vale Vista`
- `No Generar Pago`
- `Transferencia Bancaria`
### Banco

- `Scotiabank`
- `Security`
- `The Bank of Tokyo-Mitsubishi`
- `Sociedad Emisora de Tarjetas Los Heroes S.A.`
- `Tenpo Prepago SA`
- `Global 66`
- `Mercadopago Emisora S.A.`
- `Los Andes Tarjetas de Prepago`
- `JP Morgan Chase Bank`
- `Banco Deutsche`
- `Copec Pay`
- `MACH`
- `Prex Chile S.A.`
- `HSBC`
- `Itau`
- `BBVA`
- `BCI`
- `BICE`
- `Banco de Chile`
- `Consorcio`
- `COOPEUCH`
- `Corpbanca`
- `CrediChile`
- `Banco Estado`
- `Falabella`
- `Internacional`
- `Rabobank`
- `Ripley`
- `Santander`
- `BTG Pactual`
- `Santander Hub de Pago V2`
### Tipo de Cuenta

- `Corriente`
- `Vista`
- `Ahorro`
### Tipo Vale Vista

- `Direccionado Entrega al Beneficiario (ServiEstado)`
- `Custodia Electrónica (ServiEstado)`
- `Direccionado Entrega al Tomador (ServiEstado)`
- `Entrega Mesón (Banco de Chile)`
- `Empresa (Banco de Chile)`
- `Impresion Centralizada (ServiEstado)`
- `Pago Cash (Banco Estado)`
- `Vale Vista Empresa (Banco Santander)`
### Régimen Previsional*

- `AFP`
- `No Cotiza`
- `IPS (Ex-INP)`
### Fondo de Cotización

- `Capital`
- `Cuprum`
- `Habitat`
- `Modelo`
- `PlanVital`
- `ProVida`
- `Uno`
- `Servicios de Seguro Social - Régimen 1`
- `Servicios de Seguro Social - Régimen 2`
- `Empart - Régimen 1`
- `Empart - Régimen 2`
- `Capremer - Régimen 1`
- `Triomar - Régimen 1`
- `Canaempu Públicos - Régimen 1`
- `Canaempu Públicos - Régimen 21`
- `EE Municipales de la República - Régimen 1`
- `EE Municipales de la República - Régimen 2`
- `EE Municipales de la República - Régimen 3`
- `OO Municipales de la República - Régimen 1`
- `OO Municipales de la República - Régimen 2`
- `OO Municipales de la República - Régimen 3`
- `Caja Ferro - Régimen 2`
### Fonasa/Isapre*

- `Fonasa`
- `Banmedica`
- `Colmena`
- `Consalud`
- `Cruz Blanca`
- `Nueva Masvida`
- `Vida Tres`
- `Banco Estado`
- `ISALUD Isapre de Codelco`
- `Cruz del Norte`
- `Esencial`
- `Mutual`
- `No Cotiza Salud`
### AFC*

- `Menos de 11 Años`
- `Más de 11 Años`
- `No Cotiza`
### Jubilado

- `Sí`
- `No`
### Régimen Jubilacion*

- `jubilacion_afp: AFP`
- `jubilacion_ips: IPS (Ex-INP)`
### Cuenta 2

- `Capital`
- `Cuprum`
- `Habitat`
- `Modelo`
- `PlanVital`
- `ProVida`
- `Uno`
### Moneda*

- `UF`
- `$`
- `%`
### En Situación de Discapacidad

- `Sí`
- `No`
### En Situación de Invalidez

- `No`
- `Pensionado con Invalidez Parcial`
- `Asignatario Pensión por Invalidez Total`
### Tramo de Asignación

- `A`
- `B`
- `C`
- `D`
### Numero Calzado

- `35`
- `36`
- `37`
- `38`
- `39`
- `40`
- `41`
- `42`
- `43`
- `44`
- `45`
- `46`
- `51`
### Talla Pantalón

- `34`
- `36`
- `38`
- `40`
- `42`
- `44`
- `46`
- `48`
- `50`
- `51`
- `52`
- `54`
- `56`
- `58`
### Talla Polera

- `S`
- `M`
- `L`
- `XL`
- `XXL`
- `XXXL`
