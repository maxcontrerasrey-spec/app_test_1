import { supabase } from "../../../shared/lib/supabase";
import { formatRut, normalizeRut } from "../../../shared/lib/rut";

export type RecruitmentCaseStatus =
  | "open"
  | "sourcing"
  | "screening"
  | "ready_to_hire"
  | "partially_filled"
  | "filled"
  | "closed_unfilled"
  | "cancelled";

export type RecruitmentCandidateStage =
  | "lead"
  | "contacted"
  | "screening"
  | "shortlisted"
  | "documents_pending"
  | "ready_for_hire"
  | "hired"
  | "rejected"
  | "withdrawn";

export type RecruitmentDashboardSummary = {
  pending_contracts_control: number;
  active_cases: number;
  ready_to_hire_cases: number;
  filled_cases: number;
  total_cases: number;
};

export type HiringControlApproval = {
  id: number;
  step_code: "contracts_control";
  step_name: string;
  hiring_request_id: string;
  approver_user_id: string | null;
  approver_name: string | null;
  approver_email: string | null;
  created_at: string;
  hiring_requests: {
    folio: string | null;
    status: string;
    requester_name: string | null;
    requester_email: string | null;
    contract_name: string;
    contract_number: string | null;
    job_position_name: string;
    vacancies: number | null;
    requested_entry_date: string | null;
    start_date: string | null;
    end_date: string | null;
    shift_name: string | null;
    salary_offer: number | null;
    campamento: boolean | null;
    pasajes: boolean | null;
    other_benefits: string | null;
  } | null;
};

export type RecruitmentCaseListRow = {
  id: string;
  case_code: string;
  status: RecruitmentCaseStatus;
  requested_vacancies: number;
  filled_vacancies: number;
  title: string;
  contract_name: string;
  job_position_name: string;
  cost_center_code: string;
  cost_center_name: string;
  requested_entry_date: string | null;
  target_close_date: string | null;
  opened_at: string;
  requester_name: string | null;
  requester_email: string | null;
  owner_name: string | null;
  owner_user_id: string | null;
  candidate_count: number;
  ready_candidates: number;
  hired_candidates: number;
};

export type RecruitmentCandidateControlRow = {
  id: string;
  candidate_profile_id: string;
  recruitment_case_id: string;
  case_code: string;
  folio: string | null;
  case_status: RecruitmentCaseStatus;
  national_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  driver_license_number: string | null;
  driver_license_class: string | null;
  driver_license_expiry: string | null;
  stage_code: RecruitmentCandidateStage;
  stage_entered_at: string;
  suitability_status: "unknown" | "fit" | "risk" | "blocked";
  is_selected: boolean;
  contract_name: string;
  job_position_name: string;
  cost_center_code: string;
  cost_center_name: string;
  owner_name: string | null;
  active_process_count: number;
  contract_locked_case_id: string | null;
  contract_locked_case_code: string | null;
  contract_locked_folio: string | null;
  contract_locked_stage_code: RecruitmentCandidateStage | null;
  is_contract_path_blocked: boolean;
};

export type RecruitmentCaseAssignment = {
  id: number;
  user_id: string;
  assignment_role: "owner" | "recruiter" | "document_controller" | "viewer";
  is_primary: boolean;
  assigned_at: string;
  full_name: string | null;
  email: string | null;
};

export type RecruitmentCaseCandidateHistoryRow = {
  id: number;
  from_stage: RecruitmentCandidateStage | null;
  to_stage: RecruitmentCandidateStage;
  changed_by: string;
  reason_code: string | null;
  comment: string | null;
  created_at: string;
};

export type RecruitmentCaseCandidateRow = {
  id: string;
  candidate_profile_id: string;
  national_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  driver_license_number: string | null;
  driver_license_class: string | null;
  driver_license_expiry: string | null;
  stage_code: RecruitmentCandidateStage;
  stage_entered_at: string;
  suitability_status: "unknown" | "fit" | "risk" | "blocked";
  is_selected: boolean;
  hired_at: string | null;
  created_at: string;
  stage_history: RecruitmentCaseCandidateHistoryRow[];
};

export type RecruitmentCaseAuditRow = {
  id: number;
  action_type: string;
  actor_user_id: string;
  actor_name: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type CandidateDocumentStatus = "pending" | "uploaded" | "approved" | "rejected" | "expired";

export type CandidateDocumentRow = {
  id: string;
  document_type_id: string;
  name: string;
  is_critical: boolean;
  requires_expiry_date: boolean;
  status: CandidateDocumentStatus;
  file_path: string | null;
  expiry_date: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
};

export type CandidateChecklistResult = {
  semaphore: "green" | "yellow" | "red" | "gray";
  documents: CandidateDocumentRow[];
};

export type RecruitmentCaseDetail = {
  case: {
    id: string;
    case_code: string;
    status: RecruitmentCaseStatus;
    requested_vacancies: number;
    filled_vacancies: number;
    title: string;
    contract_name: string;
    job_position_name: string;
    cost_center_code: string;
    cost_center_name: string;
    requested_entry_date: string | null;
    target_close_date: string | null;
    opened_at: string;
    close_reason: string | null;
    hiring_request: {
      id: string;
      folio: string | null;
      requester_name: string | null;
      requester_email: string | null;
      start_date: string | null;
      end_date: string | null;
      shift_name: string | null;
      salary_offer: number | null;
      campamento: boolean | null;
      pasajes: boolean | null;
      other_benefits: string | null;
    };
  };
  assignments: RecruitmentCaseAssignment[];
  candidates: RecruitmentCaseCandidateRow[];
  audit: RecruitmentCaseAuditRow[];
};

type RecruitmentControlDashboardPayload = {
  summary?: RecruitmentDashboardSummary | null;
  pending_approvals?: HiringControlApproval[] | null;
  active_cases?: RecruitmentCaseListRow[] | null;
  candidate_control?: RecruitmentCandidateControlRow[] | null;
};

function formatRpcError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}) {
  return [
    error.message,
    error.details ? `Detalles: ${error.details}` : "",
    error.hint ? `Sugerencia: ${error.hint}` : "",
    error.code ? `Código: ${error.code}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

export function toRecruitmentCaseStatusLabel(value: RecruitmentCaseStatus | string | null | undefined) {
  if (value === "open") return "Abierto";
  if (value === "sourcing") return "Búsqueda";
  if (value === "screening") return "Screening";
  if (value === "ready_to_hire") return "Listo para contratar";
  if (value === "partially_filled") return "Cobertura parcial";
  if (value === "filled") return "Cubierto";
  if (value === "closed_unfilled") return "Cerrado sin cobertura";
  if (value === "cancelled") return "Cancelado";
  return "Abierto";
}

export function toRecruitmentCandidateStageLabel(
  value: RecruitmentCandidateStage | string | null | undefined
) {
  if (value === "lead") return "Lead";
  if (value === "contacted") return "Contactado";
  if (value === "screening") return "Screening";
  if (value === "shortlisted") return "Shortlist";
  if (value === "documents_pending") return "Docs pendientes";
  if (value === "ready_for_hire") return "Listo para contratar";
  if (value === "hired") return "Contratado";
  if (value === "rejected") return "Rechazado";
  if (value === "withdrawn") return "Retirado";
  return "Lead";
}

export async function fetchRecruitmentControlDashboard() {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_recruitment_control_dashboard_v2");

  if (error) {
    return {
      data: null,
      error: "No fue posible cargar el tablero de Control de Contrataciones."
    };
  }

  const payload = (data ?? {}) as RecruitmentControlDashboardPayload;

  return {
    data: {
      summary: payload.summary ?? {
        pending_contracts_control: 0,
        active_cases: 0,
        ready_to_hire_cases: 0,
        filled_cases: 0,
        total_cases: 0
      },
      pendingApprovals: payload.pending_approvals ?? [],
      activeCases: payload.active_cases ?? [],
      candidateControl: payload.candidate_control ?? []
    },
    error: null
  };
}

export async function fetchRecruitmentCaseDetail(caseId: string) {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_recruitment_case_detail", {
    p_case_id: caseId
  });

  if (error) {
    return {
      data: null,
      error: "No fue posible cargar el detalle del caso."
    };
  }

  return {
    data: (data ?? null) as RecruitmentCaseDetail | null,
    error: null
  };
}

export async function addCandidateToRecruitmentCase(input: {
  caseId: string;
  nationalId: string;
  fullName: string;
  email?: string;
  phone?: string;
}) {
  if (!supabase) {
    return {
      error: "Supabase no está configurado en este entorno."
    };
  }

  const normalizedNationalId = normalizeRut(input.nationalId);

  const { data, error } = await supabase.rpc("add_candidate_to_recruitment_case", {
    p_case_id: input.caseId,
    p_national_id: normalizedNationalId,
    p_full_name: input.fullName,
    p_email: input.email?.trim() ? input.email.trim() : null,
    p_phone: input.phone?.trim() ? input.phone.trim() : null
  });

  if (error) {
    return {
      data: null,
      error: formatRpcError(error) || "No fue posible agregar el candidato."
    };
  }

  return {
    data: Array.isArray(data) ? data[0] ?? null : null,
    error: null
  };
}

export { formatRut, normalizeRut };

export async function advanceRecruitmentCandidateStage(input: {
  caseCandidateId: string;
  toStage: RecruitmentCandidateStage;
  comment?: string;
}) {
  if (!supabase) {
    return {
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { error } = await supabase.rpc("advance_recruitment_candidate_stage", {
    p_case_candidate_id: input.caseCandidateId,
    p_to_stage: input.toStage,
    p_comment: input.comment?.trim() ? input.comment.trim() : null
  });

  if (error) {
    return {
      error: formatRpcError(error) || "No fue posible mover la etapa del candidato."
    };
  }

  return { error: null };
}

export async function fetchCandidateChecklist(caseCandidateId: string) {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_candidate_checklist", {
    p_case_candidate_id: caseCandidateId
  });

  if (error) {
    return {
      data: null,
      error: formatRpcError(error) || "No fue posible cargar el control documental."
    };
  }

  return {
    data: data as CandidateChecklistResult,
    error: null
  };
}

export async function uploadCandidateDocument(input: {
  caseCandidateId: string;
  documentTypeId: string;
  filePath: string;
  expiryDate?: string | null;
}) {
  if (!supabase) {
    return { error: "Supabase no está configurado." };
  }

  const { error } = await supabase.rpc("upload_candidate_document", {
    p_case_candidate_id: input.caseCandidateId,
    p_document_type_id: input.documentTypeId,
    p_file_path: input.filePath,
    p_expiry_date: input.expiryDate ?? null
  });

  if (error) {
    return { error: formatRpcError(error) || "No fue posible registrar el documento." };
  }

  return { error: null };
}

export async function reviewCandidateDocument(input: {
  documentId: string;
  status: "approved" | "rejected";
  notes?: string;
}) {
  if (!supabase) {
    return { error: "Supabase no está configurado." };
  }

  const { error } = await supabase.rpc("review_candidate_document", {
    p_document_id: input.documentId,
    p_status: input.status,
    p_notes: input.notes?.trim() ? input.notes.trim() : null
  });

  if (error) {
    return { error: formatRpcError(error) || "No fue posible revisar el documento." };
  }

  return { error: null };
}

export async function updateCandidateDriverLicense(input: {
  candidateProfileId: string;
  driverLicenseClass: string | null;
  driverLicenseExpiry: string | null;
}) {
  if (!supabase) {
    return { error: "Supabase no está configurado." };
  }

  const { error } = await supabase
    .from("candidate_profiles")
    .update({
      driver_license_class: input.driverLicenseClass ? input.driverLicenseClass.trim().toUpperCase() : null,
      driver_license_expiry: input.driverLicenseExpiry || null
    })
    .eq("id", input.candidateProfileId);

  if (error) {
    return { error: error.message || "No fue posible actualizar la licencia." };
  }

  return { error: null };
}
