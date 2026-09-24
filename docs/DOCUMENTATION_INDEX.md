# Atlas — Índice y matriz de documentación

Status: ACTIVE
Document Type: DOCUMENTATION_INDEX
Owner: Engineering Governance
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: runtime versionado; este índice no reemplaza SQL, TypeScript, tests ni configuración activa
Supersedes: inventarios documentales informales
Related Controls: EEES Governance, Guardian, audit:enterprise-docs, audit:migrations, audit:supabase-security
Change Approval: Engineering Governance + dueño del dominio

## Jerarquía obligatoria

1. Runtime y contratos ejecutables: migraciones aplicadas, esquema SQL, RPCs, RLS, Edge Functions, TypeScript, tests y configuración productiva versionada.
2. Documentación normativa activa: define cómo debe operar Atlas y nunca puede prometer controles que el runtime no demuestra.
3. Documentación técnica vigente: explica cómo opera actualmente el sistema.
4. Evidencia histórica: demuestra un estado fechado y no gobierna la configuración actual.

Cuando existe contradicción, el runtime se inspecciona primero; el Markdown se corrige o se etiqueta, no se usa para cambiar automáticamente el comportamiento productivo.

## Fuentes canónicas

| Tema | Fuente primaria | Documento maestro |
| --- | --- | --- |
| Gobierno ERP | eees/foundation/03-GOVERNANCE.md y Guardian | docs/governance/ERP_GOVERNANCE.md |
| IA y Psych | supabase/functions/_shared/psychAi/*, migraciones private.* y tests | docs/governance/AI_GOVERNANCE.md y docs/contracts/PSYCH_AI_CONTRACT.md |
| Permisos | get_my_effective_permissions(), helpers, RLS, grants y tests | docs/governance/ACCESS_CONTROL_POLICY.md y docs/contracts/PERMISSIONS_CONTRACT.md |
| Datos y privacidad | esquema, RLS, Storage, logs y aprobación Legal/Compliance | docs/governance/DATA_PROTECTION_POLICY.md |
| Auditoría | logs de dominio y RPCs/triggers | docs/governance/AUDIT_STANDARD.md |
| Cambios/rollback | migraciones, CI, runbooks y evidencia productiva | docs/governance/CHANGE_MANAGEMENT.md y docs/runbooks/ROLLBACK.md |
| Arquitectura | src/app, src/modules, supabase y tests | docs/architecture/ |

## Resultado de la revisión

Se revisaron **129 archivos Markdown** del repositorio. Los documentos nuevos de esta normalización son canónicos para sus temas; los archivos históricos se conservan y no se eliminan. La normalización no cambia runtime, permisos, datos, migraciones, integraciones ni despliegues.

La matriz siguiente es exhaustiva para el inventario encontrado el 2026-09-22. “No detectada por inventario nominal” significa que no se observó contradicción por nombre/ruta; el contenido crítico debe seguir contrastándose contra el runtime.

## Matriz de fuentes documentales

| archivo | categoría | vigencia | contradicciones | acción |
| --- | --- | --- | --- | --- |
| AGENTS.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| PSYCH_AI_ARCHITECTURE.md | HISTORICAL_EVIDENCE | Histórico; no usar como contrato vigente | Versiones antiguas de Psych no coinciden con runtime V6.3 Luna | Marcar HISTORICAL y remitir a contrato Psych |
| PSYCH_AI_IMPLEMENTATION_AUDIT.md | HISTORICAL_EVIDENCE | Histórico; no usar como contrato vigente | Versiones antiguas de Psych no coinciden con runtime V6.3 Luna | Marcar HISTORICAL y remitir a contrato Psych |
| PSYCH_AI_PILOT_GUIDE.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| PSYCH_AI_PRIVACY.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| PSYCH_AI_PROMPT.md | HISTORICAL_EVIDENCE | Histórico; no usar como contrato vigente | Versiones antiguas de Psych no coinciden con runtime V6.3 Luna | Marcar HISTORICAL y remitir a contrato Psych |
| PSYCH_AI_ROLLBACK.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| PSYCH_AI_SCHEMA.md | HISTORICAL_EVIDENCE | Histórico; no usar como contrato vigente | Versiones antiguas de Psych no coinciden con runtime V6.3 Luna | Marcar HISTORICAL y remitir a contrato Psych |
| PSYCH_AI_SEMANTIC_GUARDRAIL_REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| PSYCH_AI_TEST_REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| README.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| docs/CODEX_OBJECTIVE_LOOP_CORE_DATA_INTEGRITY.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| docs/CODEX_OBJECTIVE_LOOP_EEES_100_PERCENT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| docs/CODEX_OBJECTIVE_LOOP_ENTERPRISE_REPOSITORY_CLEANUP.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| docs/architecture.md | ACTIVE_ARCHITECTURE | Activo, sujeto a validación contra runtime | No detectada por inventario nominal | Actualizar metadata y subordinar al runtime |
| docs/audit-logs.md | ACTIVE_RUNBOOK | Activo, sujeto a validación contra runtime | No detectada por inventario nominal | Actualizar metadata y subordinar al runtime |
| docs/brand-kit-plataforma-control.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| docs/database-model.md | ACTIVE_ARCHITECTURE | Activo, sujeto a validación contra runtime | No detectada por inventario nominal | Actualizar metadata y subordinar al runtime |
| docs/deploy-cloudflare-pages.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| docs/deployment.md | ACTIVE_RUNBOOK | Activo, sujeto a validación contra runtime | No detectada por inventario nominal | Actualizar metadata y subordinar al runtime |
| docs/iso-27001-control-de-acceso.md | ACTIVE_POLICY | Activo, sujeto a validación contra runtime | No detectada por inventario nominal | Actualizar metadata y subordinar al runtime |
| docs/iso-27001-politica-uso-aceptable.md | ACTIVE_POLICY | Activo, sujeto a validación contra runtime | No detectada por inventario nominal | Actualizar metadata y subordinar al runtime |
| docs/ley-19628-consentimiento-datos.md | ACTIVE_POLICY | Activo, sujeto a validación contra runtime | No detectada por inventario nominal | Actualizar metadata y subordinar al runtime |
| docs/module-map.md | ACTIVE_ARCHITECTURE | Activo, sujeto a validación contra runtime | No detectada por inventario nominal | Actualizar metadata y subordinar al runtime |
| docs/permissions-matrix.md | ACTIVE_ARCHITECTURE | Activo, sujeto a validación contra runtime | No detectada por inventario nominal | Actualizar metadata y subordinar al runtime |
| docs/psychometric-module/PSYCH_AI_ANALYST_PROMPT.md | HISTORICAL_EVIDENCE | Histórico de versiones Psych anteriores | No detectada por inventario nominal | Marcar como histórico y remitir al contrato V6.3 |
| docs/psychometric-module/PSYCH_AI_GPT5_MINI_ARCHITECTURE.md | HISTORICAL_EVIDENCE | Histórico de versiones Psych anteriores | No detectada por inventario nominal | Marcar como histórico y remitir al contrato V6.3 |
| docs/psychometric-module/PSYCH_AI_GPT5_MINI_MIGRATION_REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| docs/psychometric-module/PSYCH_AI_PIPELINE_TEST_REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| docs/psychometric-module/PSYCH_AI_REVIEWER_PROMPT.md | HISTORICAL_EVIDENCE | Histórico de versiones Psych anteriores | No detectada por inventario nominal | Marcar como histórico y remitir al contrato V6.3 |
| docs/psychometric-module/PSYCH_GPT56_LUNA_CANARY_COMPARISON.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| docs/psychometric-module/PSYCH_GPT56_LUNA_MIGRATION_AUDIT.md | HISTORICAL_EVIDENCE | Histórico de migración | Describe V5.3; runtime confirmado en V6.3 | Conservar como evidencia y remitir a V6.3 |
| docs/psychometric-module/PSYCH_GPT56_LUNA_TEST_REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| docs/psychometric-module/PSYCH_V5_2_AUDIT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| docs/psychometric-module/PSYCH_V5_2_CANARY_COMPARISON.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| docs/psychometric-module/PSYCH_V5_2_HUMANIZATION_REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| docs/psychometric-module/PSYCH_V5_2_TOKEN_ANALYSIS.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| docs/psychometric-module/PSYCH_V5_3_OBJECTIVITY_PDF_AUDIT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| docs/psychometric-module/PSYCH_V5_4_HUMANIZATION_INTEGRAL_REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| docs/psychometric-module/PSYCH_V5_SOURCE_AND_IMPLEMENTATION_AUDIT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| docs/psychometric-module/PSYCH_V6_3_IMPLEMENTATION_AUDIT.md | HISTORICAL_EVIDENCE | Evidencia fechada 2026-08-17 | No crítica; coincide con runtime, pero es evidencia fechada | Conservar y enlazar desde contrato Psych |
| docs/psychometric-module/prp-email-contract.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| docs/psychometric-module/psych-analyst.system.v2.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| docs/psychometric-module/psych-reviewer.system.v2.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| docs/rollback.md | ACTIVE_RUNBOOK | Activo, sujeto a validación contra runtime | No detectada por inventario nominal | Actualizar metadata y subordinar al runtime |
| docs/security-review.md | ACTIVE_RUNBOOK | Activo, sujeto a validación contra runtime | No detectada por inventario nominal | Actualizar metadata y subordinar al runtime |
| docs/smoke-tests.md | ACTIVE_RUNBOOK | Activo, sujeto a validación contra runtime | No detectada por inventario nominal | Actualizar metadata y subordinar al runtime |
| docs/supabase-auth-authorization-foundation.md | ACTIVE_RUNBOOK | Activo, sujeto a validación contra runtime | No detectada por inventario nominal | Actualizar metadata y subordinar al runtime |
| docs/templates/README.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| docs/templates/plantilla_migracion_reclutamiento.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| eees/CHANGELOG.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| eees/INDEX.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| eees/MIGRATION-1X-TO-2.0.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| eees/README.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| eees/adr/ADR-0006-CORE-MUTATION-IDEMPOTENCY.md | ACTIVE_ARCHITECTURE | Activo mientras no sea supersedida | No detectada por inventario nominal | Conservar y referenciar |
| eees/audits/CODE-REUSE-AND-COMPLEXITY-AUDIT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/CORE-DATA-INTEGRITY-CLOSURE-REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/CORE-DATA-INTEGRITY-FINDINGS.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/CORE-TRANSACTION-MAP.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/DATABASE-HARDENING-FINAL.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/DISASTER-RECOVERY-READINESS.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/DOMAIN-INVARIANT-MATRIX.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/EEES-100-PERCENT-CLOSURE-REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/EEES-2.0-IMPLEMENTATION-REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/EEES-2.0-POST-IMPLEMENTATION-AUDIT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/EEES-CONSISTENCY-AUDIT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/ERP-CODE-PERFORMANCE-AUDIT-2026-08-24.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/ERP-CODE-PERFORMANCE-AUDIT-2026-09-02.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/FAILURE-MODE-MATRIX.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/FINAL-IMPLEMENTATION-REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/FINAL-RESIDUAL-RISK-REGISTER.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/P1-CLOSURE-REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/P2-CLOSURE-REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/P3-CLOSURE-REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/P4-CLOSURE-REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/REGRESSION-COVERAGE-MATRIX.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/REPOSITORY-CLEANUP-CLOSURE-REPORT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/REPOSITORY-CLEANUP-INVENTORY.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/audits/SECURITY-HARDENING-FINAL.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| eees/baselines/ARCHITECTURE-BASELINE.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/baselines/CAPACITY_BASELINE_v1.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/baselines/DATABASE-BASELINE.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/baselines/OBSERVABILITY-BASELINE.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/baselines/PERFORMANCE_BASELINE_v1.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/baselines/PRODUCTION_READINESS_BASELINE_v1.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/baselines/QUALITY-BASELINE.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/baselines/REPOSITORY-CLEANUP-BASELINE_v1.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/baselines/SECURITY-BASELINE.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/baselines/SRE_SLI_SLO_BASELINE_v1.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/baselines/TESTING_BASELINE_v1.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/books/ARCHITECTURE.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/books/BACKEND.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/books/DATA-DOCUMENTS.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/books/DATABASE.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/books/FRONTEND.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/books/GOVERNANCE.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/books/INTEGRATIONS.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/books/MODULE-STANDARD.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/books/OBSERVABILITY.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/books/RELEASE-CICD.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/books/SECURITY.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/books/SUPPLY-CHAIN.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/books/TESTING-AUTOMATION.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/books/UX-DESIGN-SYSTEM.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/certification/CERTIFICATION-MODEL.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/certification/CORE-DATA-INTEGRITY-CERTIFICATION.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/certification/ENTERPRISE-CERTIFICATION-FINAL.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/certification/MODULE-CHECKLIST.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/certification/RELEASE-CHECKLIST.md | CURRENT_TECHNICAL_REFERENCE | Vigente como baseline/checklist | No detectada por inventario nominal | Conservar y separar baseline de evidencia |
| eees/codex/BOOT_SEQUENCE.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/foundation/00-MANIFESTO.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/foundation/01-ERP-DNA.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/foundation/02-ENGINEERING-PRINCIPLES.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/foundation/03-GOVERNANCE.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/foundation/04-GLOSSARY.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/guardian/REGRESSION-POLICY.md | ACTIVE_POLICY | Activo | No detectada por inventario nominal | Conservar como norma ejecutable y no duplicar |
| eees/knowledge/adrs/ADR-0001-eees-initial-adoption.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| eees/playbooks/DOCUMENT-SYNC-FAILURE.md | ACTIVE_RUNBOOK | Activo | No detectada por inventario nominal | Conservar y enlazar |
| eees/playbooks/EDGE-FUNCTION-FAILURE.md | ACTIVE_RUNBOOK | Activo | No detectada por inventario nominal | Conservar y enlazar |
| eees/playbooks/FAILED-MIGRATION.md | ACTIVE_RUNBOOK | Activo | No detectada por inventario nominal | Conservar y enlazar |
| eees/playbooks/INTEGRATION-OUTAGE.md | ACTIVE_RUNBOOK | Activo | No detectada por inventario nominal | Conservar y enlazar |
| eees/playbooks/PRODUCTION-ROLLBACK.md | ACTIVE_RUNBOOK | Activo | No detectada por inventario nominal | Conservar y enlazar |
| eees/playbooks/RLS-PERMISSION-INCIDENT.md | ACTIVE_RUNBOOK | Activo | No detectada por inventario nominal | Conservar y enlazar |
| eees/playbooks/ROLLBACK-PRODUCTIVO.md | ACTIVE_RUNBOOK | Activo | No detectada por inventario nominal | Conservar y enlazar |
| eees/playbooks/SECURITY-INCIDENT.md | ACTIVE_RUNBOOK | Activo | No detectada por inventario nominal | Conservar y enlazar |
| supabase/MIGRATIONS_AUDIT.md | HISTORICAL_EVIDENCE | Histórico o fechado; no gobierna runtime | No detectada por inventario nominal | Conservar como evidencia fechada |
| supabase/README.md | CURRENT_TECHNICAL_REFERENCE | Vigente como referencia; contrastar con runtime | No detectada por inventario nominal | Mantener y enlazar desde el índice |
| tasks/lessons.md | CURRENT_TECHNICAL_REFERENCE | Registro de ejecución | No detectada por inventario nominal | Conservar como historial operativo |
| tasks/todo.md | CURRENT_TECHNICAL_REFERENCE | Registro de ejecución | No detectada por inventario nominal | Conservar como historial operativo |

## Pendientes controlados

- Los documentos activos antiguos que todavía no contienen el bloque de metadata completo se mantienen operativos por compatibilidad y quedan priorizados para una segunda pasada acotada.
- Las políticas sobre protección de datos y transición legal chilena requieren aprobación Legal/Compliance; este índice no emite interpretación jurídica.
- La cobertura de auditoría sigue siendo federada por dominio; no se documenta una auditoría global inexistente.
- Las afirmaciones productivas de Psych se basan en el runtime V6.3 inspeccionado: gpt56-luna-medium-v6.3, gpt-5.6-luna, psych-ai-prompt-v6.3, psych-ai-schema-v6.3 y psych-methodology-v6.3.

## Criterio de uso por agentes

Un archivo marcado HISTORICAL, SUPERSEDED u OBSOLETE es evidencia y no instrucción vigente. Para cualquier cambio, consultar primero este índice, luego el documento maestro aplicable y finalmente el contrato ejecutable real.
