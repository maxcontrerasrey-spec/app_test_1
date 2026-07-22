---
document_id: EEES-BASELINE-TESTING-P3-V1
title: Testing Baseline P3 v1
version: 1.0.0
status: Activo
language: es-CL
owner: Quality
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Testing Baseline P3 v1

## Alcance medido

Baseline inicial medido para logica critica extraida y contratos frontend con RPC/servicios de dominio. No define meta global de cobertura del ERP; define una base reproducible para dominios criticos P3.

## Comandos

- Unit tests: `npm run test:unit`.
- Contract tests: `npm run test:contracts`.
- Coverage: `npm run test:coverage`.
- Runtime validado: Node 24.14.0 del runtime empaquetado de Codex. Node 25.9.0 del entorno local termino Vitest con codigo 137 antes de ejecutar tests.

## Resultado medido

- Test files unitarios: 10.
- Test files de contrato: 2.
- Tests unitarios: 32.
- Tests de contrato: 6.
- Tests totales bajo coverage: 38.
- Line coverage: 49.22% (286/581).
- Statement coverage: 47.71% (292/612).
- Branch coverage: 42.30% (561/1326).
- Function coverage: 42.52% (91/214).

## Archivos incluidos en coverage P3

- `src/modules/incentives/lib/**/*.ts`.
- `src/modules/incentives/services/incentivesApiMappers.ts`.
- `src/modules/operaciones/lib/service-entry.ts`.
- `src/modules/operaciones/lib/transformers.ts`.
- `src/modules/recruitment/lib/**/*.ts`.
- `src/shared/lib/supabaseRpc.ts`.
- `src/shared/lib/queryKeys.ts`.

## Objetivos progresivos

- Mantener tests de contrato para payloads y retornos RPC criticos antes de modificar mappers.
- Exigir test asociado cuando se agregue logica pura critica en incentivos, operaciones, reclutamiento, BUK, permisos, documentos, estados o mappings.
- Migrar query keys por dominio usando `src/shared/lib/queryKeys.ts`; nuevas claves inline en `src` deben fallar Guardian.
- Mejorar cobertura por archivo critico cuando se toque ese archivo; no perseguir 100% ni subir coverage con assertions triviales.

## Brechas clasificadas

- `bukEmployeeNomina.ts` queda medido con 0% dentro del baseline por ser transformacion extensa de workbook legacy; requiere suite especifica cuando se toque exportacion BUK nominal.
- `incentiveRequestsExport.ts` queda medido con 0% por exportacion XLSX; requiere pruebas de estructura cuando se cambie el archivo.
- `queryKeys.ts` tiene baja cobertura porcentual porque expone muchas factories sin logica compleja; queda protegido por tests de normalizacion, distincion list/page y Guardian anti-inline.
