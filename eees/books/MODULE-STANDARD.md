---
document_id: EEES-BOOK-MOD
title: Module Standard Book
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Module Standard Book

## Proposito

Definir reglas normativas para module standard book del ERP, derivadas de evidencia real del repositorio.

## Evidencia del repositorio

- `src/app/router/AppRouter.tsx`
- `src/modules/*`
- `src/shared/*`
- `supabase/migrations/*`
- `supabase/functions/*`
- `scripts/*`
- `.github/workflows/*`

## Reglas obligatorias

- **MOD-001. Modulo routeado debe existir en matriz.** Todo `moduleCode` routeado debe estar documentado y autorizado.
- **MOD-002. Nuevo modulo exige schema de autorizacion.** Revisar `app_modules`, `role_module_access`, roles y profiles.
- **MOD-003. Hook servicio componente.** Paginas orquestan; hooks consultan; servicios mapean contratos.
- **MOD-004. No mezclar dominios pesados.** Un modulo no debe importar servicios internos de otro dominio sin frontera declarada.

## Quality Gates

- `npm run guardian`
- `npm run build:frontend-check`
- `git diff --check`

## Gestion de excepciones

Las excepciones se registran en `eees/audits/exceptions/` con owner, fecha, regla afectada, riesgo y condicion de salida.
