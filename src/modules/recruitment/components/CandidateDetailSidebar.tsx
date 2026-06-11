import { useEffect, useState } from "react";
import { TextField } from "../../../shared/ui/forms/TextField";
import { SearchableSelectField as SelectField } from "../../../shared/ui/forms/SearchableSelectField";
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
  mode?: "candidate_control" | "personnel_to_hire";
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
  onWhoApprovalRejected?: () => Promise<void>;
  onLicenseUpdated?: () => Promise<void>;
  onInterviewNotesUpdated?: () => Promise<void>;
  onCandidateFileUpdated?: () => Promise<void>;
  onTransferCandidateRequested?: () => void;
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
  mode = "candidate_control",
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
  onWhoApprovalRejected,
  onLicenseUpdated,
  onInterviewNotesUpdated,
  onCandidateFileUpdated,
  onTransferCandidateRequested
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

  if (!selectedCaseDetail || !selectedCandidate || !selectedCandidateBoardRow) {
    return null;
  }

  const stageOptions = getNextStageOptions(selectedCandidate.stage_code).map((stage) => ({
    value: stage,
    label: toRecruitmentCandidateStageLabel(stage)
  }));
  const showStageControls = mode === "candidate_control";
  const isWhoPending = selectedCandidate.stage_code === "who_pending";
  const canApproveWho = hasCapability("can_approve_who_stage");
  const latestWhoApproval = selectedCandidate.who_approval ?? null;
  const completedWhoCauseCount = whoCauseDrafts.filter(
    (cause) => cause.type && cause.year.trim() && cause.comment.trim()
  ).length;
  const isDocumentValidationApproved =
    selectedCandidate.document_validation_status === "approved";

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
      <div className="control-detail-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3>{selectedCandidate.full_name}</h3>
          <span className="tracking-status-pill">
            {toRecruitmentCandidateStageLabel(selectedCandidate.stage_code)}
          </span>
        </div>
        {onTransferCandidateRequested && selectedCandidate.stage_code !== "hired" && selectedCandidate.stage_code !== "rejected" && selectedCandidate.stage_code !== "withdrawn" && (
          <button
            type="button"
            className="soft-primary-button control-compact-button"
            title="Trasladar a otro folio"
            onClick={onTransferCandidateRequested}
          >
            Trasladar
          </button>
        )}
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

          <div className="approval-chip-row control-block-top">
            <span className="approval-chip">
              Owner: {selectedCandidateBoardRow?.owner_name ?? "No asignado"}
            </span>
          </div>

          <div className="approval-detail-note control-block-top">
            <div className="control-inline-header">
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
                  className="control-inline-button"
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
              <div className="control-form-stack">
                <div className="control-form-grid-two">
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
                <div className="control-actions-row">
                  <button
                    type="button"
                    className="soft-primary-button control-compact-button"
                    onClick={() => setIsEditingLicense(false)}
                    disabled={isLicenseSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="soft-primary-button approval-button-approve control-compact-button control-compact-button-primary"
                    onClick={handleSaveLicense}
                    disabled={isLicenseSaving}
                  >
                    {isLicenseSaving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
                {licenseError ? (
                  <p className="control-inline-error">{licenseError}</p>
                ) : null}
              </div>
            )}
          </div>

          {selectedCandidateBoardRow?.is_contract_path_blocked ? (
            <div className="approval-detail-note control-block-top">
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
            <div className="approval-detail-note control-block-top">
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
              <div className="control-readonly-grid control-readonly-grid-spaced">
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
                <div className="who-causes-summary-list who-causes-summary-list-spaced">
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
                <p className="control-comment-text">
                  {latestWhoApproval.comment}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="approval-detail-note control-block-top">
            <small>Revisión documental previa</small>
            <strong>
              {isDocumentValidationApproved
                ? "Aprobada para contratación"
                : "Pendiente de validación final"}
            </strong>
            <div className="control-readonly-grid control-readonly-grid-spaced">
              <div>
                <small>Validado por</small>
                <strong>{selectedCandidate.document_validated_by_name ?? "Pendiente"}</strong>
              </div>
              <div>
                <small>Fecha validación</small>
                <strong>{formatDateTimeValue(selectedCandidate.document_validated_at)}</strong>
              </div>
            </div>
            {selectedCandidate.document_validation_comment ? (
              <p className="control-comment-text">
                {selectedCandidate.document_validation_comment}
              </p>
            ) : null}
            {!isDocumentValidationApproved && selectedCandidate.stage_code === "document_review" ? (
              <p className="who-causes-summary-note">
                La aprobación final de documentos y ficha se registra desde la pestaña
                <strong> Control Documental </strong>
                antes de mover al candidato a contratación.
              </p>
            ) : null}
          </div>

          {showStageControls ? (
            <>
              <div className="control-edit-grid control-edit-grid-spaced">
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

                      <p className="who-causes-summary-note">
                        Si no registras hallazgos, la validación Who se aprobará automáticamente y
                        no generará una tarea pendiente.
                      </p>

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
                    disabled={
                      isStageSaving || 
                      isWhoPending || 
                      !stageDraft || 
                      ((stageDraft === "rejected" || stageDraft === "withdrawn") && !stageComment.trim()) ||
                      (stageDraft === "ready_for_hire" && !isDocumentValidationApproved)
                    }
                    onClick={() =>
                      void onAdvanceStage(
                        stageDraft === "who_pending" ? normalizedWhoCauses : undefined
                      )
                    }
                  >
                    Mover candidato de etapa
                  </button>
                  {(stageDraft === "rejected" || stageDraft === "withdrawn") && !stageComment.trim() ? (
                    <p className="control-inline-error" style={{ marginTop: "6px", fontSize: "0.85rem", color: "#cf1322" }}>
                      * El comentario es obligatorio para descartar.
                    </p>
                  ) : null}
                  {stageDraft === "ready_for_hire" && !isDocumentValidationApproved ? (
                    <p className="control-inline-error" style={{ marginTop: "6px", fontSize: "0.85rem", color: "#cf1322" }}>
                      * Debes aprobar la revisión documental en la pestaña de Control Documental antes de dejarlo listo para contratar.
                    </p>
                  ) : null}
                </div>
              </div>

              {isWhoPending ? (
                <div className="approval-detail-note control-block-top">
                  <small>Control de aprobación Who</small>
                  <strong>
                    Este candidato no puede avanzar mientras la aprobación de antecedentes siga pendiente.
                  </strong>
                  {canApproveWho ? (
                    <div className="control-actions-row control-actions-row-top">
                      <button
                        type="button"
                        className="soft-primary-button"
                        style={{ backgroundColor: "#fff1f0", color: "#cf1322", borderColor: "#ffa39e" }}
                        disabled={isStageSaving}
                        onClick={() => void onWhoApprovalRejected?.()}
                      >
                        {isStageSaving ? "Procesando..." : "Rechazar antecedentes"}
                      </button>
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
            </>
          ) : null}

          {/* Resumen de Entrevista / Puntos Clave */}
          <div className="approval-detail-note control-block-top">
            <div className="control-inline-header">
              <small>Puntos Clave de la Entrevista</small>
              {!isEditingInterview ? (
                <button
                  type="button"
                  onClick={() => {
                    setInterviewNotesText(selectedCandidate.interview_notes || "");
                    setIsEditingInterview(true);
                    setInterviewError("");
                  }}
                  className="control-inline-button"
                >
                  [Editar]
                </button>
              ) : null}
            </div>

            {!isEditingInterview ? (
              <p className={`control-summary-text${selectedCandidate.interview_notes ? "" : " is-empty"}`}>
                {selectedCandidate.interview_notes || "Sin observaciones de entrevista registradas."}
              </p>
            ) : (
              <div className="control-form-stack">
                <textarea
                  id="interview-notes-input"
                  className="control-textarea"
                  placeholder="Escribe aquí los puntos clave, fortalezas y debilidades identificadas en la entrevista..."
                  value={interviewNotesText}
                  onChange={(e) => setInterviewNotesText(e.target.value)}
                />
                <div className="control-actions-row">
                  <button
                    type="button"
                    className="soft-primary-button control-compact-button"
                    onClick={() => setIsEditingInterview(false)}
                    disabled={isInterviewSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="soft-primary-button approval-button-approve control-compact-button control-compact-button-primary"
                    onClick={handleSaveInterviewNotes}
                    disabled={isInterviewSaving}
                  >
                    {isInterviewSaving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
                {interviewError ? (
                  <p className="control-inline-error">{interviewError}</p>
                ) : null}
              </div>
            )}
          </div>

          <div className="approval-detail-note control-block-top-lg">
            <div className="control-inline-header">
              <small>Historial de etapa</small>
              <button
                type="button"
                onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                className="control-inline-button"
              >
                {isHistoryExpanded ? "Contraer ▲" : `Ver historial (${selectedCandidate.stage_history.length}) ▼`}
              </button>
            </div>

            {isHistoryExpanded ? (
              <div className="control-history-scroll">
                {selectedCandidate.stage_history.length > 0 ? (
                  selectedCandidate.stage_history.map((entry, index) => (
                    <div
                      key={index}
                      className={`control-history-entry${index < selectedCandidate.stage_history.length - 1 ? " has-divider" : ""}`}
                    >
                      <strong className="control-history-entry-title">
                        {toRecruitmentCandidateStageLabel(entry.to_stage)}
                      </strong>
                      <span className="control-history-entry-meta">
                        {formatDateTimeValue(entry.created_at)}
                      </span>
                      {entry.comment ? (
                        <p className="control-history-entry-comment">
                          "{entry.comment}"
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <span className="control-history-empty">Sin historial adicional</span>
                )}
              </div>
            ) : null}
          </div>



          {decisionMessage ? <p className="form-status form-status-spaced">{decisionMessage}</p> : null}
        </div>
      )}

      {activeTab === "documents" && (
        <CandidateDocumentChecklist
          caseCandidateId={selectedCandidate.id}
          onChecklistUpdated={onCandidateFileUpdated}
        />
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
