import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasModuleAccess, type AppModuleCode, type AppRole } from "../config/access";
import { useAuth } from "../context/AuthContext";
import { OperatorSelectionGate } from "./OperatorSelectionGate";

function AuthLoadingScreen() {
  return (
    <section className="auth-loading-screen">
      <div className="auth-loading-card">
        <strong>Cargando sesión</strong>
        <span>Validando acceso a la plataforma.</span>
      </div>
    </section>
  );
}

export function ProtectedRoute() {
  const { isConfigured, isLoading, isRecoveryMode, profile, requiresOperatorSelection, user } = useAuth();
  const location = useLocation();

  if (!isConfigured) {
    return (
      <section className="auth-loading-screen">
        <div className="auth-loading-card">
          <strong>Configuración incompleta</strong>
          <span>Faltan variables de entorno de Supabase.</span>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (profile?.must_reset_password || isRecoveryMode) {
    return <Navigate to="/reset-password" replace />;
  }

  if (profile && profile.status !== "active" && location.pathname !== "/sin-acceso") {
    return (
      <Navigate
        to="/sin-acceso"
        replace
        state={{ reason: "profile-status", status: profile.status }}
      />
    );
  }

  if (requiresOperatorSelection) {
    return <OperatorSelectionGate />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { isConfigured, isLoading, isRecoveryMode, profile, user } = useAuth();

  if (isConfigured && isLoading) {
    return <AuthLoadingScreen />;
  }

  if (isConfigured && user && profile?.must_reset_password && !isRecoveryMode) {
    return <Navigate to="/reset-password" replace />;
  }

  if (isConfigured && user && !isRecoveryMode) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function RoleProtectedRoute({
  moduleCode,
  allowRoles,
  children
}: {
  moduleCode: AppModuleCode;
  allowRoles?: AppRole[];
  children: ReactNode;
}) {
  const { accessibleModules, appRoles, isLoading, isSuperAdmin } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  const hasAllowedRole = Boolean(allowRoles?.some((role) => appRoles.includes(role)));

  if (!isSuperAdmin && !hasModuleAccess(accessibleModules, moduleCode) && !hasAllowedRole) {
    return <Navigate to="/sin-acceso" replace />;
  }

  return <>{children}</>;
}

export function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, isSuperAdmin } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/sin-acceso" replace />;
  }

  return <>{children}</>;
}
