---
document_id: EEES-AUDIT-P1-CLOSURE
title: P1 Closure Report
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# P1 Closure Report

## Alcance

Esta fase cierra exclusivamente backlog P1 tecnicamente ejecutable desde `eees/audits/FINAL-IMPLEMENTATION-REPORT.md`:

- Consolidar smokes autenticados por rol con cuentas controladas.
- Auditar deuda legacy de onboarding sin reactivar superficies historicas.

No se avanza a deuda P2 de refactor de archivos grandes.

## Cambios ejecutados

- La matriz `tests/smoke/frontend-authenticated.scenarios.json` cubre roles P1 principales con escenarios activables por secrets, sin correos ni passwords versionados.
- `scripts/audit-frontend-auth-smoke-matrix.mjs` exige cobertura P1 por rol, coherencia con GitHub Actions, documentacion y ausencia de credenciales reales.
- `.github/workflows/audit-supabase-migrations.yml` mapea todos los secrets requeridos por la matriz y ejecuta el gate de onboarding legacy.
- `scripts/smoke-frontend-auth-candidates.mjs` resuelve modulos requeridos para rutas productivas adicionales antes de recomendar cuentas controladas.
- `scripts/audit-onboarding-legacy-guards.mjs` valida que `/alta-operacional` use `alta_operacional_personal`, que el layout vivo no dependa de `reclutamiento`, que los RPC legacy esten reemplazados por helper operacional y que las tablas legacy tengan hardening posterior.

## Estado P1

| Item P1 | Estado | Evidencia |
| --- | --- | --- |
| Smokes autenticados por rol | Cerrado como contrato versionado | `npm run audit:frontend-auth-smoke-matrix` |
| Ejecucion real con cuentas controladas | Ejecutable y condicionada a secrets | `npm run smoke:frontend-authenticated-matrix` |
| Candidatos para cuentas controladas | Ejecutable read-only | `npm run smoke:frontend-auth-candidates` |
| Onboarding legacy si se reactiva | Cerrado con auditor estatico | `npm run audit:onboarding-legacy-guards` |

## Riesgos residuales

- La ejecucion autenticada real depende de que existan secrets y variables de repositorio para cada rol. Sin secrets, la matriz queda validada y los escenarios se reportan como `skipped`.
- La deuda P2 de archivos sobre 800 lineas permanece fuera de alcance por instruccion explicita de no avanzar a P2.

## Gates de cierre

Los gates requeridos de cierre P1 son:

| Gate | Resultado | Nota |
| --- | --- | --- |
| `npm run audit:frontend-auth-smoke-matrix` | PASS | 16 escenarios, cobertura P1 por rol exigida. |
| `npm run audit:onboarding-legacy-guards` | PASS | Superficie viva y migraciones correctivas verificadas. |
| `npm run smoke:frontend-authenticated-matrix` | PASS condicionado | 16 escenarios omitidos por falta de secrets locales; sin falso PASS autenticado. |
| `npm run smoke:frontend-auth-candidates` | PASS condicionado | 13 de 16 escenarios tienen candidato elegible; faltan cuentas elegibles para `certificaciones-form`, `director-eje-bi-dotacion` y `operaciones-accreditation`. |
| `npm run audit:frontend-auth-smoke-secrets` | PASS condicionado | 2 de 30 secrets unicos configurados; variables publicas requeridas configuradas. |
| `npm run guardian:full` | PASS | 0 errores, 14 warnings historicos P2/FE. |
| `git diff --check` | PASS | Sin whitespace errors. |
