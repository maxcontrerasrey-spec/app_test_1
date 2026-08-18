import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiAbsenteeismTrend } from "../hooks/useBiQueries";
import { EChartSurface, useChartTheme } from "../../../shared/ui";
import { buildRecentPeriodCodes, formatMetricValue, formatPercentValue, WORKFORCE_PALETTE } from "../lib/workforceChartConfig";
import type { BiFilters } from "../types";

type BiAbsenteeismTrendChartProps = {
  filters?: BiFilters;
};

const TREND_MONTHS = 6;

function referenceDateFromPeriodCode(periodCode?: string): Date {
  if (periodCode && /^\d{6}$/.test(periodCode)) {
    const year = Number(periodCode.slice(0, 4));
    const month = Number(periodCode.slice(4, 6));
    return new Date(year, month - 1, 1);
  }
  return new Date();
}

export function BiAbsenteeismTrendChart({ filters }: BiAbsenteeismTrendChartProps) {
  const chartTheme = useChartTheme();
  const palette = WORKFORCE_PALETTE[chartTheme.mode];

  const periodCodes = useMemo(
    () => buildRecentPeriodCodes(TREND_MONTHS, referenceDateFromPeriodCode(filters?.periodCode)),
    [filters?.periodCode]
  );

  // La tendencia siempre necesita su propia ventana de 6 meses; el filtro
  // de período solo mueve el mes final de esa ventana, no acota a un único
  // mes (eso dejaría un solo punto, sin tendencia que mostrar).
  const trendFilters = useMemo<BiFilters | undefined>(
    () => (filters ? { ...filters, periodCode: undefined } : undefined),
    [filters]
  );

  const { data, isLoading, isError } = useBiAbsenteeismTrend(trendFilters, periodCodes);

  const chartOption = useMemo<EChartsOption | null>(() => {
    if (!data || data.length === 0) return null;

    const hasAnyDays = data.some((point) => point.totalDays > 0);
    if (!hasAnyDays) return null;

    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: chartTheme.tooltipSurface,
        textStyle: { color: chartTheme.tooltipText },
        formatter: (raw: unknown) => {
          const points = Array.isArray(raw) ? raw : [raw];
          const first = points[0] as { dataIndex?: number } | undefined;
          const dataIndex = typeof first?.dataIndex === "number" ? first.dataIndex : 0;
          const point = data[dataIndex];
          if (!point) return "";

          const pctRow =
            point.absenteeismPct !== null
              ? `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Ausentismo</span><strong>${formatPercentValue(point.absenteeismPct)}</strong></div>`
              : "";

          return `<div class="chart-tooltip"><div class="chart-tooltip-title">${point.monthLabel}</div><div class="chart-tooltip-list">` +
            `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Vacaciones</span><strong>${formatMetricValue(point.vacationDays)} días</strong></div>` +
            `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Licencias médicas</span><strong>${formatMetricValue(point.medicalLeaveDays)} días</strong></div>` +
            `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Otras ausencias</span><strong>${formatMetricValue(point.otherAbsenceDays)} días</strong></div>` +
            `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Total</span><strong>${formatMetricValue(point.totalDays)} días</strong></div>` +
            `${pctRow}</div></div>`;
        }
      },
      legend: {
        bottom: 0,
        icon: "circle",
        textStyle: { color: chartTheme.text },
        data: ["Vacaciones", "Licencias médicas", "Otras ausencias", "Ausentismo %"]
      },
      grid: { top: 20, right: 48, bottom: 56, left: 48 },
      xAxis: {
        type: "category",
        data: data.map((point) => point.monthLabel),
        axisLabel: { color: chartTheme.text },
        axisLine: { lineStyle: { color: chartTheme.border } }
      },
      yAxis: [
        {
          type: "value",
          name: "Días",
          axisLabel: { color: chartTheme.text },
          splitLine: { lineStyle: { color: chartTheme.border } }
        },
        {
          type: "value",
          name: "Ausentismo %",
          min: 0,
          max: (value: { max: number }) => Math.max(10, Math.ceil(value.max * 1.2)),
          axisLabel: { color: chartTheme.text, formatter: "{value}%" },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: "Vacaciones",
          type: "bar",
          stack: "absences",
          yAxisIndex: 0,
          itemStyle: { color: palette.vacation },
          data: data.map((point) => point.vacationDays)
        },
        {
          name: "Licencias médicas",
          type: "bar",
          stack: "absences",
          yAxisIndex: 0,
          itemStyle: { color: palette.medicalLeave },
          data: data.map((point) => point.medicalLeaveDays)
        },
        {
          name: "Otras ausencias",
          type: "bar",
          stack: "absences",
          yAxisIndex: 0,
          itemStyle: { color: palette.otherAbsence, borderRadius: [4, 4, 0, 0] },
          data: data.map((point) => point.otherAbsenceDays)
        },
        {
          name: "Ausentismo %",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          symbolSize: 7,
          lineStyle: { color: chartTheme.text, width: 2.4 },
          itemStyle: { color: chartTheme.text },
          connectNulls: false,
          data: data.map((point) => point.absenteeismPct)
        }
      ]
    };
  }, [chartTheme, data, palette]);

  return (
    <div className="info-card">
      <h3 className="bi-chart-title">Evolución Mensual del Ausentismo</h3>
      <EChartSurface
        height={340}
        option={chartOption ?? {}}
        loading={isLoading}
        empty={!isLoading && (isError || !chartOption)}
        emptyMessage={isError ? "No se pudo cargar la evolución de ausentismo." : "No hay datos suficientes para mostrar la evolución."}
        loadingMessage="Cargando datos..."
      />
    </div>
  );
}
