import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
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
import { ChartSurface, ChartTooltip, SelectField, TextField } from "../../../shared/ui";
import { formatCurrencyValue } from "../../../shared/lib/format";
import { useHrIncentivesAnalytics } from "../hooks/useIncentivesQueries";

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function getStatusLabel(status: string) {
  switch (status) {
    case "P":
      return "Pendiente administrador contrato";
    case "E":
      return "Pendiente gerente de area";
    case "R":
      return "Rechazado";
    case "F":
      return "Aprobado";
    case "C":
      return "Anulado";
    case "A":
    default:
      return "Todos";
  }
}

function truncateLabel(value: string, maxLength: number = 14) {
  if (!value) return "";
  return value.length > maxLength ? value.substring(0, maxLength) + "…" : value;
}

export function IncentiveAnalyticsView() {
  const [periodCodeFilter, setPeriodCodeFilter] = useState("");
  const [contractCodeFilter, setContractCodeFilter] = useState("");
  const [typeIdFilter, setTypeIdFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("A");

  const analyticsQuery = useHrIncentivesAnalytics({
    periodCode: periodCodeFilter || undefined,
    contractCode: contractCodeFilter || undefined,
    typeId: typeIdFilter || undefined,
    status: statusFilter
  });

  const periodTrendData = useMemo(() => {
    return (analyticsQuery.data?.totalAmountByPeriod ?? []).map((item) => ({
      periodCode: item.periodCode,
      totalAmount: item.totalAmount
    }));
  }, [analyticsQuery.data?.totalAmountByPeriod]);

  const amountByTypeData = useMemo(() => {
    const palette = ["#2563eb", "#0f766e", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#65a30d", "#b45309"];

    return (analyticsQuery.data?.countByIncentiveType ?? []).map((item, index) => ({
      name: item.incentiveTypeName,
      value: item.totalAmount,
      color: palette[index % palette.length]
    }));
  }, [analyticsQuery.data?.countByIncentiveType]);

  const deviationsData = useMemo(() => {
    return (analyticsQuery.data?.deviationsByContract.slice(0, 8) ?? []).map((item) => ({
      contractCode: item.contractCode,
      contractLabel: item.areaName || item.contractCode,
      outOfDeadlineCount: Number(item.outOfDeadlineCount || 0),
      contractMismatchCount: Number(item.contractMismatchCount || 0)
    }));
  }, [analyticsQuery.data?.deviationsByContract]);

  const amountByDriverData = useMemo(() => {
    const rawData = analyticsQuery.data?.amountByDriver.slice(0, 8) ?? [];
    return rawData.map((item) => {
      const flatItem: any = {
        driverName: item.driverName || "Desconocido",
        totalAmount: item.totalAmount
      };
      item.contracts.forEach((c) => {
        flatItem[c.contractLabel] = c.amount;
      });
      return flatItem;
    });
  }, [analyticsQuery.data?.amountByDriver]);

  const uniqueDriverContracts = useMemo(() => {
    const contractsSet = new Set<string>();
    const rawData = analyticsQuery.data?.amountByDriver.slice(0, 8) ?? [];
    rawData.forEach(item => {
      item.contracts.forEach(c => {
        contractsSet.add(c.contractLabel);
      });
    });
    return Array.from(contractsSet);
  }, [analyticsQuery.data?.amountByDriver]);

  const cards = analyticsQuery.data?.summaryCards;
  const contractOptions = analyticsQuery.data?.filterOptions.contracts ?? [];
  const incentiveTypeOptions = analyticsQuery.data?.filterOptions.incentiveTypes ?? [];
  const statusOptions =
    analyticsQuery.data?.filterOptions.statuses ?? [
      { value: "A", label: "Todos" },
      { value: "P", label: getStatusLabel("P") },
      { value: "E", label: getStatusLabel("E") },
      { value: "R", label: getStatusLabel("R") },
      { value: "F", label: getStatusLabel("F") },
      { value: "C", label: getStatusLabel("C") }
    ];

  return (
    <section className="hr-incentives-analytics-layout">
      <div className="info-card">
        <div className="tracking-toolbar">
          <div className="tracking-toolbar-copy">
            <h3>Análisis de Incentivos</h3>
            <span className="tracking-filter-caption">
              Control gerencial del gasto, la aprobación y las desviaciones operacionales.
            </span>
          </div>
          <button
            type="button"
            className="soft-primary-button"
            onClick={() => {
              setPeriodCodeFilter("");
              setContractCodeFilter("");
              setTypeIdFilter("");
              setStatusFilter("A");
            }}
          >
            Limpiar filtros
          </button>
        </div>

        <div className="hr-incentives-analytics-filters">
          <TextField
            id="hr-incentive-analytics-period"
            label="Período"
            value={periodCodeFilter}
            onChange={(event) => setPeriodCodeFilter(event.target.value)}
            placeholder="YYYYMM"
            inputMode="numeric"
          />
          <SelectField
            id="hr-incentive-analytics-contract"
            label="Contrato"
            value={contractCodeFilter}
            onChange={(event) => setContractCodeFilter(event.target.value)}
            options={contractOptions}
            placeholder="Todos los contratos"
          />
          <SelectField
            id="hr-incentive-analytics-type"
            label="Tipo de incentivo"
            value={typeIdFilter}
            onChange={(event) => setTypeIdFilter(event.target.value)}
            options={incentiveTypeOptions}
            placeholder="Todos los tipos"
          />
          <SelectField
            id="hr-incentive-analytics-status"
            label="Estado"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={statusOptions}
          />
        </div>
      </div>

      {analyticsQuery.isError ? (
        <div className="info-card">
          <p className="form-status form-status-error">{analyticsQuery.error.message}</p>
        </div>
      ) : null}

      <div className="tracking-kpi-row hr-incentives-analytics-kpis">
        <article className="tracking-kpi-card tracking-kpi-card-generado">
          <span>Gasto total</span>
          <strong>{cards ? formatCurrencyValue(cards.totalAmount) : "—"}</strong>
        </article>
        <article className="tracking-kpi-card tracking-kpi-card-pendiente">
          <span>Solicitudes</span>
          <strong>{cards ? cards.requestCount.toLocaleString("es-CL") : "—"}</strong>
        </article>
        <article className="tracking-kpi-card tracking-kpi-card-en-proceso">
          <span>Tasa de aprobación</span>
          <strong>{cards ? formatPercent(cards.approvalRate) : "—"}</strong>
        </article>
        <article className="tracking-kpi-card tracking-kpi-card-error">
          <span>Tasa de rechazo</span>
          <strong>{cards ? formatPercent(cards.rejectionRate) : "—"}</strong>
        </article>
      </div>

      <div className="hr-incentives-analytics-grid">
        <article className="hr-incentives-analytics-card">
          <div className="hr-incentives-analytics-card-header">
            <h4>Evolución del gasto</h4>
            <span className="tracking-filter-caption">Monto agregado por período</span>
          </div>
          <ChartSurface
            height={280}
            loading={analyticsQuery.isLoading}
            empty={periodTrendData.length === 0}
            emptyMessage="No hay períodos para el filtro actual."
          >
            <ComposedChart data={periodTrendData} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="incentiveAmountFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.22)" />
              <XAxis
                dataKey="periodCode"
                stroke="var(--text-muted)"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 11, fontWeight: 500 }}
                tickMargin={12}
              />
              <YAxis
                stroke="var(--text-muted)"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 11, fontWeight: 500 }}
                tickMargin={12}
                tickFormatter={(value: number) => formatCompactCurrency(value)}
              />
              <Tooltip
                content={(props) => (
                  <ChartTooltip
                    {...props}
                    chartValueFormatter={(value) => formatCurrencyValue(Number(value ?? 0))}
                    chartLabelFormatter={(label) => `Período ${label}`}
                  />
                )}
              />
              <Legend 
                wrapperStyle={{ fontSize: "11.5px", fontWeight: 500, color: "var(--text-secondary)", paddingTop: "12px" }}
                iconType="circle"
                iconSize={8}
              />
              <Bar
                dataKey="totalAmount"
                name="Gasto total"
                fill="url(#incentiveAmountFill)"
                stroke="#2563eb"
                strokeWidth={2}
                radius={[10, 10, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="totalAmount"
                name="Tendencia"
                stroke="#0f172a"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ChartSurface>
        </article>

        <article className="hr-incentives-analytics-card">
          <div className="hr-incentives-analytics-card-header">
            <h4>Distribución por tipo</h4>
            <span className="tracking-filter-caption">Participación del presupuesto por incentivo</span>
          </div>
          <ChartSurface
            height={280}
            loading={analyticsQuery.isLoading}
            empty={amountByTypeData.length === 0}
            emptyMessage="No hay tipos de incentivo para el filtro actual."
          >
            <PieChart>
              <Pie
                data={amountByTypeData}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={94}
                paddingAngle={2}
              >
                {amountByTypeData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={(props) => (
                  <ChartTooltip
                    {...props}
                    chartValueFormatter={(value) => formatCurrencyValue(Number(value ?? 0))}
                  />
                )}
              />
              <Legend 
                wrapperStyle={{ fontSize: "11.5px", fontWeight: 500, color: "var(--text-secondary)", paddingTop: "16px" }}
                iconType="circle"
                iconSize={8}
              />
            </PieChart>
          </ChartSurface>
        </article>

        <article className="hr-incentives-analytics-card">
          <div className="hr-incentives-analytics-card-header">
            <h4>Top desviaciones por contrato</h4>
            <span className="tracking-filter-caption">
              Contratos con mayor concentración de fuera de plazo y contrato distinto
            </span>
          </div>
          <ChartSurface
            height={320}
            loading={analyticsQuery.isLoading}
            empty={deviationsData.length === 0}
            emptyMessage="No hay desviaciones para el filtro actual."
          >
            <BarChart
              data={deviationsData}
              layout="vertical"
              margin={{ top: 16, right: 16, bottom: 8, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.22)" />
              <XAxis 
                type="number" 
                stroke="var(--text-muted)" 
                tickLine={false} 
                axisLine={false} 
                allowDecimals={false} 
                tick={{ fill: "var(--text-muted)", fontSize: 11, fontWeight: 500 }}
                tickMargin={12}
              />
              <YAxis
                type="category"
                dataKey="contractLabel"
                width={96}
                stroke="var(--text-muted)"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 11, fontWeight: 500 }}
                tickMargin={12}
                tickFormatter={(value) => truncateLabel(value, 12)}
              />
              <Tooltip
                content={(props) => (
                  <ChartTooltip {...props} chartValueFormatter={(value) => `${value ?? 0} solicitudes`} />
                )}
              />
              <Legend 
                wrapperStyle={{ fontSize: "11.5px", fontWeight: 500, color: "var(--text-secondary)", paddingTop: "8px" }}
                iconType="circle"
                iconSize={8}
              />
              <Bar dataKey="outOfDeadlineCount" name="Fuera de plazo" stackId="deviations" fill="#ef4444" radius={[0, 6, 6, 0]} />
              <Bar
                dataKey="contractMismatchCount"
                name="Contrato distinto"
                stackId="deviations"
                fill="#57a6b2"
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ChartSurface>
        </article>

        <article className="hr-incentives-analytics-card">
          <div className="hr-incentives-analytics-card-header">
            <h4>Ranking de conductores</h4>
            <span className="tracking-filter-caption">
              Mayor monto ingresado, diferenciado por contrato
            </span>
          </div>
          <ChartSurface
            height={320}
            loading={analyticsQuery.isLoading}
            empty={amountByDriverData.length === 0}
            emptyMessage="No hay datos para el filtro actual."
          >
            <BarChart
              data={amountByDriverData}
              layout="vertical"
              margin={{ top: 16, right: 16, bottom: 8, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.22)" />
              <XAxis 
                type="number" 
                stroke="var(--text-muted)" 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: "var(--text-muted)", fontSize: 11, fontWeight: 500 }}
                tickMargin={12}
                tickFormatter={(value: number) => formatCompactCurrency(value)}
              />
              <YAxis
                type="category"
                dataKey="driverName"
                width={96}
                stroke="var(--text-muted)"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 11, fontWeight: 500 }}
                tickMargin={12}
                tickFormatter={(value) => truncateLabel(value, 12)}
              />
              <Tooltip
                content={(props) => (
                  <ChartTooltip 
                    {...props} 
                    chartValueFormatter={(value) => formatCurrencyValue(Number(value ?? 0))} 
                  />
                )}
              />
              <Legend 
                wrapperStyle={{ fontSize: "11.5px", fontWeight: 500, color: "var(--text-secondary)", paddingTop: "8px" }}
                iconType="circle"
                iconSize={8}
              />
              {uniqueDriverContracts.map((contractLabel, index) => (
                <Bar
                  key={contractLabel}
                  dataKey={contractLabel}
                  name={contractLabel}
                  stackId="driverAmount"
                  fill={["#2563eb", "#0f766e", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#65a30d", "#b45309"][index % 8]}
                />
              ))}
            </BarChart>
          </ChartSurface>
        </article>
      </div>
    </section>
  );
}
