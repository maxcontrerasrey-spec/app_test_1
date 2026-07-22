---
document_id: EEES-AUDIT-CORE-DATA-INTEGRITY-FINDINGS
title: Core Data Integrity Findings
version: 1.0.0
status: Activo
language: es-CL
owner: Security and Data Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Core Data Integrity Findings

## Hallazgos

| ID | Severidad | Hallazgo adversarial | Cierre |
|---|---|---|---|
| CDI-001 | P1 | Tabla audit-only de compactación sin RLS | RLS habilitado y grants cliente revocados |
| CDI-002 | P1 | `hiring_requests` permitía escritura directa fuera del workflow | políticas de mutación eliminadas y grants revocados |
| CDI-003 | P1 | `candidate_documents` permitía alterar metadata de revisión | mutación cliente revocada; RPC/Edge canónico |
| CDI-004 | P1 | Onboarding exponía políticas de escritura sobre estado y logs | superficie reducida a lectura + RPCs |
| CDI-005 | P1 | Retry POST podía duplicar solicitudes de contratación | key por actor, unique parcial y lock transaccional |
| CDI-006 | P1 | Retry POST podía duplicar incentivos | key por actor, unique parcial y lock transaccional |
| CDI-007 | P1 | Dos rangos distintos podían superar el check de jornada en carrera | serialización por trabajador |
| CDI-008 | P1 | Usuario BI podía reescribir snapshots históricos | append-once y ejecución exclusiva service role |
| CDI-009 | P1 | Registros legacy carecían de timestamps/motivos exigibles | backfill trazable, historial y CHECKs |
| CDI-010 | P1 | Upload BUK no tenía timeout y hacía fallback ante conflicto ambiguo | timeout 30 s; `409` exige reconciliación |
| CDI-011 | P1 | Sync BUK borraba Storage antes de checkpoint por documento | checkpoint de job previo a limpieza; retry completa cleanup |
| CDI-012 | P1 | Purga podía quedar `processing` y no registraba intención previa | stale recovery + snapshot de intención |
| CDI-013 | P1 | Certificado y evaluación BUK se persistían solo al final conjunto | checkpoints independientes y skip en retry |
| CDI-014 | P1 | Acreditación dependía de un segundo write frontend después de BUK | job durable determinístico + persistencia RPC en Edge |
| CDI-015 | P1 | Primera implementación validaba acreditación con contexto service role sin `auth.uid()` | RPC de autorización ejecutado con client JWT del actor |
| CDI-016 | P1 | Primera implementación generaba una nueva key en cada retry manual | key retenida por lifecycle del submit y limpiada solo al éxito |

## Reataque

- Replay: las funciones consultan la clave bajo advisory lock y devuelven el registro existente.
- Concurrencia: una segunda asignación del mismo trabajador espera el commit previo y reevalúa el overlap.
- Bypass: `authenticated` conserva SELECT, pero no INSERT/UPDATE/DELETE en superficies gobernadas por RPC.
- Temporalidad: la captura de un periodo existente retorna cero y no ejecuta `DO UPDATE`.
- Partial state: jobs y checkpoints quedan persistidos antes de limpiar Storage o continuar al siguiente artefacto.
- Datos vivos: consultas adversariales no encontraron estados/pasos incoherentes, jobs stale, rangos superpuestos ni cierres incompletos después del hardening.

## Dependencias externas reales

- BUK controla disponibilidad, rate limits y algunos identificadores históricos de documentos.
- BUK no entrega una clave idempotente ni una transacción distribuida. Si acepta un POST y corta la respuesta antes del checkpoint, el ERP exige reconciliación en vez de ejecutar un fallback automático.
- Los smokes autenticados requieren secretos operacionales de CI. Su ausencia local no modifica los controles persistentes.
