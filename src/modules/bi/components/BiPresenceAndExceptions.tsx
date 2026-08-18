import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiPresenceSummaryToday, useBiExceptionsToday } from "../hooks/useBiQueries";
import { EChartSurface, useChartTheme } from "../../../shared/ui";
import { computePresenceSummary, formatMetricValue, formatPercentValue, WORKFORCE_PALETTE } from "../lib/workforceChartConfig";
import type { BiFilters } from "../types";

type BiPresenceAndExceptionsProps = {
  filters?: BiFilters;
};

const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  vacation: "Vacaciones",
  medical_leave: "Licencia médica",
  absent: "Ausencia",
  administrative_leave: "Permiso administrativo",
  union_leave: "Permiso sindical"
};

function exceptionTypeLabel(type: string) {
  return EXCEPTION_TYPE_LABELS[type] ?? type;
}

export function BiPresenceAndExceptions({ filters }: BiPresenceAndExceptionsProps) {
  const { data: presenceData, isLoading: isLoadingPresence, isError: isErrorPresence } = useBiPresenceSummaryToday(filters);
  const { data: exceptionsData, isLoading: isLoadingExceptions, isError: isErrorExceptions } = useBiExceptionsToday(filters);
  const chartTheme = useChartTheme();
  const palette = WORKFORCE_PALETTE[chartTheme.mode];

  // Mismo helper que alimenta las tarjetas KPI superiores: el anillo y el
  // KPI de Presencia no pueden divergir porque comparten la única
  // implementación del cálculo.
  const presenceSummary = useMemo(() => computePresenceSummary(presenceData ?? []), [presenceData]);

  const presenceRingOption = useMemo<EChartsOption | null>(() => {
    if (!presenceSummary || presenceSummary.totalHeadcount === 0) return null;

    return {
      tooltip: {
        trigger: "item",
        backgroundColor: chartTheme.tooltipSurface,
        textStyle: { color: chartTheme.tooltipText },
        formatter: () =>
          `<div class="chart-tooltip"><div class="chart-tooltip-title">Presencia hoy</div><div class="chart-tooltip-list">` +
          `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Presentes</span><strong>${formatMetricValue(presenceSummary.totalPresent)}</strong></div>` +
          `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Ausentes</span><strong>${formatMetricValue(presenceSummary.totalAbsent)}</strong></div>` +
          `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Dotación total</span><strong>${formatMetricValue(presenceSummary.totalHeadcount)}</strong></div>` +
          `<div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Presencia</span><strong>${formatPercentValue(presenceSummary.presencePct)}</strong></div>` +
          `</div></div>`
      },
      series: [
        {
          type: "pie",
          radius: ["72%", "92%"],
          center: ["50%", "50%"],
          label: { show: false },
          labelLine: { show: false },
          emphasis: { scale: false },
          itemStyle: { borderRadius: 6, borderColor: chartTheme.surface, borderWidth: 2 },
          data: [
            { name: "Presentes", value: presenceSummary.totalPresent, itemStyle: { color: palette.presence } },
            { name: "Ausentes", value: presenceSummary.totalAbsent, itemStyle: { color: palette.track } }
          ]
        }
      ]
    };
  }, [chartTheme, palette, presenceSummary]);

  const exceptionRows = useMemo(() => {
    if (!exceptionsData || exceptionsData.length === 0) return [];
    const totals = new Map<string, number>();
    exceptionsData.forEach((row) => {
      totals.set(row.exceptionType, (totals.get(row.exceptionType) ?? 0) + row.totalPersons);
    });
    const totalAbsent = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
    return Array.from(totals.entries())
      .map(([type, value]) => ({
        type,
        label: exceptionTypeLabel(type),
        value,
        pct: totalAbsent > 0 ? (value / totalAbsent) * 100 : 0
      }))
      .sort((left, right) => right.value - left.value);
  }, [exceptionsData]);

  const totalExceptionPersons = exceptionRows.reduce((sum, row) => sum + row.value, 0);

  const compositionOption = useMemo<EChartsOption | null>(() => {
    const colorForExceptionType = (type: string) => {
      if (type === "vacation") return palette.vacation;
      if (type === "medical_leave") return palette.medicalLeave;
      return palette.otherAbsence;
    };

    if (exceptionRows.length === 0) return null;

    return {
      tooltip: {
        trigger: "item",
        backgroundColor: chartTheme.tooltipSurface,
        textStyle: { color: chartTheme.tooltipText },
        formatter: (raw: unknown) => {
          const point = Array.isArray(raw) ? raw[0] : raw;
          const name = String(point?.name ?? "");
          const row = exceptionRows.find((item) => item.label === name);
          if (!row) return name;
          return `<div class="chart-tooltip"><div class="chart-tooltip-title">${row.label}</div><div class="chart-tooltip-list"><div class="chart-tooltip-item"><span class="chart-tooltip-item-label">Personas</span><strong>${formatMetricValue(row.value)}</strong></div><div class="chart-tooltip-item"><span class="chart-tooltip-item-label">% del ausentismo</span><strong>${formatPercentValue(row.pct)}</strong></div></div></div>`;
        }
      },
      legend: { bottom: 0, icon: "circle", textStyle: { color: chartTheme.text } },
      series: [
        {
          type: "pie",
          radius: ["48%", "74%"],
          center: ["50%", "42%"],
          itemStyle: { borderRadius: 8, borderColor: chartTheme.surface, borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: exceptionRows.map((row) => ({
            name: row.label,
            value: row.value,
            itemStyle: { color: colorForExceptionType(row.type) }
          }))
        }
      ]
    };
  }, [chartTheme, exceptionRows, palette]);

  return (
    <div className="bi-chart-row">
      <div className="info-card">
        <h3 className="bi-chart-title">Presencia General Hoy</h3>
        {presenceSummary && presenceRingOption ? (
          <div className="bi-presence-ring-layout">
            <div className="bi-donut-center-wrap bi-presence-ring-chart">
              <EChartSurface height={220} option={presenceRingOption} />
              <div className="bi-donut-center-label bi-presence-ring-label">
                <strong>{formatPercentValue(presenceSummary.presencePct)}</strong>
              </div>
            </div>
            <div className="bi-presence-ring-stats">
              <p>
                <strong>{formatMetricValue(presenceSummary.totalPresent)}</strong> presentes de{" "}
                {formatMetricValue(presenceSummary.totalHeadcount)} personas
              </p>
              <p className="bi-presence-ring-absent">{formatMetricValue(presenceSummary.totalAbsent)} ausentes</p>
            </div>
          </div>
        ) : (
          <EChartSurface
            height={280}
            option={{}}
            loading={isLoadingPresence}
            empty={!isLoadingPresence}
            emptyMessage={isErrorPresence ? "No se pudo cargar la presencia." : "No hay datos para los filtros seleccionados."}
            loadingMessage="Cargando datos..."
          />
        )}
      </div>
      <div className="info-card">
        <h3 className="bi-chart-title">Composición de Ausentismo Hoy</h3>
        {compositionOption ? (
          <div className="bi-donut-center-wrap">
            <EChartSurface height={280} option={compositionOption} />
            <div className="bi-donut-center-label" style={{ top: "42%" }}>
              <strong>{formatMetricValue(totalExceptionPersons)}</strong>
              <span>personas</span>
            </div>
          </div>
        ) : (
          <EChartSurface
            height={280}
            option={{}}
            loading={isLoadingExceptions}
            empty={!isLoadingExceptions}
            emptyMessage={isErrorExceptions ? "No se pudo cargar el ausentismo." : "No hay ausencias hoy para los filtros seleccionados."}
            loadingMessage="Cargando datos..."
          />
        )}
      </div>
    </div>
  );
}
