import { useMemo, useState } from "react";
import type { BarSeriesOption, LineSeriesOption, PieSeriesOption } from "echarts/charts";
import type {
  DatasetComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TitleComponentOption,
  ToolboxComponentOption,
  TooltipComponentOption
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import { EChart } from "../../../shared/ui";

type ShowcaseOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | PieSeriesOption
  | DatasetComponentOption
  | GridComponentOption
  | LegendComponentOption
  | TitleComponentOption
  | ToolboxComponentOption
  | TooltipComponentOption
>;

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

  const trendData = range === "weekly" ? weeklySeries : monthlySeries;

  const trendOption = useMemo<ShowcaseOption>(
    () => ({
      title: {
        text: "Carga operacional del pipeline",
        subtext: range === "weekly" ? "Vista semanal" : "Vista mensual"
      },
      tooltip: {
        trigger: "axis"
      },
      legend: {
        top: 4
      },
      toolbox: {
        right: 8,
        feature: {
          saveAsImage: { title: "Exportar" },
          dataZoom: { title: { zoom: "Acercar", back: "Restablecer" } },
          restore: { title: "Restaurar" }
        }
      },
      grid: {
        left: 24,
        right: 24,
        top: 72,
        bottom: 28,
        containLabel: true
      },
      xAxis: {
        type: "category",
        data: trendData.labels
      },
      yAxis: {
        type: "value",
        name: "Casos"
      },
      series: [
        {
          name: "Folios abiertos",
          type: "bar",
          barMaxWidth: 28,
          emphasis: { focus: "series" },
          data: trendData.folios
        },
        {
          name: "Aprobaciones",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 9,
          emphasis: { focus: "series" },
          data: trendData.approvals
        },
        {
          name: "Movilidades",
          type: "line",
          smooth: true,
          symbol: "diamond",
          symbolSize: 8,
          emphasis: { focus: "series" },
          data: trendData.mobilities
        }
      ]
    }),
    [range, trendData]
  );

  const distributionOption = useMemo<ShowcaseOption>(
    () => ({
      title: {
        text: "Distribución operativa",
        subtext: "Estados agregados del tablero"
      },
      tooltip: {
        trigger: "item"
      },
      legend: {
        bottom: 0
      },
      series: [
        {
          name: "Estado",
          type: "pie",
          radius: ["44%", "72%"],
          center: ["50%", "48%"],
          avoidLabelOverlap: true,
          label: {
            formatter: "{b}\n{c}"
          },
          emphasis: {
            scale: true,
            scaleSize: 8
          },
          data: statusDistribution
        }
      ]
    }),
    []
  );

  return (
    <div className="playground-grid labs-chart-grid">
      <div className="ink-card">
        <div className="labs-chart-toolbar">
          <div>
            <h3 className="labs-chart-card-title">Apache ECharts integrado</h3>
            <p className="ink-text labs-chart-caption">
              Registro modular, responsive, listo para line, bar, pie, heatmap, gauge y más.
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

        <EChart
          option={trendOption}
          height={340}
          onEvents={{
            click: (params) => {
              const payload = params as { seriesName?: string; name?: string; value?: number | string };
              setSelectedPoint(
                `${payload.seriesName ?? "Serie"} · ${payload.name ?? "Punto"}: ${payload.value ?? "—"}`
              );
            }
          }}
        />

        <p className="ink-text labs-chart-caption labs-chart-feedback">
          {selectedPoint}
        </p>
      </div>

      <div className="ink-card">
        <h3 className="labs-chart-card-title">Interacción y exportación</h3>
        <p className="ink-text labs-chart-caption">
          El gráfico mantiene tooltip, legend, zoom, exportación y cambio de tema sin wrapper externo.
        </p>
        <EChart option={distributionOption} height={340} renderer="svg" />
      </div>
    </div>
  );
}
