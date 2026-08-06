---
document_id: EEES-AUDIT-FINAL-RESIDUAL-RISK
title: Final Residual Risk Register
version: 1.0.1
status: Activo
language: es-CL
owner: Operations
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Final Residual Risk Register

## Estado

Sin blockers internos P0/P1 abiertos. Los dos riesgos residuales frontend identificados en la auditoria de seguridad quedaron cerrados el 2026-08-05. Los riesgos que permanecen clasificados abajo son dependencias externas o capacidades que requieren datos productivos historicos; no corresponden a esos dos hallazgos frontend.

## Riesgos frontend cerrados el 2026-08-05

| # | Riesgo | Estado | Correccion | Evidencia de cierre |
| --- | --- | --- | --- | --- |
| 1 | Advisories moderados de React Router | **CERRADO** | React `19.2.7`, React DOM `19.2.7` y React Router `8.3.0` | `npm audit`: 0 vulnerabilidades; PR `#1`; merge `547a1268fa9a41e08b06d7fda683692f6f36ba46` |
| 2 | Headers de seguridad definidos pero no desplegados | **CERRADO** | Headers publicados en Cloudflare produccion y cache inmutable para assets versionados | Deployment `44d70579-9768-4427-91ad-ab2b9e8deaf4`; CSP, `X-Frame-Options`, HSTS y `Permissions-Policy` verificados en `gestion.busesjm.cl` |

**Resultado: 2 de 2 riesgos residuales frontend cerrados.**

## Riesgos externos vigentes

| Riesgo | Tipo | Impacto | Owner | Mitigacion repo | Condicion de cierre |
| --- | --- | --- | --- | --- | --- |
| Smokes autenticados reales sin secrets completos | Dependencia externa | No se puede probar login real por cada rol en CI | QA | Matriz, auditor y workflow versionados | Configurar `FRONTEND_AUTH_SMOKE_*` y `FRONTEND_AUTH_SMOKE_MATRIX_REQUIRED=1` |
| Restore PostgreSQL productivo no ejecutado | Dependencia externa | RTO/RPO real no validado | Operations | DR readiness y failed migration playbook | Ejecutar restore no destructivo en entorno controlado Supabase |
| Restore Storage productivo no ejecutado | Dependencia externa | Recuperacion documental real no medida | Operations | BUK como custodia final y playbook documental | Validar snapshot/restore Storage con proveedor |
| SLOs productivos sin serie historica | Dependencia externa | No hay objetivos numericos confiables | Operations | SLI baseline con `NO MEDIDO` y alertas accionables | Recolectar historico de disponibilidad, error rate y latencia |
| Rate limits BUK no medidos desde repo | Dependencia externa | Throughput/retry puede depender de proveedor | Integrations | Jobs idempotentes, snapshots y playbook BUK | Confirmar limites BUK o medir en ambiente controlado |

## Blockers internos

0 blockers internos P0/P1 identificados despues del cierre ejecutable.
