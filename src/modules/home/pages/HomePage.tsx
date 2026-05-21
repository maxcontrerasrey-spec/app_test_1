import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/context/AuthContext";
import { supabase } from "../../../shared/lib/supabase";

type HiringRequestSummaryRow = {
  id: string;
  folio: string | null;
  status:
    | "pending_area_manager"
    | "pending_contracts_control"
    | "approved"
    | "rejected"
    | "pendiente"
    | "aprobada"
    | "rechazada"
    | "cerrada";
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

function formatRequestDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatDaysSince(value: string) {
  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) {
    return "No disponible";
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfCreatedDay = new Date(createdAt);
  startOfCreatedDay.setHours(0, 0, 0, 0);

  const diffInMs = startOfToday.getTime() - startOfCreatedDay.getTime();
  const diffInDays = Math.max(0, Math.floor(diffInMs / 86_400_000));

  if (diffInDays === 0) return "Hoy";
  if (diffInDays === 1) return "1 dia";
  return `${diffInDays} dias`;
}

function toStatusLabel(value: HiringRequestSummaryRow["status"] | string | null | undefined) {
  if (value === "approved" || value === "aprobada") return "Aprobada";
  if (value === "rejected" || value === "rechazada") return "Rechazada";
  if (value === "pending_contracts_control") return "Pendiente control contratos";
  if (value === "pending_area_manager" || value === "pendiente") {
    return "Pendiente gerente de area";
  }
  if (value === "cerrada") return "Cerrada";
  return "Pendiente";
}

function formatCurrencyValue(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "No disponible";
  }

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(value);
}

function formatBooleanLabel(value: boolean | null | undefined) {
  if (value === true) return "Si";
  if (value === false) return "No";
  return "No disponible";
}

function formatPersonLabel(value: string | null | undefined) {
  if (!value?.trim()) {
    return "No disponible";
  }

  const normalized = value.trim();
  if (!normalized.includes(".") && !normalized.includes("_") && !normalized.includes("-")) {
    return normalized;
  }

  return normalized
    .split(/[._-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

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
    if (!supabase) {
      return;
    }

    setIsDecisionLoading(approvalId);
    setDecisionMessage("");

    const normalizedComment =
      selectedApproval?.id === approvalId ? decisionComment.trim() : "";

    const { error } = await supabase.rpc("decide_hiring_request_approval_v2", {
      p_approval_id: approvalId,
      p_decision: decision,
      p_comment: normalizedComment || null
    });

    if (error) {
      setDecisionMessage(error.message || "No fue posible registrar la decisión.");
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
                    Estado: {toStatusLabel(request?.status)}
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
                          {toStatusLabel(request.status)}
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
