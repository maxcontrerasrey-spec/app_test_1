import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { useTheme } from "../../../shared/context/ThemeContext";
import { EChartSurface } from "../../../shared/ui";
import type { BiRecruitmentDashboard } from "../types";

type BiRecruitmentAnalyticsViewProps = {
  dashboard: BiRecruitmentDashboard | null;
  isLoading: boolean;
  isError: boolean;
};

type FilledVacancyView = "total" | "hired" | "mobility";

function formatMetricValue(value: number) {
  return value.toLocaleString("es-CL");
}

export function BiRecruitmentAnalyticsView({
  dashboard,
  isLoading,
  isError
}: BiRecruitmentAnalyticsViewProps) {
  const { theme } = useTheme();
  const [filledVacancyView, setFilledVacancyView] = useState<FilledVacancyView>("total");

  const isDark = theme === "dark";
  const textColor = isDark ? "#E2E8F0" : "#1E293B";
  const axisColor = isDark ? "rgba(148, 163, 184, 0.22)" : "rgba(148, 163, 184, 0.28)";

  const summaryCardGroups = useMemo(() => {
    if (!dashboard) {
      return { primary: [], mobility: [] };
    }

    const mobilityNotExecuted = Math.max(
      dashboard.summary.mobilityRequests -
        dashboard.summary.mobilityExecuted -
        dashboard.summary.mobilityPendingExecution -
        dashboard.summary.mobilityPendingApproval,
      0
    );
    const filledVacancyOptions: Array<{
      key: FilledVacancyView;
      label: string;
      value: string;
    }> = [
      {
        key: "total",
        label: "Todos",
        value: formatMetricValue(dashboard.summary.filledVacancies)
      },
      {
        key: "hired",
        label: "Contratados",
        value: formatMetricValue(dashboard.summary.filledHiredCandidates)
      },
      {
        key: "mobility",
        label: "Movilidad",
        value: formatMetricValue(dashboard.summary.filledMobilityApproved)
      }
    ];
    const selectedFilledVacancy =
      filledVacancyOptions.find((option) => option.key === filledVacancyView) ??
      filledVacancyOptions[0];

    return {
      primary: [
        { title: "Folios Abiertos", value: formatMetricValue(dashboard.summary.openFolios), type: "pendiente" },
        { title: "Cupos Solicitados", value: formatMetricValue(dashboard.summary.requestedVacancies), type: "generado" },
        {
          title: "Cupos Cubiertos",
          value: selectedFilledVacancy.value,
          type: "generado",
          filledVacancyOptions
        },
        { title: "Candidatos en Curso", value: formatMetricValue(dashboard.summary.candidatesInProgress), type: "en-proceso" },
        { title: "Listos para Contratar", value: formatMetricValue(dashboard.summary.readyCandidates), type: "pendiente" }
      ],
      mobility: [
        { title: "Movilidades Internas", value: formatMetricValue(dashboard.summary.mobilityRequests), type: "en-proceso" },
        { title: "Movilidades Ejecutadas", value: formatMetricValue(dashboard.summary.mobilityExecuted), type: "generado" },
        { title: "Pend. Ejecución RRHH", value: formatMetricValue(dashboard.summary.mobilityPendingExecution), type: "error" },
        { title: "Pendiente de Aprobación", value: formatMetricValue(dashboard.summary.mobilityPendingApproval), type: "pendiente" },
        { title: "Rechazadas / No ejecutadas", value: formatMetricValue(mobilityNotExecuted), type: "error" }
      ]
    };
  }, [dashboard, filledVacancyView]);

  const casesByStatusOption = useMemo<EChartsOption | null>(() => {
    if (!dashboard || dashboard.casesByStatus.length === 0) {
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
          data: dashboard.casesByStatus.map((item) => ({ name: item.label, value: item.value }))
        }
      ]
    };
  }, [dashboard, textColor]);

  const candidatesByStageOption = useMemo<EChartsOption | null>(() => {
    if (!dashboard || dashboard.candidatesByStage.length === 0) {
      return null;
    }

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { top: 16, right: 16, bottom: 72, left: 56 },
      xAxis: {
        type: "category",
        data: dashboard.candidatesByStage.map((item) => item.label),
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
          data: dashboard.candidatesByStage.map((item) => item.value),
          itemStyle: { borderRadius: [8, 8, 0, 0] }
        }
      ]
    };
  }, [axisColor, dashboard, textColor]);

  const vacanciesByContractOption = useMemo<EChartsOption | null>(() => {
    if (!dashboard || dashboard.vacanciesByContract.length === 0) {
      return null;
    }

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { bottom: 0, textStyle: { color: textColor } },
      grid: { top: 16, right: 16, bottom: 88, left: 56 },
      xAxis: {
        type: "category",
        data: dashboard.vacanciesByContract.map((item) => item.label),
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
          name: "Solicitados",
          type: "bar",
          stack: "vacancies",
          data: dashboard.vacanciesByContract.map((item) => item.requested),
          itemStyle: { borderRadius: [8, 8, 0, 0] }
        },
        {
          name: "Cubiertos",
          type: "bar",
          stack: "vacancies",
          data: dashboard.vacanciesByContract.map((item) => item.filled)
        }
      ]
    };
  }, [axisColor, dashboard, textColor]);

  const mobilityStatusOption = useMemo<EChartsOption | null>(() => {
    if (!dashboard || dashboard.mobilityByStatus.length === 0) {
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
          data: dashboard.mobilityByStatus.map((item) => ({ name: item.label, value: item.value }))
        }
      ]
    };
  }, [dashboard, textColor]);

  const timelineOption = useMemo<EChartsOption | null>(() => {
    if (!dashboard || dashboard.timeline.length === 0) {
      return null;
    }

    return {
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, textStyle: { color: textColor } },
      grid: { top: 16, right: 16, bottom: 64, left: 56 },
      xAxis: {
        type: "category",
        data: dashboard.timeline.map((item) => item.bucketLabel),
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
          name: "Folios abiertos",
          type: "line",
          smooth: true,
          data: dashboard.timeline.map((item) => item.openedFolios)
        },
        {
          name: "Listos para contratar",
          type: "line",
          smooth: true,
          data: dashboard.timeline.map((item) => item.readyCandidates)
        },
        {
          name: "Contratados",
          type: "line",
          smooth: true,
          data: dashboard.timeline.map((item) => item.hiredCandidates)
        },
        {
          name: "MI ejecutadas",
          type: "line",
          smooth: true,
          data: dashboard.timeline.map((item) => item.executedMobilities)
        }
      ]
    };
  }, [axisColor, dashboard, textColor]);

  if (isLoading) {
    return <div className="bi-loading-state">Cargando analítica de reclutamiento...</div>;
  }

  if (isError || !dashboard) {
    return <div className="bi-error-state">No se pudo cargar la analítica de reclutamiento.</div>;
  }

  return (
    <div className="bi-dashboard-grid">
      <div className="tracking-kpi-row bi-recruitment-kpi-row">
        {summaryCardGroups.primary.map((card) => (
          <article
            key={card.title}
            className={`tracking-kpi-card tracking-kpi-card-${card.type} bi-overview-kpi-card ${
              card.filledVacancyOptions ? "bi-filled-vacancy-card" : ""
            }`}
          >
            <span>{card.title}</span>
            <strong>{card.value}</strong>
            {card.filledVacancyOptions ? (
              <div className="bi-card-segmented-control" aria-label="Detalle de cupos cubiertos">
                {card.filledVacancyOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={option.key === filledVacancyView ? "is-active" : ""}
                    aria-pressed={option.key === filledVacancyView}
                    onClick={() => setFilledVacancyView(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="tracking-kpi-row bi-recruitment-kpi-row">
        {summaryCardGroups.mobility.map((card) => (
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
          <h3 className="bi-chart-title">Cupos por Contrato</h3>
          <EChartSurface
            height={340}
            option={vacanciesByContractOption ?? {}}
            empty={!vacanciesByContractOption}
            emptyMessage="Sin folios visibles para el filtro."
          />
        </div>
        <div className="info-card">
          <h3 className="bi-chart-title">Estado de Movilidad Interna</h3>
          <EChartSurface
            height={340}
            option={mobilityStatusOption ?? {}}
            empty={!mobilityStatusOption}
            emptyMessage="Sin movilidades visibles para el filtro."
          />
        </div>
      </div>

      <div className="info-card">
        <h3 className="bi-chart-title">Pulso Semanal Operativo</h3>
        <EChartSurface
          height={340}
          option={timelineOption ?? {}}
          empty={!timelineOption}
          emptyMessage="Sin movimiento visible para el filtro."
        />
      </div>
    </div>
  );
}
