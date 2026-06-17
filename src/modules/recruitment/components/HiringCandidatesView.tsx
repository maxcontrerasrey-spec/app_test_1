import { useMemo, useState } from "react";
import { TextField } from "../../../shared/ui";
import {
  formatRut,
  toRecruitmentCandidateStageLabel,
  type RecruitmentCandidateControlRow,
  type RecruitmentCandidateStage,
  type RecruitmentCaseDetail,
  type RecruitmentCaseListRow,
  type WhoApprovalCause
} from "../services/hiringControl";
import {
  candidateStageFilterOptions,
  getCandidateControlLockLabel,
  getStageChipClass
} from "./hiringControlViewUtils";
import { CandidateDetailSidebar } from "./CandidateDetailSidebar";
import { CandidateIntakeForm } from "./CandidateIntakeForm";
import { TransferCandidateModal } from "./TransferCandidateModal";

type HiringCandidatesViewProps = {
  isLoading: boolean;
  errorMessage: string;
  activeCases: RecruitmentCaseListRow[];
  candidateControl: RecruitmentCandidateControlRow[];
  selectedCandidateId: string;
  selectedCaseDetail: RecruitmentCaseDetail | null;
  stageDraft: RecruitmentCandidateStage | "";
  stageComment: string;
  isStageSaving: boolean;
  decisionMessage: string;
  onSelectCandidate: (candidateId: string, caseId: string) => void;
  onCandidateAdded: (caseId: string, candidateId: string) => Promise<void>;
  onStageDraftChange: (value: RecruitmentCandidateStage | "") => void;
  onStageCommentChange: (value: string) => void;
  onAdvanceStage: (whoCauses?: WhoApprovalCause[]) => Promise<void>;
  onWhoApprovalRegistered: () => Promise<void>;
  onWhoApprovalRejected?: () => Promise<void>;
  onLicenseUpdated: () => Promise<void>;
  onInterviewNotesUpdated: () => Promise<void>;
  onCandidateFileUpdated: () => Promise<void>;
};

export function HiringCandidatesView({
  isLoading,
  errorMessage,
  activeCases,
  candidateControl,
  selectedCandidateId,
  selectedCaseDetail,
  stageDraft,
  stageComment,
  isStageSaving,
  decisionMessage,
  onSelectCandidate,
  onCandidateAdded,
  onStageDraftChange,
  onStageCommentChange,
  onAdvanceStage,
  onWhoApprovalRegistered,
  onWhoApprovalRejected,
  onLicenseUpdated,
  onInterviewNotesUpdated,
  onCandidateFileUpdated
}: HiringCandidatesViewProps) {
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [candidateSearchTerm, setCandidateSearchTerm] = useState("");
  const [candidateStageFilter, setCandidateStageFilter] =
    useState<(typeof candidateStageFilterOptions)[number]["key"]>("active");
  const candidateIntakeCases = useMemo(
    () =>
      activeCases.filter(
        (caseRow) => !["filled", "closed_unfilled", "cancelled"].includes(caseRow.status)
      ),
    [activeCases]
  );

  const filteredCandidateControl = useMemo(() => {
    const normalizedSearch = candidateSearchTerm.trim().toLowerCase();

    return candidateControl.filter((candidate) => {
      let matchesStage = false;
      if (candidateStageFilter === "active") {
        matchesStage = candidate.stage_code !== "rejected" && candidate.stage_code !== "withdrawn";
      } else if (candidateStageFilter === "discarded") {
        matchesStage = candidate.stage_code === "rejected" || candidate.stage_code === "withdrawn";
      } else {
        matchesStage = candidate.stage_code === candidateStageFilter;
      }

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

  const selectedCandidateBoardRow =
    candidateControl.find((candidate) => candidate.id === selectedCandidateId) ??
    null;

  const selectedCandidate =
    selectedCaseDetail?.candidates.find((candidate) => candidate.id === selectedCandidateId) ??
    null;

  return (
    <>
      <div className="tracking-toolbar">
        <div className="tracking-toolbar-copy">
          <h3>Control de candidatos</h3>
          {errorMessage ? (
            <span className="tracking-filter-caption">
              {errorMessage}
            </span>
          ) : null}
        </div>
        <div className="tracking-filters tracking-filters-inline">
          <button
            type="button"
            className="soft-primary-button"
            style={{ flexShrink: 0 }}
            disabled={candidateIntakeCases.length === 0}
            onClick={() => setShowCandidateForm((current) => !current)}
          >
            {showCandidateForm ? "Cerrar alta" : "Registrar candidato"}
          </button>
          <TextField
            id="hiring-candidates-search"
            label="Buscar candidatos"
            value={candidateSearchTerm}
            placeholder="Buscar por candidato, RUT, caso, folio o contrato"
            onChange={(event) => setCandidateSearchTerm(event.target.value)}
            className="tracking-search-field"
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

      <div 
        className="control-layout" 
        style={!selectedCandidateBoardRow ? { gridTemplateColumns: "1fr" } : undefined}
      >
        <div className="tracking-table-wrap">
          {showCandidateForm ? (
            <CandidateIntakeForm
              initialCaseId={selectedCaseDetail?.case.id ?? candidateIntakeCases[0]?.id ?? ""}
              candidateIntakeCases={candidateIntakeCases}
              selectedCaseDetail={selectedCaseDetail}
              onCandidateAdded={onCandidateAdded}
            />
          ) : null}
          <div className="tracking-table-scroll">
            <table className="tracking-table">
              <thead>
                <tr>
                   <th>Candidato</th>
                   <th>Caso</th>
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
                        candidate.id === selectedCandidateBoardRow?.id
                          ? "tracking-row-selected"
                          : ""
                      }
                      onClick={() => {
                        if (candidate.id === selectedCandidateBoardRow?.id) {
                          onSelectCandidate("", "");
                          return;
                        }

                        onSelectCandidate(candidate.id, candidate.recruitment_case_id);
                      }}
                    >
                      <td>
                        <strong>{candidate.full_name}</strong>
                        <div className="tracking-filter-caption">
                          {formatRut(candidate.national_id)}
                        </div>
                      </td>
                       <td>
                         {candidate.case_code}
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

        <CandidateDetailSidebar
          isLoading={isLoading}
          selectedCaseDetail={selectedCaseDetail}
          selectedCandidate={selectedCandidate}
          selectedCandidateBoardRow={selectedCandidateBoardRow}
          stageDraft={stageDraft}
          stageComment={stageComment}
          isStageSaving={isStageSaving}
          decisionMessage={decisionMessage}
          onStageDraftChange={onStageDraftChange}
          onStageCommentChange={onStageCommentChange}
          onAdvanceStage={onAdvanceStage}
          onWhoApprovalRegistered={onWhoApprovalRegistered}
          onWhoApprovalRejected={onWhoApprovalRejected}
          onLicenseUpdated={onLicenseUpdated}
          onInterviewNotesUpdated={onInterviewNotesUpdated}
          onCandidateFileUpdated={onCandidateFileUpdated}
          onTransferCandidateRequested={() => setIsTransferModalOpen(true)}
        />
      </div>

      <TransferCandidateModal
        isOpen={isTransferModalOpen}
        candidate={selectedCandidateBoardRow}
        activeCases={activeCases}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={() => {
          setIsTransferModalOpen(false);
          // trigger a refresh of the dashboard
          // Since there is no onRefresh passed to HiringCandidatesView directly,
          // the parent handles polling/refresh via queries, but we might want to force it.
          // For now, the user can change candidate or the polling will pick it up.
        }}
      />
    </>
  );
}
