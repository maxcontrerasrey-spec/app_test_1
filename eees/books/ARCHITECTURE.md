---
document_id: EEES-BOOK-ARCH
title: Architecture Book
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Architecture Book

## Proposito

Definir reglas normativas para architecture book del ERP, derivadas de evidencia real del repositorio.

## Evidencia del repositorio

- `src/app/router/AppRouter.tsx`
- `src/modules/*`
- `src/shared/*`
- `supabase/migrations/*`
- `supabase/functions/*`
- `scripts/*`
- `.github/workflows/*`

## Reglas obligatorias

- **ARCH-001. Router protegido canonico.** Toda ruta privada debe estar bajo `ProtectedRoute` y usar `RoleProtectedRoute` o `AdminProtectedRoute` segun corresponda.
- **ARCH-002. Dominio antes que carpeta generica.** Las capacidades nuevas deben entrar en `src/modules/<dominio>` y compartir solo utilidades realmente transversales.
- **ARCH-003. Lazy loading por frontera de modulo.** Las rutas productivas deben usar `routeModuleImporters` y `lazyWithRetry`.
- **ARCH-004. Deuda legacy aislada.** Codigo sin ruta activa se clasifica LEGACY o UNKNOWN y no se reutiliza sin auditoria.

## Quality Gates

- `npm run guardian`
- `npm run build:frontend-check`
- `git diff --check`

## Gestion de excepciones

Las excepciones se registran en `eees/audits/exceptions/` con owner, fecha, regla afectada, riesgo y condicion de salida.
