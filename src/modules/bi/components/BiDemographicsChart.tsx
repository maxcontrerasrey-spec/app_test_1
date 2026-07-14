import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiAgeDistribution, useBiHeadcountByContract } from "../hooks/useBiQueries";
import { formatBiContractLabel } from "../lib/presentation";
import { EChartSurface, useChartTheme } from "../../../shared/ui";
import type { BiFilters } from "../types";

type BiDemographicsChartProps = {
  filters?: BiFilters;
};

export function BiDemographicsChart({ filters }: BiDemographicsChartProps) {
  const { data, isLoading } = useBiAgeDistribution(filters);
  const { data: contractsData } = useBiHeadcountByContract(filters);
  const chartTheme = useChartTheme();

  const chartOption = useMemo<EChartsOption | null>(() => {
    if (!data || data.length === 0) {
      return null;
    }

    const ageRanges = ["< 20", "20–29", "30–39", "40–49", "50–59", "60+", "Desconocido"];
    const contracts = Array.from(new Set(data.map((d) => d.areaName || d.contractCode)));
    const lookup = new Map<string, number>();
    const contractLabels = new Map<string, string>();

    contractsData?.forEach((item) => {
      const contractKey = item.areaName || item.contractCode;
      if (!contractLabels.has(contractKey)) {
        contractLabels.set(contractKey, formatBiContractLabel(item.areaName || item.contractCode));
      }
    });

    data.forEach((item) => {
      const contractKey = item.areaName || item.contractCode;
      lookup.set(`${contractKey}:${item.ageRange}`, item.headcount);
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
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: chartTheme.tooltipSurface, textStyle: { color: chartTheme.tooltipText } },
      legend: { data: ageRanges, textStyle: { color: chartTheme.text } },
      grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
      xAxis: { type: "value", splitLine: { lineStyle: { color: chartTheme.border } } },
      yAxis: {
        type: "category",
        data: contracts.map((contractCode) => contractLabels.get(contractCode) ?? contractCode),
        axisLabel: { color: chartTheme.text }
      },
      series: seriesData
    };
  }, [chartTheme, contractsData, data]);

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
