import type { RecruitmentCandidateControlRow, RecruitmentCandidateStage } from "../services/hiringControl";

export const caseFilterOptions = [
  { key: null, label: "Todos" },
  { key: "open", label: "Abiertos" },
  { key: "screening", label: "Screening" },
  { key: "ready_to_hire", label: "Listos para contratar" },
  { key: "filled", label: "Cubiertos" }
] as const;

export const candidateStageFilterOptions = [
  { key: "active", label: "Activos en Proceso" },
  { key: "lead", label: "Lead" },
  { key: "who_pending", label: "Who Pendiente" },
  { key: "medical_exams", label: "Exámenes Médicos" },
  { key: "document_review", label: "Revisión Documental" },
  { key: "ready_for_hire", label: "Listos para contratar" },
  { key: "hired", label: "Contratados" },
  { key: "discarded", label: "Descartados" }
] as const;

export function formatDateValue(value: string | null | undefined) {
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

export function formatDateTimeValue(value: string | null | undefined) {
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

export function getNextStageOptions(
  currentStage: RecruitmentCandidateStage
): RecruitmentCandidateStage[] {
  switch (currentStage) {
    case "lead":
      return ["who_pending", "rejected", "withdrawn"];
    case "who_pending":
      return [];
    case "who_approved":
      return ["medical_exams", "rejected", "withdrawn"];
    case "medical_exams":
      return ["document_review", "rejected", "withdrawn"];
    case "document_review":
      return ["ready_for_hire", "rejected", "withdrawn"];
    case "ready_for_hire":
      return ["hired", "rejected", "withdrawn"];
    case "rejected":
    case "withdrawn":
      return [];
    default:
      return [];
  }
}

export function getStageChipClass(stage: RecruitmentCandidateStage) {
  if (stage === "hired") return "tracking-kpi-card-generado";
  if (stage === "ready_for_hire") return "tracking-kpi-card-en-proceso";
  if (stage === "rejected" || stage === "withdrawn") return "tracking-kpi-card-error";
  return "tracking-kpi-card-pendiente";
}

export function getCandidateControlLockLabel(candidate: RecruitmentCandidateControlRow) {
  if (!candidate.is_contract_path_blocked) {
    if (candidate.stage_code === "ready_for_hire" || candidate.stage_code === "hired") {
      return "Ruta contractual activa";
    }

    return "Ruta libre";
  }

  return `Bloqueado por ${candidate.contract_locked_case_code ?? "otro caso"}${candidate.contract_locked_folio ? ` · ${candidate.contract_locked_folio}` : ""}`;
}
