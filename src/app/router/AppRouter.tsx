import { Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppShell } from "../layout/AppShell";
import { lazyWithRetry } from "../../shared/lib/lazyWithRetry";
import { routeModuleImporters } from "./routeModules";
import {
  AdminProtectedRoute,
  ProtectedRoute,
  PublicOnlyRoute,
  RoleProtectedRoute
} from "../../modules/auth/components/RouteGuards";
import { HR_INCENTIVE_ANALYTICS_ALLOWED_ROLES } from "../../modules/incentives/lib/analyticsAccess";

const HomePage = lazyWithRetry("home-page", routeModuleImporters.homePage);
const HiringRequestPage = lazyWithRetry("hiring-request-page", routeModuleImporters.hiringRequestPage);
const InternalMobilityPage = lazyWithRetry("internal-mobility-page", routeModuleImporters.internalMobilityPage);
const HiringStatusPage = lazyWithRetry("hiring-status-page", routeModuleImporters.hiringStatusPage);
const LoginPage = lazyWithRetry("login-page", routeModuleImporters.loginPage);
const ResetPasswordPage = lazyWithRetry("reset-password-page", routeModuleImporters.resetPasswordPage);
const AccessDeniedPage = lazyWithRetry("access-denied-page", routeModuleImporters.accessDeniedPage);
const OperacionesDashboard = lazyWithRetry("operaciones-dashboard", routeModuleImporters.operacionesDashboard);
const HumanResourcesDashboard = lazyWithRetry(
  "human-resources-dashboard",
  routeModuleImporters.humanResourcesDashboard
);
const RosterPage = lazyWithRetry("roster-page", routeModuleImporters.rosterPage);
const AccreditationPage = lazyWithRetry(
  "accreditation-page",
  routeModuleImporters.accreditationPage
);
const CompetencyCertificationPage = lazyWithRetry(
  "competency-certification-page",
  routeModuleImporters.competencyCertificationPage
);
const CompetencyVerificationPage = lazyWithRetry(
  "competency-verification-page",
  routeModuleImporters.competencyVerificationPage
);
const AIAssistantHome = lazyWithRetry("ai-assistant-page", routeModuleImporters.aiAssistantHome);
const OnboardingModuleLayout = lazyWithRetry(
  "onboarding-module-layout",
  routeModuleImporters.onboardingModuleLayout
);
const BiDashboardPage = lazyWithRetry("bi-dashboard-page", routeModuleImporters.biDashboard);

function RouteLoadingScreen() {
  return (
    <section className="auth-loading-screen">
      <div className="auth-loading-card">
        <strong>Cargando módulo</strong>
        <span>Preparando la vista solicitada.</span>
      </div>
    </section>
  );
}

function LegacyAccreditationRedirect() {
  const { view } = useParams();
  const destination = view
    ? `/recursos-humanos/acreditacion/${view}`
    : "/recursos-humanos/acreditacion/dashboard";

  return <Navigate to={destination} replace />;
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteLoadingScreen />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verificar/competencia" element={<CompetencyVerificationPage />} />
        <Route path="/verificar/competencia/:lookup" element={<CompetencyVerificationPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/sin-acceso"
              element={<AccessDeniedPage />}
            />
            <Route
              path="/copiloto-ia"
              element={
                <AdminProtectedRoute>
                  <AIAssistantHome />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/solicitud-contrataciones"
              element={
                <RoleProtectedRoute moduleCode="solicitud_contrataciones">
                  <HiringRequestPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/movilidad-interna"
              element={
                <RoleProtectedRoute moduleCode="movilidad_interna">
                  <InternalMobilityPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/control-contrataciones"
              element={
                <RoleProtectedRoute moduleCode="control_contrataciones">
                  <HiringStatusPage />
                </RoleProtectedRoute>
              }
            />

            <Route
              path="/alta-operacional/:tab?"
              element={
                <RoleProtectedRoute moduleCode="alta_operacional_personal">
                  <OnboardingModuleLayout />
                </RoleProtectedRoute>
              }
            />

            <Route
              path="/operaciones"
              element={<Navigate to="/operaciones/resumen" replace />}
            />
            <Route
              path="/operaciones/:view"
              element={
                <RoleProtectedRoute moduleCode="operaciones">
                  <OperacionesDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/recursos-humanos"
              element={
                <RoleProtectedRoute
                  moduleCode="recursos_humanos"
                  allowRoles={HR_INCENTIVE_ANALYTICS_ALLOWED_ROLES}
                >
                  <Navigate to="/recursos-humanos/incentivos" replace />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/recursos-humanos/acreditacion"
              element={
                <RoleProtectedRoute moduleCode="acreditacion_personas">
                  <Navigate to="/recursos-humanos/acreditacion/dashboard" replace />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/recursos-humanos/acreditacion/:view"
              element={
                <RoleProtectedRoute moduleCode="acreditacion_personas">
                  <AccreditationPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/recursos-humanos/:view"
              element={
                <RoleProtectedRoute
                  moduleCode="recursos_humanos"
                  allowRoles={HR_INCENTIVE_ANALYTICS_ALLOWED_ROLES}
                >
                  <HumanResourcesDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/bi"
              element={
                <RoleProtectedRoute moduleCode="bi_analytics">
                  <Navigate to="/bi/dotacion" replace />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/bi/:view"
              element={
                <RoleProtectedRoute moduleCode="bi_analytics">
                  <BiDashboardPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/roster"
              element={
                <RoleProtectedRoute moduleCode="jornadas_turnos">
                  <RosterPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/roster/patterns"
              element={
                <RoleProtectedRoute moduleCode="jornadas_turnos">
                  <RosterPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/acreditacion"
              element={
                <RoleProtectedRoute moduleCode="acreditacion_personas">
                  <LegacyAccreditationRedirect />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/acreditacion/:view"
              element={
                <RoleProtectedRoute moduleCode="acreditacion_personas">
                  <LegacyAccreditationRedirect />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/certificados"
              element={
                <RoleProtectedRoute moduleCode="certificados">
                  <CompetencyCertificationPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/seguimiento-certificados"
              element={
                <RoleProtectedRoute moduleCode="seguimiento_certificados">
                  <Navigate to="/certificados" replace />
                </RoleProtectedRoute>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
