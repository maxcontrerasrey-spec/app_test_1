import {
  asArray,
  asRecord,
  getSupabaseClientOrThrow as getSupabaseClient,
  getSupabaseErrorMessage,
  readBoolean,
  readNumber,
  readNullableText,
  readText
} from "../../../shared/lib/supabaseRpc";
import type {
  AccreditationDashboardPayload,
  AccreditationDocumentStatus,
  AccreditationProfileDocument,
  AccreditationSetupCatalogs,
  AccreditationWorkerProfile,
  AccreditationWorkerRow
} from "../types";

function mapSetupOption(item: Record<string, unknown>) {
  return {
    value: readText(item.value),
    label: readText(item.label),
    description: readText(item.description)
  };
}

function mapFieldGuide(item: Record<string, unknown>) {
  return {
    key: readText(item.key),
    label: readText(item.label),
    required: readBoolean(item.required),
    source: readText(item.source),
    target: readText(item.target),
    description: readText(item.description)
  };
}

function mapSetupCatalogs(payload: unknown): AccreditationSetupCatalogs {
  const source = asRecord(payload);
  const metadata = asRecord(source.metadata);
  const fieldGuides = asRecord(metadata.field_guides);

  return {
    sites: asArray<Record<string, unknown>>(source.sites).map((item) => ({
      id: readText(item.id),
      code: readText(item.code),
      name: readText(item.name),
      siteType: readText(item.site_type),
      contractCode: readNullableText(item.contract_code),
      areaCode: readNullableText(item.area_code),
      description: readNullableText(item.description),
      isActive: readBoolean(item.is_active)
    })),
    requirements: asArray<Record<string, unknown>>(source.requirements).map((item) => ({
      id: readText(item.id),
      code: readText(item.code),
      name: readText(item.name),
      category: readText(item.category),
      description: readNullableText(item.description),
      isMandatory: readBoolean(item.is_mandatory),
      requiresExpiryDate: readBoolean(item.requires_expiry_date),
      alertDaysBeforeExpiry: readNumber(item.alert_days_before_expiry),
      blocksAccreditation: readBoolean(item.blocks_accreditation),
      validityDays:
        item.validity_days === null || item.validity_days === undefined
          ? null
          : readNumber(item.validity_days),
      isActive: readBoolean(item.is_active)
    })),
    matrixRules: asArray<Record<string, unknown>>(source.matrix_rules).map((item) => ({
      id: readText(item.id),
      siteId: readText(item.site_id),
      siteName: readText(item.site_name),
      requirementId: readText(item.requirement_id),
      requirementName: readText(item.requirement_name),
      jobTitle: readNullableText(item.job_title),
      sortOrder: readNumber(item.sort_order),
      notes: readNullableText(item.notes),
      isActive: readBoolean(item.is_active)
    })),
    bukJobTitles: asArray<Record<string, unknown>>(source.buk_job_titles).map((item) => ({
      value: readText(item.value),
      label: readText(item.label)
    })),
    contractOptions: asArray<Record<string, unknown>>(source.contract_options).map((item) => ({
      value: readText(item.value),
      label: readText(item.label),
      areaCode: readNullableText(item.area_code)
    })),
    areaOptions: asArray<Record<string, unknown>>(source.area_options).map((item) => ({
      value: readText(item.value),
      label: readText(item.label)
    })),
    metadata: {
      siteTypes: asArray<Record<string, unknown>>(metadata.site_types).map(mapSetupOption),
      requirementCategories: asArray<Record<string, unknown>>(metadata.requirement_categories).map(mapSetupOption),
      fieldGuides: {
        site: asArray<Record<string, unknown>>(fieldGuides.site).map(mapFieldGuide),
        requirement: asArray<Record<string, unknown>>(fieldGuides.requirement).map(mapFieldGuide),
        matrix: asArray<Record<string, unknown>>(fieldGuides.matrix).map(mapFieldGuide)
      }
    }
  };
}

function mapDashboard(payload: unknown): AccreditationDashboardPayload {
  const source = asRecord(payload);
  const summary = asRecord(source.summary);

  return {
    summary: {
      totalWorkers: readNumber(summary.total_workers),
      approved: readNumber(summary.approved),
      expiringSoon: readNumber(summary.expiring_soon),
      pending: readNumber(summary.pending),
      expired: readNumber(summary.expired),
      expiringIn7Days: readNumber(summary.expiring_in_7_days),
      expiringIn15Days: readNumber(summary.expiring_in_15_days),
      expiringIn30Days: readNumber(summary.expiring_in_30_days)
    },
    bySite: asArray<Record<string, unknown>>(source.by_site).map((item) => ({
      siteId: readText(item.site_id),
      siteName: readText(item.site_name),
      totalWorkers: readNumber(item.total_workers),
      approved: readNumber(item.approved),
      pending: readNumber(item.pending),
      expired: readNumber(item.expired),
      expiringSoon: readNumber(item.expiring_soon)
    })),
    expiringWorkers: asArray<Record<string, unknown>>(source.expiring_workers).map((item) => ({
      workerAccreditationId: readText(item.worker_accreditation_id),
      bukEmployeeId: readText(item.buk_employee_id),
      fullName: readText(item.full_name),
      jobTitle: readNullableText(item.job_title),
      siteName: readText(item.site_name),
      status: readText(item.status) as AccreditationWorkerRow["accreditationStatus"],
      accreditationExpiryDate: readNullableText(item.accreditation_expiry_date)
    }))
  };
}

function mapWorkerRow(row: Record<string, unknown>): AccreditationWorkerRow {
  return {
    workerAccreditationId: readNullableText(row.worker_accreditation_id),
    bukEmployeeId: readText(row.buk_employee_id),
    fullName: readText(row.full_name),
    documentNumber: readNullableText(row.document_number),
    documentType: readText(row.document_type),
    jobTitle: readNullableText(row.job_title),
    contractCode: readNullableText(row.contract_code),
    areaName: readNullableText(row.area_name),
    siteId: readNullableText(row.site_id),
    siteName: readNullableText(row.site_name),
    accreditationStatus: readText(row.accreditation_status) as AccreditationWorkerRow["accreditationStatus"],
    accreditationExpiryDate: readNullableText(row.accreditation_expiry_date),
    requiredDocumentsTotal: readNumber(row.required_documents_total),
    approvedDocumentsTotal: readNumber(row.approved_documents_total),
    pendingDocumentsTotal: readNumber(row.pending_documents_total),
    expiredDocumentsTotal: readNumber(row.expired_documents_total),
    rosterPatternName: readNullableText(row.roster_pattern_name),
    rosterStartDate: readNullableText(row.roster_start_date)
  };
}

function mapProfileDocument(row: Record<string, unknown>): AccreditationProfileDocument {
  return {
    documentTrackingId: readNullableText(row.document_tracking_id),
    requirementId: readText(row.requirement_id),
    requirementCode: readText(row.requirement_code),
    requirementName: readText(row.requirement_name),
    category: readText(row.category),
    description: readNullableText(row.description),
    isMandatory: readBoolean(row.is_mandatory),
    requiresExpiryDate: readBoolean(row.requires_expiry_date),
    alertDaysBeforeExpiry: readNumber(row.alert_days_before_expiry),
    blocksAccreditation: readBoolean(row.blocks_accreditation),
    status: readText(row.status) as AccreditationDocumentStatus,
    issueDate: readNullableText(row.issue_date),
    expiryDate: readNullableText(row.expiry_date),
    bukDocumentId: readNullableText(row.buk_document_id),
    bukDocumentName: readNullableText(row.buk_document_name),
    bukDocumentUrl: readNullableText(row.buk_document_url),
    reviewedAt: readNullableText(row.reviewed_at),
    reviewerNotes: readNullableText(row.reviewer_notes),
    metadata: asRecord(row.metadata)
  };
}

function mapWorkerProfile(payload: unknown): AccreditationWorkerProfile {
  const source = asRecord(payload);
  const worker = asRecord(source.worker);
  const rosterContext = source.roster_context ? asRecord(source.roster_context) : null;

  return {
    worker: {
      workerAccreditationId: readText(worker.worker_accreditation_id),
      bukEmployeeId: readText(worker.buk_employee_id),
      fullName: readText(worker.full_name),
      documentNumber: readNullableText(worker.document_number),
      documentType: readText(worker.document_type),
      jobTitle: readNullableText(worker.job_title),
      contractCode: readNullableText(worker.contract_code),
      areaName: readNullableText(worker.area_name),
      siteId: readText(worker.site_id),
      siteName: readText(worker.site_name),
      siteCode: readText(worker.site_code),
      accreditationStatus: readText(worker.accreditation_status) as AccreditationWorkerProfile["worker"]["accreditationStatus"],
      accreditationExpiryDate: readNullableText(worker.accreditation_expiry_date),
      requiredDocumentsTotal: readNumber(worker.required_documents_total),
      approvedDocumentsTotal: readNumber(worker.approved_documents_total),
      pendingDocumentsTotal: readNumber(worker.pending_documents_total),
      expiredDocumentsTotal: readNumber(worker.expired_documents_total)
    },
    rosterContext: rosterContext
      ? {
          patternName: readText(rosterContext.pattern_name),
          patternCode: readText(rosterContext.pattern_code),
          startDate: readText(rosterContext.start_date),
          endDate: readNullableText(rosterContext.end_date)
        }
      : null,
    recentRosterExceptions: asArray<Record<string, unknown>>(source.recent_roster_exceptions).map(
      (item) => ({
        exceptionDate: readText(item.exception_date),
        exceptionType: readText(item.exception_type),
        notes: readNullableText(item.notes),
        isActive: readBoolean(item.is_active)
      })
    ),
    documents: asArray<Record<string, unknown>>(source.documents).map(mapProfileDocument),
    auditLog: asArray<Record<string, unknown>>(source.audit_log).map((item) => ({
      id: readText(item.id),
      eventType: readText(item.event_type),
      eventSummary: readText(item.event_summary),
      payload: asRecord(item.payload),
      actorId: readNullableText(item.actor_id),
      actorName: readNullableText(item.actor_name),
      createdAt: readText(item.created_at)
    }))
  };
}

export async function fetchAccreditationSetupCatalogs() {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_accreditation_setup_catalogs");
  if (error) {
    throw new Error(
      getSupabaseErrorMessage(
        error,
        "No fue posible cargar la configuracion de acreditacion.",
        "message"
      )
    );
  }

  return mapSetupCatalogs(data);
}

export async function fetchAccreditationDashboard(filters: {
  siteId?: string | null;
  jobTitle?: string | null;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_accreditation_dashboard", {
    p_site_id: filters.siteId || null,
    p_job_title: filters.jobTitle?.trim() ? filters.jobTitle.trim() : null
  });
  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible cargar el dashboard de acreditacion.", "message")
    );
  }

  return mapDashboard(data);
}

export async function searchAccreditationWorkers(filters: {
  search?: string;
  siteId?: string | null;
  status?: string | null;
  limit?: number;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("search_accreditation_workers", {
    p_search: filters.search?.trim() || null,
    p_site_id: filters.siteId || null,
    p_status: filters.status?.trim() || null,
    p_limit: filters.limit ?? 50
  });
  if (error) {
    throw new Error(
      getSupabaseErrorMessage(
        error,
        "No fue posible buscar trabajadores para acreditacion.",
        "message"
      )
    );
  }

  return asArray<Record<string, unknown>>(data).map(mapWorkerRow);
}

export async function fetchWorkerAccreditationProfile(bukEmployeeId: string, siteId: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_worker_accreditation_profile", {
    p_buk_employee_id: bukEmployeeId,
    p_site_id: siteId
  });
  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible cargar el perfil de acreditacion.", "message")
    );
  }

  return mapWorkerProfile(data);
}

export async function saveAccreditationSite(input: {
  siteId?: string | null;
  code: string;
  name: string;
  siteType?: string;
  contractCode?: string | null;
  areaCode?: string | null;
  description?: string | null;
  isActive?: boolean;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("upsert_accreditation_site", {
    p_site_id: input.siteId ?? null,
    p_code: input.code,
    p_name: input.name,
    p_site_type: input.siteType ?? "contract",
    p_contract_code: input.contractCode ?? null,
    p_area_code: input.areaCode ?? null,
    p_description: input.description ?? null,
    p_is_active: input.isActive ?? true
  });
  if (error) {
    throw new Error(
      getSupabaseErrorMessage(
        error,
        "No fue posible guardar la faena de acreditacion.",
        "message"
      )
    );
  }

  return String(data ?? "");
}

export async function saveAccreditationRequirement(input: {
  requirementId?: string | null;
  code: string;
  name: string;
  category?: string;
  description?: string | null;
  isMandatory?: boolean;
  requiresExpiryDate?: boolean;
  alertDaysBeforeExpiry?: number;
  blocksAccreditation?: boolean;
  validityDays?: number | null;
  isActive?: boolean;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("upsert_accreditation_requirement", {
    p_requirement_id: input.requirementId ?? null,
    p_code: input.code,
    p_name: input.name,
    p_category: input.category ?? "general",
    p_description: input.description ?? null,
    p_is_mandatory: input.isMandatory ?? true,
    p_requires_expiry_date: input.requiresExpiryDate ?? false,
    p_alert_days_before_expiry: input.alertDaysBeforeExpiry ?? 30,
    p_blocks_accreditation: input.blocksAccreditation ?? true,
    p_validity_days: input.validityDays ?? null,
    p_is_active: input.isActive ?? true
  });
  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible guardar el requisito.", "message")
    );
  }

  return String(data ?? "");
}

export async function saveAccreditationMatrixRule(input: {
  ruleId?: string | null;
  siteId: string;
  requirementId: string;
  jobTitle?: string | null;
  sortOrder?: number;
  notes?: string | null;
  isActive?: boolean;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("upsert_accreditation_matrix_rule", {
    p_rule_id: input.ruleId ?? null,
    p_site_id: input.siteId,
    p_requirement_id: input.requirementId,
    p_job_title: input.jobTitle ?? null,
    p_sort_order: input.sortOrder ?? 0,
    p_notes: input.notes ?? null,
    p_is_active: input.isActive ?? true
  });
  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible guardar la regla de matriz.", "message")
    );
  }

  return String(data ?? "");
}

export async function saveWorkerAccreditationDocument(input: {
  bukEmployeeId: string;
  siteId: string;
  requirementId: string;
  status: AccreditationDocumentStatus;
  issueDate?: string | null;
  expiryDate?: string | null;
  bukDocumentId?: string | null;
  bukDocumentName?: string | null;
  bukDocumentUrl?: string | null;
  reviewerNotes?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("upsert_worker_accreditation_document", {
    p_buk_employee_id: input.bukEmployeeId,
    p_site_id: input.siteId,
    p_requirement_id: input.requirementId,
    p_status: input.status,
    p_issue_date: input.issueDate ?? null,
    p_expiry_date: input.expiryDate ?? null,
    p_buk_document_id: input.bukDocumentId ?? null,
    p_buk_document_name: input.bukDocumentName ?? null,
    p_buk_document_url: input.bukDocumentUrl ?? null,
    p_reviewer_notes: input.reviewerNotes ?? null,
    p_metadata: input.metadata ?? {}
  });
  if (error) {
    throw new Error(
      getSupabaseErrorMessage(
        error,
        "No fue posible guardar el documento de acreditacion.",
        "message"
      )
    );
  }

  return String(data ?? "");
}

export async function uploadAccreditationDocumentToBuk(input: {
  employeeId: string;
  documentName: string;
  file: File;
}) {
  const client = getSupabaseClient();
  const formData = new FormData();
  formData.append("employeeId", input.employeeId);
  formData.append("documentName", input.documentName);
  formData.append("file", input.file);

  const { data, error } = await client.functions.invoke("upload-buk-accreditation-document", {
    body: formData
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible subir el archivo a BUK.", "message")
    );
  }

  const payload = asRecord(data);
  if (payload.error) {
    throw new Error(readText(payload.error) || "No fue posible subir el archivo a BUK.");
  }

  return {
    bukDocumentId: readNullableText(payload.bukDocumentId),
    bukDocumentUrl: readNullableText(payload.bukDocumentUrl),
    documentName: readText(payload.documentName),
    payload: asRecord(payload.payload)
  };
}
