---
document_id: EEES-BOOK-FE
title: Frontend Book
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Frontend Book

## Proposito

Definir reglas normativas para frontend book del ERP, derivadas de evidencia real del repositorio.

## Evidencia del repositorio

- `src/app/router/AppRouter.tsx`
- `src/modules/*`
- `src/shared/*`
- `supabase/migrations/*`
- `supabase/functions/*`
- `scripts/*`
- `.github/workflows/*`

## Reglas obligatorias

- **FE-001. Servicios de dominio para datos.** Componentes deben delegar llamadas Supabase a hooks/servicios salvo casos publicos justificados.
- **FE-002. Query keys centralizadas.** Invalidaciones React Query deben usar `queryKeys` compartidas.
- **FE-003. UI ERP consistente.** Controles nuevos deben reutilizar patrones existentes antes de crear CSS local.
- **FE-004. Estados operativos claros.** Loading, error, vacio y exito deben ser visibles sin mezclar stack tecnico.

## Quality Gates

- `npm run guardian`
- `npm run build:frontend-check`
- `git diff --check`

## Gestion de excepciones

Las excepciones se registran en `eees/audits/exceptions/` con owner, fecha, regla afectada, riesgo y condicion de salida.
