import ReactECharts from "echarts-for-react";
import { useBiRecruitmentPipeline } from "../hooks/useBiQueries";
import { useTheme } from "../../../shared/context/ThemeContext";

export function BiRecruitmentFunnel() {
  const { data, isLoading } = useBiRecruitmentPipeline();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const textColor = isDark ? "#E2E8F0" : "#1E293B";

  const renderChart = () => {
    if (isLoading) return <div className="bi-loading-state">Cargando datos...</div>;
    if (!data || data.length === 0) return <div className="bi-empty-state">Sin datos de reclutamiento</div>;

    // Agrupar todos los contratos para un Funnel general
    const stageCounts: Record<string, number> = {
      applied: 0,
      interviewed: 0,
      offered: 0,
      hired: 0
    };

    data.forEach((d) => {
      if (stageCounts[d.stageCode] !== undefined) {
        stageCounts[d.stageCode] += d.candidateCount;
      } else {
        stageCounts.applied += d.candidateCount; // Default fallback
      }
    });

    const funnelData = [
      { value: stageCounts.applied || 0, name: "Aplicantes" },
      { value: stageCounts.interviewed || 0, name: "Entrevistados" },
      { value: stageCounts.offered || 0, name: "Ofertados" },
      { value: stageCounts.hired || 0, name: "Contratados" }
    ].sort((a, b) => b.value - a.value); // Funnel typically needs descending order

    const options = {
      tooltip: { trigger: "item", formatter: "{a} <br/>{b} : {c}", backgroundColor: isDark ? "#1E293B" : "#FFFFFF", textStyle: { color: textColor } },
      legend: { data: ["Aplicantes", "Entrevistados", "Ofertados", "Contratados"], textStyle: { color: textColor } },
      series: [
        {
          name: "Pipeline",
          type: "funnel",
          left: "10%",
          width: "80%",
          maxSize: "100%",
          sort: "descending",
          gap: 2,
          label: { show: true, position: "inside" },
          labelLine: { length: 10, lineStyle: { width: 1, type: "solid" } },
          itemStyle: { borderColor: "#fff", borderWidth: 1 },
          emphasis: { label: { fontSize: 20 } },
          data: funnelData
        }
      ]
    };

    return <ReactECharts option={options} style={{ height: "300px", width: "100%" }} />;
  };

  return (
    <div className="info-card">
      <h3 className="bi-chart-title">Embudo de Reclutamiento (General)</h3>
      {renderChart()}
    </div>
  );
}
