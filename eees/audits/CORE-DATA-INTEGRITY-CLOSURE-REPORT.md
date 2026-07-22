---
document_id: EEES-AUDIT-CORE-DATA-INTEGRITY-CLOSURE
title: Core Data Integrity Closure Report
version: 1.0.0
status: Activo
language: es-CL
owner: Quality
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Core Data Integrity Closure Report

## Estado

CERTIFIED WITH EXTERNAL DEPENDENCIES.

## Ciclos

1. Mapeo de 15 flujos y 37 invariantes con inspección de código, migraciones, RPCs, RLS, Edge Functions y datos vivos.
2. Ataque de bypass, replay, carrera, partial state, temporalidad y grants; detección de 9 P1 internos.
3. Primer hardening forward-only, pruebas CORE, Guardian y CI.
4. Reataque documental; detección y cierre de 5 P1 internos adicionales.
5. Reataque remoto, despliegue de cuatro Edge Functions y ejecución completa de gates.
6. Revisión independiente de implementación; corrección del contexto actor y lifecycle de idempotencia.

## Cambios ejecutados

- Mutaciones críticas restringidas a RPC/Edge autorizado.
- Contrataciones e incentivos protegidos contra replay.
- Jornadas serializadas por trabajador.
- Snapshots BUK cerrados inmutables.
- Metadata legacy reparada de forma explícita y constraints activados.
- Uploads y purgas documentales con intención durable, checkpoints parciales, timeout y stale recovery.
- Guardian exige mapa, matriz, findings, certificación, reporte y suites CORE.

## Resultado residual

- P0 internos: 0.
- P1 internos: 0.
- Dependencias externas: BUK, Storage y proveedores transaccionales fuera de PostgreSQL.
- No se modificó lógica funcional de negocio; se cerraron caminos alternativos y estados técnicamente inválidos.

## Evidencia de ejecución

- Guardian Full: PASS, 0 errores y 0 warnings.
- Unit Tests, Contract Tests, Coverage: PASS.
- Integrity Tests: 6 PASS; Concurrency Tests: 3 PASS; Idempotency Tests: 6 PASS.
- Migraciones: 351 archivos canónicos; versiones CORE alineadas con Supabase remoto.
- Security y Route/Role: PASS.
- TypeScript y build productivo: PASS.
- Edge checks: cuatro funciones Deno PASS y cuatro despliegues ACTIVE.
- Smokes afectados: rutas PASS; fronteras Edge retornan `401` controlado sin credenciales.
- EEES Consistency y `git diff --check`: PASS.
