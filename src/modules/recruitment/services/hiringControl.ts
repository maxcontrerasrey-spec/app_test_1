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
  | "who_pending"
  | "who_approved"
  | "in_process"
  | "medical_exams"
  | "document_review"
  | "ready_for_hire"
  | "hired"
  | "rejected"
  | "withdrawn";

export type WhoCauseType = "laboral" | "penal" | "civil";

export type WhoApprovalCause = {
  type: WhoCauseType;
  year: number;
  comment: string;
};

export type RecruitmentDashboardSummary = {
  pending_contracts_control: number;
  pending_approval_count?: number;
  active_cases: number;
  ready_to_hire_cases: number;
  filled_cases: number;
  total_cases: number;
  candidates_in_progress?: number;
};

export type HiringControlApproval = {
  id: number;
  step_code: "contracts_control" | "area_manager";
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
    travel_methodology?: string | null;
    other_benefits: string | null;
  } | null;
};

export type RecruitmentCaseListRow = {
  id: string;
  source_type?: "case" | "request";
  hiring_request_id?: string;
  folio?: string | null;
  case_code: string;
  status: RecruitmentCaseStatus;
  requested_vacancies: number;
  filled_vacancies: number;
  title: string;
  contract_name: string;
  job_position_name: string;
  hiring_request_status?: string;
  can_close_request?: boolean;
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
  mobility_active_count?: number;
  mobility_approved_count?: number;
  start_date?: string | null;
  end_date?: string | null;
  shift_name?: string | null;
  turno?: string | null;
  salary_offer?: number | null;
  salary?: number | null;
  campamento?: boolean | null;
  pasajes?: boolean | null;
  travel_methodology?: string | null;
  other_benefits?: string | null;
  approval_summary?: {
    step_name: string | null;
    status: string | null;
    decision_comment: string | null;
    decided_at: string | null;
    decided_by_name: string | null;
  } | null;
};

export type RecruitmentProcessesPageSummary = {
  activeCases: number;
  requestedVacancies: number;
  inProgressCandidates: number;
  readyToHireCases: number;
  filledCases: number;
  hiredCandidates: number;
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
  interview_notes: string | null;
  hired_at?: string | null;
  buk_generated_at?: string | null;
  buk_employee_id?: string | null;
  has_buk_generation_success?: boolean;
};

export type RecruitmentPersonnelToHireRow = RecruitmentCandidateControlRow;

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

export type CandidateWhoApprovalSummary = {
  id: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requested_by: string;
  requested_by_name: string | null;
  requested_at: string;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  comment: string | null;
  causes?: WhoApprovalCause[] | null;
};

export type CandidateWorkerFile = {
  id: string;
  project_name: string | null;
  company_entry_date: string | null;
  shift_name: string | null;
  advance_amount: number | null;
  contract_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CandidateDocumentValidationSummary = {
  status: "pending" | "approved";
  validated_by: string | null;
  validated_by_name: string | null;
  validated_at: string | null;
  comment: string | null;
};

export type CandidateBukProfileDetails = {
  case_candidate_id: string;
  candidate_profile_id: string;
  suggested_employee_code?: string | null;
  document_type: string | null;
  document_number: string;
  first_name: string | null;
  last_name: string | null;
  second_last_name: string | null;
  full_name: string;
  gender: string | null;
  birth_date: string | null;
  nationality: string | null;
  marital_status: string | null;
  email: string | null;
  personal_email: string | null;
  phone: string | null;
  office_phone: string | null;
  country: string | null;
  address_line: string | null;
  region: string | null;
  district_or_commune: string | null;
  current_city: string | null;
  street_name: string | null;
  street_number: string | null;
  apartment_or_office: string | null;
  education_title: string | null;
  education_institution: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  disability_status: string | null;
  disability_notice_date: string | null;
  invalidity_status: string | null;
  invalidity_notice_date: string | null;
  inclusion_notes: string | null;
  labor_inclusion: string | null;
  firefighter_status: string | null;
  foreign_worker: string | null;
  shirt_size: string | null;
  pants_size: string | null;
  shoe_size: string | null;
  worker_file: {
    id: string | null;
    employee_code: string | null;
    project_name: string | null;
    company_entry_date: string | null;
    shift_name: string | null;
    advance_amount: number | null;
    contract_notes: string | null;
    private_role: string | null;
    afc_start_date: string | null;
    seniority_recognition_date: string | null;
    progressive_vacation_start_date: string | null;
    payment_method: string | null;
    payment_period: string | null;
    bank_name: string | null;
    bank_account_type: string | null;
    bank_account_number: string | null;
    bank_branch_code: string | null;
    vale_vista_type: string | null;
    pension_regime: string | null;
    contribution_fund: string | null;
    afp_collection_entity: string | null;
    increase_quote_one_percent: string | null;
    health_provider: string | null;
    health_plan_uf: number | null;
    health_plan_pesos: number | null;
    health_plan_percentage: number | null;
    afc_regime: string | null;
    retired_status: string | null;
    retirement_regime: string | null;
    account_two_fund: string | null;
    account_two_plan: string | null;
    currency: string | null;
    simple_load_count: number | null;
    maternal_load_count: number | null;
    invalid_load_count: number | null;
    family_allowance_section: string | null;
    personal_data_update_date: string | null;
  };
};

export type RecruitmentCaseCandidateRow = {
  id: string;
  candidate_profile_id: string;
  national_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  nationality: string | null;
  marital_status: string | null;
  address_line: string | null;
  district_or_commune: string | null;
  current_city: string | null;
  region: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  inclusion_notes: string | null;
  firefighter_status: string | null;
  shirt_size: string | null;
  pants_size: string | null;
  shoe_size: string | null;
  bank_name: string | null;
  bank_account_type: string | null;
  bank_account_number: string | null;
  afp_name: string | null;
  health_provider: string | null;
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
  interview_notes: string | null;
  worker_file?: CandidateWorkerFile | null;
  who_approval?: CandidateWhoApprovalSummary | null;
  document_validation_status?: "pending" | "approved" | null;
  document_validated_by?: string | null;
  document_validated_by_name?: string | null;
  document_validated_at?: string | null;
  document_validation_comment?: string | null;
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
      travel_methodology?: string | null;
      other_benefits: string | null;
      approval_summary?: {
        step_name: string | null;
        status: string | null;
        decision_comment: string | null;
        decided_at: string | null;
        decided_by_name: string | null;
      } | null;
    };
  };
  assignments: RecruitmentCaseAssignment[];
  candidates: RecruitmentCaseCandidateRow[];
  audit: RecruitmentCaseAuditRow[];
};

export type RecruitmentPagedResponse<T, S = null> = {
  items: T[];
  totalCount: number;
  summary: S | null;
};

type RecruitmentPagedPayload<T, S = null> = {
  items?: T[] | null;
  total_count?: number | null;
  summary?: S | null;
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
  if (value === "who_pending") return "Who Pendiente";
  if (value === "who_approved") return "Who Aprobado";
  if (value === "in_process") return "En Proceso";
  if (value === "medical_exams") return "Exámenes Médicos";
  if (value === "document_review") return "Revisión Documental";
  if (value === "ready_for_hire") return "Listo para contratar";
  if (value === "hired") return "Contratado";
  if (value === "rejected") return "Rechazado";
  if (value === "withdrawn") return "Retirado";
  return "Lead";
}

function parsePagedPayload<T, S = null>(payload: unknown): RecruitmentPagedResponse<T, S> {
  const parsed = (payload ?? {}) as RecruitmentPagedPayload<T, S>;

  return {
    items: Array.isArray(parsed.items) ? parsed.items : [],
    totalCount: Number(parsed.total_count ?? 0),
    summary: (parsed.summary ?? null) as S | null
  };
}

function parseRecruitmentProcessesPagePayload(
  payload: unknown
): RecruitmentPagedResponse<RecruitmentCaseListRow, RecruitmentProcessesPageSummary> {
  const parsed = parsePagedPayload<
    RecruitmentCaseListRow,
    Partial<RecruitmentProcessesPageSummary>
  >(payload);

  return {
    ...parsed,
    summary: {
      activeCases: Number(parsed.summary?.activeCases ?? 0),
      requestedVacancies: Number(parsed.summary?.requestedVacancies ?? 0),
      inProgressCandidates: Number(parsed.summary?.inProgressCandidates ?? 0),
      readyToHireCases: Number(parsed.summary?.readyToHireCases ?? 0),
      filledCases: Number(parsed.summary?.filledCases ?? 0),
      hiredCandidates: Number(parsed.summary?.hiredCandidates ?? 0)
    }
  };
}

export async function fetchRecruitmentControlSummary() {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_recruitment_control_summary");

  if (error) {
    return {
      data: null,
      error: formatRpcError(error) || "No fue posible cargar el resumen de Control de Contrataciones."
    };
  }

  return {
    data: (data ?? {
      pending_contracts_control: 0,
      pending_approval_count: 0,
      active_cases: 0,
      ready_to_hire_cases: 0,
      filled_cases: 0,
      total_cases: 0,
      candidates_in_progress: 0
    }) as RecruitmentDashboardSummary,
    error: null
  };
}

export async function fetchRecruitmentPendingApprovalsPage(input: {
  limit: number;
  offset: number;
}) {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_recruitment_pending_approvals_page", {
    p_limit: input.limit,
    p_offset: input.offset
  });

  if (error) {
    return {
      data: null,
      error: formatRpcError(error) || "No fue posible cargar la cola de aprobaciones."
    };
  }

  return {
    data: parsePagedPayload<HiringControlApproval>(data),
    error: null
  };
}

export async function fetchRecruitmentProcessesPage(input: {
  search?: string;
  statusFilter?: string | null;
  sortColumn?: string | null;
  sortDirection?: "asc" | "desc";
  limit: number;
  offset: number;
}) {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_recruitment_processes_page", {
    p_search: input.search?.trim() ? input.search.trim() : null,
    p_status_filter: input.statusFilter ?? null,
    p_sort_column: input.sortColumn ?? null,
    p_sort_direction: input.sortDirection ?? "asc",
    p_limit: input.limit,
    p_offset: input.offset
  });

  if (error) {
    return {
      data: null,
      error: formatRpcError(error) || "No fue posible cargar los procesos de contratación."
    };
  }

  return {
    data: parseRecruitmentProcessesPagePayload(data),
    error: null
  };
}

export async function fetchRecruitmentCandidatesPage(input: {
  search?: string;
  stageFilter?: string;
  limit: number;
  offset: number;
}) {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_recruitment_candidates_page", {
    p_search: input.search?.trim() ? input.search.trim() : null,
    p_stage_filter: input.stageFilter ?? "active",
    p_limit: input.limit,
    p_offset: input.offset
  });

  if (error) {
    return {
      data: null,
      error: formatRpcError(error) || "No fue posible cargar candidatos."
    };
  }

  return {
    data: parsePagedPayload<RecruitmentCandidateControlRow>(data),
    error: null
  };
}

export async function fetchRecruitmentPersonnelToHirePage(input: {
  search?: string;
  limit: number;
  offset: number;
}) {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_recruitment_personnel_to_hire_page", {
    p_search: input.search?.trim() ? input.search.trim() : null,
    p_limit: input.limit,
    p_offset: input.offset
  });

  if (error) {
    return {
      data: null,
      error: formatRpcError(error) || "No fue posible cargar personal a contratar."
    };
  }

  return {
    data: parsePagedPayload<RecruitmentPersonnelToHireRow>(data),
    error: null
  };
}

export async function fetchRecruitmentContractedPersonnelPage(input: {
  search?: string;
  limit: number;
  offset: number;
}) {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_recruitment_contracted_personnel_page", {
    p_search: input.search?.trim() ? input.search.trim() : null,
    p_limit: input.limit,
    p_offset: input.offset
  });

  if (error) {
    return {
      data: null,
      error: formatRpcError(error) || "No fue posible cargar el personal contratado."
    };
  }

  return {
    data: parsePagedPayload<RecruitmentPersonnelToHireRow>(data),
    error: null
  };
}

export async function fetchRecruitmentActiveCaseOptions(input: {
  search?: string;
  limit?: number;
} = {}) {
  if (!supabase) {
    return {
      data: [] as RecruitmentCaseListRow[],
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_recruitment_active_case_options", {
    p_search: input.search?.trim() ? input.search.trim() : null,
    p_limit: input.limit ?? 500
  });

  if (error) {
    return {
      data: [] as RecruitmentCaseListRow[],
      error: formatRpcError(error) || "No fue posible cargar folios disponibles."
    };
  }

  return {
    data: Array.isArray(data) ? (data as RecruitmentCaseListRow[]) : [],
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
      error: formatRpcError(error) || "No fue posible cargar el detalle del caso."
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
export async function transferCandidateToCase(input: {
  caseCandidateId: string;
  targetCaseId: string;
  comment?: string;
}) {
  if (!supabase) {
    return {
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { error } = await supabase.rpc("transfer_candidate_to_case", {
    p_case_candidate_id: input.caseCandidateId,
    p_target_case_id: input.targetCaseId,
    p_comment: input.comment?.trim() ? input.comment.trim() : null
  });

  if (error) {
    return {
      error: formatRpcError(error) || "No fue posible trasladar al candidato."
    };
  }

  return { error: null };
}


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

export async function requestCandidateStageWho(input: {
  caseCandidateId: string;
  comment?: string;
  causes: WhoApprovalCause[];
}): Promise<{ error: string | null; stageCode: string | null }> {
  if (!supabase) {
    return {
      error: "Supabase no está configurado en este entorno.",
      stageCode: null
    };
  }

  const { data, error } = await supabase.rpc("request_candidate_stage_who", {
    p_case_candidate_id: input.caseCandidateId,
    p_comment: input.comment?.trim() ? input.comment.trim() : null,
    p_causes: input.causes.map((cause) => ({
      type: cause.type,
      year: cause.year,
      comment: cause.comment.trim()
    }))
  });

  if (error) {
    return {
      error: formatRpcError(error) || "No fue posible enviar la aprobación Who.",
      stageCode: null
    };
  }

  return {
    error: null,
    stageCode: Array.isArray(data) && data[0]?.stage_code ? String(data[0].stage_code) : null
  };
}

export async function approveCandidateStageWho(input: {
  caseCandidateId: string;
  comment?: string;
}) {
  if (!supabase) {
    return {
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { error } = await supabase.rpc("approve_candidate_stage_who", {
    p_case_candidate_id: input.caseCandidateId,
    p_comment: input.comment?.trim() ? input.comment.trim() : null
  });

  if (error) {
    return {
      error: formatRpcError(error) || "No fue posible aprobar la etapa Who."
    };
  }

  return { error: null };
}

export async function rejectCandidateStageWho(input: {
  caseCandidateId: string;
  comment?: string;
}): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: "Supabase no está configurado." };
  }

  const { error } = await supabase.rpc("reject_candidate_stage_who", {
    p_case_candidate_id: input.caseCandidateId,
    p_comment: input.comment || null
  });

  if (error) {
    return {
      error: formatRpcError(error) || "No fue posible rechazar la aprobación Who."
    };
  }

  return { error: null };
}

export function toWhoCauseTypeLabel(value: WhoCauseType | string | null | undefined) {
  if (value === "laboral") return "Laboral";
  if (value === "penal") return "Penal";
  if (value === "civil") return "Civil";
  return "Sin definir";
}

export async function updateCandidateDriverLicense(input: {
  candidateProfileId: string;
  driverLicenseClass: string | null;
  driverLicenseExpiry: string | null;
}) {
  if (!supabase) {
    return { error: "Supabase no está configurado." };
  }

  const { error } = await supabase.rpc("update_candidate_driver_license", {
    p_profile_id: input.candidateProfileId,
    p_license_class: input.driverLicenseClass ? input.driverLicenseClass.trim().toUpperCase() : null,
    p_license_expiry: input.driverLicenseExpiry || null
  });

  if (error) {
    return { error: error.message || "No fue posible actualizar la licencia." };
  }

  return { error: null };
}

export async function updateCandidateInterviewNotes(input: {
  caseCandidateId: string;
  notes: string | null;
}) {
  if (!supabase) {
    return { error: "Supabase no está configurado." };
  }

  const { error } = await supabase.rpc("update_candidate_interview_notes", {
    p_case_candidate_id: input.caseCandidateId,
    p_notes: input.notes ? input.notes.trim() : null
  });

  if (error) {
    return { error: error.message || "No fue posible actualizar las notas de entrevista." };
  }

  return { error: null };
}

export async function fetchCandidateBukProfile(caseCandidateId: string): Promise<{
  data: CandidateBukProfileDetails | null;
  error: string | null;
}> {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_candidate_buk_profile", {
    p_case_candidate_id: caseCandidateId
  });

  if (error) {
    return {
      data: null,
      error: formatRpcError(error) || "No fue posible cargar la ficha BUK del candidato."
    };
  }

  return {
    data: (data ?? null) as CandidateBukProfileDetails | null,
    error: null
  };
}

export async function updateCandidatePersonProfile(input: {
  caseCandidateId: string;
  documentType?: string | null;
  documentNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  secondLastName?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  maritalStatus?: string | null;
  companyEmail?: string | null;
  personalEmail?: string | null;
  privatePhone?: string | null;
  officePhone?: string | null;
  country?: string | null;
  addressLine?: string | null;
  districtOrCommune?: string | null;
  currentCity?: string | null;
  region?: string | null;
  streetName?: string | null;
  streetNumber?: string | null;
  apartmentOrOffice?: string | null;
  educationTitle?: string | null;
  educationInstitution?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  disabilityStatus?: string | null;
  disabilityNoticeDate?: string | null;
  invalidityStatus?: string | null;
  invalidityNoticeDate?: string | null;
  inclusionNotes?: string | null;
  laborInclusion?: string | null;
  firefighterStatus?: string | null;
  foreignWorker?: string | null;
  shirtSize?: string | null;
  pantsSize?: string | null;
  shoeSize?: string | null;
}) {
  if (!supabase) {
    return {
      error: "Supabase no está configurado en este entorno."
    };
  }

  const normalizedDocumentNumber =
    input.documentType?.trim() === "RUT"
      ? normalizeRut(input.documentNumber)
      : input.documentNumber?.trim() ?? null;

  const { error } = await supabase.rpc("upsert_candidate_person_profile", {
    p_case_candidate_id: input.caseCandidateId,
    p_document_type: input.documentType?.trim() ? input.documentType.trim() : null,
    p_document_number: normalizedDocumentNumber?.trim() ? normalizedDocumentNumber.trim() : null,
    p_first_name: input.firstName?.trim() ? input.firstName.trim() : null,
    p_last_name: input.lastName?.trim() ? input.lastName.trim() : null,
    p_second_last_name: input.secondLastName?.trim() ? input.secondLastName.trim() : null,
    p_gender: input.gender?.trim() ? input.gender.trim() : null,
    p_birth_date: input.birthDate || null,
    p_nationality: input.nationality?.trim() ? input.nationality.trim() : null,
    p_marital_status: input.maritalStatus?.trim() ? input.maritalStatus.trim() : null,
    p_company_email: input.companyEmail?.trim() ? input.companyEmail.trim() : null,
    p_personal_email: input.personalEmail?.trim() ? input.personalEmail.trim() : null,
    p_private_phone: input.privatePhone?.trim() ? input.privatePhone.trim() : null,
    p_office_phone: input.officePhone?.trim() ? input.officePhone.trim() : null,
    p_country: input.country?.trim() ? input.country.trim() : null,
    p_address_line: input.addressLine?.trim() ? input.addressLine.trim() : null,
    p_district_or_commune: input.districtOrCommune?.trim()
      ? input.districtOrCommune.trim()
      : null,
    p_current_city: input.currentCity?.trim() ? input.currentCity.trim() : null,
    p_region: input.region?.trim() ? input.region.trim() : null,
    p_street_name: input.streetName?.trim() ? input.streetName.trim() : null,
    p_street_number: input.streetNumber?.trim() ? input.streetNumber.trim() : null,
    p_apartment_or_office: input.apartmentOrOffice?.trim()
      ? input.apartmentOrOffice.trim()
      : null,
    p_education_title: input.educationTitle?.trim() ? input.educationTitle.trim() : null,
    p_education_institution: input.educationInstitution?.trim()
      ? input.educationInstitution.trim()
      : null,
    p_emergency_contact_name: input.emergencyContactName?.trim()
      ? input.emergencyContactName.trim()
      : null,
    p_emergency_contact_phone: input.emergencyContactPhone?.trim()
      ? input.emergencyContactPhone.trim()
      : null,
    p_emergency_contact_relationship: input.emergencyContactRelationship?.trim()
      ? input.emergencyContactRelationship.trim()
      : null,
    p_disability_status: input.disabilityStatus?.trim()
      ? input.disabilityStatus.trim()
      : null,
    p_disability_notice_date: input.disabilityNoticeDate || null,
    p_invalidity_status: input.invalidityStatus?.trim()
      ? input.invalidityStatus.trim()
      : null,
    p_invalidity_notice_date: input.invalidityNoticeDate || null,
    p_inclusion_notes: input.inclusionNotes?.trim() ? input.inclusionNotes.trim() : null,
    p_labor_inclusion: input.laborInclusion?.trim() ? input.laborInclusion.trim() : null,
    p_firefighter_status: input.firefighterStatus?.trim()
      ? input.firefighterStatus.trim()
      : null,
    p_foreign_worker: input.foreignWorker?.trim() ? input.foreignWorker.trim() : null,
    p_shirt_size: input.shirtSize?.trim() ? input.shirtSize.trim() : null,
    p_pants_size: input.pantsSize?.trim() ? input.pantsSize.trim() : null,
    p_shoe_size: input.shoeSize?.trim() ? input.shoeSize.trim() : null
  });

  if (error) {
    return {
      error: formatRpcError(error) || "No fue posible actualizar la ficha personal del candidato."
    };
  }

  return { error: null };
}

export async function updateCandidateWorkerFile(input: {
  caseCandidateId: string;
  employeeCode?: string | null;
  projectName?: string | null;
  companyEntryDate?: string | null;
  shiftName?: string | null;
  advanceAmount?: number | null;
  contractNotes?: string | null;
  privateRole?: string | null;
  afcStartDate?: string | null;
  seniorityRecognitionDate?: string | null;
  progressiveVacationStartDate?: string | null;
  paymentMethod?: string | null;
  paymentPeriod?: string | null;
  bankName?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  bankBranchCode?: string | null;
  valeVistaType?: string | null;
  pensionRegime?: string | null;
  contributionFund?: string | null;
  afpCollectionEntity?: string | null;
  increaseQuoteOnePercent?: string | null;
  healthProvider?: string | null;
  healthPlanUf?: number | null;
  healthPlanPesos?: number | null;
  healthPlanPercentage?: number | null;
  afcRegime?: string | null;
  retiredStatus?: string | null;
  retirementRegime?: string | null;
  accountTwoFund?: string | null;
  accountTwoPlan?: string | null;
  currency?: string | null;
  simpleLoadCount?: number | null;
  maternalLoadCount?: number | null;
  invalidLoadCount?: number | null;
  familyAllowanceSection?: string | null;
  personalDataUpdateDate?: string | null;
}) {
  if (!supabase) {
    return {
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { error } = await supabase.rpc("upsert_candidate_worker_file", {
    p_case_candidate_id: input.caseCandidateId,
    p_employee_code: input.employeeCode?.trim() ? input.employeeCode.trim() : null,
    p_project_name: input.projectName?.trim() ? input.projectName.trim() : null,
    p_company_entry_date: input.companyEntryDate || null,
    p_shift_name: input.shiftName?.trim() ? input.shiftName.trim() : null,
    p_advance_amount: input.advanceAmount ?? null,
    p_contract_notes: input.contractNotes?.trim() ? input.contractNotes.trim() : null,
    p_private_role: input.privateRole?.trim() ? input.privateRole.trim() : null,
    p_afc_start_date: input.afcStartDate || null,
    p_seniority_recognition_date: input.seniorityRecognitionDate || null,
    p_progressive_vacation_start_date: input.progressiveVacationStartDate || null,
    p_payment_method: input.paymentMethod?.trim() ? input.paymentMethod.trim() : null,
    p_payment_period: input.paymentPeriod?.trim() ? input.paymentPeriod.trim() : null,
    p_bank_name: input.bankName?.trim() ? input.bankName.trim() : null,
    p_bank_account_type: input.bankAccountType?.trim()
      ? input.bankAccountType.trim()
      : null,
    p_bank_account_number: input.bankAccountNumber?.trim()
      ? input.bankAccountNumber.trim()
      : null,
    p_bank_branch_code: input.bankBranchCode?.trim() ? input.bankBranchCode.trim() : null,
    p_vale_vista_type: input.valeVistaType?.trim() ? input.valeVistaType.trim() : null,
    p_pension_regime: input.pensionRegime?.trim() ? input.pensionRegime.trim() : null,
    p_contribution_fund: input.contributionFund?.trim()
      ? input.contributionFund.trim()
      : null,
    p_afp_collection_entity: input.afpCollectionEntity?.trim()
      ? input.afpCollectionEntity.trim()
      : null,
    p_increase_quote_one_percent: input.increaseQuoteOnePercent?.trim()
      ? input.increaseQuoteOnePercent.trim()
      : null,
    p_health_provider: input.healthProvider?.trim() ? input.healthProvider.trim() : null,
    p_health_plan_uf: input.healthPlanUf ?? null,
    p_health_plan_pesos: input.healthPlanPesos ?? null,
    p_health_plan_percentage: input.healthPlanPercentage ?? null,
    p_afc_regime: input.afcRegime?.trim() ? input.afcRegime.trim() : null,
    p_retired_status: input.retiredStatus?.trim() ? input.retiredStatus.trim() : null,
    p_retirement_regime: input.retirementRegime?.trim()
      ? input.retirementRegime.trim()
      : null,
    p_account_two_fund: input.accountTwoFund?.trim() ? input.accountTwoFund.trim() : null,
    p_account_two_plan: input.accountTwoPlan?.trim() ? input.accountTwoPlan.trim() : null,
    p_currency: input.currency?.trim() ? input.currency.trim() : null,
    p_simple_load_count: input.simpleLoadCount ?? null,
    p_maternal_load_count: input.maternalLoadCount ?? null,
    p_invalid_load_count: input.invalidLoadCount ?? null,
    p_family_allowance_section: input.familyAllowanceSection?.trim()
      ? input.familyAllowanceSection.trim()
      : null,
    p_personal_data_update_date: input.personalDataUpdateDate || null
  });

  if (error) {
    return {
      error: formatRpcError(error) || "No fue posible actualizar la ficha del ingreso actual."
    };
  }

  return { error: null };
}

export async function enqueueCandidatesToBuk(candidateIds: string[]) {
  if (!supabase) {
    return {
      data: [] as Array<{
        job_id: string;
        recruitment_case_candidate_id: string;
        status: string;
      }>,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const normalizedIds = Array.from(
    new Set(candidateIds.map((candidateId) => candidateId.trim()).filter(Boolean))
  );

  if (normalizedIds.length === 0) {
    return {
      data: [],
      error: "Selecciona al menos una persona para generar en BUK."
    };
  }

  const { data, error } = await supabase.rpc("enqueue_buk_generation", {
    p_candidate_ids: normalizedIds
  });

  if (error) {
    return {
      data: [],
      error: formatRpcError(error) || "No fue posible encolar la generación en BUK."
    };
  }

  return {
    data: Array.isArray(data)
      ? (data as Array<{
          job_id: string;
          recruitment_case_candidate_id: string;
          status: string;
        }>)
      : [],
    error: null
  };
}

type BukSyncQueueRow = {
  job_id: string;
  recruitment_case_candidate_id: string;
  status: string;
};

type BukSyncQueueStatusRow = {
  job_id: string;
  recruitment_case_candidate_id: string;
  status: "pending" | "processing" | "success" | "error";
  buk_employee_id: string | null;
  error_message: string | null;
  attempts: number;
  started_at: string | null;
  finished_at: string | null;
};

type BukSyncProcessedRow = {
  jobId: string;
  candidateId: string;
  status: "success" | "error";
  bukEmployeeId?: string;
  error?: string;
};

async function fetchBukSyncJobsStatus(jobIds: string[]) {
  if (!supabase) {
    return {
      data: [] as BukSyncQueueStatusRow[],
      error: "Supabase no está configurado en este entorno."
    };
  }

  const normalizedJobIds = Array.from(new Set(jobIds.map((jobId) => jobId.trim()).filter(Boolean)));
  if (normalizedJobIds.length === 0) {
    return {
      data: [] as BukSyncQueueStatusRow[],
      error: null
    };
  }

  const { data, error } = await supabase.rpc("get_buk_sync_jobs_status", {
    p_job_ids: normalizedJobIds
  });

  if (error) {
    return {
      data: [] as BukSyncQueueStatusRow[],
      error: formatRpcError(error) || "No fue posible consultar el estado de la cola BUK."
    };
  }

  return {
    data: Array.isArray(data) ? (data as BukSyncQueueStatusRow[]) : [],
    error: null
  };
}

function mergeQueuedJobsWithStatus(
  queuedJobs: BukSyncQueueRow[],
  statusRows: BukSyncQueueStatusRow[]
) {
  const statusByJobId = new Map(statusRows.map((row) => [row.job_id, row]));

  return queuedJobs.map((job) => ({
    ...job,
    status: statusByJobId.get(job.job_id)?.status ?? job.status
  }));
}

function mapStatusRowsToProcessed(statusRows: BukSyncQueueStatusRow[]) {
  return statusRows
    .filter(
      (row): row is BukSyncQueueStatusRow & { status: "success" | "error" } =>
        row.status === "success" || row.status === "error"
    )
    .map((row) => ({
      jobId: row.job_id,
      candidateId: row.recruitment_case_candidate_id,
      status: row.status,
      bukEmployeeId: row.buk_employee_id ?? undefined,
      error: row.error_message ?? undefined
    }));
}

export async function generateCandidatesInBuk(candidateIds: string[]) {
  const queueResult = await enqueueCandidatesToBuk(candidateIds);
  if (queueResult.error) {
    return {
      data: [] as BukSyncQueueRow[],
      processed: [] as BukSyncProcessedRow[],
      error: queueResult.error,
      dispatchError: null as string | null
    };
  }

  const queuedJobs = queueResult.data as BukSyncQueueRow[];
  const pendingJobIds = queuedJobs
    .filter((job) => job.status === "pending" && typeof job.job_id === "string" && job.job_id.trim())
    .map((job) => job.job_id);

  if (pendingJobIds.length === 0) {
    return {
      data: queuedJobs,
      processed: [] as BukSyncProcessedRow[],
      error: null,
      dispatchError: null
    };
  }

  if (!supabase) {
    return {
      data: queuedJobs,
      processed: [] as BukSyncProcessedRow[],
      error: null,
      dispatchError: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.functions.invoke("sync-buk-candidates", {
    body: { jobIds: pendingJobIds }
  });

  if (error) {
    const statusResult = await fetchBukSyncJobsStatus(pendingJobIds);
    if (!statusResult.error) {
      const hasProcessingEvidence = statusResult.data.some(
        (job) =>
          job.status !== "pending" ||
          job.started_at !== null ||
          job.finished_at !== null
      );

      if (hasProcessingEvidence) {
        return {
          data: mergeQueuedJobsWithStatus(queuedJobs, statusResult.data),
          processed: mapStatusRowsToProcessed(statusResult.data),
          error: null,
          dispatchError: null
        };
      }
    }

    return {
      data: queuedJobs,
      processed: [] as BukSyncProcessedRow[],
      error: null,
      dispatchError:
        error.message || "No fue posible ejecutar la sincronización automática con BUK."
    };
  }

  const payload =
    data && typeof data === "object" ? (data as { error?: unknown; processed?: unknown }) : null;
  const functionError =
    payload?.error && typeof payload.error === "string"
      ? payload.error
      : payload?.error
        ? String(payload.error)
        : null;

  return {
    data: queuedJobs,
    processed: Array.isArray(payload?.processed)
      ? (payload.processed as BukSyncProcessedRow[])
      : [],
    error: null,
    dispatchError: functionError
  };
}


export interface CandidateHistoricalRejection {
  case_code: string;
  job_position: string;
  stage_code: string;
  rejection_reason: string | null;
  date: string;
}

export interface CandidateProfileSearchResult {
  id: string;
  national_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  historical_rejections?: CandidateHistoricalRejection[];
}

export async function findCandidateProfileByRut(rut: string): Promise<{
  data: CandidateProfileSearchResult | null;
  error: string | null;
}> {
  if (!supabase) {
    return { data: null, error: "Supabase no está configurado." };
  }

  const normalizedNationalId = normalizeRut(rut);

  const { data, error } = await supabase.rpc("find_candidate_profile_with_history_by_rut", {
    p_national_id: normalizedNationalId
  });

  if (error) {
    return {
      data: null,
      error: formatRpcError(error) || "No fue posible buscar el candidato."
    };
  }

  const results = data as unknown as CandidateProfileSearchResult[];
  return {
    data: (results && results.length > 0 ? results[0] : null),
    error: null
  };
}

export interface BukCandidateStatus {
  exists: boolean;
  status?: string;
  name?: string;
  is_active?: boolean;
  exit_date?: string | null;
}

export async function checkCandidateInBukLive(rut: string): Promise<{
  data: BukCandidateStatus | null;
  error: string | null;
}> {
  if (!supabase) {
    return { data: null, error: "Supabase no está configurado." };
  }

  const normalizedNationalId = normalizeRut(rut);

  const { data, error } = await supabase.rpc("find_buk_employee_status_by_rut", {
    p_national_id: normalizedNationalId
  });

  if (error) {
    return {
      data: null,
      error: formatRpcError(error) || "No fue posible verificar el estado en BUK."
    };
  }

  const results = data as unknown as Array<{
    match_found: boolean;
    name?: string;
    status?: string;
    is_active?: boolean;
    exit_date?: string | null;
  }> | null;

  const firstResult = results && results.length > 0 ? results[0] : null;

  return {
    data: firstResult
      ? {
          exists: Boolean(firstResult.match_found),
          status: firstResult.status,
          name: firstResult.name,
          is_active: firstResult.is_active,
          exit_date: firstResult.exit_date ?? null
        }
      : { exists: false },
    error: null
  };
}
