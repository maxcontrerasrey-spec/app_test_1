---
document_id: EEES-BOOK-OBS
title: Observability and Operations Book
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Observability and Operations Book

## Proposito

Definir reglas normativas para observability and operations book del ERP, derivadas de evidencia real del repositorio.

## Evidencia del repositorio

- `src/app/router/AppRouter.tsx`
- `src/modules/*`
- `src/shared/*`
- `supabase/migrations/*`
- `supabase/functions/*`
- `scripts/*`
- `.github/workflows/*`

## Reglas obligatorias

- **OBS-001. Errores con accion.** Mensajes operativos deben indicar causa controlada o siguiente paso.
- **OBS-002. Jobs con recuperacion stale.** Jobs processing deben tener barrido o requeue cuando queden colgados.
- **OBS-003. Auditoria por mutacion critica.** Cambios de estado, documentos, permisos y syncs deben dejar evidencia.
- **OBS-004. Rollback documentado.** Cada release debe tener camino de rollback o forward-fix.

## Quality Gates

- `npm run guardian`
- `npm run build:frontend-check`
- `git diff --check`

## Gestion de excepciones

Las excepciones se registran en `eees/audits/exceptions/` con owner, fecha, regla afectada, riesgo y condicion de salida.
