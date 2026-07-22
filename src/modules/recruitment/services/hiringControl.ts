import { supabase } from "../../../shared/lib/supabase";
import { formatRut, normalizeRut } from "../../../shared/lib/rut";
import { getSupabaseErrorMessage } from "../../../shared/lib/supabaseRpc";

export type {
  CandidateBukProfileDetails,
  CandidateDocumentValidationSummary,
  CandidateWhoApprovalSummary,
  CandidateWorkerFile,
  HiringControlApproval,
  RecruitmentCandidateControlRow,
  RecruitmentCandidateStage,
  RecruitmentCaseAssignment,
  RecruitmentCaseAuditRow,
  RecruitmentCaseCandidateHistoryRow,
  RecruitmentCaseCandidateRow,
  RecruitmentCaseDetail,
  RecruitmentCaseHeadcountBreakdown,
  RecruitmentCaseListRow,
  RecruitmentCaseStatus,
  RecruitmentDashboardSummary,
  RecruitmentPagedResponse,
  RecruitmentPersonnelToHireRow,
  RecruitmentProcessStatusFilter,
  RecruitmentProcessesPageSummary,
  WhoApprovalCause,
  WhoCauseType
} from "./hiringControlTypes";
export { getRecruitmentCaseHeadcountBreakdown } from "./hiringControlTypes";
import type {
  CandidateBukProfileDetails,
  CandidateDocumentValidationSummary,
  CandidateWhoApprovalSummary,
  CandidateWorkerFile,
  HiringControlApproval,
  RecruitmentCandidateControlRow,
  RecruitmentCandidateStage,
  RecruitmentCaseAssignment,
  RecruitmentCaseAuditRow,
  RecruitmentCaseCandidateHistoryRow,
  RecruitmentCaseCandidateRow,
  RecruitmentCaseDetail,
  RecruitmentCaseListRow,
  RecruitmentCaseStatus,
  RecruitmentDashboardSummary,
  RecruitmentPagedResponse,
  RecruitmentPersonnelToHireRow,
  RecruitmentProcessStatusFilter,
  RecruitmentProcessesPageSummary,
  WhoApprovalCause,
  WhoCauseType
} from "./hiringControlTypes";

type RecruitmentPagedPayload<T, S = null> = {
  items?: T[] | null;
  total_count?: number | null;
  summary?: S | null;
};

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
  const rawSummary = parsed.summary;

  if (!rawSummary || typeof rawSummary !== "object") {
    return {
      ...parsed,
      summary: null
    };
  }

  return {
    ...parsed,
    summary: {
      activeCases: Number(rawSummary.activeCases ?? 0),
      requestedVacancies: Number(rawSummary.requestedVacancies ?? 0),
      inProgressCandidates: Number(rawSummary.inProgressCandidates ?? 0),
      readyToHireCases: Number(rawSummary.readyToHireCases ?? 0),
      filledCases: Number(rawSummary.filledCases ?? 0),
      hiredCandidates: Number(rawSummary.hiredCandidates ?? 0)
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
      error: getSupabaseErrorMessage(
        error,
        "No fue posible cargar el resumen de Control de Contrataciones."
      )
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
      error: getSupabaseErrorMessage(error, "No fue posible cargar la cola de aprobaciones.")
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
      error: getSupabaseErrorMessage(error, "No fue posible cargar los procesos de contratación.")
    };
  }

  return {
    data: parseRecruitmentProcessesPagePayload(data),
    error: null
  };
}

export async function resolveRecruitmentProcessSearchFilter(search: string): Promise<{
  data: RecruitmentProcessStatusFilter;
  error: string | null;
}> {
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    return { data: null, error: null };
  }

  const filters: RecruitmentProcessStatusFilter[] = [
    null,
    "open",
    "screening",
    "ready_to_hire",
    "filled",
    "cancelled"
  ];
  const results = await Promise.all(
    filters.map(async (statusFilter) => ({
      statusFilter,
      result: await fetchRecruitmentProcessesPage({
        search: normalizedSearch,
        statusFilter,
        sortColumn: "case_code",
        sortDirection: "asc",
        limit: 5,
        offset: 0
      })
    }))
  );

  const firstError = results.find(({ result }) => result.error)?.result.error ?? null;

  if (firstError) {
    return { data: null, error: firstError };
  }

  const exactSearch = normalizedSearch.toLowerCase().replace(/^rc-/, "");
  const exactMatch = results.find(({ result }) =>
    result.data?.items.some((item) => {
      const caseCode = item.case_code.toLowerCase();
      const caseNumber = caseCode.replace(/^rc-/, "");
      const folio = item.folio?.toLowerCase() ?? "";

      return caseCode === normalizedSearch.toLowerCase() || caseNumber === exactSearch || folio === exactSearch;
    })
  );

  if (exactMatch) {
    return { data: exactMatch.statusFilter, error: null };
  }

  const firstVisibleMatch = results.find(({ result }) => (result.data?.totalCount ?? 0) > 0);

  return { data: firstVisibleMatch?.statusFilter ?? null, error: null };
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
      error: getSupabaseErrorMessage(error, "No fue posible cargar candidatos.")
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
      error: getSupabaseErrorMessage(error, "No fue posible cargar personal a contratar.")
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
      error: getSupabaseErrorMessage(error, "No fue posible cargar el personal contratado.")
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
      error: getSupabaseErrorMessage(error, "No fue posible cargar folios disponibles.")
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
      error: getSupabaseErrorMessage(error, "No fue posible cargar el detalle del caso.")
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
      error: getSupabaseErrorMessage(error, "No fue posible agregar el candidato.")
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
      error: getSupabaseErrorMessage(error, "No fue posible trasladar al candidato.")
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
      error: getSupabaseErrorMessage(error, "No fue posible mover la etapa del candidato.")
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
      error: getSupabaseErrorMessage(error, "No fue posible enviar la aprobación Who."),
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
      error: getSupabaseErrorMessage(error, "No fue posible aprobar la etapa Who.")
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
      error: getSupabaseErrorMessage(error, "No fue posible rechazar la aprobación Who.")
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
    return { error: getSupabaseErrorMessage(error, "No fue posible actualizar la licencia.", "message") };
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
    return {
      error: getSupabaseErrorMessage(error, "No fue posible actualizar las notas de entrevista.", "message")
    };
  }

  return { error: null };
}

export {
  checkCandidateInBukLive,
  enqueueCandidatesToBuk,
  fetchCandidateBukProfile,
  findCandidateProfileByRut,
  generateCandidatesInBuk,
  updateCandidatePersonProfile,
  updateCandidateWorkerFile
} from "./hiringBukProfile";
export type { BukCandidateStatus, CandidateHistoricalRejection, CandidateProfileSearchResult } from "./hiringBukProfile";
