import { useBiWorkforceOverview } from "../hooks/useBiQueries";
import type { BiFilters } from "../types";

type BiOverviewCardsProps = {
  filters?: BiFilters;
};

export function BiOverviewCards({ filters }: BiOverviewCardsProps) {
  const { data, isLoading, isError } = useBiWorkforceOverview(filters);

  if (isLoading) {
    return <div className="bi-overview-row">Cargando KPIs...</div>;
  }

  if (isError || !data) {
    return <div className="bi-error-state">No se pudieron cargar los KPIs.</div>;
  }

  const kpis = [
    { title: "Dotación Activa", value: data.totalActiveEmployees.toLocaleString("es-CL"), type: "generado" },
    { title: "Contratos Activos", value: data.totalContracts.toLocaleString("es-CL"), type: "pendiente" },
    { title: "Presencia Hoy", value: (data.totalActiveEmployees - data.onVacationToday - data.onMedicalLeaveToday - data.otherAbsencesToday).toLocaleString("es-CL"), type: "en-proceso" },
    { title: "Licencias Médicas Hoy", value: data.onMedicalLeaveToday.toLocaleString("es-CL"), type: "error" },
    { title: "Vacaciones Hoy", value: data.onVacationToday.toLocaleString("es-CL"), type: "pendiente" },
    { title: "Contratados del Mes", value: data.hiredThisMonth.toLocaleString("es-CL"), type: "generado" }
  ];

  return (
    <div className="tracking-kpi-row bi-overview-kpi-row">
      {kpis.map((kpi, idx) => (
        <article key={idx} className={`tracking-kpi-card tracking-kpi-card-${kpi.type} bi-overview-kpi-card`}>
          <span>{kpi.title}</span>
          <strong>{kpi.value}</strong>
        </article>
      ))}
    </div>
  );
}
