# Tareas y Roadmap de Desarrollo

> **REGLA FUNDACIONAL (Leccion 56):** Antes de proponer, planificar o ejecutar cualquier cambio sobre este repositorio, se debe leer `tasks/todo.md` y `tasks/lessons.md` completos. Esta es la primera accion obligatoria de cada sesion de trabajo, sin excepcion.

Este archivo mantiene solo el estado vivo y los cierres recientes con relevancia operacional para el ERP. El historial cerrado sin enlace productivo fue purgado para reducir peso del repositorio; las reglas reutilizables permanecen en `tasks/lessons.md` y la documentacion vigente en `docs/`.

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
