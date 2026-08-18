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
- Warnings: 0
- Info: 18

## Errores

- EEES-GATE · `audit:performance-baseline` · > app_test_1@0.1.0 audit:performance-baseline
> node scripts/audit-performance-baseline.mjs


Performance baseline audit failed:
- dist total 10275373 <= baseline 10256676
- JS total 2753387 <= baseline 2741012
- CSS total 247213 <= baseline 240891

## Warnings

- Sin warnings.

## Gates informativos

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
- build:frontend-check: PASS
- git diff --check: PASS
