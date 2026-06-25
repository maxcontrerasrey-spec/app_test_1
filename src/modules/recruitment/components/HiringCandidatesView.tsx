import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TextField } from "../../../shared/ui";
import {
  formatRut,
  toRecruitmentCandidateStageLabel,
  type RecruitmentCandidateControlRow,
  type RecruitmentCandidateStage,
  type RecruitmentCaseDetail,
  type WhoApprovalCause
} from "../services/hiringControl";
import {
  invalidateRecruitmentControlQueries,
  useRecruitmentActiveCaseOptions,
  useRecruitmentCandidatesPage
} from "../hooks/useRecruitmentQueries";
import {
  candidateStageFilterOptions,
  getCandidateControlLockLabel,
  getStageChipClass
} from "./hiringControlViewUtils";
import { CandidateDetailSidebar } from "./CandidateDetailSidebar";
import { CandidateIntakeForm } from "./CandidateIntakeForm";
import { TransferCandidateModal } from "./TransferCandidateModal";
import { TrackingPagination } from "./TrackingPagination";

const CANDIDATE_PAGE_SIZE = 50;

type HiringCandidatesViewProps = {
  isParentLoading: boolean;
  errorMessage: string;
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
  isParentLoading,
  errorMessage,
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
  const queryClient = useQueryClient();
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [candidateSearchTerm, setCandidateSearchTerm] = useState("");
  const [candidateStageFilter, setCandidateStageFilter] =
    useState<(typeof candidateStageFilterOptions)[number]["key"]>("active");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [candidatePage, setCandidatePage] = useState(0);
  const candidatesQuery = useRecruitmentCandidatesPage({
    search: debouncedSearchTerm,
    stageFilter: candidateStageFilter,
    limit: CANDIDATE_PAGE_SIZE,
    offset: candidatePage * CANDIDATE_PAGE_SIZE
  });
  const activeCaseOptionsQuery = useRecruitmentActiveCaseOptions({ limit: 500 });
  const candidateControl = candidatesQuery.data?.items ?? [];
  const activeCases = activeCaseOptionsQuery.data ?? [];
  const candidateTotalCount = candidatesQuery.data?.totalCount ?? 0;
  const candidatesError =
    candidatesQuery.error instanceof Error ? candidatesQuery.error.message : "";
  const caseOptionsError =
    activeCaseOptionsQuery.error instanceof Error ? activeCaseOptionsQuery.error.message : "";
  const combinedErrorMessage = errorMessage || candidatesError || caseOptionsError;
  const isLoading =
    isParentLoading || candidatesQuery.isLoading || activeCaseOptionsQuery.isLoading;
  const candidateIntakeCases = useMemo(
    () =>
      activeCases.filter(
        (caseRow) => !["filled", "closed_unfilled", "cancelled"].includes(caseRow.status)
      ),
    [activeCases]
  );

  const selectedCandidateBoardRow =
    candidateControl.find((candidate) => candidate.id === selectedCandidateId) ??
    null;

  const selectedCandidate =
    selectedCaseDetail?.candidates.find((candidate) => candidate.id === selectedCandidateId) ??
    null;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(candidateSearchTerm);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [candidateSearchTerm]);

  useEffect(() => {
    setCandidatePage(0);
  }, [debouncedSearchTerm, candidateStageFilter]);

  return (
    <>
      <div className="tracking-toolbar">
        <div className="tracking-toolbar-copy">
          <h3>Control de candidatos</h3>
          {combinedErrorMessage ? (
            <span className="tracking-filter-caption">
              {combinedErrorMessage}
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
                {candidateControl.length > 0 ? (
                  candidateControl.map((candidate) => (
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
          void invalidateRecruitmentControlQueries(
            queryClient,
            selectedCandidateBoardRow?.recruitment_case_id
          );
        }}
      />
      <TrackingPagination
        page={candidatePage}
        pageSize={CANDIDATE_PAGE_SIZE}
        totalCount={candidateTotalCount}
        label="Candidatos visibles"
        onPageChange={setCandidatePage}
      />
    </>
  );
}
