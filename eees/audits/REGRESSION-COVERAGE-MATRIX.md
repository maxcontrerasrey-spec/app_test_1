---
document_id: EEES-AUDIT-REGRESSION-COVERAGE-MATRIX
title: Regression Coverage Matrix
version: 1.0.0
status: Activo
language: es-CL
owner: Quality
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Regression Coverage Matrix

## Resumen

Matriz P3 de lecciones historicas y bugs relevantes con mecanismo anti-regresion verificable. Conteo protegido P3: 12 regresiones historicas.

## Matriz

| Bug/lesson | Riesgo | Mecanismo anti-regresion |
| --- | --- | --- |
| Lessons 163-165 | Ficha BUK acepta datos derivados inconsistentes o incompletos. | `tests/unit/recruitment-worker-file-form-helpers.test.ts` valida direccion derivada, RUT, defaults BUK y campos faltantes. |
| Lesson 167 | Formularios bloqueados por falta de catalogos externos frescos. | `tests/unit/recruitment-candidate-buk-worker-rules.test.ts` valida defaults contractuales sin dependencia externa. |
| Lesson 168 | Ausencias o pautas operativas mal interpretadas en incentivos. | `tests/unit/incentive-registration-helpers.test.ts` valida bloqueo por ausencia, descanso y elegibilidad de reemplazo. |
| Lesson 169 | Batch operacional mezcla datos por fila o acepta payload invalido. | `tests/unit/operations-service-entry.test.ts` y `tests/contracts/operations-service-entry-contract.test.ts` validan payload planificado/no realizado. |
| Lesson 173 | Modulos ERP cargan helpers pesados o mezclan fronteras. | `npm run build:frontend-check` permanece en Guardian y separa tests de logica pura sin agregar imports frontend pesados. |
| Lesson 174 | Certificados/documentos deben conservar contratos y trazabilidad. | `tests/contracts/incentives-rpc-contracts.test.ts` valida mappers snake_case de retornos RPC y errores por campos faltantes. |
| Lesson 175 | Una accion exitosa no refresca listas visibles. | `src/shared/lib/queryKeys.ts` centraliza roots e invalidaciones; Guardian `FE-002` bloquea nuevas claves inline. |
| Lesson 176 | Labels contractuales se inventan en UI y divergen entre vistas. | Contract tests de incentivos validan transformacion canonica de aprobaciones, historial y detalle. |
| Lesson 177 | Smokes autenticados parciales se declaran como cierre. | `npm run guardian:full` ejecuta matriz auth, route-role smoke, frontend routes y edge check. |
| Lesson 178 | Extraccion P2 queda sin contrato verificable. | Guardian `TST-006` exige tests para logica pura critica extraida en P2. |
| Error recurrente Supabase/fetch | Stack traces o errores tecnicos llegan a UI. | `tests/unit/supabase-rpc-errors.test.ts` valida sanitizacion central en `supabaseRpc`. |
| Query keys duplicadas list/page | Cache comparte payloads incompatibles. | `tests/unit/query-keys.test.ts` valida distincion list/page y normalizacion BI estable. |

## Controles Guardian P3

- `FE-002`: query keys inline o factories locales en `src` fallan.
- `TST-005`: artefactos, scripts y configuracion P3 deben existir.
- `TST-006`: fuentes criticas puras deben tener tests asociados.
- `REL-002`: excepciones versionadas deben tener expiracion ISO.
- Duplicidad de rule IDs y referencias EEES rotas permanecen bloqueadas por `validateRules()` y `validateReferences()`.
