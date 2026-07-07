# Tareas y Roadmap de Desarrollo

> **REGLA FUNDACIONAL (Lección 56):** Antes de proponer, planificar o ejecutar cualquier cambio sobre este repositorio, se debe leer `tasks/todo.md` y `tasks/lessons.md` completos. Esta es la primera acción obligatoria de cada sesión de trabajo, sin excepción.

## Corrección de asignación de gerente de área en folios 1:1 con colisión de centro de costo

- [x] Auditar por qué el folio `0077` de `MANTENCION CALAMA` resolvió a Andrés Madrid como `Gerente de area` pese a que el match 1:1 del contrato indica a Rodrigo Galdames
- [x] Corregir la resolución backend de `submit_hiring_request(...)` para priorizar el gerente del mapping 1:1 del contrato antes de caer al catálogo global `cost_center_approvers`
- [x] Verificar alcance del bug sobre aprobaciones `area_manager` pendientes y documentar el resultado antes de cerrar

## Resultado de corrección de asignación de gerente de área en folios 1:1 con colisión de centro de costo

- La causa raíz estuvo en backend, no en el modal de aprobación. El folio [`0077`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/ApprovalModal.tsx:148) se creó con contrato `MANTENCION CALAMA` (`contract_id = 62`, `cost_center_code = 10111`) y el match 1:1 de [`buk_contract_mappings`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260607230000_add_buk_contract_mapping_catalog.sql:202) sí lo deja explícito con `manager_name = Rodrigo Galdames`.
- El desvío ocurrió porque [`submit_hiring_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617215411_skip_redundant_area_manager_self_approval.sql:1) ignoraba ese `manager_name` contractual y resolvía `area_manager` únicamente desde `cost_center_approvers` por `cost_center_code`.
- En este tenant, `cost_center_code` no es una clave segura para gerente:
  - `10111` está compartido por `MANTENCION CALAMA` y por contratos de `RECURSOS HUMANOS`;
  - `cost_center_approvers(10111)` hoy apunta a `Andres Madrid Maureira`, porque esa tabla quedó sembrada históricamente para `GERENCIA RECURSOS HUMANOS`;
  - por eso el folio `0077` tomó a Andrés aunque el contrato 1:1 correcto fuese Rodrigo.
- El problema no era aislado a `10111`. La auditoría encontró al menos otra colisión operativa relevante en `10114`, donde el catálogo 1:1 mezcla contratos de `Zona II` y `Zona III` con gerentes distintos, por lo que seguir resolviendo solo por centro de costo seguiría siendo estructuralmente frágil.
- La corrección quedó versionada en [`20260707201000_fix_hiring_area_manager_resolution_from_contract_mapping.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260707201000_fix_hiring_area_manager_resolution_from_contract_mapping.sql:1):
  - `submit_hiring_request(...)` ahora intenta resolver primero el `manager_name` del match 1:1 operativo del contrato a un perfil activo;
  - solo si eso no se puede resolver, degrada al catálogo global `cost_center_approvers`;
  - con eso, contratos como `MANTENCION CALAMA` vuelven a usar a Rodrigo Galdames y, si el solicitante coincide con el gerente contractual, la autoaprobación vuelve a operar como estaba diseñada.
- Estado del folio `0077` auditado:
  - la solicitud quedó `pending_contracts_control`;
  - la aprobación `area_manager` histórica quedó grabada con `approver_name = Andres Madrid Maureira`;
  - no existen hoy aprobaciones `area_manager` pendientes mal asignadas por este bug, por lo que no fue necesario reparar cola viva adicional en esta pasada.

## Hotfix de pendientes BUK ya existentes

- [x] Auditar por qué candidatos visibles en `Personal a Contratar` siguen pendientes aunque BUK ya tenga una ficha generada por el ERP
- [x] Corregir el worker `sync-buk-candidates` para que recupere correctamente planes ya existentes y complete la generación efectiva sin dejar el job en `error`
- [x] Validar con evidencia remota, revisión de diff y despliegue del worker antes de cerrar

## Reparación de F2 interna creada por ERP que fue anulada como duplicado externo

- [x] Corregir `sync-buk-candidates` para que una ficha activa que coincide con el `suggested_employee_code` del ERP se repare y reutilice, en vez de anular la pedida como duplicado externo
- [x] Endurecer la resolución del contexto BUK para recuperar `buk_area_code` canónicamente cuando el mapping exista pero siga incompleto
- [ ] Reparar el caso productivo de José Patricio Méndez Díaz (`RC-0013`) alineando BUK y ERP con validación remota completa

## Resultado de reparación estructural de correlativo BUK y F2 internas

- La raíz profunda sí estaba en el contrato backend del correlativo de ficha. [`20260707173500_fix_buk_employee_code_resolution_against_live_registry.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260707173500_fix_buk_employee_code_resolution_against_live_registry.sql:1) recompone `resolve_candidate_worker_employee_code(...)` para que el siguiente `F1/F2/F3...` salga del registro vivo de fichas BUK (`public.employees.raw_payload ->> 'code_sheet'`) y de los snapshots recientes de `buk_sync_jobs`, no solo del `candidate_worker_files.employee_code` viejo.
- Esa misma migración dejó alineado el payload vivo de ficha BUK con la verdad canónica:
  - `get_candidate_buk_profile(...)` ahora prioriza `suggested_employee_code`;
  - `candidate_worker_files.employee_code` quedó backfilleado en remoto para los casos afectados, incluyendo José Patricio Méndez Díaz y los tres candidatos de `RC-0067`, todos ya con `F2`.
- En runtime todavía quedaba un segundo bug que explicaba por qué los tres casos nuevos seguían fallando aun con la ficha correcta:
  - el worker ya entraba por `reused_incomplete_existing`;
  - pero al crear el trabajo BUK omitía `other_type_of_working_day` cuando la jornada del área resolvía `working_schedule_type = 'otros'`;
  - BUK por eso respondía `Otros Tipos de Jornada no puede estar en blanco`.
- La corrección final quedó en [`sync-buk-candidates/index.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1):
  - reutiliza una ficha activa interna cuando coincide con el `suggested_employee_code` resuelto por ERP, en vez de cancelarla como duplicado externo;
  - recupera `buk_area_code` por RPC cuando el mapping contractual existe pero sigue incompleto;
  - arrastra también `other_type_of_working_day` desde el contexto operativo del área cuando la jornada BUK es `otros`.
- El despliegue productivo quedó aplicado con:
  - `npx --yes supabase db push --linked --include-all`
  - `npx --yes supabase functions deploy sync-buk-candidates --project-ref pzblmbahnoyntrhistea --use-api --yes`
- Reparación productiva confirmada sobre los tres casos vivos de `RC-0067`:
  - Jorge Ricardo Orellana Coronado: job `1d0864cd-60bd-4076-b747-2ab4ec62ad72` -> `success`, ficha `41908`, trabajo BUK `141997`, `16` documentos subidos, candidato `hired`;
  - Antonio Enrique Morales Gamboa: job `3058fa0c-a2e4-46d3-9478-279d1a0eacbf` -> `success`, ficha `41904`, trabajo BUK `141998`, `16` documentos subidos, candidato `hired`;
  - Gregorio Patricio Callejas Bravo: job `b1fc23f6-9d42-4149-bc2b-c5ed5e2e847b` -> `success`, ficha `41905`, trabajo BUK `141999`, `16` documentos subidos, candidato `hired`.
- La evidencia BUK final quedó alineada en los tres:
  - `start_date = 2026-07-06`
  - `working_schedule_type = 'otros'`
  - `other_type_of_working_day = 'especial_art_25'`
  - `base_wage = 0`
  - `area_id = 2911`, `leader_id = 17716`
- José Patricio Méndez Díaz no se marcó como resuelto en esta pasada. Su ficha `41875/F2` ya está identificada como interna y el correlativo quedó corregido, pero el caso quedó históricamente anulado como duplicado activo por un job `success` anterior; requiere una reparación adicional de estado ERP/caso antes de volver a dejarlo “como operamos ahora”.

## Resultado de hotfix de pendientes BUK ya existentes

- La causa raíz no estaba en la tabla `Personal a Contratar`, sino en la señal canónica que la alimenta. El bucket [`get_recruitment_personnel_page_bucket(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703044500_align_personnel_buckets_with_buk_success.sql:1) solo retira un candidato cuando existe `buk_sync_jobs.status = 'success'` con `buk_employee_id`, por lo que cualquier alta BUK incompleta o job terminado en `error` sigue apareciendo como pendiente.
- La evidencia remota fue consistente en los tres casos visibles de `RC-0067`:
  - Jorge Ricardo Orellana Coronado (`candidate_id = ebe77765-252c-43a2-a208-239a5259f60a`) quedó con jobs `error` y ficha BUK `41908`;
  - Antonio Enrique Morales Gamboa (`candidate_id = 380dd752-b77d-4234-ab95-4404e4a7ac75`) quedó con job `error` y ficha BUK `41904`;
  - Gregorio Patricio Callejas Bravo (`candidate_id = 713c2905-03d3-4191-94f3-e82530816220`) quedó con jobs `error` y ficha BUK `41905`.
- En los tres, el patrón fue el mismo:
  - la ficha `F2` ya existía en BUK y el worker la resolvía como `reused_incomplete_existing`;
  - BUK respondía `Empleado Ya existe un plan para este Empleado`;
  - como `sync-buk-candidates` no recuperaba bien la colección de planes existente, el job moría en `error` antes de crear/reparar el trabajo, por eso la ficha quedaba `inactivo`, sin `current_job`, y el bucket la seguía mostrando pendiente.
- La corrección quedó concentrada en [`sync-buk-candidates/index.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1):
  - agrega un parser reutilizable de colecciones BUK para tolerar respuestas con arrays en `data`, `plans`, `jobs`, `items` o `results`;
  - reaprovecha ese parser en lookups de empleados, roles, planes y jobs;
  - cuando `createBukEmployeePlan(...)` devuelve el duplicado `ya existe un plan`, reconsulta planes y degrada de forma segura a “plan existente recuperado” en vez de abortar el flujo completo.
- El runtime quedó desplegado en el proyecto remoto `pzblmbahnoyntrhistea` con `npx --yes supabase functions deploy sync-buk-candidates --project-ref pzblmbahnoyntrhistea --use-api --yes`.
- Validación cerrada con:
  - evidencia remota vía Supabase sobre `candidate_profiles`, `recruitment_case_candidates` y `buk_sync_jobs` de los tres candidatos afectados;
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`
- Limitación de esta sesión:
  - este shell no tiene `deno`, así que no pude correr `deno check` del worker;
  - tampoco tengo un JWT interactivo vigente ni el secreto interno del webhook BUK en esta terminal, así que no pude disparar desde shell el reproceso real de esos jobs después del deploy. El próximo `Generar en BUK` desde la UI ya correrá con el worker corregido.

## Hotfix de avance de etapa a listo para contratar

- [x] Auditar el error `42703` al mover candidatos a `ready_for_hire` y confirmar si proviene del frontend o del trigger backend asociado
- [x] Versionar una migración correctiva mínima que recomponga `enqueue_personnel_to_hire_email(...)` reutilizando el patrón vigente para notificaciones de contratación
- [x] Revalidar con auditoría de migración, compilación relevante, `git diff --check` y dejar documentado el resultado antes de cerrar

## Resultado de hotfix de avance de etapa a listo para contratar

- La causa raíz quedó en backend, no en el modal. Al mover un candidato a `ready_for_hire`, el trigger `trg_recruitment_case_candidates_ready_for_buk_email_dispatch()` ejecutaba `enqueue_personnel_to_hire_email(...)`, función introducida en [`20260703070000_add_personnel_to_hire_notifications_and_access_alignment.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703070000_add_personnel_to_hire_notifications_and_access_alignment.sql:78) que volvía a leer `hr.request_context` y `hr.module_label` desde `public.hiring_requests`, columnas inexistentes en contratación.
- La corrección quedó versionada en [`20260707153816_fix_personnel_to_hire_notification_missing_request_context.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260707153816_fix_personnel_to_hire_notification_missing_request_context.sql:1), recompilando solo `public.enqueue_personnel_to_hire_email(...)` y reutilizando el patrón ya usado en otras notificaciones del módulo:
  - elimina las columnas inexistentes del `select`;
  - conserva intactos destinatarios, `event_key`, trigger y ruta funcional;
  - fija `request_context = 'hiring'` y `module_label = 'Contratación'` en el payload del correo, que es la semántica correcta para este flujo.
- La migración quedó aplicada también en el proyecto remoto enlazado con `npx --yes supabase db push --linked --include-all`, por lo que el error productivo `42703` ya no debería reaparecer al avanzar a `Listo para contratar`.
- Validación cerrada con:
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npm run audit:migrations -- --files supabase/migrations/20260707153816_fix_personnel_to_hire_notification_missing_request_context.sql`
  - `git diff --check`
  - `npx --yes supabase db push --linked --dry-run`
  - `npx --yes supabase db push --linked --include-all`

## Hotfix de tarjetas vacías en folios en curso

- [x] Auditar por qué los KPIs del widget `Folios en curso` quedan en `0` aunque existan datos visibles en la tabla
- [x] Corregir el fallback frontend para que no trate un `summary` ausente como un resumen válido de ceros
- [x] Aplicar la migración remota necesaria para que producción entregue el `summary` filtrado real del RPC
- [x] Revalidar con `TypeScript`, build frontend, auditoría de migración, `git diff --check` y comprobación remota de migraciones; luego documentar el resultado

## Resultado de hotfix de tarjetas vacías en folios en curso

- La causa raíz quedó partida en dos:
  - el frontend estaba convirtiendo `summary` ausente en un objeto válido lleno de ceros dentro de [`hiringControl.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:1), por lo que [`ActiveFoliosWidget.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/ActiveFoliosWidget.tsx:1) nunca caía al fallback;
  - en remoto todavía no estaban aplicadas las migraciones [`20260707130500_restore_admin_override_for_hiring_approval_v2.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260707130500_restore_admin_override_for_hiring_approval_v2.sql:1), [`20260707133000_harden_recruitment_personnel_helpers_and_buk_payload.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260707133000_harden_recruitment_personnel_helpers_and_buk_payload.sql:1) y [`20260707145531_add_filtered_recruitment_dashboard_summary.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260707145531_add_filtered_recruitment_dashboard_summary.sql:1), así que producción seguía expuesta al contrato viejo sin `summary`.
- La corrección frontend quedó en dos capas:
  - [`parseRecruitmentProcessesPagePayload(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:469) ahora deja `summary = null` cuando el payload no lo trae realmente;
  - [`ActiveFoliosWidget.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/ActiveFoliosWidget.tsx:1) ahora degrada de forma segura a:
    - resumen global del dashboard cuando no hay filtro y el RPC aún no expone `summary`;
    - resumen calculado desde los folios visibles cuando sí hay filtro y el backend todavía no responde el bloque agregado.
- La corrección remota quedó aplicada con `npx --yes supabase db push --linked --include-all`, publicando en el proyecto remoto las tres migraciones pendientes.
- Validación cerrada con:
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npm run audit:migrations -- --files supabase/migrations/20260707130500_restore_admin_override_for_hiring_approval_v2.sql supabase/migrations/20260707133000_harden_recruitment_personnel_helpers_and_buk_payload.sql supabase/migrations/20260707145531_add_filtered_recruitment_dashboard_summary.sql`
  - `npx --yes supabase db push --linked --dry-run`
  - `npx --yes supabase db push --linked --include-all`
  - `git diff --check`

## Auditoría y versionado de cambios pendientes del worktree

- [x] Auditar todos los cambios pendientes de frontend, Edge Function y migraciones para verificar que sigan alineados con el contrato actual del repositorio
- [x] Corregir cualquier drift o riesgo de despliegue detectado antes de versionar
- [x] Revalidar con `TypeScript`, build frontend, auditoría de migraciones, auditoría de seguridad Supabase y `git diff --check`
- [x] Versionar únicamente después de cerrar los hallazgos y empujar el resultado a `main`

## Resultado de auditoría y versionado de cambios pendientes del worktree

- El paquete pendiente quedó auditado y aprobado para `main` en tres grupos:
  - frontend de reclutamiento/operaciones: [`CandidateIntakeForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateIntakeForm.tsx:1), [`TransferCandidateModal.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/TransferCandidateModal.tsx:1), [`HiringProcessesView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringProcessesView.tsx:1), [`HiringStatusPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringStatusPage.tsx:1), [`DatePickerField.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/forms/DatePickerField.tsx:1), [`OperationsBaseRegister.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/components/OperationsBaseRegister.tsx:1) y [`HiringRequestPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringRequestPage.tsx:1);
  - endurecimiento backend/BUK: [`check_buk_candidate/index.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/check_buk_candidate/index.ts:1) y las migraciones [`20260707130500_restore_admin_override_for_hiring_approval_v2.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260707130500_restore_admin_override_for_hiring_approval_v2.sql:1) y [`20260707133000_harden_recruitment_personnel_helpers_and_buk_payload.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260707133000_harden_recruitment_personnel_helpers_and_buk_payload.sql:1);
  - reparación auditada WHO de Rodolfo: [`20260703170500_repair_rodolfo_who_rejection_to_approved.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703170500_repair_rodolfo_who_rejection_to_approved.sql:1), [`20260703171200_normalize_rodolfo_who_repair_timeline.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703171200_normalize_rodolfo_who_repair_timeline.sql:1) y [`20260703171800_align_rodolfo_who_repair_audit_payload.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703171800_align_rodolfo_who_repair_audit_payload.sql:1).
- Hallazgo corregido durante la auditoría:
  - las tres migraciones de reparación WHO estaban demasiado acopladas al caso productivo puntual y podían fallar al correr en otro entorno o sobre snapshots ya reparados;
  - se endurecieron para que mantengan la validación estricta en el caso objetivo, pero hagan `raise notice` y `no-op` si el candidato o la aprobación objetivo no existen o ya quedaron corregidos.
- Validación cerrada con:
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npm run audit:migrations -- --files supabase/migrations/20260703170500_repair_rodolfo_who_rejection_to_approved.sql supabase/migrations/20260703171200_normalize_rodolfo_who_repair_timeline.sql supabase/migrations/20260703171800_align_rodolfo_who_repair_audit_payload.sql supabase/migrations/20260707130500_restore_admin_override_for_hiring_approval_v2.sql supabase/migrations/20260707133000_harden_recruitment_personnel_helpers_and_buk_payload.sql`
  - `npm run audit:supabase-security`
  - `git diff --check`

## Dashboard de folios en curso con KPIs filtrados y búsqueda por gerencia

- [x] Auditar el contrato actual entre `ActiveFoliosWidget`, `useRecruitmentProcessesPage(...)` y `get_recruitment_processes_page(...)` para unificar tabla y tarjetas sobre la misma fuente filtrada
- [x] Versionar una migración que agregue al RPC el resumen filtrado del set visible, habilite búsqueda por gerencia y preserve el contrato actual de filas sin romper producción
- [x] Ajustar el widget para consumir el resumen dinámico, agregar la tarjeta de requerimiento total y reflejar explícitamente los contratados dentro de los indicadores del folio
- [x] Revalidar con `TypeScript`, build frontend, auditoría de migración y `git diff --check`; luego documentar el resultado en este archivo

## Resultado de dashboard de folios en curso con KPIs filtrados y búsqueda por gerencia

- La migración [`20260707145531_add_filtered_recruitment_dashboard_summary.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260707145531_add_filtered_recruitment_dashboard_summary.sql:1) recompila [`get_recruitment_processes_page(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260707145531_add_filtered_recruitment_dashboard_summary.sql:3) para que el mismo RPC devuelva:
  - `items` paginados como hasta ahora;
  - `summary` filtrado sobre el mismo CTE `filtered`, con `activeCases`, `requestedVacancies`, `inProgressCandidates`, `readyToHireCases`, `filledCases` y `hiredCandidates`;
  - búsqueda por gerencia reutilizando `hiring_requests.cost_unit` y `hiring_requests.cost_unit_name` dentro del `search_haystack`;
  - soporte efectivo de orden por `opened_at`, que la UI ya intentaba usar.
- [`hiringControl.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:1) quedó alineado para tipar y normalizar ese `summary` nuevo sin romper las otras páginas paginadas que siguen usando `items` y `totalCount`.
- [`ActiveFoliosWidget.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/ActiveFoliosWidget.tsx:1) ahora:
  - hace dinámicas las tarjetas según el filtro de búsqueda activo;
  - agrega la tarjeta `Requerimiento total`;
  - amplía el placeholder para incluir búsqueda por gerencia;
  - muestra una cápsula adicional de `Contrat.` para reflejar contrataciones efectivas y deja `filled_vacancies/requested_vacancies` explícito como cupos cubiertos/requeridos.
- [`dashboard.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/styles/dashboard.css:1) y [`global.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/styles/global.css:1) ajustan el layout de cinco KPIs y el nuevo tono visual de contratados sin alterar el resto del dashboard.
- Validación cerrada con:
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npm run audit:migrations -- --files supabase/migrations/20260707145531_add_filtered_recruitment_dashboard_summary.sql`
  - `git diff --check`

## Reparación auditada de rechazo WHO erróneo para Rodolfo Francisco González Ortiz

- [x] Auditar el estado productivo del candidato, la aprobación WHO rechazada y el actor que debe quedar como aprobador final
- [x] Versionar una reparación SQL que reactive la candidatura sin borrar la evidencia del rechazo original y la deje nuevamente en `who_approved`
- [x] Aplicar la migración remota, verificar el estado final del candidato y documentar la lección operativa

## Hotfix crítico de contratación efectiva BUK con plan, trabajo y sueldo base manual

- [x] Verificar en producción por qué candidatos como Dayana Prevot quedaban creados en BUK pero sin información previsional efectiva ni trabajo asociado
- [x] Corregir `sync-buk-candidates` para que, además del alta del empleado, cree o repare el plan previsional y el trabajo en BUK antes de cerrar el job como `success`
- [x] Ajustar la renta base del trabajo BUK a `0` para que remuneraciones la complete manualmente, sin reutilizar el líquido ERP como sueldo base
- [x] Reparar en producción los empleados ya cargados de forma incompleta o con sueldo base incorrecto

## Resultado de hotfix crítico de contratación efectiva BUK con plan, trabajo y sueldo base manual

- La causa raíz quedó confirmada en producción: el worker BUK estaba cerrando `success` después de `POST /employees` y upload documental, pero nunca creaba el `plan` ni el `job` reales en BUK; por eso los colaboradores quedaban `inactivos`, sin previsión visible y sin centro de costo/trabajo asignado.
- La corrección quedó concentrada en [`sync-buk-candidates/index.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1):
  - ahora resuelve el contexto operativo del contrato (`area`, `company`, `leader`, `role`) antes de cerrar el job;
  - crea o repara `plans` y `jobs` en BUK para altas nuevas y para reintentos sobre fichas incompletas ya creadas;
  - deja `wage = 0` en el trabajo BUK para que remuneraciones complete manualmente el sueldo base, en vez de mapear el líquido ERP como renta base;
  - registra en `result_snapshot` el request/response del plan y del trabajo, además de la resolución usada sobre la ficha.
- La reparación productiva inmediata quedó validada sobre los casos ya afectados:
  - `41872` Dayana Carolina Prevot Santander quedó `activo`, con previsión `fonasa / afp / afc normal`, trabajo `CONDUCTOR DE TAXI BUS`, `company_id = 1`, `area_id = 406`, `cost_center = 108` y `base_wage = 0`;
  - `41870` Víctor Antonio Muñoz Palma quedó `activo`, con trabajo `CONDUCTOR DE BUS`, `cost_center = 555` y `base_wage = 0`;
  - `41871` Natalia Ortiz Casupa quedó `activa`, con trabajo `SECRETARIO TECNICO`, `company_id = 4`, `area_id = 405` y `base_wage = 0`;
  - `41873` Sebastián Ignacio Leiva Muñoz quedó `activo`, con previsión `consalud`, trabajo `COORDINADOR DE SERVICIOS`, `company_id = 5`, `area_id = 736` y `base_wage = 0`;
  - también se corrigió a `base_wage = 0` en `41874` Julio Nicolás Mancilla Flores y `41739` Luis Antonio Gutierrez Pizarro, que ya estaban activos pero con la renta base mal cargada.
- Validación cerrada con:
  - despliegue productivo de `sync-buk-candidates` vía `npx --yes supabase functions deploy sync-buk-candidates --use-api --yes`
  - verificación directa por API BUK sobre los empleados reparados (`GET /employees/{id}`), confirmando `status = activo`, previsión visible y `current_job` presente con `base_wage = 0`

## Resultado de reparación auditada de rechazo WHO erróneo para Rodolfo Francisco González Ortiz

- La reparación quedó dividida en tres migraciones versionadas para mantener mínima superficie por cambio:
  - [`20260703170500_repair_rodolfo_who_rejection_to_approved.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703170500_repair_rodolfo_who_rejection_to_approved.sql:1) reactiva la candidatura terminal, crea una nueva resolución WHO y la aprueba a nombre de `Maximiliano Contreras Rey` sin pisar la aprobación rechazada original.
  - [`20260703171200_normalize_rodolfo_who_repair_timeline.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703171200_normalize_rodolfo_who_repair_timeline.sql:1) ordena en milisegundos la cronología `rejected -> lead -> who_pending -> who_approved` para que historial y auditoría no queden ambiguos por timestamps idénticos.
  - [`20260703171800_align_rodolfo_who_repair_audit_payload.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703171800_align_rodolfo_who_repair_audit_payload.sql:1) alinea el `approved_at` del audit log con la fila aprobada final.
- Estado productivo verificado después del despliegue:
  - candidato `ef4064a2-d076-4258-9691-2d270e3c7d0b` quedó en `stage_code = who_approved`;
  - la aprobación WHO original `id = 80` sigue en `status = rejected` con comentario `riesgo de demanda`;
  - la nueva aprobación correctiva `id = 84` quedó en `status = approved`, `approved_by = 0de4ef6f-3e52-4bab-8042-ab04ea7763ae` y comentario `Corrección auditada de rechazo WHO emitido por error. Antecedentes aprobados.`;
  - el historial quedó ordenado como `who_rejected` -> `candidate_reactivated_who_correction` -> `who_requested_repair` -> `who_approved`.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260703170500_repair_rodolfo_who_rejection_to_approved.sql`
  - `npm run audit:migrations -- --files supabase/migrations/20260703171200_normalize_rodolfo_who_repair_timeline.sql`
  - `npm run audit:migrations -- --files supabase/migrations/20260703171800_align_rodolfo_who_repair_audit_payload.sql`
  - `git diff --check`
  - `npx --yes supabase db push --linked --include-all`
  - verificación remota con `candidate_stage_approvals`, `recruitment_case_candidate_stage_history` y `recruitment_case_audit_log` sobre el candidato reparado

## Hotfix crítico de timeout aparente en generación masiva BUK

- [x] Auditar si el error masivo `Edge Function returned a non-2xx status code` correspondía a fallo real o a timeout del request mientras la cola seguía procesando
- [x] Corregir la conciliación frontend/backend para que la UI lea el estado real de `buk_sync_jobs` cuando la invocación larga corta por tiempo
- [x] Validar la migración remota, la compilación y el caso real de carga masiva antes de versionar en `main`

## Corrección enterprise de duplicados activos BUK y correlativo de ficha histórica

- [x] Definir y versionar la salida canónica cuando la creación en BUK falla porque el trabajador ya existe activo: cancelar la pedida ERP de forma auditable en vez de marcar contratación exitosa
- [x] Corregir el worker `sync-buk-candidates` para que use `suggested_employee_code` y clone fichas históricas con el correlativo siguiente (`F2`, `F3`, ...) en vez de reutilizar `F1`
- [x] Validar localmente y aplicar la reparación remota sobre Mario Roberto Pizarro Fernández; además confirmar que José Patricio Méndez Díaz ya sale con `suggested_employee_code = F2` en el payload vivo del job

## Resultado de corrección enterprise de duplicados activos BUK y correlativo de ficha histórica

- La raíz del problema quedó partida en dos:
  - el worker BUK ya resolvía el duplicado de identidad, pero seguía tratando al trabajador activo en BUK como “éxito reutilizable”, lo que dejaba al candidato en `hired` y al folio vivo aunque la contratación ya existía fuera del ERP;
  - la ficha histórica seguía expuesta al riesgo de reutilizar `candidate_worker_files.employee_code = F1` si el worker no respetaba el `suggested_employee_code` calculado por backend.
- La reparación productiva quedó en tres capas versionadas:
  - [`20260703153711_handle_active_buk_duplicates_and_preserve_next_sheet_code.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703153711_handle_active_buk_duplicates_and_preserve_next_sheet_code.sql:1) introduce la finalización canónica `finalize_buk_sync_job_existing_active_employee(...)` para convertir el duplicado activo en anulación ERP auditada;
  - [`20260703154216_fix_internal_active_buk_duplicate_cleanup_queue.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703154216_fix_internal_active_buk_duplicate_cleanup_queue.sql:1) y [`20260703154427_fix_active_buk_duplicate_cleanup_conflict_guard.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703154427_fix_active_buk_duplicate_cleanup_conflict_guard.sql:1) endurecen esa RPC para que su cola documental interna no dependa de `auth.uid()` ni de un `on conflict` ambiguo;
  - [`sync-buk-candidates/index.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1) ahora respeta `suggested_employee_code`, clona fichas históricas con el correlativo siguiente y deriva el duplicado activo a la nueva finalización ERP en vez de procesarlo como alta estándar.
- La verificación remota cerrada sobre Mario Roberto Pizarro Fernández fue concluyente:
  - job `a9601a88-f672-4fac-9ae7-ca8eac35a6cc` quedó `success` con `buk_employee_id = 41804` y snapshot `erpAction = cancel_request_existing_active_buk_employee`;
  - candidato `30679184-d1a5-4bdd-a9c8-ff0895001f2d` pasó de `hired` a `withdrawn` con motivo explícito;
  - caso `RC-0038` quedó `cancelled` con `filled_vacancies = 0`;
  - solicitud `0038` quedó `closed`;
  - la purga documental terminal quedó encolada en `candidate_document_cleanup_jobs`.
- Sobre José Patricio Méndez Díaz, la validación backend relevante también quedó confirmada:
  - el payload autorizado del job `7309322a-8937-465c-8148-e9be39e28b2a` ya contiene `profile.suggested_employee_code = F2` mientras `worker_file.employee_code` sigue en `F1`;
  - eso prueba que el source of truth correcto para la nueva ficha ya está saliendo del ERP y que el worker corregido tomará el correlativo calculado por backend en vez de reutilizar `F1`.

## Resultado de hotfix crítico de timeout aparente en generación masiva BUK

- La causa raíz no era un fallo real de la cola BUK, sino una desalineación entre transporte HTTP y estado canónico del job. La carga masiva real de Angélica creó 6 jobs a las `15:05:43` UTC y todos partieron a las `15:05:45` UTC, pero la última respuesta terminó recién a las `15:08:23` UTC. En ese intervalo, la UI seguía dependiendo del resultado completo de `supabase.functions.invoke("sync-buk-candidates")`, por eso mostró `Edge Function returned a non-2xx status code` aunque la cola ya estaba avanzando.
- La evidencia remota del caso real fue concluyente:
  - `4` jobs terminaron en `success` con `buk_employee_id` válido (`41871`, `41872`, `41873`, `41874`);
  - `2` jobs terminaron en `error` con rechazo real de BUK por duplicidad de `rut/email`;
  - ninguno quedó bloqueado en `pending`, por lo que el mensaje anterior era un falso negativo del transporte.
- La corrección quedó en dos capas:
  - la migración [`20260703151109_reconcile_bulk_buk_sync_timeout_with_queue_status.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703151109_reconcile_bulk_buk_sync_timeout_with_queue_status.sql:1) agrega `public.get_buk_sync_jobs_status(...)`, una RPC auth-bound que permite al frontend leer el estado real de jobs visibles para RRHH administrativo;
  - [`generateCandidatesInBuk(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:1) ahora, ante un corte de la invocación larga, consulta esa RPC y reconcilia la cola real antes de declarar error;
  - [`HiringPersonnelToHireView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringPersonnelToHireView.tsx:1) ahora informa resultados mixtos y procesamiento en segundo plano sin degradar todo a un único mensaje genérico.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260703151109_reconcile_bulk_buk_sync_timeout_with_queue_status.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`
  - `npx --yes supabase db push --linked --include-all`
  - verificación remota auth-bound de `public.get_buk_sync_jobs_status(...)` sobre los 6 jobs reales de Angélica, confirmando retorno `success/error` coherente con lo ocurrido en BUK

## Control enterprise de carpeta Postulación para documentos BUK

- [x] Auditar el contrato vivo del endpoint `POST /employees/{id}/docs` en BUK y confirmar si existe soporte real de carpeta/ruta documental
- [x] Ajustar el helper de upload BUK para enviar los documentos ERP a la carpeta `Postulación` sin romper la carga actual
- [x] Dejar trazabilidad del folder devuelto por BUK y documentar el cambio antes de cerrar

## Resultado de control enterprise de carpeta Postulación para documentos BUK

- La viabilidad quedó confirmada contra el `apidocs` del tenant BUK. El endpoint `POST /employees/{id}/docs` soporta el query param `path`, descrito como “Ruta donde se guardará el archivo. Si se deja en blanco se creará en la carpeta raíz del empleado. Ejemplo: `personales/seguridad`”.
- El problema en nuestro runtime era puramente contractual: [`uploadBukDocument(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/_shared/bukDocuments.ts:1) subía `file` o `file_base64` más `name`, pero nunca enviaba `path`, por eso BUK dejaba todos los archivos en la carpeta general del trabajador.
- La corrección quedó implementada en dos puntos:
  - [`bukDocuments.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/_shared/bukDocuments.ts:1) ahora agrega `path` al URL de upload usando `BUK_EMPLOYEE_DOCUMENTS_PATH` y, si no existe configuración explícita, usa por defecto `Postulación`;
  - [`sync-buk-candidates/index.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1) ahora persiste también `bukEmployeeFolderId` en `result_snapshot.documents` para dejar evidencia del folder real devuelto por BUK.
- El diseño quedó deliberadamente configurable:
  - default operativo: `Postulación`;
  - override opcional: `BUK_EMPLOYEE_DOCUMENTS_PATH`;
  - escape hatch: si esa env existe pero viene vacía, el helper no fuerza `path` y BUK vuelve a usar la carpeta raíz.

## Hotfix crítico de autorización de jobs BUK para Administrativo

- [x] Auditar el error `Edge Function returned a non-2xx status code` distinguiendo si el job quedaba encolado, tomado por el worker o bloqueado antes del `claim`
- [x] Corregir la autorización de `sync-buk-candidates` para que `administrativo` valide jobs desde el helper operativo de `Personal a Contratar`, no desde el permiso legacy de gestión completa del caso
- [x] Validar el fix en remoto reprocesando el job pendiente real y documentar el cierre antes de versionar

## Resultado de hotfix crítico de autorización de jobs BUK para Administrativo

- La causa raíz no estaba en la cola ni en la ficha del candidato. El job real de Angélica (`d51fe0e7-dbc1-4d55-a9d9-846820884d92`) sí se encoló correctamente en `public.buk_sync_jobs`, pero quedó en `status = pending` con `started_at = null`, lo que prueba que el worker fallaba antes de tomar el job.
- El punto exacto del fallo estaba en la Edge Function [`sync-buk-candidates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:785): antes de `claimJobs(...)` ejecuta `authorize_buk_sync_jobs(...)`, y esa función en producción seguía usando `public.user_can_manage_recruitment_case(...)`.
- Para Angélica el estado real era inconsistente:
  - `public.user_can_generate_buk_candidates(...) = true`;
  - `public.user_can_manage_recruitment_case(...) = false`;
  - `public.user_can_manage_recruitment_personnel_candidate(...) = true`;
  - por eso la UI podía encolar desde `Personal a Contratar`, pero la invocación inmediata de la Edge Function devolvía no-2xx y dejaba el job sin procesar.
- La corrección quedó versionada en [`20260703145135_fix_buk_job_authorization_for_personnel_roles.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703145135_fix_buk_job_authorization_for_personnel_roles.sql:1), recompilando `authorize_buk_sync_jobs(...)` para aceptar jobs visibles por:
  - `user_can_manage_recruitment_case(...)`, o
  - `user_can_manage_recruitment_personnel_candidate(...)`.
- Verificación remota cerrada:
  - antes del fix, `public.authorize_buk_sync_jobs('eefcf398-5d20-47b9-af89-afedfdce0ef2', ['d51fe0e7-dbc1-4d55-a9d9-846820884d92']) = false`;
  - después del fix, la misma consulta devuelve `true`;
  - la migración quedó aplicada en el proyecto remoto con `npx --yes supabase db push --linked --include-all`.
- Limitación de esta sesión:
  - no tengo en este shell una sesión JWT reutilizable de Angélica ni el valor del secreto interno `BUK_SYNC_INTERNAL_WEBHOOK_SECRET`, así que no pude disparar desde terminal el HTTP real del worker para consumir ese job pendiente;
  - con la autorización ya corregida en producción, el siguiente click en `Generar en BUK` o cualquier reproceso seguro del job ya no debería chocar con el no-2xx por permisos.

## Hotfix enterprise de generación BUK para Administrativo en Personal a Contratar

- [x] Auditar el error de Angélica Calderón reproduciendo la cadena `Personal a Contratar -> detalle de caso -> generar en BUK` y confirmar qué RPCs siguen exigiendo permisos o etapas legacy
- [x] Corregir el acceso al detalle operativo del caso para que `administrativo` y `jefe_administrativo` puedan ver el subflujo BUK de candidatos pendientes sin recuperar la pestaña `Control de candidatos`
- [x] Alinear la generación BUK con el bucket pendiente real, permitiendo candidatos en `ready_for_hire` o `hired` siempre que aún no exista sync BUK exitosa
- [x] Validar SQL, TypeScript, despliegue remoto y documentar el cierre antes de versionar en `main`

## Resultado de hotfix enterprise de generación BUK para Administrativo en Personal a Contratar

- La causa raíz quedó en dos drift backend distintos que seguían activos después del hotfix anterior:
  - [`get_recruitment_case_detail(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703142845_fix_admin_buk_generation_personnel_access.sql:1) todavía arrancaba exigiendo `user_can_view_recruitment_process_summary(...)`, helper que excluye a `administrativo`; por eso Angélica veía `Sin permisos para ver este proceso de contratación` aunque sí tenía acceso al bucket `Personal a Contratar`.
  - [`get_candidate_buk_sync_payload(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703143352_fix_buk_sync_payload_document_contract_for_admin_generation.sql:1) seguía bloqueando todo lo que no estuviera en `stage_code = ready_for_hire`, aunque el bucket productivo ya agrupa pendientes BUK tanto en `ready_for_hire` como en `hired` mientras no exista sync exitosa.
- La reparación quedó versionada en dos migraciones complementarias:
  - [`20260703142845_fix_admin_buk_generation_personnel_access.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703142845_fix_admin_buk_generation_personnel_access.sql:1) recompila `get_recruitment_case_detail(...)` para aceptar cualquiera de estas fronteras válidas: resumen, control de candidatos o acceso operativo de personal pendiente BUK.
  - [`20260703143352_fix_buk_sync_payload_document_contract_for_admin_generation.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703143352_fix_buk_sync_payload_document_contract_for_admin_generation.sql:1) alinea la generación con el bucket real y restaura el contrato documental que consume el worker BUK (`document_type_id`, `document_name`, `file_path`, `status`, `expiry_date`).
- La verificación remota sobre producción quedó cerrada contra la cuenta real `angelica.calderon@busesjm.com`:
  - `user_can_view_recruitment_process_summary(...) = false`, lo que confirma que no reabrimos el resumen general ni `Control de candidatos`;
  - `get_recruitment_case_detail('RC-2108')` ya devuelve el caso y `1` candidato para el flujo operativo;
  - `get_candidate_buk_sync_payload(...)` ya construye correctamente el payload del candidato `RC-2108` aun estando en `stage_code = hired`, porque sigue pendiente de generación BUK efectiva.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260703142845_fix_admin_buk_generation_personnel_access.sql supabase/migrations/20260703143352_fix_buk_sync_payload_document_contract_for_admin_generation.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`
  - `npx --yes supabase migration list --linked`, confirmando aplicadas `20260703142845` y `20260703143352`

## Corrección enterprise de empresa destino DSAL en Movilidad Interna

- [x] Auditar la fuente canónica que resuelve `company_name` para `CODELCO - DSAL` y reproducir el desvío en producción entre `buk_contract_mappings`, contrato destino y solicitudes de movilidad
- [x] Corregir el helper y el mapping persistido para que `6170400011:0001 / CODELCO - DSAL` resuelva `Consorcio Andino SPA` en vez de `Buses JM Pullman S.A.`
- [x] Reparar las solicitudes de movilidad interna ya afectadas por el dato incorrecto y validar que ya no exijan cambio de empresa si el origen también es `Consorcio Andino SPA`
- [x] Validar auditoría SQL, tipado, despliegue remoto y documentar el cierre antes de versionar en `main`

## Resultado de corrección enterprise de empresa destino DSAL en Movilidad Interna

- La causa raíz estaba en el contrato canónico de empresa para movilidad interna. `CODELCO - DSAL` fue sembrado como mapping operativo válido (`6170400011:0001`), pero al no tener `company_name` explícita terminó heredando el fallback genérico `:0001 => Buses JM Pullman S.A.`, aunque el contrato en BUK corresponde a `Consorcio Andino SPA`.
- La reparación quedó versionada en [`20260703134355_fix_dsal_company_mapping_consorcio_andino.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703134355_fix_dsal_company_mapping_consorcio_andino.sql:1), que:
  - endurece `resolve_known_company_name(...)` con la excepción explícita de `6170400011:0001`;
  - corrige la fila persistida de `public.buk_contract_mappings` para `CODELCO - DSAL`;
  - backfillea `public.internal_mobility_requests` afectados y su snapshot persistido para alinear `destination_company_name` y `requires_termination`.
- La verificación remota sobre producción confirmó el cierre del caso:
  - la fila `buk_contract_mappings.id = 94` quedó con `company_name = Consorcio Andino SPA` y `updated_at = 2026-07-03 13:47:05+00`;
  - la movilidad `MI-0038`, creada el `2026-07-01`, quedó con `current_company_name = Consorcio Andino SPA`, `destination_company_name = Consorcio Andino SPA` y `requires_termination = false`;
  - el snapshot `submitted` del mismo request también quedó corregido para no dejar mensajes contradictorios dentro del caso.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260703134355_fix_dsal_company_mapping_consorcio_andino.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`
  - `npx --yes supabase db push --linked --include-all`
  - `npx --yes supabase migration list --linked`, confirmando aplicada `20260703134355_fix_dsal_company_mapping_consorcio_andino`

## Hotfix de acceso operativo para Administrativo en Personal a Contratar

- [x] Auditar y corregir la mezcla entre `candidate_control_access` y el subflujo operativo de `Personal a Contratar`, para que `administrativo`/`jefe_administrativo` puedan ver y operar solo los candidatos en buckets BUK sin recuperar visibilidad sobre `Control de candidatos`
- [x] Retirar la capability heredada `candidate_control_access` de `administrativo`/`jefe_administrativo`, aislar un helper backend específico para personal listo/contratado y alinear `get_recruitment_personnel_page_bucket(...)`, `get_recruitment_case_detail(...)` y la ficha/checklist BUK
- [x] Validar compilación, auditoría SQL, despliegue remoto y cerrar la incidencia de Angélica Calderón con evidencia auditable antes de versionar

## Resultado de hotfix de acceso operativo para Administrativo en Personal a Contratar

- La causa raíz no estaba en la cuenta de Angélica Calderón sino en la frontera de permisos. El despliegue previo había dejado dos drift simultáneos:
  - `administrativo` y `jefe_administrativo` seguían heredando `candidate_control_access`, por eso todavía podían ver `Control de candidatos` en builds que usaban capability;
  - las RPCs de `Personal a Contratar` seguían colgando de `candidate_control_access` y de `user_can_view_recruitment_case(...)`, helper que excluye a esos roles, por eso Angélica veía la pestaña pero quedaba sin candidatos.
- La corrección quedó versionada en [`20260703132143_hotfix_personnel_access_without_candidate_control.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703132143_hotfix_personnel_access_without_candidate_control.sql:1), que:
  - crea helpers específicos para el subflujo de personal listo/contratado (`user_can_access_recruitment_personnel(...)` y `user_can_manage_recruitment_personnel_candidate(...)`);
  - retira `candidate_control_access` de `administrativo` y `jefe_administrativo`;
  - recompila la lista de buckets, el detalle de caso, ficha BUK, checklist documental, edición de ficha/licencia/notas, carga/revisión documental y cola BUK para usar el helper operativo correcto sin reabrir `Control de candidatos`.
- La verificación remota confirmó el estado esperado:
  - `candidate_control_access` quedó solo en `reclutamiento` para este módulo;
  - `administrativo` y `jefe_administrativo` mantienen `recruitment_personnel_to_hire` pero no `recruitment_candidate_control`;
  - la cuenta `angelica.calderon@busesjm.com` sigue activa;
  - producción mantiene `7` candidatos pendientes de generación BUK y `1` ya contratado en BUK, así que `Personal a Contratar` vuelve a tener datos reales para mostrar.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260703132143_hotfix_personnel_access_without_candidate_control.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`
  - `npx --yes supabase db push --linked --include-all`

## Control enterprise de Personal a Contratar, Personal contratado y payload previsional BUK

- [x] Auditar y corregir la frontera de negocio entre `ready_for_hire`, generación en BUK y `hired`, para que la gestión manual deje de usar la etapa Contratado y el éxito real en BUK mueva al candidato a Personal contratado
- [x] Restringir la generación en BUK y la exportación de nómina a los roles `administrativo` y `jefe_administrativo`, manteniendo la visibilidad de la pestaña para `reclutamiento`
- [x] Endurecer la ficha previsional BUK para que Fonasa autocomplemente 7% y que Isapre exija `Plan Isapre UF`, reflejando la regla tanto en UI como en backend/payload de sincronización
- [x] Agregar la nueva pestaña `Personal contratado`, retirar de `Personal a Contratar` a quienes ya fueron cargados en BUK y validar compilación/auditoría antes de versionar

## Control enterprise de tabs y notificaciones de Personal a Contratar

- [x] Auditar y corregir la matriz de acceso para que `reclutamiento` conserve todas las pestañas y `administrativo`/`jefe_administrativo` queden limitados a Resumen, Personal a Contratar, Personal contratado y Movilidad Interna, sin deriva por capabilities heredadas
- [x] Disparar un correo transaccional al entrar un candidato a `ready_for_hire` dirigido a todos los usuarios activos con rol `administrativo` y `jefe_administrativo`
- [x] Programar recordatorios cada 24 horas mientras el candidato siga pendiente de generación efectiva en BUK y validar SQL, TypeScript y diffs antes de cerrar

## Resultado de control enterprise de tabs y notificaciones de Personal a Contratar

- La visibilidad de tabs quedó corregida sobre la capa de features y la UI viva en [`HiringStatusPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringStatusPage.tsx:1):
  - `reclutamiento` conserva acceso a todas las pestañas;
  - `administrativo` y `jefe_administrativo` ya no ven `Control de candidatos`;
  - mantienen `Resumen de procesos de contratación`, `Personal a Contratar`, `Personal contratado` y `Movilidad Interna`.
- La migración [`20260703070000_add_personnel_to_hire_notifications_and_access_alignment.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703070000_add_personnel_to_hire_notifications_and_access_alignment.sql:1) dejó operativo el flujo transaccional para `Personal a Contratar`:
  - al entrar un candidato a `ready_for_hire`, se encola un correo a todos los perfiles activos con rol `administrativo` y `jefe_administrativo`;
  - si pasan 24 horas sin `buk_sync_jobs.status = success` con `buk_employee_id` válido, el cron horario vuelve a emitir recordatorio;
  - el estado de aviso queda auditado en `recruitment_case_candidates.ready_for_buk_notified_at` y `ready_for_buk_last_reminder_sent_at`.
- La edge function [`hiring-transactional-email`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/hiring-transactional-email/index.ts:1) ahora soporta el nuevo evento `personnel_to_hire`, con asunto diferenciado para aviso inicial y recordatorio.
- Validación y despliegue cerrados con:
  - `npm run audit:migrations -- --files supabase/migrations/20260703070000_add_personnel_to_hire_notifications_and_access_alignment.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`
  - `npx --yes supabase db push --linked --include-all`
  - `npx --yes supabase migration list --linked`, confirmando aplicada `20260703070000_add_personnel_to_hire_notifications_and_access_alignment`
  - `npx --yes supabase functions deploy hiring-transactional-email --project-ref pzblmbahnoyntrhistea --no-verify-jwt`

## Corrección enterprise de buckets Personal a Contratar vs Personal contratado

- [x] Auditar la clasificación vigente de ambas pestañas y corregir la deriva para que dependan de la generación efectiva en BUK, no solo de `stage_code`
- [x] Ajustar la vista/contrato para que `Personal a Contratar` concentre pendientes de BUK y `Personal contratado` solo muestre fichas con job BUK exitoso
- [x] Validar compilación, auditoría SQL, diff limpio y documentar el cierre antes de volver a versionar en `main`

## Hotfix crítico de Control Documental en Personal a Contratar

- [x] Auditar la RPC viva `get_candidate_checklist(...)` y confirmar por qué desaparecieron los documentos cargados en candidatos listos para migrar a BUK
- [x] Restaurar el contrato backend correcto de checklist documental sin perder las reglas vigentes de ficha BUK
- [x] Validar SQL, TypeScript y comportamiento derivado antes de aplicar en remoto y versionar en `main`

## Resultado de hotfix crítico de Control Documental en Personal a Contratar

- La causa raíz estaba íntegramente en backend. La migración [`20260703033100_manage_buk_personnel_pipeline_and_plan_rules.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703033100_manage_buk_personnel_pipeline_and_plan_rules.sql:1027) recompiló `get_candidate_checklist(...)` con dos drift simultáneos:
  - consultó `jp.requires_driver_license` sobre `public.job_positions`, pero esa columna no existe en este esquema, provocando el `42703`;
  - además cambió el payload de salida a claves como `checklist` y `semaphore_color`, mientras la UI sigue consumiendo `documents`, `semaphore` y `document_validation`.
- Eso explica por qué los documentos “desaparecieron” en la pestaña `Control Documental`: no se borraron de `candidate_documents`; la RPC fallaba antes de construir la respuesta y, aun sin el error SQL, la forma del JSON ya no coincidía con [`CandidateDocumentChecklist.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateDocumentChecklist.tsx:1).
- La reparación quedó versionada en [`20260703053000_restore_candidate_checklist_contract_and_driver_resolution.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703053000_restore_candidate_checklist_contract_and_driver_resolution.sql:1), que:
  - vuelve a resolver “conductor vs otros” con `public.is_driver_job_position(...)`, que sí es el helper canónico del módulo;
  - restaura el shape JSON que consume el frontend documental;
  - preserva la regla vigente de ficha BUK para salud: si el prestador exige plan, se controla específicamente `Plan Isapre UF`.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260703053000_restore_candidate_checklist_contract_and_driver_resolution.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`
  - `npx --yes supabase db push --linked --include-all`

## Resultado de corrección enterprise de buckets Personal a Contratar vs Personal contratado

- La causa raíz no estaba en los botones ni en el stage manual visible, sino en el criterio de clasificación de las pestañas: la RPC `get_recruitment_personnel_page_bucket(...)` seguía separando solo por `stage_code`, lo que permitía deriva con registros históricos o cierres no confirmados en BUK.
- El contrato quedó corregido con la migración [`20260703044500_align_personnel_buckets_with_buk_success.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260703044500_align_personnel_buckets_with_buk_success.sql:1):
  - `Personal a Contratar` ahora agrupa candidatos sin generación BUK exitosa confirmada;
  - `Personal contratado` solo muestra candidatos con `buk_sync_jobs.status = success` y `buk_employee_id` válido;
  - la clasificación ya no depende exclusivamente de que el candidato tenga `stage_code = hired`.
- La UI de [`HiringPersonnelToHireView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringPersonnelToHireView.tsx:1) también quedó alineada con esa verdad canónica:
  - el copy del bucket pendiente ahora habla explícitamente de “pendientes de generación efectiva en BUK”;
  - la pestaña `Personal contratado` muestra como fecha principal `buk_generated_at`, con fallback seguro a `hired_at`.
- Validación local cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260703044500_align_personnel_buckets_with_buk_success.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`

## Resultado de control enterprise de Personal a Contratar, Personal contratado y payload previsional BUK

- La frontera operativa ahora quedó explícita: `ready_for_hire` representa personal pendiente de generar en BUK y `hired` queda reservado para el cierre sistémico posterior al éxito real en BUK.
- La UI de Control de Contrataciones ya no permite mover manualmente desde `Listo para contratar` a `Contratado`; la nueva pestaña `Personal contratado` consume exclusivamente candidatos ya cerrados por el worker BUK.
- `Personal a Contratar` sigue visible para `reclutamiento`, `administrativo` y `jefe_administrativo`, pero los botones `Generar en BUK` y `Exportar nómina` quedaron restringidos visualmente y en backend a `administrativo` y `jefe_administrativo`.
- La ficha previsional BUK quedó endurecida en dos capas:
  - Fonasa fuerza `Plan Isapre porcentual = 7%` y limpia planes incompatibles;
  - Isapre exige `Plan Isapre UF` tanto al guardar como al construir checklist/payload de sincronización.
- La sincronización BUK ahora cierra el job con una RPC específica que:
  - marca `buk_sync_jobs` en `success`,
  - mueve el candidato a `hired`,
  - registra historial/auditoría,
  - resincroniza el estado del caso de reclutamiento.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260703033100_manage_buk_personnel_pipeline_and_plan_rules.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`
  - `npx --yes supabase db push --linked --include-all`
  - `npx --yes supabase functions deploy sync-buk-candidates --project-ref pzblmbahnoyntrhistea --no-verify-jwt`
  - `npx --yes supabase migration list --linked`, confirmando aplicada la migración `20260703033100_manage_buk_personnel_pipeline_and_plan_rules`

## Corrección enterprise de autenticación en generación BUK desde Personal a Contratar

- [x] Auditar la cadena `enqueue -> edge worker -> payload BUK` para confirmar por qué el job falla con `Usuario no autenticado` aun cuando la cola se crea correctamente
- [x] Corregir el contrato backend para que el worker consuma el `payload_snapshot` autorizado del job y no reejecute RPCs auth-bound bajo `service_role`
- [x] Validar la corrección sobre jobs reales/remotos, desplegar la edge function actualizada, documentar el cierre y registrar la lección operativa

## Corrección enterprise de secret interno y resolución geográfica BUK

- [x] Auditar el estado real del webhook interno `BUK_SYNC_INTERNAL_WEBHOOK_SECRET` y dejarlo operativo en el proyecto remoto
- [x] Corregir la resolución de `location_id` para usar el catálogo BUK correcto a nivel comuna (`depth=3`) con fallback seguro por región
- [x] Reprocesar un job fallido real contra producción, validar la creación en BUK, la carga documental y documentar el cierre operativo

## Corrección enterprise de exportación XLS de nómina BUK

- [x] Auditar la ruta de exportación XLS y reproducir la causa exacta del error `e.match is not a function`
- [x] Corregir la serialización de fechas del workbook `biff8` sin alterar el contrato funcional de la nómina
- [x] Validar compilación, build frontend y prueba dirigida de la librería XLS antes de versionar

## Resultado de corrección enterprise de exportación XLS de nómina BUK

- La causa raíz no estaba en los datos del candidato ni en la plantilla JSON. El fallo se reproducía directamente en la librería `@mylinkpi/xlsx` al exportar `bookType: "biff8"` con celdas tipadas como `Date` y `cell.t = "d"`.
- La evidencia exacta quedó reproducida en terminal: `writeFile(..., { bookType: "biff8" })` terminaba en `parseDate(str)` dentro de `xlsx.js`, lo que rompe con `str.match is not a function` cuando la celda recibe un objeto `Date` en vez de un string.
- Se corrigió el exportador [`bukEmployeeNomina.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/lib/bukEmployeeNomina.ts:1) con el contrato correcto para `xls`:
  - las fechas ahora se convierten a serial numérico de Excel;
  - las columnas de fecha se escriben como `cell.t = "n"` con formato `dd-mm-yyyy`;
  - el autofit sigue mostrando correctamente el ancho visual formateando esas fechas solo para cálculo de ancho.
- Con esto se preserva el comportamiento esperado del archivo Excel sin degradar la exportación a texto plano ni depender de un tipo no soportado por `biff8`.
- Validación cerrada con:
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`
  - prueba dirigida con `@mylinkpi/xlsx`, confirmando que un workbook `biff8` con fechas numéricas formateadas exporta correctamente mientras la variante anterior con `Date` fallaba en `parseDate(str)`

## Resultado de corrección enterprise de secret interno y resolución geográfica BUK

- La revisión remota confirmó dos drift distintos en la integración:
  - el proyecto Supabase no tenía cargado `BUK_SYNC_INTERNAL_WEBHOOK_SECRET`, por lo que la vía interna del worker no era utilizable de forma real;
  - el worker estaba consumiendo `GET /locations` sin `depth`, y BUK retornaba solo 16 regiones `depth=1`, no comunas. Por eso el caché local quedó mal poblado y la resolución de `location_id` para un candidato de `Maule / VII: del Maule` terminaba usando un nivel geográfico incorrecto.
- Se corrigió el contrato de ubicaciones en [`sync-buk-candidates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1):
  - ahora el fetch prioriza `GET /locations?depth=3`, que en el tenant real devuelve comunas;
  - el parser deriva `region` desde `full_name` cuando BUK no la entrega explícitamente;
  - el caché `buk_locations` guarda también `depth` y `full_name` en `raw_payload`;
  - si el caché aún contiene el formato viejo (solo regiones sin `depth>=3`), el worker fuerza refresh aunque siga dentro del TTL.
- También se cargó el secreto remoto `BUK_SYNC_INTERNAL_WEBHOOK_SECRET` en el proyecto `pzblmbahnoyntrhistea`, dejando operativa la ruta interna del worker con `x-internal-webhook-secret`.
- La validación final se hizo sobre el mismo job productivo que había fallado antes:
  - job `cf9c791d-ab1a-4844-bf68-7649c9b9eb08`
  - candidato `00a06205-74fa-4192-af1b-f3503f4e174d`
  - `buk_locations` quedó refrescado a `346` comunas, incluyendo `Maule -> location_id 147 -> region_name "VII: del Maule"`
  - la reinvocación interna del worker terminó en `success`
  - BUK creó exitosamente al trabajador con `bukEmployeeId = 41739`
  - el `result_snapshot` del job registró además la carga exitosa de los documentos del candidato en BUK
- Validación cerrada con:
  - verificación remota de `supabase secrets list`, confirmando `BUK_SYNC_INTERNAL_WEBHOOK_SECRET`
  - consulta directa a `GET /locations?depth=3`, confirmando la comuna `Maule` con `id = 147`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `git diff --check`
  - `npx --yes supabase functions deploy sync-buk-candidates --project-ref pzblmbahnoyntrhistea --no-verify-jwt`
  - reinvocación interna real de `sync-buk-candidates` con `x-internal-webhook-secret`, confirmando `status = success`, `buk_employee_id = 41739` y caché geográfico corregido

## Resultado de corrección enterprise de autenticación en generación BUK desde Personal a Contratar

- La auditoría end-to-end confirmó que el problema no estaba en la creación del job ni en la ficha del candidato. El job remoto fallido `cf9c791d-ab1a-4844-bf68-7649c9b9eb08` quedó registrado con `payload_snapshot` completo en `public.buk_sync_jobs`, pero el worker [`sync-buk-candidates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1) volvía a ejecutar `get_candidate_buk_sync_payload(...)` desde `service_role`, reabriendo una cadena auth-bound y terminando en `Usuario no autenticado`.
- Se corrigió la raíz en dos capas:
  - la nueva migración [`20260701193000_return_authorized_payload_from_claim_buk_sync_jobs.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260701193000_return_authorized_payload_from_claim_buk_sync_jobs.sql:1) recompone `claim_buk_sync_jobs(...)` para devolver explícitamente `payload_snapshot` junto al estado del job;
  - la edge function [`sync-buk-candidates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1) ahora consume ese snapshot autorizado y validado, en vez de reconstruir el payload del candidato bajo otro contexto de autenticación.
- También se cerró una ramificación de coherencia operativa: la función tenía modo interactivo por JWT y modo interno por `x-internal-webhook-secret`, pero el catálogo local no dejaba explícito que debía ejecutarse sin verificación JWT de plataforma. [`supabase/config.toml`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/config.toml:1) ahora declara `verify_jwt = false` para `sync-buk-candidates`, y el despliegue remoto se realizó además con `--no-verify-jwt` para que la validación propia del worker gobierne ambos modos.
- Validación cerrada con:
  - consulta remota de `public.buk_sync_jobs` sobre el job fallido, confirmando `payload_snapshot` presente y `error_message = 'Usuario no autenticado'` antes del fix
  - `npm run audit:migrations -- --files supabase/migrations/20260701193000_return_authorized_payload_from_claim_buk_sync_jobs.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `git diff --check`
  - `npx --yes supabase db push --linked --include-all`
  - `npx --yes supabase migration list --linked`
  - `npx --yes supabase functions deploy sync-buk-candidates --project-ref pzblmbahnoyntrhistea --no-verify-jwt`
  - invocación remota sin `Authorization`, verificando respuesta de la propia función (`{"error":"Unauthorized"}`) en lugar del bloqueo previo de plataforma por JWT ausente, lo que confirma que el runtime desplegado ya está usando la capa de autorización correcta

## Corrección de catálogo de cargo en solicitud de contrataciones

- [x] Auditar la cadena `BUK -> catálogo ERP -> selector de contratación` para confirmar por qué no aparece `Conductor Minibus Acercamiento`
- [x] Cargar el cargo faltante en el catálogo backend canónico de `job_positions` sin alterar el contrato frontend
- [x] Validar el catálogo remoto, auditar migración y documentar el cierre operativo

## Resultado de corrección de catálogo de cargo en solicitud de contrataciones

- La revisión del flujo confirmó que el selector `Cargo solicitado` de [`HiringRequestPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringRequestPage.tsx:304) no consume un catálogo vivo desde BUK. La vista usa [`fetchHiringCatalogs()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringCatalogs.ts:61), y esa función lee directamente `public.job_positions`.
- El cargo `Conductor Minibus Acercamiento` no existía en `job_positions`, por eso nunca podía aparecer en la solicitud aunque operativamente se espere como cargo válido. La auditoría también confirmó que hoy no aparece en la dotación activa sincronizada de `employees`, así que el faltante real estaba en el catálogo canónico del ERP y no en un filtro de frontend.
- Se agregó la migración [`20260701183000_add_missing_minibus_job_position_to_hiring_catalog.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260701183000_add_missing_minibus_job_position_to_hiring_catalog.sql:1), que incorpora `CONDUCTOR MINIBUS ACERCAMIENTO` como cargo activo en `public.job_positions` con upsert idempotente.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260701183000_add_missing_minibus_job_position_to_hiring_catalog.sql`
  - `npx --yes supabase db push --linked --include-all`
  - verificación remota de `public.job_positions`, confirmando `code = CARGO-090`, `name = CONDUCTOR MINIBUS ACERCAMIENTO` e `is_active = true`
  - `git diff --check`

## Alineación enterprise de la ficha BUK para paso a contratación

- [x] Auditar el contrato vivo de la ficha BUK contra la lista Excel adjunta y detectar drift entre obligatoriedad, defaults visibles, checklist y payload backend
- [x] Implementar defaults automáticos y reglas condicionales de negocio para código de ficha, rol privado, AFC, antigüedad, vacaciones progresivas y jubilación
- [x] Alinear formulario, template/exportación y validaciones backend para que solo bloqueen por los campos realmente exigibles según contexto
- [x] Validar compilación, auditoría de migraciones, consistencia de diffs y aplicar la migración en el remoto enlazado antes de versionar en `main`

## Corrección de rol y acceso de Isac Arratia en movilidad interna

- [x] Auditar el rol efectivo de Isac Arratia y la matriz viva que decide el acceso a `movilidad_interna`
- [x] Revertir el sobreacceso transitorio de `operaciones_l_2` y corregir la asignación de Isac a `operaciones_l_1`
- [x] Validar el rol y permiso efectivo final con `user_roles` y `user_can_access_module(...)`, auditar migración y documentar el cierre operativo

## Resultado de corrección de rol y acceso de Isac Arratia en movilidad interna

- La causa raíz final no era el módulo de `operaciones_l_2`; era la clasificación del usuario. Isac Arratia (`iarratia@busesjm.com`) estaba cargado en `user_roles` como `operaciones_l_2`, pero debía operar como `operaciones_l_1`.
- La migración intermedia [`20260701114500_restore_internal_mobility_for_operaciones_l2.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260701114500_restore_internal_mobility_for_operaciones_l2.sql:1) quedó solo como rastro auditable del diagnóstico inicial. La corrección efectiva y final está en [`20260701170000_reassign_isac_arratia_to_operaciones_l1.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260701170000_reassign_isac_arratia_to_operaciones_l1.sql:1), que:
  - revierte el sobreacceso transitorio de `movilidad_interna` para `operaciones_l_2`;
  - elimina la asignación `operaciones_l_2` de Isac;
  - inserta la asignación correcta `operaciones_l_1` para el usuario.
- La validación remota confirmó el estado final esperado:
  - `user_roles` de Isac quedó en `operaciones_l_1`;
  - `user_can_access_module('movilidad_interna')` devuelve `true` para Isac;
  - un usuario real que sí permanece en `operaciones_l_2` (`jorge.parra@busesjm.com`) devuelve `false`, probando que no quedó sobrepermiso residual en ese rol.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260701170000_reassign_isac_arratia_to_operaciones_l1.sql`
  - `npx --yes supabase db push --linked --include-all`
  - verificación remota de `public.user_roles`, `public.role_module_access` y `public.user_can_access_module(...)`
  - `git diff --check`

## Resultado de alineación enterprise de la ficha BUK para paso a contratación

- La auditoría sobre la lista [`lista.xls`](</Users/maximilianocontrerasrey/Desktop/lista.xls>) confirmó tres drift relevantes del contrato vivo: el template canónico aún no marcaba `Tipo de Documento*` ni `Email Personal*`, la ficha seguía obligando `Régimen jubilación` aun cuando `Jubilado = No`, y los defaults operativos (`Código de Ficha`, `Rol Privado`, `AFC`, `Aumentar cotización 1%`) no estaban resueltos de forma canónica entre pantalla, checklist y payload backend.
- En frontend se endureció la ficha contractual/personal en [`CandidateWorkerFileForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateWorkerFileForm.tsx:1) y se encapsularon las reglas de negocio en [`candidateBukWorkerRules.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/lib/candidateBukWorkerRules.ts:1):
  - `Email Personal*` pasa a ser obligatorio en ficha personal.
  - `Código de Ficha` se autocompleta con sugerencia backend `F1/Fx`.
  - `Rol Privado` por defecto queda en `No`.
  - `Inicio cotización AFC`, `Reconocimiento de Antigüedad` e `Inicio Vacaciones Progresivas` se completan automáticamente con la fecha de ingreso.
  - `Aumentar cotización 1%` por defecto queda en `No`.
  - `AFC` por defecto queda en `Menos de 11 Años`.
  - `Régimen jubilación` solo se exige cuando `Jubilado = Sí`; si no, queda vacío.
  - `AFP Recaudadora` degrada al mismo fondo de cotización cuando aplica AFP.
  - `Tipo Vale Vista` y los planes de salud se limpian o exigen solo cuando realmente aplican por método de pago/prestador.
- El backend quedó como fuente de verdad con la migración [`20260701162000_harden_buk_worker_file_defaults_and_requirement_rules.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260701162000_harden_buk_worker_file_defaults_and_requirement_rules.sql:1), que:
  - crea helpers para resolver valores afirmativos BUK, aplicabilidad de plan de salud y correlativo de código de ficha por candidato;
  - rehace `upsert_candidate_worker_file(...)` para derivar defaults operativos y exigir `Régimen jubilación` solo cuando corresponde;
  - rehace `get_candidate_buk_profile(...)` para devolver la sugerencia de ficha y los defaults efectivos que la app debe mostrar;
  - alinea `get_candidate_checklist(...)` y `get_candidate_buk_sync_payload(...)` con la misma semántica, evitando que la ficha se vea “completa” en una capa y “incompleta” en otra.
- También se sincronizó el template/exportación de nómina en [`bukEmployeeTemplateData.json`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/lib/bukEmployeeTemplateData.json:1) y [`bukEmployeeNomina.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/lib/bukEmployeeNomina.ts:1) para reflejar `Tipo de Documento*`, `Email Personal*` y los defaults nuevos del contrato.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260701162000_harden_buk_worker_file_defaults_and_requirement_rules.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`
  - `npx --yes supabase db push --linked --include-all`
  - `npx --yes supabase migration list --linked`

## Hotfix backend de transición de candidatos a `En Proceso`

- [x] Auditar la cadena completa de transición de candidatos y reproducir por contrato SQL la causa del error `Etapa inválida - Código: P0001`
- [x] Corregir la función backend viva preservando todos los controles recientes de cierre terminal, auditoría y validación documental
- [x] Verificar ramificaciones derivadas para asegurar coherencia entre etapas visibles, constraints y RPC activa antes de aplicar en remoto
- [x] Validar con auditoría de migración, compilación, aplicación remota y documentar el cierre operativo

## Resultado de hotfix backend de transición de candidatos a `En Proceso`

- La causa raíz no estaba en la UI ni en permisos: la función viva [`advance_recruitment_candidate_stage(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628011500_require_terminal_candidate_reason_in_stage_transition.sql:3) fue recompilada el `2026-06-28` sin conservar la etapa `in_process` que ya había sido incorporada antes al pipeline de reclutamiento.
- Eso dejó al sistema en drift: frontend, métricas BI, labels, filtros, constraints de `recruitment_case_candidates` y datos productivos sí reconocían `En Proceso`, pero la RPC operativa rechazaba `p_to_stage = 'in_process'` con `Etapa invalida`.
- La nueva migración [`20260701103500_restore_in_process_transition_in_recruitment_stage_rpc.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260701103500_restore_in_process_transition_in_recruitment_stage_rpc.sql:1) recompone la función sobre la versión más reciente y conserva las defensas nuevas:
  - vuelve a permitir `who_approved -> in_process -> medical_exams`
  - exige aprobación Who resuelta para avanzar tanto a `in_process` como a `medical_exams`
  - mantiene motivo obligatorio para `rejected/withdrawn`
  - conserva cancelación de aprobaciones Who pendientes en cierres terminales
  - conserva validación documental y bloqueo contractual antes de `ready_for_hire`
  - conserva cola de limpieza documental y auditoría de cambios
- La auditoría de ramificaciones confirmó que no había otra ruptura activa equivalente en frontend ni en catálogos: el drift estaba concentrado en la recompilación de la RPC backend.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260701103500_restore_in_process_transition_in_recruitment_stage_rpc.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npx supabase db push --linked --include-all`
  - verificación remota de la definición efectiva de `advance_recruitment_candidate_stage(...)` para confirmar soporte de `in_process`
  - `git diff --check`

## Restricción de tipos de incentivo por regla activa del trabajador

- [x] Auditar cómo se carga hoy el dropdown de tipos de incentivo y dónde se desacopla del contrato real de reglas activas
- [x] Agregar un contrato backend que resuelva tipos elegibles por trabajador, contrato y fecha usando la misma lógica canónica de matching de reglas
- [x] Conectar el formulario de registro para mostrar solo tipos elegibles y degradar correctamente cuando no existan reglas activas aplicables
- [x] Validar con auditoría de migraciones, `TypeScript`, build frontend, aplicación remota y dejar el cierre auditado en este documento

## Coherencia contractual DMH en contexto y elegibilidad de Incentivos

- [x] Auditar el flujo completo `búsqueda -> contexto del trabajador -> contrato seleccionado -> tipos elegibles` para el caso DMH reportado
- [x] Corregir el backend para no romper el contexto de trabajadores activos cuando su área BUK no tenga mapping operativo 1:1, degradando de forma controlada al catálogo vivo de contratos
- [x] Limitar el selector de contrato del trabajador a sus opciones reales cuando sí exista mapping, evitando que el formulario herede contratos ajenos entre trabajadores
- [x] Validar con RPC autenticadas reales para un caso DMH mapeado y uno sin mapping operativo, más `audit:migrations`, `TypeScript`, build frontend y `git diff --check`

## Resultado de coherencia contractual DMH en contexto y elegibilidad de Incentivos

- La revisión end-to-end confirmó que el problema no estaba en la regla de `cambio_turno_vuelta`: la regla global activa existe y un trabajador DMH correctamente mapeado (`CONT-028`) ya devuelve en backend `cambio_turno_vuelta` y `servicio_especial_facturable`.
- La incoherencia real estaba una capa antes. [`get_hr_incentive_worker_core(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630213000_harden_hr_incentive_worker_context_without_mapping.sql:3) abortaba todo el flujo cuando el trabajador existía en BUK pero su área primaria no tenía mapping operativo `1:1`, dejando al formulario sin contexto aunque el trabajador siguiera activo y elegible en negocio.
- La nueva migración [`20260630213000_harden_hr_incentive_worker_context_without_mapping.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630213000_harden_hr_incentive_worker_context_without_mapping.sql:1) endurece el contrato backend en tres puntos:
  - `get_hr_incentive_worker_core(...)` ya no exige mapping operativo para reconocer al trabajador; solo exige que el trabajador exista y devuelve contrato/área primaria cuando el mapping está disponible.
  - `get_hr_incentive_worker_context(...)` deja de mezclar todos los contratos del ERP cuando el trabajador sí tiene contexto propio. Ahora entrega solo sus áreas/contratos reales; únicamente si no existe ninguna opción operativa propia degrada al catálogo vivo de contratos para que la operación no se bloquee.
  - `search_hr_incentive_eligible_workers(...)` deja visible al trabajador elegible por cargo aunque su área primaria no tenga mapping operativo, usando el área normalizada como contexto de búsqueda y permitiendo que luego el contrato se seleccione desde el backend endurecido.
- Este ajuste corrige dos problemas de coherencia a la vez: elimina la herencia silenciosa de contratos ajenos entre trabajadores en el selector y evita que un caso DMH con área BUK no catalogada quede fuera de toda la cadena solo por esa ausencia de mapping.
- Validación cerrada con:
  - RPC autenticada `get_hr_incentive_worker_context('12247')` + `get_hr_incentive_eligible_types('12247','CONT-028','2026-06-30')`, confirmando para una trabajadora DMH mapeada la visibilidad de `cambio_turno_vuelta` y `servicio_especial_facturable`
  - RPC autenticada `get_hr_incentive_worker_context('8657')`, confirmando que el backend ya no debe depender de un mapping operativo primario para reconocer el trabajador
  - `npm run audit:migrations -- --files supabase/migrations/20260630213000_harden_hr_incentive_worker_context_without_mapping.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
- `npm run build:frontend-check`
- `git diff --check`

## Corrección end-to-end de elegibilidad para incentivos por hora con regla global

- [x] Auditar la cadena completa de `sobretiempo` para DMH y DRT: tipo, reglas activas, worker context, payload BUK y resolución horaria
- [x] Corregir la extracción backend del sueldo base BUK para que la estrategia `buk_overtime` use el payload real vigente y no descarte incentivos válidos
- [x] Validar con RPC autenticadas reales sobre trabajadores DMH y DRT, más auditoría de migración, `TypeScript`, build frontend y `git diff --check`

## Resultado de corrección end-to-end de elegibilidad para incentivos por hora con regla global

- La auditoría completa confirmó que `sobretiempo` no desaparecía por contrato ni por regla. El tipo [`sobretiempo`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630184500_add_buk_overtime_strategy_to_hr_incentives.sql:39) está activo, usa `calculation_basis = per_hour`, `hour_rate_strategy = buk_overtime` y sí matchea una regla global activa (`contract/job_title/union = Todos`).
- El descarte ocurría en la última milla de elegibilidad. `resolve_hr_incentive_hour_rate(...)` devolvía `can_resolve = false` porque el `worker_core` llegaba con `base_salary = null`, aun cuando el payload BUK vivo sí traía el dato como `current_job.base_wage`.
- La causa raíz era el extractor backend [`extract_hr_incentive_worker_base_salary(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630220500_fix_buk_overtime_base_wage_extraction.sql:3): solo buscaba `base_salary` y variantes parciales, pero no `base_wage`, que es precisamente el campo efectivo que llega hoy desde BUK en los trabajadores auditados de DMH y DRT.
- La nueva migración [`20260630220500_fix_buk_overtime_base_wage_extraction.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630220500_fix_buk_overtime_base_wage_extraction.sql:1) corrige el extractor de forma enterprise y compatible hacia atrás, agregando lectura ordenada de `base_wage` en raíz, `contract`, `current_job` y `current_job.compensation`, sin cambiar la semántica de los flujos que ya resolvían con `base_salary`.
- Con esto, la cadena completa vuelve a ser coherente: `get_hr_incentive_worker_core(...)` carga sueldo base real desde BUK, `resolve_hr_incentive_hour_rate(...)` logra calcular la hora extra y `get_hr_incentive_eligible_types(...)` deja de esconder `sobretiempo` para trabajadores DMH/DRT que sí tienen una regla global aplicable.
- Validación cerrada con:
  - RPC autenticada de `resolve_hr_incentive_rate_rule(...)` + `resolve_hr_incentive_hour_rate(...)` para una trabajadora DMH (`12247`), confirmando que antes el match existía pero fallaba solo la resolución salarial
  - RPC autenticada de `get_hr_incentive_eligible_types(...)` para DMH (`12247`) y DRT (`17264`) después de la corrección
  - `npm run audit:migrations -- --files supabase/migrations/20260630220500_fix_buk_overtime_base_wage_extraction.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`

## Cálculo enterprise de horas extra desde BUK con fallback auditable

- [x] Auditar el plan externo y contrastarlo con el ERP vivo para confirmar qué datos contractuales llegan hoy desde la sync BUK y qué drift existe respecto del diseño propuesto
- [x] Formalizar una estrategia de cálculo por tipo para incentivos `per_hour`, de modo que solo los tipos configurados como horas extra usen cálculo automático y el resto mantenga la lógica vigente por regla
- [x] Extender el contrato backend de reglas/preview/create para resolver hora extra desde datos BUK cuando existan y, si faltan salarios en payload, degradar a un fallback explícito versionado en configuración base
- [x] Ajustar configuración base y formulario para exponer la nueva estrategia y mostrar un desglose auditable del valor hora cuando aplique, sin romper flujos existentes
- [x] Validar con auditoría de migración, `TypeScript`, build frontend, aplicación remota y dejar el cierre auditado en este documento

## Cierre del bucle en tipos manuales de Incentivos

- [x] Auditar por qué los tipos con `allows_manual_amount` siguen desapareciendo del selector cuando no tienen regla activa y por qué configuración base aún exige monto para registrar su contexto
- [x] Corregir la elegibilidad backend para que un tipo manual siga visible sin regla monetaria y la regla vacía no se interprete como monto `0` válido
- [x] Ajustar configuración base para permitir reglas sin monto en tipos que ya resuelven el importe manualmente
- [x] Validar con auditoría de migración, `TypeScript`, build frontend, aplicación remota y dejar el cierre auditado en este documento

## Resultado de cierre del bucle en tipos manuales de Incentivos

- Se agregó la migración [`20260630195500_fix_manual_incentive_eligibility_and_amountless_rules.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630195500_fix_manual_incentive_eligibility_and_amountless_rules.sql:1), que recompila `add_hr_incentive_rate_rule(...)`, `get_hr_incentive_eligible_types(...)` y `build_hr_incentive_preview_from_worker_data(...)` para separar definitivamente la elegibilidad manual de la existencia de una regla monetaria.
- La causa raíz quedó cerrada en backend: `get_hr_incentive_eligible_types(...)` seguía naciendo solo desde `resolve_hr_incentive_rate_rule(...)`, por lo que cualquier tipo con `allows_manual_amount = true` pero sin regla activa jamás llegaba al selector. Ahora esos tipos se incorporan explícitamente como elegibles por capacidad propia y se deduplican frente a los tipos que sí traen regla.
- La otra mitad del bucle también quedó corregida: una regla sin monto para un tipo manual ya no es inválida en configuración base, pero tampoco pasa a significar “monto 0 operativo”. `add_hr_incentive_rate_rule(...)` admite monto nulo en tipos manuales y lo persiste como contexto neutro; luego `build_hr_incentive_preview_from_worker_data(...)` bloquea el caso si el usuario no ingresa monto manual y la regla solo aporta `0`, exigiendo monto manual o una regla monetaria real.
- [`IncentiveSetupView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveSetupView.tsx:1) dejó de exigir monto para tipos que ya resuelven el importe manualmente. El campo ahora es opcional en esos casos y el submit envía `null` en vez de forzar un `0` artificial desde frontend.
- Validación remota dirigida sobre `Servicio Especial Facturable al Cliente`:
  - el tipo sigue con `allows_manual_amount = true`;
  - mantiene `0` reglas activas;
  - aun así `build_hr_incentive_preview_from_worker_data(...)` resolvió correctamente una previsualización manual real para un trabajador de `CONT-028 / CODELCO DMH`, devolviendo `amount_source = manual`, `calculated_amount = 8000` y `rate_rule_id = null`.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260630195500_fix_manual_incentive_eligibility_and_amountless_rules.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npx --yes supabase db push --linked --dry-run --include-all`
  - `npx --yes supabase db push --linked --include-all`
  - humo remoto sobre `hr_incentive_rate_rules` y `build_hr_incentive_preview_from_worker_data(...)` para el caso `servicio_especial_facturable`
  - `git diff --check`

## Resultado de cálculo enterprise de horas extra desde BUK con fallback auditable

- Se agregó la migración [`20260630184500_add_buk_overtime_strategy_to_hr_incentives.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630184500_add_buk_overtime_strategy_to_hr_incentives.sql:1), que formaliza una estrategia horaria por tipo (`rule_amount` / `buk_overtime`), extiende las reglas con `fallback_base_salary`, `fallback_weekly_hours` y `overtime_multiplier`, y recompila los contratos vivos de setup, elegibilidad, preview y create.
- La auditoría remota aterrizó el drift clave del plan externo: la sync actual sí trae `weekly_hours`, pero no `base_salary` en `employees.raw_payload`. Por eso el diseño quedó enterprise y no frágil: `sobretiempo` intenta calcular desde BUK cuando exista sueldo base, degrada a fallback salarial versionado en la regla cuando falta ese dato, y conserva como último respaldo el `rate_rule_amount` directo para no romper la operación vigente.
- [`IncentiveSetupView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveSetupView.tsx:1), [`incentivesApi.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/services/incentivesApi.ts:1) y [`types.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/types.ts:1) ahora exponen esta estrategia en configuración base, incluyendo toggle por tipo `per_hour` y campos de fallback auditable por regla.
- [`IncentiveRegistrationForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRegistrationForm.tsx:1) muestra el desglose del valor hora solo cuando aplica la estrategia `buk_overtime`, diferenciando si el valor vino desde BUK, desde fallback salarial de regla o desde el respaldo directo de la regla.
- `get_hr_incentive_eligible_types(...)` dejó de ofrecer incentivos por hora que no pueden resolverse operacionalmente con el contexto real del trabajador, salvo que el propio tipo permita resolución manual. Así el selector sigue alineado con la verdad backend y no ofrece caminos inviables.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260630184500_add_buk_overtime_strategy_to_hr_incentives.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npx --yes supabase db push --linked --dry-run --include-all`
  - `npx --yes supabase db push --linked --include-all`
  - humo remoto sobre `hr_incentive_types` para confirmar `sobretiempo -> buk_overtime`
  - humo remoto sobre `resolve_hr_incentive_hour_rate(...)` para verificar los tres caminos: BUK, fallback salarial versionado y respaldo directo por regla
  - `git diff --check`

## Resultado de restricción de tipos de incentivo por regla activa del trabajador

- Se agregó la migración [`20260630171000_filter_hr_incentive_types_by_active_rules.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630171000_filter_hr_incentive_types_by_active_rules.sql:1), que incorpora la RPC `get_hr_incentive_eligible_types(...)` para resolver tipos elegibles por `trabajador + contrato + fecha` reutilizando la misma lógica canónica de `resolve_hr_incentive_rate_rule(...)`.
- El formulario dejó de poblar el selector desde el catálogo global de tipos activos. [`IncentiveRegistrationForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRegistrationForm.tsx:1) ahora consulta la RPC de elegibilidad y solo muestra incentivos con regla activa aplicable al contexto seleccionado.
- La UX también quedó alineada con el contrato operativo: si faltan trabajador, contrato o fecha, el selector lo indica; si no existe ninguna regla activa aplicable, muestra un mensaje semántico explícito en vez de dejar al usuario descubrir el bloqueo recién en preview.
- La invalidez de caché también quedó alineada: [`IncentiveSetupView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveSetupView.tsx:1), [`useIncentivesQueries.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/hooks/useIncentivesQueries.ts:1) y [`queryKeys.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/lib/queryKeys.ts:1) invalidan y versionan explícitamente la caché de tipos elegibles cuando cambia la configuración base.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260630171000_filter_hr_incentive_types_by_active_rules.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npx --yes supabase db push --linked --dry-run --include-all`
  - `npx --yes supabase db push --linked --include-all`
  - humo remoto de la migración y la nueva RPC
  - `git diff --check`

## Corrección enterprise del monto manual en Incentivos

- [x] Auditar por qué el flujo de monto manual sigue exigiendo una regla activa antes de aceptar el monto digitado
- [x] Reconciliar el contrato backend de preview/create para que el tipo de incentivo pueda operar sin regla cuando el monto manual resuelve la solicitud
- [x] Ajustar la salida frontend del preview para representar correctamente el caso manual sin regla en vez de simular una regla base inexistente
- [x] Validar con auditoría de migraciones, `TypeScript`, build frontend, aplicación remota y dejar el cierre auditado en este documento

## Resultado de corrección enterprise del monto manual en Incentivos

- Se agregó la migración [`20260630162000_fix_hr_incentive_manual_amount_without_rule.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630162000_fix_hr_incentive_manual_amount_without_rule.sql:1), que recompila `build_hr_incentive_preview_from_worker_data(...)` para resolver primero la política del tipo de incentivo y usar la regla de monto solo cuando el caso realmente la necesita.
- El backend ya no exige una regla placeholder para solicitudes con monto manual. Si el tipo permite `allows_manual_amount` y el usuario ingresa un monto válido, el flujo puede previsualizar y registrar aunque no exista una regla activa para esa combinación.
- Cuando el tipo permite monto manual pero el usuario deja el campo vacío y tampoco existe una regla activa, el backend devuelve ahora un bloqueo semántico correcto: debe ingresar monto manual o configurar una regla, en vez de fallar como si todo el flujo dependiera siempre de la tabla de reglas.
- [`IncentiveRegistrationForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRegistrationForm.tsx:1) dejó de simular una “regla base 0”. El preview muestra `Sin regla requerida` y `No aplica` para los metadatos de regla cuando el monto viene resuelto manualmente sin match de regla.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260630162000_fix_hr_incentive_manual_amount_without_rule.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npx --yes supabase db push --linked --dry-run --include-all`
  - `npx --yes supabase db push --linked --include-all`
  - `git diff --check`

## Habilitación de monto manual controlado en Incentivos

- [x] Auditar el contrato actual de Incentivos para ubicar dónde se resuelve hoy el monto y qué superficies dependen de `calculated_amount`
- [x] Extender el backend de Incentivos para permitir monto manual solo en tipos configurados en base, con trazabilidad completa en solicitud e historial
- [x] Ajustar configuración base y formulario de registro para exponer el monto manual solo cuando aplique, sin romper el flujo vigente por regla
- [x] Validar con auditoría de migraciones, `TypeScript`, build frontend, aplicación remota y dejar el cierre auditado en este documento

## Resultado de habilitación de monto manual controlado en Incentivos

- Se agregó la migración [`20260630150000_enable_manual_amounts_for_hr_incentives.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630150000_enable_manual_amounts_for_hr_incentives.sql:1), que incorpora `allows_manual_amount` en `hr_incentive_types` y `amount_source`/`manual_amount` en `hr_incentive_requests`, manteniendo `calculated_amount` como monto canónico para todo el ERP.
- El backend de Incentivos ahora soporta override manual solo para tipos habilitados desde configuración base. Las RPCs `calculate_hr_incentive_preview(...)` y `create_hr_incentive_request(...)` conservan compatibilidad con sus firmas previas y exponen nuevas sobrecargas con `p_manual_amount`, evitando quiebres en consumidores existentes.
- La trazabilidad quedó cerrada de punta a punta: el origen del monto viaja por preview, solicitud persistida, historial y exportación. Si no se ingresa monto manual, el flujo sigue comportándose exactamente como antes y usa la regla vigente.
- [`IncentiveSetupView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveSetupView.tsx:1) ahora permite definir y alternar la opción “Permite monto manual” por tipo; [`IncentiveRegistrationForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRegistrationForm.tsx:1) solo muestra el campo manual cuando el tipo lo autoriza y deja el monto por regla si el usuario no lo completa.
- [`IncentiveRequestsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRequestsView.tsx:1) y [`IncentiveApprovalsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveApprovalsView.tsx:1) ya muestran el origen del monto en detalle, y la exportación agrega columnas para `origen_monto` y `monto_manual`.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260630150000_enable_manual_amounts_for_hr_incentives.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npx --yes supabase db push --linked --dry-run --include-all`
  - `npx --yes supabase db push --linked --include-all`
  - humo remoto sobre `pg_proc` e `information_schema.columns` para confirmar firmas nuevas y columnas `allows_manual_amount`, `amount_source`, `manual_amount`
  - `git diff --check`

## Alineación backend del módulo de Operaciones con ERP vigente

- [x] Auditar el drift actual entre Operaciones y el ERP vigente para distinguir qué reglas siguen duplicadas en frontend y cuáles deben migrarse al backend canónico
- [x] Formalizar el contrato backend de Operaciones que hoy no está versionado (`base_services`, `equipment`, `service_entries` y/o sus wrappers) sin inventar datos maestros ni romper los dos contratos actuales bosquejados
- [x] Reemplazar la lógica editable del estado del conductor para que Operaciones derive turno/descanso desde Jornadas (`Roster`) en vez de aceptar una decisión manual
- [x] Llevar la búsqueda de conductores al mismo patrón BUK ya usado por Jornadas, Incentivos, Movilidad Interna y Acreditación
- [x] Revisar y corregir la matriz de acceso del módulo `operaciones` para que el backend quede alineado con la seguridad modular vigente
- [x] Validar con auditoría de migraciones, `TypeScript`, build, smoke backend y dejar el cierre auditado en este documento

## Resultado de alineación backend del módulo de Operaciones con ERP vigente

- Se versionó la migración [`20260630133626_align_operations_backend_with_roster_and_catalogs.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630133626_align_operations_backend_with_roster_and_catalogs.sql:1), que formaliza `base_services`, `equipment` y `service_entries`, crea `user_can_manage_operations(...)`, expone `search_operations_drivers(...)` y redefine [`submit_service_entries_batch(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630133626_align_operations_backend_with_roster_and_catalogs.sql:282) para derivar turno/descanso desde Jornadas en vez de aceptar una decisión manual del cliente.
- La misma migración quedó aplicada y registrada remotamente en Supabase. Validación remota confirmada: `92` servicios base sembrados, `6` equipos bootstrap activos y presencia de columnas roster-aware (`driver_buk_employee_id`, `driver_shift_source`, `driver_roster_base_status`, `driver_roster_effective_status`) en `public.service_entries`.
- El módulo Operaciones ya no resuelve contratos contra etiquetas legacy rígidas. [`OperacionesDashboard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/pages/OperacionesDashboard.tsx:1) carga `contracts.contract_name` desde el ERP vivo y el backend acepta tanto `CODELCO DMH` como el alias heredado `SERVICIO CODELCO DMH` solo para compatibilidad.
- El selector manual de “Estado de turno” dejó de ser una decisión editable. [`OperationsBaseRegister.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/components/OperationsBaseRegister.tsx:1) ahora muestra el estado resuelto desde roster (`Turno`, `Descanso`, `Turno adicional`, `Vacaciones`, `Licencia médica`, `Sin pauta`) y el payload dejó de depender de esa variable local.
- La búsqueda de conductores se reconectó al patrón BUK indexado del ERP. [`searchOperationsDrivers(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/services/operacionesApi.ts:1) consume la RPC `search_operations_drivers(...)`, y Operaciones dejó de precargar `employees_active_current` completo para filtrar en cliente.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260630093000_block_duplicate_rest_day_incentives_per_worker_date.sql supabase/migrations/20260630133626_align_operations_backend_with_roster_and_catalogs.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `node scripts/generate-recruitment-migration-template.mjs`
  - `node scripts/audit-supabase-security.mjs`
  - `git diff --check`

## Resultado de auditoría de trabajos pendientes ajenos

- El bloque pendiente de Incentivos sí aplicaba al ERP actual y quedó incorporado: la migración [`20260630093000_block_duplicate_rest_day_incentives_per_worker_date.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630093000_block_duplicate_rest_day_incentives_per_worker_date.sql:1) ya está validada localmente y aplicada/remotamente para impedir dobles incentivos sobre el mismo descanso consumido.
- La limpieza profunda del repo también aplicaba y se mantuvo: se retiran scripts one-off sin integración viva (`process-pdf.mjs`, `sync-doc.cjs`, `test-rpc.mjs`, `scripts/preview_migracion.cjs`, `supabase/.temp/linked-project.json`), se actualiza [`scripts/audit-supabase-security.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/audit-supabase-security.mjs:1) al árbol real y [`.gitignore`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/.gitignore:1) pasa a ignorar `vite.config.d.ts`.
- El retiro de Excels binarios del repo también quedó validado: [`docs/templates/plantilla_migracion_reclutamiento.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/docs/templates/plantilla_migracion_reclutamiento.md:1), [`docs/templates/generador_certificados_legacy.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/docs/templates/generador_certificados_legacy.md:1) y [`docs/templates/README.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/docs/templates/README.md:1) preservan el contrato funcional en texto auditable, y no quedaron referencias vivas del runtime a los `.xls/.xlsx` retirados.

## Refinamiento visual y reutilización compartida en Operaciones / registros base

- [x] Eliminar la cabecera superior redundante de `registros_base` y dejar el bloque operativo arrancando directamente en los controles útiles
- [x] Unificar alturas, tipografía y tratamiento visual de inputs/selectores/readonly en la sección para que siga el lenguaje compartido del ERP
- [x] Reemplazar el selector artesanal de conductores por el lookup compartido usado por Jornadas, Incentivos y Movilidad Interna
- [x] Marcar visualmente el estado de turno desde roster con semántica visible (`verde = en turno`, `rojo = descanso`) sin reintroducir edición manual
- [x] Validar con `TypeScript`, build frontend y `git diff --check`

## Resultado del refinamiento visual y reutilización compartida en Operaciones / registros base

- [`OperationsBaseRegister.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/components/OperationsBaseRegister.tsx:1) eliminó la cabecera redundante, usa el lookup compartido de conductores, simplifica el estado local del bloque y reemplaza el antiguo input de turno por un indicador semántico derivado desde roster.
- [`OperationsDriverLookup.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/components/OperationsDriverLookup.tsx:1) y [`useOperationsQueries.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/hooks/useOperationsQueries.ts:1) conectan Operaciones al mismo patrón `WorkerLookupField + React Query + búsqueda remota indexada` ya operativo en otros módulos, eliminando el popover artesanal y el debounce manual del dashboard.
- [`WorkerLookupField.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/forms/WorkerLookupField.tsx:1) ahora acepta `searchContext`, dejando reusable el patrón compartido incluso cuando una búsqueda necesita contexto adicional como la fecha de servicio.
- [`operaciones.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/styles/operaciones.css:1) alinea la tipografía con las variables globales del ERP, iguala alturas de campos, refuerza el relieve neumórfico de paneles/tarjetas/resultados y deja el bloque visual consistente con el estándar actual.

## Optimización de latencia en búsqueda de conductores de Operaciones

- [x] Medir la ruta actual de búsqueda para distinguir si la lentitud viene del lookup frontend o de la RPC backend
- [x] Recompilar la RPC `search_operations_drivers(...)` sobre el patrón indexado correcto del ERP y reducir trabajo previo al `limit`
- [x] Validar con `audit:migrations`, `db push --dry-run`, aplicación remota, humo SQL comparativo y `git diff --check`

## Resultado de optimización de latencia en búsqueda de conductores de Operaciones

- La causa raíz quedó aislada en backend: `search_operations_drivers(...)` estaba consultando `employees_active_current`, que ya deduplica con `window functions`, y luego Operaciones volvía a deduplicar/ordenar antes de aplicar `limit`. Ese doble trabajo anulaba los índices de búsqueda y llevaba una búsqueda representativa a ~`2763 ms`.
- La migración [`20260630154500_optimize_operations_driver_search.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630154500_optimize_operations_driver_search.sql:1) recompila la RPC para usar `public.employees` con `is_active = true`, aprovechar `idx_employees_active_worker_search_text_trgm` y `idx_employees_active_document_digits_trgm`, y resolver `resolve_hr_roster_day_status(...)` solo sobre el subconjunto ya rankeado y limitado.
- Verificación remota comparativa cerrada con una búsqueda de referencia (`jorge`): la forma anterior ejecutó en ~`2763 ms`; la forma optimizada equivalente quedó en ~`80 ms` usando el índice trigram y limitando antes del lateral de roster.

## Microajustes visuales pendientes en Operaciones e Incentivos

- [x] Igualar el selector superior de contrato de Operaciones con el tratamiento visual de fecha y turno
- [x] Encerrar el mensaje bloqueante de Incentivo Extraordinario en una alerta roja con icono y paleta del ERP
- [x] Validar con `TypeScript`, build frontend y `git diff --check`

## Resultado de microajustes visuales pendientes en Operaciones e Incentivos

- [`OperationsBaseRegister.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/components/OperationsBaseRegister.tsx:1) y [`operaciones.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/styles/operaciones.css:1) ahora aplican el mismo tratamiento de `select` superior tanto a Jornada como a Ingreso, eliminando el control nativo pequeño que seguía rompiendo la simetría visual del bloque.
- [`IncentiveRegistrationForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRegistrationForm.tsx:1) dejó de renderizar el bloqueo de negocio del preview como texto suelto en la rama `previewQuery.isError`; ahora reutiliza la misma alerta semántica del módulo con icono de emergencia.
- [`incentives.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/styles/incentives.css:1) refuerza la alerta roja con un contenedor más visible, cápsula de icono y copy jerarquizado dentro de la paleta del ERP.

## Hotfix del workflow `Sync BUK Employees`

- [x] Auditar el último run fallido del workflow `sync-buk.yml` y ubicar la operación exacta que dispara `statement timeout`
- [x] Endurecer `scripts/sync-buk-employees.mjs` para persistir páginas grandes sin depender de un solo `upsert` monolítico
- [x] Validar el script localmente y dejar el cierre auditado en este documento

## Resultado del hotfix del workflow `Sync BUK Employees`

- El run fallido [`28415240557`](https://github.com/maxcontrerasrey-spec/app_test_1/actions/runs/28415240557) no se cayó por credenciales ni por BUK. La traza mostró que la sync avanzó hasta la página `32/53` y luego abortó con `57014 / canceling statement due to statement timeout` dentro de la persistencia de página, antes incluso de imprimir el `Page 32/... synced ...`.
- La causa raíz era operativa: [`scripts/sync-buk-employees.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/sync-buk-employees.mjs:1) todavía dependía de dos `upsert` monolíticos por página de `100` empleados, y solo el snapshot diario tenía retry. Cuando el costo de escritura subió, una página completa dejó de entrar cómodamente dentro del timeout del proyecto.
- El script ahora:
  - resuelve la URL Supabase con semántica de primer valor no vacío (`VITE_SUPABASE_URL`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`);
  - parte la persistencia en chunks (`25` para `employees`, `20` para `buk_employees_daily_snapshot`);
  - aplica retry por chunk también sobre la tabla principal `employees`, no solo sobre el snapshot.
- Validación cerrada con:
  - `node --check scripts/sync-buk-employees.mjs`
  - `git diff --check`
  - corrida manual exitosa del workflow [`28415556775`](https://github.com/maxcontrerasrey-spec/app_test_1/actions/runs/28415556775), que completó `Run BUK Sync Script` en `5m15s` sin volver a caer por `statement timeout`

## Implementación de matriz de accesos desde `usuarios_busesjm.xlsx`

- [x] Versionar la matriz aterrizada en permisos finos de módulos y submódulos
- [x] Agregar capa `app_features`/`role_feature_access` y exponer `accessible_features` en `get_my_effective_permissions()`
- [x] Normalizar los grants de `role_module_access` para que todo lo no definido en el Excel quede solo para `admin`
- [x] Aplicar gating por submódulo en Reclutamiento, Jornadas, Incentivos y BI sin romper rutas ni estados actuales
- [x] Endurecer al menos las mutaciones críticas de Jornadas contra permisos finos reales
- [x] Validar con auditoría de migración, `TypeScript`, build frontend, `db push --dry-run`, aplicación remota, `git diff --check` y dejar cierre auditado en este documento

## Resultado de implementación de matriz de accesos desde `usuarios_busesjm.xlsx`

- La propuesta aterrizada quedó versionada en [`docs/access-matrix-propuesta-usuarios-busesjm.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/docs/access-matrix-propuesta-usuarios-busesjm.md:1), separando explícitamente módulos, submódulos, workflows y el bloque `admin only`.
- Se agregó la migración [`20260629173000_implement_enterprise_access_matrix_features.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260629173000_implement_enterprise_access_matrix_features.sql:1), que:
  - crea `app_features` y `role_feature_access`;
  - normaliza `role_module_access` según la matriz del Excel;
  - deja `acreditacion_personas`, `alta_operacional_personal`, `ai_assistant`, `operaciones`, `certificados` y `seguimiento_certificados` solo para `admin`;
  - amplía `get_my_effective_permissions()` para devolver `accessible_features`;
  - endurece Jornadas para que el backend distinga entre `roster_calendar`, `roster_assign_pattern` y `roster_manage_patterns`.
- En frontend, [`AuthContext.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/auth/context/AuthContext.tsx:1) ahora expone `accessibleFeatures`/`hasFeature`, y las pantallas de Reclutamiento, Jornadas, Incentivos y BI usan esa señal para mostrar solo los submódulos realmente autorizados y redirigir a la primera vista válida cuando corresponde.
- Aplicación remota confirmada en el proyecto enlazado: la migración quedó publicada en Supabase y las verificaciones SQL devolvieron `14` features activas y grants consistentes para roles como `reclutamiento`, `operaciones_l_2`, `control_contratos` y `admin`.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260629173000_implement_enterprise_access_matrix_features.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npx --yes supabase db push --linked --dry-run`
  - `npx --yes supabase db push --linked --include-all`
  - verificaciones SQL remotas sobre `app_features`, `role_feature_access` y `role_module_access`
  - `git diff --check`

## Idempotencia documental en reintentos de sync BUK

- [x] Auditar si `sync-buk-candidates` podía re-subir documentos ya enviados a BUK cuando un job fallaba a mitad de proceso
- [x] Corregir el retry para que reutilice el progreso parcial guardado en `buk_sync_jobs.result_snapshot`
- [x] Validar con auditoría SQL focalizada, `TypeScript`, build frontend, `db push --dry-run` y `git diff --check`

## Hardening enterprise de API, búsquedas y presión de consultas

- [x] Auditar las rutas de consulta más sensibles del ERP para detectar autorización insuficiente, colisiones de caché y ráfagas de refetch innecesarias
- [x] Endurecer las Edge Functions críticas para que solo ejecuten jobs o uploads dentro del ámbito autorizado del usuario o del webhook interno
- [x] Separar claves de React Query incompatibles y bajar refetch agresivo en vistas pesadas para reducir carga sobre frontend, PostgREST y base
- [x] Llevar la búsqueda de Acreditación de Personas al mismo patrón indexable enterprise usado en jornadas, movilidad e incentivos
- [x] Validar con auditoría de migración, `TypeScript`, build frontend, `db push --dry-run`, aplicación remota de la migración, deploy de Edge Functions y `git diff --check`

## Resultado del hardening enterprise de API, búsquedas y presión de consultas

- Se agregó la migración [`20260629113000_harden_enterprise_api_auth_and_accreditation_search.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260629113000_harden_enterprise_api_auth_and_accreditation_search.sql:1), que deja dos helpers internos de autorización (`authorize_buk_sync_jobs`, `authorize_candidate_document_cleanup_targets`) sin exposición a `authenticated` y recompila [`search_accreditation_workers(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260629113000_harden_enterprise_api_auth_and_accreditation_search.sql:58) sobre `public.employees` activos con el mismo patrón indexable de búsqueda ya usado por jornadas, movilidad e incentivos.
- [`sync-buk-candidates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1) ya no permite invocaciones interactivas abiertas sobre la cola completa. Fuera del webhook interno exige `jobIds` explícitos y valida que todos pertenezcan a casos gestionables por el usuario antes de reclamar jobs.
- [`purge-candidate-documents`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/purge-candidate-documents/index.ts:1) quedó con la misma disciplina: la sweep masiva nocturna sólo puede correr por webhook interno y una invocación interactiva debe venir acotada a candidatos autorizados concretos.
- [`upload-buk-accreditation-document`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/upload-buk-accreditation-document/index.ts:1) ahora exige JWT válido, permiso real de Acreditación de Personas y guardrails de archivo (`PDF/JPG/PNG`, máximo `10 MB`) antes de tocar BUK.
- En frontend se eliminaron dos focos de presión evitable:
  - [`queryKeys.incentives`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/lib/queryKeys.ts:1) ya separa explícitamente listas y páginas para evitar colisiones de caché entre payloads distintos;
  - los hooks pesados de `dashboard`, `recruitment`, `incentives`, `internal mobility` y `roster` dejaron de hacer `refetchOnWindowFocus/refetchOnReconnect` automático, conservando `staleTime`, `refetchInterval` e invalidaciones explícitas para no castigar a la base al volver al tab.
- [`AccreditationWorkersView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/accreditation/components/AccreditationWorkersView.tsx:1) ahora debouncea la búsqueda a `150 ms`, lo que evita round-trips por cada tecla en el módulo de acreditación.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260629113000_harden_enterprise_api_auth_and_accreditation_search.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npx --yes supabase db push --linked --dry-run`
  - `npx --yes supabase db push --linked --include-all`
  - `npx --yes supabase functions deploy sync-buk-candidates purge-candidate-documents upload-buk-accreditation-document --project-ref pzblmbahnoyntrhistea --use-api --yes`
  - `git diff --check`

## Carga inicial del calendario de jornadas DRT

- [x] Auditar el archivo base [`drt.xlsx`](/Users/maximilianocontrerasrey/Desktop/drt.xlsx) y reconciliarlo contra la dotación activa de `CODELCO DRT`
- [x] Versionar el origen normalizado y la conciliación de la carga en artefactos auditables del repositorio
- [x] Publicar la carga masiva de jornadas DRT sobre `hr_shift_patterns` y `hr_worker_rosters` sin romper las asignaciones existentes de otros contratos
- [x] Validar con auditoría de migraciones, `db push --dry-run`, aplicación remota y verificación SQL de conteos/resultados

## Resultado de la carga inicial del calendario de jornadas DRT

- El archivo fuente quedó aterrizado en [`data/seed/hr_roster_drt_20260628.json`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/data/seed/hr_roster_drt_20260628.json:1) y su conciliación operativa en [`data/seed/hr_roster_drt_20260628.audit.json`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/data/seed/hr_roster_drt_20260628.audit.json:1), dejando evidencia navegable del input y del cruce contra `employees_active_current`.
- La reconciliación cerró con una conclusión importante: el Excel trae `177` filas y la dotación activa DRT también suma `177`, pero el cruce exacto por `RUT` sólo encontró `175` coincidencias válidas. El archivo sigue mencionando a `11.724.567-5` y `10.421.699-4`, que ya no existen como trabajadores activos, mientras la dotación viva DRT ya incluye a `15.078.051-9` y `16.000.975-6`, que no vienen en la base Excel.
- Se agregó la migración [`20260628162000_import_drt_roster_calendar.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628162000_import_drt_roster_calendar.sql:1), que:
  - normaliza la carga del archivo en una tabla temporal auditable;
  - reutiliza o reactiva las pautas `10X5+5`, `4X3`, `5X2` y `7X7` en `hr_shift_patterns`;
  - proyecta sólo los `175` trabajadores activos realmente conciliados en `CODELCO DRT`;
  - cierra solapes previos sobre esos mismos trabajadores antes de insertar o actualizar la pauta vigente en `hr_worker_rosters`.
- La estrategia evita dos clases de error de alto costo: no inventa asignaciones para trabajadores ya inexistentes y tampoco pisa a ciegas a los dos trabajadores nuevos que hoy están activos en DRT pero todavía no forman parte del Excel recibido.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260628162000_import_drt_roster_calendar.sql`
  - `npx --yes supabase db push --linked --dry-run`
  - `npx --yes supabase db push --linked --include-all`
  - humo remoto por SQL/REST para confirmar `175` asignaciones DRT cargadas, distribución por pauta consistente con el archivo conciliado y preservación de las demás pautas del módulo
  - `git diff --check`

## Alineación del contrato legacy de onboarding operacional

- [x] Auditar la convivencia entre el onboarding legacy (`onboarding_processes`, `onboarding_employee_courses`) y el onboarding canónico (`employee_onboarding_*`, `alta_operacional_personal`)
- [x] Corregir permisos/RLS legacy para que dependan del helper canónico `user_can_access_operational_onboarding(...)` en vez del módulo legacy `reclutamiento`
- [x] Alinear la `route` registrada en `app_modules` para `alta_operacional_personal` con la ruta real protegida por React
- [x] Validar con auditoría SQL focalizada, `TypeScript`, build frontend, `db push --dry-run`, aplicación remota y `git diff --check`

## Resultado de alineación del contrato legacy de onboarding operacional

- La auditoría del loop mostró una doble deriva en onboarding: la UI viva y las RLS nuevas ya operan con el módulo `alta_operacional_personal`, pero la capa legacy creada en [`20260608175000_create_onboarding_module_tables.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608175000_create_onboarding_module_tables.sql:1) y [`20260608175500_onboarding_module_rpcs.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608175500_onboarding_module_rpcs.sql:1) seguía validando acceso contra `user_can_access_module(..., 'reclutamiento')`, que hoy no representa el contrato visible del módulo.
- Se agregó la migración [`20260628130000_align_operational_onboarding_legacy_permissions.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628130000_align_operational_onboarding_legacy_permissions.sql:1), que hace tres ajustes seguros sin cambiar payloads:
  - actualiza `app_modules.route` de `alta_operacional_personal` a `/alta-operacional`, que es la ruta real protegida por [`AppRouter.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/router/AppRouter.tsx:105);
  - reemplaza las políticas `SELECT` legacy por políticas que reutilizan `user_can_access_operational_onboarding((select auth.uid()))`;
  - recompila las RPCs legacy `start_employee_onboarding`, `get_onboarding_dashboard`, `get_employee_onboarding_detail` y `evaluate_onboarding_course` para exigir el mismo helper canónico.
- La migración quedó además endurecida para ambientes heterogéneos: si la capa legacy no existe físicamente, el ajuste se vuelve un no-op seguro para tablas/RPCs ausentes y aun así mantiene alineada la metadata del módulo en `app_modules`.
- El cambio reduce riesgo de incoherencia entre frontend, `app_modules`, RLS y RPCs: donde la superficie legacy exista, ya no queda autorizada por un módulo distinto al que realmente expone y protege la aplicación; donde no exista, la versión queda reconciliada sin romper el despliegue.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260628130000_align_operational_onboarding_legacy_permissions.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npx --yes supabase db push --linked --dry-run`
  - `npx --yes supabase db push --linked --include-all`
  - humo remoto vía `supabase db query --linked`:
    - `supabase_migrations.schema_migrations` confirmó la versión `20260628130000`;
    - `app_modules` confirmó `alta_operacional_personal -> /alta-operacional`;
    - `pg_proc` devolvió `0` filas para `start_employee_onboarding`, `get_onboarding_dashboard`, `get_employee_onboarding_detail` y `evaluate_onboarding_course`, confirmando que la capa legacy no está desplegada en el remoto enlazado y que la migración debe seguir siendo condicional.
  - `git diff --check`

## Alineación de ruta canónica para Acreditación de Personas

- [x] Auditar el contrato entre `app_modules`, navegación y router de Acreditación de Personas
- [x] Corregir la metadata SQL para que `acreditacion_personas` apunte a la ruta canónica actual y no al alias legacy
- [x] Validar con auditoría SQL focalizada, `TypeScript`, build frontend, aplicación remota y `git diff --check`

## Resultado de alineación de ruta canónica para Acreditación de Personas

- La auditoría del loop mostró otra deriva de catálogo similar a onboarding, pero más acotada: [`navigation.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/config/navigation.ts:80) y [`AppRouter.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/router/AppRouter.tsx:139) ya operan Acreditación de Personas bajo `/recursos-humanos/acreditacion/...`, mientras `app_modules.route` seguía registrando `/acreditacion`, que hoy existe solo como redirect legacy de compatibilidad.
- Se agregó la migración [`20260628134500_align_accreditation_module_route.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628134500_align_accreditation_module_route.sql:1), que actualiza `app_modules.route` de `acreditacion_personas` a `/recursos-humanos/acreditacion/dashboard` sin tocar `module_code`, grants, RLS ni consumers.
- El cambio reduce riesgo de deriva entre catálogo SQL y superficie real del ERP: cualquier consumo futuro de `app_modules.route` ya aterriza en la ruta canónica del módulo en vez del alias histórico.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260628134500_align_accreditation_module_route.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npx --yes supabase db push --linked --dry-run`
  - `npx --yes supabase db push --linked --include-all`
  - humo remoto vía `supabase db query --linked` para confirmar `acreditacion_personas -> /recursos-humanos/acreditacion/dashboard`
  - `git diff --check`

## Hotfix del workflow Purge Terminal Candidate Documents

- [x] Auditar el workflow de GitHub Actions y el script `purge-terminal-candidate-documents.mjs` contra el último run fallido
- [x] Corregir el selector de URL Supabase para que use la primera variable no vacía y no falle si `SUPABASE_URL` viene definida como string vacío
- [x] Validar typecheck/build y reproducir localmente el escenario del run fallido

## Resultado del hotfix del workflow Purge Terminal Candidate Documents

- El fallo del run `28313347787` no vino de Supabase ni del secreto del webhook. El workflow validó correctamente que existía una URL usable vía `VITE_SUPABASE_URL`, pero el script [`purge-terminal-candidate-documents.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/purge-terminal-candidate-documents.mjs:1) resolvía la URL con `env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL`.
- Como GitHub Actions inyectó `SUPABASE_URL` como string vacío y `VITE_SUPABASE_URL` con valor real, el operador `??` se quedó con `""` y `requireEnv(...)` terminó abortando con `Missing SUPABASE_URL`, exactamente como se vio en el log del job `purge`.
- El script ahora usa `firstNonEmpty(...)` para elegir la primera variable realmente usable entre `SUPABASE_URL`, `VITE_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_URL`, alineándose con la lógica del paso `Validate required purge variables` del workflow. Además, `process.env` vuelve a tener prioridad sobre `.env.local`, evitando que pruebas locales o ejecuciones automatizadas queden contaminadas por un archivo de desarrollo.
- Validación cerrada con:
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - reproducción local del escenario del run fallido con `SUPABASE_URL=''` y `VITE_SUPABASE_URL` poblada, comprobando que el script ya no aborta por `Missing SUPABASE_URL`
  - `git diff --check`

## Resultado de idempotencia documental en reintentos de sync BUK

- La auditoría del loop mostró un riesgo funcional después del blindaje de auth/concurrencia: si [`sync-buk-candidates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1) subía algunos documentos a BUK y luego fallaba más adelante, el retry reconstruía el payload completo y podía volver a intentar subir esos mismos documentos externos.
- Se reutilizó el mismo endurecimiento de cola [`20260628054500_claim_buk_sync_jobs_atomically.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628054500_claim_buk_sync_jobs_atomically.sql:1) para devolver también `result_snapshot`, y la Edge Function ahora usa `result_snapshot.documents` como evidencia de progreso parcial al reintentar el mismo job.
- [`sync-buk-candidates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1) ya no vuelve a procesar documentos cuyo `sourceDocumentId` quedó registrado como subido en un intento previo del mismo job, reduciendo duplicación de side effects en BUK cuando la falla ocurre después de una carga parcial.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260628054500_claim_buk_sync_jobs_atomically.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npx --yes supabase db push --linked --dry-run`
  - `git diff --check`

## Blindaje de seguridad y concurrencia en la sync BUK

- [x] Auditar el flujo `Generar en BUK` entre `HiringPersonnelToHireView`, `enqueue_buk_generation(...)`, `buk_sync_jobs` y la Edge Function `sync-buk-candidates`
- [x] Corregir la exposición pública de la function y la reclamación no atómica de la cola
- [x] Validar con auditoría SQL focalizada, `TypeScript`, build frontend, `db push --dry-run` y `git diff --check`

## Resultado de blindaje de seguridad y concurrencia en la sync BUK

- La auditoría del loop mostró dos huecos de alto riesgo en la misma Edge Function [`sync-buk-candidates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1): no validaba JWT ni secreto interno antes de procesar la cola BUK, y seguía usando el patrón frágil `select pending -> update processing` en dos pasos.
- Se agregó la migración [`20260628054500_claim_buk_sync_jobs_atomically.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628054500_claim_buk_sync_jobs_atomically.sql:1), que versiona [`claim_buk_sync_jobs(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628054500_claim_buk_sync_jobs_atomically.sql:1) para reclamar jobs `pending/error` con `FOR UPDATE SKIP LOCKED` y dejarlos en `processing` dentro de la misma operación.
- La Edge Function [`sync-buk-candidates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1) ahora:
  - exige `Authorization: Bearer ...` válido o un secreto interno opcional `BUK_SYNC_INTERNAL_WEBHOOK_SECRET` antes de tocar la cola;
  - usa la reclamación atómica SQL y deja de hacer la transición a `processing` en un segundo round-trip.
- El cambio reduce riesgo en dos dimensiones a la vez: evita ejecuciones públicas no autenticadas sobre una integración sensible con BUK y reduce duplicación de jobs cuando hay reintentos o invocaciones superpuestas.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260628054500_claim_buk_sync_jobs_atomically.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npx --yes supabase db push --linked --dry-run`
  - `git diff --check`

## Selección exacta de targets para la sweep documental nocturna

- [x] Auditar si el barrido histórico de candidatos terminales con documentos remanentes dependía de una muestra parcial de `candidate_documents`
- [x] Corregir la selección de targets para que el `limit` se aplique sobre candidatos elegibles reales y no sobre residuos documentales arbitrarios
- [x] Validar con auditoría SQL focalizada, `TypeScript`, build frontend, `db push --dry-run` y `git diff --check`

## Resultado de selección exacta de targets para la sweep documental nocturna

- La revisión del loop mostró una segunda fragilidad en la misma purga nocturna: [`enqueueSweepJobs(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/purge-candidate-documents/index.ts:99) tomaba primero una muestra limitada de `candidate_documents` y recién después buscaba candidatos terminales compatibles. Ese orden hacía que el `limit` real se aplicara sobre residuos documentales y no sobre candidatos descartados elegibles.
- Se agregó la migración [`20260628050000_exact_terminal_cleanup_sweep_targets.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628050000_exact_terminal_cleanup_sweep_targets.sql:1), que versiona [`list_terminal_candidate_cleanup_targets(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628050000_exact_terminal_cleanup_sweep_targets.sql:1) para seleccionar exactamente candidatos en `rejected/withdrawn` con documentos remanentes y sin jobs activos, aplicando el `limit` sobre entidades de negocio reales.
- La Edge Function [`purge-candidate-documents`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/purge-candidate-documents/index.ts:99) ahora usa esa lista exacta y deja de depender de un muestreo parcial de `candidate_documents`, reduciendo el riesgo de que descartados antiguos con documentos vivos queden fuera de la limpieza nocturna solo por volumen.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260628050000_exact_terminal_cleanup_sweep_targets.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npx --yes supabase db push --linked --dry-run`
  - `git diff --check`

## Reclamación atómica de la cola de purga documental nocturna

- [x] Auditar la interacción entre `advance_recruitment_candidate_stage(...)`, `candidate_document_cleanup_jobs`, la Edge Function `purge-candidate-documents` y el scheduler nocturno
- [x] Corregir el riesgo de doble procesamiento cuando dos invocaciones reclaman la misma cola en paralelo
- [x] Validar con auditoría SQL focalizada, `TypeScript`, build frontend, `db push --dry-run` y `git diff --check`

## Resultado de reclamación atómica de la cola de purga documental nocturna

- La implementación previa ya resolvía la seguridad funcional del contexto terminal y la reactivación del candidato, pero seguía teniendo una carrera operativa: [`purge-candidate-documents`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/purge-candidate-documents/index.ts:1) primero leía jobs `pending/error` y recién después los marcaba `processing`, dejando una ventana donde dos invocaciones podían tomar el mismo lote.
- Se agregó la migración [`20260628043000_claim_candidate_document_cleanup_jobs_atomically.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628043000_claim_candidate_document_cleanup_jobs_atomically.sql:1), que versiona [`claim_candidate_document_cleanup_jobs(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628043000_claim_candidate_document_cleanup_jobs_atomically.sql:1) con `FOR UPDATE SKIP LOCKED` y el cambio a `processing` dentro de la misma reclamación.
- La Edge Function [`purge-candidate-documents`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/purge-candidate-documents/index.ts:1) ahora usa esa reclamación atómica y deja de hacer el patrón frágil “select pending -> update processing” en dos round-trips separados.
- El cambio reduce un riesgo transversal entre scheduler, storage y auditoría: una corrida manual, repetida o superpuesta ya no debería traducirse en dobles borrados sobre `candidate-docs`, errores espurios de limpieza ni eventos `candidate_documents_purged` duplicados por el mismo job.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260628043000_claim_candidate_document_cleanup_jobs_atomically.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npx --yes supabase db push --linked --dry-run`
  - `git diff --check`
- Validación no disponible en este entorno:
  - `deno check supabase/functions/purge-candidate-documents/index.ts` no pudo ejecutarse porque `deno` no está instalado en la sesión actual.

## Endurecimiento de tareas vigentes en Inicio

- [x] Auditar `get_dashboard_tasks(...)` contra `DashboardHome`, `TasksWidget`, estados de reclutamiento, movilidad interna y aprobaciones Who para detectar tareas potencialmente huérfanas
- [x] Corregir la RPC para que solo exponga aprobaciones cuya etapa siga viva según `current_step_code` o `stage_code` canónico
- [x] Validar con auditoría SQL focalizada, `TypeScript`, build frontend y `git diff --check`

## Resultado de endurecimiento de tareas vigentes en Inicio

- La auditoría del loop mostró una asimetría de contrato dentro del propio dashboard: [`get_dashboard_approval_tracking()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628023000_exclude_closed_hiring_requests_from_dashboard_approval_tracking.sql:1) ya quedó amarrado a la etapa viva del request, pero [`get_dashboard_tasks(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628033000_harden_dashboard_tasks_active_step_alignment.sql:1) seguía confiando solo en filas `pending`.
- Se agregó la migración [`20260628033000_harden_dashboard_tasks_active_step_alignment.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628033000_harden_dashboard_tasks_active_step_alignment.sql:1), que endurece tres frentes sin cambiar el contrato consumido por React:
  - aprobaciones de contratación solo aparecen si `hiring_requests.status` sigue en `pending_area_manager` o `pending_contracts_control` y `hiring_request_approvals.step_code = hiring_requests.current_step_code`;
  - aprobaciones de movilidad interna solo aparecen si `internal_mobility_requests` sigue en etapa pendiente equivalente y el `step_code` coincide con `current_step_code`;
  - aprobaciones Who solo aparecen si la participación del candidato sigue realmente en `recruitment_case_candidates.stage_code = 'who_pending'` y el caso sigue operativo.
- El cambio reduce una clase de riesgo silenciosa: que Inicio o las notificaciones revivan tareas ya cerradas por un rezago de datos, aunque hoy la muestra manual del remoto no expuso filas huérfanas para contratación.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260628033000_harden_dashboard_tasks_active_step_alignment.sql`
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`

## Auditoría enterprise, tipografía SF segura y hardening de Inicio + búsqueda de trabajadores

- [x] Auditar el contrato vivo entre `Inicio`, `get_dashboard_home_bundle(...)`, `get_dashboard_operational_summary()` y `get_recruitment_control_summary()` para explicar por qué el resumen de reclutamiento abierto muestra menos casos que los existentes
- [x] Corregir de forma incremental y versionada la métrica/RPC responsable para alinear `Inicio` con el universo operativo real sin romper visibilidad por rol ni las bandejas actuales
- [x] Aplicar la mejora tipográfica enterprise inspirada en Apple/SF de forma centralizada y legal, reutilizando `Inter` ya disponible, endureciendo jerarquía y legibilidad, y agregando tratamiento numérico tabular donde aporte valor ERP
- [x] Reducir la latencia de búsqueda de trabajadores por debajo de 1 segundo mediante la ruta más segura entre SQL, índices y UX del lookup, sin crear una segunda fuente de verdad BUK
- [x] Validar con auditoría SQL focalizada, `TypeScript`, build frontend, `git diff --check` y, si el entorno responde, humo real de las RPCs afectadas antes de commitear y subir a `main`

## Resultado de auditoría enterprise, tipografía SF segura y hardening de Inicio + búsqueda de trabajadores

- La deriva de `Inicio` quedó acotada a backend y no a React: `get_dashboard_operational_summary()` contaba reclutamiento con un motor distinto de [`get_recruitment_control_summary()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260625022401_harden_recruitment_mobility_enterprise_scale.sql:32), mientras la visibilidad gerencial dependía de una comparación literal de CECO en [`user_can_view_hiring_request_process_summary(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627153000_harden_dashboard_and_worker_search_enterprise.sql:106). La migración nueva [`20260627153000_harden_dashboard_and_worker_search_enterprise.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627153000_harden_dashboard_and_worker_search_enterprise.sql:1) normaliza ambos CECO y hace que el bloque de reclutamiento en Inicio reutilice el resumen operativo vivo para `open_processes`, `ready_to_hire_cases` y `filled_cases`.
- El bloque inferior de `Folios en curso` dejó de depender del payload capado del bundle de Inicio. [`ActiveFoliosWidget.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/ActiveFoliosWidget.tsx:1) ahora consume [`useRecruitmentProcessesPage(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/hooks/useRecruitmentQueries.ts:129) con paginación y búsqueda server-side, preservando el detalle expandible pero mostrando todo el universo visible por página en vez de quedarse limitado al subset cargado por `get_dashboard_home_bundle(...)`.
- La búsqueda de trabajadores quedó endurecida en la capa correcta: la misma migración agrega helpers indexables (`build_active_employee_search_text`, `build_employee_document_digits`, `build_active_employee_identity_key`), índices `pg_trgm` sobre `public.employees` y un índice parcial para trabajadores bloqueados de movilidad. Las RPCs [`search_hr_incentive_eligible_workers(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627153000_harden_dashboard_and_worker_search_enterprise.sql:319), [`search_internal_mobility_workers(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627153000_harden_dashboard_and_worker_search_enterprise.sql:435), [`search_hr_roster_workers(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627153000_harden_dashboard_and_worker_search_enterprise.sql:544) y [`get_hr_roster_calendar_summary(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627153000_harden_dashboard_and_worker_search_enterprise.sql:623) dejaron de apoyarse en el hot path no-sargable sobre `employees_active_current` y ahora filtran primero sobre `employees` activos con helpers reutilizables antes de deduplicar identidad.
- También se recortó fricción evitable en frontend: los tres lookups de trabajador redujeron debounce a `150 ms`, y [`RosterWorkerLookup.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster/components/RosterWorkerLookup.tsx:1) ya no dispara el filtro secundario del resumen mensual por cada tecla sin pausa, sino recién cuando la búsqueda debounced se estabiliza.
- La capa tipográfica quedó centralizada y legal: [`src/main.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/main.tsx:1) carga `Inter` desde `@fontsource` en subset `latin`, y [`src/styles/global.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/styles/global.css:1) ahora define un stack `Inter + system`, jerarquía de headings sobria, colores de texto más consistentes y `font-variant-numeric: tabular-nums` para métricas, tablas y resúmenes de dashboard.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260627153000_harden_dashboard_and_worker_search_enterprise.sql`
  - `npx tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`
  - `npx --yes supabase db push --linked --dry-run`
  - `npx --yes supabase db push --linked --include-all`
  - humo remoto vía `supabase db query --linked`:
    - `pg_get_functiondef(...)` confirmó la normalización CECO en `user_can_view_hiring_request_process_summary(...)`;
    - `pg_get_functiondef(...)` confirmó que `get_dashboard_operational_summary()` reutiliza `get_recruitment_control_summary()`;
    - `pg_indexes` confirmó `idx_employees_active_worker_search_text_trgm`, `idx_employees_active_name_search_prefix`, `idx_employees_active_document_digits_trgm` e `idx_internal_mobility_requests_blocked_worker_lookup`.

## Ejecucion visible del prompt de auditoria enterprise ERP

- [x] Releer el prompt de auditoria y convertir su ejecucion en artefactos versionados visibles dentro del repo
- [x] Levantar documentacion viva minima de arquitectura, modelo de datos, modulos, permisos, auditoria, humo, deployment, rollback y security review
- [x] Registrar hallazgos vigentes que quedaron fuera del cambio funcional anterior, incluyendo deuda legacy de onboarding
- [x] Dejar esta ejecucion trazable en `tasks/todo.md` y `tasks/lessons.md`

## Resultado de ejecucion visible del prompt de auditoria enterprise ERP

- La corrida del prompt ya no queda implicita solo en cambios de SQL/frontend. Se versionaron documentos concretos en `docs/` para que cualquier auditor vea estado actual, riesgos, cambios recientes y forma de operar sin depender de memoria tribal:
  - `docs/architecture.md`
  - `docs/database-model.md`
  - `docs/permissions-matrix.md`
  - `docs/audit-logs.md`
  - `docs/smoke-tests.md`
  - `docs/deployment.md`
  - `docs/rollback.md`
  - `docs/module-map.md`
  - `docs/security-review.md`
- La ejecucion deja explicitado el contrato actual entre frontend, AuthContext, `get_my_effective_permissions()`, rutas protegidas y helpers `user_can_*`, en vez de asumir que el endurecimiento ya era autoevidente por las migraciones.
- Tambien queda documentado un hallazgo vigente que no convenia esconder: existe SQL legacy de onboarding que sigue usando `user_can_access_module(..., 'reclutamiento')` aunque `'reclutamiento'` es rol y no modulo. El backend nuevo de alta operacional ya opera con `alta_operacional_personal`, por lo que el riesgo actual es de coherencia/legado y debe corregirse cuando se sanee ese bloque viejo.
- Esta pasada no agrego otra correccion funcional productiva porque el objetivo puntual era hacer visible y auditable la ejecucion del prompt sin abrir un frente fuera de alcance ni mezclar una cirugia adicional no pedida con el cierre documental.

## Simplificacion del registro de incentivos y alertas de prohibicion

- [x] Eliminar del formulario la confirmacion manual redundante `En descanso` y derivar el valor desde el cruce vivo con Jornadas
- [x] Convertir los bloqueos/prohibiciones de negocio del formulario de incentivos a alertas rojas con icono warning y paleta ERP vigente
- [x] Eliminar `Observaciones complementarias`, dejando `Motivo operacional` como unico texto libre
- [x] Validar `TypeScript`, build frontend y `git diff --check`

## Resultado de simplificacion del registro de incentivos y alertas de prohibicion

- [`IncentiveRegistrationForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRegistrationForm.tsx:1) ya no pide la confirmacion manual `En descanso`. El formulario deriva `declaredRestDay` desde `useHrIncentiveRosterSnapshot(...)` y sigue enviando ese valor al backend para conservar el contrato y la persistencia auditada sin forzar una reconfirmacion humana redundante.
- El mensaje de prohibicion por descanso/reemplazo y los bloqueos equivalentes del formulario dejaron de renderizarse como texto rojo plano. Ahora usan una alerta dedicada con icono warning y paleta roja enterprise definida en [`incentives.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/styles/incentives.css:1).
- [`IncentiveOperationalFlags.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveOperationalFlags.tsx:1) ya no muestra la pill derivada de `declaredRestDay`, evitando repetir en la UI una señal que el usuario ya ve en el cruce operativo del roster.
- Se eliminó `Observaciones complementarias`; el único texto libre del alta quedó en `Motivo operacional`, que es el campo con valor de negocio real para este flujo.
- Validación cerrada con `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.

## Ajuste de labels del menu de Reclutamiento

- [x] Auditar la configuracion viva del menu de Reclutamiento y la regla visual del dropdown para evitar filas dobles
- [x] Renombrar `Movilidad Interna` a `Solicitud de Movilidad Interna` y `Alta Operacional (Admin)` a `Onboarding`
- [x] Validar `TypeScript`, build frontend y `git diff --check`

## Resultado de ajuste de labels del menu de Reclutamiento

- [`navigation.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/config/navigation.ts:1) ahora expone `Solicitud de Movilidad Interna` y `Onboarding` como labels del submenu de `Reclutamiento`, sin tocar rutas, permisos ni `moduleCode`.
- [`global.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/styles/global.css:770) endurece el contrato visual del dropdown con `min-width`, `width: max-content` y `max-width` acotado para que labels mas largos sigan entrando en una sola fila y el panel no genere dobles lineas.
- Validación cerrada con `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.

## Ajuste neumorfico de paginacion en tablas

- [x] Auditar el paginador visible que usa `Anterior` y `Siguiente` para ubicar por qué no seguía la estetica neumorfica del ERP
- [x] Unificar el paginador de `Folios en curso` con el mismo boton base del sistema y endurecer el estilo de paginacion compartida
- [x] Validar `TypeScript`, build frontend y `git diff --check`

## Resultado de ajuste neumorfico de paginacion en tablas

- [`ActiveFoliosWidget.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/ActiveFoliosWidget.tsx:414) dejó de usar el botón aislado que rompía la continuidad visual y ahora reutiliza `soft-primary-button` junto a la variante compartida de paginación.
- [`global.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/styles/global.css:2997) endurece el contrato visual de `tracking`, `movilidad` e `incentivos` con una misma variante neumórfica para `Anterior/Siguiente`: relieve exterior, hover con lift sutil, estado presionado inset y disabled hundido en la misma paleta del sistema.
- Validación cerrada con `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.

## Ordenamiento completo del resumen de folios y contraste de KPI en Control de Contrataciones

- [x] Auditar el contrato entre el resumen de `Folios en curso` y `get_recruitment_processes_page(...)` para identificar por qué no todas las columnas quedaban ordenables
- [x] Corregir el mapping de sort del resumen para que todas las columnas salvo `Días Abierto` usen claves válidas del backend
- [x] Reforzar contraste, borde y sombra de la tarjeta `Folios activos en búsqueda` sin romper la grilla ni la paleta actual
- [x] Validar `TypeScript`, build frontend y `git diff --check`

## Resultado de ordenamiento completo del resumen de folios y contraste de KPI en Control de Contrataciones

- [`ActiveFoliosWidget.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/ActiveFoliosWidget.tsx:18) ahora tipa las claves ordenables del resumen y corrige `Cupos` para usar `vacancies`, que es la clave real aceptada por `get_recruitment_processes_page(...)`. Con eso, `Caso`, `Estado`, `Cargo`, `Contrato / CC`, `Cupos` y `Candidatos activos` vuelven a ordenar de verdad; `Días Abierto` sigue explícitamente fuera del sort.
- [`HiringStatusPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringStatusPage.tsx:338) agrega una clase específica solo a la tarjeta `Folios activos en búsqueda`, y [`global.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/styles/global.css:3258) le da más borde, contraste cálido y una sombra mejor definida para que no se funda con el fondo ni parezca sin bordes.
- Validación cerrada con `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.

## Hotfix de ordenamiento por dias abierto en Inicio

- [x] Auditar por qué la columna `Días Abierto` del resumen de folios en Inicio seguía sin ordenar pese a tener header visible
- [x] Habilitar `opened_at` como sort explícito tanto en `ActiveFoliosWidget` como en `get_recruitment_processes_page(...)`
- [x] Validar migración SQL, `TypeScript`, build frontend y `git diff --check`

## Resultado de hotfix de ordenamiento por dias abierto en Inicio

- [`ActiveFoliosWidget.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/ActiveFoliosWidget.tsx:20) dejó de tratar `Días Abierto` como excepción: el header ahora es clickeable, muestra icono de orden y alterna `asc`, `desc` y reset igual que el resto de columnas.
- Se versionó la migración [`20260627164000_enable_opened_at_sort_for_dashboard_folios.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627164000_enable_opened_at_sort_for_dashboard_folios.sql:1), que amplía `get_recruitment_processes_page(...)` para aceptar `opened_at` como `p_sort_column` válido y ordenar explícitamente por `sort_opened_at` en ambos sentidos.
- La corrección no quedó solo local: `npx --yes supabase db push --linked --include-all` aplicó la migración al proyecto remoto enlazado, así que el sort por antigüedad ya puede funcionar también en el entorno vivo que consume esa RPC.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260627164000_enable_opened_at_sort_for_dashboard_folios.sql`, `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.

## Aterrizaje enterprise de auditoría de reclutamiento, movilidad y sync BUK

- [x] Contrastar la auditoría adjunta contra el estado vivo del SQL, las RPCs y la Edge Function `sync-buk-candidates`
- [x] Corregir el orden de locks de `sync_recruitment_case_status(...)` para eliminar el camino de deadlock con `close_hiring_request(...)`
- [x] Endurecer `transfer_candidate_to_case(...)` para resincronizar caso origen y destino sin introducir nuevos interbloqueos
- [x] Crear caché local versionado para ubicaciones BUK y reutilizarlo desde `sync-buk-candidates` con TTL y fallback resiliente
- [x] Aplicar la migración en Supabase, desplegar la Edge Function corregida, validar build/auditoría y documentar el cierre auditable

## Resultado de aterrizaje enterprise de auditoría de reclutamiento, movilidad y sync BUK

- La auditoría adjunta quedó confirmada como vigente en sus tres hallazgos principales: el riesgo de deadlock entre [`close_hiring_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260625213000_reopen_recruitment_slots_after_internal_mobility_rejection.sql:155) y [`sync_recruitment_case_status(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260625214500_refine_reopen_closed_folios_to_rejected_mobility_release.sql:3), la deriva de contadores al mover candidatos entre folios y la latencia redundante de `GET /locations` en la Edge Function BUK.
- Se agregó y aplicó en Supabase la migración [`20260625233000_harden_recruitment_sync_and_buk_locations_cache.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260625233000_harden_recruitment_sync_and_buk_locations_cache.sql:1), que introduce `public.buk_locations`, rehace `sync_recruitment_case_status(...)` con orden de lock `hiring_requests -> recruitment_cases`, y endurece [`transfer_candidate_to_case(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260625233000_harden_recruitment_sync_and_buk_locations_cache.sql:203) para resincronizar ambos casos con orden determinista por UUID.
- La corrección del traslado no se limitó a “llamar sync dos veces”: el backend ahora sincroniza origen y destino en un orden estable, evitando crear un segundo vector de deadlock si dos traslados concurrentes cruzan folios distintos en sentidos opuestos.
- [`sync-buk-candidates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1) dejó de consultar todas las localizaciones de BUK en cada corrida. Ahora lee `public.buk_locations`, refresca solo cuando el caché expira (TTL por defecto: 12 horas, configurable por `BUK_LOCATIONS_CACHE_TTL_HOURS`) y, si BUK falla pero existe caché previa, continúa con fallback stale en vez de abortar el procesamiento completo.
- El runtime quedó efectivamente publicado: además de versionar el cambio en repo, se desplegó `sync-buk-candidates` al proyecto `pzblmbahnoyntrhistea` con `npx --yes supabase functions deploy sync-buk-candidates --project-ref pzblmbahnoyntrhistea --use-api --yes`.
- Se corrigió también la deriva del historial remoto del conector Supabase: `apply_migration` registró la migración con timestamp `20260625224046`, por lo que se normalizó `supabase_migrations.schema_migrations` al versionado real `20260625233000` para que producción y repo no intenten re-aplicar el mismo cambio en el siguiente `db push`.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260625233000_harden_recruitment_sync_and_buk_locations_cache.sql`
  - `npx tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`
  - humo remoto vía Supabase:
    - `pg_get_functiondef('public.sync_recruitment_case_status(uuid, uuid)'::regprocedure)` confirmó el lock order corregido;
    - `pg_get_functiondef('public.transfer_candidate_to_case(uuid, uuid, text)'::regprocedure)` confirmó la resincronización determinista de ambos casos;
    - `information_schema.columns` confirmó la creación de `public.buk_locations`;
- `list_edge_functions` confirmó la publicación vigente de `sync-buk-candidates`.

## Hardening de resolución de ubicación en widget de clima

- [x] Auditar el flujo de geolocalización, reverse geocoding y fallback por IP del widget de clima
- [x] Corregir la resolución aproximada de ubicación para que no degrade a labels inválidos o errores textuales cuando fallen los proveedores primarios
- [x] Validar `TypeScript`, build frontend y `git diff --check`

## Resultado de hardening de resolución de ubicación en widget de clima

- [`DashboardInfoCards.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardInfoCards.tsx:1) dejó de depender de un único fallback frágil para ubicación por red. Ahora intenta primero `BigDataCloud` por IP con el mismo contrato de reverse geocoding que ya usa para coordenadas, y solo después cae a `geojs`.
- El parsing del fallback quedó endurecido: ciudad, región y código de país ahora se resuelven de forma defensiva, las coordenadas se validan con `Number.isFinite`, y solo se persiste caché cuando el payload tiene label y lat/lon utilizables.
- El caché local de ubicación dejó de mezclar orígenes incompatibles. Ahora persiste `isFallback`, distingue `Última ubicación conocida` de `Última ubicación aproximada`, y evita que una ubicación aproximada vuelva a entrar como si fuera geolocalización real en la lógica de reintento.
- El fetch meteorológico también quedó endurecido frente a carreras: el widget ahora ignora aborts de requests viejas, valida `response.ok` antes de parsear Open Meteo y solo permite que la request activa escriba `weather`, evitando que una respuesta cancelada limpie el forecast correcto.
- La consulta a Open Meteo ya no puede quedar esperando indefinidamente por lentitud del proveedor. [`DashboardInfoCards.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardInfoCards.tsx:1) ahora usa `fetchJsonWithTimeout(...)` con `WEATHER_REQUEST_TIMEOUT_MS = 8000`, enlazado al `AbortController` del effect para que timeout local, cambio de ubicación y unmount compartan el mismo camino de salida.
- El contrato visual también quedó alineado: [`DashboardWeatherCard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardWeatherCard.tsx:1) ahora consume `locationStatusLabel` y muestra el estado operativo de ubicación cuando la tarjeta está resolviendo o en fallback, en vez de calcularlo en el padre y descartarlo silenciosamente.
- Cuando no se puede resolver una ubicación aproximada, el widget ya no muestra `Error: ...` como label visible. Degrada a la ubicación por defecto con un `statusLabel` explícito, manteniendo operativo el widget de clima sin exponer ruido técnico al usuario final.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false` y `git diff --check`.

## Hardening transaccional del upload documental en reclutamiento

- [x] Auditar el flujo `storage -> RPC -> checklist` en la carga documental de candidatos para detectar residuos o drift entre binario y metadato
- [x] Corregir de forma mínima el caso donde el archivo sube a `candidate-docs` pero la RPC documental falla y deja blobs huérfanos
- [x] Validar `TypeScript` y `git diff --check`

## Resultado de hardening transaccional del upload documental en reclutamiento

- [`CandidateDocumentChecklist.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateDocumentChecklist.tsx:1) ahora trata la carga documental como una operación compensable: si el archivo ya subió a `candidate-docs` pero [`upload_candidate_document(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260605121500_restrict_candidate_control_access.sql:445) falla por permisos, validación o estado del candidato, el frontend elimina inmediatamente el blob recién creado.
- El cambio reduce residuos en storage sin tocar SQL, RLS ni contratos RPC. El binario solo queda persistido cuando la referencia de base se registró correctamente.
- La ruta de error también quedó más diagnóstica: si falla tanto la RPC como la limpieza compensatoria, el usuario recibe un mensaje explícito indicando que además no se pudo limpiar el archivo temporal.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false` y `git diff --check`.

## Alineación de audit log con eventos documentales vivos de reclutamiento

- [x] Contrastar los `action_type` realmente emitidos por las RPCs documentales contra la constraint vigente de `recruitment_case_audit_log`
- [x] Corregir por migración incremental la desalineación entre funciones vivas y constraint, sin tocar permisos ni contratos RPC
- [x] Validar `TypeScript` y `git diff --check`

## Resultado de alineación de audit log con eventos documentales vivos de reclutamiento

- La revisión del flujo documental mostró un drift real entre backend y esquema: [`reset_candidate_document_validation(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260609121500_expand_hiring_summary_and_document_validation.sql:221) y [`approve_candidate_documentation(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260609121500_expand_hiring_summary_and_document_validation.sql:684) insertan `candidate_document_validation_reset` y `candidate_documentation_approved`, pero la última constraint versionada de `recruitment_case_audit_log` no los aceptaba.
- Se agregó la migración [`20260627223000_allow_candidate_document_audit_actions.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627223000_allow_candidate_document_audit_actions.sql:1), que recompone el `CHECK` de `recruitment_case_audit_log_action_type_check` incluyendo ambos eventos junto con `candidate_documents_purged`.
- El cambio reduce riesgo de errores en runtime justo en la trazabilidad documental: las RPCs vivas ya no quedan en situación de intentar auditar un evento que el propio esquema rechaza.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false` y `git diff --check`.

## Acotación de resets documentales multi-caso por cambios de perfil

- [x] Auditar si una edición de `candidate_profiles` estaba reseteando validaciones documentales de más cuando la persona participa en varios casos
- [x] Restringir el trigger a cambios en campos que realmente gobiernan el checklist documental
- [x] Validar `TypeScript` y `git diff --check`

## Resultado de acotación de resets documentales multi-caso por cambios de perfil

- La función [`trg_reset_candidate_document_validation_from_profile()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260609121500_expand_hiring_summary_and_document_validation.sql:346) reseteaba validación documental de todos los casos del perfil ante cualquier `UPDATE` sobre `candidate_profiles`, incluso si el cambio era ajeno al checklist.
- Se agregó la migración [`20260627230000_scope_candidate_profile_document_validation_reset.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627230000_scope_candidate_profile_document_validation_reset.sql:1), que deja el reset solo para cambios en campos efectivamente usados por el checklist personal: documento, identidad, sexo, nacionalidad, nacimiento, estado civil y domicilio.
- El cambio reduce falsos resets multi-caso sin tocar RLS, RPCs ni la lógica de validación real. Una persona puede seguir participar en varios casos, pero ya no pierde aprobación documental por modificaciones irrelevantes del perfil compartido.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false` y `git diff --check`.

## Alineación del checklist documental con la ficha contractual BUK

- [x] Auditar el contrato entre `CandidateWorkerFileForm`, `get_candidate_checklist(...)` y `approve_candidate_documentation(...)` para detectar discrepancias entre campos obligatorios UI y backend
- [x] Corregir por migración incremental el campo contractual faltante y acotar los resets automáticos del worker file a cambios que realmente afectan la aprobación documental
- [x] Validar `TypeScript` y `git diff --check`

## Resultado de alineación del checklist documental con la ficha contractual BUK

- La auditoría del loop mostró un drift real de contrato: [`CandidateWorkerFileForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateWorkerFileForm.tsx:157) exige `Periodo de pago` como obligatorio, y la cola BUK también lo trata como requisito contractual, pero [`get_candidate_checklist(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260609121500_expand_hiring_summary_and_document_validation.sql:389) no lo consideraba dentro de `missing_worker_fields`.
- Se agregó la migración [`20260627233000_align_worker_file_document_validation_contract.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627233000_align_worker_file_document_validation_contract.sql:1), que incorpora `payment_period` al cálculo de `worker_file_complete` y por lo tanto al bloqueo real de [`approve_candidate_documentation(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260609121500_expand_hiring_summary_and_document_validation.sql:684).
- La misma migración endurece [`trg_reset_candidate_document_validation_from_worker_file()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627233000_align_worker_file_document_validation_contract.sql:1) para que un `UPDATE` sobre `candidate_worker_files` solo resetee la aprobación documental cuando cambian campos que gobiernan la completitud contractual, evitando falsos resets por notas o metadatos no decisorios.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false` y `git diff --check`.

## Trazabilidad exacta de revisión documental por candidato-participación

- [x] Auditar `review_candidate_document(...)` para verificar si el audit log resolvía el `recruitment_case_candidate_id` exacto o lo infería de forma ambigua por `candidate_profile_id`
- [x] Corregir la RPC y el cliente para que la revisión documental audite la participación exacta del candidato dentro del caso
- [x] Validar `TypeScript` y `git diff --check`

## Resultado de trazabilidad exacta de revisión documental por candidato-participación

- La revisión mostró un riesgo real en [`review_candidate_document(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260609121500_expand_hiring_summary_and_document_validation.sql:593): el audit log resolvía `recruitment_case_candidate_id` buscando por `recruitment_case_id + candidate_profile_id` y quedándose con el registro más reciente, en vez de usar la participación exacta que ya conoce el checklist abierto en UI.
- Se agregó la migración [`20260627234500_scope_document_review_audit_to_case_candidate.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627234500_scope_document_review_audit_to_case_candidate.sql:1), que redefine la RPC de revisión documental para exigir `p_case_candidate_id`, bloquear la fila real de `recruitment_case_candidates`, validar que el documento pertenezca a ese candidato dentro del caso y auditar con ese id exacto.
- [`documentChecklistApi.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/documentChecklistApi.ts:99) y [`CandidateDocumentChecklist.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateDocumentChecklist.tsx:166) ahora envían el `caseCandidateId` ya disponible en pantalla, sin abrir un contrato nuevo hacia el usuario ni tocar la persistencia documental.
- El cambio reduce riesgo de auditoría cruzada o equivocada cuando un mismo perfil participa más de una vez en el dominio de reclutamiento y deja el evento `document_reviewed` anclado a la participación operativa real.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false` y `git diff --check`.

## Reset documental obligatorio al trasladar candidatos entre folios

- [x] Auditar el contrato entre `transfer_candidate_to_case(...)`, `candidate_documents`, `get_candidate_checklist(...)` y `document_validation_status`
- [x] Corregir el traslado para que cualquier cambio de folio invalide la aprobación documental previa y no deje aprobaciones arrastradas al nuevo contexto
- [x] Validar `TypeScript` y `git diff --check`

## Resultado de reset documental obligatorio al trasladar candidatos entre folios

- La auditoría mostró un drift de alto riesgo: [`transfer_candidate_to_case(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260625233000_harden_recruitment_sync_and_buk_locations_cache.sql:219) mueve `candidate_documents` al folio destino, pero no reseteaba `document_validation_status`. Como [`get_candidate_checklist(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260609121500_expand_hiring_summary_and_document_validation.sql:386) recalcula requisitos según el caso destino, un candidato ya aprobado podía quedar visualmente “validado” en un folio con otro contexto documental.
- El hueco no lo cubría el trigger documental existente: al actualizar `candidate_documents.recruitment_case_id`, el trigger buscaba la participación del candidato ya en el caso destino, pero en ese momento `recruitment_case_candidates` todavía no había sido movido, así que no encontraba fila que resetear.
- Se agregó la migración [`20260628001000_reset_document_validation_after_candidate_transfer.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628001000_reset_document_validation_after_candidate_transfer.sql:1), que redefine `transfer_candidate_to_case(...)` para llamar explícitamente a [`reset_candidate_document_validation(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260609121500_expand_hiring_summary_and_document_validation.sql:228) inmediatamente después de mover la participación al nuevo folio.
- El cambio mantiene el modelo actual de documentos y no relaja permisos, pero garantiza que una aprobación documental quede siempre anclada al contexto vigente del candidato y no sobreviva indebidamente a un traslado.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false` y `git diff --check`.

## Unificación de firma viva para `review_candidate_document(...)`

- [x] Auditar si la migración nueva de revisión documental dejó conviviendo la firma antigua y la nueva de la RPC
- [x] Eliminar la sobrecarga residual para dejar una sola firma viva y evitar drift de schema cache / contrato muerto
- [x] Validar `TypeScript` y `git diff --check`

## Resultado de unificación de firma viva para `review_candidate_document(...)`

- La revisión mostró un riesgo de contrato vivo en [`20260627234500_scope_document_review_audit_to_case_candidate.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627234500_scope_document_review_audit_to_case_candidate.sql:1): la migración redefinía la RPC con `p_case_candidate_id`, pero solo eliminaba la firma nueva de 4 argumentos antes del `create or replace`, dejando coexistir la firma legacy de 3 argumentos en el historial.
- Se endureció esa misma migración para eliminar explícitamente también [`review_candidate_document(uuid, text, text)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627234500_scope_document_review_audit_to_case_candidate.sql:1), de modo que el runtime final conserve una sola firma documental activa.
- El cambio no modifica la lógica de revisión ni el cliente actual; reduce riesgo de sobrecarga RPC, ambigüedad de schema cache y persistencia de contratos muertos en producción.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false` y `git diff --check`.

## Limpieza automática del blob reemplazado en recargas documentales

- [x] Auditar si una recarga exitosa de documento reemplazaba `file_path` en base pero dejaba el archivo anterior huérfano en `candidate-docs`
- [x] Corregir el flujo de upload para limpiar el blob reemplazado sin tocar SQL ni permisos
- [x] Validar `TypeScript` y `git diff --check`

## Resultado de limpieza automática del blob reemplazado en recargas documentales

- La auditoría mostró una fuga silenciosa de storage: [`upload_candidate_document(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260605121500_restrict_candidate_control_access.sql:445) hace `on conflict ... do update` sobre `candidate_documents` y reemplaza `file_path`, pero el flujo feliz no eliminaba el archivo anterior de `candidate-docs`.
- Se corrigió en [`CandidateDocumentChecklist.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateDocumentChecklist.tsx:90): tras una RPC exitosa, si el documento ya tenía `file_path` previo y este difiere del nuevo upload, el cliente elimina el blob reemplazado. Si esa limpieza falla, la operación principal se mantiene exitosa pero deja un mensaje explícito de residuo para no ocultar el problema.
- El cambio reduce consumo innecesario de storage y mantiene el contrato actual `storage -> RPC` sin abrir una nueva dependencia entre frontend y SQL.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false` y `git diff --check`.

## Guardia de contexto antes de purgar documentos terminales

- [x] Auditar si la Edge Function nocturna validaba que el candidato siguiera en la misma participación terminal antes de borrar documentos
- [x] Endurecer la purga para que revalide `case_candidate`, caso, perfil y etapa terminal antes de eliminar storage/base
- [x] Validar `TypeScript` y `git diff --check`

## Resultado de guardia de contexto antes de purgar documentos terminales

- La revisión mostró un riesgo diferido en [`purge-candidate-documents`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/purge-candidate-documents/index.ts:1): el job se ejecutaba usando solo el snapshot guardado en `candidate_document_cleanup_jobs`, sin confirmar que la participación siguiera existiendo en el mismo caso y todavía en la etapa terminal que originó la limpieza.
- Se agregó una validación previa en la misma Edge Function para releer [`recruitment_case_candidates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/purge-candidate-documents/index.ts:104) y abortar la purga si cambió el caso, el perfil o la etapa. Con eso, la limpieza ya no depende ciegamente de un job viejo cuando el contexto operativo pudo haber cambiado antes de las 22:00 o por una corrección administrativa posterior.
- El cambio no altera el modelo de jobs ni la semántica de borrado exitosa; solo impide que una purga obsoleta borre documentos fuera del contexto vigente del candidato.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false` y `git diff --check`.

## Reapertura automática de cupos y folios por rechazo de Movilidad Interna

- [x] Auditar el contrato actual entre `internal_mobility_requests`, `recruitment_cases` y `hiring_requests` para identificar por qué un rechazo RRHH libera la movilidad pero no siempre reabre el folio/cupo
- [x] Endurecer el backend para que cualquier liberación efectiva de cupo por rechazo de movilidad resincronice el caso de reclutamiento y reabra el folio cuando corresponda, sin pisar cierres finales ajenos al dominio
- [x] Blindar el cierre manual del folio frente a movilidades activas inconsistentes y dejar la reapertura automática auditable con logs explícitos
- [x] Aplicar la migración en Supabase, ejecutar humo SQL, `TypeScript`, build, `git diff --check` y documentar el resultado final en este archivo

## Resultado de reapertura automática de cupos y folios por rechazo de Movilidad Interna

- La causa raíz estaba partida en dos contratos backend:
  1. [`set_internal_mobility_hr_execution_status(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260625184520_harden_internal_mobility_worker_lock_and_rrhh_rejection.sql:666) sí permitía rechazar RRHH y dejaba de contar la movilidad como aprobada, pero no re-sincronizaba siempre el caso asociado;
  2. [`sync_recruitment_case_status(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260625214500_refine_reopen_closed_folios_to_rejected_mobility_release.sql:3) preservaba `cancelled` cuando existían `close_reason` y `closed_at`, por lo que un folio cerrado manualmente jamás reaparecía aunque recuperara cupo.
- Se versionaron dos migraciones incrementales:
  - [`20260625213000_reopen_recruitment_slots_after_internal_mobility_rejection.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260625213000_reopen_recruitment_slots_after_internal_mobility_rejection.sql:1), que conecta el rechazo RRHH con `sync_recruitment_case_status(...)`, endurece `close_hiring_request(...)` para no cerrar folios con movilidades activas reservando cupos y deja la reapertura auditable;
  - [`20260625214500_refine_reopen_closed_folios_to_rejected_mobility_release.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260625214500_refine_reopen_closed_folios_to_rejected_mobility_release.sql:1), que restringe la reapertura automática exclusivamente a cierres recuperados por `internal_mobility_requests.status = 'rejected'`, evitando reabrir folios cerrados históricos sin relación con movilidad.
- El contrato final quedó así:
  - si una movilidad aprobada pasa a `Rechazado RRHH`, el request cambia a `rejected`, el caso vinculado se resincroniza y el cupo vuelve inmediatamente al folio;
  - si ese folio estaba cerrado manualmente y la vacante reaparece específicamente por una movilidad interna rechazada, el sistema reabre `hiring_requests.status = approved`, limpia el cierre del caso y vuelve a dejarlo visible operativamente;
  - si el folio cerrado no tiene una movilidad rechazada vinculada, permanece cerrado aunque tenga vacantes, evitando reaperturas espurias de históricos.
- `close_hiring_request(...)` ahora bloquea cierres cuando el folio tiene movilidades en `pending_area_manager`, `pending_contracts_control` o `approved + hr_execution_status = pending`, cerrando el hueco que permitía clausurar folios con cupos aún reservados.
- Se corrigió además la deriva de versionado remoto: en `supabase_migrations.schema_migrations` existía `20260625185730_harden_internal_mobility_worker_lock_and_rrhh_rejection`, mientras el repo llevaba `20260625184520`. Se normalizó el historial remoto para que coincida con el código versionado y se hizo lo mismo con los timestamps que el conector Supabase generó al aplicar las dos migraciones nuevas.
- Validación cerrada con:
  - `npm run audit:migrations -- --files supabase/migrations/20260625213000_reopen_recruitment_slots_after_internal_mobility_rejection.sql`
  - `npm run audit:migrations -- --files supabase/migrations/20260625214500_refine_reopen_closed_folios_to_rejected_mobility_release.sql`
  - `npx tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `git diff --check`
  - humo remoto vía Supabase:
    - `pg_get_functiondef(...)` confirmó `has_rejected_internal_mobility`, el bloqueo de cierre por movilidades activas y el `perform public.sync_recruitment_case_status(...)` dentro del rechazo RRHH;
    - no quedaron casos productivos pendientes de reapertura bajo la nueva regla (`affected_cases = 0`, `reopened_after_sync = 0`).

## Ajuste visual y cierre operativo de Movilidad Interna

- [x] Auditar el layout actual de la bandeja de conductores en `Movilidad Interna` y el contrato backend de ejecución RRHH / bloqueo de trabajador
- [x] Llevar la lista de conductores a ancho completo con detalle inferior, manteniendo máximo 5 filas visibles con scroll
- [x] Bloquear en backend y frontend que un trabajador con movilidad interna activa o aprobada pendiente de ejecución participe en otra simultánea
- [x] Agregar cierre RRHH `Rechazado` que marque la solicitud como rechazada y libere al trabajador para futuros procesos
- [x] Aplicar la migración en Supabase, validar humo SQL, `TypeScript`, build y documentar el resultado

## Resultado de ajuste visual y cierre operativo de Movilidad Interna

- [`HiringInternalMobilityView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringInternalMobilityView.tsx:1) dejó el layout lateral de dos columnas y ahora usa la lista de conductores a ancho completo, con el resumen/detalle debajo. La tabla conserva scroll propio con un máximo visual equivalente a 5 filas visibles.
- [`global.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/styles/global.css:2910) agregó clases específicas (`control-layout-stacked-mobility`, `control-detail-panel-full`, `tracking-table-scroll-mobility-queue`) para no romper otros tableros que reutilizan `control-layout`.
- [`types.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/types.ts:84), [`presentation.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/lib/presentation.ts:21), [`InternalMobilityPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/pages/InternalMobilityPage.tsx:1) y [`HiringInternalMobilityView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringInternalMobilityView.tsx:1) quedaron alineados con un tercer estado RRHH: `rejected`, expuesto en UI como `Rechazado RRHH`.
- Se versionó y aplicó en Supabase la migración [`20260625184520_harden_internal_mobility_worker_lock_and_rrhh_rejection.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260625184520_harden_internal_mobility_worker_lock_and_rrhh_rejection.sql:1). Esa migración endurece tres frentes: bloqueo de búsqueda para trabajadores con movilidad activa, bloqueo transaccional en `submit_internal_mobility_request(...)` mediante `pg_advisory_xact_lock(...)`, y cierre RRHH rechazado que cambia `status = rejected`, libera al trabajador y deja auditoría.
- La validación remota confirmó que `search_internal_mobility_workers(...)` ya excluye trabajadores con solicitudes `pending_area_manager`, `pending_contracts_control` o `approved + hr_execution_status = pending`, y que `set_internal_mobility_hr_execution_status(...)` ya acepta `pending`, `executed` y `rejected`.
- `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check` cerraron sin errores.
- La auditoría operativa detectó 3 duplicidades históricas previas al bloqueo nuevo: `MI-0032 / MI-0015`, `MI-0033 / MI-0014` y `MI-0031 / MI-0013`. No se corrigieron automáticamente para no intervenir datos productivos sin instrucción explícita, pero ahora RRHH puede cerrarlas desde la UI con `Rechazado`.

## Habilitación completa de Incentivos Extraordinarios para Control de Contratos

- [x] Auditar el contrato actual de permisos del módulo de Incentivos Extraordinarios y el rol efectivo de María Jesús Lagos
- [x] Versionar una migración mínima para habilitar el acceso requerido sin abrir permisos ajenos al contrato actual
- [x] Aplicar la migración en Supabase y verificar que `control_contratos` ya hereda gestión completa de incentivos

## Resultado de habilitación completa de Incentivos Extraordinarios para Control de Contratos

- Se confirmó que la cuenta `mariajesus.lagos@busesjm.com` corresponde a `Maria Jesus Lagos Minardi`, con estado `active` y rol único `control_contratos`.
- El contrato actual del backend no expone Incentivos Extraordinarios como módulo independiente: la gestión completa depende de [`user_can_manage_hr_incentives(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260606090000_add_hr_incentives_module.sql:170), que hoy habilita acceso a quien tenga el módulo `recursos_humanos`.
- Se agregó y aplicó en Supabase la migración [`20260625162703_grant_control_contratos_hr_module_for_incentives.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260625162703_grant_control_contratos_hr_module_for_incentives.sql:1), que otorga `role_module_access(control_contratos, recursos_humanos, true)` sin tocar RLS ni funciones del dominio.
- La verificación remota cerró con tres checks efectivos sobre el usuario de María Jesús: `user_can_access_module(..., 'recursos_humanos') = true`, `user_can_manage_hr_incentives(...) = true` y `user_can_view_hr_incentive_analytics(...) = true`.
- `supabase migration list --linked` quedó alineado y ya muestra `20260625162703` tanto local como remoto.

## Endurecimiento enterprise de Reclutamiento y Movilidad Interna

- [x] Contrastar cada hallazgo de la auditoría adjunta contra el esquema, RPCs, triggers e índices finales, descartando recomendaciones ya resueltas o que introduzcan riesgo operacional
- [x] Corregir las brechas vigentes de notificación secuencial, indexación y consistencia del catálogo one-to-one mediante una migración incremental segura
- [x] Reducir invalidaciones Realtime globales y payloads innecesarios del control de reclutamiento sin degradar actualización ni permisos
- [x] Evaluar la búsqueda de trabajadores de movilidad sobre la fuente BUK actual y descartar materialización riesgosa sin duplicar fuentes de verdad
- [x] Aplicar y versionar la migración en Supabase, ejecutar pruebas de contrato/rendimiento, validar frontend y documentar el cierre

## Resultado de endurecimiento enterprise de Reclutamiento y Movilidad Interna

- Se agregó y aplicó en Supabase la migración [`20260625022401_harden_recruitment_mobility_enterprise_scale.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260625022401_harden_recruitment_mobility_enterprise_scale.sql:1), con índices faltantes sobre `internal_mobility_requests.destination_contract_id`, `submitted_by` y `final_decided_by`.
- La notificación pendiente de Movilidad Interna ya no depende solo de `INSERT`: `trg_internal_mobility_pending_email_dispatch` quedó como `AFTER INSERT OR UPDATE OF status`, por lo que una reapertura a `pending` en `contracts_control` vuelve a encolar correo.
- El flag `buk_contract_mappings.is_one_to_one` dejó de ser solo backfill estático. Ahora se recalcula por trigger cuando cambia `contract_id`, `is_operational` o el propio flag, evitando que nuevos mappings operativos dejen destinos ambiguos visibles en contratación/movilidad.
- `Control de Contrataciones` dejó de consumir `get_recruitment_control_dashboard_v2` en frontend. La vista ahora usa `get_recruitment_control_summary()` y páginas específicas para aprobaciones, procesos, candidatos, personal y folios activos, todas con `limit/offset`, búsqueda server-side y `total_count`.
- Las invalidaciones Realtime del módulo quedaron acotadas por subvista: procesos, candidatos y personal ya no escuchan las 12 tablas globales al mismo tiempo ni invalidan movilidad interna desde el padre.
- Se evaluó la recomendación de materializar `employees_active_current` y no se aplicó en esta pasada: habría creado una segunda fuente de verdad BUK sin un job de sincronización dedicado. La decisión segura fue no tocar esa vista hasta diseñar una sync/materialización explícita.
- Validación remota cerrada con `supabase db push --linked --include-all`, `supabase migration list --linked`, humo RPC con usuario de reclutamiento (`active_cases = 53`, `candidates_in_progress = 45`, búsqueda `zona ii = 41`) y prueba de orden server-side corregida (`RC-0013`, `RC-0015`, `RC-0017`, ...).
- Validación local cerrada con `npm run audit:migrations -- --files supabase/migrations/20260625022401_harden_recruitment_mobility_enterprise_scale.sql`, `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.

## Optimización final de catálogos en analítica de incentivos

- [x] Contrastar la auditoría post-optimización contra `get_hr_incentives_analytics(...)` y aislar el único hallazgo aún vigente
- [x] Reemplazar en una migración nueva los `SELECT DISTINCT` transaccionales de `filter_options` por catálogos maestros (`contracts`/`buk_contract_mappings` y `hr_incentive_types`)
- [x] Aplicar la migración en Supabase, validar humo SQL, `TypeScript`, build y cerrar el resultado auditable en este archivo

## Resultado de optimización final de catálogos en analítica de incentivos

- Se agregó la migración [`20260625014355_optimize_hr_incentive_analytics_filter_catalogs.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260625014355_optimize_hr_incentive_analytics_filter_catalogs.sql:1), que mantiene intacto el contrato JSON de `get_hr_incentives_analytics(...)` y solo reemplaza el origen de `filter_options`.
- `filter_options.contracts` dejó de escanear `hr_incentive_requests` y ahora se alimenta del catálogo maestro activo `contracts + buk_contract_mappings`, reutilizando el mismo criterio operativo de labels que la configuración del módulo.
- `filter_options.types` dejó de salir de la tabla transaccional y ahora se resuelve desde `hr_incentive_types` activos, evitando que el costo del dropdown crezca con el histórico de solicitudes.
- La migración se publicó con `npx --yes supabase db push --linked --include-all`. En este entorno, `supabase migration list --linked` no pudo cerrarse porque el CLI pidió `SUPABASE_DB_PASSWORD`, pero el despliegue sí terminó y la verificación remota quedó cerrada por RPC autenticada.
- Humo remoto validado con sesión temporal de un usuario autorizado (`control_contratos`): `get_hr_incentives_analytics(...)` devolvió `110` contratos y `7` tipos en `filter_options`, exactamente igual al conteo de tablas maestras activas consultadas por service role. El payload analítico siguió respondiendo sin cambios de shape.
- Validación local cerrada con `npm run audit:migrations -- --files supabase/migrations/20260625014355_optimize_hr_incentive_analytics_filter_catalogs.sql`, `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.

## Aterrizaje de auditoría SQL enterprise

- [x] Contrastar la auditoría adjunta contra el estado real del repo y separar hallazgos vigentes de findings ya corregidos por migraciones posteriores
- [x] Aplicar solo los endurecimientos seguros que no rompen contratos productivos actuales
- [x] Validar la nueva migración, diff limpio y dejar documentados los hallazgos descartados por obsolescencia o riesgo de reescritura histórica

## Hotfix de folios elegibles en Movilidad Interna

- [x] Auditar por qué `Movilidad Interna` quedó mostrando `No hay folios abiertos` aunque existan casos con cupos activos
- [x] Corregir la regresión de frontend y blindar la resolución de destino en las RPCs para que siga funcionando con el catálogo BUK one-to-one actual
- [x] Aplicar la migración en el proyecto productivo correcto y dejar evidencia auditable de la publicación remota

## Ajuste de filtros en Business Intelligence

- [x] Auditar por qué el filtro de contratos de BI muestra códigos en vez de nombres operativos y por qué el selector de cargos no ofrece una selección masiva usable
- [x] Corregir la presentación de contratos con labels humanos y mejorar el multiselect compartido para selección total, limpieza y selección parcial clara
- [x] Validar tipado/build/diff y registrar la regla de presentación para que BI no vuelva a exponer claves técnicas al usuario

## Ajuste de KPI y cascada de filtros en Business Intelligence

- [x] Reemplazar la tarjeta de `Contratos Activos` por `% de Ausentismo` calculado según los filtros vigentes
- [x] Hacer que contratos y cargos se filtren mutuamente para mostrar solo combinaciones válidas según la selección actual
- [x] Validar tipado/build/diff y dejar documentado el contrato de cascada para evitar drift futuro

## Alineación de dimensión contractual en Business Intelligence

- [x] Auditar por qué al seleccionar un contrato operativo como `ALTO NORTE` los gráficos seguían mostrando universos ajenos como `ROL PRIVADO JM`
- [x] Corregir la dimensión de filtrado BI para que opere por `area_name` operacional y no por `contract_code` interno cuando el usuario filtra contratos
- [x] Aplicar la migración en Supabase, revalidar build/diff y documentar la regla de diseño para evitar mezclas futuras

## Resultado de aterrizaje de auditoría SQL enterprise

- La auditoría adjunta combinaba riesgos reales con hallazgos históricos ya corregidos por migraciones posteriores. Se confirmó como **desactualizado** el punto crítico sobre `candidate-docs`: el bucket ya no está abierto por `bucket_id` desde la migración [`20260615220000_enterprise_security_contract_stabilization.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260615220000_enterprise_security_contract_stabilization.sql:602), que reemplazó esas policies por acceso scoped vía [`user_can_access_candidate_document_object(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260615220000_enterprise_security_contract_stabilization.sql:560).
- También quedó descartado como **ya corregido** el hallazgo sobre `recruitment_case_audit_log.action_type`: el constraint fue ampliado en migraciones posteriores como [`20260523000024_add_interview_notes.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260523000024_add_interview_notes.sql:8), [`20260608000002_add_transfer_candidate_rpc.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608000002_add_transfer_candidate_rpc.sql:7) y [`20260611220000_expand_internal_mobility_and_recruitment_stage_controls.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260611220000_expand_internal_mobility_and_recruitment_stage_controls.sql:279).
- Se aplicó la migración [`20260618163500_harden_enterprise_sql_audit_followups.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260618163500_harden_enterprise_sql_audit_followups.sql:1) para cerrar dos puntos vigentes y seguros:
  1. eliminar la policy muerta `security_audit_logs_insert_self`, que nunca podía entrar en juego porque `authenticated` no tenía `INSERT` sobre `security_audit_logs`;
  2. endurecer [`sync_hr_roster_exception_from_buk(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260618163500_harden_enterprise_sql_audit_followups.sql:5) para que use el helper vivo [`current_request_has_service_role()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260618041437_allow_internal_context_for_buk_snapshot.sql:1) en vez de depender solo de la heurística de claims vacíos.
- No se tocaron los archivos con doble timestamp ni migraciones históricas ya ejecutadas. Reescribir nombres versionados a esta altura genera más riesgo operacional que beneficio y debe tratarse como higiene de proceso futura, no como hotfix sobre historia congelada.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260618163500_harden_enterprise_sql_audit_followups.sql`, `git diff --check` y auditoría local `node scripts/audit-supabase-security.mjs` solo como referencia de ruido histórico, no como truth source de estado vivo.

## Resultado de hotfix de folios elegibles en Movilidad Interna

- La causa raíz inmediata estaba en [`InternalMobilityPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/pages/InternalMobilityPage.tsx:1): la UI volvió a filtrar `eligibleFolios` contra `setupCatalogs.destinations`, pero la versión vigente de [`get_internal_mobility_setup_catalogs()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612003000_link_internal_mobility_to_recruitment_cases.sql:151) devolvía `destinations = []`. Resultado: aunque backend sí entregara folios con cupos, el cliente los vaciaba todos y mostraba el falso negativo de la captura.
- El problema profundo venía del backend y no debía quedar sin cirugía: después de la normalización one-to-one del catálogo BUK, ya no es seguro resolver el destino de una movilidad uniendo solo por `contract_number`. Eso deja ambigüedad cuando existen varios contratos activos con el mismo número y distinto `contract_name`.
- Se dejó versionada la migración [`20260623200718_fix_internal_mobility_destination_resolution.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260623200718_fix_internal_mobility_destination_resolution.sql:1), que rehace `get_internal_mobility_setup_catalogs()` y `submit_internal_mobility_request(...)` para resolver el mapping exacto por `contract_number` más coincidencia prioritaria de `buk_area_name_normalized` contra `hr.contract_name / rc.contract_name`, con fallback controlado por `cost_center_code`.
- En esa misma migración se repone además el payload `destinations` operativo desde `buk_contract_mappings`, dejando alineadas las dos capas del flujo y evitando nuevas regresiones de frontend por catálogos vacíos o parciales.
- La verificación productiva preliminar confirmó que sí existen folios abiertos con cupos en base; el síntoma no era falta de data sino una desalineación entre contrato RPC histórico, catálogo operativo normalizado y filtro de UI.
- La publicación remota quedó ejecutada en el proyecto vinculado con `npx --yes supabase db push --linked --include-all`. La verificación posterior con `npx --yes supabase migration list --linked` confirmó que ya no quedan diferencias entre migraciones locales y remotas.

## Resultado de ajuste de filtros en Business Intelligence

- La causa del filtro de contratos estaba en [`BiDashboardPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/pages/BiDashboardPage.tsx:63): el selector armaba sus opciones solo con `contractCode`, aunque la misma consulta de BI ya traía `areaName`. Por eso el usuario veía claves técnicas como `10100` o `010201` en vez del nombre real del contrato.
- Se corrigió el armado de opciones para que el valor siga siendo el `contractCode` que consume el backend, pero el label visible use `areaName` con fallback defensivo al código solo si no existe nombre operativo.
- También se alineó la visualización de contratos en los gráficos visibles de dotación desde [`BiHeadcountCharts.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/components/BiHeadcountCharts.tsx:1) y [`BiDemographicsChart.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/components/BiDemographicsChart.tsx:1), para no seguir mostrando números como nombre de contrato en tooltips o ejes.
- El problema de cargos no era de datos sino de UX del componente compartido [`MultiSelectField.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/forms/MultiSelectField.tsx:1): permitía checkboxes individuales, pero no ofrecía una forma explícita de `Seleccionar todos` o `Limpiar`, lo que volvía torpe la selección parcial frente a catálogos largos.
- El multiselect ahora incorpora una cabecera fija con acciones `Seleccionar todos` y `Limpiar`, además de resumir correctamente cuando todas las opciones están activas.

## Resultado de ajuste de KPI y cascada de filtros en Business Intelligence

- La tarjeta resumen de [`BiOverviewCards.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/components/BiOverviewCards.tsx:1) dejó de mostrar `Contratos Activos` y ahora expone `Ausentismo Hoy`, calculado como `(vacaciones + licencias médicas + otros permisos/ausencias) / dotación activa` sobre el universo ya filtrado por periodo, contratos y cargos.
- El cálculo reutiliza el overview existente y no abrió una RPC nueva: toma `onVacationToday`, `onMedicalLeaveToday`, `otherAbsencesToday` y `totalActiveEmployees`, entregando un porcentaje con formato local.
- En [`BiDashboardPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/pages/BiDashboardPage.tsx:1) los filtros de `Contratos` y `Cargos` quedaron acoplados por combinaciones válidas del dataset BI ya cargado:
  1. si eliges contrato, el catálogo de cargos se reduce a los cargos presentes en ese contrato;
  2. si eliges cargo, el catálogo de contratos se reduce a los contratos que tienen ese cargo;
  3. si hay selecciones incompatibles después de cambiar el otro filtro, la UI sanea automáticamente los valores inválidos para no dejar un estado roto.

## Resultado de alineación de dimensión contractual en Business Intelligence

- La causa raíz de la inconsistencia no estaba en el tooltip sino en el contrato entero de BI: [`get_bi_employee_population(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260623235155_align_bi_contract_filters_with_area_dimension.sql:1) filtraba por `contract_code`, mientras la UI presentaba y el usuario entendía los contratos por `area_name`.
- En la data real eso rompe fuerte el universo porque una misma operación como `ALTO NORTE (8832580001:0001)` convive con múltiples `contract_code` (`10116.0`, `0`, etc.). Por eso al elegir Alto Norte podían aparecer gráficos de otro universo asociado a la clave `0`, como `ROL PRIVADO JM`.
- Se agregó y aplicó en Supabase la migración [`20260623235155_align_bi_contract_filters_with_area_dimension.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260623235155_align_bi_contract_filters_with_area_dimension.sql:1), que alinea `get_bi_employee_population(...)`, `get_bi_workforce_overview(...)`, `get_bi_headcount_by_job_title(...)` y `get_bi_age_distribution(...)` para resolver filtros de contrato por `area_name` operacional normalizado, manteniendo compatibilidad defensiva con selecciones legacy por código interno.
- En frontend también se dejó explícita la separación entre valor operativo y label visible: los filtros ahora envían `area_name` como dimensión real, mientras [`formatBiContractLabel(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/lib/presentation.ts:1) limpia el sufijo técnico entre paréntesis para no contaminar chips, ejes ni tooltips.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260623235155_align_bi_contract_filters_with_area_dimension.sql`, `npx tsc -b --pretty false`, `npm run build:frontend-check`, `git diff --check` y `npx --yes supabase db push --linked --include-all`.

## Etapa RRHH en Movilidad Interna y auditoría preventiva de legacies

- [x] Auditar el flujo actual de movilidad interna y ubicar una etapa RRHH posterior a la aprobación sin romper el contrato operativo vigente
- [x] Extender backend y frontend para soportar `Pendiente de Ejecución RRHH` / `Ejecutado RRHH`, con permisos explícitos para `administrativo`
- [x] Auditar residuos legacy peligrosos en el circuito de movilidad, aplicar migración en Supabase y validar build / typecheck / queries de humo

## Visibilidad de Movilidad Interna para Administrativo en Control de Contrataciones

- [x] Auditar por qué `administrativo` no veía la sección `Movilidad Interna` pese a tener acceso operativo al cierre RRHH
- [x] Corregir la guarda de frontend para que `Movilidad Interna` dependa del módulo `movilidad_interna` y no de capacidades de control de candidatos
- [x] Revalidar `TypeScript`, build frontend instrumentado y diff limpio antes de cerrar

## Flujo WHO en control de candidatos de Reclutamiento

- [x] Auditar la transición `Lead -> Who` para confirmar si el botón realmente dispara la RPC y dónde se pierde la señal de error o éxito
- [x] Endurecer la UI para bloquear causas WHO incompletas y dejar visible junto al botón el resultado exacto del envío
- [x] Revalidar `TypeScript`, diff limpio y registrar el hallazgo operativo para evitar nuevas transiciones silenciosas

## Ajustes operativos de Movilidad Interna y Jornadas y Turnos

- [x] Auditar la UI viva de `Movilidad Interna`, `Control de contratación > Movilidad Interna` y `Jornadas y Turnos` para confirmar dónde vive cada control y cómo persisten los filtros/selecciones
- [x] Quitar del resumen standalone de movilidad interna cualquier acción de cierre o ejecución, manteniendo ese control únicamente en `Control de contratación`
- [x] Hacer que la selección de detalle en `Control de contratación > Movilidad Interna` opere como toggle: primer click muestra detalle, segundo click sobre la misma fila limpia la selección
- [x] Agregar bajo `Calendario` tarjetas dinámicas con conteo de personas con jornada asignada y personas pendientes, respetando mes y filtros visibles de trabajador, contrato y área
- [x] Validar con `npx tsc -b --pretty false`, `npm run build`, `git diff --check`, documentar el cierre aquí, actualizar `tasks/lessons.md`, hacer commit en `main` y push

## Resultado de ajustes operativos de Movilidad Interna y Jornadas y Turnos

- [`src/modules/internal_mobility/pages/InternalMobilityPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/pages/InternalMobilityPage.tsx:1) dejó el historial como vista de solo lectura: se mantuvieron los estados RRHH y la trazabilidad, pero se eliminaron los botones de ejecución/rechazo para que el control operativo permanezca únicamente en contratación.
- [`src/modules/recruitment/components/HiringInternalMobilityView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringInternalMobilityView.tsx:1) ya no fuerza un detalle persistente: si vuelves a hacer click sobre la misma movilidad, la selección se limpia y el panel desaparece.
- [`src/modules/roster/pages/RosterPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster/pages/RosterPage.tsx:1) ahora muestra dos tarjetas bajo `Calendario` con personas asignadas y pendientes. El conteo se respalda en la nueva RPC [`get_hr_roster_calendar_summary(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260626124500_add_hr_roster_calendar_summary.sql:1), filtrando por mes, búsqueda de trabajador, contrato y área sin depender de resultados parciales del autocomplete.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260626124500_add_hr_roster_calendar_summary.sql`, `npx tsc -b --pretty false`, `npm run build`, `git diff --check` y publicación remota de la migración con `npx --yes supabase db push --linked --include-all`.

## Ajuste de filtro semántico en Jornadas y Turnos

- [x] Reemplazar los inputs libres de `Contrato` y `Área` en `Jornadas y Turnos` por un único desplegable consistente con la semántica real de la vista
- [x] Publicar desde backend el catálogo de opciones operativas para ese filtro y alinear el resumen de roster para que trate `Contrato/Área` como una sola dimensión
- [x] Revalidar `TypeScript`, build, auditoría SQL, `db push` remoto y documentar el cierre

## Resultado de ajuste de filtro semántico en Jornadas y Turnos

- [`src/modules/roster/pages/RosterPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster/pages/RosterPage.tsx:1) dejó de mostrar dos campos libres (`Contrato` y `Área`) y ahora usa un solo desplegable `Contrato / Área`, coherente con la semántica operativa que ya consumía la vista.
- [`src/modules/roster/services/rosterApi.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster/services/rosterApi.ts:1) y [`src/modules/roster/types.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster/types.ts:1) ahora leen `operational_areas` desde setup catalogs para poblar ese selector sin depender del trabajador seleccionado.
- La migración [`20260626133500_unify_hr_roster_scope_filter.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260626133500_unify_hr_roster_scope_filter.sql:1) unifica el filtro backend sobre `coalesce(area_name, contract_code)` y publica el catálogo del desplegable desde `get_hr_roster_setup_catalogs()`, manteniendo compatibilidad con la firma previa de `get_hr_roster_calendar_summary(...)`.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260626133500_unify_hr_roster_scope_filter.sql`, `npx tsc -b --pretty false`, `npm run build`, `git diff --check`, `npx --yes supabase db push --linked --include-all` y verificación posterior con `supabase migration list --linked`.

## Hotfix de error SQL al enviar WHO a aprobación

- [x] Auditar el error `column rcc.candidate_id does not exist` para confirmar si nacía en la RPC principal o en un trigger lateral del flujo WHO
- [x] Versionar y aplicar en Supabase una migración mínima que corrija la función de notificación WHO sin tocar el contrato de etapas
- [x] Revalidar auditoría de migraciones, tipado y estado remoto para cerrar el hotfix con trazabilidad

## Hotfix de columna de capability en notificación WHO

- [x] Auditar el nuevo error `column rc.capability does not exist` para confirmar el contrato real de `role_capabilities`
- [x] Versionar y aplicar en Supabase la corrección incremental de `capability -> capability_code` en la función lateral WHO
- [x] Revalidar auditoría de migraciones, tipado y push remoto antes de cerrar

## Aterrizaje de auditoría enterprise de Incentivos Extraordinarios

- [x] Contrastar cada hallazgo de `/Users/maximilianocontrerasrey/Downloads/auditoria_incentivos_extraordinarios.md` contra las RPCs y migraciones vivas del módulo para separar findings vigentes de puntos ya corregidos
- [x] Endurecer la bandeja de incentivos sin romper contrato: denormalizar el aprobador pendiente actual, eliminar la subconsulta lateral del filtro principal y reemplazar `COUNT(*) OVER` por un patrón de conteo/página más barato
- [x] Corregir la agregación analítica por homónimos usando `employee_buk_employee_id` como clave de grupo manteniendo el payload JSON que ya consume frontend
- [x] Reducir costo de resolución de trabajador en incentivos con soporte de indexación seguro para `normalize_buk_area_name(area_name)` sin alterar la fuente de verdad BUK
- [x] Validar con `audit:migrations`, `TypeScript`, build, `git diff --check`, `db push` remoto, humo SQL y documentar qué hallazgos de la auditoría quedaron descartados por ya estar resueltos

## Resultado de aterrizaje de auditoría enterprise de Incentivos Extraordinarios

- La auditoría quedó aterrizada contra el SQL vivo y no se implementó a ciegas. Dos hallazgos venían **ya resueltos** antes de esta pasada:
  1. `SEC-01` ya estaba cubierto en [`cancel_hr_incentive_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260615113000_reconcile_roster_extra_shift_with_incentives.sql:758), que hoy sí reconcilia `extra_shift` al anular incentivos sobre descanso.
  2. `CONC-01` ya estaba cubierto en [`bulk_decide_hr_incentive_request_approvals(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614235500_optimize_hr_incentive_mass_workflows.sql:816), que normaliza y ordena determinísticamente los `approval_ids` antes de bloquear y procesar.
- Se agregó y aplicó en Supabase la migración [`20260626152000_harden_hr_incentives_enterprise_audit_findings.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260626152000_harden_hr_incentives_enterprise_audit_findings.sql:1), que cierra los hallazgos vigentes sin romper el contrato frontend:
  - denormaliza `current_approver_name` en `hr_incentive_requests`, con sincronización automática por trigger desde `hr_incentive_request_approvals`;
  - rehace [`get_hr_incentive_requests(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260626152000_harden_hr_incentives_enterprise_audit_findings.sql:115) para quitar el `LEFT JOIN LATERAL` del filtro de texto y reemplazar `COUNT(*) OVER()` por `filtered_count + paged_requests`;
  - corrige [`get_hr_incentives_analytics(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260626152000_harden_hr_incentives_enterprise_audit_findings.sql:398) para agrupar por `employee_buk_employee_id` y evitar colisión de homónimos sin alterar el JSON consumido por la UI;
  - agrega soporte de indexación para búsquedas textuales (`pg_trgm`) y para `normalize_buk_area_name(area_name)` sobre `public.employees`.
- El único ajuste de implementación requerido durante el despliegue fue técnico y seguro: el índice GIN no aceptó `concat_ws(...)` por no ser `IMMUTABLE`, así que se introdujo la helper [`build_hr_incentive_request_search_text(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260626152000_harden_hr_incentives_enterprise_audit_findings.sql:7) para alinear expresión de búsqueda e indexación sin tocar el payload del módulo.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260626152000_harden_hr_incentives_enterprise_audit_findings.sql`, `npx tsc -b --pretty false`, `npm run build:frontend-check`, `git diff --check`, `npx --yes supabase db push --linked --include-all` y verificación remota posterior con `supabase migration list --linked`.

## Búsqueda ampliada en resumen de procesos de contratación

- [x] Auditar qué columnas usa hoy el buscador de `Resumen de procesos de contratación`
- [x] Ampliar el matching para que encuentre términos parciales de gerencia, área, centro de costo y labels operativos relacionados
- [x] Revalidar tipado/diff limpio y documentar la nueva semántica del filtro

## Resultado de búsqueda ampliada en resumen de procesos de contratación

- El buscador de [`HiringProcessesView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringProcessesView.tsx:15) dejó de depender solo de `case_code`, `contract_name`, `job_position_name` y `cost_center_name`.
- Ahora construye un índice textual unificado con `case_code`, `folio`, `title`, `contract_name`, `job_position_name`, `cost_center_name`, `cost_center_code`, `requester_name`, `requester_email`, `owner_name`, `shift_name`, `turno`, `travel_methodology` y `other_benefits`.
- La búsqueda quedó normalizada sin tildes y por múltiples términos. Con eso expresiones como `zona ii`, `prevencion`, `mantenimiento` o combinaciones parciales del nombre operativo del centro/caso pueden resolver aunque no coincidan exactamente con un solo campo visible en la tabla.
- Validación cerrada con `npx tsc -b --pretty false` y `git diff --check`.

## Resultado de hotfix de columna de capability en notificación WHO

- La segunda falla vino de la misma función lateral [`enqueue_who_pending_approval_email(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260618153004_fix_who_pending_email_capability_column.sql:1): el filtro de destinatarios consultaba `rc.capability`, pero la tabla [`role_capabilities`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260526150000_add_effective_capabilities.sql:13) expone `capability_code`.
- Se agregó y aplicó en Supabase la migración [`20260618153004_fix_who_pending_email_capability_column.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260618153004_fix_who_pending_email_capability_column.sql:1), que mantiene intacta la lógica del helper y solo corrige la columna del join de permisos.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260618153004_fix_who_pending_email_capability_column.sql`, `npx tsc -b --pretty false`, `git diff --check` y `npx --yes supabase db push --linked --yes`.

## Soft ERP UI incremental con limpieza y compactación

- [x] Auditar el dashboard, la navegación principal y los contenedores compartidos para aterrizar el prompt `soft neumorphism` solo donde agrega valor operacional
- [x] Crear primitives reutilizables de superficie/carta soft y reutilizarlas en `AppShell`, `DashboardWidgetFrame` y cards ejecutivas para evitar estilos duplicados
- [x] Modernizar `DashboardHome` y sus widgets con jerarquía visual más limpia, manteniendo tablas y formularios densos en modo operativo y legible
- [x] Compactar helpers y patrones repetidos del dashboard para reducir líneas sin degradar contratos ni estados de carga/error/empty
- [x] Validar `TypeScript`, build frontend, diff limpio, documentar el resultado, actualizar `tasks/lessons.md`, commit en `main` y push

## Resultado de Soft ERP UI incremental con limpieza y compactación

- La implementación del prompt se aterrizó sobre la superficie real del home y no como “neumorfismo total”. Se modernizaron [`AppShell.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/layout/AppShell.tsx:1), [`DashboardHome.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/pages/DashboardHome.tsx:1), [`DashboardWidgetFrame.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/DashboardWidgetFrame.tsx:1) y el sistema visual de [`global.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/styles/global.css:1) / [`dashboard.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/styles/dashboard.css:1), dejando tablas y flujos densos en modo operativo y legible.
- Se creó una capa reusable mínima en frontend en vez de repartir estilos ad hoc por pantalla:
  - [`SoftSurface.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/layout/SoftSurface.tsx:1) centraliza superficies `raised/panel/inset/accent`;
  - [`SoftMetricCard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/layout/SoftMetricCard.tsx:1) consolida KPIs/cards ejecutivas;
  - [`formatters.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/lib/formatters.ts:1) elimina duplicación de formateo de fechas en widgets del dashboard.
- El home quedó con una línea `Soft ERP UI` controlada: hero ejecutivo con métricas rápidas, navegación superior más sobria y táctil, widgets con mejor jerarquía visual y cards informativas suavizadas. No se tocó el contrato funcional de filtros, expansión de filas, acciones ni queries del dashboard.
- La compactación se concentró en deuda visible y segura:
  - `DashboardWidgetFrame` ahora acepta subtítulo y envuelve la superficie compartida;
  - `ActiveFoliosWidget` dejó de repetir headers inline y KPIs hardcodeados, reutilizando configuración y `SoftMetricCard`;
  - `TasksWidget`, `ApprovalTrackingWidget` y `ActiveFoliosWidget` comparten helpers de fecha en vez de duplicar utilitarios locales.
- Validación cerrada con `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.

## Resultado de hotfix de error SQL al enviar WHO a aprobación

- La causa raíz no estaba en [`request_candidate_stage_who(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260607173000_autoapprove_who_without_findings.sql:73), sino en la función lateral [`enqueue_who_pending_approval_email(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260618151509_fix_who_pending_email_candidate_profile_join.sql:1), disparada por el trigger de `candidate_stage_approvals` cuando la solicitud sí alcanzaba estado `pending`.
- Esa función seguía usando un join legacy `rcc.candidate_id`, pero el esquema vigente de [`recruitment_case_candidates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260520000012_recruitment_cases_phase1.sql:58) trabaja con `candidate_profile_id`. Por eso la transición fallaba recién al intentar encolar la notificación.
- Se agregó y aplicó en Supabase la migración [`20260618151509_fix_who_pending_email_candidate_profile_join.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260618151509_fix_who_pending_email_candidate_profile_join.sql:1), que reemplaza ese join por `candidate_profiles` y toma `national_id` como RUT sin alterar el resto del payload.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260618151509_fix_who_pending_email_candidate_profile_join.sql`, `npx tsc -b --pretty false`, `git diff --check`, `npx --yes supabase db push --linked --yes` y `npx --yes supabase migration list --linked`.

## Resultado de flujo WHO en control de candidatos de Reclutamiento

- La RPC correcta ya estaba conectada: [`request_candidate_stage_who(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260607173000_autoapprove_who_without_findings.sql:73) seguía siendo la responsable de mover `Lead -> who_pending` cuando existen causas y de autoaprobar solo cuando no hay hallazgos.
- La fricción estaba en frontend, dentro de [`CandidateDetailSidebar.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateDetailSidebar.tsx:51): la UI filtraba silenciosamente filas WHO incompletas antes de invocar el cambio de etapa y además dejaba el mensaje de error/éxito enterrado al final del panel.
- Se endureció el flujo para que cualquier causa iniciada deba quedar completa o el botón quede bloqueado con mensaje explícito. También se dejó una confirmación visible junto al botón indicando si la solicitud irá a aprobación Who o si, por no existir causas, se autoaprobará.
- Validación cerrada con `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.

## Nuevo rol Jefe Administrativo

- [x] Auditar el contrato actual de roles, módulos, capabilities y checks legacy por nombre para incorporar `jefe_administrativo` sin dejar permisos partidos
- [x] Versionar y aplicar en Supabase la migración del rol `jefe_administrativo`, con herencia funcional de `administrativo + reclutamiento`
- [x] Asignar el nuevo rol a Francisco Cordero Villagra y verificar módulos, capability y equivalencias efectivas
- [x] Extender el alcance del módulo `Business Intelligence` para `jefe_administrativo` y validar acceso efectivo en producción

## Resultado de nuevo rol Jefe Administrativo

- Se agregó la migración [`20260618135544_add_jefe_administrativo_role.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260618135544_add_jefe_administrativo_role.sql:1), aplicada directamente en Supabase productivo, para registrar `jefe_administrativo` en `app_roles`, copiarle la unión de `role_module_access` y `role_capabilities` de `administrativo` + `reclutamiento`, y reasignar a Francisco Cordero Villagra.
- La parte crítica no fue solo crear el rol: se redefinió [`public.user_has_role(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260618135544_add_jefe_administrativo_role.sql:33) para que `jefe_administrativo` satisfaga checks legacy que todavía preguntan explícitamente por `administrativo` o `reclutamiento`. Con eso se evitó tener que parchear decenas de RPCs una por una.
- Francisco quedó con un único rol asignado (`jefe_administrativo`), pero la verificación remota confirmó `inherits_administrativo = true` e `inherits_reclutamiento = true`, además de los módulos `solicitud_contrataciones`, `control_contrataciones`, `movilidad_interna`, `jornadas_turnos` y `acreditacion_personas`, más la capability `candidate_control_access`.
- En frontend también se actualizó el contrato de roles en [`access.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/auth/config/access.ts:1) y el helper RRHH de movilidad en [`presentation.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/lib/presentation.ts:1) para que la sesión reconozca el nuevo rol sin drift visual.
- El alcance BI quedó alineado después con la migración incremental [`20260618141152_grant_bi_analytics_to_jefe_administrativo.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260618141152_grant_bi_analytics_to_jefe_administrativo.sql:1), también aplicada en Supabase. La verificación remota confirmó `public.user_can_access_module(francisco_id, 'bi_analytics') = true`.

## Resultado de visibilidad de Movilidad Interna para Administrativo en Control de Contrataciones

- La causa raíz estaba en [`HiringStatusPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringStatusPage.tsx:1): la pestaña `Movilidad Interna` se renderizaba solo si el usuario tenía `candidate_control_access`, aunque el cierre RRHH ya había sido diseñado para el rol `administrativo`.
- La corrección separó ambos contratos: `Control de candidatos` y `Personal a Contratar` siguen gobernados por capacidad, mientras `Movilidad Interna` ahora usa acceso modular real (`movilidad_interna`) con bypass de `superadmin`.
- También se ajustó el fallback de vista para que la falta de acceso a candidatos no fuerce volver a `Resumen de procesos` cuando el usuario sí puede operar la cola de movilidad.
- Validación cerrada con `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.

## Ajuste de estado visible y aging congelado en historial de Movilidad Interna

- [x] Auditar dónde se construye el estado visible del historial y qué timestamps ya están disponibles para calcular aging sin abrir migraciones innecesarias.
- [x] Ajustar la presentación para que una movilidad aprobada y luego ejecutada por RRHH se vea como `Ejecutada` en el resumen visible al solicitante y al gerente.
- [x] Reemplazar la columna `Requiere finiquito` del historial por `Días abierta`, congelando el contador al ejecutar RRHH o al rechazo, y revalidar tipado/build/diff.

## Resultado de ajuste de estado visible y aging congelado en historial de Movilidad Interna

- [`presentation.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/lib/presentation.ts:1) ahora consolida dos semánticas nuevas: `toInternalMobilityVisibleStatusLabel(...)`, que muestra `Ejecutada` cuando `status = approved` y `hr_execution_status = executed`, y `formatInternalMobilityOpenDays(...)`, que calcula días abiertos desde `approved_at` o `submitted_at` y los congela cuando existe `hr_execution_executed_at` o `rejected_at`.
- [`InternalMobilityPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/pages/InternalMobilityPage.tsx:1) dejó de mostrar solo `Aprobada/Rechazada` en la tabla histórica. Ahora el solicitante o gerente ve `Ejecutada` en la columna `Estado` cuando RRHH ya cerró la movilidad.
- En esa misma tabla, la columna final ya no muestra `Requiere finiquito`. Ahora muestra `Días abierta`, con el aging congelado al momento de ejecución o rechazo para no seguir corriendo después del cierre operativo.
- El detalle modal también quedó alineado: el encabezado usa el estado visible consolidado y la sección de destino expone `Días abierta` junto al resto del contexto operativo.
- Validación cerrada con `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.

## Alta de contratos ACCIONA - TRANQUE TALABRE y SIGMA - DAND en catálogo operacional

- [x] Auditar la fuente de verdad de contratos/áreas para no tocar solo el aprobador por CECO y dejar roto el catálogo operacional.
- [x] Versionar una migración puntual que agregue o actualice ambos contratos en `contracts` y `buk_contract_mappings` siguiendo el patrón del catálogo BUK vigente.
- [x] Aplicar el cambio al proyecto productivo correcto, validar disponibilidad y cerrar con auditoría de migraciones/diff.

## Resultado de alta de contratos ACCIONA - TRANQUE TALABRE y SIGMA - DAND en catálogo operacional

- Se agregó la migración [`20260622183000_add_acciona_talabre_sigma_dand_contract_mappings.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260622183000_add_acciona_talabre_sigma_dand_contract_mappings.sql:1), que reutiliza el mismo patrón del catálogo BUK vigente: sanea/crea filas en `contracts` y luego inserta o actualiza `buk_contract_mappings`, cerrando finalmente el `contract_id`.
- Los dos contratos quedaron aplicados directamente sobre el proyecto real apuntado por `.env.local` (`pzblmbahnoyntrhistea`) usando `SUPABASE_SERVICE_ROLE_KEY`, porque en este entorno no está disponible el CLI `supabase`. El alta efectiva creó `CONT-102` para `5906986003:0001 / ACCIONA - TRANQUE TALABRE` y `CONT-103` para `7680816001:0001 / SIGMA - DAND`.
- La verificación remota confirmó que ambos `buk_area_name` ya existen en `buk_contract_mappings` con `contract_id` enlazado y código operacional visible (`CONT-102`, `CONT-103`), por lo que quedan disponibles para los flujos que consumen este catálogo.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260622183000_add_acciona_talabre_sigma_dand_contract_mappings.sql`, consulta remota de humo vía service role sobre `buk_contract_mappings`, `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.

## Endurecimiento de cupos en Movilidad Interna contra folios de Reclutamiento

- [x] Auditar el contrato real entre `internal_mobility_requests` y `recruitment_cases` para confirmar en qué momento los cupos del folio se descontaban o quedaban solo informativos.
- [x] Corregir la métrica de cupos para que las movilidades pendientes también reserven vacante desde la creación, no recién al aprobarse.
- [x] Blindar la aprobación final frente a sobrecupos legacy, validar el flujo y dejar documentada la regla operativa resultante.

## Historial expandible en Solicitudes visibles de Movilidad Interna

- [x] Auditar si la tabla actual puede reutilizar `get_internal_mobility_request_detail(...)` para mostrar historial inline sin crear contratos paralelos
- [x] Reemplazar la interacción modal por filas expandibles con flecha y bloques `Solicitud | Aprobación | Ejecución`, mostrando fechas, estados y actor responsable
- [x] Revalidar `TypeScript`, build frontend y diff limpio; documentar el resultado final en este archivo y en `tasks/lessons.md` si aparece un patrón reusable

## Resultado de historial expandible en Solicitudes visibles de Movilidad Interna

- [`InternalMobilityPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/pages/InternalMobilityPage.tsx:1) dejó de abrir un modal externo para el historial visible. La tabla ahora usa el patrón expandible estándar del repo: flecha en el folio, toggle inline y una fila secundaria con el detalle debajo del registro seleccionado.
- El cambio reutiliza la RPC ya vigente [`get_internal_mobility_request_detail(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617170000_add_internal_mobility_hr_execution_stage.sql:312), por lo que no fue necesario inventar un segundo contrato ni abrir una migración solo para la UI.
- La expansión muestra tres bloques fijos alineados al flujo pedido: `Solicitud`, `Aprobación` y `Ejecución`. En cada uno se exponen actor, fechas y estado útil para auditoría operativa; además se conservaron las acciones RRHH dentro del bloque `Ejecución`.
- Validación cerrada con `npx tsc -b --pretty false` y `git diff --check`. `vite build` volvió a quedar en `transforming...` sin consumo relevante de CPU, reproduciendo el síntoma ya conocido del entorno y no un error nuevo introducido por este ajuste.

## Sincronización de estado operativo de contratos BUK para formularios

- [x] Auditar el workbook `Libro1.xlsx` contra `public.buk_contract_mappings` para medir diferencias reales de `is_operational` y filas faltantes
- [x] Versionar una actualización del catálogo maestro para que contratación y movilidad interna consuman el estado `Operativo/Terminado` desde la misma fuente
- [x] Verificar que los formularios de solicitud de contrataciones y movilidad interna ya queden limitados a mappings operativos sin abrir contratos paralelos en frontend
- [x] Validar con humo remoto del catálogo, `TypeScript`, build frontend si cierra, y diff limpio; documentar resultado y lección si aparece un patrón reusable

## Normalización one-to-one del catálogo BUK en formularios operativos

- [x] Auditar por qué mappings operativos del workbook siguen compartiendo `contract_id` y quedan fuera del selector pese a ser válidos para negocio
- [x] Versionar una normalización segura del catálogo para asignar contrato dedicado a cada mapping operativo que hoy quedó ambiguo, sin romper folios ni historiales existentes

## Hotfix de drift de esquema en submit de Movilidad Interna

- [x] Auditar el error `request_id of relation internal_mobility_request_approvals does not exist` al enviar una movilidad interna
- [x] Corregir la RPC `submit_internal_mobility_request(...)` para alinearla con el esquema vivo de aprobaciones y auditoría de movilidad
- [x] Aplicar la migración en Supabase, validar humo remoto del contrato y dejar documentado el hallazgo

## Resultado de hotfix de drift de esquema en submit de Movilidad Interna

- La causa raíz estaba en la versión vigente de [`submit_internal_mobility_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260623200718_fix_internal_mobility_destination_resolution.sql:138): al rehacer la resolución de destino por folio/cupo, la función volvió a insertar en `internal_mobility_request_approvals (request_id, ...)` y `internal_mobility_request_audit_log (request_id, ...)`, aunque el esquema real usa `internal_mobility_request_id`.
- Eso dejó una mezcla peligrosa: la mitad de la RPC estaba al día con la lógica de folios de reclutamiento, pero los inserts de aprobaciones y auditoría quedaron copiados desde un contrato previo. El error aparecía exactamente al momento de enviar la solicitud, antes de que la aprobación pudiera siquiera crearse.
- Se agregó y aplicó la migración [`20260624014344_fix_internal_mobility_submit_approval_schema_drift.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260624014344_fix_internal_mobility_submit_approval_schema_drift.sql:1), que reemplaza la función completa por una versión consistente con el esquema vivo: conserva la resolución one-to-one del destino por folio, repone los inserts correctos en `internal_mobility_request_snapshots`, `internal_mobility_request_approvals` y `internal_mobility_request_audit_log`, y vuelve a sincronizar el caso de reclutamiento con `sync_recruitment_case_status(...)`.
- La publicación remota quedó cerrada con `SUPABASE_DISABLE_TELEMETRY=1 npx --yes supabase db push --linked --include-all` y `SUPABASE_DISABLE_TELEMETRY=1 npx --yes supabase migration list --linked`, confirmando que la migración [`20260624014344`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260624014344_fix_internal_mobility_submit_approval_schema_drift.sql:1) ya está alineada entre local y remoto.
- Como humo remoto adicional se consultó el `pg_get_functiondef(...)` de la función publicada para verificar que ya no existan inserts malos a `request_id` ni en aprobaciones ni en auditoría. Validación local cerrada además con `npm run audit:migrations -- --files supabase/migrations/20260624014344_fix_internal_mobility_submit_approval_schema_drift.sql` y `git diff --check`.

## Corrección integral de métricas y performance en Reclutamiento / BI

- [x] Unificar la métrica `Candidatos en curso` en Control de Candidatos, excluyendo contratados, rechazados y retirados
- [x] Corregir BI Reclutamiento para que `Folios abiertos` excluya casos cubiertos, cerrados y cancelados sin depender de listas truncadas
- [x] Reemplazar en BI Reclutamiento los filtros `Contrato / Cargo` por `Gerencia / Contrato`, con catálogos coherentes y columnas equitativas
- [x] Homologar el tamaño de las tarjetas, ordenar el bloque de Movilidad Interna y retirar los tiempos de aprobación/ejecución solicitados
- [x] Sustituir la agregación pesada en React por una única RPC filtrada y agregada en PostgreSQL, preservando el alcance por rol y CECO
- [x] Auditar y optimizar la carga de BI y los detalles expandibles, evitando polling, payloads duplicados y consultas N+1 innecesarias
- [x] Aplicar/versionar la migración en Supabase y validar cifras reales, permisos, índices, tipado, build y regresiones visuales

## Resultado de corrección integral de métricas y performance en Reclutamiento / BI

- La causa de `60` folios no era visual: BI agregaba en React sobre `active_cases`, una lista operacional truncada a 60 filas después de mezclar casos activos con solicitudes cerradas/rechazadas. La consulta remota confirmó `54` folios realmente abiertos y la nueva RPC entrega ese mismo valor.
- [`get_bi_recruitment_dashboard(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260624021807_optimize_recruitment_bi_metrics_and_filters.sql:5) quedó como fuente única de BI Reclutamiento. Calcula stocks completos en PostgreSQL, preserva el scope por rol/CECO, devuelve solo agregados y expone filtros encadenados de `Gerencia` y `Contrato`.
- La métrica `Candidatos en curso` quedó unificada: incluye cualquier etapa vigente, incluido `ready_for_hire`, y excluye solo `hired`, `rejected` y `withdrawn` dentro de folios abiertos. La comprobación productiva devolvió `46`.
- La vista de BI ahora muestra seis tarjetas principales de tamaño homogéneo y un segundo bloque con `Movilidades Internas`, `Movilidades Ejecutadas`, `Pend. Ejecución RRHH` y `Pendiente de Aprobación`. Se eliminaron `T. Aprobación MI` y `T. Ejecución RRHH`.
- El widget de folios de Inicio dejó de lanzar una segunda carga completa de Control de Contrataciones. Reutiliza `operational_summary_data` del bundle de Inicio y las expansiones comparten la caché de detalle de TanStack Query.
- El polling de respaldo de Reclutamiento y Movilidad pasó de 30 segundos a 5 minutos porque ambas superficies ya invalidan por Realtime. Esto reduce solicitudes periódicas simultáneas sin perder actualización operacional.
- Se agregaron seis índices específicos para estados activos, etapas de candidatos y fechas/estados de movilidad. En producción, la nueva RPC ejecutó en aproximadamente `33 ms`, frente a `68 ms` de `get_recruitment_control_dashboard_v2()` sin sumar la segunda llamada de movilidad que antes requería BI.
- Validación cerrada con auditoría canónica de migraciones, `npx tsc -b --pretty false`, `npm run build:frontend-check`, `git diff --check`, humo remoto de la RPC con `54` folios / `46` candidatos, prueba de filtro Zona II (`23` folios y `12` contratos), verificación de índices y alineación local/remota de la migración `20260624021807`.

## Corrección de BI Reclutamiento con fuentes reales

- [x] Auditar por qué la pestaña `Reclutamiento` estaba heredando widgets de `Analítica de Dotación`
- [x] Reemplazar la analítica de reclutamiento basada en RPC BI derivada por una vista sustentada en las fuentes operativas reales de reclutamiento y movilidad interna
- [x] Validar tipado/build/diff, documentar el resultado y registrar la lección para no volver a mezclar universos de BI

## Resultado de corrección de BI Reclutamiento con fuentes reales

- La causa raíz visual estaba en [`BiDashboardPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/pages/BiDashboardPage.tsx:1): la condición `activeView === "dotacion" || activeView === "reclutamiento"` envolvía no solo los filtros sino también todo el grid de dotación. Por eso la pestaña `Reclutamiento` heredaba tarjetas y gráficos que nunca debieron renderizarse allí.
- Esa mezcla además contaminaba el diagnóstico de negocio: el componente [`BiRecruitmentAnalyticsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/components/BiRecruitmentAnalyticsView.tsx:1) consumía un RPC BI derivado que no estaba alineado con la operación diaria, mientras el usuario contrastaba contra bandejas reales de reclutamiento y movilidad.
- La corrección separó ambos universos. `Dotación` volvió a renderizar solo su stack original, mientras `Reclutamiento` ahora usa un dataset propio calculado desde [`get_recruitment_control_dashboard_v2()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:449) y [`get_internal_mobility_requests()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/services/internalMobilityApi.ts:364), agregados en el hook [`useBiRecruitmentOperationalAnalytics.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/hooks/useBiRecruitmentOperationalAnalytics.ts:1).
- Las nuevas tarjetas y gráficos de reclutamiento quedaron limitadas a métricas respaldadas por esas fuentes vivas: folios/casos abiertos, cupos solicitados/cubiertos, candidatos en curso, listos para contratar, pendientes de aprobación, movilidades internas, estados de movilidad y pulso semanal operativo. Se retiraron del tablero de reclutamiento los bloques que dependían de inferencias no trazables.
- Los filtros de `Contratos` y `Cargos` dentro de `Reclutamiento` ya no se alimentan desde la dimensión de dotación. Ahora salen del mismo universo operativo filtrado, evitando que el selector ofrezca combinaciones o labels ajenos a la data real visible en esa pestaña.
- Validación cerrada con `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.
- [x] Aplicar la corrección directamente en Supabase, revalidar disponibilidad en contratación/movilidad y documentar el resultado final

## Resultado de normalización one-to-one del catálogo BUK en formularios operativos

- La causa raíz no era el estado `Operativo/Terminado`, sino la historia del catálogo `contracts`: varios mappings operativos válidos seguían apuntando al mismo `contract_id` genérico, por lo que el sistema los degradaba a `is_one_to_one = false` y los escondía de los formularios.
- Se confirmó que el modelo `public.contracts` sí permite la corrección elegante porque su unicidad es `(contract_number, contract_name)`, no solo `contract_number`. Eso habilita crear contratos dedicados por variante operativa sin tocar folios ni solicitudes históricas ya grabadas.
- Se dejó versionada la migración [`20260623192941_normalize_buk_operational_one_to_one_contracts.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260623192941_normalize_buk_operational_one_to_one_contracts.sql:1), que normaliza cualquier mapping operativo ambiguo creando el contrato exacto `contract_number + buk_area_name` cuando falta, reasignando el `contract_id` del mapping y recalculando `is_one_to_one` sobre el catálogo operativo final.
- La corrección quedó aplicada directamente en Supabase productivo. Se crearon `CONT-104` a `CONT-110` para los casos que no tenían contrato exacto: `ADMINISTRACION CALAMA`, `BODEGA JM`, `MANTENCION CALAMA JM`, `RECURSOS HUMANOS JM`, `RECURSOS HUMANOS ZONA NORTE`, `Newrest - Caserones` y `BODEGA ZONA NORTE`.
- Los casos que ya tenían contrato exacto reutilizable no se duplicaron: `INDIRECTOS ZONA II` siguió en `CONT-056` y `MANTENCION CALAMA` en `CONT-062`.
- La verificación remota posterior cerró limpia: `0` mappings operativos quedaron con `is_one_to_one = false`. En particular, `RECURSOS HUMANOS JM` y `RECURSOS HUMANOS ZONA NORTE` ahora resuelven a `CONT-107` y `CONT-108`, respectivamente, por lo que vuelven a ser seleccionables en contratación y también quedan disponibles para cualquier flujo que consuma destinos operativos one-to-one.

## Resultado de sincronización de estado operativo de contratos BUK para formularios

- Se auditó el workbook [`Libro1.xlsx`](/Users/maximilianocontrerasrey/Documents/GitHub/Libro1.xlsx) contra `public.buk_contract_mappings` y se encontró drift real de catálogo: faltaban 7 filas en base, había 10 diferencias de `is_operational` y 12 registros legacy fuera del workbook que seguían activos. El origen del desalineamiento no estaba en los formularios sino en la fuente maestra de mappings.
- Se dejó versionada la sincronización en [`20260623174202_sync_buk_contract_mapping_operational_status.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260623174202_sync_buk_contract_mapping_operational_status.sql:1) y además se aplicó directamente sobre el proyecto real apuntado por `.env.local`, actualizando campos descriptivos, corrigiendo `is_operational`, insertando los 7 faltantes y desactivando mappings operativos que ya no existen en el workbook.
- La verificación remota posterior cerró limpia para el contrato pedido: `104` filas del workbook presentes en base, `0` diferencias de estado, `0` diferencias descriptivas y `0` mappings operativos fuera del workbook. Solo quedaron `9` filas operativas `non one-to-one`, que se mantienen visibles en el catálogo maestro pero no se exponen como destino seleccionable porque hoy contratación y movilidad resuelven por `contract_id` único; abrirlas rompería el contrato vigente.
- Contrataciones ya consumía correctamente solo mappings `is_operational = true`, `is_one_to_one = true` desde [`hiringCatalogs.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringCatalogs.ts:78) y desde la RPC [`submit_hiring_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617215411_skip_redundant_area_manager_self_approval.sql:3), por lo que no requirió cambio funcional adicional.
- Movilidad interna ya estaba blindada en backend: [`submit_internal_mobility_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612003000_link_internal_mobility_to_recruitment_cases.sql:252) rechaza cualquier folio que no resuelva a un contrato destino operativo `is_operational = true` y `is_one_to_one = true`. El ajuste faltante estaba en la selección visual, porque `eligible_folios` podía seguir mostrando casos abiertos asociados a contratos ya terminados.
- Se corrigió esa última brecha en [`InternalMobilityPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/pages/InternalMobilityPage.tsx:102), filtrando `eligibleFolios` contra el conjunto de destinos operativos ya resueltos por la misma RPC. Con eso la UI deja de ofrecer folios terminados y el backend conserva el bloqueo transaccional si alguien intenta forzarlo.

## Resultado de endurecimiento de cupos en Movilidad Interna contra folios de Reclutamiento

- La auditoría del contrato vigente mostró la raíz exacta del problema en [`get_recruitment_case_effective_metrics(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612003000_link_internal_mobility_to_recruitment_cases.sql:14): `available_vacancies` solo restaba `hired_candidate_count + approved_mobility_count`. Eso significaba que una movilidad pendiente sí aparecía en métricas operativas, pero **no reservaba cupo** del folio.
- En la práctica, con esa lógica, un folio con `2` cupos podía aceptar `3` movilidades si ninguna había llegado todavía a `approved`. El bloqueo recién ocurría tarde o derechamente no ocurría en aprobación final, porque la reserva no nacía en `submit_internal_mobility_request(...)`.
- Se dejó versionada la migración [`20260622203000_harden_internal_mobility_vacancy_reservations.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260622203000_harden_internal_mobility_vacancy_reservations.sql:1), que cambia dos cosas:
  1. `available_vacancies` ahora descuenta `hired + mobility_pending + mobility_approved`, por lo que el cupo queda reservado desde que la solicitud entra a `pending_area_manager` o `pending_contracts_control`;
  2. la nueva helper `internal_mobility_request_has_reserved_slot(...)` blinda `decide_internal_mobility_request_approval(...)` para que una solicitud legacy que haya quedado fuera del cupo reservado no pueda aprobarse en Control de Contratos.
- La auditoría remota de datos sobre el proyecto real no encontró hoy casos activos sobre-reservados ni pendientes abiertas, por lo que el ajuste es preventivo y endurece el flujo antes de que aparezca el primer desborde real.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260622203000_harden_internal_mobility_vacancy_reservations.sql`, `npx tsc -b --pretty false`, `git diff --check` y auditoría remota por `service_role` sobre `recruitment_cases`, `recruitment_case_candidates` e `internal_mobility_requests`.
- Aplicación remota pendiente: el entorno sí permite `npx supabase migration list --linked`, pero `npx supabase db push --linked` falla por autenticación del pooler (`cli_login_postgres`, `SQLSTATE 28P01`). El bloqueo es del acceso DB del entorno, no del SQL preparado.

## Eliminación de autoaprobación redundante en Solicitud de Contrataciones

- [x] Auditar el flujo real de creación de folios para identificar por qué un gerente solicitante recibía de vuelta su propia aprobación de área
- [x] Versionar y aplicar en Supabase una migración que salte automáticamente a `control_contratos` cuando el solicitante coincide con el aprobador del CECO
- [x] Mantener trazabilidad completa del paso omitido, validar el diff y dejar documentada la regla operativa

## Resultado de eliminación de autoaprobación redundante en Solicitud de Contrataciones

- Se agregó la migración [`20260617215411_skip_redundant_area_manager_self_approval.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617215411_skip_redundant_area_manager_self_approval.sql:1), ya aplicada en Supabase, que redefine [`submit_hiring_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617215411_skip_redundant_area_manager_self_approval.sql:3).
- La regla nueva detecta cuando `auth.uid()` coincide con `cost_center_approvers.approver_user_id` del contrato solicitado. En ese caso, el folio nace directamente en `pending_contracts_control` y `current_step_code = 'contracts_control'`, sin devolver la aprobación al mismo gerente que lo creó.
- No se perdió auditoría: el paso `area_manager` se sigue insertando en `hiring_request_approvals`, pero autoaprobado con comentario explícito y con `hiring_request_audit_log` marcando `auto_skipped_area_manager = true`.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260617215411_skip_redundant_area_manager_self_approval.sql`, `git diff --check` y `npx --yes supabase db push --linked --yes`.

## Ajuste de alcance y jerarquía del widget operativo de incentivos

- [x] Auditar el resumen operativo vigente para confirmar cómo se calcula el alcance visible y qué métricas de incentivos expone hoy
- [x] Extender el backend para dar alcance amplio a `administrativo` y agregar el monto total emitido excluyendo rechazados
- [x] Reordenar la hoja de incentivos del widget para mostrar primero `Aprobados` y `Pendientes`, con el monto total debajo, y revalidar tipado/migración

## Resultado de ajuste de alcance y jerarquía del widget operativo de incentivos

- Se agregó la migración [`20260617222335_adjust_dashboard_operational_incentives_widget_scope.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617222335_adjust_dashboard_operational_incentives_widget_scope.sql:1), que redefine `get_dashboard_operational_summary()` para incluir a `administrativo` dentro del `broad_access`.
- En la misma RPC, la sección `incentives` ahora agrega `total_amount` usando `sum(hir.calculated_amount)` solo para solicitudes con `status <> 'R'`, manteniendo la exclusión de rechazados tanto en monto como en total emitido.
- El frontend quedó alineado en [`dashboardService.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/services/dashboardService.ts:1), [`types/index.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/types/index.ts:131) y [`DashboardOperationalSummaryCard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardOperationalSummaryCard.tsx:1): la hoja de incentivos ahora muestra primero `Aprobados`, luego `Pendientes` y debajo `Monto total`.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260617222335_adjust_dashboard_operational_incentives_widget_scope.sql`, `npx tsc -b --pretty false` y `git diff --check`.

## Limpieza y estandarización profunda del frontend del dashboard

- [x] Auditar hotspots del home y detectar contratos muertos, inline styles y componentes demasiado concentrados
- [x] Separar tarjetas densas en subcomponentes reutilizables, limpiar props/estado innecesarios y retirar CSS sin uso
- [x] Revalidar `TypeScript`, build frontend y diff limpio antes de commit/push

## Resultado de limpieza y estandarización profunda del frontend del dashboard

- [`DashboardInfoCards.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardInfoCards.tsx:1) dejó de concentrar la presentación completa de clima y cumpleaños. Esa UI se extrajo a [`DashboardWeatherCard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardWeatherCard.tsx:1) y [`DashboardBirthdayCard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardBirthdayCard.tsx:1), manteniendo la lógica de datos en el contenedor y bajando acoplamiento visual.
- Se eliminaron contratos muertos del dashboard: `pendingTasksCount` y `approvalTrackingCount` ya no viajan hacia `DashboardInfoCards`, y `WeatherState` ya no arrastra `temperatureMax/temperatureMin` que la UI no consumía.
- [`dashboard.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/styles/dashboard.css:1) quedó más honesto: se trasladó presentación inline de clima/cumpleaños a clases de módulo y se removieron selectores sin consumidores reales (`dashboard-info-primary`, `dashboard-info-secondary`, weather helpers legacy).
- La tarjeta operativa también quedó más limpia: [`DashboardOperationalSummaryCard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardOperationalSummaryCard.tsx:1) ya no usa leyendas inferiores ni estilos inline residuales para su heading.

## Ensamble BUK: alta de ficha y carga documental

- [x] Auditar el flujo actual de creación de empleado y carga documental BUK para detectar drift contra el endpoint oficial confirmado por soporte
- [x] Unificar la lógica de upload documental BUK entre reclutamiento y acreditaciones, endureciendo contratos y trazabilidad
- [x] Aplicar en Supabase la migración mínima necesaria para auditoría del job de sincronización y desplegar las Edge Functions ajustadas
- [x] Validar build, auditoría de migraciones y humo operacional de la integración antes de commit/push

## Endurecimiento de validación de build frontend

- [x] Reproducir e identificar si `vite build` realmente se bloquea o solo queda silencioso durante la fase de transformación
- [x] Dejar una vía de validación frontend determinística y observable para evitar falsos positivos de “build colgado”
- [x] Revalidar el build completo con la nueva vía y documentar el hallazgo

## Widget operativo multipestaña en Inicio

- [x] Auditar el bundle actual del dashboard y reutilizar la misma regla de visibilidad de procesos para evitar contratos nuevos de permisos
- [x] Extender backend con un resumen operativo agregado de reclutamiento, dotación e incentivos, aplicado directamente en Supabase
- [x] Incorporar un cuarto widget paginado en Inicio consumiendo el nuevo payload y revalidar build, migraciones y query remota de humo

## Resultado de endurecimiento de validación de build frontend

- La duda quedó cerrada con reproducción directa: `vite build` no estaba colgado. El proceso sí completaba, pero la etapa `transforming...` podía quedar varios segundos sin emitir líneas, lo que en ejecuciones previas se interpretó erróneamente como atasco.
- La validación determinística quedó estandarizada en [`scripts/run-frontend-build.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/run-frontend-build.mjs:1) y expuesta por el script `npm run build:frontend-check` en [`package.json`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/package.json:1).
- Ese runner separa `TypeScript` y `Vite`, imprime timestamps de inicio y cierre por fase, y aplica timeout real por etapa. Con esto ya no dependemos de interpretar silencio de consola como estado del build.
- La revalidación completa quedó cerrada en este entorno con `TypeScript` en `5s` y `Vite` en `4s`, además de `✓ 1112 modules transformed` y artefactos `dist` regenerados correctamente.

## Resultado de widget operativo multipestaña en Inicio

- Se agregó el componente [`DashboardOperationalSummaryCard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardOperationalSummaryCard.tsx:1) y el home ahora muestra un cuarto card paginado, con navegación y rotación automática, para resumir `Reclutamiento`, `Dotación` e `Incentivos` al lado de los widgets superiores existentes.
- El backend quedó endurecido con tres migraciones versionadas y aplicadas en Supabase: [`20260617200234_add_dashboard_operational_summary_widget_scope.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617200234_add_dashboard_operational_summary_widget_scope.sql:1), [`20260617200819_fix_dashboard_operational_summary_employee_scope.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617200819_fix_dashboard_operational_summary_employee_scope.sql:1) y [`20260617201047_align_dashboard_operational_summary_workforce_scope.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617201047_align_dashboard_operational_summary_workforce_scope.sql:1).
- El nuevo helper SQL `get_dashboard_operational_summary()` reutiliza `user_can_view_hiring_request_process_summary(...)` como fuente única de alcance visible. Con eso, `operaciones_l_1` queda acotado a sus propios procesos, y perfiles gerenciales/directivos heredan la visibilidad por CECO ya vigente sin abrir un bypass paralelo.
- La parte de dotación necesitó una corrección explícita contra el esquema vivo: `employees_active_current.contract_code` está alineado al `cost_center_code` BUK y no al `contracts.code`. Por eso la lógica final normaliza y compara CECO para headcount/ausentismo, mientras mantiene `contracts.code` para incentivos.
- Validación cerrada con `npx tsc -b --pretty false`, `npm run build:frontend-check`, `npm run audit:migrations -- --files ...` sobre las tres migraciones, `git diff --check`, `supabase db push --linked --yes` y query remota de humo sobre `get_dashboard_home_bundle(6)`, que devolvió `operational_summary_data` con datos reales en las tres pestañas.
- Ajuste posterior de alcance: la primera versión todavía subdimensionaba dotación e incentivos porque derivaba su universo desde contratos presentes en `hiring_requests`. Se corrigió con [`20260617212727_fix_dashboard_operational_scope_for_workforce_and_incentives.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617212727_fix_dashboard_operational_scope_for_workforce_and_incentives.sql:1), separando el scope de `Reclutamiento` del scope de `Dotación/Incentivos` por rol. La query remota del bundle pasó de `532` a `1576` contratados visibles para el mismo usuario validado.

## Resultado de ensamble BUK: alta de ficha y carga documental

- El drift confirmado estaba en el contrato de documentos: ambas Edge Functions BUK seguían construyendo por defecto la ruta `.../documents`, mientras la referencia oficial validada con soporte es `POST /employees/{id}/docs`.
- Se creó el helper compartido [`supabase/functions/_shared/bukDocuments.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/_shared/bukDocuments.ts:1) para que reclutamiento y acreditaciones usen exactamente la misma lógica de URL, subida y parseo de respuesta BUK. Ese helper normaliza templates legacy, soporta placeholders `{employee_id}` o `{id}` y corrige automáticamente templates heredados que todavía apunten a `/documents`.
- La carga documental quedó endurecida con fallback controlado: primero intenta `multipart/form-data` con `file`, y si BUK responde con errores típicos de contrato (`400/409/415/422`), reintenta mediante `file_base64`, que es el segundo formato documentado por soporte.
- Se agregó la migración [`20260617165000_harden_buk_document_upload_contract.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617165000_harden_buk_document_upload_contract.sql:1), ya aplicada en Supabase, para incorporar `buk_sync_jobs.result_snapshot` y no seguir sobreescribiendo `payload_snapshot`. Desde ahora el job conserva el input original y registra aparte el empleado creado, los documentos subidos, el transporte usado (`file` o `file_base64`) y cualquier error.
- La Edge Function [`sync-buk-candidates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1) ya no pierde trazabilidad: cada documento aprobado descargado desde `candidate-docs` queda reflejado en `result_snapshot.documents`, junto con el `bukDocumentId` y la respuesta devuelta por BUK.
- La Edge Function [`upload-buk-accreditation-document`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/upload-buk-accreditation-document/index.ts:1) quedó alineada al mismo helper y ahora devuelve también `transport` y `bukStatus`, manteniendo el contrato previo con `bukDocumentId`, `bukDocumentUrl` y `documentName`.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260617165000_harden_buk_document_upload_contract.sql`, `npx tsc -b --pretty false`, `git diff --check`, `supabase migration list --linked`, `supabase db push --linked --include-all` y deploy directo de `sync-buk-candidates` + `upload-buk-accreditation-document` al proyecto `pzblmbahnoyntrhistea`. En este entorno, `vite build` quedó colgado sin salida ni consumo relevante de CPU, por lo que no lo usé como señal válida de cierre.

## Resultado de etapa RRHH en Movilidad Interna y auditoría preventiva de legacies

- Se agregó la migración [`20260617170000_add_internal_mobility_hr_execution_stage.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617170000_add_internal_mobility_hr_execution_stage.sql:1), ya aplicada en Supabase, para introducir una segunda capa operativa sobre movilidades aprobadas: `hr_execution_status = pending|executed`, con trazabilidad de último gestor y ejecutor RRHH.
- La aprobación sigue significando “movilidad autorizada”; la nueva etapa RRHH significa “anexo generado y firmas gestionadas”. Esto evita sobrecargar `status = approved` con semántica operativa nueva y deja auditable el cierre real del traslado.
- Se creó la RPC [`set_internal_mobility_hr_execution_status(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617170000_add_internal_mobility_hr_execution_stage.sql:74), limitada a `admin`/`superadmin` y rol `administrativo`. También se corrigió el helper de visibilidad para que `administrativo` pueda operar la cola RRHH y no quede con acceso al módulo pero sin visibilidad funcional.
- En frontend, las vistas [`InternalMobilityPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/pages/InternalMobilityPage.tsx:1) y [`HiringInternalMobilityView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringInternalMobilityView.tsx:1) ahora muestran el estado RRHH y permiten marcar `Pendiente de Ejecución RRHH` o `Ejecutado RRHH` según permisos. La bandeja operativa de ejecución filtra solo movilidades aprobadas aún no ejecutadas, de modo que desaparecen al cerrarse.
- Como saneamiento de código, se centralizó la presentación de estados y auditoría en [`presentation.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/lib/presentation.ts:1), reduciendo duplicación entre módulos y bajando riesgo de drift visual o semántico.
- La pasada preventiva de legacies sobre movilidad confirmó que en la base activa no existe un trigger equivalente al residuo que rompía contrataciones: sobre `internal_mobility_request_approvals` solo quedaron `trg_internal_mobility_pending_email_dispatch`, `trg_internal_mobility_request_approvals_set_updated_at` y `trg_mobility_approvals_rejected_email_dispatch`.

## Corrección de rechazo de folios en Control de Contratos

- [x] Auditar el flujo de rechazo de aprobaciones de folios y contrastarlo contra la constraint activa de `hiring_requests`
- [x] Identificar drift o artefactos legacy en Supabase que puedan reescribir estados inválidos
- [x] Publicar una migración defensiva que elimine el trigger legacy responsable, aplicarla en Supabase y validar el cierre

## Resultado de corrección de rechazo de folios en Control de Contratos

- La causa raíz no estaba en el modal ni en permisos: la base remota todavía mantenía activo el trigger legacy [`trg_hiring_request_approvals_refresh_status`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617161500_remove_legacy_hiring_status_refresh_trigger.sql:1) sobre `hiring_request_approvals`.
- Ese trigger dependía de las funciones heredadas `refresh_hiring_request_status(...)` y `handle_hiring_request_approval_change()`, diseñadas para el workflow antiguo con estados `pendiente` y `aprobada`. Al rechazar un folio desde el flujo actual, el trigger intentaba reescribir `public.hiring_requests.status` con valores fuera de la constraint moderna y provocaba el error `hiring_requests_status_check`.
- Se agregó la migración [`20260617161500_remove_legacy_hiring_status_refresh_trigger.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617161500_remove_legacy_hiring_status_refresh_trigger.sql:1) para eliminar explícitamente ese trigger y ambas funciones legacy, dejando como única autoridad de transición de estado a las RPCs vigentes (`decide_hiring_request_approval_v2` y `close_hiring_request`).
- La migración quedó aplicada directamente en Supabase. El smoke remoto posterior confirmó que `trg_hiring_request_approvals_refresh_status` ya no existe, que `refresh_hiring_request_status(...)` y `handle_hiring_request_approval_change()` quedaron removidas, y que la constraint `hiring_requests_status_check` sigue aceptando exactamente `pending_area_manager`, `pending_contracts_control`, `approved`, `rejected` y `closed`.

## Estabilización enterprise SQL/RLS/contratos previa a producción

- [x] Eliminar secretos `service_role` hardcodeados del repo y dejar tooling de auditoría para impedir regresión
- [x] Crear auditor SQL de seguridad para detectar JWTs, grants peligrosos, helpers con `p_user_id`, policies amplias de Storage y migraciones con RPC/policies sin `notify pgrst`
- [x] Encapsular escritura de Operaciones en una RPC transaccional `submit_service_entries_batch(...)`
- [x] Encapsular lecturas de Alta Operacional mediante RPCs `get_operational_onboarding_*` y retirar escrituras directas innecesarias
- [x] Endurecer Storage `candidate-docs` para que las rutas queden acotadas a candidatos/casos visibles
- [x] Agregar validadores de payload en servicios frontend para fallar explícitamente ante drift SQL <-> TypeScript
- [x] Ejecutar validaciones locales y smoke tests posibles antes de cierre

## Auditoría y publicación de ajustes pendientes en Roster

- [x] Auditar el diff staged en `src/modules/roster` para detectar regresiones visuales o de comportamiento antes de publicar
- [x] Validar los cambios con checks relevantes del módulo (`npx tsc -b`, `npm run build`, `git diff --check`)
- [x] Si la auditoría queda limpia, commitear y push a `main`

## Resultado de auditoría y publicación de ajustes pendientes en Roster

- La auditoría del refactor visual detectó una regresión responsive introducida por el reemplazo de `hr-incentives-list-item` por `roster-list-item`: en mobile se perdió el apilado vertical de filas con botón inline. Se corrigió en [`src/modules/roster/styles/roster.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster/styles/roster.css:347) restaurando el comportamiento de columna bajo `768px`.
- Los formularios y listas del módulo quedaron desacoplados de estilos heredados de Incentivos mediante `roster-form-grid`, `roster-list`, `roster-list-item` y `roster-inline-button`, evitando dependencias visuales cruzadas.
- Validación cerrada con `git diff --check`, `npx tsc -b` y `npm run build` antes del commit y push.

## Revisión del warning falso de recarga de app

- [x] Inspeccionar el `AppErrorBoundary` y el helper `lazyWithRetry` para identificar qué condición dispara el mensaje de recarga
- [x] Verificar si el backend participa en ese flujo o si la causa es exclusivamente de carga dinámica frontend
- [x] Corregir el mensaje para no atribuir erróneamente el problema a un deploy inexistente
- [x] Validar `npx tsc -b` y `git diff --check`

## Resultado de revisión del warning falso de recarga de app

- La causa raíz no estaba en Supabase ni en una verificación de versión backend. El mensaje provenía del boundary global [`AppErrorBoundary.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/AppErrorBoundary.tsx:1), que trataba cualquier `chunk load error` como si fuera necesariamente una publicación reciente.
- Ese mismo tipo de error también puede dispararse por fallas transitorias al cargar un módulo lazy (`failed to fetch dynamically imported module`, `loading chunk`, etc.), por lo que el diagnóstico “hubo deploy” era técnicamente incorrecto.
- La detección de `chunk load error` quedó centralizada en [`lazyWithRetry.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/lib/lazyWithRetry.ts:1) y el mensaje visible ahora es neutral: indica que puede deberse a conexión inestable o a actualización reciente, sin mentir sobre un deploy inexistente.

## Endurecimiento de carga lazy y caché para Cloudflare Pages

- [x] Auditar la relación entre deploy automático de Pages, chunks lazy hasheados y errores `failed to fetch dynamically imported module`
- [x] Bajar headers de caché explícitos para que el shell HTML no quede desincronizado respecto a assets versionados
- [x] Precargar en segundo plano los módulos visibles y también al hover/focus de navegación
- [x] Validar `npm run build`, `git diff --check` y que `_headers` llegue a `dist`

## Resultado de endurecimiento de carga lazy y caché para Cloudflare Pages

- La causa estructural más probable quedó identificada: el proyecto está preparado para Cloudflare Pages conectado al repo, por lo que cada push a `main` puede publicar automáticamente una nueva versión con chunks hasheados distintos aunque no haya “deploy manual”.
- Se agregó [`public/_headers`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/public/_headers:1) para que `/*` se sirva con `Cache-Control: no-cache, must-revalidate`, mientras [`/assets/*`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/public/_headers:4) queda `immutable`. Con esto el navegador vuelve a validar el shell HTML y reduce el riesgo de quedar apuntando a hashes viejos.
- Se creó la capa [`routeModules.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/router/routeModules.ts:1) y [`AppShell.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/layout/AppShell.tsx:1) ahora precarga los módulos visibles en `idle` y también al `hover/focus` de la navegación. La meta es bajar la ventana en que un usuario llega por primera vez a un chunk lazy justo después de una publicación o de una red inestable.
- La validación cerró con `npm run build`, `git diff --check` y comprobación directa de que `dist/_headers` se genera junto a `dist/_redirects`.

## Endurecimiento de escalabilidad masiva en Incentivos

- [x] Eliminar recomputaciones innecesarias del contexto y preview en `create_hr_incentive_request(...)` para reducir costo por ingreso
- [x] Volver atómica la aprobación masiva de incentivos y endurecer el locking para bajar riesgo de éxito parcial o deadlocks
- [x] Hacer segura bajo concurrencia la marcación automática de `extra_shift` en descansos trabajados
- [x] Validar `npm run audit:migrations`, `npx tsc -b`, `git diff --check`, queries de humo y empujar a `main`

## Resultado de endurecimiento de escalabilidad masiva en Incentivos

- Se agregó la migración [`20260614235500_optimize_hr_incentive_mass_workflows.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614235500_optimize_hr_incentive_mass_workflows.sql:1), ya aplicada en Supabase, para optimizar el camino de ingresos y aprobaciones masivas del módulo de incentivos.
- El cuello principal de validación quedó reducido separando un helper interno liviano [`get_hr_incentive_worker_core(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614235500_optimize_hr_incentive_mass_workflows.sql:26) del payload pesado de [`get_hr_incentive_worker_context(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614235500_optimize_hr_incentive_mass_workflows.sql:94). `calculate_hr_incentive_preview(...)` y [`create_hr_incentive_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614235500_optimize_hr_incentive_mass_workflows.sql:363) ahora reutilizan contexto resuelto una sola vez mediante [`build_hr_incentive_preview_from_worker_data(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614235500_optimize_hr_incentive_mass_workflows.sql:203), en vez de recalcular trabajador + preview completo sobre la misma solicitud.
- La mejora quedó medida en la base activa con una simulación segura de solo lectura: `calculate_hr_incentive_preview(...)` repetido 100 veces bajó de aproximadamente `4.43s` a `3.09s`, cerca de un `30%` menos de tiempo total para el mismo caso válido.
- La aprobación masiva ya no deja éxito parcial por diseño. [`bulk_decide_hr_incentive_request_approvals(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614235500_optimize_hr_incentive_mass_workflows.sql:607) ahora deduplica IDs, bloquea aprobaciones y solicitudes en orden determinístico y deja que cualquier error aborte el lote completo en la misma transacción.
- La marcación automática de descansos trabajados dejó de depender de `select + insert/update` separados. [`create_hr_incentive_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614235500_optimize_hr_incentive_mass_workflows.sql:534) ahora usa `insert ... on conflict ... do update` sobre `hr_roster_exceptions`, reactivando solo `extra_shift` válidos y preservando excepciones de mayor jerarquía como BUK.
- Para soportar escala real también se agregaron índices alineados al patrón de uso: búsqueda normalizada de aprobadores en `profiles`, resolución operativa en `buk_contract_mappings`, matching de reglas en `hr_incentive_rate_rules` y cola global de aprobaciones pendientes para vistas administrativas.

## Endurecimiento enterprise de Alta Operacional de Personal

- [x] Corregir la guarda de acceso del módulo para alinear la ruta con la regla real de `admin` o `superadmin`
- [x] Reemplazar `prompt` / `confirm` / `alert` del builder y del inicio de casos por formularios y feedback auditables
- [x] Bajar la configuración sensible de plantillas y tareas a RPCs con trazabilidad versionada
- [x] Reparar la semántica de estados y completar el detalle operativo de personas en proceso con tareas y bitácora real
- [x] Validar `npx tsc -b`, `npm run build`, `npm run audit:migrations` y `git diff --check`

## Resultado de endurecimiento enterprise de Alta Operacional de Personal

- Se agregó la migración [`20260614233000_harden_operational_onboarding_module.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614233000_harden_operational_onboarding_module.sql:1), que crea `onboarding_template_activity_log` y versiona RPCs para crear/actualizar plantillas y crear/actualizar/eliminar tareas con validación de permisos y comentario de auditoría opcional.
- La ruta [`/alta-operacional/:tab?`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/router/AppRouter.tsx:127) dejó de depender de `AdminProtectedRoute` y ahora usa el contrato modular real (`alta_operacional_personal`), consistente con el alta definida para `admin` y el bypass estructural de `superadmin`.
- El frontend del módulo quedó saneado: [`TemplateBuilderPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operational_onboarding/pages/TemplateBuilderPage.tsx:1) ahora usa formularios explícitos para metadata y tareas, elimina los `window.prompt/confirm/alert`, implementa edición real, confirmación de eliminación y comentarios auditables; [`StartOnboardingModal.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operational_onboarding/components/modals/StartOnboardingModal.tsx:1) ahora entrega validación inline y no cierra el flujo por errores silenciosos.
- La vista operativa quedó más honesta y útil: [`PeopleTab.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operational_onboarding/components/tabs/PeopleTab.tsx:1) ya no muestra placeholders de detalle sino tareas y bitácora reales por caso, y [`TasksTab.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operational_onboarding/components/tabs/TasksTab.tsx:1) dejó de clasificar `not_applicable` como pendiente.

## Limitación backend: Contador de Descansos Trabajados en Dashboard (RESUELTA)

- **Desacople detectado:** El frontend requiere mostrar en las tarjetas de KPIs del dashboard analítico (`IncentiveAnalyticsView.tsx`) un contador de "Descansos Trabajados" en lugar de "Solicitudes".
- **Limitación original:** La RPC `get_hr_incentives_analytics` no retornaba la sumatoria de `declared_rest_day_count`.
- **Acción tomada:** Codex agregó la migración SQL necesaria. En frontend, se endureció el tipo `HrIncentiveAnalyticsSummaryCards`, se mapeó `declared_rest_day_count` en la capa de servicios y se reemplazó el KPI de "Solicitudes" por "Descansos trabajados" en la vista.

## Alta Operacional de Personal: backend enterprise y acceso restringido

- [x] Auditar el onboarding legacy ya existente para evitar colisión de nombres o permisos con el nuevo módulo operacional
- [x] Versionar una migración SQL nueva con tablas, índices, triggers de `updated_at`, métricas automáticas de caso, trazabilidad y bucket privado de evidencias
- [x] Registrar el módulo `alta_operacional_personal` en `app_modules` dejando acceso explícito solo para `admin`, manteniendo `superadmin` por bypass estructural
- [x] Validar árbol de migraciones, typecheck, diff y push a `main`

## Limitación backend: Tipos no generados en Alta Operacional de Personal

- **Desacople detectado:** Codex creó 6 tablas nuevas para el Onboarding Operacional pero no actualizó `src/types/database.types.ts` mediante la CLI de Supabase, dejando al frontend ciego respecto a los nuevos contratos.
- **Acción tomada:** Fiel a la regla Eleonora (no tocar base de datos ni inferir arreglos de backend), no generé las interfaces SQL. En su lugar, compensé creando contratos estáticos TypeScript en `src/modules/operational_onboarding/types.ts` mapeando la migración leída. Esto permitió destrabar el frontend sin romper la arquitectura backend.

## RPC de inicio transaccional para Alta Operacional de Personal

- [x] Auditar el modelo desplegado de casos y tareas para definir una RPC consistente con las tablas nuevas
- [x] Versionar una migración SQL con `start_operational_onboarding(p_candidate_id uuid, p_template_id uuid)` y permisos explícitos
- [ ] Aplicar la migración en Supabase, probar creación real de caso+tareas y cerrar validación de árbol/typecheck/diff

## Resultado de Alta Operacional de Personal

- Se agregó la migración [`20260614213000_add_operational_onboarding_backend.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614213000_add_operational_onboarding_backend.sql:1), que implementa el backend del módulo `Alta Operacional de Personal` con las tablas `onboarding_templates`, `onboarding_template_tasks`, `employee_onboarding_cases`, `employee_onboarding_tasks`, `employee_onboarding_evidence` y `employee_onboarding_activity_log`.
- El diseño evita colisionar con el onboarding legacy de reclutamiento (`onboarding_processes`, `onboarding_employee_courses`). El nuevo flujo quedó en estructuras separadas, con trazabilidad propia, contadores automáticos por caso y bucket privado `onboarding_evidence`.
- Se registró el módulo `alta_operacional_personal` en `app_modules` con acceso explícito solo para `admin`. `superadmin` conserva acceso por la helper estructural `user_is_admin(...)`; no se abrió a otros roles ni se publicó una ruta React porque en este checkout todavía no existe frontend operativo para este módulo.
- Validación cerrada con `npm run audit:migrations`, `npx tsc -b`, `git diff --check` y aplicación real en Supabase (`pzblmbahnoyntrhistea`), además de verificación de tablas creadas, bucket privado y `role_module_access = ['admin']`.

## Limpieza enterprise de superficies compartidas de tareas y navegación

- [x] Auditar acoplamiento, ramas muertas y `any` introducidos en campana, widget de tareas y navegación
- [x] Centralizar la clasificación de tareas compartidas y eliminar tipado sintético/frágil en frontend
- [x] Validar typecheck y consistencia de diff

## Soporte multi-select en filtros RPC de Incentivos

- [x] Auditar las firmas activas de `get_hr_incentives_analytics(...)` y `get_hr_incentive_requests(...)` contra el contrato pedido por el frontend
- [x] Versionar una nueva migración SQL que cambie los filtros singulares por arreglos y sanee `grant execute` sobre las nuevas firmas
- [x] Alinear el cliente TypeScript para aceptar filtros singulares o múltiples sin romper las vistas actuales
- [x] Validar `npx tsc -b`, `git diff --check` y queries de humo en Supabase sobre ambas funciones

## Resultado de soporte multi-select en filtros RPC de Incentivos

- Se agregó la migración [`20260614170000_support_multi_select_hr_incentive_filters.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614170000_support_multi_select_hr_incentive_filters.sql:1), que reemplaza las firmas antiguas de [`get_hr_incentives_analytics(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614170000_support_multi_select_hr_incentive_filters.sql:4) y [`get_hr_incentive_requests(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614170000_support_multi_select_hr_incentive_filters.sql:261) por versiones con `text[]` y `uuid[]`.
- El backend ahora sanea arreglos vacíos, ignora valores en blanco, deduplica filtros y mantiene el comportamiento de `A = Todos` para estados. La lógica quedó bajada a `ANY(...)` sin inventar una segunda RPC ni dejar sobrecargas ambiguas vivas en PostgREST.
- En frontend se endureció el contrato en [`types.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/types.ts:298) y [`incentivesApi.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/services/incentivesApi.ts:700) para aceptar tanto el formato actual single-select como futuros arreglos (`status/statuses`, `contractCode/contractCodes`, `typeId/typeIds`) sin romper las vistas existentes.
- La migración quedó aplicada en Supabase y validada con queries de humo reales: `get_hr_incentives_analytics(null, array['CONT-028'], null, array['A'])` devolvió un `jsonb` válido y `get_hr_incentive_requests(null, array['P','E','A'], array['CONT-028'], null, null, null)` respondió filas bajo contexto autenticado administrativo.

## Alineación de historial remoto y cambios locales pendientes

- [x] Auditar el drift entre migraciones locales del repo y `supabase_migrations.schema_migrations`
- [x] Backfillear de forma segura las migraciones recientes ya aplicadas o supersedidas para que queden registradas en Supabase
- [x] Versionar el cambio local pendiente de `IncentiveAnalyticsView.tsx` y empujarlo a `main`
- [x] Validar `npx tsc -b`, `git diff --check`, estado limpio de git y relectura del historial remoto

## Resultado de alineación de historial remoto y cambios locales pendientes

- Se registraron en `supabase_migrations.schema_migrations` las versiones locales recientes que estaban fuera del historial remoto pero cuyo efecto ya estaba presente o absorbido por migraciones posteriores: `20260612224500`, `20260612233000`, `20260613103000`, `20260613150000`, `20260613193000`, `20260614001000`, `20260614102500`, `20260614104000`, `20260614113000`, `20260614130000`, `20260614133500` y `20260614170000`.
- El backfill no reejecutó DDL histórico sobre producción. Se hizo como saneamiento de auditoría después de verificar en base activa la presencia real de hitos recientes: tipos documentales con vencimiento, módulo roster, columnas de incentivos, helper BUK, horizonte de 6 meses y RPC analítica vigente.
- [`IncentiveAnalyticsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveAnalyticsView.tsx:1), que estaba modificado localmente y sin versionar, quedó integrado a `main` con sus ajustes visuales sobre labels internos de barras y cursores de tooltip.
- Queda identificado un drift legacy más antiguo en el repo: antes de esta ventana reciente existen archivos con un esquema de versionado distinto e incluso timestamps duplicados, por lo que su regularización completa exige una depuración histórica separada y no una carga ciega sobre producción.

## Reparación segura de gobernanza del árbol de migraciones legacy

- [x] Auditar en detalle el árbol de `supabase/migrations`, cuantificando naming canónico, legacy y colisiones reales
- [x] Congelar una baseline explícita del estado legacy para impedir que siga creciendo deuda silenciosa
- [x] Agregar un auditor automatizable y una guardia de CI para fallar ante nuevas migraciones fuera del estándar
- [x] Documentar el saneamiento con detalle sin renombrar ni reejecutar DDL histórico en producción

## Resultado de reparación segura de gobernanza del árbol de migraciones legacy

- Se creó el auditor [`scripts/audit-supabase-migrations.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/audit-supabase-migrations.mjs:1), capaz de clasificar migraciones canónicas y legacy, detectar naming inválido, detectar colisiones de versión normalizada, escribir baseline y validar que no entre deuda nueva.
- Se congeló el estado actual en [`supabase/migration-baseline.json`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migration-baseline.json:1). Esa baseline registra las `108` migraciones legacy permitidas hoy y la única colisión aceptada: `20260522000020`.
- Se agregó el workflow [`audit-supabase-migrations.yml`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/.github/workflows/audit-supabase-migrations.yml:1), que ejecuta `npm run audit:migrations` en cambios sobre `supabase/**` y bloquea nuevas migraciones con formato incorrecto o nuevas colisiones.
- La auditoría detallada quedó actualizada en [`supabase/MIGRATIONS_AUDIT.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/MIGRATIONS_AUDIT.md:1) y la guía operativa en [`supabase/README.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/README.md:1). La decisión consciente fue no renombrar ni mover las migraciones legacy en esta pasada porque el sistema productivo está estable y esa cirugía requiere una fase separada con baseline SQL o manifiesto remoto completo.

## Endurecimiento final de reglas entre Incentivos y Roster

- [x] Exigir en backend y frontend que el trabajador reemplazado figure en turno cuando el incentivo requiera reemplazo
- [x] Corregir warnings objetivos del dominio Incentivos/Roster en Supabase: grants expuestos, `search_path` mutable, índices faltantes y políticas RLS con `initplan`
- [x] Validar con `npx tsc -b`, `git diff --check`, advisors/queries de humo y documentar el cierre

## Resultado de endurecimiento final de reglas entre Incentivos y Roster

- Se agregó la migración [`20260614014734_harden_hr_incentive_replacement_shift_validation.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614014734_harden_hr_incentive_replacement_shift_validation.sql:1), ya aplicada en Supabase, para endurecer [`create_hr_incentive_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614014734_harden_hr_incentive_replacement_shift_validation.sql:99). Desde ahora, si el tipo de incentivo exige trabajador reemplazado, ese trabajador debe figurar `En turno` o `Turno adicional` en la fecha seleccionada; cualquier otro estado bloquea el registro con mensaje de negocio claro y deja trazabilidad en `hr_incentive_request_history.metadata.replacement_roster_validation`.
- En frontend, [`IncentiveRegistrationForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRegistrationForm.tsx:1) ahora consulta y muestra el estado operativo del trabajador reemplazado en tiempo real. El botón de registro queda bloqueado si ese trabajador está en descanso, sin pauta o con una ausencia.
- La misma migración corrigió deuda objetiva del dominio: cerró el `anon` expuesto sobre [`get_hr_incentive_approval_queue()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614014734_harden_hr_incentive_replacement_shift_validation.sql:369), agregó índices faltantes sobre `decision_by`, `created_by`, `assigned_by` y `pattern_id`, y rehízo las políticas RLS de `hr_shift_patterns`, `hr_worker_rosters` y `hr_roster_exceptions` con `initplan` estable.
- Se agregó además la migración [`20260614015101_harden_hr_buk_helper_search_paths.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614015101_harden_hr_buk_helper_search_paths.sql:1), también aplicada en Supabase, para fijar `search_path = public` en los helpers BUK/HR usados por búsquedas, cargo, turno y compañía.
- Validación cerrada con `npx tsc -b`, `git diff --check`, advisors y queries de humo sobre la base activa: la regla nueva quedó presente en la función, los grants del approval queue ya no exponen `PUBLIC/anon`, los índices existen y las policies quedaron actualizadas.

## Bloqueo de incentivos por vacaciones o licencia médica

- [x] Auditar la fuente canónica de estado de calendario y cómo Incentivos consume hoy `roster_validation`
- [x] Bloquear en backend el preview y el registro cuando el trabajador figure con `vacation` o `medical_leave`, incluso si la pauta está sin asignar
- [x] Validar `npx tsc -b`, `git diff --check` y documentar la regla con su lección

## Prioridad BUK sobre excepciones manuales de vacaciones y licencia

- [x] Auditar el contrato actual de excepciones de roster para confirmar si distingue origen manual vs BUK
- [x] Endurecer backend para permitir carga manual pero bloquear edición/desactivación manual de fechas gobernadas por BUK
- [x] Dejar una RPC explícita de sync BUK que sobreescriba excepciones manuales cuando difieran y reflejar el origen en el panel
- [x] Validar `npx tsc -b`, `git diff --check` y documentar el cierre aplicado en Supabase

## Resultado de prioridad BUK sobre excepciones manuales de vacaciones y licencia

- Se agregó la migración [`20260613203332_20260614160000_add_roster_exception_source_priority.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613203332_20260614160000_add_roster_exception_source_priority.sql:1), aplicada además en Supabase, para formalizar `exception_source` en [`hr_roster_exceptions`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613203332_20260614160000_add_roster_exception_source_priority.sql:1) con valores `manual` y `buk`.
- La carga manual sigue existiendo, pero la RPC [`upsert_hr_roster_exception(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613203332_20260614160000_add_roster_exception_source_priority.sql:18) ahora bloquea cualquier intento de modificar o reemplazar manualmente una fecha ya gobernada por BUK. Del mismo modo, [`set_hr_roster_exception_status(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613203332_20260614160000_add_roster_exception_source_priority.sql:136) impide activar o desactivar esas filas desde el panel.
- Se dejó lista la RPC [`sync_hr_roster_exception_from_buk(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613203332_20260614160000_add_roster_exception_source_priority.sql:172), pensada para la futura sync: cuando BUK entregue `vacation` o `medical_leave`, esa función sobreescribe la fila manual de ese trabajador/fecha y la convierte en `source='buk'`. Si BUK limpia la ausencia, también baja cualquier excepción manual o BUK de vacaciones/licencia para esa fecha, preservando la prioridad de la fuente oficial.
- [`get_worker_schedule(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613203332_20260614160000_add_roster_exception_source_priority.sql:265) ahora expone `exception_source` en la lista de excepciones y en cada día del calendario. Eso permitió endurecer el panel en [`RosterPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster/pages/RosterPage.tsx:1) y sus tipos/servicios asociados para mostrar `Origen: BUK/Manual`, bloquear botones inválidos y avisar antes de intentar guardar sobre una fecha gobernada por BUK.
- Validación cerrada con `npx tsc -b`, `git diff --check` y aplicación real de la migración en la base activa.

## Resultado de bloqueo de incentivos por vacaciones o licencia médica

- Se agregó la migración [`20260613201122_20260613194500_block_hr_incentives_for_leave_status.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613201122_20260613194500_block_hr_incentives_for_leave_status.sql:1), que redefine [`resolve_hr_roster_day_status(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613201122_20260613194500_block_hr_incentives_for_leave_status.sql:1) y [`calculate_hr_incentive_preview(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613201122_20260613194500_block_hr_incentives_for_leave_status.sql:118) para que vacaciones y licencia médica bloqueen el flujo de incentivos desde la fuente canónica de calendario.
- El bloqueo ya no depende de que el trabajador tenga una pauta asignada. [`resolve_hr_roster_day_status(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613201122_20260613194500_block_hr_incentives_for_leave_status.sql:1) ahora primero revisa excepciones activas y, si no existe roster vigente, igual expone `effective_status` y `exception_label`. Con eso, una futura carga desde BUK podrá bloquear incentivos aunque no exista pauta local.
- [`calculate_hr_incentive_preview(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613201122_20260613194500_block_hr_incentives_for_leave_status.sql:118) ahora rechaza explícitamente el preview cuando `effective_status` es `vacation` o `medical_leave`, devolviendo un mensaje rojo de negocio que impide también el registro final porque [`create_hr_incentive_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613200144_mark_hr_incentive_rest_day_as_extra_shift.sql:1) sigue dependiendo del preview canónico.
- En frontend se endureció el contrato de [`HrIncentiveRosterValidation`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/types.ts:38), el parseo en [`incentivesApi.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/services/incentivesApi.ts:160) y el bloqueo visual en [`IncentiveRegistrationForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRegistrationForm.tsx:162), dejando preparada la UI para respetar `blockedByAbsence` aunque mañana BUK entregue la bandera sin lanzar excepción.
- Validación cerrada con `npx tsc -b`, `git diff --check` y aplicación real de la migración en Supabase.

## Endurecimiento estructural de periodos y alertas operativas en Incentivos

- [x] Reemplazar la lógica plana `YYYYMM` por la regla estructural de periodo `21 -> 20`, con persistencia y backfill seguro
- [x] Imponer la ventana operativa de registro de incentivos: hasta 7 días hacia atrás, marcando `Fuera de Plazo` todo lo que exceda 2 días
- [x] Exponer y resaltar en historial/aprobaciones las banderas `Fuera de Plazo` y `Contrato distinto`, además del periodo calculado
- [x] Validar build, revisar diff y empujar el cambio a `main`

## Endurecimiento de historial de incentivos: anulación y exportación auditables

- [x] Restringir en backend y frontend la anulación de incentivos para que solo la ejecuten `superadmin` y `control_contratos`
- [x] Expandir el contrato canónico de historial para permitir exportación XLS con todos los campos persistidos y estatus
- [x] Implementar selección múltiple y exportación XLS por folios seleccionados o por período desde historial
- [x] Validar typecheck, diff y empujar el cambio a `main`

## Claridad contractual y UX de Configuración en Acreditaciones

- [x] Auditar la pantalla de configuración para identificar campos ambiguos, texto libre riesgoso y falta de trazabilidad sobre origen/destino de datos
- [x] Versionar una migración que exponga metadata de configuración en backend y endurezca validaciones de faenas, requisitos y matriz
- [x] Refactorizar la UI para consumir metadata desde Supabase, reemplazar enums libres por catálogos controlados y explicar cada campo inline
- [x] Aplicar la migración directamente en Supabase y verificar presencia remota de metadata y validaciones
- [x] Validar `npm run audit:migrations`, `npx tsc -b`, `npm run build` y `git diff --check`

## Resultado de claridad contractual y UX de Configuración en Acreditaciones

- Se agregó la migración [`20260617134339_clarify_accreditation_setup_contracts.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617134339_clarify_accreditation_setup_contracts.sql:1), aplicada en Supabase, para endurecer las RPCs de configuración y hacer explícito el contrato autodocumentado del módulo.
- [`get_accreditation_setup_catalogs()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617134339_clarify_accreditation_setup_contracts.sql:279) ahora devuelve `metadata.site_types`, `metadata.requirement_categories` y `metadata.field_guides`, dejando versionado qué pide cada campo, de dónde nace y dónde se persiste.
- [`upsert_accreditation_site(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617134339_clarify_accreditation_setup_contracts.sql:3), [`upsert_accreditation_requirement(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617134339_clarify_accreditation_setup_contracts.sql:86) y [`upsert_accreditation_matrix_rule(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617134339_clarify_accreditation_setup_contracts.sql:191) ahora fallan con mensajes de negocio claros ante códigos vacíos, tipos inválidos o referencias inactivas.
- En frontend, [`AccreditationSettingsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/accreditation/components/AccreditationSettingsView.tsx:1) consume esa metadata real: `Tipo` y `Categoria` dejaron de ser texto libre, `Cargo exacto` pasó a buscarse contra cargos activos BUK y cada campo muestra inline su fuente y tabla destino.

## Ajuste pendiente solicitado: documentos opcionales para no conductores y toggle explícito del lateral en candidatos

- [x] Extender en backend los documentos de conductor solicitados para que también apliquen a cargos no conductores, pero como opcionales
- [x] Corregir la interacción de `Control de candidatos` para que el lateral solo cierre al pinchar nuevamente la fila izquierda seleccionada
- [x] Aplicar la migración directamente en Supabase y validar el contrato efectivo en `document_types`
- [x] Validar `npm run audit:migrations`, `npx tsc -b`, `npm run build` y `git diff --check`

## Resultado de documentos opcionales para no conductores y toggle explícito del lateral en candidatos

- Se agregó la migración [`20260617141731_extend_candidate_driver_docs_to_other_roles.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617141731_extend_candidate_driver_docs_to_other_roles.sql:1), ya aplicada en Supabase, para extender a cargos no conductores como opcionales estos documentos: `Licencia de conducir`, `Hoja de vida del conductor`, `Examen Teórico de Instructor`, `Examen Práctico de Instructor`, `Examen Preocupacional` y `Psicosensotecnico`.
- La verificación remota sobre `public.document_types` confirmó el contrato pedido: en los seis casos quedó `applies_to_other = true` y `required_for_other = false`, preservando `required_for_driver = true` para conductores.
- [`HiringCandidatesView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringCandidatesView.tsx:1) dejó de cerrar el lateral por click fuera. Se eliminó el listener global y la deselección ahora solo ocurre al pinchar nuevamente la misma fila seleccionada de la tabla izquierda.

## Auditoría integral del flujo de aprobaciones de incentivos

- [x] Mapear el flujo actual de aprobaciones de incentivos en frontend y Supabase, identificando la causa raíz del error `approval_id is ambiguous`
- [x] Corregir la aprobación masiva para eliminar la ambigüedad SQL sin romper atomicidad ni locking del proceso
- [x] Endurecer la UI de aprobaciones para que la selección masiva solo incluya filas realmente decidibles por el usuario actual
- [x] Verificar el ciclo completo con jornadas y turnos: creación de `extra_shift`, conservación de excepciones prioritarias y reconciliación al rechazar/anular
- [x] Validar con `npx tsc -b`, `npm run build` y `git diff --check`

## Resultado de auditoría integral del flujo de aprobaciones de incentivos

- La causa raíz del error reportado estaba en la RPC masiva `bulk_decide_hr_incentive_request_approvals(...)`: el `RETURNS TABLE` exponía la variable implícita `approval_id` y la misma función reutilizaba `approval_id` como alias/columna del `unnest`, disparando la ambigüedad `42702` antes de iterar las decisiones.
- Se agregó la migración [`20260616183000_fix_hr_incentive_bulk_approval_ambiguity.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260616183000_fix_hr_incentive_bulk_approval_ambiguity.sql:1) para renombrar el alias del `unnest`, conservar la normalización/deduplicación de IDs y mantener intacto el locking/atomicidad del proceso masivo.
- El SQL del fix quedó aplicado además en la base remota del proyecto vía `npx supabase db query --linked --file ...`; la verificación directa sobre `pg_get_functiondef(...)` confirmó que la función publicada ya contiene `selected_approval_id`.
- En [`IncentiveApprovalsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveApprovalsView.tsx:1) la selección masiva ahora filtra solo filas decidibles por el usuario actual; los checkboxes de solo lectura quedan deshabilitados y la cabecera no intenta seleccionar aprobaciones ajenas.
- La navegación desde la campana ahora abre directamente [`/recursos-humanos/aprobaciones`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/lib/taskPresentation.ts:49), que es la bandeja real del flujo de aprobaciones de incentivos.
- La integración con jornadas y turnos quedó verificada sobre la implementación viva: [`create_hr_incentive_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260615113000_reconcile_roster_extra_shift_with_incentives.sql:421) crea/reconcilia `extra_shift` solo cuando el descanso declarado coincide con la pauta, y [`decide_hr_incentive_request_approval(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260615113000_reconcile_roster_extra_shift_with_incentives.sql:837) junto con [`cancel_hr_incentive_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260615113000_reconcile_roster_extra_shift_with_incentives.sql:760) revierten o restauran la excepción automática al rechazar/anular sin pisar excepciones BUK.
- Validación cerrada con `npm run audit:migrations`, `npx tsc -b`, `npm run build` y `git diff --check`.

## Ajuste analítico de fechas en exportación XLS de Incentivos

- [x] Convertir todas las fechas exportadas a celdas nativas de Excel en vez de strings ISO
- [x] Aplicar formato de visualización por tipo de fecha (`dd-mm-yyyy` y `dd-mm-yyyy hh:mm`) sin romper análisis
- [x] Validar typecheck y diff limpio

## Dashboard analítico de Incentivos

- [x] Investigar contratos reales de incentivos, roles, routing y wrapper de gráficos; dejar `implementation_plan.md`
- [x] Crear RPC analítica agregada y permisos backend para acceso gerencial al dashboard de incentivos
- [x] Implementar vista React con multifiltros, KPIs y gráficas dentro de `HumanResourcesDashboard`
- [ ] Validar typecheck, diff y push a `main`

## Ajuste backend de ranking de conductores en Analítica de Incentivos

- [x] Auditar la RPC `get_hr_incentives_analytics(...)` vigente contra el contrato que ya espera el frontend para `amount_by_driver`
- [x] Crear una nueva migración SQL que agregue el ranking top 12 por `requester_name` con desglose anidado por contrato
- [x] Validar diff y documentar el ajuste sin reescribir migraciones históricas

## Resultado de ajuste backend de ranking de conductores en Analítica de Incentivos

- Se agregó la migración [`20260614001000_update_hr_incentive_driver_amount_analytics.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614001000_update_hr_incentive_driver_amount_analytics.sql:1), que redefine [`get_hr_incentives_analytics(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614001000_update_hr_incentive_driver_amount_analytics.sql:1) sin tocar la migración histórica original del dashboard analítico.
- La causa raíz era un drift claro de contrato: el frontend ya consumía `amount_by_driver`, pero la RPC seguía devolviendo solo `deviations_by_contract`. La nueva versión incorpora `driver_contract_amounts` y `amount_by_driver`, agrupando por `requester_name`, sumando `calculated_amount` y limitando a los 12 conductores con mayor monto total.
- El payload nuevo sale con la estructura anidada requerida: `driver_name`, `total_amount` y `contracts[]` con `contract_code`, `contract_label` y `amount`, ordenado por monto tanto a nivel de conductor como de contrato.
- Se mantuvo intacto el bloque `deviations_by_contract` porque la vista actual de [`IncentiveAnalyticsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveAnalyticsView.tsx:1) todavía lo renderiza en una tarjeta aparte. Así se corrigió el ranking de conductores sin romper el resto del dashboard.

## Ajuste backend de inversión por contrato y trabajador en Analítica de Incentivos

- [x] Auditar la vista actual para confirmar que el frontend ya consume `amount_by_contract` y `amount_by_worker`
- [x] Crear una migración SQL nueva que reemplace la métrica de desviaciones por sumatorias de `calculated_amount`
- [x] Mantener intactos los filtros, KPIs y el resto del payload analítico para evitar regresiones fuera de los gráficos inferiores

## Resultado de ajuste backend de inversión por contrato y trabajador en Analítica de Incentivos

- Se agregó la migración [`20260614104000_update_hr_incentive_analytics_amount_breakdowns.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614104000_update_hr_incentive_analytics_amount_breakdowns.sql:1), que redefine [`get_hr_incentives_analytics(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614104000_update_hr_incentive_analytics_amount_breakdowns.sql:1) sobre la versión reparada más reciente.
- El bloque anterior `deviations_by_contract` fue reemplazado por `amount_by_contract`, que agrupa por `selected_contract_code`, conserva `area_name` y retorna `total_amount` como suma de `calculated_amount`, ordenado de mayor a menor y limitado a 12 contratos.
- Se agregó `amount_by_worker`, esta vez agrupando por el trabajador receptor del incentivo mediante [`employee_full_name`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260606_090000_add_hr_incentives_module.sql:42), no por el `requester`. El payload sale anidado con `worker_name`, `total_amount` y `contracts[]` con `contract_code`, `contract_label` y `amount`.
- El resto del contrato analítico se mantuvo estable: `summary_cards`, `total_amount_by_period`, `count_by_incentive_type` y `filter_options` no cambiaron, reduciendo el riesgo de romper otras tarjetas del dashboard.


## Submódulo Jornadas y Turnos (Roster)

- [x] Aterrizar el plan externo a la arquitectura real del repo: módulo propio `src/modules/roster`, permiso dedicado y validación cruzada con incentivos sin inventar otra superficie HR paralela
- [x] Crear la migración Supabase del submódulo Roster: tablas maestras, asignaciones, excepciones, helpers matemáticos, RPCs públicas y registro en `app_modules` / `role_module_access`
- [x] Extender el contrato de incentivos para soportar validación de “día de descanso requerido” desde backend y configuración de tipos
- [x] Implementar frontend de Roster: rutas, navegación, servicios, React Query, calendario mensual, gestor de pautas y asignación de trabajadores
- [x] Incorporar gestión de excepciones operativas del trabajador dentro del flujo del calendario
- [x] Validar `npx tsc -b`, `npm run build`, `git diff --check`, documentar resultado y empujar a `main`

## Resultado de Submódulo Jornadas y Turnos (Roster)

- Se implementó el nuevo módulo [`src/modules/roster`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster:1) como superficie propia del ERP, con ruta [`/roster`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/router/AppRouter.tsx:1), acceso gobernado por `jornadas_turnos` y entrada en navegación central sin abrir permisos ajenos al resto del sistema.
- La base quedó formalizada en [`20260613193000_add_hr_roster_module.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613193000_add_hr_roster_module.sql:1): tablas `hr_shift_patterns`, `hr_worker_rosters`, `hr_roster_exceptions`, helpers matemáticos de ciclo, RPC `get_worker_schedule(...)`, catálogos, búsquedas, asignación, excepciones y registro del módulo en `app_modules` / `role_module_access`.
- La UI quedó dividida entre calendario operativo, gestor de pautas y asignación de trabajadores. [`RosterPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster/pages/RosterPage.tsx:1) concentra el flujo, [`RosterCalendar.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster/components/RosterCalendar.tsx:1) pinta días de trabajo, descanso y excepción, y [`RosterPatternManager.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster/components/RosterPatternManager.tsx:1) mantiene las pautas reutilizables.
- La validación cruzada con Incentivos quedó bajada al backend, no al cliente: `hr_incentive_types` ahora soporta `requires_rest_day`, [`calculate_hr_incentive_preview(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613193000_add_hr_roster_module.sql:1183) devuelve `roster_validation` y [`create_hr_incentive_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613193000_add_hr_roster_module.sql:1290) bloquea el registro cuando el incentivo exige descanso y la pauta real no lo cumple.
- En frontend, [`IncentiveSetupView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveSetupView.tsx:1) permite activar o quitar la exigencia de descanso por tipo, y [`IncentiveRegistrationForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRegistrationForm.tsx:1) muestra la validación de pauta antes de enviar, evitando solicitudes inválidas aunque existan otras superficies futuras.
- Cierre técnico validado con `npx tsc -b`, `npm run build` y `git diff --check`, y el cambio quedó empujado a `main`.

## Endurecimiento de horizonte y visibilidad activa en Jornadas y Turnos

- [x] Limitar la proyección del calendario de jornadas a un máximo de 6 meses desde la fecha actual en backend y frontend
- [x] Confirmar y reforzar, sin duplicaciones innecesarias, que el módulo solo opere con trabajadores activos provenientes de BUK
- [x] Validar `npx tsc -b`, revisar diff y documentar el resultado final junto con la lección aprendida

## Resultado de endurecimiento de horizonte y visibilidad activa en Jornadas y Turnos

- Se agregó la migración [`20260614113000_harden_hr_roster_projection_horizon.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614113000_harden_hr_roster_projection_horizon.sql:1), que redefine [`get_worker_schedule(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614113000_harden_hr_roster_projection_horizon.sql:1) para rechazar consultas que excedan el cierre del sexto mes proyectado. Con esto, el calendario deja de aceptar horizontes futuros indefinidos aunque las asignaciones sigan siendo abiertas a nivel lógico.
- La exclusión de inactivos no se duplicó en React porque ya estaba bien modelada en la fuente canónica: el lookup y la RPC trabajan contra `employees_active_current`. Se reforzó la trazabilidad cambiando el error de carga a `Trabajador BUK no encontrado o sin ficha activa`, cubriendo también selecciones que queden obsoletas tras una sincronización de BUK.
- [`RosterPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster/pages/RosterPage.tsx:1) ahora expone el límite futuro directamente en el selector mensual mediante `max`, mostrando además el mes de cierre permitido. El ajuste no bloquea la revisión histórica, solo el avance más allá del horizonte gobernado.
- Durante la validación apareció una regresión de tipado ajena a la nueva regla: el detalle del día comparaba `effectiveStatus === 'extra'` cuando el código real del dominio es `extra_shift`. Se corrigió en la misma pasada para dejar `npx tsc -b` nuevamente sano.
- Cierre validado con `npx tsc -b` y `git diff --check`.

## Simplificación transversal de búsqueda por nombre en lookups BUK

- [x] Auditar todas las búsquedas de personas alimentadas por `employees_active_current` o fuentes BUK equivalentes
- [x] Implementar matching simplificado por `primer nombre + primer apellido + segundo apellido opcional` sin cambiar la visualización del nombre
- [x] Alinear filtros locales restantes con la misma semántica y validar `npx tsc -b` más `git diff --check`

## Resultado de simplificación transversal de búsqueda por nombre en lookups BUK

- Se agregó la migración [`20260614130000_simplify_buk_name_searches.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614130000_simplify_buk_name_searches.sql:1), que introduce la helper [`build_buk_employee_name_search_key(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614130000_simplify_buk_name_searches.sql:1). Esa función prioriza campos estructurados de BUK (`first_name`, `last_name`, `second_last_name` y variantes) y, si no existen, cae a una derivación defensiva desde `full_name`.
- Las RPCs activas [`search_hr_incentive_eligible_workers(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614130000_simplify_buk_name_searches.sql:53), [`search_internal_mobility_workers(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614130000_simplify_buk_name_searches.sql:143) y [`search_hr_roster_workers(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614130000_simplify_buk_name_searches.sql:239) ahora incorporan esa clave simplificada al haystack de búsqueda y priorizan arriba los matches por prefijo sobre nombre simplificado. Con eso, `Jorge Araya` encuentra a `Jorge Alberto Araya Soto` sin exigir el segundo nombre.
- La visualización no cambió: los lookups siguen mostrando `full_name`, RUT, cargo y área exactamente igual. El cambio vive solo en la semántica de matching y ranking de resultados.
- Se alineó además el filtro local de conductores en [`OperacionesDashboard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/pages/OperacionesDashboard.tsx:134), apoyado por la helper [`buildSimplifiedBukNameSearchKey(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/lib/transformers.ts:28), para que Operaciones no quede con una lógica distinta al resto de los lookups BUK.
- Cierre validado con `npx tsc -b` y `git diff --check`.

## Hotfix de primer nombre compuesto en búsqueda simplificada BUK

- Se agregó la migración [`20260614133500_fix_buk_name_search_first_token.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614133500_fix_buk_name_search_first_token.sql:1) para corregir un caso real de datos BUK: `first_name` puede venir como `Jorge Aníbal`, no solo `Jorge`.
- La helper [`build_buk_employee_name_search_key(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260614133500_fix_buk_name_search_first_token.sql:1) ahora reduce `first_name` al primer token antes de construir la clave simplificada. Con eso, `jorge ara` vuelve a encontrar correctamente a `Jorge Aníbal Araya Cangana`.
- La corrección fue aplicada también en la base activa de Supabase durante esta sesión y validada con un query de humo directo sobre `employees_active_current`, confirmando la clave `jorge araya cangana`.

## Validación técnica de acceso BUK para ausencias en roster

- [x] Auditar la infraestructura actual de sync BUK y el modelo vigente de excepciones en roster
- [x] Validar si el token actual puede leer vacaciones/licencias/ausencias desde la API de BUK
- [x] Si el token no alcanza, dejar trazabilidad y tooling reutilizable en vez de forzar una sync inválida

## Resultado de validación técnica de acceso BUK para ausencias en roster

- La validación real del token vigente mostró este contrato: `GET /employees` responde `200`, pero `GET /vacations` y `GET /absences` responden `401 Unauthorized`. Por tanto, hoy no existe permiso efectivo para implementar una segunda sync funcional de ausencias basada en ese token.
- La fuente actual de `employees_active_current` tampoco resuelve el problema por sí sola: el `raw_payload` de empleados trae atributos maestros y laborales, pero no un rango operativo de vacaciones/licencias utilizable para poblar automáticamente [`hr_roster_exceptions`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613193000_add_hr_roster_module.sql:125).
- Se agregó el validador [`validate-buk-absence-access.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/validate-buk-absence-access.mjs:1), que prueba de forma segura los endpoints `employees`, `vacations` y `absences` usando el mismo `BUK_AUTH_TOKEN` de la integración.
- También se agregó el workflow manual [validate-buk-absence-access.yml](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/.github/workflows/validate-buk-absence-access.yml:1), para que el equipo pueda revalidar permisos en GitHub Actions apenas BUK habilite `Vacaciones: Lectura` y el acceso necesario para ausencias/licencias.
- La regla de negocio quedó definida para la siguiente fase: cuando el token tenga alcance, las fechas provenientes de BUK tendrán jerarquía superior y no podrán ser sobreescritas por excepciones manuales locales.

## Hotfix de preview de incentivos con roster_day_row sin asignar

- [x] Auditar la versión vigente de `calculate_hr_incentive_preview(...)` para aislar por qué falla aunque exista pauta en roster
- [x] Corregir la construcción de `roster_validation` para que no lea `roster_day_row` cuando el incentivo no exige descanso
- [x] Validar el query de preview en la base activa y documentar el cierre

## Endurecimiento integral entre sistema de turnos e incentivos extraordinarios

- [x] Desacoplar la lectura inmediata de estado operativo del cálculo de monto para informar turno, descanso o ausencia apenas se selecciona el trabajador
- [x] Agregar trazabilidad explícita `En descanso` en el registro de incentivos y persistirla en base, detalle y exportación XLS
- [x] Corregir backend de interacción roster-incentivos: bloqueo robusto por ausencias, restauración de excepciones manuales tras override BUK y marcado automático de turno adicional en descansos reales
- [x] Validar typecheck, advisors relevantes, aplicar migraciones en Supabase y dejar listo para push a `main`

## Resultado de endurecimiento integral entre sistema de turnos e incentivos extraordinarios

- Se agregó la migración [`20260613210505_harden_hr_incentive_roster_interaction_and_rest_declaration.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613210505_harden_hr_incentive_roster_interaction_and_rest_declaration.sql:1), ya aplicada también en Supabase, para persistir `declared_rest_day` en [`hr_incentive_requests`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613210505_harden_hr_incentive_roster_interaction_and_rest_declaration.sql:1) y endurecer las RPC críticas del cruce entre Incentivos y Roster.
- [`calculate_hr_incentive_preview(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613210505_harden_hr_incentive_roster_interaction_and_rest_declaration.sql:24) dejó de depender de un `record` frágil, ahora clasifica correctamente `extra_shift` como estado no descansado para incentivos que exigen descanso y sigue bloqueando vacaciones/licencia médica con mensaje de negocio claro.
- [`create_hr_incentive_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613210505_harden_hr_incentive_roster_interaction_and_rest_declaration.sql:197) ahora exige la confirmación `En descanso`, compara la declaración humana contra la pauta real y marca `extra_shift` para cualquier incentivo registrado sobre un descanso efectivo, no solo para tipos que exigen reemplazo. Las excepciones automáticas quedaron trazadas con `exception_source = 'incentive_auto'`.
- La sync [`sync_hr_roster_exception_from_buk(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613210505_harden_hr_incentive_roster_interaction_and_rest_declaration.sql:575) dejó de borrar ciegamente estados manuales o automáticos: cuando BUK pisa una fecha, preserva el estado previo en columnas `superseded_*` y lo restaura cuando BUK retira la ausencia.
- En frontend, [`IncentiveRegistrationForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRegistrationForm.tsx:1) ahora consulta el estado operativo apenas se selecciona trabajador y fecha, pinta el resultado en verde/amarillo/rojo y no permite enviar la solicitud si la declaración `En descanso` contradice la pauta detectada.
- Para mantener auditabilidad completa, [`get_hr_incentive_requests(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613210505_harden_hr_incentive_roster_interaction_and_rest_declaration.sql:704), [`get_hr_incentive_request_detail(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613210505_harden_hr_incentive_roster_interaction_and_rest_declaration.sql:835) y la exportación XLS en [`IncentiveRequestsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRequestsView.tsx:1) ya incluyen el dato `declarado_en_descanso`.
- Se agregó además la migración [`20260613210649_add_hr_roster_exception_fk_indexes.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613210649_add_hr_roster_exception_fk_indexes.sql:1), aplicada en Supabase, para indexar `created_by` y `superseded_created_by` en [`hr_roster_exceptions`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613210649_add_hr_roster_exception_fk_indexes.sql:1) y cerrar un hallazgo objetivo de performance en la tabla recién endurecida.
- Validación cerrada con `npx tsc -b`, `git diff --check`, aplicación real de ambas migraciones en Supabase y query de humo sobre la base activa confirmando columna nueva, firma RPC nueva y respuesta válida de `calculate_hr_incentive_preview(...)`.

## Ajuste de mensaje para bloqueo de reemplazo por trabajador en turno

- [x] Auditar el punto exacto donde se informa el bloqueo de pauta en Incentivos
- [x] Reemplazar el mensaje técnico por una explicación clara de negocio en backend y frontend
- [x] Validar typecheck y diff, y documentar el ajuste

## Resultado de ajuste de mensaje para bloqueo de reemplazo por trabajador en turno

- Se mantuvo intacta la regla de negocio: si el incentivo exige descanso, un trabajador marcado `en turno` por su pauta no puede ser usado como reemplazo.
- Se agregó la migración [`20260613192711_clarify_hr_incentive_rest_day_block_message.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613192711_clarify_hr_incentive_rest_day_block_message.sql:1), que redefine [`calculate_hr_incentive_preview(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613192711_clarify_hr_incentive_rest_day_block_message.sql:1) para que el backend explique el bloqueo en lenguaje de negocio: no puede reemplazar porque está en turno en esa fecha.
- [`IncentiveRegistrationForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRegistrationForm.tsx:353) ahora muestra el mismo criterio en frontend, evitando el mensaje ambiguo de “exige descanso” sin contexto de reemplazo.
- Validación local cerrada con `npx tsc -b` y `git diff --check`.

## Marcado automático de turno adicional desde Incentivos

- [x] Auditar dónde convive hoy la lógica de pauta entre Incentivos y Roster
- [x] Persistir automáticamente `extra_shift` cuando un incentivo se registra sobre un día de descanso permitido
- [x] Evitar sobrescritura de vacaciones/licencias u otras excepciones activas al marcar el calendario
- [x] Validar `npx tsc -b` y revisar el diff final

## Resultado de marcado automático de turno adicional desde Incentivos

- Se agregó la migración [`20260613200144_mark_hr_incentive_rest_day_as_extra_shift.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613200144_mark_hr_incentive_rest_day_as_extra_shift.sql:1), que redefine [`create_hr_incentive_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613200144_mark_hr_incentive_rest_day_as_extra_shift.sql:1) para que el calendario operativo se marque en la misma transacción del incentivo.
- El marcado automático solo ocurre cuando la validación de pauta ya confirmó que el incentivo requiere descanso y el trabajador efectivamente estaba en descanso ese día. En ese caso se crea o refresca una excepción `extra_shift`.
- La persistencia es defensiva: si ese día ya existe una excepción activa distinta de `extra_shift` como vacaciones o licencia, no se sobrescribe. En su lugar, se preserva la excepción preexistente.
- Se agregó trazabilidad en [`hr_incentive_request_history`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613200144_mark_hr_incentive_rest_day_as_extra_shift.sql:236) mediante `calendar_marking`, para distinguir entre `extra_shift_created`, `extra_shift_refreshed`, `existing_exception_preserved` y `not_applicable`.
- Validación local cerrada con `npx tsc -b` y `git diff --check`.

## Migración completa de motor gráfico a Recharts

- [x] Auditar todas las referencias activas del motor gráfico anterior en dependencias, wrapper compartido, Labs y dashboard analítico
- [x] Instalar `recharts` y `react-is`, y retirar el motor anterior junto con su partición de bundle dedicada
- [x] Reemplazar la capa compartida de gráficos para que el ERP consuma Recharts con API interna estable
- [x] Migrar las vistas activas de gráficos y eliminar residuos del motor anterior en código, textos y documentación operativa
- [x] Validar `npx tsc -b`, `git diff --check` y dejar documentado el resultado final

## Resultado de migración completa de motor gráfico a Recharts

- Se retiró por completo la dependencia previa del repositorio: desaparecieron [`src/shared/lib/echarts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/lib/echarts:1), [`src/shared/ui/charts/EChart.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/charts:1) y el showcase legado de Labs, junto con su partición dedicada en [`vite.config.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/vite.config.ts:1) y [`vite.config.js`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/vite.config.js:1).
- La nueva base compartida quedó en [`ChartSurface.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/charts/ChartSurface.tsx:1) y [`ChartTooltip.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/charts/ChartTooltip.tsx:1), encapsulando `ResponsiveContainer`, estados de carga/vacío y tooltip homogéneo para consumidores de Recharts.
- [`IncentiveAnalyticsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveAnalyticsView.tsx:1) fue reescrito con `ComposedChart`, `PieChart` y `BarChart`, preservando KPIs, filtros y semántica analítica sin depender de opciones imperativas ni runtime extra.
- [`LabsPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/labs/pages/LabsPage.tsx:1) ahora carga [`RechartsShowcase.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/labs/components/RechartsShowcase.tsx:1) vía `lazy()`, manteniendo el laboratorio pero sobre la misma tecnología que ya gobierna el ERP.
- Validación cerrada con `npx tsc -b`, `npm run build` y `git diff --check`. La build generó un chunk aislado [`recharts-vendor`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/vite.config.ts:1) de `390.16 kB`, menor que el vendor gráfico previo y fuera del arranque principal.

## Resultado de dashboard analítico de Incentivos

- La investigación previa quedó formalizada en [`implementation_plan.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/implementation_plan.md:1), aterrizando el prompt a la arquitectura real del repo: la analítica no vive en una página paralela sino como un nuevo `view` dentro de [`HumanResourcesDashboard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/pages/HumanResourcesDashboard.tsx:1).
- Se agregó la migración [`20260613150000_add_hr_incentive_analytics_dashboard.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613150000_add_hr_incentive_analytics_dashboard.sql:1), que introduce la helper [`user_can_view_hr_incentive_analytics(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613150000_add_hr_incentive_analytics_dashboard.sql:1) y la RPC [`get_hr_incentives_analytics(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613150000_add_hr_incentive_analytics_dashboard.sql:19), devolviendo JSON agregado para KPIs, evolución por período, distribución por tipo y desviaciones por contrato sin traer la tabla masiva al frontend.
- El control de acceso quedó separado del permiso operativo estándar: [`analyticsAccess.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/lib/analyticsAccess.ts:1) define la matriz analítica (`director_eje`, `gerente_general`, `director_op`, `gerencia`, `operaciones_l_1`, `control_contratos`, además de `superadmin`), [`RoleProtectedRoute`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/auth/components/RouteGuards.tsx:74) ahora puede admitir roles explícitos y [`AppShell.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/layout/AppShell.tsx:147) filtra navegación por módulo **o** por alcance de rol analítico, sin abrir el resto del módulo a usuarios gerenciales.
- En frontend se creó [`IncentiveAnalyticsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveAnalyticsView.tsx:1), con multifiltros (`período`, `contrato`, `tipo`, `estado`), KPIs y gráficas compartidas. El contrato de datos quedó tipado en [`types.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/types.ts:271), consumido desde [`incentivesApi.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/services/incentivesApi.ts:287) y cacheado vía [`useHrIncentivesAnalytics(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/hooks/useIncentivesQueries.ts:53).
- La navegación interna del módulo ahora incorpora la pestaña `Análisis de Incentivos` y redirige correctamente si un usuario intenta abrir una vista no permitida, evitando que perfiles analíticos disparen queries de registro/configuración que el backend no les autoriza.
- Validación local cerrada con `npx tsc -b` y `git diff --check`. Falta solo versionar y empujar a `main`.

## Resultado de ajuste analítico de fechas en exportación XLS de Incentivos

- [`buildIncentiveExportRows(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRequestsView.tsx:62) dejó de exportar fechas como strings ISO y ahora las transforma a objetos `Date` para que Excel las reciba como fechas reales.
- Se separó el tratamiento de fechas de negocio y timestamps auditables en [`exportIncentiveRequestsToXlsx(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRequestsView.tsx:139): `fecha_servicio` y `fecha_ingreso_sindicato` salen como `dd-mm-yyyy`, mientras `fecha_creacion`, `fecha_actualizacion` y `fecha_anulacion` salen como `dd-mm-yyyy hh:mm`.
- La decisión evita reutilizar el helper visual [`formatRequestDate(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/lib/format.ts:12) dentro del XLS, porque ese helper degrada la fecha a texto y rompe ordenamiento, filtros, pivots y fórmulas en Excel.
- Validación local cerrada con `npx tsc -b` y `git diff --check`.

## Resultado de endurecimiento de historial de incentivos: anulación y exportación auditables

- Se agregó la migración [`20260613103000_harden_hr_incentive_history_cancel_and_export.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613103000_harden_hr_incentive_history_cancel_and_export.sql:1), que corrige el problema de fondo: [`cancel_hr_incentive_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613103000_harden_hr_incentive_history_cancel_and_export.sql:9) ya no confía en el acceso general al módulo, sino que permite anular únicamente a `superadmin/admin` y `control_contratos`.
- La misma migración redefine [`get_hr_incentive_requests(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613103000_harden_hr_incentive_history_cancel_and_export.sql:66) para devolver el payload persistido relevante del folio: identificadores, contratos primario/seleccionado, sindicato, reglas de cálculo, actor creador, timestamps, anulaciones y banderas operativas. La exportación ya no depende de reconstrucciones parciales en React.
- [`IncentiveRequestsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRequestsView.tsx:1) ahora oculta la acción `Anular` para cualquier rol fuera de `superadmin` y `control_contratos`, agrega selección múltiple por checkbox y habilita dos salidas auditables: `Exportar seleccionados` y `Exportar período`.
- La exportación usa [`@mylinkpi/xlsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/package.json:1) ya homologado en el ERP, y genera un `.xlsx` con estatus y campos base guardados en base de datos, evitando otro motor de planillas o un contrato paralelo ad hoc.
- Validación local cerrada con `npx tsc -b` y `git diff --check`.

## Resultado de endurecimiento estructural de periodos y alertas operativas en Incentivos

- Se agregó la migración [`20260612233000_harden_hr_incentive_periods_and_flags.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612233000_harden_hr_incentive_periods_and_flags.sql:1), que convierte la lógica de periodo en una regla backend explícita: del día `21` al `20` siguiente, donde el período corresponde al mes de cierre. Ejemplo: `21/05 -> 20/06 = 202606`.
- La migración agrega helpers canónicos para periodo, desfase de ingreso y contrato distinto, además de backfill sobre [`hr_incentive_requests`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612233000_harden_hr_incentive_periods_and_flags.sql:57) para recalcular `period_code`, `entry_lag_days`, `is_out_of_deadline` e `is_contract_mismatch` en registros existentes.
- [`create_hr_incentive_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612233000_harden_hr_incentive_periods_and_flags.sql:89) ahora rechaza incentivos con más de 7 días hacia atrás, guarda el período estructural correcto y persiste las banderas operativas que luego consume la UI.
- [`get_hr_incentive_requests(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612233000_harden_hr_incentive_periods_and_flags.sql:318), [`get_hr_incentive_approval_queue()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612233000_harden_hr_incentive_periods_and_flags.sql:419) y [`get_hr_incentive_request_detail(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612233000_harden_hr_incentive_periods_and_flags.sql:507) exponen ahora `period_code`, `entry_lag_days`, `is_out_of_deadline` e `is_contract_mismatch` para no recalcular la verdad del negocio en React.
- En frontend, [`IncentiveRegistrationForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRegistrationForm.tsx:1) muestra desde el preview el período de pago y las alertas operativas, y además limita el selector de fecha a la ventana `[hoy - 7, hoy]` sin romper el resto del ERP gracias al endurecimiento controlado de [`DatePickerField.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/forms/DatePickerField.tsx:1).
- [`IncentiveRequestsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRequestsView.tsx:1) e [`IncentiveApprovalsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveApprovalsView.tsx:1) ahora muestran badges operativos unificados mediante [`IncentiveOperationalFlags.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveOperationalFlags.tsx:1): `Fuera de Plazo` en rojo agua y `Contrato distinto` en azul agua, además del período calculado.
- Validación local cerrada con `npx tsc -b` y `git diff --check`.

## Endurecimiento enterprise de flujos auditables y bordes ORION

- [x] Extraer cortes seguros en frontend/servicios para reducir tamaño y acoplamiento en tareas compartidas y checklist documental
- [x] Reemplazar interacciones bloqueantes del navegador en incentivos y checklist por modales auditables con validación explícita
- [x] Eliminar `any` y `ts-ignore` evitables en edge functions ORION con contratos mínimos de runtime
- [x] Validar `npx tsc -b`, `git diff --check` y documentar el cierre

## Resultado de endurecimiento enterprise de flujos auditables y bordes ORION

- [`AppShell.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/layout/AppShell.tsx:1) dejó de concentrar la lógica de la campana; el dropdown quedó desacoplado en [`TopNotificationsMenu.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/layout/TopNotificationsMenu.tsx:1) y la clasificación compartida de tareas se centralizó en [`taskPresentation.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/lib/taskPresentation.ts:1). Esto reduce duplicación, elimina tipado sintético y baja el riesgo de drift entre campana e inicio.
- El checklist documental salió parcialmente de [`hiringControl.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:1) hacia [`documentChecklistApi.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/documentChecklistApi.ts:1), dejando un servicio más estrecho y trazable para carga, revisión y validación documental.
- [`CandidateDocumentChecklist.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateDocumentChecklist.tsx:1) ya no depende de `prompt/alert`; ahora usa [`DocumentChecklistActionModal.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/DocumentChecklistActionModal.tsx:1), preserva el archivo pendiente entre selección y metadata requerida, y solo cierra modales cuando la operación realmente fue exitosa.
- El módulo de incentivos dejó de depender de `window.confirm` y `window.prompt`: [`IncentiveApprovalsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveApprovalsView.tsx:1) y [`IncentiveRequestsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRequestsView.tsx:1) ahora usan [`IncentiveActionModal.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveActionModal.tsx:1), con comentario obligatorio para rechazos y comentario opcional para aprobaciones/anulaciones.
- Las edge functions [`orion-document-processor`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/orion-document-processor/index.ts:1) y [`orion-chat`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/orion-chat/index.ts:1) quedaron sin `ts-ignore` ni `any` evitables en sus puntos de embeddings y manejo de errores. Se introdujeron contratos mínimos explícitos para `Supabase.ai.Session`, mejorando mantenibilidad y reduciendo deuda silenciosa en un borde crítico de IA.
- Validación final cerrada con `npx tsc -b` exitoso y `git diff --check` limpio.

## Resultado de limpieza enterprise de superficies compartidas de tareas y navegación

- Se creó [`taskPresentation.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/lib/taskPresentation.ts:1) para centralizar la clasificación de tareas compartidas entre campana y widget de inicio. Antes, esa lógica estaba duplicada y dependía de strings dispersos (`module_code === 'recursos_humanos'`) en más de una superficie.
- [`AppShell.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/layout/AppShell.tsx:10) dejó de fabricar un item sintético con `as any` para agrupar incentivos en la campana. Ahora usa un tipo explícito `DashboardNotificationPreviewItem`, reduciendo fragilidad para futuros desarrolladores y evitando que la UI dependa de objetos parcialmente tipados.
- [`TasksWidget.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/TasksWidget.tsx:1) quedó desacoplado del flujo de incentivos: se eliminaron la importación de `decideHrIncentiveApproval(...)`, el detalle expandido muerto y la rama de decisión que ya no podían ejecutarse después del filtro del inicio. Eso reduce tamaño, complejidad ciclomática y riesgo de divergencia funcional.
- También se corrigieron dos señales de deuda técnica transversal: [`navigation.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/config/navigation.ts:8) ya tipa correctamente `flask` sin `as any`, y [`SelectField.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/forms/SelectField.tsx:3) reemplaza `raw?: any` por `raw?: unknown`.
- Validación cerrada con `npx tsc -b` exitoso y `git diff --check` limpio.

## Ajuste de densidad entre campana y widget de tareas del inicio

- [x] Auditar dónde comparten hoy la misma fuente la campana y el widget de inicio
- [x] Filtrar solo el widget de inicio para ocultar incentivos pendientes sin tocar la campana
- [x] Validar tipos/diff y documentar ajuste final

## Resultado de ajuste de densidad entre campana y widget de tareas del inicio

- La fuente compartida sigue siendo `tasksData`; no se tocó la campana ni la RPC de backend. El ajuste quedó deliberadamente en el consumidor más estrecho: [`TasksWidget.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/TasksWidget.tsx:42).
- El widget `Tareas pendientes` del inicio ahora filtra localmente las tareas con `type = 'hr_incentive_approval'` o `module_code = 'recursos_humanos'`, de modo que los incentivos pendientes siguen contando y apareciendo en la campana superior, pero ya no saturan la tabla principal del inicio.
- El resto del comportamiento no cambia: contratación, `Who` y movilidad interna siguen usando la misma fuente, el mismo refresh y la misma lógica de decisión inline.
- Validación cerrada con `npx tsc -b` exitoso y `git diff --check` limpio.

## Notificación de incentivos pendientes en campana superior

- [x] Auditar la fuente canónica de la campana (`tasksData`) para extenderla sin duplicar otra query de notificaciones
- [x] Agregar incentivos pendientes de aprobación al contrato de `get_dashboard_tasks(...)` y al consumo frontend del resumen de tareas
- [x] Validar build y documentar el ajuste final

## Resultado de notificación de incentivos pendientes en campana superior

- La campana no necesitaba otra query: su fuente canónica ya era `tasksData` desde [`get_dashboard_home_bundle()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/services/dashboardService.ts:13), así que el ajuste correcto fue ampliar [`get_dashboard_tasks(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612211622_add_hr_incentive_tasks_to_dashboard_notifications.sql:3).
- Se agregó la migración [`20260612211622_add_hr_incentive_tasks_to_dashboard_notifications.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612211622_add_hr_incentive_tasks_to_dashboard_notifications.sql:1), que incorpora a `tasksData` las aprobaciones pendientes de `hr_incentive_request_approvals` bajo `module_code = 'recursos_humanos'` y `type = 'hr_incentive_approval'`, incluyendo trabajador, tipo de incentivo, contrato, fecha de servicio y monto.
- En frontend se ajustó el contrato de [`DashboardTaskItem`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/types/index.ts:3) para soportar `service_date` y `calculated_amount`, la campana en [`AppShell.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/layout/AppShell.tsx:84) ahora resume mejor los incentivos, y [`TasksWidget.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/TasksWidget.tsx:1) ya distingue incentivos de contratación/movilidad para mostrar su detalle correcto y decidirlos usando `decideHrIncentiveApproval(...)`.
- La migración fue aplicada también en Supabase productivo durante esta sesión, por lo que la campana ya puede contar y listar incentivos pendientes de aprobación sin esperar otro despliegue manual de base de datos.
- Validación cerrada con `npx tsc -b` exitoso y `git diff --check` limpio. `npm run build` no devolvió error de compilación, pero el proceso `vite build` no terminó dentro de 120 segundos en este entorno, así que la validación dura quedó acotada a typecheck más revisión de diff.

## Hotfix de aprobaciones huérfanas en Incentivos Extraordinarios

- [x] Auditar en producción por qué existen incentivos `P` visibles en historial sin filas asociadas en `hr_incentive_request_approvals`
- [x] Reparar los incentivos pendientes huérfanos creando su aprobación inicial de `Administrador de contrato` y su trazabilidad mínima faltante
- [x] Verificar en producción que la bandeja `Aprobaciones` vuelva a exponer los folios pendientes y documentar el cierre

## Resultado de hotfix de aprobaciones huérfanas en Incentivos Extraordinarios

- La causa real no estaba en la UI: en producción existía al menos un incentivo pendiente (`folio 1`, `status = 'P'`) en [`hr_incentive_requests`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612213000_backfill_missing_hr_incentive_contract_admin_approvals.sql:4) sin ninguna fila asociada en `hr_incentive_request_approvals`, por eso `Historial` lo mostraba como pendiente pero `Aprobaciones` quedaba vacía.
- Se agregó la migración [`20260612213000_backfill_missing_hr_incentive_contract_admin_approvals.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612213000_backfill_missing_hr_incentive_contract_admin_approvals.sql:1), que detecta incentivos `P` sin cadena de aprobación, resuelve nuevamente el administrador de contrato y reconstruye tanto la fila pendiente inicial como el evento de historial `approval_created`.
- La reparación fue aplicada también en Supabase productivo durante esta sesión. Después del backfill, el folio `1` quedó con aprobación `contract_admin` pendiente asignada a `Jose Orellana Paez`, restaurando la consistencia entre solicitud, historial y bandeja de aprobaciones.
- La verificación remota se hizo consultando directamente `hr_incentive_request_approvals` e `hr_incentive_request_history`. La RPC `get_hr_incentive_approval_queue()` no pudo invocarse desde el conector SQL por depender de `auth.uid()`, así que la validación de bandeja quedó respaldada por el estado de datos corregido, no por una llamada RPC autenticada desde el MCP.

## Ajuste urgente de visibilidad y cerrados en folios de contratación

- [x] Auditar y corregir la fuente real de `Resumen de procesos de contratación` para que los folios rechazados/cerrados también aparezcan en la sección `Rechazados / Cerrados`, incluso cuando no exista un `recruitment_case` operativo
- [x] Reemplazar la lógica de visibilidad de folios abiertos en `Inicio` y `Control de Contrataciones` según la nueva matriz: visibilidad total para `reclutamiento`, `control_contratos`, `director_eje`, `gerente_general`, `director_op`; visibilidad por gerencia para `gerencia`; visibilidad solo de solicitudes propias para el resto
- [x] Revisar la auditoría adjunta contra el estado vivo del repo y aplicar mejoras seguras e inmediatas donde el hallazgo siga vigente
- [x] Validar build y documentar resultado final en `todo.md` y `lessons.md`

## Alias de renta y turno en active_cases de Reclutamiento

- [x] Auditar la versión vigente de `get_recruitment_control_dashboard_v2` para confirmar el contrato actual de `active_cases`
- [x] Agregar alias adicionales para renta y turno sin romper los campos ya usados por el frontend actual
- [x] Validar consistencia del diff y documentar el ajuste

## Hotfix crítico del dashboard de Reclutamiento tras alias en active_cases

- [x] Comparar la RPC rota publicada con la última implementación operativa real para aislar el drift introducido
- [x] Restaurar `get_recruitment_control_dashboard_v2` sobre la base correcta y reaplicar solo los alias `salary` y `turno`
- [x] Propagar el error real de la RPC en frontend para no ocultar regresiones operativas futuras
- [x] Validar `npm run build`, `git diff --check` y documentar el cierre del hotfix

## Hotfix de error residual en detalle de caso y campana de tareas pendientes

- [x] Auditar por qué `Control de Contrataciones` sigue mostrando `No fue posible cargar el detalle del caso` aun con el tablero ya operativo
- [x] Corregir el manejo del error de detalle para que no contamine la vista de procesos ni oculte el motivo real
- [x] Implementar una campana en el topbar con contador de tareas pendientes y menú resumen con acceso directo
- [x] Validar build y documentar el cierre sin romper navegación ni vistas existentes

## Resultado de hotfix de error residual en detalle de caso y campana de tareas pendientes

- La causa del mensaje rojo residual no era una nueva caída del tablero: [`HiringStatusPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringStatusPage.tsx:61) mezclaba `dashboardError` y `caseDetailError` aunque el usuario ya hubiera vuelto a `Resumen de procesos`, por lo que un fallo previo del expandible contaminaba la vista principal.
- Se corrigió el gating para que el error de `get_recruitment_case_detail` solo se muestre cuando realmente corresponde cargar ese subflujo, y además [`fetchRecruitmentCaseDetail()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:505) ahora propaga `formatRpcError(error)` en vez de esconder la causa real.
- [`ActiveFoliosWidget.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/ActiveFoliosWidget.tsx:36) ahora guarda errores por `caseId`, de modo que el expandible del inicio puede mostrar el motivo exacto del fallo de detalle sin convertirlo en un “tablero roto”.
- Se agregó una campana operativa en [`AppShell.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/layout/AppShell.tsx:1), al lado del avatar, reutilizando `tasksData` desde [`useDashboard()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/hooks/useDashboard.ts:19). Muestra badge rojo con conteo, resumen desplegable y navegación directa a la ruta relevante de cada tarea pendiente.
- El soporte visual del dropdown quedó en [`global.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/styles/global.css:614), sin introducir otro backend, otra query key ni otro contrato paralelo para notificaciones.
- Validación cerrada con `npm run build` exitoso y `git diff --check` limpio.

## Resultado de hotfix crítico del dashboard de Reclutamiento tras alias en active_cases

- Se agregó la migración [`20260612161000_hotfix_restore_recruitment_dashboard_v2.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612161000_hotfix_restore_recruitment_dashboard_v2.sql:1), que restaura [`get_recruitment_control_dashboard_v2()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612161000_hotfix_restore_recruitment_dashboard_v2.sql:3) sobre la versión operativa real y reaplica solo los aliases `turno` y `salary` dentro de `active_cases`.
- La causa raíz fue drift de implementación: la migración [`20260612154500_add_salary_and_turno_to_active_cases_dashboard.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612154500_add_salary_and_turno_to_active_cases_dashboard.sql:1) no solo agregaba campos, también reemplazaba las ramas `candidate_control` y `personnel_to_hire` por una variante distinta de la RPC, alterando helpers, filtros y contrato runtime del tablero.
- [`fetchRecruitmentControlDashboard()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:468) ahora propaga `formatRpcError(error)` en vez de ocultar el detalle con un texto fijo, lo que permitirá ver inmediatamente el fallo real si Supabase vuelve a rechazar el RPC.
- Validación cerrada con `npm run build` exitoso, `git diff --check` limpio y diff estructural contra la última versión sana de la RPC mostrando solo dos adiciones funcionales: `turno` y `salary` en ambas ramas de `active_cases`.

## Resultado de alias de renta y turno en active_cases de Reclutamiento

- Se agregó la migración [`20260612154500_add_salary_and_turno_to_active_cases_dashboard.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612154500_add_salary_and_turno_to_active_cases_dashboard.sql:1), que redefine la RPC [`get_recruitment_control_dashboard_v2()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612154500_add_salary_and_turno_to_active_cases_dashboard.sql:3).
- La auditoría previa mostró que `active_cases` ya exponía `shift_name` y `salary_offer`; por eso el ajuste seguro no reemplaza ni renombra esos campos, sino que agrega alias nuevos `turno` y `salary` en ambas ramas del arreglo (`source_type = case` y `source_type = request`).
- Así el payload conserva intactos los campos que hoy consume [`RecruitmentCaseListRow`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:72) y, al mismo tiempo, habilita consumidores nuevos que prefieran leer `salary` y `turno`.

## Saneamiento seguro del historial de migraciones Supabase

- [x] Auditar el árbol local de `supabase/migrations` para distinguir naming legacy, migraciones válidas y ruido no SQL
- [x] Ejecutar solo la limpieza segura que no altera SQL ni arriesga reconciliación falsa con producción
- [x] Dejar documentado el plan de saneamiento posterior con criterio de no regresión

## Resultado de saneamiento seguro del historial de migraciones Supabase

- Se movió [`supabase/migrations/README.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/README.md:1) fuera del directorio de migraciones para eliminar el warning de `supabase migration list` sin tocar ninguna migración SQL real.
- La auditoría dejó cuantificado el problema real en [`supabase/MIGRATIONS_AUDIT.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/MIGRATIONS_AUDIT.md:1): `119` archivos SQL revisados, `11` con formato CLI válido y `108` legacy en formato `YYYYMMDD_HHMMSS_nombre.sql`.
- También quedó validado que convertir el naming legacy a `YYYYMMDDHHMMSS_nombre.sql` no genera colisiones de nombre en el árbol local, pero aún así no se ejecutó el renombre masivo porque el historial remoto está desalineado y varias migraciones fueron aplicadas manualmente.
- La decisión segura en esta pasada fue limpiar ruido, fijar la convención futura en [`supabase/README.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/README.md:1) y documentar el orden correcto para una reconciliación posterior (`foto remota -> tabla de equivalencias -> rename controlado -> repair puntual -> validación final`).

## Bandeja de doble aprobación para Incentivos Extraordinarios

- [x] Auditar el flujo actual de `Incentivos Extraordinarios` para detectar dónde debía injertarse la cadena de doble aprobación sin duplicar lógica
- [x] Extender Supabase con aprobaciones secuenciales para incentivos: `Administrador de contrato` primero y `Gerente de área` segundo, incluyendo detalle y decisión masiva
- [x] Agregar una nueva sección `Aprobaciones` en el dashboard de incentivos con selección múltiple, detalle expandido y acciones de aprobar/rechazar
- [x] Exponer la sección `Recursos Humanos` a aprobadores efectivos de incentivos cuando tengan pendientes reales, sin abrir el módulo a todos los roles
- [x] Validar `npm run build`, revisar consistencia del diff y documentar el resultado final

## Higiene de dependencias y migraciones pendientes

- [x] Auditar el uso real de `@xenova/transformers` y `xlsx` para distinguir deuda real de dependencias colgadas
- [x] Reemplazar o retirar dependencias vulnerables sin romper exportaciones, scripts operativos ni artefactos ERP existentes
- [x] Revisar la migración pendiente `20260612120000_align_internal_mobility_permission_contracts.sql` y eliminarla solo si realmente no pertenece al flujo vigente
- [x] Validar `npm run build`, `npm audit` y documentar el resultado final en `todo.md` y `lessons.md`

## Resultado de higiene de dependencias y migraciones pendientes

- `@xenova/transformers` se retiró completamente del proyecto porque no tenía usos reales en `src/` ni en `scripts/`; también se limpió su chunk muerto en [`vite.config.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/vite.config.ts:1) y [`vite.config.js`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/vite.config.js:1).
- `xlsx` no estaba colgado: seguía gobernando exportaciones del frontend y varios scripts operativos. Para no romper esos flujos ni perder soporte `xlsx/xls`, se reemplazó por [`@mylinkpi/xlsx`](https://www.npmjs.com/package/@mylinkpi/xlsx), manteniendo la misma API de uso en [`OperacionesDashboard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/pages/OperacionesDashboard.tsx:595), [`bukEmployeeNomina.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/lib/bukEmployeeNomina.ts:237) y scripts de provisión/migración.
- La migración pendiente [`20260612120000_align_internal_mobility_permission_contracts.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612120000_align_internal_mobility_permission_contracts.sql:1) sí corresponde al ERP actual y no se eliminó: sigue siendo la pieza que alinea los permisos de `Movilidad Interna` con `Control de Contrataciones`.
- Validación cerrada con `npm audit --omit=dev --json` en `0` vulnerabilidades, `npm run build` exitoso y smoke test Node del paquete de planillas leyendo/escribiendo workbook con la nueva dependencia.

## Ajuste de contratos aplicables en registro de incentivos

- [x] Auditar el flujo de `Registro de incentivos` para identificar dónde se limita el selector al contrato actual del trabajador
- [x] Corregir el backend canónico para que el selector mantenga el contrato primario como default pero exponga todos los contratos activos del ERP
- [x] Validar build y documentar el cambio sin romper la resolución automática de montos

## Resultado de ajuste de contratos aplicables en registro de incentivos

- Se agregó la migración [`20260612131500_expand_hr_incentive_contract_options.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612131500_expand_hr_incentive_contract_options.sql:1), que redefine la RPC canónica [`get_hr_incentive_worker_context(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612131500_expand_hr_incentive_contract_options.sql:1).
- La causa raíz no estaba en el selector React sino en el payload backend: `available_areas` solo devolvía áreas/contratos históricamente asociadas al trabajador, por lo que el formulario jamás podía mostrar el resto de contratos activos del ERP.
- El nuevo contrato mantiene el `primary_contract_code` y el área operativa del trabajador para la preselección y trazabilidad, pero agrega como opciones complementarias todos los registros activos de [`public.contracts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612131500_expand_hr_incentive_contract_options.sql:108).
- La resolución de monto no se tocó: [`calculate_hr_incentive_preview(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612040714_consolidate_hr_incentive_rule_resolution.sql:392) y [`create_hr_incentive_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612040714_consolidate_hr_incentive_rule_resolution.sql:471) siguen calculando por `selected_contract_code`, así que el cambio amplía opciones sin alterar el matching de reglas ni el guardado del folio.
- Validación cerrada con `npm run build` y `git diff --check`.

## Hotfix de ambigüedad en registro de incentivos

- [x] Auditar la RPC de creación para ubicar la referencia ambigua a `folio`
- [x] Corregir la función de registro sin tocar el cálculo ni el payload funcional de incentivos
- [x] Validar build y documentar el hotfix

## Resultado de hotfix de ambigüedad en registro de incentivos

- Se agregó la migración [`20260612133000_fix_hr_incentive_request_folio_ambiguity.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612133000_fix_hr_incentive_request_folio_ambiguity.sql:1), que redefine [`create_hr_incentive_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612133000_fix_hr_incentive_request_folio_ambiguity.sql:1).
- La causa raíz era una colisión clásica de PL/pgSQL: la función expone `returns table (... folio bigint ...)` y luego hacía `insert ... returning id, folio`, dejando `folio` ambiguo entre la columna real de `hr_incentive_requests` y el nombre de salida de la propia función.
- El hotfix califica explícitamente el `returning` como `hir.id, hir.folio`, eliminando la ambigüedad sin modificar preview, reglas, validaciones ni la estructura de la solicitud registrada.
- Validación cerrada con `npm run build` y `git diff --check`.

## Hotfix de visibilidad de folios propios para solicitantes con rol gerencia

- [x] Auditar por qué folios históricos migrados como el 2101 no son visibles para su propio solicitante
- [x] Corregir la helper de visibilidad para que el solicitante siempre vea sus propios folios, incluso si además tiene rol `gerencia`
- [x] Validar build y documentar el ajuste sin abrir visibilidad global indebida

## Resultado de hotfix de visibilidad de folios propios para solicitantes con rol gerencia

- Se agregó la migración [`20260612140000_restore_requester_visibility_for_hiring_process_summary.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612140000_restore_requester_visibility_for_hiring_process_summary.sql:1), que redefine [`user_can_view_hiring_request_process_summary(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612140000_restore_requester_visibility_for_hiring_process_summary.sql:1).
- La causa raíz era lógica, no de UI ni de migración de datos: la helper vigente solo permitía “solicitudes propias” para usuarios que **no** tuvieran rol `gerencia`. Si el solicitante además era `gerencia`, quedaba obligado a pasar por el branch de `cost_center_approvers`, lo que podía ocultar folios propios históricos aunque `requester_id` sí estuviera bien grabado.
- El ajuste mueve `requester_user_id = target_user_id` al nivel superior de la condición, de modo que el dueño del folio siempre lo vea; la visibilidad extra por rol (`gerencia` por centro de costo, roles globales, etc.) se mantiene intacta para terceros.
- Validación cerrada con `npm run build` y `git diff --check`.

## Resultado de bandeja de doble aprobación para Incentivos Extraordinarios

- Se agregó la migración [`20260612130334_add_hr_incentive_double_approval_queue.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612130334_add_hr_incentive_double_approval_queue.sql:1), que crea [`hr_incentive_request_approvals`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612130334_add_hr_incentive_double_approval_queue.sql:3) y redefine las RPCs clave del flujo para soportar doble aprobación real.
- La solicitud de incentivo ya no termina solo en `status = 'P'`: al registrarse crea la aprobación pendiente de `Administrador de contrato`, resolviendo el usuario desde [`buk_contract_mappings.contract_admin_name`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260607_230000_add_buk_contract_mapping_catalog.sql:36) y `profiles` activos; al aprobar esa etapa, se crea automáticamente la aprobación de `Gerente de área` desde [`cost_center_approvers`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260520_000006_secure_hiring_requests_workflow.sql:15).
- Se añadieron las RPCs [`get_hr_incentive_approval_queue()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612130334_add_hr_incentive_double_approval_queue.sql:458), [`get_hr_incentive_request_detail(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612130334_add_hr_incentive_double_approval_queue.sql:527), [`decide_hr_incentive_request_approval(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612130334_add_hr_incentive_double_approval_queue.sql:646) y [`bulk_decide_hr_incentive_request_approvals(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612130334_add_hr_incentive_double_approval_queue.sql:824), dejando la aprobación individual y masiva gobernada en backend y no por loops inseguros en React.
- [`HumanResourcesDashboard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/pages/HumanResourcesDashboard.tsx:1) ahora expone la nueva pestaña `Aprobaciones`, e [`IncentiveApprovalsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveApprovalsView.tsx:1) entrega la bandeja con búsqueda, checkboxes, aprobación/rechazo masivo y detalle extendido del incentivo.
- [`IncentiveRequestsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRequestsView.tsx:1) dejó de tratar `F` como `Pagado`: ahora `P = Pendiente administrador contrato`, `E = Pendiente gerente de area` y `F = Aprobado`, además de mostrar el aprobador pendiente en historial mediante `current_flow_user`.
- Como la ruta vive bajo `/recursos-humanos/:view` y está protegida por `accessible_modules`, se agregó además la migración [`20260612133601_expose_hr_module_for_incentive_approvers.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612133601_expose_hr_module_for_incentive_approvers.sql:1), que añade `recursos_humanos` a [`get_my_effective_permissions()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612133601_expose_hr_module_for_incentive_approvers.sql:1) solo para usuarios con aprobaciones pendientes reales en `hr_incentive_request_approvals`.
- En la pasada final se añadió también la suscripción Realtime de [`hr_incentive_request_approvals`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/pages/HumanResourcesDashboard.tsx:48) para que la nueva cola invalide al instante cuando cambian las aprobaciones y no dependa solo del polling.
- La SQL de exposición dinámica para aprobadores ya fue ejecutada manualmente en Supabase productivo durante esta sesión; el archivo de migración se conserva en repo para no perder trazabilidad ni romper futuros despliegues versionados.
- Validación local cerrada con `npm run build` y `git diff --check`. En el cierre también se corrigió un error de compilación ajeno al flujo (`NodeJS.Timeout` en [`AppShell.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/layout/AppShell.tsx:82)) usando timers tipados para navegador y cleanup explícito al desmontar.

## Ajuste de permisos entre Movilidad Interna y Control de Contrataciones

- [x] Auditar las RPCs y helpers de permisos que gobiernan la lectura de movilidad interna desde el módulo propio y desde `Control de Contrataciones`
- [x] Unificar la visibilidad de solicitudes de movilidad con el mismo contrato de folios (`roles globales`, `gerencia por área`, `resto solo solicitudes propias`) y eliminar drift entre módulos/capabilities
- [x] Verificar que la pestaña `Movilidad Interna` en `Control de Contrataciones` conserve exactamente el mismo gate e interacción de `Personal a Contratar` sin romper vistas existentes
- [x] Validar build, revisar diffs y documentar el resultado final en `todo.md` y `lessons.md`

## Integración base de gráficos para módulos ERP

- [x] Auditar el frontend actual y definir la integración gráfica que minimice bundle extra y evite wrappers de terceros innecesarios
- [x] Crear una capa compartida reutilizable en `src/shared` con ciclo de vida React limpio y contrato estable para gráficos
- [x] Exponer un showcase mínimo dentro de la app para validar interacción, resize y consistencia visual con los temas existentes
- [x] Validar build, revisar bundle/diff y documentar la integración final en `todo.md` y `lessons.md`

## Resultado de integración base de gráficos para módulos ERP

- La capa compartida vigente quedó en [`src/shared/ui/charts/ChartSurface.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/charts/ChartSurface.tsx:1) y [`ChartTooltip.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/charts/ChartTooltip.tsx:1): contenedor responsive, loading, empty state y tooltip reusable para consumidores Recharts.
- El preset actual quedó enfocado en tipos ERP reales (`line`, `bar`, `pie`) para no cargar complejidad innecesaria en la base compartida.
- [`src/shared/ui/index.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/index.ts:1) ya exporta la nueva capa de gráficos para que cualquier módulo la consuma desde el barrel estándar.
- Se añadió un showcase mínimo en [`src/modules/labs/components/RechartsShowcase.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/labs/components/RechartsShowcase.tsx:1) y [`LabsPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/labs/pages/LabsPage.tsx:1), con cambio semanal/mensual, interacción y tooltip.
- Para no inflar el arranque de `Labs`, el showcase quedó cargado con `lazy()`; así el vendor gráfico se separa del resto del laboratorio y solo se descarga cuando esa sección realmente se usa.
- La nueva partición de [`vite.config.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/vite.config.ts:1) y [`vite.config.js`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/vite.config.js:1) mantiene vendors base (`app-framework`, `supabase`, `markdown`, `xlsx`, `recharts`) para que el peso gráfico quede aislado fuera del arranque normal.
- En la misma pasada se actualizó `react-router-dom` al parche compatible `^6.30.4`, eliminando la vulnerabilidad moderada de open redirect detectada por `npm audit` sin abrir un upgrade mayor del router.
- Validación cerrada con `npm run build`, `git diff --check` y smoke test HTTP local usando el bundle ESM instalado en `node_modules` más captura automatizada con Playwright CLI.
- El criterio vigente es sostener solo la complejidad gráfica que el ERP usa hoy, evitando motores más generales mientras no exista una necesidad funcional real que lo justifique.
- Queda deuda de dependencias que no se corrigió en esta pasada porque no existe un fix compatible inmediato en este stack actual: `xlsx` sigue con advisories abiertos sin `fixAvailable` y `@xenova/transformers` arrastra `protobufjs/onnxruntime-web`, donde `npm audit` solo propone una regresión mayor hacia `2.0.1`.

## Resultado de ajuste de permisos entre Movilidad Interna y Control de Contrataciones

- Se agregó la migración [`20260612120000_align_internal_mobility_permission_contracts.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612120000_align_internal_mobility_permission_contracts.sql:1), que elimina el drift entre la visibilidad de folios y la visibilidad de solicitudes de movilidad interna.
- [`user_can_view_internal_mobility_request_summary(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612120000_align_internal_mobility_permission_contracts.sql:3) ahora delega directamente en [`user_can_view_hiring_request_process_summary(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260611_182500_restore_control_contratos_summary_visibility.sql:8), de modo que movilidad interna hereda exactamente la misma matriz: roles globales ven todo, `gerencia` solo sus áreas y el resto solo solicitudes propias.
- La nueva helper [`user_can_read_internal_mobility_requests(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612120000_align_internal_mobility_permission_contracts.sql:19) permite leer la bandeja de movilidad tanto desde el módulo `movilidad_interna` como desde superficies de `Control de Contrataciones` gobernadas por `candidate_control_access`, evitando que la UI muestre una pestaña autorizada con backend todavía bloqueado.
- La pestaña `Movilidad Interna` de [`HiringStatusPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringStatusPage.tsx:355) ya colgaba del mismo `canAccessCandidateControl` que `Personal a Contratar`; no fue necesario abrir más roles en frontend, solo alinear el contrato backend para que vista e interacción queden consistentes.
- Validación local cerrada con `npm run build` y `git diff --check`.

## Hotfix de resolución de reglas en Incentivos Extraordinarios

- [x] Auditar frontend, catálogos y RPCs del módulo para reconstruir el flujo real de resolución de monto por contrato, cargo y sindicato
- [x] Consolidar las RPCs de incentivos en una única versión canónica que soporte sindicato nominal y contexto operativo de contrato
- [x] Hacer visible en UI el preview del monto calculado y la regla aplicada para que el usuario vea el resultado real antes de registrar
- [x] Validar build local, revisar consistencia del diff y dejar documentado el resultado final

## Resultado de hotfix de resolución de reglas en Incentivos Extraordinarios

- La regla de `90.000` para `Por Inasistencia del Trabajador` y `Sindicato Codelco DMH` sí estaba persistida en base, pero el módulo seguía expuesto a drift porque las RPCs de incentivos habían sido redefinidas varias veces con firmas distintas para sindicato.
- Se agregó la migración [`20260612040714_consolidate_hr_incentive_rule_resolution.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612040714_consolidate_hr_incentive_rule_resolution.sql:1), que elimina overloads históricos y fija una versión canónica de `add_hr_incentive_rate_rule`, `get_hr_incentive_worker_context`, `resolve_hr_incentive_rate_rule`, `calculate_hr_incentive_preview`, `create_hr_incentive_request` y `get_hr_incentive_setup_catalogs`.
- La consolidación deja el matching operativo por `contrato + cargo + union_name + union_status`, y además fuerza el contexto del trabajador a resolver contrato operativo desde `buk_contract_mappings`, evitando que setup, preview y registro final trabajen con contratos distintos.
- En frontend, [`IncentiveRegistrationForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRegistrationForm.tsx:1) ahora muestra explícitamente el preview del cálculo: monto final, monto base de regla, contrato aplicado, cargo aplicado, sindicato aplicado y prioridad; si falla la resolución, se ve el error real en pantalla.
- Se añadió soporte visual en [`incentives.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/styles/incentives.css:1) para esa tarjeta de preview sin romper el layout responsive del módulo.
- Validación cerrada con `npm run build`, `git diff --check` y aplicación remota exitosa en Supabase productivo (`20260612041403_consolidate_hr_incentive_rule_resolution` en `pzblmbahnoyntrhistea`).

## Hotfix crítico de Movilidad Interna: cargo, empresa y catálogos BUK

- [x] Auditar en Supabase vivo por qué `Movilidad Interna` no resolvía cargo actual, empresa actual ni destinos operativos
- [x] Corregir la resolución backend de cargo y empresa desde `raw_payload` de BUK y completar el catálogo `buk_contract_mappings.company_name`
- [x] Revalidar las RPCs de setup, búsqueda y contexto de trabajador contra datos reales y documentar el resultado

## Ajuste inmediato de contadores de movilidad, bandeja de movilidad y rechazados Who

- [x] Separar el contador de movilidad interna en `Resumen de procesos de contratación` para que no infle `Activos`
- [x] Agregar la pestaña `Movilidad Interna` dentro de `Control de Contrataciones`, reutilizando la lógica operacional de detalle
- [x] Hacer visibles en `Control de candidatos` los rechazados y retirados por Who aunque el caso siga operativo
- [x] Corregir el drift de firmas SQL introducido en `candidate_control` y publicar el hotfix en Supabase productivo
- [x] Validar build local y registrar la limitación de verificación remota restante

## Resultado de ajuste inmediato de contadores de movilidad, bandeja de movilidad y rechazados Who

- Se agregó la migración [`20260612030732_refine_mobility_counters_and_rejected_candidate_visibility.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612030732_refine_mobility_counters_and_rejected_candidate_visibility.sql:1), que separa explícitamente `candidate_count = active_candidate_count` y mantiene `mobility_active_count` en paralelo para que una movilidad pendiente no se pinte además como candidato azul.
- La misma pasada amplía [`get_internal_mobility_requests()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612030732_refine_mobility_counters_and_rejected_candidate_visibility.sql:5) con `recruitment_case_code`, `source_folio`, `current_shift_name` y `destination_shift_name`, contrato necesario para renderizar la nueva bandeja de movilidad desde Reclutamiento.
- Se incorporó [`HiringInternalMobilityView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringInternalMobilityView.tsx:1) y [`HiringStatusPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringStatusPage.tsx:1) ahora expone una pestaña `Movilidad Interna` junto a `Personal a Contratar`, con detalle expandible, búsqueda y refresco por Realtime compartido.
- `candidate_control` quedó ajustado para incluir `rejected` y `withdrawn` aunque el caso no esté cancelado, corrigiendo el hueco funcional por el que los rechazados de Who desaparecían de la bandeja.
- La primera publicación del cambio dejó un drift de firmas en `candidate_control` al llamar helpers con parámetros incompatibles con producción. Se corrigió con la migración incremental [`20260612032013_fix_recruitment_candidate_control_signature_drift.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612032013_fix_recruitment_candidate_control_signature_drift.sql:1), ya aplicada también en `pzblmbahnoyntrhistea`.
- La siguiente regresión no fue de permisos sino de esquema: la RPC seguía intentando leer `rcc.documentation_completed_at`, columna inexistente en `recruitment_case_candidates`. Se corrigió con [`20260612033448_hotfix_recruitment_dashboard_personnel_columns.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612033448_hotfix_recruitment_dashboard_personnel_columns.sql:1), reemplazando esa referencia por `document_validated_at / stage_entered_at / updated_at` y retirando `candidate_number`, también inexistente en `candidate_profiles`.
- Validación local cerrada con `npm run build` y `git diff --check`. La validación remota por `execute_sql` quedó bloqueada después por reautenticación del conector Supabase, pero ambas migraciones respondieron `success=true` al publicarse.

## Movilidad Interna ligada a folios con cupos y contadores operativos

- [x] Rediseñar la creación de movilidad interna para que dependa de un folio/caso abierto con cupos disponibles y derive desde ahí cargo, contrato, turno y empresa destino
- [x] Recalcular backend de casos para que movilidades pendientes cuenten como activos y movilidades aprobadas consuman cupos como contratación cerrada
- [x] Ajustar `Inicio`, `Control de Contrataciones` y `Movilidad Interna` para exponer los nuevos contadores y el selector de folio destino
- [x] Aplicar la migración en Supabase productivo, validar payloads vivos y registrar el resultado final

## Resultado de Movilidad Interna ligada a folios con cupos y contadores operativos

- Se agregó la migración [`20260612_003000_link_internal_mobility_to_recruitment_cases.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612_003000_link_internal_mobility_to_recruitment_cases.sql:1), ya aplicada en Supabase remoto, para ligar cada movilidad interna a `recruitment_cases` y `hiring_requests`.
- [`submit_internal_mobility_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612_003000_link_internal_mobility_to_recruitment_cases.sql:252) ahora exige `recruitment_case_id`, rechaza folios sin cupos y persiste `recruitment_case_id`, `hiring_request_id`, `recruitment_case_code` y `source_folio` dentro de la solicitud.
- [`get_internal_mobility_setup_catalogs()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612_003000_link_internal_mobility_to_recruitment_cases.sql:149) ya no entrega destinos libres para este flujo: expone `eligible_folios` con cargo, contrato, turno, empresa y cupos disponibles derivados del caso real.
- Se centralizó el cálculo en [`get_recruitment_case_effective_metrics(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612_003000_link_internal_mobility_to_recruitment_cases.sql:13) y [`sync_recruitment_case_status(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612_003000_link_internal_mobility_to_recruitment_cases.sql:70): movilidad pendiente suma a activos, movilidad aprobada suma a vacantes cubiertas.
- [`InternalMobilityPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/pages/InternalMobilityPage.tsx:1), [`internalMobilityApi.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/services/internalMobilityApi.ts:1) y [`types.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/types.ts:1) quedaron ajustados para seleccionar trabajador + folio, autocompletar destino desde el caso y mostrar el resumen con los datos operativos correctos.
- [`HiringProcessesView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringProcessesView.tsx:1), [`ActiveFoliosWidget.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/ActiveFoliosWidget.tsx:1), [`hiringControl.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:1) y [`src/styles/global.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/styles/global.css:1) ahora muestran movilidades en amarillo dentro de los contadores activos del folio.
- Validación viva en `pzblmbahnoyntrhistea`: `eligible_folios_count = 36`, `active_cases_count = 44`, `active_folios_count = 25`. El primer folio elegible ya sale como `0016 · CONDUCTOR DE BUS · ARAMARK GABY INTERNO · Cupos 1/1`, con empresa `Buses JM Pullman S.A.` y `available_vacancies = 1`.
- Validación local cerrada con `npm run build` exitoso después de alinear tipos, detalle y resúmenes del nuevo contrato.

## Resultado de hotfix crítico de Movilidad Interna: cargo, empresa y catálogos BUK

- La causa raíz no estaba en React sino en el contrato vivo de datos: [`employees_active_current`](</Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260611_231500_fix_internal_mobility_worker_resolution.sql:1>) traía `job_title` vacío para `1575/1575` trabajadores activos, por lo que `Movilidad Interna` jamás podía mostrar cargo actual ni poblar correctamente el dropdown de cargos destino.
- El segundo quiebre estaba en [`buk_contract_mappings`](</Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260611_231500_fix_internal_mobility_worker_resolution.sql:1>): `company_name` estaba vacío en `107/107` mappings, dejando inutilizable la empresa destino y degradando el selector de contrato/área nuevo.
- Se agregó la migración [`20260611_231500_fix_internal_mobility_worker_resolution.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260611_231500_fix_internal_mobility_worker_resolution.sql:1), que incorpora helpers para extraer cargo real desde `raw_payload.current_job.role.name` / `jobs[*].role.name`, resolver empresa por `company_id` y por sufijo de contrato/área BUK, ampliar el fallback de turnos y redefinir las RPCs `get_internal_mobility_setup_catalogs`, `search_internal_mobility_workers`, `get_internal_mobility_worker_context` y `submit_internal_mobility_request`.
- El hotfix se aplicó también en Supabase remoto durante esta sesión. Validación viva: `1575/1575` trabajadores ahora resuelven cargo, `1575/1575` resuelven empresa, `95` destinos operativos ya salen con empresa visible y el contexto del trabajador `20652` ya devuelve `CONDUCTOR DE BUS`, `Buses JM Pullman S.A.` y `matched_destination_contract_id = 81`.
- También se corrigió el desalineamiento entre `company_id` y sufijo contractual de Minardi: `company_id = 3` pero contratos `:0002`, por lo que la equivalencia quedó explicitada para no volver a dejar `INDIRECTO ZONA II SIMSA` sin empresa.

## Ajuste integral de etapas, permisos Who y movilidad interna

- [x] Agregar nuevos turnos de contratación y reutilizarlos también en Movilidad Interna
- [x] Insertar la nueva etapa `En Proceso` entre `Who` y `Exámenes Médicos`, ajustando frontend y RPCs
- [x] Corregir la carga de trabajador en Movilidad Interna para tolerar `company_id` numérico y no bloquear si la empresa no se resuelve
- [x] Persistir `turno actual` y `turno nuevo` en Movilidad Interna y exponerlos en detalle/listados
- [x] Reparar permisos de `gerente_general` para Who sin abrir acceso global y corregir auditoría `23514`
- [x] Validar build, consistencia de diffs y documentar hallazgos/riesgos

## Resultado de ajuste integral de etapas, permisos Who y movilidad interna

- Se agregó la migración [`20260611_220000_expand_internal_mobility_and_recruitment_stage_controls.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260611_220000_expand_internal_mobility_and_recruitment_stage_controls.sql:1), que incorpora los turnos `10X5+5`, `6X3+1` y `6X1`, amplía el `CHECK` de `recruitment_case_audit_log`, habilita la etapa `in_process`, agrega `candidate_control_access` a `gerente_general`, y endurece la visibilidad Who para que dependa del caso realmente pendiente de aprobación.
- La misma migración también expande `Movilidad Interna`: `current_company_name` deja de bloquear si no se resuelve, se agregan `current_shift_name`, `destination_shift_id` y `destination_shift_name`, y se redefinen las RPCs de setup, búsqueda, contexto y creación de solicitud para soportar `company_id` numérico y fallback por área/worker file.
- En frontend se actualizaron [`hiringControl.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:1) y [`hiringControlViewUtils.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/hiringControlViewUtils.ts:1) para reflejar la nueva etapa visible `En Proceso` y su transición `Who Aprobado -> En Proceso -> Exámenes Médicos`.
- [`InternalMobilityPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/pages/InternalMobilityPage.tsx:1), [`internalMobilityApi.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/services/internalMobilityApi.ts:1) y [`types.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/types.ts:1) ahora exponen turno actual/destino, permiten empresa actual no resuelta sin romper el formulario y muestran esos datos en resumen, tabla y detalle.
- La corrección del error `23514` no se resolvió renombrando acciones: se alineó el constraint con los `action_type` ya usados por el código (`candidate_stage_approval_requested`, `candidate_stage_approval_approved`, `candidate_stage_approval_rejected`, entre otros) para preservar trazabilidad consistente.

## Notificaciones transaccionales por correo en aprobaciones de contratación

- [x] Diseñar el flujo backend para disparar correos exactamente cuando un folio cambia de aprobador o entra a reclutamiento
- [x] Crear una Edge Function nueva para envío transaccional con `Resend`, usando secrets de Supabase y validación por secret interno
- [x] Crear una migración SQL que dispare el correo al gerente de área al enviar el requerimiento, a Control de Contratos al aprobar gerencia y al pool activo de `reclutamiento` al aprobar Control de Contratos
- [x] Dejar el flujo idempotente y con trazabilidad mínima para evitar correos duplicados por reintentos
- [x] Validar `npm run build`, revisar diffs y documentar resultado final en `todo.md` y `lessons.md`

## Resultado de notificaciones transaccionales por correo en aprobaciones de contratación

- Se agregó la Edge Function [`hiring-transactional-email`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/hiring-transactional-email/index.ts:1), preparada para enviar correos vía `Resend` y protegida por un secret interno (`INTERNAL_EMAIL_WEBHOOK_SECRET`) para que no quede expuesta a llamados arbitrarios.
- Se creó la migración [`20260611_170000_add_hiring_transactional_email_notifications.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260611_170000_add_hiring_transactional_email_notifications.sql:1), que incorpora configuración `transactional_email_settings`, log idempotente `transactional_email_dispatches`, helpers de encolado y triggers backend sobre `hiring_request_approvals` y `recruitment_cases`.
- El correo al gerente de área se dispara cuando nace la aprobación `area_manager`; el correo a Control de Contratos se dispara cuando nace la aprobación `contracts_control`; y el correo a Reclutamiento se dispara cuando se inserta el `recruitment_case` al aprobar Control de Contratos.
- El destinatario de Reclutamiento quedó resuelto contra el pool activo del rol `reclutamiento`, porque el flujo actual no asigna un `recruiter` automático al abrir el caso.
- El envío quedó deshabilitado por defecto (`transactional_email_settings.is_enabled = false`) para evitar disparos accidentales antes del deploy manual y de que cargues la URL final de la Edge Function en Supabase.
- Validación local cerrada con `git diff --check` y `npm run build` exitosos.

## Hotfix de regresión de visibilidad para control_contratos en Control de Contrataciones

- [x] Auditar qué SQL dejó desalineado `Inicio` vs `Control de Contrataciones` para el rol `control_contratos`
- [x] Preparar un hotfix backend mínimo para restaurar acceso al resumen de procesos sin tocar el resto del flujo
- [x] Verificar consistencia local del parche y documentar el origen de la regresión

## Resultado de hotfix de regresión de visibilidad para control_contratos en Control de Contrataciones

- La regresión apunta al contrato revertido en [`20260608_155500_revert_control_contratos_module_access.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_155500_revert_control_contratos_module_access.sql:1), que explícitamente quitaba a `control_contratos` del módulo `control_contrataciones` y de la visibilidad operacional de casos.
- Para restaurar el comportamiento esperado se agregó la migración de reparación [`20260611_182500_restore_control_contratos_summary_visibility.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260611_182500_restore_control_contratos_summary_visibility.sql:1), que vuelve a otorgar `role_module_access` al módulo y recompone las helpers `user_can_view_hiring_request_process_summary(...)` y `user_can_view_recruitment_process_summary(...)`.
- El hotfix no toca frontend. El quiebre está en SQL y la UI de `Control de Contrataciones` solo estaba reflejando ese drift.
- Validación local cerrada con `git diff --check`.

## Hotfix de regresión por alias roto en get_recruitment_control_dashboard_v2

- [x] Auditar la RPC activa y contrastarla contra el estado remoto real de casos, roles y helpers
- [x] Corregir la referencia rota de `contract_lock.case_id` dentro del bloque de `candidate_control`
- [x] Evitar que la vista de procesos vuelva a ocultar errores mostrando un falso cero silencioso
- [x] Validar build local y documentar el hallazgo

## Resultado de hotfix de regresión por alias roto en get_recruitment_control_dashboard_v2

- La causa raíz más probable no era la visibilidad base: en remoto sí existen `29` casos abiertos, `control_contratos` sí volvió a tener acceso al módulo y las helpers `user_can_view_*` responden `true` para el usuario admin inspeccionado.
- El quiebre estaba reintroducido en la versión actual de [`get_recruitment_control_dashboard_v2()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260611_184500_fix_recruitment_dashboard_contract_lock_alias_regression.sql:1): el bloque `candidate_control` volvió a leer `contract_lock.case_id`, pero el helper `find_active_candidate_contract_lock(...)` expone `recruitment_case_id`.
- Eso hace que cualquier sesión con `candidate_control_access` pueda romper toda la RPC y el frontend termine mostrando resúmenes en cero aunque sí existan folios/casos.
- Se agregó la migración de reparación [`20260611_184500_fix_recruitment_dashboard_contract_lock_alias_regression.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260611_184500_fix_recruitment_dashboard_contract_lock_alias_regression.sql:1), que restaura `contract_lock.recruitment_case_id`.
- También se ajustó [`HiringProcessesView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringProcessesView.tsx:126) para mostrar el error de la query en vez de aparentar un tablero vacío si la RPC vuelve a fallar.
- Validación local cerrada con `git diff --check` y `npm run build`.

## Análisis de factibilidad para nuevo módulo Movilidad Interna

- [x] Auditar la arquitectura actual de `Solicitud de Contratación`, BUK, permisos y aprobaciones para identificar reutilización real
- [x] Definir el diseño mínimo viable de `Movilidad Interna` evitando duplicación entre frontend, servicios y SQL
- [x] Documentar factibilidad, riesgos, dependencias y propuesta de implementación incremental

## Resultado de análisis de factibilidad para nuevo módulo Movilidad Interna

- Se documentó la evaluación completa en [`docs/movilidad-interna-factibilidad.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/docs/movilidad-interna-factibilidad.md:1), aterrizada contra la arquitectura viva del repo y no contra una propuesta genérica.
- La conclusión técnica es que `Movilidad Interna` sí es factible con alta reutilización, pero no debe montarse sobre `hiring_requests`; ese dominio está acoplado a vacantes y apertura de reclutamiento, mientras que movilidad parte de un trabajador activo ya existente.
- La mejor estrategia es crear un módulo hermano con tablas y RPCs propias, reutilizando navegación, guards, lookup BUK, resolución de aprobadores, auditoría y notificaciones transaccionales ya construidas para contratación.
- El principal gap detectado no está en React sino en datos: hoy el repo puede obtener `empresa actual` desde BUK, pero `buk_contract_mappings` no guarda de forma explícita la `empresa destino`, por lo que se recomienda extender ese catálogo con una columna de empresa legal antes de implementar la regla definitiva de `requiere_finiquito`.
- Se dejó además una propuesta incremental por etapas para evitar un refactor excesivo en la primera pasada y reducir riesgo de regresión sobre el flujo productivo de contratación.

## Implementación completa de Movilidad Interna

- [x] Crear el backend de `Movilidad Interna` en Supabase: módulo autorizado, tablas, RPCs, helpers de visibilidad, auditoría, aprobaciones y notificaciones
- [x] Implementar el frontend del módulo reutilizando patrones de `Solicitud de Contratación`, con formulario, lookup BUK, alerta de cambio de empresa y detalle operativo
- [x] Integrar las aprobaciones de movilidad en Inicio y validar el flujo end-to-end con build y revisión final

## Resultado de implementación completa de Movilidad Interna

- Se creó la migración [`20260611184435_add_internal_mobility_module.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260611184435_add_internal_mobility_module.sql:1), que registra el módulo `movilidad_interna`, amplía `buk_contract_mappings` con `company_name` y `buk_area_code`, y crea el dominio completo de backend: `internal_mobility_requests`, `internal_mobility_request_approvals`, `internal_mobility_request_snapshots`, `internal_mobility_request_audit_log`, helpers de visibilidad, búsqueda BUK, contexto de trabajador, envío de solicitud, detalle y decisión de aprobaciones.
- La misma migración conecta el flujo al motor ya existente de notificaciones transaccionales: correos al gerente de área y a Control de Contratos al crearse sus aprobaciones pendientes, y correo de handoff a Reclutamiento cuando Control de Contratos aprueba la movilidad.
- El módulo frontend quedó implementado en [`src/modules/internal_mobility`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility): página [`InternalMobilityPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/pages/InternalMobilityPage.tsx:1), lookup de trabajadores activos BUK, hooks `react-query`, servicios RPC y detalle operativo con historial de aprobaciones y auditoría.
- La UI reutiliza patrones existentes de `Solicitud de Contratación`, pero aterrizados al nuevo dominio: trabajador activo, origen/destino, empresa actual/destino, alerta amarilla por cambio de empresa y cálculo visible de `requiere finiquito`.
- El módulo quedó registrado en [`AppRouter.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/router/AppRouter.tsx:1), [`navigation.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/config/navigation.ts:1) y [`access.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/auth/config/access.ts:1), usando el mismo sistema de autorización por `app_modules` / `role_module_access`.
- `Inicio` ahora también contempla aprobaciones pendientes de movilidad interna: [`get_dashboard_tasks(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260611184435_add_internal_mobility_module.sql:1680) incorpora la nueva fuente y [`TasksWidget.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/TasksWidget.tsx:1) ya decide entre aprobación de contratación y aprobación de movilidad sin duplicar widget.
- La Edge Function [`hiring-transactional-email`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/hiring-transactional-email/index.ts:1) se extendió para reconocer `request_context = internal_mobility` y renderizar correos con trabajador, empresas origen/destino y flag de finiquito, sin crear una segunda function paralela.
- Validación local cerrada con `npm run build` y `git diff --check`.
- Validación específica de Edge Function intentada pero no cerrada localmente: `deno` no está instalado en este entorno y `npx supabase functions serve` quedó bloqueado por Docker no disponible, por lo que el código de la function quedó compilando por consistencia TypeScript del repo pero sin smoke test local de runtime Supabase.

## Resultado de ajuste urgente de visibilidad y cerrados en folios de contratación

- Se creó la migración [`20260611_103000_scope_recruitment_process_visibility_and_closed_requests.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260611_103000_scope_recruitment_process_visibility_and_closed_requests.sql:1), que redefine la visibilidad de resumen sobre `hiring_requests`: acceso total para `reclutamiento`, `control_contratos`, `director_eje`, `gerente_general` y `director_op`; acceso por centro de costo aprobado para `gerencia`; acceso solo a solicitudes propias para el resto.
- La misma migración corrige el hueco funcional de `Rechazados / Cerrados`: ahora `get_recruitment_control_dashboard_v2()` incorpora también folios `rejected/closed` que nunca alcanzaron a abrir un `recruitment_case`, evitando que desaparezcan de la pestaña de cerrados.
- [`HiringProcessesView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringProcessesView.tsx:1) quedó preparado para expandir tanto casos operativos reales como filas de solicitud cerrada sin caso, mostrando resumen contractual y trazabilidad de la decisión en ambos escenarios.
- [`ActiveFoliosWidget.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/ActiveFoliosWidget.tsx:1) y [`dashboard.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/styles/dashboard.css:523) absorbieron una mejora puntual de la auditoría: se retiraron estilos inline repetidos del widget y se movieron a clases reutilizables con ajuste responsivo.
- La auditoría adjunta se consideró parcialmente vigente: el hallazgo sobre inline styles sí seguía aplicando en `ActiveFoliosWidget`, pero la parte sobre `DashboardInfoCards.tsx` quedó desfasada frente al estado actual del repo.
- Validación local cerrada con `git diff --check` y `npm run build` exitosos.

## Plantilla XLS de migración para reclutamiento en producción

- [x] Auditar el contrato real de datos de reclutamiento para definir una plantilla de migración alineada al esquema vivo
- [x] Diseñar una plantilla Excel reutilizable que preserve fecha original de solicitud y cubra folios, casos, candidatos, ficha laboral y estado documental
- [x] Generar el archivo en repo, validarlo técnicamente y dejar instrucciones claras de llenado para la futura carga masiva

## Resultado de plantilla XLS de migración para reclutamiento en producción

- Se creó el generador reutilizable [`scripts/generate-recruitment-migration-template.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/generate-recruitment-migration-template.mjs:1), que arma la plantilla de migración directamente desde el contrato vivo del módulo y reutiliza la misma base de headers BUK ya ocupada por la nómina de `Personal a Contratar`.
- El entregable quedó publicado originalmente como `plantilla_migracion_reclutamiento.xls` y `plantilla_migracion_reclutamiento.xlsx`; ambos binarios fueron retirados después en favor de [`docs/templates/plantilla_migracion_reclutamiento.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/docs/templates/plantilla_migracion_reclutamiento.md:1).
- La plantilla trae diez hojas: `Instrucciones`, `Diccionario`, `Folios`, `Casos`, `Candidatos`, `Ficha_BUK`, `Documentos`, `Matriz_Documental`, `Catalogos_Migracion` y `Listas_BUK`.
- `fecha_solicitud_original` quedó explícitamente como columna obligatoria en `Folios`, para que la futura carga pueda respetar la fecha original de solicitud como pidió negocio.
- `Ficha_BUK` replica la estructura real de RRHH/BUK ya usada por la app y `Documentos` migra estado y referencia documental, dejando claro en instrucciones que los archivos binarios no viajan dentro del Excel.
- La validación técnica cerró con lectura efectiva del workbook generado y `npm run build` exitoso.

## ORION read-only global access + reparación del exportador XLS

- [x] Reproducir y corregir el problema funcional real del exportador XLS de `Personal a Contratar`
- [x] Aterrizar `implementation_plan.md` al contrato actual de ORION, Edge Functions y RLS del repo
- [x] Implementar herramienta read-only global para ORION con esquema controlado, allowlist de tablas/columnas y sin capacidad de mutación
- [x] Crear o ajustar las migraciones SQL necesarias en repo y, si la terminal lo permite, aplicarlas directamente en Supabase
- [x] Validar `npm run build`, registrar resultados en `todo.md` y actualizar `lessons.md`

## Resultado de ORION read-only global access + reparación del exportador XLS

- El exportador XLS de `Personal a Contratar` quedó corregido en [`src/modules/recruitment/lib/bukEmployeeNomina.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/lib/bukEmployeeNomina.ts:236): ahora usa carga dinámica segura de `xlsx` (`utils` + `writeFile`) en el mismo patrón que ya funcionaba en otros módulos y mantiene exportación real en formato `.xls` (`bookType: biff8`).
- La vista [`HiringPersonnelToHireView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringPersonnelToHireView.tsx:1) ya ejecuta la exportación como operación asíncrona controlada, con mensaje operativo de éxito o error y sin depender del panel lateral activo.
- Se aterrizó el plan [`implementation_plan.md`](/Users/maximilianocontrerasrey/Downloads/implementation_plan.md:1) sobre la arquitectura real de ORION agregando un mapa de tablas legibles y una herramienta universal read-only dentro de la Edge Function.
- Se creó [`supabase/functions/orion-chat/erpSchema.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/orion-chat/erpSchema.ts:1), que centraliza el contrato de lectura permitido para ORION: tablas, columnas visibles, columnas de búsqueda, columnas exact-match, orden por defecto y límites máximos.
- [`supabase/functions/orion-chat/index.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/orion-chat/index.ts:1) ahora incorpora `orion_database_search`, una herramienta universal de solo lectura que opera exclusivamente sobre la allowlist declarada, reutiliza el cliente autenticado del usuario y por tanto sigue respetando RLS.
- No fue necesario crear una migración SQL nueva para esta etapa, porque la lectura universal se resolvió en la Edge Function sobre PostgREST autenticado y tablas ya existentes. El cambio estructural real vive en código, no en esquema.
- La validación local cerró con `npm run build` exitoso y smoke test de escritura XLS vía `xlsx` generando archivo `.xls` válido en directorio temporal.
- El despliegue directo de `orion-chat` a Supabase no se pudo ejecutar desde este entorno porque la política del agente bloqueó el deploy productivo al detectar que la function conserva integración configurable con proveedor LLM externo (`ORION_LLM_*`). El repo quedó listo para que ese deploy lo ejecutes tú desde tu terminal autenticada.

## ORION: restauración de respuesta final con LLM tras tool-calling

- [x] Auditar la regresión real observada en producción después del deploy de `orion_database_search`
- [x] Corregir el cierre del ciclo de tool-calling para que ORION no deje respuestas vacías cuando el LLM consume herramientas y no entrega contenido final en el primer loop
- [x] Validar `npm run build` y dejar el fix listo para deploy manual desde terminal autenticada

## Resultado de ORION: restauración de respuesta final con LLM tras tool-calling

- La regresión no era un fallo del frontend ni del stream. La Edge Function [`orion-chat`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/orion-chat/index.ts:1) podía quedar atrapada en un ciclo de `tool_calls` y salir del loop sin `content` final del modelo, dejando una respuesta vacía para consultas como folios de contratación.
- Se encapsuló la llamada a Groq en `requestGroqChatCompletion(...)`, se amplió el timeout operativo a `20s` y se subió `MAX_ITERATIONS` a `4`.
- El cambio clave es estructural: si después de ejecutar herramientas ORION todavía no tiene respuesta textual, ahora fuerza una llamada final al modelo con `tool_choice: "none"` y una instrucción explícita de cerrar el análisis usando únicamente los datos ya obtenidos.
- Con esto se preserva la arquitectura prevista de ORION enlazada al LLM; no se reemplazó por un parche local ni por un modo determinístico alternativo.
- La validación local cerró con `npm run build`. El deploy desde este entorno volvió a quedar bloqueado por política externa del conector hacia Groq, por lo que el único paso restante es re-publicar `orion-chat` desde tu terminal autenticada.

## Revisión estructural de ORION y limpieza de arquitectura

- [x] Auditar el estado actual de ORION en frontend, Edge Functions y migraciones para detectar drift respecto al contrato operativo vigente
- [x] Endurecer permisos y migraciones de ORION para que queden idempotentes, coherentes con acceso `admin` y sin exposición innecesaria
- [x] Encapsular la lógica de base de conocimiento de ORION, corregir inconsistencias reales y eliminar código/artefactos sobrantes
- [x] Validar `npm run build`, revisar el resultado y documentar los cambios en `todo.md` y `lessons.md`

## Resultado de revisión estructural de ORION y limpieza de arquitectura

- Se detectó drift entre el contrato original seguro de ORION y la capa actual: el repo ya tenía Groq, RAG y function calling montados, pero las migraciones locales nuevas todavía no estaban aplicadas en Supabase remoto y nacían con permisos demasiado amplios e idempotencia débil.
- Se corrigieron directamente las migraciones aún no aplicadas [`20260610_000000_orion_knowledge_base_rag.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260610_000000_orion_knowledge_base_rag.sql:1), [`20260610_000001_setup_orion_knowledge_bucket.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260610_000001_setup_orion_knowledge_bucket.sql:1) y [`20260610_000002_orion_function_calling_rpcs.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260610_000002_orion_function_calling_rpcs.sql:1) para dejarlas idempotentes, con `search_path` fijo, grants explícitos y acceso alineado al módulo `ai_assistant` / `admin`.
- La base de conocimiento de ORION quedó encapsulada en [`src/modules/ai_assistant/services/orionKnowledge.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/ai_assistant/services/orionKnowledge.ts:1), reduciendo lógica duplicada dentro del componente y corrigiendo el bug real de borrado por usar nombre visible en vez de `storagePath`.
- [`src/modules/ai_assistant/components/AIKnowledgePanel.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/ai_assistant/components/AIKnowledgePanel.tsx:1) ahora lista, sube, procesa y elimina documentos a través de un servicio único con contrato estable entre Storage y `orion_knowledge_base`.
- Se eliminó código muerto en [`src/modules/ai_assistant/services/orion.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/ai_assistant/services/orion.ts:1) y se borró el artefacto residual [`supabase/functions/orion-chat/index.ts.backup`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/orion-chat/index.ts.backup:1), además de ignorar `supabase/.temp/`.
- La exportación XLS de `Personal a Contratar` ya no mete `xlsx` en el import estático general: [`src/modules/recruitment/lib/bukEmployeeNomina.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/lib/bukEmployeeNomina.ts:1) ahora carga `xlsx` bajo demanda, y [`src/modules/recruitment/components/HiringPersonnelToHireView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringPersonnelToHireView.tsx:1) quedó con manejo de error/finalización más sólido.
- Validación cerrada con `npm run build` y `git diff --check`.

## Personal a Contratar: exportación de nómina XLS para RRHH

- [x] Auditar la vista actual de `Personal a Contratar`, la ficha BUK del candidato y la plantilla `Empleados.xls`
- [x] Incorporar selección múltiple de candidatos listos para contratación dentro de la misma tabla
- [x] Implementar exportación de nómina usando la estructura de `Empleados.xls`, rellenando una fila por cada candidato seleccionado
- [x] Resolver carga de fichas BUK por candidato al exportar sin depender del panel lateral activo
- [x] Validar `npm run build` y documentar el resultado en `todo.md` y `lessons.md`

## Resultado de Personal a Contratar: exportación de nómina XLS para RRHH

- [`src/modules/recruitment/components/HiringPersonnelToHireView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringPersonnelToHireView.tsx:1) ahora permite selección múltiple dentro de la misma tabla, con checkbox por fila, selección masiva del filtro visible y contador de seleccionados para exportación.
- La exportación no depende del panel lateral ni del `selectedCaseDetail` activo. Cada candidato seleccionado carga su propia ficha mediante `fetchCandidateBukProfile(...)` al momento de exportar.
- Se agregó [`src/modules/recruitment/lib/bukEmployeeNomina.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/lib/bukEmployeeNomina.ts:1), que reconstruye la plantilla `Empleados.xls` en dos hojas (`Empleados` y `Listas`) usando los headers y catálogos ya normalizados en `bukEmployeeTemplateData.json`.
- La hoja `Empleados` se rellena con una fila por candidato seleccionado, mapeando datos personales y `worker_file` de la ficha BUK al formato de carga masiva que usará RRHH.
- El archivo descargado se genera como `.xls` (`bookType: biff8`) para mantener compatibilidad con la lógica de la plantilla entregada por negocio.
- Si alguna ficha BUK no se puede cargar completa, la nómina igual se exporta con fallback desde el row operativo disponible y la UI informa cuántas filas quedaron parciales.
- La validación técnica cerró con `npm run build`.

## Orion: reducción de contexto sensible y revalidación de proveedor externo

- [x] Auditar la implementación actual de `orion-chat` y del cliente ORION para identificar el punto exacto de salida de contexto sensible
- [x] Endurecer la Edge Function con redacción server-side, ventana de contexto reducida y payload mínimo hacia el proveedor externo
- [x] Adaptar el cliente ORION para tolerar respuesta JSON segura además de SSE, evitando depender de streaming largo
- [x] Validar `npm run build`, intentar despliegue productivo y comprobar si la política del entorno acepta el nuevo contrato
- [x] Documentar en `todo.md` y `lessons.md` qué quedó resuelto y qué bloqueo externo persiste, si aplica

## Resultado de Orion: reducción de contexto sensible y revalidación de proveedor externo

- La ruta Groq seguía bloqueada por política del entorno incluso después de sanitizar el payload, por lo que la autorización explícita del usuario no bastó para permitir un deploy productivo que enviara contexto del ERP a un tercero.
- Para no dejar ORION roto, [`supabase/functions/orion-chat/index.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/orion-chat/index.ts:1) quedó rediseñada como backend seguro local: valida JWT por `sub`, usa `service_role` para resolver la sesión, persiste conversación en Supabase y responde en JSON sin streaming largo ni llamadas a proveedores externos.
- La función ahora sanea texto sensible con redacción de correo, URL, UUID, RUT, teléfono y secuencias numéricas largas antes de cualquier tratamiento interno de contexto, además de recortar la ventana a `8` mensajes y `600` caracteres por mensaje para no arrastrar payload excesivo.
- [`src/modules/ai_assistant/services/orionChat.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/ai_assistant/services/orionChat.ts:1) quedó compatible con doble contrato: consume `application/json` seguro y conserva compatibilidad con `text/event-stream` por si en una etapa futura reaparece un proveedor aprobado.
- Se desplegó exitosamente `orion-chat` versión `5` en Supabase productivo. La validación viva cerró con smoke test autenticado real contra la función activa: `POST 200`, `content-type: application/json`, persistencia correcta en `orion_sessions` y `orion_messages`.
- Los logs de Supabase confirmaron la recuperación operativa: la versión `4` anterior terminaba en `504` a ~151s; la versión `5` respondió `200` en `3357 ms`.
- Estado funcional actual de ORION: operativo y estable en `modo seguro local`, con persistencia real y respuestas determinísticas orientadas al ERP. La integración con un LLM externo sigue pendiente de un proveedor explícitamente permitido por la política del entorno.

## Ajuste de visibilidad y gobernanza documental en Control de Contrataciones

- [x] Ampliar la visibilidad de `Resumen de procesos de contratación` a los roles ejecutivos/operativos definidos sin abrir `Control de candidatos` ni `Personal a Contratar`
- [x] Sustituir el catálogo documental legacy por la matriz vigente `Otros` vs `Conductor`, manteniendo la lógica de obligatoriedad por tipo de cargo
- [x] Incorporar una validación documental formal antes de `Listo para contratar`, con trazabilidad de aprobador de reclutamiento
- [x] Validar build, actualizar lecciones y dejar `main` listo para deploy

## Hotfix de regresión en Control de Contrataciones

- [x] Reproducir la falla real de `get_recruitment_control_dashboard_v2()` con contexto autenticado
- [x] Corregir la referencia rota a `contract_lock.recruitment_case_id` en una migración de hotfix
- [x] Aplicar la migración en Supabase, validar el RPC autenticado y compilar antes de empujar a `main`

## Ajuste fino de texto y labels en control documental

- [x] Simplificar el mensaje de bloqueo de ficha incompleta en `Control Documental`
- [x] Renombrar labels operativos de documentos en `document_types` para reflejar el vocabulario final de negocio
- [x] Aplicar migración en Supabase y validar build

## Orion: restricción temporal y arranque de Etapa 2 aterrizada

- [x] Restringir visibilidad del módulo ORION y su widget exclusivamente a `admin`
- [x] Aterrizar `implementation_plan.md` a la arquitectura real del repo y elegir la primera fase implementable sin credenciales externas
- [x] Implementar la sincronización global de estado entre widget y pantalla completa mediante `ORIONProvider`
- [x] Validar build, documentar resultado y dejar `main` listo para deploy

## Orion: Etapa 2A de persistencia real

- [x] Crear persistencia base de ORION en Supabase (`orion_sessions` y `orion_messages`) con RLS por usuario
- [x] Implementar servicio frontend para listar, crear y anexar mensajes de sesiones ORION
- [x] Reemplazar el estado efímero del `ORIONContext` por carga y escritura reales en Supabase
- [x] Aplicar migración en Supabase productivo, validar build y dejar `main` listo para deploy

## Orion: Etapa 2B backend seguro y streaming real

- [x] Diseñar el contrato seguro de ORION sobre Supabase Edge Functions y proveedor LLM compatible OpenAI
- [x] Implementar la Edge Function `orion-chat` con autenticación JWT, lectura de contexto, streaming SSE y persistencia final de respuesta
- [x] Conectar el frontend de ORION al stream real con degradación controlada si la función o el secret aún no están publicados
- [x] Aplicar en Supabase productivo el registro remoto del módulo `ai_assistant` y desplegar `orion-chat`

## Resultado parcial de Orion: Etapa 2B backend seguro y streaming real

- Quedó creada en repo la Edge Function [`supabase/functions/orion-chat/index.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/orion-chat/index.ts:1). La función valida JWT, verifica que la sesión ORION pertenezca al usuario, recupera contexto reciente desde `orion_messages`, consulta un proveedor LLM OpenAI-compatible por streaming y persiste la respuesta final en Supabase.
- El proveedor quedó configurable por secrets de Supabase: `ORION_LLM_API_KEY`, `ORION_LLM_BASE_URL` y `ORION_LLM_MODEL`. Por defecto el código apunta a Groq OpenAI-compatible (`https://api.groq.com/openai/v1`) con modelo `llama-3.1-8b-instant`.
- También quedó creada la migración [`20260609_180000_register_orion_module.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260609_180000_register_orion_module.sql:1) para formalizar `ai_assistant` en `app_modules` y dejarlo visible solo para `admin` en `role_module_access`.
- En frontend se agregó [`src/modules/ai_assistant/services/orionChat.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/ai_assistant/services/orionChat.ts:1), que consume `text/event-stream` desde la Edge Function y emite eventos `status`, `token`, `done` y `error`.
- [`src/modules/ai_assistant/context/ORIONContext.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/ai_assistant/context/ORIONContext.tsx:1) ya no simula por timers. Ahora intenta backend real, renderiza la respuesta token a token y reconcilia los mensajes persistidos contra la sesión local.
- Para no degradar el entorno actual mientras la parte remota no quede publicada, ORION entra en `modo contingencia` si la Edge Function no existe todavía o si falta el secret del modelo; así el módulo no queda roto.
- La validación local cerró con `npm run build` y `git diff --check`.
- Cierre remoto completado el 9 de junio: la migración `register_orion_module` quedó aplicada en Supabase productivo y la Edge Function `orion-chat` quedó desplegada en estado `ACTIVE` con `verify_jwt = true`.

## Resultado de Orion: Etapa 2A de persistencia real

- Se agregó la migración [`20260609_130000_add_orion_session_persistence.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260609_130000_add_orion_session_persistence.sql:1), que crea `public.orion_sessions` y `public.orion_messages`, con índices, grants mínimos y RLS estricta por `created_by = auth.uid()`.
- La migración ya quedó aplicada en Supabase productivo como `add_orion_session_persistence`, por lo que la persistencia no depende de deploy posterior de base.
- Se creó [`src/modules/ai_assistant/services/orion.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/ai_assistant/services/orion.ts:1) para centralizar el acceso a Supabase: bootstrap de sesión inicial, listado de conversaciones, creación de sesión y append de mensajes.
- [`src/modules/ai_assistant/context/ORIONContext.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/ai_assistant/context/ORIONContext.tsx:1) ya no trabaja solo con mocks en memoria. Ahora hidrata sesiones reales del usuario autenticado y persiste tanto el mensaje del usuario como la respuesta simulada de ORION.
- El efecto práctico de esta pasada es que el widget y la pantalla completa ya comparten una conversación persistente entre recargas de la app, que era la base necesaria antes de conectar Edge Function, streaming o backend LLM seguro.
- La validación técnica cerró con `npm run build`, `git diff --check` y verificación remota de migraciones en Supabase.

## Resultado de Orion: restricción temporal y arranque de Etapa 2 aterrizada

- ORION quedó oculto para cualquier cuenta no `admin`. El link superior ya no aparece salvo para `isSuperAdmin`, el widget global ya no se monta salvo para `admin`, y la ruta [`/copiloto-ia`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/router/AppRouter.tsx:87) ahora está protegida por `AdminProtectedRoute`.
- No fue necesario tocar `role_module_access` porque `ai_assistant` ni siquiera está registrado hoy en `public.app_modules`; el problema real era de frontend: el acceso estaba hardcodeado fuera del sistema normal de módulos.
- El `implementation_plan.md` se aterrizó al estado real del repo. La primera fase elegida fue la única que agrega valor inmediato sin depender de secretos, Edge Functions ni Groq: sincronizar estado entre widget y pantalla completa.
- Para eso se creó [`src/modules/ai_assistant/context/ORIONContext.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/ai_assistant/context/ORIONContext.tsx:1) y se integró en [`src/main.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/main.tsx:1).
- `AIChatWindow`, `ORIONWidget` y `AIChatHistory` ya no operan con estados mock separados. Ahora comparten sesión activa, mensajes, pasos de procesamiento, apertura del widget y creación/cambio de conversaciones.
- El efecto práctico de esta primera implementación es que una conversación iniciada en el widget continúa exactamente igual en la pantalla completa, que era la deuda estructural principal de la Etapa 1 frente al plan.
- La validación técnica cerró con `npm run build` y `git diff --check`.

## Resultado de ajuste fino de texto y labels en control documental

- El warning de ficha incompleta en [`CandidateDocumentChecklist.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateDocumentChecklist.tsx:243) quedó resumido a un único mensaje operativo: `Es necesario completar la ficha del candidato y cargar la documentación`.
- Se eliminó el detalle largo de campos faltantes en esa vista, sin tocar la lógica que sigue bloqueando la aprobación final mientras la ficha o el checklist no estén completos.
- Se agregó la migración [`20260609_141500_rename_candidate_document_labels.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260609_141500_rename_candidate_document_labels.sql:1) y ya fue aplicada en Supabase productivo.
- Los labels actualizados en base quedaron así: `Certificado de Antecedentes`, `Cédula de identidad`, `Certificado de estudios` y `Licencia de conducir`.
- La validación técnica cerró con `npm run build` y `git diff --check`.

## Ajuste de vencimiento y nuevo documento en control documental

- [x] Auditar la fuente canónica del checklist para aplicar la regla desde `document_types`
- [x] Restringir `requires_expiry_date` solo a los documentos definidos por negocio y agregar `Psicosensotecnico`
- [x] Alinear la plantilla de migración de reclutamiento y documentar el cierre

## Resultado de ajuste de vencimiento y nuevo documento en control documental

- Se agregó la migración [`20260612224500_update_candidate_document_expiry_rules.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260612224500_update_candidate_document_expiry_rules.sql:1), que endurece la regla de vencimiento en la fuente canónica `public.document_types`.
- Desde esta migración, `requires_expiry_date` queda en `true` únicamente para `Cédula de identidad`, `Licencia de conducir`, `Examen Preocupacional` y `Psicosensotecnico`; todos los demás documentos activos del checklist quedan sin exigencia de vencimiento.
- El nuevo documento `Psicosensotecnico` se agrega como documento activo y crítico para `Conductor`, con vencimiento obligatorio, manteniendo el contrato diferencial `Conductor` vs `Otros` del catálogo documental.
- También se actualizó [`scripts/generate-recruitment-migration-template.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/generate-recruitment-migration-template.mjs:80) para que la plantilla operativa de migración ya incluya `Psicosensotecnico` y no derive un catálogo distinto al de base.

## Resultado parcial del hotfix de regresión en Control de Contrataciones

- La regresión no estaba en React ni en permisos. La RPC `public.get_recruitment_control_dashboard_v2()` estaba fallando en runtime con `ERROR: column contract_lock.case_id does not exist`.
- El quiebre fue introducido en la migración [`20260609_121500_expand_hiring_summary_and_document_validation.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260609_121500_expand_hiring_summary_and_document_validation.sql:1417), donde se renombró por error la salida del helper `find_active_candidate_contract_lock(...)`.
- Ya quedó preparado el hotfix productivo en [`20260609_131500_fix_recruitment_dashboard_contract_lock_column.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260609_131500_fix_recruitment_dashboard_contract_lock_column.sql:1), restaurando el contrato correcto `contract_lock.recruitment_case_id`.
- El hotfix ya quedó aplicado en Supabase productivo como `fix_recruitment_dashboard_contract_lock_column`.
- La verificación autenticada volvió a responder datos reales: para `admin` y para `reclutamiento`, la RPC entrega `active_cases_count = 4`, `candidate_control_count = 6` y `personnel_to_hire_count = 0`, sin error SQL.
- La validación local cerró con `npm run build` y `git diff --check`.

## Resultado de ajuste de visibilidad y gobernanza documental en Control de Contrataciones

- La visibilidad quedó separada por contrato de negocio y no por “vista completa”. La nueva helper backend `user_can_view_recruitment_process_summary(...)` abre únicamente `Resumen de procesos de contratación` para `director_eje`, `gerente_general`, `director_op`, `gerencia`, `operaciones_l_1`, `administrativo`, `control_contratos`, además de `reclutamiento` y `admin`.
- `Control de candidatos` y `Personal a Contratar` se mantuvieron exclusivos para `reclutamiento` porque la capacidad `candidate_control_access` no se amplió. La verificación directa en Supabase confirmó que esa capability sigue asignada solo a ese rol.
- El catálogo documental dejó de ser genérico: `document_types` ahora distingue aplicabilidad y obligatoriedad por `Otros` vs `Conductor`, y el checklist filtra automáticamente según el cargo del caso.
- Se agregó una aprobación documental formal previa a `ready_for_hire`. La base registra `document_validation_status`, aprobador, fecha y comentario; además, cualquier cambio posterior en documentos, ficha personal o ficha contractual resetea esa aprobación para no dejar una validación obsoleta.
- La UI ahora expone esta instancia en `Control Documental`, muestra el estado de revisión previa y bloquea visualmente el salto a `Listo para contratar` hasta que la validación final exista.
- La migración quedó aplicada en Supabase productivo como `expand_hiring_summary_and_document_validation`, y la validación técnica cerró con `npm run build` y consultas directas sobre módulos, capabilities y catálogo documental.

## Corrección de regresión por timeout en detección de ubicación del clima

- [x] Revisar el historial reciente del widget para identificar qué cambio volvió a dejarlo colgado en `Detectando ubicación`
- [x] Corregir la regresión con timeouts propios de la app en vez de depender solo del timeout nativo del navegador
- [x] Validar build y documentar la causa raíz

## Resultado de corrección de regresión por timeout en detección de ubicación del clima

- La regresión sí fue introducida por un cambio reciente del widget. En [`e63588c`](https://github.com/maxcontrerasrey-spec/app_test_1/commit/e63588c) se endureció la resolución de ubicación, pero también se alargaron los intentos de geolocalización a `20s` y `30s`, manteniendo dependencia del timeout interno de `navigator.geolocation.getCurrentPosition(...)`.
- Ese contrato no es confiable en Safari ni en algunos navegadores móviles: si el engine no resuelve o no corta a tiempo, el componente queda demasiado rato en `Resolviendo ubicación...` e incluso puede parecer bloqueado.
- [`src/modules/dashboard/components/DashboardInfoCards.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardInfoCards.tsx:338) ahora envuelve la geolocalización con un hard-timeout propio de frontend, por lo que el flujo deja de depender ciegamente del navegador para salir del estado pendiente.
- También se reordenó la estrategia: primero intenta una lectura rápida no precisa, luego una precisa y recién después una lectura relajada; cada etapa tiene corte local verificable (`8s`, `12s`, `14s`) para no congelar la tarjeta.
- La validación técnica cerró con `npm run build` y el cambio quedó acotado al widget, sin tocar otros módulos del Inicio.

## Corrección estructural del widget de clima para ubicación real

- [x] Auditar el flujo actual del widget y confirmar por qué seguía degradando a Santiago o quedando sin ciudad válida
- [x] Reescribir la degradación de ubicación para eliminar el fallback fijo engañoso y endurecer la resolución de ciudad
- [x] Validar build, registrar resultado y capturar la lección nueva

## Resultado de corrección estructural del widget de clima para ubicación real

- La regresión ya no estaba en `getCurrentPosition(...)` solamente. El mayor problema era de contrato: el widget seguía considerando a `Santiago, CL` como fallback “válido”, por lo que cualquier timeout o error menor terminaba mostrando una ubicación falsa como si fuera real.
- [`src/modules/dashboard/components/DashboardInfoCards.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardInfoCards.tsx:36) dejó de usar coordenadas fijas para fallback. Ahora el estado degradado es realmente `Ubicación no disponible`, sin latitud/longitud inventadas; si no hay geolocalización real, el clima no se calcula con una ciudad falsa.
- La resolución de nombre de ciudad quedó endurecida con dos proveedores secuenciales de reverse geocoding. Primero intenta `BigDataCloud` y, si no entrega ciudad usable, reintenta con `Nominatim` antes de caer al label por coordenadas.
- La aproximación por red mediante `ipwho.is` ahora queda marcada correctamente como fallback (`isFallback = true`) y visible como `Aproximada por red (...)`, en vez de mezclarse con ubicación exacta.
- También se amplió la tolerancia del navegador: el intento preciso subió a `20s` y el intento relajado a `30s`, con caché más amplia, para evitar degradaciones prematuras en Safari y navegadores más lentos con permisos.
- En UI, cuando la ubicación siga aproximada o no resuelta, el card expone `Reintentar ubicación exacta` para disparar un nuevo intento explícito sin refrescar toda la app.
- La validación técnica cerró con `npm run build` y `git diff --check`.

## Corrección integral de clima, cierre de folios y warning BUK por RUT

- [x] Confirmar la causa raíz de la geolocalización degradada y endurecer el widget para que no caiga prematuramente a Santiago
- [x] Mantener visibles los candidatos descartados de folios cerrados dentro de `Control de candidatos`
- [x] Corregir el cierre del resumen/pipeline de candidato para que no se reabra solo y cierre al hacer click afuera
- [x] Reemplazar la verificación frágil contra Edge Function por una validación backend contra la sync BUK, incluyendo fecha de salida cuando exista
- [x] Validar build, documentar resultados en `todo` y capturar lección nueva en `lessons`

## Resultado de corrección integral de clima, cierre de folios y warning BUK por RUT

- La persistencia del panel de candidato no estaba en `HiringCandidatesView`, sino en la auto-selección del primer candidato desde [`src/modules/recruitment/pages/HiringStatusPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringStatusPage.tsx:113). Esa lógica fue recortada para que un cierre manual no vuelva a abrir solo el pipeline.
- Además del ajuste anterior, [`src/modules/recruitment/components/HiringCandidatesView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringCandidatesView.tsx:65) ahora cierra el resumen al hacer click fuera del layout completo, no solo sobre un hueco exacto del grid.
- Los candidatos descartados de folios cerrados desaparecían por backend: `get_recruitment_control_dashboard_v2()` filtraba `rc.status not in ('filled', 'closed_unfilled', 'cancelled')` y por eso expulsaba también descartados históricos. La migración [`20260608_235500_fix_candidate_visibility_and_buk_rut_lookup.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_235500_fix_candidate_visibility_and_buk_rut_lookup.sql:1) mantiene visibles en `candidate_control` los candidatos `rejected/withdrawn` de casos `cancelled` cuyo folio quedó `closed`.
- El warning por RUT en BUK dejó de depender de una Edge Function opaca al repo. Ahora el frontend usa la RPC `find_buk_employee_status_by_rut(...)`, soportada por la sync local `public.employees`, con salida de estado, nombre y fecha de salida cuando la data existe en `raw_payload`.
- La verificación de BUK quedó respaldada con datos reales de producción: la sync contiene `1586` activos y `3607` inactivos, y hay registros inactivos con fechas derivables desde `active_until` / `current_job.end_date`, lo que habilita mostrar salida histórica en la advertencia.
- En clima, la regresión venía de aceptar lecturas de navegador demasiado permisivas o antiguas y degradar rápido a fallback. [`src/modules/dashboard/components/DashboardInfoCards.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardInfoCards.tsx:315) volvió a un flujo secuencial verificable: intento preciso sin caché, luego intento tolerante, y solo después fallback.
- La migración fue aplicada directamente en Supabase productivo con nombre `fix_candidate_visibility_and_buk_rut_lookup`.
- La validación técnica cerró con `npm run build`, arranque local de Vite en `127.0.0.1:5173` y respuesta `HTTP/1.1 200 OK` del servidor local.

## Corrección definitiva de ciclo de geolocalización del widget de clima

- [x] Aislar por qué el widget seguía colgándose en `Resolviendo ubicación...` o degradando a Santiago bajo `gestion.busesjm.cl`
- [x] Reescribir el ciclo del widget para evitar auto-reintentos provocados por el mismo `statusLabel`
- [x] Validar build y dejar la corrección documentada

## Resultado de corrección definitiva de ciclo de geolocalización del widget de clima

- La nueva causa raíz no era Cloudflare ni reverse geocoding. El propio `useEffect` del widget dependía de `location.statusLabel`, `location.isResolved` y `location.isFallback`, pero dentro del mismo flujo hacía `setLocation(... statusLabel: "Resolviendo ubicación...")`. Eso disparaba otra vez el efecto y abría ciclos de geolocalización solapados.
- El widget quedó reestructurado en [`src/modules/dashboard/components/DashboardInfoCards.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardInfoCards.tsx:328): ahora inicializa desde caché si existe, mantiene refs para evitar requests concurrentes, consulta permisos cuando el navegador lo soporta y ejecuta un solo ciclo de resolución por intento.
- También se endureció la degradación: primero intenta alta precisión sin caché, luego un intento tolerante, y solo después usa fallback por red o el fallback fijo. Si ya existe última ubicación válida, la conserva como respaldo en vez de reiniciar el estado de forma agresiva.
- Se verificó además que el origen `https://gestion.busesjm.cl` no está enviando `Permissions-Policy` que bloquee geolocalización; por lo tanto el problema corregido era interno del widget.
- La validación cerró con `npm run build`.

## Corrección de pantallas en blanco al cambiar de módulo

- [x] Revisar router, guards y estrategia de carga de páginas para aislar por qué la app quedaba completamente en blanco
- [x] Implementar una defensa estructural para fallos de `lazy import` y excepciones de render de módulos
- [x] Validar build y dejar la corrección lista para deploy

## Resultado de corrección de pantallas en blanco al cambiar de módulo

- El problema más probable no estaba en `ProtectedRoute` ni en `RoleProtectedRoute`: ambos muestran loading o redirect, pero no devuelven una pantalla vacía. El punto débil estaba en el router con `React.lazy(...)` puro y sin `ErrorBoundary` global.
- Cuando un módulo lazy falla al cargar en producción, por ejemplo por `chunk` desactualizado después de un deploy o por excepción al montar una vista, React derriba el árbol si no existe un boundary de recuperación. Eso explica el síntoma de “todo en blanco hasta refrescar”.
- Se agregó el helper [`src/shared/lib/lazyWithRetry.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/lib/lazyWithRetry.ts:1), que detecta errores típicos de chunks dinámicos y fuerza una sola recarga controlada antes de propagar el error.
- Se incorporó además [`src/shared/ui/AppErrorBoundary.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/AppErrorBoundary.tsx:1) como boundary global en [`src/main.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/main.tsx:1), con acciones explícitas de `Recargar app` e `Ir al inicio` en vez de dejar la SPA muerta.
- Finalmente, [`src/app/router/AppRouter.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/router/AppRouter.tsx:1) dejó de usar `lazy(...)` directo y ahora carga todas las páginas de ruta mediante `lazyWithRetry(...)`.
- La validación cerró con `npm run build`.

## Limpieza profunda de repo y compactación de arquitectura base

- [x] Auditar archivos sueltos, hotspots del repo y referencias rígidas al dominio antiguo
- [x] Eliminar scripts/test ad-hoc sin valor productivo en la raíz del proyecto
- [x] Compactar contratos repetidos de runtime y caché en módulos operativos activos
- [x] Validar build, documentar limpieza y dejar `main` listo para deploy

## Resultado de limpieza profunda de repo y compactación de arquitectura base

- Se limpió la raíz del repo eliminando la batería de archivos ad-hoc de prueba/debug que no pertenecían a la arquitectura del ERP. Salieron `check_maria.mjs`, `run_test.mjs`, `test_0008.*`, `test_approvers.mjs`, `test_dashboard_rpc.mjs`, `test_fetch_rpc.mjs`, `test_function_def.mjs`, `test_get_dashboard_tasks*`, `test_get_detail.mjs`, `test_maria_rpc.mjs`, `test_profiles.mjs`, `test_rls.mjs`, `test_tasks_rpc*` y también el archivo trackeado [`test_db.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/test_db.mjs:1), que era un stub incompleto sin uso real.
- Se centralizó la resolución de la URL pública de la app en [`src/shared/config/runtime.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/config/runtime.ts:1), eliminando lógica dispersa de host en auth. `AuthContext` ahora construye redirects como `/reset-password` desde una única fuente y el ejemplo de entorno ya apunta al subdominio real [`gestion.busesjm.cl`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/.env.example:4).
- Se compactó la invalidación de caché en módulos operativos activos: reclutamiento ahora reutiliza `invalidateRecruitmentControlQueries(...)` desde [`src/modules/recruitment/hooks/useRecruitmentQueries.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/hooks/useRecruitmentQueries.ts:86) e incentivos reutiliza `invalidateHrIncentiveQueries(...)` desde [`src/modules/incentives/hooks/useIncentivesQueries.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/hooks/useIncentivesQueries.ts:104). Con esto se eliminó duplicación entre vistas, mutaciones y realtime invalidation.
- También quedó normalizada la raíz de query keys para incentivos en [`src/shared/lib/queryKeys.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/lib/queryKeys.ts:10), evitando arrays literales repetidos como `['incentives', 'requests']` en varios componentes.
- La limpieza cerró con `npm run build` y `git diff --check`.

## Reparación del dashboard de Control de Contrataciones tras regresión SQL

- [x] Revisar `tasks/lessons.md`, migraciones recientes y logs productivos para aislar la causa raíz de los errores en `folios` y `control de candidatos`
- [x] Restaurar el contrato real de `get_recruitment_control_dashboard_v2()` y eliminar referencias a columnas inexistentes
- [x] Corregir el orden local de migraciones para evitar replay roto en entornos nuevos
- [x] Aplicar la corrección en Supabase productivo, validar el RPC autenticado y compilar frontend

## Resultado de reparación del dashboard de Control de Contrataciones tras regresión SQL

- La causa raíz no estaba en React sino en SQL: `public.get_recruitment_control_dashboard_v2()` había quedado con dos regresiones simultáneas. Primero, referenciaba `rcc.is_contracted`, columna que no existe en `public.recruitment_case_candidates`. Segundo, al “normalizar” claves a snake_case se redujo el payload y se rompió el contrato que consumen `Control de candidatos`, `Personal a Contratar` y `Resumen de procesos de contratación`.
- En repo quedó restaurada la versión final del RPC en [`supabase/migrations/20260608_181000_fix_dashboard_snake_case_keys.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_181000_fix_dashboard_snake_case_keys.sql:1), manteniendo claves snake_case pero devolviendo nuevamente todos los campos que espera el frontend (`recruitment_case_id`, `folio`, `contract_name`, `owner_name`, conteos, locks contractuales, etc.).
- Se corrigió además una deriva de historial local: había dos archivos con timestamp `20260608_180000`. El de dashboard quedó renombrado a [`supabase/migrations/20260608_180100_fix_dashboard_closed_cases.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_180100_fix_dashboard_closed_cases.sql:1) y convertido en no-op controlado para no reintroducir un estado intermedio inválido.
- Para reparar el estado vivo sin depender del replay completo de migraciones locales, se agregó además [`supabase/migrations/20260608_191500_repair_recruitment_control_dashboard_payload.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_191500_repair_recruitment_control_dashboard_payload.sql:1) y se aplicó en Supabase productivo mediante el conector.
- La verificación remota autenticada volvió a responder correctamente el tablero: `pending_approvals_count = 1`, `active_cases_count = 3`, `candidate_control_count = 5`, `personnel_to_hire_count = 0`, sin error SQL.
- La validación local cerró con `npm run build` y `git diff --check`.

## Corrección de advisors Supabase sobre reclutamiento y permisos

- [x] Fijar `search_path` mutable y limpiar grants expuestos solo en helpers internos no usados por frontend
- [x] Reescribir policies RLS activas de reclutamiento/solicitudes/documentos para usar `(select auth.uid())` y eliminar duplicidad de `hiring_request_approvals`
- [x] Eliminar duplicados seguros de índices/constraints detectados por advisors sin tocar piezas inciertas de producción
- [ ] Aplicar migración en Supabase, reconsultar advisors, validar `build` y documentar resultado

## Resultado parcial de corrección de advisors Supabase sobre reclutamiento y permisos

- Quedó creada en repo la migración [`supabase/migrations/20260608_180000_fix_advisors_rls_and_helper_exposure.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_180000_fix_advisors_rls_and_helper_exposure.sql:1), enfocada solo en cambios seguros: `search_path`, RLS `initplan`, `drop policy` redundante, revocación de helpers no expuestos por UI y limpieza puntual de duplicados claros.
- La migración reescribe las policies activas que hoy impactan reclutamiento, solicitudes, Who, documentos y `employees` para usar `(select auth.uid())`, que es exactamente la recomendación del advisor de performance.
- También deja listo el saneamiento de duplicados remotos más evidentes: `hiring_request_approvals_select_app`, `idx_hiring_request_approvals_approver_status`, `idx_recruitment_case_candidates_profile` y la constraint legacy `recruitment_case_candidates_recruitment_case_id_candidate_p_key`.
- La validación local cerró correctamente con `npm run build` y `git diff --check`.
- La única parte pendiente no es del SQL sino del entorno: la ejecución remota vía conector Supabase fue rechazada por límite de uso del propio conector, por lo que la migración aún no quedó aplicada en la base ni fue posible reconsultar advisors post-cambio desde esta sesión.

## Corrección de bloqueo del widget de clima

- [x] Reemplazar el flujo secuencial de geolocalización por una estrategia que entregue ubicación rápida sin quedarse colgada
- [x] Evitar que el fallback a Santiago se dispare antes de agotar una lectura rápida y una refinada
- [x] Validar build y documentar la corrección

## Ajuste de aprobación Who sin hallazgos

- [x] Revisar el flujo actual `Lead -> Who` para identificar dónde nace la aprobación pendiente
- [x] Permitir que un candidato sin hallazgos avance por Who sin crear tarea pendiente de autorización
- [x] Ajustar la UI para explicar el comportamiento sin hallazgos, validar build y documentar el resultado

## Sincronización de usuarios, roles y módulos desde matriz Excel

- [x] Normalizar la matriz `usuarios_busesjm.xlsx` a códigos canónicos de rol y módulos vigentes en la app
- [x] Sincronizar roles, capacidades, módulos visibles y perfiles en Supabase preservando a Maximiliano como `admin` total
- [x] Crear en Auth las cuentas faltantes con clave inicial controlada sin alterar claves existentes
- [x] Verificar resultado real en base, compilar frontend y documentar el cierre

## Análisis de enlace contable entre contratos/cecos y BUK

- [x] Inspeccionar `bbdd-cecos.xlsx`, identificar la nueva columna `Proyecto BUK` y medir cobertura/calidad del dato
- [x] Contrastar la matriz con `public.contracts` y con los campos de proyecto/área presentes en la sync BUK
- [x] Definir el modelo de enlace recomendado entre visión contable y visión BUK, con riesgos y siguiente implementación sugerida

## Catálogo backend BUK -> contabilidad para contratación e incentivos

- [x] Persistir en repo una migración que crea el catálogo backend `buk_contract_mappings` y sincroniza contratos faltantes/actualizados desde la matriz maestra
- [x] Reamarrar `Solicitud de contrataciones` para mostrar como fuente visible el área BUK, manteniendo el `contract_id` contable como llave operativa
- [x] Reemplazar en SQL de incentivos la dependencia de áreas libres de `employees` por el catálogo backend curado y 1:1
- [ ] Aplicar la migración en Supabase productivo y verificar consultas reales

## Resultado de análisis de enlace contable entre contratos/cecos y BUK

- `bbdd-cecos.xlsx` en `Hoja2` trae `95` filas y `9` columnas. La nueva columna `Area_Buk` viene completa en `95/95` filas y no presenta ambigüedad interna: cada fila sigue siendo 1:1 entre `Proyecto`, `Descripcion Proyecto`, `Centro de Costo` y `Area_Buk`.
- Contra `public.contracts`, la cobertura es alta: `92/95` proyectos del Excel ya existen en Supabase por `contract_number` y además `92/95` descripciones contables siguen calzando exactamente con `contract_name`.
- Los `3` proyectos nuevos que todavía no están en `public.contracts` son: `SERCOING - DRT` (`7606991001:0001`), `CODELCO - DSAL` (`6170400011:0001`) y `ARAMARK - DCH` (`7611769636:0001`).
- La nueva columna no replica simplemente el nombre contable. Hay `29` filas donde `Area_Buk` difiere de `Descripcion Proyecto`; varios son renombres menores (`JM SERV ESPECIALES` -> `JM SERVICIOS ESPECIALES`, `TESORERIA` -> `TESORERIA JM`), pero otros son equivalencias de negocio reales (`INDIRECTOS ZONA II` -> `ADMINISTRACION CALAMA`, `CODELCO DMH` -> `SERVICIO CODELCO DMH`, `INTERURBANO VALPARAISO` -> `VALPARAISO`).
- En la sync viva de BUK, `employees_active_current.area_name` no viene limpio: llega como `Area BUK (Proyecto_BUK_versionado)`, por ejemplo `SERVICIO CODELCO DMH (6170400006:0004)` o `VALPARAISO (7850277002:0001)`. Por eso no conviene usar coincidencia textual directa contra el string completo.
- Si se limpia el nombre del área y se ignora el sufijo versionado del proyecto, el cruce mejora bastante: `73/95` filas del Excel encuentran correspondencia en el histórico completo `public.employees`. El cruce contra solo empleados activos sube menos porque varias áreas no tienen dotación activa hoy.
- La diferencia clave es el sufijo del `Proyecto BUK`: en BUK muchas áreas operan con el mismo prefijo del proyecto pero con versiones distintas (`:0004`, `:0005`, etc.). Eso hace que `Proyecto` contable y `Proyecto BUK` no deban tratarse como igualdad rígida de string completo.
- Conclusión operativa: el Excel ya puede actuar como tabla puente maestra entre la visión contable (`contracts`, cecos, unidades de costo) y la visión operativa BUK (`area_name`, `project code`). Pero debe persistirse explícitamente; inferir este enlace desde `employees_active_current` o desde `area_name` libre no es suficientemente estable para producción.

## Resultado parcial de catálogo backend BUK -> contabilidad

- Quedó creada en repo la migración [`supabase/migrations/20260607_230000_add_buk_contract_mapping_catalog.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260607_230000_add_buk_contract_mapping_catalog.sql:1), que introduce `public.buk_contract_mappings`, normaliza nombres de área BUK, sincroniza contratos contables faltantes y reescribe las RPCs críticas de incentivos para usar esta fuente curada.
- La migración también ajusta `submit_hiring_request(...)` para que los nuevos folios guarden como `contract_name` el nombre BUK visible, no la descripción contable interna, manteniendo intacta la llave `contract_id`.
- En frontend, [`src/modules/recruitment/services/hiringCatalogs.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringCatalogs.ts:1) ya dejó de leer `public.contracts` como fuente visible y ahora apunta al catálogo puente backend.
- La validación local cerró con `npm run build` y `git diff --check`.
- La única parte pendiente no es técnica del repo sino operativa del conector: la aplicación remota en Supabase fue rechazada por límite de uso del connector, por lo que todavía falta ejecutar la migración en la base productiva y luego verificar conteos/consultas reales antes de enviar esto a `main`.

## Resultado de sincronización de usuarios, roles y módulos desde matriz Excel

- La matriz `usuarios_busesjm.xlsx` quedó aterrizada a códigos canónicos de la app. Se incorporaron al frontend los roles `director_eje`, `director_op`, `gerente_general`, `operaciones_l_1`, `operaciones_l_2` y `administrativo` para evitar que Auth los degradara a `guest`.
- Se aplicó en Supabase la migración `sync_users_roles_modules_from_excel`, que además aseguró la existencia del catálogo mínimo de `app_modules` y `app_capabilities` antes de sincronizar accesos.
- Maximiliano Contreras Rey quedó como único `admin` total con `is_super_admin = true`. Maria Jesus Lagos dejó de heredar permisos de admin y quedó solo con `control_contratos`, tal como define la matriz.
- Se creó el script reutilizable `scripts/provision-users-from-matrix.mjs` y con él se dieron de alta `21` cuentas faltantes en Supabase Auth con contraseña inicial `Bjm2026*`, sin modificar contraseñas de las `13` cuentas ya existentes.
- Luego del alta, se reejecutó el bloque de sincronización de perfiles y `user_roles` para que las nuevas fichas heredaran su rol efectivo inmediatamente. La verificación final confirmó `34/34` usuarios presentes, `0` faltantes, y módulos/capacidades alineados con la hoja `modulos` y la parte de aprobaciones que hoy sí gobierna por rol (`Who` y acceso documental).
- La validación técnica cerró con `npm run build`, `git diff --check` y consultas directas sobre Supabase.

## Resultado de ajuste de aprobación Who sin hallazgos

- La rigidez estaba en backend: `normalize_candidate_who_causes(...)` rechazaba listas vacías y `request_candidate_stage_who(...)` siempre abría una aprobación pendiente.
- La lógica quedó alineada al negocio: si el reclutador no registra hallazgos, la validación Who se autoaprueba internamente, el candidato pasa a `who_approved` y no aparece ninguna tarea pendiente de autorización.
- Si existen hallazgos, el flujo sigue igual: se crea registro en `candidate_stage_approvals`, el candidato queda en `who_pending` y la aprobación aparece en las bandejas correspondientes.
- Para no romper la trazabilidad posterior, incluso el caso sin hallazgos deja registro estructurado: se inserta una fila Who ya aprobada, sin causas y con metadata `auto_approved = true`.
- La UI ahora lo explica en la ficha del candidato y muestra mensaje distinto según el resultado real: `Solicitud Who enviada a aprobación` o `Sin hallazgos: validación Who aprobada automáticamente`.
- La migración quedó aplicada en Supabase como `20260608004750 autoapprove_who_without_findings`.
- La validación técnica cerró con `npm run build` y `git diff --check`.

## Resultado de corrección de bloqueo del widget de clima

- El segundo problema no estaba en la API de ciudad ni en Open-Meteo, sino en la orquestación local del navegador.
- El experimento con múltiples lecturas de geolocalización terminó siendo inestable en uso real: primero dejó la tarjeta colgada y luego siguió cayendo a `Santiago, CL`.
- Se retiró esa complejidad y se volvió al contrato simple y verificable: una sola lectura real del navegador con `getCurrentPosition(...)` y reverse geocoding posterior para traducir las coordenadas reales.
- El fallback fijo vuelve a quedar reservado solo al error real del navegador (`permiso denegado`, `posición no disponible`, `timeout`), no a carreras internas del componente.
- La validación técnica cerró con `npm run build`.

## Corrección de regresión en resolución real del clima

- [x] Reproducir por código por qué el widget vuelve a `Santiago, CL` aunque el usuario esté fuera de Santiago
- [x] Endurecer el flujo de geolocalización para que no caiga prematuramente al fallback fijo cuando aún exista una lectura real recuperable
- [x] Validar build y documentar la corrección sin tocar otros widgets del Inicio

## Resultado de corrección de regresión en resolución real del clima

- La API de reverse geocoding no era la culpable: para coordenadas de Los Andes (`-32.83`, `-70.59`) devuelve correctamente `Los Andes, CL`.
- La regresión estaba en el flujo del navegador. El widget pedía una lectura de alta precisión y, si esa llamada fallaba por timeout o disponibilidad, caía directo al fallback fijo `Santiago, CL`.
- Se corrigió el flujo para degradar en dos pasos: primero intenta geolocalización de alta precisión y, si eso falla sin denegación explícita, reintenta con una lectura más tolerante (`enableHighAccuracy: false`, timeout mayor y caché más amplia) antes de declarar fallback.
- El fallback fijo a Santiago ahora queda reservado a casos reales de permiso denegado, falta de soporte o doble fallo de geolocalización, no como salida prematura de un solo intento estricto.
- La validación técnica cerró con `npm run build` y `git diff --check`.


## Corrección crítica del bundle del Inicio

- [x] Confirmar la causa real del dashboard vacío revisando RPC `get_dashboard_home_bundle(...)` y logs productivos
- [x] Corregir la función SQL defectuosa sin alterar permisos ni payloads válidos del resto del inicio
- [x] Validar el bundle autenticado, compilar frontend y dejar resultado/lección documentados

## Resultado de corrección crítica del bundle del Inicio

- El problema no era caché ni falta de datos: el RPC `public.get_dashboard_home_bundle(...)` estaba rompiendo completo el Inicio con error SQL `column b.days_until does not exist`.
- La causa raíz fue una regresión en la agregación del widget de cumpleaños. `get_dashboard_home_bundle(...)` trataba `public.get_upcoming_birthdays(...)` como si devolviera filas (`from ... b`), pero esa función devuelve `jsonb`.
- Se corrigió el bundle para consumir directamente el `jsonb` de `get_upcoming_birthdays(...)`, manteniendo intactos los demás payloads (`tasks_data`, `approval_tracking_data`, `active_folios_data`).
- La corrección quedó aplicada en producción y además registrada en el repo con la migración `20260607_081211_fix_dashboard_home_bundle_birthdays_payload.sql`.
- La validación autenticada sobre Supabase cerró con datos reales: `approval_tracking_data = 2`, `active_folios_data = 3`, `birthdays_data = 6`. En esa muestra `tasks_data = 0`, por lo que el vacío de tareas no era fallo técnico sino estado actual del flujo.
- La validación local cerró con `npm run build`.


## Segunda pasada controlada sobre RLS

- [x] Auditar warnings vigentes de security/performance advisors enfocados en funciones y políticas que afectan flujos activos de la app
- [x] Seleccionar solo correcciones RLS/grants/search_path no destructivas y con verificación directa
- [x] Aplicar una migración nueva, separada y reversible, sin mezclar limpieza de índices/constraints destructivos
- [x] Verificar con consultas remotas, advisors y build; dejar resultado y lecciones documentadas

## Resultado de segunda pasada controlada sobre RLS

- La primera propuesta amplia fue rechazada por el conector de Supabase por riesgo productivo. En vez de forzarla, la pasada se degradó a un corte seguro sobre auth/config compartido y performance de claves foráneas.
- Se aplicó en producción la migración `20260607_075617_controlled_rls_second_pass.sql`, registrada remotamente como `20260607120109 controlled_rls_second_pass`.
- La migración corrigió policies RLS compartidas de `profiles`, `user_roles`, `document_types`, `cost_center_approvers` y `workflow_approvers`, reemplazando el patrón directo `auth.uid()` por `(select auth.uid())` donde correspondía y separando policies `ALL` en policies por operación para evitar evaluación redundante.
- También creó siete índices faltantes sobre claves foráneas activas: `candidate_profiles.created_by`, `hiring_request_audit_log.approval_id`, `hiring_request_snapshots.created_by`, `hiring_requests.final_decided_by`, `role_module_access.module_code`, `user_roles.assigned_by` y `workflow_approvers.approver_user_id`.
- La verificación posterior confirmó que desaparecieron las alertas `auth_rls_initplan` para `profiles`, `user_roles`, `cost_center_approvers` y `workflow_approvers`, y también las alertas `multiple_permissive_policies` sobre `document_types` y `user_roles`.
- Los warnings de RLS más pesados ligados a reclutamiento, solicitudes y documentos siguen pendientes y no se tocaron en esta iteración para no reescribir políticas operativas masivas sobre tablas vivas.
- La validación local cerró con `git diff --check` y `npm run build`.

## Endurecimiento productivo sobre Supabase Pro

- [x] Reintroducir un RPC resumido del dashboard para reducir roundtrips del inicio a una sola llamada
- [x] Incorporar invalidación por Realtime en Inicio, Reclutamiento e Incentivos para reducir dependencia de polling y `F5`
- [x] Corregir avisos críticos/útiles del advisor de Supabase en seguridad y performance que sí impactan la app actual
- [x] Validar build, advisors y documentar el resultado operativo

## Resultado de endurecimiento productivo sobre Supabase Pro

- El inicio dejó de depender de cuatro RPCs separadas y ahora consume un bundle único desde `public.get_dashboard_home_bundle(...)`, reduciendo roundtrips del dashboard principal.
- Se agregó invalidación por Realtime en tres superficies operativas: `Inicio`, `Control de Contrataciones` e `Incentivos`. Con esto, la app deja de descansar principalmente en polling corto y gana refresco reactivo ante cambios reales en base.
- En frontend se subió el intervalo de respaldo del dashboard a `180s`; la actualización principal ahora la hace Realtime y el polling queda como fallback de resiliencia, no como motor principal.
- En Supabase productivo quedó aplicada la migración `20260606_234500_supabase_pro_hardening_dashboard_and_rls.sql`, que añadió el RPC bundle, fijó `search_path` en helpers de sindicato, cerró exposición `anon` en RPCs sensibles y creó índices faltantes sobre tablas activas del flujo.
- La verificación remota confirmó que `advance_recruitment_candidate_stage`, `reject_candidate_stage_who` y `find_candidate_profile_with_history_by_rut` ya no exponen `EXECUTE` a `anon`, y que `get_dashboard_home_bundle(...)` quedó publicado para `authenticated`.
- El `build` local cerró correctamente con `npm run build`.
- Se intentó además una pasada más agresiva sobre RLS y limpieza destructiva de duplicados, pero el conector de Supabase la rechazó por riesgo productivo. Ese recorte quedó deliberadamente fuera de esta entrega para no introducir regresiones de acceso en vivo.

## Submódulo RRHH: Incentivos operativos

- [x] Reemplazar el placeholder de `Recursos Humanos` por un módulo real con ruta interna `/recursos-humanos/incentivos`
- [x] Crear backend Supabase para incentivos: tablas de tipos, cargos elegibles, reglas de monto, solicitudes e historial
- [x] Publicar RPCs seguras para buscar trabajadores BUK elegibles, obtener contexto del trabajador y contratos alternativos, calcular monto y registrar/anular incentivos
- [x] Implementar frontend con tres superficies iniciales: listado, registro con cálculo automático y configuración base
- [x] Aplicar migración en Supabase, validar build y registrar resultado/lecciones

## Enlace BUK en Configuración base de Incentivos

- [x] Revisar por qué `Configuración base` no exponía cargos sincronizados desde BUK
- [x] Exponer en backend el catálogo real de cargos BUK activos dentro de `get_hr_incentive_setup_catalogs()`
- [x] Reemplazar inputs manuales de cargo en `Configuración base` por selectores alimentados desde BUK
- [x] Aplicar migración en Supabase, validar build y registrar resultado

## Compactación de configuración base y sindicato BUK en incentivos

- [x] Revisar por qué la tarjeta de cargos elegibles quedaba estirada y no compacta
- [x] Identificar el dato real de sindicato disponible en BUK sincronizado
- [x] Extender reglas de incentivo para considerar sindicato y exponerlo en frontend/backend
- [x] Aplicar migración, validar build y documentar resultado

## Corrección de búsqueda de trabajador en incentivos

- [x] Identificar la causa del error `column reference "job_title" is ambiguous`
- [x] Reemplazar la función RPC afectada y validar búsqueda de trabajadores elegibles

## Limpieza estructural profunda de Supabase

- [x] Auditar base productiva contra código vivo para distinguir objetos operativos de superficie legacy o sin contrato actual
- [x] Cerrar deuda estructural segura: helpers/RPCs expuestos de más, sobrecargas legacy y duplicados exactos verificables
- [x] Aplicar la limpieza en Supabase y dejar migración espejo en repo con validación posterior
- [x] Verificar consultas críticas, `build`, y documentar hallazgos/resultados en `tasks/lessons.md`

## Resultado de limpieza estructural profunda de Supabase

- La revisión se hizo contra la base productiva real y no solo contra migraciones locales. Se contrastaron tablas, funciones y grants vivos con los consumidores efectivos del código (`src/`, `scripts/`) para separar objetos con contrato actual de superficie legacy.
- Se aplicó en Supabase la migración espejo [`supabase/migrations/20260608_230500_structural_supabase_cleanup.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_230500_structural_supabase_cleanup.sql:1), con un alcance deliberadamente seguro: `unaccent` salió del esquema `public`, se eliminaron sobrecargas obsoletas de `add_hr_incentive_rate_rule(...)` y `resolve_hr_incentive_rate_rule(...)`, y se borraron duplicados exactos de índices (`idx_profiles_email`, `idx_candidate_profiles_national_id`, `idx_job_positions_name`, `idx_shifts_name`).
- También quedó aplicado y versionado [`supabase/migrations/20260608_231500_drop_unused_find_candidate_profile_by_rut.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_231500_drop_unused_find_candidate_profile_by_rut.sql:1), retirando el RPC legacy `find_candidate_profile_by_rut(text)` ya reemplazado por `find_candidate_profile_with_history_by_rut(text)`.
- La verificación remota confirmó el estado final esperado: `find_candidate_profile_by_rut` ya no existe, solo queda una sobrecarga vigente para `add_hr_incentive_rate_rule(...)`, solo una para `resolve_hr_incentive_rate_rule(...)`, y no queda ninguno de los cuatro índices duplicados exactos.
- Se auditó además el inventario real de tablas `public`. No se eliminaron tablas con `0` filas como `candidate_documents`, `candidate_worker_files` o `hr_incentive_requests`, porque sí tienen contrato funcional vigente en la app y removerlas habría roto módulos vivos aunque hoy no tengan volumen.
- Los advisors siguen marcando funciones `SECURITY DEFINER` ejecutables por `authenticated`, pero en este sistema eso no es basura residual sino el patrón operativo actual de RPCs protegidas por validación interna y RLS. Esa superficie no se tocó en esta pasada porque mezclar limpieza estructural con recontratación de permisos productivos aumenta riesgo de regresión.
- La validación técnica cerró con `npm run build`. El estado remoto de migraciones ya refleja `structural_supabase_cleanup_safe_pass` y `drop_unused_find_candidate_profile_by_rut`.

## Reparación del widget de clima tras cambio de subdominio

- [x] Confirmar si el problema venía del subdominio/headers o de una regresión en la estrategia de geolocalización
- [x] Restaurar una resolución robusta de ubicación real antes del fallback por IP/Santiago
- [x] Validar build y documentar el criterio para cambios de origen (`pages.dev` -> subdominio propio)

## Resultado de reparación del widget de clima tras cambio de subdominio

- Se descartó un bloqueo por headers del subdominio. `https://gestion.busesjm.cl` y `https://app-test-1-2ao.pages.dev` responden sobre `https` y no exponen `Permissions-Policy` que deshabilite geolocalización.
- La causa real estaba en frontend: el widget había vuelto a una versión degradada que hacía un solo `getCurrentPosition(...)` con `enableHighAccuracy: true` y, ante cualquier fallo, caía directo al fallback por IP o `Santiago, CL`.
- Eso explicaba el síntoma observado tras el cambio de dominio: al cambiar de `pages.dev` a `gestion.busesjm.cl`, el navegador trata la geolocalización como permiso por origen nuevo. Si ese primer intento preciso falla o todavía no se resuelve bien el permiso, el widget se iba demasiado rápido a ubicación aproximada.
- Se corrigió [`src/modules/dashboard/components/DashboardInfoCards.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/DashboardInfoCards.tsx:1) para lanzar dos lecturas reales del navegador en paralelo (rápida/coarse y precisa), aceptar la mejor precisión disponible, y solo usar IP/Santiago cuando ambas fallen de verdad.
- Además, la última ubicación real válida del navegador queda cacheada localmente por 12 horas. Si el permiso tarda o falla temporalmente, la tarjeta ya no salta directo a Santiago; reutiliza primero la última ubicación conocida y vuelve a intentar al enfocar la app.
- La validación técnica cerró con `npm run build`.

## Sindicato nominal BUK como variable real de montos

- [x] Verificar si el nombre específico del sindicato existe en la sync BUK
- [x] Sustituir el uso de estado sindical genérico por sindicato nominal en reglas, contexto y cálculo
- [x] Aplicar migración, validar y documentar resultado

## Resultado de sindicato nominal BUK como variable real de montos

- Se confirmó que el dato correcto para la lógica de montos no era el proxy binario de sindicalización, sino `raw_payload.current_job.union`.
- La sync activa trae `1571` trabajadores con sindicato nominal y `18` valores distintos, incluyendo casos reales como `No Sindicalizados`, `Sindicato Codelco DMH` y `Sindicato Interempresa de trabajadores de transporte buses JM, Minardi S.A. (Inter calama)`.
- El módulo ahora expone `buk_unions` en configuración base, permite crear reglas por sindicato específico y muestra ese valor exacto en la ficha operativa del trabajador.
- Las nuevas columnas `hr_incentive_rate_rules.union_name` y `hr_incentive_requests.employee_union_name` quedaron aplicadas en Supabase mediante la migración `20260606_223500_use_exact_buk_union_name_for_incentives.sql`.

## Resultado de compactación de configuración base y sindicato BUK en incentivos

- La separación vertical exagerada de `Cargos elegibles BUK` no venía del selector, sino del comportamiento por defecto del grid de dos columnas: la tarjeta izquierda se estiraba a la altura de la derecha. Se corrigió estructuralmente con `align-items: start` y densidad más compacta en la tarjeta/lista.
- En esa etapa se incorporó una primera capa de estado sindical derivado (`unionized`, `non_unionized`, `unknown`) usando atributos sincronizados desde BUK.
- Ese criterio quedó posteriormente reemplazado por sindicato nominal exacto (`raw_payload.current_job.union`) como variable principal de cálculo, manteniendo el estado derivado solo como respaldo técnico.
- `Reglas de monto` ya permite condicionar por `Sindicato BUK (opcional)` y el formulario operativo muestra el sindicato exacto del trabajador en modo solo lectura.
- La migración `20260606_220000_add_union_status_to_hr_incentives.sql` quedó aplicada en Supabase. La verificación remota confirmó `121` cargos BUK disponibles, los tres estados sindicales en catálogo y las columnas nuevas persistidas en `hr_incentive_rate_rules` y `hr_incentive_requests`.

## Resultado de enlace BUK en Configuración base de Incentivos

- `Configuración base` dejó de depender de texto libre para cargos BUK y ahora consume el catálogo real de cargos activos sincronizados en `employees_active_current`.
- `get_hr_incentive_setup_catalogs()` fue extendida para devolver `buk_job_titles`, reusando la misma lógica de resolución de cargo que ya ocupaba la búsqueda de trabajadores elegibles.
- La UI administrativa ahora muestra un selector de cargos sincronizados tanto para `Cargos elegibles BUK` como para la restricción opcional por cargo en `Reglas de monto`.
- La migración `20260606_130000_link_hr_incentive_setup_to_buk_job_titles.sql` fue aplicada en Supabase y la validación técnica local cerró con `npm run build`.

## Resultado de submódulo RRHH: Incentivos operativos

- `Recursos Humanos` dejó de ser placeholder y ahora expone un módulo real en `/recursos-humanos/incentivos`, con navegación interna para `Registrar incentivo`, `Historial` y `Configuración base`.
- Supabase quedó extendido con tablas propias de incentivos (`hr_incentive_allowed_job_titles`, `hr_incentive_types`, `hr_incentive_rate_rules`, `hr_incentive_requests`, `hr_incentive_request_history`) y RPCs seguras para búsqueda de trabajadores BUK elegibles, contexto del trabajador, cálculo server-side, alta y anulación.
- La lógica crítica quedó en backend: el monto no se puede editar desde frontend, se resuelve por regla vigente según tipo, cargo y contrato; además el formulario solo muestra trabajadores cuyo cargo BUK esté permitido en la configuración base.
- La UI inicial ya permite operar end to end sobre la base nueva: buscar trabajador, autocompletar RUT/cargo, elegir contrato activo u otros contratos históricos detectados en BUK, calcular incentivo y registrar la solicitud; además existe bandeja de historial con anulación y pantalla administrativa para mantener cargos, tipos y reglas.
- La migración se aplicó directamente en Supabase productivo y la verificación técnica cerró con `npm run build`, `git diff --check` y comprobación remota de tablas/RPCs (`hr_incentive_requests`, `get_hr_incentive_setup_catalogs`, `search_hr_incentive_eligible_workers`, `create_hr_incentive_request`).

## Corrección productiva del widget de cumpleaños

- [x] Verificar si la última sync BUK realmente escribió datos nuevos en `employees`
- [x] Contrastar la fuente del widget de cumpleaños con la vista `employees_active_current` y la función `get_upcoming_birthdays(...)`
- [x] Corregir la lógica SQL del próximo cumpleaños para que no desplace fechas al día 1 del mes
- [x] Aplicar migración en Supabase y validar el top real de cumpleaños

## Resultado de corrección productiva del widget de cumpleaños

- La sync BUK sí quedó persistida en producción: `public.employees` subió a `5212` filas con `max(updated_at) = 2026-06-06 02:04:11+00`.
- La diferencia entre `activeCount = 1605` del job y `employees_active_current = 1593` en la vista es consistente con la deduplicación de fichas activas múltiples; el dashboard consume la vista canónica, no la tabla cruda.
- El problema real no era caché ni falta de actualización, sino la función `get_upcoming_birthdays(...)`: el cálculo del último día del mes estaba mal parentizado y terminaba truncando cumpleaños válidos al día `1`.
- Eso hacía que la tarjeta pudiera saltarse cumpleaños inmediatos de junio y priorizar erróneamente personas de julio, aun con datos correctos ya sincronizados.
- La corrección quedó versionada en una migración dedicada para que el dashboard de producción dependa de una lógica determinista y auditable, no de un hotfix manual.
- La validación final confirmó que casos reales de junio vuelven a salir primero: por ejemplo, `Patricio Edgardo Villalobos Villarreal` recuperó `next_birthday = 2026-06-06` y el top vuelve a ordenar correctamente `06/06`, `07/06` y `08/06`.

## Endurecimiento de caching para Inicio y Reclutamiento

- [x] Auditar qué superficies críticas siguen usando fetch imperativo y estado duplicado en vez de caché compartido
- [x] Centralizar query keys y hooks de TanStack Query para Dashboard Home, catálogos de contratación y detalle/tablero de Control de Contrataciones
- [x] Reemplazar recargas manuales por invalidación explícita tras mutaciones del flujo de reclutamiento
- [x] Validar compilación y documentar la estrategia

## Resultado de endurecimiento de caching para Inicio y Reclutamiento

- La app ya no mezcla dos contratos de refresco distintos en el flujo principal: Inicio sigue con TanStack Query y Reclutamiento quedó alineado al mismo modelo para dashboard, detalle por caso y catálogos.
- Se creó una capa explícita de `queryKeys` y hooks reutilizables (`useRecruitmentControlDashboard`, `useRecruitmentCaseDetail`, `useHiringCatalogs`) para evitar arrays ad hoc y recargas duplicadas dispersas en componentes.
- `HiringStatusPage` dejó de disparar `loadDashboard()` / `loadCaseDetail()` manualmente después de cada acción; ahora invalida solo las queries afectadas, lo que reduce fetches redundantes y mantiene la UI coherente sin depender de `F5`.
- `HiringProcessesView` ya no mantiene un caché local paralelo del detalle expandido; reutiliza la misma query compartida del caso, evitando drift entre vistas del mismo dato.
- `HiringRequestPage` dejó de recargar catálogos en cada montaje con `useEffect`; los catálogos activos quedan cacheados con TTL largo, apropiado para datos maestros de baja volatilidad.

## Refresh automático del dashboard operativo

- [x] Verificar si `Inicio` refresca solo o depende de `F5` / recarga manual
- [x] Corregir `useDashboard` para que el estado operativo se actualice automáticamente sin intervención del usuario
- [x] Validar compilación y documentar la regla

## Restricción de Control de candidatos por capacidad documental

- [x] Separar `Control de candidatos` con una capability exclusiva para Reclutamiento y `system_admin`
- [x] Ocultar la vista y navegación del subflujo para usuarios sin esa capability
- [x] Endurecer los RPCs del subflujo candidato/documental para bloquear acceso forzado desde cliente
- [x] Validar compilación y dejar resultado documentado

## Separación de "Control de candidatos" y "Personal a Contratar"

- [x] Ajustar `get_recruitment_control_dashboard_v2()` para que los candidatos `hired` salgan de `candidate_control` y entren a una bandeja propia
- [x] Crear la vista `Personal a Contratar` junto a `Control de candidatos`, reutilizando ficha y documentos ya cargados
- [x] Ocultar acciones de avance de etapa en la nueva bandeja y validar build + migración aplicada

## Corrección de cierre de folios y visibilidad operativa

- [x] Corregir backend para que `close_hiring_request` permita cierre solo a `admin`, `reclutamiento` y gerente de área
- [x] Eliminar la ambigüedad de nombres dentro de `close_hiring_request` evitando colisión entre columnas de salida y columnas reales
- [x] Exponer en el payload de procesos si el usuario actual puede cerrar cada folio y usar esa señal para ocultar el botón en frontend
- [x] Validar build y documentar el comportamiento final de candidatos al cerrar un folio

## Resultado de corrección de cierre de folios y visibilidad operativa

- Se agregó la migración [`supabase/migrations/20260608_130000_harden_close_hiring_request_permissions.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608_130000_harden_close_hiring_request_permissions.sql:1), que introduce `public.user_can_close_hiring_request(...)` como fuente única de autorización para cierres.
- `close_hiring_request(...)` dejó de permitir cierre por simple acceso al módulo o por ser solicitante original. Ahora solo cierra `admin`, `reclutamiento` y el aprobador activo del centro de costo.
- La colisión de nombres dentro de la RPC quedó eliminada al renombrar las columnas de salida a `request_id` y `request_status`, evitando ambigüedad con columnas reales de tablas operativas.
- El dashboard de `Control de Contrataciones` ahora recibe `can_close_request` por cada caso, por lo que el botón `Cerrar Folio` solo se renderiza cuando el backend confirma que el usuario actual sí puede cerrar ese folio.
- Se corrigió además el efecto colateral sobre `Personal a Contratar`: los candidatos `hired` de folios cerrados manualmente siguen visibles en esa bandeja para permitir completar ficha y documentación posterior al cierre del folio.
- La validación local cerró con `npm run build` y `git diff --check`.

## Resultado de separación de "Control de candidatos" y "Personal a Contratar"

- `Control de candidatos` ya no mezcla el estado terminal `hired`; la bandeja quedó enfocada solo en pipeline operativo previo a contratación.
- Se creó la nueva vista `Personal a Contratar` dentro de `Control de Contrataciones`, al lado de `Control de candidatos`, reutilizando el mismo detalle lateral para revisar trazabilidad, checklist documental y ficha del candidato.
- En la nueva bandeja se ocultaron explícitamente los controles de avance de etapa y aprobación Who; queda como superficie de revisión y preparación contractual, no como pipeline de reclutamiento.
- Supabase quedó alineado con una migración nueva que reescribe `get_recruitment_control_dashboard_v2()` para exponer `candidate_control` sin `hired` y un nuevo payload `personnel_to_hire` solo con candidatos contratados.
- La validación técnica cerró con `git diff --check`, `npm run build`, migración aplicada en Supabase y verificación del cuerpo de la función remota mediante `pg_get_functiondef(...)`.

## Resultado de restricción de Control de candidatos por capacidad documental

- `Control de candidatos` dejó de depender solo del acceso al módulo `control_contrataciones`; ahora usa la capability explícita `candidate_control_access`.
- El frontend ya no renderiza la pestaña ni permite permanecer en la vista de candidatos si el usuario no tiene esa capability.
- `get_recruitment_control_dashboard_v2()` ya no entrega el payload `candidate_control` a usuarios sin permiso, reduciendo exposición de datos sensibles incluso si inspeccionan la respuesta de red.
- Se agregó una migración de endurecimiento que asigna `candidate_control_access` a `reclutamiento` y bloquea por backend los RPCs del subflujo candidato/documental para cualquier usuario sin esa capacidad, manteniendo bypass administrativo por `user_is_admin(...)`.
- Al aplicar el endurecimiento sobre Supabase apareció drift real de firmas en funciones remotas; la migración se ajustó con `drop function if exists ...` explícitos antes de recrear las funciones sensibles, evitando fallos por cambio de `RETURNS TABLE`.
- La validación técnica quedó cerrada con `git diff --check` y `npm run build`.

## Resultado de refresh automático del dashboard operativo

- El dashboard no era realmente vivo: usaba TanStack Query, pero sin `refetchInterval`, con `refetchOnWindowFocus: false` heredado por defecto y sin ninguna suscripción en tiempo real.
- En la práctica, una solicitud de aprobación nueva podía no aparecer hasta refrescar la página o remount de la vista.
- `useDashboard` ahora fuerza un contrato operativo más correcto: `staleTime: 15s`, `refetchInterval: 30s`, `refetchOnWindowFocus: true` y `refetchOnReconnect: true`.
- Con esto, `Tareas Pendientes`, `Seguimiento de aprobaciones`, `Folios en curso` y `Cumpleaños` dejan de depender de `F5`, aunque no son instantáneos al segundo. Para inmediatez absoluta, el siguiente salto sería suscripción en tiempo real.

## Limpieza estructural de dashboard y vestigios muertos

- [x] Detectar widgets del dashboard sin uso real ni futuro operativo inmediato
- [x] Eliminar abstracciones genéricas del dashboard que solo encubrían un único caso real
- [x] Reducir comentarios y vestigios de transición que ya no agregan valor
- [x] Validar compilación y build después de la limpieza

## Resultado de limpieza estructural de dashboard y vestigios muertos

- Se eliminaron los componentes muertos `QuickActionsWidget.tsx` y `TimelineWidget.tsx`; no tenían referencias activas ni contrato operativo vigente.
- `DashboardGrid` dejó de usar un bus genérico `onAction(actionType, payload)` para un solo caso real; ahora recibe un `onRefresh()` explícito, más simple y menos acoplado.
- `TasksWidget` ya no dispara strings de comando (`REFRESH_DATA`) para refrescar el dashboard; invoca un callback directo y tipado.
- Se retiró ruido residual en `HomePage.tsx`, manteniendo el módulo como un contenedor limpio hacia `DashboardHome`.

## Corrección de regresión en geolocalización del widget de clima

- [x] Revisar por qué el widget de clima dejó de resolver ubicación real aunque el navegador entregara coordenadas
- [x] Corregir el fallback para que no vuelva a `Santiago, CL` cuando solo falle el reverse geocoding
- [x] Reintentar resolución de ubicación al recuperar foco si la sesión quedó sin permiso o sin respuesta inicial
- [x] Validar compilación y build

## Resultado de corrección de regresión en geolocalización del widget de clima

- El widget sí obtenía coordenadas reales, pero si fallaba la llamada de reverse geocoding caía visualmente a `Santiago, CL`; eso hacía parecer que no resolvía ubicación aunque el clima ya no estuviera usando el fallback.
- Ahora el flujo es más robusto: primero se guardan y usan las coordenadas reales, luego se intenta traducirlas a ciudad; si esa traducción falla, el widget conserva una etiqueta basada en coordenadas reales en vez de mentir con Santiago.
- También se expuso un estado más preciso para errores de geolocalización (`permiso denegado`, `ubicación no disponible`, `timeout`) y se reintenta al recuperar foco mientras la ubicación siga sin resolverse.

## Corrección de fallback inicial falso en clima

- [x] Verificar por qué el widget seguía mostrando `Santiago, CL` y clima de Santiago mientras declaraba `Resolviendo ubicación...`
- [x] Separar estado inicial pendiente de estado fallback real
- [x] Evitar que Open-Meteo consulte coordenadas de Santiago antes de recibir ubicación o error explícito
- [x] Evitar que el estado intermedio de coordenadas aborte la resolución del nombre de ciudad
- [x] Agregar timeout propio de aplicación para salir de estados pendientes colgados
- [x] Validar `tsc` y build de Vite

## Resultado de corrección de fallback inicial falso en clima

- El estado inicial del widget usaba `DEFAULT_LOCATION`, que ya contenía coordenadas de Santiago. Eso hacía que la tarjeta consultara clima de Santiago aunque la geolocalización siguiera pendiente.
- Ahora existe `INITIAL_LOCATION` sin coordenadas; mientras el navegador resuelve ubicación, no se consulta clima con fallback falso.
- La ubicación real se confirma después de resolver la etiqueta humana; si esa resolución falla, se muestran coordenadas reales, no Santiago.
- `Santiago, CL` queda reservado para error real, falta de soporte de geolocalización o timeout explícito de la app.
- Se agregó un timeout propio de 12 segundos para que la UI no quede indefinidamente en `Resolviendo ubicación...` si el navegador no llama ni éxito ni error.

## Endurecimiento de parser de ciudad para clima

- [x] Verificar si la regresión restante venía del parser del payload de geocodificación inversa
- [x] Extraer ciudad también desde `localityInfo.administrative` cuando el proveedor no entregue `city` o `locality` planos
- [x] Validar compilación y build

## Resultado de endurecimiento de parser de ciudad para clima

- BigDataCloud sí entrega ciudad para Los Andes, pero la app estaba preparada solo para campos planos (`city`, `locality`, `principalSubdivision`).
- El parser ahora también revisa `localityInfo.administrative` y toma la localidad administrativa más específica disponible antes de degradar a región o coordenadas.
- Con esto, el widget deja de caer innecesariamente a coordenadas cuando el proveedor entregue la ciudad en estructura anidada.

## Reparación de build roto por dependencia de TanStack Query

- [x] Reproducir el fallo real de `vite build`
- [x] Aislar si el problema venía del código del dashboard o de una dependencia publicada defectuosa
- [x] Fijar `@tanstack/react-query` y `@tanstack/query-core` a una versión estable que exponga correctamente su entrypoint
- [x] Validar con `git diff --check`, `tsc -b` y `vite build`

## Resultado de reparación de build roto por dependencia de TanStack Query

- El error de Vite no venía del cambio de auto-refresh ni de la app: la versión `5.100.14` de `@tanstack/react-query` instalada en este entorno quedó con `exports` apuntando a `build/modern/index.js`, pero ese archivo no existía en `node_modules`.
- La señal definitiva fue reproducible fuera de Vite: `import("@tanstack/react-query")` fallaba con `ERR_MODULE_NOT_FOUND` porque faltaba el entrypoint moderno del paquete.
- Se fijaron `@tanstack/react-query` y `@tanstack/query-core` en `5.90.20`, versión estable que vuelve a exponer correctamente el entrypoint ESM esperado por Vite.
- Tras el ajuste, `tsc -b` y `vite build` vuelven a pasar y el build quedó restablecido.

## Verificación de sync BUK y corrección de layout en Solicitud de Contrataciones

- [x] Verificar en Supabase si la sincronización BUK realmente actualizó `employees` después del fix del workflow
- [x] Revisar la estructura y estilos de `HiringRequestPage` para aislar la causa del solapamiento reportado
- [x] Aplicar un ajuste de layout defensivo para evitar compresión horizontal entre formulario y resumen sticky
- [x] Validar con `git diff --check`, `npx tsc -b` y `npm run build`

## Resultado de verificación de sync BUK y corrección de layout en Solicitud de Contrataciones

- La base confirma que la sync BUK no quedó al día: `employees.updated_at` y `employees_active_current` siguen congelados en `2026-05-30T03:54:02.283802+00:00`, por lo que todavía no hubo actualización efectiva posterior al arreglo del workflow.
- El problema del workflow ya no es de código local sino de ejecución: hace falta disparar una corrida manual o esperar la próxima ventana programada y luego volver a verificar la base.
- En `Solicitud de Contrataciones`, el riesgo más alto estaba en la compresión horizontal del layout: el formulario seguía compartiendo ancho con el resumen sticky hasta un breakpoint demasiado bajo.
- Se endureció el comportamiento responsivo para que `hiring-layout-grid` colapse a una sola columna desde `1320px` y `summary-panel` deje de ser sticky en ese rango, evitando montajes entre bloques cuando el ancho intermedio ya no sostiene ambos paneles con holgura.

## Corrección de compatibilidad de variables en Sync BUK GitHub Actions

- [x] Revisar la regresión introducida por el hardening del workflow tras un nuevo fallo en GitHub Actions
- [x] Restaurar compatibilidad con `NEXT_PUBLIC_SUPABASE_URL` en el workflow, porque el script ya seguía soportando ese nombre
- [x] Validar sintaxis YAML y registrar la lección

## Resultado de corrección de compatibilidad de variables en Sync BUK GitHub Actions

- El workflow endurecido dejó de ser compatible con una configuración histórica válida del repo: `vars.NEXT_PUBLIC_SUPABASE_URL`.
- El script `sync-buk-employees.mjs` sí seguía aceptando `NEXT_PUBLIC_SUPABASE_URL`, pero `sync-buk.yml` solo inyectaba y validaba `VITE_SUPABASE_URL`/`SUPABASE_URL`; eso podía provocar un fallo temprano del job aunque la configuración previa siguiera siendo la única presente en GitHub.
- Se restauró compatibilidad completa: el workflow ahora exporta y valida `NEXT_PUBLIC_SUPABASE_URL` además de `VITE_SUPABASE_URL` y `SUPABASE_URL`.

## Corrección de fallback de URLs BUK vacías en GitHub Actions

- [x] Inspeccionar el log real del run fallido de `Sync BUK Employees`
- [x] Corregir el script para que trate `BUK_EMPLOYEES_URL` y `BUK_AREAS_URL` vacías como ausentes en vez de valores válidos
- [x] Validar sintaxis del script y publicar el fix

## Resultado de corrección de fallback de URLs BUK vacías en GitHub Actions

- El log real del run fallido mostró la causa exacta: `BUK_EMPLOYEES_URL` y `BUK_AREAS_URL` llegaban a GitHub Actions como string vacío, no como `undefined`.
- `sync-buk-employees.mjs` usaba `??` para decidir fallback, por lo que `""` seguía considerándose un valor “presente”; eso rompía `new URL("")` con `TypeError: Invalid URL` antes de comenzar la sincronización real.
- El script ahora normaliza variables opcionales de entorno y convierte strings vacíos en `null`, permitiendo que el fallback seguro a `https://busesjm.buk.cl/api/v1/chile/employees` y su endpoint derivado de áreas funcione también en GitHub Actions.

## Revisión de alerta en integración BUK

- [x] Revisar el estado documentado de la integración BUK y el contrato actual de sincronización
- [x] Auditar el workflow `.github/workflows/sync-buk.yml` y el script `scripts/sync-buk-employees.mjs` para detectar puntos frágiles que expliquen updates fallidos
- [x] Endurecer la validación de variables críticas y la instalación de dependencias del job programado
- [x] Hacer que el script deje un resumen más explícito de la sincronización ejecutada
- [x] Corregir la lógica de ventana horaria para que un run programado no se salte la sync por retraso de GitHub Actions
- [x] Validar sintaxis del script, consistencia del workflow y registrar la lección

## Resultado de revisión de alerta en integración BUK

- El flujo de sincronización BUK no mostraba un contrato explícito de variables en GitHub Actions: si faltaba `VITE_SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY`, el job fallaba tarde y con diagnóstico ambiguo.
- El workflow ahora usa `npm ci --omit=dev` con cache de npm, en vez de instalar solo `@supabase/supabase-js`, dejando una ejecución más determinista y alineada con `package-lock.json`.
- Se agregó una etapa `Validate required sync variables` en `.github/workflows/sync-buk.yml` que falla temprano si faltan `BUK_AUTH_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` o una URL válida de Supabase (`VITE_SUPABASE_URL` o `SUPABASE_URL`).
- `scripts/sync-buk-employees.mjs` ahora valida explícitamente `SUPABASE_SERVICE_ROLE_KEY`, normaliza el contrato de URL de Supabase y deja un resumen final más útil (`pagesProcessed`, `synced`, `finalCount`, `activeCount`) para auditoría operativa.
- La causa raíz de los “runs verdes” sin actualización real era la validación por `LOCAL_HOUR=20`: si GitHub ejecutaba el cron con retraso, el job quedaba en éxito pero omitía la sincronización. La lógica ahora decide por `github.event.schedule` + offset real de `America/Santiago`, no por la hora tardía de arranque del runner.

## Revisión y consolidación de documentación post-auditoría

- [x] Verificar que `todo.md` refleje todos los cambios aplicados por la auditoría de otro modelo
- [x] Verificar que `lessons.md` tenga las lecciones correctas sin duplicados ni corrupción
- [x] Confirmar que los archivos creados por la auditoría (`logger.ts`, `transformers.ts`, `types/index.ts`) existen en el repo
- [x] Registrar la Lección 56 como regla fundacional permanente: revisar ambos documentos antes de cualquier acción
- [x] Validar compilación y build

## Resultado de revisión y consolidación post-auditoría

- Los cambios aplicados por el otro modelo son coherentes con el estado del repo: `logger.ts` existe en `src/shared/lib/`, los tipos de Operaciones están en `src/modules/operaciones/types/index.ts` y los transformadores en `src/modules/operaciones/lib/transformers.ts`.
- `lessons.md` quedó limpio: 56 lecciones numeradas sin duplicados, sin líneas corruptas y sin referencias rotas.
- `todo.md` tiene una referencia histórica a `DashboardNewsRow` en el resultado de saneamiento (línea 14); es válida como registro de lo que se hizo en ese momento, aunque el archivo ya no exista.
- La Lección 56 queda como regla fundacional: todo agente, modelo o sesión debe leer ambos documentos antes de tocar cualquier parte del repositorio.

## Saneamiento guiado por auditoría: logs, tipos y encapsulamiento UI

- [x] Contrastar la auditoría externa con el estado real del repo y descartar hallazgos ya resueltos
- [x] Introducir un logger seguro compartido y reemplazar logs crudos en Auth y Dashboard
- [x] Extraer tipos y transformadores de Operaciones para reducir `any` en la página principal
- [x] Reemplazar el bloque más repetitivo de estilos inline en `CandidateDetailSidebar.tsx` por clases CSS reutilizables
- [x] Validar con `git diff --check`, `npx tsc -b` y `npm run build`

## Resultado de saneamiento guiado por auditoría

- La auditoría externa estaba parcialmente desfasada: el riesgo original de múltiples `useEffect` sin caché global en dashboard ya no aplica como estaba descrito, porque `useDashboard` ya opera sobre TanStack Query.
- Se agregó `src/shared/lib/logger.ts` y se reemplazaron logs crudos en `AuthContext`, `dashboardService`, `DashboardNewsRow` y `CandidateIntakeForm`, evitando exponer objetos de error completos en producción.
- Operaciones ahora tiene contratos explícitos en `src/modules/operaciones/types/index.ts` y transformadores reutilizables en `src/modules/operaciones/lib/transformers.ts`, reduciendo `any` en `OperacionesDashboard.tsx`, `OperationsSummary.tsx`, `OperationsExport.tsx` y `OperationsBaseRegister.tsx`.
- `validateServiceEntryPayload(...)` dejó de aceptar `any` y ahora trabaja sobre `unknown` + narrowing explícito.
- `CandidateDetailSidebar.tsx` dejó de concentrar el bloque más repetitivo de estilos inline: edición de licencia, entrevista e historial ahora usan clases reutilizables en `src/styles/global.css`.
- `DashboardInfoCards.tsx` también dejó de usar estilos inline residuales en la tarjeta de cumpleaños; el patrón de layout ahora queda centralizado en `dashboard.css`.

## Fila superior del Dashboard: tarjetas informativas útiles

- [x] Auditar la integración actual con BUK y formalizar el contrato local de `employees` para próximos cumpleaños
- [x] Extender la sincronización BUK para persistir fecha de nacimiento cuando exista en el payload
- [x] Crear una RPC `get_upcoming_birthdays(...)` basada en la tabla local `employees`
- [x] Implementar una fila superior de 4 tarjetas reales en Inicio, sin placeholders
- [x] Validar build, revisar contraste/responsive y documentar el patrón

## Resultado de fila superior del Dashboard: tarjetas informativas útiles

- El inicio ahora tiene una fila superior compacta con cuatro tarjetas reales: clima operativo, tareas personales pendientes, aprobaciones en curso y cumpleaños próximos.
- Los cumpleaños no salen directo de BUK desde el navegador; se leen desde la tabla local `employees`, que ahora queda formalizada en el repo y alimentada por la sincronización existente.
- `scripts/sync-buk-employees.mjs` se extendió para capturar `birth_date` desde el payload de BUK cuando esté disponible, evitando crear una integración paralela solo para cumpleaños.
- La RPC `get_upcoming_birthdays(...)` centraliza permisos y cálculo de próximos cumpleaños en backend, manteniendo el dashboard liviano y sin lógica duplicada en React.
- La validación técnica quedó cerrada con `git diff --check`, `npx tsc -b` y `npm run build`; la validación funcional final depende de aplicar la migración y volver a correr la sincronización de BUK en el ambiente real.

## Endurecimiento BUK: ficha activa, sincronización diaria y paginación de cumpleaños

- [x] Formalizar una fuente canónica de empleados activos para evitar duplicidad por múltiples fichas
- [x] Hacer que cumpleaños y otros consumos operativos lean solo la ficha activa vigente
- [x] Ajustar la automatización BUK para ejecutarse diariamente a las 20:00 hora Chile
- [x] Convertir la tarjeta de cumpleaños en una tarjeta paginable por persona dentro del mismo módulo
- [x] Validar build y dejar el contrato registrado en lecciones

## Resultado de endurecimiento BUK: ficha activa, sincronización diaria y paginación de cumpleaños

- Se formalizó `employees_active_current` como fuente canónica de ficha activa, deduplicando por identidad documental y conservando solo la ficha activa más vigente.
- `get_upcoming_birthdays(...)` y el consumo operativo de conductores en Operaciones ya no leen la tabla cruda `employees`, sino la fuente canónica activa.
- La automatización de BUK existente en GitHub Actions se ajustó para dispararse diariamente a las 20:00 hora Chile, resolviendo explícitamente la diferencia entre UTC y `America/Santiago`.
- La tarjeta de cumpleaños dejó de estar fija en una sola persona: ahora rota automáticamente y permite navegar manualmente entre cumpleañeros dentro de la misma tarjeta.

## Mejora de tarjeta de clima: extremos térmicos y ubicación real

- [x] Replantear la fuente de ubicación del clima para que use geolocalización real del navegador y no datos maestros del ERP
- [x] Extender la tarjeta de clima para mostrar máxima y mínima diaria
- [x] Mostrar la ubicación física detectada en tiempo real y definir fallback explícito si el permiso falla
- [x] Validar build y registrar el contrato operativo del fallback

## Resultado de mejora de tarjeta de clima: extremos térmicos y ubicación real

- La tarjeta de clima ahora muestra temperatura actual, máxima y mínima diaria.
- La ubicación del clima ya no depende de BUK ni de tablas del ERP; se resuelve desde `navigator.geolocation` en el navegador del usuario.
- Si el permiso de ubicación está disponible, la tarjeta muestra la ciudad real detectada y consulta el clima para esas coordenadas. Si el permiso falla o no existe, el sistema cae de forma explícita a `Santiago, CL`.

## Refinamiento de tarjeta de clima: geocodificación inversa y feedback visual

- [x] Reemplazar la geocodificación inversa de Open-Meteo por BigDataCloud para asegurar la resolución confiable de ciudad y código de país
- [x] Exponer la ciudad real detectada en la cabecera del widget, reservando "Santiago, CL" solo para fallbacks de permiso
- [x] Incorporar temas visuales dinámicos sutiles (cálido, frío, lluvioso) basados en la temperatura y código de condición
- [x] Ajustar la respiración visual de la tarjeta elevando el contenedor inferior

## Resultado del refinamiento de tarjeta de clima

- El frontend ahora resuelve la ubicación sin errores de API mediante BigDataCloud.
- El título del widget refleja la ciudad detectada en lugar de quedar estático.
- La tarjeta cambia sutilmente de temperatura visual (frío, calor, lluvia) manteniendo la paleta de colores del ERP.

## Fase 2B.1: capacidades efectivas backend para `Who`

## Limpieza estructural completa de SQL y Supabase

- [x] Inventariar objetos SQL versionados en `supabase/migrations` y scripts sueltos fuera del historial
- [x] Contrastar el consumo real de tablas, vistas, buckets, RPCs y permisos desde el frontend actual
- [x] Inspeccionar el estado vivo de Supabase para detectar objetos huérfanos, redundantes o ya desligados del producto
- [x] Diseñar una limpieza segura que preserve solo el contrato usado por la app actual
- [x] Ejecutar la limpieza en código versionado: migración destructiva para objetos muertos y poda de archivos SQL locales no vigentes
- [x] Validar que el frontend siga compilando y que las RPCs/contratos críticos permanezcan alineados
- [x] Documentar resultado y lecciones nuevas

## Resultado de limpieza estructural completa de SQL y Supabase

- Se auditó el consumo real del frontend y se confirmó que el dashboard ya no usa el catálogo SQL de widgets ni preferencias por usuario; solo mantenía esa dependencia por inercia.
- En Supabase seguían vivos `dashboard_widgets` (5 filas), `user_dashboard_preferences` (0 filas), `notifications` (0 filas) y RPCs no consumidas como `get_dashboard_widgets_for_current_user`, `get_dashboard_alerts`, `get_dashboard_kpis`, `get_home_dashboard_summary` y `get_hiring_control_dashboard`.
- Se simplificó el frontend del inicio para operar con layout estático real, eliminando la lectura de `dashboard_widgets` y `user_dashboard_preferences`.
- Se creó la migración [20260603_170000_drop_unused_dashboard_catalog.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260603_170000_drop_unused_dashboard_catalog.sql:1) para borrar el circuito SQL muerto del dashboard.
- Se eliminaron scripts SQL sueltos no versionados en [supabase](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase): `check_approvals.sql`, `dashboard_admin_fix.sql` y `fix_approval_data.sql`.
- La limpieza fue validada con `git diff --check`, `tsc -b` y `vite build`.

## Corrección de security definer en view de empleados activos

- [x] Corregir `public.employees_active_current` para que use `security_invoker = true`
- [x] Dejar migración versionada sin alterar el contrato funcional de cumpleaños ni Operaciones
- [x] Validar consistencia del cambio

## Resultado de corrección de security definer en view de empleados activos

- El warning de Supabase es válido: `employees_active_current` había quedado como view con semántica de `security definer`, lo que hace que evalúe permisos con el contexto del creador en vez del usuario que consulta.
- Se creó la migración [20260603_175500_fix_employees_active_current_security.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260603_175500_fix_employees_active_current_security.sql:1), que recrea la view con `with (security_invoker = true)` manteniendo exactamente el mismo `SELECT` y el mismo `grant select`.
- Este cambio no altera el contrato funcional del inicio ni de Operaciones: la app sigue consultando `employees_active_current`, solo que ahora la view queda alineada con el modelo de seguridad esperado por Supabase.

## Hardening seguro de grants y RLS en Supabase

- [x] Identificar hallazgos de seguridad que sí eran deuda accidental y no parte deliberada del diseño RPC autenticado
- [x] Corregir grants sobrantes a `anon/public` sobre funciones del schema `public`
- [x] Cerrar helpers internos para que no queden ejecutables por usuarios autenticados cuando no corresponde
- [x] Definir política RLS explícita para `public.employees` sin romper `employees_active_current`
- [x] Aplicar el ajuste en la base viva y revalidar advisors

## Resultado de hardening seguro de grants y RLS en Supabase

- Se aplicó la migración [20260604_103000_harden_function_grants_and_employees_rls.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260604_103000_harden_function_grants_and_employees_rls.sql:1) tanto en el repo como en la base viva.
- `public.set_updated_at()` y `public.normalize_candidate_who_causes(jsonb)` quedaron con `search_path = public`, eliminando los warnings por `function_search_path_mutable`.
- Se revocó `EXECUTE` a `public` y `anon` sobre todas las funciones del schema `public`, cerrando la exposición accidental de RPCs internas por recreaciones sucesivas de funciones.
- Se revocó además `EXECUTE` a `authenticated` sobre helpers internos que la app no invoca directamente (`set_updated_at`, `normalize_candidate_who_causes`, `handle_new_auth_user`, `sync_auth_user_profile`, `protect_profiles_sensitive_columns`, `find_active_candidate_contract_lock`, `open_recruitment_case_from_hiring_request`, `sync_recruitment_case_status`).
- `public.employees` quedó con RLS explícita para `SELECT` autenticado solo en módulos que realmente consumen empleados y sin permisos de escritura para `authenticated`; `anon` perdió todos los permisos sobre esa tabla.
- Tras revalidar Supabase, desaparecieron los hallazgos de `RLS Enabled No Policy`, `Function Search Path Mutable` y todos los `anon_security_definer_function_executable`.
- Los warnings restantes ya son estructurales al diseño actual: RPCs `SECURITY DEFINER` que la app autenticada sí usa, la extensión `unaccent` en `public` y `Leaked Password Protection` desactivado en Auth.

- [x] Diseñar una fuente backend de capacidades sin amarrar la UI a roles duros
- [x] Crear catálogo de capacidades y asignación por rol en Supabase
- [x] Extender `get_my_effective_permissions()` para devolver `capabilities`
- [x] Consumir `capabilities` desde `AuthContext` y exponer helper `hasCapability(...)`
- [x] Validar compilación y dejar el patrón documentado

## Resultado de Fase 2B.1: capacidades efectivas backend para `Who`

- El sistema ya no necesita inferir futuras autorizaciones de `Who` desde nombres de rol en React.
- La base ahora soporta `app_capabilities` y `role_capabilities`, y `get_my_effective_permissions()` devuelve `capabilities` junto con roles y módulos.
- `AuthContext` expone `capabilities` y `hasCapability(...)`, dejando listo el terreno para la aprobación `Who` en el pipeline de candidatos.

## Fase 2B.2: aprobación Who y nuevo pipeline de candidatos

- [x] Confirmar el estado real de candidatos en producción antes de definir el mapeo de etapas
- [x] Crear tabla `candidate_stage_approvals` con trazabilidad y RLS
- [x] Migrar etapas antiguas al nuevo pipeline y crear solicitudes `Who` pendientes donde corresponda
- [x] Modificar `advance_recruitment_candidate_stage(...)` para bloquear saltos no válidos y exigir aprobación `Who`
- [x] Crear `approve_candidate_stage_who(...)`
- [x] Exponer el resumen `Who` en `get_recruitment_case_detail(...)`
- [x] Ajustar frontend mínimo para nuevas etapas y aprobación `Who` desde el sidebar
- [x] Validar compilación y build

## Resultado de Fase 2B.2: aprobación Who y nuevo pipeline de candidatos

- El pipeline de candidatos ya soporta `who_pending`, `who_approved`, `medical_exams` y `document_review` con bloqueo backend real, no solo visual.
- La tabla `candidate_stage_approvals` deja trazabilidad formal de solicitud y aprobación `Who`.
- La aprobación `Who` ya se puede ejecutar desde el sidebar del candidato por un usuario que tenga la capability efectiva correspondiente.
- El detalle del candidato ahora muestra el resumen de la aprobación `Who`, evitando que el estado quede opaco dentro del flujo.

## Corrección de migración Fase 2B.2: orden de endurecimiento del pipeline

- [x] Corregir la migración `20260526_160000_add_candidate_who_approval_pipeline.sql` para no endurecer `stage_code` antes del backfill
- [x] Verificar que el orden seguro sea: liberar constraint antiguo, migrar datos vivos, insertar aprobaciones pendientes y recién entonces agregar el nuevo check
- [x] Validar consistencia del repo y dejar la lección registrada

## Resultado de corrección de migración Fase 2B.2

- La falla `23514` venía de endurecer el `CHECK` de `recruitment_case_candidates.stage_code` antes de remapear filas históricas con etapas antiguas (`contacted`, `screening`, `shortlisted`, `documents_pending`).
- La migración ahora sigue el orden correcto: primero elimina el constraint anterior, luego hace el backfill de datos y al final crea el nuevo `recruitment_case_candidates_stage_code_check`.
- Con este orden, la misma migración puede correr sobre datos vivos sin romperse por estados intermedios incompatibles.
- Se detectó además un segundo constraint legacy activo en algunos ambientes, `recruitment_case_candidates_stage_check`, que también debe eliminarse antes del backfill porque rechaza etapas nuevas como `who_pending`.

## Integración de aprobaciones Who en dashboard

- [x] Confirmar si `Tareas Pendientes` y `Seguimiento de aprobaciones` estaban leyendo `candidate_stage_approvals`
- [x] Extender `get_dashboard_tasks(...)` para incluir aprobaciones `Who` pendientes cuando el usuario tenga la capability correspondiente
- [x] Extender `get_dashboard_approval_tracking()` para incluir `Who` pendiente como parte del seguimiento global
- [x] Ajustar los widgets del dashboard para mostrar y aprobar `Who` desde Inicio
- [x] Validar compilación y build

## Resultado de integración de aprobaciones Who en dashboard

- El dashboard ya no trata `Who` como un detalle escondido solo dentro de Reclutamiento.
- `Tareas Pendientes` ahora incluye `candidate_stage_approvals` en estado `pending` para usuarios con `can_approve_who_stage`.
- `Seguimiento de aprobaciones` también muestra las solicitudes `Who` pendientes junto con las aprobaciones de folio.
- La aprobación `Who` ya se puede resolver desde el propio Inicio, sin obligar al usuario a navegar a otra pantalla para una tarea que ya apareció como pendiente.

## Estructuración de causas Who y limpieza del detalle operativo

- [x] Reemplazar el comentario plano de solicitud `Who` por una estructura de hasta 4 causas con tipo, año y comentario
- [x] Capturar las causas en `Control de Contrataciones` antes de enviar a `who_pending`, en un bloque compacto
- [x] Guardar las causas en backend y exponerlas en el detalle del candidato y en el dashboard
- [x] Ajustar `Tareas Pendientes` y `Seguimiento de aprobaciones` para que una aprobación `Who` muestre el resumen de causas, no la solicitud completa del folio
- [x] Validar compilación y build

## Resultado de estructuración de causas Who y limpieza del detalle operativo

- `Who` ya no depende de un comentario libre para describir hallazgos; ahora guarda hasta 4 causas estructuradas con tipo (`laboral`, `penal`, `civil`), año y comentario.
- La captura de esas causas vive pegada a la acción de mover a `Who Pendiente`, en un cuadro compacto y colapsable para no ensuciar el sidebar.
- El detalle expandido en `Inicio` ahora diferencia correctamente entre aprobaciones de folio y aprobaciones `Who`: mantiene la fila resumen arriba, pero al desplegar `Who` muestra el resumen de causas y la observación general, no la solicitud contractual completa.

## Deuda visible del dashboard: affordances muertas

- [x] Auditar los botones sin función visibles en `Inicio` (`Acciones Rápidas`, kebab de widgets y affordances equivalentes)
- [x] Retirar del layout principal cualquier botón o menú que hoy no tenga contrato operativo real
- [x] Reemplazar esas entradas por un único botón flotante colapsable en la esquina superior derecha del dashboard
- [x] Dejar las opciones futuras visibles como backlog no operativo, sin clicks rotos
- [ ] Validar en Cloudflare el layout final antes de retomar Fase 2C

## Resultado de deuda visible del dashboard: affordances muertas

- El dashboard dejó de exponer botones clickeables sin comportamiento, que los testers venían reportando como fallas del sistema.
- `Acciones Rápidas` salió del layout principal y las opciones futuras quedaron consolidadas en un único menú flotante colapsable en la esquina superior derecha.
- Las opciones del menú quedaron visibles como backlog operativo, pero no ejecutables, evitando nuevas falsas expectativas en QA mientras se programa su lógica real.

## Refinamiento visual del launcher de acciones rápidas

- [x] Reemplazar el botón flotante textual por un launcher compacto tipo asistente flotante
- [x] Hacer que el menú se abra por hover o clic, anclado al icono en la esquina superior derecha
- [ ] Validar visualmente en Cloudflare que el launcher no compita con el encabezado ni tape navegación

## Resultado de refinamiento visual del launcher de acciones rápidas

- El dashboard ya no muestra un botón textual de backlog en la cabecera; ahora usa un launcher compacto de icono único.
- El panel de acciones rápidas se despliega al pasar el cursor o hacer clic sobre el icono, alineándose mejor con la referencia visual pedida por el usuario.

## Aterrizaje de plan externo Fase 2B y 2C

- [x] Revisar `implementation_plan.md` contra la arquitectura real del repo y del backend activo
- [x] Corregir supuestos falsos del plan externo (`Kanban`, modal inexistente, permisos por rol duro)
- [x] Dejar un plan implementable en `docs/reclutamiento-operaciones-fase2-plan.md`

## Resultado de aterrizaje de plan externo Fase 2B y 2C

- El plan de `Who` y `Ficha del Trabajador` quedó reescrito sobre las piezas reales del sistema: `HiringCandidatesView`, `CandidateDetailSidebar`, `advance_recruitment_candidate_stage(...)` y `get_my_effective_permissions()`.
- Se descartó explícitamente construir superficies paralelas que hoy no existen, como un Kanban nuevo o un modal de detalle alternativo.
- El aterrizaje fija una secuencia técnica realista: primero capabilities backend, luego aprobación `Who`, luego ficha del trabajador.

## Paquete de saneamiento ERP: datos útiles y rendimiento

- [x] Auditar desalineaciones reales entre código, esquema y datos vivos de contrataciones/reclutamiento
- [x] Crear una migración de saneamiento segura para normalizar requester data, recuperar `travel_methodology` desde auditoría cuando exista y agregar índices útiles
- [x] Reducir trabajo inútil del dashboard eliminando fetches no usados y código muerto asociado
- [x] Validar con consultas reales, TypeScript y build; dejar reglas permanentes en lecciones

## Resultado de paquete de saneamiento ERP: datos útiles y rendimiento

- La base viva se auditó contra el código y se confirmó que la suciedad real actual es acotada: un `requester_name` no canónico (`folio 0005`) y un histórico aprobado con `pasajes=true` pero sin `travel_methodology` (`folio 0007`).
- La migración `20260526_140000_erp_data_hygiene_and_dashboard_perf.sql` normaliza `requester_name/requester_email` desde `profiles`, intenta recuperar `travel_methodology` solo desde auditoría real, agrega índices útiles para aprobaciones y casos, y desactiva widgets operativos que ya no se usan (`AlertsWidget`, `KPIWidget`, `TimelineWidget`) limpiando además sus preferencias huérfanas.
- El dashboard dejó de arrastrar contrato y código muerto para notificaciones, alertas y KPIs no renderizados. Se simplificó `DashboardDataBundle`, se removieron fetches sin consumidor y se eliminaron componentes frontend sin uso.
- La validación quedó cerrada con consulta real a Supabase, `git diff --check`, `npx tsc -b` y `npm run build`.

## Exposición de error real en recuperación de contraseña

- [x] Revisar por qué la pantalla de login oculta el mensaje real de fallo al pedir recuperación
- [x] Mostrar el error devuelto por `sendPasswordReset` en vez de un mensaje genérico
- [x] Validar compilación y documentar la regla en lecciones

## Corrección de metodología de pasajes por etapa de aprobación

- [x] Revisar por qué el selector de metodología de pasajes aparece también en aprobaciones de área
- [x] Corregir el contrato de tareas y detalle de aprobación para exponer la etapa real (`step_code`)
- [x] Restringir la UI de metodología de pasajes solo a `contracts_control`
- [x] Validar compilación y documentar la regla en lecciones

## Seguimiento global de aprobaciones en dashboard

- [x] Diseñar una sección separada para folios pendientes de aprobación, ubicada entre `Tareas Pendientes` y `Folios en curso`
- [x] Publicar una RPC de seguimiento global de aprobaciones con acceso controlado desde backend
- [x] Integrar el nuevo bloque en el dashboard, con búsqueda y estado visible del folio en aprobación
- [x] Validar compilación y dejar la regla documentada en lecciones

## Corrección de bandeja personal de aprobaciones en dashboard

- [x] Revisar por qué un folio aprobado sigue visible en `Tareas Pendientes` para el administrador
- [x] Corregir `get_dashboard_tasks(...)` para que la bandeja muestre solo aprobaciones asignadas al usuario autenticado
- [x] Validar que el dashboard siga compilando y documentar la regla en lecciones

## Corrección de recuperación de contraseña en producción

- [x] Revisar el flujo de recuperación y descartar hardcodes a `localhost` en el repo
- [x] Hacer explícita la URL pública de la app mediante `VITE_PUBLIC_APP_URL`
- [x] Documentar la dependencia entre recuperación de contraseña, Cloudflare Pages y configuración de Supabase Auth

## Resultado de corrección de recuperación de contraseña en producción

- `sendPasswordReset` ahora prioriza `VITE_PUBLIC_APP_URL` para construir la URL de recuperación.
- Se documentó el despliegue con la variable `VITE_PUBLIC_APP_URL` y la validación de `Authentication > URL Configuration` en Supabase.
- El problema observado con `localhost:3000` queda identificado como desalineación de ambiente y no como una ruta hardcodeada activa en el repo.

## Resultado de corrección de bandeja personal de aprobaciones en dashboard

- La causa raíz identificada fue semántica: `get_dashboard_tasks(...)` mezclaba la bandeja personal con el bypass administrativo, por lo que un admin seguía viendo en pendientes el siguiente paso del mismo folio después de aprobar.
- La corrección mueve `Tareas Pendientes` a un contrato explícitamente personal: solo devuelve aprobaciones con `approver_user_id = p_user_id`.
- El bypass administrativo se mantiene para otras lecturas/acciones seguras, pero deja de contaminar la bandeja diaria del usuario.

## Resultado de seguimiento global de aprobaciones en dashboard

- El dashboard ahora separa explícitamente tres dominios: trabajo personal pendiente, seguimiento global de aprobaciones y folios ya abiertos en reclutamiento.
- `Seguimiento de aprobaciones` queda entre `Tareas Pendientes` y `Folios en curso`, con búsqueda propia y estado visible del paso actual.
- La nueva vista global no reusa la RPC personal de tareas; usa un contrato backend específico para evitar volver a mezclar bandeja personal con seguimiento transversal.

## Resultado de corrección de metodología de pasajes por etapa de aprobación

- La causa raíz fue un contrato incompleto: la UI solo recibía `pasajes = true`, pero no la etapa real de aprobación.
- `step_code` ahora queda expuesto en tareas y en el detalle de aprobación para que el frontend pueda distinguir `area_manager` de `contracts_control`.
- La selección de `metodología de pasajes` solo se muestra y exige en la etapa `contracts_control`, que es el comportamiento de negocio correcto.

## Resultado de exposición de error real en recuperación de contraseña

- La pantalla de login dejaba ciego el diagnóstico al reemplazar cualquier error de Supabase por un texto fijo.
- Ahora el flujo muestra el mensaje real devuelto por `sendPasswordReset`, lo que permite distinguir entre problemas de configuración de URLs, templates, correo o límites del proveedor.

## Resultado de paquete de saneamiento ERP: datos útiles y rendimiento

- Se normaliza `requester_name` y `requester_email` desde `profiles` cuando existe un vínculo real por `requester_id` o `submitted_by`, eliminando valores inconsistentes de baja calidad.
- `travel_methodology` solo se backfillea cuando ya existe en auditoría; no se inventan valores de negocio para históricos.
- Se agregan índices para las consultas críticas del flujo de aprobaciones y casos de reclutamiento, reduciendo scans evitables.
- El dashboard deja de consultar notificaciones que hoy no se muestran, reduciendo carga remota y líneas sin valor operativo.

## Ajuste puntual de acceso administrativo

- [x] Revisar el modelo actual de acceso administrativo (`profiles.is_super_admin` + `user_roles`)
- [x] Crear una migración de datos para equiparar el acceso de Maria Jesus con el administrador del sistema

## Resultado del ajuste puntual de acceso administrativo

- Se creó la migración [20260526_000100_grant_maria_jesus_admin_parity.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260526_000100_grant_maria_jesus_admin_parity.sql:1).
- La migración busca el perfil fuente de `Maximiliano Contreras Rey`, localiza el perfil destino de `Maria Jesus Lagos` o `Maria Jesus Lagos Minardi`, activa su perfil y replica sus roles activos.
- También iguala el flag `is_super_admin` para que el acceso efectivo quede en paridad con el administrador del sistema.

## Fase 2C: Ficha del Trabajador

- [x] Extender `candidate_profiles` solo con datos permanentes útiles para operación y pago
- [x] Crear `candidate_worker_files` ligada a `recruitment_case_candidates` para datos del ingreso actual
- [x] Publicar RPCs separadas para actualizar datos permanentes y ficha transaccional con validación por caso
- [x] Extender `get_recruitment_case_detail(...)` para devolver la ficha completa del candidato seleccionado
- [x] Agregar tercera pestaña `Ficha del candidato` en `CandidateDetailSidebar`
- [x] Validar compilación, build y dejar lecciones registradas

## Validación en vivo de historial de candidatos en BUK

- [x] Crear Supabase Edge Function `check_buk_candidate` para proteger `BUK_AUTH_TOKEN`.
- [x] Ajustar Frontend para consumir Edge Function y parsear respuestas correctamente.
- [x] Mostrar alerta visual automática 🔴/🟡 según estado del candidato en BUK.

## Mejoras de Rechazo e Historial en Control de Candidatos

- [x] **Alerta Histórica:** Crear función `find_candidate_profile_with_history_by_rut` para mostrar descartes previos en `CandidateIntakeForm`.
- [x] **Comentario Obligatorio:** Bloquear transición de base de datos y UI hacia etapa "Descartado" sin proveer un motivo claro en `HiringCandidatesView`.
- [x] **Rechazo Who Activo:** Crear `reject_candidate_stage_who` para permitir a gerencia rechazar antecedentes y descartar automáticamente con "Rechazado por Gerencia por antecedentes Who" en `TasksWidget` y el Sidebar de Detalle.

## Resultado de validación en vivo de historial de candidatos en BUK

- El alta de candidatos ya no depende solo del maestro local: `CandidateIntakeForm` consulta en paralelo el perfil interno por RUT y la Edge Function `check_buk_candidate`.
- La verificación contra BUK quedó encapsulada del lado servidor en [check_buk_candidate](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/check_buk_candidate/index.ts:1), protegiendo `BUK_AUTH_TOKEN` y evitando cualquier llamada directa del navegador a la API privada.
- Si el RUT ya existe en BUK, el formulario muestra una alerta visual inmediata diferenciando estado activo/inactivo, para que Reclutamiento detecte reingresos o riesgos antes de crear la participación.

## Resultado de mejoras de rechazo e historial en Control de Candidatos

- La búsqueda por RUT ahora usa `find_candidate_profile_with_history_by_rut(...)`, de modo que el reclutador ve descartes y retiros previos del mismo candidato antes de ingresarlo nuevamente al proceso.
- El descarte manual dejó de aceptar comentarios vacíos: la regla vive en la RPC `advance_recruitment_candidate_stage(...)` y cubre tanto `rejected` como `withdrawn`.
- La aprobación `Who` ya no solo se puede aprobar; también se puede rechazar desde la UI operativa mediante `reject_candidate_stage_who(...)`.
- El fix final del flujo `Who` corrigió dos puntos críticos de backend: el audit log ahora registra `candidate_stage_approval_rejected` en vez de reciclar el action type de aprobación, y el movimiento a `rejected` ocurre dentro de la propia RPC, sin delegar a una transición genérica que exigía otro dominio de permisos.

## Resultado de Fase 2C: Ficha del candidato

- La ficha quedó separada en dos capas útiles: datos personales persistentes en `candidate_profiles` y datos del ingreso actual en `candidate_worker_files`.
- La escritura se hace por dos RPCs seguras (`upsert_candidate_person_profile(...)` y `upsert_candidate_worker_file(...)`) usando `p_case_candidate_id` para validar acceso real al caso.
- El detalle del caso ahora devuelve toda la ficha del candidato dentro del mismo `get_recruitment_case_detail(...)`, evitando una segunda fuente de verdad para el sidebar.
- `CandidateDetailSidebar` ahora tiene una tercera pestaña `Ficha del candidato`, con guardado independiente para ficha personal y ficha del ingreso actual.
- La parte transaccional no crea filas vacías: si el bloque del ingreso actual se guarda completamente en blanco, la ficha asociada no persiste basura en `candidate_worker_files`.

## Plan de trabajo vigente: Reclutamiento y Operaciones Fase 2

- [x] Contrastar el plan externo con la arquitectura real del repo
- [x] Versionar un plan técnico corregido en [docs/reclutamiento-operaciones-fase2-plan.md](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/docs/reclutamiento-operaciones-fase2-plan.md:1)
- [x] Ejecutar Fase 2A: metodología de pasajes en aprobación final
- [ ] Ejecutar Fase 2B: nuevo pipeline de candidatos con aprobación `Who`
- [ ] Ejecutar Fase 2C: tercera pestaña `Ficha del Trabajador`

## Resultado de alineación del plan Fase 2

- El plan externo se mantuvo como intención funcional, pero se corrigió para aterrizarlo sobre la arquitectura real del sistema.
- No se implementarán componentes paralelos inexistentes como `CandidateBoard.tsx` o `CandidateDetailModal.tsx`; los cambios se montarán sobre `TasksWidget`, `ApprovalModal`, `HiringCandidatesView` y `CandidateDetailSidebar`.
- Se definió que `ready_for_hire` y `hired` siguen existiendo como etapas terminales, y que la aprobación `Who` debe llevar trazabilidad formal en backend.
- La `Ficha del Trabajador` quedó separada conceptualmente entre datos persistentes de persona y datos específicos de la postulación o ingreso actual.

## Resultado de Fase 2A: metodología de pasajes

- Se creó la migración [20260525_233500_add_travel_methodology_to_hiring_approval.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260525_233500_add_travel_methodology_to_hiring_approval.sql:1).
- `hiring_requests` ahora soporta `travel_methodology` con códigos estables de negocio.
- `decide_hiring_request_approval_v2(...)` exige metodología de pasajes cuando Control de Contratos aprueba un folio con `pasajes = true`.
- La exigencia quedó reflejada tanto en `ApprovalModal` como en `TasksWidget`, evitando bypass entre superficies de aprobación.
- La metodología también quedó expuesta en el detalle de aprobación y en el payload de tareas pendientes.

## Fase ERP Core 2: Permisos efectivos desde backend

- [x] Diseñar un contrato único de permisos efectivos basado en `auth.uid()`
- [x] Publicar una RPC que devuelva perfil, roles y módulos accesibles en una sola respuesta
- [x] Migrar `AuthContext` para consumir la RPC y dejar de reconstruir permisos con lecturas separadas
- [x] Remover derivaciones redundantes de permisos en el dashboard donde el backend ya resuelve acceso

## Resultado de Fase ERP Core 2: Permisos efectivos desde backend

- `AuthContext` ya no consulta `profiles`, `user_roles`, `app_modules` y `role_module_access` por separado para armar acceso.
- La nueva RPC [20260525_231500_get_my_effective_permissions.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260525_231500_get_my_effective_permissions.sql:1) devuelve el contrato efectivo de autorización para el usuario autenticado, usando `auth.uid()` como única identidad válida.
- El frontend conserva `access.ts` como capa de tipado y normalización, pero la autoridad operativa de roles y módulos queda centralizada en backend.
- El dashboard dejó de filtrar widgets por roles en cliente cuando la RPC ya entrega el catálogo resuelto para el usuario actual.

## Fase ERP Core 1: Estado remoto del dashboard

- [x] Instalar TanStack Query como base de estado asíncrono compartido
- [x] Envolver la aplicación con `QueryClientProvider`
- [x] Migrar `useDashboard` desde `useState + refresh()` manual a queries/mutations con invalidación
- [x] Dejar preparado el siguiente paso de permisos efectivos desde backend sin tocar todavía la lógica de acceso

## Resultado de Fase ERP Core 1: Estado remoto del dashboard

- El dashboard ya no depende de un ciclo manual de `useState + Promise.all + refresh()` para su carga principal.
- `useDashboard` ahora usa TanStack Query para resolver widgets, tareas, folios activos y notificaciones en una sola query con caché.
- Las preferencias de visibilidad de widgets ya usan mutation con update optimista e invalidación posterior.
- `main.tsx` quedó preparado con `QueryClientProvider` para extender el patrón a Reclutamiento, Operaciones y Certificados.

## Reparación ERP de Dashboard, Roles y Gobernanza

- [x] Alinear roles reales del frontend con los roles usados por dashboard y migraciones
- [x] Endurecer RPCs del dashboard para que validen `auth.uid()` y no acepten consultas impersonadas
- [x] Corregir el motor SQL del dashboard al esquema real de candidatos y documentos
- [x] Reemplazar estilos inline críticos y tipados laxos en widgets del dashboard por componentes reutilizables
- [x] Dejar migración versionada con grants y `notify pgrst` para convergencia segura entre ambientes

## Resultado de reparación ERP de Dashboard, Roles y Gobernanza

- `access.ts` ahora reconoce `operaciones` y `gerencia`, alineando el frontend con los roles ya usados por dashboard y por las migraciones.
- Se creó [20260525_140000_harden_dashboard_engine_and_roles.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260525_140000_harden_dashboard_engine_and_roles.sql:1) para:
  - publicar `get_dashboard_widgets_for_current_user()`
  - blindar `get_dashboard_tasks(...)`, `get_dashboard_alerts(...)` y `get_dashboard_kpis(...)` con validación de `auth.uid()`
  - corregir el uso de `candidate_profiles.full_name`
  - reemplazar estados inexistentes como `closed`
  - agregar grants explícitos y `notify pgrst, 'reload schema'`
- El dashboard dejó de depender de estructuras `any` para tareas, alertas e indicadores, y ahora usa contratos tipados en `src/modules/dashboard/types/`.
- Se extrajo `DashboardWidgetFrame` para reutilizar el contenedor y cabecera de widgets, reduciendo duplicación.
- `DashboardGrid` y los widgets críticos dejaron de depender de estilos inline para layout base, vacíos, prioridad y acciones.

## Reparación ERP de detalle de aprobaciones

- [x] Reemplazar lectura directa desde `hiring_request_approvals` por una RPC segura para el modal de detalle del folio
- [x] Publicar la RPC con `grant execute` y `notify pgrst`

## Resultado de reparación ERP de detalle de aprobaciones

- Se creó [20260525_161159_add_get_hiring_approval_detail_rpc.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260525_161159_add_get_hiring_approval_detail_rpc.sql:1) para centralizar el detalle del folio en `get_hiring_approval_detail(...)`.
- `getHiringApprovalDetails(...)` ya no consulta tablas operacionales directo desde el cliente; ahora usa la RPC y conserva el formato de error consistente.

## Ajuste ERP de layout del dashboard operativo

- [x] Expandir `Tareas Pendientes` a ancho completo para eliminar scroll horizontal innecesario
- [x] Reubicar `Alertas Operacionales` debajo de `Acciones Rápidas`
- [x] Eliminar `Actividad Reciente` del layout principal por falta de utilidad operacional directa

## Resultado de ajuste ERP de layout del dashboard operativo

- `Tareas Pendientes` pasa a ser la bandeja dominante del dashboard y usa todo el eje horizontal disponible.
- `Alertas Operacionales` deja de competir en la cabecera con la bandeja principal y baja a la columna secundaria junto a `Acciones Rápidas`.
- `Actividad Reciente` sale del dashboard para evitar ruido visual y widgets sin valor operativo inmediato.

## Ajuste ERP de legibilidad del dashboard operativo

- [x] Eliminar scroll horizontal de `Tareas Pendientes` ajustando el reparto interno de columnas
- [x] Limpiar el modal de aprobación removiendo el correo del solicitante
- [x] Aumentar la separación entre la bandeja principal y los widgets secundarios
- [x] Igualar visualmente la altura de `Indicadores Clave` y `Acciones Rápidas`

## Resultado de ajuste ERP de legibilidad del dashboard operativo

- `Tareas Pendientes` ahora distribuye mejor el espacio y muestra todo el contenido dentro del contenedor sin depender de scroll horizontal.
- El modal flotante del folio quedó más limpio al remover el correo del solicitante del bloque visible.
- La distancia vertical entre la bandeja principal y los widgets secundarios aumentó para reforzar jerarquía visual.
- `Indicadores Clave` y `Acciones Rápidas` se renderizan con una altura base equivalente para evitar desequilibrio visual.

## Ajuste ERP del inicio del dashboard

- [x] Eliminar el bloque superior `Centro Operacional • ...`
- [x] Remover `Alertas Operacionales` del inicio del dashboard

## Resultado de ajuste ERP del inicio del dashboard

- El dashboard abre con un encabezado más limpio, centrado en el saludo y el resumen operativo.
- `Alertas Operacionales` deja de ocupar espacio en el inicio, manteniendo el foco visual en `Tareas Pendientes`, `Indicadores Clave` y `Acciones Rápidas`.

## Reparación ERP de contrato de tareas del dashboard

- [x] Alinear `get_dashboard_tasks(...)` con el payload real que consume la tabla expandible
- [x] Restaurar `Indicadores Clave` en el layout secundario del dashboard
- [x] Tipar la tabla expandible de tareas y sacar estilos inline de las acciones integradas

## Resultado de reparación ERP de contrato de tareas del dashboard

- La bandeja `Tareas Pendientes` vuelve a mostrar la solicitud completa porque la RPC entrega folio, cargo, contrato, solicitante, cupos y fechas reales.
- `Indicadores Clave` reaparece en el dashboard como columna par de `Acciones Rápidas`.
- La tabla expandible de tareas quedó alineada a un contrato tipado y sin depender de estilos inline para el bloque de aprobación.

## Ajuste ERP de foco operativo del dashboard

- [x] Retirar `Indicadores Clave` del dashboard actual por falta de utilidad inmediata

## Resultado de ajuste ERP de foco operativo del dashboard

- El dashboard queda concentrado en `Tareas Pendientes` y `Acciones Rápidas`, sin reservar espacio para KPIs que hoy no soportan una decisión operativa directa.

## Separación ERP entre pendientes y folios activos

- [x] Dejar `Tareas Pendientes` solo con aprobaciones pendientes
- [x] Crear `Folios en curso` con búsqueda y formato expandible consistente
- [x] Reutilizar el detalle de caso real para que un folio aprobado baje de pendientes a la bandeja de activos

## Resultado de separación ERP entre pendientes y folios activos

- `Tareas Pendientes` ahora muestra solo solicitudes pendientes de aprobación.
- `Folios en curso` aparece como sección independiente con búsqueda y usa el mismo lenguaje visual de la bandeja principal.
- Al aprobar un folio, sale de pendientes y pasa a la bandeja de casos activos según el estado operativo que le corresponda.

## Ajuste ERP de jerarquía visual entre pendientes y folios activos

- [x] Mover `Folios en curso` inmediatamente debajo de `Tareas Pendientes`
- [x] Dejar `Acciones Rápidas` después de las dos bandejas operativas para no ocultar seguimiento real

## Resultado de ajuste ERP de jerarquía visual entre pendientes y folios activos

- `Folios en curso` ya no queda escondido debajo de widgets secundarios.
- El dashboard presenta primero trabajo pendiente de decisión y luego seguimiento de folios activos, que es la secuencia operacional correcta.

## Ajuste ERP de utilidad en bandeja de aprobaciones

- [x] Eliminar métricas de candidatos desde `Tareas Pendientes` porque una solicitud no aprobada aún no entra al funnel operativo
- [x] Compactar `Contrato / CC` en una sola línea para mejorar legibilidad de la bandeja
- [x] Exponer en el detalle de `Folios en curso` el comentario y trazabilidad de la decisión de aprobación

## Resultado de ajuste ERP de utilidad en bandeja de aprobaciones

- `Tareas Pendientes` ahora muestra solo información relevante para decidir la aprobación.
- El comentario ingresado al aprobar o rechazar deja de ser un dato oculto: queda visible luego en el detalle del folio activo junto con quién resolvió y cuándo.

## Ajuste ERP de continuidad entre aprobación y selección

- [x] Exponer la decisión de aprobación dentro del detalle de `Resumen de procesos de contratación`

## Resultado de ajuste ERP de continuidad entre aprobación y selección

- Reclutamiento puede ver en `Control de Contrataciones > Resumen de procesos de contratación` la etapa aprobada, la resolución, quién la tomó, cuándo y el comentario asociado, sin salir del flujo operativo.

## Ajuste ERP de aging para folios activos

- [x] Reemplazar la columna de solicitante por `Días Abierto` en `Folios en curso`

## Resultado de ajuste ERP de aging para folios activos

- `Folios en curso` ahora expone cuántos días lleva abierto cada folio desde la aprobación de Control de Contratos, usando `opened_at` como base operativa.

## Ajuste ERP de respiración visual entre módulos del dashboard

- [x] Aumentar la separación vertical entre `Tareas Pendientes`, `Folios en curso` y `Acciones Rápidas`

## Resultado de ajuste ERP de respiración visual entre módulos del dashboard

- El dashboard deja más aire entre bandejas operativas para que cada módulo se lea como bloque independiente y no como una sola masa continua.

## Corrección de separación visible entre módulos del dashboard

- [x] Reemplazar el espaciado sutil basado en variables por una separación explícita y mayor entre módulos principales

## Resultado de corrección de separación visible entre módulos del dashboard

- La separación entre `Tareas Pendientes`, `Folios en curso` y `Acciones Rápidas` ahora depende de un margen explícito entre bloques, para que la distancia se perciba claramente en pantalla.

## Corrección de consistencia de separación entre todos los módulos

- [x] Aplicar la misma clase de separación a `Tareas Pendientes`, `Folios en curso` y `Acciones Rápidas`

## Resultado de corrección de consistencia de separación entre todos los módulos

- Los tres bloques principales del dashboard ahora comparten la misma regla explícita de separación, en vez de depender de comportamiento implícito del grid.

## Corrección final de separación uniforme entre módulos principales

- [x] Reemplazar la separación basada en márgenes por `row-gap` explícito en el contenedor principal del dashboard

## Resultado de corrección final de separación uniforme entre módulos principales

- La distancia entre `Tareas Pendientes`, `Folios en curso` y `Acciones Rápidas` ahora la controla una sola regla de `row-gap`, evitando diferencias visuales entre bloques.

## Refinamientos estéticos y UX en el Dashboard

- [x] Ajustar estética de la tarjeta de Solicitud de Contrataciones reduciendo tamaño y grosor
- [x] Uniformar separación vertical (row-gap y margin-bottom a 18px) entre todos los módulos del Dashboard
- [x] Validar que no hay estilos inline y que CSS es elegante y consistente

## Eliminación completa del módulo de noticias externas

- [x] Eliminar componente frontend `DashboardNewsRow.tsx`
- [x] Eliminar import y uso de `DashboardNewsWidget` en `DashboardInfoCards.tsx`
- [x] Eliminar bloque CSS completo de `.dashboard-news-*` en `dashboard.css`
- [x] Eliminar script de sincronización `scripts/sync-gnews.mjs`
- [x] Eliminar flujo de GitHub Actions `.github/workflows/sync-gnews.yml`
- [x] Crear migración SQL para eliminar tabla `global_news`, función `get_home_news()`, policies e índices
- [x] Validar compilación y build sin vestigios de noticias

## Resultado de eliminación del módulo de noticias externas

- El ERP dejó de depender de una fuente externa (GNews API) para poblar el dashboard, alineándose con la directiva de mostrar solo información operativa interna.
- Se eliminaron los 3 archivos principales del módulo: componente React, script de sincronización y workflow de GitHub Actions.
- Se eliminaron ~145 líneas de CSS exclusivas del widget de noticias.
- La migración `20260530_110500_drop_global_news.sql` elimina la función `get_home_news()`, la policy de lectura, los índices y la tabla `global_news` de Supabase.
- La fila superior del dashboard queda con 2 tarjetas operativas (Clima y Cumpleaños) y espacio libre para futuras tarjetas internas.

Este documento lleva el control de las tareas técnicas orientadas a construir la plataforma según el **Mapa Operacional Maestro**.

## Roadmap Actual: Gobernanza y Estabilización

- [x] **Fase 1**: Refactor de Operaciones (Remover cambio contraseña inerte).
- [x] **Fase 1**: Seguridad Zero Trust (Protección de `public.profiles` en BD).
- [x] **Fase 2**: Higiene de Repositorio y Gobernanza (Documentación, limpieza de `.DS_Store`, orden de archivos en `docs/`).
- [x] **Fase 3**: Dashboard Interactivo (Modal de Aprobaciones aislado, Layout optimizado, Tareas vs Alertas).
- [x] **Fase 3**: Estabilización AuthContext (Control de bloqueos infinitos, timeouts de seguridad, Admin Override).

## Próximos Módulos (Backlog)

- [ ] **Módulo Certificados**: Iniciar refactorización y fragmentación de la vista monolítica `CertificatesPage.tsx` hacia una arquitectura modular (`src/modules/certificates/components/`).
- [ ] **Zero Trust para Operaciones**: Implementar una RPC segura (`submit_service_entry`) en base de datos para restringir la escritura directa a `service_entries` desde el frontend, validando los permisos del contrato en backend.

## Aterrizaje de ficha de candidato contra plantilla BUK

- [x] Auditar la hoja `Empleados` y `Listas` de la plantilla BUK y mapear brechas contra la ficha actual
- [x] Extender modelo y RPCs de ficha del candidato para soportar los campos BUK prioritarios sin romper el flujo actual
- [x] Adaptar la UI de `Ficha del candidato` por secciones coherentes con BUK, usando catálogos desplegables reales
- [x] Validar compilación y documentar el mapeo y restricciones detectadas

## Resultado de aterrizaje de ficha de candidato contra plantilla BUK

- La plantilla BUK quedó aterrizada como contrato operativo real de la ficha del candidato: se extrajeron los encabezados y catálogos del Excel a `src/modules/recruitment/lib/bukEmployeeTemplateData.json` y se expusieron vía `bukEmployeeTemplate.ts`.
- Se creó un flujo de lectura dedicado `get_candidate_buk_profile(...)` para no inflar `get_recruitment_case_detail(...)` con decenas de campos de onboarding y payroll que solo usa la ficha.
- `CandidateWorkerFileForm.tsx` ahora captura identidad, contacto, domicilio, estudios, inclusión, previsión, pagos y datos del ingreso actual en dos bloques claros: perfil persistente del candidato e ingreso transaccional del caso.
- Se versionó la migración `20260604_121500_align_candidate_buk_profile.sql` para extender `candidate_profiles`, `candidate_worker_files` y las RPCs `upsert_candidate_person_profile(...)` / `upsert_candidate_worker_file(...)` con el set BUK priorizado.
- La validación técnica local quedó cerrada con `git diff --check`, `npx tsc -b` y `npm run build`.


## Implementación de Modo Oscuro Premium y Refinamiento de UI

- [x] Agregar capacidad de alternar entre modo claro y oscuro desde la barra de navegación superior, persistiendo la preferencia en `localStorage`.
- [x] Sustituir colores duros globales (blancos puros y negros sólidos) por variables dinámicas semánticas (`--surface`, `--surface-soft`, `--text-muted`, `--title`).
- [x] Corregir la persistencia de widgets "brillantes" (blancos con opacidad o colores fijos) reemplazándolos con reglas de `[data-theme="dark"]` y variables RGB.
- [x] Resolver contrastes de tipografía en el módulo de Reclutamiento (widgets de seguimiento, detalles de fichas, chips de aprobación) que quedaban invisibles bajo fondo nocturno.
- [x] Corregir fallos de "flashes blancos" en efectos de `hover` y ajustar opacidades de componentes anidados.
- [x] Validar que el layout no se desarme por inserción de nuevos controles (solucionado grid layout de `top-shell-right`).

## Resultado de la Implementación de Modo Oscuro Premium

- La plataforma cuenta ahora con un interruptor orgánico para Modo Oscuro, que tiñe toda la interfaz con tonos azules de medianoche y no negro sólido (mejorando la legibilidad en ERP).
- Se auditaron y eliminaron decenas de colores estáticos (`#ffffff`, `#475467`, `rgba(31, 56, 106)`) dispersos en `global.css` y `dashboard.css`, asegurando que cada componente se ilumine o sombree automáticamente según la paleta elegida.
- La pantalla de "Control de Contrataciones" (tarjetas de KPI, panel lateral del candidato y grilla) soporta el tema oscuro manteniendo la estética de los "brillos" y "alertas semafóricas".
- Se documentó como lección que la legibilidad en modo oscuro no debe solucionarse parcheando componentes individuales, sino atacando la raíz de las variables CSS.

## Tab "Rechazados / Cerrados" en Resumen de Procesos

- [x] Identificar por qué folios rechazados y cerrados aparecían mezclados con folios activos en el resumen
- [x] Añadir el filtro "Rechazados / Cerrados" en `caseFilterOptions` de `hiringControlViewUtils.ts`
- [x] Exponer `hiring_request_status` en el payload de `get_recruitment_control_dashboard_v2` para poder filtrar por status en el frontend
- [x] Actualizar `filteredCases` y el rendering de etiquetas de estado en `HiringProcessesView.tsx`
- [x] Crear migración `20260608_000001_fix_dashboard_active_cases_filter.sql` con los cambios SQL correspondientes

## Resultado de Tab "Rechazados / Cerrados"

- El resumen de procesos ahora muestra los folios correctamente separados: activos en sus respectivas columnas y cerrados/rechazados solo en la nueva pestaña "Rechazados / Cerrados".
- La RPC `get_recruitment_control_dashboard_v2` fue actualizada para incluir el campo `hiring_request_status` y permitir que el frontend filtre por él.
- Los folios en estado `closed` o `rejected` solo aparecen en la nueva sección dedicada, y el estado mostrado refleja correctamente si es un rechazo del aprobador o un cierre.
- Migración aplicable en Supabase: `20260608_000001_fix_dashboard_active_cases_filter.sql`.

## Restricción estricta de cierre de folio con candidatos activos + Módulo de Traslado

- [x] Añadir bloqueo en `close_hiring_request` para impedir cerrar un folio que tenga candidatos activos (no contratados, no rechazados, no desistidos)
- [x] Crear RPC `transfer_candidate_to_case(p_case_candidate_id, p_target_case_id, p_comment)` para trasladar candidatos entre folios
- [x] Incluir en el traslado la migración de documentos (`candidate_documents`) y el registro de auditoría en ambos folios
- [x] Ampliar el `CHECK` constraint de `recruitment_case_audit_log.action_type` para incluir todos los tipos de acción del sistema
- [x] Añadir validaciones de seguridad: permisos sobre ambos casos, candidato no en etapa terminal, candidato no duplicado en destino, documentos sin conflicto de unicidad
- [x] Crear servicio frontend `transferCandidateToCase` en `hiringControl.ts`
- [x] Crear componente `TransferCandidateModal.tsx` con selector de folio destino y motivo opcional
- [x] Integrar el modal y el botón "Trasladar" en `HiringCandidatesView.tsx` y `CandidateDetailSidebar.tsx`
- [x] Corregir errores de la migración original antes de aplicar
- [x] Validar `npx tsc --noEmit` sin errores

## Resultado de Módulo de Traslado de Candidatos

- El sistema ahora bloquea a nivel de base de datos el cierre de un folio si existen candidatos activos, retornando un mensaje explícito que exige trasladarlos o descartarlos primero.
- La RPC `transfer_candidate_to_case(...)` mueve al candidato de un folio a otro de forma completamente atómica: cambia el `recruitment_case_id` en `recruitment_case_candidates` y en todos sus `candidate_documents`, preservando revisiones y aprobaciones documentales.
- La ficha del trabajador (`candidate_worker_files`) viaja automáticamente porque está enlazada por `recruitment_case_candidate_id`, sin requerir código adicional.
- Se registra trazabilidad completa: `candidate_transferred_out` en el folio origen y `candidate_transferred_in` en el folio destino.
- En la UI, el botón "Trasladar" aparece en el panel derecho del candidato siempre que este no esté en etapa terminal (contratado, rechazado, desistido).
- Las migraciones aplicables son `20260608_000001_fix_dashboard_active_cases_filter.sql` y `20260608_000002_add_transfer_candidate_rpc.sql`, en ese orden.
- Error crítico corregido antes de aplicar: el `CHECK` constraint de `action_type` no incluía los nuevos valores `candidate_transferred_out/in` ni los valores de migraciones anteriores como `document_uploaded`, `candidate_person_profile_updated`, etc.

## Warning preventivo al reasignar ciclos de jornada

- [x] Revisar cómo responde el backend cuando una nueva pauta se cruza con una asignación existente
- [x] Mostrar una tarjeta amarilla cuando una nueva pauta vaya a recortar la asignación vigente
- [x] Mostrar una tarjeta roja cuando el rango siga bloqueado por superposición real y no pueda guardarse
- [x] Reutilizar el estilo de warnings del sistema sin alterar la lógica SQL existente
- [x] Validar `npx tsc -b` y `git diff --check`

## Resultado de Warning preventivo al reasignar ciclos de jornada

- El modal de asignación de pauta ahora anticipa visualmente cuándo una nueva fecha de inicio cerrará la pauta activa el día anterior.
- Si la nueva asignación además deja un hueco posterior por tener fecha de término, el usuario lo ve antes de guardar.
- Cuando el rango elegido todavía colisiona con otra asignación ya existente, se muestra una tarjeta roja con el detalle de los tramos que bloquearán el guardado.
- No se modificó la lógica backend de `assign_hr_worker_roster(...)`; el cambio solo hace explícito en UI lo que el sistema ya aplica o rechaza.

## Reparación de contexto vacío al seleccionar trabajador en Incentivos

- [x] Auditar el contrato entre `search_hr_incentive_eligible_workers(...)` y `get_hr_incentive_worker_context(...)`
- [x] Corregir la búsqueda backend para que solo exponga trabajadores con contexto operativo resoluble
- [x] Hacer visible en el formulario el error de contexto en vez de dejar campos vacíos sin explicación
- [x] Validar `npx tsc -b` y `git diff --check`

## Resultado de reparación de contexto vacío al seleccionar trabajador en Incentivos

- La causa raíz fue un drift entre RPCs: el buscador de trabajadores de Incentivos permitía seleccionar empleados por cargo elegible aun cuando luego `get_hr_incentive_worker_context(...)` no podía resolverles un área operativa conciliada.
- Se agregó la migración [`20260615005000_align_hr_incentive_worker_search_with_context.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260615005000_align_hr_incentive_worker_search_with_context.sql:1), que vuelve a alinear `search_hr_incentive_eligible_workers(...)` con el mismo criterio operativo del contexto: mapeo BUK 1:1, contrato activo y cargo elegible.
- En [`IncentiveRegistrationForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRegistrationForm.tsx:1) ahora el RUT y cargo usan fallback del trabajador ya seleccionado mientras llega el contexto, el selector de contrato se bloquea explícitamente si la RPC falla y el usuario ve el error real en vez de un formulario silenciosamente vacío.

## Corrección de tipo en contexto de trabajador para Incentivos

- [x] Confirmar la causa raíz del error `invalid input syntax for type uuid` al seleccionar trabajadores en Incentivos
- [x] Corregir la RPC `get_hr_incentive_worker_context(...)` respetando el tipo real de `buk_contract_mappings.id`
- [x] Validar la RPC corregida en Supabase con un caso real y verificar que vuelvan sindicato y contrato operativo
- [x] Ejecutar `npx tsc -b`, `git diff --check`, commit y push a `main`

## Resultado de corrección de tipo en contexto de trabajador para Incentivos

- La caída ya no provenía del buscador, sino de una regresión introducida en la optimización masiva: `get_hr_incentive_worker_context(...)` intentaba castear `mapping_id` a `uuid` aunque `public.buk_contract_mappings.id` es `bigint`.
- Se versionó la reparación en [`20260615093000_fix_hr_incentive_worker_context_mapping_id_type.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260615093000_fix_hr_incentive_worker_context_mapping_id_type.sql:1), restaurando el contrato correcto sin alterar reglas de negocio ni la estructura del payload.
- La validación de humo sobre Supabase se hizo con el trabajador BUK `13529` (`Javier Alejandro Luna Herrera`) bajo un contexto `superadmin`, y la RPC volvió a entregar `Sindicato Codelco DMH`, `SERVICIO CODELCO DMH`, `CONT-028` y el listado de áreas sin el error de casteo.
- La corrección quedó publicada en `main` con el commit `39089d8`.

## Auditoría integral BUK -> Roster -> Incentivos previa a producción

- [x] Mapear las interacciones críticas que rescatan información de la sync BUK en roster e incentivos
- [x] Ejecutar pruebas de humo backend/frontend sobre la cadena completa: asignación de turno, lectura de calendario, preview/registro de incentivo y marcación de sobreturno
- [x] Reparar cualquier drift funcional o contractual detectado entre roster e incentivos
- [x] Validar con `npx tsc -b`, `npm run build`, `git diff --check`, queries de humo en Supabase y empujar a `main`

## Resultado de auditoría integral BUK -> Roster -> Incentivos previa a producción

- Se auditó la cadena completa `BUK -> search_hr_roster_workers/search_hr_incentive_eligible_workers -> get_worker_schedule/resolve_hr_roster_day_status -> get_hr_incentive_worker_context -> create_hr_incentive_request`, verificando en Supabase que un incentivo real en descanso (`folio 4`, trabajador BUK `13529`) sigue marcando correctamente `extra_shift` sobre el calendario operativo.
- La falla crítica detectada era de gobernanza y trazabilidad: backend ya persistía `exception_source = incentive_auto`, pero el frontend de Jornadas solo conocía `manual | buk` y degradaba ese origen automático a `manual`. Eso permitía mostrar, y potencialmente intentar intervenir, una marca generada por Incentivos como si fuera una excepción manual.
- Se versionó y aplicó la migración [`20260615113000_reconcile_roster_extra_shift_with_incentives.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260615113000_reconcile_roster_extra_shift_with_incentives.sql:1), que centraliza la reconciliación de `extra_shift` en [`reconcile_hr_roster_extra_shift_from_incentives(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260615113000_reconcile_roster_extra_shift_with_incentives.sql:3), bloquea edición manual de fechas gobernadas por incentivos y repara el ciclo de vida al cancelar o rechazar solicitudes para no dejar sobreturnos huérfanos en el calendario.
- En frontend, [`RosterPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster/pages/RosterPage.tsx:56), [`rosterApi.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster/services/rosterApi.ts:29) y [`types.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster/types.ts:10) quedaron alineados con el contrato real `manual | buk | incentive_auto`, mostrando `Gobernado por Incentivos` y bloqueando cambios inválidos desde Jornadas.
- La validación cerró con queries reales en Supabase bajo contexto `superadmin`, además de `git diff --check`, `npx tsc -b`, `npm run build` y `npm run audit:migrations`. También se backfilleó el historial remoto de migraciones para registrar la versión local `20260615113000` junto al apply remoto ya ejecutado.

## Estabilización enterprise SQL/RLS/contratos previa a producción

- [x] Eliminar credenciales `service_role` hardcodeadas del repositorio y agregar auditor de secret scanning para CI
- [x] Crear auditor SQL local para detectar grants amplios, helpers riesgosos, policies amplias de Storage y falta de `notify pgrst`
- [x] Encapsular escritura masiva de Operaciones en RPC transaccional `submit_service_entries_batch(...)`
- [x] Encapsular lecturas principales de Onboarding Operacional mediante RPCs y reducir grants directos de mutación
- [x] Endurecer `candidate-docs` con policies por path/caso usando helper backend
- [x] Agregar validadores de payload frontend para fallar explícitamente si RPCs críticas rompen contrato
- [x] Ejecutar validaciones locales: auditoría de seguridad, auditoría de migraciones, typecheck y build
- [ ] Rotar efectivamente la `service_role` en Supabase y actualizar secretos de runtime fuera del repositorio
- [x] Ejecutar smoke tests remotos mínimos después de aplicar la migración en Supabase

## Resultado de estabilización enterprise SQL/RLS/contratos previa a producción

- Se removieron scripts one-off con credenciales embebidas y se reemplazaron las credenciales hardcodeadas de `sync-doc.cjs` y `process-pdf.mjs` por variables de entorno obligatorias.
- Se agregó `scripts/audit-supabase-security.mjs` y se integró al workflow de migraciones para bloquear JWT `service_role` hardcodeado como hallazgo crítico.
- Se creó la migración `20260615220000_enterprise_security_contract_stabilization.sql` con RPC transaccional para Operaciones, RPCs de lectura para Onboarding Operacional, endurecimiento de policies de `candidate-docs`, revocación de mutaciones directas de onboarding y `notify pgrst`.
- Se movió la persistencia masiva de planificación operacional desde múltiples escrituras cliente-tabla hacia `submit_service_entries_batch(...)`, con validación backend de `auth.uid()`, contrato, servicio, equipo, payload e idempotencia por clave operacional.
- Se agregaron validadores explícitos en servicios frontend de Onboarding e Incentivos para que un contrato RPC roto falle temprano en vez de pintar datos vacíos o ceros.
- Validación local ejecutada: `node scripts/audit-supabase-security.mjs`, `npm run audit:migrations`, `npx tsc -b --pretty false`, `npm run build` y búsqueda directa de JWT hardcodeados.
- La migración fue aplicada en Supabase (`global_control_intern`, ref `pzblmbahnoyntrhistea`) mediante `apply_migration`, y los smokes remotos mínimos confirmaron: `anon` no ejecuta las RPCs nuevas, las RPCs de lectura de onboarding responden con `service_role`, y `submit_service_entries_batch(...)` bloquea llamadas sin `auth.uid()`.
- Pendiente operacional no resoluble solo por código: rotar la credencial `service_role` expuesta en Supabase antes de pasar a producción y ejecutar smokes remotos con usuarios reales por rol.

## Corrección de aprobadores por centro de costo y sync BUK de ausencias

- [x] Releer el Excel `bbdd-cecos.xlsx` y contrastar centros de costo activos contra `cost_center_approvers`
- [x] Provisionar usuarios/roles/aprobadores faltantes sin resetear contraseñas de usuarios existentes
- [x] Confirmar en Supabase que no queden contratos activos que disparen P0001 por aprobador faltante
- [x] Validar que el token BUK actualizado tenga acceso a `employees`, `vacations` y `absences`
- [x] Agregar sync BUK de vacaciones/licencias hacia `hr_roster_exceptions` usando la RPC canónica
- [x] Versionar el ajuste de `sync_hr_roster_exception_from_buk(...)` para permitir ejecución server-to-server con `service_role`
- [x] Aplicar la sync inicial de BUK para la ventana 2026-06-15 a 2026-12-15

## Resultado de corrección de aprobadores por centro de costo y sync BUK de ausencias

- La causa del P0001 en contratación era data operacional incompleta: el Excel sí contenía el gerente del centro `20114`, pero `cost_center_approvers` no tenía todos los centros activos provisionados. Se agregó [`scripts/provision-hiring-approvers-from-cecos.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/provision-hiring-approvers-from-cecos.mjs:1) para leer `Hoja1`/`Hoja2`, crear/actualizar identidades gerenciales, asignar `aprobador_folios` y vincular cada centro de costo.
- El provisioning fue aplicado en Supabase y la validación posterior confirmó `contractsStillMissingApprover: []`, por lo que no quedan contratos activos que deberían disparar el P0001 por aprobador faltante.
- Observaciones del Excel: `Jose Miardi Cueto` figura como gerente para centros asociados a contratos no activos/no bloqueantes pero no aparece en la hoja de usuarios; el centro `10111` aparece con dos gerentes distintos, lo que no rompe hoy el flujo activo pero debe resolverse si el negocio requiere aprobador por contrato/proyecto en vez de solo por centro.
- Se agregó [`scripts/sync-buk-roster-absences.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/sync-buk-roster-absences.mjs:1) y el workflow [`sync-buk-roster-absences.yml`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/.github/workflows/sync-buk-roster-absences.yml:1) para sincronizar vacaciones/licencias aprobadas desde BUK hacia Jornadas, preservando la jerarquía BUK sobre registros manuales.
- Se versionó y aplicó [`20260616023530_allow_service_role_buk_roster_exception_sync.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260616023530_allow_service_role_buk_roster_exception_sync.sql:1), que mantiene bloqueada la RPC para `anon/authenticated` común y habilita explícitamente el contexto `service_role` usado por automatizaciones server-to-server.
- La sync inicial procesó 14.401 registros BUK de vacaciones y 15.176 de ausencias; dentro de la ventana 2026-06-15 a 2026-12-15 aplicó 2.622 días oficiales sin fallas, omitió 46 días porque sus trabajadores no están activos/presentes en la base canónica y no tuvo limpiezas pendientes.

## Clickwrap AUP ISO 27001

- [x] Agregar `profiles.aup_accepted_at` como estado canónico de aceptación
- [x] Crear `security_audit_logs` con RLS, inserts controlados y sin políticas de update/delete
- [x] Implementar RPC `accept_aup_policy(...)` con log inalterable por trigger
- [x] Endurecer grants para que el cliente no tenga INSERT/UPDATE/DELETE directo sobre `security_audit_logs`
- [x] Extender `get_my_effective_permissions()` para exponer `aup_accepted_at` sin fetch adicional
- [x] Crear modal global bloqueante en `AppShell` con aceptar/cerrar sesión
- [x] Aplicar migración en Supabase y ejecutar smoke transaccional con rollback

## Resultado de Clickwrap AUP ISO 27001

- Se versionó y aplicó [`20260616130057_add_aup_clickwrap_audit.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260616130057_add_aup_clickwrap_audit.sql:1), agregando `aup_accepted_at`, tabla `security_audit_logs`, RLS, trigger de auditoría y RPC `accept_aup_policy(...)`. Luego [`20260616130905_harden_aup_audit_log_grants.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260616130905_harden_aup_audit_log_grants.sql:1) retiró INSERT/UPDATE/DELETE directo del cliente.
- La aceptación queda gobernada por backend: el frontend llama la RPC y el trigger registra `aup_accepted` aunque el cambio de columna ocurriera por otra ruta autorizada. No existen policies ni grants de `UPDATE`/`DELETE` sobre `security_audit_logs`, y el cliente tampoco tiene `INSERT` directo.
- [`AuthContext.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/auth/context/AuthContext.tsx:1) ahora incluye `aup_accepted_at` en el perfil y expone `acceptAupPolicy()` para actualizar estado local sin recargar ni duplicar llamadas de permisos.
- [`AupPolicyModal.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/auth/components/AupPolicyModal.tsx:1) se monta globalmente desde [`AppShell.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/layout/AppShell.tsx:1) cuando el usuario autenticado no ha aceptado la política, bloqueando navegación salvo aceptar o cerrar sesión.
- Smokes remotos ejecutados con rollback confirmaron que `accept_aup_policy(...)` marca el perfil, crea log `aup_accepted` y que `get_my_effective_permissions()` expone `profile.aup_accepted_at`.

## Migración total de gráficos a Apache ECharts

- [x] Eliminar `recharts` del árbol de dependencias y reemplazarlo por `echarts` + `echarts-for-react`
- [x] Retirar los wrappers compartidos `ChartSurface` / `ChartTooltip` basados en Recharts
- [x] Crear `EChartSurface` como wrapper único con carga diferida, estados de carga/vacío y tokens visuales del ERP
- [x] Migrar `Análisis de Incentivos` a opciones ECharts conservando filtros, KPIs, tooltips y clicks de drill-down
- [x] Reemplazar el showcase de Labs por `EChartsShowcase`
- [x] Validar que no queden vestigios de Recharts y ejecutar typecheck/build/diff

## Resultado de migración total de gráficos a Apache ECharts

- Se eliminó `recharts` de `package.json` y `package-lock.json`; el único motor gráfico activo del frontend queda en `echarts` / `echarts-for-react`.
- La capa compartida ahora vive en [`EChartSurface.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/charts/EChartSurface.tsx:1), que conserva el contrato de shell visual (`chart-shell`, loading y empty states), pero carga el motor gráfico de forma diferida para no penalizar el inicio de la app.
- [`IncentiveAnalyticsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveAnalyticsView.tsx:1) fue migrado a objetos `EChartsOption` para evolución, distribución por tipo, inversión por contrato y ranking apilado por trabajador. Se mantuvieron los filtros múltiples existentes y los clicks sobre período, tipo y contrato.
- [`LabsPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/labs/pages/LabsPage.tsx:1) ahora carga dinámicamente [`EChartsShowcase.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/labs/components/EChartsShowcase.tsx:1), eliminando el último componente Recharts del código fuente.

## Auditoría adicional de unicidad de folios de Incentivos por período

- [x] Auditar el esquema real de `hr_incentive_requests` y confirmar si `folio` ya tiene unicidad global o si falta endurecimiento estructural
- [x] Diseñar una guarda SQL reutilizable que audite integridad por `period_code` y detecte duplicidades/anomalías antes de exponer bandejas o reportes
- [x] Implementar la auditoría en una nueva migración y conectarla a los RPCs relevantes del módulo de Incentivos
- [x] Validar local/remoto con `npm run audit:migrations`, `npx tsc -b`, `git diff --check` y una query de humo sobre la función de auditoría
- [x] Documentar el cierre y la lección en `tasks/todo.md` y `tasks/lessons.md`

## Resultado de auditoría adicional de unicidad de folios de Incentivos por período

- `hr_incentive_requests.folio` ya estaba protegido por unicidad global desde el origen (`generated always as identity unique`), por lo que la capa extra no debía duplicar a ciegas ese `UNIQUE`, sino auditar integridad real por `period_code`.
- Se agregó la migración [`20260616225802_add_hr_incentive_period_folio_integrity_audit.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260616225802_add_hr_incentive_period_folio_integrity_audit.sql:1), aplicada además en Supabase y registrada en `supabase_migrations.schema_migrations`.
- La migración crea dos funciones nuevas: `audit_hr_incentive_period_folio_integrity(...)`, que expone anomalías auditables por período, y `assert_hr_incentive_period_folio_integrity(...)`, que aborta el flujo si detecta duplicidad de folio por período o desalineación entre `period_code` y el período calculado desde `service_date`.
- La auditoría quedó conectada de dos formas. Primero, como trigger `trg_hr_incentive_requests_period_integrity_audit` sobre `hr_incentive_requests` para revalidar automáticamente el período afectado en cada alta o cambio relevante. Segundo, como guarda previa en las RPCs `get_hr_incentive_requests(...)`, `get_hr_incentives_analytics(...)`, `get_hr_incentive_approval_queue()` y `get_hr_incentive_request_detail(...)`.
- La verificación remota cerró con `select count(*) as anomaly_count from public.audit_hr_incentive_period_folio_integrity(null);`, devolviendo `0`, y con `select public.assert_hr_incentive_period_folio_integrity(null);`, sin errores. Validación local complementaria: `npm run audit:migrations`, `npx tsc -b --pretty false` y `git diff --check`.

## Automatización BUK de Personal a Contratar

- [x] Revisar `implementation_plan.md` contra la estructura real del repo y la documentación oficial vigente de BUK
- [x] Aterrizar el plan corrigiendo brechas reales del contrato BUK (`location_id` obligatorio, `payment_period` obligatorio y validación explícita de permisos/token)
- [x] Implementar backend asíncrono: tabla `buk_sync_jobs`, RPC de encolado, payload canónico de candidato a BUK y Edge Function `sync-buk-candidates`
- [x] Extender la ficha BUK candidata y la checklist para cubrir campos obligatorios adicionales del alta automática
- [x] Implementar UI en `HiringPersonnelToHireView.tsx` y servicio `enqueueCandidatesToBuk(...)`
- [x] Crear script de validación de accesos BUK para empleados, localidades y documentos con diagnóstico explícito
- [x] Validar `npm run audit:migrations`, `npx tsc -b`, `git diff --check`, aplicar SQL/función remota si corresponde, commitear y pushear

## Resultado de automatización BUK de Personal a Contratar

- El plan original no era ejecutable tal como estaba: al contrastarlo con la documentación oficial de BUK aparecieron dos requisitos reales que faltaban en el modelo local, `location_id` y `payment_period`. En vez de empujar una integración incompleta, se aterrizó la arquitectura para resolverlos sin crear otra ficha paralela.
- Se agregó la migración [`20260616231219_add_buk_candidate_sync_queue.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260616231219_add_buk_candidate_sync_queue.sql:1), ya aplicada en Supabase y registrada en `supabase_migrations.schema_migrations`. La migración crea `buk_sync_jobs`, agrega `payment_period` a `candidate_worker_files`, redefine `upsert_candidate_worker_file(...)` y `get_candidate_buk_profile(...)`, y expone `enqueue_buk_generation(...)` junto con `get_candidate_buk_sync_payload(...)`.
- El enqueue ya no acepta candidatos ambiguos: solo encola candidatos contratados, con validación documental aprobada y con ficha personal/contractual BUK realmente completa. Si ya existe un job `pending/processing`, lo reutiliza; si el candidato ya fue generado con éxito en BUK, aborta para evitar duplicidades.
- En frontend, [`HiringPersonnelToHireView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringPersonnelToHireView.tsx:1) ahora agrega el botón `Generar en BUK`, y [`hiringControl.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:1) expone `enqueueCandidatesToBuk(...)`.
- La ficha contractual del candidato quedó extendida con `payment_period` en [`CandidateWorkerFileForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateWorkerFileForm.tsx:1), alineando la UI con el contrato que exige el alta automática.
- Se formalizó la creación del módulo `bi_analytics` en PostgreSQL (`app_modules` y `role_module_access`) a través de la migración `20260617022000_register_bi_analytics_module.sql`, garantizando que el backend dicte el acceso y eliminando hacks de UI.
- Se refactorizó la estética del panel de Inteligencia de Negocios para que los estilos CSS y el grid sean verdaderamente compactos, limpios y consistentes con el resto de la plataforma ERP.
- Se agregó la Edge Function [`sync-buk-candidates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1), desplegada en el proyecto `pzblmbahnoyntrhistea`. Esta función consume la cola, resuelve `location_id` contra `GET /locations`, crea al empleado en BUK, sube documentos aprobados al endpoint configurado y elimina los binarios originales desde `candidate-docs` cuando la subida fue exitosa.
- Se agregó el script [`scripts/validate-buk-token-access.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/validate-buk-token-access.mjs:1) para validar el token sobre `GET /employees`, `GET /locations` y, opcionalmente, `POST /employees` / `POST /employees/{id}/documents` cuando se entregan fixtures de escritura reales.
- Validación cerrada con `npm run audit:migrations`, `npx tsc -b --pretty false`, `npm run build`, `git diff --check`, aplicación remota de la migración, despliegue de la Edge Function y smoke HTTP real contra `sync-buk-candidates`, que respondió `200 {"processed":[]}` después de cargar `BUK_AUTH_TOKEN` como secret del proyecto.

## Despliegue de vistas analíticas BI BUK

- [x] Generar migración con vistas para Headcount, Presencia, Excepciones y Pipeline de Reclutamiento.
- [x] Ejecutar la migración asegurando el formato `security_invoker = true`, uso exclusivo de esquema `public.` y transacciones con `notify pgrst`.
- [x] Confirmar aplicación en la base de datos de producción (`pzblmbahnoyntrhistea`) y registro manual en `supabase_migrations.schema_migrations`.
- [x] Validar que todas las vistas cumplen la convención de lecciones y no contienen `search_path`.

## Resultado de despliegue de vistas analíticas BI BUK

- Se creó y aplicó la migración `20260617001200_add_buk_bi_analytics_views.sql`. Las 11 vistas materializan KPIs para cuadros de mando usando BUK data.
- Todas las vistas heredan explícitamente RLS a través de `with (security_invoker = true)` y referencian tablas `public.`, respetando el patrón estricto del repositorio.
- Se insertó la versión manualmente en `supabase_migrations.schema_migrations` debido a que la aplicación de la migración fue directa sobre el motor SQL de Supabase Pro, manteniendo íntegra la auditoría e historial del entorno de producción.

## Implementación de Dashboard BI (Inteligencia de Negocios) en Frontend

- [x] Crear estructura base para nuevo módulo `/bi` independiente de RRHH
- [x] Mapear tipos estrictos TypeScript contra los 11 *views* generados (`buk_bi_*`)
- [x] Implementar capa de servicios y abstracción de queries (`React Query`) con `staleTime` de 5 minutos
- [x] Desarrollar componentes visuales usando Apache ECharts respetando el diseño premium
- [x] Refactorizar la navegación, quitando Análisis de Incentivos de RRHH y reubicándolo en el nuevo Dashboard BI
- [x] Validar que `npx tsc -b` y build finalicen sin errores, asegurando que la refactorización fue exitosa

## Resultado de implementación de Dashboard BI en Frontend

- Se creó el módulo `src/modules/bi` bajo la ruta `/bi` y se añadieron vistas explícitas para "Analítica de Dotación" e "Incentivos".
- Las consultas a `buk_bi_*` fueron mapeadas mediante funciones tipadas en `biApi.ts` y envueltas en hooks `useBiQueries.ts`, garantizando que la caché en memoria alivie el tráfico a Supabase.
- Se retiró la pestaña analítica de `HumanResourcesDashboard.tsx` aislando el dominio de RRHH para dejarlo netamente transaccional.
- Se agregó un nuevo rol en `access.ts` (`bi_analytics`) para blindar el acceso gerencial al dashboard global de métricas.
- La compilación `npx tsc -b` certificó cero errores en tipos, cumpliendo la política de estrictez de la base de código.

## Revisión de estándar sobre ajustes UI recientes

- [x] Auditar los últimos cambios de BI e Incentivos ya integrados en `main` para detectar deuda de estándar o accesibilidad.
- [x] Eliminar estilos/hover inline evitables del filtro analítico de Incentivos y dejarlos gobernados por CSS del módulo.
- [x] Endurecer semántica mínima de navegación/acciones (`type="button"`, `aria-label`, `aria-current`) en la superficie BI/Incentivos.
- [x] Revalidar que TypeScript, build y el árbol git queden limpios tras el ajuste.

## Resultado de revisión de estándar sobre ajustes UI recientes

- La auditoría de los commits UI recientes no detectó regresiones funcionales, pero sí una deuda objetiva de estándar: el botón de limpiar filtros en analítica de Incentivos dependía de estilos inline y de mutación DOM por `onMouseEnter/onMouseLeave`.
- Se normalizó ese control en [`IncentiveAnalyticsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveAnalyticsView.tsx:578) y [`incentives.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/styles/incentives.css:249), dejando hover/focus gobernados por CSS del módulo y agregando `aria-label`.
- También se endureció la navegación de BI en [`BiDashboardPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/pages/BiDashboardPage.tsx:54) con `type="button"` y `aria-current`, evitando semántica ambigua si la vista vuelve a quedar embebida dentro de formularios o shells más complejos.

## Cirugía profunda de performance sobre bundle frontend

- [x] Auditar el árbol de carga real para detectar dependencias pesadas entrando al bundle base por imports eager o widgets globales.
- [x] Mover ORION y su renderer Markdown a carga diferida real, sin dejar `react-markdown` ni el widget global dentro del shell principal.
- [x] Reconciliar toda la superficie BI con el wrapper compartido `EChartSurface` para impedir imports directos de `echarts-for-react`.
- [x] Reemplazar el runtime gráfico por `echarts/core` modular y registrar solo charts/componentes efectivamente usados.
- [x] Endurecer `manualChunks` para separar `echarts`, `zrender` y el wrapper React, y validar que desaparezca el warning de chunks grandes.

## Resultado de cirugía profunda de performance sobre bundle frontend

- El bundle base dejó de arrastrar dependencias analíticas y de markdown: `ORIONWidget` ahora se carga vía `lazyWithRetry(...)` desde [`AppShell.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/layout/AppShell.tsx:19) y el render de mensajes Markdown quedó encapsulado en [`MarkdownRenderer.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/ai_assistant/components/MarkdownRenderer.tsx:1), evitando que `react-markdown` quede pegado al shell autenticado.
- Los cinco charts BI quedaron migrados al wrapper compartido [`EChartSurface`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/charts/EChartSurface.tsx:1), eliminando imports directos de `echarts-for-react` desde componentes de negocio y alineando BI con el mismo patrón ya usado por Incentivos y Labs.
- El runtime gráfico ahora usa [`echartsRuntime.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/charts/echartsRuntime.ts:1) con `echarts/core` y registro explícito de `bar`, `line`, `pie`, `gauge` y `funnel`, en vez del paquete completo.
- La configuración de Vite se endureció en [`vite.config.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/vite.config.ts:13) y su espejo [`vite.config.js`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/vite.config.js:12), separando `echarts-react-vendor`, `echarts-vendor` y `zrender-vendor`.
- La mejora quedó medida con build real. El chunk principal `index` bajó de aproximadamente `1,051.62 kB` a `54.47 kB`. El antiguo bloque gráfico monolítico se partió en `echarts-vendor 377.07 kB`, `zrender-vendor 174.81 kB` y `echarts-react-vendor 9.54 kB`. `npm run build` ya no emite el warning de chunks mayores a `500 kB`.

## Corrección de filtro BI de incentivos y limpieza de navegación

- [x] Corregir la lectura de opciones de tipos de incentivo en analítica BI contra el contrato SQL realmente vigente.
- [x] Mover Business Intelligence a un módulo principal independiente en la navegación superior, junto a Operaciones.
- [x] Eliminar Labs del routing, preload, navegación y artefactos de UI asociados.
- [x] Revalidar build y comportamiento general sin romper ECharts ni los módulos existentes.

## Resultado de corrección de filtro BI de incentivos y limpieza de navegación

- La causa raíz del filtro roto era un drift contractual: la versión vigente de [`get_hr_incentives_analytics(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260616225802_add_hr_incentive_period_folio_integrity_audit.sql:571) expone `filter_options.types`, pero el frontend en [`incentivesApi.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/services/incentivesApi.ts:393) todavía buscaba solo `filter_options.incentive_types`.
- Se endureció el mapper para aceptar ambos nombres (`types` y `incentive_types`), dejando compatibilidad hacia atrás y evitando que el dropdown de tipos quede vacío cuando la SQL vigente responde con el contrato nuevo.
- Business Intelligence quedó promovido a módulo principal en [`navigation.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/config/navigation.ts:28), con accesos directos a `Analítica de Dotación` y `Análisis de Incentivos`, separado de `Recursos Humanos`.
- Labs quedó extirpado del sistema: se removieron sus rutas/preload en [`AppRouter.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/router/AppRouter.tsx:1) y [`routeModules.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/router/routeModules.ts:1), y se eliminaron los artefactos [`src/modules/labs/pages/LabsPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/labs/pages/LabsPage.tsx:1) y [`src/modules/labs/components/EChartsShowcase.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/labs/components/EChartsShowcase.tsx:1).

## Ajuste final de orden en navegación superior

- [x] Reordenar los módulos top-level según la secuencia operacional solicitada.
- [x] Mover ORION al final del menú superior, ocupando la posición final antes reservada para Labs.
- [x] Verificar que el shell siga compilando y que el orden no dependa de inyecciones especiales fuera de `navigationModules`.

## Resultado de ajuste final de orden en navegación superior

- La barra superior quedó alineada al orden pedido: `Inicio -> Reclutamiento -> Recursos Humanos -> Operaciones -> Business Intelligence -> ORION`.
- [`navigation.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/config/navigation.ts:28) ahora declara `Recursos Humanos` antes de `Operaciones` y `Business Intelligence`, evitando que el orden dependa de cambios accidentales posteriores.
- En [`AppShell.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/layout/AppShell.tsx:408) ORION dejó de inyectarse antes de los módulos visibles y pasó al cierre real del menú, que era la intención funcional que antes cumplía Labs.

## Simplificación final de navegación BI

- [x] Eliminar el submenú superior duplicado de BI y dejar la navegación interna de la página como única superficie para cambiar entre Dotación e Incentivos.

## Resultado de simplificación final de navegación BI

- [`navigation.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/config/navigation.ts:82) ahora deja `Business Intelligence` como módulo simple que entra a `/bi/dotacion`, evitando duplicar en la barra superior las mismas dos vistas que ya existen como tabs/chips dentro del dashboard.

## Limpieza estructural adicional de código y build

- [x] Eliminar flags, ramas e iconos muertos que quedaron huérfanos tras la salida de Labs y la simplificación del top nav.
- [x] Evitar que `tsc -b` regenere `vite.config.js` como artefacto redundante en la raíz.
- [x] Mantener la tipificación del config de Vite sin arrastrar archivos espejo innecesarios.

## Resultado de limpieza estructural adicional de código y build

- Se removió la deuda declarativa de navegación en [`navigation.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/config/navigation.ts:7): `adminOnly` dejó de existir en `NavigationModule` y `flask` salió del union de `iconKey` porque ya no había ningún consumidor real tras eliminar Labs.
- [`AppShell.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/layout/AppShell.tsx:25) quedó más compacto al eliminar el `case "flask"` del render de iconos y la rama muerta que filtraba `module.adminOnly`.
- [`tsconfig.node.json`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/tsconfig.node.json:1) ahora emite solo declaraciones para `vite.config.ts`, evitando que el build vuelva a generar [`vite.config.js`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/vite.config.js:1) como duplicado ejecutable en la raíz.

## Implementación integral de Acreditación de Personas

- [x] Aterrizar el plan sobre contratos reales del repo, reutilizando `employees_active_current`, helpers de autorización, patrón de RPCs y navegación existente.
- [x] Crear la migración del módulo con tablas de acreditación, matriz de requisitos, auditoría, helper de acceso y registro en `app_modules` / `role_module_access`.
- [x] Implementar RPCs de lectura y mutación para dashboard, mantenedores, búsqueda de trabajadores, generación de requisitos y recálculo de estado.
- [x] Reutilizar la integración BUK existente para registrar/subir documentos de acreditación sin crear una segunda fuente persistente de archivos en Supabase.
- [x] Implementar el frontend `src/modules/accreditation` con vistas de Dashboard, Trabajadores y Configuración, conectado a los contratos backend reales.
- [x] Verificar integración con Jornadas y Turnos mostrando contexto vigente del trabajador cuando exista pauta activa o excepciones relevantes.
- [x] Validar `npm run audit:migrations`, `npx tsc -b`, `npm run build` y `git diff --check`, y documentar cierre y lecciones aprendidas.

## Resultado de implementación integral de Acreditación de Personas

- Se agregó la migración [`20260617103000_add_people_accreditation_module.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617103000_add_people_accreditation_module.sql:1), que formaliza el módulo `acreditacion_personas` sobre `employees_active_current` con tablas separadas para `accreditation_sites`, `accreditation_requirements`, `accreditation_matrix`, `worker_accreditations`, `worker_document_tracking` y `accreditation_audit_log`, además de helper de acceso, RLS, grants y alta en `app_modules` / `role_module_access`.
- El motor backend quedó encapsulado en RPCs reales de negocio: generación de requisitos (`generate_worker_requirements(...)`), recálculo transaccional (`recalculate_accreditation_status(...)`), mantenedores (`upsert_accreditation_*`), búsqueda bootstrap desde BUK activo (`search_accreditation_workers(...)`), dashboard (`get_accreditation_dashboard(...)`) y perfil detallado (`get_worker_accreditation_profile(...)`).
- La integración documental no abrió una segunda bodega persistente en Supabase. Se reutilizó el patrón BUK ya operativo creando la Edge Function [`upload-buk-accreditation-document`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/upload-buk-accreditation-document/index.ts:1), que sube el binario directo al endpoint de documentos del trabajador y devuelve solo metadatos para trazabilidad local.
- El frontend quedó desplegado en [`src/modules/accreditation`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/accreditation:1) con ruta [`/acreditacion/:view`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/router/AppRouter.tsx:1), navegación en Recursos Humanos y tres superficies: dashboard, trabajadores y configuración.
- La comunicación con Jornadas y Turnos quedó visible dentro de la ficha del trabajador. El perfil muestra jornada activa desde `hr_worker_rosters` y excepciones recientes desde `hr_roster_exceptions`, evitando que acreditación opere ciega respecto al contexto operacional real.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260617103000_add_people_accreditation_module.sql`, `npx tsc -b`, `npm run build` y `git diff --check`.

## Repliegue de Acreditaciones dentro de RRHH y refactor backend BI con snapshot histórico

- [x] Reubicar la ruta contractual y de navegación de `acreditacion_personas` bajo `Recursos Humanos`, manteniendo permisos propios y compatibilidad con enlaces existentes.
- [x] Diseñar la capa SQL de BI con snapshot diario inmutable, helpers de período y extracción canónica de ciudad/región/fecha de ingreso desde BUK.
- [x] Reemplazar las lecturas BI basadas en `views` estáticas por RPCs filtrables para overview, headcount, geografía, presencia, ausentismo, forecast y reclutamiento.
- [x] Ajustar la matemática mensual de ausentismo a la fórmula de Personal Equivalente solicitada y mover `hired_this_month` a BUK real.
- [x] Refactorizar `biApi.ts`, `useBiQueries.ts` y la superficie BI necesaria para que React Query recargue por filtros.
- [x] Validar `npm run audit:migrations`, `npx tsc -b`, `npm run build`, `git diff --check`, luego commit y push directo a `main`.

## Resultado de repliegue de Acreditaciones dentro de RRHH y refactor backend BI con snapshot histórico

- La ruta canónica del módulo quedó alineada a RRHH: `acreditacion_personas` ahora apunta a `/recursos-humanos/acreditacion`, [`navigation.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/config/navigation.ts:1) navega a esa ruta y [`AppRouter.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/router/AppRouter.tsx:1) conserva redirects desde `/acreditacion/*` para no romper enlaces históricos.
- Se agregó la migración [`20260617143000_refactor_bi_backend_with_filters_and_snapshots.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617143000_refactor_bi_backend_with_filters_and_snapshots.sql:1), que crea `buk_employees_daily_snapshot`, helpers de período/normalización y reemplaza la BI estática por RPCs filtrables, incluyendo `get_bi_headcount_by_city(...)`.
- La matemática mensual quedó endurecida en backend: `get_bi_exceptions_monthly(...)` y `get_bi_medical_leave_by_area(...)` calculan FTE equivalente con base 30 días y exponen `absenteeism_pct`, mientras `get_bi_workforce_overview(...)` mueve `hired_this_month` a fecha de ingreso real extraída desde BUK.
- El script [`sync-buk-employees.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/sync-buk-employees.mjs:1) ahora captura snapshot diario al cierre de la sync, dejando el histórico operativo alineado a la carga BUK sin depender solo de `pg_cron`.
- La capa frontend BI quedó conectada al contrato nuevo: [`biApi.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/services/biApi.ts:1) consume RPCs con filtros, [`useBiQueries.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/hooks/useBiQueries.ts:1) invalida por `queryKey` reactiva y el dashboard de [`BiDashboardPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/pages/BiDashboardPage.tsx:1) ya propaga `periodCode`, `contractCodes` y `jobTitles` a los widgets.

## Auditoría de commits recientes y corrección del buscador BUK en Acreditación

- [x] Auditar `tasks/todo.md`, `tasks/lessons.md`, los últimos 5 commits y sus migraciones relevantes para identificar riesgos reales de auditoría.
- [x] Corregir el buscador de trabajadores en Acreditación para que replique la semántica de búsqueda BUK usada por Incentivos y Movilidad Interna.
- [x] Validar `npm run audit:migrations`, `npx tsc -b`, `npm run build` y `git diff --check`, luego resumir hallazgos de auditoría.

## Resultado de auditoría de commits recientes y corrección del buscador BUK en Acreditación

- El buscador de [`AccreditationWorkersView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/accreditation/components/AccreditationWorkersView.tsx:1) dejó de depender obligatoriamente de una faena seleccionada. Ahora dispara búsqueda cuando existe faena o cuando el input tiene suficiente señal BUK (`>= 2` letras o `>= 4` dígitos de RUT).
- Se agregó la migración [`20260617101500_fix_accreditation_worker_search_alignment.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617101500_fix_accreditation_worker_search_alignment.sql:1), que redefine `search_accreditation_workers(...)` para reutilizar `build_buk_employee_name_search_key(...)`, soportar búsqueda por RUT normalizado y ordenar resultados con la misma lógica de prioridad que ya usa el resto del ecosistema BUK.
- La auditoría de commits detectó un hallazgo de proceso en [`3356754`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/.git/COMMIT_EDITMSG:1): aunque la intención fue reparar historial, el commit reescribió nombres de migraciones históricas ya congeladas. Hoy el auditor pasa, pero la acción sigue siendo delicada y no debe repetirse como patrón normal porque toca historia del árbol, no solo baseline o tooling.
- También se detectó una regresión de performance introducida por el mapa BI en [`d02b0d1`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/.git/COMMIT_EDITMSG:1): el componente había vuelto a importar `echarts` completo. Se corrigió reutilizando el runtime compartido y moviendo el GeoJSON a carga dinámica; el warning residual de build queda concentrado solo en el chunk `chile-*.js`, no en `BiDashboardPage`.

## Endurecimiento de catálogos en configuración de Acreditaciones

- [x] Auditar la pantalla de configuración para distinguir campos maestros que deben seguir libres de los campos que sí pueden colgarse de catálogos canónicos del ERP.
- [x] Convertir `Código contrato` y `Código área` en selects buscables alimentados desde contratos/CECOs reales, manteniendo compatibilidad con valores legacy ya guardados.
- [x] Exponer los nuevos catálogos desde la RPC de setup y versionar/aplicar la migración correspondiente en Supabase.
- [x] Validar migración, tipado, build y consistencia de diff antes del commit final.

## Resultado de endurecimiento de catálogos en configuración de Acreditaciones

- [`get_accreditation_setup_catalogs()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617225911_add_accreditation_setup_contract_area_catalogs.sql:1) ahora devuelve `contract_options` y `area_options` construidos desde [`public.contracts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260617225911_add_accreditation_setup_contract_area_catalogs.sql:1), con labels operativos y trazabilidad explícita del `area_code` ligado al contrato.
- [`AccreditationSettingsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/accreditation/components/AccreditationSettingsView.tsx:1) reemplazó los inputs libres de `Código contrato` y `Código área` por `SearchableSelectField`, reduciendo error humano en la configuración de faenas y autocompletando el área al seleccionar un contrato conocido.
- La UI conserva compatibilidad operativa con registros antiguos: si una faena ya guardó un `contract_code` o `area_code` que hoy no existe en el catálogo activo, el formulario lo sigue mostrando como opción manual en vez de romper la edición.
- Se mantuvieron como texto libre los campos de definición maestra (`Código`, `Nombre`, descripciones y códigos propios del requisito), porque no salen de un catálogo corporativo existente y convertirlos en listas habría degradado flexibilidad sin respaldo de fuente canónica.
- Cierre validado con `npm run audit:migrations -- --files supabase/migrations/20260617225911_add_accreditation_setup_contract_area_catalogs.sql`, `npx tsc -b`, `git diff --check` y `npx --yes supabase db push --linked --yes`.

## Reparación de sync BUK fallida por snapshot diario

- [x] Auditar el workflow y capturar el error real de la última corrida fallida.
- [x] Corregir la autorización de `capture_buk_employee_daily_snapshot(...)` para contexto `service_role` e interno server-to-server.
- [x] Endurecer el script `sync-buk-employees.mjs` para reintentar operaciones finales timeout-sensitive devueltas como `{ error }` por Supabase JS.
- [x] Aplicar la migración en Supabase y verificar la sync completa con ejecución real local.

## Resultado de reparación de sync BUK fallida por snapshot diario

- La corrida fallida [`27732317190`](https://github.com/maxcontrerasrey-spec/app_test_1/actions/runs/27732317190) no estaba rompiendo en BUK ni en los upserts de empleados: procesó las 53 páginas y cayó al cierre con `P0001: Sin permisos para capturar snapshot diario BUK`.
- La migración [`20260618041437_allow_internal_context_for_buk_snapshot.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260618041437_allow_internal_context_for_buk_snapshot.sql:1) endurece `current_request_has_service_role()` para leer `request.jwt.claim.role` o `request.jwt.claims`, y permite que `capture_buk_employee_daily_snapshot(...)` acepte contexto interno sin claims del mismo modo que otras syncs server-to-server del ERP.
- [`sync-buk-employees.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/sync-buk-employees.mjs:1) ya no depende de una RPC masiva al final para construir el snapshot BI. Ahora persiste `buk_employees_daily_snapshot` por página en el mismo loop paginado de empleados, mantiene retry real sobre `result.error` para timeouts `57014` y deja los contadores finales en modo informativo con `count: "planned"`.
- La verificación real cerró completa: una llamada aislada a `capture_buk_employee_daily_snapshot('2026-06-18')` devolvió `5218`, y la sync manual completa terminó con `pagesProcessed: 53`, `synced: 5218`, `finalCount: 5218`, `activeCount: 1586` y `snapshotRowsAffected: 5218`.

## Reparación del disparo automático en la generación BUK de candidatos

- [x] Auditar el flujo real de `Generar en BUK` entre frontend, RPC `enqueue_buk_generation(...)`, cola `buk_sync_jobs` y Edge Function `sync-buk-candidates`.
- [x] Corregir el flujo para que la UI no marque éxito cuando solo se encoló el job, sino cuando además se haya intentado ejecutar la sincronización.
- [x] Validar el estado remoto de `buk_sync_jobs`, la disponibilidad de la Edge Function y el tipado frontend antes del commit final.

## Resultado de reparación del disparo automático en la generación BUK de candidatos

- La auditoría viva confirmó que la observación principal era correcta: la UI de [`HiringPersonnelToHireView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringPersonnelToHireView.tsx:1) llamaba solo a [`enqueue_buk_generation(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260616231219_add_buk_candidate_sync_queue.sql:692), pero nunca despertaba la Edge Function [`sync-buk-candidates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/sync-buk-candidates/index.ts:1). En producción, `public.buk_sync_jobs` estaba vacía al momento de la revisión, lo que confirma que el problema no era un backlog atascado sino una brecha de orquestación.
- [`generateCandidatesInBuk(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:1016) ahora encapsula el flujo completo: primero encola los candidatos y luego invoca `sync-buk-candidates` con los `jobIds` recién creados. Si la ejecución automática falla, la UI ya no reporta “éxito”; devuelve un mensaje explícito de job encolado pero no procesado.
- [`HiringPersonnelToHireView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringPersonnelToHireView.tsx:1) cambió el contrato de feedback: diferencia entre encolado, procesamiento efectivo, jobs ya en curso y errores devueltos por la Edge Function, evitando falsos positivos operacionales en el botón `Generar en BUK`.
- Validación cerrada con consulta remota a `public.buk_sync_jobs`, confirmación de despliegue activo de `sync-buk-candidates`, `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.

## Limpieza y optimización segura de frontend transversal

- [x] Auditar hotspots reales de redundancia, estilos inline y tipado laxo antes de tocar módulos críticos.
- [x] Compactar lógica duplicada de sorting y estados visuales en vistas operativas sin alterar contratos de negocio.
- [x] Eliminar líneas muertas y mover estilos repetidos a CSS compartido para reducir ruido de mantenimiento.
- [x] Validar con `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`, luego commit y push a `main`.

## Resultado de limpieza y optimización segura de frontend transversal

- [`IncentiveApprovalsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveApprovalsView.tsx:1) dejó de usar `any` en sorting, centralizó columnas ordenables en una sola constante y eliminó varias celdas/estilos inline repetidos del detalle expandido.
- [`HiringProcessesView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringProcessesView.tsx:1) consolidó el contrato de ordenamiento en helpers reutilizables y dejó de repetir manualmente cada `<th>` sortable.
- [`AIKnowledgePanel.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/ai_assistant/components/AIKnowledgePanel.tsx:1) eliminó un `pathName` muerto, reemplazó `catch (err: any)` por manejo seguro de errores y descargó estados visuales al CSS del módulo.
- [`global.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/styles/global.css:1) y [`ai-assistant.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/ai_assistant/styles/ai-assistant.css:1) absorbieron los estilos compartidos nuevos para evitar lógica visual inline dispersa entre vistas.
- El cierre técnico pasó con `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`, dejando esta pasada lista para versionar junto con la migración SQL pendiente de endurecimiento.

## Dashboard BI de Reclutamiento y alineación de scope contractual

- [x] Auditar el contrato actual de BI para no mezclar filtros de dotación por `area_name` con métricas de reclutamiento/movilidad aún atadas a nombres o códigos inconsistentes.
- [x] Incorporar una nueva vista `Reclutamiento` en Business Intelligence, reutilizando filtros existentes y agregando métricas ejecutivas de folios, candidatos, aprobaciones y movilidad interna.
- [x] Versionar y aplicar en Supabase las RPCs necesarias para que la nueva vista respete visibilidad por solicitante/CECO y soporte filtros operacionales por contrato y cargo.
- [x] Validar el cierre con `npm run audit:migrations`, `npx tsc -b`, `npm run build:frontend-check`, `git diff --check`, `supabase db push --linked` y consultas directas a las RPCs sobre la base remota.

## Resultado de dashboard BI de Reclutamiento y alineación de scope contractual

- [`BiDashboardPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/pages/BiDashboardPage.tsx:1) ahora expone una tercera vista `Reclutamiento` junto a `Analítica de Dotación (BUK)` y `Análisis de Incentivos`, reutilizando la misma barra de filtros por período, contrato y cargo para mantener una navegación BI consistente.
- Se agregó [`BiRecruitmentAnalyticsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/components/BiRecruitmentAnalyticsView.tsx:1), que concentra KPIs y gráficos para folios abiertos, casos activos, cupos solicitados, candidatos en curso, SLA de aprobación, responsables con mayor demora, movilidad interna y pulso semanal del período.
- [`biApi.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/services/biApi.ts:1), [`useBiQueries.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/hooks/useBiQueries.ts:1) y [`types/index.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/bi/types/index.ts:1) incorporaron el contrato tipado `get_bi_recruitment_dashboard(...)`, evitando parseo implícito o gráficos colgados de JSON sin shape validado.
- La primera migración [`20260624001734_add_bi_recruitment_dashboard.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260624001734_add_bi_recruitment_dashboard.sql:1) introdujo la nueva RPC BI y además alineó `get_bi_recruitment_pipeline(...)` y `get_bi_hiring_velocity(...)` para usar el mismo matching operacional por `normalize_buk_area_name(...)` y el mismo scope visible del proceso de contratación.
- La validación runtime encontró una deriva real en agregaciones con `FILTER`, por lo que se corrigió de forma auditable con la migración incremental [`20260624002636_fix_bi_recruitment_dashboard_runtime.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260624002636_fix_bi_recruitment_dashboard_runtime.sql:1). Esa segunda pasada también reemplazó un timeline cartesiano por subconsultas semanales correlacionadas para no inflar conteos ni degradar performance.
- Quedó verificado en Supabase remoto que `get_bi_recruitment_dashboard(...)` devuelve payload real y que `get_bi_recruitment_pipeline(...)` sigue respondiendo bajo el mismo usuario autenticado de prueba (`set_config('request.jwt.claim.sub', ...)`), además de `supabase migration list --linked` sin deriva entre local y remoto.

## Optimización y corrección de métricas BI/Reclutamiento del 23-06-2026

- [x] Incorporar `Candidatos en curso` en Control de Candidatos y Dashboard, excluyendo descartados, rechazados, contratados y folios cerrados.
- [x] Reemplazar los filtros de Reclutamiento BI por `Gerencias` y `Contratos`, con opciones dependientes calculadas en backend.
- [x] Corregir el universo de folios abiertos y KPIs para que no dependa de listas operacionales truncadas.
- [x] Igualar dimensiones de tarjetas, ordenar las métricas de movilidad y retirar los dos tiempos solicitados.
- [x] Sustituir la agregación cliente de reclutamiento y movilidad por una RPC agregada, autorizada e indexada.
- [x] Reutilizar el caché TanStack Query en expansiones y reducir polling redundante cuando existe Realtime.
- [x] Aplicar y versionar las migraciones, ejecutar pruebas remotas, typecheck, build, auditor de migraciones y revisión de diff.

## Resultado de optimización y corrección de métricas BI/Reclutamiento

- `get_bi_recruitment_dashboard(...)` ahora agrega el universo completo autorizado en PostgreSQL y devuelve `54` folios abiertos y `46` candidatos en curso; la cifra anterior de `60` provenía de mezclar estados cerrados/rechazados dentro de una lista limitada.
- La vista BI de Reclutamiento carga una sola respuesta agregada, con filtros por gerencia y contrato, en lugar de descargar candidatos, folios y movilidades con datos personales para agregarlos en el navegador.
- Las tarjetas quedaron separadas en seis KPIs primarios y cuatro de movilidad, con altura uniforme y el orden solicitado: total, ejecutadas, pendientes RRHH y pendientes de aprobación.
- El dashboard de Inicio reutiliza su resumen operacional para los contadores y las expansiones comparten el caché de detalle de React Query; los pollings de respaldo pasan de 30 segundos a 5 minutos porque ambos dominios ya usan Realtime.
- La migración `20260624021807_optimize_recruitment_bi_metrics_and_filters.sql` quedó aplicada y alineada en Supabase. El smoke remoto confirmó los valores productivos y un `EXPLAIN ANALYZE` redujo la consulta BI de aproximadamente `68 ms / 4.747 shared hits`, más una segunda llamada de movilidad, a aproximadamente `33 ms / 2.792 shared hits` en una sola RPC.
- La auditoría SQL detectó además contratos legacy previos a esta entrega. Se versionó `20260624023707_repair_legacy_sql_contracts_found_by_lint.sql` para retirar dos RPCs obsoletas y restaurar `user_contracts`; persiste como hallazgo independiente que Operaciones fue incorporado sin versionar las tablas `base_services`, `equipment` y `service_entries`, por lo que no se inventaron datos maestros para ocultarlo.

## Endurecimiento de escala y multiaprobación para Incentivos Extraordinarios

- [x] Contrastar la auditoría adjunta contra el contrato real de Incentivos para separar riesgos vigentes de hallazgos ya corregidos por migraciones previas.
- [x] Eliminar del hot path las auditorías de integridad costosas en `get_hr_incentive_requests`, `get_hr_incentive_approval_queue`, `get_hr_incentive_request_detail` y `get_hr_incentives_analytics`, reemplazándolas por invariantes baratos y verificables en base.
- [x] Versionar una migración que añada paginación server-side e índices de soporte para historial y bandeja de aprobaciones, manteniendo compatibilidad operacional con exportación y multiaprobación secuencial.
- [x] Refactorizar el frontend de Incentivos para consumir páginas, mover la búsqueda pesada al backend, reducir polling redundante y evitar render masivo del dataset completo en el DOM.
- [x] Aplicar la migración en Supabase, validar humo SQL, `npx tsc -b --pretty false`, `npm run build:frontend-check`, `npm run audit:migrations`, `git diff --check` y documentar el resultado final aquí y en `tasks/lessons.md`.

## Resultado de endurecimiento de escala y multiaprobación para Incentivos Extraordinarios

- La auditoría externa sí apuntaba a dos problemas reales del módulo: demasiada lógica de integridad ejecutándose dentro de cada RPC de lectura y bandejas que cargaban el dataset completo para luego filtrar/sortear en React. Ese diseño no escala bien a miles de incentivos por período ni a una cola de aprobación secuencial operada por múltiples usuarios.
- Se dejó versionada y aplicada en Supabase la migración [`20260624184559_scale_hr_incentives_pagination_and_integrity.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260624184559_scale_hr_incentives_pagination_and_integrity.sql:1), que hace cuatro cosas estructurales:
  1. elimina del hot path los `perform assert_hr_incentive_period_folio_integrity(...)` en historial, cola, analítica y detalle, dejando la auditoría como verificación explícita y no como costo fijo por consulta;
  2. endurece invariantes productivos baratos en base: `period_code` alineado a `service_date`, aprobaciones pendientes siempre con `approver_user_id`, un único pendiente por solicitud y snapshot persistido del gerente de área;
  3. corrige la multiaprobación secuencial para congelar el aprobador de segunda etapa al crear la solicitud y autoaprobar esa segunda etapa cuando administrador de contrato y gerente de área resultan ser la misma persona;
  4. agrega índices de soporte y RPCs paginadas (`get_hr_incentive_requests` y `get_hr_incentive_approval_queue`) con búsqueda y ordenamiento server-side.
- En frontend, [`IncentiveRequestsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRequestsView.tsx:1) y [`IncentiveApprovalsView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveApprovalsView.tsx:1) dejaron de cargar y ordenar todo el universo en memoria. Ahora consumen páginas de 50 registros, debounced search, orden server-side y paginación explícita, manteniendo exportación masiva solo como acción puntual y no como patrón permanente de lectura.
- También se redujo la presión de refresco en vivo desde [`HumanResourcesDashboard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/pages/HumanResourcesDashboard.tsx:1): las suscripciones Realtime ahora se acotan por vista activa y el polling de respaldo pasa a 5 minutos, evitando invalidaciones globales innecesarias sobre todo el módulo.
- Validación cerrada con:
  1. `npx tsc -b --pretty false`
  2. `npm run build:frontend-check`
  3. `npm run audit:migrations -- --files supabase/migrations/20260624184559_scale_hr_incentives_pagination_and_integrity.sql`
  4. `npx --yes supabase db push --linked --include-all`
  5. `npx --yes supabase migration list --linked`
  6. humo remoto vía service role: `audit_hr_incentive_period_folio_integrity(null) = 0`, `pendingWithoutApprover = 0`, `multiPendingRequests = 0`, `missingAreaManagerSnapshots = 0`.

## Ejecución de auditoría de líneas de código y compactación shared-first

- [x] Revisar `auditoria_lineas_codigo.md` contra el estado real del repo para separar hallazgos vigentes de infraestructura ya existente.
- [x] Centralizar la búsqueda de trabajadores en un único `WorkerLookupField` reutilizable sin cambiar contratos de hooks ni UX operativa.
- [x] Unificar tipos base de trabajadores BUK en `src/shared/types/buk.ts` y reconectar los módulos de incentivos, movilidad interna y roster.
- [x] Migrar instancias locales de `Intl` a `src/shared/lib/format.ts` y absorber el formateo restante de clima, onboarding, reclutamiento e incentivos.
- [x] Eliminar duplicación de sombras/fondos en dashboard reutilizando la superficie neumórfica ya existente en vez de abrir otra capa de CSS.
- [x] Validar con `npx tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check` antes de commitear y subir a `main`.

## Resultado de auditoría de líneas de código y compactación shared-first

- La auditoría quedó aterrizada sobre el código vivo, no sobre una lectura genérica del repo. El hallazgo de sombras duplicadas no justificaba inventar otra primitive porque [`SoftSurface`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/layout/SoftSurface.tsx:1) y las utilidades `soft-surface` ya existían; la corrección útil fue recortar reglas repetidas en [`dashboard.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/styles/dashboard.css:1) para que los cards vuelvan a depender de la superficie compartida.
- Los tres lookups locales se compactaron sobre [`WorkerLookupField.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/forms/WorkerLookupField.tsx:1) y ahora [`IncentiveWorkerLookup.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveWorkerLookup.tsx:1), [`InternalMobilityWorkerLookup.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/internal_mobility/components/InternalMobilityWorkerLookup.tsx:1) y [`RosterWorkerLookup.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/roster/components/RosterWorkerLookup.tsx:1) solo aportan la semántica específica de cada módulo.
- Se versionó el modelo compartido [`src/shared/types/buk.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/types/buk.ts:1) y los tipos `HrIncentiveEligibleWorker`, `InternalMobilityEligibleWorker` y `RosterWorkerSearchItem` dejaron de redefinir la misma identidad base del trabajador BUK.
- [`src/shared/lib/format.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/lib/format.ts:1) ahora concentra número, porcentaje, moneda compacta, fecha, fecha-hora y weekday corto. Esa pasada eliminó instancias locales de `Intl` en dashboard, incentivos, onboarding y reclutamiento, reduciendo ruido y evitando crear formatters ad-hoc en renders densos.
- Esta compactación fue deliberadamente shared-first y de impacto acotado: se redujo duplicación donde ya había contrato repetido, pero se evitó “sobrecompactar” vistas con comportamiento distinto solo para bajar líneas artificialmente.

## Alineación de acreditación con sync diferida BUK y purga documental de candidatos terminales

- [x] Confirmar si la carga documental Buk permite ruta/carpeta destino y separar ese hallazgo del modo de sincronización deseado por operación.
- [x] Definir que acreditación no debe sincronizar a Buk por cada upload si el objetivo es evitar latencia en la carga operativa.
- [x] Implementar limpieza automática y auditable de `candidate-docs` cuando un candidato pase a `rejected` o `withdrawn`.
- [x] Validar `TypeScript`, build frontend y `git diff --check`.

## Resultado de alineación de acreditación con sync diferida BUK y purga documental de candidatos terminales

- El `apidocs` real de Buk confirmó que `POST /employees/{id}/docs` acepta `path`, por lo que la carpeta destino `acreditacion/...` es viable; pero el modo correcto para este ERP no es subir a Buk por cada documento si eso castiga la experiencia operativa. La sincronización de acreditación debe resolverse por cola diferida o corte explícito, no como side effect inmediato de cada carga.
- Se versionó la migración [`20260627184500_queue_terminal_candidate_document_cleanup.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627184500_queue_terminal_candidate_document_cleanup.sql:1), que agrega la cola `candidate_document_cleanup_jobs`, encola la purga automáticamente dentro de [`advance_recruitment_candidate_stage(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627184500_queue_terminal_candidate_document_cleanup.sql:117) cuando el candidato pasa a `rejected` o `withdrawn`, y deja el proceso auditable.
- La Edge Function [`purge-candidate-documents`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/purge-candidate-documents/index.ts:1) quedó endurecida para ejecución interna segura por webhook secreto, barrido nocturno de candidatos terminales con documentos remanentes y reproceso de jobs en `error`, además de la purga física en `candidate-docs` y la auditoría `candidate_documents_purged`.
- Se agregó la migración [`20260627195500_allow_candidate_document_purge_audit_log.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627195500_allow_candidate_document_purge_audit_log.sql:1) para extender el `CHECK` de `recruitment_case_audit_log` y permitir el evento de purga documental sin fallar en runtime.
- El scheduler quedó versionado en [`scripts/purge-terminal-candidate-documents.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/purge-terminal-candidate-documents.mjs:1) y [`.github/workflows/purge-terminal-candidate-documents.yml`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/.github/workflows/purge-terminal-candidate-documents.yml:1), con doble ventana UTC para respetar `22:00` en `America/Santiago`.
- [`HiringStatusPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringStatusPage.tsx:1) ya no intenta ejecutar la purga en el click del usuario; la etapa terminal queda actualizada al instante y la limpieza pasa a ser una regla automática nocturna.
- El cierre remoto quedó ejecutado y verificado el 27-06-2026: `npx supabase db push --linked --include-all` aplicó [`20260627184500_queue_terminal_candidate_document_cleanup.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627184500_queue_terminal_candidate_document_cleanup.sql:1) y [`20260627195500_allow_candidate_document_purge_audit_log.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627195500_allow_candidate_document_purge_audit_log.sql:1), `npx supabase functions deploy purge-candidate-documents` publicó la function, y el secreto `CANDIDATE_DOCUMENT_CLEANUP_WEBHOOK_SECRET` quedó cargado tanto en Supabase como en GitHub Actions. La prueba de humo `node scripts/purge-terminal-candidate-documents.mjs --limit 5` respondió `ok: true`, `mode: internal`.

## Reactivación controlada de candidatos terminales en el mismo folio

- [x] Auditar por qué un candidato rechazado o desistido no podía reingresar al mismo folio aunque el negocio sí requiere reapertura controlada
- [x] Corregir backend y frontend para distinguir duplicado activo versus participación terminal reactivable
- [x] Mantener la reapertura auditable, limpiando aprobaciones y jobs pendientes que ya no aplican
- [x] Validar `TypeScript` y `git diff --check`

## Resultado de reactivación controlada de candidatos terminales en el mismo folio

- La auditoría mostró un drift de contrato entre UI y SQL: [`CandidateIntakeForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateIntakeForm.tsx:1) bloqueaba cualquier coincidencia de RUT dentro del caso, y [`add_candidate_to_recruitment_case(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608150500_fix_add_candidate_ambiguous_column.sql:1) resolvía el conflicto con `on conflict do nothing`, devolviendo la fila existente sin reactivar realmente la participación terminal.
- Se versionó la migración [`20260628004500_allow_reactivate_terminal_candidate_in_same_case.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628004500_allow_reactivate_terminal_candidate_in_same_case.sql:1), que redefine `add_candidate_to_recruitment_case(...)` para permitir solo la reactivación de participaciones `rejected` o `withdrawn`, devolverlas a `lead`, resetear la validación documental, cancelar aprobaciones `who_pending` pendientes y eliminar jobs documentales obsoletos antes de re-sincronizar el folio.
- El backend ahora rechaza explícitamente los duplicados activos con `El candidato ya participa en el caso seleccionado`, en vez de esconder el conflicto detrás de un retorno exitoso vacío.
- [`CandidateIntakeForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateIntakeForm.tsx:1) distingue visualmente ambos escenarios: un candidato activo sigue bloqueado, mientras uno terminal muestra advertencia operativa y habilita el CTA `Reactivar candidato en el caso`.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false` y `git diff --check`.

## Cancelación de aprobaciones Who al cerrar candidatos manualmente

- [x] Auditar si una transición manual a `rejected` o `withdrawn` dejaba aprobaciones `Who` pendientes fuera de contexto
- [x] Corregir la RPC de cambio de etapa para cancelar aprobaciones pendientes antes de encolar la purga documental
- [x] Mantener trazabilidad del saneamiento en auditoría sin abrir un refactor lateral
- [x] Validar `TypeScript`, auditoría de migración y `git diff --check`

## Resultado de cancelación de aprobaciones Who al cerrar candidatos manualmente

- La revisión del flujo mostró una desalineación entre pipeline, bandejas y auditoría: [`advance_recruitment_candidate_stage(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260627184500_queue_terminal_candidate_document_cleanup.sql:117) podía cerrar manualmente un candidato en `rejected` o `withdrawn`, pero dejaba viva una fila `candidate_stage_approvals.status = pending` cuando el candidato venía de `who_pending`.
- Se versionó la migración [`20260628010000_cancel_pending_who_approval_on_terminal_candidate_transition.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628010000_cancel_pending_who_approval_on_terminal_candidate_transition.sql:1), que redefine `advance_recruitment_candidate_stage(...)` para cancelar cualquier aprobación `Who` pendiente del mismo `recruitment_case_candidate_id` antes de auditar el cambio y encolar la limpieza documental.
- La misma RPC deja ahora el conteo `cancelled_who_approvals` en `recruitment_case_audit_log.metadata`, de modo que la transición terminal conserva trazabilidad explícita del saneamiento y no solo del cambio de etapa.
- El cambio reduce riesgo operativo directo: la bandeja de tareas ya no puede seguir mostrando aprobaciones `Who` pendientes para un candidato que el propio pipeline marcó como cerrado.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false`, `npm run audit:migrations -- --files supabase/migrations/20260628010000_cancel_pending_who_approval_on_terminal_candidate_transition.sql` y `git diff --check`.

## Motivo obligatorio en transiciones terminales de candidatos

- [x] Auditar si la RPC viva seguía exigiendo motivo al mover un candidato a `rejected` o `withdrawn`
- [x] Reponer la validación backend para que la trazabilidad no dependa solo de la UI
- [x] Mantener alineada la cancelación `Who` recién agregada dentro de la misma firma viva
- [x] Validar `TypeScript`, auditoría de migración y `git diff --check`

## Resultado de motivo obligatorio en transiciones terminales de candidatos

- La auditoría mostró una regresión de contrato en la RPC viva [`advance_recruitment_candidate_stage(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628010000_cancel_pending_who_approval_on_terminal_candidate_transition.sql:1): una versión previa sí exigía comentario para `rejected` o `withdrawn`, pero la firma más reciente había perdido esa validación.
- Se versionó la migración [`20260628011500_require_terminal_candidate_reason_in_stage_transition.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628011500_require_terminal_candidate_reason_in_stage_transition.sql:1), que recompone ese guardrail en backend sin cambiar el contrato cliente actual. La UI ya pedía comentario, pero ahora cualquier consumidor futuro o bypass técnico vuelve a quedar cubierto por la RPC.
- El cambio reduce un riesgo de trazabilidad enterprise: ya no se puede cerrar una participación de candidato sin motivo persistido en `rejection_reason`, `withdrawal_reason`, historial de etapas y audit log.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false`, `npm run audit:migrations -- --files supabase/migrations/20260628011500_require_terminal_candidate_reason_in_stage_transition.sql` y `git diff --check`.

## Resumen de aprobación coherente al reabrir folios

- [x] Auditar cómo `get_recruitment_processes_page(...)` construye `approval_summary` para folios activos después de un cierre y reapertura automática
- [x] Corregir el selector de `latest_approval` para que un request nuevamente `approved` no arrastre como resumen un rechazo del cierre manual anterior
- [x] Validar `TypeScript`, build frontend, auditoría de migración y `git diff --check`

## Resultado de resumen de aprobación coherente al reabrir folios

- La auditoría mostró una inconsistencia real entre workflow y UI: [`get_recruitment_processes_page(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260625022401_harden_recruitment_mobility_enterprise_scale.sql:211) elegía `approval_summary` por “última aprobación cronológica” sin considerar `hiring_requests.status`. Si un folio se cerraba manualmente y luego se reabría por liberación de cupo, el request volvía a `approved`, pero el resumen podía seguir mostrando el rechazo administrativo del cierre.
- Se versionó la migración [`20260628014500_prefer_approved_summary_for_reopened_hiring_requests.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628014500_prefer_approved_summary_for_reopened_hiring_requests.sql:1), que redefine `get_recruitment_processes_page(...)` para priorizar aprobaciones `approved` cuando el `hiring_request` está actualmente `approved`. Con eso, Inicio y Reclutamiento dejan de mostrar una señal de rechazo obsoleta sobre un folio operativo otra vez activo.
- El ajuste no cambia contratos frontend ni permisos. Solo corrige la selección SQL del resumen para que el estado visible del folio y su `approval_summary` vuelvan a hablar el mismo idioma.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false`, `npm run build:frontend-check`, `npm run audit:migrations -- --files supabase/migrations/20260628014500_prefer_approved_summary_for_reopened_hiring_requests.sql` y `git diff --check`.

## Alineación del detalle de caso con folios reabiertos

- [x] Auditar si `get_recruitment_case_detail(...)` seguía seleccionando `approval_summary` por último evento histórico aunque el folio ya estuviera reabierto
- [x] Corregir el detalle para que use el mismo criterio de “aprobación vigente” del resumen paginado
- [x] Validar `TypeScript`, build frontend, auditoría de migración y `git diff --check`

## Resultado de alineación del detalle de caso con folios reabiertos

- La misma deriva existía en [`get_recruitment_case_detail(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260609121500_expand_hiring_summary_and_document_validation.sql:956): el `approval_summary` del `hiring_request` seguía el último `approved/rejected` por fecha y podía mostrar el rechazo del cierre manual aun cuando el request ya estaba otra vez `approved`.
- Se versionó la migración [`20260628020000_align_case_detail_approval_summary_with_reopened_requests.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628020000_align_case_detail_approval_summary_with_reopened_requests.sql:1), que redefine `get_recruitment_case_detail(...)` para priorizar aprobaciones `approved` cuando el estado actual del `hiring_request` es `approved`, replicando el mismo criterio que ya usa [`get_recruitment_processes_page(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628014500_prefer_approved_summary_for_reopened_hiring_requests.sql:1).
- Con esto, el expandible o detalle lateral del caso deja de contradecir al listado principal: ambos muestran la señal operativa vigente y no el último rechazo administrativo histórico.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false`, `npm run build:frontend-check`, `npm run audit:migrations -- --files supabase/migrations/20260628020000_align_case_detail_approval_summary_with_reopened_requests.sql` y `git diff --check`.

## Exclusión de folios cerrados en seguimiento de aprobaciones del Dashboard

- [x] Auditar `get_dashboard_approval_tracking()` para verificar si seguía filtrando con estados legacy y podía incluir solicitudes ya cerradas
- [x] Corregir la RPC para mostrar solo solicitudes realmente pendientes y amarradas a su `current_step_code`
- [x] Validar `TypeScript`, build frontend, auditoría de migración y `git diff --check`

## Resultado de exclusión de folios cerrados en seguimiento de aprobaciones del Dashboard

- La revisión mostró un drift claro en [`get_dashboard_approval_tracking()`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260608162000_make_approval_tracking_public.sql:1): seguía excluyendo estados legacy (`approved`, `rejected`, `canceled`, `withdrawn`) pero no `closed`, por lo que podía dejar folios ya cerrados dentro del widget “Seguimiento de aprobaciones”.
- Se versionó la migración [`20260628023000_exclude_closed_hiring_requests_from_dashboard_approval_tracking.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260628023000_exclude_closed_hiring_requests_from_dashboard_approval_tracking.sql:1), que endurece la RPC para incluir solo `pending_area_manager` y `pending_contracts_control`, exigir `current_step_code` no nulo y resolver el join del aprobador pendiente exactamente contra esa etapa vigente.
- El cambio reduce ruido operativo en Inicio: el widget deja de mezclar solicitudes aún en flujo con folios cerrados que ya no tienen una aprobación real por resolver.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false`, `npm run build:frontend-check`, `npm run audit:migrations -- --files supabase/migrations/20260628023000_exclude_closed_hiring_requests_from_dashboard_approval_tracking.sql` y `git diff --check`.

## Limpieza profunda conservadora del repositorio

- [x] Auditar artefactos generados locales, temporales Supabase y residuos de builds/cachés fuera de valor operacional
- [x] Confirmar qué scripts versionados eran one-off sin integración en package scripts, workflows ni documentación viva
- [x] Eliminar solo residuos demostrablemente prescindibles y mantener intactos los scripts con valor operativo real
- [x] Validar `TypeScript`, build frontend, auditoría de seguridad y `git diff --check` tras la limpieza

## Resultado de limpieza profunda conservadora del repositorio

- Se eliminaron residuos versionados sin integración activa ni valor futuro claro: `process-pdf.mjs`, `sync-doc.cjs`, `test-rpc.mjs`, `scripts/preview_migracion.cjs`, `supabase/.temp/linked-project.json` y `vite.config.d.ts`.
- La limpieza también contempla artefactos locales no versionados sin valor persistente: `dist/`, `*.tsbuildinfo`, `.DS_Store`, `app_mobile/.expo/`, `app_mobile/node_modules/` y el directorio `app_mobile/` completo al no contener código versionado.
- [`.gitignore`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/.gitignore:1) ahora ignora `vite.config.d.ts` para evitar que el typecheck vuelva a reintroducir ese espejo generado en la raíz.
- Se ajustó [`scripts/audit-supabase-security.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/audit-supabase-security.mjs:1) para que siga auditando archivos raíz mantenidos y deje de depender de helpers obsoletos.
- El criterio fue conservador: no se tocaron documentos funcionales, scripts operativos activos ni plantillas que aún respaldan procesos del ERP.

## Retiro de Excel versionados del repositorio

- [x] Auditar todos los `.xls` y `.xlsx` dentro del repo y determinar si tenían uso real o solo valor de referencia
- [x] Convertir a Markdown las plantillas que todavía aportaban contexto o contrato funcional
- [x] Eliminar los binarios Excel del repositorio
- [x] Validar generación de la nueva documentación, estado git y ausencia total de Excel versionados

## Resultado de retiro de Excel versionados del repositorio

- La plantilla de migración de reclutamiento dejó de vivir como binario y quedó convertida a [`docs/templates/plantilla_migracion_reclutamiento.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/docs/templates/plantilla_migracion_reclutamiento.md:1), generada desde el mismo contrato fuente en [`scripts/generate-recruitment-migration-template.mjs`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/generate-recruitment-migration-template.mjs:1).
- El workbook legado de certificados quedó condensado en [`docs/templates/generador_certificados_legacy.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/docs/templates/generador_certificados_legacy.md:1), preservando estructura, datasets y razón de retiro sin mantener el Excel en git.
- Se agregó [`docs/templates/README.md`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/docs/templates/README.md:1) para dejar explícito qué plantillas siguen vigentes.
- Los archivos `docs/templates/generador_de_certificados_rev02.xlsx`, `docs/templates/plantilla_migracion_reclutamiento.xls` y `docs/templates/plantilla_migracion_reclutamiento.xlsx` se retiran del repositorio.

## Bloqueo de incentivos por descanso ya ocupado en la misma fecha

- [x] Auditar el contrato actual de `calculate_hr_incentive_preview(...)` y `create_hr_incentive_request(...)` para ubicar el punto correcto del bloqueo transversal por fecha
- [x] Versionar una migración nueva que impida registrar cualquier incentivo adicional cuando ya exista otro incentivo activo que exige descanso para ese trabajador y fecha
- [x] Exponer el motivo de bloqueo en la UI de registro con mensaje explícito indicando contrato ya ocupado
- [x] Validar `TypeScript`, build/frontend si aplica, auditoría de migración y `git diff --check`

## Resultado de bloqueo de incentivos por descanso ya ocupado en la misma fecha

- Se versionó la migración [`20260630093000_block_duplicate_rest_day_incentives_per_worker_date.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630093000_block_duplicate_rest_day_incentives_per_worker_date.sql:1), que redefine [`build_hr_incentive_preview_from_worker_data(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630093000_block_duplicate_rest_day_incentives_per_worker_date.sql:3) y [`create_hr_incentive_request(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630093000_block_duplicate_rest_day_incentives_per_worker_date.sql:190) para bloquear el registro cuando el trabajador ya tiene otro incentivo activo cuyo tipo exige descanso en la misma fecha.
- El bloqueo backend no depende del contrato que se intenta usar ahora: revisa cualquier incentivo activo (`P`, `E`, `F`) del mismo trabajador y fecha, cruza contra [`hr_incentive_types.requires_rest_day`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260613193000_add_hr_roster_module.sql:45) y devuelve un mensaje explícito indicando el contrato ya ocupado.
- [`IncentiveRegistrationForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveRegistrationForm.tsx:1), [`incentivesApi.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/services/incentivesApi.ts:1) y [`types.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/types.ts:1) quedaron alineados para exponer `blockedByExistingRestDayIncentive`, pintar la alerta roja y deshabilitar el botón de registro antes de persistir.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260630093000_block_duplicate_rest_day_incentives_per_worker_date.sql`, `./node_modules/.bin/tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.

## Registro operativo de servicios no realizados en Operaciones

- [x] Definir el estado formal de ejecución del servicio en backend para distinguir servicio planificado de servicio no realizado sin abrir un flujo paralelo
- [x] Permitir desde `registros_base` marcar un servicio obligatorio como no realizado con confirmación explícita y sin romper la asignación normal de conductor/equipo
- [x] Llevar ese estado y observación a la exportación histórica para que la trazabilidad no dependa de interpretar nulos
- [x] Validar con auditoría de migración, `TypeScript`, build frontend, `db push --dry-run`, aplicación remota y `git diff --check`

## Resultado de registro operativo de servicios no realizados en Operaciones

- La migración [`20260630170500_add_operations_not_performed_status.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630170500_add_operations_not_performed_status.sql:1) agrega `service_execution_status` y `service_execution_note` a [`public.service_entries`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630133626_align_operations_backend_with_roster_and_catalogs.sql:109), permite `equipment_code` nulo solo para este caso operativo y recompila [`submit_service_entries_batch(...)`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630170500_add_operations_not_performed_status.sql:18) para aceptar tanto servicios planificados como servicios no realizados.
- [`OperationsBaseRegister.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/components/OperationsBaseRegister.tsx:1) ahora expone el botón `Servicio no realizado`, confirma la acción con warning, limpia conductor/equipo, bloquea la edición incompatible y deja una alerta visible dentro de la tarjeta para que el estado no quede ambiguo.
- [`OperacionesDashboard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/pages/OperacionesDashboard.tsx:1), [`service-entry.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/lib/service-entry.ts:1) y [`OperationsExport.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/components/OperationsExport.tsx:1) quedaron alineados para tratar `not_performed` como un cierre válido del servicio, persistir la observación operativa y exportarla tanto en la vista previa como en el Excel.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260630170500_add_operations_not_performed_status.sql`, `./node_modules/.bin/tsc -b --pretty false`, `npm run build:frontend-check`, `npx --yes supabase db push --linked --dry-run`, `npx --yes supabase db push --linked --include-all` y `git diff --check`.

## Ajuste de ubicación del botón operativo y restauración de Historial para Control de Contratos/Gerencia

- [x] Mover el botón `Servicio no realizado` fuera del resumen contraído y dejarlo solo dentro de la expansión del servicio
- [x] Auditar la habilitación de `Historial` de Incentivos para `control_contratos` y `gerencia` tanto en el gating frontend como en la matriz efectiva de permisos
- [x] Reforzar los grants de acceso para que `control_contratos` vea el historial completo sin restricción adicional
- [x] Validar con auditoría de migración, `TypeScript`, build frontend, `db push --dry-run`, aplicación remota y `git diff --check`

## Resultado de ajuste de ubicación del botón operativo y restauración de Historial para Control de Contratos/Gerencia

- [`OperationsBaseRegister.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/components/OperationsBaseRegister.tsx:1) ya no deja el botón `Servicio no realizado` en el encabezado del resumen contraído; ahora lo muestra solo dentro de la expansión real del servicio, manteniendo el resumen limpio y el estado visible por cápsula.
- [`operaciones.css`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/styles/operaciones.css:1) agrega un bloque específico de acciones del cuerpo expandido para mantener el botón alineado a la derecha sin alterar la jerarquía visual del resumen.
- [`HumanResourcesDashboard.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/pages/HumanResourcesDashboard.tsx:1) ahora permite la vista `Historial` también por rol base (`control_contratos` y `gerencia`) además del feature flag, evitando que una desalineación transitoria de `accessible_features` esconda la pestaña a usuarios que sí deben verla.
- La migración [`20260630183500_restore_hr_incentives_history_access_for_management_roles.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260630183500_restore_hr_incentives_history_access_for_management_roles.sql:1) refuerza de forma idempotente `role_module_access` sobre `recursos_humanos` y `role_feature_access` sobre `hr_incentives_history` para `gerencia` y `control_contratos`, preservando que el historial siga completo y sin filtro extra por contrato.
- Validación cerrada con `npm run audit:migrations -- --files supabase/migrations/20260630183500_restore_hr_incentives_history_access_for_management_roles.sql`, `./node_modules/.bin/tsc -b --pretty false`, `npm run build:frontend-check`, `npx --yes supabase db push --linked --dry-run`, `npx --yes supabase db push --linked --include-all` y `git diff --check`.

## Auditoría completa de front y back con corrección conservadora

- [x] Auditar el estado actual del repositorio, validar compilación y localizar fallas reproducibles o riesgos claros en frontend y backend sin tocar cambios ajenos ya pendientes
- [x] Revisar contratos críticos de reclutamiento/aprobaciones/BUK entre React, servicios TypeScript, migraciones SQL y Edge Functions para detectar drift funcional
- [x] Corregir únicamente los errores confirmados con cambios mínimos, versionables y seguros para producción
- [x] Revalidar con `TypeScript`, build frontend y chequeos de consistencia aplicables; luego documentar hallazgos, correcciones y límites de la auditoría

## Resultado de auditoría completa de front y back con corrección conservadora

- Se corrigió un drift funcional real entre frontend y backend en aprobaciones de folios:
  - [`HiringStatusPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringStatusPage.tsx:1) y [`HiringProcessesView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringProcessesView.tsx:1) ahora propagan el estado de admin hasta [`ApprovalModal.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/ApprovalModal.tsx:1);
  - la migración [`20260707130500_restore_admin_override_for_hiring_approval_v2.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260707130500_restore_admin_override_for_hiring_approval_v2.sql:1) restaura en `decide_hiring_request_approval_v2(...)` el bypass explícito que el contrato legacy y la UI ya asumían para admin/superadmin.
- Se corrigieron tres bugs P1 de estado stale en frontend:
  - [`CandidateIntakeForm.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateIntakeForm.tsx:1) ahora invalida respuestas async fuera de orden, limpia autocompletado stale cuando cambia el RUT y evita mezclar datos del candidato anterior;
  - [`TransferCandidateModal.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/TransferCandidateModal.tsx:1) resetea folio destino, comentario y error al reabrir o cambiar de candidato;
  - [`DatePickerField.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/ui/forms/DatePickerField.tsx:1) deja de bloquear fechas pasadas por default, y los flujos que sí debían seguir restringidos quedaron explicitados en [`OperationsBaseRegister.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/operaciones/components/OperationsBaseRegister.tsx:1) y [`HiringRequestPage.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringRequestPage.tsx:1).
- También se corrigió un riesgo de detalle stale en dashboard: [`ActiveFoliosWidget.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/dashboard/components/widgets/ActiveFoliosWidget.tsx:1) ahora refresca el caso expandido cuando la lista principal se actualiza, evitando mostrar KPIs/listado nuevos con un detalle viejo del mismo folio.
- Se endurecieron superficies backend sensibles de reclutamiento/BUK:
  - [`check_buk_candidate/index.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/check_buk_candidate/index.ts:1) ahora exige bearer token válido y permiso real de `Control de candidatos` antes de consultar BUK;
  - la migración [`20260707133000_harden_recruitment_personnel_helpers_and_buk_payload.sql`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260707133000_harden_recruitment_personnel_helpers_and_buk_payload.sql:1) mueve el gate de autorización al inicio de `get_candidate_buk_sync_payload(...)` y revoca ejecución directa a `authenticated` sobre helpers internos de personal/BUK para evitar oráculos y uso directo no deseado.
- Validación cerrada con:
  - `./node_modules/.bin/tsc -b --pretty false`
  - `npm run build:frontend-check`
  - `npm run audit:migrations -- --files supabase/migrations/20260707130500_restore_admin_override_for_hiring_approval_v2.sql supabase/migrations/20260707133000_harden_recruitment_personnel_helpers_and_buk_payload.sql`
  - `git diff --check`
- Límite explícito de esta auditoría:
  - no se aplicaron migraciones remotas ni se desplegaron Edge Functions desde esta sesión;
  - se respetaron los tres SQL no versionados que ya estaban presentes en el worktree (`20260703170500`, `20260703171200`, `20260703171800`) sin modificarlos.

## Selector de contrato en reglas de monto de Incentivos

- [x] Auditar el campo `Contrato (opcional)` de reglas de monto para confirmar si seguía como texto libre pese a existir catálogo vivo de contratos
- [x] Reemplazar el input libre por una lista desplegable alimentada por `contractOptions` ya cargado por el módulo
- [x] Validar con `TypeScript`, build frontend y `git diff --check`

## Resultado de selector de contrato en reglas de monto de Incentivos

- [`IncentiveSetupView.tsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/incentives/components/IncentiveSetupView.tsx:1) dejó de usar un `TextField` libre para `Contrato (opcional)` en `Reglas de monto`.
- El formulario ahora reutiliza `setupCatalogsQuery.data.contractOptions`, mostrando una lista desplegable con los contratos reales ya vigentes en el ERP y manteniendo `Todos los contratos` como opción vacía.
- Validación cerrada con `./node_modules/.bin/tsc -b --pretty false`, `npm run build:frontend-check` y `git diff --check`.
