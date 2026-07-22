---
document_id: EEES-ADR-0006-CORE-MUTATION-IDEMPOTENCY
title: Core Mutation Idempotency
version: 1.0.0
status: Activo
language: es-CL
owner: Architecture
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# ADR-0006 Core Mutation Idempotency

## Decisión

Las creaciones de contratación e incentivos exigen `p_idempotency_key` generado una vez por invocación cliente. La base serializa por actor/clave y reutiliza el resultado previo. La asignación de jornada migra a `assign_hr_worker_roster_v2`, serializada por trabajador.

## Contexto

Supabase JS habilita reintentos automáticos de PostgREST, incluidos POST/RPC, frente a fallas transitorias. Una respuesta perdida después del commit podía repetir una mutación válida.

## Consecuencias

- Los RPC antiguos dejan de ser ejecutables por `authenticated`; `service_role` conserva compatibilidad operacional.
- Los nuevos contratos mantienen payload y retorno existentes, agregando solo la clave de replay o el nombre versionado de jornada.
- El rollback es forward-only: restaurar grants exige primero mantener un mecanismo equivalente de idempotencia/concurrencia.
