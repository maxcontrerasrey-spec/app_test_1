---
document_id: EEES-BOOK-REL
title: Release and CI/CD Book
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Release and CI/CD Book

## Proposito

Definir reglas normativas para release and ci/cd book del ERP, derivadas de evidencia real del repositorio.

## Evidencia del repositorio

- `src/app/router/AppRouter.tsx`
- `src/modules/*`
- `src/shared/*`
- `supabase/migrations/*`
- `supabase/functions/*`
- `scripts/*`
- `.github/workflows/*`

## Reglas obligatorias

- **REL-001. Main siempre verificable.** Push a main debe dejar CI verde o blocker clasificado.
- **CICD-001. Workflows con paths relevantes.** Cambios en docs, EEES, scripts, Supabase, rutas y package deben activar guardrails.
- **DEP-001. Deploy separado de migracion.** Frontend, SQL y Edge Functions tienen validacion y rollback propios.
- **REL-002. Reporte de cierre.** Cambios enterprise deben terminar con comandos ejecutados y riesgos restantes.

## Quality Gates

- `npm run guardian`
- `npm run build:frontend-check`
- `git diff --check`

## Gestion de excepciones

Las excepciones se registran en `eees/audits/exceptions/` con owner, fecha, regla afectada, riesgo y condicion de salida.
