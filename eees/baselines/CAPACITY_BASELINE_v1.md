---
document_id: EEES-BASELINE-CAPACITY
title: Capacity Baseline
version: 1.0.0
status: Activo
language: es-CL
owner: Operations
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Capacity Baseline

## Inventario medido

- Archivos TS/TSX en `src`: 200.
- Lineas TS/TSX medidas: 44.250.
- Migraciones SQL: 347.
- Edge Functions con `index.ts`: 11.
- Workflows GitHub: 5.
- Tests automatizados versionados: 12 archivos.
- Scripts propios `.mjs`: 28.
- dist total: 10,658,698 bytes.
- JS total: 3,017,477 bytes en 51 archivos.
- CSS total: 213,123 bytes en 10 archivos.

## Superficies de capacidad

| Superficie | Evidencia repo | Estado |
| --- | --- | --- |
| Bundle inicial y vendors | `eees/baselines/PERFORMANCE_BASELINE_v1.md` y `npm run audit:performance-baseline` | Medido |
| Migraciones/schema | `supabase/migration-baseline.json` y `npm run audit:migrations` | Medido por auditor |
| Edge Functions | 11 funciones con type check parcial para `sync-buk-candidates` | Parcial |
| Jobs BUK | `claim_buk_sync_jobs` con `FOR UPDATE SKIP LOCKED` | Medido por auditor |
| Purga documental | `claim_candidate_document_cleanup_jobs` con `FOR UPDATE SKIP LOCKED` | Medido por auditor |
| Rate limits BUK | Depende del proveedor BUK | NO MEDIDO en repo |
| Storage growth | Depende de metricas Supabase Storage | NO MEDIDO en repo |
| Throughput RPC productivo | Depende de logs/metrics Supabase | NO MEDIDO en repo |
| Memoria cliente real | Depende de profiling browser productivo | NO MEDIDO en repo |

## Regla operativa

No se optimiza sin evidencia. Cambios en bundle, jobs, batches, Storage, RPCs o integraciones deben actualizar este baseline o declarar `NO MEDIDO` con el mecanismo requerido para medir.
