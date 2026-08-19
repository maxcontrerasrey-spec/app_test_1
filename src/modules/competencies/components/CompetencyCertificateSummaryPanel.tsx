import { useEffect, useRef, useState } from "react";
import { formatDateForDisplay } from "../../../shared/lib/date";
import { decideCompetencyLegalApproval, fetchCompetencyLegalApprovalQueue } from "../services/competencyLegalApprovalApi";
import type { CompetencyDashboardPayload, CompetencyDashboardRow, CompetencyLegalApproval } from "../types";

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    "": "No informado",
    draft: "Borrador",
    submitted: "Emitida",
    completed: "Completada",
    generated: "Generado",
    uploaded_to_buk: "Cargado BUK",
    rejected: "Rechazado",
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

  if (row.certificateStatus === "rejected") {
    return { label: "Rechazado", tone: "danger" };
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
  const [legalApprovals, setLegalApprovals] = useState<CompetencyLegalApproval[]>([]);
  const [legalApprovalError, setLegalApprovalError] = useState<string | null>(null);
  const [legalApprovalBusy, setLegalApprovalBusy] = useState<string | null>(null);
  const reconciliationInFlight = useRef(false);

  async function loadLegalApprovals() {
    try {
      setLegalApprovalError(null);
      setLegalApprovals(await fetchCompetencyLegalApprovalQueue());
    } catch {
      setLegalApprovals([]);
      setLegalApprovalError(null);
    }
  }

  useEffect(() => {
    void loadLegalApprovals();
  }, []);

  useEffect(() => {
    if (reconciliationInFlight.current || !dashboard?.recent.length) return;
    const pendingApproved = dashboard.recent.filter(
      (row) => row.legalApprovalStatus === "approved" && ["not_generated", "queued"].includes(row.certificateStatus)
    );
    if (pendingApproved.length === 0) return;
    reconciliationInFlight.current = true;
    void (async () => {
      try {
        const { generateCompetencyCertificate } = await import("../services/competencyApi");
        await Promise.allSettled(pendingApproved.map((row) => generateCompetencyCertificate(row.requestId)));
        onRetry();
      } finally {
        reconciliationInFlight.current = false;
      }
    })();
  }, [dashboard, onRetry]);

  async function resolveLegalApproval(item: CompetencyLegalApproval, decision: "approved" | "rejected") {
    const rejectionReason = decision === "rejected"
      ? window.prompt("Indica el motivo del rechazo legal:")?.trim() ?? ""
      : undefined;
    if (decision === "rejected" && !rejectionReason) return;

    setLegalApprovalBusy(item.certificateId);
    try {
      await decideCompetencyLegalApproval(item.certificateId, decision, rejectionReason);
      if (decision === "approved") {
        const { generateCompetencyCertificate } = await import("../services/competencyApi");
        await generateCompetencyCertificate(item.requestId);
      }
      await loadLegalApprovals();
      onRetry();
    } catch (error) {
      setLegalApprovalError(error instanceof Error ? error.message : String(error));
    } finally {
      setLegalApprovalBusy(null);
    }
  }

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

      {legalApprovalError ? <div className="competency-alert">{legalApprovalError}</div> : null}
      {legalApprovals.length > 0 ? (
        <section className="competency-legal-approval-panel" aria-label="Aprobaciones legales pendientes">
          <div className="competency-validity-card__header">
            <div>
              <h3>Aprobaciones Representante Legal</h3>
              <p>Certificados Codelco El Salvador bloqueados hasta la resolución de Guillermo Zañartu Apara.</p>
            </div>
            <button type="button" className="competency-inline-action" onClick={() => void loadLegalApprovals()}>
              Actualizar
            </button>
          </div>
          <div className="competency-legal-approval-list">
            {legalApprovals.map((item) => (
              <article className="competency-legal-approval-card" key={item.certificateId}>
                <div>
                  <strong>{item.workerFullName}</strong>
                  <small>{item.workerDocumentNumber} · {item.folio}</small>
                  <small>{item.workerJobTitle || "Cargo no informado"} · {item.workerAreaName || "Faena no informada"}</small>
                </div>
                <div className="competency-legal-approval-card__meta">
                  <span>{item.legalSignerName}</span>
                  <small>{item.legalSignerRole} · {item.legalSignerDocumentNumber || "RUN pendiente de BUK"}</small>
                  <small>Capacitación: {formatDateLabel(item.trainingDate)}</small>
                </div>
                <div className="competency-legal-approval-card__actions">
                  <button type="button" className="competency-inline-action competency-inline-action--success" disabled={legalApprovalBusy === item.certificateId} onClick={() => void resolveLegalApproval(item, "approved")}>
                    Aprobar firma
                  </button>
                  <button type="button" className="competency-inline-action competency-inline-action--danger" disabled={legalApprovalBusy === item.certificateId} onClick={() => void resolveLegalApproval(item, "rejected")}>
                    Rechazar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
