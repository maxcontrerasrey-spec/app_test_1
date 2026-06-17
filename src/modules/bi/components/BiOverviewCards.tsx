import { useBiWorkforceOverview } from "../hooks/useBiQueries";

export function BiOverviewCards() {
  const { data, isLoading, isError } = useBiWorkforceOverview();

  if (isLoading) {
    return <div className="bi-overview-row">Cargando KPIs...</div>;
  }

  if (isError || !data) {
    return <div className="bi-error-state">No se pudieron cargar los KPIs.</div>;
  }

  const kpis = [
    { title: "Dotación Activa", value: data.totalActiveEmployees.toLocaleString() },
    { title: "Contratos Activos", value: data.totalContracts.toLocaleString() },
    { title: "Presencia Hoy", value: (data.totalActiveEmployees - data.onVacationToday - data.onMedicalLeaveToday - data.otherAbsencesToday).toLocaleString() },
    { title: "Licencias Médicas Hoy", value: data.onMedicalLeaveToday.toLocaleString() },
    { title: "Vacaciones Hoy", value: data.onVacationToday.toLocaleString() },
    { title: "Contratados del Mes", value: data.hiredThisMonth.toLocaleString() }
  ];

  return (
    <div className="bi-overview-row">
      {kpis.map((kpi, idx) => (
        <div key={idx} className="bi-stat-card">
          <div className="bi-stat-card-title">{kpi.title}</div>
          <div className="bi-stat-card-value">{kpi.value}</div>
        </div>
      ))}
    </div>
  );
}
