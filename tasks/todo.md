# Tareas y Roadmap de Desarrollo

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

## Fase 2B.1: capacidades efectivas backend para `Who`

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
