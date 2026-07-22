---
document_id: EEES-BASELINE-QA
title: Quality Baseline
version: 1.0.0
status: Activo
language: es-CL
owner: Quality
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Quality Baseline

## Gates existentes

- `npx tsc -b`.
- `npm run build:frontend-check`.
- `npm run audit:migrations`.
- `npm run audit:supabase-security`.
- `npm run audit:route-role-smoke`.
- `npm run audit:frontend-auth-smoke-matrix`.
- `npm run audit:onboarding-legacy-guards`.
- `npm run audit:enterprise-100-readiness`.
- `npm run audit:repository-cleanup`.
- `npm run smoke:frontend-routes`.
- `git diff --check`.

## Estado medido

- Scripts npm versionados: 32.
- Scripts propios `.mjs`: 28.
- Tests/smoke versionados: existe `tests/smoke/frontend-authenticated.scenarios.json`.
- Guardian P2 complejidad/reutilizacion: 0 errores, 0 warnings despues de reducir 13 archivos criticos sobre 800 lineas.
- Cobertura P3 medida: lines 49.22%, statements 47.71%, branches 42.30%, functions 42.52% sobre 38 tests criticos.
- Cobertura E2E autenticada real: matriz P1 por rol versionada y condicionada a secrets.

## Score inicial

80/100. Buen set de gates operativos y baseline P3 medido; falta ampliar cobertura especifica cuando se toquen exportadores BUK/XLSX y mantener ejecucion E2E autenticada con secrets completos por rol.
