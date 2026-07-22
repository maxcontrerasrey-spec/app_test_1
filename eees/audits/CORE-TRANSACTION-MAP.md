---
document_id: EEES-AUDIT-CORE-TRANSACTION-MAP
title: Core Transaction Map
version: 1.0.0
status: Activo
language: es-CL
owner: Architecture
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Core Transaction Map

## Resultado

Se mapearon 15 flujos críticos desde entrada hasta persistencia, auditoría y recuperación.

| ID | Flujo | Entrada canónica | Persistencia y efecto | Atomicidad / recuperación |
|---|---|---|---|---|
| CT-01 | Registro maestro BUK | jobs y Edge de sincronización | `employees`, vistas activas | claim con `SKIP LOCKED`; retry por job |
| CT-02 | Snapshot mensual BUK | cron/service role | `buk_employees_daily_snapshot` | append-once; replay retorna 0 |
| CT-03 | Solicitud de contratación | `submit_hiring_request` | solicitud, snapshot, aprobaciones, audit | transacción RPC e idempotency key |
| CT-04 | Pipeline de candidato | RPCs de transición/WHO | candidato, aprobaciones, historial | locks, estados terminales y audit |
| CT-05 | Documentos candidato | Edge/RPC de documento | Storage, metadata, cleanup job | estado durable y compensación; Storage externo |
| CT-06 | Alta BUK de candidato | `sync-buk-candidates` | job, candidato, BUK externo | claim, snapshots de progreso y replay |
| CT-07 | Movilidad interna | RPCs de movilidad | solicitud, aprobaciones, historial | advisory lock por trabajador |
| CT-08 | Incentivos | `create_hr_incentive_request` y aprobaciones | solicitud, approvals, roster exception | idempotency key, locks y estados |
| CT-09 | Jornadas | `assign_hr_worker_roster_v2` | `hr_worker_rosters` | advisory lock por trabajador |
| CT-10 | Operaciones | `submit_service_entries_batch` | `service_entries` | unique operacional y `ON CONFLICT` |
| CT-11 | Alta operacional | RPCs de onboarding | casos, tareas, evidencia, activity logs | escritura directa revocada; audit RPC |
| CT-12 | Acreditación | RPCs y Edge BUK | acreditación y tracking documental | unique trabajador/faena; BUK externo |
| CT-13 | Competencias | RPC + Edge certificado | request, evaluación, certificado | advisory lock, hash y estados de retry |
| CT-14 | Identidad y permisos | Auth + RPC de permisos | perfiles, roles y accesos | backend-authoritative, RLS y grants |
| CT-15 | Notificaciones transaccionales | jobs/Edge autorizados | audit de entrega y proveedor | correlation ID, retry y evidencia de error |

## Límites externos

- BUK y proveedores de correo no participan en transacciones PostgreSQL.
- Storage y base de datos no comparten un commit distribuido.
- Estos límites se gobiernan con estados durables, jobs reintentables, snapshots, claves de replay y trazas; la disponibilidad o respuesta final del proveedor permanece externa.
