import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { PageShell } from "../../../shared/ui";
import { useRealtimeQueryInvalidation } from "../../../shared/hooks/useRealtimeQueryInvalidation";
import { invalidateInternalMobilityQueries } from "../../internal_mobility/hooks/useInternalMobilityQueries";
import { hasModuleAccess } from "../../auth/config/access";
import { useAuth } from "../../auth/context/AuthContext";
import {
  getRecruitmentCaseDetailQueryOptions,
  invalidateRecruitmentControlQueries,
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
import { closeHiringRequest } from "../services/hiringWorkflow";
import { HiringCandidatesView } from "../components/HiringCandidatesView";
import { HiringInternalMobilityView } from "../components/HiringInternalMobilityView";
import { HiringPersonnelToHireView } from "../components/HiringPersonnelToHireView";
import { HiringProcessesView } from "../components/HiringProcessesView";

type RecruitmentInternalView = "processes" | "candidates" | "personnel_to_hire" | "internal_mobility";

const emptySummary: RecruitmentDashboardSummary = {
  pending_contracts_control: 0,
  active_cases: 0,
  ready_to_hire_cases: 0,
  filled_cases: 0,
  total_cases: 0
};

export function HiringStatusPage() {
  const { accessibleModules, hasCapability, isSuperAdmin, user } = useAuth();
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
  const canAccessInternalMobility =
    isSuperAdmin || hasModuleAccess(accessibleModules, "movilidad_interna");
  const dashboardQuery = useRecruitmentControlDashboard();
  const dashboardData = dashboardQuery.data;
  const summary = dashboardData?.summary ?? emptySummary;
  const pendingApprovals = dashboardData?.pendingApprovals ?? [];
  const activeCases = dashboardData?.activeCases ?? [];
  const candidateControl = dashboardData?.candidateControl ?? [];
  const personnelToHire = dashboardData?.personnelToHire ?? [];
  const candidatesInProgress = candidateControl.filter(
    (candidate) =>
      !["hired", "rejected", "withdrawn"].includes(candidate.stage_code) &&
      !["filled", "closed_unfilled", "cancelled"].includes(candidate.case_status)
  ).length;
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
  const errorMessage = dashboardError || (shouldLoadCaseDetail ? caseDetailError : "");
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
  const recruitmentRealtimeSubscriptions = useMemo(
    () => [
      { table: "recruitment_cases" },
      { table: "recruitment_case_assignments" },
      { table: "recruitment_case_candidates" },
      { table: "recruitment_case_audit_log" },
      { table: "candidate_stage_approvals" },
      { table: "candidate_profiles" },
      { table: "candidate_worker_files" },
      { table: "candidate_documents" },
      { table: "hiring_requests" },
      { table: "hiring_request_approvals" },
      { table: "internal_mobility_requests" },
      { table: "internal_mobility_request_approvals" }
    ],
    []
  );

  const invalidateRealtimeRecruitment = useCallback(
    async (client: QueryClient) => {
      await Promise.all([
        invalidateRecruitmentControlQueries(client, selectedCaseId || undefined),
        invalidateInternalMobilityQueries(client)
      ]);
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
    if (activeView === "internal_mobility" && canAccessInternalMobility) {
      return;
    }

    if (!canAccessCandidateControl && activeView !== "processes") {
      setActiveView("processes");
      setSelectedCandidateId("");
      setStageDraft("");
      setStageComment("");
    }
  }, [activeView, canAccessCandidateControl, canAccessInternalMobility]);

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
      setDecisionMessage("Etapa del candidato actualizada.");
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
      pendingApprovals={pendingApprovals}
      activeCases={activeCases}
      currentUserId={user?.id}
      isDecisionLoading={isDecisionLoading}
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
          <article className="tracking-kpi-card tracking-kpi-card-pendiente">
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

        {activeView === "processes" ||
        (!canAccessCandidateControl && activeView !== "internal_mobility") ? (
          processesView
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
        ) : activeView === "personnel_to_hire" ? (
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
        ) : activeView === "internal_mobility" && canAccessInternalMobility ? (
          <HiringInternalMobilityView
            isParentLoading={dashboardQuery.isLoading}
            externalErrorMessage={dashboardError}
          />
        ) : (
          processesView
        )}
      </section>
    </PageShell>
  );
}
