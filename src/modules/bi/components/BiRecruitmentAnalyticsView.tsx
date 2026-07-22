import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChartSurface, useChartTheme } from "../../../shared/ui";
import type { BiRecruitmentDashboard } from "../types";
import {
  aggregatePulseData,
  BI_CHART_PALETTES,
  CANDIDATE_STAGE_ORDER_INDEX,
  formatMetricValue,
  formatPercentValue,
  getCaseStatusColor,
  getMobilityStatusColor,
  OPERATIONAL_PULSE_VIEW_OPTIONS,
  type FilledVacancyView,
  type OperationalPulseView,
  type RequestedVacancyView
} from "../lib/recruitmentAnalyticsChartConfig";

type BiRecruitmentAnalyticsViewProps = {
  dashboard: BiRecruitmentDashboard | null;
  isLoading: boolean;
  isError: boolean;
};

export function BiRecruitmentAnalyticsView({
  dashboard,
  isLoading,
  isError
}: BiRecruitmentAnalyticsViewProps) {
  const chartTheme = useChartTheme();
  const [filledVacancyView, setFilledVacancyView] = useState<FilledVacancyView>("total");
  const [requestedVacancyView, setRequestedVacancyView] =
    useState<RequestedVacancyView>("total");
  const [operationalPulseView, setOperationalPulseView] =
    useState<OperationalPulseView>("weekly");

  const textColor = chartTheme.text;
  const axisColor = chartTheme.border;
  const biPalette = BI_CHART_PALETTES[chartTheme.mode];

  const summaryCardGroups = useMemo(() => {
    if (!dashboard) {
      return { primary: [] };
    }

    const requestedVacancyOptions: Array<{
      key: RequestedVacancyView;
      label: string;
      value: string;
    }> = [
      {
        key: "total",
        label: "Total",
        value: formatMetricValue(dashboard.summary.requestedVacancies)
      },
      {
        key: "pending",
        label: "Faltante",
        value: formatMetricValue(
          Math.max(dashboard.summary.requestedVacancies - dashboard.summary.filledVacancies, 0)
        )
      }
    ];
    const selectedRequestedVacancy =
      requestedVacancyOptions.find((option) => option.key === requestedVacancyView) ??
      requestedVacancyOptions[0];

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
        { title: "Folios Abiertos", value: formatMetricValue(dashboard.summary.openFolios), type: "bi-gray" },
        {
          title: "Cupos Solicitados",
          value: selectedRequestedVacancy.value,
          type: "bi-yellow",
          segmentedOptions: requestedVacancyOptions,
          activeSegmentKey: requestedVacancyView,
          onSegmentSelect: (key: string) => setRequestedVacancyView(key as RequestedVacancyView),
          segmentedControlLabel: "Detalle de cupos solicitados"
        },
        {
          title: "Cupos Cubiertos",
          value: selectedFilledVacancy.value,
          type: "bi-green",
          segmentedOptions: filledVacancyOptions,
          activeSegmentKey: filledVacancyView,
          onSegmentSelect: (key: string) => setFilledVacancyView(key as FilledVacancyView),
          segmentedControlLabel: "Detalle de cupos cubiertos"
        },
        { title: "Candidatos en Curso", value: formatMetricValue(dashboard.summary.candidatesInProgress), type: "bi-blue" },
        { title: "Listos para Contratar", value: formatMetricValue(dashboard.summary.readyCandidates), type: "bi-ready" }
      ]
    };
  }, [dashboard, filledVacancyView, requestedVacancyView]);

  const casesByStatusOption = useMemo<EChartsOption | null>(() => {
    if (!dashboard || dashboard.casesByStatus.length === 0) {
      return null;
    }

    const totalCases = dashboard.casesByStatus.reduce((sum, item) => sum + item.value, 0);

    return {
      color: dashboard.casesByStatus.map((item) => getCaseStatusColor(item.label, biPalette)),
      tooltip: { trigger: "item" },
      series: [
        {
          type: "pie",
          radius: ["42%", "72%"],
          center: ["50%", "50%"],
          itemStyle: {
            borderColor: chartTheme.surface,
            borderWidth: 2
          },
          label: {
            formatter: (params) => {
              const percent = typeof params.percent === "number"
                ? params.percent
                : totalCases > 0
                  ? (Number(params.value ?? 0) / totalCases) * 100
                  : 0;
              return `${params.name}\n${formatPercentValue(percent)}`;
            },
            color: textColor
          },
          tooltip: {
            valueFormatter: (value) => {
              const numericValue = Number(value);
              const percent = totalCases > 0 ? (numericValue / totalCases) * 100 : 0;
              return formatPercentValue(percent);
            }
          },
          data: dashboard.casesByStatus.map((item) => ({
            name: item.label,
            value: item.value,
            itemStyle: {
              color: getCaseStatusColor(item.label, biPalette),
              borderColor: chartTheme.surface,
              borderWidth: 2
            }
          }))
        }
      ]
    };
  }, [biPalette, chartTheme.surface, dashboard, textColor]);

  const candidatesByStageOption = useMemo<EChartsOption | null>(() => {
    if (!dashboard || dashboard.candidatesByStage.length === 0) {
      return null;
    }

    const orderedStages = [...dashboard.candidatesByStage].sort((left, right) => {
      const leftIndex = CANDIDATE_STAGE_ORDER_INDEX.get(left.label) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = CANDIDATE_STAGE_ORDER_INDEX.get(right.label) ?? Number.MAX_SAFE_INTEGER;

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return left.label.localeCompare(right.label, "es-CL");
    });

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { top: 16, right: 16, bottom: 72, left: 56 },
      xAxis: {
        type: "category",
        data: orderedStages.map((item) => item.label),
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
          data: orderedStages.map((item, index) => ({
            value: item.value,
            itemStyle: { color: biPalette.stage[index % biPalette.stage.length] }
          })),
          itemStyle: { borderRadius: [8, 8, 0, 0] }
        }
      ]
    };
  }, [axisColor, biPalette, dashboard, textColor]);

  const vacanciesByContractOption = useMemo<EChartsOption | null>(() => {
    if (!dashboard || dashboard.vacanciesByContract.length === 0) {
      return null;
    }

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { top: 16, right: 16, bottom: 104, left: 56 },
      dataZoom: [
        {
          type: "slider",
          bottom: 20,
          height: 14,
          start: 0,
          end:
            dashboard.vacanciesByContract.length > 14
              ? Math.round((14 / dashboard.vacanciesByContract.length) * 100)
              : 100,
          brushSelect: false,
          showDetail: false,
          showDataShadow: false,
          borderColor: chartTheme.border,
          fillerColor: biPalette.requested,
          backgroundColor: chartTheme.surface,
          handleSize: "190%",
          handleStyle: {
            color: chartTheme.textMuted,
            borderColor: chartTheme.border
          },
          moveHandleStyle: { color: chartTheme.textMuted },
          selectedDataBackground: {
            lineStyle: { color: biPalette.requested },
            areaStyle: { color: biPalette.requested }
          }
        },
        {
          type: "inside",
          zoomOnMouseWheel: false,
          moveOnMouseMove: true,
          moveOnMouseWheel: true
        }
      ],
      xAxis: {
        type: "category",
        data: dashboard.vacanciesByContract.map((item) => item.label),
        axisLabel: { color: textColor, interval: 0, rotate: 20, width: 108, overflow: "truncate" },
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
          barWidth: 18,
          barGap: "-100%",
          z: 1,
          data: dashboard.vacanciesByContract.map((item) => item.requested),
          itemStyle: {
            borderRadius: [8, 8, 0, 0],
            color: biPalette.requested
          }
        },
        {
          name: "Cubiertos",
          type: "bar",
          barWidth: 18,
          z: 2,
          data: dashboard.vacanciesByContract.map((item) => item.filled),
          itemStyle: {
            borderRadius: [8, 8, 0, 0],
            color: biPalette.covered
          }
        }
      ]
    };
  }, [axisColor, biPalette, chartTheme, dashboard, textColor]);

  const mobilityStatusOption = useMemo<EChartsOption | null>(() => {
    if (!dashboard || dashboard.mobilityByStatus.length === 0) {
      return null;
    }

    return {
      color: dashboard.mobilityByStatus.map((item) => getMobilityStatusColor(item.label, biPalette)),
      tooltip: { trigger: "item" },
      series: [
        {
          type: "pie",
          radius: ["44%", "74%"],
          center: ["50%", "50%"],
          itemStyle: {
            borderColor: chartTheme.surface,
            borderWidth: 2
          },
          label: { formatter: "{b}\n{c}", color: textColor },
          data: dashboard.mobilityByStatus.map((item) => ({
            name: item.label,
            value: item.value,
            itemStyle: {
              color: getMobilityStatusColor(item.label, biPalette),
              borderColor: chartTheme.surface,
              borderWidth: 2
            }
          }))
        }
      ]
    };
  }, [biPalette, chartTheme.surface, dashboard, textColor]);

  const timelineOption = useMemo<EChartsOption | null>(() => {
    if (!dashboard || dashboard.timeline.length === 0) {
      return null;
    }

    const pulseData = aggregatePulseData(dashboard.timeline, operationalPulseView);
    const requestedGoalMax = Math.max(
      ...pulseData.map((item) => item.requestedVacancies),
      1
    );

    return {
      color: [biPalette.folios, biPalette.hired, biPalette.mobility, biPalette.ready],
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, textStyle: { color: textColor } },
      grid: { top: 16, right: 16, bottom: 64, left: 56 },
      xAxis: {
        type: "category",
        data: pulseData.map((item) => item.bucketLabel),
        axisLabel: { color: textColor },
        axisLine: { lineStyle: { color: axisColor } }
      },
      yAxis: [
        {
          type: "value",
          axisLabel: { color: textColor },
          splitLine: { lineStyle: { color: axisColor } }
        },
        {
          type: "value",
          min: 0,
          max: requestedGoalMax,
          show: false,
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: "Folios abiertos",
          type: "line",
          yAxisIndex: 0,
          smooth: true,
          symbolSize: 7,
          lineStyle: { color: biPalette.folios, width: 2.8 },
          itemStyle: { color: biPalette.folios },
          data: pulseData.map((item) => item.openedFolios)
        },
        {
          name: "Contratados",
          type: "line",
          yAxisIndex: 0,
          smooth: true,
          symbolSize: 7,
          lineStyle: { color: biPalette.hired, width: 2.8 },
          itemStyle: { color: biPalette.hired },
          data: pulseData.map((item) => item.hiredCandidates)
        },
        {
          name: "MI ejecutadas",
          type: "line",
          yAxisIndex: 0,
          smooth: true,
          symbol: "diamond",
          symbolSize: 8,
          lineStyle: { color: biPalette.mobility, width: 2.6, type: "dashed" },
          itemStyle: { color: biPalette.mobility },
          data: pulseData.map((item) => item.executedMobilities)
        },
        {
          name: "Meta requerimiento",
          type: "line",
          yAxisIndex: 1,
          smooth: false,
          symbol: "none",
          lineStyle: { color: biPalette.ready, type: "dotted", width: 2.4 },
          label: {
            show: true,
            position: "right",
            color: biPalette.ready,
            formatter: "Meta {c}"
          },
          data: pulseData.map((item) => item.requestedVacancies)
        }
      ]
    };
  }, [axisColor, biPalette, dashboard, operationalPulseView, textColor]);

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
              card.segmentedOptions ? "bi-segmented-kpi-card" : ""
            }`}
          >
            <span>{card.title}</span>
            <strong>{card.value}</strong>
            {card.segmentedOptions ? (
              <div
                className={`bi-card-segmented-control bi-card-segmented-control-${card.segmentedOptions.length}`}
                aria-label={card.segmentedControlLabel}
              >
                {card.segmentedOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={option.key === card.activeSegmentKey ? "is-active" : ""}
                    aria-pressed={option.key === card.activeSegmentKey}
                    onClick={() => card.onSegmentSelect(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
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
        <div className="bi-chart-header">
          <h3 className="bi-chart-title">Pulso Operativo</h3>
          <div className="bi-pulse-view-tabs" aria-label="Vista temporal del pulso operativo">
            {OPERATIONAL_PULSE_VIEW_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={option.key === operationalPulseView ? "is-active" : ""}
                aria-pressed={option.key === operationalPulseView}
                title={option.label}
                onClick={() => setOperationalPulseView(option.key)}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
        </div>
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
