import ReactECharts from "echarts-for-react";
import { useBiPresenceSummaryToday, useBiExceptionsToday } from "../hooks/useBiQueries";
import { useTheme } from "../../../shared/context/ThemeContext";

export function BiPresenceAndExceptions() {
  const { data: presenceData, isLoading: isLoadingPresence } = useBiPresenceSummaryToday();
  const { data: exceptionsData, isLoading: isLoadingExceptions } = useBiExceptionsToday();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const textColor = isDark ? "#E2E8F0" : "#1E293B";

  const renderGauge = () => {
    if (isLoadingPresence) return <div className="bi-loading-state">Cargando datos...</div>;
    if (!presenceData || presenceData.length === 0) return <div className="bi-empty-state">Sin datos de presencia</div>;

    const totalHeadcount = presenceData.reduce((acc, d) => acc + d.headcount, 0);
    const totalPresent = presenceData.reduce((acc, d) => acc + d.presentToday, 0);
    const overallPresencePct = totalHeadcount > 0 ? (totalPresent / totalHeadcount) * 100 : 0;

    const options = {
      series: [
        {
          type: "gauge",
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: 100,
          splitNumber: 10,
          itemStyle: {
            color: overallPresencePct >= 90 ? "#10B981" : overallPresencePct >= 80 ? "#F59E0B" : "#EF4444"
          },
          progress: { show: true, width: 30 },
          pointer: { show: false },
          axisLine: { lineStyle: { width: 30, color: [[1, isDark ? "#334155" : "#E2E8F0"]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          title: { show: false },
          detail: {
            valueAnimation: true,
            formatter: "{value}%",
            color: textColor,
            fontSize: 40,
            offsetCenter: [0, "-10%"]
          },
          data: [{ value: Number(overallPresencePct.toFixed(1)) }]
        }
      ]
    };

    return <ReactECharts option={options} style={{ height: "300px", width: "100%" }} />;
  };

  const renderExceptionsDonut = () => {
    if (isLoadingExceptions) return <div className="bi-loading-state">Cargando datos...</div>;
    if (!exceptionsData || exceptionsData.length === 0) return <div className="bi-empty-state">Sin excepciones hoy</div>;

    const groupedByType = exceptionsData.reduce((acc, curr) => {
      acc[curr.exceptionType] = (acc[curr.exceptionType] || 0) + curr.totalPersons;
      return acc;
    }, {} as Record<string, number>);

    const seriesData = Object.entries(groupedByType).map(([type, count]) => ({
      name: type === "vacation" ? "Vacaciones" : type === "medical_leave" ? "Licencias Médicas" : "Otros ausentismos",
      value: count
    }));

    const options = {
      tooltip: { trigger: "item", backgroundColor: isDark ? "#1E293B" : "#FFFFFF", textStyle: { color: textColor } },
      legend: { top: "5%", left: "center", textStyle: { color: textColor } },
      series: [
        {
          name: "Excepciones",
          type: "pie",
          radius: ["40%", "70%"],
          itemStyle: {
            borderRadius: 10,
            borderColor: isDark ? "#0F172A" : "#FFFFFF",
            borderWidth: 2
          },
          data: seriesData
        }
      ]
    };

    return <ReactECharts option={options} style={{ height: "300px", width: "100%" }} />;
  };

  return (
    <div className="bi-chart-row">
      <div className="bi-chart-container">
        <h3 className="bi-chart-title">Presencia General Hoy</h3>
        {renderGauge()}
      </div>
      <div className="bi-chart-container">
        <h3 className="bi-chart-title">Composición de Ausentismo Hoy</h3>
        {renderExceptionsDonut()}
      </div>
    </div>
  );
}
