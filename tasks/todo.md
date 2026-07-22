# Tareas y Roadmap de Desarrollo

> **REGLA FUNDACIONAL (Leccion 56):** Antes de proponer, planificar o ejecutar cualquier cambio sobre este repositorio, se debe leer `tasks/todo.md` y `tasks/lessons.md` completos. Esta es la primera accion obligatoria de cada sesion de trabajo, sin excepcion.

Este archivo mantiene solo el estado vivo y los cierres recientes con relevancia operacional para el ERP. El historial cerrado sin enlace productivo fue purgado para reducir peso del repositorio; las reglas reutilizables permanecen en `tasks/lessons.md` y la documentacion vigente en `docs/`.

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

## Proximos objetivos vivos

- [ ] Convertir la purga documental en rutina periodica: revisar archivos grandes versionados y referencias huerfanas antes de cada cierre mayor.
- [ ] Mantener smokes autenticados por rol cuando existan credenciales controladas en secrets.
- [ ] Evaluar activos no documentales pesados solo si el usuario autoriza optimizacion fuera de `docs/` y `tasks/`.
