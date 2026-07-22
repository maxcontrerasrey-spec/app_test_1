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
- [ ] `npm run guardian` ejecutado.
- [ ] `npm run build:frontend-check` ejecutado.
- [ ] `git diff --check` ejecutado.
- [ ] Riesgos residuales clasificados.
- [ ] Rollback o forward-fix definido.
