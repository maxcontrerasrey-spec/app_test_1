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
