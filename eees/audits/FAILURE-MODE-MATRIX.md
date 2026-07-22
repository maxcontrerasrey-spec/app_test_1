---
document_id: EEES-AUDIT-FAILURE-MODE-MATRIX
title: Failure Mode Matrix
version: 1.0.0
status: Activo
language: es-CL
owner: Operations
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Failure Mode Matrix

| Superficie | Impacto | Deteccion | Contencion | Recovery | Owner | Test/audit | Playbook |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Supabase/PostgREST | RPCs o UI sin datos | `guardian:full`, smokes, logs Supabase | Pausar release | Reload schema o forward-fix | Engineering | `audit:migrations` | `eees/playbooks/FAILED-MIGRATION.md` |
| PostgreSQL | Corrupcion o schema drift | `audit:migrations`, security audit | Bloquear deploy SQL | Migracion correctiva | Database | `audit:supabase-security` | `eees/playbooks/FAILED-MIGRATION.md` |
| Auth/RLS | Exposicion o bloqueo indebido | route-role, auth matrix, security audit | Revocar grants o pausar modulo | Forward-fix RLS/RPC | Security | `audit:route-role-smoke` | `eees/playbooks/RLS-PERMISSION-INCIDENT.md` |
| Storage | Documento ausente o expuesto | jobs, document checks, incident reports | Pausar purga/subida | Reintento idempotente o recarga | Operations | `audit:p4-operational-readiness` | `eees/playbooks/DOCUMENT-SYNC-FAILURE.md` |
| Edge Functions | Sync/certificado/documento falla | Deno check, logs Edge | Pausar workflow o invocacion | Redeploy version corregida | Backend | `check:edge:sync-buk-candidates` | `eees/playbooks/EDGE-FUNCTION-FAILURE.md` |
| BUK | Dotacion/documentos no sincronizan | workflow logs, job snapshots | Pausar retries si duplican dano | Retry idempotente | Integrations | `audit:p4-operational-readiness` | `eees/playbooks/INTEGRATION-OUTAGE.md` |
| Jobs/batches | Doble efecto o job colgado | stale recovery y estados job | Pausar schedule | Claim atomico/requeue | Operations | `audit:p4-operational-readiness` | `eees/playbooks/PRODUCTION-ROLLBACK.md` |
| Documentos | Retencion indebida o falta de respaldo | cleanup jobs y snapshots | Bloquear cierre documental | Subir a BUK o purgar Storage | Documents | contract/audit docs | `eees/playbooks/DOCUMENT-SYNC-FAILURE.md` |
| Frontend | Ruta rota o bundle regresivo | build, smoke routes, performance audit | Revert frontend | Redeploy fix | Frontend | `build`, `smoke:frontend-routes` | `eees/playbooks/PRODUCTION-ROLLBACK.md` |
| Deploy | Release incompleto | GitHub Actions | Detener deploy | Revert o forward-fix | Release | `guardian:full` | `eees/playbooks/PRODUCTION-ROLLBACK.md` |
| Migrations | SQL falla o queda drift | migration audit | No editar historia aplicada | Forward migration | Database | `audit:migrations` | `eees/playbooks/FAILED-MIGRATION.md` |
| CI/CD | Gate no corre o secrets faltan | workflow status | Bloquear merge/release | Corregir workflow o secret | QA | `audit:enterprise-100-readiness` | `eees/playbooks/PRODUCTION-ROLLBACK.md` |
