---
document_id: EEES-AUDIT-CONSISTENCY
title: EEES Consistency Audit
version: 1.0.0
status: Activo
language: es-CL
owner: QA
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# EEES Consistency Audit

## Estado

PASS

## Resumen

- Errores: 0
- Warnings: 14
- Info: 7

## Errores

- Sin errores bloqueantes.

## Warnings

- FE-001 · `src/modules/auth/context/AuthContext.tsx` · Componente TSX con acceso directo a Supabase; preferir servicio de dominio.
- PERF-001 · `src/modules/accreditation/components/AccreditationSettingsView.tsx` · Archivo sobre 800 lineas: 867.
- PERF-001 · `src/modules/bi/components/BiRecruitmentAnalyticsView.tsx` · Archivo sobre 800 lineas: 813.
- PERF-001 · `src/modules/competencies/pages/CompetencyCertificationPage.tsx` · Archivo sobre 800 lineas: 804.
- PERF-001 · `src/modules/competencies/services/competencyApi.ts` · Archivo sobre 800 lineas: 1056.
- PERF-001 · `src/modules/dashboard/components/DashboardInfoCards.tsx` · Archivo sobre 800 lineas: 882.
- PERF-001 · `src/modules/incentives/components/IncentiveRegistrationForm.tsx` · Archivo sobre 800 lineas: 836.
- PERF-001 · `src/modules/incentives/components/IncentiveRequestsView.tsx` · Archivo sobre 800 lineas: 845.
- PERF-001 · `src/modules/incentives/services/incentivesApi.ts` · Archivo sobre 800 lineas: 1235.
- PERF-001 · `src/modules/operaciones/pages/OperacionesDashboard.tsx` · Archivo sobre 800 lineas: 907.
- PERF-001 · `src/modules/operational_onboarding/pages/TemplateBuilderPage.tsx` · Archivo sobre 800 lineas: 1016.
- PERF-001 · `src/modules/recruitment/components/CandidateDetailSidebar.tsx` · Archivo sobre 800 lineas: 804.
- PERF-001 · `src/modules/recruitment/components/CandidateWorkerFileForm.tsx` · Archivo sobre 800 lineas: 1572.
- PERF-001 · `src/modules/recruitment/services/hiringControl.ts` · Archivo sobre 800 lineas: 1648.

## Gates informativos

- audit:enterprise-docs: PASS
- audit:route-role-smoke: PASS
- audit:frontend-auth-smoke-matrix: PASS
- audit:migrations: PASS
- audit:supabase-security: PASS
- build:frontend-check: PASS
- git diff --check: PASS
