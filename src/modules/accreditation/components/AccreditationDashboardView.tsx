import { ChangeEvent } from "react";
import { SelectField, TextField } from "../../../shared/ui";
import { useAccreditationDashboard, useAccreditationSetupCatalogs } from "../hooks/useAccreditationQueries";

type Props = {
  siteId: string;
  jobTitle: string;
  onSiteIdChange: (value: string) => void;
  onJobTitleChange: (value: string) => void;
};

export function AccreditationDashboardView({
  siteId,
  jobTitle,
  onSiteIdChange,
  onJobTitleChange
}: Props) {
  const setupQuery = useAccreditationSetupCatalogs();
  const dashboardQuery = useAccreditationDashboard({ siteId: siteId || null, jobTitle });

  const siteOptions = (setupQuery.data?.sites ?? [])
    .filter((site) => site.isActive)
    .map((site) => ({
      value: site.id,
      label: site.contractCode ? `${site.name} · ${site.contractCode}` : site.name
    }));

  const summary = dashboardQuery.data?.summary;

  return (
    <section className="tracking-panel accreditation-panel">
      <div className="field-grid accreditation-filter-grid">
        <SelectField
          id="accreditation-dashboard-site"
          label="Faena"
          value={siteId}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => onSiteIdChange(event.target.value)}
          options={siteOptions}
          placeholder="Todas las faenas"
        />
        <TextField
          id="accreditation-dashboard-job-title"
          label="Cargo"
          value={jobTitle}
          onChange={(event) => onJobTitleChange(event.target.value)}
          placeholder="Filtra por cargo exacto"
        />
      </div>

      {dashboardQuery.isLoading ? <p className="tracking-filter-caption">Cargando dashboard...</p> : null}
      {dashboardQuery.error ? (
        <p className="tracking-filter-caption" style={{ color: "var(--danger-700)" }}>
          {dashboardQuery.error.message}
        </p>
      ) : null}

      {summary ? (
        <>
          <div className="accreditation-kpi-grid">
            <article className="info-card accreditation-kpi accreditation-kpi-approved">
              <h3>Acreditados</h3>
              <strong>{summary.approved}</strong>
              <p>Total universo: {summary.totalWorkers}</p>
            </article>
            <article className="info-card accreditation-kpi accreditation-kpi-warning">
              <h3>Por vencer</h3>
              <strong>{summary.expiringSoon}</strong>
              <p>7 dias: {summary.expiringIn7Days} · 15 dias: {summary.expiringIn15Days}</p>
            </article>
            <article className="info-card accreditation-kpi accreditation-kpi-pending">
              <h3>Pendientes</h3>
              <strong>{summary.pending}</strong>
              <p>Requieren accion documental o aprobacion.</p>
            </article>
            <article className="info-card accreditation-kpi accreditation-kpi-expired">
              <h3>Vencidos</h3>
              <strong>{summary.expired}</strong>
              <p>30 dias: {summary.expiringIn30Days}</p>
            </article>
          </div>

          <div className="accreditation-dashboard-columns">
            <article className="info-card accreditation-list-card">
              <h3>Distribucion por Faena</h3>
              <div className="accreditation-list-table">
                {(dashboardQuery.data?.bySite ?? []).map((item) => (
                  <div key={item.siteId} className="accreditation-list-row">
                    <div>
                      <strong>{item.siteName}</strong>
                      <p>{item.totalWorkers} trabajador(es)</p>
                    </div>
                    <div className="accreditation-mini-stats">
                      <span>Aprobados: {item.approved}</span>
                      <span>Pendientes: {item.pending}</span>
                      <span>Por vencer: {item.expiringSoon}</span>
                      <span>Vencidos: {item.expired}</span>
                    </div>
                  </div>
                ))}
                {(dashboardQuery.data?.bySite ?? []).length === 0 ? (
                  <p className="tracking-filter-caption">No hay faenas con acreditaciones aun.</p>
                ) : null}
              </div>
            </article>

            <article className="info-card accreditation-list-card">
              <h3>Trabajadores criticos</h3>
              <div className="accreditation-list-table">
                {(dashboardQuery.data?.expiringWorkers ?? []).map((worker) => (
                  <div key={`${worker.workerAccreditationId}-${worker.bukEmployeeId}`} className="accreditation-list-row">
                    <div>
                      <strong>{worker.fullName}</strong>
                      <p>{worker.siteName}</p>
                    </div>
                    <div className="accreditation-mini-stats">
                      <span>{worker.jobTitle ?? "Sin cargo"}</span>
                      <span>{worker.accreditationExpiryDate ?? "Sin vencimiento"}</span>
                      <span className={`accreditation-status accreditation-status-${worker.status}`}>
                        {worker.status}
                      </span>
                    </div>
                  </div>
                ))}
                {(dashboardQuery.data?.expiringWorkers ?? []).length === 0 ? (
                  <p className="tracking-filter-caption">No hay vencimientos proximos en la muestra actual.</p>
                ) : null}
              </div>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
