import ReactECharts from "echarts-for-react";
import { useBiAgeDistribution } from "../hooks/useBiQueries";
import { useTheme } from "../../../shared/context/ThemeContext";

export function BiDemographicsChart() {
  const { data, isLoading } = useBiAgeDistribution();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const textColor = isDark ? "#E2E8F0" : "#1E293B";

  const renderChart = () => {
    if (isLoading) return <div className="bi-loading-state">Cargando datos...</div>;
    if (!data || data.length === 0) return <div className="bi-empty-state">Sin datos demográficos</div>;

    // Agrupar datos por contrato y rango de edad
    const ageRanges = ["< 20", "20–29", "30–39", "40–49", "50–59", "60+", "Desconocido"];
    const contracts = Array.from(new Set(data.map((d) => d.contractCode)));

    const seriesData = ageRanges.map((range) => {
      return {
        name: range,
        type: "bar",
        stack: "total",
        emphasis: { focus: "series" },
        data: contracts.map((contract) => {
          const match = data.find((d) => d.contractCode === contract && d.ageRange === range);
          return match ? match.headcount : 0;
        })
      };
    });

    const options = {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: isDark ? "#1E293B" : "#FFFFFF", textStyle: { color: textColor } },
      legend: { data: ageRanges, textStyle: { color: textColor } },
      grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
      xAxis: { type: "value", splitLine: { lineStyle: { color: isDark ? "#334155" : "#E2E8F0" } } },
      yAxis: { type: "category", data: contracts, axisLabel: { color: textColor } },
      series: seriesData
    };

    return <ReactECharts option={options} style={{ height: "300px", width: "100%" }} />;
  };

  return (
    <div className="bi-chart-container bi-chart-full-width">
      <h3 className="bi-chart-title">Distribución Etaria por Contrato</h3>
      {renderChart()}
    </div>
  );
}
