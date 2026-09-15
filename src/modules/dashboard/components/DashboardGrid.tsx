import type { DashboardDataBundle } from "../types";
import { ActiveFoliosWidget } from "./widgets/ActiveFoliosWidget";
import { ApprovalTrackingWidget } from "./widgets/ApprovalTrackingWidget";
import { TasksWidget } from "./widgets/TasksWidget";

interface DashboardGridProps {
  isLoading: boolean;
  dashboardData?: DashboardDataBundle;
  onRefresh?: () => void;
}

export function DashboardGrid({ isLoading, dashboardData, onRefresh }: DashboardGridProps) {
  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <p className="helper-copy">Cargando tu centro de mando...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <div className="dashboard-zone dashboard-zone-full dashboard-module-section dashboard-zone-tasks">
        <div className="dashboard-zone-column">
          <TasksWidget title="Tareas Pendientes" dashboardData={dashboardData} onRefresh={onRefresh} />
        </div>
      </div>

      <div className="dashboard-zone dashboard-zone-full dashboard-module-section dashboard-zone-approvals">
        <div className="dashboard-zone-column">
          <ApprovalTrackingWidget title="Seguimiento de solicitudes" dashboardData={dashboardData} />
        </div>
      </div>

      <div className="dashboard-zone dashboard-zone-full dashboard-module-section dashboard-zone-folios">
        <div className="dashboard-zone-column">
          <ActiveFoliosWidget title="Folios en curso" dashboardData={dashboardData} />
        </div>
      </div>
    </div>
  );
}
