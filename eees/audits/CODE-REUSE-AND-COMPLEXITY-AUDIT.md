---
document_id: EEES-AUDIT-CODE-REUSE
title: Code Reuse and Complexity Audit
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Auditoria de reutilizacion y complejidad

| Archivo | Riesgo | Accion | Esfuerzo | Beneficio | Dependencia | Prueba requerida |
| --- | --- | --- | --- | --- | --- | --- |
| `src/modules/recruitment/services/hiringControl.ts` | 1647 lineas; mezcla contratos, mapping y acciones | Separar queries, mappers y acciones por subdominio | Alto | Menos regresiones en reclutamiento | Tests/smokes de folios y candidatos | `build:frontend-check`, smoke reclutamiento |
| `src/modules/recruitment/components/CandidateWorkerFileForm.tsx` | 1571 lineas; formulario critico BUK | Extraer secciones y validadores | Medio | Mejor auditoria de payload BUK | Mantener contrato BUK | Build y flujo BUK |
| `src/modules/incentives/services/incentivesApi.ts` | 1234 lineas; muchas RPCs | Dividir por setup, registro, aprobacion, analytics | Medio | Cambios mas seguros | Query keys | Build y smoke RRHH |
| `src/modules/competencies/services/competencyApi.ts` | 1055 lineas; PDF/documentos/BUK | Mantener generadores pesados fuera del hot path | Medio | Bundle mas estable | Edge Function productiva | Build y certificado prueba |
| `src/modules/operaciones/pages/OperacionesDashboard.tsx` | 906 lineas; pagina con responsabilidad amplia | Separar tabs y estado compartido | Medio | Menos regresiones UI | Smokes operaciones | `smoke:operations-rpc` |
| `src/modules/dashboard/components/DashboardInfoCards.tsx` | 881 lineas; dashboard acoplado | Extraer widgets con contratos explicitos | Medio | Carga y lectura mas clara | `get_dashboard_home_bundle` | `smoke:dashboard-rpc` |

## Accion transversal

Guardian reporta archivos sobre 800 lineas como WARNING y no bloquea por deuda historica registrada.
