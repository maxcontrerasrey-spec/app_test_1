import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiRecruitmentPipeline } from "../hooks/useBiQueries";
import { EChartSurface, useChartTheme } from "../../../shared/ui";
import type { BiFilters } from "../types";

type BiRecruitmentFunnelProps = {
  filters?: BiFilters;
};

export function BiRecruitmentFunnel({ filters }: BiRecruitmentFunnelProps) {
  const { data, isLoading } = useBiRecruitmentPipeline(filters);
  const chartTheme = useChartTheme();

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
      tooltip: { trigger: "item", formatter: "{a} <br/>{b} : {c}", backgroundColor: chartTheme.tooltipSurface, textStyle: { color: chartTheme.tooltipText } },
      legend: { data: ["Aplicantes", "Entrevistados", "Ofertados", "Contratados"], textStyle: { color: chartTheme.text } },
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
          itemStyle: { borderColor: chartTheme.surface, borderWidth: 1 },
          emphasis: { label: { fontSize: 20 } },
          data: funnelData
        }
      ]
    };
  }, [chartTheme, data]);

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
