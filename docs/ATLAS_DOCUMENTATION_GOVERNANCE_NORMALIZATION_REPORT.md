# ATLAS DOCUMENTATION & GOVERNANCE NORMALIZATION REPORT

Status: ACTIVE
Document Type: CURRENT_TECHNICAL_REFERENCE
Owner: Engineering Governance
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: docs/DOCUMENTATION_INDEX.md, runtime versionado y evidencia de gates
Supersedes: informe inexistente
Related Controls: EEES, Guardian, CI, audit:enterprise-docs
Change Approval: Engineering Governance

## Executive summary

Se normalizó la jerarquía documental de Atlas sin modificar comportamiento productivo. Se revisaron 129 archivos Markdown existentes, se creó una matriz exhaustiva y se agregaron 16 documentos maestros para gobierno, arquitectura, contratos y operación.

La principal contradicción encontrada estaba en documentación Psych antigua que refería gpt-5-mini y versiones V4/V5. El runtime inspeccionado confirma V6.3 Luna. Los documentos antiguos fueron marcados HISTORICAL y el contrato vigente quedó centralizado en docs/contracts/PSYCH_AI_CONTRACT.md.

## Files reviewed

- 129 archivos Markdown existentes revisados el 2026-09-22.
- Matriz exhaustiva: docs/DOCUMENTATION_INDEX.md.
- 16 documentos canónicos nuevos agregados en docs/governance, docs/architecture, docs/contracts, docs/runbooks e índice.
- Este informe se agrega como evidencia de la normalización.

## Active documents

Los documentos maestros activos son:

- docs/governance/ERP_GOVERNANCE.md
- docs/governance/AI_GOVERNANCE.md
- docs/governance/ACCESS_CONTROL_POLICY.md
- docs/governance/DATA_PROTECTION_POLICY.md
- docs/governance/AUDIT_STANDARD.md
- docs/governance/CHANGE_MANAGEMENT.md
- docs/architecture/SYSTEM_ARCHITECTURE.md
- docs/architecture/DATA_ARCHITECTURE.md
- docs/architecture/AI_ARCHITECTURE.md
- docs/architecture/MODULE_MAP.md
- docs/contracts/PERMISSIONS_CONTRACT.md
- docs/contracts/PSYCH_AI_CONTRACT.md
- docs/contracts/AI_MODEL_CONTRACT.md
- docs/runbooks/ROLLBACK.md
- docs/runbooks/INCIDENT_RESPONSE.md

La matriz también identifica documentos EEES, arquitectura, políticas y runbooks que continúan activos.

## Historical documents

Se conservaron como evidencia, sin borrado:

- documentación Psych basada en gpt-5-mini/V4;
- auditorías y comparaciones V5.2/V5.3;
- informes de migración y canary fechados;
- auditorías EEES, certificaciones y cierres de releases;
- auditoría histórica del árbol de migraciones.

El listado archivo por archivo y su clasificación está en docs/DOCUMENTATION_INDEX.md.

## Obsolete documents

No se eliminó ningún documento ni se declaró OBSOLETE sin evidencia adicional. Los documentos reemplazados por contratos maestros se marcaron HISTORICAL o quedaron clasificados como evidencia fechada.

## Runtime validation

El código Psych inspeccionado confirma:

- pipeline gpt56-luna-medium-v6.3;
- modelo gpt-5.6-luna;
- prompt psych-ai-prompt-v6.3;
- schema psych-ai-schema-v6.3;
- metodología psych-methodology-v6.3;
- sanitización de identificadores directos y respuestas crudas;
- guardrails y salida limitada a las tres clasificaciones vigentes.

No se modificaron scoring, respuestas, hashes, PRP, Barratt, thresholds, RLS, RPCs, Edge Functions ni integraciones.

## Permissions validation

No effective user permissions were changed. Esta iteración no modificó profiles, roles, módulos, capabilities, helpers, RLS, grants ni políticas de autorización. La validación estructural de rutas/roles y las suites contractuales pasaron.

## Production impact

No production behavior changed. No se aplicaron migraciones, no se desplegaron funciones, no se cambiaron datos, secretos, feature flags, dominios, integraciones ni configuración productiva.

## Test evidence

- npm run audit:enterprise-docs — PASS.
- npm run audit:migrations — PASS; 546 migraciones canónicas, sin duplicados.
- npm run audit:supabase-security — PASS, con advertencias históricas del baseline.
- npm run test:integrity — PASS; 13 archivos, 93 tests.
- npm run test:contracts — PASS; 14 archivos, 47 tests.
- npx tsc -b --pretty false — PASS.
- npm run build:frontend-check — PASS.
- npx --yes supabase db push --linked --dry-run — PASS; remoto actualizado, sin migraciones pendientes.
- git diff --check — PASS.
- npm run guardian — FAIL por dos hallazgos preexistentes y ajenos a esta normalización: la migración no versionada 20260916103000_allow_release_terminal_candidate_without_folio.sql carece de cabecera EEES-DB-005, y .git/info/refs contiene una copia conflictiva local.

## Residual risks

1. Completar metadata estándar en documentos activos antiguos mediante cambios acotados.
2. Resolver los dos bloqueos preexistentes de Guardian en una tarea separada, sin mezclarla con documentación.
3. Obtener aprobación Legal/Compliance para la política de datos y la transición regulatoria chilena.
4. Mantener la matriz documental sincronizada cuando se agreguen rutas, módulos, providers o contratos.
5. Diseñar una auditoría transversal solo después de definir alcance, retención y compatibilidad con los logs por dominio.

## Recommended next steps

1. P0: revisar y aprobar PSYCH_AI_CONTRACT y DATA_PROTECTION_POLICY con Psicología y Legal/Compliance.
2. P0: resolver la cabecera EEES de la migración pendiente y el artefacto .git/info/refs en una tarea independiente.
3. P1: automatizar la detección de metadata faltante en documentos activos.
4. P1: integrar DOCUMENTATION_INDEX en el gate enterprise.
5. P1: ejecutar una matriz viva de permisos por rol antes de cualquier cambio de autorización.
6. P2: completar el mapa de datos con relaciones BUK y retención por dominio.
