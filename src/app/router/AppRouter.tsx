import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../layout/AppShell";
import { lazyWithRetry } from "../../shared/lib/lazyWithRetry";
import {
  ProtectedRoute,
  PublicOnlyRoute,
  RoleProtectedRoute
} from "../../modules/auth/components/RouteGuards";

const HomePage = lazyWithRetry("home-page", async () => ({
  default: (await import("../../modules/home/pages/HomePage")).HomePage
}));

const CertificatesPage = lazyWithRetry("certificates-page", async () => ({
  default: (await import("../../modules/certificates/pages/CertificatesPage")).CertificatesPage
}));

const CertificateTrackingPage = lazyWithRetry("certificate-tracking-page", async () => ({
  default: (
    await import("../../modules/certificates/pages/CertificateTrackingPage")
  ).CertificateTrackingPage
}));

const HiringRequestPage = lazyWithRetry("hiring-request-page", async () => ({
  default: (await import("../../modules/recruitment/pages/HiringRequestPage")).HiringRequestPage
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
              element={<AIAssistantHome />}
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
              path="/control-contrataciones"
              element={
                <RoleProtectedRoute moduleCode="control_contrataciones">
                  <HiringStatusPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/certificados"
              element={
                <RoleProtectedRoute moduleCode="certificados">
                  <CertificatesPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/seguimiento-certificados"
              element={
                <RoleProtectedRoute moduleCode="seguimiento_certificados">
                  <CertificateTrackingPage />
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
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
