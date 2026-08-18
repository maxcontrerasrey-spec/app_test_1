import { useMemo } from "react";
import { useBiPresenceSummaryToday, useBiWorkforceOverview } from "../hooks/useBiQueries";
import { computePresenceSummary, formatMetricValue, formatPercentValue } from "../lib/workforceChartConfig";
import type { BiFilters } from "../types";

type BiOverviewCardsProps = {
  filters?: BiFilters;
};

type BiKpiCard = {
  title: string;
  value: string;
  caption?: string;
  tone: "bi-blue" | "bi-green" | "bi-yellow" | "bi-gray" | "bi-ready";
};

export function BiOverviewCards({ filters }: BiOverviewCardsProps) {
  const { data, isLoading, isError } = useBiWorkforceOverview(filters);
  // Presencia y ausentismo combinados se leen de get_bi_presence_summary_today
  // y NO se derivan sumando los tres conteos por tipo de
  // get_bi_workforce_overview: esos conteos son independientes entre sí, así
  // que un empleado con dos excepciones activas el mismo día (vacaciones +
  // licencia médica) quedaría contado dos veces. El RPC de presencia ya
  // resuelve la deduplicación con count(distinct). Es la misma consulta que
  // ya usa el anillo, así que React Query la sirve desde caché.
  const presenceQuery = useBiPresenceSummaryToday(filters);

  const presenceSummary = useMemo(
    () => computePresenceSummary(presenceQuery.data ?? []),
    [presenceQuery.data]
  );

  // Cada KPI expone magnitud y tasa juntas cuando ambas existen: mostrar
  // "Ausentismo 7,6%" al lado de "Presencia 1.461" obligaba a hacer el
  // cálculo mental para compararlos.
  const kpis = useMemo<BiKpiCard[]>(() => {
    if (!data) return [];

    const { totalActiveEmployees, onVacationToday, onMedicalLeaveToday, hiredThisMonth } = data;
    const ratioOfHeadcount = (value: number) =>
      totalActiveEmployees > 0
        ? `${formatPercentValue((value / totalActiveEmployees) * 100)} de la dotación`
        : undefined;

    // Presencia/ausentismo quedan en "—" si su consulta falla, en vez de
    // caer al cálculo con doble conteo: es preferible un dato ausente a un
    // dato que contradiga al anillo de más abajo.
    const presenceCard: BiKpiCard = presenceSummary
      ? {
          title: "Presencia Hoy",
          value: formatPercentValue(presenceSummary.presencePct),
          caption: `${formatMetricValue(presenceSummary.totalPresent)} personas presentes`,
          tone: "bi-green"
        }
      : { title: "Presencia Hoy", value: "—", tone: "bi-green" };

    const absenteeismCard: BiKpiCard = presenceSummary
      ? {
          title: "Ausentismo Hoy",
          value: formatPercentValue(presenceSummary.absenteeismPct),
          caption: `${formatMetricValue(presenceSummary.totalAbsent)} personas ausentes`,
          tone: "bi-yellow"
        }
      : { title: "Ausentismo Hoy", value: "—", tone: "bi-yellow" };

    return [
      {
        title: "Dotación Activa",
        value: formatMetricValue(totalActiveEmployees),
        caption: `${formatMetricValue(data.totalContracts)} contratos`,
        tone: "bi-blue"
      },
      presenceCard,
      absenteeismCard,
      {
        // Conteo de un solo tipo de excepción: no participa de la suma que
        // provocaba doble conteo, así que puede venir del overview.
        title: "Licencias Médicas Hoy",
        value: formatMetricValue(onMedicalLeaveToday),
        caption: ratioOfHeadcount(onMedicalLeaveToday),
        tone: "bi-ready"
      },
      {
        title: "Vacaciones Hoy",
        value: formatMetricValue(onVacationToday),
        caption: ratioOfHeadcount(onVacationToday),
        tone: "bi-gray"
      },
      {
        // Contexto de demanda desde el mismo RPC (openRecruitmentCases):
        // un volumen de contrataciones sin la necesidad abierta contra la
        // cual leerlo no permite juzgar si el ritmo alcanza.
        title: "Contratados del Mes",
        value: formatMetricValue(hiredThisMonth),
        caption: `${formatMetricValue(data.openRecruitmentCases)} procesos abiertos`,
        tone: "bi-blue"
      }
    ];
  }, [data, presenceSummary]);

  if (isLoading) {
    return <div className="bi-loading-state">Cargando KPIs...</div>;
  }

  if (isError || !data) {
    return <div className="bi-error-state">No se pudieron cargar los KPIs.</div>;
  }

  return (
    <div className="tracking-kpi-row bi-overview-kpi-row">
      {kpis.map((kpi) => (
        <article
          key={kpi.title}
          className={`tracking-kpi-card tracking-kpi-card-${kpi.tone} bi-overview-kpi-card`}
        >
          <span>{kpi.title}</span>
          <strong>{kpi.value}</strong>
          {kpi.caption ? <small className="bi-kpi-caption">{kpi.caption}</small> : null}
        </article>
      ))}
    </div>
  );
}
