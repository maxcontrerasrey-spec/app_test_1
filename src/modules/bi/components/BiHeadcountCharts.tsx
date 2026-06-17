import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import * as echarts from "echarts";
import { useBiHeadcountByContract, useBiHeadcountByCity } from "../hooks/useBiQueries";
import { useTheme } from "../../../shared/context/ThemeContext";
import { EChartSurface } from "../../../shared/ui";
import type { BiFilters } from "../types";
import chileGeoJson from "../../../shared/assets/maps/chile.json";

echarts.registerMap("chile", chileGeoJson as any);

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

    // Agrupar por regionName en un intento de match con el GeoJSON
    const totalsByRegion = new Map<string, number>();
    cityData.forEach((item) => {
      const region = item.regionName || item.cityName;
      let normalizedRegion = region;
      // Normalización simple para que haga match con el mapa de 'fcortes/Chile-GeoJSON'
      if (!region.startsWith("Región")) {
        if (region.includes("Metropolitana")) normalizedRegion = "Región Metropolitana de Santiago";
        else if (region.includes("O'Higgins")) normalizedRegion = "Región del Libertador General Bernardo O'Higgins";
        else if (region.includes("Aysén")) normalizedRegion = "Región de Aysén del General Carlos Ibáñez del Campo";
        else if (region.includes("Magallanes")) normalizedRegion = "Región de Magallanes y de la Antártica Chilena";
        else normalizedRegion = `Región de ${region}`;
      }
      totalsByRegion.set(normalizedRegion, (totalsByRegion.get(normalizedRegion) ?? 0) + item.headcount);
    });

    const maxHeadcount = Math.max(...totalsByRegion.values(), 10);

    return {
      tooltip: {
        trigger: "item",
        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
        textStyle: { color: textColor },
        formatter: "{b}<br/>Dotación: {c}"
      },
      visualMap: {
        min: 0,
        max: maxHeadcount,
        text: ["High", "Low"],
        realtime: false,
        calculable: true,
        inRange: {
          color: ["#E0F2FE", "#3B82F6", "#1E3A8A"]
        },
        textStyle: { color: textColor }
      },
      series: [
        {
          name: "Dotación",
          type: "map",
          map: "chile",
          roam: true,
          label: {
            show: false
          },
          emphasis: {
            label: { show: true, color: textColor }
          },
          data: [...totalsByRegion.entries()].map(([name, value]) => ({ name, value }))
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
