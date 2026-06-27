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
- Paginas: `HiringRequestPage.tsx`, `HiringStatusPage.tsx`
- Hooks: `useRecruitmentQueries.ts`
- Servicios: `hiringRequests.ts`, `hiringWorkflow.ts`, `hiringControl.ts`, `documentChecklistApi.ts`, `hiringCatalogs.ts`
- Riesgo: `hiringControl.ts` y varios componentes exceden tamano comodo de auditoria

### Movilidad interna

- Ruta: `/movilidad-interna`
- Pagina: `InternalMobilityPage.tsx`
- Hooks: `useInternalMobilityQueries.ts`
- Servicio: `internalMobilityApi.ts`
- Acoplamientos: consume folios/casos de reclutamiento y permisos compartidos

### Incentivos extraordinarios

- Ruta: `/recursos-humanos/:view`
- Pagina principal: `HumanResourcesDashboard.tsx`
- Hooks: `useIncentivesQueries.ts`
- Servicio: `incentivesApi.ts`
- Riesgo: servicio y vistas grandes; mezcla setup, analytics, cola y registro

### Jornadas y turnos

- Ruta: `/roster`
- Pagina: `RosterPage.tsx`
- Hooks: `useRosterQueries.ts`
- Servicio: `rosterApi.ts`
- Dependencia critica: worker lookup sobre `employees` y resumen mensual por RPC

### Acreditacion

- Ruta: `/recursos-humanos/acreditacion/:view`
- Pagina: `AccreditationPage.tsx`
- Hooks: `useAccreditationQueries.ts`
- Servicio: `accreditationApi.ts`

### Operaciones

- Ruta: `/operaciones/:view`
- Pagina: `OperacionesDashboard.tsx`
- Servicio: `operacionesApi.ts`
- Riesgo: dashboard unico muy largo y con responsabilidad amplia
- Hallazgo de acoplamiento: `OperacionesDashboard.tsx` todavia mezcla estado de pagina con lecturas directas a Supabase ademas de `operacionesApi.ts`

### Business Intelligence

- Ruta: `/bi/:view`
- Pagina: `BiDashboardPage.tsx`
- Hooks: `useBiQueries.ts`
- Servicio: `biApi.ts`

### Alta operacional

- Ruta: `/alta-operacional/:tab?`
- Pagina/layout: `OnboardingModuleLayout.tsx`
- Hooks: `useTemplateQueries.ts`, `useOnboardingCases.ts`, `useOnboardingTasks.ts`, `useOnboardingActivityLog.ts`, `useCandidateProfiles.ts`
- Servicio: `templateApi.ts`
- Riesgo: coexistencia de SQL legacy de onboarding con backend nuevo

### AI Assistant

- Ruta: `/copiloto-ia`
- Pagina: `AIAssistantHome.tsx`
- Servicios: `orion.ts`, `orionChat.ts`, `orionKnowledge.ts`
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
