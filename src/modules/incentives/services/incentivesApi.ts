import {
  asArray,
  getSupabaseErrorMessage,
  getSupabaseClientOrThrow as getSupabaseClient,
  readNullableText
} from "../../../shared/lib/supabaseRpc";
import type {
  BulkHrIncentiveApprovalDecisionResult,
  CreateHrIncentiveRequestInput,
  CreateHrIncentiveRequestResult,
  HrIncentiveAnalyticsFilters,
  HrIncentiveApprovalQueuePageFilters,
  HrIncentiveEligibleWorker,
  HrIncentiveRequest,
  HrIncentiveRequestsFilters,
  HrIncentiveRequestsPageFilters,
  HrIncentiveRosterSnapshot,
  HrIncentiveUnionStatus
} from "../types";

import {
  mapAnalyticsPayload,
  mapApprovalQueueRow,
  mapPagedResult,
  mapPreview,
  mapRequestDetail,
  mapRequestRow,
  mapRosterSnapshotRow,
  mapSetupCatalogs,
  mapWorkerContext
} from "./incentivesApiMappers";
export async function fetchHrIncentiveSetupCatalogs() {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_hr_incentive_setup_catalogs");

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible cargar la configuración de incentivos.", "message")
    );
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
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible buscar trabajadores elegibles.", "message")
    );
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
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible cargar el contexto del trabajador.", "message")
    );
  }

  return mapWorkerContext(data);
}

export async function fetchHrIncentiveEligibleTypes(params: {
  bukEmployeeId: string;
  selectedContractCode: string;
  serviceDate?: string | null;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_hr_incentive_eligible_types", {
    p_buk_employee_id: params.bukEmployeeId,
    p_selected_contract_code: params.selectedContractCode,
    p_service_date: params.serviceDate ?? null
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible cargar los incentivos disponibles.", "message")
    );
  }

  return asArray<Record<string, unknown>>(data).map((item) => ({
    id: String(item.id ?? ""),
    code: String(item.code ?? ""),
    name: String(item.name ?? ""),
    calculationBasis: item.calculation_basis === "per_hour" ? "per_hour" : "fixed",
    hourRateStrategy:
      item.hour_rate_strategy === "buk_overtime" ? "buk_overtime" : "rule_amount",
    requiresReplacement: Boolean(item.requires_replacement),
    requiresRestDay: Boolean(item.requires_rest_day),
    allowsManualAmount: Boolean(item.allows_manual_amount),
    isActive: Boolean(item.is_active),
    createdAt: String(item.created_at ?? "")
  }));
}

export async function fetchHrIncentivePreview(params: {
  bukEmployeeId: string;
  incentiveTypeId: string;
  selectedContractCode: string;
  durationHours?: number | null;
  manualAmount?: number | null;
  serviceDate?: string | null;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("calculate_hr_incentive_preview", {
    p_buk_employee_id: params.bukEmployeeId,
    p_incentive_type_id: params.incentiveTypeId,
    p_selected_contract_code: params.selectedContractCode,
    p_duration_hours: params.durationHours ?? null,
    p_manual_amount: params.manualAmount ?? null,
    p_service_date: params.serviceDate ?? null
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible calcular el incentivo.", "message")
    );
  }

  return mapPreview(data);
}

export async function fetchHrIncentiveRosterSnapshot(params: {
  bukEmployeeId: string;
  serviceDate?: string | null;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("resolve_hr_roster_day_status", {
    p_buk_employee_id: params.bukEmployeeId,
    p_target_date: params.serviceDate ?? null
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(
        error,
        "No fue posible consultar el estado operativo del trabajador.",
        "message"
      )
    );
  }

  const row = asArray<Record<string, unknown>>(data)[0];

  if (!row) {
    return {
      baseStatus: "unassigned",
      effectiveStatus: "unassigned",
      exceptionType: null,
      exceptionLabel: null,
      patternName: null,
      scheduleStatus: "unassigned",
      scheduleLabel: "Sin pauta",
      isWorkingDay: false,
      isRestDay: false,
      blockedByAbsence: false
    } satisfies HrIncentiveRosterSnapshot;
  }

  return mapRosterSnapshotRow(row);
}

export async function createHrIncentiveRequest(
  input: CreateHrIncentiveRequestInput,
  idempotencyKey: string
) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("create_hr_incentive_request", {
    p_buk_employee_id: input.bukEmployeeId,
    p_incentive_type_id: input.incentiveTypeId,
    p_selected_contract_code: input.selectedContractCode,
    p_selected_area_name: input.selectedAreaName,
    p_selected_area_code: input.selectedAreaCode ?? null,
    p_service_date: input.serviceDate,
    p_duration_hours: input.durationHours ?? null,
    p_manual_amount: input.manualAmount ?? null,
    p_motive: input.motive ?? null,
    p_description: input.description ?? null,
    p_replacement_buk_employee_id: input.replacementBukEmployeeId ?? null,
    p_declared_rest_day: input.declaredRestDay,
    p_idempotency_key: idempotencyKey
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible registrar el incentivo.", "message")
    );
  }

  const row = asArray<Record<string, unknown>>(data)[0];

  if (!row) {
    throw new Error("La creación del incentivo no devolvió un resultado válido.");
  }

  return {
    requestId: String(row.request_id ?? ""),
    folio: Number(row.folio ?? 0),
    status: String(row.status ?? "P") as CreateHrIncentiveRequestResult["status"],
    calculatedAmount: Number(row.calculated_amount ?? 0),
    periodCode: String(row.period_code ?? ""),
    entryLagDays: Number(row.entry_lag_days ?? 0),
    isOutOfDeadline: Boolean(row.is_out_of_deadline),
    isContractMismatch: Boolean(row.is_contract_mismatch)
  } satisfies CreateHrIncentiveRequestResult;
}

export async function cancelHrIncentiveRequest(requestId: string, comment?: string) {
  const client = getSupabaseClient();
  const { error } = await client.rpc("cancel_hr_incentive_request", {
    p_request_id: requestId,
    p_comment: comment?.trim() || null
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible anular el incentivo.", "message")
    );
  }
}

function normalizeFilterArray(
  ...values: Array<string | string[] | null | undefined>
) {
  const normalized = values.flatMap((value) => {
    const entries = Array.isArray(value) ? value : value ? [value] : [];
    return entries
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  });

  return normalized.length > 0 ? Array.from(new Set(normalized)) : null;
}

export async function fetchHrIncentiveRequests(filters: HrIncentiveRequestsFilters) {
  const client = getSupabaseClient();
  const resolvedStatuses = normalizeFilterArray(filters.status, filters.statuses);
  const resolvedContractCodes = normalizeFilterArray(filters.contractCode, filters.contractCodes);
  const resolvedTypeIds = normalizeFilterArray(filters.typeId, filters.typeIds);
  const { data, error } = await client.rpc("get_hr_incentive_requests", {
    p_period_code: filters.periodCode?.trim() || null,
    p_statuses: resolvedStatuses,
    p_contract_codes: resolvedContractCodes,
    p_worker_search: filters.workerSearch?.trim() || null,
    p_type_ids: resolvedTypeIds,
    p_service_date_until: filters.serviceDateUntil?.trim() || null
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible cargar los incentivos registrados.", "message")
    );
  }

  return asArray<Record<string, unknown>>(data).map(mapRequestRow);
}

export async function fetchHrIncentiveRequestsPage(filters: HrIncentiveRequestsPageFilters) {
  const client = getSupabaseClient();
  const resolvedStatuses = normalizeFilterArray(filters.status, filters.statuses);
  const resolvedContractCodes = normalizeFilterArray(filters.contractCode, filters.contractCodes);
  const resolvedTypeIds = normalizeFilterArray(filters.typeId, filters.typeIds);
  const { data, error } = await client.rpc("get_hr_incentive_requests", {
    p_period_code: filters.periodCode?.trim() || null,
    p_statuses: resolvedStatuses,
    p_contract_codes: resolvedContractCodes,
    p_worker_search: filters.workerSearch?.trim() || null,
    p_type_ids: resolvedTypeIds,
    p_service_date_until: filters.serviceDateUntil?.trim() || null,
    p_limit: filters.limit ?? null,
    p_offset: filters.offset ?? 0,
    p_sort_column: filters.sortColumn ?? null,
    p_sort_direction: filters.sortDirection ?? "desc"
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible cargar los incentivos registrados.", "plain")
    );
  }

  return mapPagedResult(data, mapRequestRow);
}

export async function fetchAllHrIncentiveRequests(
  filters: HrIncentiveRequestsFilters,
  pageSize = 500
) {
  const items: HrIncentiveRequest[] = [];
  let offset = 0;

  while (true) {
    const page = await fetchHrIncentiveRequestsPage({
      ...filters,
      limit: pageSize,
      offset
    });

    items.push(...page.items);

    if (page.items.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return items;
}

export async function fetchHrIncentivesAnalytics(filters: HrIncentiveAnalyticsFilters) {
  const client = getSupabaseClient();
  const resolvedStatuses = normalizeFilterArray(filters.status, filters.statuses);
  const resolvedContractCodes = normalizeFilterArray(filters.contractCode, filters.contractCodes);
  const resolvedTypeIds = normalizeFilterArray(filters.typeId, filters.typeIds);
  const { data, error } = await client.rpc("get_hr_incentives_analytics", {
    p_period_code: filters.periodCode?.trim() || null,
    p_statuses: resolvedStatuses,
    p_contract_codes: resolvedContractCodes,
    p_type_ids: resolvedTypeIds
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(
        error,
        "No fue posible cargar el dashboard analítico de incentivos.",
        "plain"
      )
    );
  }

  return mapAnalyticsPayload(data);
}

export async function fetchHrIncentiveApprovalQueue() {
  const result = await fetchHrIncentiveApprovalQueuePage({});
  return result.items;
}

export async function fetchHrIncentiveApprovalQueuePage(
  filters: HrIncentiveApprovalQueuePageFilters
) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_hr_incentive_approval_queue", {
    p_search: filters.search?.trim() || null,
    p_limit: filters.limit ?? null,
    p_offset: filters.offset ?? 0,
    p_sort_column: filters.sortColumn ?? null,
    p_sort_direction: filters.sortDirection ?? "asc"
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(
        error,
        "No fue posible cargar la bandeja de aprobaciones de incentivos.",
        "plain"
      )
    );
  }

  return mapPagedResult(data, mapApprovalQueueRow);
}

export async function fetchHrIncentiveRequestDetail(requestId: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_hr_incentive_request_detail", {
    p_request_id: requestId
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible cargar el detalle del incentivo.", "plain")
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
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible registrar la decisión.", "plain")
    );
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
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible procesar las aprobaciones.", "plain")
    );
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
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible guardar el cargo elegible.", "message")
    );
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
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible actualizar el cargo elegible.", "message")
    );
  }
}

export async function addHrIncentiveType(input: {
  code: string;
  name: string;
  calculationBasis: "fixed" | "per_hour";
  requiresReplacement: boolean;
  allowsManualAmount: boolean;
  hourRateStrategy: "rule_amount" | "buk_overtime";
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("add_hr_incentive_type", {
    p_code: input.code,
    p_name: input.name,
    p_calculation_basis: input.calculationBasis,
    p_requires_replacement: input.requiresReplacement,
    p_allows_manual_amount: input.allowsManualAmount,
    p_hour_rate_strategy: input.hourRateStrategy
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible guardar el tipo de incentivo.", "message")
    );
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
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible actualizar el tipo de incentivo.", "message")
    );
  }
}

export async function setHrIncentiveTypeRosterRequirement(
  typeId: string,
  requiresRestDay: boolean
) {
  const client = getSupabaseClient();
  const { error } = await client.rpc("set_hr_incentive_type_roster_requirement", {
    p_type_id: typeId,
    p_requires_rest_day: requiresRestDay
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(
        error,
        "No fue posible actualizar la validación de descanso del incentivo.",
        "message"
      )
    );
  }
}

export async function setHrIncentiveTypeManualAmountOption(
  typeId: string,
  allowsManualAmount: boolean
) {
  const client = getSupabaseClient();
  const { error } = await client.rpc("set_hr_incentive_type_manual_amount_option", {
    p_type_id: typeId,
    p_allows_manual_amount: allowsManualAmount
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(
        error,
        "No fue posible actualizar la política de monto manual del incentivo.",
        "message"
      )
    );
  }
}

export async function setHrIncentiveTypeHourRateStrategy(
  typeId: string,
  hourRateStrategy: "rule_amount" | "buk_overtime"
) {
  const client = getSupabaseClient();
  const { error } = await client.rpc("set_hr_incentive_type_hour_rate_strategy", {
    p_type_id: typeId,
    p_hour_rate_strategy: hourRateStrategy
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(
        error,
        "No fue posible actualizar la estrategia horaria del incentivo.",
        "message"
      )
    );
  }
}

export async function addHrIncentiveRateRule(input: {
  incentiveTypeId: string;
  amount?: number | null;
  contractCode?: string | null;
  jobTitle?: string | null;
  unionName?: string | null;
  unionStatus?: HrIncentiveUnionStatus | null;
  priority?: number;
  validFrom?: string | null;
  validTo?: string | null;
  fallbackBaseSalary?: number | null;
  fallbackWeeklyHours?: number | null;
  overtimeMultiplier?: number | null;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("add_hr_incentive_rate_rule", {
    p_incentive_type_id: input.incentiveTypeId,
    p_amount: input.amount ?? null,
    p_contract_code: input.contractCode?.trim() || null,
    p_job_title: input.jobTitle?.trim() || null,
    p_union_name: input.unionName?.trim() || null,
    p_union_status: input.unionStatus?.trim() || null,
    p_priority: input.priority ?? 100,
    p_valid_from: input.validFrom?.trim() || null,
    p_valid_to: input.validTo?.trim() || null,
    p_fallback_base_salary: input.fallbackBaseSalary ?? null,
    p_fallback_weekly_hours: input.fallbackWeeklyHours ?? null,
    p_overtime_multiplier: input.overtimeMultiplier ?? null
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible guardar la regla de monto.", "message")
    );
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
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible actualizar la regla de monto.", "message")
    );
  }
}
