import { supabase } from "../../../shared/lib/supabase";
import type {
  BulkHrIncentiveApprovalDecisionResult,
  CreateHrIncentiveRequestInput,
  CreateHrIncentiveRequestResult,
  HrIncentiveApprovalQueueItem,
  HrIncentiveEligibleWorker,
  HrIncentivePreview,
  HrIncentiveRequestDetail,
  HrIncentiveRequest,
  HrIncentiveRequestsFilters,
  HrIncentiveSetupCatalogs,
  HrIncentiveUnionStatus,
  HrIncentiveWorkerContext
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

function readNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function formatRpcError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}) {
  return [error.message, error.details, error.hint, error.code ? `Código: ${error.code}` : ""]
    .filter(Boolean)
    .join(" · ");
}

function mapUnionStatus(value: unknown): HrIncentiveUnionStatus {
  return value === "unionized" || value === "non_unionized" ? value : "unknown";
}

function mapSetupCatalogs(payload: unknown): HrIncentiveSetupCatalogs {
  const source = (payload ?? {}) as Record<string, unknown>;

  return {
    bukJobTitles: asArray<unknown>(source.buk_job_titles)
      .map((item) => String(item ?? "").trim())
      .filter(Boolean),
    bukUnions: asArray<unknown>(source.buk_unions)
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .map((item) => ({ value: item, label: item })),
    bukUnionStatuses: asArray<Record<string, unknown>>(source.buk_union_statuses).map((item) => ({
      value: mapUnionStatus(item.value),
      label: String(item.label ?? "")
    })),
    allowedJobTitles: asArray<Record<string, unknown>>(source.allowed_job_titles).map((item) => ({
      id: String(item.id ?? ""),
      jobTitle: String(item.job_title ?? ""),
      isActive: Boolean(item.is_active),
      createdAt: String(item.created_at ?? "")
    })),
    incentiveTypes: asArray<Record<string, unknown>>(source.incentive_types).map((item) => ({
      id: String(item.id ?? ""),
      code: String(item.code ?? ""),
      name: String(item.name ?? ""),
      calculationBasis: (item.calculation_basis === "per_hour" ? "per_hour" : "fixed"),
      requiresReplacement: Boolean(item.requires_replacement),
      isActive: Boolean(item.is_active),
      createdAt: String(item.created_at ?? "")
    })),
    rateRules: asArray<Record<string, unknown>>(source.rate_rules).map((item) => ({
      id: String(item.id ?? ""),
      incentiveTypeId: String(item.incentive_type_id ?? ""),
      incentiveTypeName: String(item.incentive_type_name ?? ""),
      contractCode:
        typeof item.contract_code === "string" && item.contract_code.trim()
          ? item.contract_code
          : null,
      jobTitle:
        typeof item.job_title === "string" && item.job_title.trim() ? item.job_title : null,
      unionName:
        typeof item.union_name === "string" && item.union_name.trim() ? item.union_name : null,
      unionStatus:
        typeof item.union_status === "string" && item.union_status.trim()
          ? mapUnionStatus(item.union_status)
          : null,
      amount: Number(item.amount ?? 0),
      priority: Number(item.priority ?? 100),
      validFrom: typeof item.valid_from === "string" ? item.valid_from : null,
      validTo: typeof item.valid_to === "string" ? item.valid_to : null,
      isActive: Boolean(item.is_active),
      createdAt: String(item.created_at ?? "")
    }))
  };
}

function mapWorkerContext(payload: unknown): HrIncentiveWorkerContext {
  const source = (payload ?? {}) as Record<string, unknown>;
  const worker = (source.worker ?? {}) as Record<string, unknown>;

  return {
    worker: {
      bukEmployeeId: String(worker.buk_employee_id ?? ""),
      fullName: String(worker.full_name ?? ""),
      documentNumber: String(worker.document_number ?? ""),
      documentType: String(worker.document_type ?? "rut"),
      jobTitle: String(worker.job_title ?? ""),
      unionName:
        typeof worker.union_name === "string" && worker.union_name.trim() ? worker.union_name : null,
      unionStatus: mapUnionStatus(worker.union_status),
      unionStatusLabel: String(worker.union_status_label ?? ""),
      unionJoinedAt:
        typeof worker.union_joined_at === "string" && worker.union_joined_at.trim()
          ? worker.union_joined_at
          : null,
      primaryContractCode:
        typeof worker.primary_contract_code === "string" && worker.primary_contract_code.trim()
          ? worker.primary_contract_code
          : null,
      primaryAreaName:
        typeof worker.primary_area_name === "string" && worker.primary_area_name.trim()
          ? worker.primary_area_name
          : null,
      primaryAreaCode:
        typeof worker.primary_area_code === "string" && worker.primary_area_code.trim()
          ? worker.primary_area_code
          : null
    },
    availableAreas: asArray<Record<string, unknown>>(source.available_areas).map((item) => ({
      contractCode:
        typeof item.contract_code === "string" && item.contract_code.trim()
          ? item.contract_code
          : null,
      areaName: typeof item.area_name === "string" && item.area_name.trim() ? item.area_name : null,
      areaCode: typeof item.area_code === "string" && item.area_code.trim() ? item.area_code : null,
      label: String(item.label ?? ""),
      isPrimary: Boolean(item.is_primary)
    }))
  };
}

function mapPreview(payload: unknown): HrIncentivePreview {
  const source = (payload ?? {}) as Record<string, unknown>;
  const worker = (source.worker ?? {}) as Record<string, unknown>;
  const rule = (source.rule ?? {}) as Record<string, unknown>;

  return {
    worker: {
      bukEmployeeId: String(worker.buk_employee_id ?? ""),
      fullName: String(worker.full_name ?? ""),
      documentNumber: String(worker.document_number ?? ""),
      documentType: String(worker.document_type ?? "rut"),
      jobTitle: String(worker.job_title ?? ""),
      unionName:
        typeof worker.union_name === "string" && worker.union_name.trim() ? worker.union_name : null,
      unionStatus: mapUnionStatus(worker.union_status),
      unionStatusLabel: String(worker.union_status_label ?? ""),
      unionJoinedAt:
        typeof worker.union_joined_at === "string" && worker.union_joined_at.trim()
          ? worker.union_joined_at
          : null,
      primaryContractCode:
        typeof worker.primary_contract_code === "string" && worker.primary_contract_code.trim()
          ? worker.primary_contract_code
          : null,
      primaryAreaName:
        typeof worker.primary_area_name === "string" && worker.primary_area_name.trim()
          ? worker.primary_area_name
          : null,
      primaryAreaCode:
        typeof worker.primary_area_code === "string" && worker.primary_area_code.trim()
          ? worker.primary_area_code
          : null
    },
    rule: {
      rateRuleId: String(rule.rate_rule_id ?? ""),
      incentiveTypeId: String(rule.incentive_type_id ?? ""),
      incentiveTypeName: String(rule.incentive_type_name ?? ""),
      calculationBasis: rule.calculation_basis === "per_hour" ? "per_hour" : "fixed",
      requiresReplacement: Boolean(rule.requires_replacement),
      rateRuleAmount: Number(rule.rate_rule_amount ?? 0),
      matchedContractCode:
        typeof rule.matched_contract_code === "string" && rule.matched_contract_code.trim()
          ? rule.matched_contract_code
          : null,
      matchedJobTitle:
        typeof rule.matched_job_title === "string" && rule.matched_job_title.trim()
          ? rule.matched_job_title
          : null,
      matchedUnionName:
        typeof rule.matched_union_name === "string" && rule.matched_union_name.trim()
          ? rule.matched_union_name
          : null,
      matchedUnionStatus:
        typeof rule.matched_union_status === "string" && rule.matched_union_status.trim()
          ? mapUnionStatus(rule.matched_union_status)
          : null,
      priority: Number(rule.priority ?? 0)
    },
    durationHours:
      source.duration_hours === null || source.duration_hours === undefined
        ? null
        : Number(source.duration_hours),
    serviceDate: String(source.service_date ?? ""),
    selectedContractCode: String(source.selected_contract_code ?? ""),
    calculatedAmount: Number(source.calculated_amount ?? 0)
  };
}

function mapRequestRow(row: Record<string, unknown>): HrIncentiveRequest {
  return {
    id: String(row.id ?? ""),
    folio: Number(row.folio ?? 0),
    employeeFullName: String(row.employee_full_name ?? ""),
    employeeDocumentNumber: String(row.employee_document_number ?? ""),
    replacementFullName:
      typeof row.replacement_full_name === "string" && row.replacement_full_name.trim()
        ? row.replacement_full_name
        : null,
    replacementDocumentNumber:
      typeof row.replacement_document_number === "string" &&
      row.replacement_document_number.trim()
        ? row.replacement_document_number
        : null,
    motive: typeof row.motive === "string" && row.motive.trim() ? row.motive : null,
    description: typeof row.description === "string" && row.description.trim() ? row.description : null,
    incentiveTypeName: String(row.incentive_type_name ?? ""),
    calculatedAmount: Number(row.calculated_amount ?? 0),
    periodCode: String(row.period_code ?? ""),
    selectedAreaName: String(row.selected_area_name ?? ""),
    selectedContractCode: String(row.selected_contract_code ?? ""),
    createdAt: String(row.created_at ?? ""),
    serviceDate: String(row.service_date ?? ""),
    durationHours:
      row.duration_hours === null || row.duration_hours === undefined
        ? null
        : Number(row.duration_hours),
    requesterName: String(row.requester_name ?? ""),
    status: String(row.status ?? "P") as HrIncentiveRequest["status"],
    currentFlowUser:
      typeof row.current_flow_user === "string" && row.current_flow_user.trim()
        ? row.current_flow_user
        : null,
    cancellationComment:
      typeof row.cancellation_comment === "string" && row.cancellation_comment.trim()
        ? row.cancellation_comment
        : null
  };
}

function mapApprovalQueueRow(row: Record<string, unknown>): HrIncentiveApprovalQueueItem {
  return {
    approvalId: Number(row.approval_id ?? 0),
    requestId: String(row.request_id ?? ""),
    folio: Number(row.folio ?? 0),
    stepCode: String(row.step_code ?? "contract_admin") as HrIncentiveApprovalQueueItem["stepCode"],
    stepName: String(row.step_name ?? ""),
    stepOrder: Number(row.step_order ?? 0),
    approvalStatus: String(row.approval_status ?? "pending") as HrIncentiveApprovalQueueItem["approvalStatus"],
    approverUserId: readNullableText(row.approver_user_id),
    approverName: String(row.approver_name ?? ""),
    employeeFullName: String(row.employee_full_name ?? ""),
    employeeDocumentNumber: String(row.employee_document_number ?? ""),
    employeeJobTitle: String(row.employee_job_title ?? ""),
    employeeUnionName: readNullableText(row.employee_union_name),
    selectedContractCode: String(row.selected_contract_code ?? ""),
    selectedAreaName: String(row.selected_area_name ?? ""),
    incentiveTypeName: String(row.incentive_type_name ?? ""),
    serviceDate: String(row.service_date ?? ""),
    calculatedAmount: Number(row.calculated_amount ?? 0),
    requesterName: String(row.requester_name ?? ""),
    createdAt: String(row.created_at ?? "")
  };
}

function mapRequestDetail(payload: unknown): HrIncentiveRequestDetail {
  const source = (payload ?? {}) as Record<string, unknown>;
  const request = (source.request ?? {}) as Record<string, unknown>;

  return {
    request: {
      id: String(request.id ?? ""),
      folio: Number(request.folio ?? 0),
      status: String(request.status ?? "P") as HrIncentiveRequestDetail["request"]["status"],
      employeeBukEmployeeId: String(request.employee_buk_employee_id ?? ""),
      employeeDocumentType: String(request.employee_document_type ?? "rut"),
      employeeDocumentNumber: String(request.employee_document_number ?? ""),
      employeeFullName: String(request.employee_full_name ?? ""),
      employeeJobTitle: String(request.employee_job_title ?? ""),
      employeeUnionName: readNullableText(request.employee_union_name),
      employeeUnionStatus: mapUnionStatus(request.employee_union_status),
      employeeUnionJoinedAt: readNullableText(request.employee_union_joined_at),
      primaryContractCode: readNullableText(request.primary_contract_code),
      primaryAreaName: readNullableText(request.primary_area_name),
      selectedContractCode: String(request.selected_contract_code ?? ""),
      selectedAreaName: String(request.selected_area_name ?? ""),
      selectedAreaCode: readNullableText(request.selected_area_code),
      incentiveTypeName: String(request.incentive_type_name ?? ""),
      requiresReplacement: Boolean(request.requires_replacement),
      replacementBukEmployeeId: readNullableText(request.replacement_buk_employee_id),
      replacementDocumentNumber: readNullableText(request.replacement_document_number),
      replacementFullName: readNullableText(request.replacement_full_name),
      motive: readNullableText(request.motive),
      description: readNullableText(request.description),
      serviceDate: String(request.service_date ?? ""),
      durationHours:
        request.duration_hours === null || request.duration_hours === undefined
          ? null
          : Number(request.duration_hours),
      periodCode: String(request.period_code ?? ""),
      calculationBasis:
        request.calculation_basis === "per_hour" ? "per_hour" : "fixed",
      rateRuleAmount: Number(request.rate_rule_amount ?? 0),
      calculatedAmount: Number(request.calculated_amount ?? 0),
      requesterName: String(request.requester_name ?? ""),
      requesterEmail: readNullableText(request.requester_email),
      currentStepCode:
        readNullableText(request.current_step_code) as HrIncentiveRequestDetail["request"]["currentStepCode"],
      currentStepName: readNullableText(request.current_step_name),
      currentApproverName: readNullableText(request.current_approver_name),
      cancelledAt: readNullableText(request.cancelled_at),
      cancellationComment: readNullableText(request.cancellation_comment),
      createdAt: String(request.created_at ?? ""),
      updatedAt: String(request.updated_at ?? "")
    },
    approvals: asArray<Record<string, unknown>>(source.approvals).map((item) => ({
      id: Number(item.id ?? 0),
      stepCode: String(item.step_code ?? "contract_admin") as HrIncentiveRequestDetail["approvals"][number]["stepCode"],
      stepName: String(item.step_name ?? ""),
      stepOrder: Number(item.step_order ?? 0),
      approverUserId: readNullableText(item.approver_user_id),
      approverName: readNullableText(item.approver_name),
      approverEmail: readNullableText(item.approver_email),
      status: String(item.status ?? "pending") as HrIncentiveRequestDetail["approvals"][number]["status"],
      decisionBy: readNullableText(item.decision_by),
      decisionComment: readNullableText(item.decision_comment),
      decidedAt: readNullableText(item.decided_at),
      createdAt: String(item.created_at ?? "")
    })),
    history: asArray<Record<string, unknown>>(source.history).map((item) => ({
      id: Number(item.id ?? 0),
      actionType: String(item.action_type ?? ""),
      actorUserId: readNullableText(item.actor_user_id),
      actorName: readNullableText(item.actor_name),
      comment: readNullableText(item.comment),
      metadata:
        item.metadata && typeof item.metadata === "object"
          ? (item.metadata as Record<string, unknown>)
          : null,
      createdAt: String(item.created_at ?? "")
    }))
  };
}

export async function fetchHrIncentiveSetupCatalogs() {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_hr_incentive_setup_catalogs");

  if (error) {
    throw new Error(error.message || "No fue posible cargar la configuración de incentivos.");
  }

  return mapSetupCatalogs(data);
}

export async function searchHrIncentiveEligibleWorkers(search: string, limit = 12) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("search_hr_incentive_eligible_workers", {
    p_search: search.trim() || null,
    p_limit: limit
  });

  if (error) {
    throw new Error(error.message || "No fue posible buscar trabajadores elegibles.");
  }

  return asArray<Record<string, unknown>>(data).map(
    (item): HrIncentiveEligibleWorker => ({
      bukEmployeeId: String(item.buk_employee_id ?? ""),
      fullName: String(item.full_name ?? ""),
      documentNumber: String(item.document_number ?? ""),
      jobTitle: String(item.job_title ?? ""),
      contractCode:
        typeof item.contract_code === "string" && item.contract_code.trim()
          ? item.contract_code
          : null,
      areaName: typeof item.area_name === "string" && item.area_name.trim() ? item.area_name : null,
      displayLabel: String(item.display_label ?? "")
    })
  );
}

export async function fetchHrIncentiveWorkerContext(bukEmployeeId: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_hr_incentive_worker_context", {
    p_buk_employee_id: bukEmployeeId
  });

  if (error) {
    throw new Error(error.message || "No fue posible cargar el contexto del trabajador.");
  }

  return mapWorkerContext(data);
}

export async function fetchHrIncentivePreview(params: {
  bukEmployeeId: string;
  incentiveTypeId: string;
  selectedContractCode: string;
  durationHours?: number | null;
  serviceDate?: string | null;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("calculate_hr_incentive_preview", {
    p_buk_employee_id: params.bukEmployeeId,
    p_incentive_type_id: params.incentiveTypeId,
    p_selected_contract_code: params.selectedContractCode,
    p_duration_hours: params.durationHours ?? null,
    p_service_date: params.serviceDate ?? null
  });

  if (error) {
    throw new Error(error.message || "No fue posible calcular el incentivo.");
  }

  return mapPreview(data);
}

export async function createHrIncentiveRequest(input: CreateHrIncentiveRequestInput) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("create_hr_incentive_request", {
    p_buk_employee_id: input.bukEmployeeId,
    p_incentive_type_id: input.incentiveTypeId,
    p_selected_contract_code: input.selectedContractCode,
    p_selected_area_name: input.selectedAreaName,
    p_selected_area_code: input.selectedAreaCode ?? null,
    p_service_date: input.serviceDate,
    p_duration_hours: input.durationHours ?? null,
    p_motive: input.motive ?? null,
    p_description: input.description ?? null,
    p_replacement_buk_employee_id: input.replacementBukEmployeeId ?? null
  });

  if (error) {
    throw new Error(error.message || "No fue posible registrar el incentivo.");
  }

  const row = asArray<Record<string, unknown>>(data)[0];

  if (!row) {
    throw new Error("La creación del incentivo no devolvió un resultado válido.");
  }

  return {
    requestId: String(row.request_id ?? ""),
    folio: Number(row.folio ?? 0),
    status: String(row.status ?? "P") as CreateHrIncentiveRequestResult["status"],
    calculatedAmount: Number(row.calculated_amount ?? 0)
  } satisfies CreateHrIncentiveRequestResult;
}

export async function cancelHrIncentiveRequest(requestId: string, comment?: string) {
  const client = getSupabaseClient();
  const { error } = await client.rpc("cancel_hr_incentive_request", {
    p_request_id: requestId,
    p_comment: comment?.trim() || null
  });

  if (error) {
    throw new Error(error.message || "No fue posible anular el incentivo.");
  }
}

export async function fetchHrIncentiveRequests(filters: HrIncentiveRequestsFilters) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_hr_incentive_requests", {
    p_period_code: filters.periodCode?.trim() || null,
    p_status: filters.status?.trim() || "A",
    p_contract_code: filters.contractCode?.trim() || null,
    p_worker_search: filters.workerSearch?.trim() || null,
    p_type_id: filters.typeId?.trim() || null,
    p_service_date_until: filters.serviceDateUntil?.trim() || null
  });

  if (error) {
    throw new Error(error.message || "No fue posible cargar los incentivos registrados.");
  }

  return asArray<Record<string, unknown>>(data).map(mapRequestRow);
}

export async function fetchHrIncentiveApprovalQueue() {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_hr_incentive_approval_queue");

  if (error) {
    throw new Error(
      formatRpcError(error) || "No fue posible cargar la bandeja de aprobaciones de incentivos."
    );
  }

  return asArray<Record<string, unknown>>(data).map(mapApprovalQueueRow);
}

export async function fetchHrIncentiveRequestDetail(requestId: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_hr_incentive_request_detail", {
    p_request_id: requestId
  });

  if (error) {
    throw new Error(
      formatRpcError(error) || "No fue posible cargar el detalle del incentivo."
    );
  }

  return mapRequestDetail(data);
}

export async function decideHrIncentiveApproval(params: {
  approvalId: number;
  decision: "approved" | "rejected";
  comment?: string | null;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("decide_hr_incentive_request_approval", {
    p_approval_id: params.approvalId,
    p_decision: params.decision,
    p_comment: params.comment?.trim() ? params.comment.trim() : null
  });

  if (error) {
    throw new Error(formatRpcError(error) || "No fue posible registrar la decisión.");
  }

  const row = asArray<Record<string, unknown>>(data)[0];

  return {
    requestId: row ? String(row.request_id ?? "") : "",
    requestStatus: row ? (String(row.request_status ?? "") as HrIncentiveRequest["status"]) : null,
    decidedStep: row ? readNullableText(row.decided_step) : null
  };
}

export async function bulkDecideHrIncentiveApprovals(params: {
  approvalIds: number[];
  decision: "approved" | "rejected";
  comment?: string | null;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("bulk_decide_hr_incentive_request_approvals", {
    p_approval_ids: params.approvalIds,
    p_decision: params.decision,
    p_comment: params.comment?.trim() ? params.comment.trim() : null
  });

  if (error) {
    throw new Error(formatRpcError(error) || "No fue posible procesar las aprobaciones.");
  }

  return asArray<Record<string, unknown>>(data).map(
    (item): BulkHrIncentiveApprovalDecisionResult => ({
      approvalId: Number(item.approval_id ?? 0),
      requestId: readNullableText(item.request_id),
      success: Boolean(item.success),
      requestStatus: readNullableText(item.request_status) as BulkHrIncentiveApprovalDecisionResult["requestStatus"],
      error: readNullableText(item.error)
    })
  );
}

export async function addHrIncentiveAllowedJobTitle(jobTitle: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("add_hr_incentive_allowed_job_title", {
    p_job_title: jobTitle
  });

  if (error) {
    throw new Error(error.message || "No fue posible guardar el cargo elegible.");
  }

  return String(data ?? "");
}

export async function setHrIncentiveAllowedJobTitleStatus(jobTitleId: string, isActive: boolean) {
  const client = getSupabaseClient();
  const { error } = await client.rpc("set_hr_incentive_allowed_job_title_status", {
    p_job_title_id: jobTitleId,
    p_is_active: isActive
  });

  if (error) {
    throw new Error(error.message || "No fue posible actualizar el cargo elegible.");
  }
}

export async function addHrIncentiveType(input: {
  code: string;
  name: string;
  calculationBasis: "fixed" | "per_hour";
  requiresReplacement: boolean;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("add_hr_incentive_type", {
    p_code: input.code,
    p_name: input.name,
    p_calculation_basis: input.calculationBasis,
    p_requires_replacement: input.requiresReplacement
  });

  if (error) {
    throw new Error(error.message || "No fue posible guardar el tipo de incentivo.");
  }

  return String(data ?? "");
}

export async function setHrIncentiveTypeStatus(typeId: string, isActive: boolean) {
  const client = getSupabaseClient();
  const { error } = await client.rpc("set_hr_incentive_type_status", {
    p_type_id: typeId,
    p_is_active: isActive
  });

  if (error) {
    throw new Error(error.message || "No fue posible actualizar el tipo de incentivo.");
  }
}

export async function addHrIncentiveRateRule(input: {
  incentiveTypeId: string;
  amount: number;
  contractCode?: string | null;
  jobTitle?: string | null;
  unionName?: string | null;
  unionStatus?: HrIncentiveUnionStatus | null;
  priority?: number;
  validFrom?: string | null;
  validTo?: string | null;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("add_hr_incentive_rate_rule", {
    p_incentive_type_id: input.incentiveTypeId,
    p_amount: input.amount,
    p_contract_code: input.contractCode?.trim() || null,
    p_job_title: input.jobTitle?.trim() || null,
    p_union_name: input.unionName?.trim() || null,
    p_union_status: input.unionStatus?.trim() || null,
    p_priority: input.priority ?? 100,
    p_valid_from: input.validFrom?.trim() || null,
    p_valid_to: input.validTo?.trim() || null
  });

  if (error) {
    throw new Error(error.message || "No fue posible guardar la regla de monto.");
  }

  return String(data ?? "");
}

export async function setHrIncentiveRateRuleStatus(ruleId: string, isActive: boolean) {
  const client = getSupabaseClient();
  const { error } = await client.rpc("set_hr_incentive_rate_rule_status", {
    p_rule_id: ruleId,
    p_is_active: isActive
  });

  if (error) {
    throw new Error(error.message || "No fue posible actualizar la regla de monto.");
  }
}
