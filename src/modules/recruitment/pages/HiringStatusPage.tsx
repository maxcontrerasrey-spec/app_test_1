import { useEffect, useState } from "react";
import { PageShell } from "../../../shared/ui";
import { useAuth } from "../../auth/context/AuthContext";
import { decideHiringApproval } from "../services/hiringWorkflow";
import {
  advanceRecruitmentCandidateStage,
  fetchRecruitmentCaseDetail,
  fetchRecruitmentControlDashboard,
  type HiringControlApproval,
  type RecruitmentCandidateControlRow,
  type RecruitmentCandidateStage,
  type RecruitmentCaseDetail,
  type RecruitmentCaseListRow,
  type RecruitmentDashboardSummary
} from "../services/hiringControl";
import { HiringCandidatesView } from "../components/HiringCandidatesView";
import { HiringProcessesView } from "../components/HiringProcessesView";

type RecruitmentInternalView = "processes" | "candidates";

const emptySummary: RecruitmentDashboardSummary = {
  pending_contracts_control: 0,
  active_cases: 0,
  ready_to_hire_cases: 0,
  filled_cases: 0,
  total_cases: 0
};

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
      return false;
    }

    setDecisionMessage(
      decision === "approved" ? "Aprobación registrada." : "Rechazo registrado."
    );
    setIsDecisionLoading(null);
    await loadDashboard(selectedCaseId);
    return true;
  };

  const handleCandidateAdded = async (caseId: string, candidateId: string) => {
    setSelectedCaseId(caseId);
    setSelectedCandidateId(candidateId);
    await loadDashboard(caseId);
    await loadCaseDetail(caseId, candidateId);
  };

  const handleAdvanceStage = async () => {
    const selectedCandidate =
      selectedCaseDetail?.candidates.find((candidate) => candidate.id === selectedCandidateId) ??
      selectedCaseDetail?.candidates[0] ??
      null;

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

  const handleLicenseUpdated = async () => {
    if (selectedCaseId && selectedCandidateId) {
      await loadDashboard(selectedCaseId);
      await loadCaseDetail(selectedCaseId, selectedCandidateId);
    }
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
          <button
            type="button"
            className={`approval-chip ${activeView === "candidates" ? "tracking-kpi-card-active" : ""}`}
            onClick={() => setActiveView("candidates")}
          >
            Control de candidatos
          </button>
        </div>

        {activeView === "processes" ? (
          <HiringProcessesView
            isLoading={isLoading}
            pendingApprovals={pendingApprovals}
            activeCases={activeCases}
            currentUserId={user?.id}
            isDecisionLoading={isDecisionLoading}
            decisionMessage={decisionMessage}
            errorMessage={errorMessage}
            onApprovalSuccess={() => void loadDashboard(selectedCaseId)}
          />
        ) : (
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
            onLicenseUpdated={handleLicenseUpdated}
            onInterviewNotesUpdated={handleLicenseUpdated}
          />
        )}
      </section>
    </PageShell>
  );
}
