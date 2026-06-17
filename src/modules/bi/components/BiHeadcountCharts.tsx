import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiHeadcountByContract, useBiHeadcountByCity } from "../hooks/useBiQueries";
import { useTheme } from "../../../shared/context/ThemeContext";
import { EChartSurface } from "../../../shared/ui";
import type { BiFilters } from "../types";

type BiHeadcountChartsProps = {
  filters?: BiFilters;
};

export function BiHeadcountCharts({ filters }: BiHeadcountChartsProps) {
  const { data: contractData, isLoading: isLoadingContract } = useBiHeadcountByContract(filters);
  const { data: cityData, isLoading: isLoadingCity } = useBiHeadcountByCity(filters);
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const textColor = isDark ? "#E2E8F0" : "#1E293B";

  const contractChartOption = useMemo<EChartsOption | null>(() => {
    if (!contractData || contractData.length === 0) {
      return null;
    }

    const totalsByContract = new Map<string, number>();

    contractData.forEach((item) => {
      totalsByContract.set(item.contractCode, (totalsByContract.get(item.contractCode) ?? 0) + item.headcount);
    });

    return {
      tooltip: { trigger: "item", backgroundColor: isDark ? "#1E293B" : "#FFFFFF", textStyle: { color: textColor } },
      series: [
        {
          name: "Dotación",
          type: "pie",
          radius: ["20%", "80%"],
          center: ["50%", "50%"],
          roseType: "area",
          itemStyle: {
            borderRadius: 8
          },
          label: { show: false },
          labelLine: { show: false },
          data: [...totalsByContract.entries()].map(([contractCode, headcount]) => ({
            value: headcount,
            name: contractCode
          }))
        }
      ]
    };
  }, [contractData, isDark, textColor]);

  const mapChartOption = useMemo<EChartsOption | null>(() => {
    if (!cityData || cityData.length === 0) {
      return null;
    }

    const topCities = [...cityData]
      .sort((left, right) => right.headcount - left.headcount)
      .slice(0, 10)
      .reverse();

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
        textStyle: { color: textColor }
      },
      grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: isDark ? "#334155" : "#E2E8F0" } },
        axisLabel: { color: textColor }
      },
      yAxis: {
        type: "category",
        data: topCities.map((item) =>
          item.regionName && item.regionName !== item.cityName
            ? `${item.cityName} (${item.regionName})`
            : item.cityName
        ),
        axisLabel: { color: textColor }
      },
      series: [
        {
          name: "Dotación",
          type: "bar",
          data: topCities.map((item) => item.headcount),
          itemStyle: {
            borderRadius: [8, 8, 8, 8],
            color: "#2563EB"
          },
          label: {
            show: true,
            position: "right",
            color: textColor
          }
        }
      ]
    };
  }, [cityData, isDark, textColor]);

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
        <h3 className="bi-chart-title">Dotación por Ciudad</h3>
        <EChartSurface
          height={300}
          option={mapChartOption ?? {}}
          loading={isLoadingCity}
          empty={!mapChartOption}
          emptyMessage="Sin datos de ciudad"
          loadingMessage="Cargando ciudades..."
        />
      </div>
    </div>
  );
}
