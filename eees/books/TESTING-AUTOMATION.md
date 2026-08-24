---
document_id: EEES-BOOK-TST
title: Testing and Automation Book
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Testing and Automation Book

## TST-005 - Baseline medido de testing

La suite conserva un baseline reproducible de unit, contracts y coverage.

## TST-006 - Logica critica protegida

Las funciones puras de negocio registradas por Guardian deben tener pruebas anti-regresion dirigidas.

## TST-007 - Cobertura de codigo cambiado

La cobertura global sigue siendo baseline, pero los cambios en logica critica deben incluir guardrail dirigido. La adopcion de diff coverage queda gradual hasta disponer de una comparacion estable contra la rama base en todos los entornos.

## Proposito

Definir reglas normativas para testing and automation book del ERP, derivadas de evidencia real del repositorio.

## Evidencia del repositorio

- `src/app/router/AppRouter.tsx`
- `src/modules/*`
- `src/shared/*`
- `supabase/migrations/*`
- `supabase/functions/*`
- `scripts/*`
- `.github/workflows/*`

## Reglas obligatorias

- **TST-001. Bug critico exige guardrail.** Cuando sea viable, todo bug critico cerrado debe tener test, smoke, auditoria, Guardian rule o lesson.
- **TST-002. No declarar PASS sin ejecutar.** Resultados deben asociarse al comando ejecutado.
- **TST-003. Smokes auth condicionados.** Pruebas autenticadas pueden saltarse sin secrets, pero la matriz debe validarse.
- **TST-004. CI reproduce gates locales.** Los workflows deben ejecutar auditorias de rutas, migraciones, seguridad y frontend.

## Quality Gates

- `npm run guardian`
- `npm run build:frontend-check`
- `git diff --check`

## Gestion de excepciones

Las excepciones se registran en `eees/audits/exceptions/` con owner, fecha, regla afectada, riesgo y condicion de salida.
