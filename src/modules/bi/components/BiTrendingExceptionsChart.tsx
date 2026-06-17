import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiExceptionsMonthly } from "../hooks/useBiQueries";
import { useTheme } from "../../../shared/context/ThemeContext";
import { EChartSurface } from "../../../shared/ui";

export function BiTrendingExceptionsChart() {
  const { data, isLoading } = useBiExceptionsMonthly();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const textColor = isDark ? "#E2E8F0" : "#1E293B";

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

    return {
      tooltip: { trigger: "axis", backgroundColor: isDark ? "#1E293B" : "#FFFFFF", textStyle: { color: textColor } },
      legend: { data: ["Licencias Médicas", "Vacaciones"], textStyle: { color: textColor } },
      grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: months, axisLabel: { color: textColor } },
      yAxis: { type: "value", splitLine: { lineStyle: { color: isDark ? "#334155" : "#E2E8F0" } } },
      series: [
        {
          name: "Licencias Médicas",
          type: "line",
          areaStyle: { opacity: 0.3 },
          smooth: true,
          itemStyle: { color: "#EF4444" },
          data: medicalLeaves
        },
        {
          name: "Vacaciones",
          type: "line",
          areaStyle: { opacity: 0.3 },
          smooth: true,
          itemStyle: { color: "#3B82F6" },
          data: vacations
        }
      ]
    };
  }, [data, isDark, textColor]);

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
