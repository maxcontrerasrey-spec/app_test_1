---
document_id: EEES-BOOK-DB
title: Database Book
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Database Book

## Proposito

Definir reglas normativas para database book del ERP, derivadas de evidencia real del repositorio.

## Evidencia del repositorio

- `src/app/router/AppRouter.tsx`
- `src/modules/*`
- `src/shared/*`
- `supabase/migrations/*`
- `supabase/functions/*`
- `scripts/*`
- `.github/workflows/*`

## Reglas obligatorias

- **DB-001. Migraciones forward-only.** No editar migraciones historicas aplicadas; crear migracion correctiva nueva.
- **DB-002. RLS por defecto.** Toda tabla operacional nueva debe habilitar RLS o justificar excepcion.
- **DB-003. RPC critica con grants explicitos.** Funciones expuestas deben revocar public/anon cuando no sean publicas y conceder solo roles necesarios.
- **DB-004. Baseline de migraciones.** Nueva deuda de naming o colision debe fallar `audit:migrations`.

## Quality Gates

- `npm run guardian`
- `npm run build:frontend-check`
- `git diff --check`

## Gestion de excepciones

Las excepciones se registran en `eees/audits/exceptions/` con owner, fecha, regla afectada, riesgo y condicion de salida.
