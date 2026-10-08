---
document_id: EEES-AUDIT-CONSISTENCY
title: EEES Consistency Audit
version: 1.0.0
status: Activo
language: es-CL
owner: QA
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# EEES Consistency Audit

## Estado

FAIL

## Resumen

- Errores: 1
- Warnings: 1
- Info: 23

## Errores

- EEES-GATE · `build:frontend-check` · > app_test_1@0.1.0 build:frontend-check
> node scripts/run-frontend-build.mjs

[build-check] 2026-10-08T20:52:37.109Z inicio de validacion frontend
[build-check] 2026-10-08T21:17:46.272Z TypeScript sigue ejecutandose (1509s)

[build-check] 2026-10-08T21:17:46.279Z TypeScript supero el timeout de 300s

## Warnings

- PERF-001 · `src/modules/operaciones/pages/OperationsRoutePlannerDemo.tsx` · Archivo sobre 800 lineas: 877.

## Gates informativos

- audit:eees-governance: PASS
- audit:secrets: PASS
- audit:destructive-migrations: PASS
- audit:dependencies: PASS
- audit:ci-supply-chain: PASS
- test:unit: PASS
- test:contracts: PASS
- audit:enterprise-docs: PASS
- audit:p4-operational-readiness: PASS
- audit:enterprise-100-readiness: PASS
- audit:repository-cleanup: PASS
- audit:core-data-integrity: PASS
- test:integrity: PASS
- test:concurrency: PASS
- test:idempotency: PASS
- audit:route-role-smoke: PASS
- audit:frontend-auth-smoke-matrix: PASS
- audit:onboarding-legacy-guards: PASS
- audit:migrations: PASS
- audit:supabase-security: PASS
- audit:competency-catalog-guards: PASS
- audit:performance-baseline: PASS
- git diff --check: PASS
