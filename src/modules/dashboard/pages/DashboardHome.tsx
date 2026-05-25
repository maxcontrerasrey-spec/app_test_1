import React from "react";
import { useAuth } from "../../auth/context/AuthContext";
import { useDashboard } from "../hooks/useDashboard";
import { DashboardGrid } from "../components/DashboardGrid";
import "../styles/dashboard.css"; // We will create this file

export function DashboardHome() {
  const { user, appRoles, displayName } = useAuth();
  const { widgets, isLoading, tasksData, alertsData, kpisData } = useDashboard();

  // Map backend roles to readable department names for greeting
  const roleDisplayNames: Record<string, string> = {
    admin: "Administrador de Sistema",
    reclutamiento: "Reclutamiento y Selección",
    control_contratos: "Control de Contratos",
    operaciones: "Planificación Operacional",
    certificaciones: "Control Documental",
    gerencia: "Gerencia General"
  };

  const primaryRole = appRoles[0] || "invitado";
  const departmentName = roleDisplayNames[primaryRole] || "Staff";

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-greeting">
          <p className="eyebrow">Centro Operacional • {departmentName}</p>
          <h2>Bienvenido(a), {displayName}</h2>
          <p className="helper-copy">Aquí tienes tu resumen operativo y tareas pendientes de hoy.</p>
        </div>
        <div className="dashboard-header-actions">
          {/* Future Search and Notifications bell goes here */}
        </div>
      </header>

      <main className="dashboard-main">
        <DashboardGrid 
          widgets={widgets} 
          isLoading={isLoading} 
          dashboardData={{ tasksData, alertsData, kpisData }}
        />
      </main>
    </div>
  );
}
