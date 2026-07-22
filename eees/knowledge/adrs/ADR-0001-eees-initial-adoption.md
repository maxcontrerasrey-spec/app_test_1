---
document_id: EEES-ADR-0001
title: ADR 0001 - Adopcion inicial EEES
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# ADR 0001 - Adopcion inicial EEES

## Contexto

El repositorio tenia documentacion operacional en `docs/`, tareas y lecciones en `tasks/`, auditorias ejecutables en `scripts/` y CI con guardrails, pero no existia un estandar enterprise unico que reconciliara esas fuentes como norma ejecutable.

## Decision

Crear `eees/` como autoridad normativa del ERP y mantener `docs/` como descripcion tecnica/operacional. El comando canonico de gobierno sera `npm run guardian`, respaldado por reglas machine-readable en `eees/guardian/rules.json`.

## Consecuencias

- Cambios enterprise deben revisar EEES y ejecutar Guardian.
- Deuda historica se clasifica como warning o backlog, no como norma.
- Nuevos modulos, permisos, integraciones y cambios de seguridad deben referenciar los Books aplicables.
- `AGENTS.md` apunta a `eees/codex/BOOT_SEQUENCE.md` para agentes.

## Evidencia

- `docs/architecture.md`
- `docs/module-map.md`
- `docs/permissions-matrix.md`
- `docs/security-review.md`
- `docs/smoke-tests.md`
- `scripts/audit-eees-guardian.mjs`
- `.github/workflows/audit-supabase-migrations.yml`
