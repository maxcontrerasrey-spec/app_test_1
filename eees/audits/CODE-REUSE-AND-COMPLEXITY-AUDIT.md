---
document_id: EEES-AUDIT-CODE-REUSE
title: Code Reuse and Complexity Audit
version: 1.1.0
status: Activo
language: es-CL
owner: Engineering
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Auditoria de reutilizacion y complejidad

## Baseline P2

- Archivos criticos iniciales sobre 800 lineas: 13.
- Guardian inicial P2: 0 errores, 14 warnings historicos.
- Guardian post P1: 0 errores, 14 warnings historicos.
- Guardian post P2: 0 errores, 0 warnings.

## Archivos criticos iniciales

| Archivo | Lineas iniciales | Riesgo | Accion P2 | Estado |
| --- | ---: | --- | --- | --- |
| `src/modules/recruitment/services/hiringControl.ts` | 1647 | Servicio con tipos, acciones, perfil BUK y sync | Extraidos tipos a `hiringControlTypes.ts` y perfil/sync a `hiringBukProfile.ts` con re-export publico | Cerrado |
| `src/modules/recruitment/components/CandidateWorkerFileForm.tsx` | 1571 | Formulario BUK critico con helpers y JSX extenso | Extraidos helpers, contenido visual y seccion contractual | Cerrado |
| `src/modules/incentives/services/incentivesApi.ts` | 1234 | RPCs y mappers en un solo archivo | Extraidos mappers RPC a `incentivesApiMappers.ts` | Cerrado |
| `src/modules/competencies/services/competencyApi.ts` | 1055 | API Supabase mezclada con generador PDF pesado | Extraido preview PDF a `competencyPreviewPdf.ts` | Cerrado |
| `src/modules/operational_onboarding/pages/TemplateBuilderPage.tsx` | 1015 | Builder con formularios, handlers y tabla de tareas | Extraidos formularios y listado de tareas | Cerrado |
| `src/modules/operaciones/pages/OperacionesDashboard.tsx` | 906 | Pagina con configuracion, draft local y mappers remotos | Extraida configuracion/draft/mappers a `operacionesDashboardConfig.ts` | Cerrado |
| `src/modules/dashboard/components/DashboardInfoCards.tsx` | 881 | Tarjetas mezcladas con clima/geolocalizacion | Extraido hook y helpers de clima | Cerrado |
| `src/modules/accreditation/components/AccreditationSettingsView.tsx` | 866 | Formularios por defecto mezclados con vista | Extraidos defaults/options a `settingsForms.ts` | Cerrado |
| `src/modules/incentives/components/IncentiveRequestsView.tsx` | 844 | Vista mezclada con export XLSX | Extraida exportacion XLSX y labels de estado | Cerrado |
| `src/modules/incentives/components/IncentiveRegistrationForm.tsx` | 835 | Formulario mezclado con alertas y helpers de regla | Extraidos helpers y alerta visual | Cerrado |
| `src/modules/bi/components/BiRecruitmentAnalyticsView.tsx` | 812 | Vista mezclada con config de graficos | Extraida configuracion/formatters a `recruitmentAnalyticsChartConfig.ts` | Cerrado |
| `src/modules/recruitment/components/CandidateDetailSidebar.tsx` | 803 | Sidebar con helpers WHO locales | Extraidos helpers de causa WHO | Cerrado |
| `src/modules/competencies/pages/CompetencyCertificationPage.tsx` | 803 | Pagina con panel resumen embebido | Extraido `CompetencyCertificateSummaryPanel` | Cerrado |

## Resultado

- Archivos criticos restantes sobre 800 lineas: 0.
- Duplicaciones eliminadas/cortadas: 13 superficies.
- Accesos directos Supabase fuera de boundary advertidos por Guardian: 0.
- Se mantuvieron exports publicos mediante re-export en servicios existentes cuando habia consumidores previos.
- No se editaron migraciones historicas ni se flexibilizo Guardian.

## Deuda residual clasificada

- Los servicios nuevos `hiringBukProfile.ts`, `competencyPreviewPdf.ts` e `incentivesApiMappers.ts` quedan bajo 800 lineas, pero siguen siendo candidatos a tests unitarios focalizados si se agrega suite unitaria P3.
- `AuthContext.tsx` conserva llamadas `supabase.auth.*` por ser boundary de ciclo de sesion; las llamadas RPC/tablas de perfil fueron movidas a `authApi.ts`.
- No se normalizaron todas las query keys del ERP completo: no habia warning Guardian activo y hacerlo seria P3 por mayor superficie transversal.
