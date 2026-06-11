import { supabase } from "../../../shared/lib/supabase";
import type {
  CreateInternalMobilityRequestInput,
  CreateInternalMobilityRequestResult,
  InternalMobilityEligibleWorker,
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
      .map((item) => String(item ?? "").trim())
      .filter(Boolean),
    shiftCatalog: asArray<Record<string, unknown>>(source.shift_catalog).map((item) => ({
      id: Number(item.id ?? 0),
      code: String(item.code ?? ""),
      name: String(item.name ?? ""),
      active: Boolean(item.active)
    })),
    destinations: asArray<Record<string, unknown>>(source.destinations).map((item) => ({
      contractId: Number(item.contract_id ?? 0),
      contractCode: String(item.contract_code ?? ""),
      contractNumber: String(item.contract_number ?? ""),
      areaName: String(item.area_name ?? ""),
      areaCode:
        typeof item.area_code === "string" && item.area_code.trim() ? item.area_code : null,
      costCenterCode: String(item.cost_center_code ?? ""),
      costCenterName: String(item.cost_center_name ?? ""),
      companyName: String(item.company_name ?? ""),
      label: String(item.label ?? "")
    }))
  };
}

function mapWorkerContext(payload: unknown): InternalMobilityWorkerContext {
  const source = (payload ?? {}) as Record<string, unknown>;
  const worker = (source.worker ?? {}) as Record<string, unknown>;

  return {
    worker: {
      bukEmployeeId: String(worker.buk_employee_id ?? ""),
      fullName: String(worker.full_name ?? ""),
      documentNumber: String(worker.document_number ?? ""),
      documentType: String(worker.document_type ?? "rut"),
      currentJobTitle: String(worker.current_job_title ?? ""),
      currentContractCode:
        typeof worker.current_contract_code === "string" && worker.current_contract_code.trim()
          ? worker.current_contract_code
          : null,
      currentAreaName:
        typeof worker.current_area_name === "string" && worker.current_area_name.trim()
          ? worker.current_area_name
          : null,
      currentAreaCode:
        typeof worker.current_area_code === "string" && worker.current_area_code.trim()
          ? worker.current_area_code
          : null,
      currentCompanyName:
        typeof worker.current_company_name === "string" && worker.current_company_name.trim()
          ? worker.current_company_name
          : null,
      currentShiftName:
        typeof worker.current_shift_name === "string" && worker.current_shift_name.trim()
          ? worker.current_shift_name
          : null,
      matchedDestinationContractId:
        worker.matched_destination_contract_id === null ||
        worker.matched_destination_contract_id === undefined
          ? null
          : Number(worker.matched_destination_contract_id),
      matchedDestinationContractCode:
        typeof worker.matched_destination_contract_code === "string" &&
        worker.matched_destination_contract_code.trim()
          ? worker.matched_destination_contract_code
          : null,
      matchedDestinationAreaName:
        typeof worker.matched_destination_area_name === "string" &&
        worker.matched_destination_area_name.trim()
          ? worker.matched_destination_area_name
          : null,
      matchedDestinationCompanyName:
        typeof worker.matched_destination_company_name === "string" &&
        worker.matched_destination_company_name.trim()
          ? worker.matched_destination_company_name
          : null
    }
  };
}

function mapRequestSummary(row: Record<string, unknown>): InternalMobilityRequestSummary {
  return {
    requestId: String(row.request_id ?? ""),
    folio: String(row.folio ?? ""),
    status: String(row.status ?? "pending_area_manager") as InternalMobilityRequestSummary["status"],
    requesterName: String(row.requester_name ?? ""),
    requesterEmail:
      typeof row.requester_email === "string" && row.requester_email.trim()
        ? row.requester_email
        : null,
    employeeFullName: String(row.employee_full_name ?? ""),
    employeeDocumentNumber:
      typeof row.employee_document_number === "string" && row.employee_document_number.trim()
        ? row.employee_document_number
        : null,
    currentJobTitle:
      typeof row.current_job_title === "string" && row.current_job_title.trim()
        ? row.current_job_title
        : null,
    currentAreaName:
      typeof row.current_area_name === "string" && row.current_area_name.trim()
        ? row.current_area_name
        : null,
    currentCompanyName:
      typeof row.current_company_name === "string" && row.current_company_name.trim()
        ? row.current_company_name
        : null,
    currentShiftName:
      typeof row.current_shift_name === "string" && row.current_shift_name.trim()
        ? row.current_shift_name
        : null,
    destinationJobTitle: String(row.destination_job_title ?? ""),
    destinationAreaName: String(row.destination_area_name ?? ""),
    destinationShiftName:
      typeof row.destination_shift_name === "string" && row.destination_shift_name.trim()
        ? row.destination_shift_name
        : null,
    destinationCostCenterCode:
      typeof row.destination_cost_center_code === "string" &&
      row.destination_cost_center_code.trim()
        ? row.destination_cost_center_code
        : null,
    destinationCostCenterName:
      typeof row.destination_cost_center_name === "string" &&
      row.destination_cost_center_name.trim()
        ? row.destination_cost_center_name
        : null,
    destinationCompanyName: String(row.destination_company_name ?? ""),
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
      id: String(request.id ?? ""),
      folio: String(request.folio ?? ""),
      status: String(request.status ?? "pending_area_manager") as InternalMobilityRequestDetail["request"]["status"],
      requesterName: String(request.requester_name ?? ""),
      requesterJobTitle:
        typeof request.requester_job_title === "string" && request.requester_job_title.trim()
          ? request.requester_job_title
          : null,
      requesterEmail:
        typeof request.requester_email === "string" && request.requester_email.trim()
          ? request.requester_email
          : null,
      employeeBukEmployeeId: String(request.employee_buk_employee_id ?? ""),
      employeeDocumentNumber:
        typeof request.employee_document_number === "string" &&
        request.employee_document_number.trim()
          ? request.employee_document_number
          : null,
      employeeDocumentType:
        typeof request.employee_document_type === "string" && request.employee_document_type.trim()
          ? request.employee_document_type
          : null,
      employeeFullName: String(request.employee_full_name ?? ""),
      currentJobTitle:
        typeof request.current_job_title === "string" && request.current_job_title.trim()
          ? request.current_job_title
          : null,
      currentContractCode:
        typeof request.current_contract_code === "string" && request.current_contract_code.trim()
          ? request.current_contract_code
          : null,
      currentAreaName:
        typeof request.current_area_name === "string" && request.current_area_name.trim()
          ? request.current_area_name
          : null,
      currentAreaCode:
        typeof request.current_area_code === "string" && request.current_area_code.trim()
          ? request.current_area_code
          : null,
      currentCompanyName:
        typeof request.current_company_name === "string" && request.current_company_name.trim()
          ? request.current_company_name
          : null,
      currentShiftName:
        typeof request.current_shift_name === "string" && request.current_shift_name.trim()
          ? request.current_shift_name
          : null,
      destinationJobTitle: String(request.destination_job_title ?? ""),
      destinationContractId: Number(request.destination_contract_id ?? 0),
      destinationContractCode:
        typeof request.destination_contract_code === "string" &&
        request.destination_contract_code.trim()
          ? request.destination_contract_code
          : null,
      destinationContractNumber:
        typeof request.destination_contract_number === "string" &&
        request.destination_contract_number.trim()
          ? request.destination_contract_number
          : null,
      destinationAreaName: String(request.destination_area_name ?? ""),
      destinationAreaCode:
        typeof request.destination_area_code === "string" && request.destination_area_code.trim()
          ? request.destination_area_code
          : null,
      destinationCostCenterCode:
        typeof request.destination_cost_center_code === "string" &&
        request.destination_cost_center_code.trim()
          ? request.destination_cost_center_code
          : null,
      destinationCostCenterName:
        typeof request.destination_cost_center_name === "string" &&
        request.destination_cost_center_name.trim()
          ? request.destination_cost_center_name
          : null,
      destinationCompanyName: String(request.destination_company_name ?? ""),
      destinationShiftId:
        request.destination_shift_id === null || request.destination_shift_id === undefined
          ? null
          : Number(request.destination_shift_id),
      destinationShiftName:
        typeof request.destination_shift_name === "string" &&
        request.destination_shift_name.trim()
          ? request.destination_shift_name
          : null,
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
      createdAt: String(request.created_at ?? ""),
      updatedAt: String(request.updated_at ?? "")
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
    p_destination_contract_id: input.destinationContractId,
    p_destination_job_title: input.destinationJobTitle,
    p_destination_shift_id: input.destinationShiftId,
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
    currentCompanyName: String(row.current_company_name ?? ""),
    destinationCompanyName: String(row.destination_company_name ?? "")
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
