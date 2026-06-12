import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../layout/AppShell";
import { lazyWithRetry } from "../../shared/lib/lazyWithRetry";
import {
  AdminProtectedRoute,
  ProtectedRoute,
  PublicOnlyRoute,
  RoleProtectedRoute
} from "../../modules/auth/components/RouteGuards";

const HomePage = lazyWithRetry("home-page", async () => ({
  default: (await import("../../modules/home/pages/HomePage")).HomePage
}));


const HiringRequestPage = lazyWithRetry("hiring-request-page", async () => ({
  default: (await import("../../modules/recruitment/pages/HiringRequestPage")).HiringRequestPage
}));

const InternalMobilityPage = lazyWithRetry("internal-mobility-page", async () => ({
  default: (await import("../../modules/internal_mobility/pages/InternalMobilityPage")).InternalMobilityPage
}));

const HiringStatusPage = lazyWithRetry("hiring-status-page", async () => ({
  default: (await import("../../modules/recruitment/pages/HiringStatusPage")).HiringStatusPage
}));

const LoginPage = lazyWithRetry("login-page", async () => ({
  default: (await import("../../modules/auth/pages/LoginPage")).LoginPage
}));

const ResetPasswordPage = lazyWithRetry("reset-password-page", async () => ({
  default: (await import("../../modules/auth/pages/ResetPasswordPage")).ResetPasswordPage
}));

const AccessDeniedPage = lazyWithRetry("access-denied-page", async () => ({
  default: (await import("../../modules/auth/pages/AccessDeniedPage")).AccessDeniedPage
}));

const OperacionesDashboard = lazyWithRetry("operaciones-dashboard", async () => ({
  default: (await import("../../modules/operaciones/pages/OperacionesDashboard")).OperacionesDashboard
}));

const HumanResourcesDashboard = lazyWithRetry("human-resources-dashboard", async () => ({
  default: (
    await import("../../modules/incentives/pages/HumanResourcesDashboard")
  ).HumanResourcesDashboard
}));

const AIAssistantHome = lazyWithRetry("ai-assistant-page", async () => ({
  default: (await import("../../modules/ai_assistant/pages/AIAssistantHome")).AIAssistantHome
}));

const LabsPage = lazyWithRetry("labs-page", async () => ({
  default: (await import("../../modules/labs/pages/LabsPage")).LabsPage
}));

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

export function AppRouter() {
  return (
    <Suspense fallback={<RouteLoadingScreen />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
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
              element={<Navigate to="/recursos-humanos/incentivos" replace />}
            />
            <Route
              path="/recursos-humanos/:view"
              element={
                <RoleProtectedRoute moduleCode="recursos_humanos">
                  <HumanResourcesDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/labs"
              element={
                <AdminProtectedRoute>
                  <LabsPage />
                </AdminProtectedRoute>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
