# Tareas y Roadmap de Desarrollo

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
