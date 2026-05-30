import React from "react";
import { useAuth } from "../../auth/context/AuthContext";
import { useDashboard } from "../hooks/useDashboard";
import { DashboardGrid } from "../components/DashboardGrid";
import { DashboardInfoCards } from "../components/DashboardInfoCards";
import { FloatingActionMenu } from "../components/FloatingActionMenu";
import "../styles/dashboard.css";

export function DashboardHome() {
  const { displayName } = useAuth();
  const {
    widgets,
    isLoading,
    tasksData,
    approvalTrackingData,
    activeFoliosData,
    birthdaysData,
    refresh
  } =
    useDashboard();

  const handleAction = async (actionType: string) => {
    if (actionType === "REFRESH_DATA") {
      void refresh();
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-greeting">
          <h2>Bienvenido(a), {displayName}</h2>
          <p className="helper-copy">Aquí tienes tu resumen operativo y tareas pendientes de hoy.</p>
        </div>
        <div className="dashboard-header-actions">
          <FloatingActionMenu />
        </div>
      </header>

      <main className="dashboard-main">
        <DashboardInfoCards
          pendingTasksCount={tasksData.length}
          approvalTrackingCount={approvalTrackingData.length}
          birthdays={birthdaysData}
        />
        <DashboardGrid
          widgets={widgets}
          isLoading={isLoading}
          dashboardData={{ tasksData, approvalTrackingData, activeFoliosData, birthdaysData }}
          onAction={handleAction}
        />
      </main>
    </div>
  );
}
