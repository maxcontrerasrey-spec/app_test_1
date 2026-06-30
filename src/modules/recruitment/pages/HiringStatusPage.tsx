import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { PageShell } from "../../../shared/ui";
import { useRealtimeQueryInvalidation } from "../../../shared/hooks/useRealtimeQueryInvalidation";
import { hasFeatureAccess, hasModuleAccess } from "../../auth/config/access";
import { useAuth } from "../../auth/context/AuthContext";
import {
  getRecruitmentCaseDetailQueryOptions,
  invalidateRecruitmentControlQueries,
  useRecruitmentCaseDetail,
  useRecruitmentControlSummary
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
import { closeHiringRequest } from "../services/hiringWorkflow";
import { HiringCandidatesView } from "../components/HiringCandidatesView";
import { HiringInternalMobilityView } from "../components/HiringInternalMobilityView";
import { HiringPersonnelToHireView } from "../components/HiringPersonnelToHireView";
import { HiringProcessesView } from "../components/HiringProcessesView";

type RecruitmentInternalView = "processes" | "candidates" | "personnel_to_hire" | "internal_mobility";

const emptySummary: RecruitmentDashboardSummary = {
  pending_contracts_control: 0,
  pending_approval_count: 0,
  active_cases: 0,
  ready_to_hire_cases: 0,
  filled_cases: 0,
  total_cases: 0,
  candidates_in_progress: 0
};

export function HiringStatusPage() {
  const { accessibleFeatures, accessibleModules, hasCapability, isSuperAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<RecruitmentInternalView>("processes");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [isStageSaving, setIsStageSaving] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState("");
  const [stageDraft, setStageDraft] = useState<RecruitmentCandidateStage | "">("");
  const [stageComment, setStageComment] = useState("");
  const canAccessProcesses =
    isSuperAdmin ||
    hasFeatureAccess(accessibleFeatures, "recruitment_processes_summary") ||
    hasModuleAccess(accessibleModules, "control_contrataciones");
  const canAccessCandidateControl =
    isSuperAdmin ||
    hasFeatureAccess(accessibleFeatures, "recruitment_candidate_control") ||
    hasCapability("candidate_control_access");
  const canAccessPersonnelToHire =
    isSuperAdmin || hasFeatureAccess(accessibleFeatures, "recruitment_personnel_to_hire");
  const canAccessInternalMobility =
    isSuperAdmin ||
    hasFeatureAccess(accessibleFeatures, "recruitment_internal_mobility") ||
    hasModuleAccess(accessibleModules, "movilidad_interna");
  const summaryQuery = useRecruitmentControlSummary();
  const summary = summaryQuery.data ?? emptySummary;
  const candidatesInProgress = summary.candidates_in_progress ?? 0;
  const shouldLoadCaseDetail =
    (canAccessCandidateControl || canAccessPersonnelToHire) &&
    (activeView === "candidates" || activeView === "personnel_to_hire") &&
    Boolean(selectedCaseId);
  const caseDetailQuery = useRecruitmentCaseDetail(selectedCaseId, shouldLoadCaseDetail);
  const selectedCaseDetail = caseDetailQuery.data ?? null;
  const summaryError =
    summaryQuery.error instanceof Error ? summaryQuery.error.message : "";
  const caseDetailError =
    caseDetailQuery.error instanceof Error ? caseDetailQuery.error.message : "";
  const errorMessage = summaryError || (shouldLoadCaseDetail ? caseDetailError : "");
  const isLoading = Boolean(
    summaryQuery.isLoading || (shouldLoadCaseDetail && caseDetailQuery.isLoading)
  );

  const recruitmentRealtimeSubscriptions = useMemo(() => {
    if (activeView === "processes") {
      return [
        { table: "recruitment_cases" },
        { table: "recruitment_case_assignments" },
        { table: "hiring_requests" },
        { table: "hiring_request_approvals" },
        { table: "internal_mobility_requests" }
      ];
    }

    if (activeView === "candidates") {
      return [
        { table: "recruitment_cases" },
        { table: "recruitment_case_candidates" },
        { table: "candidate_stage_approvals" },
        { table: "candidate_profiles" }
      ];
    }

    if (activeView === "personnel_to_hire") {
      return [
        { table: "recruitment_case_candidates" },
        { table: "candidate_worker_files" },
        { table: "candidate_documents" }
      ];
    }

    return [];
  }, [activeView]);

  const invalidateRealtimeRecruitment = useCallback(
    async (client: QueryClient) => {
      await invalidateRecruitmentControlQueries(client, selectedCaseId || undefined);
    },
    [selectedCaseId]
  );

  useRealtimeQueryInvalidation({
    channelName: `recruitment-control:${user?.id ?? "anonymous"}:${selectedCaseId || "none"}`,
    enabled: Boolean(user?.id),
    subscriptions: recruitmentRealtimeSubscriptions,
    invalidate: invalidateRealtimeRecruitment
  });

  const invalidateRecruitmentCache = async (caseId?: string) => {
    await invalidateRecruitmentControlQueries(queryClient, caseId || selectedCaseId || undefined);
  };

  useEffect(() => {
    if (!selectedCaseDetail) {
      if (selectedCandidateId) {
        setSelectedCandidateId("");
      }
      return;
    }

    if (
      selectedCandidateId &&
      !selectedCaseDetail.candidates.some((candidate) => candidate.id === selectedCandidateId)
    ) {
      setSelectedCandidateId("");
    }
  }, [selectedCandidateId, selectedCaseDetail]);

  useEffect(() => {
    setStageDraft("");
    setStageComment("");
  }, [selectedCaseId, selectedCandidateId]);

  useEffect(() => {
    const firstAllowedView: RecruitmentInternalView | null = canAccessProcesses
      ? "processes"
      : canAccessCandidateControl
        ? "candidates"
        : canAccessPersonnelToHire
          ? "personnel_to_hire"
          : canAccessInternalMobility
            ? "internal_mobility"
            : null;

    const activeViewAllowed =
      (activeView === "processes" && canAccessProcesses) ||
      (activeView === "candidates" && canAccessCandidateControl) ||
      (activeView === "personnel_to_hire" && canAccessPersonnelToHire) ||
      (activeView === "internal_mobility" && canAccessInternalMobility);

    if (activeViewAllowed || !firstAllowedView) {
      return;
    }

    setActiveView(firstAllowedView);
    setSelectedCandidateId("");
    setStageDraft("");
    setStageComment("");
  }, [
    activeView,
    canAccessCandidateControl,
    canAccessInternalMobility,
    canAccessPersonnelToHire,
    canAccessProcesses
  ]);

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

    let error: string | null = null;
    let stageCode: string | null = null;

    if (stageDraft === "who_pending") {
      const result = await requestCandidateStageWho({
        caseCandidateId: selectedCandidate.id,
        comment: stageComment,
        causes: whoCauses ?? []
      });
      error = result.error;
      stageCode = result.stageCode;
    } else {
      const result = await advanceRecruitmentCandidateStage({
        caseCandidateId: selectedCandidate.id,
        toStage: stageDraft,
        comment: stageComment
      });
      error = result.error;
    }

    if (error) {
      setDecisionMessage(error);
      setIsStageSaving(false);
      return;
    }

    if (stageDraft === "who_pending") {
      setDecisionMessage(
        stageCode === "who_approved"
          ? "Sin hallazgos: validación Who aprobada automáticamente."
          : "Solicitud Who enviada a aprobación."
      );
    } else {
      if (stageDraft === "rejected" || stageDraft === "withdrawn") {
        setDecisionMessage(
          "Etapa del candidato actualizada. La limpieza documental quedó programada para la revisión automática nocturna de las 22:00."
        );
      } else {
        setDecisionMessage("Etapa del candidato actualizada.");
      }
    }
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

  const handleCloseHiringRequest = async (requestId: string, comment?: string) => {
    setIsStageSaving(true);
    setDecisionMessage("");

    const { error } = await closeHiringRequest({
      requestId,
      comment
    });

    if (error) {
      window.alert(error);
      setDecisionMessage(error);
      setIsStageSaving(false);
      return;
    }

    window.alert("Folio cerrado exitosamente.");
    setDecisionMessage("Folio cerrado exitosamente.");
    setIsStageSaving(false);
    await invalidateRecruitmentCache();
  };

  const processesView = (
    <HiringProcessesView
      isLoading={isLoading}
      pendingApprovalCount={summary.pending_approval_count ?? summary.pending_contracts_control}
      currentUserId={user?.id}
      decisionMessage={decisionMessage}
      errorMessage={errorMessage}
      onApprovalSuccess={() => void invalidateRecruitmentCache()}
      onCloseRequest={handleCloseHiringRequest}
    />
  );

  return (
    <PageShell>
      <div className="minimal-page-header">
        <h1>Control de Contrataciones</h1>
      </div>

      <section className="tracking-panel">
        <div className="tracking-kpi-row">
          <article className="tracking-kpi-card tracking-kpi-card-pendiente tracking-kpi-card-folio-search">
            <span className="micro-label">Folios activos en búsqueda</span>
            <strong>{summary.active_cases}</strong>
          </article>
          <article className="tracking-kpi-card tracking-kpi-card-en-proceso">
            <span className="micro-label">Candidatos en curso</span>
            <strong>{candidatesInProgress}</strong>
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
          {canAccessProcesses ? (
            <button
              type="button"
              className={`approval-chip ${activeView === "processes" ? "tracking-kpi-card-active" : ""}`}
              onClick={() => setActiveView("processes")}
            >
              Resumen de procesos de contratación
            </button>
          ) : null}
          {canAccessCandidateControl ? (
            <button
              type="button"
              className={`approval-chip ${activeView === "candidates" ? "tracking-kpi-card-active" : ""}`}
              onClick={() => setActiveView("candidates")}
            >
              Control de candidatos
            </button>
          ) : null}
          {canAccessPersonnelToHire ? (
            <button
              type="button"
              className={`approval-chip ${activeView === "personnel_to_hire" ? "tracking-kpi-card-active" : ""}`}
              onClick={() => setActiveView("personnel_to_hire")}
            >
              Personal a Contratar
            </button>
          ) : null}
          {canAccessInternalMobility ? (
            <button
              type="button"
              className={`approval-chip ${activeView === "internal_mobility" ? "tracking-kpi-card-active" : ""}`}
              onClick={() => setActiveView("internal_mobility")}
            >
              Movilidad Interna
            </button>
          ) : null}
        </div>

        {activeView === "processes" && canAccessProcesses ? (
          processesView
        ) : activeView === "candidates" && canAccessCandidateControl ? (
          <HiringCandidatesView
            isParentLoading={isLoading}
            errorMessage={errorMessage}
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
        ) : activeView === "personnel_to_hire" && canAccessPersonnelToHire ? (
          <HiringPersonnelToHireView
            isParentLoading={isLoading}
            errorMessage={errorMessage}
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
        ) : activeView === "internal_mobility" && canAccessInternalMobility ? (
          <HiringInternalMobilityView
            isParentLoading={summaryQuery.isLoading}
            externalErrorMessage={summaryError}
          />
        ) : (
          processesView
        )}
      </section>
    </PageShell>
  );
}
