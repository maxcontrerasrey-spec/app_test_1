# Auditoría de estado actual — Atlas Operations Control

Fecha: 2026-09-30
Alcance: inspección del repositorio local. No se consultó ni modificó producción.

## Resumen

Atlas tiene un módulo Operaciones de captura por servicio base, fecha, turno, conductor BUK y equipo, además de resumen y exportación. No tiene aún una entidad de viaje despachable, hitos operacionales, confirmación de conductor, una Control Tower, posiciones GPS, geocercas ni integración TrackTec. En consecuencia, la vista actual representa planificación/captura registrada y no ejecución en tiempo real.

## Arquitectura y navegación existente

- SPA React 18 + TypeScript + Vite; rutas protegidas por `RoleProtectedRoute` con módulo `operaciones`.
- `/operaciones` redirige a `/operaciones/resumen`; las vistas se montan en `OperacionesDashboard`.
- Navegación actual: Resumen, Registro de servicios base, Registro de servicios especiales y Exportador. El registro especial es un placeholder.
- El dashboard agrega carga, estado, consultas y renderizado en una página extensa; consulta Supabase directamente además de llamar al servicio `operacionesApi.ts`.
- Las vistas consumen React Query selectivamente; la captura base usa `submit_service_entries_batch` y la búsqueda de conductor usa `search_operations_drivers`.
- La capa visual sigue la hoja `operaciones.css`; no hay mapa/SDK geoespacial reutilizable.

## Contratos de datos verificados

| Entidad existente | Uso vigente | Decisión |
|---|---|---|
| `contracts` | Catálogo y estado de contratos | Reutilizar como maestro. |
| `base_services` | Era el catálogo de servicios del módulo anterior | Retirar tabla/datos; reemplazar por `atlas_ops_service_templates` vacío. |
| `equipment` | Era el padrón de flota del módulo anterior | Retirar tabla/datos; reemplazar por `atlas_ops_vehicles` vacío. |
| `service_entries` | Era el registro diario e historial del módulo anterior | Retirar tabla y capturas; reemplazar por `atlas_ops_dispatches` vacío. |
| `operations_contract_editors` / `operations_editable_contracts` | Alcance de escritura por usuario y contrato | Mantener como frontera de edición existente. |
| BUK + roster | Búsqueda de conductor y validación de jornada para fecha | Reutilizar `search_operations_drivers`; no copiar trabajadores ni inferir identidad. |

La migración fuente de `service_entries` es `20260630133626_align_operations_backend_with_roster_and_catalogs.sql`; cambios posteriores ajustaron RLS, matriz de contratos y RPC batch. El frontend no tiene permisos independientes: `operaciones` habilita el módulo; escritura requiere además el guard backend de contrato y rol.

## Seguridad, auditoría y operación

- Acceso frontend por `operaciones`; las RPC críticas revalidan rol/alcance. Las tablas de captura revocan escritura directa a `authenticated`.
- Las políticas y helper de edición evolucionaron después de la migración inicial. Un módulo nuevo debe repetir el guard vigente, no copiar la política histórica.
- Existe `created_by`/timestamps en `service_entries`, pero no una bitácora operacional común para publicación, confirmación, cambios de asignación e hitos.
- Realtime, cron, webhook y secretos de TrackTec no están configurados para Operaciones.
- AI y structured output viven hoy en el dominio Psicolaboral; no hay habilitación general de IA operacional.
- La regla del prompt prohíbe migración remota, despliegue y cambios irreversibles sin autorización. Esta ejecución prepara cambios locales y validaciones, sin aplicarlos remotamente.

## Lo reutilizable y las brechas

Por instrucción posterior del usuario, el nuevo destino reemplaza la implementación de Operaciones completa desde cero, incluidas sus tablas y datos específicos. La migración retira los registros y maestros propios antiguos sin importarlos al nuevo modelo. Los módulos compartidos `contracts`, BUK, roster, Auth y roles permanecen canónicos; el código de módulo `operaciones` sigue registrado, pero sus concesiones previas por rol se retiran. No se borran dominios externos.

Faltan: modelo de servicio/dispatch, asignación validada, hitos versionados, timeline, publicación y recepción autenticadas por conductor, alertas, geocercas, telemetría normalizada, health/retención e integración TrackTec. Para el conductor falta también una asociación autenticada usuario↔ficha BUK; el reemplazo la exige explícita y no infiere identidad desde nombre/RUT.

## Referencias internas

- `src/app/router/AppRouter.tsx`, `src/app/router/routeModules.ts`, `src/shared/config/navigation.ts`
- `src/modules/operaciones/pages/OperacionesDashboard.tsx`
- `src/modules/operaciones/services/operacionesApi.ts`, `hooks/useOperationsQueries.ts`, `types/index.ts`
- `src/modules/operaciones/components/*`, `styles/operaciones.css`
- `src/modules/roster/services/rosterApi.ts`
- `supabase/migrations/20260630133626_align_operations_backend_with_roster_and_catalogs.sql`
- `supabase/migrations/20260715162000_release_operations_module_role_matrix.sql`
- `supabase/migrations/20260716023011_add_operations_editable_contract_matrix.sql`
- `supabase/migrations/20260716025833_harden_operations_bi_orion_audit_followups.sql`
- `supabase/migrations/20260716141754_optimize_operations_batch_submit_set_based.sql`
- `supabase/migrations/20260720134318_fix_operations_submit_timeout_single_prepare.sql`

## Conclusión de la fase 0

La instrucción del usuario define el montaje de cero: se eliminan las tablas y datos propios del módulo previo, y `atlas_ops_*` parte vacío. No se importan plantillas, flota, capturas ni snapshots previos; los nombres históricos permanecen solo en el historial de migraciones.
