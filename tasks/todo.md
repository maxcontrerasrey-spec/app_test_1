# Tareas y Roadmap de Desarrollo

> **REGLA FUNDACIONAL (Lección 56):** Antes de proponer, planificar o ejecutar cualquier cambio sobre este repositorio, se debe leer `tasks/todo.md` y `tasks/lessons.md` completos. Esta es la primera acción obligatoria de cada sesión de trabajo, sin excepción.

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
- El entregable quedó publicado en dos formatos dentro de [`docs/templates`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/docs/templates): [`plantilla_migracion_reclutamiento.xls`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/docs/templates/plantilla_migracion_reclutamiento.xls) y [`plantilla_migracion_reclutamiento.xlsx`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/docs/templates/plantilla_migracion_reclutamiento.xlsx).
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
