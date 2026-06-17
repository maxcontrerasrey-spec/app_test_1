import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiHeadcountByContract, useBiHeadcountByJobTitle } from "../hooks/useBiQueries";
import { useTheme } from "../../../shared/context/ThemeContext";
import { EChartSurface } from "../../../shared/ui";

export function BiHeadcountCharts() {
  const { data: contractData, isLoading: isLoadingContract } = useBiHeadcountByContract();
  const { data: jobData, isLoading: isLoadingJob } = useBiHeadcountByJobTitle();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const textColor = isDark ? "#E2E8F0" : "#1E293B";

  const contractChartOption = useMemo<EChartsOption | null>(() => {
    if (!contractData || contractData.length === 0) {
      return null;
    }

    return {
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
  }, [contractData, isDark, textColor]);

  const jobChartOption = useMemo<EChartsOption | null>(() => {
    if (!jobData || jobData.length === 0) {
      return null;
    }

    const topJobs = [...jobData].sort((a, b) => b.headcount - a.headcount).slice(0, 10);

    return {
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
  }, [isDark, jobData, textColor]);

  return (
    <div className="bi-chart-row">
      <div className="info-card">
        <h3 className="bi-chart-title">Dotación por Contrato</h3>
        <EChartSurface
          height={300}
          option={contractChartOption ?? {}}
          loading={isLoadingContract}
          empty={!contractChartOption}
          emptyMessage="Sin datos de contrato"
          loadingMessage="Cargando datos..."
        />
      </div>
      <div className="info-card">
        <h3 className="bi-chart-title">Top 10 Cargos</h3>
        <EChartSurface
          height={300}
          option={jobChartOption ?? {}}
          loading={isLoadingJob}
          empty={!jobChartOption}
          emptyMessage="Sin datos de cargo"
          loadingMessage="Cargando datos..."
        />
      </div>
    </div>
  );
}
