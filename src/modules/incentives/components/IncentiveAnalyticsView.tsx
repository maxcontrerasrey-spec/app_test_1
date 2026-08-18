import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";

const EraserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m13.3 6 5.6 5.6" />
  </svg>
);
import { EChartSurface, TextField, MultiSelectField } from "../../../shared/ui";
import {
  formatCompactNumberValue,
  formatCurrencyValue,
  formatPercentValue
} from "../../../shared/lib/format";
import { formatDateForDisplay } from "../../../shared/lib/date";
import { useHrIncentivesAnalytics, useHrIncentiveRequests } from "../hooks/useIncentivesQueries";
import {
  computeAmountVariance,
  computeIncentivesAmountBreakdown,
  computeSharePct
} from "../lib/incentivesAnalyticsHelpers";
import { SegmentedStatusBar, type SegmentedStatusSegment } from "../../bi/components/SegmentedStatusBar";

type ChartClickParams = {
  data?: unknown;
};

type TooltipParam = {
  marker?: string;
  name?: string;
  seriesName?: string;
  value?: unknown;
  data?: unknown;
  percent?: number;
  dataIndex?: number;
};

type ChartDataRecord = Record<string, unknown>;

// Azul = volumen/neutral, verde = cubierto/aprobado, naranjo = pendiente,
// rojo = rechazo, gris = referencia. Reservado para series categoricas
// (tipo de incentivo, contratos) donde no aplica un color de estado unico.
const CHART_PALETTE = ["#2563eb", "#0f766e", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#65a30d", "#b45309"];
const COLOR_NEUTRAL_VOLUME = "#2563eb";

function formatPercent(value: number) {
  return formatPercentValue(value, 1, "0.0%");
}

function formatCompactCurrency(value: number) {
  return formatCompactNumberValue(value, "0");
}

function formatShortDate(val: string) {
  const full = formatDateForDisplay(val);
  const parts = full.split("/");
  if (parts.length === 3) return `${parts[0]}/${parts[1]}`;
  return full;
}

function formatPeriodCode(val: string) {
  if (val.length === 6) {
    const year = val.substring(2, 4);
    const month = val.substring(4, 6);
    const months: Record<string, string> = {
      "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
      "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
      "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic"
    };
    return `${months[month] || month}${year}`;
  }
  return val;
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

function truncateLabel(value: string, maxLength: number = 22) {
  if (!value) return "";
  return value.length > maxLength ? value.substring(0, maxLength) + "…" : value;
}

function asTooltipParams(params: unknown): TooltipParam[] {
  if (Array.isArray(params)) {
    return params as TooltipParam[];
  }

  return [params as TooltipParam];
}

function getChartDataRecord(value: unknown): ChartDataRecord {
  if (value && typeof value === "object") {
    return value as ChartDataRecord;
  }

  return {};
}

function toggleFilterValue(values: string[], nextValue: string) {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values.filter((value) => value !== "A"), nextValue];
}

function buildItemTooltip(title: string, amount: number, suffix = "", valueLabel = "Monto") {
  return `<div class="chart-tooltip"><div class="chart-tooltip-title">${title}</div><div class="chart-tooltip-list"><div class="chart-tooltip-item"><span class="chart-tooltip-item-label">${valueLabel}</span><strong>${formatCurrencyValue(amount)}${suffix}</strong></div></div></div>`;
}

function buildCountTooltip(title: string, count: number, suffix = "") {
  return `<div class="chart-tooltip"><div class="chart-tooltip-title">${title}</div><div class="chart-tooltip-list"><div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Solicitudes</span><strong>${count.toLocaleString("es-CL")}${suffix}</strong></div></div></div>`;
}

function formatVarianceLabel(deltaPct: number | null) {
  if (deltaPct === null || !Number.isFinite(deltaPct)) return null;
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${deltaPct.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`;
}

function ChartToggle({
  value,
  onChange
}: {
  value: "period" | "date";
  onChange: (value: "period" | "date") => void;
}) {
  return (
    <div style={{ display: "flex", gap: "0.25rem", background: "var(--surface-muted)", padding: "0.25rem", borderRadius: "var(--radius-md)" }}>
      <button
        type="button"
        onClick={() => onChange("period")}
        style={{
          border: "none",
          background: value === "period" ? "var(--surface)" : "transparent",
          color: value === "period" ? "var(--title)" : "var(--text-muted)",
          padding: "0.25rem 0.75rem",
          fontSize: "0.82rem",
          fontWeight: value === "period" ? 600 : 500,
          borderRadius: "calc(var(--radius-md) - 2px)",
          boxShadow: value === "period" ? "var(--shadow-soft)" : "none",
          cursor: "pointer",
          transition: "all 0.2s"
        }}
      >
        Periodos
      </button>
      <button
        type="button"
        onClick={() => onChange("date")}
        style={{
          border: "none",
          background: value === "date" ? "var(--surface)" : "transparent",
          color: value === "date" ? "var(--title)" : "var(--text-muted)",
          padding: "0.25rem 0.75rem",
          fontSize: "0.82rem",
          fontWeight: value === "date" ? 600 : 500,
          borderRadius: "calc(var(--radius-md) - 2px)",
          boxShadow: value === "date" ? "var(--shadow-soft)" : "none",
          cursor: "pointer",
          transition: "all 0.2s"
        }}
      >
        Actual
      </button>
    </div>
  );
}

export function IncentiveAnalyticsView() {
  const [timeView, setTimeView] = useState<"period" | "date">("period");
  const [typeTimeView, setTypeTimeView] = useState<"period" | "date">("date");
  const [contractTimeView, setContractTimeView] = useState<"period" | "date">("date");
  const [workerTimeView, setWorkerTimeView] = useState<"period" | "date">("date");

  const [periodCodeFilter, setPeriodCodeFilter] = useState("");
  const [contractCodeFilter, setContractCodeFilter] = useState<string[]>([]);
  const [typeIdFilter, setTypeIdFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>(["A"]);

  const analyticsQuery = useHrIncentivesAnalytics({
    periodCode: periodCodeFilter || undefined,
    contractCodes: contractCodeFilter.length > 0 ? contractCodeFilter : undefined,
    typeIds: typeIdFilter.length > 0 ? typeIdFilter : undefined,
    statuses: statusFilter.length > 0 ? statusFilter : undefined
  });

  const allPeriodsAnalyticsQuery = useHrIncentivesAnalytics({
    periodCode: undefined,
    contractCodes: contractCodeFilter.length > 0 ? contractCodeFilter : undefined,
    typeIds: typeIdFilter.length > 0 ? typeIdFilter : undefined,
    statuses: statusFilter.length > 0 ? statusFilter : undefined
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
    contractCodes: contractCodeFilter.length > 0 ? contractCodeFilter : undefined,
    typeIds: typeIdFilter.length > 0 ? typeIdFilter : undefined,
    statuses: statusFilter.length > 0 ? statusFilter : undefined
  });

  const dateTrendData = useMemo(() => {
    if (!requestsQuery.data) return [];

    const aggregated: Record<string, number> = {};
    for (const req of requestsQuery.data) {
      const datePart = req.serviceDate.split("T")[0];
      aggregated[datePart] = (aggregated[datePart] ?? 0) + req.calculatedAmount;
    }

    return Object.entries(aggregated)
      .map(([date, amount]) => ({
        serviceDate: date,
        totalAmount: amount
      }))
      .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
  }, [requestsQuery.data]);

  const evolutionChartData = timeView === "period" ? periodTrendData : dateTrendData;

  const evolutionVariance = useMemo(() => {
    if (evolutionChartData.length < 2) return null;
    const current = evolutionChartData[evolutionChartData.length - 1];
    const previous = evolutionChartData[evolutionChartData.length - 2];
    return computeAmountVariance(current.totalAmount, previous.totalAmount);
  }, [evolutionChartData]);

  const evolutionVarianceLabel = formatVarianceLabel(evolutionVariance?.deltaPct ?? null);

  const amountByTypeData = useMemo(() => {
    const sourceData = typeTimeView === "period" ? allPeriodsAnalyticsQuery.data?.countByIncentiveType : analyticsQuery.data?.countByIncentiveType;

    return (sourceData ?? []).map((item, index) => ({
      name: item.incentiveTypeName,
      value: item.totalAmount,
      itemStyle: { color: CHART_PALETTE[index % CHART_PALETTE.length] },
      typeId: item.incentiveTypeId
    }));
  }, [analyticsQuery.data?.countByIncentiveType, allPeriodsAnalyticsQuery.data?.countByIncentiveType, typeTimeView]);

  const amountByTypeTotal = useMemo(
    () => amountByTypeData.reduce((sum, item) => sum + item.value, 0),
    [amountByTypeData]
  );

  const amountByContractData = useMemo(() => {
    const sourceData = contractTimeView === "period" ? allPeriodsAnalyticsQuery.data?.amountByContract : analyticsQuery.data?.amountByContract;
    const rows = sourceData?.slice(0, 8) ?? [];
    const total = rows.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);

    return rows.map((item) => ({
      contractCode: item.contractCode,
      contractLabel: item.areaName || item.contractCode,
      totalAmount: Number(item.totalAmount || 0),
      sharePct: computeSharePct(Number(item.totalAmount || 0), total)
    }));
  }, [analyticsQuery.data?.amountByContract, allPeriodsAnalyticsQuery.data?.amountByContract, contractTimeView]);

  const rawWorkerData = useMemo(() => {
    const sourceData = workerTimeView === "period" ? allPeriodsAnalyticsQuery.data?.amountByWorker : analyticsQuery.data?.amountByWorker;
    return sourceData?.slice(0, 8) ?? [];
  }, [analyticsQuery.data?.amountByWorker, allPeriodsAnalyticsQuery.data?.amountByWorker, workerTimeView]);

  const workerRankingTotalBase = timeView === "period"
    ? allPeriodsAnalyticsQuery.data?.summaryCards.totalAmount ?? 0
    : analyticsQuery.data?.summaryCards.totalAmount ?? 0;

  const amountByWorkerData = useMemo(() => {
    return rawWorkerData
      .map((item) => ({
        workerName: item.workerName || "Desconocido",
        totalAmount: item.totalAmount,
        sharePct: computeSharePct(item.totalAmount, workerRankingTotalBase),
        contracts: item.contracts
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [rawWorkerData, workerRankingTotalBase]);

  const evolutionOption = useMemo<EChartsOption>(() => {
    const categories = evolutionChartData.map((item) => {
      const raw = "periodCode" in item ? item.periodCode : item.serviceDate;
      return timeView === "date" ? formatShortDate(String(raw)) : formatPeriodCode(String(raw));
    });
    const seriesData = evolutionChartData.map((item) => {
      const raw = "periodCode" in item ? item.periodCode : item.serviceDate;
      return {
        value: item.totalAmount,
        totalAmount: item.totalAmount,
        periodCode: "periodCode" in item ? item.periodCode : undefined,
        serviceDate: "serviceDate" in item ? item.serviceDate : undefined,
        displayLabel: timeView === "date" ? formatShortDate(String(raw)) : formatPeriodCode(String(raw))
      };
    });

    return {
      grid: { top: 20, right: 20, bottom: 42, left: 56 },
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const first = asTooltipParams(params)[0];
          const data = getChartDataRecord(first?.data);
          const title = timeView === "period"
            ? `Período ${data.displayLabel ?? ""}`
            : `Fecha: ${data.displayLabel ?? ""}`;
          return buildItemTooltip(title, Number(data.totalAmount ?? 0));
        }
      },
      xAxis: {
        type: "category",
        data: categories,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { fontSize: 11, fontWeight: 500 }
      },
      yAxis: {
        type: "value",
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { formatter: (value: number) => formatCompactCurrency(value), fontSize: 11, fontWeight: 500 },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.22)", type: "dashed" } }
      },
      series: [
        {
          type: "bar",
          name: "Monto registrado",
          data: seriesData,
          barMaxWidth: 42,
          itemStyle: { color: COLOR_NEUTRAL_VOLUME, borderRadius: [6, 6, 0, 0] }
        }
      ]
    };
  }, [evolutionChartData, timeView]);

  const amountByTypeOption = useMemo<EChartsOption>(() => ({
    tooltip: {
      trigger: "item",
      formatter: (params: unknown) => {
        const item = asTooltipParams(params)[0];
        const data = getChartDataRecord(item?.data);
        const percent = typeof item?.percent === "number" ? ` · ${item.percent.toFixed(1)}%` : "";
        return buildItemTooltip(String(data.name ?? item?.name ?? "Tipo"), Number(data.value ?? item?.value ?? 0), percent);
      }
    },
    legend: { bottom: 0, icon: "circle", type: "scroll" },
    series: [
      {
        type: "pie",
        name: "Monto",
        radius: ["50%", "75%"],
        center: ["50%", "45%"],
        padAngle: 3,
        itemStyle: {
          borderRadius: 8,
          borderColor: "#ffffff",
          borderWidth: 2,
          shadowBlur: 10,
          shadowColor: "rgba(0, 0, 0, 0.08)",
          shadowOffsetX: 2,
          shadowOffsetY: 2
        },
        data: amountByTypeData,
        label: { formatter: ({ name }: { name: string }) => truncateLabel(name, 16) }
      }
    ]
  }), [amountByTypeData]);

  const amountByContractOption = useMemo<EChartsOption>(() => ({
    grid: { top: 18, right: 28, bottom: 28, left: 12 },
    tooltip: {
      trigger: "item",
      formatter: (params: unknown) => {
        const item = asTooltipParams(params)[0];
        const data = getChartDataRecord(item?.data);
        const sharePct = typeof data.sharePct === "number" ? ` · ${formatPercent(data.sharePct)}` : "";
        return buildItemTooltip(String(data.contractLabel ?? "Contrato"), Number(data.value ?? 0), sharePct);
      }
    },
    xAxis: {
      type: "value",
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { formatter: (value: number) => formatCompactCurrency(value), fontSize: 11, fontWeight: 500 },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.22)", type: "dashed" } }
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: amountByContractData.map((item) => item.contractLabel),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { show: false }
    },
    series: [
      {
        type: "bar",
        name: "Monto total",
        barMaxWidth: 26,
        data: amountByContractData.map((item) => ({
          value: item.totalAmount,
          contractCode: item.contractCode,
          contractLabel: item.contractLabel,
          sharePct: item.sharePct
        })),
        itemStyle: {
          color: COLOR_NEUTRAL_VOLUME,
          borderRadius: [0, 8, 8, 0]
        },
        label: {
          show: true,
          position: "insideLeft",
          distance: 8,
          color: "#ffffff",
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 16,
          width: 220,
          overflow: "truncate",
          ellipsis: "…",
          formatter: (params: { data?: unknown }) => {
            const data = getChartDataRecord(params.data);
            const sharePct = typeof data.sharePct === "number" ? ` · ${formatPercent(data.sharePct)}` : "";
            return `${String(data.contractLabel ?? "")}${sharePct}`;
          }
        }
      }
    ]
  }), [amountByContractData]);

  const amountByWorkerOption = useMemo<EChartsOption>(() => {
    const workerNames = amountByWorkerData.map((item) => item.workerName);

    return {
      grid: { top: 18, right: 28, bottom: 8, left: 132 },
      tooltip: {
        trigger: "item",
        formatter: (params: unknown) => {
          const item = asTooltipParams(params)[0];
          const dataIndex = item?.dataIndex ?? 0;
          const worker = amountByWorkerData[dataIndex];
          if (!worker) return "";

          const contractRows = worker.contracts
            .map(
              (contract) =>
                `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">${contract.contractLabel}</span><strong>${formatCurrencyValue(contract.amount)}</strong></div>`
            )
            .join("");

          return `<div class="chart-tooltip"><div class="chart-tooltip-title">${worker.workerName}</div><div class="chart-tooltip-list"><div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Monto total</span><strong>${formatCurrencyValue(worker.totalAmount)} · ${formatPercent(worker.sharePct)}</strong></div>${contractRows}</div></div>`;
        }
      },
      xAxis: {
        type: "value",
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { formatter: (value: number) => formatCompactCurrency(value), fontSize: 11, fontWeight: 500 },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.22)", type: "dashed" } }
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: workerNames,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          fontSize: 11,
          fontWeight: 600,
          formatter: (value: string) => truncateLabel(value, 18)
        }
      },
      series: [
        {
          type: "bar",
          name: "Monto total",
          barMaxWidth: 22,
          data: amountByWorkerData.map((item) => item.totalAmount),
          itemStyle: {
            color: COLOR_NEUTRAL_VOLUME,
            borderRadius: [0, 6, 6, 0]
          },
          label: {
            show: true,
            position: "right",
            distance: 6,
            color: "var(--text-muted)",
            fontSize: 11,
            fontWeight: 700,
            formatter: (params: { dataIndex?: number }) => {
              const worker = amountByWorkerData[params.dataIndex ?? 0];
              return worker ? formatPercent(worker.sharePct) : "";
            }
          }
        }
      ]
    };
  }, [amountByWorkerData]);

  const cards = analyticsQuery.data?.summaryCards;
  const amountBreakdown = useMemo(() => {
    if (!analyticsQuery.data) return null;
    return computeIncentivesAmountBreakdown(
      analyticsQuery.data.summaryCards,
      analyticsQuery.data.totalAmountByPeriod
    );
  }, [analyticsQuery.data]);

  const statusSegments = useMemo<SegmentedStatusSegment[] | null>(() => {
    if (!cards || cards.requestCount === 0) return null;

    const pendingCount = Math.max(cards.requestCount - cards.approvedCount - cards.rejectedCount, 0);

    return [
      { key: "approved", label: "Aprobadas", value: cards.approvedCount, tone: "approved" },
      { key: "pending", label: "Pendientes", value: pendingCount, tone: "pending" },
      { key: "rejected", label: "Rechazadas", value: cards.rejectedCount, tone: "rejected" }
    ];
  }, [cards]);

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

        <div className="hr-incentives-analytics-filters">
          <TextField
            id="hr-incentive-analytics-period"
            label="Período"
            value={periodCodeFilter}
            onChange={(event) => setPeriodCodeFilter(event.target.value)}
            placeholder="YYYYMM"
            inputMode="numeric"
          />
          <MultiSelectField
            id="hr-incentive-analytics-contract"
            label="Contratos"
            value={contractCodeFilter}
            onChange={setContractCodeFilter}
            options={contractOptions}
            placeholder="Todos los contratos"
          />
          <MultiSelectField
            id="hr-incentive-analytics-type"
            label="Tipos de incentivo"
            value={typeIdFilter}
            onChange={setTypeIdFilter}
            options={incentiveTypeOptions}
            placeholder="Todos los tipos"
          />
          <MultiSelectField
            id="hr-incentive-analytics-status"
            label="Estados"
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            placeholder="Todos"
          />
          <button
            type="button"
            className="hr-incentives-analytics-clear-button"
            title="Limpiar filtros"
            aria-label="Limpiar filtros"
            onClick={() => {
              setPeriodCodeFilter("");
              setContractCodeFilter([]);
              setTypeIdFilter([]);
              setStatusFilter(["A"]);
            }}
          >
            <EraserIcon />
          </button>
        </div>
      </div>

      {analyticsQuery.isError ? (
        <div className="info-card">
          <p className="form-status form-status-error">{analyticsQuery.error.message}</p>
        </div>
      ) : null}

      <div className="tracking-kpi-row hr-incentives-analytics-kpis">
        <article className="tracking-kpi-card tracking-kpi-card-bi-gray">
          <span>Monto Registrado</span>
          <strong>{cards ? formatCurrencyValue(cards.totalAmount) : "—"}</strong>
          <small className="bi-kpi-caption">Todas las solicitudes ingresadas, sin importar estado</small>
        </article>
        <article className="tracking-kpi-card tracking-kpi-card-bi-green">
          <span>Monto Aprobado</span>
          <strong>{amountBreakdown ? formatCurrencyValue(amountBreakdown.approvedAmount) : "—"}</strong>
          {amountBreakdown ? (
            <small className="bi-kpi-caption">{formatPercent(amountBreakdown.approvedPct)} del registrado</small>
          ) : null}
        </article>
        <article className="tracking-kpi-card tracking-kpi-card-bi-yellow">
          <span>Monto Pendiente</span>
          <strong>{amountBreakdown ? formatCurrencyValue(amountBreakdown.pendingAmount) : "—"}</strong>
          {amountBreakdown ? (
            <small className="bi-kpi-caption">{formatPercent(amountBreakdown.pendingPct)} del registrado</small>
          ) : null}
        </article>
        <article className="tracking-kpi-card tracking-kpi-card-bi-blue">
          <span>Solicitudes</span>
          <strong>{cards ? cards.requestCount.toLocaleString("es-CL") : "—"}</strong>
        </article>
        <article className="tracking-kpi-card tracking-kpi-card-bi-green">
          <span>Tasa de Aprobación</span>
          <strong>{cards ? formatPercent(cards.approvalRate) : "—"}</strong>
          {amountBreakdown ? (
            <small className="bi-kpi-caption">
              Rechazo {formatPercent(cards?.rejectionRate ?? 0)} · Pendiente {formatPercent(amountBreakdown.pendingPct)}
            </small>
          ) : null}
        </article>
      </div>

      {statusSegments ? (
        <div className="info-card bi-status-stack-card">
          <div className="bi-status-stack-header">
            <h4>Estado de Solicitudes</h4>
            <span className="tracking-filter-caption">Aprobadas / Pendientes / Rechazadas</span>
          </div>
          <SegmentedStatusBar segments={statusSegments} totalLabel="Estado de solicitudes de incentivos" />
        </div>
      ) : null}

      <div className="hr-incentives-analytics-grid">
        <article className="hr-incentives-analytics-card">
          <div className="hr-incentives-analytics-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              <h4>Evolución del monto</h4>
              <span className="tracking-filter-caption">
                {timeView === "period" ? "Monto agregado por período" : "Monto agregado por fecha"}
                {evolutionVarianceLabel ? ` · ${evolutionVarianceLabel} vs anterior` : ""}
              </span>
            </div>
            <ChartToggle value={timeView} onChange={setTimeView} />
          </div>
          <EChartSurface
            height={280}
            option={evolutionOption}
            loading={analyticsQuery.isLoading || (timeView === "date" && requestsQuery.isLoading)}
            empty={evolutionChartData.length === 0}
            emptyMessage={timeView === "period" ? "No hay períodos para el filtro actual." : "No hay datos para el período actual."}
            onEvents={{
              click: (params: ChartClickParams) => {
                const data = getChartDataRecord(params.data);
                const periodCode = typeof data.periodCode === "string" ? data.periodCode : "";
                if (!periodCode) return;
                setPeriodCodeFilter((previous) => previous === periodCode ? "" : periodCode);
              }
            }}
          />
        </article>

        <article className="hr-incentives-analytics-card">
          <div className="hr-incentives-analytics-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              <h4>Distribución por tipo</h4>
              <span className="tracking-filter-caption">Participación del presupuesto por incentivo</span>
            </div>
            <ChartToggle value={typeTimeView} onChange={setTypeTimeView} />
          </div>
          <div className="bi-donut-center-wrap">
            <EChartSurface
              height={280}
              option={amountByTypeOption}
              loading={analyticsQuery.isLoading}
              empty={amountByTypeData.length === 0}
              emptyMessage="No hay tipos de incentivo para el filtro actual."
              onEvents={{
                click: (params: ChartClickParams) => {
                  const data = getChartDataRecord(params.data);
                  const typeId = typeof data.typeId === "string" ? data.typeId : "";
                  if (!typeId) return;
                  setTypeIdFilter((previous) => toggleFilterValue(previous, typeId));
                }
              }}
            />
            {amountByTypeData.length > 0 ? (
              <div className="bi-donut-center-label">
                <span>Total</span>
                <strong>{formatCompactCurrency(amountByTypeTotal)}</strong>
              </div>
            ) : null}
          </div>
        </article>

        <article className="hr-incentives-analytics-card">
          <div className="hr-incentives-analytics-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              <h4>Inversión por contrato</h4>
              <span className="tracking-filter-caption">
                Top contratos con mayor volumen de incentivos
              </span>
            </div>
            <ChartToggle value={contractTimeView} onChange={setContractTimeView} />
          </div>
          <EChartSurface
            height={320}
            option={amountByContractOption}
            loading={analyticsQuery.isLoading}
            empty={amountByContractData.length === 0}
            emptyMessage="No hay datos para el filtro actual."
            onEvents={{
              click: (params: ChartClickParams) => {
                const data = getChartDataRecord(params.data);
                const contractCode = typeof data.contractCode === "string" ? data.contractCode : "";
                if (!contractCode) return;
                setContractCodeFilter((previous) => toggleFilterValue(previous, contractCode));
              }
            }}
          />
        </article>

        <article className="hr-incentives-analytics-card">
          <div className="hr-incentives-analytics-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              <h4>Ranking de trabajadores</h4>
              <span className="tracking-filter-caption">
                Monto total por trabajador · detalle de contratos en tooltip
              </span>
            </div>
            <ChartToggle value={workerTimeView} onChange={setWorkerTimeView} />
          </div>
          <EChartSurface
            height={320}
            option={amountByWorkerOption}
            loading={analyticsQuery.isLoading}
            empty={amountByWorkerData.length === 0}
            emptyMessage="No hay datos para el filtro actual."
          />
        </article>
      </div>
    </section>
  );
}
