import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import {
  decideHiringApproval,
  toHiringStatusLabel,
  type HiringWorkflowStatus
} from "../services/hiringWorkflow";
import {
  fetchHiringControlDashboard,
  type HiringControlApproval,
  type HiringControlRequestRow,
  type HiringControlSummary
} from "../services/hiringControl";

type StatusFilter = HiringWorkflowStatus | null;

const emptySummary: HiringControlSummary = {
  pending_area_manager: 0,
  pending_contracts_control: 0,
  approved: 0,
  rejected: 0,
  total: 0
};

const kpiCards: Array<{
  key: StatusFilter;
  label: string;
  summaryKey: keyof HiringControlSummary;
  className: string;
}> = [
  {
    key: "pending_contracts_control",
    label: "Pendiente control",
    summaryKey: "pending_contracts_control",
    className: "tracking-kpi-card-en-proceso"
  },
  {
    key: "pending_area_manager",
    label: "Pendiente gerencia",
    summaryKey: "pending_area_manager",
    className: "tracking-kpi-card-pendiente"
  },
  {
    key: "approved",
    label: "Aprobadas",
    summaryKey: "approved",
    className: "tracking-kpi-card-generado"
  },
  {
    key: "rejected",
    label: "Rechazadas",
    summaryKey: "rejected",
    className: "tracking-kpi-card-error"
  }
];

function formatDateValue(value: string | null | undefined) {
  if (!value) {
    return "No disponible";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No disponible";
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
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

  return value.trim();
}

export function HiringStatusPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<HiringControlSummary>(emptySummary);
  const [pendingApprovals, setPendingApprovals] = useState<HiringControlApproval[]>([]);
  const [recentRequests, setRecentRequests] = useState<HiringControlRequestRow[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [decisionComment, setDecisionComment] = useState("");
  const [decisionMessage, setDecisionMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDecisionLoading, setIsDecisionLoading] = useState<number | null>(null);

  const loadDashboard = async () => {
    setIsLoading(true);
    setErrorMessage("");

    const result = await fetchHiringControlDashboard();

    if (result.error || !result.data) {
      setSummary(emptySummary);
      setPendingApprovals([]);
      setRecentRequests([]);
      setErrorMessage(result.error ?? "No fue posible cargar el tablero de contrataciones.");
      setIsLoading(false);
      return;
    }

    setSummary(result.data.summary);
    setPendingApprovals(result.data.pendingApprovals);
    setRecentRequests(result.data.recentRequests);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return recentRequests.filter((request) => {
      const matchesStatus = !statusFilter || request.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        (request.folio ?? "").toLowerCase().includes(normalizedSearch) ||
        (request.requester_name ?? "").toLowerCase().includes(normalizedSearch) ||
        request.job_position_name.toLowerCase().includes(normalizedSearch) ||
        request.contract_name.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [recentRequests, searchTerm, statusFilter]);

  useEffect(() => {
    if (filteredRequests.length === 0) {
      setSelectedRequestId("");
      return;
    }

    const selectedStillVisible = filteredRequests.some((request) => request.id === selectedRequestId);
    if (!selectedStillVisible) {
      setSelectedRequestId(filteredRequests[0]?.id ?? "");
    }
  }, [filteredRequests, selectedRequestId]);

  const selectedRequest =
    filteredRequests.find((request) => request.id === selectedRequestId) ??
    filteredRequests[0] ??
    null;

  const selectedPendingApproval =
    selectedRequest &&
    pendingApprovals.find((approval) => approval.hiring_request_id === selectedRequest.id);
  const canDecideSelectedApproval =
    Boolean(user?.id) && selectedPendingApproval?.approver_user_id === user?.id;

  const handleDecision = async (
    approvalId: number,
    decision: "approved" | "rejected"
  ) => {
    setIsDecisionLoading(approvalId);
    setDecisionMessage("");

    const { error } = await decideHiringApproval({
      approvalId,
      decision,
      comment: decisionComment
    });

    if (error) {
      setDecisionMessage(error);
      setIsDecisionLoading(null);
      return;
    }

    setDecisionComment("");
    setDecisionMessage(
      decision === "approved" ? "Aprobación registrada." : "Rechazo registrado."
    );
    setIsDecisionLoading(null);
    await loadDashboard();
  };

  return (
    <section className="page">
      <div className="hero-panel hero-panel-compact">
        <h2>Control de Contrataciones</h2>
        <p>
          Vista consolidada del flujo real de contrataciones, sin estados locales ni
          seguimiento ficticio.
        </p>
      </div>

      <section className="tracking-panel">
        <div className="tracking-kpi-row">
          {kpiCards.map((card) => (
            <button
              key={card.label}
              type="button"
              className={`tracking-kpi-card ${card.className} ${
                statusFilter === card.key ? "tracking-kpi-card-active" : ""
              }`}
              onClick={() =>
                setStatusFilter((current) => (current === card.key ? null : card.key))
              }
            >
              <span className="micro-label">{card.label}</span>
              <strong>{summary[card.summaryKey] ?? 0}</strong>
            </button>
          ))}
        </div>

        {pendingApprovals.length > 0 ? (
          <article className="info-card approval-panel-card approval-panel-primary">
            <div className="home-section-header">
              <div>
                <h3>Cola de Control de Contratos</h3>
                <p>
                  {isLoading
                    ? "Cargando aprobaciones..."
                    : `${pendingApprovals.length} pendientes en esta etapa`}
                </p>
              </div>
            </div>

            <ul className="approval-queue">
              {pendingApprovals.map((approval) => (
                <li key={approval.id} className="approval-queue-item">
                  <div className="approval-queue-copy">
                    <strong>{approval.hiring_requests?.folio ?? "Sin folio"}</strong>
                    <span>{approval.step_name}</span>
                    <span>
                      {approval.hiring_requests?.job_position_name ?? "Cargo no disponible"}
                    </span>
                    <span>
                      {approval.hiring_requests?.contract_name ?? "Contrato no disponible"}
                    </span>
                  </div>
                  <div className="approval-action-row">
                    <button
                      type="button"
                      className="soft-primary-button approval-button-detail"
                      onClick={() => {
                        setSelectedRequestId(approval.hiring_request_id);
                        setDecisionMessage("");
                      }}
                    >
                      Ver detalle
                    </button>
                    {approval.approver_user_id === user?.id ? (
                      <>
                        <button
                          type="button"
                          className="soft-primary-button approval-button-approve"
                          disabled={isDecisionLoading === approval.id}
                          onClick={() => handleDecision(approval.id, "approved")}
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          className="soft-primary-button approval-button-reject"
                          disabled={isDecisionLoading === approval.id}
                          onClick={() => handleDecision(approval.id, "rejected")}
                        >
                          Rechazar
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </article>
        ) : null}

        <div className="tracking-toolbar">
          <div className="tracking-toolbar-copy">
            <h3>Resumen de solicitudes</h3>
            {statusFilter ? (
              <span className="tracking-filter-caption">
                Filtrando por estado: {toHiringStatusLabel(statusFilter)}
              </span>
            ) : null}
            {errorMessage ? <span className="tracking-filter-caption">{errorMessage}</span> : null}
          </div>
          <div className="tracking-filters">
            <input
              className="text-field tracking-search"
              placeholder="Buscar por folio, solicitante, cargo o contrato"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className="control-layout">
          <div className="tracking-table-wrap">
            <div className="tracking-table-scroll">
              <table className="tracking-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Estado</th>
                    <th>Solicitante</th>
                    <th>Cargo</th>
                    <th>Contrato</th>
                    <th>Area manager</th>
                    <th>Control contratos</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.length > 0 ? (
                    filteredRequests.map((request) => (
                      <tr
                        key={request.id}
                        className={request.id === selectedRequest?.id ? "tracking-row-selected" : ""}
                        onClick={() => {
                          setSelectedRequestId(request.id);
                          setDecisionMessage("");
                        }}
                      >
                        <td>{request.folio ?? "Sin folio"}</td>
                        <td>
                          <span className="tracking-status-pill">
                            {toHiringStatusLabel(request.status)}
                          </span>
                        </td>
                        <td>{formatPersonLabel(request.requester_name)}</td>
                        <td>{request.job_position_name}</td>
                        <td>{request.contract_name}</td>
                        <td>{toHiringStatusLabel(request.area_manager_status)}</td>
                        <td>{toHiringStatusLabel(request.contracts_control_status)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="tracking-empty-state" colSpan={7}>
                        {isLoading
                          ? "Cargando solicitudes..."
                          : "No hay solicitudes para el filtro actual."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="control-detail-panel">
            {selectedRequest ? (
              <>
                <div className="control-detail-header">
                  <h3>{selectedRequest.folio ?? "Sin folio"}</h3>
                  <span className="tracking-status-pill">
                    {toHiringStatusLabel(selectedRequest.status)}
                  </span>
                </div>

                <div className="control-readonly-grid">
                  <div>
                    <small>Solicitante</small>
                    <strong>{formatPersonLabel(selectedRequest.requester_name)}</strong>
                  </div>
                  <div>
                    <small>Correo</small>
                    <strong>{selectedRequest.requester_email ?? "No disponible"}</strong>
                  </div>
                  <div>
                    <small>Cargo solicitado</small>
                    <strong>{selectedRequest.job_position_name}</strong>
                  </div>
                  <div>
                    <small>Vacantes</small>
                    <strong>{selectedRequest.vacancies ?? 0}</strong>
                  </div>
                  <div>
                    <small>Contrato</small>
                    <strong>{selectedRequest.contract_name}</strong>
                  </div>
                  <div>
                    <small>Numero contrato</small>
                    <strong>{selectedRequest.contract_number ?? "No disponible"}</strong>
                  </div>
                  <div>
                    <small>Centro de costo</small>
                    <strong>
                      {selectedRequest.cost_center_code ?? "No disponible"} ·{" "}
                      {selectedRequest.cost_center_name ?? "No disponible"}
                    </strong>
                  </div>
                  <div>
                    <small>Turno</small>
                    <strong>{selectedRequest.shift_name ?? "No disponible"}</strong>
                  </div>
                  <div>
                    <small>Ingreso solicitado</small>
                    <strong>{formatDateValue(selectedRequest.requested_entry_date)}</strong>
                  </div>
                  <div>
                    <small>Inicio / termino</small>
                    <strong>
                      {formatDateValue(selectedRequest.start_date)} -{" "}
                      {formatDateValue(selectedRequest.end_date)}
                    </strong>
                  </div>
                </div>

                <div className="approval-chip-row">
                  <span className="approval-chip">
                    Renta: {formatCurrencyValue(selectedRequest.salary_offer)}
                  </span>
                  <span className="approval-chip">
                    Campamento: {formatBooleanLabel(selectedRequest.campamento)}
                  </span>
                  <span className="approval-chip">
                    Pasajes: {formatBooleanLabel(selectedRequest.pasajes)}
                  </span>
                  <span className="approval-chip">
                    Area manager: {toHiringStatusLabel(selectedRequest.area_manager_status)}
                  </span>
                  <span className="approval-chip">
                    Control contratos:{" "}
                    {toHiringStatusLabel(selectedRequest.contracts_control_status)}
                  </span>
                </div>

                <div className="control-readonly-grid">
                  <div>
                    <small>Aprobador area</small>
                    <strong>
                      {selectedRequest.area_manager_approver_name ?? "No disponible"}
                    </strong>
                  </div>
                  <div>
                    <small>Decision area</small>
                    <strong>{formatDateValue(selectedRequest.area_manager_decided_at)}</strong>
                  </div>
                  <div>
                    <small>Aprobador control</small>
                    <strong>
                      {selectedRequest.contracts_control_approver_name ?? "No disponible"}
                    </strong>
                  </div>
                  <div>
                    <small>Decision control</small>
                    <strong>
                      {formatDateValue(selectedRequest.contracts_control_decided_at)}
                    </strong>
                  </div>
                  <div>
                    <small>Fecha solicitud</small>
                    <strong>
                      {formatDateValue(selectedRequest.submitted_at ?? selectedRequest.created_at)}
                    </strong>
                  </div>
                  <div>
                    <small>Cierre</small>
                    <strong>
                      {formatDateValue(selectedRequest.approved_at ?? selectedRequest.rejected_at)}
                    </strong>
                  </div>
                </div>

                <div className="approval-detail-note">
                  <small>Otros beneficios</small>
                  <strong>{selectedRequest.other_benefits?.trim() || "No informado"}</strong>
                </div>

                {selectedPendingApproval && canDecideSelectedApproval ? (
                  <>
                    <div className="approval-comment-box">
                      <label className="field-label" htmlFor="control-approval-comment">
                        Comentario de decision{" "}
                        <span className="field-label-optional">(Opcional)</span>
                      </label>
                      <textarea
                        id="control-approval-comment"
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
                        disabled={isDecisionLoading === selectedPendingApproval.id}
                        onClick={() => handleDecision(selectedPendingApproval.id, "approved")}
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        className="soft-primary-button approval-button-reject"
                        disabled={isDecisionLoading === selectedPendingApproval.id}
                        onClick={() => handleDecision(selectedPendingApproval.id, "rejected")}
                      >
                        Rechazar
                      </button>
                    </div>
                  </>
                ) : null}

                {selectedPendingApproval && !canDecideSelectedApproval ? (
                  <div className="approval-detail-note">
                    <small>Etapa asignada</small>
                    <strong>
                      Esta aprobación está asignada a{" "}
                      {selectedPendingApproval.approver_name ??
                        selectedPendingApproval.approver_email ??
                        "otro usuario"}.
                    </strong>
                  </div>
                ) : null}

                {decisionMessage ? <p className="form-status">{decisionMessage}</p> : null}
              </>
            ) : (
              <div className="control-detail-header">
                <h3>Sin solicitud seleccionada</h3>
                <span className="tracking-filter-caption">
                  {isLoading ? "Cargando detalle..." : "Seleccione un folio para revisar su trazabilidad."}
                </span>
              </div>
            )}
          </aside>
        </div>
      </section>
    </section>
  );
}
