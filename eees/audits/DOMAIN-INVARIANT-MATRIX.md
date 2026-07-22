---
document_id: EEES-AUDIT-DOMAIN-INVARIANT-MATRIX
title: Domain Invariant Matrix
version: 1.0.0
status: Activo
language: es-CL
owner: Data Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Domain Invariant Matrix

## Resultado

Se verificaron 37 invariantes críticas. Ninguna depende solo de UI.

| ID | Invariante | Enforcement |
|---|---|---|
| INV-01 | Un snapshot BUK cerrado no se sobrescribe | DB/RPC append-once |
| INV-02 | Solo service role captura snapshot BUK | grant + RPC |
| INV-03 | Tabla de compactación audit tiene RLS | DB/RLS |
| INV-04 | Solicitud de contratación requiere actor y permiso | RPC |
| INV-05 | Reintento de contratación devuelve la misma solicitud | unique + advisory lock |
| INV-06 | Estado pending y paso de contratación coinciden | CHECK |
| INV-07 | Aprobación/rechazo conserva timestamp terminal | CHECK + backfill trazable |
| INV-08 | Contratación directa no evade workflow | grants/RLS |
| INV-09 | Transición de candidato valida origen/destino | RPC |
| INV-10 | Candidato rechazado o retirado conserva motivo | CHECK |
| INV-11 | WHO mantiene una aprobación activa coherente | unique + RPC |
| INV-12 | Documento candidato no se muta directo | grants/RLS |
| INV-13 | Documento aprobado exige archivo y revisión | RPC + audit |
| INV-14 | Cleanup documental tiene un job activo por candidato | unique parcial |
| INV-15 | Claim de cleanup no duplica trabajo | `SKIP LOCKED` |
| INV-16 | Job BUK activo es único por candidato | unique parcial |
| INV-17 | Claim BUK es exclusivo y recupera stale | `SKIP LOCKED` + timeout |
| INV-18 | Upload BUK exitoso no se repite en retry | snapshot de IDs exitosos |
| INV-19 | Movilidad del mismo trabajador se serializa | advisory lock |
| INV-20 | Incentivo respeta regla, pauta y ventana | RPC |
| INV-21 | Reintento de incentivo devuelve el mismo folio | unique + advisory lock |
| INV-22 | Aprobación final no deja approvals activas | RPC + consulta adversarial |
| INV-23 | Rangos de jornada no se superponen por carrera | advisory lock + overlap check |
| INV-24 | Entrada operacional repetida no duplica slot | unique + upsert |
| INV-25 | Onboarding operativo se muta solo por RPC | grants/RLS |
| INV-26 | Acreditación es única por trabajador/faena | unique |
| INV-27 | Tracking documental es único por requisito | unique |
| INV-28 | Competencia exige evaluación 100/100/100 y archivo | RPC |
| INV-29 | Certificado evita duplicados concurrentes | advisory lock + unique |
| INV-30 | Permisos efectivos se resuelven en backend | RPC/RLS/grants |
| INV-31 | Upload BUK tiene timeout y no duplica transporte ante 409 | Edge |
| INV-32 | Cada documento BUK se checkpointa antes de borrar Storage | Edge/job |
| INV-33 | Purga registra intención durable antes del efecto destructivo | Edge/job |
| INV-34 | Certificado y evaluación se checkpointan por separado | Edge/DB |
| INV-35 | Acreditación deduplica por operación y conserva resultado BUK | job unique/Edge/RPC |
| INV-36 | Autorización Edge de acreditación conserva `auth.uid()` del actor | JWT + RPC |
| INV-37 | Retry manual del mismo submit reutiliza idempotency key | UI lifecycle + DB unique |

## Clasificación

- DB/constraint/unique: 12.
- RPC/transaction/lock: 14.
- Job/recovery/Edge checkpoint: 8.
- External compensado: 1, relativo al commit distribuido Storage/BUK; no existe dependencia `UI_ONLY`.
