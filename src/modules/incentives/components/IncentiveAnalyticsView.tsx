import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChartSurface, TextField, MultiSelectField } from "../../../shared/ui";
import { formatCurrencyValue } from "../../../shared/lib/format";
import { formatDateForDisplay } from "../../../shared/lib/date";
import { useHrIncentivesAnalytics, useHrIncentiveRequests } from "../hooks/useIncentivesQueries";

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
};

type ChartDataRecord = Record<string, unknown>;

const CHART_PALETTE = ["#2563eb", "#0f766e", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#65a30d", "#b45309"];

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
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

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (Array.isArray(value)) return Number(value[1] ?? value[0] ?? 0);
  return Number(value ?? 0);
}

function toggleFilterValue(values: string[], nextValue: string) {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values.filter((value) => value !== "A"), nextValue];
}

function buildAxisTooltip(params: unknown, title: string) {
  const rows = asTooltipParams(params);
  const body = rows
    .filter((item) => item.seriesName)
    .map((item) => {
      const amount = formatCurrencyValue(toNumber(item.value));
      return `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">${item.marker ?? ""}${item.seriesName}</span><strong>${amount}</strong></div>`;
    })
    .join("");

  return `<div class="chart-tooltip"><div class="chart-tooltip-title">${title}</div><div class="chart-tooltip-list">${body}</div></div>`;
}

function buildItemTooltip(title: string, amount: number, suffix = "") {
  return `<div class="chart-tooltip"><div class="chart-tooltip-title">${title}</div><div class="chart-tooltip-list"><div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Monto</span><strong>${formatCurrencyValue(amount)}${suffix}</strong></div></div></div>`;
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

  const amountByTypeData = useMemo(() => {
    const sourceData = typeTimeView === "period" ? allPeriodsAnalyticsQuery.data?.countByIncentiveType : analyticsQuery.data?.countByIncentiveType;

    return (sourceData ?? []).map((item, index) => ({
      name: item.incentiveTypeName,
      value: item.totalAmount,
      itemStyle: { color: CHART_PALETTE[index % CHART_PALETTE.length] },
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

  const rawWorkerData = useMemo(() => {
    const sourceData = workerTimeView === "period" ? allPeriodsAnalyticsQuery.data?.amountByWorker : analyticsQuery.data?.amountByWorker;
    return sourceData?.slice(0, 8) ?? [];
  }, [analyticsQuery.data?.amountByWorker, allPeriodsAnalyticsQuery.data?.amountByWorker, workerTimeView]);

  const amountByWorkerData = useMemo(() => {
    return rawWorkerData.map((item) => {
      const flatItem: Record<string, string | number> = {
        workerName: item.workerName || "Desconocido",
        totalAmount: item.totalAmount
      };
      item.contracts.forEach((contract) => {
        flatItem[contract.contractLabel] = contract.amount;
      });
      return flatItem;
    });
  }, [rawWorkerData]);

  const uniqueWorkerContracts = useMemo(() => {
    const contractsSet = new Set<string>();
    rawWorkerData.forEach((item) => {
      item.contracts.forEach((contract) => {
        contractsSet.add(contract.contractLabel);
      });
    });
    return Array.from(contractsSet);
  }, [rawWorkerData]);

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
      grid: { top: 36, right: 20, bottom: 42, left: 56 },
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const first = asTooltipParams(params)[0];
          const data = getChartDataRecord(first?.data);
          const title = timeView === "period"
            ? `Período ${data.displayLabel ?? ""}`
            : `Fecha: ${data.displayLabel ?? ""}`;
          return buildAxisTooltip(params, title);
        }
      },
      legend: { bottom: 0, icon: "circle" },
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
          name: "Gasto total",
          data: seriesData,
          itemStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(59, 130, 246, 0.8)" },
                { offset: 1, color: "rgba(59, 130, 246, 0.1)" }
              ]
            },
            borderRadius: [6, 6, 0, 0]
          }
        },
        {
          type: "line",
          name: "Tendencia",
          data: seriesData,
          smooth: true,
          symbolSize: 8,
          symbol: "circle",
          lineStyle: {
            color: "#38bdf8",
            width: 3,
            shadowColor: "rgba(56, 189, 248, 0.5)",
            shadowBlur: 12,
            shadowOffsetY: 4
          },
          itemStyle: {
            color: "#38bdf8",
            borderWidth: 2,
            borderColor: "#ffffff"
          }
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
        return buildItemTooltip(String(data.contractLabel ?? "Contrato"), Number(data.value ?? 0));
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
        data: amountByContractData.map((item) => ({
          value: item.totalAmount,
          contractCode: item.contractCode,
          contractLabel: item.contractLabel
        })),
        itemStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: "rgba(16, 185, 129, 0.2)" },
              { offset: 1, color: "rgba(16, 185, 129, 0.8)" }
            ]
          },
          borderRadius: [0, 8, 8, 0]
        },
        label: {
          show: true,
          position: "insideLeft",
          color: "#ffffff",
          fontSize: 11.5,
          fontWeight: 600,
          formatter: (params: { data?: unknown }) => {
            const data = getChartDataRecord(params.data);
            return truncateLabel(String(data.contractLabel ?? ""), 34);
          }
        }
      }
    ]
  }), [amountByContractData]);

  const amountByWorkerOption = useMemo<EChartsOption>(() => {
    const workerNames = amountByWorkerData.map((item) => String(item.workerName));

    return {
      grid: { top: 18, right: 28, bottom: 54, left: 132 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const rows = asTooltipParams(params).filter((item) => toNumber(item.value) > 0);
          const title = rows[0]?.name ?? "Trabajador";
          const body = rows
            .map((item) => `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">${item.marker ?? ""}${item.seriesName}</span><strong>${formatCurrencyValue(toNumber(item.value))}</strong></div>`)
            .join("");
          return `<div class="chart-tooltip"><div class="chart-tooltip-title">${title}</div><div class="chart-tooltip-list">${body}</div></div>`;
        }
      },
      legend: { bottom: 0, icon: "circle", type: "scroll" },
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
      series: uniqueWorkerContracts.map((contractLabel, index) => ({
        type: "bar",
        name: contractLabel,
        stack: "workerAmount",
        data: amountByWorkerData.map((item) => Number(item[contractLabel] ?? 0)),
        itemStyle: { 
          color: CHART_PALETTE[index % CHART_PALETTE.length], 
          borderRadius: 4,
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.5)"
        }
      }))
    };
  }, [amountByWorkerData, uniqueWorkerContracts]);

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
              setContractCodeFilter([]);
              setTypeIdFilter([]);
              setStatusFilter(["A"]);
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
          <span>Descansos trabajados</span>
          <strong>{cards ? cards.declaredRestDayCount.toLocaleString("es-CL") : "—"}</strong>
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
                Trabajadores con mayor monto ingresado, diferenciado por contrato
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
