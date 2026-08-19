import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { useBiHeadcountByManagement, useBiHeadcountByRegion } from "../hooks/useBiQueries";
import { EChartSurface, useChartTheme } from "../../../shared/ui";
import type { BiFilters } from "../types";

type BiHeadcountChartsProps = {
  filters?: BiFilters;
};

export function BiHeadcountCharts({ filters }: BiHeadcountChartsProps) {
  const { data: managementData, isLoading: isLoadingManagement } = useBiHeadcountByManagement(filters);
  const { data: regionData, isLoading: isLoadingRegion } = useBiHeadcountByRegion(filters);
  const [isChileMapReady, setIsChileMapReady] = useState(false);
  const chartTheme = useChartTheme();

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    void import("../../../shared/ui/charts/echartsRuntime")
      .then(({ echarts }) => {
        if (echarts.getMap("chile")) {
          if (isMounted) setIsChileMapReady(true);
          return null;
        }

        return fetch("/maps/chile.json", { cache: "force-cache", signal: controller.signal })
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

            if (isMounted) setIsChileMapReady(true);
          });
      })
      .catch((error: unknown) => {
        if (isMounted && !(error instanceof DOMException && error.name === "AbortError")) {
          setIsChileMapReady(false);
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const managementChartOption = useMemo<EChartsOption | null>(() => {
    if (!managementData || managementData.length === 0) {
      return null;
    }

    // El backend ya entrega una fila por gerencia. Orden ascendente para que
    // la mayor dotación quede arriba al usar un eje categórico invertido.
    const rows = [...managementData].sort((left, right) => left.headcount - right.headcount);

    return {
      // Reservamos el espacio a la izquierda para las etiquetas completas y
      // acercamos el eje al borde útil del card, evitando el gran vacío lateral.
      grid: { left: 12, right: 32, top: 14, bottom: 20, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: chartTheme.tooltipSurface,
        textStyle: { color: chartTheme.tooltipText },
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params;
          const name = typeof item === "object" && item && "name" in item ? String(item.name) : "Gerencia";
          const value = typeof item === "object" && item && "value" in item ? Number(item.value) : 0;
          return `${name}<br/>Dotación: ${value}`;
        }
      },
      xAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: chartTheme.textMuted },
        splitLine: { lineStyle: { color: chartTheme.border } }
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: rows.map((item) => item.managementName),
        axisLabel: {
          color: chartTheme.text,
          width: 420,
          overflow: "break",
          align: "right",
          lineHeight: 17
        },
        axisLine: { lineStyle: { color: chartTheme.border } },
        axisTick: { show: false }
      },
      series: [
        {
          name: "Dotación",
          type: "bar",
          barMaxWidth: 22,
          itemStyle: { color: chartTheme.primary, borderRadius: [0, 6, 6, 0] },
          label: { show: true, position: "right", color: chartTheme.text, fontWeight: 600 },
          data: rows.map((item) => item.headcount)
        }
      ]
    };
  }, [chartTheme, managementData]);

  const mapChartOption = useMemo<EChartsOption | null>(() => {
    if (!isChileMapReady || !regionData || regionData.length === 0) {
      return null;
    }

    // La RPC ya agrupa y canoniza la región según los nombres del GeoJSON.
    // Nunca usamos la ciudad como sustituto: eso produciría una región falsa.
    const rows = regionData.filter((item) => item.regionName !== "SIN REGION");
    if (rows.length === 0) return null;

    const maxHeadcount = Math.max(...rows.map((item) => item.headcount), 10);

    return {
      tooltip: {
        trigger: "item",
        backgroundColor: chartTheme.tooltipSurface,
        textStyle: { color: chartTheme.tooltipText },
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params;
          const name = typeof item === "object" && item && "name" in item
            ? String(item.name)
            : "Región";
          const rawValue = typeof item === "object" && item && "value" in item
            ? item.value
            : null;
          const numericValue = Number(rawValue);
          const value = Number.isFinite(numericValue)
            ? numericValue.toLocaleString("es-CL")
            : "Sin dato";
          return `${name}<br/>Dotación: ${value}`;
        }
      },
      visualMap: {
        min: 0,
        max: maxHeadcount,
        text: ["Alta", "Baja"],
        realtime: false,
        calculable: false,
        inRange: {
          color: ["#eff6ff", "#93c5fd", "#2563eb", "#1e3a8a", "#0f172a"]
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
            label: { show: true, color: chartTheme.text },
            itemStyle: {
              borderColor: chartTheme.text,
              borderWidth: 1.5,
              shadowBlur: 8,
              shadowColor: "rgba(15, 23, 42, 0.3)"
            }
          },
          data: rows.map((item) => ({ name: item.regionName, value: item.headcount }))
        }
      ]
    };
  }, [chartTheme, isChileMapReady, regionData]);

  return (
    <div className="bi-chart-row">
      <div className="info-card">
        <h3 className="bi-chart-title">Dotación por Gerencia</h3>
        <EChartSurface
          height={300}
          option={managementChartOption ?? {}}
          loading={isLoadingManagement}
          empty={!managementChartOption}
          emptyMessage="Sin datos de gerencia"
          loadingMessage="Cargando datos..."
        />
      </div>
      <div className="info-card">
        <h3 className="bi-chart-title">Dotación por Región</h3>
        <EChartSurface
          height={300}
          option={mapChartOption ?? {}}
          loading={isLoadingRegion || !isChileMapReady}
          empty={!mapChartOption}
          emptyMessage="Sin datos de región"
          loadingMessage="Cargando mapa..."
        />
      </div>
    </div>
  );
}
