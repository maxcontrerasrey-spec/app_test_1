import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useTheme } from "../../../shared/context/ThemeContext";
import { EChartSurface } from "../../../shared/ui";
import { useBiRecruitmentDashboard } from "../hooks/useBiQueries";
import type { BiFilters } from "../types";

type BiRecruitmentAnalyticsViewProps = {
  filters?: BiFilters;
};

function formatMetricValue(value: number) {
  return value.toLocaleString("es-CL");
}

function formatDuration(value: number | null | undefined, unit: "hours" | "days") {
  if (value == null) {
    return "Sin dato";
  }

  const formatted = value.toLocaleString("es-CL", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1
  });

  return unit === "days" ? `${formatted} días` : `${formatted} h`;
}

export function BiRecruitmentAnalyticsView({ filters }: BiRecruitmentAnalyticsViewProps) {
  const { data, isLoading, isError } = useBiRecruitmentDashboard(filters);
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const textColor = isDark ? "#E2E8F0" : "#1E293B";
  const axisColor = isDark ? "rgba(148, 163, 184, 0.22)" : "rgba(148, 163, 184, 0.28)";

  const summaryCards = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      { title: "Folios Abiertos", value: formatMetricValue(data.summary.openFolios), type: "pendiente" },
      { title: "Casos Abiertos", value: formatMetricValue(data.summary.openCases), type: "en-proceso" },
      { title: "Cupos Solicitados", value: formatMetricValue(data.summary.requestedVacancies), type: "generado" },
      { title: "Candidatos en Curso", value: formatMetricValue(data.summary.candidatesInProgress), type: "en-proceso" },
      { title: "Listos para Contratar", value: formatMetricValue(data.summary.readyCandidates), type: "generado" },
      { title: "Pendientes de Aprobación", value: formatMetricValue(data.summary.pendingApprovals), type: "error" },
      { title: "T. Medio Contratación", value: formatDuration(data.summary.avgDaysToHire, "days"), type: "pendiente" },
      { title: "T. Medio Aprobación", value: formatDuration(data.summary.avgApprovalHours, "hours"), type: "pendiente" },
      { title: "Movilidades Internas", value: formatMetricValue(data.summary.mobilityRequests), type: "generado" },
      { title: "Pend. Ejecución RRHH", value: formatMetricValue(data.summary.mobilityPendingExecution), type: "error" },
      { title: "T. Aprobación MI", value: formatDuration(data.summary.avgMobilityApprovalHours, "hours"), type: "pendiente" },
      { title: "T. Ejecución RRHH", value: formatDuration(data.summary.avgMobilityExecutionHours, "hours"), type: "generado" }
    ];
  }, [data]);

  const casesByStatusOption = useMemo<EChartsOption | null>(() => {
    if (!data || data.casesByStatus.length === 0) {
      return null;
    }

    return {
      tooltip: { trigger: "item" },
      legend: { bottom: 0, textStyle: { color: textColor } },
      series: [
        {
          type: "pie",
          radius: ["42%", "72%"],
          center: ["50%", "45%"],
          label: { formatter: "{b}\n{c}", color: textColor },
          data: data.casesByStatus.map((item) => ({ name: item.label, value: item.value }))
        }
      ]
    };
  }, [data, textColor]);

  const candidatesByStageOption = useMemo<EChartsOption | null>(() => {
    if (!data || data.candidatesByStage.length === 0) {
      return null;
    }

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { top: 16, right: 16, bottom: 72, left: 56 },
      xAxis: {
        type: "category",
        data: data.candidatesByStage.map((item) => item.label),
        axisLabel: { color: textColor, interval: 0, rotate: 24 },
        axisLine: { lineStyle: { color: axisColor } }
      },
      yAxis: {
        type: "value",
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: axisColor } }
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 40,
          data: data.candidatesByStage.map((item) => item.value),
          itemStyle: { borderRadius: [8, 8, 0, 0] }
        }
      ]
    };
  }, [axisColor, data, textColor]);

  const approvalSlaOption = useMemo<EChartsOption | null>(() => {
    if (!data || data.approvalsByStep.length === 0) {
      return null;
    }

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { bottom: 0, textStyle: { color: textColor } },
      grid: { top: 16, right: 16, bottom: 72, left: 56 },
      xAxis: {
        type: "category",
        data: data.approvalsByStep.map((item) => item.stepName),
        axisLabel: { color: textColor, interval: 0, rotate: 18 },
        axisLine: { lineStyle: { color: axisColor } }
      },
      yAxis: [
        {
          type: "value",
          name: "Horas",
          axisLabel: { color: textColor },
          splitLine: { lineStyle: { color: axisColor } }
        },
        {
          type: "value",
          name: "Ítems",
          axisLabel: { color: textColor },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: "Promedio",
          type: "bar",
          yAxisIndex: 0,
          barMaxWidth: 36,
          data: data.approvalsByStep.map((item) => item.avgHours ?? 0),
          itemStyle: { borderRadius: [8, 8, 0, 0] }
        },
        {
          name: "Pendientes",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          data: data.approvalsByStep.map((item) => item.pendingItems)
        }
      ]
    };
  }, [axisColor, data, textColor]);

  const approvalOwnersOption = useMemo<EChartsOption | null>(() => {
    if (!data || data.approvalOwners.length === 0) {
      return null;
    }

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { top: 16, right: 16, bottom: 24, left: 160 },
      xAxis: {
        type: "value",
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: axisColor } }
      },
      yAxis: {
        type: "category",
        data: data.approvalOwners.map((item) => item.label),
        axisLabel: { color: textColor },
        axisLine: { lineStyle: { color: axisColor } }
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 28,
          data: data.approvalOwners.map((item) => item.avgHours ?? 0),
          itemStyle: { borderRadius: [0, 8, 8, 0] }
        }
      ]
    };
  }, [axisColor, data, textColor]);

  const mobilityStatusOption = useMemo<EChartsOption | null>(() => {
    if (!data || data.mobilityByStatus.length === 0) {
      return null;
    }

    return {
      tooltip: { trigger: "item" },
      legend: { bottom: 0, textStyle: { color: textColor } },
      series: [
        {
          type: "pie",
          radius: ["44%", "74%"],
          center: ["50%", "45%"],
          label: { formatter: "{b}\n{c}", color: textColor },
          data: data.mobilityByStatus.map((item) => ({ name: item.label, value: item.value }))
        }
      ]
    };
  }, [data, textColor]);

  const mobilityCycleOption = useMemo<EChartsOption | null>(() => {
    if (!data) {
      return null;
    }

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { top: 16, right: 16, bottom: 32, left: 56 },
      xAxis: {
        type: "category",
        data: ["Aprobación", "Ejecución RRHH"],
        axisLabel: { color: textColor },
        axisLine: { lineStyle: { color: axisColor } }
      },
      yAxis: {
        type: "value",
        name: "Horas",
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: axisColor } }
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 56,
          data: [
            data.summary.avgMobilityApprovalHours ?? 0,
            data.summary.avgMobilityExecutionHours ?? 0
          ],
          itemStyle: { borderRadius: [8, 8, 0, 0] }
        }
      ]
    };
  }, [axisColor, data, textColor]);

  const timelineOption = useMemo<EChartsOption | null>(() => {
    if (!data || data.timeline.length === 0) {
      return null;
    }

    return {
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, textStyle: { color: textColor } },
      grid: { top: 16, right: 16, bottom: 64, left: 56 },
      xAxis: {
        type: "category",
        data: data.timeline.map((item) => item.bucketLabel),
        axisLabel: { color: textColor },
        axisLine: { lineStyle: { color: axisColor } }
      },
      yAxis: {
        type: "value",
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: axisColor } }
      },
      series: [
        {
          name: "Folios",
          type: "line",
          smooth: true,
          data: data.timeline.map((item) => item.openedFolios)
        },
        {
          name: "Casos",
          type: "line",
          smooth: true,
          data: data.timeline.map((item) => item.openedCases)
        },
        {
          name: "Contratados",
          type: "line",
          smooth: true,
          data: data.timeline.map((item) => item.hiredCandidates)
        },
        {
          name: "MI ejecutadas",
          type: "line",
          smooth: true,
          data: data.timeline.map((item) => item.executedMobilities)
        }
      ]
    };
  }, [axisColor, data, textColor]);

  if (isLoading) {
    return <div className="bi-loading-state">Cargando analítica de reclutamiento...</div>;
  }

  if (isError || !data) {
    return <div className="bi-error-state">No se pudo cargar la analítica de reclutamiento.</div>;
  }

  return (
    <div className="bi-dashboard-grid">
      <div className="tracking-kpi-row bi-overview-kpi-row">
        {summaryCards.map((card) => (
          <article
            key={card.title}
            className={`tracking-kpi-card tracking-kpi-card-${card.type} bi-overview-kpi-card`}
          >
            <span>{card.title}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="bi-chart-row">
        <div className="info-card">
          <h3 className="bi-chart-title">Estado de Casos</h3>
          <EChartSurface
            height={320}
            option={casesByStatusOption ?? {}}
            empty={!casesByStatusOption}
            emptyMessage="Sin casos visibles para el filtro."
          />
        </div>
        <div className="info-card">
          <h3 className="bi-chart-title">Etapas de Candidatos</h3>
          <EChartSurface
            height={320}
            option={candidatesByStageOption ?? {}}
            empty={!candidatesByStageOption}
            emptyMessage="Sin candidatos visibles para el filtro."
          />
        </div>
      </div>

      <div className="bi-chart-row">
        <div className="info-card">
          <h3 className="bi-chart-title">SLA de Aprobación por Etapa</h3>
          <EChartSurface
            height={320}
            option={approvalSlaOption ?? {}}
            empty={!approvalSlaOption}
            emptyMessage="Sin aprobaciones dentro del período."
          />
        </div>
        <div className="info-card">
          <h3 className="bi-chart-title">Responsables con Mayor Demora</h3>
          <EChartSurface
            height={320}
            option={approvalOwnersOption ?? {}}
            empty={!approvalOwnersOption}
            emptyMessage="Sin responsables trazables para el filtro."
          />
        </div>
      </div>

      <div className="info-card">
        <h3 className="bi-chart-title">Pulso Semanal del Período</h3>
        <EChartSurface
          height={340}
          option={timelineOption ?? {}}
          empty={!timelineOption}
          emptyMessage="Sin movimiento en el período filtrado."
        />
      </div>

      <div className="bi-chart-row">
        <div className="info-card">
          <h3 className="bi-chart-title">Estado de Movilidad Interna</h3>
          <EChartSurface
            height={320}
            option={mobilityStatusOption ?? {}}
            empty={!mobilityStatusOption}
            emptyMessage="Sin movilidades visibles para el filtro."
          />
        </div>
        <div className="info-card">
          <h3 className="bi-chart-title">Ciclo Medio de Movilidad</h3>
          <EChartSurface
            height={320}
            option={mobilityCycleOption ?? {}}
            empty={!mobilityCycleOption}
            emptyMessage="Sin trazabilidad suficiente en movilidad."
          />
        </div>
      </div>
    </div>
  );
}
