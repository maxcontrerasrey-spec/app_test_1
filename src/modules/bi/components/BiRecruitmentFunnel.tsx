import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiRecruitmentPipeline } from "../hooks/useBiQueries";
import { useTheme } from "../../../shared/context/ThemeContext";
import { EChartSurface } from "../../../shared/ui";

export function BiRecruitmentFunnel() {
  const { data, isLoading } = useBiRecruitmentPipeline();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const textColor = isDark ? "#E2E8F0" : "#1E293B";

  const chartOption = useMemo<EChartsOption | null>(() => {
    if (!data || data.length === 0) {
      return null;
    }

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
    ].sort((a, b) => b.value - a.value);

    return {
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
  }, [data, isDark, textColor]);

  return (
    <div className="info-card">
      <h3 className="bi-chart-title">Embudo de Reclutamiento (General)</h3>
      <EChartSurface
        height={300}
        option={chartOption ?? {}}
        loading={isLoading}
        empty={!chartOption}
        emptyMessage="Sin datos de reclutamiento"
        loadingMessage="Cargando datos..."
      />
    </div>
  );
}
