import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiRecruitmentPipeline } from "../hooks/useBiQueries";
import { EChartSurface, useChartTheme } from "../../../shared/ui";
import {
  CANDIDATE_STAGE_ORDER_INDEX,
  CANDIDATE_STAGE_OPTIONAL_BRANCHES
} from "../lib/recruitmentAnalyticsChartConfig";
import { formatMetricValue, formatPercentValue, mapPipelineStageLabel, PIPELINE_TERMINAL_STAGES, WORKFORCE_PALETTE } from "../lib/workforceChartConfig";
import type { BiFilters } from "../types";

type BiCandidatesByStageChartProps = {
  filters?: BiFilters;
};

/**
 * Reemplaza al antiguo "Embudo de Reclutamiento": ese componente agrupaba
 * por codigos de etapa inventados ("applied"/"interviewed"/"offered") que
 * nunca coinciden con los stage_code reales de
 * `recruitment_case_candidates` (lead/who_pending/.../ready_for_hire), asi
 * que el 100% de los candidatos caia en el bucket por defecto. Aqui se usa
 * el stage_code real, se excluyen los estados terminales (hired/
 * rejected/withdrawn, que no son "pipeline en curso") y se mantiene el
 * orden operacional real -- no es un funnel estricto porque
 * "Levantamiento de Contraindicación" es una rama opcional.
 */
export function BiCandidatesByStageChart({ filters }: BiCandidatesByStageChartProps) {
  const { data, isLoading, isError } = useBiRecruitmentPipeline(filters);
  const chartTheme = useChartTheme();
  const palette = WORKFORCE_PALETTE[chartTheme.mode];

  const rows = useMemo(() => {
    if (!data || data.length === 0) return [];

    const totals = new Map<string, number>();
    data.forEach((item) => {
      if (PIPELINE_TERMINAL_STAGES.has(item.stageCode)) return;
      const label = mapPipelineStageLabel(item.stageCode);
      totals.set(label, (totals.get(label) ?? 0) + item.candidateCount);
    });

    const totalInPipeline = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);

    return Array.from(totals.entries())
      .map(([label, value]) => ({
        label,
        value,
        pct: totalInPipeline > 0 ? (value / totalInPipeline) * 100 : 0,
        isOptionalBranch: CANDIDATE_STAGE_OPTIONAL_BRANCHES.has(label)
      }))
      .sort((left, right) => {
        const leftIndex = CANDIDATE_STAGE_ORDER_INDEX.get(left.label) ?? Number.MAX_SAFE_INTEGER;
        const rightIndex = CANDIDATE_STAGE_ORDER_INDEX.get(right.label) ?? Number.MAX_SAFE_INTEGER;
        if (leftIndex !== rightIndex) return leftIndex - rightIndex;
        return left.label.localeCompare(right.label, "es-CL");
      });
  }, [data]);

  const chartOption = useMemo<EChartsOption | null>(() => {
    if (rows.length === 0) return null;

    // Se invierte para que la primera etapa del pipeline (Lead) quede
    // arriba, siguiendo el orden operacional real, no por cantidad.
    const ordered = [...rows].reverse();

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: chartTheme.tooltipSurface,
        textStyle: { color: chartTheme.tooltipText },
        formatter: (raw: unknown) => {
          const point = Array.isArray(raw) ? raw[0] : raw;
          const dataIndex = typeof point?.dataIndex === "number" ? point.dataIndex : 0;
          const row = ordered[dataIndex];
          if (!row) return "";
          const note = row.isOptionalBranch
            ? '<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Nota</span><strong>Etapa opcional</strong></div>'
            : "";
          return `<div class="chart-tooltip"><div class="chart-tooltip-title">${row.label}</div><div class="chart-tooltip-list"><div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Candidatos</span><strong>${formatMetricValue(row.value)}</strong></div><div class="chart-tooltip-item"><span class="chart-tooltip-item-label">% del pipeline</span><strong>${formatPercentValue(row.pct)}</strong></div>${note}</div></div>`;
        }
      },
      grid: { top: 8, right: 24, bottom: 8, left: 12, containLabel: true },
      xAxis: {
        type: "value",
        axisLabel: { color: chartTheme.text },
        splitLine: { lineStyle: { color: chartTheme.border } }
      },
      yAxis: {
        type: "category",
        data: ordered.map((row) => row.label),
        axisLabel: { color: chartTheme.text, width: 170, overflow: "truncate" },
        axisLine: { lineStyle: { color: chartTheme.border } }
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 22,
          data: ordered.map((row) => ({
            value: row.value,
            itemStyle: { color: palette.volume, opacity: row.isOptionalBranch ? 0.7 : 1, borderRadius: [0, 6, 6, 0] }
          }))
        }
      ]
    };
  }, [chartTheme, palette.volume, rows]);

  return (
    <div className="info-card">
      <h3 className="bi-chart-title">Candidatos por Etapa</h3>
      <EChartSurface
        height={320}
        option={chartOption ?? {}}
        loading={isLoading}
        empty={!isLoading && (isError || !chartOption)}
        emptyMessage={isError ? "No se pudo cargar el pipeline de candidatos." : "No hay candidatos en pipeline para los filtros seleccionados."}
        loadingMessage="Cargando datos..."
      />
    </div>
  );
}
