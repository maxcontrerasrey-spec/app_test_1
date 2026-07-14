import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { useBiHeadcountByContract, useBiHeadcountByCity } from "../hooks/useBiQueries";
import { formatBiContractLabel } from "../lib/presentation";
import { EChartSurface, useChartTheme } from "../../../shared/ui";
import type { BiFilters } from "../types";
import { echarts } from "../../../shared/ui/charts/echartsRuntime";

type BiHeadcountChartsProps = {
  filters?: BiFilters;
};

export function BiHeadcountCharts({ filters }: BiHeadcountChartsProps) {
  const { data: contractData, isLoading: isLoadingContract } = useBiHeadcountByContract(filters);
  const { data: cityData, isLoading: isLoadingCity } = useBiHeadcountByCity(filters);
  const [isChileMapReady, setIsChileMapReady] = useState(() => Boolean(echarts.getMap("chile")));
  const chartTheme = useChartTheme();

  useEffect(() => {
    let isMounted = true;

    if (echarts.getMap("chile")) {
      setIsChileMapReady(true);
      return () => {
        isMounted = false;
      };
    }

    void fetch("/maps/chile.json", { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`No fue posible cargar mapa de Chile (${response.status})`);
        }

        return response.json();
      })
      .then((geoJson) => {
        if (!echarts.getMap("chile")) {
          echarts.registerMap("chile", geoJson as never);
        }

        if (isMounted) {
          setIsChileMapReady(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsChileMapReady(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const contractChartOption = useMemo<EChartsOption | null>(() => {
    if (!contractData || contractData.length === 0) {
      return null;
    }

    const totalsByContract = new Map<string, { label: string; headcount: number }>();

    contractData.forEach((item) => {
      const contractKey = item.areaName || item.contractCode;
      const current = totalsByContract.get(contractKey);
      totalsByContract.set(contractKey, {
        label: formatBiContractLabel(item.areaName || item.contractCode),
        headcount: (current?.headcount ?? 0) + item.headcount
      });
    });

    return {
      tooltip: { trigger: "item", backgroundColor: chartTheme.tooltipSurface, textStyle: { color: chartTheme.tooltipText } },
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
          data: [...totalsByContract.values()].map((item) => ({
            value: item.headcount,
            name: item.label
          }))
        }
      ]
    };
  }, [chartTheme, contractData]);

  const mapChartOption = useMemo<EChartsOption | null>(() => {
    if (!isChileMapReady || !cityData || cityData.length === 0) {
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
        backgroundColor: chartTheme.tooltipSurface,
        textStyle: { color: chartTheme.tooltipText },
        formatter: "{b}<br/>Dotación: {c}"
      },
      visualMap: {
        min: 0,
        max: maxHeadcount,
        text: ["High", "Low"],
        realtime: false,
        calculable: true,
        inRange: {
          color: [chartTheme.info, chartTheme.primary, chartTheme.text]
        },
        textStyle: { color: chartTheme.text }
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
            label: { show: true, color: chartTheme.text }
          },
          data: [...totalsByRegion.entries()].map(([name, value]) => ({ name, value }))
        }
      ]
    };
  }, [chartTheme, cityData, isChileMapReady]);

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
          loading={isLoadingCity || !isChileMapReady}
          empty={!mapChartOption}
          emptyMessage="Sin datos de ciudad"
          loadingMessage="Cargando mapa..."
        />
      </div>
    </div>
  );
}
