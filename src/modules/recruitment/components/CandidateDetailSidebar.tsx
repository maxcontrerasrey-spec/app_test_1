import { useEffect, useState } from "react";
import { SelectField, TextField } from "../../../shared/ui";
import { useAuth } from "../../auth/context/AuthContext";
import {
  formatRut,
  toRecruitmentCandidateStageLabel,
  toWhoCauseTypeLabel,
  updateCandidateDriverLicense,
  updateCandidateInterviewNotes,
  type RecruitmentCandidateControlRow,
  type RecruitmentCandidateStage,
  type RecruitmentCaseCandidateRow,
  type RecruitmentCaseDetail,
  type WhoApprovalCause,
  type WhoCauseType
} from "../services/hiringControl";
import {
  formatDateTimeValue,
  formatDateValue,
  getCandidateControlLockLabel,
  getNextStageOptions
} from "./hiringControlViewUtils";
import { CandidateDocumentChecklist } from "./CandidateDocumentChecklist";
import { CandidateWorkerFileForm } from "./CandidateWorkerFileForm";

type CandidateDetailSidebarProps = {
  isLoading: boolean;
  selectedCaseDetail: RecruitmentCaseDetail | null;
  selectedCandidate: RecruitmentCaseCandidateRow | null;
  selectedCandidateBoardRow: RecruitmentCandidateControlRow | null;
  stageDraft: RecruitmentCandidateStage | "";
  stageComment: string;
  isStageSaving: boolean;
  decisionMessage: string;
  onStageDraftChange: (value: RecruitmentCandidateStage | "") => void;
  onStageCommentChange: (value: string) => void;
  onAdvanceStage: (whoCauses?: WhoApprovalCause[]) => Promise<void>;
  onWhoApprovalRegistered?: () => Promise<void>;
  onLicenseUpdated?: () => Promise<void>;
  onInterviewNotesUpdated?: () => Promise<void>;
  onCandidateFileUpdated?: () => Promise<void>;
};

type WhoCauseDraft = {
  type: WhoCauseType | "";
  year: string;
  comment: string;
};

const buildEmptyWhoCauseDrafts = (): WhoCauseDraft[] =>
  Array.from({ length: 4 }, () => ({
    type: "",
    year: "",
    comment: ""
  }));

export function CandidateDetailSidebar({
  isLoading,
  selectedCaseDetail,
  selectedCandidate,
  selectedCandidateBoardRow,
  stageDraft,
  stageComment,
  isStageSaving,
  decisionMessage,
  onStageDraftChange,
  onStageCommentChange,
  onAdvanceStage,
  onWhoApprovalRegistered,
  onLicenseUpdated,
  onInterviewNotesUpdated,
  onCandidateFileUpdated
}: CandidateDetailSidebarProps) {
  const { hasCapability } = useAuth();
  const [activeTab, setActiveTab] = useState<"pipeline" | "documents" | "worker">("pipeline");
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const [isEditingLicense, setIsEditingLicense] = useState(false);
  const [licenseClass, setLicenseClass] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [isLicenseSaving, setIsLicenseSaving] = useState(false);
  const [licenseError, setLicenseError] = useState("");

  const [isEditingInterview, setIsEditingInterview] = useState(false);
  const [interviewNotesText, setInterviewNotesText] = useState("");
  const [isInterviewSaving, setIsInterviewSaving] = useState(false);
  const [interviewError, setInterviewError] = useState("");
  const [isWhoCausesExpanded, setIsWhoCausesExpanded] = useState(false);
  const [whoCauseDrafts, setWhoCauseDrafts] = useState<WhoCauseDraft[]>(buildEmptyWhoCauseDrafts);

  useEffect(() => {
    setIsHistoryExpanded(false);
    setIsEditingLicense(false);
    setLicenseError("");

    setIsEditingInterview(false);
    setInterviewNotesText(selectedCandidate?.interview_notes || "");
    setInterviewError("");
    setIsWhoCausesExpanded(false);
    setWhoCauseDrafts(buildEmptyWhoCauseDrafts());
  }, [selectedCandidate?.id]);

  useEffect(() => {
    if (stageDraft === "who_pending") {
      setIsWhoCausesExpanded(true);
    }
  }, [stageDraft]);

  const handleSaveLicense = async () => {
    if (!selectedCandidate) return;
    setIsLicenseSaving(true);
    setLicenseError("");

    const { error } = await updateCandidateDriverLicense({
      candidateProfileId: selectedCandidate.candidate_profile_id,
      driverLicenseClass: licenseClass.trim() || null,
      driverLicenseExpiry: licenseExpiry || null
    });

    if (error) {
      setLicenseError(error);
      setIsLicenseSaving(false);
      return;
    }

    setIsLicenseSaving(false);
    setIsEditingLicense(false);
    if (onLicenseUpdated) {
      await onLicenseUpdated();
    }
  };

  const handleSaveInterviewNotes = async () => {
    if (!selectedCandidate) return;
    setIsInterviewSaving(true);
    setInterviewError("");

    const { error } = await updateCandidateInterviewNotes({
      caseCandidateId: selectedCandidate.id,
      notes: interviewNotesText.trim() || null
    });

    if (error) {
      setInterviewError(error);
      setIsInterviewSaving(false);
      return;
    }

    setIsInterviewSaving(false);
    setIsEditingInterview(false);
    if (onInterviewNotesUpdated) {
      await onInterviewNotesUpdated();
    }
  };

  if (!selectedCaseDetail || !selectedCandidate) {
    return (
      <aside className="control-detail-panel">
        <div className="control-detail-header">
          <h3>Sin candidato seleccionado</h3>
          <span className="tracking-filter-caption">
            {isLoading
              ? "Cargando candidatos..."
              : "Selecciona una participación activa para revisar su detalle y mover etapa."}
          </span>
        </div>
      </aside>
    );
  }

  const stageOptions = getNextStageOptions(selectedCandidate.stage_code).map((stage) => ({
    value: stage,
    label: toRecruitmentCandidateStageLabel(stage)
  }));
  const isWhoPending = selectedCandidate.stage_code === "who_pending";
  const canApproveWho = hasCapability("can_approve_who_stage");
  const latestWhoApproval = selectedCandidate.who_approval ?? null;
  const completedWhoCauseCount = whoCauseDrafts.filter(
    (cause) => cause.type && cause.year.trim() && cause.comment.trim()
  ).length;

  const handleWhoCauseDraftChange = (
    index: number,
    field: keyof WhoCauseDraft,
    value: string
  ) => {
    setWhoCauseDrafts((current) =>
      current.map((cause, causeIndex) =>
        causeIndex === index
          ? {
              ...cause,
              [field]: field === "year" ? value.replace(/[^\d]/g, "").slice(0, 4) : value
            }
          : cause
      )
    );
  };

  const normalizedWhoCauses: WhoApprovalCause[] = whoCauseDrafts
    .filter((cause) => cause.type && cause.year.trim() && cause.comment.trim())
    .map((cause) => ({
      type: cause.type as WhoCauseType,
      year: Number(cause.year),
      comment: cause.comment.trim()
    }));

  return (
    <aside className="control-detail-panel">
      <div className="control-detail-header">
        <h3>{selectedCandidate.full_name}</h3>
        <span className="tracking-status-pill">
          {toRecruitmentCandidateStageLabel(selectedCandidate.stage_code)}
        </span>
      </div>

      <div className="control-tabs-row">
        <button 
          type="button" 
          className={`control-tab ${activeTab === "pipeline" ? "active" : ""}`}
          onClick={() => setActiveTab("pipeline")}
        >
          Pipeline Operativo
        </button>
        <button 
          type="button" 
          className={`control-tab ${activeTab === "documents" ? "active" : ""}`}
          onClick={() => setActiveTab("documents")}
        >
          Control Documental
        </button>
        <button
          type="button"
          className={`control-tab ${activeTab === "worker" ? "active" : ""}`}
          onClick={() => setActiveTab("worker")}
        >
          Ficha del candidato
        </button>
      </div>

      {activeTab === "pipeline" && (
        <div className="control-detail-body">
          <div className="control-readonly-grid">
            <div>
              <small>RUT / Identificador</small>
              <strong>{formatRut(selectedCandidate.national_id)}</strong>
            </div>
            <div>
              <small>Correo</small>
              <strong>{selectedCandidate.email || "No disponible"}</strong>
            </div>
            <div>
              <small>Teléfono</small>
              <strong>{selectedCandidate.phone || "No disponible"}</strong>
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

          <div className="approval-chip-row" style={{ marginTop: "1rem" }}>
            <span className="approval-chip">
              Owner: {selectedCandidateBoardRow?.owner_name ?? "No asignado"}
            </span>
          </div>

          <div className="approval-detail-note" style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <small>Licencia de Conducir</small>
              {!isEditingLicense ? (
                <button
                  type="button"
                  onClick={() => {
                    setLicenseClass(selectedCandidate.driver_license_class || "");
                    setLicenseExpiry(selectedCandidate.driver_license_expiry || "");
                    setIsEditingLicense(true);
                    setLicenseError("");
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--accent, #0052cc)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    padding: 0,
                    fontWeight: "medium"
                  }}
                >
                  [Editar]
                </button>
              ) : null}
            </div>

            {!isEditingLicense ? (
              <strong>
                {selectedCandidate.driver_license_class
                  ? `${selectedCandidate.driver_license_class} · Vence: ${formatDateValue(selectedCandidate.driver_license_expiry)}`
                  : "No registrada"}
              </strong>
            ) : (
              <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <TextField
                    id="license-class-input"
                    label="Clase de Licencia"
                    value={licenseClass}
                    placeholder="Ej: A2, A4, B"
                    onChange={(e) => setLicenseClass(e.target.value)}
                  />
                  <TextField
                    id="license-expiry-input"
                    label="Vencimiento"
                    type="date"
                    value={licenseExpiry}
                    onChange={(e) => setLicenseExpiry(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "end" }}>
                  <button
                    type="button"
                    className="soft-primary-button"
                    style={{ minHeight: "2rem", minWidth: "4.5rem", fontSize: "0.82rem", padding: "0 0.5rem" }}
                    onClick={() => setIsEditingLicense(false)}
                    disabled={isLicenseSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="soft-primary-button approval-button-approve"
                    style={{ minHeight: "2rem", minWidth: "4.5rem", fontSize: "0.82rem", padding: "0 0.5rem", color: "#fff", background: "var(--accent, #0052cc)" }}
                    onClick={handleSaveLicense}
                    disabled={isLicenseSaving}
                  >
                    {isLicenseSaving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
                {licenseError ? (
                  <p style={{ margin: "0.25rem 0 0", color: "var(--error, #e53e3e)", fontSize: "0.8rem" }}>{licenseError}</p>
                ) : null}
              </div>
            )}
          </div>

          {selectedCandidateBoardRow?.is_contract_path_blocked ? (
            <div className="approval-detail-note" style={{ marginTop: "1rem" }}>
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

          {latestWhoApproval ? (
            <div className="approval-detail-note" style={{ marginTop: "1rem" }}>
              <small>Aprobación Who</small>
              <strong>
                {latestWhoApproval.status === "approved"
                  ? "Aprobada"
                  : latestWhoApproval.status === "pending"
                    ? "Pendiente"
                    : latestWhoApproval.status === "rejected"
                      ? "Rechazada"
                      : "Cancelada"}
              </strong>
              <div className="control-readonly-grid" style={{ marginTop: "0.75rem" }}>
                <div>
                  <small>Solicitado por</small>
                  <strong>{latestWhoApproval.requested_by_name ?? "No disponible"}</strong>
                </div>
                <div>
                  <small>Fecha solicitud</small>
                  <strong>{formatDateTimeValue(latestWhoApproval.requested_at)}</strong>
                </div>
                <div>
                  <small>Aprobado por</small>
                  <strong>{latestWhoApproval.approved_by_name ?? "Pendiente"}</strong>
                </div>
                <div>
                  <small>Fecha aprobación</small>
                  <strong>{formatDateTimeValue(latestWhoApproval.approved_at)}</strong>
                </div>
              </div>
              {latestWhoApproval.causes?.length ? (
                <div className="who-causes-summary-list" style={{ marginTop: "0.75rem" }}>
                  {latestWhoApproval.causes.map((cause, index) => (
                    <div key={`${latestWhoApproval.id}-sidebar-cause-${index}`} className="who-causes-summary-item">
                      <span className="who-causes-summary-title">Causa {index + 1}</span>
                      <span>{toWhoCauseTypeLabel(cause.type)}</span>
                      <span>{cause.year}</span>
                      <p>{cause.comment}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {latestWhoApproval.comment ? (
                <p style={{ marginTop: "0.75rem", fontSize: "0.88rem", color: "#555" }}>
                  {latestWhoApproval.comment}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="control-edit-grid" style={{ marginTop: "1.5rem" }}>
            <SelectField
              id="candidate-next-stage"
              label="Siguiente etapa"
              value={stageDraft}
              disabled={isWhoPending || isStageSaving}
              onChange={(event) =>
                onStageDraftChange(event.target.value as RecruitmentCandidateStage | "")
              }
              options={stageOptions}
              placeholder="Selecciona una etapa"
            />

            <TextField
              id="candidate-stage-comment"
              label="Comentario"
              value={stageComment}
              disabled={isStageSaving}
              onChange={(event) => onStageCommentChange(event.target.value)}
            />

            {stageDraft === "who_pending" ? (
              <div className="control-span-full">
                <div className="approval-detail-note who-causes-configurator">
                  <div className="who-causes-configurator-header">
                    <div>
                      <small>Resumen para aprobación Who</small>
                      <strong>{completedWhoCauseCount} / 4 causas completas</strong>
                    </div>
                    <button
                      type="button"
                      className="who-causes-toggle"
                      onClick={() => setIsWhoCausesExpanded((current) => !current)}
                    >
                      {isWhoCausesExpanded ? "Contraer ▲" : "Configurar causas ▼"}
                    </button>
                  </div>

                  {isWhoCausesExpanded ? (
                    <div className="who-causes-editor-list">
                      {whoCauseDrafts.map((cause, index) => (
                        <div key={`who-cause-${index}`} className="who-cause-editor-row">
                          <div className="who-cause-editor-title">Causa {index + 1}</div>
                          <div className="who-cause-editor-fields">
                            <SelectField
                              id={`who-cause-type-${index}`}
                              label="Tipo de causa"
                              value={cause.type}
                              onChange={(event) =>
                                handleWhoCauseDraftChange(index, "type", event.target.value)
                              }
                              options={[
                                { value: "laboral", label: "Laboral" },
                                { value: "penal", label: "Penal" },
                                { value: "civil", label: "Civil" }
                              ]}
                              placeholder="Selecciona tipo"
                              disabled={isStageSaving}
                            />
                            <TextField
                              id={`who-cause-year-${index}`}
                              label="Año"
                              value={cause.year}
                              placeholder="Ej: 2023"
                              onChange={(event) =>
                                handleWhoCauseDraftChange(index, "year", event.target.value)
                              }
                              disabled={isStageSaving}
                            />
                            <TextField
                              id={`who-cause-comment-${index}`}
                              label="Comentario"
                              value={cause.comment}
                              placeholder="Resumen breve de la causa"
                              onChange={(event) =>
                                handleWhoCauseDraftChange(index, "comment", event.target.value)
                              }
                              disabled={isStageSaving}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="control-span-full">
              <button
                type="button"
                className="soft-primary-button approval-button-approve"
                disabled={isStageSaving || isWhoPending || !stageDraft}
                onClick={() =>
                  void onAdvanceStage(stageDraft === "who_pending" ? normalizedWhoCauses : undefined)
                }
              >
                Mover candidato de etapa
              </button>
            </div>
          </div>

          {isWhoPending ? (
            <div className="approval-detail-note" style={{ marginTop: "1rem" }}>
              <small>Control de aprobación Who</small>
              <strong>
                Este candidato no puede avanzar mientras la aprobación de antecedentes siga pendiente.
              </strong>
              {canApproveWho ? (
                <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="soft-primary-button approval-button-approve"
                    disabled={isStageSaving}
                    onClick={() => void onWhoApprovalRegistered?.()}
                  >
                    {isStageSaving ? "Aprobando..." : "Aprobar antecedentes"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Resumen de Entrevista / Puntos Clave */}
          <div className="approval-detail-note" style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <small>Puntos Clave de la Entrevista</small>
              {!isEditingInterview ? (
                <button
                  type="button"
                  onClick={() => {
                    setInterviewNotesText(selectedCandidate.interview_notes || "");
                    setIsEditingInterview(true);
                    setInterviewError("");
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--accent, #0052cc)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    padding: 0,
                    fontWeight: "medium"
                  }}
                >
                  [Editar]
                </button>
              ) : null}
            </div>

            {!isEditingInterview ? (
              <p style={{ margin: 0, fontSize: "0.88rem", whiteSpace: "pre-wrap", color: selectedCandidate.interview_notes ? "#333" : "#777", fontStyle: selectedCandidate.interview_notes ? "normal" : "italic" }}>
                {selectedCandidate.interview_notes || "Sin observaciones de entrevista registradas."}
              </p>
            ) : (
              <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.5rem" }}>
                <textarea
                  id="interview-notes-input"
                  style={{
                    width: "100%",
                    minHeight: "100px",
                    padding: "0.5rem",
                    fontSize: "0.88rem",
                    border: "1px solid #d2d2d4",
                    borderRadius: "4px",
                    fontFamily: "inherit",
                    resize: "vertical",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                  placeholder="Escribe aquí los puntos clave, fortalezas y debilidades identificadas en la entrevista..."
                  value={interviewNotesText}
                  onChange={(e) => setInterviewNotesText(e.target.value)}
                />
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "end" }}>
                  <button
                    type="button"
                    className="soft-primary-button"
                    style={{ minHeight: "2rem", minWidth: "4.5rem", fontSize: "0.82rem", padding: "0 0.5rem" }}
                    onClick={() => setIsEditingInterview(false)}
                    disabled={isInterviewSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="soft-primary-button approval-button-approve"
                    style={{ minHeight: "2rem", minWidth: "4.5rem", fontSize: "0.82rem", padding: "0 0.5rem", color: "#fff", background: "var(--accent, #0052cc)" }}
                    onClick={handleSaveInterviewNotes}
                    disabled={isInterviewSaving}
                  >
                    {isInterviewSaving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
                {interviewError ? (
                  <p style={{ margin: "0.25rem 0 0", color: "var(--error, #e53e3e)", fontSize: "0.8rem" }}>{interviewError}</p>
                ) : null}
              </div>
            )}
          </div>

          <div className="approval-detail-note" style={{ marginTop: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <small>Historial de etapa</small>
              <button
                type="button"
                onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent, #0052cc)",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  padding: 0,
                  fontWeight: "medium"
                }}
              >
                {isHistoryExpanded ? "Contraer ▲" : `Ver historial (${selectedCandidate.stage_history.length}) ▼`}
              </button>
            </div>

            {isHistoryExpanded ? (
              <div style={{ marginTop: "0.5rem", maxHeight: "150px", overflowY: "auto" }}>
                {selectedCandidate.stage_history.length > 0 ? (
                  selectedCandidate.stage_history.map((entry, index) => (
                    <div
                      key={index}
                      style={{
                        padding: "0.35rem 0",
                        borderBottom: index < selectedCandidate.stage_history.length - 1 ? "1px solid #f0f0f0" : "none",
                        fontSize: "0.85rem",
                        lineHeight: "1.3"
                      }}
                    >
                      <strong style={{ display: "block", color: "#333" }}>
                        {toRecruitmentCandidateStageLabel(entry.to_stage)}
                      </strong>
                      <span style={{ fontSize: "0.78rem", color: "#666" }}>
                        {formatDateTimeValue(entry.created_at)}
                      </span>
                      {entry.comment ? (
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#555", fontStyle: "italic" }}>
                          "{entry.comment}"
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <span style={{ fontSize: "0.85rem", color: "#777" }}>Sin historial adicional</span>
                )}
              </div>
            ) : null}
          </div>



          {decisionMessage ? <p className="form-status" style={{ marginTop: "1rem" }}>{decisionMessage}</p> : null}
        </div>
      )}

      {activeTab === "documents" && (
        <CandidateDocumentChecklist caseCandidateId={selectedCandidate.id} />
      )}

      {activeTab === "worker" && (
        <CandidateWorkerFileForm
          candidate={selectedCandidate}
          caseDetail={selectedCaseDetail}
          onSaved={onCandidateFileUpdated}
        />
      )}
    </aside>
  );
}
