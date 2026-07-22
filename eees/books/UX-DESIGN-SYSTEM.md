---
document_id: EEES-BOOK-UX
title: UX and Design System Book
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# UX and Design System Book

## Proposito

Definir reglas normativas para ux and design system book del ERP, derivadas de evidencia real del repositorio.

## Evidencia del repositorio

- `src/app/router/AppRouter.tsx`
- `src/modules/*`
- `src/shared/*`
- `supabase/migrations/*`
- `supabase/functions/*`
- `scripts/*`
- `.github/workflows/*`

## Reglas obligatorias

- **UX-001. ERP denso y legible.** Pantallas operativas priorizan comparacion, scan y accion por sobre composicion decorativa.
- **UX-002. No duplicar controles.** Filtros pertenecen a la vista operacional que los usa, no a resumentes donde confunden.
- **UX-003. Datos criticos visibles.** Decisiones como modalidad de pasajes deben mostrarse junto al resumen del folio.
- **UX-004. Texto no amontonado.** Campos extensos deben ocupar ancho completo cuando la grilla lo permite.

## Quality Gates

- `npm run guardian`
- `npm run build:frontend-check`
- `git diff --check`

## Gestion de excepciones

Las excepciones se registran en `eees/audits/exceptions/` con owner, fecha, regla afectada, riesgo y condicion de salida.
