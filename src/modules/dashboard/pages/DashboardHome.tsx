import { useMemo } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { useRealtimeQueryInvalidation } from "../../../shared/hooks/useRealtimeQueryInvalidation";
import { useDashboard } from "../hooks/useDashboard";
import { DashboardGrid } from "../components/DashboardGrid";
import { DashboardInfoCards } from "../components/DashboardInfoCards";
import "../styles/dashboard.css";

export function DashboardHome() {
  const { displayName, user } = useAuth();
  const {
    isLoading,
    tasksData,
    approvalTrackingData,
    activeFoliosData,
    birthdaysData,
    refresh
  } = useDashboard();
  const dashboardQueryKey = useMemo(
    () => queryKeys.dashboard.home(user?.id ?? "anonymous"),
    [user?.id]
  );
  const dashboardRealtimeSubscriptions = useMemo(
    () => [
      { table: "hiring_requests" },
      { table: "hiring_request_approvals" },
      { table: "recruitment_cases" },
      { table: "recruitment_case_candidates" },
      { table: "candidate_stage_approvals" },
      { table: "employees" }
    ],
    []
  );

  useRealtimeQueryInvalidation({
    channelName: `dashboard-home:${user?.id ?? "anonymous"}`,
    enabled: Boolean(user?.id),
    queryKeys: [dashboardQueryKey],
    subscriptions: dashboardRealtimeSubscriptions
  });

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-greeting">
          <h2>Bienvenido(a), {displayName}</h2>
          <p className="helper-copy">Aquí tienes tu resumen operativo y tareas pendientes de hoy.</p>
        </div>
        <div className="dashboard-header-actions">
        </div>
      </header>

      <main className="dashboard-main">
        <DashboardInfoCards
          pendingTasksCount={tasksData.length}
          approvalTrackingCount={approvalTrackingData.length}
          birthdays={birthdaysData}
        />
        <DashboardGrid
          isLoading={isLoading}
          dashboardData={{ tasksData, approvalTrackingData, activeFoliosData, birthdaysData }}
          onRefresh={() => {
            void refresh();
          }}
        />
      </main>
    </div>
  );
}
