# Security Review Enterprise

## Resumen ejecutivo

La base de seguridad actual es razonable para un ERP productivo: RLS, helpers `user_can_*`, RPCs `security definer`, `get_my_effective_permissions()` y auditoria por dominio. El sistema no esta en estado "greenfield limpio", pero la tendencia reciente es correcta y ya existen hardenings relevantes aplicados.

## Riesgos corregidos o mitigados recientemente

### Alto: deriva de visibilidad en reclutamiento

- `20260627153000_harden_dashboard_and_worker_search_enterprise.sql` normaliza CECO en `user_can_view_hiring_request_process_summary(...)`.
- `get_dashboard_operational_summary()` ahora reutiliza el resumen operativo vivo para reclutamiento.

### Alto: busquedas lentas y no sargables sobre trabajadores

- la misma migracion crea helpers indexables e indices `pg_trgm` sobre `public.employees`.
- se quita carga del hot path sobre `employees_active_current`.

### Medio: policy muerta sobre `security_audit_logs`

- `20260618163500_harden_enterprise_sql_audit_followups.sql` elimina una policy de insert que no podia ejecutarse con los grants reales.

### Medio: guardado de actor y permisos efectivos

- `get_my_effective_permissions()` centraliza roles, modulos y capabilities.
- frontend ya no depende de allowlists por correo.

## Riesgos pendientes

### Alto: deuda legacy de onboarding pre-backend nuevo

- `20260608175000_create_onboarding_module_tables.sql` y `20260608175500_onboarding_module_rpcs.sql` usan `user_can_access_module(..., 'reclutamiento')`.
- `'reclutamiento'` es rol, no modulo.
- El backend nuevo de alta operacional usa `alta_operacional_personal`, por lo que el riesgo hoy esta contenido a artefactos legacy, pero debe cerrarse antes de reactivar o reutilizar ese bloque.

### Medio: ausencia de smoke tests automatizados por rol

- hoy no existe harness E2E o `tests/smoke`.
- el control real depende de build, auditoria de migraciones y humo manual/SQL.

### Medio: deriva posible de documentacion Enterprise

- El mapa modular y matriz de permisos pueden quedar obsoletos si se agregan rutas/modulos sin actualizar documentacion viva.
- Se incorpora `npm run audit:enterprise-docs` como guardrail local/CI-ready para exigir que los modulos routeados existan en `docs/permissions-matrix.md` y que los directorios lazy-loaded esten en `docs/module-map.md`.
- Este control no reemplaza auditoria funcional, pero bloquea el drift basico entre rutas activas, permisos documentados y mapa modular.

### Medio: archivos gigantes en zonas criticas

- `hiringControl.ts`, `incentivesApi.ts`, `CandidateWorkerFileForm.tsx`, `OperacionesDashboard.tsx`.
- no es una brecha directa de permisos, pero si aumenta riesgo de regresion en cambios de seguridad o visibilidad.

### Bajo pero estructural: deuda del historial de migraciones

- controlada por `supabase/migration-baseline.json` y `supabase/MIGRATIONS_AUDIT.md`.
- no bloquea operacion inmediata, pero complica auditoria y automatizacion futura.

## Recomendacion priorizada

1. Cerrar el legado de onboarding para que todo el dominio use solo `alta_operacional_personal` o helper dedicado.
2. Integrar `npm run audit:enterprise-docs` en CI junto a build, migraciones y seguridad.
3. Implementar smoke tests por rol sobre rutas y RPCs mas criticas.
4. Segmentar archivos frontend/backend mas grandes donde el cambio seguro ya es caro.
5. Mantener la disciplina de migraciones canonicas y baseline congelada.
