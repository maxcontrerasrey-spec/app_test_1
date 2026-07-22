---
document_id: EEES-BOOK-SEC
title: Security Book
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Security Book

## Proposito

Definir reglas normativas para security book del ERP, derivadas de evidencia real del repositorio.

## Evidencia del repositorio

- `src/app/router/AppRouter.tsx`
- `src/modules/*`
- `src/shared/*`
- `supabase/migrations/*`
- `supabase/functions/*`
- `scripts/*`
- `.github/workflows/*`

## Reglas obligatorias

- **SEC-001. Service role fuera del navegador.** Service role solo se permite en scripts controlados, CI o Edge Functions.
- **SEC-002. Autorizacion backend autoritativa.** Las acciones criticas deben validar actor en SQL/RPC, no depender de UI.
- **SEC-003. Sin permisos por email.** Roles, modulos y capabilities viven en SQL y `access.ts`, no en allowlists locales por correo.
- **SEC-004. Errores sanitizados.** Errores hacia UI no deben exponer stacks ni secretos.

## Quality Gates

- `npm run guardian`
- `npm run build:frontend-check`
- `git diff --check`

## Gestion de excepciones

Las excepciones se registran en `eees/audits/exceptions/` con owner, fecha, regla afectada, riesgo y condicion de salida.
