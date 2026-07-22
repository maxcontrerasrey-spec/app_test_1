import { formatDateForDisplay } from "../../../shared/lib/date";
import type { CompetencyDashboardPayload, CompetencyDashboardRow } from "../types";

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    "": "No informado",
    draft: "Borrador",
    submitted: "Emitida",
    completed: "Completada",
    generated: "Generado",
    uploaded_to_buk: "Cargado BUK",
    buk_upload_failed: "BUK pendiente",
    enabled: "Habilitado",
    expired: "Vencido",
    pending: "Pendiente",
    success: "Correcto",
    failed: "Fallido",
    not_started: "No iniciado"
  };
  return labels[value] ?? value;
}

function formatDateLabel(value: string | null | undefined) {
  return value ? formatDateForDisplay(value.slice(0, 10)) || "Sin fecha" : "Sin fecha";
}

function getCertificateValidity(row: CompetencyDashboardRow) {
  if (row.certificateStatus === "revoked" || row.certificateStatus === "annulled") {
    return { label: "Revocado", tone: "danger" };
  }

  if (row.certificateStatus === "replaced") {
    return { label: "Reemplazado", tone: "warning" };
  }

  if (!row.validUntil) {
    return { label: "Sin vigencia", tone: "neutral" };
  }

  const [year, month, day] = row.validUntil.slice(0, 10).split("-").map(Number);
  const validUntilDate = new Date(year, month - 1, day);
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.ceil((validUntilDate.getTime() - todayDate.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return { label: "Vencido", tone: "danger" };
  }

  if (diffDays <= 30) {
    return { label: `Vence en ${diffDays} dias`, tone: "warning" };
  }

  return { label: "Vigente", tone: "success" };
}

type CompetencyCertificateSummaryPanelProps = {
  dashboard: CompetencyDashboardPayload | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
};

export function CompetencyCertificateSummaryPanel({
  dashboard,
  isLoading,
  errorMessage,
  onRetry
}: CompetencyCertificateSummaryPanelProps) {
  const summary = dashboard?.summary;
  const recent = dashboard?.recent ?? [];

  return (
    <section className="competency-summary-panel" aria-label="Resumen de certificados generados">
      <div className="competency-section-heading">
        <h2>Resumen de Certificados</h2>
        <span>Generacion y vigencia</span>
      </div>

      {errorMessage ? (
        <div className="competency-alert">
          {errorMessage}
          <button type="button" className="competency-inline-action" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      ) : null}

      <div className="competency-summary-grid" aria-busy={isLoading}>
        <article>
          <span>Total certificados</span>
          <strong>{isLoading ? "-" : summary?.total ?? 0}</strong>
          <small>Registros creados</small>
        </article>
        <article>
          <span>Generados</span>
          <strong>{isLoading ? "-" : summary?.generated ?? summary?.enabled ?? 0}</strong>
          <small>PDF emitido o cargado</small>
        </article>
        <article>
          <span>Por vencer</span>
          <strong>{isLoading ? "-" : summary?.expiring30 ?? 0}</strong>
          <small>Proximos 30 dias</small>
        </article>
        <article>
          <span>Vencidos</span>
          <strong>{isLoading ? "-" : summary?.expired ?? 0}</strong>
          <small>Fuera de vigencia</small>
        </article>
        <article>
          <span>Pendiente BUK</span>
          <strong>{isLoading ? "-" : summary?.pendingBuk ?? 0}</strong>
          <small>Carga documental</small>
        </article>
      </div>

      <div className="competency-validity-card">
        <div className="competency-validity-card__header">
          <div>
            <h3>Certificados recientes</h3>
            <p>Ultimos 50 registros visibles segun permisos del usuario.</p>
          </div>
          <button type="button" className="competency-inline-action" onClick={onRetry} disabled={isLoading}>
            Actualizar
          </button>
        </div>

        {isLoading ? (
          <div className="competency-summary-empty">Cargando resumen de certificados...</div>
        ) : recent.length === 0 ? (
          <div className="competency-summary-empty">No hay certificados generados para mostrar.</div>
        ) : (
          <div className="competency-summary-table" role="table" aria-label="Vigencia de certificados recientes">
            <div className="competency-summary-table__head" role="row">
              <span>Folio</span>
              <span>Trabajador</span>
              <span>Modelos</span>
              <span>Vigencia</span>
              <span>Estado</span>
            </div>
            {recent.map((row) => {
              const validity = getCertificateValidity(row);

              return (
                <div className="competency-summary-table__row" role="row" key={row.certificateId}>
                  <strong>{row.folio}</strong>
                  <span>
                    {row.workerFullName}
                    <small>{row.workerDocumentNumber}</small>
                  </span>
                  <span>{row.modelSummary || "Sin modelos informados"}</span>
                  <span>
                    {formatDateLabel(row.validUntil)}
                    <small className={`competency-validity-badge competency-validity-badge--${validity.tone}`}>
                      {validity.label}
                    </small>
                  </span>
                  <span>
                    {statusLabel(row.certificateStatus)}
                    <small>{statusLabel(row.bukUploadStatus)}</small>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
