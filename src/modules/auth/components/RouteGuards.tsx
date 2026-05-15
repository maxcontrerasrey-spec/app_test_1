import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasModuleAccess, type AppModuleCode } from "../config/access";
import { useAuth } from "../context/AuthContext";

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
  const { isConfigured, isLoading, user } = useAuth();
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

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { isConfigured, isLoading, isRecoveryMode, user } = useAuth();

  if (isConfigured && isLoading) {
    return <AuthLoadingScreen />;
  }

  if (isConfigured && user && !isRecoveryMode) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function RoleProtectedRoute({
  moduleCode,
  children
}: {
  moduleCode: AppModuleCode;
  children: ReactNode;
}) {
  const { accessibleModules, isLoading, isSuperAdmin } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isSuperAdmin && !hasModuleAccess(accessibleModules, moduleCode)) {
    return <Navigate to="/sin-acceso" replace />;
  }

  return <>{children}</>;
}
