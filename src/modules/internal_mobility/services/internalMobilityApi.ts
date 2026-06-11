import { supabase } from "../../../shared/lib/supabase";
import type {
  CreateInternalMobilityRequestInput,
  CreateInternalMobilityRequestResult,
  InternalMobilityEligibleWorker,
  InternalMobilityEligibleFolio,
  InternalMobilityRequestDetail,
  InternalMobilityRequestSummary,
  InternalMobilitySetupCatalogs,
  InternalMobilityWorkerContext
} from "../types";

function getSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase no está configurado en este entorno.");
  }

  return supabase;
}

function asArray<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

function readText(value: unknown, fallback = "") {
  return String(value ?? fallback);
}

function readNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNullableNumber(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

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

function mapSetupCatalogs(payload: unknown): InternalMobilitySetupCatalogs {
  const source = (payload ?? {}) as Record<string, unknown>;

  return {
    bukJobTitles: asArray<unknown>(source.buk_job_titles)
      .map((item) => readText(item).trim())
      .filter(Boolean),
    shiftCatalog: asArray<Record<string, unknown>>(source.shift_catalog).map((item) => ({
      id: Number(item.id ?? 0),
      code: readText(item.code),
      name: readText(item.name),
      active: Boolean(item.active)
    })),
    destinations: asArray<Record<string, unknown>>(source.destinations).map((item) => ({
      contractId: Number(item.contract_id ?? 0),
      contractCode: readText(item.contract_code),
      contractNumber: readText(item.contract_number),
      areaName: readText(item.area_name),
      areaCode: readNullableText(item.area_code),
      costCenterCode: readText(item.cost_center_code),
      costCenterName: readText(item.cost_center_name),
      companyName: readText(item.company_name),
      label: readText(item.label)
    })),
    eligibleFolios: asArray<Record<string, unknown>>(source.eligible_folios).map(
      (item): InternalMobilityEligibleFolio => ({
        recruitmentCaseId: readText(item.recruitment_case_id),
        hiringRequestId: readText(item.hiring_request_id),
        folio: readNullableText(item.folio),
        caseCode: readText(item.case_code),
        jobPositionName: readText(item.job_position_name),
        contractName: readText(item.contract_name),
        contractNumber: readNullableText(item.contract_number),
        shiftName: readNullableText(item.shift_name),
        costCenterCode: readText(item.cost_center_code),
        costCenterName: readText(item.cost_center_name),
        companyName: readNullableText(item.company_name),
        requestedVacancies: Number(item.requested_vacancies ?? 0),
        filledVacancies: Number(item.filled_vacancies ?? 0),
        availableVacancies: Number(item.available_vacancies ?? 0),
        pendingMobilityCount: Number(item.pending_mobility_count ?? 0),
        approvedMobilityCount: Number(item.approved_mobility_count ?? 0),
        label: readText(item.label)
      })
    )
  };
}

function mapWorkerContext(payload: unknown): InternalMobilityWorkerContext {
  const source = (payload ?? {}) as Record<string, unknown>;
  const worker = (source.worker ?? {}) as Record<string, unknown>;

  return {
    worker: {
      bukEmployeeId: readText(worker.buk_employee_id),
      fullName: readText(worker.full_name),
      documentNumber: readText(worker.document_number),
      documentType: readText(worker.document_type, "rut"),
      currentJobTitle: readText(worker.current_job_title),
      currentContractCode: readNullableText(worker.current_contract_code),
      currentAreaName: readNullableText(worker.current_area_name),
      currentAreaCode: readNullableText(worker.current_area_code),
      currentCompanyName: readNullableText(worker.current_company_name),
      currentShiftName: readNullableText(worker.current_shift_name),
      matchedDestinationContractId: readNullableNumber(worker.matched_destination_contract_id),
      matchedDestinationContractCode: readNullableText(worker.matched_destination_contract_code),
      matchedDestinationAreaName: readNullableText(worker.matched_destination_area_name),
      matchedDestinationCompanyName: readNullableText(worker.matched_destination_company_name)
    }
  };
}

function mapRequestSummary(row: Record<string, unknown>): InternalMobilityRequestSummary {
  return {
    requestId: readText(row.request_id),
    folio: readText(row.folio),
    status: String(row.status ?? "pending_area_manager") as InternalMobilityRequestSummary["status"],
    requesterName: readText(row.requester_name),
    requesterEmail: readNullableText(row.requester_email),
    employeeFullName: readText(row.employee_full_name),
    employeeDocumentNumber: readNullableText(row.employee_document_number),
    currentJobTitle: readNullableText(row.current_job_title),
    currentAreaName: readNullableText(row.current_area_name),
    currentCompanyName: readNullableText(row.current_company_name),
    currentShiftName: readNullableText(row.current_shift_name),
    destinationJobTitle: readText(row.destination_job_title),
    destinationAreaName: readText(row.destination_area_name),
    destinationShiftName: readNullableText(row.destination_shift_name),
    destinationCostCenterCode: readNullableText(row.destination_cost_center_code),
    destinationCostCenterName: readNullableText(row.destination_cost_center_name),
    destinationCompanyName: readText(row.destination_company_name),
    requiresTermination: Boolean(row.requires_termination),
    motive: String(row.motive ?? ""),
    currentStepName:
      typeof row.current_step_name === "string" && row.current_step_name.trim()
        ? row.current_step_name
        : null,
    currentApproverName:
      typeof row.current_approver_name === "string" && row.current_approver_name.trim()
        ? row.current_approver_name
        : null,
    createdAt: String(row.created_at ?? ""),
    submittedAt: String(row.submitted_at ?? ""),
    approvedAt:
      typeof row.approved_at === "string" && row.approved_at.trim() ? row.approved_at : null,
    rejectedAt:
      typeof row.rejected_at === "string" && row.rejected_at.trim() ? row.rejected_at : null
  };
}

function mapRequestDetail(payload: unknown): InternalMobilityRequestDetail {
  const source = (payload ?? {}) as Record<string, unknown>;
  const request = (source.request ?? {}) as Record<string, unknown>;

  return {
    request: {
      id: readText(request.id),
      folio: readText(request.folio),
      status: String(request.status ?? "pending_area_manager") as InternalMobilityRequestDetail["request"]["status"],
      requesterName: readText(request.requester_name),
      requesterJobTitle: readNullableText(request.requester_job_title),
      requesterEmail: readNullableText(request.requester_email),
      employeeBukEmployeeId: readText(request.employee_buk_employee_id),
      employeeDocumentNumber: readNullableText(request.employee_document_number),
      employeeDocumentType: readNullableText(request.employee_document_type),
      employeeFullName: readText(request.employee_full_name),
      currentJobTitle: readNullableText(request.current_job_title),
      currentContractCode: readNullableText(request.current_contract_code),
      currentAreaName: readNullableText(request.current_area_name),
      currentAreaCode: readNullableText(request.current_area_code),
      currentCompanyName: readNullableText(request.current_company_name),
      currentShiftName: readNullableText(request.current_shift_name),
      recruitmentCaseId: readNullableText(request.recruitment_case_id),
      hiringRequestId: readNullableText(request.hiring_request_id),
      recruitmentCaseCode: readNullableText(request.recruitment_case_code),
      sourceFolio: readNullableText(request.source_folio),
      destinationJobTitle: readText(request.destination_job_title),
      destinationContractId: readNullableNumber(request.destination_contract_id),
      destinationContractCode: readNullableText(request.destination_contract_code),
      destinationContractNumber: readNullableText(request.destination_contract_number),
      destinationAreaName: readText(request.destination_area_name),
      destinationAreaCode: readNullableText(request.destination_area_code),
      destinationCostCenterCode: readNullableText(request.destination_cost_center_code),
      destinationCostCenterName: readNullableText(request.destination_cost_center_name),
      destinationCompanyName: readNullableText(request.destination_company_name),
      destinationShiftId: readNullableNumber(request.destination_shift_id),
      destinationShiftName: readNullableText(request.destination_shift_name),
      requiresTermination: Boolean(request.requires_termination),
      motive: String(request.motive ?? ""),
      currentStepCode:
        typeof request.current_step_code === "string" && request.current_step_code.trim()
          ? request.current_step_code
          : null,
      submittedAt: String(request.submitted_at ?? ""),
      approvedAt:
        typeof request.approved_at === "string" && request.approved_at.trim()
          ? request.approved_at
          : null,
      rejectedAt:
        typeof request.rejected_at === "string" && request.rejected_at.trim()
          ? request.rejected_at
          : null,
      createdAt: readText(request.created_at),
      updatedAt: readText(request.updated_at)
    },
    approvals: asArray<Record<string, unknown>>(source.approvals).map((item) => ({
      id: Number(item.id ?? 0),
      stepCode: String(item.step_code ?? ""),
      stepName: String(item.step_name ?? ""),
      stepOrder: Number(item.step_order ?? 0),
      approverUserId:
        typeof item.approver_user_id === "string" && item.approver_user_id.trim()
          ? item.approver_user_id
          : null,
      approverName:
        typeof item.approver_name === "string" && item.approver_name.trim()
          ? item.approver_name
          : null,
      approverEmail:
        typeof item.approver_email === "string" && item.approver_email.trim()
          ? item.approver_email
          : null,
      status: String(item.status ?? "pending") as InternalMobilityRequestDetail["approvals"][number]["status"],
      decisionComment:
        typeof item.decision_comment === "string" && item.decision_comment.trim()
          ? item.decision_comment
          : null,
      decidedAt:
        typeof item.decided_at === "string" && item.decided_at.trim() ? item.decided_at : null,
      createdAt: String(item.created_at ?? "")
    })),
    auditLog: asArray<Record<string, unknown>>(source.audit_log).map((item) => ({
      id: Number(item.id ?? 0),
      actionType: String(item.action_type ?? ""),
      actorUserId: String(item.actor_user_id ?? ""),
      actorName:
        typeof item.actor_name === "string" && item.actor_name.trim() ? item.actor_name : null,
      createdAt: String(item.created_at ?? ""),
      oldValues:
        item.old_values && typeof item.old_values === "object"
          ? (item.old_values as Record<string, unknown>)
          : null,
      newValues:
        item.new_values && typeof item.new_values === "object"
          ? (item.new_values as Record<string, unknown>)
          : null,
      metadata:
        item.metadata && typeof item.metadata === "object"
          ? (item.metadata as Record<string, unknown>)
          : null
    }))
  };
}

export async function fetchInternalMobilitySetupCatalogs() {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_internal_mobility_setup_catalogs");

  if (error) {
    throw new Error(error.message || "No fue posible cargar catálogos de movilidad interna.");
  }

  return mapSetupCatalogs(data);
}

export async function searchInternalMobilityWorkers(search: string, limit = 12) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("search_internal_mobility_workers", {
    p_search: search,
    p_limit: limit
  });

  if (error) {
    throw new Error(error.message || "No fue posible buscar trabajadores activos.");
  }

  return asArray<Record<string, unknown>>(data).map(
    (item): InternalMobilityEligibleWorker => ({
      bukEmployeeId: String(item.buk_employee_id ?? ""),
      fullName: String(item.full_name ?? ""),
      documentNumber: String(item.document_number ?? ""),
      jobTitle: String(item.job_title ?? ""),
      contractCode:
        typeof item.contract_code === "string" && item.contract_code.trim()
          ? item.contract_code
          : null,
      areaName: typeof item.area_name === "string" && item.area_name.trim() ? item.area_name : null,
      companyName:
        typeof item.company_name === "string" && item.company_name.trim()
          ? item.company_name
          : null,
      displayLabel: String(item.display_label ?? "")
    })
  );
}

export async function fetchInternalMobilityWorkerContext(bukEmployeeId: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_internal_mobility_worker_context", {
    p_buk_employee_id: bukEmployeeId
  });

  if (error) {
    throw new Error(error.message || "No fue posible cargar el contexto del trabajador.");
  }

  return mapWorkerContext(data);
}

export async function createInternalMobilityRequest(input: CreateInternalMobilityRequestInput) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("submit_internal_mobility_request", {
    p_buk_employee_id: input.bukEmployeeId,
    p_recruitment_case_id: input.recruitmentCaseId,
    p_motive: input.motive,
    p_requester_signed: input.requesterSigned
  });

  if (error) {
    throw new Error(formatRpcError(error) || "No fue posible registrar la solicitud.");
  }

  const row = asArray<Record<string, unknown>>(data)[0];

  if (!row) {
    throw new Error("La creación no devolvió un resultado válido.");
  }

  return {
    requestId: String(row.request_id ?? ""),
    folio: String(row.folio ?? ""),
    status: String(row.status ?? "pending_area_manager") as CreateInternalMobilityRequestResult["status"],
    requiresTermination: Boolean(row.requires_termination),
    currentCompanyName: readNullableText(row.current_company_name),
    destinationCompanyName: readNullableText(row.destination_company_name)
  } satisfies CreateInternalMobilityRequestResult;
}

export async function fetchInternalMobilityRequests() {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_internal_mobility_requests");

  if (error) {
    throw new Error(error.message || "No fue posible cargar solicitudes de movilidad.");
  }

  return asArray<Record<string, unknown>>(data).map(mapRequestSummary);
}

export async function fetchInternalMobilityRequestDetail(requestId: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_internal_mobility_request_detail", {
    p_request_id: requestId
  });

  if (error) {
    throw new Error(error.message || "No fue posible cargar el detalle de la solicitud.");
  }

  return mapRequestDetail(data);
}

export async function decideInternalMobilityApproval(params: {
  approvalId: number;
  decision: "approved" | "rejected";
  comment?: string | null;
}) {
  const client = getSupabaseClient();
  const { error } = await client.rpc("decide_internal_mobility_request_approval", {
    p_approval_id: params.approvalId,
    p_decision: params.decision,
    p_comment: params.comment?.trim() ? params.comment.trim() : null
  });

  if (error) {
    return {
      error: formatRpcError(error) || "No fue posible registrar la decisión."
    };
  }

  return {
    error: null
  };
}
