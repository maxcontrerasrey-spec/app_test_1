---
document_id: EEES-CERT-RELEASE
title: Release Checklist
version: 1.0.0
status: Activo
language: es-CL
owner: QA
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Release Checklist

- [ ] Scope y riesgo definidos.
- [ ] Contratos frontend/backend inspeccionados.
- [ ] Migraciones nuevas cumplen naming canonico.
- [ ] RLS/grants revisados si hay SQL.
- [ ] Edge Functions validadas si cambian.
- [ ] `npm run guardian:full` ejecutado.
- [ ] `npm run test:unit` ejecutado.
- [ ] `npm run test:contracts` ejecutado.
- [ ] `npm run test:coverage` ejecutado.
- [ ] `npm run build:frontend-check` ejecutado.
- [ ] `npm run audit:performance-baseline` ejecutado si cambia frontend, assets o build.
- [ ] `npm run audit:p4-operational-readiness` ejecutado si cambia release, jobs, Edge Functions o EEES.
- [ ] `npm run audit:enterprise-100-readiness` ejecutado si cambia EEES, release, CI/CD, DR, SRE, capacity o certificacion.
- [ ] Disaster Recovery evaluado en `eees/audits/DISASTER-RECOVERY-READINESS.md`.
- [ ] Failure Mode Matrix vigente en `eees/audits/FAILURE-MODE-MATRIX.md`.
- [ ] Capacity baseline vigente en `eees/baselines/CAPACITY_BASELINE_v1.md`.
- [ ] `git diff --check` ejecutado.
- [ ] Riesgos residuales clasificados.
- [ ] Rollback o forward-fix definido en `eees/playbooks/PRODUCTION-ROLLBACK.md`.
- [ ] Migraciones fallidas tienen camino en `eees/playbooks/FAILED-MIGRATION.md`.
- [ ] Si hay efectos externos, idempotencia/retry confirmado antes de release.
