import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChartSurface, useChartTheme } from "../../../shared/ui";
import type { BiRecruitmentDashboard } from "../types";
import { useProgressiveBiStage } from "../hooks/useProgressiveBiStage";
import {
  buildIncorporationPaceSeries,
  buildVacancyGapRows,
  BI_CHART_PALETTES,
  CANDIDATE_STAGE_ORDER_INDEX,
  CANDIDATE_STAGE_OPTIONAL_BRANCHES,
  computeVacancyCoverage,
  formatMetricValue,
  formatPercentValue,
  getMobilityStatusColor,
  INCORPORATION_PACE_VIEW_OPTIONS,
  truncateRecruitmentChartLabel,
  type IncorporationPaceView
} from "../lib/recruitmentAnalyticsChartConfig";

type BiRecruitmentAnalyticsViewProps = {
  dashboard: BiRecruitmentDashboard | null;
  isLoading: boolean;
  isError: boolean;
};

// Orden operacional de estados de movilidad (no por volumen). Distintos
// "pendiente" quedan en el mismo color de familia (naranjo) pero con tonos
// propios via getMobilityStatusColor, para no perder valor diagnostico
// entre "Pendiente ejecución RRHH" y "Pendiente control contratos".
const MOBILITY_STATUS_ORDER = [
  "Ejecutadas",
  "Pendiente ejecucion RRHH",
  "Pendiente control contratos",
  "Pendiente gerencia",
  "Rechazadas"
];
const MOBILITY_STATUS_ORDER_INDEX = new Map(
  MOBILITY_STATUS_ORDER.map((label, index) => [label, index])
);

export function formatAverageHiringDuration(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Sin datos";
  }

  const totalDays = Math.max(Math.round(value), 0);
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const days = totalDays - years * 365 - months * 30;
  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${formatMetricValue(years)} ${years === 1 ? "año" : "años"}`);
  }

  if (months > 0) {
    parts.push(`${formatMetricValue(months)} ${months === 1 ? "mes" : "meses"}`);
  }

  if (days > 0 || parts.length === 0) {
    parts.push(`${formatMetricValue(days)} ${days === 1 ? "día" : "días"}`);
  }

  return parts.join(" ");
}

function buildRecruitmentTooltip(title: string, rows: Array<[string, string]>) {
  return `<div class="chart-tooltip"><div class="chart-tooltip-title">${title}</div><div class="chart-tooltip-list">${
    rows
      .map(([label, value]) => `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">${label}</span><strong>${value}</strong></div>`)
      .join("")
  }</div></div>`;
}

export function BiRecruitmentAnalyticsView({
  dashboard,
  isLoading,
  isError
}: BiRecruitmentAnalyticsViewProps) {
  const chartTheme = useChartTheme();
  const [incorporationPaceView, setIncorporationPaceView] =
    useState<IncorporationPaceView>("weekly");
  const chartStage = useProgressiveBiStage(!isLoading && !isError && Boolean(dashboard), 3);

  const textColor = chartTheme.text;
  const axisColor = chartTheme.border;
  const biPalette = BI_CHART_PALETTES[chartTheme.mode];

  const kpiCards = useMemo(() => {
    if (!dashboard) return [];

    const coverage = computeVacancyCoverage(
      dashboard.summary.requestedVacancies,
      dashboard.summary.filledVacancies
    );
    const pendingVacancies = coverage.missing;

    return [
      { title: "Folios Abiertos", value: formatMetricValue(dashboard.summary.openFolios), type: "bi-gray" },
      {
        title: "Vacantes Pendientes",
        value: formatMetricValue(pendingVacancies),
        caption: `${formatMetricValue(coverage.requested)} solicitadas`,
        type: "bi-yellow"
      },
      {
        title: "Cobertura",
        value: formatPercentValue(coverage.coveragePct),
        caption: `${formatMetricValue(coverage.filled)} / ${formatMetricValue(coverage.requested)}`,
        type: "bi-green"
      },
      { title: "Candidatos Activos", value: formatMetricValue(dashboard.summary.candidatesInProgress), type: "bi-blue" },
      {
        title: "Tiempo Medio de Contratación",
        value: formatAverageHiringDuration(dashboard.summary.averageHiringDays),
        type: "bi-blue"
      }
    ];
  }, [dashboard]);

  const vacancyGapRows = useMemo(() => {
    if (!dashboard || dashboard.vacanciesByContract.length === 0) return [];
    return buildVacancyGapRows(dashboard.vacanciesByContract);
  }, [dashboard]);

  const vacancyGapOption = useMemo<EChartsOption | null>(() => {
    if (vacancyGapRows.length === 0) return null;

    // Orden ascendente en los datos porque el eje Y categoria se dibuja de
    // abajo hacia arriba; así la barra con más faltantes queda arriba.
    const rows = [...vacancyGapRows].reverse();
    const visibleCount = Math.min(rows.length, 10);

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const point = Array.isArray(params) ? params[0] : params;
          const dataIndex = typeof point.dataIndex === "number" ? point.dataIndex : 0;
          const row = rows[dataIndex];
          if (!row) return "";

          return buildRecruitmentTooltip(row.label, [
            ["Solicitados", formatMetricValue(row.requested)],
            ["Cubiertos", formatMetricValue(row.filled)],
            ["Faltantes", formatMetricValue(row.missing)],
            ["Cobertura", formatPercentValue(row.coveragePct)]
          ]);
        }
      },
      legend: { top: 0, icon: "circle", textStyle: { color: textColor } },
      grid: { top: 32, right: 24, bottom: 8, left: 12, containLabel: true },
      dataZoom:
        rows.length > visibleCount
          ? [
              {
                type: "slider",
                yAxisIndex: 0,
                right: 4,
                width: 12,
                start: rows.length > 0 ? ((rows.length - visibleCount) / rows.length) * 100 : 0,
                end: 100,
                brushSelect: false,
                showDetail: false,
                showDataShadow: false,
                borderColor: chartTheme.border,
                fillerColor: biPalette.requested,
                backgroundColor: chartTheme.surface,
                handleSize: "150%"
              },
              { type: "inside", yAxisIndex: 0, zoomOnMouseWheel: false, moveOnMouseMove: true, moveOnMouseWheel: true }
            ]
          : undefined,
      xAxis: {
        type: "value",
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: axisColor } }
      },
      yAxis: {
        type: "category",
        data: rows.map((row) => row.label),
        axisLabel: {
          color: textColor,
          width: 160,
          overflow: "truncate",
          formatter: (value: string) => truncateRecruitmentChartLabel(value, 22)
        },
        axisLine: { lineStyle: { color: axisColor } }
      },
      series: [
        {
          name: "Solicitados",
          type: "bar",
          barWidth: 14,
          barGap: "-100%",
          z: 1,
          data: rows.map((row) => row.requested),
          itemStyle: { color: biPalette.requested, borderRadius: [0, 6, 6, 0] }
        },
        {
          name: "Cubiertos",
          type: "bar",
          barWidth: 14,
          z: 2,
          data: rows.map((row) => row.filled),
          itemStyle: { color: biPalette.covered, borderRadius: [0, 6, 6, 0] }
        }
      ]
    };
  }, [axisColor, biPalette, chartTheme, textColor, vacancyGapRows]);

  const candidateStageRows = useMemo(() => {
    if (!dashboard || dashboard.candidatesByStage.length === 0) return [];

    const totalCandidates = dashboard.candidatesByStage.reduce((sum, item) => sum + item.value, 0);

    return [...dashboard.candidatesByStage]
      .sort((left, right) => {
        const leftIndex = CANDIDATE_STAGE_ORDER_INDEX.get(left.label) ?? Number.MAX_SAFE_INTEGER;
        const rightIndex = CANDIDATE_STAGE_ORDER_INDEX.get(right.label) ?? Number.MAX_SAFE_INTEGER;
        if (leftIndex !== rightIndex) return leftIndex - rightIndex;
        return left.label.localeCompare(right.label, "es-CL");
      })
      .map((item) => ({
        ...item,
        pctOfTotal: totalCandidates > 0 ? (item.value / totalCandidates) * 100 : 0,
        isOptionalBranch: CANDIDATE_STAGE_OPTIONAL_BRANCHES.has(item.label)
      }));
  }, [dashboard]);

  const candidatesByStageOption = useMemo<EChartsOption | null>(() => {
    if (candidateStageRows.length === 0) return null;

    // Orden ascendente para que la primera etapa del pipeline quede arriba.
    const rows = [...candidateStageRows].reverse();

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const point = Array.isArray(params) ? params[0] : params;
          const dataIndex = typeof point.dataIndex === "number" ? point.dataIndex : 0;
          const row = rows[dataIndex];
          if (!row) return "";

          const rows_: Array<[string, string]> = [
            ["Candidatos", formatMetricValue(row.value)],
            ["% del total", formatPercentValue(row.pctOfTotal)]
          ];
          if (row.isOptionalBranch) {
            rows_.push(["Nota", "Etapa opcional del proceso"]);
          }
          return buildRecruitmentTooltip(row.label, rows_);
        }
      },
      grid: { top: 8, right: 24, bottom: 8, left: 12, containLabel: true },
      xAxis: {
        type: "value",
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: axisColor } }
      },
      yAxis: {
        type: "category",
        data: rows.map((row) => row.label),
        axisLabel: { color: textColor, width: 150, overflow: "truncate" },
        axisLine: { lineStyle: { color: axisColor } }
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 22,
          data: rows.map((row, index) => ({
            value: row.value,
            itemStyle: {
              color: biPalette.stage[(candidateStageRows.length - 1 - index) % biPalette.stage.length],
              opacity: row.isOptionalBranch ? 0.72 : 1,
              borderRadius: [0, 6, 6, 0]
            }
          }))
        }
      ]
    };
  }, [axisColor, biPalette, candidateStageRows, textColor]);

  const mobilityRows = useMemo(() => {
    if (!dashboard || dashboard.mobilityByStatus.length === 0) return [];

    const total = dashboard.mobilityByStatus.reduce((sum, item) => sum + item.value, 0);

    return [...dashboard.mobilityByStatus]
      .sort((left, right) => {
        const leftIndex = MOBILITY_STATUS_ORDER_INDEX.get(left.label) ?? Number.MAX_SAFE_INTEGER;
        const rightIndex = MOBILITY_STATUS_ORDER_INDEX.get(right.label) ?? Number.MAX_SAFE_INTEGER;
        if (leftIndex !== rightIndex) return leftIndex - rightIndex;
        return right.value - left.value;
      })
      .map((item) => ({ ...item, pctOfTotal: total > 0 ? (item.value / total) * 100 : 0 }));
  }, [dashboard]);

  const mobilityStatusOption = useMemo<EChartsOption | null>(() => {
    if (mobilityRows.length === 0) return null;

    const rows = [...mobilityRows].reverse();

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const point = Array.isArray(params) ? params[0] : params;
          const dataIndex = typeof point.dataIndex === "number" ? point.dataIndex : 0;
          const row = rows[dataIndex];
          if (!row) return "";

          return buildRecruitmentTooltip(row.label, [
            ["Solicitudes", formatMetricValue(row.value)],
            ["% del total", formatPercentValue(row.pctOfTotal)]
          ]);
        }
      },
      grid: { top: 8, right: 24, bottom: 8, left: 12, containLabel: true },
      xAxis: {
        type: "value",
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: axisColor } }
      },
      yAxis: {
        type: "category",
        data: rows.map((row) => row.label),
        axisLabel: { color: textColor, width: 150, overflow: "truncate" },
        axisLine: { lineStyle: { color: axisColor } }
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 26,
          data: rows.map((row) => ({
            value: row.value,
            itemStyle: {
              color: getMobilityStatusColor(row.label, biPalette),
              borderRadius: [0, 6, 6, 0]
            }
          }))
        }
      ]
    };
  }, [axisColor, biPalette, mobilityRows, textColor]);

  const incorporationPaceSeries = useMemo(() => {
    if (!dashboard || dashboard.timeline.length === 0) return [];
    return buildIncorporationPaceSeries(dashboard.timeline, incorporationPaceView);
  }, [dashboard, incorporationPaceView]);

  const incorporationPaceOption = useMemo<EChartsOption | null>(() => {
    if (incorporationPaceSeries.length === 0) return null;

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const point = Array.isArray(params) ? params[0] : params;
          const dataIndex = typeof point.dataIndex === "number" ? point.dataIndex : 0;
          const row = incorporationPaceSeries[dataIndex];
          if (!row) return "";

          return buildRecruitmentTooltip(row.bucketLabel, [
            ["Contratados", formatMetricValue(row.hiredCandidates)],
            ["Movilidad ejecutada", formatMetricValue(row.executedMobilities)],
            ["Total incorporaciones", formatMetricValue(row.totalIncorporations)]
          ]);
        }
      },
      color: [biPalette.folios, biPalette.hired],
      legend: { bottom: 0, textStyle: { color: textColor } },
      grid: { top: 16, right: 24, bottom: 64, left: 48 },
      xAxis: {
        type: "category",
        data: incorporationPaceSeries.map((item) => item.bucketLabel),
        axisLabel: { color: textColor },
        axisLine: { lineStyle: { color: axisColor } }
      },
      yAxis: {
        type: "value",
        name: "Personas",
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: axisColor } }
      },
      series: [
        {
          name: "Contratados",
          type: "bar",
          stack: "incorporaciones",
          barMaxWidth: 32,
          itemStyle: { color: biPalette.folios },
          data: incorporationPaceSeries.map((item) => item.hiredCandidates)
        },
        {
          name: "Movilidad ejecutada",
          type: "bar",
          stack: "incorporaciones",
          barMaxWidth: 32,
          itemStyle: { color: biPalette.hired, borderRadius: [4, 4, 0, 0] },
          data: incorporationPaceSeries.map((item) => item.executedMobilities)
        }
      ]
    };
  }, [axisColor, biPalette, incorporationPaceSeries, textColor]);

  if (isLoading) {
    return <div className="bi-loading-state">Cargando analítica de reclutamiento...</div>;
  }

  if (isError || !dashboard) {
    return <div className="bi-error-state">No se pudo cargar la analítica de reclutamiento.</div>;
  }

  return (
    <div className="bi-dashboard-grid">
      <div className="tracking-kpi-row bi-recruitment-kpi-row">
        {kpiCards.map((card) => (
          <article key={card.title} className={`tracking-kpi-card tracking-kpi-card-${card.type} bi-overview-kpi-card`}>
            <span>{card.title}</span>
            <strong>{card.value}</strong>
            {card.caption ? <small className="bi-kpi-caption">{card.caption}</small> : null}
          </article>
        ))}
      </div>

      {chartStage >= 1 ? (
        <div className="info-card">
          <h3 className="bi-chart-title">Brecha de Contratación por Contrato</h3>
          <EChartSurface
            height={320}
            option={vacancyGapOption ?? {}}
            empty={!vacancyGapOption}
            emptyMessage="Sin folios visibles para el filtro."
          />
        </div>
      ) : null}

      {chartStage >= 2 ? (
        <div className="bi-chart-row">
          <div className="info-card">
            <h3 className="bi-chart-title">Etapas de Candidatos</h3>
            <EChartSurface
              height={320}
              option={candidatesByStageOption ?? {}}
              empty={!candidatesByStageOption}
              emptyMessage="Sin candidatos visibles para el filtro."
            />
          </div>
          <div className="info-card">
            <h3 className="bi-chart-title">Movilidad Interna</h3>
            <EChartSurface
              height={320}
              option={mobilityStatusOption ?? {}}
              empty={!mobilityStatusOption}
              emptyMessage="Sin movilidades visibles para el filtro."
            />
          </div>
        </div>
      ) : null}

      {chartStage >= 3 ? (
        <div className="info-card">
          <div className="bi-chart-header">
            <h3 className="bi-chart-title">Ritmo de Incorporación</h3>
            <div className="bi-pulse-view-tabs" aria-label="Vista temporal del ritmo de incorporación">
              {INCORPORATION_PACE_VIEW_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={option.key === incorporationPaceView ? "is-active" : ""}
                  aria-pressed={option.key === incorporationPaceView}
                  title={option.label}
                  onClick={() => setIncorporationPaceView(option.key)}
                >
                  {option.shortLabel}
                </button>
              ))}
            </div>
          </div>
          <EChartSurface
            height={340}
            option={incorporationPaceOption ?? {}}
            empty={!incorporationPaceOption}
            emptyMessage="Sin incorporaciones visibles para el filtro."
          />
        </div>
      ) : null}
    </div>
  );
}
