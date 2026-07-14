import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiExceptionsMonthly } from "../hooks/useBiQueries";
import { EChartSurface, useChartTheme } from "../../../shared/ui";
import type { BiFilters } from "../types";

type BiTrendingExceptionsChartProps = {
  filters?: BiFilters;
};

export function BiTrendingExceptionsChart({ filters }: BiTrendingExceptionsChartProps) {
  const { data, isLoading } = useBiExceptionsMonthly(filters);
  const chartTheme = useChartTheme();

  const chartOption = useMemo<EChartsOption | null>(() => {
    if (!data || data.length === 0) {
      return null;
    }

    const months = Array.from(new Set(data.map((d) => d.yearMonth))).sort();
    const totalsByMonthAndType = new Map<string, number>();

    data.forEach((item) => {
      const key = `${item.yearMonth}:${item.exceptionType}`;
      totalsByMonthAndType.set(key, (totalsByMonthAndType.get(key) ?? 0) + item.totalDays);
    });

    const medicalLeaves = months.map((month) => totalsByMonthAndType.get(`${month}:medical_leave`) ?? 0);
    const vacations = months.map((month) => totalsByMonthAndType.get(`${month}:vacation`) ?? 0);
    const absenteeismByMonth = months.map((month) => {
      const monthRow = data.find((item) => item.yearMonth === month);
      return monthRow?.absenteeismPct ?? 0;
    });

    return {
      tooltip: { trigger: "axis", backgroundColor: chartTheme.tooltipSurface, textStyle: { color: chartTheme.tooltipText } },
      legend: { data: ["Licencias Médicas", "Vacaciones", "Ausentismo %"], textStyle: { color: chartTheme.text } },
      grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: months, axisLabel: { color: chartTheme.text } },
      yAxis: [
        { type: "value", splitLine: { lineStyle: { color: chartTheme.border } } },
        { type: "value", min: 0, max: 100, axisLabel: { formatter: "{value}%" } }
      ],
      series: [
        {
          name: "Licencias Médicas",
          type: "line",
          areaStyle: { opacity: 0.3 },
          smooth: true,
          itemStyle: { color: chartTheme.danger },
          data: medicalLeaves
        },
        {
          name: "Vacaciones",
          type: "line",
          areaStyle: { opacity: 0.3 },
          smooth: true,
          itemStyle: { color: chartTheme.primary },
          data: vacations
        },
        {
          name: "Ausentismo %",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          itemStyle: { color: chartTheme.warning },
          data: absenteeismByMonth
        }
      ]
    };
  }, [chartTheme, data]);

  return (
    <div className="info-card">
      <h3 className="bi-chart-title">Tendencia de Ausentismo (Días Perdidos por Mes)</h3>
      <EChartSurface
        height={300}
        option={chartOption ?? {}}
        loading={isLoading}
        empty={!chartOption}
        emptyMessage="Sin datos históricos de ausentismo"
        loadingMessage="Cargando datos..."
      />
    </div>
  );
}
