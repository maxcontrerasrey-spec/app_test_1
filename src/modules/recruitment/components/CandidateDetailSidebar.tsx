import { useEffect, useState } from "react";
import { SelectField, TextField } from "../../../shared/ui";
import {
  formatRut,
  toRecruitmentCandidateStageLabel,
  type RecruitmentCandidateControlRow,
  type RecruitmentCandidateStage,
  type RecruitmentCaseCandidateRow,
  type RecruitmentCaseDetail
} from "../services/hiringControl";
import {
  formatDateTimeValue,
  formatDateValue,
  getCandidateControlLockLabel,
  getNextStageOptions
} from "./hiringControlViewUtils";
import { CandidateDocumentChecklist } from "./CandidateDocumentChecklist";

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
  onAdvanceStage: () => Promise<void>;
};

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
  onAdvanceStage
}: CandidateDetailSidebarProps) {
  const [activeTab, setActiveTab] = useState<"pipeline" | "documents">("pipeline");
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  useEffect(() => {
    setIsHistoryExpanded(false);
  }, [selectedCandidate?.id]);

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

          <div className="control-edit-grid" style={{ marginTop: "1.5rem" }}>
            <SelectField
              id="candidate-next-stage"
              label="Siguiente etapa"
              value={stageDraft}
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
              onChange={(event) => onStageCommentChange(event.target.value)}
            />

            <div className="control-span-full">
              <button
                type="button"
                className="soft-primary-button approval-button-approve"
                disabled={isStageSaving || !stageDraft}
                onClick={() => void onAdvanceStage()}
              >
                Mover candidato de etapa
              </button>
            </div>
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

          <div className="approval-detail-note" style={{ marginTop: "1rem" }}>
            <small style={{ display: "block", marginBottom: "0.35rem" }}>Auditoría del caso (últimos 5 eventos)</small>
            <div style={{ fontSize: "0.82rem", color: "#555" }}>
              {selectedCaseDetail.audit.length > 0 ? (
                selectedCaseDetail.audit.slice(0, 5).map((entry, index) => (
                  <div key={index} style={{ padding: "0.15rem 0" }}>
                    • {entry.action_type} · {entry.actor_name ?? "Usuario"} · {formatDateTimeValue(entry.created_at)}
                  </div>
                ))
              ) : (
                <span>Sin eventos registrados</span>
              )}
            </div>
          </div>

          {decisionMessage ? <p className="form-status" style={{ marginTop: "1rem" }}>{decisionMessage}</p> : null}
        </div>
      )}

      {activeTab === "documents" && (
        <CandidateDocumentChecklist caseCandidateId={selectedCandidate.id} />
      )}
    </aside>
  );
}
