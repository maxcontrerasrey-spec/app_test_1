import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChartSurface } from "../../../shared/ui";

type ChartClickParams = {
  data?: unknown;
};

type TooltipParam = {
  name?: string;
  value?: unknown;
  percent?: number;
};

const weeklySeries = {
  labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
  folios: [14, 18, 17, 22],
  mobilities: [2, 3, 4, 5],
  approvals: [11, 15, 14, 19]
};

const monthlySeries = {
  labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun"],
  folios: [42, 37, 48, 54, 51, 59],
  mobilities: [8, 7, 10, 12, 11, 14],
  approvals: [35, 32, 41, 45, 46, 52]
};

const statusDistribution = [
  { value: 21, name: "Activos" },
  { value: 9, name: "Listos" },
  { value: 6, name: "Movilidad" },
  { value: 4, name: "Cerrados" }
];

export function EChartsShowcase() {
  const [range, setRange] = useState<"weekly" | "monthly">("weekly");
  const [selectedPoint, setSelectedPoint] = useState("Haz clic en una barra o línea para inspeccionar el dato.");

  const trendRows = useMemo(() => {
    const source = range === "weekly" ? weeklySeries : monthlySeries;

    return source.labels.map((label, index) => ({
      periodLabel: label,
      folios: source.folios[index],
      approvals: source.approvals[index],
      mobilities: source.mobilities[index]
    }));
  }, [range]);

  const trendOption = useMemo<EChartsOption>(() => ({
    grid: { top: 34, right: 20, bottom: 34, left: 42 },
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, icon: "circle" },
    xAxis: {
      type: "category",
      data: trendRows.map((item) => item.periodLabel),
      axisTick: { show: false },
      axisLine: { show: false }
    },
    yAxis: {
      type: "value",
      axisTick: { show: false },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.28)", type: "dashed" } }
    },
    series: [
      {
        type: "bar",
        name: "Folios abiertos",
        data: trendRows.map((item) => ({ value: item.folios, ...item })),
        itemStyle: { borderRadius: [8, 8, 0, 0] }
      },
      {
        type: "line",
        name: "Aprobaciones",
        data: trendRows.map((item) => ({ value: item.approvals, ...item })),
        smooth: true,
        symbolSize: 8
      },
      {
        type: "line",
        name: "Movilidades",
        data: trendRows.map((item) => ({ value: item.mobilities, ...item })),
        smooth: true,
        symbolSize: 8
      }
    ]
  }), [trendRows]);

  const statusOption = useMemo<EChartsOption>(() => ({
    tooltip: {
      trigger: "item",
      formatter: (params: unknown) => {
        const item = params as TooltipParam;
        return `${item.name ?? "Estado"}<br/><strong>${item.value ?? 0} casos</strong> · ${item.percent ?? 0}%`;
      }
    },
    legend: { bottom: 0, icon: "circle" },
    series: [
      {
        type: "pie",
        name: "Estados",
        radius: ["46%", "72%"],
        center: ["50%", "46%"],
        padAngle: 2,
        data: statusDistribution,
        label: { formatter: "{b}" }
      }
    ]
  }), []);

  return (
    <div className="playground-grid labs-chart-grid">
      <div className="ink-card">
        <div className="labs-chart-toolbar">
          <div>
            <h3 className="labs-chart-card-title">Apache ECharts integrado</h3>
            <p className="ink-text labs-chart-caption">
              Motor Canvas encapsulado en la capa compartida del ERP, con carga diferida y opciones completas.
            </p>
          </div>
          <div className="labs-chart-actions">
            <button
              type="button"
              className={`ink-button ${range === "weekly" ? "" : "secondary"}`.trim()}
              onClick={() => setRange("weekly")}
            >
              Semanal
            </button>
            <button
              type="button"
              className={`ink-button ${range === "monthly" ? "" : "secondary"}`.trim()}
              onClick={() => setRange("monthly")}
            >
              Mensual
            </button>
          </div>
        </div>

        <EChartSurface
          height={340}
          option={trendOption}
          onEvents={{
            click: (params: ChartClickParams) => {
              const data = params.data as { periodLabel?: string; folios?: number; approvals?: number; mobilities?: number } | undefined;
              if (!data) return;

              setSelectedPoint(
                `${data.periodLabel ?? "Periodo"} · Folios ${data.folios ?? "—"} · Aprobaciones ${data.approvals ?? "—"} · Movilidades ${data.mobilities ?? "—"}`
              );
            }
          }}
        />

        <p className="ink-text labs-chart-caption labs-chart-feedback">{selectedPoint}</p>
      </div>

      <div className="ink-card">
        <h3 className="labs-chart-card-title">Interacción y lectura</h3>
        <p className="ink-text labs-chart-caption">
          El gráfico mantiene leyenda, tooltip y jerarquía visual usando el mismo wrapper compartido de producción.
        </p>
        <EChartSurface height={340} option={statusOption} />
      </div>
    </div>
  );
}
