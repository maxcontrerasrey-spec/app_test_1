---
document_id: EEES-BOOK-BE
title: Backend Book
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Backend Book

## Proposito

Definir reglas normativas para backend book del ERP, derivadas de evidencia real del repositorio.

## Evidencia del repositorio

- `src/app/router/AppRouter.tsx`
- `src/modules/*`
- `src/shared/*`
- `supabase/migrations/*`
- `supabase/functions/*`
- `scripts/*`
- `.github/workflows/*`

## Reglas obligatorias

- **BE-001. Edge Functions con frontera explicita.** Funciones deben validar env, auth/webhook y formato de payload.
- **BE-002. Idempotencia en jobs.** Colas y syncs deben poder reintentarse sin duplicar efectos.
- **BE-003. Service role con alcance minimo.** Cuando se use service role, debe existir razon operacional y auditoria.
- **BE-004. Contratos JSON estables.** RPCs consumidas por UI deben mantener nombres y tipos esperados o versionarse.

## Quality Gates

- `npm run guardian`
- `npm run build:frontend-check`
- `git diff --check`

## Gestion de excepciones

Las excepciones se registran en `eees/audits/exceptions/` con owner, fecha, regla afectada, riesgo y condicion de salida.
