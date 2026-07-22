---
document_id: EEES-BASELINE-PRODUCTION-READINESS
title: Production Readiness Baseline
version: 1.0.0
status: Activo
language: es-CL
owner: Operations
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Production Readiness Baseline

## Estado medido

- Frontend build: `npm run build` genera `dist` local verificable.
- Health/readiness frontend: rutas smoke `/login` y `/operaciones/resumen` se validan con `npm run smoke:frontend-routes`.
- Health/readiness backend: Edge Function critica `sync-buk-candidates` se valida con `npm run check:edge:sync-buk-candidates`.
- Migration readiness: `npm run audit:migrations` valida baseline de migraciones y naming canonico.
- Security readiness: `npm run audit:supabase-security` valida patrones de Supabase/RLS/secretos con warning budget vigente.
- Release readiness: `npm run guardian:full` orquesta tests, smokes, auditorias, build y checks de documentos EEES.

## Environment Contract

- `VITE_SUPABASE_URL`: requerido para frontend y smokes autenticados.
- `VITE_SUPABASE_ANON_KEY`: requerido para frontend y smokes autenticados.
- `SUPABASE_SERVICE_ROLE_KEY`: solo permitido en scripts controlados, CI o Edge Functions.
- `BUK_AUTH_TOKEN`: requerido para workflows y funciones BUK con efectos externos.
- `BUK_EMPLOYEES_URL` y `BUK_AREAS_URL`: requeridos para sync BUK de dotacion.
- `CANDIDATE_DOCUMENT_CLEANUP_WEBHOOK_SECRET`: requerido para purga documental programada.
- `FRONTEND_AUTH_SMOKE_*_EMAIL` y `FRONTEND_AUTH_SMOKE_*_PASSWORD`: requeridos solo para smokes autenticados reales por rol.

## Dependencias Externas

- Supabase hosted project, Auth, PostgREST, Storage y Edge runtime: dependencia externa para validar disponibilidad real.
- Cloudflare Pages o hosting equivalente: dependencia externa para validar despliegue productivo real.
- GitHub Actions secrets/vars: dependencia externa para ejecutar smokes autenticados y jobs programados en CI.
- BUK API: dependencia externa para validar throughput, rate limits y disponibilidad de integracion.

## Degradacion e aislamiento

- Smokes autenticados se omiten sin secrets salvo que `FRONTEND_AUTH_SMOKE_MATRIX_REQUIRED=1`.
- Jobs BUK y purga documental tienen secretos separados y pueden pausarse por workflow sin deshabilitar el ERP.
- SQL aplicado se recupera por migracion correctiva forward-only; no hay rollback destructivo versionado.
- Errores UI de Supabase se sanitizan en `src/shared/lib/supabaseRpc.ts`.

## Deployment Validation

- Validacion local obligatoria antes de release: `npm run guardian:full`, `npm run build`, `git diff --check`.
- Validacion CI: `.github/workflows/audit-supabase-migrations.yml` ejecuta guardrails enterprise para cambios en `docs`, `eees`, `supabase`, `scripts`, rutas y `package`.
- Validacion post-release: seguir `eees/certification/RELEASE-CHECKLIST.md` y `eees/playbooks/PRODUCTION-ROLLBACK.md`.
