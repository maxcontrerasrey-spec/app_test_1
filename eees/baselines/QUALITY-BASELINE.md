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
- `npm run smoke:frontend-routes`.
- `git diff --check`.

## Estado medido

- Scripts npm versionados: 28.
- Scripts propios `.mjs`: 28.
- Tests/smoke versionados: existe `tests/smoke/frontend-authenticated.scenarios.json`.
- Cobertura unitaria: NO MEDIDO.
- Cobertura E2E autenticada real: matriz P1 por rol versionada y condicionada a secrets.

## Score inicial

74/100. Buen set de gates operativos; falta cobertura unitaria y ejecucion E2E autenticada obligatoria con secrets completos por rol.
