import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import { decideHiringApproval } from "../services/hiringWorkflow";
import {
  advanceRecruitmentCandidateStage,
  fetchRecruitmentCaseDetail,
  fetchRecruitmentControlDashboard,
  toRecruitmentCandidateStageLabel,
  toRecruitmentCaseStatusLabel,
  type HiringControlApproval,
  type RecruitmentCandidateControlRow,
  type RecruitmentCandidateStage,
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

const candidateStageFilterOptions = [
  { key: null, label: "Todas las etapas" },
  { key: "lead", label: "Lead" },
  { key: "screening", label: "Screening" },
  { key: "documents_pending", label: "Docs pendientes" },
  { key: "ready_for_hire", label: "Listos para contratar" },
  { key: "hired", label: "Contratados" }
] as const;

type RecruitmentInternalView = "processes" | "candidates";

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

function getCandidateControlLockLabel(candidate: RecruitmentCandidateControlRow) {
  if (!candidate.is_contract_path_blocked) {
    if (candidate.stage_code === "ready_for_hire" || candidate.stage_code === "hired") {
      return "Ruta contractual activa";
    }

    return "Ruta libre";
  }

  return `Bloqueado por ${candidate.contract_locked_case_code ?? "otro caso"}${candidate.contract_locked_folio ? ` · ${candidate.contract_locked_folio}` : ""}`;
}

export function HiringStatusPage() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<RecruitmentInternalView>("processes");
  const [summary, setSummary] = useState<RecruitmentDashboardSummary>(emptySummary);
  const [pendingApprovals, setPendingApprovals] = useState<HiringControlApproval[]>([]);
  const [activeCases, setActiveCases] = useState<RecruitmentCaseListRow[]>([]);
  const [candidateControl, setCandidateControl] = useState<RecruitmentCandidateControlRow[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<RecruitmentCaseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDecisionLoading, setIsDecisionLoading] = useState<number | null>(null);
  const [isStageSaving, setIsStageSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [decisionMessage, setDecisionMessage] = useState("");
  const [caseSearchTerm, setCaseSearchTerm] = useState("");
  const [caseFilter, setCaseFilter] = useState<(typeof caseFilterOptions)[number]["key"]>(null);
  const [candidateSearchTerm, setCandidateSearchTerm] = useState("");
  const [candidateStageFilter, setCandidateStageFilter] =
    useState<(typeof candidateStageFilterOptions)[number]["key"]>(null);
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
      setCandidateControl([]);
      setErrorMessage(result.error ?? "No fue posible cargar el tablero.");
      setIsLoading(false);
      return;
    }

    setSummary(result.data.summary);
    setPendingApprovals(result.data.pendingApprovals);
    setActiveCases(result.data.activeCases);
    setCandidateControl(result.data.candidateControl);

    const nextCaseId =
      preferredCaseId && result.data.activeCases.some((item) => item.id === preferredCaseId)
        ? preferredCaseId
        : result.data.activeCases[0]?.id ?? result.data.candidateControl[0]?.recruitment_case_id ?? "";

    setSelectedCaseId(nextCaseId);
    setIsLoading(false);
  };

  const loadCaseDetail = async (caseId: string, preferredCandidateId?: string) => {
    if (!caseId) {
      setSelectedCaseDetail(null);
      return;
    }

    const result = await fetchRecruitmentCaseDetail(caseId);

    if (result.error || !result.data) {
      setSelectedCaseDetail(null);
      setErrorMessage(result.error ?? "No fue posible cargar el detalle del caso.");
      return;
    }

    setSelectedCaseDetail(result.data);

    const nextCandidateId =
      preferredCandidateId &&
      result.data.candidates.some((candidate) => candidate.id === preferredCandidateId)
        ? preferredCandidateId
        : result.data.candidates[0]?.id ?? "";

    setSelectedCandidateId(nextCandidateId);
    setStageDraft("");
    setStageComment("");
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (activeView !== "candidates") {
      return;
    }

    if (!selectedCaseId) {
      setSelectedCaseDetail(null);
      return;
    }

    void loadCaseDetail(selectedCaseId, selectedCandidateId);
  }, [activeView, selectedCaseId, selectedCandidateId]);

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

  const filteredCandidateControl = useMemo(() => {
    const normalizedSearch = candidateSearchTerm.trim().toLowerCase();

    return candidateControl.filter((candidate) => {
      const matchesStage = !candidateStageFilter || candidate.stage_code === candidateStageFilter;
      const matchesSearch =
        !normalizedSearch ||
        candidate.full_name.toLowerCase().includes(normalizedSearch) ||
        candidate.national_id.toLowerCase().includes(normalizedSearch) ||
        candidate.case_code.toLowerCase().includes(normalizedSearch) ||
        candidate.contract_name.toLowerCase().includes(normalizedSearch) ||
        (candidate.folio ?? "").toLowerCase().includes(normalizedSearch);

      return matchesStage && matchesSearch;
    });
  }, [candidateControl, candidateSearchTerm, candidateStageFilter]);

  useEffect(() => {
    if (filteredCases.length === 0) {
      if (activeView === "processes") {
        setSelectedCaseId("");
      }
      return;
    }

    if (!filteredCases.some((caseRow) => caseRow.id === selectedCaseId) && activeView === "processes") {
      setSelectedCaseId(filteredCases[0]?.id ?? "");
    }
  }, [filteredCases, selectedCaseId, activeView]);

  useEffect(() => {
    if (filteredCandidateControl.length === 0) {
      if (activeView === "candidates") {
        setSelectedCandidateId("");
      }
      return;
    }

    if (!filteredCandidateControl.some((candidate) => candidate.id === selectedCandidateId)) {
      const nextCandidate = filteredCandidateControl[0];
      setSelectedCandidateId(nextCandidate.id);
      setSelectedCaseId(nextCandidate.recruitment_case_id);
    }
  }, [filteredCandidateControl, selectedCandidateId, activeView]);

  const selectedCandidateBoardRow =
    candidateControl.find((candidate) => candidate.id === selectedCandidateId) ??
    filteredCandidateControl[0] ??
    null;

  const selectedCandidate =
    selectedCaseDetail?.candidates.find((candidate) => candidate.id === selectedCandidateId) ??
    selectedCaseDetail?.candidates[0] ??
    null;

  const handleApprovalDecision = async (
    approvalId: number,
    decision: "approved" | "rejected"
  ) => {
    setIsDecisionLoading(approvalId);
    setDecisionMessage("");

    const { error } = await decideHiringApproval({
      approvalId,
      decision,
      comment: null
    });

    if (error) {
      setDecisionMessage(error);
      setIsDecisionLoading(null);
      return;
    }

    setDecisionMessage(
      decision === "approved" ? "Aprobación registrada." : "Rechazo registrado."
    );
    setIsDecisionLoading(null);
    await loadDashboard(selectedCaseId);
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
      await loadCaseDetail(selectedCaseDetail.case.id, selectedCandidate.id);
    }
  };

  return (
    <section className="page">
      <div className="hero-panel hero-panel-compact">
        <h2>Control de Contrataciones</h2>
        <p>
          Seguimiento de procesos activos por folio aprobado y control operativo
          transversal de candidatos dentro del mismo submódulo.
        </p>
      </div>

      <section className="tracking-panel">
        <div className="tracking-kpi-row">
          <article className="tracking-kpi-card tracking-kpi-card-pendiente">
            <span className="micro-label">Folios activos en búsqueda</span>
            <strong>{summary.active_cases}</strong>
          </article>
          <article className="tracking-kpi-card tracking-kpi-card-en-proceso">
            <span className="micro-label">Con candidato listo</span>
            <strong>{summary.ready_to_hire_cases}</strong>
          </article>
          <article className="tracking-kpi-card tracking-kpi-card-generado">
            <span className="micro-label">Casos cubiertos</span>
            <strong>{summary.filled_cases}</strong>
          </article>
        </div>

        <div className="approval-chip-row">
          <button
            type="button"
            className={`approval-chip ${activeView === "processes" ? "tracking-kpi-card-active" : ""}`}
            onClick={() => setActiveView("processes")}
          >
            Resumen de procesos de contratación
          </button>
          <button
            type="button"
            className={`approval-chip ${activeView === "candidates" ? "tracking-kpi-card-active" : ""}`}
            onClick={() => setActiveView("candidates")}
          >
            Control de candidatos
          </button>
        </div>

        {activeView === "processes" ? (
          <>
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
                        <span>
                          {approval.hiring_requests?.job_position_name ?? "Cargo no disponible"}
                        </span>
                        <span>{approval.hiring_requests?.contract_name ?? "Contrato no disponible"}</span>
                      </div>
                      <div className="approval-action-row">
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
                <h3>Resumen de procesos de contratación</h3>
                <span className="tracking-filter-caption">
                  Tabla de seguimiento de folios aprobados y activos en búsqueda, con volumen operativo por folio.
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
                      <th>Candidatos activos</th>
                      <th>Solicitó</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.length > 0 ? (
                      filteredCases.map((caseRow) => (
                        <tr key={caseRow.id}>
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
                          <td>{caseRow.requester_name ?? "No disponible"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="tracking-empty-state" colSpan={7}>
                          {isLoading
                            ? "Cargando casos..."
                            : "No hay folios activos para el filtro actual."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="tracking-toolbar">
              <div className="tracking-toolbar-copy">
                <h3>Control de candidatos</h3>
                <span className="tracking-filter-caption">
                  {errorMessage ||
                    "Consola transversal de candidatos. Un mismo candidato puede participar en varios folios, pero solo uno puede sostener la ruta contractual activa."}
                </span>
              </div>
              <div className="tracking-filters">
                <input
                  className="text-field tracking-search"
                  placeholder="Buscar por candidato, RUT, caso, folio o contrato"
                  value={candidateSearchTerm}
                  onChange={(event) => setCandidateSearchTerm(event.target.value)}
                />
              </div>
            </div>

            <div className="approval-chip-row">
              {candidateStageFilterOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={`approval-chip ${candidateStageFilter === option.key ? "tracking-kpi-card-active" : ""}`}
                  onClick={() => setCandidateStageFilter(option.key)}
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
                        <th>Candidato</th>
                        <th>Folio / Caso</th>
                        <th>Etapa</th>
                        <th>Contrato</th>
                        <th>Participaciones activas</th>
                        <th>Ruta contractual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCandidateControl.length > 0 ? (
                        filteredCandidateControl.map((candidate) => (
                          <tr
                            key={candidate.id}
                            className={
                              candidate.id === selectedCandidateBoardRow?.id ? "tracking-row-selected" : ""
                            }
                            onClick={() => {
                              setSelectedCandidateId(candidate.id);
                              setSelectedCaseId(candidate.recruitment_case_id);
                            }}
                          >
                            <td>
                              <strong>{candidate.full_name}</strong>
                              <div className="tracking-filter-caption">{candidate.national_id}</div>
                            </td>
                            <td>
                              {(candidate.folio ?? "Sin folio")} · {candidate.case_code}
                            </td>
                            <td>
                              <span
                                className={`tracking-status-pill ${getStageChipClass(
                                  candidate.stage_code
                                )}`}
                              >
                                {toRecruitmentCandidateStageLabel(candidate.stage_code)}
                              </span>
                            </td>
                            <td>{candidate.contract_name}</td>
                            <td>{candidate.active_process_count}</td>
                            <td>{getCandidateControlLockLabel(candidate)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="tracking-empty-state" colSpan={6}>
                            {isLoading
                              ? "Cargando candidatos..."
                              : "No hay candidatos activos para el filtro actual."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <aside className="control-detail-panel">
                {selectedCaseDetail && selectedCandidate ? (
                  <>
                    <div className="control-detail-header">
                      <h3>{selectedCandidate.full_name}</h3>
                      <span className="tracking-status-pill">
                        {toRecruitmentCandidateStageLabel(selectedCandidate.stage_code)}
                      </span>
                    </div>

                    <div className="control-readonly-grid">
                      <div>
                        <small>RUT / Identificador</small>
                        <strong>{selectedCandidate.national_id}</strong>
                      </div>
                      <div>
                        <small>Correo / Teléfono</small>
                        <strong>{selectedCandidate.email ?? selectedCandidate.phone ?? "No disponible"}</strong>
                      </div>
                      <div>
                        <small>Folio activo</small>
                        <strong>{selectedCaseDetail.case.hiring_request.folio ?? "Sin folio"}</strong>
                      </div>
                      <div>
                        <small>Caso</small>
                        <strong>{selectedCaseDetail.case.case_code}</strong>
                      </div>
                      <div>
                        <small>Contrato</small>
                        <strong>{selectedCaseDetail.case.contract_name}</strong>
                      </div>
                      <div>
                        <small>Cargo</small>
                        <strong>{selectedCaseDetail.case.job_position_name}</strong>
                      </div>
                      <div>
                        <small>Participaciones activas</small>
                        <strong>{selectedCandidateBoardRow?.active_process_count ?? 1}</strong>
                      </div>
                      <div>
                        <small>Ruta contractual</small>
                        <strong>
                          {selectedCandidateBoardRow
                            ? getCandidateControlLockLabel(selectedCandidateBoardRow)
                            : "No disponible"}
                        </strong>
                      </div>
                    </div>

                    <div className="approval-chip-row">
                      <span className="approval-chip">
                        Owner: {selectedCandidateBoardRow?.owner_name ?? "No asignado"}
                      </span>
                      <span className="approval-chip">
                        Licencia:{" "}
                        {selectedCandidate.driver_license_class
                          ? `${selectedCandidate.driver_license_class} · ${formatDateValue(
                              selectedCandidate.driver_license_expiry
                            )}`
                          : "No registrada"}
                      </span>
                    </div>

                    {selectedCandidateBoardRow?.is_contract_path_blocked ? (
                      <div className="approval-detail-note">
                        <small>Bloqueo operacional</small>
                        <strong>
                          El candidato ya sostiene una ruta contractual en{" "}
                          {selectedCandidateBoardRow.contract_locked_case_code ?? "otro caso"}
                          {selectedCandidateBoardRow.contract_locked_folio
                            ? ` · folio ${selectedCandidateBoardRow.contract_locked_folio}`
                            : ""}.
                        </strong>
                      </div>
                    ) : null}

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
                    <h3>Sin candidato seleccionado</h3>
                    <span className="tracking-filter-caption">
                      {isLoading
                        ? "Cargando candidatos..."
                        : "Selecciona una participación activa para revisar su detalle y mover etapa."}
                    </span>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </section>
    </section>
  );
}
