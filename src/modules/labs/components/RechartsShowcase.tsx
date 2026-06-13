import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartSurface, ChartTooltip } from "../../../shared/ui";

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
  { value: 21, name: "Activos", color: "#2563eb" },
  { value: 9, name: "Listos", color: "#0f766e" },
  { value: 6, name: "Movilidad", color: "#d97706" },
  { value: 4, name: "Cerrados", color: "#7c3aed" }
];

export function RechartsShowcase() {
  const [range, setRange] = useState<"weekly" | "monthly">("weekly");
  const [selectedPoint, setSelectedPoint] = useState("Haz clic en una barra o línea para inspeccionar el dato.");

  const trendData = useMemo(() => {
    const source = range === "weekly" ? weeklySeries : monthlySeries;

    return source.labels.map((label, index) => ({
      label,
      folios: source.folios[index],
      approvals: source.approvals[index],
      mobilities: source.mobilities[index]
    }));
  }, [range]);

  return (
    <div className="playground-grid labs-chart-grid">
      <div className="ink-card">
        <div className="labs-chart-toolbar">
          <div>
            <h3 className="labs-chart-card-title">Recharts integrado</h3>
            <p className="ink-text labs-chart-caption">
              Capa compartida liviana, responsive y suficiente para líneas, barras y pie sin vendor gráfico extra.
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

        <ChartSurface height={340}>
          <ComposedChart data={trendData} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.28)" />
            <XAxis dataKey="label" stroke="var(--text-muted)" tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} />
            <Tooltip content={(props) => <ChartTooltip {...props} />} />
            <Legend />
            <Bar
              dataKey="folios"
              name="Folios abiertos"
              fill="#2563eb"
              radius={[8, 8, 0, 0]}
              onClick={(data) => {
                const payload = (data as { payload?: { label?: string; folios?: number; approvals?: number } }).payload;
                if (!payload) {
                  return;
                }

                setSelectedPoint(
                  `${payload.label ?? "Periodo"} · Folios ${payload.folios ?? "—"} · Aprobaciones ${payload.approvals ?? "—"}`
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="approvals"
              name="Aprobaciones"
              stroke="#0f766e"
              strokeWidth={3}
              dot={{ r: 4 }}
              onClick={(data) => {
                const payload = (data as { payload?: { label?: string; approvals?: number; mobilities?: number } }).payload;
                if (!payload) {
                  return;
                }

                setSelectedPoint(
                  `${payload.label ?? "Periodo"} · Aprobaciones ${payload.approvals ?? "—"} · Movilidades ${payload.mobilities ?? "—"}`
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="mobilities"
              name="Movilidades"
              stroke="#d97706"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </ComposedChart>
        </ChartSurface>

        <p className="ink-text labs-chart-caption labs-chart-feedback">{selectedPoint}</p>
      </div>

      <div className="ink-card">
        <h3 className="labs-chart-card-title">Interacción y lectura</h3>
        <p className="ink-text labs-chart-caption">
          El gráfico mantiene leyenda, tooltip y jerarquía visual con una librería más acotada al uso real del ERP.
        </p>
        <ChartSurface height={340}>
          <PieChart>
            <Pie
              data={statusDistribution}
              dataKey="value"
              nameKey="name"
              innerRadius={70}
              outerRadius={108}
              paddingAngle={2}
            >
              {statusDistribution.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={(props) => (
                <ChartTooltip {...props} chartValueFormatter={(value) => `${value ?? 0} casos`} />
              )}
            />
            <Legend />
          </PieChart>
        </ChartSurface>
      </div>
    </div>
  );
}
