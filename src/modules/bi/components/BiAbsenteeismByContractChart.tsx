import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiHeadcountByContract, useBiPresenceSummaryToday } from "../hooks/useBiQueries";
import { formatBiContractLabel } from "../lib/presentation";
import { EChartSurface, useChartTheme } from "../../../shared/ui";
import { buildAbsenteeismByContractRows, formatMetricValue, formatPercentValue, WORKFORCE_PALETTE } from "../lib/workforceChartConfig";
import type { BiFilters } from "../types";

type BiAbsenteeismByContractChartProps = {
  filters?: BiFilters;
};

const VISIBLE_ROWS_BEFORE_ZOOM = 10;

/**
 * "Ausentismo por Contrato" = 100 - presence_pct, calculado por
 * `get_bi_presence_summary_today` de forma consistente por contrato. Se
 * tituló como ausentismo (no presencia) porque la prioridad de gestión es
 * detectar contratos con mayor déficit de disponibilidad hoy (sección 9
 * del brief); no se aplica ningún umbral "crítico/bueno/malo" porque no
 * existe un objetivo oficial de JM para ausentismo.
 */
export function BiAbsenteeismByContractChart({ filters }: BiAbsenteeismByContractChartProps) {
  const { data: presenceData, isLoading: isLoadingPresence, isError: isErrorPresence } = useBiPresenceSummaryToday(filters);
  const { data: contractData } = useBiHeadcountByContract(filters);
  const chartTheme = useChartTheme();
  const palette = WORKFORCE_PALETTE[chartTheme.mode];

  const labelByContractCode = useMemo(() => {
    const lookup = new Map<string, string>();
    contractData?.forEach((item) => {
      if (!lookup.has(item.contractCode)) {
        lookup.set(item.contractCode, formatBiContractLabel(item.areaName || item.contractCode));
      }
    });
    return lookup;
  }, [contractData]);

  const rows = useMemo(() => {
    if (!presenceData || presenceData.length === 0) return [];
    return buildAbsenteeismByContractRows(presenceData, labelByContractCode);
  }, [labelByContractCode, presenceData]);

  const chartOption = useMemo<EChartsOption | null>(() => {
    if (rows.length === 0) return null;

    const ordered = [...rows].reverse();
    const visibleCount = Math.min(ordered.length, VISIBLE_ROWS_BEFORE_ZOOM);

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: chartTheme.tooltipSurface,
        textStyle: { color: chartTheme.tooltipText },
        formatter: (raw: unknown) => {
          const point = Array.isArray(raw) ? raw[0] : raw;
          const dataIndex = typeof point?.dataIndex === "number" ? point.dataIndex : 0;
          const row = ordered[dataIndex];
          if (!row) return "";
          return `<div class="chart-tooltip"><div class="chart-tooltip-title">${row.label}</div><div class="chart-tooltip-list">` +
            `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Ausentismo</span><strong>${formatPercentValue(row.absenteeismPct)}</strong></div>` +
            `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Presentes</span><strong>${formatMetricValue(row.presentToday)}</strong></div>` +
            `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Ausentes</span><strong>${formatMetricValue(row.absentToday)}</strong></div>` +
            `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Dotación base</span><strong>${formatMetricValue(row.headcount)}</strong></div>` +
            `</div></div>`;
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
                borderColor: chartTheme.border,
                fillerColor: palette.otherAbsence,
                backgroundColor: chartTheme.tooltipSurface,
                handleSize: "150%"
              },
              { type: "inside", yAxisIndex: 0, zoomOnMouseWheel: false, moveOnMouseMove: true, moveOnMouseWheel: true }
            ]
          : undefined,
      xAxis: {
        type: "value",
        axisLabel: { color: chartTheme.text, formatter: "{value}%" },
        splitLine: { lineStyle: { color: chartTheme.border } }
      },
      yAxis: {
        type: "category",
        data: ordered.map((row) => row.label),
        axisLabel: { color: chartTheme.text, width: 170, overflow: "truncate" },
        axisLine: { lineStyle: { color: chartTheme.border } }
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 22,
          data: ordered.map((row) => row.absenteeismPct),
          itemStyle: { color: palette.otherAbsence, borderRadius: [0, 6, 6, 0] }
        }
      ]
    };
  }, [chartTheme, palette, rows]);

  return (
    <div className="info-card">
      <h3 className="bi-chart-title">Ausentismo por Contrato (Hoy)</h3>
      <EChartSurface
        height={320}
        option={chartOption ?? {}}
        loading={isLoadingPresence}
        empty={!isLoadingPresence && (isErrorPresence || !chartOption)}
        emptyMessage={isErrorPresence ? "No se pudo cargar el ausentismo por contrato." : "No hay datos para los filtros seleccionados."}
        loadingMessage="Cargando datos..."
      />
    </div>
  );
}
