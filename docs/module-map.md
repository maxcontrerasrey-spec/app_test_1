# Mapa de Modulos y Dependencias

## Router y entrypoints

- Router principal: `src/app/router/AppRouter.tsx`
- Lazy imports: `src/app/router/routeModules.ts`
- Navegacion visible: `src/shared/config/navigation.ts`

## Modulos principales

### Inicio / Dashboard

- Rutas: `/`
- Paginas/componentes: `src/modules/home/pages/HomePage.tsx`, `src/modules/dashboard/components/*`
- Nota de estructura: `home` es solo wrapper; `HomePage.tsx` devuelve `DashboardHome`.
- Hooks: `src/modules/dashboard/hooks/useDashboard.ts`
- Servicios: `src/modules/dashboard/services/dashboardService.ts`
- RPCs: `get_dashboard_home_bundle`, `get_dashboard_operational_summary`
- Riesgo: widgets grandes y alto acoplamiento con reclutamiento operativo

### Reclutamiento

- Rutas: `/solicitud-contrataciones`, `/control-contrataciones`
- Paginas: `src/modules/recruitment/pages/HiringRequestPage.tsx`, `src/modules/recruitment/pages/HiringStatusPage.tsx`
- Hooks: `src/modules/recruitment/hooks/useRecruitmentQueries.ts`
- Servicios: `src/modules/recruitment/services/hiringRequests.ts`, `src/modules/recruitment/services/hiringWorkflow.ts`, `src/modules/recruitment/services/hiringControl.ts`, `src/modules/recruitment/services/documentChecklistApi.ts`, `src/modules/recruitment/services/hiringCatalogs.ts`
- Riesgo: `hiringControl.ts` y varios componentes exceden tamano comodo de auditoria

### Movilidad interna

- Ruta: `/movilidad-interna`
- Pagina: `src/modules/internal_mobility/pages/InternalMobilityPage.tsx`
- Hooks: `src/modules/internal_mobility/hooks/useInternalMobilityQueries.ts`
- Servicio: `src/modules/internal_mobility/services/internalMobilityApi.ts`
- Acoplamientos: consume folios/casos de reclutamiento y permisos compartidos

### Incentivos extraordinarios

- Ruta: `/recursos-humanos/:view`
- Pagina principal: `src/modules/incentives/pages/HumanResourcesDashboard.tsx`
- Hooks: `src/modules/incentives/hooks/useIncentivesQueries.ts`
- Servicio: `src/modules/incentives/services/incentivesApi.ts`
- Riesgo: servicio y vistas grandes; mezcla setup, analytics, cola y registro

### Jornadas y turnos

- Ruta: `/roster`
- Pagina: `src/modules/roster/pages/RosterPage.tsx`
- Hooks: `src/modules/roster/hooks/useRosterQueries.ts`
- Servicio: `src/modules/roster/services/rosterApi.ts`
- Dependencia critica: worker lookup sobre `employees` y resumen mensual por RPC

### Acreditacion

- Ruta: `/recursos-humanos/acreditacion/:view`
- Pagina: `src/modules/accreditation/pages/AccreditationPage.tsx`
- Hooks: `src/modules/accreditation/hooks/useAccreditationQueries.ts`
- Servicio: `src/modules/accreditation/services/accreditationApi.ts`

### Certificacion de competencias

- Rutas: `/certificados`, `/seguimiento-certificados`
- Pagina: `src/modules/competencies/pages/CompetencyCertificationPage.tsx`
- Hooks: `src/modules/competencies/hooks/useCompetencyQueries.ts`
- Servicio: `src/modules/competencies/services/competencyApi.ts`
- Backend: RPCs `get_competency_catalogs`, `search_competency_workers`, `get_competency_dashboard` y Edge Function `generate-competency-certificate`
- Fronteras criticas: emision de folio/vigencia/hash/PDF desde backend, storage privado `competency_documents` y carga documental BUK
- Estado operativo actual: el modo de prueba genera PDF local no persistente; el flujo productivo backend mantiene validacion reforzada antes de registrar/cargar

### Operaciones

- Ruta: `/operaciones/:view`
- Pagina: `src/modules/operaciones/pages/OperacionesDashboard.tsx`
- Servicio: `src/modules/operaciones/services/operacionesApi.ts`
- Riesgo: dashboard unico muy largo y con responsabilidad amplia
- Hallazgo de acoplamiento: `OperacionesDashboard.tsx` todavia mezcla estado de pagina con lecturas directas a Supabase ademas de `operacionesApi.ts`

### Business Intelligence

- Ruta: `/bi/:view`
- Pagina: `src/modules/bi/pages/BiDashboardPage.tsx`
- Hooks: `src/modules/bi/hooks/useBiQueries.ts`
- Servicio: `src/modules/bi/services/biApi.ts`

### Alta operacional

- Ruta: `/alta-operacional/:tab?`
- Pagina/layout: `src/modules/operational_onboarding/pages/OnboardingModuleLayout.tsx`
- Hooks: `src/modules/operational_onboarding/hooks/useTemplateQueries.ts`, `src/modules/operational_onboarding/hooks/useOnboardingCases.ts`, `src/modules/operational_onboarding/hooks/useOnboardingTasks.ts`, `src/modules/operational_onboarding/hooks/useOnboardingActivityLog.ts`, `src/modules/operational_onboarding/hooks/useCandidateProfiles.ts`
- Servicio: `src/modules/operational_onboarding/services/templateApi.ts`
- Riesgo: coexistencia de SQL legacy de onboarding con backend nuevo

### AI Assistant

- Ruta: `/copiloto-ia`
- Pagina: `src/modules/ai_assistant/pages/AIAssistantHome.tsx`
- Servicios: `src/modules/ai_assistant/services/orion.ts`, `src/modules/ai_assistant/services/orionChat.ts`, `src/modules/ai_assistant/services/orionKnowledge.ts`
- Guardia: admin-only

### Modulos sin ruta activa

- `src/modules/labs`: existe en el arbol, pero no aparece en `routeModules.ts`, `AppRouter.tsx` ni en la navegacion actual; tratarlo como modulo no operativo hasta demostrar lo contrario.

## Dependencias compartidas

- Auth y permisos: `src/modules/auth/*`
- Supabase client: `src/shared/lib/supabase.ts`
- Realtime invalidation: `src/shared/hooks/useRealtimeQueryInvalidation.ts`
- UI base: `src/shared/ui/*`

## Candidatos claros para refactor progresivo

1. `src/modules/recruitment/services/hiringControl.ts`
2. `src/modules/incentives/services/incentivesApi.ts`
3. `src/modules/recruitment/components/CandidateWorkerFileForm.tsx`
4. `src/modules/operational_onboarding/pages/TemplateBuilderPage.tsx`
5. `src/modules/dashboard/components/DashboardInfoCards.tsx`

## Candidatos claros para smoke tests

1. Inicio con `get_dashboard_home_bundle`
2. Reclutamiento paginado y detalle de caso
3. Busqueda de trabajadores en roster/incentivos/movilidad
4. Aprobaciones Who y control de candidatos
5. Alta operacional: templates + tasks + activity log
