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
import { formatDateForDisplay } from "../../../shared/lib/date";
import { useHrIncentivesAnalytics, useHrIncentiveRequests } from "../hooks/useIncentivesQueries";

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
  const [timeView, setTimeView] = useState<"period" | "date">("period");
  const [typeTimeView, setTypeTimeView] = useState<"period" | "date">("date");
  const [contractTimeView, setContractTimeView] = useState<"period" | "date">("date");
  const [workerTimeView, setWorkerTimeView] = useState<"period" | "date">("date");

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

  const allPeriodsAnalyticsQuery = useHrIncentivesAnalytics({
    periodCode: undefined,
    contractCode: contractCodeFilter || undefined,
    typeId: typeIdFilter || undefined,
    status: statusFilter
  });

  const periodTrendData = useMemo(() => {
    return (allPeriodsAnalyticsQuery.data?.totalAmountByPeriod ?? [])
      .slice(-12)
      .map((item) => ({
        periodCode: item.periodCode,
        totalAmount: item.totalAmount
      }));
  }, [allPeriodsAnalyticsQuery.data?.totalAmountByPeriod]);

  const actualPeriodCode = periodCodeFilter || (periodTrendData.length > 0 ? periodTrendData[periodTrendData.length - 1].periodCode : undefined);

  const requestsQuery = useHrIncentiveRequests({
    periodCode: actualPeriodCode,
    contractCode: contractCodeFilter || undefined,
    typeId: typeIdFilter || undefined,
    status: statusFilter
  });

  const dateTrendData = useMemo(() => {
    if (!requestsQuery.data) return [];
    
    const aggregated: Record<string, number> = {};
    for (const req of requestsQuery.data) {
      const datePart = req.serviceDate.split("T")[0];
      if (!aggregated[datePart]) {
        aggregated[datePart] = 0;
      }
      aggregated[datePart] += req.calculatedAmount;
    }

    return Object.entries(aggregated)
      .map(([date, amount]) => ({
        serviceDate: date,
        totalAmount: amount
      }))
      .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
  }, [requestsQuery.data]);

  const evolutionChartData = timeView === "period" ? periodTrendData : dateTrendData;
  const evolutionXAxisKey = timeView === "period" ? "periodCode" : "serviceDate";

  const amountByTypeData = useMemo(() => {
    const palette = ["#2563eb", "#0f766e", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#65a30d", "#b45309"];
    const sourceData = typeTimeView === "period" ? allPeriodsAnalyticsQuery.data?.countByIncentiveType : analyticsQuery.data?.countByIncentiveType;

    return (sourceData ?? []).map((item, index) => ({
      name: item.incentiveTypeName,
      value: item.totalAmount,
      color: palette[index % palette.length],
      typeId: item.incentiveTypeId
    }));
  }, [analyticsQuery.data?.countByIncentiveType, allPeriodsAnalyticsQuery.data?.countByIncentiveType, typeTimeView]);

  const amountByContractData = useMemo(() => {
    const sourceData = contractTimeView === "period" ? allPeriodsAnalyticsQuery.data?.amountByContract : analyticsQuery.data?.amountByContract;
    return (sourceData?.slice(0, 8) ?? []).map((item) => ({
      contractCode: item.contractCode,
      contractLabel: item.areaName || item.contractCode,
      totalAmount: Number(item.totalAmount || 0)
    }));
  }, [analyticsQuery.data?.amountByContract, allPeriodsAnalyticsQuery.data?.amountByContract, contractTimeView]);

  const amountByWorkerData = useMemo(() => {
    const sourceData = workerTimeView === "period" ? allPeriodsAnalyticsQuery.data?.amountByWorker : analyticsQuery.data?.amountByWorker;
    const rawData = sourceData?.slice(0, 8) ?? [];
    return rawData.map((item) => {
      const flatItem: any = {
        workerName: item.workerName || "Desconocido",
        totalAmount: item.totalAmount
      };
      item.contracts.forEach((c) => {
        flatItem[c.contractLabel] = c.amount;
      });
      return flatItem;
    });
  }, [analyticsQuery.data?.amountByWorker, allPeriodsAnalyticsQuery.data?.amountByWorker, workerTimeView]);

  const uniqueWorkerContracts = useMemo(() => {
    const contractsSet = new Set<string>();
    const sourceData = workerTimeView === "period" ? allPeriodsAnalyticsQuery.data?.amountByWorker : analyticsQuery.data?.amountByWorker;
    const rawData = sourceData?.slice(0, 8) ?? [];
    rawData.forEach(item => {
      item.contracts.forEach(c => {
        contractsSet.add(c.contractLabel);
      });
    });
    return Array.from(contractsSet);
  }, [analyticsQuery.data?.amountByWorker, allPeriodsAnalyticsQuery.data?.amountByWorker, workerTimeView]);

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
          <div className="hr-incentives-analytics-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              <h4>Evolución del gasto</h4>
              <span className="tracking-filter-caption">
                {timeView === "period" ? "Monto agregado por período" : "Monto agregado por fecha"}
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.25rem", background: "var(--surface-muted)", padding: "0.25rem", borderRadius: "var(--radius-md)" }}>
              <button
                type="button"
                onClick={() => setTimeView("period")}
                style={{
                  border: "none",
                  background: timeView === "period" ? "var(--surface)" : "transparent",
                  color: timeView === "period" ? "var(--title)" : "var(--text-muted)",
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.82rem",
                  fontWeight: timeView === "period" ? 600 : 500,
                  borderRadius: "calc(var(--radius-md) - 2px)",
                  boxShadow: timeView === "period" ? "var(--shadow-soft)" : "none",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Periodos
              </button>
              <button
                type="button"
                onClick={() => setTimeView("date")}
                style={{
                  border: "none",
                  background: timeView === "date" ? "var(--surface)" : "transparent",
                  color: timeView === "date" ? "var(--title)" : "var(--text-muted)",
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.82rem",
                  fontWeight: timeView === "date" ? 600 : 500,
                  borderRadius: "calc(var(--radius-md) - 2px)",
                  boxShadow: timeView === "date" ? "var(--shadow-soft)" : "none",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Actual
              </button>
            </div>
          </div>
          <ChartSurface
            height={280}
            loading={analyticsQuery.isLoading || (timeView === "date" && requestsQuery.isLoading)}
            empty={evolutionChartData.length === 0}
            emptyMessage={timeView === "period" ? "No hay períodos para el filtro actual." : "No hay datos para el período actual."}
          >
            <ComposedChart data={evolutionChartData as any[]} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="incentiveAmountFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.22)" />
              <XAxis
                dataKey={evolutionXAxisKey}
                stroke="var(--text-muted)"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 11, fontWeight: 500 }}
                tickMargin={12}
                tickFormatter={(val) => timeView === "date" ? formatDateForDisplay(String(val)) : val}
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
                    chartLabelFormatter={(label) => timeView === "period" ? `Período ${label}` : `Fecha: ${formatDateForDisplay(String(label))}`}
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
                onClick={(data: any) => {
                  const payload = data.payload || data;
                  if (payload && payload.periodCode) {
                    setPeriodCodeFilter(prev => prev === payload.periodCode ? "" : payload.periodCode);
                  }
                }}
                cursor="pointer"
              />
              <Line
                type="monotone"
                dataKey="totalAmount"
                name="Tendencia"
                stroke="#0f172a"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                onClick={(data: any) => {
                  const payload = data.payload || data;
                  if (payload && payload.periodCode) {
                    setPeriodCodeFilter(prev => prev === payload.periodCode ? "" : payload.periodCode);
                  }
                }}
                cursor="pointer"
              />
            </ComposedChart>
          </ChartSurface>
        </article>

        <article className="hr-incentives-analytics-card">
          <div className="hr-incentives-analytics-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              <h4>Distribución por tipo</h4>
              <span className="tracking-filter-caption">Participación del presupuesto por incentivo</span>
            </div>
            <div style={{ display: "flex", gap: "0.25rem", background: "var(--surface-muted)", padding: "0.25rem", borderRadius: "var(--radius-md)" }}>
              <button
                type="button"
                onClick={() => setTypeTimeView("period")}
                style={{
                  border: "none",
                  background: typeTimeView === "period" ? "var(--surface)" : "transparent",
                  color: typeTimeView === "period" ? "var(--title)" : "var(--text-muted)",
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.82rem",
                  fontWeight: typeTimeView === "period" ? 600 : 500,
                  borderRadius: "calc(var(--radius-md) - 2px)",
                  boxShadow: typeTimeView === "period" ? "var(--shadow-soft)" : "none",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Periodos
              </button>
              <button
                type="button"
                onClick={() => setTypeTimeView("date")}
                style={{
                  border: "none",
                  background: typeTimeView === "date" ? "var(--surface)" : "transparent",
                  color: typeTimeView === "date" ? "var(--title)" : "var(--text-muted)",
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.82rem",
                  fontWeight: typeTimeView === "date" ? 600 : 500,
                  borderRadius: "calc(var(--radius-md) - 2px)",
                  boxShadow: typeTimeView === "date" ? "var(--shadow-soft)" : "none",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Actual
              </button>
            </div>
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
                onClick={(data: any) => {
                  const payload = data?.payload || data;
                  if (payload && payload.typeId) {
                    setTypeIdFilter(prev => prev === payload.typeId ? "" : payload.typeId);
                  }
                }}
                cursor="pointer"
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
          <div className="hr-incentives-analytics-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              <h4>Inversión por contrato</h4>
              <span className="tracking-filter-caption">
                Top contratos con mayor volumen de incentivos
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.25rem", background: "var(--surface-muted)", padding: "0.25rem", borderRadius: "var(--radius-md)" }}>
              <button
                type="button"
                onClick={() => setContractTimeView("period")}
                style={{
                  border: "none",
                  background: contractTimeView === "period" ? "var(--surface)" : "transparent",
                  color: contractTimeView === "period" ? "var(--title)" : "var(--text-muted)",
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.82rem",
                  fontWeight: contractTimeView === "period" ? 600 : 500,
                  borderRadius: "calc(var(--radius-md) - 2px)",
                  boxShadow: contractTimeView === "period" ? "var(--shadow-soft)" : "none",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Periodos
              </button>
              <button
                type="button"
                onClick={() => setContractTimeView("date")}
                style={{
                  border: "none",
                  background: contractTimeView === "date" ? "var(--surface)" : "transparent",
                  color: contractTimeView === "date" ? "var(--title)" : "var(--text-muted)",
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.82rem",
                  fontWeight: contractTimeView === "date" ? 600 : 500,
                  borderRadius: "calc(var(--radius-md) - 2px)",
                  boxShadow: contractTimeView === "date" ? "var(--shadow-soft)" : "none",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Actual
              </button>
            </div>
          </div>
          <ChartSurface
            height={320}
            loading={analyticsQuery.isLoading}
            empty={amountByContractData.length === 0}
            emptyMessage="No hay datos para el filtro actual."
          >
            <BarChart
              data={amountByContractData}
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
                dataKey="contractLabel"
                width={10}
                stroke="var(--text-muted)"
                tickLine={false}
                axisLine={false}
                tick={false}
              />
              <Tooltip
                content={(props) => (
                  <ChartTooltip 
                    {...props} 
                    chartValueFormatter={(value) => formatCurrencyValue(Number(value ?? 0))} 
                  />
                )}
              />
              <Bar 
                dataKey="totalAmount" 
                name="Monto total" 
                fill="#57a6b2" 
                radius={[0, 6, 6, 0]}
                onClick={(data: any) => {
                  const payload = data.payload || data;
                  if (payload && payload.contractCode) {
                    setContractCodeFilter(prev => prev === payload.contractCode ? "" : payload.contractCode);
                  }
                }}
                cursor="pointer"
              />
            </BarChart>
          </ChartSurface>
        </article>

        <article className="hr-incentives-analytics-card">
          <div className="hr-incentives-analytics-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              <h4>Ranking de trabajadores</h4>
              <span className="tracking-filter-caption">
                Trabajadores con mayor monto ingresado, diferenciado por contrato
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.25rem", background: "var(--surface-muted)", padding: "0.25rem", borderRadius: "var(--radius-md)" }}>
              <button
                type="button"
                onClick={() => setWorkerTimeView("period")}
                style={{
                  border: "none",
                  background: workerTimeView === "period" ? "var(--surface)" : "transparent",
                  color: workerTimeView === "period" ? "var(--title)" : "var(--text-muted)",
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.82rem",
                  fontWeight: workerTimeView === "period" ? 600 : 500,
                  borderRadius: "calc(var(--radius-md) - 2px)",
                  boxShadow: workerTimeView === "period" ? "var(--shadow-soft)" : "none",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Periodos
              </button>
              <button
                type="button"
                onClick={() => setWorkerTimeView("date")}
                style={{
                  border: "none",
                  background: workerTimeView === "date" ? "var(--surface)" : "transparent",
                  color: workerTimeView === "date" ? "var(--title)" : "var(--text-muted)",
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.82rem",
                  fontWeight: workerTimeView === "date" ? 600 : 500,
                  borderRadius: "calc(var(--radius-md) - 2px)",
                  boxShadow: workerTimeView === "date" ? "var(--shadow-soft)" : "none",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Actual
              </button>
            </div>
          </div>
          <ChartSurface
            height={320}
            loading={analyticsQuery.isLoading}
            empty={amountByWorkerData.length === 0}
            emptyMessage="No hay datos para el filtro actual."
          >
            <BarChart
              data={amountByWorkerData}
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
                dataKey="workerName"
                width={10}
                stroke="var(--text-muted)"
                tickLine={false}
                axisLine={false}
                tick={false}
              />
              <Tooltip
                content={(props) => (
                  <ChartTooltip 
                    {...props} 
                    chartValueFormatter={(value) => formatCurrencyValue(Number(value ?? 0))} 
                  />
                )}
              />
              {uniqueWorkerContracts.map((contractLabel, index) => (
                <Bar
                  key={contractLabel}
                  dataKey={contractLabel}
                  name={contractLabel}
                  stackId="workerAmount"
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
