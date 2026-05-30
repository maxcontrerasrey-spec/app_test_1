import { DatePickerField } from "../../../shared/ui";
import type { DashboardSummary } from "../types";

interface OperationsSummaryProps {
  dashboardContract: string;
  setDashboardContract: (value: string) => void;
  contractOptions: string[];
  dashboardDateFrom: string;
  setDashboardDateFrom: (value: string) => void;
  dashboardDateTo: string;
  setDashboardDateTo: (value: string) => void;
  dashboardSummary: DashboardSummary;
  dashboardLoading: boolean;
  dashboardError: string;
}

export function OperationsSummary({
  dashboardContract,
  setDashboardContract,
  contractOptions,
  dashboardDateFrom,
  setDashboardDateFrom,
  dashboardDateTo,
  setDashboardDateTo,
  dashboardSummary,
  dashboardLoading,
  dashboardError
}: OperationsSummaryProps) {
  const dashboardCompletionRate =
    dashboardSummary.totalExpected > 0 ? Math.round((dashboardSummary.totalPlanned / dashboardSummary.totalExpected) * 100) : 0;

  return (
    <section className="operations-page-shell">
      <section className="dashboard-hero operations-page-hero">
        <div className="dashboard-hero__copy">
          <h3>Resumen</h3>
          <p>Indicadores operacionales alimentados desde los registros históricos de planificación.</p>
        </div>
      </section>

      <section className="operations-control-grid operations-control-grid--summary">
        <section className="panel operations-panel">
          <p className="panel-label">Resumen</p>
          <label>
            <span>Contrato</span>
            <select value={dashboardContract} onChange={(event) => setDashboardContract(event.target.value)}>
              <option value="">Todos los contratos</option>
              {contractOptions.map((contract) => (
                <option key={contract} value={contract}>
                  {contract}
                </option>
              ))}
            </select>
          </label>
          <div className="operations-inline-fields">
            <DatePickerField id="dashboard-date-from" label="Desde" value={dashboardDateFrom} onChange={setDashboardDateFrom} />
            <DatePickerField id="dashboard-date-to" label="Hasta" value={dashboardDateTo} onChange={setDashboardDateTo} />
          </div>
        </section>

        <section className="panel operations-panel metrics operations-metrics-panel">
          <article>
            <span>Planificados</span>
            <strong>{dashboardSummary.totalPlanned}</strong>
          </article>
          <article>
            <span>Base habilitada</span>
            <strong>{dashboardSummary.totalExpected}</strong>
          </article>
          <article>
            <span>Cobertura</span>
            <strong>{dashboardCompletionRate}%</strong>
          </article>
        </section>
      </section>

      <section className="dashboard-shell">
        <section className="dashboard-cards">
          <article className="dashboard-card">
            <span>Servicios planificados</span>
            <strong>{dashboardSummary.totalPlanned}</strong>
            <small>Registros guardados en el rango seleccionado.</small>
          </article>
          <article className="dashboard-card">
            <span>Servicios base habilitados</span>
            <strong>{dashboardSummary.totalExpected}</strong>
            <small>Servicios programables según periodicidad y contrato.</small>
          </article>
          <article className="dashboard-card">
            <span>Conductores en turno</span>
            <strong>{dashboardSummary.totalInTurn}</strong>
            <small>Conductores distintos marcados como en turno.</small>
          </article>
          <article className="dashboard-card">
            <span>Conductores fuera de turno</span>
            <strong>{dashboardSummary.totalOutOfTurn}</strong>
            <small>Conductores distintos marcados como fuera de turno.</small>
          </article>
        </section>

        <section className="dashboard-table-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Dashboard</p>
              <h3>Servicios planificados vs base habilitada por contrato</h3>
            </div>
          </div>

          {dashboardError ? <p className="submit-feedback submit-feedback--error">{dashboardError}</p> : null}

          <div className="dashboard-table">
            <div className="dashboard-table__head">
              <span>Contrato</span>
              <span>Planificados</span>
              <span>Base habilitada</span>
              <span>En turno</span>
              <span>Fuera de turno</span>
              <span>Cobertura</span>
            </div>

            {dashboardLoading ? (
              <div className="dashboard-table__row dashboard-table__row--empty">
                <span>Cargando indicadores...</span>
              </div>
            ) : dashboardSummary.byContract.length > 0 ? (
              dashboardSummary.byContract.map((item) => (
                <div key={item.contractCode} className="dashboard-table__row">
                  <strong>{item.contractCode}</strong>
                  <span>{item.plannedServices}</span>
                  <span>{item.expectedServices}</span>
                  <span>{item.inTurnWorkers}</span>
                  <span>{item.outOfTurnWorkers}</span>
                  <span>{item.completionRate}%</span>
                </div>
              ))
            ) : (
              <div className="dashboard-table__row dashboard-table__row--empty">
                <span>No hay datos para el rango seleccionado.</span>
              </div>
            )}
          </div>
        </section>
      </section>
    </section>
  );
}
