import { useMemo } from "react";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { useRealtimeQueryInvalidation } from "../../../shared/hooks/useRealtimeQueryInvalidation";
import { SoftMetricCard } from "../../../shared/ui";
import { useAuth } from "../../auth/context/AuthContext";
import { useDashboard } from "../hooks/useDashboard";
import { DashboardGrid } from "../components/DashboardGrid";
import { DashboardInfoCards } from "../components/DashboardInfoCards";
import "../styles/dashboard.css";

type ExecutiveMetric = {
  detail: string;
  label: string;
  tone: "danger" | "info" | "neutral" | "success" | "warning";
  value: string;
};

export function DashboardHome() {
  const { displayName, user } = useAuth();
  const {
    isLoading,
    tasksData,
    approvalTrackingData,
    activeFoliosData,
    birthdaysData,
    operationalSummaryData,
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
      { table: "internal_mobility_requests" },
      { table: "internal_mobility_request_approvals" },
      { table: "recruitment_cases" },
      { table: "recruitment_case_candidates" },
      { table: "candidate_stage_approvals" },
      { table: "employees" },
      { table: "hr_roster_exceptions" },
      { table: "hr_incentive_requests" }
    ],
    []
  );

  useRealtimeQueryInvalidation({
    channelName: `dashboard-home:${user?.id ?? "anonymous"}`,
    enabled: Boolean(user?.id),
    queryKeys: [dashboardQueryKey],
    subscriptions: dashboardRealtimeSubscriptions
  });

  const executiveMetrics = useMemo<ExecutiveMetric[]>(
    () => [
      {
        detail: "Pendientes por resolver hoy",
        label: "Tareas activas",
        tone: tasksData.length > 0 ? "warning" : "success",
        value: String(tasksData.length)
      },
      {
        detail: "Búsquedas operativas abiertas",
        label: "Procesos abiertos",
        tone: "info",
        value: String(operationalSummaryData?.recruitment.openProcesses ?? 0)
      },
      {
        detail: "Dotación sin disponibilidad hoy",
        label: "Ausentismo",
        tone: "danger",
        value: `${Number(operationalSummaryData?.workforce.absenteeismPct ?? 0).toFixed(1)}%`
      },
      {
        detail: "Solicitudes esperando decisión",
        label: "Incentivos pendientes",
        tone: "neutral",
        value: String(operationalSummaryData?.incentives.pendingApproval ?? 0)
      }
    ],
    [operationalSummaryData, tasksData.length]
  );

  return (
    <div className="dashboard-container">
      <header className="dashboard-header dashboard-hero">
        <div className="dashboard-greeting dashboard-hero-copy">
          <span className="dashboard-hero-kicker">Centro de mando operativo</span>
          <h2>Bienvenido(a), {displayName}</h2>
          <p className="helper-copy">
            Lectura rápida de operación, aprobaciones y desvíos críticos sin salir del tablero principal.
          </p>
          <div className="dashboard-hero-pills" aria-label="Estado del tablero">
            <span className="soft-inline-chip soft-inline-chip--accent">Realtime operativo</span>
            <span className="soft-inline-chip">Actualización continua por módulos críticos</span>
          </div>
        </div>
        <div className="dashboard-header-actions dashboard-hero-metrics">
          {executiveMetrics.map((metric) => (
            <SoftMetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
              tone={metric.tone}
            />
          ))}
        </div>
      </header>

      <main className="dashboard-main dashboard-main-soft">
        <DashboardInfoCards
          birthdays={birthdaysData}
          operationalSummary={operationalSummaryData}
        />
        <DashboardGrid
          isLoading={isLoading}
          dashboardData={{
            tasksData,
            approvalTrackingData,
            activeFoliosData,
            birthdaysData,
            operationalSummaryData
          }}
          onRefresh={() => {
            void refresh();
          }}
        />
      </main>
    </div>
  );
}
