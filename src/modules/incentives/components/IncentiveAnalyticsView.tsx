import { useMemo, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart, SelectField, TextField } from "../../../shared/ui";
import { formatCurrencyValue } from "../../../shared/lib/format";
import { useHrIncentivesAnalytics } from "../hooks/useIncentivesQueries";

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
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

  const lineOption = useMemo<EChartsCoreOption>(() => {
    const periods = analyticsQuery.data?.totalAmountByPeriod ?? [];

    return {
      tooltip: { trigger: "axis" },
      legend: { top: 0 },
      toolbox: {
        right: 8,
        feature: {
          saveAsImage: { title: "Exportar" },
          restore: { title: "Restaurar" }
        }
      },
      grid: {
        left: 24,
        right: 24,
        top: 52,
        bottom: 28,
        containLabel: true
      },
      xAxis: {
        type: "category",
        data: periods.map((item) => item.periodCode)
      },
      yAxis: {
        type: "value",
        name: "Monto"
      },
      series: [
        {
          name: "Gasto total",
          type: "line",
          smooth: true,
          areaStyle: {
            opacity: 0.12
          },
          symbol: "circle",
          symbolSize: 8,
          data: periods.map((item) => item.totalAmount)
        }
      ]
    };
  }, [analyticsQuery.data?.totalAmountByPeriod]);

  const donutOption = useMemo<EChartsCoreOption>(() => {
    const items = analyticsQuery.data?.countByIncentiveType ?? [];

    return {
      tooltip: {
        trigger: "item",
        formatter: "{b}<br/>{c} monto agregado · {d}%"
      },
      legend: { bottom: 0 },
      series: [
        {
          name: "Tipo de incentivo",
          type: "pie",
          radius: ["44%", "72%"],
          center: ["50%", "46%"],
          avoidLabelOverlap: true,
          label: {
            formatter: "{b}\n{d}%"
          },
          emphasis: {
            scale: true,
            scaleSize: 8
          },
          data: items.map((item) => ({
            name: item.incentiveTypeName,
            value: item.totalAmount
          }))
        }
      ]
    };
  }, [analyticsQuery.data?.countByIncentiveType]);

  const deviationsOption = useMemo<EChartsCoreOption>(() => {
    const items = analyticsQuery.data?.deviationsByContract.slice(0, 8) ?? [];

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { top: 0 },
      grid: {
        left: 24,
        right: 24,
        top: 52,
        bottom: 28,
        containLabel: true
      },
      xAxis: {
        type: "value",
        name: "Solicitudes"
      },
      yAxis: {
        type: "category",
        data: items.map((item) => item.contractCode)
      },
      series: [
        {
          name: "Fuera de plazo",
          type: "bar",
          stack: "desviaciones",
          data: items.map((item) => item.outOfDeadlineCount)
        },
        {
          name: "Contrato distinto",
          type: "bar",
          stack: "desviaciones",
          data: items.map((item) => item.contractMismatchCount)
        }
      ]
    };
  }, [analyticsQuery.data?.deviationsByContract]);

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

        <div className="tracking-filters hr-incentives-analytics-filters">
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
        <article className="info-card hr-incentives-analytics-card">
          <div className="hr-incentives-analytics-card-header">
            <h4>Evolución del gasto</h4>
            <span className="tracking-filter-caption">Monto agregado por período</span>
          </div>
          <EChart
            option={lineOption}
            height={340}
            loading={analyticsQuery.isLoading}
            empty={(analyticsQuery.data?.totalAmountByPeriod.length ?? 0) === 0}
            emptyMessage="No hay períodos para el filtro actual."
          />
        </article>

        <article className="info-card hr-incentives-analytics-card">
          <div className="hr-incentives-analytics-card-header">
            <h4>Distribución por tipo</h4>
            <span className="tracking-filter-caption">Participación del presupuesto por incentivo</span>
          </div>
          <EChart
            option={donutOption}
            height={340}
            renderer="svg"
            loading={analyticsQuery.isLoading}
            empty={(analyticsQuery.data?.countByIncentiveType.length ?? 0) === 0}
            emptyMessage="No hay tipos de incentivo para el filtro actual."
          />
        </article>

        <article className="info-card hr-incentives-analytics-card hr-incentives-analytics-card-wide">
          <div className="hr-incentives-analytics-card-header">
            <h4>Top desviaciones operacionales</h4>
            <span className="tracking-filter-caption">
              Contratos con mayor concentración de fuera de plazo y contrato distinto
            </span>
          </div>
          <EChart
            option={deviationsOption}
            height={380}
            loading={analyticsQuery.isLoading}
            empty={(analyticsQuery.data?.deviationsByContract.length ?? 0) === 0}
            emptyMessage="No hay desviaciones para el filtro actual."
          />
        </article>
      </div>
    </section>
  );
}
