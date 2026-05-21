import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import { decideHiringApproval } from "../services/hiringWorkflow";
import {
  addCandidateToRecruitmentCase,
  advanceRecruitmentCandidateStage,
  fetchRecruitmentCaseDetail,
  fetchRecruitmentControlDashboard,
  toRecruitmentCandidateStageLabel,
  toRecruitmentCaseStatusLabel,
  type HiringControlApproval,
  type RecruitmentCandidateStage,
  type RecruitmentCaseCandidateRow,
  type RecruitmentCaseDetail,
  type RecruitmentCaseListRow,
  type RecruitmentDashboardSummary
} from "../services/hiringControl";

const emptySummary: RecruitmentDashboardSummary = {
  pending_contracts_control: 0,
  active_cases: 0,
  ready_to_hire_cases: 0,
  filled_cases: 0,
  total_cases: 0
};

const caseFilterOptions = [
  { key: null, label: "Todos" },
  { key: "open", label: "Abiertos" },
  { key: "screening", label: "Screening" },
  { key: "ready_to_hire", label: "Listos para contratar" },
  { key: "filled", label: "Cubiertos" }
] as const;

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

function formatDateTimeValue(value: string | null | undefined) {
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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
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

function getNextStageOptions(
  currentStage: RecruitmentCandidateStage
): RecruitmentCandidateStage[] {
  switch (currentStage) {
    case "lead":
      return ["contacted", "screening", "rejected", "withdrawn"];
    case "contacted":
      return ["screening", "shortlisted", "rejected", "withdrawn"];
    case "screening":
      return ["shortlisted", "documents_pending", "rejected", "withdrawn"];
    case "shortlisted":
      return ["documents_pending", "rejected", "withdrawn"];
    case "documents_pending":
      return ["ready_for_hire", "rejected", "withdrawn"];
    case "ready_for_hire":
      return ["hired", "rejected", "withdrawn"];
    default:
      return [];
  }
}

function getStageChipClass(stage: RecruitmentCandidateStage) {
  if (stage === "hired") return "tracking-kpi-card-generado";
  if (stage === "ready_for_hire") return "tracking-kpi-card-en-proceso";
  if (stage === "rejected" || stage === "withdrawn") return "tracking-kpi-card-error";
  return "tracking-kpi-card-pendiente";
}

export function HiringStatusPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<RecruitmentDashboardSummary>(emptySummary);
  const [pendingApprovals, setPendingApprovals] = useState<HiringControlApproval[]>([]);
  const [activeCases, setActiveCases] = useState<RecruitmentCaseListRow[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<RecruitmentCaseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDecisionLoading, setIsDecisionLoading] = useState<number | null>(null);
  const [isCandidateSaving, setIsCandidateSaving] = useState(false);
  const [isStageSaving, setIsStageSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [decisionMessage, setDecisionMessage] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const [candidateForm, setCandidateForm] = useState({
    nationalId: "",
    fullName: "",
    email: "",
    phone: ""
  });
  const [caseSearchTerm, setCaseSearchTerm] = useState("");
  const [caseFilter, setCaseFilter] = useState<(typeof caseFilterOptions)[number]["key"]>(null);
  const [stageDraft, setStageDraft] = useState<RecruitmentCandidateStage | "">("");
  const [stageComment, setStageComment] = useState("");

  const loadDashboard = async (preferredCaseId?: string) => {
    setIsLoading(true);
    setErrorMessage("");

    const result = await fetchRecruitmentControlDashboard();

    if (result.error || !result.data) {
      setSummary(emptySummary);
      setPendingApprovals([]);
      setActiveCases([]);
      setErrorMessage(result.error ?? "No fue posible cargar el tablero.");
      setIsLoading(false);
      return;
    }

    setSummary(result.data.summary);
    setPendingApprovals(result.data.pendingApprovals);
    setActiveCases(result.data.activeCases);

    const nextCaseId =
      preferredCaseId && result.data.activeCases.some((item) => item.id === preferredCaseId)
        ? preferredCaseId
        : result.data.activeCases[0]?.id ?? "";

    setSelectedCaseId(nextCaseId);
    setIsLoading(false);
  };

  const loadCaseDetail = async (caseId: string) => {
    if (!caseId) {
      setSelectedCaseDetail(null);
      return;
    }

    setIsDetailLoading(true);
    const result = await fetchRecruitmentCaseDetail(caseId);

    if (result.error || !result.data) {
      setSelectedCaseDetail(null);
      setErrorMessage(result.error ?? "No fue posible cargar el detalle del caso.");
      setIsDetailLoading(false);
      return;
    }

    setSelectedCaseDetail(result.data);
    setSelectedCandidateId(result.data.candidates[0]?.id ?? "");
    setStageDraft("");
    setStageComment("");
    setIsDetailLoading(false);
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!selectedCaseId) {
      setSelectedCaseDetail(null);
      return;
    }

    void loadCaseDetail(selectedCaseId);
  }, [selectedCaseId]);

  const filteredCases = useMemo(() => {
    const normalizedSearch = caseSearchTerm.trim().toLowerCase();

    return activeCases.filter((caseRow) => {
      const matchesFilter = !caseFilter || caseRow.status === caseFilter;
      const matchesSearch =
        !normalizedSearch ||
        caseRow.case_code.toLowerCase().includes(normalizedSearch) ||
        caseRow.contract_name.toLowerCase().includes(normalizedSearch) ||
        caseRow.job_position_name.toLowerCase().includes(normalizedSearch) ||
        caseRow.cost_center_name.toLowerCase().includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [activeCases, caseFilter, caseSearchTerm]);

  useEffect(() => {
    if (filteredCases.length === 0) {
      setSelectedCaseId("");
      return;
    }

    if (!filteredCases.some((caseRow) => caseRow.id === selectedCaseId)) {
      setSelectedCaseId(filteredCases[0]?.id ?? "");
    }
  }, [filteredCases, selectedCaseId]);

  const selectedCase =
    filteredCases.find((caseRow) => caseRow.id === selectedCaseId) ??
    filteredCases[0] ??
    null;

  const selectedCandidate =
    selectedCaseDetail?.candidates.find((candidate) => candidate.id === selectedCandidateId) ??
    selectedCaseDetail?.candidates[0] ??
    null;

  const selectedPendingApproval =
    selectedCaseDetail &&
    pendingApprovals.find(
      (approval) => approval.hiring_request_id === selectedCaseDetail.case.hiring_request.id
    );

  const canDecideApproval =
    Boolean(user?.id) && selectedPendingApproval?.approver_user_id === user?.id;

  const handleApprovalDecision = async (
    approvalId: number,
    decision: "approved" | "rejected"
  ) => {
    setIsDecisionLoading(approvalId);
    setDecisionMessage("");

    const { error } = await decideHiringApproval({
      approvalId,
      decision,
      comment: approvalComment
    });

    if (error) {
      setDecisionMessage(error);
      setIsDecisionLoading(null);
      return;
    }

    setApprovalComment("");
    setDecisionMessage(
      decision === "approved" ? "Aprobación registrada." : "Rechazo registrado."
    );
    setIsDecisionLoading(null);
    await loadDashboard(selectedCaseId);
  };

  const handleAddCandidate = async () => {
    if (!selectedCaseDetail) {
      return;
    }

    setIsCandidateSaving(true);
    setDecisionMessage("");

    const { error } = await addCandidateToRecruitmentCase({
      caseId: selectedCaseDetail.case.id,
      nationalId: candidateForm.nationalId,
      fullName: candidateForm.fullName,
      email: candidateForm.email,
      phone: candidateForm.phone
    });

    if (error) {
      setDecisionMessage(error);
      setIsCandidateSaving(false);
      return;
    }

    setCandidateForm({
      nationalId: "",
      fullName: "",
      email: "",
      phone: ""
    });
    setDecisionMessage("Candidato agregado al caso.");
    setIsCandidateSaving(false);
    await loadDashboard(selectedCaseDetail.case.id);
    await loadCaseDetail(selectedCaseDetail.case.id);
  };

  const handleAdvanceStage = async () => {
    if (!selectedCandidate || !stageDraft) {
      return;
    }

    setIsStageSaving(true);
    setDecisionMessage("");

    const { error } = await advanceRecruitmentCandidateStage({
      caseCandidateId: selectedCandidate.id,
      toStage: stageDraft,
      comment: stageComment
    });

    if (error) {
      setDecisionMessage(error);
      setIsStageSaving(false);
      return;
    }

    setDecisionMessage("Etapa del candidato actualizada.");
    setStageDraft("");
    setStageComment("");
    setIsStageSaving(false);

    if (selectedCaseDetail) {
      await loadDashboard(selectedCaseDetail.case.id);
      await loadCaseDetail(selectedCaseDetail.case.id);
    }
  };

  return (
    <section className="page">
      <div className="hero-panel hero-panel-compact">
        <h2>Control de Contrataciones</h2>
        <p>
          Casos activos de reclutamiento abiertos desde solicitudes aprobadas, con
          pipeline inicial de candidatos y trazabilidad operacional.
        </p>
      </div>

      <section className="tracking-panel">
        <div className="tracking-kpi-row">
          <article className="tracking-kpi-card tracking-kpi-card-en-proceso">
            <span className="micro-label">Pendientes control</span>
            <strong>{summary.pending_contracts_control}</strong>
          </article>
          <article className="tracking-kpi-card tracking-kpi-card-pendiente">
            <span className="micro-label">Casos activos</span>
            <strong>{summary.active_cases}</strong>
          </article>
          <article className="tracking-kpi-card tracking-kpi-card-en-proceso">
            <span className="micro-label">Listos para contratar</span>
            <strong>{summary.ready_to_hire_cases}</strong>
          </article>
          <article className="tracking-kpi-card tracking-kpi-card-generado">
            <span className="micro-label">Casos cubiertos</span>
            <strong>{summary.filled_cases}</strong>
          </article>
        </div>

        {pendingApprovals.length > 0 ? (
          <article className="info-card approval-panel-card approval-panel-primary">
            <div className="home-section-header">
              <div>
                <h3>Cola de aprobación final</h3>
                <p>
                  {isLoading
                    ? "Cargando aprobaciones..."
                    : `${pendingApprovals.length} folios pendientes de Control de Contratos`}
                </p>
              </div>
            </div>

            <ul className="approval-queue">
              {pendingApprovals.map((approval) => (
                <li key={approval.id} className="approval-queue-item">
                  <div className="approval-queue-copy">
                    <strong>{approval.hiring_requests?.folio ?? "Sin folio"}</strong>
                    <span>{approval.step_name}</span>
                    <span>{approval.hiring_requests?.job_position_name ?? "Cargo no disponible"}</span>
                    <span>{approval.hiring_requests?.contract_name ?? "Contrato no disponible"}</span>
                  </div>
                  <div className="approval-action-row">
                    <button
                      type="button"
                      className="soft-primary-button approval-button-detail"
                      onClick={() => {
                        const existingCase = activeCases.find(
                          (caseRow) =>
                            caseRow.case_code === `RC-${approval.hiring_requests?.folio ?? ""}`
                        );
                        if (existingCase) {
                          setSelectedCaseId(existingCase.id);
                        }
                      }}
                    >
                      Ver contexto
                    </button>
                    {approval.approver_user_id === user?.id ? (
                      <>
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
            <h3>Casos activos</h3>
            <span className="tracking-filter-caption">
              {errorMessage || "Cada caso nace desde un folio aprobado y mantiene trazabilidad propia."}
            </span>
          </div>
          <div className="tracking-filters">
            <input
              className="text-field tracking-search"
              placeholder="Buscar por caso, contrato, cargo o centro de costo"
              value={caseSearchTerm}
              onChange={(event) => setCaseSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className="approval-chip-row">
          {caseFilterOptions.map((option) => (
            <button
              key={option.label}
              type="button"
              className={`approval-chip ${caseFilter === option.key ? "tracking-kpi-card-active" : ""}`}
              onClick={() => setCaseFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="control-layout">
          <div className="tracking-table-wrap">
            <div className="tracking-table-scroll">
              <table className="tracking-table">
                <thead>
                  <tr>
                    <th>Caso</th>
                    <th>Estado</th>
                    <th>Cargo</th>
                    <th>Contrato</th>
                    <th>Cupos</th>
                    <th>Candidatos</th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.length > 0 ? (
                    filteredCases.map((caseRow) => (
                      <tr
                        key={caseRow.id}
                        className={caseRow.id === selectedCase?.id ? "tracking-row-selected" : ""}
                        onClick={() => setSelectedCaseId(caseRow.id)}
                      >
                        <td>{caseRow.case_code}</td>
                        <td>
                          <span className="tracking-status-pill">
                            {toRecruitmentCaseStatusLabel(caseRow.status)}
                          </span>
                        </td>
                        <td>{caseRow.job_position_name}</td>
                        <td>{caseRow.contract_name}</td>
                        <td>
                          {caseRow.filled_vacancies}/{caseRow.requested_vacancies}
                        </td>
                        <td>
                          {caseRow.candidate_count} · listos {caseRow.ready_candidates}
                        </td>
                        <td>{caseRow.owner_name ?? "No asignado"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="tracking-empty-state" colSpan={7}>
                        {isLoading
                          ? "Cargando casos..."
                          : "No hay casos para el filtro actual."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="control-detail-panel">
            {selectedCaseDetail ? (
              <>
                <div className="control-detail-header">
                  <h3>{selectedCaseDetail.case.case_code}</h3>
                  <span className="tracking-status-pill">
                    {toRecruitmentCaseStatusLabel(selectedCaseDetail.case.status)}
                  </span>
                </div>

                <div className="control-readonly-grid">
                  <div>
                    <small>Folio origen</small>
                    <strong>{selectedCaseDetail.case.hiring_request.folio ?? "Sin folio"}</strong>
                  </div>
                  <div>
                    <small>Solicitante</small>
                    <strong>{selectedCaseDetail.case.hiring_request.requester_name ?? "No disponible"}</strong>
                  </div>
                  <div>
                    <small>Cargo</small>
                    <strong>{selectedCaseDetail.case.job_position_name}</strong>
                  </div>
                  <div>
                    <small>Contrato</small>
                    <strong>{selectedCaseDetail.case.contract_name}</strong>
                  </div>
                  <div>
                    <small>Centro de costo</small>
                    <strong>
                      {selectedCaseDetail.case.cost_center_code} · {selectedCaseDetail.case.cost_center_name}
                    </strong>
                  </div>
                  <div>
                    <small>Vacantes</small>
                    <strong>
                      {selectedCaseDetail.case.filled_vacancies}/{selectedCaseDetail.case.requested_vacancies}
                    </strong>
                  </div>
                  <div>
                    <small>Ingreso objetivo</small>
                    <strong>{formatDateValue(selectedCaseDetail.case.requested_entry_date)}</strong>
                  </div>
                  <div>
                    <small>Apertura</small>
                    <strong>{formatDateTimeValue(selectedCaseDetail.case.opened_at)}</strong>
                  </div>
                </div>

                <div className="approval-chip-row">
                  <span className="approval-chip">
                    Turno: {selectedCaseDetail.case.hiring_request.shift_name ?? "No disponible"}
                  </span>
                  <span className="approval-chip">
                    Renta: {formatCurrencyValue(selectedCaseDetail.case.hiring_request.salary_offer)}
                  </span>
                  <span className="approval-chip">
                    Campamento: {formatBooleanLabel(selectedCaseDetail.case.hiring_request.campamento)}
                  </span>
                  <span className="approval-chip">
                    Pasajes: {formatBooleanLabel(selectedCaseDetail.case.hiring_request.pasajes)}
                  </span>
                </div>

                {selectedPendingApproval ? (
                  <div className="approval-comment-box">
                    <label className="field-label" htmlFor="control-approval-comment">
                      Comentario aprobación final
                    </label>
                    <textarea
                      id="control-approval-comment"
                      className="text-field text-area-field"
                      value={approvalComment}
                      onChange={(event) => setApprovalComment(event.target.value)}
                      placeholder="Comentario opcional para la decisión final"
                    />
                    {canDecideApproval ? (
                      <div className="approval-action-row approval-action-row-detail">
                        <button
                          type="button"
                          className="soft-primary-button approval-button-approve"
                          disabled={isDecisionLoading === selectedPendingApproval.id}
                          onClick={() => handleApprovalDecision(selectedPendingApproval.id, "approved")}
                        >
                          Aprobar y abrir caso
                        </button>
                        <button
                          type="button"
                          className="soft-primary-button approval-button-reject"
                          disabled={isDecisionLoading === selectedPendingApproval.id}
                          onClick={() => handleApprovalDecision(selectedPendingApproval.id, "rejected")}
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="tracking-toolbar">
                  <div className="tracking-toolbar-copy">
                    <h3>Pipeline inicial</h3>
                    <span className="tracking-filter-caption">
                      Alta de candidatos y avance manual de etapa Fase 1.
                    </span>
                  </div>
                </div>

                <div className="control-edit-grid">
                  <div>
                    <label className="field-label" htmlFor="candidate-national-id">
                      RUT / Identificador
                    </label>
                    <input
                      id="candidate-national-id"
                      className="text-field"
                      value={candidateForm.nationalId}
                      onChange={(event) =>
                        setCandidateForm((current) => ({
                          ...current,
                          nationalId: event.target.value
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="candidate-full-name">
                      Nombre completo
                    </label>
                    <input
                      id="candidate-full-name"
                      className="text-field"
                      value={candidateForm.fullName}
                      onChange={(event) =>
                        setCandidateForm((current) => ({
                          ...current,
                          fullName: event.target.value
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="candidate-email">
                      Correo
                    </label>
                    <input
                      id="candidate-email"
                      className="text-field"
                      value={candidateForm.email}
                      onChange={(event) =>
                        setCandidateForm((current) => ({
                          ...current,
                          email: event.target.value
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="candidate-phone">
                      Teléfono
                    </label>
                    <input
                      id="candidate-phone"
                      className="text-field"
                      value={candidateForm.phone}
                      onChange={(event) =>
                        setCandidateForm((current) => ({
                          ...current,
                          phone: event.target.value
                        }))
                      }
                    />
                  </div>
                  <div className="control-span-full">
                    <button
                      type="button"
                      className="soft-primary-button approval-button-approve"
                      disabled={isCandidateSaving}
                      onClick={() => void handleAddCandidate()}
                    >
                      Agregar candidato al caso
                    </button>
                  </div>
                </div>

                <div className="tracking-table-wrap">
                  <div className="tracking-table-scroll">
                    <table className="tracking-table">
                      <thead>
                        <tr>
                          <th>Candidato</th>
                          <th>Contacto</th>
                          <th>Etapa</th>
                          <th>Licencia</th>
                          <th>Ingreso etapa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCaseDetail.candidates.length > 0 ? (
                          selectedCaseDetail.candidates.map((candidate) => (
                            <tr
                              key={candidate.id}
                              className={
                                candidate.id === selectedCandidate?.id ? "tracking-row-selected" : ""
                              }
                              onClick={() => {
                                setSelectedCandidateId(candidate.id);
                                setStageDraft("");
                                setStageComment("");
                              }}
                            >
                              <td>{candidate.full_name}</td>
                              <td>{candidate.email ?? candidate.phone ?? "No disponible"}</td>
                              <td>
                                <span
                                  className={`tracking-status-pill ${getStageChipClass(
                                    candidate.stage_code
                                  )}`}
                                >
                                  {toRecruitmentCandidateStageLabel(candidate.stage_code)}
                                </span>
                              </td>
                              <td>
                                {candidate.driver_license_class
                                  ? `${candidate.driver_license_class} · ${formatDateValue(
                                      candidate.driver_license_expiry
                                    )}`
                                  : "No registrada"}
                              </td>
                              <td>{formatDateTimeValue(candidate.stage_entered_at)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="tracking-empty-state" colSpan={5}>
                              {isDetailLoading
                                ? "Cargando candidatos..."
                                : "Aún no hay candidatos en este caso."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedCandidate ? (
                  <>
                    <div className="approval-detail-note">
                      <small>Candidato seleccionado</small>
                      <strong>
                        {selectedCandidate.full_name} · {selectedCandidate.national_id}
                      </strong>
                    </div>

                    <div className="control-edit-grid">
                      <div>
                        <label className="field-label" htmlFor="candidate-next-stage">
                          Siguiente etapa
                        </label>
                        <select
                          id="candidate-next-stage"
                          className="text-field"
                          value={stageDraft}
                          onChange={(event) =>
                            setStageDraft(event.target.value as RecruitmentCandidateStage | "")
                          }
                        >
                          <option value="">Selecciona una etapa</option>
                          {getNextStageOptions(selectedCandidate.stage_code).map((stage) => (
                            <option key={stage} value={stage}>
                              {toRecruitmentCandidateStageLabel(stage)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="field-label" htmlFor="candidate-stage-comment">
                          Comentario
                        </label>
                        <input
                          id="candidate-stage-comment"
                          className="text-field"
                          value={stageComment}
                          onChange={(event) => setStageComment(event.target.value)}
                        />
                      </div>
                      <div className="control-span-full">
                        <button
                          type="button"
                          className="soft-primary-button approval-button-approve"
                          disabled={isStageSaving || !stageDraft}
                          onClick={() => void handleAdvanceStage()}
                        >
                          Mover candidato de etapa
                        </button>
                      </div>
                    </div>

                    <div className="approval-detail-note">
                      <small>Historial de etapa</small>
                      <strong>
                        {selectedCandidate.stage_history.length > 0
                          ? selectedCandidate.stage_history
                              .map(
                                (entry) =>
                                  `${toRecruitmentCandidateStageLabel(entry.to_stage)} · ${formatDateTimeValue(entry.created_at)}`
                              )
                              .join(" | ")
                          : "Sin historial adicional"}
                      </strong>
                    </div>
                  </>
                ) : null}

                <div className="approval-detail-note">
                  <small>Auditoría del caso</small>
                  <strong>
                    {selectedCaseDetail.audit.length > 0
                      ? selectedCaseDetail.audit
                          .slice(0, 5)
                          .map(
                            (entry) =>
                              `${entry.action_type} · ${entry.actor_name ?? "Usuario"} · ${formatDateTimeValue(entry.created_at)}`
                          )
                          .join(" | ")
                      : "Sin eventos registrados"}
                  </strong>
                </div>

                {decisionMessage ? <p className="form-status">{decisionMessage}</p> : null}
              </>
            ) : (
              <div className="control-detail-header">
                <h3>Sin caso seleccionado</h3>
                <span className="tracking-filter-caption">
                  {isLoading
                    ? "Cargando casos..."
                    : "Selecciona un caso para revisar requerimiento, candidatos y auditoría."}
                </span>
              </div>
            )}
          </aside>
        </div>
      </section>
    </section>
  );
}
