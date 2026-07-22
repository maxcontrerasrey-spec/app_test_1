---
document_id: EEES-BASELINE-SRE-SLI-SLO
title: SRE SLI SLO Baseline
version: 1.0.0
status: Activo
language: es-CL
owner: Operations
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# SRE SLI SLO Baseline

## Principio

No se inventan SLOs ni porcentajes. Cuando no existe fuente historica versionada en el repo, la senal queda como `NO MEDIDO` y se declara el mecanismo minimo para medirla.

## SLIs

| Superficie | SLI | Fuente actual | Estado |
| --- | --- | --- | --- |
| Disponibilidad frontend | Rutas criticas responden y renderizan | `npm run smoke:frontend-routes` | Medido localmente |
| Error rate frontend | Errores operativos sanitizados | `tests/unit/supabase-rpc-errors.test.ts` | Medido por test |
| Latencia frontend build/ruta | Tiempo de build y smoke | salida de comandos locales/CI | Medido por ejecucion, sin serie historica |
| Auth por rol | Login y acceso por matriz | `npm run smoke:frontend-authenticated-matrix` | Condicionado a secrets |
| RPC criticas | Contratos y payloads criticos | `npm run test:contracts` | Medido por test |
| Edge Functions | Type check de `sync-buk-candidates` | `npm run check:edge:sync-buk-candidates` | Medido localmente |
| Jobs BUK | Reclamo atomico, retry y snapshots | `npm run audit:p4-operational-readiness` | Medido por auditor |
| Documentos/Storage | Purga documental y BUK como custodia | `npm run audit:p4-operational-readiness` | Medido por auditor |
| BUK API | Disponibilidad/rate limit externo | GitHub Actions y logs proveedor | NO MEDIDO en repo |
| Storage availability real | Lectura/escritura remota de bucket productivo | Supabase hosted metrics | NO MEDIDO en repo |

## SLOs

- No hay SLO productivo numerico versionado porque no existe serie historica confiable en el repositorio.
- El primer objetivo operativo es recolectar mediciones reales por release y por incidente antes de fijar objetivos.
- Cualquier SLO futuro debe citar fuente de metrica, ventana, owner, impacto y playbook.

## Alertas accionables

- BUK sync: jobs `processing` antiguos o aumento de errores en la ultima corrida.
- Purga documental: jobs `error` con documentos remanentes.
- Release: `guardian:full` o `audit:enterprise-100-readiness` falla en CI.
- Migraciones: drift contra baseline o nueva deuda de seguridad.
- Auth matrix: secretos incompletos cuando la matriz sea obligatoria.
