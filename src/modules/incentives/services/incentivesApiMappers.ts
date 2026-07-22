import { asArray, readNullableText } from "../../../shared/lib/supabaseRpc";
import type {
  HrIncentiveAnalyticsPayload,
  HrIncentiveApprovalQueueItem,
  HrIncentiveEligibleWorker,
  HrIncentiveFilterOption,
  HrIncentivePagedResult,
  HrIncentivePreview,
  HrIncentiveRequest,
  HrIncentiveRequestDetail,
  HrIncentiveRosterSnapshot,
  HrIncentiveSetupCatalogs,
  HrIncentiveUnionStatus,
  HrIncentiveWorkerContext
} from "../types";

function mapUnionStatus(value: unknown): HrIncentiveUnionStatus {
  return value === "unionized" || value === "non_unionized" ? value : "unknown";
}

function readNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function requireTextField(source: Record<string, unknown>, fieldName: string) {
  const value = source[fieldName];

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  throw new Error(`Contrato RPC inválido: falta ${fieldName}.`);
}

function requireNumberField(source: Record<string, unknown>, fieldName: string) {
  const value = source[fieldName];
  const numericValue = typeof value === "number" ? value : Number(value);

  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  throw new Error(`Contrato RPC inválido: falta ${fieldName}.`);
}

function mapFilterOptions(source: unknown): HrIncentiveFilterOption[] {
  return asArray<Record<string, unknown>>(source).map((item) => ({
    value: String(item.value ?? ""),
    label: String(item.label ?? "")
  }));
}

export function mapPagedResult<T>(
  rows: Record<string, unknown>[] | null,
  mapper: (row: Record<string, unknown>) => T
): HrIncentivePagedResult<T> {
  const items = asArray<Record<string, unknown>>(rows).map(mapper);
  const firstRow = rows?.[0];

  return {
    items,
    totalCount: firstRow ? Number(firstRow.total_count ?? 0) : 0
  };
}

export function mapSetupCatalogs(payload: unknown): HrIncentiveSetupCatalogs {
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
    contractOptions: mapFilterOptions(source.contract_options),
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
      hourRateStrategy:
        item.hour_rate_strategy === "buk_overtime" ? "buk_overtime" : "rule_amount",
      requiresReplacement: Boolean(item.requires_replacement),
      requiresRestDay: Boolean(item.requires_rest_day),
      allowsManualAmount: Boolean(item.allows_manual_amount),
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
      fallbackBaseSalary:
        item.fallback_base_salary === null || item.fallback_base_salary === undefined
          ? null
          : Number(item.fallback_base_salary),
      fallbackWeeklyHours:
        item.fallback_weekly_hours === null || item.fallback_weekly_hours === undefined
          ? null
          : Number(item.fallback_weekly_hours),
      overtimeMultiplier: Number(item.overtime_multiplier ?? 1.5),
      priority: Number(item.priority ?? 100),
      validFrom: typeof item.valid_from === "string" ? item.valid_from : null,
      validTo: typeof item.valid_to === "string" ? item.valid_to : null,
      isActive: Boolean(item.is_active),
      createdAt: String(item.created_at ?? "")
    }))
  };
}

export function mapWorkerContext(payload: unknown): HrIncentiveWorkerContext {
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

export function mapPreview(payload: unknown): HrIncentivePreview {
  const source = (payload ?? {}) as Record<string, unknown>;
  const worker = (source.worker ?? {}) as Record<string, unknown>;
  const rule = (source.rule ?? {}) as Record<string, unknown>;
  const rosterValidation = (source.roster_validation ?? {}) as Record<string, unknown>;

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
      hourRateStrategy:
        rule.hour_rate_strategy === "buk_overtime" ? "buk_overtime" : "rule_amount",
      requiresReplacement: Boolean(rule.requires_replacement),
      requiresRestDay: Boolean(rule.requires_rest_day),
      allowsManualAmount: Boolean(rule.allows_manual_amount),
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
    amountSource: source.amount_source === "manual" ? "manual" : "rule",
    manualAmount:
      source.manual_amount === null || source.manual_amount === undefined
        ? null
        : Number(source.manual_amount),
    rateSource:
      source.rate_source === "buk_payload" || source.rate_source === "rule_fallback_salary"
        ? source.rate_source
        : "rule_amount",
    rateBaseSalary:
      source.rate_base_salary === null || source.rate_base_salary === undefined
        ? null
        : Number(source.rate_base_salary),
    rateWeeklyHours:
      source.rate_weekly_hours === null || source.rate_weekly_hours === undefined
        ? null
        : Number(source.rate_weekly_hours),
    rateOvertimeMultiplier:
      source.rate_overtime_multiplier === null || source.rate_overtime_multiplier === undefined
        ? null
        : Number(source.rate_overtime_multiplier),
    calculatedAmount: Number(source.calculated_amount ?? 0),
    rosterValidation: {
      requiresRestDay: Boolean(rosterValidation.requires_rest_day),
      baseStatus:
        rosterValidation.base_status === "working" ||
        rosterValidation.base_status === "resting" ||
        rosterValidation.base_status === "unassigned"
          ? rosterValidation.base_status
          : null,
      effectiveStatus: readNullableText(rosterValidation.effective_status),
      exceptionType: readNullableText(rosterValidation.exception_type),
      exceptionLabel: readNullableText(rosterValidation.exception_label),
      patternName: readNullableText(rosterValidation.pattern_name),
      scheduleStatus:
        readNullableText(rosterValidation.schedule_status) ??
        readNullableText(rosterValidation.effective_status),
      scheduleLabel:
        readNullableText(rosterValidation.schedule_label) ??
        readNullableText(rosterValidation.exception_label),
      isRestDay:
        rosterValidation.is_rest_day === null || rosterValidation.is_rest_day === undefined
          ? null
          : Boolean(rosterValidation.is_rest_day),
      blockedByAbsence: Boolean(rosterValidation.blocked_by_absence),
      blockedByExistingRestDayIncentive: Boolean(
        rosterValidation.blocked_by_existing_rest_day_incentive
      ),
      existingRestDayRequestId: readNullableText(rosterValidation.existing_rest_day_request_id),
      existingRestDayFolio:
        rosterValidation.existing_rest_day_folio === null ||
        rosterValidation.existing_rest_day_folio === undefined
          ? null
          : Number(rosterValidation.existing_rest_day_folio),
      existingRestDayContractCode: readNullableText(
        rosterValidation.existing_rest_day_contract_code
      ),
      existingRestDayContractName: readNullableText(
        rosterValidation.existing_rest_day_contract_name
      ),
      existingRestDayIncentiveTypeName: readNullableText(
        rosterValidation.existing_rest_day_incentive_type_name
      ),
      blockReason: readNullableText(rosterValidation.block_reason),
      matchedDate:
        readNullableText(rosterValidation.matched_date) ?? readNullableText(source.service_date)
    }
  };
}

export function mapRosterSnapshotRow(row: Record<string, unknown>): HrIncentiveRosterSnapshot {
  const baseStatus =
    row.base_status === "working" || row.base_status === "resting" || row.base_status === "unassigned"
      ? row.base_status
      : null;
  const effectiveStatus = readNullableText(row.effective_status) ?? baseStatus;
  const exceptionLabel = readNullableText(row.exception_label);

  return {
    baseStatus,
    effectiveStatus,
    exceptionType: readNullableText(row.exception_type),
    exceptionLabel,
    patternName: readNullableText(row.pattern_name),
    scheduleStatus: effectiveStatus,
    scheduleLabel:
      exceptionLabel ??
      (effectiveStatus === "resting"
        ? "Descanso"
        : effectiveStatus === "working"
          ? "En turno"
          : effectiveStatus === "extra_shift"
            ? "Turno adicional"
            : effectiveStatus === "training"
              ? "Capacitación"
              : effectiveStatus === "vacation"
                ? "Vacaciones"
                : effectiveStatus === "medical_leave"
                  ? "Licencia médica"
                  : effectiveStatus === "absent"
                    ? "Ausencia"
                    : effectiveStatus === "administrative_leave"
                      ? "Permiso administrativo"
                      : effectiveStatus === "union_leave"
                        ? "Permiso sindical"
                        : effectiveStatus === "unassigned"
                          ? "Sin pauta"
                          : null),
    isWorkingDay: Boolean(row.is_working_day),
    isRestDay: Boolean(row.is_rest_day),
    blockedByAbsence: effectiveStatus === "vacation" || effectiveStatus === "medical_leave"
  };
}

export function mapRequestRow(row: Record<string, unknown>): HrIncentiveRequest {
  return {
    id: String(row.id ?? ""),
    folio: Number(row.folio ?? 0),
    employeeBukEmployeeId: String(row.employee_buk_employee_id ?? ""),
    employeeDocumentType: String(row.employee_document_type ?? "rut"),
    employeeFullName: String(row.employee_full_name ?? ""),
    employeeDocumentNumber: String(row.employee_document_number ?? ""),
    employeeJobTitle: String(row.employee_job_title ?? ""),
    employeeUnionName: readNullableText(row.employee_union_name),
    employeeUnionStatus:
      typeof row.employee_union_status === "string" && row.employee_union_status.trim()
        ? mapUnionStatus(row.employee_union_status)
        : "unknown",
    employeeUnionJoinedAt: readNullableText(row.employee_union_joined_at),
    primaryContractCode: readNullableText(row.primary_contract_code),
    primaryAreaName: readNullableText(row.primary_area_name),
    selectedAreaCode: readNullableText(row.selected_area_code),
    incentiveTypeId: String(row.incentive_type_id ?? ""),
    requiresReplacement: Boolean(row.requires_replacement),
    replacementBukEmployeeId: readNullableText(row.replacement_buk_employee_id),
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
    calculationBasis: row.calculation_basis === "per_hour" ? "per_hour" : "fixed",
    rateRuleId: readNullableText(row.rate_rule_id),
    rateRuleAmount: Number(row.rate_rule_amount ?? 0),
    amountSource: row.amount_source === "manual" ? "manual" : "rule",
    manualAmount:
      row.manual_amount === null || row.manual_amount === undefined
        ? null
        : Number(row.manual_amount),
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
    createdBy: String(row.created_by ?? ""),
    requesterName: String(row.requester_name ?? ""),
    requesterEmail: readNullableText(row.requester_email),
    status: String(row.status ?? "P") as HrIncentiveRequest["status"],
    currentFlowUser:
      typeof row.current_flow_user === "string" && row.current_flow_user.trim()
        ? row.current_flow_user
        : null,
    cancelledAt: readNullableText(row.cancelled_at),
    cancelledBy: readNullableText(row.cancelled_by),
    cancellationComment:
      typeof row.cancellation_comment === "string" && row.cancellation_comment.trim()
        ? row.cancellation_comment
        : null,
    updatedAt: String(row.updated_at ?? ""),
    entryLagDays: Number(row.entry_lag_days ?? 0),
    isOutOfDeadline: Boolean(row.is_out_of_deadline),
    isContractMismatch: Boolean(row.is_contract_mismatch),
    declaredRestDay:
      row.declared_rest_day === null || row.declared_rest_day === undefined
        ? null
        : Boolean(row.declared_rest_day)
  };
}

export function mapAnalyticsPayload(payload: unknown): HrIncentiveAnalyticsPayload {
  const source = (payload ?? {}) as Record<string, unknown>;
  const summaryCards = (source.summary_cards ?? {}) as Record<string, unknown>;
  const filterOptions = (source.filter_options ?? {}) as Record<string, unknown>;
  const rawTypeOptions = filterOptions.types ?? filterOptions.incentive_types;

  return {
    summaryCards: {
      totalAmount: readNumber(summaryCards.total_amount),
      requestCount: Number(summaryCards.request_count ?? 0),
      approvedCount: Number(summaryCards.approved_count ?? 0),
      rejectedCount: Number(summaryCards.rejected_count ?? 0),
      approvalRate: readNumber(summaryCards.approval_rate),
      rejectionRate: readNumber(summaryCards.rejection_rate),
      declaredRestDayCount: Number(summaryCards.declared_rest_day_count ?? 0)
    },
    totalAmountByPeriod: asArray<Record<string, unknown>>(source.total_amount_by_period).map((item) => ({
      periodCode: String(item.period_code ?? ""),
      totalAmount: readNumber(item.total_amount),
      requestCount: Number(item.request_count ?? 0),
      approvedAmount: readNumber(item.approved_amount),
      rejectedAmount: readNumber(item.rejected_amount)
    })),
    countByIncentiveType: asArray<Record<string, unknown>>(source.count_by_incentive_type).map((item) => ({
      incentiveTypeId: String(item.incentive_type_id ?? ""),
      incentiveTypeName: String(item.incentive_type_name ?? ""),
      requestCount: Number(item.request_count ?? 0),
      totalAmount: readNumber(item.total_amount)
    })),
    amountByContract: asArray<Record<string, unknown>>(source.amount_by_contract).map((item) => ({
      contractCode: String(item.contract_code ?? ""),
      areaName: readNullableText(item.area_name),
      totalAmount: Number(item.total_amount ?? 0)
    })),
    amountByWorker: asArray<Record<string, unknown>>(source.amount_by_worker).map((item) => ({
      workerName: String(item.worker_name ?? ""),
      totalAmount: Number(item.total_amount ?? 0),
      contracts: asArray<Record<string, unknown>>(item.contracts).map((c) => ({
        contractCode: String(c.contract_code ?? ""),
        contractLabel: readNullableText(c.contract_label) || String(c.contract_code ?? ""),
        amount: Number(c.amount ?? 0)
      }))
    })),
    filterOptions: {
      contracts: mapFilterOptions(filterOptions.contracts),
      incentiveTypes: mapFilterOptions(rawTypeOptions),
      statuses: mapFilterOptions(filterOptions.statuses)
    }
  };
}

export function mapApprovalQueueRow(row: Record<string, unknown>): HrIncentiveApprovalQueueItem {
  return {
    approvalId: requireNumberField(row, "approval_id"),
    requestId: requireTextField(row, "request_id"),
    folio: requireNumberField(row, "folio"),
    stepCode: requireTextField(row, "step_code") as HrIncentiveApprovalQueueItem["stepCode"],
    stepName: String(row.step_name ?? ""),
    stepOrder: Number(row.step_order ?? 0),
    approvalStatus: requireTextField(row, "approval_status") as HrIncentiveApprovalQueueItem["approvalStatus"],
    approverUserId: readNullableText(row.approver_user_id),
    approverName: String(row.approver_name ?? ""),
    employeeFullName: requireTextField(row, "employee_full_name"),
    employeeDocumentNumber: String(row.employee_document_number ?? ""),
    employeeJobTitle: String(row.employee_job_title ?? ""),
    employeeUnionName: readNullableText(row.employee_union_name),
    selectedContractCode: requireTextField(row, "selected_contract_code"),
    selectedAreaName: String(row.selected_area_name ?? ""),
    incentiveTypeName: requireTextField(row, "incentive_type_name"),
    serviceDate: requireTextField(row, "service_date"),
    calculatedAmount: requireNumberField(row, "calculated_amount"),
    periodCode: String(row.period_code ?? ""),
    entryLagDays: Number(row.entry_lag_days ?? 0),
    isOutOfDeadline: Boolean(row.is_out_of_deadline),
    isContractMismatch: Boolean(row.is_contract_mismatch),
    requesterName: String(row.requester_name ?? ""),
    createdAt: requireTextField(row, "created_at")
  };
}

export function mapRequestDetail(payload: unknown): HrIncentiveRequestDetail {
  const source = (payload ?? {}) as Record<string, unknown>;
  const request = (source.request ?? {}) as Record<string, unknown>;

  return {
    request: {
      id: requireTextField(request, "id"),
      folio: requireNumberField(request, "folio"),
      status: requireTextField(request, "status") as HrIncentiveRequestDetail["request"]["status"],
      employeeBukEmployeeId: String(request.employee_buk_employee_id ?? ""),
      employeeDocumentType: String(request.employee_document_type ?? "rut"),
      employeeDocumentNumber: String(request.employee_document_number ?? ""),
      employeeFullName: requireTextField(request, "employee_full_name"),
      employeeJobTitle: String(request.employee_job_title ?? ""),
      employeeUnionName: readNullableText(request.employee_union_name),
      employeeUnionStatus: mapUnionStatus(request.employee_union_status),
      employeeUnionJoinedAt: readNullableText(request.employee_union_joined_at),
      primaryContractCode: readNullableText(request.primary_contract_code),
      primaryAreaName: readNullableText(request.primary_area_name),
      selectedContractCode: requireTextField(request, "selected_contract_code"),
      selectedAreaName: String(request.selected_area_name ?? ""),
      selectedAreaCode: readNullableText(request.selected_area_code),
      incentiveTypeName: requireTextField(request, "incentive_type_name"),
      requiresReplacement: Boolean(request.requires_replacement),
      replacementBukEmployeeId: readNullableText(request.replacement_buk_employee_id),
      replacementDocumentNumber: readNullableText(request.replacement_document_number),
      replacementFullName: readNullableText(request.replacement_full_name),
      motive: readNullableText(request.motive),
      description: readNullableText(request.description),
      serviceDate: requireTextField(request, "service_date"),
      durationHours:
        request.duration_hours === null || request.duration_hours === undefined
          ? null
          : Number(request.duration_hours),
      periodCode: String(request.period_code ?? ""),
      entryLagDays: Number(request.entry_lag_days ?? 0),
      isOutOfDeadline: Boolean(request.is_out_of_deadline),
      isContractMismatch: Boolean(request.is_contract_mismatch),
      calculationBasis:
        request.calculation_basis === "per_hour" ? "per_hour" : "fixed",
      rateRuleAmount: Number(request.rate_rule_amount ?? 0),
      amountSource: request.amount_source === "manual" ? "manual" : "rule",
      manualAmount:
        request.manual_amount === null || request.manual_amount === undefined
          ? null
          : Number(request.manual_amount),
      calculatedAmount: requireNumberField(request, "calculated_amount"),
      requesterName: String(request.requester_name ?? ""),
      requesterEmail: readNullableText(request.requester_email),
      currentStepCode:
        readNullableText(request.current_step_code) as HrIncentiveRequestDetail["request"]["currentStepCode"],
      currentStepName: readNullableText(request.current_step_name),
      currentApproverName: readNullableText(request.current_approver_name),
      cancelledAt: readNullableText(request.cancelled_at),
      cancellationComment: readNullableText(request.cancellation_comment),
      createdAt: requireTextField(request, "created_at"),
      updatedAt: requireTextField(request, "updated_at"),
      declaredRestDay:
        request.declared_rest_day === null || request.declared_rest_day === undefined
          ? null
          : Boolean(request.declared_rest_day)
    },
    approvals: asArray<Record<string, unknown>>(source.approvals).map((item) => ({
      id: requireNumberField(item, "id"),
      stepCode: requireTextField(item, "step_code") as HrIncentiveRequestDetail["approvals"][number]["stepCode"],
      stepName: String(item.step_name ?? ""),
      stepOrder: Number(item.step_order ?? 0),
      approverUserId: readNullableText(item.approver_user_id),
      approverName: readNullableText(item.approver_name),
      approverEmail: readNullableText(item.approver_email),
      status: requireTextField(item, "status") as HrIncentiveRequestDetail["approvals"][number]["status"],
      decisionBy: readNullableText(item.decision_by),
      decisionComment: readNullableText(item.decision_comment),
      decidedAt: readNullableText(item.decided_at),
      createdAt: requireTextField(item, "created_at")
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
