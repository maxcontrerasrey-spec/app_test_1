---
document_id: EEES-BASELINE-SEC
title: Security Baseline
version: 1.0.0
status: Activo
language: es-CL
owner: Security
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Security Baseline

## Evidencia

- `get_my_effective_permissions()` centraliza roles, modulos, capabilities y super admin.
- `RouteGuards.tsx` protege rutas por sesion, modulo y admin.
- `supabase/migrations` contiene RLS, policies, grants y `security definer`.
- `scripts/audit-supabase-security.mjs` clasifica hallazgos y baseline de warning budget.

## Fortalezas

- Autorizacion efectiva en SQL, no solo en UI.
- Service role reservado a scripts, CI y Edge Functions.
- Smokes estaticos de rutas/roles.
- Auditorias para secrets de smoke autenticado.

## Riesgos

- Deuda legacy de onboarding con referencia historica a `reclutamiento` como modulo.
- Muchas funciones `security definer` requieren disciplina de grants y search_path.
- Smokes autenticados dependen de secrets externos.

## Score inicial

76/100. Vulnerabilidades criticas conocidas: 0 medidas por auditor local. Warnings historicos: controlados por `audit:supabase-security`.
