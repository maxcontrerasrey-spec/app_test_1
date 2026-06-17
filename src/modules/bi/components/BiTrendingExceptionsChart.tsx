import ReactECharts from "echarts-for-react";
import { useBiExceptionsMonthly } from "../hooks/useBiQueries";
import { useTheme } from "../../../shared/context/ThemeContext";

export function BiTrendingExceptionsChart() {
  const { data, isLoading } = useBiExceptionsMonthly();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const textColor = isDark ? "#E2E8F0" : "#1E293B";

  const renderChart = () => {
    if (isLoading) return <div className="bi-loading-state">Cargando datos...</div>;
    if (!data || data.length === 0) return <div className="bi-empty-state">Sin datos históricos de ausentismo</div>;

    const months = Array.from(new Set(data.map((d) => d.yearMonth))).sort();
    
    // Agrupar por tipo (vacaciones vs licencias vs otros)
    const medicalLeaves = months.map((month) => {
      const match = data.filter((d) => d.yearMonth === month && d.exceptionType === "medical_leave");
      return match.reduce((acc, curr) => acc + curr.totalDays, 0);
    });

    const vacations = months.map((month) => {
      const match = data.filter((d) => d.yearMonth === month && d.exceptionType === "vacation");
      return match.reduce((acc, curr) => acc + curr.totalDays, 0);
    });

    const options = {
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

    return <ReactECharts option={options} style={{ height: "300px", width: "100%" }} />;
  };

  return (
    <div className="info-card">
      <h3 className="bi-chart-title">Tendencia de Ausentismo (Días Perdidos por Mes)</h3>
      {renderChart()}
    </div>
  );
}
