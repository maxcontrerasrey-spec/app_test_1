import ReactECharts from "echarts-for-react";
import { useBiHeadcountByContract, useBiHeadcountByJobTitle } from "../hooks/useBiQueries";
import { useTheme } from "../../../shared/context/ThemeContext";

export function BiHeadcountCharts() {
  const { data: contractData, isLoading: isLoadingContract } = useBiHeadcountByContract();
  const { data: jobData, isLoading: isLoadingJob } = useBiHeadcountByJobTitle();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const textColor = isDark ? "#E2E8F0" : "#1E293B";

  const renderContractChart = () => {
    if (isLoadingContract) return <div className="bi-loading-state">Cargando datos...</div>;
    if (!contractData || contractData.length === 0) return <div className="bi-empty-state">Sin datos de contrato</div>;

    const options = {
      tooltip: { trigger: "item", backgroundColor: isDark ? "#1E293B" : "#FFFFFF", textStyle: { color: textColor } },
      legend: { top: "5%", left: "center", textStyle: { color: textColor } },
      series: [
        {
          name: "Dotación",
          type: "pie",
          radius: ["40%", "70%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: isDark ? "#0F172A" : "#FFFFFF",
            borderWidth: 2
          },
          label: { show: false, position: "center" },
          emphasis: {
            label: { show: true, fontSize: 18, fontWeight: "bold" }
          },
          labelLine: { show: false },
          data: contractData.map((d) => ({ value: d.headcount, name: d.contractCode }))
        }
      ]
    };

    return <ReactECharts option={options} style={{ height: "300px", width: "100%" }} />;
  };

  const renderJobChart = () => {
    if (isLoadingJob) return <div className="bi-loading-state">Cargando datos...</div>;
    if (!jobData || jobData.length === 0) return <div className="bi-empty-state">Sin datos de cargo</div>;

    const topJobs = [...jobData].sort((a, b) => b.headcount - a.headcount).slice(0, 10);

    const options = {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: isDark ? "#1E293B" : "#FFFFFF", textStyle: { color: textColor } },
      grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
      xAxis: { type: "value", splitLine: { lineStyle: { color: isDark ? "#334155" : "#E2E8F0" } } },
      yAxis: { type: "category", data: topJobs.map((d) => d.jobTitle).reverse(), axisLabel: { color: textColor, width: 120, overflow: "truncate" } },
      series: [
        {
          name: "Dotación",
          type: "bar",
          data: topJobs.map((d) => d.headcount).reverse(),
          itemStyle: {
            color: "#3B82F6",
            borderRadius: [0, 4, 4, 0]
          }
        }
      ]
    };

    return <ReactECharts option={options} style={{ height: "300px", width: "100%" }} />;
  };

  return (
    <div className="bi-chart-row">
      <div className="bi-chart-container">
        <h3 className="bi-chart-title">Dotación por Contrato</h3>
        {renderContractChart()}
      </div>
      <div className="bi-chart-container">
        <h3 className="bi-chart-title">Top 10 Cargos</h3>
        {renderJobChart()}
      </div>
    </div>
  );
}
