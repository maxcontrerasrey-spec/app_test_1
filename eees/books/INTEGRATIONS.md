---
document_id: EEES-BOOK-INT
title: Integrations Book
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Integrations Book

## Proposito

Definir reglas normativas para integrations book del ERP, derivadas de evidencia real del repositorio.

## Evidencia del repositorio

- `src/app/router/AppRouter.tsx`
- `src/modules/*`
- `src/shared/*`
- `supabase/migrations/*`
- `supabase/functions/*`
- `scripts/*`
- `.github/workflows/*`

## Reglas obligatorias

- **INT-001. BUK source of truth.** Trabajadores, cargos, areas y documentos BUK deben reconciliarse con IDs BUK persistidos.
- **INT-002. Sync auditable.** Cada integracion debe registrar resultado, error sanitizado, actor o job y timestamp.
- **INT-003. Retry seguro.** Reintentos no deben duplicar trabajadores, documentos ni registros operativos.
- **INT-004. Secretos fuera del repo.** Tokens BUK, Resend, Supabase service role y webhooks se leen desde secrets/env.

## Quality Gates

- `npm run guardian`
- `npm run build:frontend-check`
- `git diff --check`

## Gestion de excepciones

Las excepciones se registran en `eees/audits/exceptions/` con owner, fecha, regla afectada, riesgo y condicion de salida.
