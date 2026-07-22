---
document_id: EEES-BASELINE-ARCH
title: Architecture Baseline
version: 1.0.0
status: Activo
language: es-CL
owner: Architecture
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Architecture Baseline

## Inventario medido

- Archivos TypeScript/TSX en `src`: 200.
- Lineas TS/TSX medidas: 44.250.
- Dominios activos: recruitment, dashboard/home, internal_mobility, incentives, roster, accreditation, competencies, operaciones, bi, operational_onboarding, ai_assistant, auth.
- Rutas protegidas: definidas en `src/app/router/AppRouter.tsx`.
- Lazy imports: `src/app/router/routeModules.ts`.

## Fortalezas

- Separacion por dominios.
- React Query y query keys centralizadas.
- Lazy loading por modulo.
- Guardias de ruta alineadas con modulos.

## Riesgos y deuda

- Archivos sobre 800 lineas en zonas criticas: `hiringControl.ts`, `CandidateWorkerFileForm.tsx`, `incentivesApi.ts`, `competencyApi.ts`, `TemplateBuilderPage.tsx`, `OperacionesDashboard.tsx`.
- Dashboard y reclutamiento tienen acoplamientos historicos.
- `labs` existe sin ruta activa; tratar como LEGACY/UNKNOWN.

## Score inicial

72/100. Metodo: 30 arquitectura modular, 25 seguridad de fronteras, 20 mantenibilidad, 15 operabilidad, 10 CI. Penalizaciones por archivos gigantes y deuda legacy.
