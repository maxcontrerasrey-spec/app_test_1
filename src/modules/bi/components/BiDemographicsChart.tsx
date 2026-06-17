import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiAgeDistribution } from "../hooks/useBiQueries";
import { useTheme } from "../../../shared/context/ThemeContext";
import { EChartSurface } from "../../../shared/ui";

export function BiDemographicsChart() {
  const { data, isLoading } = useBiAgeDistribution();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const textColor = isDark ? "#E2E8F0" : "#1E293B";

  const chartOption = useMemo<EChartsOption | null>(() => {
    if (!data || data.length === 0) {
      return null;
    }

    const ageRanges = ["< 20", "20–29", "30–39", "40–49", "50–59", "60+", "Desconocido"];
    const contracts = Array.from(new Set(data.map((d) => d.contractCode)));
    const lookup = new Map<string, number>();

    data.forEach((item) => {
      lookup.set(`${item.contractCode}:${item.ageRange}`, item.headcount);
    });

    const seriesData = ageRanges.map((range) => {
      return {
        name: range,
        type: "bar" as const,
        stack: "total",
        emphasis: { focus: "series" as const },
        data: contracts.map((contract) => lookup.get(`${contract}:${range}`) ?? 0)
      };
    });

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: isDark ? "#1E293B" : "#FFFFFF", textStyle: { color: textColor } },
      legend: { data: ageRanges, textStyle: { color: textColor } },
      grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
      xAxis: { type: "value", splitLine: { lineStyle: { color: isDark ? "#334155" : "#E2E8F0" } } },
      yAxis: { type: "category", data: contracts, axisLabel: { color: textColor } },
      series: seriesData
    };
  }, [data, isDark, textColor]);

  return (
    <div className="info-card">
      <h3 className="bi-chart-title">Distribución Etaria por Contrato</h3>
      <EChartSurface
        height={300}
        option={chartOption ?? {}}
        loading={isLoading}
        empty={!chartOption}
        emptyMessage="Sin datos demográficos"
        loadingMessage="Cargando datos..."
      />
    </div>
  );
}
