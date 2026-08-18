import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiHeadcountByContract, useBiHeadcountByJobTitle } from "../hooks/useBiQueries";
import { formatBiContractLabel } from "../lib/presentation";
import { EChartSurface, useChartTheme } from "../../../shared/ui";
import { buildRankedShareRows, formatMetricValue, formatPercentValue, WORKFORCE_PALETTE } from "../lib/workforceChartConfig";
import type { BiFilters } from "../types";

type BiHeadcountChartsProps = {
  filters?: BiFilters;
};

const VISIBLE_ROWS_BEFORE_ZOOM = 10;

function buildRankedBarOption(
  rows: ReturnType<typeof buildRankedShareRows>,
  params: {
    color: string;
    tooltipLabel: string;
    textColor: string;
    borderColor: string;
    surfaceColor: string;
  }
): EChartsOption {
  // Ascendente porque el eje categoría dibuja de abajo hacia arriba; así el
  // valor más alto queda arriba, coincidiendo con la lectura "ranking".
  const ordered = [...rows].reverse();
  const visibleCount = Math.min(ordered.length, VISIBLE_ROWS_BEFORE_ZOOM);

  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: params.surfaceColor,
      textStyle: { color: params.textColor },
      formatter: (raw: unknown) => {
        const point = Array.isArray(raw) ? raw[0] : raw;
        const dataIndex = typeof point?.dataIndex === "number" ? point.dataIndex : 0;
        const row = ordered[dataIndex];
        if (!row) return "";
        return `<div class="chart-tooltip"><div class="chart-tooltip-title">${row.label}</div><div class="chart-tooltip-list"><div class="chart-tooltip-item"><span class="chart-tooltip-item-label">${params.tooltipLabel}</span><strong>${formatMetricValue(row.value)}</strong></div><div class="chart-tooltip-item"><span class="chart-tooltip-item-label">% del total</span><strong>${formatPercentValue(row.pct)}</strong></div></div></div>`;
      }
    },
    grid: { top: 8, right: 24, bottom: 8, left: 12, containLabel: true },
    dataZoom:
      ordered.length > visibleCount
        ? [
            {
              type: "slider",
              yAxisIndex: 0,
              right: 4,
              width: 12,
              start: ((ordered.length - visibleCount) / ordered.length) * 100,
              end: 100,
              brushSelect: false,
              showDetail: false,
              showDataShadow: false,
              borderColor: params.borderColor,
              fillerColor: params.color,
              backgroundColor: params.surfaceColor,
              handleSize: "150%"
            },
            { type: "inside", yAxisIndex: 0, zoomOnMouseWheel: false, moveOnMouseMove: true, moveOnMouseWheel: true }
          ]
        : undefined,
    xAxis: {
      type: "value",
      axisLabel: { color: params.textColor },
      splitLine: { lineStyle: { color: params.borderColor } }
    },
    yAxis: {
      type: "category",
      data: ordered.map((row) => row.label),
      axisLabel: { color: params.textColor, width: 170, overflow: "truncate" },
      axisLine: { lineStyle: { color: params.borderColor } }
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 22,
        data: ordered.map((row) => row.value),
        itemStyle: { color: params.color, borderRadius: [0, 6, 6, 0] }
      }
    ]
  };
}

export function BiHeadcountCharts({ filters }: BiHeadcountChartsProps) {
  const { data: contractData, isLoading: isLoadingContract, isError: isErrorContract } = useBiHeadcountByContract(filters);
  const { data: jobData, isLoading: isLoadingJob, isError: isErrorJob } = useBiHeadcountByJobTitle(filters);
  const chartTheme = useChartTheme();
  const palette = WORKFORCE_PALETTE[chartTheme.mode];

  // Memoizado a propósito: si este objeto se recrea en cada render, los
  // useMemo de las opciones que lo tienen como dependencia se invalidan
  // siempre y ECharts recibe una option nueva en cada render del padre
  // (mismo patrón de referencia inestable que causó el loop de filtros).
  const themeParams = useMemo(
    () => ({
      textColor: chartTheme.text,
      borderColor: chartTheme.border,
      surfaceColor: chartTheme.tooltipSurface
    }),
    [chartTheme.border, chartTheme.text, chartTheme.tooltipSurface]
  );

  const contractRows = useMemo(() => {
    if (!contractData || contractData.length === 0) return [];
    const totals = new Map<string, number>();
    contractData.forEach((item) => {
      const label = formatBiContractLabel(item.areaName || item.contractCode);
      totals.set(label, (totals.get(label) ?? 0) + item.headcount);
    });
    return buildRankedShareRows(totals);
  }, [contractData]);

  const jobRows = useMemo(() => {
    if (!jobData || jobData.length === 0) return [];
    const totals = new Map<string, number>();
    jobData.forEach((item) => {
      const label = item.jobTitle.trim() || "SIN CARGO";
      totals.set(label, (totals.get(label) ?? 0) + item.headcount);
    });
    return buildRankedShareRows(totals);
  }, [jobData]);

  const contractOption = useMemo<EChartsOption | null>(() => {
    if (contractRows.length === 0) return null;
    return buildRankedBarOption(contractRows, { color: palette.volume, tooltipLabel: "Dotación", ...themeParams });
  }, [contractRows, palette.volume, themeParams]);

  const jobOption = useMemo<EChartsOption | null>(() => {
    if (jobRows.length === 0) return null;
    return buildRankedBarOption(jobRows, { color: palette.neutral, tooltipLabel: "Personas", ...themeParams });
  }, [jobRows, palette.neutral, themeParams]);

  return (
    <div className="bi-chart-row">
      <div className="info-card">
        <h3 className="bi-chart-title">Dotación por Contrato</h3>
        <EChartSurface
          height={320}
          option={contractOption ?? {}}
          loading={isLoadingContract}
          empty={!isLoadingContract && (isErrorContract || !contractOption)}
          emptyMessage={isErrorContract ? "No se pudo cargar la dotación por contrato." : "No hay datos para los filtros seleccionados."}
          loadingMessage="Cargando datos..."
        />
      </div>
      <div className="info-card">
        <h3 className="bi-chart-title">Dotación por Cargo</h3>
        <EChartSurface
          height={320}
          option={jobOption ?? {}}
          loading={isLoadingJob}
          empty={!isLoadingJob && (isErrorJob || !jobOption)}
          emptyMessage={isErrorJob ? "No se pudo cargar la dotación por cargo." : "No hay datos para los filtros seleccionados."}
          loadingMessage="Cargando datos..."
        />
      </div>
    </div>
  );
}
