import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../layout/AppShell";
import {
  ProtectedRoute,
  PublicOnlyRoute,
  RoleProtectedRoute
} from "../../modules/auth/components/RouteGuards";
import { ModulePlaceholderPage } from "../../shared/ui/ModulePlaceholderPage";

const HomePage = lazy(async () => ({
  default: (await import("../../modules/home/pages/HomePage")).HomePage
}));

const CertificatesPage = lazy(async () => ({
  default: (await import("../../modules/certificates/pages/CertificatesPage")).CertificatesPage
}));

const CertificateTrackingPage = lazy(async () => ({
  default: (
    await import("../../modules/certificates/pages/CertificateTrackingPage")
  ).CertificateTrackingPage
}));

const HiringRequestPage = lazy(async () => ({
  default: (await import("../../modules/recruitment/pages/HiringRequestPage")).HiringRequestPage
}));

const HiringStatusPage = lazy(async () => ({
  default: (await import("../../modules/recruitment/pages/HiringStatusPage")).HiringStatusPage
}));

const LoginPage = lazy(async () => ({
  default: (await import("../../modules/auth/pages/LoginPage")).LoginPage
}));

const ResetPasswordPage = lazy(async () => ({
  default: (await import("../../modules/auth/pages/ResetPasswordPage")).ResetPasswordPage
}));

const AccessDeniedPage = lazy(async () => ({
  default: (await import("../../modules/auth/pages/AccessDeniedPage")).AccessDeniedPage
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
              element={
                <RoleProtectedRoute moduleCode="operaciones">
                  <ModulePlaceholderPage
                    title="Operaciones"
                    description="Espacio reservado para procesos operacionales y paneles de gestión."
                  />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/recursos-humanos"
              element={
                <RoleProtectedRoute moduleCode="recursos_humanos">
                  <ModulePlaceholderPage
                    title="Recursos Humanos"
                    description="Espacio reservado para procesos internos y herramientas de personas."
                  />
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
