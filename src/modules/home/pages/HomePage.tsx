import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/context/AuthContext";
import { supabase } from "../../../shared/lib/supabase";
import {
  formatRequestDate,
  formatDaysSince,
  formatCurrencyValue,
  formatBooleanLabel,
  formatPersonLabel,
} from "../../../shared/lib/format";
import {
  decideHiringApproval,
  toHiringStatusLabel,
  type HiringWorkflowStatus
} from "../../recruitment/services/hiringWorkflow";

type HiringRequestSummaryRow = {
  id: string;
  folio: string | null;
  status: HiringWorkflowStatus;
  contract_name: string;
  job_position_name: string;
  vacancies?: number | null;
  submitted_at?: string | null;
  created_at: string;
};

type PendingApprovalRow = {
  id: number;
  step_name: string;
  step_code?: string;
  hiring_request_id: string;
  approver_user_id?: string;
  hiring_requests:
    | {
        folio: string | null;
        contract_name: string;
        contract_number?: string | null;
        job_position_name: string;
        requester_name?: string | null;
        requester_email?: string | null;
        vacancies?: number | null;
        requested_entry_date?: string | null;
        start_date?: string | null;
        end_date?: string | null;
        shift_name?: string | null;
        status?: string | null;
        salary_offer?: number | null;
        campamento?: boolean | null;
        pasajes?: boolean | null;
        other_benefits?: string | null;
      }
    | {
        folio: string | null;
        contract_name: string;
        contract_number?: string | null;
        job_position_name: string;
        requester_name?: string | null;
        requester_email?: string | null;
        vacancies?: number | null;
        requested_entry_date?: string | null;
        start_date?: string | null;
        end_date?: string | null;
        shift_name?: string | null;
        status?: string | null;
        salary_offer?: number | null;
        campamento?: boolean | null;
        pasajes?: boolean | null;
        other_benefits?: string | null;
      }[]
    | null;
};

export function HomePage() {
  const { user, appRoles, isSuperAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [myRequests, setMyRequests] = useState<HiringRequestSummaryRow[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalRow[]>([]);
  const [isDecisionLoading, setIsDecisionLoading] = useState<number | null>(null);
  const [decisionMessage, setDecisionMessage] = useState("");
  const [selectedApproval, setSelectedApproval] = useState<PendingApprovalRow | null>(null);
  const [decisionComment, setDecisionComment] = useState("");

  const loadHomeSummary = useCallback(async () => {
    if (!supabase || !user?.id) {
      setMyRequests([]);
      setPendingApprovals([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.rpc("get_home_dashboard_summary");

    if (error) {
      setErrorMessage("No fue posible cargar el resumen del inicio.");
      setMyRequests([]);
      setPendingApprovals([]);
      setIsLoading(false);
      return;
    }

    const payload = (data ?? {}) as {
      my_requests?: HiringRequestSummaryRow[] | null;
      pending_approvals?: PendingApprovalRow[] | null;
    };

    setMyRequests(payload.my_requests ?? []);
    setPendingApprovals(payload.pending_approvals ?? []);
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      await loadHomeSummary();
      if (!isMounted) {
        return;
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [loadHomeSummary]);

  const isApprover =
    isSuperAdmin ||
    appRoles.includes("admin") ||
    appRoles.includes("aprobador_folios") ||
    appRoles.includes("control_contratos") ||
    pendingApprovals.length > 0;

  const pendingApprovalsCount = pendingApprovals.length;

  const handleApprovalDecision = async (approvalId: number, decision: "approved" | "rejected") => {
    setIsDecisionLoading(approvalId);
    setDecisionMessage("");
    const { error } = await decideHiringApproval({
      approvalId,
      decision,
      comment: selectedApproval?.id === approvalId ? decisionComment : null
    });

    if (error) {
      setDecisionMessage(error);
      setIsDecisionLoading(null);
      return;
    }

    setDecisionMessage(decision === "approved" ? "Aprobación registrada." : "Rechazo registrado.");
    setIsDecisionLoading(null);
    setSelectedApproval(null);
    setDecisionComment("");
    await loadHomeSummary();
  };

  return (
    <section className="page">
      {isApprover ? (
        <article className="info-card approval-panel-card approval-panel-primary">
          <div className="home-section-header">
            <div>
              <h3>Aprobaciones pendientes</h3>
              <p>
                {isLoading
                  ? "Cargando aprobaciones..."
                  : `${pendingApprovalsCount} pendientes de decisión`}
              </p>
            </div>
            <div className="home-section-meta">
              {errorMessage ? <span>{errorMessage}</span> : null}
              <Link to="/solicitud-contrataciones">Crear nueva solicitud</Link>
            </div>
          </div>

          {pendingApprovals.length === 0 ? (
            <p>{isLoading ? "Cargando pendientes..." : "No tienes pendientes."}</p>
          ) : (
            <ul className="approval-queue">
              {pendingApprovals.map((approval) => {
                const request = Array.isArray(approval.hiring_requests)
                  ? approval.hiring_requests[0]
                  : approval.hiring_requests;

                return (
                  <li key={approval.id} className="approval-queue-item">
                    <div className="approval-queue-copy">
                      <strong>{request?.folio ?? "Sin folio"}</strong>
                      <span>{approval.step_name}</span>
                      <span>{request?.job_position_name ?? "Cargo no disponible"}</span>
                      <span>{request?.contract_name ?? "Contrato no disponible"}</span>
                    </div>
                    <div className="approval-action-row">
                      <button
                        type="button"
                        className="soft-primary-button approval-button-detail"
                        onClick={() => {
                          setSelectedApproval(approval);
                          setDecisionComment("");
                        }}
                      >
                        Ver detalle
                      </button>
                      <button
                        type="button"
                        className="soft-primary-button approval-button-approve"
                        disabled={isDecisionLoading === approval.id}
                        onClick={() => handleApprovalDecision(approval.id, "approved")}
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        className="soft-primary-button approval-button-reject"
                        disabled={isDecisionLoading === approval.id}
                        onClick={() => handleApprovalDecision(approval.id, "rejected")}
                      >
                        Rechazar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {decisionMessage ? <p className="form-status">{decisionMessage}</p> : null}
        </article>
      ) : null}

      {selectedApproval ? (
        <div className="info-card approval-detail-card">
          {(() => {
            const request = Array.isArray(selectedApproval.hiring_requests)
              ? selectedApproval.hiring_requests[0]
              : selectedApproval.hiring_requests;

            return (
              <>
                <h3>Detalle para aprobación</h3>
                <div className="approval-detail-grid">
                  <div className="approval-detail-item approval-detail-item-tiny">
                    <small>Folio</small>
                    <strong>{request?.folio ?? "Sin folio"}</strong>
                  </div>
                  <div className="approval-detail-item approval-detail-item-regular">
                    <small>Etapa</small>
                    <strong>{selectedApproval.step_name}</strong>
                  </div>
                  <div className="approval-detail-item approval-detail-item-xwide">
                    <small>Solicitante</small>
                    <strong title={formatPersonLabel(request?.requester_name)}>
                      {formatPersonLabel(request?.requester_name)}
                    </strong>
                  </div>
                  <div className="approval-detail-item approval-detail-item-wide">
                    <small>Cargo solicitado</small>
                    <strong title={request?.job_position_name ?? "No disponible"}>
                      {request?.job_position_name ?? "No disponible"}
                    </strong>
                  </div>
                  <div className="approval-detail-item approval-detail-item-tiny">
                    <small>Vacantes</small>
                    <strong>{request?.vacancies ?? 0}</strong>
                  </div>
                  <div className="approval-detail-item approval-detail-item-regular">
                    <small>Contrato</small>
                    <strong title={request?.contract_name ?? "No disponible"}>
                      {request?.contract_name ?? "No disponible"}
                    </strong>
                  </div>
                  <div className="approval-detail-item approval-detail-item-xwide">
                    <small>Numero contrato</small>
                    <strong title={request?.contract_number ?? "No disponible"}>
                      {request?.contract_number ?? "No disponible"}
                    </strong>
                  </div>
                </div>

                <div className="approval-chip-row">
                  <span className="approval-chip">
                    Fecha ingreso:{" "}
                    {request?.requested_entry_date
                      ? formatRequestDate(request.requested_entry_date)
                      : "No disponible"}
                  </span>
                  <span className="approval-chip">
                    Turno: {request?.shift_name ?? "No disponible"}
                  </span>
                  <span className="approval-chip">
                    Renta: {formatCurrencyValue(request?.salary_offer)}
                  </span>
                  <span className="approval-chip">
                    Campamento: {formatBooleanLabel(request?.campamento)}
                  </span>
                  <span className="approval-chip">
                    Pasajes: {formatBooleanLabel(request?.pasajes)}
                  </span>
                  <span className="approval-chip">
                    Estado: {toHiringStatusLabel(request?.status)}
                  </span>
                </div>

                <div className="approval-detail-note">
                  <small>Otros beneficios</small>
                  <strong>{request?.other_benefits?.trim() || "No informado"}</strong>
                </div>

                <div className="approval-comment-box">
                  <label className="field-label" htmlFor="approval-comment">
                    Comentario de decision <span className="field-label-optional">(Opcional)</span>
                  </label>
                  <textarea
                    id="approval-comment"
                    className="text-field text-area-field"
                    value={decisionComment}
                    onChange={(event) => setDecisionComment(event.target.value)}
                    placeholder="Agregue contexto si necesita dejar trazabilidad de la decision"
                  />
                </div>

                <div className="approval-action-row approval-action-row-detail">
                  <button
                    type="button"
                    className="soft-primary-button approval-button-approve"
                    disabled={isDecisionLoading === selectedApproval.id}
                    onClick={() => handleApprovalDecision(selectedApproval.id, "approved")}
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    className="soft-primary-button approval-button-reject"
                    disabled={isDecisionLoading === selectedApproval.id}
                    onClick={() => handleApprovalDecision(selectedApproval.id, "rejected")}
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    className="soft-primary-button approval-button-detail"
                    onClick={() => {
                      setSelectedApproval(null);
                      setDecisionComment("");
                    }}
                  >
                    Cerrar detalle
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      ) : null}

      <article className="info-card request-summary-panel">
        <div className="home-section-header">
          <div>
            <h3>Mis solicitudes</h3>
            <p>
              {isLoading
                ? "Cargando requerimientos..."
                : `${myRequests.length} registradas recientemente`}
            </p>
          </div>
        </div>

        {myRequests.length === 0 ? (
          <p>{isLoading ? "Cargando requerimientos..." : "Aun no tienes solicitudes."}</p>
        ) : (
          <div className="request-table-shell">
            <div className="request-table-scroll">
              <table className="request-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Estado</th>
                    <th>Cargo solicitado</th>
                    <th>Contrato</th>
                    <th>Vacantes</th>
                    <th>Dias desde solicitud</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.map((request) => (
                    <tr key={request.id}>
                      <td className="request-table-folio">{request.folio ?? "Sin folio"}</td>
                      <td>
                        <span className="request-table-status">
                          {toHiringStatusLabel(request.status)}
                        </span>
                      </td>
                      <td title={request.job_position_name}>{request.job_position_name}</td>
                      <td title={request.contract_name}>{request.contract_name}</td>
                      <td>{request.vacancies ?? 0}</td>
                      <td>{formatDaysSince(request.submitted_at ?? request.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
