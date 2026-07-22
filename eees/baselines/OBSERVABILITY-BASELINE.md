---
document_id: EEES-BASELINE-OBSERVABILITY
title: Observability Baseline
version: 1.0.0
status: Activo
language: es-CL
owner: Operations
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Observability Baseline

## Estado P4

- Logs frontend: errores Supabase pasan por `src/shared/lib/supabaseRpc.ts` y `src/shared/lib/logger.ts`.
- Logs Edge Functions: funciones con efectos externos validan auth o secreto interno antes de ejecutar.
- Audit trails: reclutamiento, movilidad, documentos, permisos, incentivos y BUK conservan audit logs o snapshots estructurados.
- Jobs: `buk_sync_jobs` y `candidate_document_cleanup_jobs` usan reclamo atomico desde SQL y estados `pending/processing/success/error`.
- Integraciones externas: errores HTML de BUK se sanitizan y los detalles estructurados quedan en snapshots backend controlados.

## Gaps cerrados P4

- Se agrega auditor P4 para exigir artefactos de observabilidad, idempotencia y release.
- Se agrega auditor de baseline performance para detectar regresiones medibles contra `dist`.
- Se formalizan alertas accionables por cola, integracion, migracion y release.

## Alertas accionables

- BUK sync: alertar si existen jobs `processing` antiguos sobre la ventana stale o si `error_count` sube en la ultima corrida.
- Purga documental: alertar si hay jobs `error` con documentos remanentes o si el barrido nocturno no encola/procesa durante su ventana.
- Build/deploy: alertar si `build:frontend-check`, `guardian:full` o `smoke:frontend-routes` fallan.
- Seguridad Supabase: alertar si `audit:supabase-security` supera el warning budget vigente o emite errores.
- Performance: alertar si `audit:performance-baseline` falla por aumento de bundle o asset trackeado.
