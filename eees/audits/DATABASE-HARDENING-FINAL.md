---
document_id: EEES-AUDIT-DATABASE-HARDENING-FINAL
title: Database Hardening Final
version: 1.0.0
status: Activo
language: es-CL
owner: Database
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Database Hardening Final

## Resultado

Sin blockers internos P0/P1 identificados en migraciones y contrato SQL versionado.

## Superficies revisadas

- Migraciones: 347 archivos SQL, forward-only, auditados contra `supabase/migration-baseline.json`.
- Schema drift: cubierto por `npm run audit:migrations`; drift remoto real requiere acceso Supabase.
- Constraints y FK: indices y constraints recientes se validan por auditorias y lessons de cierre.
- Uniques/idempotencia: jobs BUK y purga documental usan claims atomicos y retries clasificados.
- RPC/grants/RLS: auditor Supabase revisa grants, anon/public y patrones `SECURITY DEFINER`.
- Triggers/backfills: cambios recientes quedan versionados en migraciones nuevas.
- Orphan risks: documentos sensibles migran a BUK o se purgan con jobs auditables.
- SQL muerto/duplicado: deuda legacy congelada se gobierna por baseline, no se reescribe historia aplicada.

## Evidencia

- `npm run audit:migrations`.
- `npm run audit:supabase-security`.
- `npm run audit:p4-operational-readiness`.
- `npm run guardian:full`.

## Dependencias externas

Validar schema remoto exacto, backups y restore real depende de credenciales Supabase productivas.
