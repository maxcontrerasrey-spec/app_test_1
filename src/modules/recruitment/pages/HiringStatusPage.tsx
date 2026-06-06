import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageShell } from "../../../shared/ui";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { useAuth } from "../../auth/context/AuthContext";
import {
  getRecruitmentCaseDetailQueryOptions,
  useRecruitmentCaseDetail,
  useRecruitmentControlDashboard
} from "../hooks/useRecruitmentQueries";
import {
  approveCandidateStageWho,
  rejectCandidateStageWho,
  advanceRecruitmentCandidateStage,
  requestCandidateStageWho,
  type RecruitmentCandidateStage,
  type RecruitmentDashboardSummary,
  type WhoApprovalCause
} from "../services/hiringControl";
import { HiringCandidatesView } from "../components/HiringCandidatesView";
import { HiringPersonnelToHireView } from "../components/HiringPersonnelToHireView";
import { HiringProcessesView } from "../components/HiringProcessesView";

type RecruitmentInternalView = "processes" | "candidates" | "personnel_to_hire";

const emptySummary: RecruitmentDashboardSummary = {
  pending_contracts_control: 0,
  active_cases: 0,
  ready_to_hire_cases: 0,
  filled_cases: 0,
  total_cases: 0
};

export function HiringStatusPage() {
  const { user, hasCapability } = useAuth();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<RecruitmentInternalView>("processes");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [isDecisionLoading, setIsDecisionLoading] = useState<number | null>(null);
  const [isStageSaving, setIsStageSaving] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState("");
  const [stageDraft, setStageDraft] = useState<RecruitmentCandidateStage | "">("");
  const [stageComment, setStageComment] = useState("");
  const canAccessCandidateControl = hasCapability("candidate_control_access");
  const dashboardQuery = useRecruitmentControlDashboard();
  const dashboardData = dashboardQuery.data;
  const summary = dashboardData?.summary ?? emptySummary;
  const pendingApprovals = dashboardData?.pendingApprovals ?? [];
  const activeCases = dashboardData?.activeCases ?? [];
  const candidateControl = dashboardData?.candidateControl ?? [];
  const personnelToHire = dashboardData?.personnelToHire ?? [];
  const shouldLoadCaseDetail =
    canAccessCandidateControl &&
    (activeView === "candidates" || activeView === "personnel_to_hire") &&
    Boolean(selectedCaseId);
  const caseDetailQuery = useRecruitmentCaseDetail(selectedCaseId, shouldLoadCaseDetail);
  const selectedCaseDetail = caseDetailQuery.data ?? null;
  const dashboardError =
    dashboardQuery.error instanceof Error ? dashboardQuery.error.message : "";
  const caseDetailError =
    caseDetailQuery.error instanceof Error ? caseDetailQuery.error.message : "";
  const errorMessage = dashboardError || caseDetailError;
  const isLoading = Boolean(
    dashboardQuery.isLoading || (shouldLoadCaseDetail && caseDetailQuery.isLoading)
  );

  const preferredCaseIds = useMemo(
    () => [
      ...activeCases.map((item) => item.id),
      ...candidateControl.map((item) => item.recruitment_case_id),
      ...personnelToHire.map((item) => item.recruitment_case_id)
    ],
    [activeCases, candidateControl, personnelToHire]
  );

  const invalidateRecruitmentCache = async (caseId?: string) => {
    const targetCaseId = caseId || selectedCaseId;

    await queryClient.invalidateQueries({
      queryKey: queryKeys.recruitment.controlDashboard()
    });

    if (targetCaseId) {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.recruitment.caseDetail(targetCaseId)
      });
    }
  };

  useEffect(() => {
    const nextCaseId =
      selectedCaseId && preferredCaseIds.includes(selectedCaseId)
        ? selectedCaseId
        : preferredCaseIds[0] ?? "";

    if (nextCaseId !== selectedCaseId) {
      setSelectedCaseId(nextCaseId);
    }
  }, [preferredCaseIds, selectedCaseId]);

  useEffect(() => {
    if (!selectedCaseDetail) {
      if (selectedCandidateId) {
        setSelectedCandidateId("");
      }
      return;
    }

    const nextCandidateId = selectedCaseDetail.candidates.some(
      (candidate) => candidate.id === selectedCandidateId
    )
      ? selectedCandidateId
      : selectedCaseDetail.candidates[0]?.id ?? "";

    if (nextCandidateId !== selectedCandidateId) {
      setSelectedCandidateId(nextCandidateId);
    }
  }, [selectedCandidateId, selectedCaseDetail]);

  useEffect(() => {
    setStageDraft("");
    setStageComment("");
  }, [selectedCaseId, selectedCandidateId]);

  useEffect(() => {
    if (!canAccessCandidateControl && activeView !== "processes") {
      setActiveView("processes");
      setSelectedCandidateId("");
      setStageDraft("");
      setStageComment("");
    }
  }, [activeView, canAccessCandidateControl]);

  const handleCandidateAdded = async (caseId: string, candidateId: string) => {
    setSelectedCaseId(caseId);
    setSelectedCandidateId(candidateId);

    await Promise.all([
      invalidateRecruitmentCache(caseId),
      queryClient.prefetchQuery(getRecruitmentCaseDetailQueryOptions(caseId))
    ]);
  };

  const handleAdvanceStage = async (whoCauses?: WhoApprovalCause[]) => {
    const selectedCandidate =
      selectedCaseDetail?.candidates.find((candidate) => candidate.id === selectedCandidateId) ??
      selectedCaseDetail?.candidates[0] ??
      null;

    if (!selectedCandidate || !stageDraft) {
      return;
    }

    setIsStageSaving(true);
    setDecisionMessage("");

    const { error } =
      stageDraft === "who_pending"
        ? await requestCandidateStageWho({
            caseCandidateId: selectedCandidate.id,
            comment: stageComment,
            causes: whoCauses ?? []
          })
        : await advanceRecruitmentCandidateStage({
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
      await invalidateRecruitmentCache(selectedCaseDetail.case.id);
    }
  };

  const handleLicenseUpdated = async () => {
    if (selectedCaseId && selectedCandidateId) {
      await invalidateRecruitmentCache(selectedCaseId);
    }
  };

  const handleCandidateFileUpdated = async () => {
    if (selectedCaseId && selectedCandidateId) {
      await invalidateRecruitmentCache(selectedCaseId);
    }
  };

  const handleWhoApprovalRegistered = async () => {
    const selectedCandidate =
      selectedCaseDetail?.candidates.find((candidate) => candidate.id === selectedCandidateId) ??
      selectedCaseDetail?.candidates[0] ??
      null;

    if (!selectedCandidate || !selectedCaseDetail) {
      return;
    }

    setIsStageSaving(true);
    setDecisionMessage("");

    const { error } = await approveCandidateStageWho({
      caseCandidateId: selectedCandidate.id,
      comment: stageComment
    });

    if (error) {
      setDecisionMessage(error);
      setIsStageSaving(false);
      return;
    }

    setDecisionMessage("Aprobación Who registrada.");
    setStageDraft("");
    setStageComment("");
    setIsStageSaving(false);

    await invalidateRecruitmentCache(selectedCaseDetail.case.id);
  };

  const handleWhoApprovalRejected = async () => {
    const selectedCandidate =
      selectedCaseDetail?.candidates.find((candidate) => candidate.id === selectedCandidateId) ??
      selectedCaseDetail?.candidates[0] ??
      null;

    if (!selectedCandidate || !selectedCaseDetail) {
      return;
    }

    setIsStageSaving(true);
    setDecisionMessage("");

    const { error } = await rejectCandidateStageWho({
      caseCandidateId: selectedCandidate.id,
      comment: stageComment
    });

    if (error) {
      setDecisionMessage(error);
      setIsStageSaving(false);
      return;
    }

    setDecisionMessage("Antecedentes rechazados. Candidato descartado.");
    setStageDraft("");
    setStageComment("");
    setIsStageSaving(false);

    await invalidateRecruitmentCache(selectedCaseDetail.case.id);
  };

  return (
    <PageShell>
      <div className="minimal-page-header">
        <h1>Control de Contrataciones</h1>
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
          {canAccessCandidateControl ? (
            <button
              type="button"
              className={`approval-chip ${activeView === "candidates" ? "tracking-kpi-card-active" : ""}`}
              onClick={() => setActiveView("candidates")}
            >
              Control de candidatos
            </button>
          ) : null}
          {canAccessCandidateControl ? (
            <button
              type="button"
              className={`approval-chip ${activeView === "personnel_to_hire" ? "tracking-kpi-card-active" : ""}`}
              onClick={() => setActiveView("personnel_to_hire")}
            >
              Personal a Contratar
            </button>
          ) : null}
        </div>

        {activeView === "processes" || !canAccessCandidateControl ? (
          <HiringProcessesView
            isLoading={isLoading}
            pendingApprovals={pendingApprovals}
            activeCases={activeCases}
            currentUserId={user?.id}
            isDecisionLoading={isDecisionLoading}
            decisionMessage={decisionMessage}
            errorMessage={errorMessage}
            onApprovalSuccess={() => void invalidateRecruitmentCache()}
          />
        ) : activeView === "candidates" ? (
          <HiringCandidatesView
            isLoading={isLoading}
            errorMessage={errorMessage}
            activeCases={activeCases}
            candidateControl={candidateControl}
            selectedCandidateId={selectedCandidateId}
            selectedCaseDetail={selectedCaseDetail}
            stageDraft={stageDraft}
            stageComment={stageComment}
            isStageSaving={isStageSaving}
            decisionMessage={decisionMessage}
            onSelectCandidate={(candidateId, caseId) => {
              setSelectedCandidateId(candidateId);
              setSelectedCaseId(caseId);
            }}
            onCandidateAdded={handleCandidateAdded}
            onStageDraftChange={setStageDraft}
            onStageCommentChange={setStageComment}
            onAdvanceStage={handleAdvanceStage}
            onWhoApprovalRegistered={handleWhoApprovalRegistered}
            onWhoApprovalRejected={handleWhoApprovalRejected}
            onLicenseUpdated={handleLicenseUpdated}
            onInterviewNotesUpdated={handleLicenseUpdated}
            onCandidateFileUpdated={handleCandidateFileUpdated}
          />
        ) : (
          <HiringPersonnelToHireView
            isLoading={isLoading}
            errorMessage={errorMessage}
            personnelToHire={personnelToHire}
            selectedCandidateId={selectedCandidateId}
            selectedCaseDetail={selectedCaseDetail}
            onSelectCandidate={(candidateId, caseId) => {
              setSelectedCandidateId(candidateId);
              setSelectedCaseId(caseId);
            }}
            onLicenseUpdated={handleLicenseUpdated}
            onInterviewNotesUpdated={handleLicenseUpdated}
            onCandidateFileUpdated={handleCandidateFileUpdated}
          />
        )}
      </section>
    </PageShell>
  );
}
