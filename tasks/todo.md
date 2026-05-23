# Plan de trabajo

## Correcciones Generales de Interfaz y UX (Sprint de Pulido)

- [x] Eliminar texto publicitario/descriptivo en el panel de marca de login
- [x] Implementar activación por hover con retardo (`setTimeout` 150ms) en submenús del menú superior para evitar parpadeos
- [x] Eliminar texto explicativo en el toolbar de Control de Candidatos para limpiar la interfaz
- [x] Reubicar y enmarcar la sección "Registrar candidato" dentro del layout de columna izquierda (`tracking-table-wrap`)
- [x] Prevenir el colapso del botón "Registrar candidato" en flexbox agregando `flexShrink: 0`
- [x] Separar la celda combinada Correo/Teléfono en el detalle del candidato en campos independientes
- [x] Convertir el historial de etapas en una lista vertical estructurada y hacerlo colapsable por defecto
- [x] Eliminar la sección secundaria "Auditoría del caso" del panel lateral del candidato para evitar ruido técnico
- [x] Unificar la columna "Folio / Caso" a una sola cabecera de "Caso" mostrando solo el `case_code` para simplificar la nomenclatura de la tabla
- [x] Implementar un formulario interactivo en el panel lateral del candidato para editar/registrar la Licencia de Conducir (Clase y Vencimiento)
- [x] Crear una migración SQL en Supabase para exponer la RPC segura `update_candidate_driver_license` y refactorear el cliente para llamarla de forma segura (Zero Trust)

## Resultado de Correcciones Generales de Interfaz y UX (Sprint de Pulido)

- **Login Simplificado**: Se eliminó la firma inferior en [LoginPage.tsx](file:///Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/auth/pages/LoginPage.tsx).
- **Hover Intuitivo en Topbar**: Se configuró soporte hover con delay en [AppShell.tsx](file:///Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/app/layout/AppShell.tsx), resolviendo la fricción de navegación.
- **Limpieza de Control de Candidatos**: Se retiró el caption explicativo redundante de la toolbar en [HiringCandidatesView.tsx](file:///Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringCandidatesView.tsx).
- **Consistencia Visual en Registro**: Se reubicó [CandidateIntakeForm](file:///Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateIntakeForm.tsx) dentro del flujo de la columna de la tabla principal para evitar desbordamientos de ancho de pantalla, y se aplicó `flexShrink: 0` al botón "Registrar candidato" para evitar que se aplaste o sea invadido por el buscador.
- **Mejora en Sidebar de Detalle**: En [CandidateDetailSidebar.tsx](file:///Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateDetailSidebar.tsx) se dividieron los datos de contacto en celdas separadas, se convirtió el historial de etapas en una sección colapsable (con contador y auto-collapse al cambiar de candidato) y con formato línea por línea, y se removió la auditoría del caso técnica para despejar la vista.
- **Caso Unificado**: En la tabla de candidatos se renombró el encabezado a "Caso" y se simplificó la columna mostrando únicamente el código del caso (`case_code`), eliminando la concatenación del folio redundante.
- **Registro y Edición de Licencia**: Se agregó un sub-formulario interactivo en la sección de Licencia de Conducir en el sidebar. El usuario puede hacer clic en `[Editar]`, rellenar los inputs de clase de licencia y vencimiento (con selector de fecha) y guardar el resultado directamente.
- **Migración SQL de Licencias (Zero Trust)**: Para evitar dar privilegios generales de `UPDATE` al cliente en la tabla `candidate_profiles`, se diseñó y guardó la migración [20260522_000020_add_update_candidate_driver_license_rpc.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260522_000020_add_update_candidate_driver_license_rpc.sql:1) para instalar la función RPC `update_candidate_driver_license(...)` con validación estricta de sesión y permisos. El servicio de frontend [hiringControl.ts](file:///Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts) se adaptó para usar `supabase.rpc`.

## Refactorización y Tipado de Operaciones (Alineación de Arquitectura ERP)

- [x] Refactorizar `src/modules/operaciones/lib/service-entry.ts` para agregar interfaces y tipado estricto
- [x] Refactorizar `src/modules/operaciones/services/operacionesApi.ts` para tipar llamadas Supabase y parámetros
- [x] Refactorizar `src/modules/operaciones/data/services-data.ts` para tipar el catálogo estático
- [x] Implementar componentes modulares: `OperationsSummary.tsx`, `OperationsBaseRegister.tsx`, `OperationsExport.tsx`, `OperationsSpecialRegister.tsx`
- [x] Refactorizar `src/modules/operaciones/pages/OperacionesDashboard.tsx` para delegar visualización a los submódulos, limpiar código muerto y eliminar `@ts-nocheck`
- [x] Refactorizar `src/modules/certificates/pages/CertificatesPage.tsx` para importar y reutilizar las utilidades de fecha globales
- [x] Resolver advertencias de TypeScript (`TS18047`) de nulabilidad de `supabase` mediante constantes locales y estrechamiento de tipo
- [x] Validar compilación (`npx tsc -b`) y construcción productiva (`npm run build`) del proyecto con éxito

## Resultado de Refactorización y Tipado de Operaciones (Alineación de Arquitectura ERP)

- **Código Limpio y Libre de `@ts-nocheck`**: Se removieron todas las directivas que omitían el compilador TypeScript en el módulo de operaciones.
- **Modularización del Dashboard**: Se desintegró el archivo monolítico `OperacionesDashboard.tsx` creando submódulos especializados en `components/`. Esto disminuyó a la mitad su tamaño y separó claramente las responsabilidades visuales.
- **Tipado Estricto**: Definición e integración de las interfaces `OperationsServiceRecord`, `ServiceEntryPayload`, `CleanedServiceEntryPayload` y `ServiceEntryValidationResult`.
- **Eliminación de Redundancia de Fechas**: Ambos módulos (`operaciones` y `certificates`) ahora consumen directamente las utilidades de fecha de `src/shared/lib/date.ts`.
- **Resolución de Nulidad de Supabase**: Se aplicaron asignaciones locales e inmutables de `const client = supabase;` previniendo la pérdida de la validación de nulidad dentro de closures asíncronos y query-builders.
- **Construcción Exitosa**: El proyecto compila y construye de forma óptima sin advertencias ni errores.

## Restauración de RPC y políticas de Control de Candidatos

- [x] Diagnosticar el fallo de `get_recruitment_case_detail(...)` reportado como `PGRST202`
- [x] Generar una migración para reconstruir políticas RLS eliminadas accidentalmente por `CASCADE`
- [x] Asegurar que la RPC esté expuesta nuevamente al esquema con permisos de `authenticated`
- [x] Corregir en CSS la fractura del botón `Registrar candidato` añadiendo `white-space: nowrap`

## Resultado de Restauración de RPC y políticas de Control de Candidatos

- La causa raíz del fallo en el panel de detalle de candidato era que, al hacer `DROP FUNCTION ... CASCADE;` sobre `user_can_view_recruitment_case`, PostgreSQL borró también todas las políticas RLS (`recruitment_cases_select_scoped`, etc.) que dependían de esa función.
- Sin políticas, el `SELECT` fallaba implícitamente o PostgREST no permitía exponer bien la estructura.
- Se creó la migración [20260522_000019_restore_case_detail_and_policies.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260522_000019_restore_case_detail_and_policies.sql:1) para:
  - Recrear 6 políticas RLS (`recruitment_cases`, `recruitment_case_assignments`, `candidate_profiles`, `recruitment_case_candidates`, `recruitment_case_candidate_stage_history`, `recruitment_case_audit_log`).
  - Reinstalar de forma segura y completa la RPC `get_recruitment_case_detail(...)`.
- En el frontend, se solucionó el desbordamiento visual del botón agregando `white-space: nowrap` a la clase `.soft-primary-button` en `global.css`.

## Reparación de RPC de alta de candidatos

- [x] Verificar si el error de alta viene del frontend o de una desalineación de Supabase/PostgREST
- [x] Materializar una migración de reparación idempotente para `add_candidate_to_recruitment_case(...)`
- [x] Reotorgar permisos y forzar `notify pgrst, 'reload schema'`
- [x] Documentar el cierre y dejar instrucciones listas para ejecución manual en producción

## Resultado de reparación de RPC de alta de candidatos

- La causa raíz no está en React ni en el formulario.
- El frontend invoca correctamente `public.add_candidate_to_recruitment_case(...)`.
- El error `PGRST202` indica que en Supabase la función no existe en el schema cache activo de PostgREST o quedó fuera de la base publicada.
- Se agregó la migración [20260522_000018_repair_add_candidate_rpc.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260522_000018_repair_add_candidate_rpc.sql:1) para:
  - reponer `user_can_view_recruitment_case(...)`
  - reponer `user_can_manage_recruitment_case(...)`
  - reponer `user_can_access_recruitment_case(...)`
  - recrear `add_candidate_to_recruitment_case(...)`
  - restaurar grants de ejecución para `authenticated`
  - forzar `notify pgrst, 'reload schema'`
- Con eso, la alta de candidatos vuelve a quedar alineada con el frontend ya desplegado.

## Refactor modular de Control de Contrataciones

- [x] Extraer `HiringProcessesView.tsx` con tabla de procesos y cola de aprobación final con modal de decisión
- [x] Extraer `CandidateDetailSidebar.tsx` usando `SelectField` y `TextField` para cambio de etapa
- [x] Extraer `HiringCandidatesView.tsx` integrando `CandidateIntakeForm` y `CandidateDetailSidebar`
- [x] Refactorizar `HiringStatusPage.tsx` para dejarlo como contenedor de datos y usar `PageShell`
- [x] Revalidar compilación, build y publicar el refactor

## Resultado del refactor modular de Control de Contrataciones

- Se extrajo `HiringProcessesView.tsx` para encapsular:
  - tabla de `Resumen de procesos de contratación`
  - cola de aprobación final
  - modal de decisión por folio en lugar de botones inline en la lista
- Se consolidó `CandidateDetailSidebar.tsx` como panel reusable del detalle de candidato y cambio de etapa usando `SelectField` y `TextField`.
- Se creó `HiringCandidatesView.tsx` para contener:
  - tabla `Control de candidatos`
  - `CandidateIntakeForm`
  - `CandidateDetailSidebar`
- `HiringStatusPage.tsx` quedó reducida a orquestación de datos:
  - `loadDashboard`
  - `loadCaseDetail`
  - estados globales
  - selección de vista
  - callbacks de aprobación, alta y avance de etapa
- El shell principal del módulo ahora usa `PageShell`.
- Se ajustó `global.css` para soportar:
  - modal de aprobación
  - toolbar con `TextField`
  - layout responsive del refactor
- Validación ejecutada:
  - `npx tsc -b`
  - `npm run build`

## Auditoría Zero Trust de Contrataciones

- [x] Auditar separación de poderes entre `control_contratos` y `reclutamiento` en Supabase y frontend protegido
- [x] Identificar brechas RLS/RPC en `hiring_requests`, `recruitment_cases` y auditorías
- [x] Materializar los parches SQL de hardening en una migración versionada
- [x] Dejar documentado el resultado con hallazgos y alcance

## Resultado de auditoría Zero Trust de Contrataciones

- Se detectó que la separación de poderes no estaba blindada en backend:
  - `control_contratos` y el solicitante original heredaban acceso a `recruitment_cases` vía `user_can_access_recruitment_case(...)`
  - las RPCs de reclutamiento reutilizaban ese helper para mutar candidatos
  - `open_recruitment_case_from_hiring_request(...)` seguía ejecutable por `authenticated`
- Se creó la migración [20260522_000017_harden_recruitment_zero_trust.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260522_000017_harden_recruitment_zero_trust.sql:1) para:
  - separar explícitamente `user_can_view_recruitment_case(...)` y `user_can_manage_recruitment_case(...)`
  - restringir lectura/mutación de `recruitment_cases` y `recruitment_case_candidates` a `reclutamiento`, `admin` y asignaciones operativas válidas
  - revocar la ejecución directa de `open_recruitment_case_from_hiring_request(...)`
  - forzar RLS y endurecer la inmutabilidad de auditoría sobre `recruitment_case_audit_log`, `hiring_request_audit_log` y `recruitment_case_candidate_stage_history`
- Observación de routing:
  - el frontend sigue trabajando con autorización a nivel módulo en [access.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/auth/config/access.ts:1) y [RouteGuards.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/auth/components/RouteGuards.tsx:1)
  - por diseño, la separación fina entre `control_contratos` y `reclutamiento` debe seguir viviendo en Supabase y no depender del router

## Corrección funcional y validación de RUT en alta de candidatos

- [x] Corregir el flujo de registro de candidato para que entregue feedback visible en el mismo formulario
- [x] Implementar utilidades reutilizables `sanitizeRut`, `formatRut`, `validateRut`, `normalizeRut`
- [x] Aplicar formato y validación de RUT chileno al input controlado de candidatos
- [x] Guardar el RUT normalizado antes de enviarlo a Supabase y mostrarlo formateado en UI
- [x] Revalidar compilación y build después del ajuste

## Resultado de corrección funcional y validación de RUT en alta de candidatos

- El formulario de alta de candidatos ahora entrega feedback visible de error o éxito dentro del mismo bloque de alta.
- Se creó la utilidad reusable [rut.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/shared/lib/rut.ts:1) con:
  - `sanitizeRut`
  - `formatRut`
  - `validateRut`
  - `normalizeRut`
- El campo RUT:
  - acepta solo números y `K`
  - formatea automáticamente con puntos y guion
  - valida por módulo 11
  - se envía normalizado al backend, sin puntos ni guion
- El campo `Nombre completo` ahora muestra la reseña `Nombres Apellido Paterno Apellido Materno`.
- El RUT se muestra formateado también en la tabla y detalle de candidatos.
- Validación:
  - `npx tsc -b`: correcto
  - `npm run build`: correcto

## Alta útil de candidatos en Control de Contrataciones

- [x] Definir el flujo mínimo útil de alta de candidato dentro de `Control de candidatos`
- [x] Implementar una entrada explícita de candidato asociada a un caso activo real
- [x] Reutilizar la RPC existente `add_candidate_to_recruitment_case(...)` sin inventar lógica paralela
- [x] Revalidar compilación y build después del ajuste

## Resultado de alta útil de candidatos en Control de Contrataciones

- `Control de candidatos` ahora expone una entrada explícita `Registrar candidato`, ubicada en el submódulo correcto y vinculada a un caso activo real.
- El alta pide:
  - caso activo
  - RUT / identificador
  - nombre completo
  - correo
  - teléfono
- La implementación reutiliza la RPC `add_candidate_to_recruitment_case(...)`, por lo que mantiene:
  - creación o reutilización de `candidate_profiles`
  - vinculación al `recruitment_case`
  - `stage_history`
  - auditoría
  - sincronización de estado del caso
- Después del alta, el frontend recarga dashboard y detalle para dejar seleccionado el candidato recién incorporado.
- Revisión de autorización:
  - no fue necesario extender `app_modules`, `role_module_access`, `app_roles` ni `profiles`
  - el flujo sigue dentro del módulo `control_contrataciones` y reutiliza la seguridad ya definida
- Validación:
  - `npx tsc -b`: correcto
  - `npm run build`: correcto

## Cierre de migraciones manuales de Recruitment Phase 1

- [x] Dejar explícita la regla de utilidad real del producto en la documentación operativa del proyecto
- [x] Revisar y versionar las migraciones `20260521_000014_align_recruitment_phase1_schema_and_backfill.sql` y `20260521_000015_align_recruitment_phase1_constraints.sql`
- [x] Publicar el cierre para que la alineación de Supabase no dependa de memoria oral ni de cambios manuales sueltos

## Resultado del cierre de migraciones manuales de Recruitment Phase 1

- Quedó asentada como regla permanente del proyecto que no se incorporan datos falsos, módulos vacíos ni interacciones sin utilidad operativa real.
- Se versionaron las migraciones [20260521_000014_align_recruitment_phase1_schema_and_backfill.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260521_000014_align_recruitment_phase1_schema_and_backfill.sql:1) y [20260521_000015_align_recruitment_phase1_constraints.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260521_000015_align_recruitment_phase1_constraints.sql:1) como reflejo formal del ajuste ya aplicado en Supabase.
- Con esto, la apertura automática de `recruitment_cases`, el backfill de folios aprobados y la alineación de constraints dejan de depender de memoria oral o correcciones manuales sueltas.

## Refinamiento UX de Control de Contrataciones

- [x] Quitar elementos sin utilidad operativa inmediata en `Resumen de procesos de contratación`
- [x] Expandir la tabla de resumen a ancho completo y eliminar el panel lateral vacío
- [x] Retirar la alta improvisada de candidatos del frontend actual
- [x] Revalidar compilación, build y publicar el ajuste

## Resultado del refinamiento UX de Control de Contrataciones

- Se eliminó la tarjeta `Pendientes control` del resumen superior por no comunicar una métrica operativa clara.
- `Resumen de procesos de contratación` quedó reducido a una tabla de seguimiento a ancho completo, sin panel lateral vacío y sin filas que aparenten una interacción que hoy no existe.
- Se retiró del frontend la alta manual de candidatos dentro del resumen por no existir todavía un flujo operacional defendible para esa acción.
- `Control de candidatos` se mantiene como consola de seguimiento y avance de etapa, sin mezclar una carga inicial improvisada de personas.
- Validación:
  - `npx tsc -b`: correcto
  - `npm run build`: correcto

## Reencuadre Fase 1 de Control de Contrataciones

- [x] Reestructurar el frontend del submódulo `Control de Contrataciones` en dos submódulos internos:
  - `Resumen de procesos de contratación`
  - `Control de candidatos`
- [x] Extender el backend de Fase 1 para soportar una bandeja operativa de candidatos transversal a folios/casos activos
- [x] Endurecer la regla operacional de candidato multi-folio: puede participar en varios folios, pero solo uno puede quedar avanzando a contrato
- [x] Verificar si el ajuste requiere extensión de autorización en `app_modules`, `role_module_access`, `app_roles` o `profiles`
- [x] Revalidar compilación, build y flujo base del submódulo después del ajuste

## Resultado del reencuadre Fase 1 de Control de Contrataciones

- `Control de Contrataciones` quedó separado en dos submódulos internos dentro de la misma pantalla:
  - `Resumen de procesos de contratación`
  - `Control de candidatos`
- Se agregó la migración [20260520_000013_refine_recruitment_control_phase1.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260520_000013_refine_recruitment_control_phase1.sql:1) para:
  - enriquecer `get_recruitment_control_dashboard_v2()` con una bandeja transversal de candidatos activos
  - endurecer `advance_recruitment_candidate_stage(...)` para impedir que un mismo candidato avance a `ready_for_hire` o `hired` en más de un folio activo a la vez
  - exponer el contexto de bloqueo contractual desde backend
- [HiringStatusPage.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringStatusPage.tsx:1) ahora separa explícitamente el seguimiento por folio del control operativo de candidatos sin abrir un módulo nuevo en la navegación global.
- [hiringControl.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:1) ahora tipa y consume `candidate_control` como fuente oficial del submódulo de candidatos.
- Revisión de autorización:
  - no fue necesario extender `app_modules`, `role_module_access`, `app_roles` ni `profiles`
  - el ajuste vive dentro de `control_contrataciones` y reutiliza los scopes operativos ya definidos para el módulo
- Validación:
  - `npx tsc -b`: correcto
  - `npm run build`: correcto

## Endurecimiento seguro de hiring_requests

- [x] Revisar y cerrar la migración `20260520_000006_secure_hiring_requests_workflow.sql` para que la cadena quede secuencial, auditable y sin `UPDATE` directo desde frontend
- [x] Adaptar `Solicitud de Contrataciones` para usar `submit_hiring_request(...)` enviando solo IDs y campos libres del solicitante
- [x] Adaptar `Inicio` para usar `decide_hiring_request_approval_v2(...)`, mostrar comentario opcional y reflejar los nuevos estados del flujo
- [x] Revalidar compilación y build, documentar el cierre y dejar el cambio publicado

## Resultado de endurecimiento seguro de hiring_requests

- Se formalizó la migración [20260520_000006_secure_hiring_requests_workflow.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260520_000006_secure_hiring_requests_workflow.sql:1) con:
  - `cost_center_approvers`
  - `workflow_approvers`
  - `hiring_request_snapshots`
  - `hiring_request_audit_log`
  - nuevos estados secuenciales en `hiring_requests`
  - bloqueo de `UPDATE` directo desde `authenticated`
  - RPC `submit_hiring_request(...)`
  - RPC `decide_hiring_request_approval_v2(...)`
- La visibilidad de solicitudes y snapshots quedó restringida al solicitante, admin y aprobador de la etapa pendiente actual.
- `Solicitud de Contrataciones` ya no envía nombres derivados del frontend; solo IDs y campos libres del solicitante mediante [hiringRequests.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringRequests.ts:1).
- `Inicio` ahora decide por `decide_hiring_request_approval_v2(...)`, siempre filtra pendientes por `approver_user_id = auth.uid()` y permite comentario opcional en el detalle de aprobación.
- `Mis solicitudes` usa `submitted_at` cuando existe para calcular `Días desde solicitud`.
- Validación:
  - `npx tsc -b`: correcto
  - `npx vite build`: correcto

## Navegación superior Opaline

- [x] Reemplazar la barra lateral por una navegación superior que aproveche el ancho horizontal
- [x] Renombrar `Reclutamiento & Entrenamiento` a `Reclutamiento`
- [x] Implementar submenú flotante para `Reclutamiento` con apertura por hover y fijación por clic
- [x] Agregar módulos vacíos `Operaciones` y `Recursos Humanos`
- [x] Migrar la paleta visual principal a contrastes Opaline
- [x] Verificar si el cambio de módulos exige extensión en `app_modules` y `role_module_access`
- [x] Revalidar compilación y comportamiento base del shell superior

## Resultado de navegación superior Opaline

- La app dejó de usar la barra lateral y ahora concentra la navegación principal en una barra superior que aprovecha el ancho horizontal.
- `Reclutamiento & Entrenamiento` fue renombrado a `Reclutamiento`.
- El submenú de `Reclutamiento` quedó con apertura por hover y fijación por clic dentro del shell superior.
- Se agregaron los módulos placeholder `Operaciones` y `Recursos Humanos`.
- Se migró la paleta principal del shell y de los componentes base a contrastes Opaline, eliminando la dependencia visual del rojo anterior como lenguaje dominante.
- Se agregó la migración [20260516_000004_add_topnav_modules.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260516_000004_add_topnav_modules.sql:1) para extender:
  - `app_modules`
  - `role_module_access`
  con acceso inicial de `admin` para los dos módulos nuevos.
- `npm run build`: correcto

## Reordenamiento de Inicio y compactación de Solicitud de Contrataciones

- [x] Priorizar la bandeja de aprobaciones pendientes en la parte superior de `Inicio`
- [x] Eliminar `Estado operativo` y `Ultimas solicitudes realizadas`
- [x] Enriquecer `Mis solicitudes` con folio, cargo solicitado, contrato y vacantes
- [x] Separar visualmente acciones de aprobación con colores fijos gris/verde/rojo
- [x] Compactar la cabecera del formulario de `Solicitud de Contrataciones` usando más columnas
- [x] Revalidar compilación después del ajuste

## Resultado de reordenamiento de Inicio y compactación

- `Inicio` ahora muestra primero la bandeja de aprobaciones pendientes.
- `Ver detalle` quedó gris, `Aprobar` verde y `Rechazar` rojo en la sección de aprobaciones.
- Se eliminó la tarjeta `Estado operativo`.
- Se eliminó la sección `Ultimas solicitudes realizadas`.
- `Mis solicitudes` bajó a una sección propia y ahora muestra:
  - folio
  - cargo solicitado
  - contrato
  - vacantes
- `Solicitud de Contrataciones` redistribuyó `Nombre solicitante`, `Cargo solicitante` y `Correo solicitante` en una grilla superior más compacta, y dejó `Cargo solicitado`, `Vacantes` y `Fecha solicitada ingreso` compartiendo la siguiente franja horizontal.
- `npm run build`: correcto

## Integración inicial de login con Supabase

- [x] Definir variables de entorno locales para `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- [x] Instalar `@supabase/supabase-js`
- [x] Crear cliente Supabase reusable para el frontend
- [x] Crear contexto de autenticación con sesión persistente
- [x] Proteger rutas privadas y aislar `/login` como ruta pública
- [x] Conectar la pantalla de login al flujo real de `signInWithPassword`
- [x] Validar compilación TypeScript
- [x] Validar build de Vite
- [x] Documentar resultado de verificación y siguiente paso del módulo

## Revisión final

- [x] Confirmar que el proyecto compila sin errores
- [x] Confirmar que el build finaliza correctamente
- [x] Dejar siguiente paso explícito: modelado SQL de auth/perfiles/catálogos para `Solicitud de Contrataciones`

## Resultado de verificación

- `npx tsc --noEmit`: correcto
- `npm run build`: correcto
- Se implementó carga diferida por rutas para reducir el bundle principal de `541.52 kB` a `382.05 kB`
- El siguiente paso técnico es crear el esquema SQL inicial de Supabase para:
  - `profiles`
  - `job_positions`
  - `contracts`
  - `shifts`
  - `hiring_requests`

## Endurecimiento de acceso y recuperación

- [x] Eliminar cualquier vía alternativa de ingreso distinta al flujo real de `Continuar`
- [x] Agregar flujo útil de recuperación/reinicio de contraseña con Supabase
- [x] Restringir visibilidad de módulos por rol con política por defecto restrictiva
- [x] Restringir acceso por ruta a módulos no autorizados
- [x] Revalidar compilación y build después del endurecimiento

## Resultado de verificación 2

- `npx tsc --noEmit`: correcto
- `npm run build`: correcto
- Se agregó:
  - `/reset-password`
  - `/sin-acceso`
  - gating por rol en navegación y rutas
- Recordatorio operativo:
  - Cloudflare Pages debe tener `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` configuradas en variables de entorno; de lo contrario, `Continuar` no podrá autenticar contra Supabase

## Base robusta de usuarios y permisos

- [x] Definir un esquema formal de perfiles, roles y acceso a módulos en Supabase
- [x] Materializar ese esquema en una migración SQL dentro del proyecto
- [x] Documentar qué datos debe tener cada usuario futuro
- [x] Documentar cómo poblar los dos primeros usuarios de prueba
- [ ] Ejecutar la migración en Supabase
- [ ] Cambiar el frontend para que lea roles desde tablas reales en vez de metadata temporal

## Revisión profunda y limpieza

- [x] Revisar residuos funcionales de la etapa SharePoint/Microsoft 365 dentro del frontend activo
- [x] Migrar autorización del frontend desde metadata/allowlist a tablas reales de Supabase
- [x] Optimizar carga de autorización reduciendo round-trips evitables
- [x] Revalidar compilación y build después de la limpieza

## Resultado de revisión profunda

- Se eliminaron dependencias temporales de autorización por correo y metadata.
- La app ya toma visibilidad de módulos y acceso por ruta desde:
  - `profiles`
  - `user_roles`
  - `role_module_access`
  - `app_modules`
- Se limpiaron textos activos del frontend que seguían apuntando a SharePoint/Microsoft 365.
- Se optimizó la carga inicial de autorización leyendo perfil y roles en paralelo.
- Quedan fuera del build, pero siguen presentes en el repo como archivos no versionados:
  - `GeneradordeCertificados_20260417034937/`
  - `certificado_tipo_rev02.docx`
  - `generador_de_certificados_rev02.xlsx`

## Solicitud de Contrataciones con datos reales

- [x] Regenerar catálogos locales de `cargo solicitado` y `contratos` desde `cargos.xlsx` y `bbdd-cecos.xlsx`
- [x] Ajustar el formulario para tomar `nombre`, `correo` y `cargo` del usuario autenticado
- [x] Eliminar `Gerente del área` del modelo, formulario y resumen de la solicitud
- [x] Mantener campos `Sí/No` como selección controlada
- [x] Verificar si este cambio requiere extensión de autorización en Supabase
- [x] Revalidar compilación y build después del ajuste

## Resultado de Solicitud de Contrataciones con datos reales

- `Nombre solicitante`, `Cargo solicitante` y `Correo solicitante` ahora salen del usuario autenticado mediante `useAuth()`.
- `Cargo solicitado` quedó regenerado desde `cargos.xlsx`.
- `Nombre de contrato` y los datos autocompletables quedaron regenerados desde `bbdd-cecos.xlsx` usando:
  - `Proyecto`
  - `Descripcion Proyecto`
  - `Unidad de Costo`
  - `Descripción Unidad de Costo`
  - `Centro de Costo`
  - `Descripción Centro de Costo`
- `Gerente del área` fue eliminado del tipo, formulario, resumen y catálogo local.
- Los campos `Sí/No` se mantienen como selección controlada.
- Revisión de autorización:
  - no fue necesario extender `app_modules`, `role_module_access`, `app_roles` ni `profiles`, porque no se agregó un módulo nuevo ni un nuevo perfil operativo.
- `npx tsc --noEmit`: correcto
- `npm run build`: correcto

## Solicitud de Contrataciones sobre Supabase

- [x] Definir tablas y seeds de Supabase para `cargo solicitado`, `contratos`, `turnos` y base de solicitudes
- [x] Cambiar el frontend para leer catálogos del módulo directamente desde Supabase
- [x] Eliminar dependencia funcional de CSV locales en este módulo
- [x] Verificar si el ajuste exige cambios en autorización del módulo
- [x] Revalidar compilación y build después de la migración

## Resultado de Solicitud de Contrataciones sobre Supabase

- Se agregó la migración [20260515_000002_hiring_module_foundation.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260515_000002_hiring_module_foundation.sql:1) con:
  - `job_positions`
  - `contracts`
  - `shifts`
  - `hiring_requests`
  - seeds iniciales para cargos, contratos y turnos
  - políticas RLS para lectura de catálogos y operación base de solicitudes
- `HiringRequestPage` ahora lee cargos, contratos y turnos desde Supabase usando [hiringCatalogs.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringCatalogs.ts:1).
- El módulo ya no depende funcionalmente de los CSV locales de contratación, aunque los archivos siguen presentes en el repo y se pueden eliminar en una pasada de limpieza posterior.
- Revisión de autorización:
  - no fue necesario extender `app_modules`, `role_module_access`, `app_roles` ni `profiles`, porque el módulo y los perfiles operativos ya existían.
- `npx tsc --noEmit`: correcto
- `npm run build`: correcto

## Persistencia y aprobaciones de contrataciones

- [x] Extender el esquema de Supabase para soportar aprobaciones de solicitudes de contratación
- [x] Agregar mecanismo de creación real de solicitudes en base de datos
- [x] Dejar la solicitud en estado `pendiente` mientras falten aprobaciones requeridas
- [x] Preparar estructura para que `Control de Contrataciones` lea el requerimiento base desde la misma fuente
- [x] Verificar si este ajuste exige cambios en autorización o roles
- [x] Revalidar compilación y build después del ajuste

## Resultado de persistencia y aprobaciones de contrataciones

- Se agregó la migración [20260515_000003_hiring_request_approvals.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260515_000003_hiring_request_approvals.sql:1) con:
  - `hiring_approval_configs`
  - `hiring_request_approvals`
  - función `refresh_hiring_request_status(...)`
  - RPC `create_hiring_request(...)`
  - RPC `decide_hiring_request_approval(...)`
- `Solicitud de Contrataciones` ya no solo arma un resumen local: ahora quedó preparada para guardar el requerimiento completo en Supabase usando [hiringRequests.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringRequests.ts:1).
- La lógica de estado quedó definida así:
  - `pendiente` mientras falte la aprobación operativa o de control de contratos
  - `rechazada` si cualquier aprobación requerida rechaza
  - `aprobada` si las tres etapas requeridas quedan aprobadas
- La misma tabla `hiring_requests` queda como fuente maestra para que `Control de Contrataciones` lea el requerimiento base.
- Revisión de autorización:
  - no fue necesario extender `app_modules`, `role_module_access`, `app_roles` ni `profiles`, porque se reutilizan los perfiles y módulos ya existentes
  - las aprobaciones quedan controladas por asignación de usuario en `hiring_approval_configs`
- `npx tsc --noEmit`: correcto
- `npm run build`: correcto

## Refinamiento de Inicio para aprobaciones

- [x] Corregir lectura de roles desde el esquema real de `user_roles`
- [x] Hacer visible la bandeja de aprobaciones para `admin` y `aprobador_folios`
- [x] Agregar vista de detalle del requerimiento desde `Inicio`
- [x] Ajustar composición visual y jerarquía de botones para la aprobación
- [x] Completar detalle con renta, campamento, pasajes y beneficios
- [x] Revalidar compilación y publicar el ajuste visual

## Responsividad de Inicio

- [x] Reducir presión visual del shell lateral en laptops pequeñas

## Corrección estructural de shell superior y módulos Operativos

- [x] Corregir la interacción del mega menú superior para que los submódulos de `Reclutamiento` y `Operaciones` sean clickeables
- [x] Eliminar la barra lateral interna del módulo `Operaciones` y reestructurarlo bajo el shell superior común
- [x] Renombrar `Inicio` a `Resumen` en `Operaciones` y alinear sus submódulos al patrón de navegación superior
- [x] Corregir el calendario de `Operaciones` para que tenga fondo opaco y contraste legible
- [x] Reequilibrar `Solicitud de Contrataciones` para que el resumen lateral no empuje visualmente el formulario
- [x] Documentar la revisión de concordancia del módulo `Operaciones` con la arquitectura general
- [x] Revalidar compilación y preparar deploy verificado

## Resultado de corrección estructural de shell superior y módulos Operativos

- El mega menú superior ahora usa un contenedor de referencia que incluye tanto la barra como el panel flotante, evitando que el detector de click externo cierre el menú antes de navegar.
- `Reclutamiento` y `Operaciones` comparten ahora el mismo patrón de submódulos flotantes en la barra superior.
- `Operaciones` dejó de comportarse como una mini app interna:
  - se eliminó la barra lateral negra
  - los filtros y métricas se movieron a tarjetas contextuales dentro del área principal
  - `Inicio` pasó a `Resumen`
- El selector de fecha de `Operaciones` quedó con fondo opaco y contraste legible.
- `Solicitud de Contrataciones` se reequilibró:
  - el resumen volvió a una columna lateral limpia
  - el `hero` superior se compactó
  - se eliminaron bloques duplicados de unidad/centro de costo que estaban alargando la página
- Revisión de concordancia y autorización:
  - no fue necesario extender `app_modules` ni `role_module_access`
  - todos los submódulos de `Operaciones` siguen agrupados bajo `moduleCode: "operaciones"`
  - `Recursos Humanos` mantiene su propio `moduleCode` separado
- `npm run build`: correcto

## Ajuste de densidad del shell superior y hero de contratación

- [x] Compactar la barra superior al patrón visual de referencia
- [x] Retirar el marcador temporal de build del módulo de contratación
- [x] Reducir altura del hero y densidad del resumen lateral
- [x] Revalidar compilación

## Resultado de ajuste de densidad

- La barra superior redujo altura útil y padding para acercarse al patrón compacto de referencia.
- El mega menú mantiene iconos y estructura flotante, pero con una densidad más controlada.
- `Solicitud de Contrataciones` eliminó el marcador temporal, bajó la altura del hero y compactó el resumen lateral para que el formulario arranque antes.
- `npm run build`: correcto

## Corrección de login, overlays de calendario y shell superior

- [x] Corregir el layout del login para que colapse correctamente en pantallas más estrechas
- [x] Asegurar que los calendarios flotantes queden sobre tarjetas y resúmenes adyacentes
- [x] Convertir el shell superior en una barra plana continua pegada al borde superior
- [x] Revalidar compilación

## Resultado de corrección de login, overlays y shell

- El login ahora tiene un breakpoint real para pasar de dos columnas a una sola antes de que una mitad se degrade visualmente.
- Los calendarios de selección de fecha quedaron por encima de cajas y paneles vecinos tanto en Reclutamiento como en Operaciones.
- La navegación superior dejó de estar encapsulada en una cápsula redondeada y pasó a una barra continua pegada al borde superior del lienzo.
- `npm run build`: correcto
- [x] Hacer que las grillas de `Inicio` colapsen antes para evitar hacinamiento
- [x] Reacomodar cards y acciones de aprobaciones para pantallas medianas y móviles
- [x] Revalidar compilación y publicar el ajuste responsivo

## Estrategia de despliegue en Cloudflare

- [x] Revisar si la app requiere runtime dinámico o si puede desplegarse como sitio estático
- [x] Identificar la causa exacta del fallo de deploy observado en Cloudflare
- [x] Definir la configuración correcta de Cloudflare para este repo
- [x] Documentar el flujo operativo de despliegue y variables requeridas

## Resultado de estrategia de despliegue en Cloudflare

- La app actual no requiere Worker ni runtime Node en producción; el backend ya vive en Supabase y el frontend compila a `dist/`.
- El fallo de deploy no está en la app ni en el build de Vite: proviene de ejecutar `npx wrangler deploy`, que intenta autodetectar un flujo de Worker/Framework y exige `Vite >= 6`.
- Para este repo, el modo correcto es `Cloudflare Pages` con:
  - `Build command`: `npm run build`
  - `Build output directory`: `dist`
  - sin `Deploy command`
- Variables mínimas requeridas en Cloudflare:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Se documentó el procedimiento operativo en `docs/deploy-cloudflare-pages.md`.

## Estructura de barra lateral adaptable

- [x] Eliminar el patrón de submódulos flotantes del shell lateral
- [x] Volver a integrar submódulos dentro de la barra lateral
- [x] Hacer que el ancho lateral se adapte al contenido abierto en vez de truncar o romper textos
- [x] Revalidar compilación después del cambio estructural

## Resultado de estructura de barra lateral adaptable

- Los submódulos volvieron a renderizarse dentro de la barra lateral; ya no usan panel flotante sobre el contenido principal.
- El ancho del shell lateral ahora se calcula desde el contenido visible de navegación y se expande o contrae según la sección abierta.
- Se mantuvo la regla visual del proyecto:
  - una sola línea
  - sin cortes en dos líneas
  - sin acortar nombres por diseño cuando el shell puede ceder ancho

## Reconfiguración ancha de Solicitud de Contrataciones

- [x] Reestructurar el formulario para usar el ancho libre dejado por la barra superior
- [x] Mover el hero y el resumen a la franja superior útil del workspace
- [x] Reasignar anchos de grilla por prioridad para solicitante, cargo, correo, contrato y número de contrato
- [x] Recompactar labels y campos sin saltos de línea ni filas dobles
- [x] Revalidar compilación después del refactor

## Resultado de reconfiguración ancha

- `Solicitud de Contrataciones` dejó de usar una composición heredada de la época de barra lateral.
- El `hero-panel` ahora vive dentro del `workspace` principal y el resumen lateral ocupa la franja derecha superior en vez de dejar media pantalla vacía.
- La grilla superior fue redistribuida por prioridad real:
  - `Nombre solicitante`, `Cargo solicitante` y `Correo solicitante` reciben más ancho útil
  - `Cargo solicitado`, `Numero de Vacantes` y `Fecha solicitada ingreso` quedaron balanceados para mantener una sola línea
  - `Nombre de contrato` y `Numero contrato` ahora comparten la misma fila
- Se reorganizaron también:
  - `Fecha inicio`, `Fecha termino`, `Turno`
  - `Campamento`, `Pasajes`, `Renta liquida ofrecida`
- `npm run build`: correcto

## Ajuste de separación entre shell superior y contenido

- [x] Corregir la reserva vertical del header sticky para evitar que el contenido quede visualmente debajo de la barra
- [x] Alinear el resumen lateral con la franja superior del formulario sin invadir el shell
- [x] Revalidar compilación después del ajuste

## Resultado de ajuste de separación

- El shell superior ahora reserva altura real coherente con su volumen visual.
- Se eliminó el efecto de solapamiento entre la barra superior y la primera franja de `Solicitud de Contrataciones`.
- El resumen lateral se desplazó levemente para alinearse con el hero sin invadir el header.
- `npm run build`: correcto

## Reposición estructural del resumen lateral

- [x] Separar el hero superior de la fila donde conviven formulario y resumen
- [x] Mantener el resumen lateral usando la banda derecha, pero sin competir con el hero
- [x] Revalidar compilación

## Resultado de reposición estructural

- El hero de `Solicitud de Contrataciones` vuelve a ocupar una franja superior completa.
- El formulario y el resumen ahora conviven recién en la segunda fila del workspace.
- Se elimina la sensación de superposición entre el resumen de la derecha y la cabecera del módulo.
- `npm run build`: correcto

## Compactación del detalle de aprobación

- [x] Reconfigurar la grilla del detalle para dar prioridad de ancho a campos largos
- [x] Reducir altura visual de burbujas y ajustar tipografía para mayor densidad
- [x] Eliminar cortes visibles en `Solicitante` y `Número contrato`
- [x] Revalidar compilación después del ajuste

## Resultado de compactación del detalle de aprobación

- La grilla del detalle dejó de usar celdas uniformes y pasó a una composición proporcional de 12 columnas.
- `Solicitante`, `Cargo solicitado` y `Número contrato` recibieron más ancho estructural que `Folio` y `Vacantes`.
- Las burbujas se adelgazaron aproximadamente un 30% mediante reducción de padding, radio y tipografía.
- Los chips informativos también quedaron más compactos para sostener la limpieza visual del panel.
- `npm run build`: correcto

## Auditoría técnica, seguridad y limpieza base

- [ ] Endurecer navegación protegida según estado real del perfil y obligación de reseteo de clave
- [ ] Eliminar fragilidad entre frontend y RPC de contratación por deriva `v1`/`v2`
- [ ] Limpiar redundancias de tipos/consultas en el dashboard de aprobaciones
- [ ] Ejecutar validaciones técnicas y documentar hallazgos de seguridad/dependencias

## Compactación estructural del formulario de contratación

- [x] Definir una grilla específica para `hero`, `formulario` y `resumen`
- [x] Compactar el resumen lateral para que no empuje visualmente el formulario hacia abajo
- [x] Reducir altura del bloque hero sin perder jerarquía visual
- [x] Revalidar compilación después del ajuste

## Resultado de compactación estructural

- `Solicitud de Contrataciones` dejó de depender de una composición implícita del shell; ahora usa una grilla dedicada para `hero`, `formulario` y `resumen`.
- El panel de resumen lateral fue reducido a un set corto de campos clave y a una malla de dos columnas para no generar una lista vertical innecesariamente larga.
- El hero se compactó para liberar altura útil y hacer que los primeros controles del formulario aparezcan antes.
- `npm run build`: correcto

## Ajuste fino del resumen y campo de renta

- [x] Reubicar correctamente el sufijo `$` del campo `Renta liquida ofrecida`
- [x] Volver el resumen lateral a una sola columna vertical
- [x] Ceder algo de ancho del formulario para mejorar lectura del resumen
- [x] Revalidar compilación

## Resultado de ajuste fino del resumen y renta

- El símbolo `$` quedó anclado al control de renta y ya no al bloque completo del campo.
- El resumen lateral volvió a una sola columna de lectura continua.
- La columna izquierda del formulario cedió ancho suficiente para que el resumen use la altura lateral completa sin compactarse en dos columnas.
- `npm run build`: correcto

## Corrección de desborde del formulario bajo el resumen

- [x] Eliminar mínimos rígidos acumulados en las subgrillas internas del formulario
- [x] Forzar `min-width: 0` en grupos de campo y fecha
- [x] Revalidar compilación

## Resultado de corrección de desborde

- Las grillas internas del formulario dejaron de empujar contenido hacia la columna del resumen.
- `Nombre solicitante`, `Cargo solicitante`, `Correo solicitante`, `Cargo solicitado` y las filas siguientes ahora ceden ancho entre sí en vez de invadir el panel derecho.
- `npm run build`: correcto

## Corrección del layout lateral en Generador de Certificados

- [x] Aislar una grilla propia para `Generador de Certificados`
- [x] Evitar que el formulario reutilice la grilla lateral de contratación
- [x] Revalidar compilación

## Resultado de corrección en certificados

- `Generador de Certificados` ahora usa una grilla específica para su relación `formulario/resumen`.
- Se evita arrastrar la misma tensión de layout que tenía `Solicitud de Contrataciones`.
- `npm run build`: correcto


## Ajuste fino de shell superior y submenús rectos

- [x] Corregir estado activo para que `Inicio` solo aparezca seleccionado en `/`
- [x] Agrandar y reposicionar el logo JM arriba a la izquierda del header
- [x] Reemplazar el globo de submenús por panel rectangular alineado al header y con separadores
- [x] Eliminar sombra del estado activo y dejar solo contorno del menú seleccionado
- [x] Revalidar compilación y empujar a `main`

## Resultado de ajuste fino de shell superior y submenús rectos

- `Inicio` ya no queda falsamente activo fuera de `/`; ahora usa coincidencia exacta.
- El logo JM del header superior ganó tamaño y quedó anclado más arriba y a la izquierda dentro de su bloque.
- Los submenús dejaron de abrirse como cápsulas redondeadas y ahora usan un panel rectangular continuo, sin sombra y con separadores entre opciones.
- Los menús seleccionados mantienen solo el contorno/cápsula de selección, sin sombras activas.
- `npm run build`: correcto


## Ajuste visual Mailgun del header superior

- [x] Eliminar cápsulas por defecto en módulos superiores y dejar solo selección por línea azul inferior
- [x] Convertir submenús en panel limpio sin tarjetas internas ni globos
- [x] Mantener iconos y texto alineados con jerarquía editorial simple
- [x] Revalidar compilación y empujar a `main`

## Resultado de ajuste visual Mailgun del header superior

- Los módulos superiores dejaron de verse como botones/cápsulas por defecto; ahora son texto limpio y solo el seleccionado muestra línea azul inferior.
- Los submenús quedaron como panel limpio, sin cuadros internos ni globos alrededor de cada opción.
- Se mantuvieron iconos y copy, pero con jerarquía visual más plana y editorial.
- `npm run build`: correcto


## Barrido profundo de limpieza, rendimiento y seguridad

- [x] Ejecutar verificación técnica base (`build`, `npm audit`) y capturar hallazgos
- [x] Detectar archivos, assets y catálogos residuales que no tengan referencias reales
- [x] Eliminar residuos seguros y simplificar código/configuración redundante
- [x] Ajustar puntos de rendimiento o mantenibilidad de bajo riesgo encontrados en la pasada
- [ ] Documentar lecciones, revalidar build y empujar a `main`

## Hallazgos iniciales del barrido

- `npm audit --omit=dev` detectó 1 vulnerabilidad alta en `xlsx`; no tiene fix publicado desde upstream.
- Hay duplicidad de assets entre `src/assets` y `public/assets`. Las copias públicas de:
  - `app-logo.png`
  - `certification-icon.png`
  - `recruiting-icon.png`
  - `status-success.png`
  no tienen ya consumidores directos necesarios fuera de runtime legado.
- Los catálogos locales:
  - `src/shared/data/cargosSolicitud.csv`
  - `src/shared/data/contratosSolicitud.csv`
  - `src/shared/data/turnosSolicitud.csv`
  quedaron sin referencias tras migrar Reclutamiento a Supabase.
- El paquete exportado de Power Automate/SharePoint y su script de provisión siguen versionados, pero ya no forman parte del runtime actual de la app.

## Resultado del barrido profundo

- Se eliminaron catálogos locales de Reclutamiento ya reemplazados por Supabase:
  - `src/shared/data/cargosSolicitud.csv`
  - `src/shared/data/contratosSolicitud.csv`
  - `src/shared/data/turnosSolicitud.csv`
- Se eliminaron artefactos heredados de SharePoint/Power Automate:
  - `scripts/sharepoint/provision-certificates-lists.ps1`
  - `GeneradordeCertificados_20260417034937/`
  - documentación operativa SharePoint específica asociada
- Se consolidó el logo de `Operaciones` para usar el asset empaquetado de `src/assets` en vez de la copia pública duplicada.
- Se eliminaron copias públicas no utilizadas de:
  - `app-logo.png`
  - `certification-icon.png`
  - `recruiting-icon.png`
  - `status-success.png`
- `npm run build`: correcto
- No se detectaron secretos hardcodeados en runtime; las referencias encontradas a claves son nombres de variables/documentación o lectura desde entorno.
- Riesgo/vulnerabilidad pendiente:
  - `xlsx` mantiene 1 vulnerabilidad alta reportada por `npm audit --omit=dev`
  - no existe fix publicado desde upstream; el paquete sigue aislado por import dinámico solo en el exportador de `Operaciones`
- Deuda técnica detectada y no tocada en esta pasada por riesgo de regresión:
  - `// @ts-nocheck` sigue presente en:
    - `src/modules/operaciones/pages/OperacionesDashboard.tsx`
    - `src/modules/operaciones/services/operacionesApi.ts`
    - `src/modules/operaciones/lib/service-entry.ts`
    - `src/modules/operaciones/data/services-data.ts`


## Ajuste de contenido e iconografía del login

- [x] Cambiar textos solicitados del panel izquierdo y del pie derecho del login
- [x] Corregir contraste del texto inferior izquierdo para que sea blanco
- [x] Integrar iconos `operacion.png` y `recursos-humanos.png` con tamaño consistente
- [x] Convertir `Maximiliano Contreras` en enlace `mailto:`
- [x] Revalidar compilación y empujar a `main`

## Resultado de ajuste de contenido e iconografía del login

- El texto inferior del panel izquierdo volvió a blanco/alto contraste sobre el fondo rojo.
- Se reemplazaron los dos textos solicitados del bloque de beneficios y se integraron los iconos `operacion.png` y `recursos-humanos.png`.
- El pie derecho ahora dice `Plataforma diseñada por Maximiliano Contreras.` y el nombre abre `mailto:max.contrerasrey@icolud.com`.
- `npm run build`: correcto


## Consolidación versionada de `create_hiring_request_v2`

- [x] Revisar la deriva entre el SQL de producción y las migraciones versionadas del repo
- [x] Formalizar `create_hiring_request_v2` en una migración nueva
- [x] Alinear dependencias directas de la RPC (`area_manager` vs `operational_approval`) para que un entorno nuevo no nazca inconsistente
- [x] Documentar la deriva detectada y la corrección aplicada
- [x] Revalidar compilación y empujar a `main`

## Resultado de consolidación de `create_hiring_request_v2`

- Se agregó la migración [20260519_000005_consolidate_hiring_request_v2.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260519_000005_consolidate_hiring_request_v2.sql:1) para convertir en código versionado lo que hasta ahora solo existía en la base de producción.
- La migración no solo define `public.create_hiring_request_v2(...)`; también corrige la deriva inmediata que la rompía en entornos nuevos:
  - renombra `operational_approval` a `area_manager`
  - ajusta los `check constraints` de `hiring_approval_configs` y `hiring_request_approvals`
  - reemplaza `refresh_hiring_request_status(...)` para usar los códigos reales del flujo actual
  - deja `grant execute` formal para la RPC usada por el frontend
- El frontend sigue usando [hiringRequests.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringRequests.ts:1) sin cambios funcionales; la corrección se hizo en la capa correcta: el esquema versionado.
- `npm run build`: correcto


## Rediseño integral premium y consistente

- [x] Auditar shell, tokens globales, patrones de layout y deuda visual transversal
- [x] Redefinir design system global con tipografía, color, spacing y superficies coherentes
- [x] Rehacer navegación superior y submenús al patrón editorial enterprise solicitado
- [x] Unificar `Login`, `Inicio`, `Solicitud de Contrataciones`, `Control de Contrataciones`, `Certificados` y placeholders bajo el mismo lenguaje visual
- [x] Normalizar formularios, tablas, resúmenes laterales y estados
- [x] Revalidar compilación y revisar resultado final

### Revisión final

- Se eliminó la dependencia visual de `Inter` en el arranque y se unificó la app sobre una paleta neutra con acento funcional azul.
- El shell superior pasó a una navegación plana de estilo enterprise con submenús rectos y densidad visual más baja.
- `Login`, `Inicio`, `Solicitud de Contrataciones`, `Control de Contrataciones`, `Certificados` y paneles compartidos quedaron sobre el mismo sistema de superficies, radios, bordes y foco.
- Se detectó y corrigió fuga de estilos en `Operaciones`: el módulo redefinía `:root` y selectores genéricos como `label`, `input`, `select`, `textarea`, `login-shell` y `loading-shell`, contaminando el resto de la app tras navegar.
- Validación técnica ejecutada:
  - `npx tsc -b`
  - `npx vite build`


## Ajuste de resumen operativo en `Inicio`

- [x] Reemplazar la columna `Fecha` por una métrica de antigüedad en `Mis solicitudes`
- [x] Mantener el cálculo en frontend usando `created_at` ya disponible en el resumen
- [x] Revalidar compilación y dejar documentada la preferencia operacional

## Resultado de ajuste de resumen operativo en `Inicio`

- La tabla `Mis solicitudes` ahora muestra `Dias desde solicitud` en vez de una fecha fija.
- El cálculo usa la diferencia entre el inicio del día actual y el inicio del día de creación para evitar variaciones por hora.
- Se documentó la regla en `tasks/lessons.md`: para dashboards operacionales, la antigüedad es más útil que la fecha cruda cuando se busca priorización rápida.


## Provisionamiento definitivo de aprobadores desde Excel

- [x] Revisar la estructura real de `Hoja1` y mapear columnas a `auth.users`, `profiles`, `user_roles`, `cost_center_approvers` y `workflow_approvers`
- [x] Confirmar los roles y relaciones necesarias para `Aprobador Area` y `Aprobador Control de Contratos` en el esquema actual
- [x] Generar un script definitivo de provisión recomendado para Supabase Auth + tablas de aplicación
- [x] Entregar el script en una sola pieza, listo para ejecutar, con validaciones y orden de ejecución claro
- [x] Documentar el cierre y los supuestos operativos

## Resultado de provisionamiento definitivo de aprobadores desde Excel

- Se creó [scripts/provision-hiring-approvers.mjs](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/provision-hiring-approvers.mjs), un aprovisionador idempotente que:
  - lee `Hoja1` del Excel
  - crea o actualiza usuarios en Supabase Auth mediante `auth.admin`
  - sincroniza `profiles`
  - asigna `user_roles`
  - vincula `cost_center_approvers`
  - vincula `workflow_approvers` para `contracts_control`
- Se agregó el comando `npm run provision:hiring-approvers`.
- El mapeo de roles quedó así:
  - `Aprobador Area` -> `aprobador_folios`
  - `Aprobador Control de Contratos` -> `control_contratos` + `aprobador_folios`
- Si el usuario ya existe en Auth, el script lo actualiza por email y agrega los roles faltantes sin borrar roles previos. Eso cubre tu caso: el usuario administrador existente puede seguir siendo `admin` y además quedar como aprobador de `GERENCIA OPERACIONES ZONA II (NORTE INTERIOR)`.
- El script exige `SUPABASE_SERVICE_ROLE_KEY` para la ejecución real y permite `--dry-run` para validar el archivo antes de escribir.
- Validación ejecutada:
  - lectura real de `Hoja1` con 12 usuarios esperados
  - `node --check scripts/provision-hiring-approvers.mjs`
- Supuestos operativos:
  - las contraseñas del Excel son bootstrap passwords
  - el script deja `must_reset_password = true`
  - la carga de módulos/permisos base ya existe en la base actual


## Corrección de cambio forzado de contraseña para usuarios aprovisionados

- [x] Revisar el flujo actual de `must_reset_password` versus recuperación por correo
- [x] Permitir cambio de contraseña desde sesión autenticada sin exigir `recovery mode`
- [x] Limpiar `must_reset_password` al completar el cambio exitoso
- [x] Validar compilación y documentar la lección

## Resultado de corrección de cambio forzado de contraseña para usuarios aprovisionados

- La causa raíz estaba en [ResetPasswordPage.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/auth/pages/ResetPasswordPage.tsx): la vista usaba el mismo formulario para recuperación por correo y para cambio forzado por `must_reset_password`, pero bloqueaba el submit si `isRecoveryMode` era `false`.
- Se corrigió el flujo para aceptar también el caso de sesión autenticada normal con `must_reset_password = true`.
- En [AuthContext.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/auth/context/AuthContext.tsx) el cambio de contraseña ahora además limpia `profiles.must_reset_password = false`, evitando el loop de redirección a `/reset-password`.
- Validación ejecutada:
  - `npx tsc -b`
  - `npm run build`


## Hotfix de columnas faltantes en `hiring_request_approvals`

- [x] Confirmar la deriva real entre la RPC desplegada y el esquema productivo de `hiring_request_approvals`
- [x] Agregar migración idempotente para `approver_name` y `approver_email`
- [x] Empujar el hotfix al repo y dejar SQL exacto para aplicar en Supabase

## Resultado de corrección de carga de aprobaciones en `Inicio`

- La solicitud y su asignación estaban correctas en base:
  - `status = pending_area_manager`
  - `current_step_code = area_manager`
  - `approver_user_id = 0de4ef6f-3e52-4bab-8042-ab04ea7763ae`
- La falla estaba en el frontend de [HomePage.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/home/pages/HomePage.tsx): la bandeja dependía de un `select` con `hiring_requests!inner(...)`, y ante error de esa relación/embebido vaciaba también `Mis solicitudes`.
- Se reemplazó por una carga en dos pasos:
  - primero `hiring_request_approvals`
  - luego `hiring_requests` por `id`
  - unión en frontend
- Validación ejecutada:
  - `npx tsc -b`
  - `npm run build`


## Corrección de recursión RLS entre `hiring_requests` y `hiring_request_approvals`

- [x] Confirmar la dependencia circular entre las policies de selección
- [x] Agregar migración que simplifique `hiring_request_approvals_select_scoped`
- [x] Empujar el ajuste y dejar SQL exacto para aplicar en Supabase

## Resultado de corrección de recursión RLS entre `hiring_requests` y `hiring_request_approvals`

- Se confirmó la recursión entre las policies de `hiring_requests` y `hiring_request_approvals`, que rompía lecturas válidas del dashboard aun cuando los datos estuvieran bien asignados.
- Se versionó [20260520_000008_fix_hiring_approvals_rls_recursion.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260520_000008_fix_hiring_approvals_rls_recursion.sql:1) para dejar `hiring_request_approvals_select_scoped` acotada al aprobador asignado o admin.
- El ajuste quedó aplicado y permitió estabilizar la capa de lectura previa a la consolidación por RPC.


## Consolidación del resumen de `Inicio` por RPC segura

- [x] Reemplazar las consultas client-side dispersas por una RPC `security definer` para el dashboard de inicio
- [x] Actualizar `HomePage.tsx` para consumir la RPC y dejar de depender de joins/RLS complejos
- [x] Validar build y empujar el ajuste

## Resultado de consolidación del resumen de `Inicio` por RPC segura

- Se agregó [20260520_000009_add_home_dashboard_summary_rpc.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260520_000009_add_home_dashboard_summary_rpc.sql), que crea `public.get_home_dashboard_summary()` como RPC `security definer`.
- [HomePage.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/home/pages/HomePage.tsx) dejó de depender de múltiples consultas RLS desde cliente y ahora consume una sola RPC con:
  - `my_requests`
  - `pending_approvals`
- Esto elimina la fragilidad del resumen ante recursiones o joins problemáticos de PostgREST/RLS.
- Validación ejecutada:
  - `npx tsc -b`
  - `npm run build`


## Hotfix de ambigüedad en `decide_hiring_request_approval_v2`

- [x] Corregir referencias ambiguas entre variables de salida y columnas SQL dentro de la RPC de aprobación
- [x] Versionar el hotfix en una migración puntual y empujarlo a `main`
- [x] Entregar SQL exacto para aplicar inmediatamente en Supabase

## Resultado del hotfix de ambigüedad en `decide_hiring_request_approval_v2`

- Se corrigió la ambigüedad SQL entre `hiring_request_id` como nombre de salida y como columna interna dentro de la RPC de aprobación.
- El hotfix quedó versionado en [20260520_000010_fix_decide_hiring_request_approval_ambiguity.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260520_000010_fix_decide_hiring_request_approval_ambiguity.sql:1).
- La aprobación secuencial quedó validada end-to-end con los folios `0005` y `0007`, incluyendo aprobación, rechazo, traspaso a `contracts_control`, auditoría y snapshot para el flujo nuevo.


## Limpieza final del módulo de contrataciones

- [x] Eliminar remanentes legacy del flujo de contrataciones en Supabase mediante una migración final de cleanup
- [x] Reemplazar `Control de Contrataciones` basado en mocks por una vista real conectada a Supabase
- [x] Simplificar la capa frontend compartiendo servicios del flujo de aprobación donde hoy hay lógica duplicada
- [x] Revalidar compilación/build y documentar el cierre final del módulo

## Resultado de limpieza final del módulo de contrataciones

- Se agregó [20260520_000011_finalize_hiring_requests_cleanup.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260520_000011_finalize_hiring_requests_cleanup.sql:1), que:
  - elimina funciones legacy remanentes del flujo anterior
  - elimina `hiring_approval_configs` si aún existe
  - expone `public.get_hiring_control_dashboard()` como RPC `security definer` para la vista real de `Control de Contrataciones`
- [HiringStatusPage.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringStatusPage.tsx:1) dejó de usar mocks locales y ahora consume datos reales del módulo:
  - cola pendiente de `contracts_control`
  - resumen por estado
  - tabla de solicitudes recientes
  - detalle real por folio
- Se agregaron servicios compartidos:
  - [hiringControl.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:1)
  - [hiringWorkflow.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringWorkflow.ts:1)
- [HomePage.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/home/pages/HomePage.tsx:1) dejó de duplicar la llamada directa a la RPC de decisión y ahora comparte la misma capa de workflow.
- Validación ejecutada:
  - `npx tsc -b`
  - `npm run build`


## Diseño incremental del submódulo operativo de `Control de Contrataciones`

- [x] Definir el encaje del submódulo sobre `hiring_requests`, `hiring_request_approvals`, auditoría y RPCs existentes
- [x] Diseñar entidades nuevas para casos activos, candidatos, pipeline, checklist documental y vencimientos
- [x] Definir impacto de autorización en `app_modules`, `role_module_access`, `app_roles` y `profiles`
- [x] Proponer estrategia incremental de migraciones, RLS, RPCs y frontend sin romper producción

## Implementación Fase 1 de `Control de Contrataciones`

- [x] Crear migración aditiva para `recruitment_cases`, asignaciones, candidatos, historial de etapas y auditoría propia
- [x] Integrar apertura automática de caso al aprobar `contracts_control` sin romper `decide_hiring_request_approval_v2(...)`
- [x] Exponer RPCs Fase 1 para dashboard, detalle de caso, alta de candidato y avance de etapa
- [x] Evolucionar `/control-contrataciones` a workspace real de casos activos con tabla, detalle y pipeline básico
- [x] Revalidar autorización del submódulo con roles actuales y documentar si no se requieren roles nuevos en Fase 1
- [x] Ejecutar validación técnica con `npx tsc -b` y `npm run build`

## Resultado de Implementación Fase 1 de `Control de Contrataciones`

- Se agregó la migración [20260520_000012_recruitment_cases_phase1.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260520_000012_recruitment_cases_phase1.sql:1) con:
  - `recruitment_cases`
  - `recruitment_case_assignments`
  - `candidate_profiles`
  - `recruitment_case_candidates`
  - `recruitment_case_candidate_stage_history`
  - `recruitment_case_audit_log`
  - helpers de acceso y sincronización de estado del caso
  - RPCs Fase 1 para dashboard, detalle, alta de candidato y avance de etapa
- `decide_hiring_request_approval_v2(...)` quedó extendida para abrir automáticamente el `recruitment_case` cuando `contracts_control` aprueba la solicitud.
- La migración incluye backfill seguro para solicitudes ya aprobadas que todavía no tengan caso.
- Revisión de autorización:
  - no fue necesario crear un `app_module` nuevo
  - en Fase 1 no se agregaron `app_roles` nuevos
  - el submódulo opera con `admin`, `control_contratos` y `reclutamiento`, más asignaciones por caso
- [hiringControl.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:1) quedó como capa de servicios del workspace:
  - dashboard
  - detalle de caso
  - alta de candidato
  - avance de etapa
- [HiringStatusPage.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringStatusPage.tsx:1) ahora es un workspace operacional Fase 1 con:
  - cola de aprobación final
  - tabla de casos activos
  - detalle del caso
  - alta de candidatos
  - pipeline básico por etapas
  - auditoría resumida
- Validación ejecutada:
  - `npx tsc -b`
  - `npm run build`

## Refactorización de Arquitectura UI (Fase 1C)

- [x] Crear directorios para componentes compartidos en `src/shared/ui/`
- [x] Implementar componentes de Layout (`PageShell`)
- [x] Implementar componentes de Formulario (`TextField`, `SelectField`, `DatePickerField`)
- [x] Centralizar lógica de manejo de fechas en `src/shared/lib/date.ts`
- [x] Refactorizar `HiringRequestPage` para usar los nuevos componentes
- [x] Refactorizar inputs de fecha en `OperacionesDashboard` para usar `DatePickerField`

## Resultado de Refactorización de Arquitectura UI (Fase 1C)

- Se extrajo todo el HTML crudo y repetitivo hacia la nueva librería de componentes UI estandarizados, elevando la plataforma a nivel Enterprise.
- `HiringRequestPage.tsx` se redujo de más de 1,000 líneas a solo 571 líneas manteniendo exactitud visual y funcional.
- Se resolvió el bug de superposición de capas del calendario consolidando un `DatePickerField` robusto.
- Se reutilizó el mismo calendario corregido en `OperacionesDashboard.tsx`, garantizando consistencia.
- El código fue pusheado y desplegado exitosamente vía Cloudflare Pages.
- Validación ejecutada:
  - `npx tsc -b`
  - `npm run build`

## Auditoría Zero-Trust y Alineación de Supabase (Fase 2)

- [x] Auditar y restringir acceso de `control_contratos` al embudo operativo
- [x] Forzar RLS en tablas de auditoría como append-only
- [x] Bloquear ejecución manual de RPCs de apertura de casos fuera del flujo de aprobación

## Resultado de Auditoría Zero-Trust y Alineación de Supabase (Fase 2)

- Se aplicó la migración `20260522_000017_harden_recruitment_zero_trust.sql` para forzar la separación de poderes estricta en el pipeline de reclutamiento.
- Se blindó la inmutabilidad de la auditoría limitando su mutación a nivel RLS (`FORCE ROW LEVEL SECURITY`).
- Parche empaquetado, verificado y empujado a `main` en paralelo a las mejoras de interfaz.

## Implementación MVP del ATS Documental y Semáforo de Contratación

- [x] Crear tablas `document_types` y `candidate_documents` con RLS y enum `candidate_document_status`
- [x] Insertar catálogo maestro de 10 documentos base (Cédula, CV, Antecedentes, Licencia, etc.)
- [x] Implementar RPC `get_candidate_checklist(p_case_candidate_id)` con cálculo de semáforo dinámico (gris/verde/amarillo/rojo)
- [x] Implementar RPC `upload_candidate_document(...)` con auditoría y upsert por caso/candidato/documento
- [x] Implementar RPC `review_candidate_document(...)` con segregación de poderes: solo `compliance_documental` o `admin` aprueba documentos críticos
- [x] Endurecer `advance_recruitment_candidate_stage(...)` con bloqueo transaccional: si el semáforo no está verde, la DB rechaza avance a `ready_for_hire` o `hired`
- [x] Agregar tipos `CandidateDocumentRow`, `CandidateChecklistResult`, `CandidateDocumentStatus` a [hiringControl.ts](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/services/hiringControl.ts:1)
- [x] Agregar servicios `fetchCandidateChecklist`, `uploadCandidateDocument`, `reviewCandidateDocument`
- [x] Rediseñar [CandidateDetailSidebar.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateDetailSidebar.tsx:1) con sistema de Tabs: `Pipeline Operativo` / `Control Documental`
- [x] Crear [CandidateDocumentChecklist.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/CandidateDocumentChecklist.tsx:1) con banner de semáforo, grilla de documentos, indicadores visuales de estado y botones de acción
- [x] Agregar estilos enterprise para tabs, semáforo, filas documentales y badges críticos en [global.css](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/styles/global.css:1)
- [x] Revalidar compilación con `npx tsc -b` y `npm run build`
- [x] Registrar en `todo.md` y `lessons.md`
- [x] Empujar a `main` para deploy

## Resultado de implementación MVP del ATS Documental

- Se creó la migración [20260522_000020_candidate_documents_module.sql](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/migrations/20260522_000020_candidate_documents_module.sql:1) con:
  - enum `candidate_document_status` (`pending`, `uploaded`, `approved`, `rejected`, `expired`)
  - tabla `document_types` (catálogo maestro de documentos exigibles, con flags `is_critical` y `requires_expiry_date`)
  - tabla `candidate_documents` (instancia por candidato/caso/tipo, con unique constraint, índices y RLS scoped)
  - 10 documentos base pre-cargados (5 críticos, 5 no críticos)
  - RPC `get_candidate_checklist(...)` con cálculo de semáforo en tiempo de consulta
  - RPC `upload_candidate_document(...)` con upsert idempotente y auditoría
  - RPC `review_candidate_document(...)` con segregación: solo `compliance_documental` o `admin` revisa documentos `is_critical = true`
  - Regla de bloqueo inyectada en `advance_recruitment_candidate_stage(...)`: si el semáforo no es `green`, la DB arroja excepción bloqueante para `ready_for_hire` y `hired`
- El panel lateral de candidatos (`CandidateDetailSidebar`) fue rediseñado con un sistema de pestañas (Tabs):
  - **Pipeline Operativo:** datos del candidato, historial de etapas, bloqueo contractual, avance de etapa
  - **Control Documental:** banner de semáforo, grilla de documentos con indicadores de estado visual (borde izquierdo por color), badges `*Crítico`, y botones de acción contextuales (Cargar / Aprobar / Rechazar)
- Los estilos del sistema de tabs, semáforo y grilla documental usan la misma paleta Opaline y el design system enterprise del proyecto
- Validación ejecutada:
  - `npx tsc -b`: correcto
  - `npm run build`: correcto


## Fila expandible en Resumen de procesos de contratación

- [x] Agregar estados `expandedCaseId` y `caseDetailsCache` a `HiringProcessesView.tsx`
- [x] Hacer filas de la tabla clickeables con comportamiento acordeón (una sola abierta a la vez)
- [x] Cargar detalle del caso bajo demanda vía `fetchRecruitmentCaseDetail(caseId)` con caché
- [x] Renderizar fila hija con `colSpan={7}` mostrando grilla de 3 columnas: Solicitud original, Fechas y operación, Compensación y beneficios
- [x] Agregar estilos enterprise: chevron animado, hover suave, fondo Opaline para la fila expandida, secciones con bordes verticales
- [x] Revalidar compilación y build
- [x] Registrar en `todo.md` y `lessons.md`
- [x] Empujar a `main` para deploy

## Resultado de fila expandible en Resumen de procesos

- [HiringProcessesView.tsx](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/components/HiringProcessesView.tsx:1) ahora soporta filas expandibles tipo acordeón:
  - Al hacer clic en cualquier fila, se expande un panel debajo con el detalle completo de la solicitud original
  - El detalle se carga bajo demanda desde la RPC `get_recruitment_case_detail` y se cachea para no volver a consultarlo
  - Un chevron animado (▸ → ▾) indica visualmente qué fila está abierta
  - Solo una fila puede estar abierta a la vez
- La grilla expandida muestra 3 secciones con estilo enterprise:
  - **Solicitud original:** Solicitante, Correo, Folio, Centro de costo
  - **Fechas y operación:** Ingreso solicitado, Inicio/Fin contrato, Turno
  - **Compensación y beneficios:** Renta líquida, Campamento, Pasajes, Otros beneficios
- Estilos en [global.css](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/styles/global.css:1): filas clickeables con hover, fondo Opaline para la fila expandida, secciones con separadores verticales, tipografía escalonada (labels en 0.7rem, valores en 0.85rem)
- Validación ejecutada:
  - `npx tsc -b`: correcto
  - `npm run build`: correcto

## Registro de Licencias y Mejoras de UX (Sprint de Pulido - Fase 2)

- [x] Unificar columna "Folio / Caso" a solo "Caso" mostrando `case_code`.
- [x] Implementar formulario interactivo para registrar/editar Licencia de Conducir (Clase y Vencimiento) en el sidebar del candidato, persistiendo cambios mediante RPC segura `update_candidate_driver_license`.
- [x] Implementar buscador/lookup de candidato existente en `CandidateIntakeForm` mediante RPC segura `find_candidate_profile_by_rut` al ingresar un RUT válido, autocompletando nombre, correo y teléfono.
- [x] Bloquear registro de candidato en la UI e inhabilitar botón si el candidato ya participa en el caso seleccionado.
- [x] Reestructurar filtros del submódulo de candidatos para añadir "Activos en Proceso" (por defecto, excluye rechazados/retirados) y "Descartados" (muestra rechazados/retirados).
- [x] Habilitar la reactivación de candidatos en terminal states (`rejected` / `withdrawn`) permitiendo transiciones de vuelta a `"contacted"` o `"screening"`.
- [x] Reemplazar la cabecera grande (hero-panel) en `HiringStatusPage.tsx` por una cabecera minimalista delgada con un título elegante.
- [x] Validar compilación y empaquetado del bundle productivo sin errores.

## Resultado de Registro de Licencias y Mejoras de UX

- **Simplificación y Limpieza visual**: La columna de la tabla de candidatos ahora muestra únicamente el código del caso (`case_code`), eliminando el folio redundante. El formulario de alta se reencuadró dentro de la columna izquierda para evitar desbordes.
- **Cabecera Minimalista**: Se reemplazó la sección superior grande (hero-panel) en [HiringStatusPage.tsx](file:///Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/recruitment/pages/HiringStatusPage.tsx) por una cabecera delgada y elegante (`.minimal-page-header`), que muestra solo el título con fuente apenas mayor que el cuerpo de la página, alineado al diseño limpio del submódulo.
- **Edición local de Licencia**: Se integró un sub-formulario de edición en la sección de Licencia de Conducir en el sidebar del candidato, permitiendo registrar la clase y fecha de vencimiento. La persistencia se realiza mediante la RPC `update_candidate_driver_license` (Zero Trust).
- **Lookup por RUT y Autocompletado**: Al escribir un RUT válido, la UI ejecuta en segundo plano la RPC `find_candidate_profile_by_rut` para recuperar perfiles registrados globalmente y autocompletar sus datos.
- **Prevención de Duplicados en Caso**: Si el RUT ingresado ya está asignado al caso actual, el sistema muestra la advertencia `⚠️ Este candidato ya participa en el caso seleccionado en la etapa "..."` y deshabilita el botón de registro.
- **Filtro de Descartados**: El filtro por defecto de la tabla `"Activos en Proceso"` ahora limpia visualmente la vista ocultando candidatos en estado `rejected` o `withdrawn`. Para verlos o recuperarlos, se añadió la pestaña `"Descartados"`.
- **Reactivación de Candidatos**: En el panel lateral, el selector de etapa para candidatos descartados/retirados ahora habilita transiciones hacia `"contacted"` o `"screening"`. Al guardarse el cambio, el candidato regresa inmediatamente a la lista de activos en proceso.
- **Validación ejecutada**:
  - `npx tsc -b`: correcto
  - `npm run build`: correcto

