import { supabase } from "../../../shared/lib/supabase";
import type {
  CreateHrIncentiveRequestInput,
  CreateHrIncentiveRequestResult,
  HrIncentiveEligibleWorker,
  HrIncentivePreview,
  HrIncentiveRequest,
  HrIncentiveRequestsFilters,
  HrIncentiveSetupCatalogs,
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

function mapSetupCatalogs(payload: unknown): HrIncentiveSetupCatalogs {
  const source = (payload ?? {}) as Record<string, unknown>;

  return {
    bukJobTitles: asArray<unknown>(source.buk_job_titles)
      .map((item) => String(item ?? "").trim())
      .filter(Boolean),
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
