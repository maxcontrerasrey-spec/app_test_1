# Atlas — Runbook de rollback

Status: ACTIVE
Document Type: ACTIVE_RUNBOOK
Owner: Operations + Engineering
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: docs/rollback.md, playbooks EEES y deployment actual
Supersedes: rollback manual no trazable
Related Controls: CHANGE_MANAGEMENT, release checklist
Change Approval: Operations + Engineering

## Decisión

Identificar si la regresión es frontend, permiso/RLS, RPC/SQL, Edge Function, integración o datos. Para frontend usar el deployment anterior; para SQL aplicar forward-fix versionado; para Edge Function revertir y redeployar solo la función afectada; para datos usar restauración controlada con evidencia.

## Prohibiciones

No editar migraciones aplicadas, resetear Supabase, usar DROP CASCADE, borrar historial ni improvisar updates manuales.

## Validación posterior

Verificar login, rutas críticas, permisos, RPC afectada, integración y evidencia productiva. Registrar causa, alcance, trigger de rollback y mitigación en tasks/todo.md.
