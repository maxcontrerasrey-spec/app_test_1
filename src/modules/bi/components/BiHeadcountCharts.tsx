import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiHeadcountByManagement, useBiHeadcountByRegion } from "../hooks/useBiQueries";
import { EChartSurface, useChartTheme } from "../../../shared/ui";
import type { BiFilters } from "../types";

const CHILE_REGION_ORDER = [
  "Región de Arica y Parinacota", "Región de Tarapacá", "Región de Antofagasta",
  "Región de Atacama", "Región de Coquimbo", "Región de Valparaíso",
  "Región Metropolitana de Santiago", "Región del Libertador Bernardo O'Higgins",
  "Región del Maule", "Región de Ñuble", "Región del Bío-Bío",
  "Región de La Araucanía", "Región de Los Ríos", "Región de Los Lagos",
  "Región de Aysén del Gral.Ibañez del Campo", "Región de Magallanes y Antártica Chilena",
  "SIN REGION"
] as const;

const REGION_BAR_COLORS = ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8", "#172554"] as const;

type BiHeadcountChartsProps = { filters?: BiFilters };

export function BiHeadcountCharts({ filters }: BiHeadcountChartsProps) {
  const { data: managementData, isLoading: isLoadingManagement } = useBiHeadcountByManagement(filters);
  const { data: regionData, isLoading: isLoadingRegion } = useBiHeadcountByRegion(filters);
  const chartTheme = useChartTheme();

  const managementChartOption = useMemo<EChartsOption | null>(() => {
    if (!managementData || managementData.length === 0) return null;
    const rows = [...managementData].sort((left, right) => left.headcount - right.headcount);
    return {
      // La columna de etiquetas no debe comerse el ancho del gráfico:
      // reservamos solo lo necesario para nombres completos y dejamos que las
      // barras ocupen el resto del panel.
      grid: { left: 0, right: 10, top: 14, bottom: 20, containLabel: true },
      tooltip: {
        trigger: "axis", axisPointer: { type: "shadow" },
        backgroundColor: chartTheme.tooltipSurface, textStyle: { color: chartTheme.tooltipText },
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params;
          const name = typeof item === "object" && item && "name" in item ? String(item.name) : "Gerencia";
          const value = typeof item === "object" && item && "value" in item ? Number(item.value) : 0;
          return `${name}<br/>Dotación: ${value}`;
        }
      },
      xAxis: { type: "value", minInterval: 1, axisLabel: { color: chartTheme.textMuted }, splitLine: { lineStyle: { color: chartTheme.border } } },
      yAxis: {
        type: "category", inverse: true, data: rows.map((item) => item.managementName),
        axisLabel: { color: chartTheme.text, width: 300, overflow: "break", align: "right", lineHeight: 17 },
        axisLine: { lineStyle: { color: chartTheme.border } }, axisTick: { show: false }
      },
      series: [{
        name: "Dotación", type: "bar", barMaxWidth: 22,
        itemStyle: { color: chartTheme.primary, borderRadius: [0, 6, 6, 0] },
        label: { show: true, position: "right", color: chartTheme.text, fontWeight: 600 },
        data: rows.map((item) => item.headcount)
      }]
    };
  }, [chartTheme, managementData]);

  const regionChartOption = useMemo<EChartsOption | null>(() => {
    if (!regionData || regionData.length === 0) return null;
    // Orden geográfico norte-sur, manteniendo la lectura del mapa reemplazado.
    const rows = [...regionData]
      .filter((item) => item.regionName !== "SIN REGION" || item.headcount > 0)
      .sort((left, right) => {
        const leftIndex = CHILE_REGION_ORDER.indexOf(left.regionName as (typeof CHILE_REGION_ORDER)[number]);
        const rightIndex = CHILE_REGION_ORDER.indexOf(right.regionName as (typeof CHILE_REGION_ORDER)[number]);
        return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
      });
    if (rows.length === 0) return null;

    const totalHeadcount = rows.reduce((sum, item) => sum + item.headcount, 0);
    const maxHeadcount = Math.max(...rows.map((item) => item.headcount), 1);
    const formatPercentage = (headcount: number) => `${Math.round((headcount / Math.max(totalHeadcount, 1)) * 100)}%`;
    const colorForValue = (headcount: number) => {
      const ratio = headcount / maxHeadcount;
      const index = Math.min(REGION_BAR_COLORS.length - 1, Math.round(ratio * (REGION_BAR_COLORS.length - 1)));
      return REGION_BAR_COLORS[index];
    };

    return {
      grid: { left: 26, right: 18, top: 28, bottom: 92, containLabel: true },
      tooltip: {
        trigger: "axis", axisPointer: { type: "shadow" },
        backgroundColor: chartTheme.tooltipSurface, textStyle: { color: chartTheme.tooltipText },
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params;
          const name = typeof item === "object" && item && "name" in item ? String(item.name) : "Región";
          const rawValue = typeof item === "object" && item && "value" in item ? item.value : null;
          const numericValue = Number(rawValue);
          const value = Number.isFinite(numericValue) ? numericValue.toLocaleString("es-CL") : "Sin dato";
          return `${name}<br/>Dotación: ${value}`;
        }
      },
      xAxis: {
        type: "category",
        data: rows.map((item) => item.regionName === "SIN REGION" ? "Sin región" : item.regionName.replace(/^Región (de |del )?/, "")),
        axisLabel: { color: chartTheme.textMuted, rotate: 38, interval: 0, width: 92, overflow: "break", lineHeight: 14 },
        axisLine: { lineStyle: { color: chartTheme.border } }, axisTick: { show: false }
      },
      yAxis: { type: "value", min: 0, minInterval: 1, axisLabel: { color: chartTheme.textMuted }, splitLine: { lineStyle: { color: chartTheme.border } } },
      series: [{
        name: "Dotación", type: "bar", barMaxWidth: 38, barMinWidth: 12,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
        label: {
          show: true, position: "top", color: chartTheme.text, fontWeight: 600,
          formatter: (params) => formatPercentage(Number(params.value))
        },
        data: rows.map((item) => ({ name: item.regionName, value: item.headcount, itemStyle: { color: colorForValue(item.headcount) } }))
      }]
    };
  }, [chartTheme, regionData]);

  return (
    <div className="bi-chart-row">
      <div className="info-card">
        <h3 className="bi-chart-title">Dotación por Gerencia</h3>
        <EChartSurface height={300} option={managementChartOption ?? {}} loading={isLoadingManagement} empty={!managementChartOption} emptyMessage="Sin datos de gerencia" loadingMessage="Cargando datos..." />
      </div>
      <div className="info-card">
        <h3 className="bi-chart-title">Dotación por Región</h3>
        <EChartSurface height={360} option={regionChartOption ?? {}} loading={isLoadingRegion} empty={!regionChartOption} emptyMessage="Sin datos de región" loadingMessage="Cargando datos..." />
      </div>
    </div>
  );
}
