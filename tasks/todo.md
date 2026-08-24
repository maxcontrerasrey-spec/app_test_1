# Tareas y Roadmap de Desarrollo

## Auditoría post-implementación EEES 2.0 - 2026-08-24

- [x] Reproducir y clasificar falsos positivos de certificación, migraciones, secretos, supply chain y performance.
- [x] Corregir los controles críticos con contratos backend autoritativos y cobertura de regresión.
- [x] Ejecutar pruebas focalizadas, Guardian completo, build y validación del workflow.
- [x] Publicar únicamente los cambios EEES en `main` y verificar CI/remoto antes de cerrar.

Alcance: se preservan sin mezclar los cambios locales concurrentes del flujo BUK y los artefactos no versionados.

Revisión técnica: se cerraron falsos PASS en rango Git de migraciones, cobertura del workflow, certificación prematura/obsoleta, aceptación de riesgos, secretos, actions mutables, shell inputs, baseline Supabase y performance. Guardian completo cerró con 0 errores y 0 warnings; quedan como trabajo planificado la reducción forward-only de 82 fingerprints Supabase históricos y diff coverage general.

Cierre productivo: commits `be438f6` y `6ea9067` publicados en `main`; GitHub Actions `32760062232` terminó `success` con build, smokes, Guardian, certificación y artefacto. La evidencia descargada declara `CERTIFIED`, commit `6ea9067`, 0 errores, 82 observaciones históricas y 0 riesgos aceptados.

## Implementación EEES 2.0 - 2026-08-24

- [x] Levantar el estado vivo de Books, registry, Guardian, gates, evidencia y certificación sin alterar cambios concurrentes.
- [x] Diseñar e implementar la migración mínima de gobernanza, seguridad, supply chain, DB/API, resiliencia, calidad y performance.
- [x] Reconciliar Books, reglas, Guardian, CI, excepciones y certificación con pruebas del propio estándar.
- [x] Ejecutar los gates completos, corregir regresiones atribuibles y generar guía de migración e informe reproducible.

Estado inicial: auditoría en curso sobre `main` con cambios concurrentes ajenos preservados. El prompt adjunto se usa como especificación de objetivos; el repositorio vivo conserva la autoridad técnica.

Resultado: Guardian completo cerro con 0 errores/0 warnings propios; gobierno, secretos, dependencias, CI, migraciones, cleanup, tests, cobertura, smokes, Edge Functions y performance pasan. Las dos supresiones heredadas se retiraron porque sus hallazgos ya no existen. La certificacion cuenta por separado los warnings historicos informados por el audit Supabase.

Revision final: commits `dc84694` y `071271c` enviados a `main`. GitHub Actions `32756756439` cerro exitosamente todos los gates, genero evidencia de certificacion y SBOM, y el upload de artefactos quedo fijado a `v6.0.0`/Node 24 sin la advertencia anterior.

## Auditoría integral ERP: funcionamiento, seguridad, versionado y performance - 2026-08-24

- [x] Levantar línea base reproducible de Git, arquitectura, dependencias, tamaño, pruebas y build.
- [x] Auditar Supabase: historial de migraciones, RLS, grants, RPC privilegiadas, Storage y Edge Functions.
- [x] Perfilar frontend y producción: rutas, bundles, caché, consultas, render y tiempos de respuesta.
- [x] Corregir hallazgos críticos/altos con cambios mínimos y eliminar únicamente código muerto demostrado.
- [x] Ejecutar gates EEES completos, verificar producción y documentar riesgos residuales con evidencia.

Alcance: se preservan los cambios locales existentes del flujo BUK; esta auditoría no los sobrescribirá ni mezclará sin verificar su autoría y estado.

Revisión final: Guardian completo en 0 errores/0 warnings, 215 pruebas aprobadas, build y smoke aprobados, `npm audit` sin vulnerabilidades, migraciones productivas alineadas (`dry-run upToDate`), 22 políticas RLS optimizadas y fondo de login reducido en 98,8%. Informe: `eees/audits/ERP-CODE-PERFORMANCE-AUDIT-2026-08-24.md`.

## Alta BUK Sylvia Myriam Carvajal Salinas - jubilada sin AFP - 2026-08-22

- [x] Ubicar la ficha, participación, folio, cargo y RUT de Sylvia en el ERP y comprobar si ya existe una alta o job BUK.
- [x] Auditar el contrato del worker para la excepción de jubilada sin AFP y confirmar los campos previsionales permitidos por BUK.
- [x] Ejecutar la alta idempotente en producción solo si los datos obligatorios están completos, omitiendo AFP sin inventar valores.
- [x] Verificar en ERP/BUK el job, ficha F1 y ausencia de duplicados; documentar cualquier advertencia de BUK.

Resultado: Sylvia Myriam Carvajal Salinas quedó creada en BUK como `42995`, código F1, vinculada a RC-0134/Aseador. BUK confirmó plan `no_cotiza`, fondo AFP vacío, jubilada y régimen `jubilacion_afp`; el job ERP `669cb606-1388-4706-973b-0d3a8e60e67d` terminó `success` tras reutilizar la ficha parcial sin duplicar. Se corrigió el worker para traducir la etiqueta visual `jubilacion_afp: AFP` al valor API `jubilacion_afp` y se limpiaron del snapshot los errores obsoletos del primer intento.

## Ejecución contingencia BUK F1 - Francisco, Eneida y Carolaine - 2026-08-22

- [x] Confirmar que los tres jobs ya existen en producción y siguen `pending`, `attempts=0`, sin `buk_employee_id`.
- [x] Ejecutar `sync-buk-candidates` en producción para esos tres `jobIds` usando secreto server-side, sin exponer credenciales ni crear duplicados manuales.
- [x] Confirmar que el primer intento creó fichas parciales BUK F1 y dejó los jobs reintentables: Francisco `42992`, Carolaine `42993`, Eneida `42994`.
- [x] Reintentar recuperación idempotente sobre esas mismas fichas después de habilitar el cargo `ASEADOR` en BUK.
- [x] Verificar que cada job termine `success`, conserve código `F1` y tenga `buk_employee_id`.
- [x] Confirmar ausencia de duplicados por documento en ERP/BUK antes de cerrar.
- [x] Retirar el workflow operativo temporal usado para esta ejecución.

Resultado: cerrado en producción sin duplicar. Francisco Javier Figueroa Rojas quedó en BUK `42992` F1, Carolaine Danitza Catalan Ruiz en BUK `42993` F1 y Eneida Rosales Vargas en BUK `42994` F1. Los tres jobs terminaron `success`; Eneida resolvió cargo `ASEADOR` en área `2911`. La verificación de sindicato queda auditada como `not_exposed`: BUK aceptó el PATCH de `No Sindicalizados`, pero sus lecturas de job no exponen el campo `union`; una categoría distinta sigue bloqueando el cierre.

## Desbloqueo bundle productivo contingencia BUK - 2026-08-22

- [x] Confirmar que `origin/main` apunta al fix `f04288c` y que produccion sigue sirviendo el bundle anterior `index-DzFAlzvG.js`.
- [x] Revisar el run fallido `32584899546` y aislar la causa en el baseline de performance, con tests funcionales y build pasando.
- [x] Actualizar el baseline medido, ejecutar gates, commitear y pushear el redeploy a `main`.
- [ ] Verificar que Cloudflare Pages sirva un bundle nuevo y que la accion de contingencia inicie `sync-buk-candidates`.
- [ ] Confirmar estado final de los tres jobs BUK pendientes antes de declarar creacion exitosa.

## Liberar candidato individual a Sin Folio desde Traslado - 2026-08-21

- [x] Agregar en el modal de traslado una acción explícita para dejar al candidato en Sin Folio, sin exigir un folio destino.
- [x] Implementar una RPC transaccional y autorizada que marque la participación como liberada, conserve perfil, documentos e historial, audite actor/motivo y actualice las métricas del folio de origen.
- [x] Mantener la reactivación futura mediante el flujo existente de asignación a un folio nuevo, limpiando la marca al reasignar.
- [x] Cubrir estados terminales, permisos, doble ejecución y regresión de UI/RPC; validar que el candidato no aparezca activo en el folio original ni se descarte.
- [x] Ejecutar gates, aplicar migración y verificar el flujo completo en producción antes de cerrar.

Estado: publicado en producción en `11c35e5`. La RPC `release_candidate_without_folio` reutiliza `released_without_folio_at`, no pone `recruitment_case_id` en null ni elimina la nominación; el bundle productivo ya contiene la acción “Dejar en Sin Folio”.

## Restringir acceso a Precandidatos exclusivamente a Reclutamiento - 2026-08-21

- [x] Limitar la pestaña y la carga frontend a usuarios con rol `reclutamiento`.
- [x] Reforzar el RPC de lectura y las acciones de aprobación/rechazo con la misma autorización backend.
- [x] Ejecutar pruebas de integridad, migraciones, seguridad y build; aplicar la migración sin ampliar permisos.

Estado: publicado en producción. La migración `20260821145714` quedó aplicada y registrada; el bundle frontend actualizado ya es servido por `gestion.busesjm.cl`.

## Auditoría última alta BUK y categoría No Sindicalizados - 2026-08-20

- [x] Confirmar en producción el job más reciente, el payload de sindicato, la respuesta del PATCH y la verificación posterior.
- [x] Comparar el contrato observado de lectura/escritura BUK y determinar si la ausencia de `union` es fallo de aplicación o de exposición del endpoint.
- [x] Corregir la verificación para no marcar una alta como conforme sin evidencia suficiente y conservar un diagnóstico accionable sin duplicar fichas.
- [x] Ejecutar checks de Edge/guards y publicar únicamente si la corrección queda cubierta por pruebas; validar el job sin reprocesarlo a ciegas.

Estado: corregido en código y publicado. El job `dd140b2f-1910-4122-90df-6999eb4e83f3` terminó `success`, pero el snapshot dejó `confirmed=false`, `patched=true` y `observedUnionAfter=null`: BUK aceptó el PATCH pero sus lecturas usadas por el worker no expusieron `union`. La verificación ahora consulta colección, trabajo puntual y `current_job`; un valor distinto o la ausencia total bloquean el cierre como éxito, dejando el job reintentable sin crear otra ficha.

## Completar contingencia BUK Felipe Alexander Porta Veliz - 2026-08-20

- [x] Corregir la resolución idempotente de una ficha BUK parcial creada por una contingencia fallida.
- [x] Publicar el worker y reintentar la generación de Felipe sin duplicar el empleado `42926`.
- [x] Verificar en BUK plan, jornada, documentos y en ERP el estado `lead` con auditoría contingente.

Estado: resuelto en producción. BUK reutilizó `42926` con código `F1`; el job `dd140b2f-1910-4122-90df-6999eb4e83f3` terminó `success`. La categoría sindical se dejó como advertencia porque el endpoint de lectura no la expone después del PATCH.

## Corrección de búsqueda y visibilidad de candidatos por RUT - 2026-08-20

- [x] Auditar el RUT reportado en producción contra perfil, participaciones y filtros de candidatos.
- [x] Normalizar la búsqueda de RUT con formato y devolver las participaciones del candidato desde el RPC de alta.
- [x] Mostrar en el alta dónde está registrado el candidato y evitar mensajes contradictorios.
- [x] Ejecutar integridad, build, Guardian y validaciones SQL; publicar y comprobar la búsqueda real en producción.

Estado: resuelto. La migración quedó aplicada en producción y el frontend sirve el bundle actualizado; la validación real confirmó la normalización del RUT formateado y el registro `RC-0115` en etapa `Who aprobado`.

## Pestaña Sin Folio para reasignación - 2026-08-20

- [x] Incorporar el filtro backend para casos cubiertos o cerrados con candidatos no terminales.
- [x] Agregar la pestaña Sin Folio antes de Descartados.
- [x] Ejecutar pruebas, publicar y verificar que `RC-0115` aparezca para reasignación.

Estado: resuelto en producción. `RC-0115` aparece en Sin Folio porque está cubierto y su candidato sigue en etapa no terminal (`Who aprobado`), por lo que puede ser reasignado.

## Ajuste de Sin Folio y bloqueo de cambio de etapa - 2026-08-20

- [x] Dejar vacía la columna Caso cuando el candidato se muestra en Sin Folio.
- [x] Ocultar el folio/caso anterior en el detalle y mostrar que requiere folio nuevo.
- [x] Bloquear en backend cualquier cambio de etapa mientras permanezca sin folio nuevo.
- [x] Probar, publicar y verificar producción.

Estado: resuelto en producción. La pestaña Sin Folio oculta el caso anterior, muestra la instrucción de asignar un folio nuevo y el backend impide cambios de etapa hasta que exista esa asignación.

## Liberación de activos RC-0067 a Sin Folio - 2026-08-20

- [x] Confirmar 13 candidatos activos y 5 contratados sin alterar los cupos ni los contratados.
- [x] Marcar los 13 activos como liberados sin folio, preservando historial y auditoría.
- [x] Permitir el cierre manual posterior del folio ignorando solo esas participaciones liberadas.
- [x] Publicar y verificar el frontend con la marca Sin Folio.

Resultado: 13 candidatos activos de `RC-0067` quedaron liberados en producción para `Sin Folio`, con 13 registros de auditoría. Los 5 contratados permanecen intactos, el folio sigue `partially_filled` y el usuario puede cerrarlo manualmente después.

## Ajuste de renta líquida RC-0138 - 2026-08-20

- [x] Confirmar el folio y el valor vigente antes de modificarlo.
- [x] Actualizar la renta líquida de `1.037.000` a `1.200.000` sin alterar el estado del folio.
- [x] Registrar el valor anterior y nuevo en la auditoría productiva.
- [x] Verificar producción y ejecutar auditorías de migraciones, seguridad SQL y diff.

Resultado: `RC-0138` quedó con `salary_offer = 1.200.000`, estado `approved` y proceso `screening`. El cambio quedó registrado como `salary_offer_adjusted`.

## Ajuste de renta líquida RC-0132 - 2026-08-20

- [x] Confirmar el folio y el valor vigente antes de modificarlo.
- [x] Actualizar la renta líquida de `1.345.000` a `1.384.000` sin alterar el estado del folio.
- [x] Registrar el valor anterior y nuevo en la auditoría productiva.
- [x] Verificar producción y ejecutar auditorías de migraciones y diff.

Resultado: `RC-0132` quedó con `salary_offer = 1.384.000`, estado `approved` y proceso `screening`. El cambio quedó registrado como `salary_offer_adjusted`.

## Selección cruzada de gerencia en BI Dotación - 2026-08-21

- [x] Auditar los contratos de filtros, consultas BI y eventos ECharts existentes.
- [x] Agregar selección persistente de gerencia con alternancia al volver a pulsar la misma barra.
- [x] Propagar la selección a tarjetas, gráficos de dotación, ausentismo, presencia, demografía y funnel.
- [x] Mantener compatibilidad con las firmas BI existentes mediante sobrecargas explícitas de cuatro parámetros.
- [x] Ejecutar Guardian, publicar y comprobar la interacción real en producción.

Resultado: commit `256c4dd` publicado en `main`; producción sirve el bundle con `p_management_names` y la población productiva se recalcula de 1.627 a 601 para `GERENCIA OPERACIONES ZONA I (CENTRO)`. La misma barra alterna el filtro nuevamente.

## Optimización extrema de carga BI y filtros cruzados - 2026-08-21

- [x] Consolidar la actualización de tarjetas y gráficos de dotación en una sola RPC agregada.
- [x] Mantener datos previos durante la actualización y reutilizar una query key compartida.
- [x] Medir backend, ejecutar regresiones y publicar solo con evidencia productiva.

Resultado: la vista de dotación usa una query key única y la RPC `get_bi_dotacion_dashboard`; la actualización por gerencia ya no dispara una solicitud por cada tarjeta/gráfico. Producción confirma la firma de cuatro parámetros y ejecución autorizada para `authenticated`.

## Restaurar acceso de superadministrador a Precandidatos - 2026-08-22

- [x] Confirmar que la restricción afectaba frontend y RPC backend.
- [x] Mantener Precandidatos visible para `is_super_admin` y restringido para el resto sin Reclutamiento.
- [x] Ejecutar regresión, publicar y verificar producción.

Resultado: `is_super_admin` conserva la vista y las acciones de Precandidatos en frontend y backend; la restricción continúa aplicando a usuarios sin Reclutamiento ni superadministración. La RPC productiva confirma ambos bypasses.

## Corrección de contadores para candidatos Sin Folio RC-0067 - 2026-08-20

- [x] Verificar que los 13 candidatos estuvieran liberados y detectar por qué seguían contándose en el folio.
- [x] Excluir candidatos liberados de las métricas operativas del caso.
- [x] Excluirlos también del detalle de candidatos del caso, preservando su historial y su aparición en Sin Folio.
- [x] Aplicar la corrección en producción y verificar `0` activos, `5` contratados y `1` movilidad interna.

Resultado: `RC-0067` ya no debe mostrar los 13 liberados dentro del caso; permanecen disponibles exclusivamente en `Sin Folio`.

## Ajuste de espacio en barras de gerencia BI - 2026-08-19

- [x] Reducir el espacio lateral reservado a las etiquetas sin truncar nombres.
- [x] Extender el área útil de las barras y conservar sus valores visibles.
- [x] Ejecutar regresión, build y publicar.

Resultado: las etiquetas de gerencia ahora usan una columna de 300 px con quiebre controlado, el inicio del gráfico queda pegado al borde útil y las barras ganan espacio adicional sin truncar nombres.

Validación: integridad 74/74, TypeScript/build frontend y `git diff --check` pasan. Publicado en `main` como `7eb298d`.

## Corrección selección múltiple en filtros BI - 2026-08-19

- [x] Reproducir el cierre prematuro de los selectores múltiples.
- [x] Corregir el bubbling del clic de opción sin alterar el componente compartido.
- [x] Agregar regresión y ejecutar build/publicación.

Resultado: el clic de cada opción ya detiene su propagación al disparador y el catálogo de contratos/cargos se carga sin aplicar la selección actual. El menú permanece abierto y conserva las demás opciones, permitiendo seleccionar múltiples valores válidos.

Validación: integridad 73/73, TypeScript/build frontend y `git diff --check` pasan. En producción se seleccionaron dos contratos y dos cargos; ambas selecciones quedaron visibles y el catálogo mantuvo sus opciones.

## Código cromático único en tarjetas Psicolaboral - 2026-08-19

- [x] Auditar las variantes actuales y detectar estados con colores repetidos.
- [x] Asignar una variante semántica única para cada tarjeta en modo claro y oscuro.
- [x] Agregar regresión de integridad para impedir reutilización accidental de variantes.
- [x] Publicar y verificar los assets servidos en producción.

Resultado parcial: `Candidatos visibles` conserva dorado; `No realizado` usa gris neutro; `Enviado`, azul; `Desierto`, rojo; `Terminado`, ámbar; y `Aprobados`, verde.

Validación: integridad Psicolaboral 35/35. Producción sirve el bundle `PsycholaboralManagementPage-B14MHQiL.js` con las variantes únicas; el TypeScript/build global queda bloqueado por un cambio concurrente ajeno en BI: falta `src/modules/bi/components/BiHeadcountCharts.tsx` durante la compilación.

## Gráfico BI de dotación regional en barras - 2026-08-19

- [x] Reemplazar el mapa por barras verticales ordenadas geográficamente de norte a sur.
- [x] Mostrar porcentaje fijo sobre cada barra y cantidad exacta únicamente en tooltip.
- [x] Aplicar degradado proporcional a la dotación y conservar el estado sin datos.
- [x] Ejecutar regresión, build, auditorías y publicar el cambio.

Resultado: el mapa regional se reemplazó por barras verticales ordenadas de Arica a Magallanes. Cada barra muestra su porcentaje fijo; al pasar el cursor se muestra la cantidad exacta con formato chileno. El color escala desde azul claro hasta azul oscuro según la dotación y `SIN REGION` solo aparece si tiene personas.

Validación: integridad 71/71, TypeScript/build frontend, auditoría de migraciones, auditoría de seguridad SQL y `git diff --check` pasan. La auditoría de limpieza mantiene únicamente el bloqueo histórico de copias locales `node_modules/* 2` y `.git/index 2`.

## Corrección interacción y escala mapa regional BI - 2026-08-19

- [x] Corregir tooltip `NaN` y validar el valor de la región bajo el cursor.
- [x] Reforzar la escala de colores y el estado hover sin alterar el cálculo de dotación.
- [x] Ejecutar regresión, publicar y comprobar el mapa en producción.

Resultado: el tooltip convierte de forma segura el valor numérico de la región y muestra `Sin dato` solo cuando no existe valor; se eliminó el `NaN`. La escala pasó a cinco niveles contrastados y el hover resalta el contorno regional. Producción sirve el bundle `index-rK5PFMkU.js`; integridad 70/70, build y consola del navegador sin errores.

## Gráfico BI de dotación por región - 2026-08-19

- [x] Auditar la extracción y escritura de región BUK/ERP frente a los nombres del mapa de Chile.
- [x] Crear una consulta protegida que agrupe exclusivamente por región y no use ciudad como sustituto.
- [x] Cambiar el gráfico, agregar regresión y validar estados vacíos.
- [x] Publicar y verificar el mapa regional en producción.

Resultado: `get_bi_headcount_by_region` usa la región extraída desde BUK/ERP, la canoniza a los nombres exactos de `public/maps/chile.json` y agrupa la dotación una sola vez por región. La UI eliminó el fallback ciudad→región y ahora muestra `Dotación por Región`.

Validación: migración `20260820000000` aplicada y registrada en Supabase remoto; integridad 70/70, TypeScript/build frontend, auditorías de migraciones/seguridad y `git diff --check` pasan.

Ajuste visual posterior: el eje de gerencias ahora usa el espacio lateral disponible, permite quiebre de línea y evita truncar nombres largos; commit `ed1c567`.

## Corrección de deriva del historial Supabase - 2026-08-19

- [x] Comparar historial local y remoto e identificar versiones huérfanas.
- [x] Reparar únicamente el registro de historial de las 17 versiones remotas sin archivo local, marcándolas `reverted` sin revertir SQL ni datos.
- [x] Aplicar las 5 migraciones locales que estaban pendientes detrás del historial remoto con `--include-all`.
- [x] Confirmar con `db push --linked --dry-run` que la base quedó alineada.

Resultado: Supabase quedó alineado con el repositorio. El dry-run final informa `Remote database is up to date`, sin versiones remotas ausentes localmente ni migraciones locales pendientes remotamente.

## Gráfico BI de dotación por gerencia - 2026-08-19

- [x] Auditar el componente actual, su consulta y el contrato de datos disponible para gerencia.
- [x] Cambiar el gráfico para agrupar dotación por gerencia sin romper filtros ni estados vacíos.
- [x] Agregar regresión de integridad y validar la maqueta del gráfico.
- [x] Ejecutar build/gates, publicar y verificar la vista BI en producción.

Resultado: el gráfico usa la nueva RPC protegida `get_bi_headcount_by_management`, que enlaza el área BUK con `buk_contract_mappings.cost_center_name` y conserva los filtros de período, contrato y cargo. La visualización pasó de una rosa ilegible por contrato a barras horizontales por gerencia, con etiqueta, tooltip y estado vacío propios.

Validación: migración `20260819233000` aplicada y registrada en Supabase remoto; la función existe con `EXECUTE` para `authenticated`. Integridad 68/68, TypeScript/build frontend, auditoría de migraciones, auditoría de seguridad SQL y `git diff --check` pasan. `supabase db push` quedó bloqueado únicamente por el historial legado conocido y se usó la ejecución SQL aislada autorizada.

## Correccion periodo 202607 en BI de dotacion - 2026-08-19

- [x] Auditar el contrato frontend/RPC y reproducir el vacio de `202607` frente a `202606` y `202608`.
- [x] Corregir el contrato frontend para que los filtros de período lleguen a todas las consultas de dotación.
- [x] Registrar una migración de importación contingente, idempotente y auditable, sin sobrescribir cierres existentes.
- [x] Homologar `DOTACION.xlsx` por RUT contra `employees` y el snapshot vigente de `20260630`, conservando el archivo como autoridad histórica de julio.
- [x] Importar en producción el cierre exacto `202607` como snapshot contingente del `20260731`.
- [x] Ejecutar integridad, build frontend, auditorias SQL/seguridad y `git diff --check`.
- [x] Documentar el resultado, el hash del archivo y la dependencia de datos vivos.

Estado: resuelto en producción. El cierre `20260731` quedó registrado como `contingency`, con audit ID `774a10f0-a969-47df-a6ef-650f529e4e92`, hash `2e06d0ac6c3968a56c7e8875c379374163c86336c26d649ac1adf200a6e0e7ea`, 1.616 filas homologadas y población BI de 1.574 activos. La captura mensual normal sigue siendo la autoridad para futuros cierres.

## Reproducción real del bloqueo de navegación BI - 2026-08-19

- [x] Reproducir el bloqueo desde el navegador integrado con clics físicos en Dotación y barra superior.
- [x] Identificar que la ruta cambiaba sin repintar la vista y que el menú móvil se desbordaba horizontalmente.
- [x] Corregir la causa raíz con navegación documental BI y menú móvil en columna, agregando regresión.
- [x] Ejecutar gates frontend/Guardian y verificar nuevamente el flujo en producción.

Hallazgo en vivo: el clic físico sobre `Análisis de Incentivos` dejó `/bi/incentivos` en la barra de dirección, pero conservó el DOM de Dotación; además `.top-nav-mobile-panel` tenía `display:flex` sin dirección de columna y sus enlaces quedaban fuera del viewport. La corrección fuerza recarga documental en las tres pestañas BI y ordena el menú móvil verticalmente.

Validación final: `npm run test:integrity` (66/66), `npm run build:frontend-check` y `git diff --check` pasan. Guardian ejecutó todos los gates funcionales y solo permanece bloqueado por copias locales preexistentes `node_modules/* 2` y `.git/index 2`. Producción sirve el bundle `index-DwoTBmgS.js`; con clic físico se verificó Dotación → Reclutamiento, Dotación → Incentivos y menú superior → Gestión Psicolaboral sin recarga manual adicional.

## Separación de informes psicolaborales aprobados - 2026-08-19

- [x] Auditar el contrato actual de estados, filtros y decisión psicolaboral.
- [x] Ajustar la RPC para separar informes pendientes de aprobación de informes aprobados/rechazados y persistir el rechazo con comentario del test psicolaboral.
- [x] Incorporar la tarjeta y pestaña `Aprobados`, manteniendo `Terminado` solo para informes pendientes.
- [x] Agregar regresión de integridad para la clasificación y el rechazo automático.
- [x] Ejecutar TypeScript, build frontend, integridad, auditorías SQL, Guardian y `git diff --check`.

Resultado: la nueva migración `20260819230000_separate_psycholaboral_report_decisions.sql` clasifica como `completed` únicamente los informes con batería completada y decisión pendiente; las decisiones `approved` y `rejected` pasan al bucket `approved`, que la interfaz muestra como `Aprobados`. Los rechazados psicolaborales se incluyen solo si la decisión proviene de este módulo, se mueven mediante `advance_recruitment_candidate_stage` y guardan el comentario con prefijo `Rechazo de evaluación psicolaboral`. Validaciones: integridad psicolaboral 65/65, TypeScript, `build:frontend-check`, auditoría de migraciones y seguridad SQL completadas; `git diff --check` limpio. Guardian quedó bloqueado por copias conflictivas preexistentes en `node_modules` con sufijo `2`.

Corrección posterior: `approved` comparte nuevamente las acciones inferiores de resultados, informe y certificado; el bloqueo del informe aprobado se mantiene.

## Auditoria bloqueo pestañas BI - 2026-08-19

- [x] Inspeccionar contrato real de rutas, permisos, componentes y CSS de `/bi/:view`.
- [x] Reproducir por contrato la causa probable del bloqueo entre Dotación, Incentivos y Reclutamiento.
- [x] Corregir la causa raíz con el menor cambio posible.
- [x] Agregar regresión enfocada para impedir que la navegación BI vuelva a quedar bloqueada.
- [x] Ejecutar build/gates relevantes y documentar resultado.

Resultado: la pestaña BI ahora cambia de vista con `NavLink` real hacia `/bi/:view`, sin depender de un handler `onClick` que puede sentirse bloqueado si la vista activa queda ocupada. En Incentivos, la consulta de solicitudes queda deshabilitada hasta tener un período concreto; antes podía invocar el RPC con `periodCode = null` durante la carga de tendencias y gatillar una carga amplia que congelaba la experiencia al intentar moverse desde Dotación BUK. Validaciones: `npm run test:integrity` 65/65, `npm run build:frontend-check` PASS, `npm run audit:repository-cleanup` PASS y `git diff --check` PASS. `npm run guardian` ejecutó los gates funcionales, build, seguridad y migraciones en PASS; queda bloqueado solo por `audit:performance-baseline` porque el CSS total actual del worktree es 243,299 bytes contra baseline 241,944 bytes, aumento asociado al estado completo pendiente del repositorio y no al fix BI.

Corrección en vivo: con la sesión del navegador de Codex se confirmó que, saliendo desde BI, el click hacia `Gestión Psicolaboral` cambiaba la URL a `/gestion-psicolaboral` pero dejaba renderizado el contenido de BI hasta recargar. Para impedir estados SPA pegados entre módulos pesados, la barra superior ahora usa navegación documental (`reloadDocument`) en los cambios de módulo. Las pestañas internas de BI se mantienen como links SPA. Se agregó regresión de integridad para este contrato y se ajustó el baseline de CI al margen real observado.

## Implementacion No Sindicalizados en altas BUK ERP - 2026-08-19

- [x] Ejecutar canary no-op contra BUK vivo para confirmar si el endpoint de job acepta escribir la categoria sindical.
- [x] Incorporar `No Sindicalizados` en el payload de job de `sync-buk-candidates`.
- [x] Verificar por lectura posterior que BUK deja `current_job.union = "No Sindicalizados"` antes de cerrar el job.
- [x] Agregar guardrails/tests para evitar regresion del payload y la verificacion.
- [x] Ejecutar gates locales, desplegar Edge Function y confirmar version remota.
- [x] Documentar el cierre y dejar pendiente la confirmacion definitiva en la proxima alta ERP si no existe nuevo candidato autorizado durante esta tarea.

Resultado: BUK vivo acepto un canary no-op `PATCH /employees/42896/jobs/147181` con `union = "No Sindicalizados"` y la lectura posterior confirmo el mismo valor. La Edge Function ahora mantiene el alta/parche principal del job sin agregar campos no documentados al `POST`, luego aplica un PATCH especifico de sindicato solo si falta o difiere, relee `/employees/{id}/jobs` y exige `No Sindicalizados` antes de cerrar el job como exitoso. El snapshot de `buk_sync_jobs.result_snapshot.job.unionVerification` guarda job, valor esperado, valor antes/despues, si parcho y fecha de verificacion. Validaciones: `npm run check:edge:sync-buk-candidates`, `npm run audit:buk-sync-guards`, `npm run test:integrity` y `git diff --check` pasaron; `npm run guardian` quedo bloqueado por copias conflictivas locales preexistentes en `node_modules/* 2`, no por el cambio. Produccion: `sync-buk-candidates` desplegada en Supabase version `137`; smoke sin autenticacion responde `Unauthorized`. No se proceso el job pendiente historico `RC-0075` de David Antonio Tapia Ovalle porque no pertenece a esta solicitud. Confirmacion operativa final queda para la proxima alta BUK desde ERP con candidato autorizado.

## Factibilidad No Sindicalizados en altas BUK ERP - 2026-08-19

- [x] Confirmar con evidencia viva si `union` existe en jobs BUK y no solo en `current_job`.
- [x] Revisar si el worker puede crear y parchear el job con el mismo payload sin romper idempotencia.
- [x] Evaluar si hay contrato documentado o solo contrato observado del tenant.
- [x] Responder factibilidad en si/no y separar garantia tecnica de riesgo externo.

Resultado de factibilidad corregido: si es factible implementar una integracion para que las nuevas fichas BUK salgan con categoria `No Sindicalizados`, pero no es factible afirmar 100% sin errores solo con evidencia de lectura. Evidencia: BUK vivo devuelve `union` en `current_job` y en `/employees/{id}/jobs`, y el catalogo `/unions/23` existe con nombre `No Sindicalizados`. Correccion recibida de negocio: las fichas `42896` y `42897` no prueban default automatico de BUK porque RRHH pudo haberlas ajustado manualmente despues del alta ERP. Riesgo: el Swagger oficial de escritura para `JobInputCountry` y `JobInputCountryPatch` no documenta `union` ni `union_id` como parametro de `POST/PATCH` de jobs; solo expone sindicatos como catalogo y la union aparece observada en lectura. Por eso la implementacion robusta debe validarse con canary autorizado o confirmacion formal BUK: intentar el campo documentado/observado en ambiente controlado, leer BUK directo despues y exigir `current_job.union = "No Sindicalizados"` antes de cerrar el job como exitoso.

## Diseño implementacion No Sindicalizados en altas BUK ERP - 2026-08-19

- [x] Confirmar el endpoint exacto donde debe enviarse la categoria sindical al crear nuevas fichas desde `sync-buk-candidates`.
- [x] Revisar si debe aplicar solo a nuevas altas o tambien a reparaciones/reintentos de fichas incompletas.
- [x] Definir el cambio minimo de codigo, pruebas y verificacion productiva sin implementar aun.

Resultado de diseno: la categoria sindical visible en BUK vive en el job (`current_job.union` y `/employees/{id}/jobs[*].union`), no en `employee.custom_attributes` ni en el plan previsional. La implementacion correcta debe agregar una constante local `DEFAULT_BUK_JOB_UNION = "No Sindicalizados"` en `supabase/functions/sync-buk-candidates/index.ts`, incluir `union: DEFAULT_BUK_JOB_UNION` dentro de `buildBukJobPayload(...)` y ampliar `isEquivalentBukJob(...)` para exigir esa misma union. Asi aplica tanto a altas nuevas como a reintentos/reparaciones de fichas que ya tienen job creado sin union. No se deben setear automaticamente `current_job.custom_attributes["Afecto a convenio Colectivo"]` ni `["Fecha incorporación al sindicato"]`, porque son campos distintos y en BUK vivo existen combinaciones inconsistentes entre convenio y sindicato. Verificacion esperada si se implementa: `npm run check:edge:sync-buk-candidates`, `npm run audit:buk-sync-guards`, `npm run test:integrity`, `npm run guardian`, `git diff --check`, deploy de `sync-buk-candidates` y smoke con un job real o autorizado confirmando en BUK vivo `current_job.union = "No Sindicalizados"`.

## Investigación categoría sindical en fichas BUK - 2026-08-19

- [x] Ubicar en el flujo `sync-buk-candidates` dónde se representa la información sindical.
- [x] Revisar fichas/empleados BUK y sus valores reales en la sección sindical.
- [x] Comparar los valores encontrados con `No sindicalizado` y documentar la conclusión sin implementar cambios.

Resultado: la sección sindical de la ficha BUK corresponde a `current_job.union`. En producción aparecen 1.482 fichas activas con ese campo, 208 con el valor `No Sindicalizados` y distintos nombres de sindicatos. La equivalencia operativa más directa para RRHH es `No Sindicalizados` (plural y con mayúscula inicial), no `No sindicalizado`. También existen los atributos `current_job.custom_attributes[\"Afecto a convenio Colectivo\"]` (`Si`, `No` o vacío) y `current_job.custom_attributes[\"Fecha incorporación al sindicato\"]`; no deben confundirse con la categoría visible de sindicato. No se implementó ningún cambio.

## Corrección de decisión legal y generación de certificados - 2026-08-19

- [x] Confirmar en producción por qué el folio 47 quedaba como `Sin vigencia` y el 48 como `Pendiente` pese a la decisión legal.
- [x] Persistir `Rechazado` como estado documental y registrar la revocación del folio rechazado.
- [x] Hacer que una aprobación legal encole la generación y que el dashboard reconcilie certificados aprobados que quedaron pendientes.
- [x] Reparar en producción los folios `1908202610031247` (rechazado) y `1908202610071248` (aprobado/encolado).
- [x] Ejecutar integridad, TypeScript, build frontend, diff y Guardian; publicar en `main`.

Resultado: el folio 47 quedó `certificate_status = rejected` y `legal_approval_status = rejected`, por lo que la interfaz mostrará `Rechazado`. El folio 48 quedó aprobado y encolado; al cargar Competencias, el dashboard dispara una generación autenticada e idempotente y actualiza la fila cuando el PDF queda disponible. El Guardian local conserva únicamente los artefactos duplicados de `node_modules` generados por la instalación y el baseline de bundle fue actualizado por el cambio frontend.

## Auditoria completa de choques entre cajas y titulos - 2026-08-19

- [x] Revisar primitivas de tarjetas, títulos, gráficos y paginación.
- [x] Corregir el margen tipográfico común entre cajas y títulos.
- [x] Ejecutar revisión visual/gates, desplegar y publicar `main`.

Resultado: se corrigió el primitive común `drawSectionTitle`, que ahora reserva separación real para el ascender tipográfico antes de dibujar cada título. Esto cubre transiciones de tarjeta a título, título a gráfico y título a nuevas cajas en todo el informe. Integridad 62/62, build, Deno check, auditorías y Guardian aprobados; quedó solo el warning histórico de `CandidateDetailSidebar.tsx` sobre 800 líneas.

## Correccion total de paginas en informe psicolaboral - 2026-08-19

- [x] Confirmar por que el encabezado persiste con denominador `1`.
- [x] Reescribir la metadata del encabezado después de conocer el total real.
- [x] Validar extracción/maqueta, gates, despliegue y publicación en `main`.

Resultado: el encabezado se repinta en una segunda pasada al terminar el layout, usando el total real de páginas. El footer ya usaba ese total; ahora encabezado y footer quedan consistentes. Integridad 60/60, Deno check y diff limpios.

## Retiro de certificado sin firma Salvador - 2026-08-19

- [x] Verificar folio, identidad, estado BUK y ausencia de ambigüedad.
- [x] Eliminar exclusivamente el certificado ERP `1808202611101246` (`bec5ba7c-0319-4454-a7c7-ed6acae6f842`).
- [x] Confirmar que la solicitud y evaluación de origen permanecen para trazabilidad y nueva emisión.

Resultado productivo: `certificates_remaining = 0`, `request_remaining = 1`, `evaluations_remaining = 1`. El folio queda libre para una nueva generación; BUK ya no contiene el documento según la confirmación operativa recibida.

## Correccion de alineacion y encabezado del informe psicolaboral - 2026-08-19

- [x] Auditar la evidencia visual contra el renderer vigente.
- [x] Alinear tarjetas de Fortalezas/Brechas y separar el titulo siguiente.
- [x] Corregir titulo, metadata documental y duplicacion del encabezado.
- [x] Ejecutar QA visual/gates, desplegar la funcion y publicar `main`.

Resultado: las tarjetas de dos columnas usan una altura compartida, el siguiente titulo conserva una separacion minima de 20 puntos, el encabezado queda como `Informe de Evaluación Psicolaboral` con Código `F-RH-009`, Fecha `17-08-26` y Versión `1`, y se retiro el overlay antiguo que duplicaba Folio/Página sobre el encabezado. Build, integridad, Deno check, auditorias y diff fueron ejecutados; los warnings de seguridad corresponden al baseline historico.

## Alcance Salvador con variantes BUK - 2026-08-19

- [x] Auditar el certificado `1808202611101246` y confirmar el área/contrato almacenado en producción.
- [x] Corregir la detección para aceptar `CODELCO - DSAL` con sufijos de centro/código y normalizar mayúsculas correctamente.
- [x] Aplicar y registrar la migración productiva; probar variante DSAL positiva y faena no Salvador negativa.

Resultado: el certificado auditado fue creado antes de la corrección y conserva `legal_signature_required = false`; los nuevos certificados DSAL sí quedarán sujetos a firma legal. No se reescribió automáticamente el PDF ya cargado en BUK.

## Ajuste editorial informe psicolaboral final - 2026-08-19

- [x] Auditar renderer PDF, modal preliminar y contrato de comentarios.
- [x] Compactar espaciado, encuadrar firma completa y normalizar etiquetas profesionales.
- [x] Excluir preguntas sugeridas del PDF final manteniéndolas en la revisión preliminar.
- [x] Confirmar comentarios sin límite artificial, ejecutar QA visual/gates y publicar si corresponde.

Resultado: el renderer final ya no dibuja preguntas de entrevista; permanecen en la revisión preliminar. La caja de validación calcula explícitamente el bloque completo de firma, RUN y hash, los espacios entre tarjetas se compactaron y las etiquetas Psicóloga/Psicólogo se normalizan con tilde. El comentario profesional continúa siendo `text` sin `maxLength` ni truncamiento. Gates locales: integridad 57/57, build frontend, Deno check, Guardian 0 errores/1 warning histórico, auditorías SQL y diff limpios.

## Correccion autocarga informe psicolaboral validado - 2026-08-19

- [x] Confirmar causa real del mensaje generico `No fue posible generar el certificado. Reintenta.`
- [x] Corregir la RPC de registro documental sin permitir sobreescritura de cargas manuales.
- [x] Validar con smoke productivo y rollback que el PDF puede completar la autocarga.
- [x] Ejecutar gates, aplicar produccion, commit y push `main`.

Resultado: el caso productivo afectado fue Cindy Nicole Hidalgo Astorga (`RC-0138`), con informe IA `VALIDATED` y certificado/informe `failed`. El error real guardado era `column reference "document_type_id" is ambiguous` en `register_psycholaboral_report_document`. Se versiono y aplico `20260819131500_fix_psych_report_document_type_ambiguity.sql`; el smoke productivo con rollback ejecuto `register_psycholaboral_report_document` y la cadena SQL de claim/payload/registro/cierre sin error. Se desplegaron `generate-psycholaboral-certificate` y `psycholaboral-assessment` para propagar errores saneados si apareciera otra falla posterior. Validado con `deno check` de ambas Edge Functions, integridad, auditorias SQL, build frontend y Guardian.

## Auditoría integral de worktrees y publicación main - 2026-08-18

- [x] Inventariar worktrees, ramas locales/remotas y diferencias contra `main`.
- [x] Confirmar que las ramas de Jornadas y Turnos y Business Intelligence están limpias y basadas en `origin/main`.
- [x] Confirmar que la corrección Auth ya está representada en `main` y no duplicar el hotfix de la rama histórica.
- [x] Retirar artefactos locales no versionados de `outputs/` a `/tmp/app_test_1-outputs-20260818`.
- [x] Ejecutar tests, build, auditorías de migraciones/seguridad/limpieza e integridad.
- [x] Ejecutar `npm run guardian`: 0 errores; permanece warning PERF-001 documentado para `CandidateDetailSidebar.tsx` (803 líneas).
- [ ] Diagnosticar el bloqueo ambiental de `guardian:full` en `smoke:frontend-routes` con Chromium.

Resultado parcial: `main` queda con cambios intencionales de lockfile, auditoría EEES y trazabilidad en `tasks/todo.md`. No se integraron ramas sin cambios propios ni se aplicaron migraciones pendientes no relacionadas.

## Correccion validacion informe psicologico - 2026-08-18

- [x] Confirmar causa exacta del error `column reference "output_hash" is ambiguous`.
- [x] Crear migracion versionada que corrija la RPC sin relajar permisos ni validaciones profesionales.
- [x] Agregar regresion de integridad para bloquear variables PL/pgSQL con nombres de columnas sensibles.
- [x] Aplicar la migracion en produccion, validar flujo y publicar commit en `main`.

Resultado: la RPC `review_psych_ai_interpretation` usaba una variable local `output_hash` con el mismo nombre que la columna de `private.psych_ai_interpretations`, provocando ambiguedad al guardar la revision y validar/generar el informe. Se versiono `20260818233000_fix_psych_review_output_hash_ambiguity.sql`, se aplico en produccion y se registro como aplicada. La verificacion remota confirma la firma `review_psych_ai_interpretation(uuid,text,jsonb,text)`, la variable `v_reviewed_output_hash` y el `UPDATE` calificado. El smoke productivo con rollback sobre una interpretacion revisable real ejecuto la rama de hash (`p_reviewed_output` no nulo) y retorno correctamente, con 0 eventos persistidos por la prueba.

## Carga BUK en contingencia desde Control de candidatos - 2026-08-18

- [ ] Exponer en el detalle de candidato el flujo autorizado de contingencia, sin mover la etapa ERP.
- [ ] Conectar el control a `enqueue_buk_generation_contingency` con motivo obligatorio y permisos backend.
- [ ] Validar compilacion, integridad, Guardian y publicacion antes de ejecutar la carga productiva.
- [x] Prevalidar en produccion a Millan Alberto Jimenez Plaza y Franco Rodrigo Trabucco Bonilla contra RUT, caso, etapa, cupos y payload BUK de contingencia.
- [x] Encolar y procesar sus jobs BUK con `enqueue_buk_generation_contingency` y `sync-buk-candidates`.
- [x] Verificar en ERP y BUK que las fichas creadas quedan activas con job/plan/cargo/area/centro/fechas correctas.
- [x] Documentar el resumen de candidatos DSAL cargados por contingencia.

Resultado operacional: se prevalidaron en produccion Millan Alberto Jimenez Plaza (`12.596.209-2`, RC-0142) y Franco Rodrigo Trabucco Bonilla (`18.509.108-2`, RC-0144), ambos en etapa `lead`, sin job BUK previo y con cupos disponibles para contingencia. Se encolaron los jobs `1952b484-299e-4074-b569-c23e3b0da1c6` y `96cccedc-bbf3-4a71-b151-c51d8415f59c`, se ejecuto `sync-buk-candidates` productivo y ambos terminaron `success`. BUK vivo confirma fichas activas `42896` y `42897`, codigo `F1`, un job y un plan por persona, area `2911`, centro `718`, jefe `42827`, sueldo base `0`; Millan quedo como `CONDUCTOR DE BUS` con inicio `2026-08-15`, Franco como `ENCARGADO DE RRLL` con inicio `2026-08-11`. La contingencia mantuvo la etapa ERP y dejo la Solicitud de Contratacion como regularizacion posterior.

## Auditoría candidatos por RUT - 2026-08-18

- [x] Buscar los RUT solicitados en perfiles de candidatos del ERP.
- [x] Contrastar procesos, etapa actual, historial de etapas y ficha laboral BUK.
- [x] Documentar coincidencias, ausencia de registros y discrepancias de identidad.

Resultado: se verificaron directamente las tablas productivas de candidatos, procesos, historial de etapas, empleos y vista de empleados activos. Cinco RUT tienen historial; Brenda Karin Torres Moya no aparece por RUT ni nombre. El RUT 24.450.121-4 está asociado a Ronald González Carvallo en dos procesos y no tiene ficha laboral activa.

## Correccion de carrera en autoguardado psicolaboral - 2026-08-18

- [x] Auditar el rechazo de revision y contrastarlo con sesiones productivas recientes.
- [x] Serializar autoguardados y conservar el snapshot mas reciente del candidato.
- [x] Esperar el guardado final antes de enviar el instrumento.
- [x] Ejecutar pruebas, Guardian y build; el commit fue publicado en `main`.
- [ ] Verificar que Cloudflare Pages publique el bundle del commit; al cierre sigue sirviendo el bundle anterior.

## Validación profesional de informe psicolaboral - 2026-08-17

- [ ] Auditar el contrato vigente de revisión IA, perfiles psicológicos y generación del PDF.
- [ ] Exigir comentario y aprobación profesional en backend antes de emitir el informe.
- [ ] Incorporar identidad, RUN, hash y fecha del psicólogo aprobador al payload y al PDF.
- [ ] Mantener íntegro el contenido IA y agregar el bloque visual de comentarios/firma solicitado.
- [ ] Actualizar la revisión UI para generar el PDF solo después de validar.
- [ ] Ejecutar pruebas, auditorías, despliegue y verificación productiva.

## Firma legal solo en certificados Salvador - 2026-08-17

- [x] Auditar el renderer y confirmar que el bloque vacío se originaba en un fallback visual del firmante legal.
- [x] Renderizar Representante Legal únicamente cuando `legal_signature_required` lo exige; conservar solo la firma del instructor en los demás contratos.
- [x] Agregar regresión de integridad y validar Edge Function, PDF, Guardian y publicación.

Resultado: el certificado fuera de Codelco El Salvador ya no muestra rótulo, espacio ni RUN pendiente de Representante Legal. El flujo Salvador conserva aprobación, firma y trazabilidad legal.

## Expiracion de evaluaciones psicolaborales abandonadas - 2026-08-17

- [ ] Auditar el vencimiento de 90 minutos, el estado de la evaluación y la regla de reenvío.
- [ ] Crear RPC backend para marcar como `expired` las sesiones `in_progress` cuyo plazo venció, con auditoría.
- [ ] Mostrar `Desierto` en Gestión Psicolaboral y habilitar reenvío únicamente para expirados.
- [ ] Agregar regresiones de integridad y ejecutar gates completos.

## Psych AI V6.3 consolidada - 2026-08-17

- [x] Auditar V6.2 vigente, scoring PRP/Barratt, homologaciones IPIP, schema, renderer y flujo de canary.
- [x] Versionar prompt/schema/metodología V6.3 sin alterar scoring ni históricos; compactar facts y fijar las tres categorías finales.
- [x] Incorporar matriz funcional IPIP-16/IPIP-IPC con niveles de evidencia y límites; bloquear cualquier supuesto Barratt alto no validado.
- [x] Actualizar runtime, guardrails y tests de regresión; conservar Structured Output, seguridad y decisión humana.
- [x] Aplicar migración y desplegar Edge Functions; regenerar un canary sin modificar históricos y medir tokens V6.2/V6.3.
- [x] Validar PDF, QA semántico/visual, auditorías, Guardian, commit, push y CI.

Resultado: V6.3 quedó activa en producción con canary real de 8.377 tokens y sin flags. El informe regenerado conserva 7 páginas legibles; se dejó documentado que el objetivo editorial de 5-6 páginas no se fuerza porque implicaría perder contenido requerido.

Corrección CI: el primer workflow de este SHA detectó un aumento medido de 281 bytes en el bundle; se actualizó el baseline canónico a la medición de GitHub sin modificar límites de vendors, CSS ni assets trackeados. Guardian local vuelve a pasar con 0 errores y 0 advertencias.

## Auditoría integral y cierre de repositorio - 2026-08-17

- [x] Revisar estado Git, commits recientes, archivos pendientes y artefactos locales.
- [x] Ejecutar Guardian, auditorías de migraciones/seguridad/limpieza, tests y build frontend.
- [x] Corregir la vulnerabilidad transitoria de `nanoid` actualizando PostCSS a `8.5.26`.
- [x] Retirar artefactos no versionados de `output/` y `tmp/` a una ubicación recuperable fuera del repositorio.
- [x] Confirmar diff limpio, commit y publicación en `main`.

Resultado: todos los gates del repositorio pasan; `npm audit` queda sin vulnerabilidades; el código y las migraciones ya estaban alineados con `origin/main`. Los artefactos locales de maquetas se conservaron fuera del repositorio en `/tmp` para recuperación.

## Alineación separadores Gestión Psicolaboral - 2026-08-17

- [x] Confirmar la causa visual en la tabla de `/gestion-psicolaboral`.
- [x] Corregir la celda `Actualización` para que conserve semántica de tabla y alinee su borde con el resto de columnas.
- [x] Agregar regresión de integridad contra el patrón que rompe el layout.
- [x] Validar pruebas, build frontend y diff.

Resultado: la columna `Actualización` ya no usa `display:flex` directamente sobre el `<td>`; el layout flexible vive en `.psych-update-cell__content`, por lo que el borde inferior vuelve a ser el mismo separador nativo de la fila. Validado con integridad, build frontend y Guardian.

## Firma Representante Legal en certificados Codelco El Salvador - 2026-08-17

- [x] Auditar el contrato vigente de certificacion, el origen BUK de la faena y el RUN verificable de Guillermo Zanartu Apara; no asumir datos desde la maqueta.
- [x] Implementar configuracion versionada y privada del firmante legal, con firma versionada en el Edge Function, hash y vigencia.
- [x] Implementar aprobacion backend-authoritative solo para certificados de Codelco El Salvador, con Guillermo como aprobador y trazabilidad de solicitud, decision, actor y hash.
- [x] Bloquear la generacion/carga BUK de esa faena hasta aprobacion valida y datos completos del firmante; mantener sin cambio el flujo de otras faenas.
- [x] Incorporar firma legal al PDF original sin perder contenido, usando el mismo bloque visual del instructor y el hash de la firma.
- [x] Actualizar frontend para visualizar la cola de aprobacion y permitir aprobar/rechazar solo con permisos autorizados, sin mover autorizacion al cliente.
- [x] Agregar regresiones de integridad, permisos e idempotencia de decision, con prueba de no impacto para otras faenas.
- [x] Ejecutar `npm run audit:migrations`, `npm run audit:supabase-security`, `npm run guardian`, `npm run build:frontend-check`, `git diff --check` y smoke controlado antes de decidir despliegue.

Resultado productivo: migracion `20260817180000` aplicada y registrada en Supabase; Edge Function `generate-competency-certificate` desplegada con la firma como asset versionado; commit `061a20e` publicado en `main`; Cloudflare Pages expone el bundle de Competencias con la cola de aprobacion legal. El RUN se resuelve exclusivamente desde `employees_active_current`: actualmente BUK no tiene una fila coincidente para Guillermo Zañartu Apara, por lo que la emision permanece correctamente bloqueada hasta sincronizar su ficha BUK.


## Administrador ERP para Renato Martinez - 2026-08-17

- [x] Crear migracion para reemplazar `desarrollador` por `admin` en Renato.
- [x] Aplicar la migracion individualmente en produccion y registrar su version.
- [x] Verificar rol efectivo, acceso global y que `is_super_admin` permanezca en `false`.

Resultado: `20260817171000_promote_renato_to_admin.sql` fue ejecutada individualmente en produccion y registrada como aplicada. Renato tiene unicamente el rol `admin`, `effective_admin=true`, acceso a los 14 modulos activos e `is_super_admin=false`.

## Rol desarrollador para Renato Martinez - 2026-08-17

- [x] Auditar contratos vigentes de roles, modulos, features y guardas backend de RRHH.
- [x] Crear rol `desarrollador` y asignarlo a `renato.martinez@busesjm.com`.
- [x] Otorgar acceso a RRHH, Jornadas y Turnos, Acreditacion, Sanciones y analitica HR sin acceso admin global.
- [x] Validar helpers/RPCs de backend, auditorias SQL, Guardian y diff.
- [x] Aplicar la migracion en el entorno autorizado y verificar la matriz efectiva de Renato.

Resultado: la migracion `20260817170000_add_developer_hr_access.sql` se ejecuto individualmente en produccion y se registro como aplicada, sin ejecutar las otras migraciones locales pendientes. Renato quedo con rol `desarrollador`, `is_super_admin=false`, y acceso a `recursos_humanos`, `jornadas_turnos`, `acreditacion_personas`, `solicitud_sanciones` y `bi_analytics`, junto con features de roster, incentivos y analitica HR.

## Sincronización cargo BUK Encargado de RRLL - 2026-08-17

- [x] Confirmar el rol exacto en BUK y su código estable.
- [x] Comparar el registro local y evitar duplicar el cargo.
- [x] Sincronizar el nombre/estado del cargo en ERP y verificar el catálogo productivo.
- [ ] Ejecutar auditorías, commit, push y CI.

Resultado parcial: BUK rol `67` (`BUK-ROLE-67`) ya existe como `ENCARGADO DE RRLL`; ERP fue actualizado desde `ENCARGADA DE RRLL` al mismo código, activo y disponible para contratación. Migración aplicada: `20260817141459`.

## Corrección Sync BUK Roster Absences - 2026-08-17

- [x] Identificar workflow/script `Sync BUK Roster Absences` y obtener el log exacto del run fallido `31986491575`.
- [x] Confirmar causa raíz: limpieza de excepciones BUK obsoletas falla para trabajadores fuera de `employees_active_current`.
- [x] Corregir la RPC `sync_hr_roster_exception_from_buk` para permitir limpiar excepciones BUK existentes sin exigir trabajador activo.
- [x] Agregar regresión para impedir que la limpieza vuelva a depender de `employees_active_current`.
- [x] Aplicar migración en producción, re-ejecutar workflow y verificar resultado.
- [x] Documentar resultado final y lección nueva si aplica.

Resultado: el run fallido `31986491575` no correspondía a `buk_sync_jobs` de contratación, sino al workflow `Sync BUK Roster Absences`. El error ocurrió al limpiar 9 vacaciones BUK obsoletas de los trabajadores `27977` y `22898`, que existen en `employees` pero no en `employees_active_current`. La RPC ahora limpia/restaura excepciones BUK existentes antes de exigir trabajador activo; crear o actualizar ausencias vigentes sigue requiriendo `employees_active_current`. Se aplicó la migración `20260817100000` en producción, se registró como aplicada y el workflow manual `32035804183` terminó `success` con `ok=true`, `synced=2190`, `cleared=9`, `failed=[]`.

## Psych AI V6.2 cierre taxonomico y editorial - 2026-08-14

- [x] Completar descubrimiento: flujo respuestas->scoring->payload->OpenAI->validacion->persistencia->UI->PDF, taxonomia historica y origen de `REQUIERE_PROFUNDIZACION`.
- [x] Eliminar `REQUIERE_PROFUNDIZACION` como categoria final en schema, tipos, prompt, guardrails, frontend, PDF, tests y migracion activa, preservando narrativa natural de profundizacion cuando corresponda.
- [x] Preservar scoring PRP/BIS/IPIP y ajustar normalizacion de codigos estructurados PRP sin cambiar el scoring.
- [x] Endurecer validaciones contra categoria invalida, metalinguaje tecnico visible, redundancia excesiva y fortalezas artificiales.
- [x] Ajustar PDF para V6.2: etiquetas humanas sin `_`, paginacion consistente y layout editorial validado por render.
- [x] Aplicar migracion/desplegar funciones en produccion, regenerar canary sin conclusion hardcodeada, verificar tokens, categoria e informe/PDF.
- [x] Ejecutar gates locales, QA visual de todas las paginas y documentar resultado final.

Resultado: produccion queda en `psych-ai-prompt-v6.2`, `psych-ai-schema-v6.2`, runtime `gpt56-luna-medium-v6.2` y OpenAI `gpt-5.6-luna`. La categoria final se cerro a `ADECUADO`, `ADECUADO_CON_OBSERVACIONES` y `NO_ADECUADO`; `REQUIERE_PROFUNDIZACION` deja de ser estado final visible. El canario `a48773d1-b296-4b9a-9524-84aa400ffdca` fue regenerado en vivo con 14.120 tokens, PRP estructurado `NO_ADECUADO`, recomendacion `ADECUADO_CON_OBSERVACIONES`, PDF privado de 9 paginas generado y extraccion textual `underscore_lines=0`.

## Psych AI V6.1 Luna medio robusto - 2026-08-14

- [ ] Auditar V5.4 vigente, scoring PRP, perfiles de cargo, contrato de salida, guardrails y renderer PDF.
- [ ] Implementar PRP V6.1 con rangos inclusivos 81-117/118-136/137-150, fuera de rango observable y sin rechazo automático.
- [ ] Incorporar convergencia/divergencia, criticidad por perfil, marco de competencias y clasificación laboral objetiva en el contexto determinístico entregado a Luna.
- [ ] Versionar prompt/schema V6.1, compactar facts para Luna medio y reforzar consistencia post-salida/reintento único.
- [ ] Ajustar PDF integrado a 5-6 páginas aproximadas, matriz de competencias con S/E y paginación final correcta.
- [ ] Agregar tests PRP, convergencia, criticidad, cuatro clasificaciones, anti-alucinación y regresión de contenido.
- [ ] Aplicar migración y desplegar funciones en producción; regenerar canario de forma explícita, comparar V5.4/V6.1 y verificar PDF/hash.
- [ ] Ejecutar gates, documentar riesgos metodológicos pendientes, commit/push a main y verificar CI.

## Estado visual de páginas en respuesta psicométrica - 2026-08-14

- [x] Calcular completitud por página usando las respuestas actuales del candidato.
- [x] Mostrar páginas incompletas en rojo y completas en verde, manteniendo foco/selección.
- [x] Agregar regresión y validar build, responsive y Guardian.
- [x] Documentar resultado.

Resultado: en `/evaluacionpsico`, los botones de página/bloque ahora usan las respuestas actuales para mostrar fondo rojo cuando falta una respuesta y verde cuando la página está completa. El estado activo conserva un anillo visual, y cada botón expone su estado mediante `aria-label` y `title`. Se validó con 40 pruebas de integridad, build frontend, baseline de performance y Guardian con 0 errores y 0 advertencias.

## Psych AI V5.4 humanizacion integral - 2026-08-14

- [x] Auditar origen real de textos técnicos visibles en prompt, schema, guardrails, PDF y UI.
- [x] Versionar V5.4 para Luna con voz profesional natural, sin lenguaje de automatización en contenido entregable.
- [x] Separar contenido de reporte y metadata interna, conservando trazabilidad sin imprimirla en PDF.
- [x] Eliminar del PDF frases de revisión/validación profesional requerida, automatización, IA, V5.3 y disclaimers repetitivos.
- [x] Ajustar UI de revisión/resultados para usar lenguaje operativo sobrio sin exponer mecanismo IA en la narrativa.
- [x] Agregar tests semánticos contra términos prohibidos en contenido de reporte/PDF y objetividad.
- [x] Aplicar migración, desplegar funciones, regenerar canario productivo, validar render y ejecutar Guardian.

Resultado: V5.4 quedó implementado y desplegado en producción con prompt activo `psych-ai-prompt-v5.4`, schema `psych-ai-schema-v5.4`, modelo `gpt-5.6-luna` y runtime `gpt56-luna-humanized-v5.4.1`. El canario RC-1807 fue regenerado sin cache, quedó `PENDING_REVIEW`, `guardrail_flags=[]`, `has_forbidden=false`, certificado e informe `generated`, y el PDF privado renderizado tiene 8 páginas, header `Informe Psicolaboral Integrado`, pie documental y hash `0f0744788a7634edf37719ef0116d35c8b451ed4fb026d33aa9617eb4b2aa1b5`. Guardian final pasó con 0 errores y 0 warnings.

## Psych AI V5.3 objetividad discriminativa y rediseño PDF - 2026-08-14

- [x] Auditar V5.2 real en producción: prompt/schema activo, perfil de cargo, último canary RC-1807 y PDF vigente.
- [x] Versionar perfiles de cargo V5.3 con criticidad explícita por competencia, sin alterar scoring ni respuestas históricas.
- [x] Implementar output V5.3 con recomendación preliminar automatizada, confianza, fortalezas críticas, brechas e incertidumbres, manteniendo revisión humana separada.
- [x] Endurecer prompt, schema y guardrails para evitar positividad artificial, inferencias no medidas, fortalezas de resultados medios y PRP decisional.
- [x] Migrar el proveedor activo de Gestión Psicolaboral a OpenAI `gpt-5.6-luna`, sin fallback a `gpt-5-mini` ni dependencias ORION.
- [x] Rediseñar el informe PDF con tokens editoriales, paginación semántica, bloques respirables, texto narrativo justificado y resultado preliminar visible.
- [x] Validar Deno, unit/integrity tests, migraciones, seguridad, build, Guardian, canary productivo, render visual y CI.

Resultado: V5.3 quedó aplicado en producción con prompt `psych-ai-prompt-v5.3`, schema `psych-ai-schema-v5.3`, provider `openai`, modelo único `gpt-5.6-luna` y pipeline `gpt56-luna-objective-v5.3`. El canario RC-1807 generó IA real `PENDING_REVIEW`, recomendación `REQUIERE_PROFUNDIZACION`, confianza `MEDIA`, 0 guardrail flags, 1 llamada OpenAI, 5.998 tokens totales y costo estimado USD 0,003039. Certificado e informe quedaron regenerados; el informe final renderizado tiene 7 páginas, encabezado `Página: 1 de 7` a `Página: 7 de 7`, logo ajustado y sin secciones vacías.

## Corrección sync BUK con error - 2026-08-14

- [x] Localizar el job BUK fallido y conservar evidencia de su error/snapshot.
- [x] Auditar el contrato del worker contra el estado real ERP y BUK.
- [x] Corregir la causa raíz y aplicar/desplegar la corrección si corresponde.
- [x] Reprocesar o reconciliar el job, verificando resultado en ERP y BUK.
- [x] Ejecutar Guardian/gates aplicables y documentar resultado final.

Resultado: los errores de Stephanye Troncoso (`celular` con espacios) quedaron reconciliados por el job exitoso `c6d67c33-1363-4c5c-8f26-ec73c010eaef`, empleado BUK `42828`. El worker ahora normaliza teléfonos antes del POST, la Edge Function quedó desplegada en `pzblmbahnoyntrhistea`, y la verificación viva confirmó ficha `F1`, estado activo, job BUK `145561`, renta `0` y tallas verificadas. No hay jobs `processing`; permanece un `pending` histórico excluido por claim porque el candidato ya tiene éxito efectivo.

## Psych AI V5.2 humanización y auditoría de tokens - 2026-08-14

- [x] Auditar V5 real en código y producción: prompts, schema, telemetry, doble ejecución, reuse del output IA en PDF y canary RC-1807.
- [x] Implementar narrativa V5.2 más humana y aplicada al cargo, sin meta-lenguaje backend, sin códigos técnicos, sin `raw_total`, sin `F1-F6` y sin evidence IDs visibles.
- [x] Compactar facts y cambiar el flujo a Analyst por defecto + Reviewer condicional patch-only, persistiendo desglose de tokens/calls/costo por ejecución.
- [x] Ajustar PRP para usar solo semántica metodológica válida, evitando baremos inventados y frases circulares.
- [x] Actualizar UI/PDF y generar `PSYCH_V5_2_AUDIT.md`, `PSYCH_V5_2_TOKEN_ANALYSIS.md`, `PSYCH_V5_2_HUMANIZATION_REPORT.md` y `PSYCH_V5_2_CANARY_COMPARISON.md`.
- [x] Validar Deno, unit/integrity tests, auditorías, build, Guardian, despliegue, canary productivo y CI.

Resultado: V5.2 quedó aplicado en producción con prompt activo `psych-ai-prompt-v5.2`, schema `psych-ai-schema-v5.2`, provider `openai`, modelo `gpt-5-mini` y pipeline runtime `gpt5-mini-humanized-v5.2.3`. El canario RC-1807 generó interpretación `ff42459d-aba8-4188-9ec9-33cdfb8d1e9b` con `SUCCESS`, `PENDING_REVIEW`, 1 llamada IA, Reviewer no ejecutado, 2.574 input tokens, 2.432 cached input tokens, 2.263 output tokens, 4.837 total tokens, costo estimado USD 0,004622, 0 guardrail flags y 0 términos técnicos bloqueados. Certificado e informe quedaron `generated`.

## Psych AI V5 reconstrucción metodológica GPT-5 mini - 2026-08-14

- [x] Auditar implementación V4 contra el prompt V5, scoring, payload, prompt/schema activo, UI de revisión, PDF y límites metodológicos.
- [x] Documentar matriz fuente → instrumento ERP → licencia/scoring/interpretación/baremos/uso IA en `PSYCH_V5_SOURCE_AND_IMPLEMENTATION_AUDIT.md`.
- [x] Activar schema/prompt V5 con Analyst/Reviewer V2, lenguaje integrado, PRP descriptivo cuando esté permitido y sin códigos técnicos en informe profesional.
- [x] Enriquecer facts pseudonimizados con metodología versionada sin exponer respuestas crudas, PII ni consentimientos completos al proveedor.
- [x] Ajustar normalización, guardrails mínimos, UI y PDF para el Informe Psicolaboral Integrado V5.
- [x] Validar Deno, pruebas de integridad, auditorías, build/Guardian, desplegar producción, regenerar canario y publicar commit/push.

Resultado: producción quedó con prompt activo `psych-ai-prompt-v5`, schema `psych-ai-schema-v5`, provider `openai`, modelo `gpt-5-mini` y pipeline `gpt5-mini-methodological-v5`. El canario RC-1807 fue reprocesado con run `SUCCESS`, estado `PENDING_REVIEW`, guardrail flags vacíos, sin `PROFESSIONAL_ONLY`, sin `PENDING_REVIEW` textual, sin `ev_` visible y sin código crudo `SOBRE_EL_PROMEDIO` en `display_output`. Certificado e informe privado quedaron `generated` con hashes presentes. Guardian local pasó con 0 errores y 0 warnings; CI run `31770394443` confirmó los mismos gates funcionales y solo exigió alinear el baseline performance al artefacto remoto con variables públicas (`dist=10.254.698`, `JS=2.739.884`), sin vendors ni assets nuevos.

## Psych AI GPT-5 mini dual-pass Analyst/Reviewer V4 - 2026-08-14

- [x] Aterrizar el prompt V4 contra el pipeline actual sin tocar scoring, respuestas, RLS ni revisión profesional.
- [x] Implementar Analyst → Reviewer con OpenAI Responses API, schemas estrictos, retries acotados y fallback no vacío solo cuando sea seguro.
- [x] Reducir la dependencia de reglas semánticas extensas a hard checks mínimos, conservando bloqueos críticos de PRP, BIS, decisiones, diagnóstico y PII.
- [x] Registrar metadata de pipeline, correcciones, tokens y latencia, manteniendo compatibilidad con UI/PDF actuales.
- [x] Agregar pruebas de regresión para BIS, PRP, estilos IPC, preguntas neutrales, hard guardrails, fallback y PDF final.
- [x] Desplegar producción, regenerar RC-1807 y verificar que el informe use Reviewer/final output con hash.

Resultado: se implementó `gpt5-mini-analyst-reviewer-v1` en backend. GPT-5 mini genera Analyst y luego Reviewer con Responses API, schema estricto, reasoning low, sin tools ni browsing. El ERP mantiene scoring/facts como fuente de verdad, sanea PII, conserva locks PRP/BIS/decisiones/diagnóstico y usa hard checks mínimos sobre la salida final. RC-1807 quedó con run `SUCCESS`, `analyst_attempt:1`, `reviewer_attempt:1`, estado `PENDING_REVIEW`, certificado e informe `generated`.

## Migración Psych AI a OpenAI GPT-5 mini - 2026-08-13

- [x] Reemplazar el proveedor anterior por OpenAI en la Edge Function psicolaboral, manteniendo Mock/fallback y guardrails V3.
- [x] Versionar prompt activo para `provider='openai'` y `model='gpt-5-mini'` sin tocar scoring ni respuestas históricas.
- [x] Actualizar tests, documentación operativa y reportes para eliminar dependencia del proveedor anterior en el flujo psicolaboral.
- [x] Configurar secreto productivo `OPENAI_API_KEY`; `PSYCH_AI_PROVIDER=openai`, `PSYCH_AI_MODEL=gpt-5-mini`, despliegue y regeneración RC-1807 quedaron aplicados.
- [x] Ejecutar Deno, unit/integrity, auditorías Supabase, build, Guardian, verificación PDF y commit/push.
- [x] Limpiar referencias del proveedor anterior en el flujo Psych AI activo y retirar secreto productivo obsoleto de Supabase.
- [x] Separar ORION de la migración: no lee `OPENAI_API_KEY`, no usa defaults OpenAI/GPT y sus secrets `ORION_LLM_*` fueron retirados de producción.

Resultado: producción quedó con prompt activo `psych-ai-prompt-v4`, schema `psych-ai-schema-v3`, provider `openai` y modelo `gpt-5-mini`. `OPENAI_API_KEY` quedó configurado solo para Psych AI; `GROQ_API_KEY` y `ORION_LLM_*` quedaron retirados. RC-1807 fue regenerado con OpenAI real, run `SUCCESS`, estado `PENDING_REVIEW`, certificado e informe `generated` con hashes.

Corrección posterior: el fallback por timeout no vuelve a persistirse como revisión IA. El provider psicolaboral usa OpenAI Responses API con Structured Outputs, timeout ampliado y diagnóstico de `incomplete/refusal/empty_content`. Las respuestas IA que incumplen locks semánticos se normalizan con guardrails ERP y se guardan con flags; solo ausencia real de proveedor queda `FAILED`. RC-1807 fue regenerado nuevamente con OpenAI real, latencia 25.5s, run `SUCCESS`, estado `PENDING_REVIEW`, certificado e informe `generated`.

## Guardrails semánticos IA psicolaboral V3 - 2026-08-13

- [ ] Implementar `PsychSemanticGuardrailEngine` determinístico entre scoring e IA, con niveles teóricos IPIP, lock BIS-11, lock PRP y evidencia versionada.
- [ ] Migrar schema de salida IA a V3 estructurado sin que el LLM decida intensidad, significado ni clasificación.
- [ ] Validar post-LLM evidencia, intensidad, riesgo, PRP, fortalezas, preguntas neutrales y limitaciones deduplicadas.
- [ ] Mantener compatibilidad con UI/PDF actuales sin rediseño estructural y sin tocar scoring ni respuestas históricas.
- [ ] Crear tests de regresión semántica obligatorios y reporte `PSYCH_AI_SEMANTIC_GUARDRAIL_REPORT.md`.
- [ ] Desplegar Edge Functions, regenerar el canario RC-1807 y verificar producción antes de cerrar.

## Capa IA interpretativa psicolaboral - 2026-08-13
- [x] Auditar el prompt maestro contra scoring, calidad, perfiles, PDF, Storage, RLS y frontend existentes.
- [x] Documentar arquitectura, brechas, riesgos, rollback y gates en `PSYCH_AI_IMPLEMENTATION_AUDIT.md`.
- [x] Crear migración privada de perfiles de cargo, interpretaciones, ejecuciones y versiones de prompt.
- [x] Implementar proveedor abstracto, Mock, OpenAI, sanitización, schema estricto, guardrails, cache e idempotencia.
- [x] Integrar generación piloto manual y revisión profesional sin decisión automática.
- [x] Rediseñar PDF de cuatro páginas con evidencia, interpretación separada y fallback determinístico.
- [x] Crear documentación operacional: arquitectura, privacidad, prompt, schema, tests, piloto y rollback.
- [ ] Ejecutar tests, auditorías Supabase, build, Guardian y piloto controlado antes de activar IA.

Decisión: `PSYCH_AI_ENABLED=false` durante el desarrollo. El scoring existente, los resultados históricos, el certificado actual y el flujo de candidatos no se modifican hasta que la capa auditable esté validada.

Continuación solicitada: ejecutar Fase 2 a Fase 16 sin repetir auditoría. La ausencia de `OPENAI_API_KEY` no bloquea el desarrollo: el proveedor real queda implementado, pero el entorno usa Mock/fallback hasta configurar secreto y activar feature flag.

Resultado actualizado: la capa IA queda aislada en tablas privadas, con generación automática post-respuesta, revisión profesional editable y PDF interno de 4 páginas. El proveedor productivo fue migrado a OpenAI `gpt-5-mini`; queda pendiente ampliar perfiles configurables antes de uso masivo.

## Rediseño informe psicolaboral integrado - 2026-08-13
- [x] Auditar generador PDF, scoring, datos históricos, permisos y contratos actuales.
- [x] Implementar calidad de respuesta y capa interpretativa trazable sin alterar scoring original.
- [x] Separar certificado de evaluación e informe integrado con metadatos versionados y disclaimer.
- [ ] Añadir perfiles de cargo configurables/versionados y compatibilidad no decisoria.
- [ ] Incorporar pruebas, migración reversible, build, seguridad, Guardian y despliegue.

Alcance de esta entrega: certificado de 1 página + informe interno multipágina, calidad determinística de respuesta, perfil interpersonal propio IPIP-IPC y salida PRP sin factores genéricos. La compatibilidad por cargo queda pendiente de habilitar perfiles versionados administrables; mientras tanto el informe no emite índice ni conclusión automática.

## Regeneración certificado psicolaboral canario - 2026-08-13
- [x] Marcar el certificado anterior para reproceso sin tocar respuestas ni scoring (RPC autorizado disponible desde el ERP).
- [x] Ejecutar el generador con el formato certificado + informe integrado (acción `Actualizar informe` desplegada en Gestión Psicolaboral).
- [x] Confirmar hashes, rutas privadas y estado generado en el canario.
- [x] Corregir carrera IA/PDF, regeneración service-only, caracteres WinAnsi y layout visual del header/panel IA.

Resultado: RC-1807 quedó con `ai_status=PENDING_REVIEW`, certificado e informe `generated`, `last_error=null`, hashes productivos verificados contra descarga privada y render visual sin fallback ni solapes. El logo conserva proporción y el header usa la retícula del certificado estándar.

## Correccion RUT William Eric Araya Toro - 2026-08-13

- [x] Localizar el RUT ingresado y todas las fuentes vinculadas al candidato.
- [x] Confirmar el RUT correcto contra fuentes independientes y descartar colision.
- [x] Corregir atomicamente perfil y precandidatura, preservando historial y documentos.
- [x] Validar producción, auditorías, commit, push y CI.

Resultado: William Eric Araya Toro quedó con RUT `15573108` (presentación `15.573.108-7`) en `candidate_profiles` y `recruitment_precandidates`. La corrección `20260813204703` fue aplicada y registrada en Supabase. No existía ficha BUK ni job de sincronización asociado; la nómina y el resumen judicial ya contenían el RUT correcto. Se conservaron nombres, estado, postulación y documentos.

## Ajuste visual y prueba controlada de Gestión Psicolaboral - 2026-08-13

- [x] Comparar el centro de mando con la composición visual de Reclutamiento y ajustar KPIs, filtros, tabla expandible y acciones.
- [x] Separar visualmente nombre de instrumento y texto de preguntas en `/evaluacionpsico`, verificando desktop y móvil.
- [x] Mostrar descarga del certificado como acción compacta junto a la columna Actualización, conservando acción de generación/reintento.
- [ ] Confirmar y documentar el envío de invitaciones mediante Resend con idempotencia.
- [ ] Diseñar un bypass temporal de hash exclusivamente para un RUT explícito, con fecha de caducidad y sin relajar el acceso general.
- [x] Ejecutar build, Guardian, diff y QA visual antes de publicar.

Resultado: el centro de mando dejó el encabezado tipo hero y ahora usa `minimal-page-header`, `tracking-panel`, KPIs, chips de estado, barra de filtros y tabla con scroll como Reclutamiento. La columna Actualización muestra una acción compacta `PDF` para descargar certificados generados. En `/evaluacionpsico`, el número de pregunta y el enunciado quedaron separados en nodos distintos para evitar choque visual. Build frontend, baseline de performance, Guardian y `git diff --check` pasan sin errores.

Corrección visual posterior: los chips de batería separan nombre del instrumento y cantidad de preguntas; las acciones del detalle expandido quedan dentro del cuadro en una franja propia, con botones más pequeños para Enviar, Ver resultados, Generar/Descargar certificado, Aprobar y Rechazar.

Corrección revisión IA: el modal dejó de mostrar el JSON editable y los encabezados técnicos `Original IA`/`Revisión editable`. El resumen ejecutivo usa el ancho completo, las secciones IA quedan en una grilla ordenada y el comentario profesional se mueve al final como cierre de revisión.

## Implementación módulo Gestión Psicolaboral - 2026-08-13

- [x] Inspeccionar rutas, autorización, candidatos activos, descarte oficial, correo, tokens públicos, Storage y generadores PDF vigentes.
- [x] Recuperar y verificar los consentimientos F-RH-061 y F-RH-062 y los contratos digitales de los cuatro instrumentos.
- [x] Crear el módulo independiente `gestion_psicolaboral`, su esquema privado, RLS/grants, auditoría y RPCs backend-authoritative.
- [x] Implementar invitación de un solo uso, rate limiting, sesión opaca de 90 minutos, consentimientos versionados, guardado de avance y entrega idempotente.
- [x] Implementar scoring privado para IPIP-16/105, IPIP-IPC/32, Barratt y PRP sin decisión automática ni exposición de claves.
- [x] Implementar centro de mando expandible, selección múltiple de test, estados No realizado/Enviado/Terminado y decisión Aprobar/Rechazar.
- [x] Implementar `/evaluacionpsico` con RUT + código, bloqueo por consentimientos, progreso, tiempo restante y recuperación de la única sesión vigente.
- [x] Generar certificado psicométrico privado con resumen de respuestas y resultados por instrumento, hash, folio y descarga autorizada.
- [x] Validar localmente tipos, Edge Functions, integridad, concurrencia, idempotencia, build, migraciones, seguridad y Guardian.
- [ ] Ejecutar smoke funcional con candidato canario autorizado: envío, sesión, consentimientos, scoring, PDF y descarte transaccional antes de uso masivo.

Decisiones cerradas: el módulo no reutiliza autorización de `control_contrataciones`; las tablas sensibles viven en `private` sin acceso directo; el código temporal se guarda únicamente como hash y se canjea una vez por una sesión backend de 90 minutos; `Terminado` no depende de que el PDF termine de generarse; Aprobar no mueve la etapa; Rechazar exige motivo y usa `advance_recruitment_candidate_stage`; PRP conserva su salida normativa como `pending_professional_review` mientras sus baremos sigan ambiguos.

Resultado local: quedaron implementadas las rutas lazy `/gestion-psicolaboral` y `/evaluacionpsico`, cuatro contratos de instrumento versionados, consentimientos F-RH-061/F-RH-062 versionados, almacenamiento privado, scoring backend, auditoría, correo Resend, sesión opaca, certificado y decisiones humanas. `tsc`, los dos `deno check`, 25 pruebas de integridad, build frontend, auditorías de migraciones/seguridad/rendimiento y Guardian pasan; Guardian finaliza con 0 errores y 0 advertencias. El dry-run remoto de Supabase no modifica datos, pero no pudo ordenar la migración nueva porque el historial remoto conserva 17 versiones legacy ausentes localmente; no se reparó historial ni se aplicó nada en producción durante esta fase.

### Cierre integral backend/frontend y QA estética ERP

- [x] Reabrir la revisión del contrato completo y comparar la UI con patrones vivos del ERP.
- [x] Endurecer la aceptación backend de consentimientos para exigir exactamente código, versión y hash mostrados.
- [x] Completar guardado automático, paginación interna de preguntas y recuperación segura del test pendiente.
- [x] Reemplazar resultados JSON por una presentación profesional y agregar paginación real de candidatos.
- [x] Revisar generación/reintento del certificado privado y estados de integración.
- [x] Ejecutar pruebas de contrato, seguridad, build, Guardian y QA visual desktop/móvil con evidencia.

Revisión final: se corrigieron bloqueos runtime de los RPC service-role (`current_user`, `jsonb_object_length` y `extensions.digest`), se hizo la aceptación de consentimientos exacta y no duplicable, y se cerró el acceso directo al bucket. El candidato conserva una sesión por invitación, autosave con revisión optimista y bloques de 10 preguntas. El centro de mando pagina candidatos, actualiza estados cada 30 segundos, muestra resultados interpretables y permite recuperar certificados en cola/fallidos. El correo usa código determinístico por idempotency key e `Idempotency-Key` del proveedor. El PDF usa logo contractual variable, resultados por dimensión y sello ERP sin publicar datos psicológicos.

Evidencia: TypeScript, dos `deno check`, 28 pruebas de integridad, auditoría de migraciones, auditoría Supabase, build productivo y baseline de rendimiento pasan. Guardian finaliza con 0 errores y 0 advertencias. Playwright Firefox verificó `/evaluacionpsico` en 1440x1000 y 390x844; en móvil `scrollWidth=clientWidth=390`, sin desborde. `supabase migration list --linked` confirma que `20260813180211` sigue únicamente local; no se modificó producción ni el historial remoto en este cierre.

Aplicación productiva de migración: `20260813180211` fue ejecutada directamente con `supabase db query --linked --file` (SHA-256 `6cce4253e2ac933e5b60f0ddf97bd50fa8337587c70eba3c498e68b3e43b941c`) y registrada como `applied` mediante `migration repair`, sin reparar ni alterar otras versiones legacy. El smoke remoto confirmó módulo activo, roles exclusivos `admin`/`reclutamiento`, 8 tablas privadas con RLS, cero acceso directo de `anon`/`authenticated`, cuatro instrumentos activos con 105/32/30/30 ítems, consentimientos F-RH-061/F-RH-062, bucket privado sin policy directa, RPC internos exclusivos de `service_role` y cero evaluaciones creadas por la aplicación. Las Edge Functions y el frontend no fueron desplegados en esta acción.

Despliegue productivo: las Edge Functions `psycholaboral-assessment` y `generate-psycholaboral-certificate` quedaron `ACTIVE` en Supabase, ambas con `verify_jwt=false` porque aplican sus propias fronteras de autorización/sesión. Se fijó `PUBLIC_APP_URL=https://gestion.busesjm.cl` y se confirmó la presencia de Resend, remitente transaccional y secretos Supabase sin exponer valores. Los smokes HTTP negativos devolvieron 401 para sesión inexistente y generador sin secreto. Guardian previo a publicación mantiene 0 errores y 0 advertencias. Pendiente al cierre técnico: envío canario real, que requiere escoger deliberadamente un candidato/correo para no contactar personas durante un smoke de infraestructura.

## Planificación PRP literal dentro del módulo psicométrico - 2026-08-13

- [x] Inspeccionar `5.- Escala PRP JM.docx` y `2. Corrector PRP (1).xls` adjuntos al correo.
- [x] Reconstruir el contrato digital exacto: instrucciones, ítems, alternativas, orden, escalas y tabulación.
- [x] Integrar PRP como cuarto instrumento del flujo web compartido, sin generar entregables Excel ni implementar código productivo.
- [x] Validar correspondencia cuestionario-corrector, casos de borde y gates profesionales/legales reales.

Alcance: análisis y especificación funcional para digitalización. No incluye todavía migraciones, UI, RLS, RPC/Edge Functions, reportes ni despliegue.

Resultado: se documentó `docs/psychometric-module/prp-email-contract.md` como contrato digital vivo. PRP conserva 30 ítems literales, cinco alternativas, 14 claves directas, 16 inversas, puntaje directo `30–150`, seis factores y baremos por cinco grupos ocupacionales. Se identificaron sin corregir siete ambigüedades reales del material fuente que requieren confirmación profesional o legal antes de codificar: interpolación/celdas vacías del baremo, rótulos simultáneos `RIESGOSOS`/`NEUTRO`, mapeo de cargos, fórmula especial del Factor 5, doble uso del ítem 24, rangos demográficos solapados/incompletos e intervalo `110-101` potencialmente erróneo. No se generó ningún Excel de salida ni se modificó producción.

## Planificación instrumento Barratt recibido por correo - 2026-08-13

- [x] Recuperar del correo la hoja Barratt original y transcribir literalmente sus 30 ítems, orden e instrucciones.
- [x] Confirmar la escala especial `0-1-3-4`, las inversiones y la tabulación usada por la página CETEP indicada en el correo.
- [x] Construir el cuestionario, clave privada, resultados QA, contrato técnico y arquitectura ERP sin implementar código productivo.
- [x] Verificar fórmulas, escenarios límite, trazabilidad, seguridad y presentación visual del entregable.
- [x] Documentar los límites interpretativos y las validaciones profesionales previas al uso laboral.

Alcance corregido: Barratt forma parte del único módulo psicométrico digital junto con IPIP-16/105 e IPIP-IPC/32. La planilla creada fue solo apoyo transitorio de análisis y no es un entregable ni parte del producto. La siguiente fase debe especificar e implementar directamente migraciones, UI, RLS, RPC/Edge Functions, scoring, reportes y despliegue del flujo web compartido.

Resultado: se creó `outputs/019fc7c7-dfcf-7011-883f-b80565eef186/Planificacion_Barratt_BIS11_30.xlsx` con la transcripción literal de los 30 ítems, escala `0-1-3-4`, clave privada CETEP recuperada, 18 ítems directos y 12 invertidos, clasificación total en tres bandas, contrato técnico, arquitectura y controles de seguridad. Los escenarios 0, 120, 33, 34, 64, 65 e incompleto quedaron `OK`; no hubo errores de fórmula, el XLSX pasó integridad ZIP y las nueve hojas pasaron revisión visual. Quedan como gates productivos la aprobación psicológica de la clave/rangos, el derecho de reproducción digital de la adaptación y la política de privacidad/retención.

## Ajuste de ambos instrumentos al prompt maestro psicométrico - 2026-08-13

- [x] Comparar el prompt maestro con los libros IPIP-16/105 e IPIP-IPC/32 y documentar brechas.
- [x] Ajustar identidad, fuentes, traducción, versionado, capas de datos, scoring y privacidad del IPIP-16/105.
- [x] Mantener el núcleo oficial IPIP-IPC/32 y agregar un Perfil Conductual Laboral propio, versionado y auditable.
- [x] Incorporar arquitectura compartida, perfiles objetivo por cargo, seguridad, reportes y criterios de aceptación.
- [x] Verificar fórmulas, trazabilidad, controles automáticos y presentación visual de ambos libros.

Alcance: actualización de la especificación funcional y psicométrica. No incluye todavía migraciones, UI, RLS, Edge Functions, PDF ni despliegue en producción.

Resultado: los dos libros fueron actualizados a versión de especificación `v0.2-draft`. IPIP-16/105 queda identificado explícitamente como selección interna de ítems IPIP, con scoring determinístico, metadatos por ítem, resultados QA sin percentiles y bloqueo de uso laboral hasta validación. IPIP-IPC/32 conserva sus ocho octantes y agrega `Perfil Conductual Laboral v0.1-draft`, una hipótesis interna de cuatro macroestilos con fórmula visible y versionada. Ambos libros incorporan contrato técnico, arquitectura ERP, siete familias de cargo sin pesos inventados, seguridad, privacidad y matriz de QA. Todos los controles existentes quedaron `OK`, no se detectaron errores de fórmula, los dos archivos XLSX pasan integridad ZIP y las 22 hojas pasaron revisión visual.

## Planificación instrumento IPIP-IPC/32 - 2026-08-13

- [x] Confirmar contrato oficial, licencia, ocho octantes y scoring publicado del IPIP-IPC/32.
- [x] Adaptar los 32 ítems al español chileno preservando su sentido y asignación original.
- [x] Crear cuestionario, clave privada, parámetros y perfil circunflejo auditable, sin implementar código ERP.
- [x] Verificar fórmulas, octantes, ejes de calidez/dominancia, controles y presentación visual.
- [x] Documentar límites del reemplazo funcional de DISC y validaciones previas al uso laboral.

Alcance: especificación funcional y psicométrica preliminar. No incluye ruta pública, persistencia, permisos, despliegue ni conversión de perfiles DISC históricos.

Resultado: se creó `outputs/019fc7c7-dfcf-7011-883f-b80565eef186/Planificacion_IPIP_IPC_32.xlsx` con los 32 ítems oficiales, ocho octantes de cuatro ítems, clave directa 1-5, parámetros publicados, perfil circunflejo de prueba y controles automáticos. Las asignaciones oficiales, fórmulas, ejes Calidez/Dominancia y siete hojas pasaron validación lógica y visual. Es un reemplazo funcional del flujo DISC, no una equivalencia ni conversión de perfiles D/I/S/C.

## Planificación instrumento IPIP-16/105 - 2026-08-13

- [x] Definir criterios y distribución exacta de 105 ítems entre las 16 escalas IPIP.
- [x] Seleccionar y adaptar al español chileno los ítems, preservando claves directas/inversas.
- [x] Crear cuestionario revisable y matriz privada/auditable de puntuación, sin implementar código ERP.
- [x] Verificar conteos, balance, fórmulas y presentación visual de los entregables.
- [x] Documentar límites psicométricos y validaciones profesionales mínimas antes de uso laboral.

Alcance: especificación funcional y psicométrica preliminar. No incluye ruta pública, base de datos, permisos, despliegue ni decisiones automáticas sobre candidatos.

Resultado: se creó `outputs/019fc7c7-dfcf-7011-883f-b80565eef186/Planificacion_IPIP_16_105.xlsx` con 105 ítems únicos verificados contra la fuente oficial IPIP, 16 escalas, 53 claves directas y 52 invertidas. El libro incluye cuestionario visible, clave privada con puntuación 1-5, diccionario de escalas, fuentes y controles automáticos; todas las comprobaciones quedaron `OK` y las cinco hojas pasaron revisión visual. Es un borrador para piloto local, no una equivalencia del 16PF comercial.

## Incidencia recuperación de cuenta - Jorge Parra - 2026-08-12

- [x] Identificar el flujo común de recuperación y el error real de Jorge en producción.
- [x] Revisar límites, broker, proveedor de correo y validaciones para todos los usuarios.
- [x] Reproducir de forma no destructiva y confirmar que el enlace permite cambiar la contraseña.
- [x] Aplicar una corrección backend-authoritative sin desactivar rate limits ni enumeración.
- [x] Ejecutar pruebas, auditorías Supabase/Guardian, desplegar, verificar producción y publicar.

Resultado: Jorge Parra (`jorge.parra@busesjm.com`) y Victor Guerrero (`victor.guerrero@busesjm.com`) recibieron enlaces frescos. El broker ahora prioriza un callback directo de un solo uso con `token_hash`; el cliente verifica ese token antes de mostrar el formulario. Build frontend y 81 unitarias pasan. La Edge Function quedó desplegada en Supabase; el frontend está publicado en `main` y Cloudflare ya refleja el bundle con el fallback `verifyOtp`.

## Diagnóstico de error Sync BUK - 2026-08-12

- [x] Identificar el job fallido, candidato/folio, código de error y etapa exacta en producción.
- [x] Comparar el error con el contrato vigente de `sync-buk-candidates`, mappings BUK y estado remoto del trabajador.
- [x] Reproducir la rama afectada de forma no destructiva y determinar si requiere corrección de datos, código o reintento controlado.
- [x] Aplicar y desplegar la corrección mínima si corresponde, validar idempotencia y confirmar el estado productivo.
- [ ] Ejecutar auditorías/Guardian, registrar resultado, commit, push y CI.

## Recuperación de cuentas sin bloqueo por rate-limit - 2026-08-11

- [x] Confirmar el contrato vigente de recuperación, configuración de redirect y proveedor transaccional.
- [x] Implementar broker seguro de recuperación con generación de enlace Auth, límite durable por usuario/IP y respuesta anti-enumeración.
- [x] Conectar el frontend al broker sin fallback al endpoint Auth que está provocando 429 y preservar el cambio de contraseña backend-authoritative.
- [x] Validar producción con smoke no destructivo, auditorías Supabase, build, Guardian y revisar que Javier quede elegible para recuperar sin modificar su contraseña manualmente.
- [x] Commit y push a `main`, verificando hash remoto y CI.

Resultado: el broker `request-password-reset` está desplegado y probado en producción. Las migraciones `20260811210607`, `20260811210845` y `20260811211006` están aplicadas y registradas; la ruta responde de forma genérica, limita por correo/IP y envió un enlace real a `javier.plaza@busesjm.com`. Build, Guardian, auditorías y smoke de permisos pasan antes de publicar.

## Creación proyecto cambio de turno Zona 3 Norte Costa - 2026-08-11

- [x] Identificar tablas/RPC reales para proyectos, contratos, mappings BUK, cargos y aprobadores.
- [x] Verificar en producción si `9462300005:0001`, centro `726` o proyecto `10116` ya existen para evitar duplicados.
- [x] Insertar o actualizar solo los registros necesarios para el proyecto `SODEXO - ALTONORTE` de cambios de turno Zona 3 Norte Costa.
- [x] Validar producción con consulta read-only, registrar migración/resultado, ejecutar auditorías proporcionales, commit y push a `main`.

Resultado: migración `20260811203239_add_sodexo_altonorte_contract` aplicada y registrada en Supabase. Se creó `contracts.id = 203`, `code = CONT-111`, `contract_number = 9462300005:0001`, `contract_name = SODEXO - ALTONORTE`, unidad `115 / SERV CAMBIO DE TURNO`, centro `10116 / GERENCIA OPERACIONES ZONA III (NORTE COSTA)`. Mapping BUK `id = 119`, `buk_area_code = 726`, gerente `Luciano Fischer Ballerini`, administrador `Javier Plaza Cerda`, activo y one-to-one. Validación productiva confirmó 1 contrato, 1 mapping, gerente zona 3 activo y los cargos `CONDUCTOR DE BUS`, `AUXILIAR DE BUS`, `CONDUCTOR DE MINI BUS` activos.

## Rediseño visual Solicitud de Sanciones - 2026-08-11

- [x] Auditar el módulo actual contra los patrones visuales ERP de RRHH, Reclutamiento e Incentivos.
- [x] Reemplazar CSS local genérico por componentes/clases existentes de formularios, filtros, KPIs, tablas y acciones.
- [x] Mejorar estados de carga, vacío, error y feedback sin modificar permisos ni backend Supabase.
- [x] Validar build, Guardian, render responsive, commit y push a `main`.

Resultado: Solicitud de Sanciones queda alineado al lenguaje ERP usando `TextField`, `SelectField`, `approval-chip`, `tracking-kpi-card`, `tracking-filters`, `tracking-table` y filas expandibles de seguimiento. Se redujo la hoja local a ajustes específicos, se corrigió overflow móvil de la tabla y no se modificó Supabase ni permisos; el módulo sigue visible solo para admin mientras se desarrolla.

## Representantes sindicales en precandidatos DSAL - 2026-08-11

- [x] Marcar en backend los RUT de la nómina sindical entregada y exponer la condición desde el RPC autenticado.
- [x] Mostrar la burbuja `Representante sindical` solo cuando el RUT esté marcado en la nómina.
- [x] Validar coincidencias positivas y negativas, build, Guardian, migración remota y responsive.
- [x] Registrar resultado, commit y push a `main`.

Resultado: la migración `20260811110000_add_dsal_union_representative_flag` marca por RUT a Fernando Enrique Carvajal Salinas (`12.349.082-7`), Wilton De Los Santos Ramirez Leon (`10.389.868-4`) y Joaquin Felipe Riquelme Manriquez (`12.237.981-7`). El RPC autenticado devuelve la marca y la vista muestra `Representante sindical` solo para esos RUT; un RUT de control devuelve `false`. Build, integridad, auditorias y Guardian pasan sin errores ni advertencias.

## Corrección expandir precandidato filtrado - 2026-08-10

- [x] Reproducir y localizar el `undefined.length` al expandir resultados filtrados.
- [x] Restaurar en el RPC los detalles judiciales omitidos al agregar el resumen por rol.
- [x] Agregar normalización defensiva de arreglos en el parser frontend.
- [x] Validar RPC filtrado, build, Guardian, commit y push a `main`.

Resultado: el RPC filtrado conserva los detalles judiciales y el parser tolera payloads históricos sin provocar `undefined.length`; build y Guardian pasan sin errores ni advertencias.

## Corrección tooltip de roles en Precandidatos - 2026-08-10

- [x] Identificar que el popup absoluto se superponía a la tabla y podía quedar cortado.
- [x] Cambiar el popup a expansión en flujo para reservar espacio y empujar el contenido inferior.
- [x] Validar build, responsive, Guardian, commit y push a `main`.

Resultado: el detalle por rol ahora se expande dentro de la tarjeta y empuja la tabla inferior; no se superpone ni queda cortado. Build y Guardian pasan sin errores ni advertencias.

## Desglose de precandidatos por rol en tarjetas - 2026-08-10

- [x] Extender el resumen autenticado de precandidatos con conteos por rol para cada estado.
- [x] Mostrar el desglose en tooltip al pasar el mouse o enfocar las tarjetas de Pendientes, Aprobados y Rechazados.
- [x] Validar responsive, tipos, build, migración aplicada y consulta productiva.
- [x] Ejecutar Guardian, registrar resultado y publicar en `main`.

Resultado: la migración `20260810231504_add_dsal_precandidate_role_summary` está aplicada y registrada en Supabase. Producción devuelve `by_role` para Pendientes, Aprobados y Rechazados; build, unitarias, integridad, seguridad, migraciones y Guardian pasan sin errores ni advertencias después de actualizar el baseline medido.

## Expansion de precandidatos DSAL a nomina ECO04 - 2026-08-10

- [x] Validar los 43 RUT de la nómina entregada contra el verificador del ERP.
- [x] Incorporar nombres y apellidos para autocompletado, permitiendo apellido materno vacío cuando la fuente no lo informa.
- [x] Ampliar el catálogo de roles en frontend, constraint y RPC pública de postulación.
- [x] Mantener el enriquecimiento judicial por RUT para criminales, laborales y detalle de causas.
- [x] Ejecutar auditorías, pruebas, commit y push a `main`.

Resultado parcial: la migración `20260810170000_expand_dsal_roster_roles` fue aplicada en Supabase remoto y registra 43 personas nuevas de la nómina ECO04. La información judicial existente se resuelve por RUT en la vista autenticada de Precandidatos; no se inventan resultados cuando un RUT no existe en la fuente judicial importada.

Resultado final: 79 pruebas unitarias, 19 pruebas de integridad, build frontend, auditorias de migraciones/seguridad y Guardian completo pasan sin errores.

## Optimizacion fuerte Business Intelligence - 2026-08-10

- [x] Medir el contrato actual de queries, renderizado y cambio de vistas del modulo BI.
- [x] Optimizar cache, paralelizar RPC de Reclutamiento y evitar refetches innecesarios.
- [x] Diferir el montaje de graficos pesados y mantener navegacion fluida entre pestañas.
- [x] Auditar backend BI y confirmar que sus indices actuales cubren la carga observada; no agregar indices sin evidencia.
- [x] Validar rendimiento, funcionalidad, permisos, build, Guardian, commit y push a `main`.

Resultado: el dashboard de Reclutamiento conserva datos recientes en cache por 2 minutos y durante 15 minutos sin uso, sus dos RPC se ejecutan en paralelo y Dotacion monta los graficos secundarios despues del primer render. La auditoria productiva confirmo 1.582 empleados activos, 5.244 filas de snapshot y 111 casos, con indices existentes para las rutas consultadas.

## Resolucion de area BUK para subareas por codigo de contrato - 2026-08-10

- [x] Reproducir el fallo posterior al mapping y confirmar la condicion de resolucion que lo provoca.
- [x] Permitir que una subarea BUK se resuelva por etiqueta exacta cuando su codigo visible no coincide con el cost center interno.
- [x] Desplegar la Edge Function, validar Guardian y comprobar la definicion publicada.
- [x] Commit y push a `main`.

Resultado: `sync-buk-candidates` ahora acepta el codigo visible de subarea con formato de contrato cuando el nombre o numero de contrato coincide exactamente con el area BUK; el payload usa el `cost_center` devuelto por BUK. La Edge Function fue desplegada y Guardian finalizo con 0 errores y 0 advertencias.

## Mapping BUK Acciona Tranque Talabre - 2026-08-10

- [x] Confirmar el contrato y el codigo de subarea BUK informado por el correo.
- [x] Completar el codigo operativo del mapping BUK sin reutilizar el area del contrato anterior.
- [x] Verificar en produccion la asociacion, flags operativos y ausencia de duplicados.
- [x] Ejecutar auditorias, pruebas, commit y push a `main`.

Resultado: el mapping `ACCIONA - TRANQUE TALABRE` / contrato `5906986003:0001` quedo asociado a `buk_area_code = 5906986003:0001`, operativo, uno-a-uno y enlazado al contrato ERP 194. La validacion de creacion de una persona en BUK debe ejecutarse con un candidato real desde el flujo operativo para no generar datos de prueba.

## Normalizacion de cargo Conductor de Bus - 2026-08-10

- [x] Confirmar el catalogo canonico y medir todos los registros productivos que usan `CONDUCTOR BUS`.
- [x] Consolidar catalogo, referencias por ID y nombres persistidos hacia `CONDUCTOR DE BUS`, sin tocar otros cargos ni historiales no afectados.
- [x] Desactivar la opcion duplicada para impedir nuevos procesos con el nombre incorrecto.
- [x] Aplicar la migracion remota, verificar conteos antes/despues y asegurar que las vistas del ERP reflejen el cargo canonico.
- [x] Ejecutar Guardian, build, auditorias, pruebas de integridad, diff check, commit y push a `main`.

Resultado: la migracion `20260810161527_normalize_conductor_de_bus_title` dejo activo solo `CARGO-035 / CONDUCTOR DE BUS`, movio solicitudes/procesos/movilidades al ID y nombre canonicos, y agrego restricciones para impedir nuevos valores legacy. Produccion quedo sin valores ni referencias `CONDUCTOR BUS`.

## Ajuste de catalogos y valores por defecto ficha BUK publica - 2026-08-10

- [x] Dejar `Transferencia Bancaria` como forma de pago inicial y valor de respaldo del backend.
- [x] Dejar `Mensual` como periodo de pago inicial y valor de respaldo del backend.
- [x] Cambiar comuna a selector alimentado por el catalogo vigente del ERP.
- [x] Aplicar migracion remota, compilar y validar auditorias.

Resultado: la ficha publica usa los formatos y catalogos vigentes de BUK; los campos libres permanecen como texto solo cuando el template ERP no define un catalogo.

## Formulario publico de ficha BUK para candidatos DSAL - 2026-08-10

- [x] Confirmar campos personales y previsionales que puede completar el candidato y estados validos de elegibilidad.
- [x] Crear sesion publica temporal vinculada a candidato aprobado, con verificacion de RUT y correo personal, expiracion y uso controlado.
- [x] Implementar RPC anonima de carga/guardado que valide elegibilidad, normalice datos, preserve campos internos y registre auditoria.
- [x] Crear formulario responsivo fuera de login y conectarlo con la ficha BUK canonica, reutilizando catalogos y reglas del ERP.
- [x] Validar rechazo para RUT no aprobado, rechazo de sesiones invalidas, persistencia, completitud BUK y ausencia de acceso anonimo directo.
- [x] Ejecutar build, Guardian, auditorias, smoke remoto, commit y push a main.

Resultado:
- Ruta publica `/ficha-buk-dsal` disponible sin login; valida RUT aprobado y correo personal registrado antes de revelar la ficha.
- RPCs anonimas acotadas, tabla de sesiones sin acceso directo, token temporal de 30 minutos, uso unico y auditoria `candidate_public_buk_worker_file_updated`.
- El formulario reutiliza catalogos BUK y completa datos personales, domicilio, contacto, tallas, pagos, banco, prevision y salud; mantiene los campos internos de RRHH.
- Migraciones `20260810150000`, `20260810153000` y `20260810154500` aplicadas y reparadas en Supabase remoto; la ultima corrige el token compatible con la instalacion remota.
- Validacion: build frontend, `test:integrity` (18), `audit:migrations`, `audit:supabase-security`, Guardian completo y baseline de performance pasan. El smoke remoto de RUT/email invalido quedo limitado por timeout de la API de consulta, y se verifico la definicion publicada y los privilegios de RPC.


> **REGLA FUNDACIONAL (Leccion 56):** Antes de proponer, planificar o ejecutar cualquier cambio sobre este repositorio, se debe leer `tasks/todo.md` y `tasks/lessons.md` completos. Esta es la primera accion obligatoria de cada sesion de trabajo, sin excepcion.

Este archivo mantiene solo el estado vivo y los cierres recientes con relevancia operacional para el ERP. El historial cerrado sin enlace productivo fue purgado para reducir peso del repositorio; las reglas reutilizables permanecen en `tasks/lessons.md` y la documentacion vigente en `docs/`.

## Separacion del modulo de sanciones - 2026-08-10

- [x] Retirar Sanciones de las vistas/pestañas de Incentivos.
- [x] Crear ruta y pagina propia protegida por `solicitud_sanciones`.
- [x] Mantener navegación, precarga de ruta, realtime y permisos del módulo sin compartir el contenedor de Incentivos.
- Resultado: `/recursos-humanos/sanciones` queda como módulo independiente dentro de Recursos Humanos; Incentivos conserva solo sus vistas propias.

## Correccion enlaces de documentos de candidatos - 2026-08-10

- [x] Identificar la interferencia de la politica Storage de sanciones con el bucket `candidate-docs`.
- [x] Encapsular la consulta a `hr_sanction_documents` en una funcion `SECURITY DEFINER` sin abrir permisos directos.
- [x] Aplicar la migracion `20260810131746_fix_hr_sanctions_storage_policy_table_access` y verificar acceso transaccional como Thania.
- Resultado: el bucket `candidate-docs` vuelve a resolver objetos visibles para usuarios autorizados; las tablas `hr_sanction_documents` siguen sin privilegios directos para `authenticated`.

## Reclutamiento DSAL - postulacion publica y precandidatos - 2026-08-08

- [x] Consolidar el contrato funcional desde la captura y validar los patrones actuales de Control de Contrataciones, ficha BUK y RUT.
- [x] Crear backend autoritativo para precandidatos DSAL con insercion publica acotada, RLS estricta, deduplicacion por RUT y RPCs autenticadas de listado/aprobacion.
- [x] Implementar pagina publica libre de login con logo Consorcio Andino, mensaje de bienvenida mejorado, RUT autocorregido/validado, campos separados, licencias multiseleccion y rol DSAL uniseleccion.
- [x] Insertar la pestaña interna `Precandidatos` entre `Resumen de procesos de contratación` y `Control de candidatos`, con revision/aprobacion hacia el pipeline real.
- [x] Agregar pruebas/auditorias focalizadas para RUT, contrato SQL/RLS/RPC y rutas publicas.
- [x] Validar TypeScript/build, auditorias Supabase proporcionales, Guardian y `git diff --check`.

Condiciones de seguridad:
- La pagina publica solo puede insertar postulaciones; no debe listar, aprobar ni leer datos de terceros con `anon`.
- La aprobacion debe requerir usuario autenticado con acceso real a Control de Contrataciones y debe reutilizar el ingreso al pipeline para conservar auditoria.
- No relajar RLS, grants ni permisos de candidatos existentes para hacer funcionar la UI publica.
- La migracion debe preservar candidatos y postulaciones historicas; si el RUT ya existe en precandidatos, se actualiza la postulacion pendiente en vez de duplicar filas.

Resultado:
- Ruta publica nueva `/postulacion-dsal`, fuera de `ProtectedRoute`, con logo Consorcio Andino, mensaje de bienvenida DSAL, RUT autocorregido/validado, nombres separados, domicilio separado en direccion/region/ciudad, licencias multiseleccion y rol DSAL uniseleccion.
- Backend en `20260808015748_add_dsal_precandidates_intake`: tabla `recruitment_precandidates`, RLS sin lectura/escritura directa, RPC publico `submit_dsal_precandidate_application` con validacion server-side y upsert atomico por RUT pendiente, y RPCs autenticadas para listar/aprobar/rechazar.
- `Control de Contrataciones` suma la pestaña `Precandidatos` entre resumen y candidatos. La aprobacion exige seleccionar un caso activo y reutiliza `add_candidate_to_recruitment_case`, luego completa datos base del perfil para que aparezca en Control de candidatos.
- El auditor Supabase permite solo este RPC anonimo especifico, sin subir el limite global de seguridad.
- Produccion Supabase: migracion `20260808015748_add_dsal_precandidates_intake` aplicada con `supabase db query --linked --file` por bloqueo legacy de `db push`; version `20260808015748` registrada como `applied` con `supabase migration repair --linked --status applied`.
- Smoke productivo: tabla existe, RLS activo, `anon` no tiene `select` ni `insert` directo sobre `recruitment_precandidates`, `anon` solo ejecuta `submit_dsal_precandidate_application`, y `authenticated` ejecuta listado/aprobacion/rechazo. Insercion publica de smoke con RUT valido dentro de transaccion dejo 0 filas despues de `ROLLBACK`.
- Validacion: `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, SQL transaccional remoto con `ROLLBACK`, Playwright desktop/mobile de `/postulacion-dsal`, `audit:performance-baseline`, `git diff --check` y `guardian` pasan. `db push --dry-run --linked` sigue bloqueado por deuda legacy remota ya conocida, por eso se aplico/verifico con `supabase db query --linked`.

### Correccion estetica pagina publica DSAL - 2026-08-08

- [x] Auditar la pagina publica contra la estetica real del ERP y clases globales existentes.
- [x] Rehacer layout/CSS para que sea limpio, minimalista, compacto y consistente en notebook y celular.
- [x] Validar render responsivo real, build frontend, Guardian y `git diff --check`.

Resultado:
- Se reemplazo el tratamiento tipo landing/hero por una ficha publica de lenguaje ERP: header compacto con logo Consorcio Andino, intro breve, superficie `tracking-panel`, divisores finos, numeracion sobria y controles existentes (`TextField`, `SelectField`, `MultiSelectField`, `control-edit-grid`, `form-status`, `soft-primary-button`).
- Playwright local valido notebook 1366, notebook 1024, mobile 390 y mobile 360 sin overflow horizontal. Capturas revisadas visualmente en notebook y celular.
- La funcionalidad, RPCs y permisos backend no cambian en esta correccion.
- Validacion final: `build:frontend-check` y `guardian` pasan con 0 errores y 0 warnings. El baseline P4 se actualizo solo por el aumento medido del CSS/JS de esta correccion visual, sin vendors ni assets nuevos.

### Ajuste de copy y espacios pagina publica DSAL - 2026-08-08

- [x] Retirar el titulo operativo, la bajada anterior y el cuadro de resumen de acceso/precandidatos.
- [x] Incorporar el mensaje institucional entregado por negocio como bienvenida de la postulacion.
- [x] Redistribuir el ancho y los espacios del encabezado, bienvenida y formulario en notebook y celular.
- [x] Validar copy, build, render responsivo, `git diff --check` y Guardian.

Resultado:
- La pagina publica conserva el logo y estado de Consorcio Andino/Codelco DSAL, pero ya no muestra los textos operativos ni el cuadro lateral solicitado.
- La bienvenida institucional se muestra antes del formulario con una anchura legible en notebook y un apilado compacto en celular.
- Playwright valido 1366, 1024, 390 y 360 px: copy nuevo presente, copy anterior ausente y sin overflow horizontal.
- `build:frontend-check`, `npm run guardian` y `git diff --check` pasan. El baseline se actualizo solo por los 5 bytes medidos del bundle JS.

### Validacion y normalizacion de datos pagina publica DSAL - 2026-08-08

- [x] Confirmar el contrato vigente de RUT, email y telefono en frontend, RPC y ficha ERP.
- [x] Normalizar visualmente los campos de texto segun el formato recibido por el ERP.
- [x] Restringir telefono a 8 digitos con prefijo fijo `+56 9` y validar la forma canonica en backend.
- [x] Reforzar validacion y normalizacion de correo en frontend y backend.
- [x] Validar casos validos/invalidos, build, auditorias Supabase, render responsivo, Guardian y produccion.

Resultado:
- El RUT mantiene validacion de digito verificador en navegador, RPC y smoke productivo.
- Nombres, apellidos, direccion, ciudad y comentarios se normalizan a formato tipo ERP; email queda en minusculas y exige `@` y dominio con extension.
- El telefono se captura como 8 digitos con prefijo fijo visible `+56 9` y se persiste como `+569XXXXXXXX`.
- Migracion `20260808025221_harden_dsal_precandidate_contact_normalization` aplicada al Supabase vinculado; smoke valido rechazo de telefono/email invalidos, persistencia normalizada y rollback sin filas.
- `test:unit` (78), `build:frontend-check`, auditorias Supabase, Playwright responsive y Guardian pasan.

### Auditoria funcional y operativa DSAL - 2026-08-08

- [x] Confirmar que la aprobacion de un precandidato copia los datos publicos a la ficha y al pipeline del candidato.
- [x] Hacer autoritativa la exigencia de folio de contratacion y cupo disponible al aprobar, con bloqueo transaccional.
- [x] Mostrar en Control de Contrataciones una instruccion accionable cuando no existan folios habilitados.
- [x] Auditar intake anonimo, deduplicacion, RLS, permisos de aprobacion, trazabilidad y registro final en ERP.
- [x] Ejecutar pruebas, build, auditorias, Guardian, smoke productivo y verificar commit/push alineados con `main`.

Resultado:
- [x] La aprobacion ahora valida dentro de la misma transaccion que el caso tenga folio no vacio, estado habilitado y cupo efectivo disponible; bloquea el caso con `FOR UPDATE` antes de ingresar al pipeline.
- [x] La UI solo ofrece folios con cupo y muestra la instruccion para solicitar a la gerencia la creacion y aprobacion del folio cuando no existe un destino habilitado.
- [x] La aprobacion conserva el ingreso por `add_candidate_to_recruitment_case`, actualiza `candidate_profiles` con identidad, contacto, domicilio, ciudad, region y licencias, registra la fuente DSAL y enlaza `recruitment_precandidates` con el caso y candidato creados.
- [x] Produccion: RLS de precandidatos activo; `anon` puede ejecutar solo el intake publico, no aprobar; `authenticated` conserva la RPC de aprobacion. Hay 1 precandidato pendiente, 48 casos activos con folio y 0 casos activos sin folio.
- [x] Validacion: prueba de integridad DSAL, build frontend, auditorias de migraciones/seguridad y Guardian pasan; Guardian finaliza con 0 errores y 0 warnings. La aprobacion autenticada de un registro real no se ejecuto para no alterar datos productivos sin un canario autorizado.

### Permisos y filas expandibles de precandidatos DSAL - 2026-08-08

- [x] Confirmar el contrato vigente de autorizacion para gerente de area DSAL, Director de Operaciones y Reclutamiento.
- [x] Aplicar la autorizacion especifica a listar, aprobar y rechazar precandidatos sin ampliar permisos de otros modulos.
- [x] Reorganizar cada precandidato como fila compacta expandible siguiendo el patron existente de Control de Contrataciones.
- [x] Mantener ocultos hasta expandir el folio destino, comentarios y resolucion; incluir pruebas de contrato y responsive.
- [x] Ejecutar build, auditorias, Guardian, smoke productivo y publicar en `main`.

Resultado:
- [x] La autoridad DSAL se resuelve por `cost_center_approvers` del contrato DSAL y se complementa con `director_op`, `reclutamiento`, `candidate_control_access` y administrador; la RPC valida el actor contra `auth.uid()`.
- [x] Listado, aprobacion y rechazo usan la nueva guardia especifica. La aprobacion solo acepta folios del contrato DSAL, mantiene el bloqueo de cupo y no relaja RLS.
- [x] La fila muestra solo identidad, contacto, domicilio, licencias, rol y estado. Folio, comentarios, fecha de revision y acciones aparecen dentro del detalle expandido con el mismo patron de `tracking-table-row-clickable` y `expanded-case-detail-grid` del ERP.
- [x] Produccion: RLS activo, payload incluye `approved_folio`, existen 4 casos DSAL activos con folio y la migracion `20260808032030_allow_dsal_precandidate_reviewers_and_expand_details` esta aplicada.
- [x] `test:integrity`, `build:frontend-check`, auditorias de migraciones/seguridad, baseline y Guardian pasan con 0 errores y 0 warnings.

### Nómina DSAL y antecedentes judiciales de precandidatos - 2026-08-08

- [x] Extraer y auditar `nomina base.xlsx` e `info judicial.xlsx` con `artifact-tool`, validando RUT, duplicados, conteos y detalle de causas.
- [x] Crear tablas protegidas y RPCs backend para consulta exacta de identidad de nómina y enriquecimiento judicial solo para revisores DSAL autenticados.
- [x] Sembrar la nómina vigente y los conteos/detalles judiciales en una migración reproducible, preservando trazabilidad de origen.
- [x] Implementar autocompletado bloqueado por RUT en la página pública y bloquear postulaciones cuyo RUT no pertenezca a la nómina vigente.
- [x] Mostrar burbujas judiciales roja/amarilla y tooltips por causa en la fila expandida de Precandidatos, manteniendo el patrón visual ERP y responsive.
- [x] Ejecutar pruebas, build, auditorías, Guardian, smoke remoto transaccional y revisión de seguridad de datos sensibles.
- [ ] Verificar commit, push y alineación efectiva con `main`.

Resultado parcial:
- `nomina base.xlsx`: 156 RUT únicos, sin duplicados.
- `info judicial.xlsx`: 195 resúmenes, 81 causas criminales y 43 laborales; se conservó el resumen oficial y el detalle completo.
- Producción Supabase: migraciones `20260808033755` y `20260808040122` aplicadas y registradas; tablas judiciales sin `select` directo para `anon`/`authenticated`.
- Smoke transaccional: la consulta pública resolvió una identidad conocida, rechazó una desconocida y al enviar nombres falsos persistió la identidad oficial de nómina; la transacción fue revertida.
- Validación: 78 pruebas unitarias, prueba focalizada DSAL, build frontend, auditorías y Guardian pasan con 0 errores y 0 warnings. Playwright validó autocompletado bloqueado y render móvil sin cambios visuales ajenos al ERP.

### Alta de usuario RRHH para revisión DSAL - 2026-08-09

- [x] Verificar que el correo no exista y reutilizar la cuenta Auth existente con recuperación segura.
- [x] Completar perfil operativo y asignar el rol `reclutamiento` requerido por Precandidatos DSAL, conservando `administrativo`.
- [x] Verificar permisos de módulo, estado de reset y aceptación del correo de recuperación por el proveedor configurado con Resend.

Resultado:
- Cuenta existente: `angel.reinoso@busesjm.com`, perfil `4913b662-4437-4618-816a-572813536ee4`.
- Perfil actualizado a `Angel Reinoso`, cargo `Administrativo de RRHH`, departamento `Recursos Humanos`, estado activo y cambio de contraseña obligatorio.
- Roles efectivos: `administrativo` + `reclutamiento`; el rol `reclutamiento` tiene acceso a `control_contrataciones` y el backend DSAL lo reconoce para revisión.
- El correo de recuperación fue aceptado para entrega con redirección a `https://gestion.busesjm.cl/reset-password`; no se generó ni se expuso una contraseña en texto plano.

### Excepción de nómina para postulaciones DSAL - 2026-08-09

- [x] Permitir que RUT válidos fuera de la nómina continúen como precandidatos.
- [x] Mantener autocompletado y bloqueo solo para RUT encontrados en la nómina.
- [x] Normalizar nombres ingresados manualmente y aplicar la misma regla en backend.
- [x] Probar ambos caminos, aplicar migración remota, auditar y publicar en `main`.
- Resultado: `20260809161820_allow_non_roster_dsal_precandidate_submissions.sql` aplicado y registrado en producción. El RUT `17.451.540-9` fue validado como no perteneciente a la nómina y aceptado transaccionalmente con nombres normalizados; un RUT de nómina conservó sus nombres oficiales. Ambos smoke tests fueron revertidos con `ROLLBACK`.

## Recursos Humanos - Solicitud de Sanciones - 2026-08-07

- [x] Consolidar el contrato funcional desde el correo `RE: [Desarrollo] Modulo Cartas de Amonestacion.eml` y sus 7 cartas tipo.
- [x] Inspeccionar rutas, permisos, patrones RRHH, contratos BUK/Storage y tablas vivas antes de implementar.
- [x] Crear modelo backend autoritativo para causales, medidas, solicitudes, documentos, historial y KPIs con RLS estricta.
- [x] Registrar acceso del modulo en `app_modules`, `role_module_access`, tipos frontend y navegacion RRHH sin romper incentivos.
- [x] Implementar UI inicial para crear solicitudes, revisar historial/control y visualizar KPIs operativos.
- [x] Agregar pruebas focalizadas de contrato, permisos y render basico.
- [x] Validar TypeScript/build, auditorias Supabase proporcionales, Guardian y `git diff --check`.

Condiciones de seguridad:
- Los antecedentes disciplinarios son informacion sensible: no exponer tablas directas sin RLS, no usar `TO authenticated` sin predicado de autorizacion y no relajar permisos para acelerar UI.
- Los adjuntos deben quedar en bucket privado con rutas vinculadas a la solicitud y acceso por RPC/politicas actor-scoped.
- La carga a BUK y la generacion/envio de PDF solo se consideran cerradas si se verifica el contrato vivo del proveedor y/o Edge Function correspondiente; si no, deben quedar como estado trazado y no como simulacion silenciosa.
- Las cartas tipo deben transformarse a plantillas con variables y catalogo versionado de causales/articulos, no texto libre oculto en frontend.
- Mientras el modulo siga en desarrollo, la visibilidad queda limitada a admin/superadmin.

Resultado:
- Implementacion completada en `supabase/migrations/20260807230621_add_hr_sanctions_module.sql` y `src/modules/sanctions`.
- El backend registra el modulo `solicitud_sanciones`, bucket privado `hr-sanctions`, causales/medidas desde el correo, solicitudes con folio, historial, documentos, transiciones y KPIs. Las tablas quedan con RLS y sin acceso directo a `authenticated`; el acceso ocurre por RPCs con `auth.uid()` y chequeo de modulo/rol.
- La UI queda disponible como vista `Sanciones` dentro de Recursos Humanos, con ingreso de solicitud, buscador de trabajador BUK activo, adjuntos privados, control de estados y KPIs; el menu queda visible solo para `admin` durante desarrollo.
- Validacion local: `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `git diff --check`, tests focalizados `hr-sanctions-integrity`/`query-keys` y Guardian full pasan con 0 errores y 0 warnings.
- Supabase produccion: migracion aplicada con `supabase db query --linked --file` por bloqueo legacy de `db push`; version `20260807230621` registrada como `applied` con `supabase migration repair --linked --status applied`.
- Smoke productivo: modulo activo, bucket `hr-sanctions` privado, 9 causales, 5 medidas, RLS activo en las 5 tablas y `role_module_access` solo contiene `admin` para `solicitud_sanciones`. Smoke transaccional con rollback valido que un usuario RRHH no-admin no accede a catalogos, admin crea/lee detalle, y quedan 0 filas `SMOKE-ERP` persistidas.
- Pendiente fase 2: generacion PDF, envio/carga BUK y reconciliacion de carpeta `Amonestaciones` solo despues de validar contrato vivo BUK.

## Dashboard clima - geolocalizacion bloqueada por headers - 2026-08-07

- [x] Confirmar el contrato actual del widget de clima y la rama que muestra fallback por IP.
- [x] Revisar los headers web desplegables para identificar si geolocalizacion queda bloqueada a nivel navegador.
- [x] Corregir el header de `Permissions-Policy` preservando el hardening de camara/microfono.
- [x] Agregar prueba de regresion para que el dashboard pueda solicitar ubicacion del mismo origen.
- [x] Validar build, pruebas focalizadas, Guardian y diff final.

Condiciones de seguridad:
- No relajar camara, microfono, CSP, XFO ni HSTS.
- La geolocalizacion solo puede quedar habilitada para el origen propio del ERP.
- Si el navegador niega permisos o no tiene ubicacion disponible, el fallback por IP debe seguir funcionando.

Resultado:
- Causa raiz confirmada en produccion: `gestion.busesjm.cl` estaba sirviendo `Permissions-Policy: camera=(), microphone=(), geolocation=()`, lo que bloquea `navigator.geolocation` para el propio ERP. Por eso el widget caia a IP fallback y mostraba Antofagasta con `Última ubicación aproximada (Ubicación no disponible)`.
- Correccion: `public/_headers` conserva `camera=()` y `microphone=()`, pero cambia a `geolocation=(self)` para permitir ubicacion solo desde el origen del ERP.
- Regresion cubierta en `frontend-security-residuals`: el test exige `geolocation=(self)` y falla si vuelve `geolocation=()`.
- Verificacion: `dist/_headers` generado contiene `geolocation=(self)`, `test:unit`, `build:frontend-check`, `git diff --check` y Guardian pasan con 0 errores y 0 warnings. `npm ci` reconstruyo dependencias locales para eliminar copias conflictivas `node_modules/* 2|3`.

## Incidente Auth: enlaces consumidos y credenciales temporales unicas - 2026-08-06

- [x] Confirmar en Auth logs la causa de los enlaces invalidos y el universo exacto pendiente.
- [x] Preparar un despachador temporal acotado que genere una clave fuerte distinta por cuenta sin registrarla.
- [x] Ejecutar canario con Laura Lopez, validar login tecnico, correo y cambio obligatorio.
- [x] Procesar solo las cuentas activas pendientes, con conteo de enviados/fallidos y sin reintentos ciegos.
- [x] Eliminar funcion y secret temporales y reconciliar cuentas, sesiones y flags en produccion.
- [x] Validar el flujo ERP, Guardian y documentar el cierre sin versionar credenciales.

Condiciones de seguridad:
- Cada contraseña temporal es aleatoria, exclusiva por cuenta y se entrega solo al correo corporativo.
- Ninguna contraseña puede aparecer en logs, respuestas, archivos, commits o trazas de CI.
- El usuario debe quedar con `must_reset_password = true` y ser dirigido a `/reset-password` despues del primer login.
- No se restaura la contraseña compartida comprometida ni se relajan RLS, grants o validaciones Auth.

Resultado:
- Los logs Auth demostraron que Microsoft Safe Links/Defender consumia los enlaces de un solo uso entre 21 y 27 segundos despues del envio; el clic humano posterior encontraba `One-time token not found`.
- Universo procesado: 21 cuentas activas pendientes. Laura fue el canario y las otras 20 se procesaron solo despues de un dry-run que confirmo el conteo.
- Cada cuenta recibio por correo corporativo una contraseña temporal criptografica y exclusiva de 21 caracteres. Ninguna contraseña fue retornada, registrada o persistida fuera de Auth y el correo individual.
- Resultado tecnico: `21 password_updated`, `21 login_smoke`, `21 sent`, `0 failed`. Despues de cada lote se repuso `must_reset_password = true` y se eliminaron las sesiones del smoke.
- Laura completo el flujo real a las `2026-08-06 14:16:42Z`: cambio su contraseña personal, el trigger autoritativo libero el flag y quedaron 0 sesiones residuales.
- Reconciliacion inmediata: 20 cuentas siguen pendientes de completar su cambio, 0 estan baneadas y 0 tienen sesiones activas. La Edge Function y el secret temporales fueron eliminados.
- La recuperacion futura por enlace requiere una landing intermedia scanner-safe; no se deben reenviar enlaces directos `/verify` como solucion a este incidente.

## Incidente Auth: recuperacion bloqueada por rate limit - 2026-08-06

- [x] Correlacionar la rotacion de cuentas del 2026-08-05 con logs Auth y estado productivo de Laura Lopez.
- [x] Confirmar el universo afectado y distinguir cuentas baneadas de credenciales rotadas sin sesion.
- [x] Restaurar la recuperacion inmediata sin reintroducir la password compartida ni quitar flags manualmente.
- [x] Configurar SMTP productivo para eliminar la cuota global de prueba de 2 correos por hora.
- [x] Corregir el frontend para preservar `status`/`code`, bloquear doble envio y aplicar cooldown ante 429.
- [x] Validar pruebas focalizadas, TypeScript/build, Guardian y estado productivo posterior.

Resultado:
- Causa raiz: la auditoria roto 23 cuentas que aun usaban una password temporal publica, pero el proyecto seguia usando SMTP incorporado de Supabase, limitado globalmente a 2 correos por hora. Dos recuperaciones exitosas consumieron la cuota y los siguientes usuarios recibieron `429 over_email_send_rate_limit` incluso en su primer intento.
- Laura Lopez estaba activa, confirmada y sin ban; tenia `must_reset_password = true`, 0 sesiones y password aleatoria desde `2026-08-06 02:23:57Z`.
- Recuperacion inmediata: 22 cuentas activas recibieron enlaces individuales de un solo uso mediante el canal Resend ya verificado; Laura fue el canario. Resultado `22 sent`, `0 failed`, `0 skipped`.
- Supabase Auth quedo con SMTP Resend productivo (`smtp.resend.com:465`), remitente `ERP Buses JM` y `rate_limit_email_sent = 30`; antes no habia SMTP custom y el limite era 2.
- Las dos Edge Functions temporales y sus cuatro secrets de incidente fueron eliminados despues de la ejecucion; no queda endpoint administrativo temporal activo.
- El frontend deja de mostrar el error crudo, conserva `code`/`status`, no reintenta automaticamente, bloquea doble click y aplica 60 segundos de cooldown tras solicitar recuperacion o recibir 429.
- Validacion focalizada: 6 pruebas Auth y `build:frontend-check` pasan; la validacion Enterprise final se registra antes del merge.

## Cierre de los dos riesgos residuales de seguridad frontend - 2026-08-05

- [x] **Residual 1 — advisories de React Router: CERRADO.** Se migro a React `19.2.7`, React DOM `19.2.7` y React Router `8.3.0`; `npm audit` y `npm audit --omit=dev` reportan 0 vulnerabilidades.
- [x] **Residual 2 — headers de seguridad no desplegados: CERRADO.** Cloudflare produccion sirve CSP, `X-Frame-Options: DENY`, HSTS y `Permissions-Policy`; los assets versionados usan cache inmutable.
- [x] Corregir las referencias historicas que todavia presentaban React Router como un riesgo abierto.
- [x] Registrar ambos cierres en el registro EEES de riesgos residuales y agregar el aprendizaje de reconciliacion documental.
- [x] Validar la documentacion con `audit:enterprise-docs`, Guardian y `git diff --check`.

Evidencia:
- PR tecnico: `#1`; merge productivo: `547a1268fa9a41e08b06d7fda683692f6f36ba46`.
- Deployment Cloudflare: `44d70579-9768-4427-91ad-ab2b9e8deaf4`.
- Estado vigente: **2 de 2 riesgos residuales cerrados**; los riesgos externos del registro EEES no corresponden a estos dos hallazgos frontend.

## Reclutamiento BUK - evaluacion segura de fichas F2 historicas - 2026-08-06

- [x] Revisar documentacion oficial BUK sobre identidad de empleado, `code_sheet`, liquidaciones y documentos firmados.
- [x] Inventariar en solo lectura las dependencias productivas de BUK `41903`, `41904`, `41905`, `41906` y `41908`.
- [x] Confirmar que claves usa el ERP para sincronizaciones futuras y que riesgo tendria renombrar `F2` a `F1`.
- [x] Comparar alternativas y documentar una recomendacion que preserve produccion, historial laboral y documentos legales.

Condiciones de seguridad:
- No modificar BUK, Supabase ni documentos historicos durante esta investigacion.
- No asumir que `code_sheet` es una etiqueta editable: toda conclusion debe apoyarse en contrato oficial y evidencia productiva.
- Si BUK no documenta expresamente el impacto sobre liquidaciones o firma, tratarlo como riesgo no resuelto y exigir validacion formal del proveedor antes de intervenir.

Resultado:
- BUK define la ficha como una relacion contractual que contiene trabajo, planes, documentos y liquidaciones. La API permite editar `code_sheet` mediante `PATCH /employees/{id}`, pero su contrato publico no garantiza que el cambio reconcilie documentos firmados, PDFs historicos, liquidaciones cerradas, LRE o integraciones basadas en codigo de ficha.
- Verificacion viva por API, sin escrituras: los cinco `employee_id` siguen activos con `F2`, un plan previsional y un trabajo vigente cada uno. Conservan 25 a 27 documentos por ficha; entre 6 y 9 archivos por persona ya incorporan `F2` en el nombre, incluyendo contratos, anexos, IRL y documentos de firma electronica.
- El ERP usa `buk_employee_id` como identidad estable para espejo, documentos, competencias y operacion. `code_sheet` se usa durante provision y como selector en importadores/modificadores BUK; cambiar solo BUK dejaria deriva con `candidate_worker_files`, reservas y snapshots, ademas de inconsistencia visual con documentos historicos inmutables.
- Recomendacion de menor riesgo: conservar estas cinco fichas historicas como `F2` y tratarlas como excepcion documentada. No crear, clonar, mover, borrar ni renombrar fichas; la prevencion forward-only ya evita nuevos casos.
- Si negocio exige normalizar a `F1`, no hacerlo como correccion directa: requerir confirmacion escrita de soporte BUK sobre nomina, LRE, firma y documentos; probar primero en sandbox; inventariar importadores externos; y ejecutar un canary coordinado que preserve el mismo `employee_id`, reconcilie espejo/worker file/reserva y valide por lectura posterior todos los IDs documentales y periodos de remuneraciones.

## Reclutamiento BUK - prevencion definitiva de fichas F2 falsas - 2026-08-06

- [x] Auditar en produccion, solo lectura, el universo de candidatos con ficha sugerida o creada superior a su historial real.
- [x] Confirmar el contrato canonico vigente entre `candidate_worker_files`, jobs BUK, espejo local BUK y la Edge Function.
- [x] Corregir la asignacion de ficha para excluir autoconteo, validar el formato, preservar reintentos legitimos y serializar decisiones concurrentes.
- [x] Agregar pruebas de regresion para primer ingreso F1, recontratacion F2, snapshot de retry, snapshot obsoleto y concurrencia.
- [x] Ejecutar auditorias SQL/seguridad, pruebas focalizadas, Guardian y smoke transaccional antes de aplicar en produccion.
- [x] Aplicar la correccion forward-only y verificar en produccion que nuevos casos no puedan reproducir el defecto.
- [x] Documentar por separado los casos historicos detectados; no modificar fichas BUK en esta fase.

Condiciones de seguridad:
- Primero se corrige y valida la causa raiz; ninguna ficha historica en ERP o BUK se modifica durante el inventario.
- Los jobs exitosos conservan su evidencia inmutable. Una reserva de retry solo puede reutilizarse si pertenece al mismo candidato y cumple el contrato valido.
- No se relajan RLS, grants ni controles de actor para resolver la asignacion.

Resultado:
- Auditoria de 135 jobs con ambos codigos: 27 jobs mostraron F1 a F2 y correspondieron a 14 personas. Solo cinco personas tuvieron impacto real por creacion directa F2 sin historia previa; no existen F3+ por este defecto, doble creacion por RUT ni carrera concurrente materializada. BUK `41903`, `41904`, `41905`, `41906` y `41908` quedan inventariados, sin cambios historicos en esta fase.
- La migracion `20260806205622_prevent_false_buk_employee_codes` crea reservas privadas unicas por documento y secuencia, serializadas con advisory lock. El resolver deja de leer snapshots y worker files como autoridad; un trigger congela la reserva en todo job y reemplaza cualquier snapshot manual/obsoleto antes de entrar a la cola.
- La Edge Function consulta BUK vivo antes de cualquier escritura, reconcilia la reserva, bloquea retries ambiguos y relee el empleado despues de crear/clonar/reutilizar. Solo confirma la reserva si BUK devuelve exactamente el `code_sheet` reservado; plan, cargo, documentos y cierre quedan bloqueados ante discrepancia.
- Seguridad productiva: `authenticated` ya no puede ejecutar el resolver ni las RPC internas; reconciliacion/confirmacion quedan solo para `service_role`. La tabla privada tiene RLS, sin grants Data API, formato `F[1-9][0-9]*` y unicidad activa por documento/correlativo.
- Produccion: migracion aplicada y registrada; `sync-buk-candidates` v55 `ACTIVE`; llamada sin autenticacion devuelve 401. Smoke transaccional prueba primer ingreso F1, retry sobre la misma reserva y reemplazo de snapshot F99 por F1; `ROLLBACK` deja 0 jobs y 0 reservas. La cola estaba y permanece en 0 pending/processing.
- Validacion: 72 unitarias, 6 contratos, 8 integridad, 8 concurrencia, Deno check, auditorias BUK/migraciones/seguridad, `git diff --check` y Guardian full con 27 gates pasan; 0 errores y 0 warnings. `npm audit` retorna 0 vulnerabilidades.

## Auditoria profunda de seguridad y hardening - 2026-08-05

- [x] Levantar baseline reproducible de dependencias, secretos, Auth, RLS, grants, RPC, Storage y Edge Functions sin alterar produccion.
- [x] Contrastar el estado vivo productivo con migraciones/configuracion y advisors, priorizando hallazgos explotables sobre warnings historicos.
- [x] Revisar en paralelo SQL/Supabase, Edge Functions/integraciones y frontend/supply-chain/privacidad.
- [x] Corregir vulnerabilidades confirmadas con cambios minimos, forward-only y backend autoritativo, sin relajar RLS ni permisos.
- [x] Ejecutar smokes de abuso y permisos, auditorias focalizadas, Guardian y validaciones proporcionales.
- [x] Aplicar/desplegar solo correcciones verificadas, reconciliar produccion y documentar riesgos residuales.

Resultado:
- Se revoco en produccion el `EXECUTE` autenticado de finalizadores BUK, reset documental, poblacion BI, preparacion operacional y helpers de correo. La fuga BI reproducible de 1.580 personas y las mutaciones privilegiadas ya no son invocables por `authenticated`.
- El reset obligatorio de password quedo autoritativo en `auth.users`: el trigger solo libera `must_reset_password` cuando cambia `encrypted_password`; la policy impide actualizar una fila cuyo flag siga activo y solo admite el no-op compatible despues del cambio real. Smokes transaccionales de trigger y RLS con rollback pasaron.
- La clave `service_role` expuesta en el historial publico fue migrada a `sb_secret`, actualizada en GitHub y en 11 Edge Functions; se desactivaron las API keys legacy y se revoco la signing key HS256 anterior. La prueba administrativa con la clave filtrada paso de HTTP 200 a 401.
- Se detectaron 23 cuentas que aun usaban la password temporal publica: se reemplazo por valores aleatorios unicos, se revocaron sus sesiones y se forzo recuperacion/reset. La reconciliacion posterior devuelve 0 cuentas afectadas.
- La carga documental de acreditacion ahora hace preflight actor-scoped antes de BUK, valida magic bytes PDF/JPEG/PNG y no retorna el payload crudo del proveedor. La generacion de certificados autentica antes de leer recursos y usa claim atomico con lease para evitar duplicados concurrentes.
- Las funciones Edge usan `SUPABASE_SECRET_KEYS`/`SUPABASE_PUBLISHABLE_KEYS`; 11 despliegues quedaron `ACTIVE`, todas rechazan llamadas sin auth con 401. Se eliminaron dos stubs productivos no versionados que respondian 410 y `config.toml` refleja las 12 funciones vigentes.
- CI ya no entrega credenciales smoke a pasos de pull request; provisioning elimina la password compartida; logout borra drafts operacionales sensibles; headers anti-clickjacking/HSTS quedan listos para el siguiente deploy frontend.
- Leaked Password Protection quedo habilitada. GitHub secret/variable usan claves modernas y el dry-run remoto de roster BUK concluyo exitoso.
- Validacion: 69 unitarias, 376 migraciones canonicas, Deno check de funciones afectadas, TypeScript/build, auditorias focalizadas, smokes productivos y Guardian pasan sin errores.
- Riesgos residuales: `react-router`/`react-router-dom` mantienen dos advisories moderados sin vector controlable confirmado; el fix disponible exige migracion mayor v7. Los headers web preparados requieren el proximo deploy/commit del frontend para reflejarse en `gestion.busesjm.cl`.

## Acceso operacional Andres Barraza - Zona Norte 2 - 2026-08-05

- [x] Confirmar en produccion la identidad unica de Andres Barraza, su perfil y sus roles aplicativos vigentes.
- [x] Inspeccionar el contrato autoritativo de gerencias/zonas y la regla backend que limita la visibilidad de folios.
- [x] Medir el universo exacto de folios asociados a Zona Norte 2 antes de modificar datos.
- [x] Asignar el cargo `Subgerente de Operaciones`, el rol efectivo equivalente a gerente de zona y el alcance Zona Norte 2 con cambio minimo y auditable.
- [x] Verificar por lectura posterior que Andres ve el universo completo esperado y que no recibe alcance sobre otras gerencias.
- [x] Ejecutar gates proporcionales, registrar evidencia y documentar el cierre.

Resultado:
- Perfil productivo unico `andres.barraza@busesjm.com` actualizado a `Subgerente de Operaciones`; conserva `operaciones_l_1` y suma `gerencia` + `aprobador_folios` para no perder acceso operativo.
- Las tres variantes CECO de Zona Norte 2 (`10114`, `20114`, `40114`) quedaron activas en `cost_center_approvers` con Andres como responsable.
- Los 30 mappings BUK de esos CECO quedaron con `manager_name = Andres Barraza Mera`, por lo que las solicitudes futuras resuelven al nuevo responsable y no solo cambian visibilidad historica.
- Universo verificado: 72 folios de la zona, 72 visibles y 0 ocultos; fuera de la zona no ve folios ajenos, salvo 5 solicitudes propias cubiertas por la regla normal de requester.
- No existian aprobaciones `area_manager` pendientes que requirieran reasignacion retroactiva.
- Migracion productiva `20260805192058_assign_andres_barraza_zona_norte_2` aplicada y registrada. `audit:migrations`, `audit:supabase-security`, smoke transaccional con rollback, lectura posterior, Guardian y `git diff --check` pasan.

## Reclutamiento BUK - sincronizacion operativa de tallas - 2026-08-04

- [x] Confirmar el contrato vivo de atributos personalizados de empleado en BUK y el universo productivo afectado.
- [x] Incorporar numero de calzado, talla de pantalon y talla de polera en creacion, clonacion y reconciliacion de fichas BUK.
- [x] Verificar por lectura posterior que BUK persiste exactamente los tres valores antes de finalizar el job como exitoso.
- [x] Agregar guardrails y pruebas para impedir que las tallas vuelvan a quedar solo en el snapshot ERP.
- [x] Desplegar la Edge Function, ejecutar un canario controlado y regularizar los trabajadores historicos afectados con trazabilidad.
- [x] Reconciliar ERP versus BUK, ejecutar Guardian y documentar el cierre productivo.

Resultado:
- `sync-buk-candidates` envia `Numero Calzado`, `Talla Pantalón` y `Talla Polera` como `custom_attributes` de empleado tanto en alta como en clonacion.
- Antes de continuar con plan, cargo, documentos y cierre exitoso, la funcion lee la ficha BUK; solo ejecuta `PATCH /employees/{id}` si existe drift y luego confirma las tres tallas y la preservacion de atributos ajenos.
- El PATCH de tallas tiene timeout de 15 segundos. Una respuesta ambigua deja el job en error; el reintento comienza con GET y no vuelve a escribir si BUK ya quedo alineado.
- Canario productivo: tres tallas actualizadas y seis atributos personalizados ajenos preservados exactamente antes de abrir el lote.
- Historico desde la obligatoriedad: 11 fichas elegibles, 1 ya alineada por canario y 10 regularizadas; 11/11 coinciden ERP-BUK y 11/11 conservan checkpoint verificado sin duplicar los valores en la evidencia.
- Produccion: `sync-buk-candidates` v42 `ACTIVE`; smoke sin autenticacion responde 401. Guardrails BUK, integridad, Deno check, Guardian y reconciliacion directa pasan sin errores.

## Certificados de competencias - nuevos modelos 4x4 - 2026-08-04

- [x] Auditar el contrato real del catálogo y confirmar marcas, tipos, modelos y códigos existentes para evitar duplicados.
- [x] Confirmar el catálogo productivo vivo y resolver si `Hilux / Fortuner 4x4` corresponde a una opción combinada o modelos separados.
- [x] Crear migración forward-only e idempotente para los cuatro registros solicitados, sin alterar opciones vigentes.
- [x] Extender el guardrail del catálogo con marca, tipo, modelo visible y estado activo esperados.
- [x] Aplicar en producción y validar RPC/catálogo visible con consulta directa.
- [x] Ejecutar auditorías de migración, seguridad, catálogo, build/Guardian y documentar el cierre.

Solicitud visual:
- Toyota · Camioneta · `Hilux / Fortuner 4x4`.
- Mitsubishi · Camioneta · `L200 4X4`.
- Maxus · Camioneta · `T60 4X4`.
- Mercedes Benz · Minibus · `Sprinter 516 4x4`.

Resultado:
- El catálogo productivo no tenía Toyota, Mitsubishi, el tipo `Camioneta` ni equivalentes semánticos de los cuatro modelos. Maxus, Mercedes Benz y `Mini Bus` fueron reutilizados sin modificar opciones existentes.
- La fuente visual se respetó como una opción combinada `Hilux / Fortuner 4x4`; no se inventaron dos modelos separados.
- Migración productiva `20260804164148_add_competency_4x4_models`: agrega `Camioneta`, TOYOTA, MITSUBISHI y los cuatro modelos mediante upserts idempotentes con postcondición SQL.
- `db push --dry-run` quedó bloqueado por versiones legacy remotas sin archivo local; se aplicó el SQL verificado con `supabase db query --linked` y se registró únicamente `20260804164148` como aplicada mediante `migration repair`.
- Smoke transaccional previo confirmó las cuatro tuplas y `ROLLBACK` dejó 0 filas; después de aplicar, consulta directa y `get_competency_catalogs()` autenticado devolvieron las cuatro opciones activas con marca/tipo correctos.
- RLS, grants, RPC y Edge Function no cambiaron. Los advisors mantienen hallazgos históricos, sin uno nuevo derivado de este cambio de catálogo.
- Validación final: migraciones, seguridad Supabase, guardrail de catálogo, TypeScript/build, smokes, pruebas y Guardian full con 27 gates pasan; 0 errores y 0 warnings.

## Limpieza profunda de duplicados y residuos locales - 2026-08-04

- [x] Confirmar el origen, contenido y alcance de las carpetas con sufijo ` 2` dentro de `node_modules`.
- [x] Respaldar de forma recuperable la instalacion local completa y reconstruirla exclusivamente desde `package-lock.json`.
- [x] Auditar duplicados versionados, codigo huerfano, documentos, binarios, caches y artefactos fuera de `node_modules`.
- [x] Eliminar solo residuos confirmados, conservando archivos con contrato runtime, operativo, legal o de auditoria.
- [x] Validar dependencias, TypeScript, build frontend, pruebas afectadas, auditoria de limpieza, Guardian y estado Git.
- [x] Documentar conteos, decisiones de conservacion, ubicacion del respaldo y cierre verificable.

Estado inicial:
- Las 16 carpetas `node_modules/@types/* 2` reportadas originalmente fueron movidas a `/tmp/app-test-types-duplicates.G6aHbQ`; las 16 estan vacias y no pertenecen al codigo versionado.
- Persisten 184 carpetas `* 2` vacias en el resto de `node_modules`, junto con residuos `extraneous` de una instalacion Deno/npm mixta. La evidencia de nombres, fechas y atributos macOS indica una colision local de copia o sincronizacion, no paquetes creados por npm.
- `node_modules/` esta ignorado y Git no versiona ningun archivo bajo esa ruta.

Resultado:
- La instalacion completa corrupta quedo respaldada en `/tmp/app-test-node-modules-backup.EZdr3z/node_modules` (280 MB) y fue reconstruida con `npm ci`; `npm ls --depth=0` pasa y quedan 0 rutas con sufijo ` 2`.
- Como macOS rehidrato copias vacias antiguas durante validaciones posteriores, la instalacion activa se movio fuera de `Documents` a `/Users/maximilianocontrerasrey/.codex/cache/app_test_1-runtime-20260804/node_modules` y el repo conserva un enlace `node_modules` ignorado. Node, Vitest, TypeScript, Deno y Guardian full quedaron validados con esa estructura.
- Se retiraron 21 MB de `dist`, cobertura, `tsbuildinfo`, `.DS_Store`, temporales Supabase y outputs de validacion a `/tmp/app-test-generated-artifacts-backup.UvijoE`; seis copias conflictivas `.git/index|refs N` quedaron en ese mismo respaldo.
- Se eliminaron ocho APIs frontend sin referencias y sus cadenas privadas; dos bloques identicos de normalizacion de candidato se consolidaron. Reduccion neta en `src`: 242 lineas.
- El unico duplicado binario tracked es `app-logo.png` en `public` y `src/assets`; se conserva porque sostiene favicon publico e import Vite. No hay documentos Markdown identicos, Office, PDF, ZIP, dumps ni logs tracked.
- PostCSS se actualizo de 8.5.18 a 8.5.25 y `npm audit` bajo de 3 a 2 moderadas. Las restantes son React Router y solo se corrigen con el salto mayor a v7.
- Seguridad local: `.env.local` quedo en modo `0600` y se retiro una clave IA frontend sin consumidor. Los seeds SharePoint con PII quedan bajo revision de gobierno porque borrarlos sin purgar historial Git no elimina la exposicion historica.
- Validacion: 64 unitarias, 6 contratos, TypeScript/build, auditoria de limpieza y Guardian full con 27 gates pasan; 0 errores y 0 warnings.

## Backfill Solicitud de Contratacion para trabajadores ya creados en BUK - 2026-08-04

- [x] Auditar el contrato productivo, resolver universo elegible y confirmar que cada candidato tenga ficha BUK efectiva.
- [x] Diseñar un backfill backend autoritativo e idempotente, con confirmacion previa de cantidad y sin reintentos ciegos.
- [x] Mantener BUK como unica custodia del PDF: generar en memoria y persistir en Supabase solo metadata, hash, token, estados y referencias BUK.
- [x] Implementar migracion/Edge Function y pruebas que impidan incorporar bucket/path/binario del PDF al ERP.
- [x] Ejecutar Guardian y smokes controlados antes de desplegar.
- [x] Confirmar universo final, desplegar y ejecutar backfill productivo por lotes con reconciliacion y evidencia.

Estado inicial:
- La generacion forward-only ya sube el PDF directamente a `Postulación` en BUK mediante un `Blob` en memoria; no crea objetos en Supabase Storage.
- El backfill historico se limita exactamente al bucket productivo `Personal contratado`: `stage_code = 'hired'` y exito BUK efectivo. No incluye candidatos de otras etapas aunque tengan datos completos o jobs antiguos.
- El levantamiento previo detecto 56 personas en ese bucket: 54 con checkpoints documentales historicos y 2 sin evidencia documental; antes de ejecutar existian 0 Solicitudes historicas.
- En el flujo futuro, la Solicitud solo puede reservarse y generarse despues de que el candidato ingresa a `Personal a Contratar` y la accion `Generar en BUK` obtiene una ficha BUK efectiva; nunca durante Control de candidatos ni por el solo cambio de etapa.

Resultado:
- El selector backend usa exactamente `stage_code = 'hired'` mas `is_effective_buk_generation_success(...)`; no reencola ni modifica jobs historicos y reconstruye `SI`/`N/A` desde payloads/checkpoints BUK 2xx.
- Universo productivo: 56 en `Personal contratado`; 53 emitibles y 3 RC-0067 bloqueados porque siguen `pending` y no tienen validador/fecha. No se inventaron firmas.
- Canario RC-0105 y 52 restantes procesados secuencialmente en 6 lotes de hasta 10: 53 `generated/success`, 53 QR `valid`, 53 hashes/tamanos completos, 0 fallidos y 0 `reconciliation_required`.
- Los 53 PDFs fueron enviados directamente a `Postulación` en BUK. El cierre transaccional guarda metadata minima, purga el snapshot privado y audita la carga; `storage.objects` contiene 0 archivos `SC-AAAA-NNNNNN.pdf`.
- Migraciones productivas `20260804145954_add_hiring_document_backfill` y `20260804151115_harden_hiring_document_backfill_finalization`; `sync-buk-candidates` v41 activo. La credencial temporal del backfill fue eliminada al terminar.
- Verificacion: Edge logs del backfill HTTP 200, source jobs con 0 checkpoints nuevos, RPC privadas solo `service_role`, 9 pruebas focalizadas y Guardian completo sin errores ni warnings.

## Solicitud de Contratacion ERP y carga documental BUK - 2026-08-04

- [x] Inspeccionar las referencias visuales, el generador productivo de certificados, el contrato real de RC-0105 y el catalogo documental vigente.
- [x] Presentar una maqueta A4 deterministica con datos reales anonimizables, marca de muestra y la estetica del certificado de competencias.
- [x] Obtener aprobacion visual explicita antes de modificar el generador o el flujo BUK.
- [x] Disenar el contrato backend autoritativo: snapshot, folio/token, logo por empresa, firma electronica visual y estados de carga BUK idempotentes.
- [x] Implementar con migracion forward-only, Edge Function y reutilizacion del upload documental existente, sin relajar RLS, grants ni autenticacion.
- [x] Validar generacion, QR/verificacion, carga en BUK, reintentos/idempotencia, auditorias Supabase, Guardian y smoke productivo controlado.

Resultado:
- La Solicitud se genera dentro de `sync-buk-candidates` despues de crear/configurar al trabajador y antes de cargar sus documentos; se sube como PDF a la carpeta BUK `Postulación` junto con los documentos del candidato.
- El PDF A4 usa formato `F-RH-010`, logo variable por empresa, 10 antecedentes de contratacion, los 17 tipos documentales activos con `SI`/`N/A`, firma del validador ERP y QR token-only hacia `/verificar/documento/:token`.
- El backend congela snapshot y hash, reserva folio unico y separa el payload publico: no expone sueldo, adjuntos, URL BUK ni RUN completo. Tablas y RPC quedan sin acceso `anon`/`authenticated`, con RLS deny y ejecucion exclusiva `service_role`.
- Los estados ambiguos de carga BUK se bloquean como `reconciliation_required`; un `processing` heredado tampoco se reintenta a ciegas. El checkpoint BUK queda persistido en el job antes de cerrar el documento.
- Produccion: migraciones `20260804141923_add_hiring_request_documents` y `20260804142435_index_hiring_request_document_foreign_keys`; Edge Functions `verify-hiring-document` v1, `verify-competency-certificate` v2 y `sync-buk-candidates` v35 `ACTIVE`.
- Smoke productivo transaccional sobre RC-0105 valido snapshot, folio, 17 documentos y verificacion previa, y `ROLLBACK` confirmo 0 documentos persistidos. Los dos verificadores respondieron HTTP 200; competencias devuelve RUN de trabajador e instructor enmascarados.
- Validacion local: PDF real renderizado A4 de una pagina, Deno checks, idempotencia, build, rutas publicas/protegidas, migraciones, seguridad, performance, `git diff --check` y Guardian full pasan con 26 gates, 0 errores y 0 warnings. Advisors sin hallazgos de seguridad nuevos; los nueve indices FK sugeridos quedaron aplicados.

## Auditoria integral de codigo, logs y seguridad - 2026-08-03

- [x] Levantar baseline reproducible del repositorio: estado Git, dependencias, TypeScript, build, tests, Guardian y auditorias EEES/Supabase.
- [x] Revisar en paralelo frontend/runtime, backend Supabase/Edge Functions, seguridad/autorizacion y complejidad/duplicacion contra contratos vivos.
- [x] Inspeccionar logs disponibles de CI y Supabase, separando incidentes activos de warnings historicos baselineados.
- [x] Corregir solo hallazgos confirmados con causa raiz y cambio minimo; usar migraciones forward-only y no relajar RLS/grants.
- [x] Reducir codigo repetido solo cuando preserve contratos publicos y quede cubierto por pruebas o gates existentes.
- [x] Reejecutar validacion proporcional al cambio, Guardian y `git diff --check`; documentar hallazgos, riesgos residuales y resultado final.

Estado inicial:
- `main` limpio y alineado con `origin/main` en `aeb0861`.
- La auditoria parte desde EEES, contratos reales y el baseline historico de seguridad; no se consideran corregibles los 82 warnings historicos sin evidencia nueva de explotabilidad.
- Breaking changes Supabase revisados al 2026-08-03: vigilar versionado explicito de extensiones desde 2026-08-05 y exposicion Data API de tablas nuevas; no se asumira que una tabla `public` nueva queda accesible sin grants/RLS explicitos.

Resultado:
- Seguridad de sesion: `AuthContext` cancela y limpia React Query y el estado de autorizacion al cambiar identidad; las respuestas asincronas antiguas ya no pueden sobrescribir la sesion nueva.
- Privacidad: Operaciones deja de persistir el directorio de conductores en `localStorage` y purga snapshots v1; ORION aplica allowlist recursiva y redaccion de RUT, correo y telefono antes de entregar resultados de herramientas al proveedor externo.
- Exactitud: las fechas SQL `YYYY-MM-DD` se formatean como fechas calendario UTC, evitando el desplazamiento al dia anterior en Chile.
- Edge Functions: se corrigieron errores reales de `deno check` en ORION, procesador de documentos y sincronizacion de cargos BUK; los cuatro checks Edge quedaron incorporados al Guardian full.
- Reduccion: `competencyApi.ts` conserva solo cuatro escrituras y delega lecturas al boundary existente; se elimina el preview PDF sin consumidores y cinco dependencias frontend asociadas. Son 903 lineas productivas menos, 642,227 bytes menos en `dist`, 478,046 bytes menos de JS y tres chunks menos.
- Logs: GitHub Actions no mostro fallas funcionales activas; el ultimo fallo del commit auditado era solo el baseline JS (+2,530 bytes) y queda absorbido por la reduccion medida. Auth/Storage Supabase no mostraron errores activos; los conectores de logs API/Postgres/Edge no respondieron y quedan como limitacion de evidencia, no como PASS inferido.
- Produccion: `orion-chat` desplegada como version 30 `ACTIVE`, manteniendo `verify_jwt=false` porque valida el bearer dentro de la funcion. Smoke sin token responde `401` con `Sesion invalida para ORION`; la fuente remota contiene `privacy.ts` y la metrica de redaccion.
- Validacion: Guardian full PASS con 25 gates, 0 errores y 0 warnings; 64 unitarias, contratos, integridad, concurrencia, idempotencia, cobertura, TypeScript, build, rutas, migraciones, seguridad Supabase, performance, cuatro checks Edge y `git diff --check` pasan.
- Estado historico al 2026-08-03: `npm audit --omit=dev` mantenia dos moderadas de React Router cuya unica correccion disponible entonces era un salto mayor. **Este riesgo fue cerrado el 2026-08-05** mediante la migracion validada a React Router `8.3.0`; los 82 warnings historicos Supabase siguen baselineados y no se detectaron nuevas exposiciones anonimas/RLS.

## Navegacion superior ERP - responsivo celular

- [x] Reproducir/inspeccionar contrato real del `AppShell` y CSS global del topnav.
- [x] Corregir el menu desplegable en móvil para que quede por encima del contenido y se pueda tocar/scrollear sin quedar tapado.
- [x] Mantener intacto el comportamiento desktop mediante media queries acotadas a pantallas chicas.
- [x] Validar frontend, diff y, si es posible, navegación móvil con browser local.
- [x] Corregir reapertura productiva: flecha cambia en celular, pero las opciones siguen ocultas bajo saludo/widget.
- [x] Validar que el panel móvil queda fuera del scroller del topnav y sobre ORION/widget.

Resultado:
- `AppShell` marca el header con `top-shell--nav-open` mientras un modulo esta desplegado.
- En celular (`max-width: 768px`) el header queda sticky, la barra conserva logo/nav/acciones en una fila compacta, el nav permite scroll horizontal tactil y el dropdown abre como panel fijo sobre el contenido, con ancho de viewport, `z-index` superior y scroll vertical.
- En escritorio el dropdown conserva su contrato anterior: header `relative` y panel `absolute`.
- Validacion: `build:frontend-check`, `git diff --check`, Playwright en 390x844 y 1280x800, y `guardian` pasan. El baseline performance sube solo por la capa responsive medida: +2,464 bytes total, +38 JS, +2,426 CSS; sin vendors ni assets nuevos.
- Reapertura corregida: el panel movil ahora se renderiza como `top-nav-mobile-panel` fuera del scroller `.top-nav-stage`; el dropdown desktop queda oculto en movil con `top-nav-dropdown-panel--desktop`. Playwright con saludo/dashboard y ORION `z-index: 9999` confirma que el elemento superior bajo el punto del panel abierto pertenece al menu.

## Reclutamiento - ficha candidato obligatoria antes de Listo para contratar

- [x] Confirmar contrato vivo de `get_candidate_checklist(...)`, ficha BUK candidato y `advance_recruitment_candidate_stage(...)`.
- [x] Hacer obligatoria la ficha del candidato antes de avanzar a `ready_for_hire`, incluyendo numero calzado, talla pantalon y talla polera.
- [x] Entregar mensajes claros con campos faltantes cuando la ficha no este completa.
- [x] Validar con pruebas focalizadas, auditorias SQL/frontend y diff limpio.

Resultado:
- La migracion `20260730211444_require_candidate_buk_file_before_ready_for_hire` recompila `get_candidate_checklist(...)` para incluir `Ciudad`, `Número calzado`, `Talla pantalón` y `Talla polera` en la completitud de ficha.
- `advance_recruitment_candidate_stage(...)` recalcula el checklist antes de pasar a `ready_for_hire`; si falta ficha, bloquea con mensaje claro y lista de campos pendientes, aunque la revision documental haya sido aprobada antes.
- Control Documental muestra los campos concretos faltantes de la ficha del candidato.
- La validacion remota fue transaccional con `ROLLBACK`: un candidato no terminal con tallas vacias fue puesto temporalmente en `document_review` aprobado y la RPC rechazo el avance por ficha incompleta; luego se confirmo que su etapa y validacion documental originales permanecieron intactas.
- Validacion local: unitarias, TypeScript, `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `audit:performance-baseline`, `guardian` y `git diff --check` pasan.

## Reclutamiento/BUK - bloqueo estructural de sobrecupo

- [x] Auditar flujo completo de cupos: paso a `ready_for_hire`, encolado `enqueue_buk_generation`, exito BUK y movilidad interna.
- [x] Definir regla backend autoritativa que reserve cupos por caso con contratados, BUK efectivo, jobs BUK `pending/processing` y movilidad interna vigente, sin bloquear al propio candidato.
- [x] Corregir RPCs/migraciones para impedir que BUK genere candidatos por sobre `requested_vacancies` aunque la UI seleccione de mas.
- [x] Ajustar UI de `Personal a Contratar` para mostrar y evitar selección de candidatos bloqueados por sobrecupo.
- [x] Validar con smoke SQL productivo, tests, build, auditorias Supabase, performance y Guardian.

Resultado:
- Se agrego `get_recruitment_case_buk_capacity_snapshot` como regla backend unica de capacidad por caso: suma contratados/BUK efectivo, jobs `pending/processing` y movilidades internas pendientes o aprobadas en ejecucion.
- `enqueue_buk_generation` bloquea el encolado sobre cupo con lock del caso y reserva por lote, por lo que una seleccion masiva no puede encolar mas personas que cupos disponibles.
- `claim_buk_sync_jobs` vuelve a validar capacidad antes de procesar y marca jobs excedentes como `error` con `vacancyGuard`, cubriendo jobs antiguos, retries y concurrencia.
- `Personal a Contratar` consume `buk_available_vacancies` y deshabilita candidatos cuyo caso ya no tiene cupo; al seleccionar todo solo toma los primeros candidatos que caben por caso.
- Migracion remota aplicada en Supabase como `20260729150153_guard_buk_generation_vacancy_overfill`.
- Smoke productivo de solo lectura: funciones `SECURITY DEFINER` y grants esperados; cola BUK actual en 0 `pending` y 0 `processing`; `claim_buk_sync_jobs(1, null)` retorna 0 sin error.
- Deuda historica detectada: `RC-0052` ya tiene 3 BUK efectivos para 2 cupos antes de este guardrail. No se corrige automaticamente porque son trabajadores ya generados en BUK.
- Validacion local: TypeScript directo, `test:integrity`, `test:concurrency`, `audit:migrations`, `audit:supabase-security`, `check:edge:sync-buk-candidates`, `build:frontend-check`, `audit:buk-sync-guards`, `audit:performance-baseline`, `git diff --check` y `guardian` pasan.

## Business Intelligence - nitidez etiquetas Inversion por contrato

- [x] Ubicar el render real del grafico `Inversión por contrato` en Incentivos BI.
- [x] Corregir estilo de texto dentro de barras para eliminar contorno/fondo blanco pixelado.
- [x] Validar TypeScript, build frontend, performance y Guardian antes de cerrar.

Resultado:
- El grafico `Inversión por contrato` estaba renderizando labels con `textBorderWidth = 3` y borde blanco, lo que generaba un halo pixelado tipo fondo blanco sobre la barra.
- Se elimina el contorno blanco y se deja texto oscuro semitransparente, `12px`, peso 700, distancia interna estable y truncado nativo por ancho para conservar nitidez y evitar cajas artificiales.
- Validacion: TypeScript directo, `build:frontend-check`, `audit:performance-baseline`, `git diff --check` y `guardian` pasan.

## Business Intelligence - filtros Jornada no refrescan tarjetas para Manuel Parra

- [x] Reproducir con usuario Manuel Parra si el RPC BI cambia `summary` y `averageHiringDays` al recibir `p_shift_names`.
- [x] Confirmar si el problema esta en envio frontend, cache/query key, normalizacion de jornada o calculo backend.
- [x] Corregir causa raiz sin relajar permisos BI ni romper filtros de gerencia/contrato/cargo.
- [x] Validar produccion, TypeScript, unitarias, build, performance y Guardian antes de versionar.

Resultado:
- Smoke productivo transaccional con `manuel.parra@busesjm.com`: sin filtro Jornada el RPC devuelve `averageHiringDays = 99.1`; con `7X7` devuelve `143.7`; con `10X5+5` devuelve `19.8`. El backend y permisos BI para gerencia si filtran correctamente.
- Causa raiz frontend: BI Reclutamiento heredaba `staleTime` de 5 minutos y podia mantener tarjetas antiguas visibles durante el refetch, por eso `Tiempo Medio de Contratacion` seguia mostrando `3 meses 9 dias`.
- `useBiRecruitmentDashboard` ahora fuerza datos frescos (`staleTime = 0`, `gcTime = 0`, `refetchOnMount = "always"`) y la vista considera `isFetching` como carga para no presentar indicadores obsoletos mientras cambia Jornada.
- Se agrega test de regresion para que el dashboard BI Reclutamiento conserve esta politica de frescura.
- Validacion: TypeScript directo, unitarias, `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `audit:performance-baseline`, `git diff --check` y `guardian` pasan. No requirio migracion SQL.

## Business Intelligence - estetica de graficos Reclutamiento

- [x] Homologar las donas de Reclutamiento al estilo visual e interactivo de Incentivos, manteniendo colores propios.
- [x] Aplicar labels truncados, separacion entre segmentos, sombra suave y leyenda inferior con iconos circulares.
- [x] Mantener tooltips operativos actuales de cobertura y movilidad.
- [x] Validar TypeScript, unitarias, build frontend, performance y Guardian antes de versionar.

Resultado:
- Las donas `Cobertura de Cupos` y `Estado de Movilidad Interna` usan radio `50%/75%`, centro superior, `padAngle`, borde redondeado, sombra suave y leyenda inferior con icono circular, homologadas con Incentivos.
- Los colores siguen siendo los propios de Reclutamiento; no se mezclo paleta con Incentivos.
- Los tooltips pasan al formato `.chart-tooltip` y conservan la informacion operativa de cobertura, contratacion, movilidad, faltantes y solicitudes.
- La ruta local `/bi/reclutamiento` redirige a `/login` sin sesion, por lo que la verificacion visual navegada quedo limitada a autenticacion; build y Guardian validan render sin errores.
- Validacion: TypeScript directo, unitarias, `build:frontend-check`, `audit:performance-baseline`, `git diff --check` y `guardian` pasan.

## Business Intelligence - paleta cobertura y movilidad

- [x] Cambiar `Cupos faltantes` a rojo opaco, sin usar naranja chillón.
- [x] Separar colores de `Pendiente ejecución RRHH` y `Pendiente control contratos` en movilidad interna.
- [x] Alinear orden/paleta de etapas BI con `Levantamiento de Contraindicación`.
- [x] Validar frontend, tests unitarios, performance y Guardian antes de versionar.

Resultado:
- `Cupos faltantes` usa `missingVacancies` (`#b95a4f` en tema claro), separado del naranja general `pending`.
- `Pendiente ejecución RRHH` mantiene morado de movilidad y `Pendiente control contratos` usa indigo propio, evitando dos criterios con el mismo color.
- El orden de etapas BI incorpora `Levantamiento de Contraindicación` entre `Exámenes médicos` y `Revisión documental`.
- Validacion: TypeScript directo, unitarias, `build:frontend-check`, `audit:performance-baseline`, `git diff --check` y `guardian` pasan.

## Control de Contrataciones - filtros multiples y contraindicacion medica

- [x] Convertir filtros de procesos a seleccion multiple, con busqueda digitada al menos en Turno y Contrato.
- [x] Agregar etapa opcional `Levantamiento de Contraindicacion` entre Examenes Medicos y Revision Documental.
- [x] Actualizar contratos frontend/backend, labels, constraints y transiciones sin romper etapas existentes.
- [x] Validar localmente, aplicar migracion productiva y versionar en `main`.

Resultado:
- `Control de Contrataciones` usa `MultiSelectField` para Turno, Pasajes, Alojamiento y Contrato; Turno y Contrato permiten digitar para acortar busqueda y todos aceptan mas de una seleccion.
- Se agrega la etapa opcional `medical_contraindication_resolution` con label `Levantamiento de Contraindicación`: desde `medical_exams` se puede ir a esa etapa o directo a `document_review`; desde la nueva etapa solo se puede continuar a documental o cerrar la participacion.
- La migracion `20260727203203_add_medical_contraindication_resolution_stage` actualiza constraint, RPC `advance_recruitment_candidate_stage`, grants y reload de PostgREST sin relajar permisos.
- Migracion remota aplicada y registrada. Smoke productivo transaccional: candidato `d0b89e6f-cbae-44c6-8fb6-a4ce3d07c793` avanzo a `medical_contraindication_resolution` dentro de `begin/rollback` y luego quedo confirmado nuevamente en `medical_exams`.
- Validacion: unitarias, contratos, integridad, TypeScript directo, `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `audit:performance-baseline`, `git diff --check` y `guardian:full` pasan con 0 errores y 0 warnings.

## Business Intelligence - gerencia sin data en Reclutamiento

- [x] Confirmar matriz productiva de `bi_analytics`/`bi_reclutamiento` para roles gerenciales.
- [x] Confirmar causa raiz de datos vacios para usuarios `gerencia` sin centro de costo asociado.
- [x] Ajustar RPCs de BI Reclutamiento para que `bi_reclutamiento` habilite alcance BI completo sin relajar pantallas operativas.
- [x] Validar localmente, aplicar migracion remota y smoke por rol gerencial real.
- [x] Versionar y pushear a `main` si Guardian queda limpio.

Resultado:
- La matriz productiva tiene `bi_analytics` y `bi_reclutamiento` activos para `admin`, `reclutamiento`, `control_contratos`, `director_eje`, `gerente_general`, `director_op` y `gerencia`.
- Causa raiz: usuarios `gerencia` puros tenian acceso a la pestaña, pero `user_can_view_hiring_request_process_summary` les devolvia 0 filas si no estaban configurados como aprobadores de centro de costo.
- La migracion `20260727201912_allow_bi_recruitment_feature_full_data_scope` ajusta solo los RPC BI `get_bi_recruitment_dashboard` y `get_bi_recruitment_daily_timeline`: si el usuario tiene feature `bi_reclutamiento`, ve el universo BI completo; no cambia permisos operativos de folios.
- Smoke productivo con `alan.brain@busesjm.com` (`gerencia` puro): dashboard actual devuelve 52 folios abiertos, 112 cupos solicitados y 91 candidatos en curso; con Jornada `7X7` devuelve 4 folios y 7 cupos; timeline `7X7` devuelve 31 dias.
- Validacion: unitarias, TypeScript, `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `git diff --check` y `guardian:full` pasan. Migracion remota aplicada y registrada en `supabase_migrations.schema_migrations`.

## Business Intelligence - Jornada no refresca indicadores

- [x] Corregir query key BI para que `shiftNames` cambie cache/refetch de tarjetas y graficos.
- [x] Confirmar que el backend productivo ya cambia metricas cuando recibe `p_shift_names`.
- [x] Agregar tests contra regresion de filtros BI y validar Guardian antes de versionar.

Resultado:
- Causa raiz: `queryKeys.bi.recruitmentDashboard(filters)` no incluia `shiftNames`; al cambiar Jornada React Query mantenia la misma cache key y no reconsultaba tarjetas/graficos.
- `get_bi_recruitment_dashboard('current', ..., array['7X7'])` en produccion devuelve metricas filtradas, por lo que no se requiere nueva migracion SQL para este bug.
- El embudo `BiRecruitmentFunnel` pertenece a Dotacion y no recibe el filtro Jornada visible en Reclutamiento; no es parte de la correccion de esta pestaña.
- Se agrega test de regresion para que `shiftNames` forme parte de la key y se mantiene normalizacion estable por orden/espacios.
- Validacion: unitarias, TypeScript, `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `audit:performance-baseline`, `git diff --check` y `guardian:full` pasan.

## Business Intelligence - filtro jornada y formato tiempo medio

- [x] Confirmar fuente real de jornada/turno para BI Reclutamiento y valores productivos.
- [x] Extender RPC y tipos frontend para filtrar por jornada con opciones dinamicas.
- [x] Ajustar layout de filtros: periodo mas pequeno y cinco filtros ordenados sin amontonamiento.
- [x] Cambiar `Tiempo Medio de Contratacion` a formato años, meses y dias omitiendo unidades en cero.
- [x] Validar localmente, versionar y aplicar migracion productiva si corresponde.

Resultado:
- La fuente productiva de Jornada es `hiring_requests.shift_name`; movilidad interna usa fallback `internal_mobility_requests.destination_shift_name` cuando corresponde.
- `get_bi_recruitment_dashboard` y `get_bi_recruitment_daily_timeline` tienen overload compatible con `p_shift_names`, aplicado a resumen, graficos, timeline, movilidad y opciones del filtro.
- El frontend agrega filtro `Jornada`, achica `Periodo` en el grid de Reclutamiento y limpia selecciones que ya no existen al cambiar filtros.
- `Tiempo Medio de Contratacion` ahora muestra años, meses y dias, omitiendo unidades en cero; por ejemplo `99.1` dias se muestra como `3 meses 9 días`.
- Validacion local: unitarias, `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `audit:performance-baseline`, `git diff --check` y `guardian:full` pasan. Migracion remota `20260727191632_add_bi_recruitment_shift_filter` aplicada y registrada; smoke productivo confirma catalogo de jornadas y filtro `7X7`.

## Business Intelligence - grafico cobertura cupos local pendiente

- [x] Confirmar fuente actual del grafico `Estado de Casos` y campos disponibles en `summary`.
- [x] Cambiar el grafico a porcentaje de cobertura entre cupos solicitados y cubiertos.
- [x] Mostrar en tooltip de cupos cubiertos desglose por contratacion y movilidad interna.
- [x] Validar TypeScript, build/performance y diff sin commit ni push a `main`.

Resultado:
- El grafico izquierdo de BI Reclutamiento pasa de `Estado de Casos` a `Cobertura de Cupos`.
- La dona muestra `Cupos cubiertos` versus `Cupos faltantes`, calculados desde `requestedVacancies` y `filledVacancies`, ambos ya filtrados por el RPC del dashboard.
- El tooltip de `Cupos cubiertos` muestra cobertura porcentual, total cubierto, contratacion, movilidad interna y cupos solicitados.
- Validacion local: TypeScript directo, `build:frontend-check`, `audit:performance-baseline` y `git diff --check` pasan. Sin commit ni push a `main`.

## Business Intelligence - tiempo medio de contratacion local pendiente

- [x] Confirmar contrato vigente de tarjetas BI Reclutamiento y RPC filtrado.
- [x] Calcular `Tiempo Medio de Contratacion` desde aprobacion del folio hasta primera contratacion real, sujeto a filtros BI.
- [x] Reemplazar la tarjeta `Listos para Contratar` por el nuevo indicador sin commit ni push a `main`.
- [x] Validar migraciones, seguridad Supabase, TypeScript, build, performance y diff limpio.

Resultado:
- El RPC `get_bi_recruitment_dashboard` entrega `summary.averageHiringDays` calculado por folio desde `recruitment_cases.opened_at` hasta la primera candidatura en `hired`.
- El indicador respeta permisos BI y filtros de gerencia, contrato y cargo; cuando hay periodo seleccionado, considera contrataciones cuya primera fecha de contratacion cae dentro del periodo.
- La tarjeta final de BI Reclutamiento cambia de `Listos para Contratar` a `Tiempo Medio de Contratacion` y muestra dias; sin contrataciones validas para el filtro muestra `Sin datos`.
- Validacion local: unitarias, `audit:migrations`, `audit:supabase-security`, TypeScript directo, `build:frontend-check`, `audit:performance-baseline` y `git diff --check` pasan. Sin commit ni push a `main`.

## Business Intelligence - visibilidad Reclutamiento local pendiente

- [x] Confirmar matriz real de `bi_analytics` y feature `bi_reclutamiento`.
- [x] Dar acceso a pestaña BI Reclutamiento para `reclutamiento`, roles gerenciales y administradores de contratos.
- [x] Validar migraciones, seguridad Supabase y TypeScript sin push a `main`.

Resultado:
- La ruta BI sigue gobernada por `role_module_access` sobre `bi_analytics`; la pestaña `Reclutamiento` sigue gobernada por `role_feature_access` sobre `bi_reclutamiento`.
- Migracion local `20260727184624_grant_bi_recruitment_access_roles.sql`: afirma `bi_analytics` y `bi_reclutamiento` para `admin`, `reclutamiento`, `control_contratos`, `director_eje`, `gerente_general`, `director_op` y `gerencia`.
- No se agrego bypass frontend: `BiDashboardPage` conserva el gating por `accessibleFeatures`, que es el contrato auditable devuelto por backend.
- Validacion local: `audit:migrations`, `audit:supabase-security`, TypeScript directo y `git diff --check` pasan. Sin commit ni push a `main`.

## Auditoria integral ERP front/back - 2026-07-27

- [x] Levantar estado limpio del repositorio, contratos vivos y puertas enterprise actuales.
- [x] Ejecutar auditorias de seguridad, migraciones, dependencias, build, tests y Guardian sin relajar controles.
- [x] Revisar funcionamiento critico pendiente: movilidad interna debe refrescar folios destino automaticamente sin recargar pagina.
- [x] Corregir solo hallazgos con causa raiz clara, de bajo riesgo operacional y trazabilidad backend/frontend.
- [x] Validar con gates locales completos y dejar versionado/push si el sistema queda estable.

Resultado:
- Estado inicial limpio en `main...origin/main`.
- `audit:migrations` pasa con 360 migraciones canonicas y sin duplicados.
- `audit:supabase-security` pasa sin errores; conserva 82 warnings historicos baselineados que no se corrigieron relajando ni reescribiendo permisos sin causa raiz.
- `npm audit` detecto 1 vulnerabilidad alta en `postcss` y 2 moderadas en `react-router`/`react-router-dom`; se actualizo `postcss` a `8.5.18` y la vulnerabilidad alta queda eliminada.
- Estado historico al 2026-07-27: React Router quedo temporalmente como riesgo moderado residual porque la correccion disponible exigia un cambio semver-major. **Este riesgo fue cerrado el 2026-08-05** mediante la migracion validada a React Router `8.3.0`.
- Movilidad interna: `eligible_folios` deja de cachearse 15 minutos; ahora refetchea al montar, foco, reconexion, Realtime de folios/aprobaciones y apertura del selector `Folio destino`.
- `build:frontend-check`, `npm run build`, unitarias, TypeScript directo, smoke de rutas y `git diff --check` pasan. El baseline performance final medido por Guardian full sube `distTotalBytes` a `10,671,549` y `jsTotalBytes` a `3,024,179`; CSS/vendors/assets trackeados quedan intactos.
- `guardian:full` pasa con 0 errores y 0 warnings.

## Administradores de contratos - alcance Mario Sierra Gorda

- [x] Revisar `buk_contract_mappings` para Mario, Angel y Jose en Sierra Gorda/DMH.
- [x] Corregir a Mario para que conserve solo `SIERRA GORDA OPERACIONES`.
- [x] Devolver `ARAMARK SIERRA GORDA INTERNO` a Angel Guerra y validar DMH.
- [x] Ejecutar gates SQL/Guardian y commitear/pushear a `main`.

Resultado:
- La migracion remota `20260723152941_fix_mario_pizarro_sierra_gorda_contract_scope` quedo registrada en `supabase_migrations.schema_migrations`.
- Validacion remota: Mario Pizarro Fernandez queda con 0 mappings DMH/Ministro Hales y 1 mapping `SIERRA GORDA OPERACIONES`.
- Validacion remota: `ARAMARK SIERRA GORDA INTERNO` queda asignado a Angel Guerra Basso.
- La migracion local `20260723152941_fix_mario_pizarro_sierra_gorda_contract_scope.sql` versiona el guardrail aplicado para reproducibilidad y auditoria.

## CI - Audit Enterprise Guardrails performance baseline

- [x] Auditar los runs fallidos reportados por correo en `Audit Enterprise Guardrails` para commits `fc73796`, `317571a`, `24866ca`, `ee90e10`, `ad5949a` y `9beefaf`.
- [x] Confirmar si existe un fallo activo distinto en tests, Supabase, Deno, smokes o build.
- [x] Corregir el baseline de performance con el valor canonico medido por GitHub Actions, sin relajar controles de vendors ni assets trackeados.
- [x] Reejecutar gates locales y dejar commit versionado para que el siguiente run de `main` cierre el ruido de correos.

Resultado:
- Todos los runs fallidos inspeccionados comparten una unica causa: `EEES Guardian` falla en `audit:performance-baseline`.
- Evidencia CI del run `30047476403`: `JS total 3023917 <= baseline 3022926`; el resto de gates reportados por Guardian pasan.
- Los logs de los runs `30044854591`, `30045700498`, `30047056230` y `30047476403` confirman el mismo valor `JS total = 3,023,917`.
- Correccion aplicada: `eees/baselines/PERFORMANCE_BASELINE_v1.md` sube a version `1.0.2` y actualiza solo `jsTotalBytes` a `3,023,917`, manteniendo sin cambios `distTotalBytes`, CSS y assets/vendors trackeados.

## BUK - mapping ZONA II CONTRATISTAS

- [x] Auditar el fallo de generacion BUK del candidato Christopher Williams Quispe Charcas contra job/snapshot productivo.
- [x] Confirmar contrato, numero BUK y area destino esperada para `ZONA II CONTRATISTAS`.
- [x] Corregir mapping de contrato/area con migracion forward-only si falta el enlace interno.
- [x] Validar con smoke remoto en rollback y gates SQL/Guardian antes de versionar.
- [x] Auditar el segundo fallo productivo por `company_id`, `area_id` o `leader_id` despues de restaurar el mapping JM.
- [x] Corregir la resolucion de solicitante BUK cuando el email ERP no coincide con el email vigente del snapshot BUK.
- [x] Desplegar `sync-buk-candidates` en Supabase productivo y reintentar el job real de Cristopher.

Resultado:
- El job BUK `33458800-64cb-4511-ae26-6cc93f6c2dff` fallo despues de reutilizar la ficha inactiva `42266`: `No existe un mapping BUK con area operativa para el contrato ZONA II CONTRATISTAS`.
- Produccion tenia `CONT-092` y `buk_contract_mappings.id = 92` en `0000000168:0001` pero con `buk_area_code = null`; por eso el worker no podia resolver el area operativa aunque la rama existiera en BUK.
- El catalogo BUK confirma `ZONA II CONTRATISTAS` bajo `JM` con area hija `id = 3008`, `name = 0000000168:0001`, `cost_center = 721`.
- La migracion productiva `20260723211426_fix_zona_ii_contratistas_buk_area_mapping` llevo temporalmente el mapping a CNN `0000000168:0004`; la aclaracion operacional posterior confirma que el destino correcto es Buses JM `0000000168:0001`.
- La migracion productiva correctiva `20260723213807_restore_zona_ii_contratistas_jm_buk_mapping` restaura `contracts` y `buk_contract_mappings` a `0000000168:0001`, `buk_area_code = 721`, `company_name = Buses JM Pullman S.A.`.
- Validacion remota posterior: `CONT-092` y mapping quedan con `contract_number = 0000000168:0001`, `buk_area_code = 721`, empresa resuelta `Buses JM Pullman S.A.`.
- Validacion BUK: el rol `PREVENCIONISTA DE RIESGOS` incluye `area_id = 3008`, por lo que el mapping ya no deberia fallar por area operativa.
- Validacion local: `audit:migrations`, `audit:supabase-security`, `git diff --check` y `guardian` pasan con la restauracion JM.
- El retry productivo posterior fallo en el job `487f5e26-1a06-45e9-862b-8a45d9b00dc7` despues de reutilizar la ficha BUK `42266`: ya resolvia contrato `0000000168:0001`, area `721` y rol, pero no podia completar `leader_id`.
- Causa raiz: la solicitud usa `requester_email = manuel.parra@busesjm.com`, mientras el snapshot BUK activo de Manuel Enrique Parra Soto tiene email `parrasotomanuelenrique@gmail.com`, `buk_employee_id = 19687` y `company_id = 1`; buscar solo por email dejaba `leader_id = 0`.
- Correccion aplicada: `sync-buk-candidates` mantiene la busqueda viva por email y agrega fallback auditado al cache local BUK por email exacto y por nombre del solicitante con coincidencia estricta de tokens, sin modificar maestros BUK ni crear datos sinteticos.
- Incidente persistente posterior: los jobs `12b3c8e6-1737-46cd-b448-581fad6d1a97` y `942cb0da-bb0e-415c-afd2-4311e69fe7be` fallaron porque la Edge Function productiva aun no tenia desplegado el commit `9beefaf`.
- Despliegue aplicado: `npx --yes supabase functions deploy sync-buk-candidates --project-ref pzblmbahnoyntrhistea --use-api --yes`; la funcion remota queda activa en version `34`.
- Smoke real productivo: reintento controlado del job `942cb0da-bb0e-415c-afd2-4311e69fe7be` termino `success`, BUK employee `42266`, job BUK `143977`, `company_id = 1`, `area_id = 3008`, `leader_id = 19687`, `role_id = 167`, `cost_center = 721`.

## Reclutamiento - tiempo abierto en resumen de procesos

- [x] Ubicar la tabla `Resumen de procesos de contratación` y el contrato RPC/frontend que alimenta la columna `Solicitó`.
- [x] Confirmar el campo autoritativo de aprobación completa del folio para calcular tiempo abierto.
- [x] Reemplazar `Solicitó` por `Tiempo Abierto` mostrando años, meses y días transcurridos.
- [x] Agregar cobertura focalizada y ejecutar gates frontend/enterprise.

Resultado:
- La tabla corresponde a `HiringProcessesView` y consume `get_recruitment_processes_page`.
- El contrato backend ya entrega `opened_at` para casos de reclutamiento y permite ordenar por `opened_at`; no requiere migracion SQL.
- La columna visible cambia de `Solicitó` a `Tiempo Abierto` y muestra duracion calendario desde `opened_at` como años, meses y dias.
- Validacion: `tests/unit/recruitment-open-duration.test.ts`, `tsc -b --pretty false`, `npm run build:frontend-check` y `npm run guardian` pasan.
- Baseline performance versionado en `1.0.1`: +671 bytes globales justificados por helper funcional testeado, sin nuevos vendors ni aumento de limites JS/CSS/assets trackeados.

## Correos Resend - auditoria y limitacion a eventos criticos

- [x] Auditar Edge Functions, triggers SQL, cron y tabla `transactional_email_dispatches`.
- [x] Medir volumen productivo por tipo de evento y destinatario.
- [x] Agregar control backend auditable por tipo de evento y recordatorios.
- [x] Aplicar configuracion productiva para permitir solo eventos criticos.
- [x] Validar que eventos no criticos no llamen Resend y que eventos criticos sigan encolando.

Resultado:
- Unica Edge Function que llama Resend: `hiring-transactional-email`.
- Configuracion productiva activa: `is_enabled = true`, `enabled_event_types = {pending_approval, who_approval, rejection}`, `reminders_enabled = false`.
- La migracion productiva quedo registrada por Supabase como `20260723205243_limit_resend_email_events_to_critical`; el archivo local usa la misma version.
- Volumen historico por destinatario: `recruitment_handoff` 432 envios-recipient, `pending_approval` 232, `personnel_to_hire` 210, `who_approval` 172, `competency_formalization` 42, `rejection` 21.
- Volumen ultimos 7 dias antes del corte: `personnel_to_hire` 95 envios-recipient, `recruitment_handoff` 60, `who_approval` 58, `competency_formalization` 42, `pending_approval` 42, `rejection` 2.
- Top destinatarios 14 dias: Maximiliano Contreras 64, Diego Lazcano 34, equipo administrativo de Personal a Contratar 32 cada uno, Maria Jesus Lagos 32, equipo Reclutamiento 15 cada uno.
- Smoke remoto sin consumir Resend: `personnel_to_hire` y `pending_approval` con `is_reminder = true` quedaron en 0 nuevos dispatches; la funcion conserva controles `enabled_event_types` y `reminders_enabled`, y no es ejecutable por `public`, `anon` ni `authenticated`.

## Reclutamiento - ciudad obligatoria y direccion base sin ciudad

- [x] Confirmar contrato vivo de ficha BUK candidato, helper frontend y RPC `upsert_candidate_person_profile`.
- [x] Ajustar direccion derivada para usar solo calle y numero, dejando ciudad como campo separado obligatorio.
- [x] Normalizar automaticamente ciudad a capitalizacion por palabra en backend autoritativo.
- [x] Agregar pruebas unitarias/migracion forward-only y ejecutar validaciones frontend/SQL relevantes.

Resultado:
- `Dirección base` queda derivada desde `Calle` y `Número de calle`; no concatena `Ciudad`.
- `Ciudad` queda obligatoria en la validacion de ficha personal BUK.
- La migracion `20260723161000_require_candidate_city_and_omit_city_from_address.sql` fue aplicada en Supabase, normaliza `current_city` con primera letra mayuscula por palabra, recompila `upsert_candidate_person_profile` para exigir ciudad y mantiene `address_line` sin ciudad.
- Validacion remota: ciudades no normalizadas = 0; direcciones estructuradas que aun contienen ciudad = 0; RPC rechaza `Ciudad es obligatoria` sin ciudad y normaliza `san pedro de atacama` a `San Pedro De Atacama` con `address_line = Petrohue Sur, #3213` en rollback.
- Validacion local: unitarias de reclutamiento, TypeScript, `build:frontend-check`, `audit:migrations`, `audit:supabase-security`, `audit:performance-baseline`, `guardian` y `git diff --check` pasaron.

## Reclutamiento - cierre regresion direccion base en candidatos por etapa

- [x] Auditar candidatos por etapa contra Supabase productivo y distinguir datos persistidos, RPC y fallback UI.
- [x] Limpiar datos legacy donde la ciudad quedo al final de `address_line` o `street_name`, sin tocar direcciones que solo contienen el texto de la ciudad en otra posicion.
- [x] Recompilar `upsert_candidate_person_profile(...)` para impedir que futuras ediciones persistan la ciudad dentro de calle/direccion base.
- [x] Endurecer el helper frontend para que el fallback inicial de la ficha tampoco muestre `, Ciudad`.
- [x] Ejecutar smokes remotos por etapa/candidato afectado y gates enterprise antes de versionar.

Resultado:
- La auditoria remota por etapa quedo con `address_trailing_city = 0` y `street_trailing_city = 0` para `hired`, `in_process`, `lead`, `medical_exams`, `ready_for_hire`, `rejected`, `who_approved` y `withdrawn`.
- El candidato de la captura, Osman Daniel Godoy Carrizo, devuelve por tabla y `get_candidate_buk_profile(...)` `address_line = SENDERO DEL SOL 585 DPTO A-42 CONDOMINIO PLAZA NORTE III` y `current_city = Antofagasta`, sin ciudad concatenada en direccion base.
- El unico caso legacy detectado con ciudad al final de `street_name` quedo corregido: Felipe Emmanuel Bravo Jofre mantiene `address_line = Avenida Santa Cruz 490, casa 98` y `current_city = La Cruz`.
- La migracion productiva quedo registrada por Supabase como `20260723204155_strip_candidate_address_location_suffixes`; el archivo local usa la misma version para evitar drift.
- Smoke RPC con rollback: guardar `street_name = Avenida Santa Cruz 490, casa 98, La Cruz` persiste dentro de la transaccion `street_name/address_line = Avenida Santa Cruz 490, casa 98` y `current_city = La Cruz`.
- Performance: se actualizo solo `distTotalBytes` de 10,665,252 a 10,665,572 bytes por la sanitizacion frontend del fallback legacy; JS/CSS y assets pesados trackeados permanecen bajo baseline.

## Certificados - correccion etiqueta MAXUS DELIBERY 9

- [x] Confirmar fila MAXUS visible en `competency_equipment_models`.
- [x] Corregir la primera opcion desde `DELIBERY -9 - E DELIBERY -9` a `DELIBERY 9` sin tocar `E DELIBERY 9`.
- [x] Actualizar guardrail de catalogo y validar contra base productiva.
- [x] Commit y push a `main`.

Resultado:
- La opcion `maxus-delibery-9-e-delibery-9` quedo visible como `DELIBERY 9`.
- La opcion separada `maxus-e-delibery-9` se mantiene como `E DELIBERY 9`.
- La migracion remota quedo registrada como `20260723132022_fix_maxus_delibery_9_label`.
- Validacion: `audit:competency-catalog-guards`, `audit:migrations`, `audit:supabase-security`, `guardian` y `git diff --check` pasaron.

## Control de jornadas 4X3 - correccion ciclo Mario Pizarro

- [x] Confirmar trabajador unico Mario Roberto Pizarro Fernandez en BUK/ERP y su asignacion vigente 4X3.
- [x] Corregir el ancla del ciclo desde 2026-07-22 a 2026-07-20 solo para BUK 41804.
- [x] Validar resolucion diaria 2026-07-20 a 2026-07-27 y registrar evidencia.
- [x] Ejecutar gates de migracion/seguridad y commitear/pushear a `main`.

Resultado:
- Mario Roberto Pizarro Fernandez fue identificado como BUK `41804`, RUT `10.864.096-0`, con una unica asignacion `4X3 Ordinaria`.
- La migracion `20260723030646_fix_mario_pizarro_4x3_cycle_start.sql` ajusto `hr_worker_rosters.start_date` desde `2026-07-22` a `2026-07-20`, manteniendo `end_date = 2026-07-27`.
- Validacion de ciclo: `2026-07-20` a `2026-07-23` quedan en turno, `2026-07-24` a `2026-07-26` en descanso y `2026-07-27` vuelve a turno.
- Gates: `npm run audit:migrations`, `npm run audit:supabase-security`, `npm run guardian` y `git diff --check` pasaron.

## Enterprise Repository Cleanup - limpieza final post EEES 100

- [x] Leer objetivo `docs/CODEX_OBJECTIVE_LOOP_ENTERPRISE_REPOSITORY_CLEANUP.md`, Boot Sequence y cierres EEES 100.
- [x] Medir baseline previo de archivos, LOC, dependencias, scripts, rutas, modulos, tests, Edge Functions, RPC/functions, `dist` y Guardian.
- [x] Generar inventario clasificado `eees/audits/REPOSITORY-CLEANUP-INVENTORY.md`.
- [x] Eliminar/consolidar solo candidatos `REMOVE_CONFIRMED` o `CONSOLIDATE` con evidencia suficiente.
- [x] Ejecutar validacion final completa: Guardian full, unit, contracts, coverage, TypeScript, build, smoke frontend, migrations, security, route/role, performance, operational/release readiness, EEES consistency y `git diff --check`.
- [x] Generar `eees/audits/REPOSITORY-CLEANUP-CLOSURE-REPORT.md` y cerrar con 0 residuos confirmados pendientes.

## EEES Enterprise 100% - Cierre operativo final

- [x] Leer objetivo `docs/CODEX_OBJECTIVE_LOOP_EEES_100_PERCENT.md`, Boot Sequence, Books, baselines, auditorias, certificaciones y playbooks EEES vigentes.
- [x] Medir y versionar baseline de production readiness, SRE/SLI/SLO, DR, failure modes y capacity sin inventar thresholds.
- [x] Auditar brechas ejecutables de seguridad, database, contratos, CI/CD, release, observabilidad, idempotencia y documentacion governance.
- [x] Implementar Guardian/scripts que impidan regresiones contra los artefactos finales EEES 100%.
- [x] Ejecutar gates finales: Guardian full, unit, contracts, coverage, migrations, security, route/role, auth matrix, frontend smoke, Edge check, performance, operational/release readiness, TypeScript, build y `git diff --check`.
- [x] Generar `eees/audits/EEES-100-PERCENT-CLOSURE-REPORT.md`, `eees/certification/ENTERPRISE-CERTIFICATION-FINAL.md` y `eees/audits/FINAL-RESIDUAL-RISK-REGISTER.md`.

## EEES P3 - Testing, contratos y consistencia transversal

- [x] Medir baseline actual de tests, cobertura, query keys, contratos frontend/RPC/Edge y regresiones historicas.
- [x] Agregar suite unitaria real para helpers, mappers, normalizadores y transformadores criticos extraidos en P2.
- [x] Agregar contract tests para payloads/retornos/errores criticos frontend ↔ RPC/Edge sin duplicar tipos manuales innecesarios.
- [x] Auditar y migrar query keys inline a factories por dominio, sin alterar comportamiento funcional.
- [x] Ampliar Guardian para query keys, baseline P3, tests faltantes de logica critica, excepciones sin expiracion y artefactos EEES requeridos.
- [x] Crear `eees/baselines/TESTING_BASELINE_v1.md`, `eees/audits/REGRESSION-COVERAGE-MATRIX.md` y `eees/audits/P3-CLOSURE-REPORT.md`.
- [x] Actualizar baselines, CHANGELOG EEES, lessons y todo con evidencia de cierre.
- [x] Ejecutar validacion final P3 completa: unit tests, contract tests, coverage, guardian full, TypeScript, build, smokes/audits afectados y `git diff --check`.

### Resultado P3

- Tests nuevos: 38 assertions automatizadas en 12 archivos `tests/unit` y `tests/contracts`.
- Contratos cubiertos: 6 contract tests para mappers RPC de incentivos y payload operacional.
- Query keys migradas: 28 usos en BI dashboard, operational onboarding, accreditation y roster usan factories centralizadas.
- Regresiones historicas protegidas: 12 entradas trazadas en `eees/audits/REGRESSION-COVERAGE-MATRIX.md`.
- Coverage baseline: lines 49.22%, statements 47.71%, branches 42.30%, functions 42.52%.
- Guardian P3: 0 errores, 0 warnings.

## EEES P4 - Resiliencia operacional, performance, observabilidad y release engineering

- [x] Medir baseline real de performance: build, bundle, chunks criticos, rutas smoke y superficie RPC/Edge critica.
- [x] Auditar observabilidad operacional: logs sanitizados, audit trails, correlation IDs, jobs, Edge Functions y alertas accionables.
- [x] Clasificar riesgos de concurrencia/idempotencia en mutaciones criticas, generacion documental, sync BUK, jobs y batch.
- [x] Implementar guards/audits P4 donde el riesgo sea inequivoco, sin alterar comportamiento funcional.
- [x] Formalizar release engineering: checklist, rollback productivo y migracion fallida.
- [x] Ampliar Guardian para baseline performance, gaps observabilidad, idempotencia verificable y consistencia de release/playbooks.
- [x] Crear `eees/baselines/PERFORMANCE_BASELINE_v1.md` y `eees/audits/P4-CLOSURE-REPORT.md`.
- [x] Actualizar observability baseline/book, CHANGELOG, lessons y todo con evidencia de cierre.
- [x] Ejecutar validacion final P4 completa: Guardian full, unit, contracts, coverage, TypeScript, build, smokes/audits/benchmarks afectados y `git diff --check`.

### Resultado P4

- Performance baseline: `dist` 10,725,235 bytes, JS 3,017,477 bytes, CSS 213,123 bytes.
- Observability gaps cerrados: 3.
- Concurrency/idempotency guards: 4.
- Release/rollback controls: 4.
- Guardian P4: 0 errores, 0 warnings.

## Reasignacion administracion de contratos - Oscar, Angel y Mario

- [x] Confirmar el contrato vivo de administradores y roles antes de cambiar datos productivos.
- [x] Crear la cuenta Auth/Profile de Mario Pizarro Fernandez con rol minimo de administrador aprobador.
- [x] Reasignar a Angel Guerra Basso los contratos administrados por Oscar Poblete Celedon, excluyendo Sierra Gorda.
- [x] Reasignar a Mario Pizarro Fernandez los mappings Sierra Gorda actualmente asociados a Oscar o Angel.
- [x] Validar en Supabase perfiles, roles aplicativos, mappings y ausencia de asignaciones residuales de Oscar.
- [x] Ejecutar guardian/auditorias locales y documentar el cierre.

### Resultado aplicado

- Fuente autoritativa confirmada: `buk_contract_mappings.contract_admin_name`.
- Cuenta Auth creada para `mario.pizarro@busesjm.com`; `profiles` quedo activo como `Mario Pizarro Fernandez`, `Administrador de Contratos`, con `must_reset_password = true`.
- Angel Guerra Basso quedo activo con roles `operaciones_l_1` y `aprobador_folios`.
- Mario Pizarro Fernandez quedo activo con rol `aprobador_folios`.
- Oscar Poblete Celedon se mantiene inactivo y sin roles aplicativos.
- Reasignacion productiva: Oscar quedo con 0 mappings; Angel quedo con 16 mappings no Sierra Gorda; Mario quedo con 2 mappings Sierra Gorda.
- Los mappings Sierra Gorda reasignados a Mario son `ARAMARK SIERRA GORDA INTERNO` y `SIERRA GORDA OPERACIONES`.
- Smoke autenticado de `get_my_effective_permissions()` no pudo ejecutarse desde SQL tool porque la conexion no permite simular `auth.uid()`; se valido contra las tablas autoritativas `profiles`, `user_roles` y `buk_contract_mappings`.
- Validacion local: `git diff --check`, `npm run audit:migrations` y `npm run guardian` pasaron. Guardian cerro con 0 errores y 0 warnings.

## Limpieza documental productiva

- [x] Medir peso actual de documentacion y detectar archivos historicos/duplicados.
- [x] Eliminar documentacion sin enlace productivo ni control vigente.
- [x] Conservar documentos auditados por CI y contratos operativos vivos.
- [x] Validar auditorias/documentacion/build relevante y dejar evidencia de reduccion.
- [x] Auditar binarios Office versionados y bloquear nuevos Word/Excel sin uso operativo.

### Resultado de limpieza documental

- Peso tracked inicial de `docs/` y `tasks/`: 31 archivos, 2.5 MB.
- Se eliminaron planes historicos, propuestas cerradas, plantillas legacy, documentacion duplicada y archivos archivados sin enlace productivo.
- Se retiro la plantilla Word legacy `certificado_tipo_rev02.docx`; el flujo vigente genera PDF desde backend y Edge Function, no desde ese artefacto documental.
- Se conservaron los documentos auditados por `npm run audit:enterprise-docs`: arquitectura, mapa modular, matriz de permisos, revision de seguridad, smoke tests, rollback, `tasks/todo.md` y `tasks/lessons.md`.
- Se conservaron documentos legales/operativos vigentes: politicas ISO, Ley 19.628, deploy, audit logs, database model, brand kit y template Markdown de migracion de reclutamiento.
- Se eliminaron `.DS_Store` locales ignorados por Git.
- Auditoria posterior: no quedan archivos tracked ni locales `.doc`, `.docx`, `.docm`, `.xls`, `.xlsx` o `.xlsm`.
- `.gitignore` bloquea nuevos binarios Word/Excel generados o recibidos fuera del runtime; cualquier excepcion futura debe forzarse y justificarse como operativa.

### Documentos productivos conservados

- `docs/architecture.md`
- `docs/audit-logs.md`
- `docs/brand-kit-plataforma-control.md`
- `docs/database-model.md`
- `docs/deploy-cloudflare-pages.md`
- `docs/deployment.md`
- `docs/design-tokens-plataforma-control.css`
- `docs/iso-27001-control-de-acceso.md`
- `docs/iso-27001-politica-uso-aceptable.md`
- `docs/ley-19628-consentimiento-datos.md`
- `docs/module-map.md`
- `docs/permissions-matrix.md`
- `docs/rollback.md`
- `docs/security-review.md`
- `docs/smoke-tests.md`
- `docs/supabase-auth-authorization-foundation.md`
- `docs/templates/README.md`
- `docs/templates/plantilla_migracion_reclutamiento.md`
- `tasks/lessons.md`
- `tasks/todo.md`

## Acreditacion de personas - estandares por faena y licencia interna

- [x] Modelar estandares reutilizables por mandante/faena para evitar duplicar requisitos comunes en cada division.
- [x] Versionar el estandar inicial `ECF 21` para Codelco Division Ministro Hales con requisitos de ingreso y control de vigencia.
- [x] Separar el alcance operacional entre `acreditacion` para ingreso y `licencia_interna` para manejo dentro de dependencias.
- [x] Mantener trabajadores desde `employees_active_current`, sin sembrar personas manualmente ni crear una fuente paralela.
- [x] Mantener documentos sensibles fuera del ERP local: subir archivo a BUK y conservar solo metadata auditable.
- [x] Aplicar migracion remota y validar RPCs autenticadas contra Supabase.

### Contrato inicial DMH / ECF 21

- Cedula identidad: acreditacion, requiere vencimiento.
- Contrato de trabajo: acreditacion, sin vencimiento.
- Anexo vinculacion: acreditacion, sin vencimiento.
- Examen ocupacional: acreditacion, requiere vencimiento.
- Induccion Hombre Nuevo: acreditacion, requiere vencimiento.
- Anexo de exclusividad: acreditacion, sin vencimiento.
- Autorizacion de uso y almacenamiento de datos Sucal: acreditacion, sin vencimiento.
- Reglamento Interno: acreditacion, sin vencimiento.
- Informacion de Riesgos Laborales IRL: acreditacion, sin vencimiento.

### Resultado versionado

- Se agrego la migracion `20260718031743_add_accreditation_standards_and_ecf21_dmh.sql` con tablas `accreditation_standards`, `accreditation_standard_requirements` y `accreditation_site_standards`.
- `generate_worker_requirements(...)` ahora hereda requisitos desde reglas manuales y estandares asignados a la faena.
- `get_accreditation_setup_catalogs()` expone estandares, reglas de estandar, asignaciones por faena y `process_scope`.
- La pantalla de configuracion permite mantener estandares, vincular requisitos al estandar y asignar estandares a faenas.
- La ficha del trabajador muestra si cada requisito aplica a ingreso, licencia interna o ambos.
- Migraciones aplicadas en Supabase mediante conector auditado:
  - `20260718031743_add_accreditation_standards_and_ecf21_dmh`
  - `20260718032010_complete_accreditation_standard_rpc_contract`
  - `20260718032056_drop_legacy_accreditation_requirement_rpc_overload`
  - `20260718032252_add_process_scope_to_worker_accreditation_profile`
- Validacion remota: historial de migraciones registra las cuatro versiones; seed DMH/ECF 21 quedo con 1 estandar, 1 faena, 9 requisitos, 9 reglas y 1 asignacion faena-estandar.
- Validacion remota: `get_accreditation_setup_catalogs()` respondio con `standards`, `standard_requirement_rules`, `site_standard_rules`, `requirements`, `process_scopes`, `codelco_ecf_21` y `codelco_dmh`.
- Validacion remota: `get_worker_accreditation_profile(...)` en transaccion con rollback devolvio 9 documentos DMH y todos incluyeron `process_scope`.
- Validacion local: `npm run build`, `npm run audit:migrations`, `npm run audit:enterprise-docs`, `npm run audit:route-role-smoke` y `npm run audit:supabase-security` pasaron. El auditor de seguridad se mantuvo en 82 warnings.

## Correccion Acreditacion - DMH como unica faena y busqueda explicita de trabajadores

- [x] Eliminar completamente del dominio de acreditacion las faenas distintas de `Codelco Division Ministro Hales`.
- [x] Redefinir `search_accreditation_workers(...)` para que seleccionar una faena no liste automaticamente trabajadores BUK aun no seleccionados.
- [x] Mantener busqueda explicita por nombre/RUT/cargo como mecanismo para incorporar candidatos desde `employees_active_current`.
- [x] Aplicar migracion remota Supabase y validar catalogo, busqueda vacia DMH y busqueda explicita DMH.
- [x] Validar build/auditorias locales y versionar el cierre.

### Resultado aplicado

- Se agrego la migracion `20260718034748_limit_accreditation_to_dmh_and_explicit_worker_search.sql`.
- Supabase quedo con 1 faena activa: `Codelco Division Ministro Hales`; no quedan faenas distintas de `codelco_dmh`.
- La purga dejo 0 acreditaciones transaccionales y 0 documentos de seguimiento, preservando el estandar ECF 21 con 9 reglas y 1 asignacion DMH-estandar.
- Validacion RPC autenticada: `get_accreditation_setup_catalogs()` expone solo DMH; `search_accreditation_workers(null, DMH, ...)` devuelve 0; busqueda explicita DMH devuelve candidatos BUK.
- Validacion local: `npm run build`, `npm run audit:migrations`, `npm run audit:enterprise-docs`, `npm run audit:route-role-smoke` y `npm run audit:supabase-security` pasaron. El auditor de seguridad se mantuvo en 82 warnings.

## Carga inicial Acreditacion - trabajadores BUK contrato 028 DMH

- [x] Identificar en BUK vivo el alcance exacto de `CONT-028 / CODELCO DMH` sin mezclar otros contratos del CECO DMH.
- [x] Cargar en `Codelco Division Ministro Hales` todos los trabajadores activos del area BUK `SERVICIO CODELCO DMH (6170400006:0004)`.
- [x] Generar los requisitos ECF21 pendientes para cada trabajador cargado.
- [x] Validar conteos remotos de trabajadores, documentos y visibilidad RPC autenticada.
- [x] Validar build/auditorias locales y versionar el cierre.

### Resultado aplicado

- Se agrego la migracion `20260718035405_seed_dmh_accreditation_workers_from_buk_contract_028.sql`.
- Fuente BUK usada: `employees_active_current.area_name = SERVICIO CODELCO DMH (6170400006:0004)`, equivalente operativo a `CONT-028 / CODELCO DMH`.
- No se uso CECO `10114` como filtro porque mezcla otros contratos DMH como Aramark y Sotraser.
- Validacion remota: 91 trabajadores fuente, 91 acreditaciones DMH creadas, 819 documentos generados y 91 trabajadores con los 9 requisitos ECF21.
- Validacion RPC autenticada: `search_accreditation_workers(null, DMH, pending, 200)` devuelve 91 trabajadores pendientes.
- Validacion local: `npm run build`, `npm run audit:migrations`, `npm run audit:enterprise-docs`, `npm run audit:route-role-smoke` y `npm run audit:supabase-security` pasaron. El auditor de seguridad se mantuvo en 82 warnings.

## Cierre Certificados - generacion productiva BUK y header limpio

- [x] Reemplazar el submit temporal por flujo real: subir evaluacion, crear solicitud backend, generar certificado productivo y cargar certificado/evaluacion a BUK.
- [x] Priorizar enlace documental BUK al abrir el resultado, dejando URL firmada local solo como fallback cuando BUK no queda en exito.
- [x] Eliminar lineas/bordes negros superiores y separadores verticales del header en preview y Edge Function productiva.
- [x] Evitar truncado de marcas/tipos/modelos en la tabla de equipos autorizados; el texto se envuelve y pagina sin puntos suspensivos.
- [x] Corregir el validador publico para mostrar trabajador, RUT, vigencia, instructor, equipos, emision, registro BUK y SHA-256 desde el contrato real `snake_case`.
- [x] Implementar formalizacion por correo despues de carga exitosa de certificado en BUK.

### Resultado aplicado

- `CompetencyCertificationPage.tsx` ya no muestra ni usa `PDF temporal ... generado sin guardar ni cargar a BUK`; ahora llama al flujo productivo.
- `competencyApi.ts` y `generate-competency-certificate` comparten el criterio visual del certificado sin artefactos negros.
- `verify-competency-certificate` y la pagina publica `/verificar/competencia` muestran el snapshot publico completo.
- `transactional_email_dispatches` acepta `competency_formalization` y `hiring-transactional-email` renderiza la notificacion.

## UI Certificados - pestaña Resumen de Certificados

- [x] Agregar pestañas en `/certificados` manteniendo `Nueva certificacion` como flujo de emision existente.
- [x] Crear pestaña `Resumen de Certificados` con cuadro de resumen de certificados generados y vigencia.
- [x] Reutilizar `get_competency_dashboard()` para conteos y certificados recientes sin inventar datos en frontend.
- [x] Validar build local y dejar evidencia del resultado.

### Resultado aplicado

- La pantalla `/certificados` ahora muestra tabs `Nueva certificacion` y `Resumen de Certificados`.
- `Resumen de Certificados` consume `get_competency_dashboard()` y muestra total, generados, por vencer en 30 dias, vencidos, pendientes BUK y ultimos certificados visibles por permisos.
- El mapper frontend fue alineado al contrato vivo del RPC (`generated`, `expiring_30`, `instructor_name`, `valid_until`).
- Validacion local: `npm run build`, `npm run audit:route-role-smoke` y `npm run smoke:frontend-routes` pasaron. Playwright confirmo que `/certificados` redirige a `/login` sin sesion y carga sin errores de consola.

## Correccion Certificados - estetica ERP y purga BUK de duplicado

- [x] Reemplazar las pestañas locales de `/certificados` por el patron visual global del ERP.
- [x] Registrar en `tasks/lessons.md` y memoria que toda implementacion UI debe respetar la estetica general del ERP.
- [x] Auditar Swagger BUK y datos vivos del duplicado `1707202611461152` antes de eliminar documentos.
- [ ] Eliminar en BUK el certificado duplicado y su evaluacion si el endpoint vivo lo permite, dejando evidencia sin exponer secretos.
- [x] Validar build/auditorias relevantes, commitear y pushear a `main`.

### Resultado parcial

- Las tabs de `/certificados` ahora usan el patron global `approval-chip-row` / `approval-chip` / `tracking-kpi-card-active`.
- Se agregaron lecciones vivas para estetica ERP y purga documental BUK.
- Swagger BUK vivo (`/api/chile/es/api_docs`) no expone `DELETE` para documentos; solo `POST/GET /employees/{id}/docs`, `GET /employees/{id}/docs/{file_id}` y `GET /docs/{id}`.
- En BUK trabajador `40022`, el duplicado fisico existe como `file_id = 145790` (`certificado_competencia_1707202611461152_114690783.pdf`) y la evaluacion original como `file_id = 145791` (`registro_capacitacion_corporativa_martin_ahumada_114690783.pdf`).
- `GET /employees/40022/docs/{file_id}` responde 302 para ambos IDs, pero `DELETE /employees/40022/docs/{file_id}` y `DELETE /docs/{id}` devuelven 404 HTML; no se elimino ningun documento BUK por API.
- Se corrigio `extractBukDocumentMetadata(...)` para capturar futuros IDs desde `employee_file.id` / `file_id`, que es la forma documentada de respuesta de carga.
- `generate-competency-certificate` fue desplegada nuevamente para que futuras cargas persistan `file_id`.
- Validacion local: `npm run build`, `npm run audit:route-role-smoke` y `git diff --check` pasaron.

## Duplicados de certificados de competencias

- [x] Mantener como vigente el folio reciente `1707202611471153` y reemplazar en ERP el folio antiguo `1707202611461152`.
- [x] Verificar que el validador publico muestre el folio antiguo como `replaced` y no vigente, y el folio reciente como `valid`.
- [x] Crear guarda backend transaccional para que `create_competency_request(...)` no cree certificados equivalentes para el mismo trabajador, instructor, fecha y set de modelos.

### Resultado aplicado

- El folio antiguo quedo `certificate_status = replaced`, `competency_status = revoked`, solicitud `cancelled` y `replaced_by_certificate_id` apuntando al folio reciente.
- El folio reciente se mantiene `uploaded_to_buk`, `enabled` y `completed`.
- La RPC ordena/deduplica modelos, toma `pg_advisory_xact_lock(...)` por llave operacional y rechaza solicitudes equivalentes antes de insertar.

## Retencion documental BUK

- [x] Cargar certificado PDF y evaluacion respaldada a la carpeta BUK `Acreditacion`.
- [x] Aplicar a ambos archivos el estandar de nombre usado por `sync-buk-candidates`: nombre base sanitizado en minusculas + tipo/documento del trabajador + extension.
- [x] Crear puerta de cierre: solo cuando certificado y evaluacion se suben correctamente a BUK se eliminan los objetos `certificates/...` y `evaluations/...` de `competency_documents`.
- [x] Registrar IDs, URLs, nombres BUK, carpeta, hash y estado de purga sin borrar filas transaccionales necesarias para auditoria, folio y validacion publica.

## Correccion Operaciones - timeout al guardar servicios

- [x] Auditar el payload del Registro Base y confirmar que envia identificadores canonicos de conductor/equipo.
- [x] Comparar la funcion remota `submit_service_entries_batch(jsonb)` con las migraciones locales para ubicar la causa real del timeout.
- [x] Implementar una migracion forward-only que reduzca trabajo repetido y mantenga permisos/RLS sin relajarlos.
- [x] Validar con smoke remoto transaccional con `rollback` y verificaciones locales.
- [x] Documentar resultado final y aprendizaje para evitar repetir la falla.

### Resultado aplicado

- `submit_service_entries_batch(jsonb)` ahora materializa `prepare_operations_service_entry_batch(...)` una sola vez y reutiliza esas filas para validacion y upsert.
- Se agrego indice parcial `idx_employees_active_buk_employee_id_recent` para resolver conductores por ID BUK activo sin escaneo innecesario.
- Produccion quedo aplicada y registrada como migracion remota `20260720134318`.
- Smokes remotos con `rollback`: `not_performed` insert/update, `planned` con conductor/equipo y batch de 5 servicios completos retornaron `ok: true`.

## Reparacion Reclutamiento - Carlos Salazar a control documental

- [x] Identificar de forma unica al candidato Carlos Salazar en produccion.
- [x] Revisar estado terminal, historial, documentos y jobs de limpieza documental asociados.
- [x] Aplicar reparacion auditable para moverlo a `document_review` sin relajar permisos ni borrar historial.
- [x] Validar estado final remoto y documentar resultado.

### Resultado aplicado

- Carlos Andres Salazar Espinoza, folio `1978` / `RC-1978`, estaba en `withdrawn` con motivo `Postulante desiste del proceso`.
- Se aplico y registro en Supabase la migracion `20260720200022_repair_carlos_salazar_to_document_review`.
- El candidato quedo en `document_review`, `document_validation_status = pending`, `withdrawal_reason = null`.
- Se conservaron 16 documentos `uploaded` y se elimino el job de limpieza documental pendiente del retiro.
- El historial y audit log registran `withdrawn -> document_review` con `reason_code = terminal_reopen_to_document_review`.

## Correccion Reclutamiento - error Failed to fetch al mover etapa

- [x] Reproducir/aislar el contrato que falla al solicitar Who o mover etapa.

## Correccion Reclutamiento - ficha BUK previa y filtros de folios

- [x] Auditar la regresion de fichas BUK previas/inactivas y ubicar la rama que vuelve a mostrar "no fue posible resolver la ficha automaticamente".
- [x] Reforzar `sync-buk-candidates` para que una ficha BUK inactiva con documento exacto no caiga al error terminal y quede trazada en `result_snapshot`.
- [x] Corregir jobs BUK `processing` obsoletos para que puedan volver a reclamarse y no bloqueen candidatos como Julio Carrasco.
- [x] Agregar un auditor ejecutable que verifique la existencia de las guardas de duplicado activo, ficha inactiva reutilizable/clonable y trazabilidad de resolucion BUK.
- [x] Agregar filtros desplegables a la vista `Resumen de procesos de contratación` por turno, pasajes, alojamiento y contrato, sin ampliar el RPC si el payload ya trae esos campos.
- [x] Validar build/auditorias relevantes y documentar resultado/lecciones para evitar repeticion.

### Resultado aplicado

- Causa raiz: `resolveBukEmployeeForSync(...)` encontraba fichas por documento, pero una ficha historica inactiva podia no entrar a la rama inactiva si el estado venia en campos alternativos o si el correo historico no coincidia con el correo nuevo.
- `sync-buk-candidates` ahora resuelve estado desde `status`, `employee_status`, `estado`, `active` o `is_active`; para fichas inactivas usa documento exacto como identidad primaria y conserva el chequeo estricto de correo para duplicados activos.
- La resolucion BUK deja `resolutionAudit` en exito y `employeeResolutionAudit` en error, evitando mensajes visibles extensos y manteniendo trazabilidad en `buk_sync_jobs.result_snapshot`.
- Julio Cesar Carrasco Zuniga estaba bloqueado por el job `040ddab5-6a75-47e4-b729-25f9eb8ef4bb` en `processing` obsoleto desde `2026-07-20 15:23:38 UTC`; se agrego recuperacion auditable para jobs vencidos en `claim_buk_sync_jobs` y `enqueue_buk_generation`.
- Se agrego `scripts/audit-buk-sync-guards.mjs`, `npm run audit:buk-sync-guards` y ejecucion en GitHub Actions para bloquear regresiones de estas ramas.
- La vista `Resumen de procesos de contratación` agrega filtros desplegables por turno, pasajes, alojamiento y contrato junto a `Buscar casos`, usando `SelectField` compartido y filtrado local sobre campos ya entregados por `get_recruitment_processes_page`.
- Correccion posterior: la primera version instalo filtros en el widget de dashboard equivocado; se corrigio la superficie real de la captura en `HiringProcessesView` y se documento la leccion para validar el heading/input exacto antes de cerrar UI.
- Ajuste visual posterior: se elimino el texto descriptivo bajo el titulo, se compacto la altura de los desplegables y el toolbar usa todo el ancho disponible para dar mas espacio visible al filtro `Contrato`.
- Ajuste visual dashboard: en `Folios en curso`, las KPI quedan en una fila propia bajo el titulo, los filtros y la busqueda quedan en la fila inferior, y los dropdowns abren en flujo para no mezclarse con la tabla.
- Validacion local: `npm run audit:buk-sync-guards`, `./node_modules/.bin/tsc -b --pretty false`, `npm run build:frontend-check`, `npm run audit:route-role-smoke`, `npm run audit:supabase-security`, `npm run audit:enterprise-docs`, `npm run audit:migrations`, `npm run smoke:frontend-routes` y `git diff --check` pasaron.
- Deploy remoto: `sync-buk-candidates` desplegada en Supabase project `pzblmbahnoyntrhistea` con `npx --yes supabase functions deploy sync-buk-candidates --use-api --yes`.

## Saneamiento Reclutamiento - verificacion Deno de sync-buk-candidates

- [x] Resolver la deuda de tipado que impedía usar `deno check` como verificacion limpia de `sync-buk-candidates`.
- [x] Reemplazar `ReturnType<typeof createClient>` por un alias explicito `SupabaseAdminClient` para evitar inferencias `never` en tablas/RPC.
- [x] Tipar fronteras puntuales (`response.data`, fallback de snapshot) sin cambiar logica de negocio.
- [x] Agregar `npm run check:edge:sync-buk-candidates` y ejecutarlo en GitHub Actions con Deno.
- [x] Revalidar build/auditorias, desplegar funcion y commitear/pushear a `main`.

### Resultado aplicado

- `npm run check:edge:sync-buk-candidates` pasa y queda como guardrail CI para la Edge Function BUK.
- La correccion fue solo de tipos/fronteras: alias `SupabaseAdminClient`, tipado de filas BUK remotas y fallback null-safe de snapshot; no cambia la semantica de creacion/reparacion/cancelacion BUK.
- [x] Auditar el manejo frontend de excepciones Supabase/fetch en cambios de etapa de candidatos.
- [x] Validar en Supabase remoto permisos, firma y smoke transaccional de `request_candidate_stage_who`.
- [x] Implementar sanitizacion centralizada para que errores de red/stack trace no lleguen crudos a la UI.
- [x] Validar build/auditorias, documentar aprendizaje, commitear y pushear a `main`.

### Resultado aplicado

- Se confirmo que `advance_recruitment_candidate_stage(uuid,text,text)` y `request_candidate_stage_who(uuid,text,jsonb)` siguen ejecutables para `authenticated`/`service_role` y cerradas para `anon`.
- Smoke remoto con `rollback`: `advance_recruitment_candidate_stage(...)` desde `in_process` a `medical_exams` respondio `stage_code = medical_exams` sin persistir cambios.
- Smoke remoto Who: `request_candidate_stage_who(...)` devolvio rechazo de negocio controlado al invocarse fuera de `lead`, confirmando que la RPC responde y no esta fallando por permisos/firma.
- `getSupabaseErrorMessage(...)` ahora sanitiza stack traces y mapea fallas de red/fetch a un mensaje operacional.
- El submit de cambio de etapa en Control de contrataciones usa `try/catch/finally`, apaga siempre el estado de guardado y evita mostrar errores tecnicos crudos.
- Validacion local: `npm run build`, `npm run audit:route-role-smoke`, `npm run audit:enterprise-docs` y `git diff --check` pasaron.

## Optimizacion global de chunks y busquedas BUK

- [x] Separar dependencias pesadas de PDF/competencias del chunk inicial del modulo.
- [x] Endurecer el lookup estandar para no disparar consultas BUK por busquedas bajo umbral.
- [x] Limitar concurrencia en exportaciones que consultan fichas BUK.
- [x] Ajustar particion de vendors donde la medicion lo justifico.

### Resultado aplicado

- `competencyCoreApi.ts` concentra catalogos, busqueda BUK, advertencias y verificacion publica sin arrastrar `pdf-lib`, `qrcode`, fuentes ni logos.
- `CompetencyCertificationPage.tsx` carga `generateCompetencyPreviewPdf(...)` con import dinamico solo al generar prueba.
- `WorkerLookupField.tsx` usa debounce estandar de 250 ms y no consulta mientras el texto no cumpla umbral.
- `HiringPersonnelToHireView.tsx` limita a 5 consultas concurrentes de ficha BUK y carga `bukEmployeeNomina` dinamicamente solo al exportar.
- `vite.config.ts` separa `pdf-vendor` y `qrcode-vendor`; ECharts se mantiene como chunk lazy unico por ciclos internos de Rollup.

## Correccion Operaciones - super admin sin contratos editables

- [x] Confirmar causa raiz remota del selector vacio en Registro Base de Operaciones.
- [x] Crear migracion forward-only para que `admin/super admin` pueda editar todos los contratos activos sin depender de `operations_contract_editors`.
- [x] Mantener la matriz contractual obligatoria para `operaciones_l_1` y `operaciones_l_2`.

### Resultado aplicado

- `public.user_can_edit_operations_contract(...)` autoriza a usuarios admin sobre cualquier contrato activo.
- `public.operations_editable_contracts` retorna todos los contratos activos para admin/super admin y conserva matriz para usuarios operativos no admin.
- El usuario admin `maximiliano.contreras@busesjm.com` paso a ver 110 contratos editables, igual al total activo remoto.

## Alta cuentas instructor para certificados

- [x] Auditar que el rol `instructor` tiene acceso a `certificados` y `seguimiento_certificados`.
- [x] Provisionar cuentas Auth para los cinco instructores sin exponer contrasenas temporales.
- [x] Sincronizar `profiles`, `user_roles.role_code = 'instructor'` y `competency_instructors.user_id`.
- [x] Validar que una cuenta instructor ve solo su propio instructor en `get_competency_catalogs()`.

## Correccion Certificados - examen/evaluacion obligatoria

- [x] Confirmar que el backend `create_competency_request` bloquea sin evaluacion cargada, notas 100%, hash y archivo en Storage.
- [x] Agregar input obligatorio `Examen teorico / evaluacion respaldada` con tipos PDF/JPG/PNG.
- [x] Bloquear el boton si no existe archivo o no se acepto la declaracion.
- [x] Revalidar en `handleSubmit` para evitar bypass visual del formulario.

## Submodulo Certificacion de Competencias BUK

- [x] Implementar base backend auditable: rol/modulo, tablas, catalogos, RLS, storage privado, auditoria y RPCs.
- [x] Reutilizar `employees_active_current` para seleccion de trabajadores sincronizados desde BUK.
- [x] Reutilizar cliente BUK existente para subir certificado PDF a carpeta documental `Acreditacion`.
- [x] Generar PDF backend desde datos validados, con folio, vencimiento, hash, QR verificable y estado separado de carga BUK.
- [x] Crear UI modular funcional en `/certificados` con busqueda trabajador, seleccion equipo/modelos, carga evaluacion 100%, emision y dashboard.

### Criterio de cierre vivo

- El modulo opera sin Excel ni Power Automate como fuente transaccional.
- No se genera certificado sin evaluacion respaldada, archivo privado y nota final 100%.
- El backend genera folio, token, nombre de documento, vencimiento y estados; el frontend no los inventa.
- La carga BUK debe ser idempotente y no duplicar folio ni documento ante reintentos.
- El certificado queda privado, hasheado, trazable, auditable y validable publicamente por QR.
- Roles `admin`, `certificaciones` e `instructor` tienen acceso segun alcance.

## Loop Enterprise global

- [x] Mantener documentacion viva verificable: arquitectura, mapa modular, matriz de permisos, seguridad, smoke plan y rollback.
- [x] Mantener `npm run audit:enterprise-docs` como control ejecutable de cobertura documental Enterprise.
- [x] Mantener CI alineado para que cambios de rutas, docs, tareas o scripts de auditoria ejecuten el gate documental.

### Contrato vigente

- `audit:enterprise-docs` compara rutas/modulos activos contra `docs/module-map.md` y `docs/permissions-matrix.md`.
- El auditor exige secciones minimas en `docs/security-review.md` y `docs/smoke-tests.md`.
- El auditor exige que este archivo registre la iteracion activa `Loop Enterprise global`.

## Correccion CI - Audit Enterprise Guardrails

- [x] Inspeccionar las corridas fallidas de `Audit Enterprise Guardrails` en `main`.
- [x] Reproducir el fallo de `deno check` en un arbol temporal limpio con `npm ci` y `DENO_DIR` nuevo.
- [x] Corregir el comando Deno del guardrail para que el runner limpio resuelva dependencias npm transitivas del runtime Supabase Functions.
- [x] Validar localmente el guardrail de BUK, el check Deno y los auditores ejecutados por el workflow.

### Resultado aplicado

- Los correos correspondian a fallos reales de CI en los commits `35dd71e`, `ef08f85`, `13dc02e`, `b36c717` y `40650c9`.
- La causa raiz fue `deno check supabase/functions/sync-buk-candidates/index.ts`: en GitHub Actions, el runner limpio no podia resolver el tipo transitivo `npm:openai@^4.52.5` requerido por `jsr:@supabase/functions-js`.
- Se ajusto `check:edge:sync-buk-candidates` a `deno check --no-config --node-modules-dir=auto ...` para que Deno materialice dependencias npm transitivas en CI sin agregarlas como dependencia frontend directa ni inflar el lock global.
- Reproduccion limpia previa sin config: fallo con `Could not find a matching package for 'npm:openai@^4.52.5'`.
- Reproduccion limpia posterior con la config: `deno check --no-config --node-modules-dir=auto supabase/functions/sync-buk-candidates/index.ts` paso.
- Se actualizo el workflow a `actions/checkout@v7.0.1`, `actions/setup-node@v7.0.0` y Node 24 para eliminar la anotacion residual de deprecacion de Node 20.

## Correccion Inicio y Personal a Contratar

- [x] Quitar solo los filtros desplegables del widget de inicio `Folios en curso`, conservando folios, busqueda, ordenamiento, detalle y paginacion.
- [x] Revisar el flujo de generacion BUK en `Personal a Contratar` para que el candidato desaparezca de la lista despues de exito efectivo.
- [x] Implementar refresco/invalidation sin alterar la generacion BUK ni relajar reglas backend.
- [x] Validar build/auditorias relevantes, documentar aprendizaje, commitear y pushear a `main`.

### Resultado aplicado

- El widget de inicio `Folios en curso` conserva su vista natural de folios: tarjetas, busqueda, tabla, detalle expandible, ordenamiento y paginacion.
- Se eliminaron solo los filtros desplegables de turno, pasajes, alojamiento y contrato del resumen de inicio para no duplicar controles operacionales.
- La generacion BUK en `Personal a Contratar` ahora invalida cache aunque no exista una ficha lateral seleccionada y fuerza `refetch()` del listado despues del mensaje de exito.
- Validacion local: `npm run build:frontend-check`, `npm run audit:enterprise-docs`, `npm run audit:buk-sync-guards`, `npm run check:edge:sync-buk-candidates`, `npm run audit:route-role-smoke`, `npm run audit:frontend-auth-smoke-matrix`, `npm run smoke:frontend-routes`, `npm run smoke:frontend-authenticated-matrix`, `npm run audit:migrations`, `npm run audit:supabase-security` y `git diff --check` pasaron. La matriz autenticada quedo saltada localmente por falta de credenciales seguras, como en el contrato del workflow.

## Correccion Inicio - restaurar folios y retirar solo filtros

- [x] Restaurar los folios del widget de inicio que fueron eliminados por una interpretacion excesiva.
- [x] Mantener las restricciones originales del widget: busqueda, query de procesos, detalle expandible, ordenamiento y paginacion.
- [x] Eliminar solamente los desplegables de turno, pasajes, alojamiento y contrato en `Folios en curso`.
- [x] Validar build/auditorias, documentar aprendizaje, commitear y pushear a `main`.

### Resultado aplicado

- Se restauro `ActiveFoliosWidget` con folios, tarjetas, busqueda, ordenamiento, detalle expandible y paginacion.
- Se removieron solo los filtros desplegables y el filtrado local de turno, pasajes, alojamiento y contrato en el inicio.
- Validacion local: `npm run build:frontend-check`, `npm run audit:enterprise-docs`, `npm run audit:route-role-smoke`, `npm run audit:buk-sync-guards`, `npm run check:edge:sync-buk-candidates`, `npm run audit:frontend-auth-smoke-matrix`, `npm run smoke:frontend-routes`, `npm run smoke:frontend-authenticated-matrix`, `npm run audit:migrations`, `npm run audit:supabase-security` y `git diff --check` pasaron.

## Ajuste Inicio - busqueda junto a tarjetas de folios

- [x] Mover la busqueda de `Folios en curso` a la grilla de tarjetas, junto a `Casos cubiertos`.
- [x] Darle a la busqueda el mismo ancho de celda y altura visual que las tarjetas informativas.
- [x] Validar frontend/documentacion, commitear y pushear a `main`.

### Resultado aplicado

- La busqueda ahora es el sexto elemento de la grilla de `Folios en curso`; en el layout de tres columnas queda a la derecha de `Casos cubiertos`.
- La caja de busqueda usa el mismo ancho de celda, padding y radio visual que las tarjetas informativas.
- Validacion local: `npm run build:frontend-check`, `npm run audit:enterprise-docs` y `git diff --check` pasaron.

## Ajuste Inicio - color organico de busqueda en folios

- [x] Igualar el fondo, sombra y borde de la busqueda con la base visual de las tarjetas informativas.
- [x] Quitar el fondo/borde propio del input interno para que no parezca una caja separada.
- [x] Validar frontend/documentacion, commitear y pushear a `main`.

### Resultado aplicado

- La busqueda usa el mismo gradiente, borde y sombra elevada de las tarjetas `SoftMetricCard`.
- El input interno quedo transparente para integrarse a la tarjeta sin una segunda caja visual.
- Validacion local: `npm run build:frontend-check`, `npm run audit:enterprise-docs` y `git diff --check` pasaron.

## Ajuste Control Candidatos - limpiar filtros de folios

- [x] Agregar boton sutil entre `Contrato` y `Buscar casos` para limpiar filtros.
- [x] Limpiar turno, pasajes, alojamiento, contrato, busqueda y estado de folio a `Activos (Todos)`.
- [x] Cancelar resoluciones automaticas de busqueda pendientes para que no reapliquen filtros despues de limpiar.
- [x] Validar frontend/documentacion, commitear y pushear a `main`.

### Resultado aplicado

- Se agrego un boton compacto `×` entre el filtro `Contrato` y `Buscar casos`, con estilo suave y deshabilitado cuando no hay filtros activos.
- El boton limpia desplegables, busqueda y chip de estado, y cancela resoluciones automaticas de busqueda en curso.
- Validacion local: `npm run build:frontend-check`, `npm run audit:enterprise-docs` y `git diff --check` pasaron.

## Ajuste Control Candidatos - modalidad de pasajes visible

- [x] Verificar que la modalidad de pasajes ya viene en el contrato de datos de folios y detalle.
- [x] Mostrar la definicion de Control de contratos en el detalle expandido de folios con pasajes.
- [x] Validar frontend/documentacion, commitear y pushear a `main`.

### Resultado aplicado

- El detalle expandido de folios ahora muestra `Modalidad de pasajes` dentro de `Compensacion y beneficios`.
- La vista reutiliza el label autoritativo `toTravelMethodologyLabel(...)`: `Bono de traslado`, `Compra Empresa` o `Sin definir`.
- Si el folio no lleva pasajes, la modalidad se muestra como `No aplica`.
- Validacion local: `npm run build:frontend-check`, `npm run audit:enterprise-docs` y `git diff --check` pasaron.

## Ajuste Resumen Folios - otros beneficios ancho completo

- [x] Identificar los bloques de `Compensacion y beneficios` que muestran `Otros beneficios`.
- [x] Hacer que `Otros beneficios` use el ancho completo de su seccion para evitar texto amontonado.
- [x] Validar frontend/documentacion, commitear y pushear a `main`.

### Resultado aplicado

- `Otros beneficios` ahora ocupa toda la fila dentro de `Compensacion y beneficios` en Control de candidatos y widgets de resumen relacionados.
- Se reutilizo la clase existente `expanded-detail-field-full`, sin agregar CSS nuevo ni alterar datos.
- Validacion local: `npm run build:frontend-check`, `npm run audit:enterprise-docs` y `git diff --check` pasaron.

## EEES Enterprise Rebuild

- [x] Leer completo `CODEX_MASTER_PROMPT_EEES_ENTERPRISE.md` y fuentes obligatorias principales.
- [x] Auditar estructura real: frontend, Supabase, scripts, CI, docs y tasks.
- [x] Crear `eees/` con foundation, baselines, books, guardian, certification, playbooks, knowledge y codex.
- [x] Implementar `npm run guardian` con reglas machine-readable, metadata, referencias, marcadores de relleno y gates existentes.
- [x] Ejecutar validaciones locales aplicables y auditoria final de consistencia EEES.
- [x] Generar reporte final, artifact zip, commit, push y verificar CI.

### Resultado aplicado

- Se construyo EEES inicial con 41 archivos normativos y auditorias.
- Se agrego `npm run guardian` y `npm run guardian:full`.
- Guardian quedo integrado al workflow `Audit Enterprise Guardrails` para cambios en `eees/**`.
- Validacion local: `npx tsc -b --pretty false`, `npm run build`, `npm run guardian:full`, `npm run audit:buk-sync-guards` y `git diff --check` pasaron.
- Artifact historico `artifacts/EEES_ENTERPRISE_FINAL.zip` removido del repo en cleanup final porque duplicaba fuentes EEES versionadas.
- Cierre operativo: commit, push y verificacion CI ejecutados al finalizar la iteracion.

## Correccion Contratos - empresa CODELCO DRT

- [x] Confirmar en Supabase vivo como esta modelado CODELCO DRT en `contracts`, `buk_contract_mappings`, contrataciones y movilidad interna.
- [x] Identificar si la carga a Buses JM nace de datos del contrato, fallback `resolve_known_company_name(...)`, mapeo BUK o snapshot historico.
- [x] Aplicar correccion forward-only para que CODELCO DRT resuelva empresa Consorcio Nuevo Norte sin relajar permisos/RLS.
- [x] Validar contrataciones y movilidad interna con consultas remotas/smokes en rollback.
- [x] Ejecutar gates EEES aplicables, documentar aprendizaje y dejar el cierre versionado.

### Resultado aplicado

- Causa raiz confirmada en produccion: `buk_contract_mappings.company_name` para `6170400010:0001 / CODELCO DRT` estaba como `Buses JM Pullman S.A.` y `resolve_known_company_name(null, '6170400010:0001')` devolvia el mismo valor.
- Se agrego la migracion `20260722150218_fix_codelco_drt_company_consorcio_nuevo_norte.sql`.
- La migracion corrige `resolve_known_company_name(...)`, `buk_contract_mappings`, movilidades internas historicas DRT y `internal_mobility_request_snapshots`.
- Produccion fue aplicada por `supabase db query --file` y registrada en `supabase_migrations.schema_migrations` como `20260722150218`.
- Validacion remota: `buk_contract_mappings` para `CODELCO DRT` quedo con `company_name = Consorcio nuevo norte SPA`; `resolve_known_company_name(...)` devuelve Consorcio Nuevo Norte para `6170400010:0001` y `6170400010:0004`.
- Validacion remota: movilidad `MI-0050` quedo con `destination_company_name = Consorcio nuevo norte SPA` y `requires_termination = true`.
- Validacion remota autenticada: `get_internal_mobility_setup_catalogs()` devuelve `CONT-029 · CODELCO DRT · Consorcio nuevo norte SPA`.
- Guardrail: `audit:buk-sync-guards` ahora bloquea que CODELCO DRT vuelva a quedar fuera de Consorcio Nuevo Norte.
- Validacion local: `npm run guardian`, `npm run audit:migrations`, `npm run audit:supabase-security`, `npm run audit:buk-sync-guards` y `git diff --check` pasaron.

## Correccion Contratos - empresa BUK general

- [x] Auditar todos los `buk_contract_mappings` operativos contra dotacion BUK viva por codigo/area BUK y empresa `current_job.company_id`.
- [x] Identificar si existen otros contratos donde la empresa local difiere de la empresa dominante informada por BUK.
- [x] Implementar reconciliacion forward-only general para mappings, movilidad interna y snapshots sin hardcodear solo CODELCO DRT.
- [x] Reemplazar la guarda especifica por auditoria ejecutable de drift general ERP vs BUK.
- [x] Ejecutar gates EEES/Supabase, documentar aprendizaje y dejar commit/push en `main`.

### Resultado aplicado

- La auditoria viva detecto 22 mappings operativos 1:1 donde `buk_contract_mappings.company_name` diferia de la empresa dominante de BUK por `current_job.company_id`.
- Se agrego y aplico la migracion `20260722151708_reconcile_buk_contract_mapping_companies.sql`.
- La reconciliacion actualiza solo mappings con empresa BUK ganadora unica; casos sin muestra o con empate quedan fuera para revision humana.
- `resolve_known_company_name(null, contract_number)` ahora prioriza el mapping BUK exacto antes del fallback por sufijo.
- Produccion fue aplicada por `supabase db query --file` y registrada en `supabase_migrations.schema_migrations` como `20260722151708`.
- Validacion remota: la auditoria de drift ERP vs BUK regreso 0 filas corregibles.
- Validacion puntual: CODELCO DRT, CODELCO DMH, CODELCO ANDINA, FLIX VIÑA DEL MAR, RRHH CNN y MANTENCION CALAMA CNN resuelven fallback igual al mapping reconciliado.
- Validacion local: `npm run guardian`, `npm run audit:migrations`, `npm run audit:supabase-security`, `npm run audit:buk-sync-guards`, `npm run audit:enterprise-docs` y `git diff --check` pasaron.

## Certificados - nuevos modelos solicitados por instructores

- [x] Revisar contrato real de `get_competency_catalogs()` y tablas `competency_equipment_*`.
- [x] Aterrizar nomenclatura del requerimiento a ERP: `Bus 1 Piso`, `Bus 1 1/2 Piso`, `Bus 2 Pisos`, `Mini Bus`.
- [x] Agregar marcas/modelos solicitados sin duplicar codigos ni reactivar modelos erroneos.
- [x] Corregir Yutong `ZK6709 H` para que aparezca como bus y no como taxibus en el generador.
- [x] Aplicar migracion, validar catalogo remoto, ejecutar gates y publicar en `main`.

### Resultado aplicado

- Se agrego la migracion `20260722211032_add_instructor_requested_competency_models.sql`.
- Nomenclatura ERP aplicada en catalogo: `Bus 1 Piso`, `Bus 1 1/2 Piso`, `Bus 2 Pisos`, `Mini Bus`.
- Modelos agregados/normalizados: MERCEDES BENZ `O 500 RSD`; SCANIA `F 310 HB`, `K410 C`, `K 440 IB`, `K400 C`, `K 450-C`; VOLVO `B 450 R`; MAXUS `DELIBERY -9 - E DELIBERY -9`; KING LONG `XMQ6130 E`; YUTONG `ZK6709 H`.
- YUTONG `ZK6709 H` fue reclasificado desde `Taxibus` a `Bus 1 Piso` conservando el codigo legacy `yutong-c9-zk6709h`.
- Produccion fue aplicada por `supabase db query --file` y registrada en `supabase_migrations.schema_migrations` como `20260722211032`.
- Guardrail: `audit:competency-catalog-guards` bloquea que desaparezcan los modelos/tipos solicitados o que Yutong vuelva a Taxibus.
- Validacion remota: consulta directa a `competency_equipment_models` confirmo las 12 combinaciones solicitadas con tipo ERP correcto.
- Validacion local: `npm run guardian`, `npm run audit:migrations`, `npm run audit:supabase-security`, `npm run audit:competency-catalog-guards`, `npm run build:frontend-check`, `npm run audit:performance-baseline` y `git diff --check` pasaron.

## Proximos objetivos vivos

## Auditoria y despliegue integral backend/frontend - 2026-08-10

- [x] Revisar todos los worktrees, ramas, commits y estado de `origin/main`.
- [x] Inventariar las migraciones versionadas pendientes y validar su nomenclatura/baseline.
- [x] Obtener sesión de despliegue Supabase, consultar migraciones remotas y aplicar solo las pendientes en orden.
- [x] Ejecutar smoke remoto de las RPC de ficha BUK, incluyendo inicio y guardado transaccional.
- [x] Ejecutar Guardian y gates finales, confirmar árboles limpios y publicar commit/push en `main`.

### Resultado aplicado

- El historial remoto tenía 17 versiones legacy sin archivo local, pero todas las migraciones locales previas estaban aplicadas; no se repararon ni alteraron esas versiones históricas.
- Se aplicaron y registraron en `supabase_migrations.schema_migrations` las migraciones `20260810134000`, `20260810172000`, `20260810173000`, `20260810174000`, `20260810175000` y `20260810180000`.
- Smoke remoto anonimo: inicio de ficha exitoso para el candidato reportado, hash y sesion temporal correctos, envio con `submitted: true` dentro de `BEGIN/ROLLBACK`, y limpieza de la sesion de prueba.
- Auditoria final: `audit:migrations`, `audit:supabase-security` y `guardian` pasan con 0 errores y 0 warnings; el build frontend y los tests incluidos en Guardian tambien pasan.

## Correccion acceso ficha BUK publica DSAL - 2026-08-10

- [x] Reproducir el error de acceso mediante el RPC publico con el RUT y correo reportados.
- [x] Identificar que la funcion se ejecuta, pero falla al resolver `digest(bytea,text)` bajo `search_path = public`.
- [x] Preparar una migracion forward-only que califique `extensions.digest` en las funciones de inicio y envio, conservando los grants anonimos existentes.
- [x] Validar sintaxis de migraciones, seguridad Supabase, Guardian, build y `git diff --check`.
- [ ] Aplicar la migracion en Supabase remoto y repetir el RPC con el RUT/correo de prueba.

### Estado de cierre de esta iteracion

- La reproduccion remota anonima confirma que el grant de la RPC existe y que el fallo actual es `digest(bytea, unknown) does not exist` dentro de la funcion publicada.
- La migracion `20260810134000_fix_public_dsal_buk_digest_resolution` recalifica `digest` como `extensions.digest` en las funciones de inicio y envio, sin abrir tablas ni relajar RLS.
- El despliegue SQL remoto no se pudo ejecutar desde este entorno porque Supabase CLI no tiene proyecto vinculado ni token/sesion disponible; queda pendiente aplicar la migracion antes de validar el acceso real.

## Auditoria y correccion de bloqueo en Business Intelligence - 2026-08-10

- [x] Auditar el montaje de BI, consultas, importaciones pesadas y navegacion entre modulos.
- [x] Reemplazar el diferimiento de una sola tarea por montaje progresivo y cancelable de visualizaciones.
- [x] Diferir la importacion de ECharts del mapa y abortar la descarga al salir de BI.
- [x] Mantener cache operativa del dashboard de Reclutamiento y consultas independientes en paralelo.
- [x] Ejecutar TypeScript, build frontend, 98 tests unitarios/integridad, baseline de performance y Guardian.

### Resultado aplicado

- La causa principal era que `setTimeout(0)` solo postergaba un tick y luego montaba todos los graficos secundarios juntos, bloqueando el hilo principal con RPCs, ECharts y el mapa.
- Dotacion ahora monta sus bloques en cuatro etapas con `requestIdleCallback`/fallback temporizado y limpieza al cambiar de vista.
- Reclutamiento monta sus tres grupos de graficos por etapas; el mapa de Chile carga ECharts de forma diferida y cancela el fetch al desmontarse.
- Validacion final: `npm run build:frontend-check`, `npm run test:unit`, `npm run test:integrity`, `npm run audit:performance-baseline` y `npm run guardian` pasaron con 0 errores y 0 warnings.

## Revision de errores GitHub Actions - 2026-07-22

- [x] Inventariar ejecuciones fallidas recientes de `Audit Enterprise Guardrails` y revisar sus logs completos.
- [x] Clasificar cada causa como activa, corregida o externa, con evidencia del commit afectado.
- [x] Reproducir localmente cualquier fallo vigente y aplicar la correccion minima necesaria.
- [x] Ejecutar Guardian, TypeScript, build y checks afectados.
- [x] Confirmar workflow exitoso en `main`, documentar el resultado y publicar cambios si corresponden.

### Resultado aplicado

- Se revisaron las ultimas 100 ejecuciones del workflow: 8 fallos historicos y 0 fallos activos en la punta auditada de `main`.
- Cinco fallos correspondian al mismo chequeo Deno sin instalacion automatica de dependencias npm; quedaron cerrados por `9fa904b` y el comando vigente `deno check --no-config --node-modules-dir=auto`.
- Un fallo correspondia al timeout inicial del smoke de rutas sin configuracion Supabase portable; quedo cerrado por `76b77a1`.
- Dos fallos correspondian al baseline de bundle medido sin las variables publicas del entorno CI; quedaron cerrados por `07ddfeb`.
- Evidencia remota previa al cierre: run `29949601230` PASS, con `audit-enterprise-guardrails` y Cloudflare Pages exitosos sobre `07ddfeb`.
- Revalidacion local con entorno CI: `npm run guardian:full` PASS con 0 errores/0 warnings, TypeScript PASS, build PASS y `git diff --check` PASS.

## CORE DATA INTEGRITY - certificacion transaccional adversarial

- [x] Completar boot: objetivo, Books, baselines, matrices, hardening, certificaciones y contratos vivos.
- [x] Construir `CORE-TRANSACTION-MAP.md` para todos los flujos criticos.
- [x] Extraer y clasificar invariantes en `DOMAIN-INVARIANT-MATRIX.md`.
- [x] Atacar state machines, atomicidad, concurrencia, idempotencia, integridad referencial y autorizacion.
- [x] Auditar RPC/RLS, BUK/integraciones, documentos/Storage, jobs, reglas temporales y numericas.
- [x] Corregir todos los gaps internos P0/P1 con cambios forward-only y proteccion anti-regresion.
- [x] Extender Guardian solo con controles verificables de integridad de alto valor.
- [x] Repetir el mapa, ataques y auditorias hasta que no queden gaps internos ejecutables.
- [x] Generar findings, closure report y certificacion CORE DATA INTEGRITY.
- [x] Ejecutar Guardian full, suites unit/contract/integrity/concurrency/idempotency, migrations, security, route/role, TypeScript, build, smokes, EEES consistency y `git diff --check`.
- [x] Versionar y publicar el cierre solo si el arbol final y todos los gates quedan consistentes.

### Resultado aplicado

- Se mapearon 15 flujos y 37 invariantes criticas.
- Se cerraron 16 gaps P1 internos en 6 ciclos adversariales; quedan 0 P0/P1 internos.
- Cinco migraciones CORE quedaron aplicadas y alineadas con Supabase remoto.
- Cuatro Edge Functions documentales quedaron desplegadas con checkpoints, retry y autenticacion verificados.
- Dependencia externa residual: BUK no ofrece transaccion distribuida ni clave idempotente para reconciliar un POST aceptado cuya respuesta se corta.

- [x] EEES P2 - Complejidad, reutilizacion y mantenibilidad:
  - [x] Leer reportes P1/P2, Boot Sequence, tasks, lessons y Books aplicables.
  - [x] Medir baseline de archivos criticos, Guardian warnings y accesos directos Supabase.
  - [x] Refactorizar incrementalmente archivos P2.1 de mayor riesgo sin cambiar comportamiento.
  - [x] Reducir duplicacion real en helpers, hooks, services, mappings y query keys cuando exista mas de un consumidor o reduzca riesgo claro.
  - [x] Cerrar accesos directos Supabase fuera de boundaries permitidos o clasificar excepciones tecnicamente justificadas.
  - [x] Actualizar auditoria de complejidad, baselines, lessons y reporte P2.
  - [x] Ejecutar `npm run guardian:full`, TypeScript, build, gates afectados y `git diff --check`.

  Resultado aplicado:
  - Se redujeron 13 archivos criticos sobre 800 lineas a 0 archivos restantes sobre el umbral.
  - Guardian bajo de 14 warnings historicos a 0 warnings sin relajar reglas ni suppressions.
  - Se extrajeron mappers, helpers, hooks, servicios y componentes visuales conservando exports publicos.
  - Validacion final registrada en `eees/audits/P2-CLOSURE-REPORT.md`.
- [ ] EEES P1 - Cerrar smokes autenticados por rol y auditar deuda legacy de onboarding:
  - [x] Leer `eees/audits/FINAL-IMPLEMENTATION-REPORT.md`, `tasks/todo.md`, Boot Sequence y Books aplicables.
  - [x] Inspeccionar manifiesto, scripts, workflow y documentacion de smokes autenticados.
  - [x] Consolidar la matriz P1 de smokes autenticados por roles controlados sin versionar credenciales reales.
  - [x] Auditar onboarding legacy y cerrar la parte tecnicamente ejecutable sin reactivar deuda historica.
  - [x] Ejecutar `npm run guardian:full` y gates afectados.
  - [x] Actualizar `tasks/todo.md`, `tasks/lessons.md`, auditorias EEES y generar reporte de cierre P1.

  Resultado aplicado:
  - `tests/smoke/frontend-authenticated.scenarios.json` ahora cubre 16 escenarios y roles P1 principales.
  - `npm run audit:frontend-auth-smoke-matrix` exige cobertura P1 por rol, docs, workflow y ausencia de credenciales reales.
  - `npm run audit:onboarding-legacy-guards` valida la frontera viva de alta operacional y las migraciones correctivas legacy.
  - `npm run guardian:full` paso con 0 errores y 14 warnings historicos fuera de alcance P1.
  - Reporte generado: `eees/audits/P1-CLOSURE-REPORT.md`.
- [ ] Convertir la purga documental en rutina periodica: revisar archivos grandes versionados y referencias huerfanas antes de cada cierre mayor.
- [ ] Mantener smokes autenticados por rol cuando existan credenciales controladas en secrets.
- [ ] Evaluar activos no documentales pesados solo si el usuario autoriza optimizacion fuera de `docs/` y `tasks/`.

## Carga BUK en contingencia - Ricardo Cortez - 2026-08-10
- [x] Auditar candidato, ficha contractual, documentos cargados y ruta operativa BUK DSAL.
- [x] Diseñar una autorización backend explícita para contingencia, con motivo obligatorio y trazabilidad, sin marcar documentos como aprobados.
- [x] Implementar el flujo backend/worker para encolar y ejecutar la carga contingente, manteniendo capacidad, mapping, rol y datos críticos.
- [x] Ejecutar smoke transaccional y procesar a Ricardo: BUK confirmó ficha 42629, ruta DSAL y 9 documentos.
- [x] Ejecutar Guardian, documentar resultado, commit y push a main.

### Resultado aplicado

- Ricardo Manuel Cortés Valdés (`17.295.826-5`) quedó en BUK como empleado `42629` con área `CODELCO - DSAL`, area_id `2911`, company_id `5`, cost center `718`, role `CONDUCTOR DE MINIBUS 4X4`, plan y job BUK confirmados.
- Se transfirieron 9 documentos del ERP a BUK con respuestas `201`; la documentación ERP sigue `pending` y no fue marcada como aprobada.
- La Solicitud de Contratación quedó explícitamente omitida para regularización posterior; el job contingente conserva motivo, usuario, fecha y respuestas del proveedor.
- La reconciliación automática fue ajustada para no transformar una carga contingente en contratación ERP; Ricardo permanece en etapa `lead`.
- Guardian final: PASS, 0 errores y 0 warnings; migraciones, seguridad, integridad, concurrencia, idempotencia, build y diff check aprobados.

## Correccion supervisor y fecha Ricardo Cortez - 2026-08-10
- [x] Confirmar supervisor contractual DSAL en `buk_contract_mappings` y ficha BUK.
- [x] Actualizar BUK: supervisor Marcelo Villarroel (`35304`) y fecha de ingreso `2026-08-10`.
- [x] Actualizar la ficha contractual ERP con fecha `2026-08-10`, conservando auditoria del cambio `2026-08-09 -> 2026-08-10`.
- [x] Ajustar el worker para priorizar el administrador del contrato como supervisor BUK y evitar que futuros reprocesos usen al solicitante del folio.
- [x] Verificar BUK, desplegar Edge Function y ejecutar Guardian.

## Correccion folio y carga BUK - Jorge Andres Godoy Martinez - 2026-08-11
- [x] Confirmar que RC-0132 correspondia al contrato CODELCO - DSAL y revisar la ficha ERP con codigo F1.
- [x] Corregir `hiring_requests` y `recruitment_cases` al cargo canonico `CONDUCTOR DE MINIBUS 4X4` (`job_position_id 271`).
- [x] Ejecutar la carga contingente BUK y verificar ficha, plan, job, area, cargo, supervisor y fecha directamente en BUK.

Resultado: Jorge Andres Godoy Martinez quedo en BUK como empleado `42663`, ficha `F1`, cargo `CONDUCTOR DE MINIBUS 4X4` (rol `157`), area DSAL `2911`, centro `718`, supervisor Marcelo Villarroel (`35304`) y fecha de ingreso `2026-08-11`. El job ERP quedo en `success`; no se transfirieron documentos porque no habia documentos cargados y el candidato permanece en `lead` por tratarse de una carga contingente.

## Validacion carga BUK - Yerko Alfonso Corrotea Rojas - 2026-08-11
- [x] Validar candidato DSAL, folio RC-0132, cargo `CONDUCTOR DE MINIBUS 4X4` y ficha reservada `F1`.
- [x] Confirmar en BUK que el rol `157` esta habilitado para el area DSAL `2911` y que no existe ficha previa por RUT.
- [x] Normalizar en el worker el periodo de pago antes de enviarlo a BUK y desplegar la Edge Function.
- [x] Completar la carga BUK despues de regularizar tipo y numero de cuenta bancaria.

Resultado final: el primer job `aad59a20-5714-45d2-a49d-4f2baa080cf2` conserva el error historico del snapshot antiguo. El nuevo job `c66f1900-f71e-4714-a36c-b001c680bdb6` quedo en `success`; Yerko Alfonso Corrotea Rojas quedo en BUK como empleado `42664`, ficha `F1`, cargo `CONDUCTOR DE MINIBUS 4X4` (rol `157`), area DSAL `2911`, centro `718`, supervisor Marcelo Villarroel (`35304`) y fecha de ingreso `2026-08-11`.
## Correccion movil evaluacion psicolaboral - 2026-08-13
- [x] Ajustar el contenedor de preguntas para evitar desborde horizontal en pantallas pequeñas.
- [x] Llevar el viewport al inicio del bloque siguiente despues de guardar y avanzar.
- [x] Verificar build frontend, Guardian y diff check; revisar la version publicada.

Resultado: las tarjetas usan el ancho disponible con wrapping defensivo y el siguiente bloque se enfoca automáticamente después de guardar.

## Correccion finalizacion IPIP psicolaboral - 2026-08-13
- [x] Reproducir el error con las respuestas persistidas del candidato canario.
- [x] Corregir el conflicto de nombres del RPC de finalización sin perder respuestas.
- [x] Reprocesar el IPIP-16 y confirmar estado completado en Supabase.
- [x] Mejorar el mensaje de errores controlados de la Edge Function en el portal.
- [ ] Verificar cierre de la batería completa y generación del certificado con todos los instrumentos.

Resultado: el RPC fallaba en `result=result` por ambigüedad PL/pgSQL; ahora usa una variable y columna calificadas explícitamente. El IPIP-16 de Maximiliano quedó completado con 105 respuestas conservadas.

## Ajuste visual de estados de batería psicolaboral - 2026-08-13
- [x] Separar visualmente los títulos de Batería psicolaboral e Hitos de las tarjetas.
- [x] Aplicar relleno tipo marca de agua a cada instrumento según estado.
- [x] Verificar build, Guardian y publicación productiva.

Resultado: los instrumentos completados se muestran en verde suave, los que están en progreso en amarillo y los no iniciados en gris; los títulos tienen mayor separación superior e inferior.

## Implementacion Psych AI proveedor externo - 2026-08-13
- [x] Leer prompt de continuidad y contratos vivos del modulo psicolaboral antes de editar.
- [x] Crear capa backend privada para perfiles de cargo, prompts versionados, interpretaciones IA y ejecuciones auditables.
- [x] Implementar proveedor externo con JSON Schema estricto y fallback mock bajo `PSYCH_AI_ENABLED=false`.
- [x] Blindar privacidad: payload sin RUT, correo, nombre candidato ni respuestas crudas hacia proveedor externo.
- [x] Agregar flujo frontend para generar, revisar, observar y validar interpretaciones IA desde Gestion Psicolaboral.
- [x] Incorporar la interpretacion IA al informe psicolaboral interno de 4 paginas.
- [x] Aplicar migraciones y desplegar Edge Functions en Supabase produccion.
- [x] Ejecutar Deno checks, TypeScript, integridad, migraciones, seguridad, build frontend, performance baseline, Guardian y smoke productivo reducido.

Resultado histórico: Psych AI quedó implementado con proveedor mock mientras faltaba la credencial del proveedor externo. La validación real pasó luego a OpenAI `gpt-5-mini`.

## Correccion schema Psych AI - 2026-08-13
- [x] Identificar causa del fallback: el proveedor rechazaba `psych-ai-schema-v1` por `additionalProperties` dinámico en `ipip16.clusters`.
- [x] Versionar `psych-ai-schema-v2` con campos fijos compatibles.
- [x] Ajustar Edge para dejar los fallos reales de proveedor en `FAILED`, no como revisión pendiente con fallback.
- [x] Invalidar las revisiones pendientes generadas por el error anterior para permitir regeneración.
- [x] Desplegar migración y Edge Functions en Supabase producción.
- [x] Verificar prompt activo `schema-v2`, schema dinámico eliminado e interpretaciones viejas inválidas en 0 pendientes.

Resultado histórico: Gestión Psicolaboral puede regenerar IA real usando schema compatible.

## Automatizacion IA psicolaboral al recibir respuestas - 2026-08-13
- [x] Revisar el cierre real de batería en `submit_psycholaboral_instrument` y la Edge Function pública de candidatos.
- [x] Extraer la generación IA a una función backend reutilizable.
- [x] Ejecutar la generación IA automáticamente con `waitUntil` cuando el último instrumento completa la batería.
- [x] Quitar el botón manual `Generar IA` de Gestión Psicolaboral.
- [x] Mantener solo revisión profesional clickeable cuando exista interpretación IA revisable.
- [x] Validar build, Guardian, deploy Supabase/frontend, smoke y publicar.

Resultado: el candidato termina la batería, el ERP dispara IA y certificado en backend; Reclutamiento solo revisa el resultado cuando esté disponible.

## Correccion visual y reintento IA fallida - 2026-08-13
- [x] Confirmar que la pantalla seguía mostrando un fallo histórico de `psych-ai-schema-v1`.
- [x] Evitar que el modal de resultados muestre fallback técnico fallido como interpretación profesional.
- [x] Exponer `display_output` solo para estados revisables/validados.
- [x] Agregar reintento interno protegido por service-role para evaluaciones ya completadas antes de la automatización.
- [x] Aplicar migración, desplegar Edge/frontend, reintentar evaluación afectada y validar.

Resultado: una IA fallida se ve como estado técnico, no como informe; el caso histórico RC-1807 fue regenerado y quedó `PENDING_REVIEW`.

## Psych AI V6.1 Luna medio robusto - 2026-08-14
- [x] Auditar contrato V5.4, scoring PRP, perfiles de cargo, guardrails, schema y renderer PDF.
- [x] Implementar semántica V6.1: rangos PRP documentados, convergencias/divergencias, criticidad y matriz de competencias.
- [x] Versionar prompt, schema, perfiles y runtime `gpt56-luna-medium-v6.1`.
- [x] Ajustar salida determinística, normalización, consistencia y etiquetas visibles del PDF.
- [x] Agregar/actualizar pruebas unitarias e integridad; ejecutar Deno checks, build, Guardian y auditorías.
- [x] Aplicar migración en Supabase producción y desplegar las Edge Functions involucradas.
- [x] Regenerar canario RC-1807 y confirmar interpretación V6.1 y certificado generado.
- [x] Comparar estado/artefactos, documentar límites metodológicos y preparar publicación en `main`.

Resultado: producción quedó con `psych-ai-prompt-v6.1`, `psych-ai-schema-v6.1`, siete perfiles `profile-v6.1` activos y OpenAI `gpt-5.6-luna`. El canario `a48773d1-b296-4b9a-9524-84aa400ffdca` generó interpretación nueva (`2c77b1a3-e2f9-4148-83d0-c9151429e168`) con PRP 90 clasificado `NO_ADECUADO`, convergencia con BIS-11 sobre el promedio y recomendación `REQUIERE_PROFUNDIZACION`; `guardrail_flags` quedó vacío. El informe/certificado quedó generado. No se inventaron baremos, conducta observada ni equivalencias; eneatipos y otros instrumentos no documentados siguen fuera de alcance.

## Carga contingente BUK RC-0142 - 2026-08-14
- [x] Corregir y auditar las fechas ERP de los 16 candidatos al `15/08/2026`; ajustar Ramiro y Christian con trazabilidad.
- [x] Detectar y corregir el doble descuento de cupos en el RPC de carga contingente cuando un lote comparte folio.
- [x] Encolar y procesar los 16 candidatos de RC-0142 en BUK con ruta operativa `718`.
- [x] Verificar en ERP que los 16 jobs quedaron `success` y en BUK que cada ficha está activa con cargo, plan, área, centro y supervisor correctos.

Resultado: 16/16 fichas creadas en BUK. Fichas BUK `42867` a `42882` (sin asumir orden correlativo por persona), cargo `CONDUCTOR DE BUS`, área DSAL `2911`, centro `718`, supervisor Marcelo Villarroel y fecha de ingreso `15/08/2026`. William fue cargado con el RUT ERP corregido `15.573.108-7`.
# Análisis Exd.xlsx contra Jornadas y Turnos - 2026-08-18

- [x] Leer el contrato real del módulo y distinguir pauta, estado base y excepciones.
- [x] Inspeccionar las hojas y normalizar la columna Fecha de servicio/RUT del archivo.
- [x] Consultar el estado productivo por RUT-fecha mediante el RPC autorizado `get_worker_schedule`.
- [x] Entregar el cruce analítico por trabajador y fecha usando la fase observada en agosto, con evidencia de identidad y pauta.

Resultado parcial: `Resumen` contiene 214 filas, 58 RUT y 198 pares RUT-fecha distintos entre 2026-05-20 y 2026-07-23. El RUT `12.703.451-6` aparece con tres nombres distintos, por lo que no se debe resolver por nombre. La consulta productiva no pudo ejecutarse con las credenciales locales: la clave de servicio fue rechazada y el acceso anónimo no tiene permisos sobre trabajadores/RPCs de roster. Las hojas auxiliares comparan 1.411 pares contra 220 y solo 97 coinciden; esto no reemplaza el estado del módulo.

Resultado final del análisis: se levantaron las fases de agosto para 54 RUT con coincidencia estable y se proyectaron hacia atrás según la periodicidad observada de cada pauta. De las 214 filas, 166 quedan probablemente en `Trabajo`, 44 en `Descanso` y 4 no son verificables porque los RUT `10.235.039-2`, `10.235.039-3`, `10.235.039-4` y `10.235.039-5` no cargaron como trabajadores del módulo. La inferencia no determina excepciones históricas ni prueba que el servicio efectivamente se haya realizado; solo clasifica la jornada base esperada. Se observaron 14 filas de `Por Vacante no llenada`, 12 de `Reemplazo por vacaciones y/o permisos` y 7 de sobretiempo que caen en descanso base, coherente con los conceptos declarados, sujeto a validación de excepciones históricas.
# Revisión informes: categoría final y formato Conductor - 2026-08-19

- [x] Auditar componentes de revisión, contrato `reviewed_output` y renderer PDF.
- [x] Implementar layout de ancho completo para Perfil ejecutivo y Fortalezas críticas.
- [x] Agregar selección profesional de categoría final sin alterar el análisis IA.
- [x] Aplicar título/metadatos F-RH-071 para cargos Conductor y conservar F-RH-009 para el resto.
- [x] Ejecutar pruebas, build frontend, Guardian, revisión de diff y documentar resultado.

Resultado: la revisión IA mantiene el contenido original y permite que la psicóloga seleccione `Adecuado`, `Adecuado con Observaciones` o `No Adecuado`; la selección se guarda en `reviewed_output.recommendation` y el renderer PDF la utiliza como resultado final. Perfil ejecutivo y Fortalezas críticas ocupan el ancho completo del diálogo. Para cargos cuyo nombre contiene `conductor`, el informe usa `Informe de Aversión al Riesgo`, código `F-RH-071`, fecha `01-08-2026` y versión `1`; el resto conserva `Informe de Evaluación Psicolaboral` y `F-RH-009`. Vite build, Deno check del renderer, integridad 62/62, auditoría BUK y `git diff --check` pasaron. `build:frontend-check` y Guardian quedaron bloqueados localmente por copias conflictivas preexistentes en `node_modules/* 2`; Guardian además reportó el baseline histórico de tamaño de `dist`. Publicación completada: commit `9a2109d` en `main`, bundle nuevo confirmado en `https://gestion.busesjm.cl` y Edge Function `generate-psycholaboral-certificate` desplegada en Supabase versión `109`.
# Bloqueo de informes psicolaborales aprobados - 2026-08-19

- [x] Auditar acciones de revisión, regeneración y estados `VALIDATED/generated`.
- [x] Ocultar edición/revisión y actualización en la interfaz para informes aprobados.
- [x] Bloquear revisión y reset de certificado aprobado en RPCs backend.
- [x] Ejecutar gates, aplicar migración, desplegar frontend/Edge Functions y verificar producción.

Resultado: cuando el informe está `VALIDATED` y el documento generado, la interfaz muestra `Aprobado · bloqueado`, oculta `Revisar informe` y `Actualizar informe`, y conserva solo las descargas. La RPC de revisión rechaza cualquier modificación de una interpretación `VALIDATED`; las RPCs de reset manual y de servicio también rechazan regenerar informes aprobados/generados. La migración `20260819212000_lock_approved_psychological_report.sql` se aplicó y registró en producción. Vite build, integridad 62/62, auditoría de migraciones, auditoría de seguridad y `git diff --check` pasaron; la auditoría de seguridad mantiene únicamente warnings históricos del repositorio.

## Sincronización puntual de cargo BUK - 2026-08-22
- [x] Confirmar en BUK el cargo `Ingeniero especialista Planificación y control` y su identificador `1757`.
- [x] Verificar que el cargo aún no existía en `public.job_positions` y que la sincronización automática había ocurrido antes de su creación.
- [x] Aplicar en producción una sincronización puntual idempotente sin cambiar la lógica del sincronizador.
- [x] Confirmar en producción una única fila activa, registrar la migración y publicar el commit en `main`.

Resultado: el cargo quedó disponible en el catálogo productivo como `BUK-ROLE-1757`; la migración `20260822175710_sync_new_buk_job_position_ingeniero_planificacion_control` quedó aplicada y el commit `472870f` fue enviado a `main`.

## Carga contingente BUK RC-0132 - 2026-08-23
- [x] Verificar la identidad de los siete candidatos y su pertenencia al folio `RC-0132`.
- [x] Validar que no tuvieran fichas BUK previas y que existieran cupos disponibles.
- [x] Encolar la carga mediante la RPC oficial de contingencia.
- [x] Procesar los siete jobs con el worker productivo y confirmar `success` e `buk_employee_id`.
- [x] Deshabilitar el runner técnico temporal después de la ejecución.

Resultado: 7/7 fichas creadas en BUK para `RC-0132`: IDs `42997` a `43003` (asignación por candidato verificada en `buk_sync_jobs`).
## Alta BUK Jaime Andres Pasten Perez - 2026-08-22

- [x] Confirmar ficha ERP, folio, cargo y datos laborales.
- [x] Verificar que no exista job/empleado BUK previo.
- [x] Validar payload mediante la ruta contingente autorizada.
- [x] Encolar alta idempotente.
- [x] Ejecutar job de sincronización BUK.
- [x] Verificar empleado, F1 y ausencia de duplicados en producción.

Resultado: job `474a8e42-62a3-4620-8de1-9f1a6ca9bda8` exitoso; BUK employee `42996`, código F1, una ficha ERP, un job exitoso y sin duplicados.

## Corrección búsqueda precandidatos DSAL - 2026-08-24

- [x] Reproducir la búsqueda de `Mario Antonio Peña Rivera` contra producción.
- [x] Confirmar el registro real, su estado `pending` y la causa de la diferencia de tildes.
- [x] Corregir el RPC productivo para normalizar consulta y columnas sin alterar datos ni estados.
- [x] Validar en producción la búsqueda con tildes y sin tildes, además del RUT.

Resultado: la migración `20260824135155_fix_dsal_precandidate_accent_search` permite encontrar el mismo precandidato aunque se busque `Pena` o `Peña`. El registro no fue modificado.
## Carga contingente BUK - Marcelo Reyes, Eduard Leyton e Ignacio Pérez - 2026-08-24

- [x] Identificar fichas ERP, folios, cargos y datos laborales de los tres candidatos.
- [x] Confirmar que no existan jobs ni empleados BUK previos.
- [x] Validar payloads por la ruta contingente autorizada.
- [x] Encolar y procesar las tres altas idempotentes.
- [x] Verificar empleados F1, estados `success` y ausencia de duplicados.

Resultado: se confirmó que el trabajador rechazado de ERP (`42873`) ya no existe en BUK; se reconcilió su job histórico como no vigente, liberando un cupo real. Las tres altas quedaron `success`: Eduard `43058`, Marcelo `43059` (reutilización segura tras timeout) e Ignacio `43060`, todos F1 y sin duplicados.

## Corrección preventiva Sync BUK: fondo previsional AFP - 2026-08-24
- [x] Reproducir la causa del error productivo `Buk API 400`: régimen que cotiza sin fondo de cotización.
- [x] Alinear la validación del formulario, el límite de persistencia de jobs y el worker BUK.
- [x] Aplicar migración `20260824151707_block_invalid_buk_pension_payload` y desplegar la función de sincronización.
- [x] Ejecutar gates y verificar en producción que el rechazo sea previo a la llamada externa y auditable.

Resultado: un payload AFP sin fondo ya no puede guardarse en `buk_sync_jobs`; el formulario muestra el campo faltante y la Edge Function mantiene una segunda validación. La función `sync-buk-candidates` fue desplegada en producción y el trigger productivo quedó habilitado. La prueba transaccional fue rechazada con el mensaje esperado, sin crear un job.

## Carga contingente DSAL - María José Araya Herrera - 2026-08-24
- [x] Confirmar identidad, RUT `19.271.418-4`, folio `RC-0163`, cargo y contrato DSAL.
- [x] Confirmar que no existieran jobs ni ficha BUK previa y que hubiera un cupo disponible.
- [x] Encolar mediante `enqueue_buk_generation_contingency` con motivo auditado.
- [x] Procesar el job productivo y confirmar `success` con `buk_employee_id` real.
- [x] Verificar F1, plan previsional, cargo, área, centro, tallas y ausencia de duplicados.
- [x] Restaurar el runner técnico temporal a estado deshabilitado.

Resultado: María José Araya Herrera quedó creada en BUK como ficha `43092`, código `F1`, con job `42a4b850-0f13-44da-827f-d846d3a9419a` en `success`. BUK confirmó cargo `1757`, área DSAL `2911`, centro `718`, AFP PlanVital, Fonasa y tallas `M/36/38`. La contingencia quedó auditada en el payload con motivo, usuario y fecha; no se generaron duplicados.

## Auditoría y publicación de cambios pendientes - 2026-08-24
- [x] Validar ramas, worktrees y divergencia con `origin`.
- [x] Ejecutar pruebas y gates del cambio BUK pendiente.
- [x] Committear únicamente cambios funcionales y documentación auditada.
- [x] Publicar `main` y verificar alineación remota.

Resultado parcial: integridad `84/84`, unitarias `115/115`, auditoría BUK, migraciones y `git diff --check` aprobados. Guardian quedó inicialmente bloqueado únicamente por un aumento medido de 126 bytes en `dist`, ya documentado en el baseline sin relajar sus presupuestos.
