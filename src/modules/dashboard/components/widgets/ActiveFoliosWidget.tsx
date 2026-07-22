import { useMemo } from "react";
import { SoftMetricCard } from "../../../../shared/ui";
import type { DashboardDataBundle } from "../../types";
import { DashboardWidgetFrame } from "./DashboardWidgetFrame";

type ActiveFoliosWidgetProps = {
  title: string;
  dashboardData?: DashboardDataBundle;
};

export function ActiveFoliosWidget({ title, dashboardData }: ActiveFoliosWidgetProps) {
  const recruitmentSummary = dashboardData?.operationalSummaryData?.recruitment;
  const folioKpis = useMemo(
    () => [
      {
        label: "Folios activos en búsqueda",
        tone: "warning" as const,
        value: String(recruitmentSummary?.openProcesses ?? 0)
      },
      {
        label: "Requerimiento total",
        tone: "neutral" as const,
        value: String(recruitmentSummary?.requestedVacancies ?? 0)
      },
      {
        label: "Candidatos en curso",
        tone: "info" as const,
        value: String(recruitmentSummary?.inProgressCandidates ?? 0)
      },
      {
        label: "Con candidato listo",
        tone: "info" as const,
        value: String(recruitmentSummary?.readyToHireCases ?? 0)
      },
      {
        label: "Casos cubiertos",
        tone: "success" as const,
        value: String(recruitmentSummary?.filledCases ?? 0)
      }
    ],
    [recruitmentSummary]
  );

  return (
    <DashboardWidgetFrame
      title={title}
      className="widget-tasks widget-fill-height"
    >
      <div className="dashboard-folios-toolbar dashboard-folios-summary-only">
        <div className="tracking-kpi-row dashboard-folios-kpis">
          {folioKpis.map((kpi) => (
            <SoftMetricCard
              key={kpi.label}
              className="dashboard-folios-kpi-card"
              label={kpi.label}
              value={kpi.value}
              tone={kpi.tone}
            />
          ))}
        </div>
      </div>
    </DashboardWidgetFrame>
  );
}
