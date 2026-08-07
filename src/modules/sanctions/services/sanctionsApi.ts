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
  CreateHrSanctionRequestInput,
  CreateHrSanctionRequestResult,
  HrSanctionCause,
  HrSanctionDocumentType,
  HrSanctionMeasure,
  HrSanctionRequestsKpis,
  HrSanctionRequestsPage,
  HrSanctionRequestsPageFilters,
  HrSanctionRequestRow,
  HrSanctionSetupCatalogs,
  HrSanctionStatus,
  HrSanctionWorker
} from "../types";

function mapCause(row: Record<string, unknown>): HrSanctionCause {
  return {
    id: readText(row.id),
    code: readText(row.code),
    name: readText(row.name),
    description: readText(row.description),
    regulatoryBasis: readText(row.regulatory_basis),
    templateTitle: readNullableText(row.template_title)
  };
}

function mapMeasure(row: Record<string, unknown>): HrSanctionMeasure {
  return {
    id: readText(row.id),
    code: readText(row.code),
    name: readText(row.name),
    requiresDtFiling: readBoolean(row.requires_dt_filing),
    requiresCertifiedMailOnRefusal: readBoolean(row.requires_certified_mail_on_refusal)
  };
}

function mapRequestRow(row: Record<string, unknown>): HrSanctionRequestRow {
  return {
    id: readText(row.id),
    folio: readNumber(row.folio),
    employeeBukEmployeeId: readText(row.employee_buk_employee_id),
    employeeFullName: readText(row.employee_full_name),
    employeeDocumentNumber: readText(row.employee_document_number),
    employeeJobTitle: readText(row.employee_job_title),
    employeeContractCode: readNullableText(row.employee_contract_code),
    employeeAreaName: readNullableText(row.employee_area_name),
    incidentPlace: readText(row.incident_place),
    incidentAt: readText(row.incident_at),
    equipmentNumber: readNullableText(row.equipment_number),
    causeName: readText(row.cause_name),
    measureName: readText(row.measure_name),
    status: readText(row.status, "submitted") as HrSanctionStatus,
    dueAt: readText(row.due_at),
    createdAt: readText(row.created_at),
    requesterName: readText(row.requester_name),
    bukUploadStatus: readText(row.buk_upload_status, "not_ready") as HrSanctionRequestRow["bukUploadStatus"],
    documentsCount: readNumber(row.documents_count)
  };
}

function mapKpis(source: Record<string, unknown>): HrSanctionRequestsKpis {
  return {
    total: readNumber(source.total),
    submitted: readNumber(source.submitted),
    underReview: readNumber(source.under_review),
    issued: readNumber(source.issued),
    pendingSignature: readNumber(source.pending_signature),
    closed: readNumber(source.closed),
    overdue: readNumber(source.overdue)
  };
}

export async function fetchHrSanctionSetupCatalogs(): Promise<HrSanctionSetupCatalogs> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_hr_sanction_setup_catalogs");

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible cargar la configuración de sanciones.", "message")
    );
  }

  const payload = asRecord(data);
  return {
    causes: asArray<Record<string, unknown>>(payload.causes).map(mapCause),
    measures: asArray<Record<string, unknown>>(payload.measures).map(mapMeasure)
  };
}

export async function searchHrSanctionWorkers(search: string, limit = 12): Promise<HrSanctionWorker[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("search_hr_sanction_workers", {
    p_search: search.trim() || null,
    p_limit: limit
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible buscar trabajadores para sanciones.", "message")
    );
  }

  return asArray<Record<string, unknown>>(data).map((row) => ({
    bukEmployeeId: readText(row.buk_employee_id),
    fullName: readText(row.full_name),
    documentNumber: readText(row.document_number),
    documentType: readText(row.document_type, "rut"),
    jobTitle: readText(row.job_title),
    contractCode: readNullableText(row.contract_code),
    areaName: readNullableText(row.area_name),
    displayLabel: readText(row.display_label)
  }));
}

export async function createHrSanctionRequest(
  input: CreateHrSanctionRequestInput,
  idempotencyKey: string
): Promise<CreateHrSanctionRequestResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("create_hr_sanction_request", {
    p_payload: {
      bukEmployeeId: input.bukEmployeeId,
      causeId: input.causeId,
      measureId: input.measureId,
      incidentAt: input.incidentAt,
      incidentPlace: input.incidentPlace,
      equipmentNumber: input.equipmentNumber,
      regulatoryBasis: input.regulatoryBasis,
      description: input.description
    },
    p_idempotency_key: idempotencyKey
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible crear la solicitud de sanción.", "message")
    );
  }

  const row = asArray<Record<string, unknown>>(data)[0];
  if (!row) {
    throw new Error("La creación de la sanción no devolvió resultado.");
  }

  return {
    requestId: readText(row.request_id),
    folio: readNumber(row.folio),
    status: readText(row.status, "submitted") as HrSanctionStatus,
    dueAt: readText(row.due_at),
    isOutOfDeadline: readBoolean(row.is_out_of_deadline)
  };
}

export async function uploadHrSanctionDocument(params: {
  requestId: string;
  file: File;
  documentType: HrSanctionDocumentType;
  userId: string;
}) {
  const client = getSupabaseClient();
  const extension = params.file.name.includes(".")
    ? params.file.name.slice(params.file.name.lastIndexOf("."))
    : "";
  const safeName = params.file.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  const filePath = `evidence/${params.userId}/${params.requestId}/${crypto.randomUUID()}-${safeName || `documento${extension}`}`;

  const { error: uploadError } = await client.storage
    .from("hr-sanctions")
    .upload(filePath, params.file, {
      cacheControl: "3600",
      contentType: params.file.type || "application/octet-stream",
      upsert: false
    });

  if (uploadError) {
    throw new Error(
      getSupabaseErrorMessage(uploadError, "No fue posible cargar el documento de respaldo.", "message")
    );
  }

  const { error } = await client.rpc("register_hr_sanction_document", {
    p_request_id: params.requestId,
    p_document_type: params.documentType,
    p_file_path: filePath,
    p_file_name: params.file.name,
    p_mime_type: params.file.type || "application/octet-stream",
    p_file_size: params.file.size
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "El archivo se cargó, pero no fue posible registrarlo.", "message")
    );
  }
}

export async function fetchHrSanctionRequestsPage(
  filters: HrSanctionRequestsPageFilters
): Promise<HrSanctionRequestsPage> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_hr_sanction_requests_page", {
    p_status: filters.status && filters.status !== "all" ? filters.status : null,
    p_search: filters.search?.trim() || null,
    p_limit: filters.limit ?? 25,
    p_offset: filters.offset ?? 0
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible cargar las solicitudes de sanción.", "message")
    );
  }

  const payload = asRecord(data);
  return {
    total: readNumber(payload.total),
    kpis: mapKpis(asRecord(payload.kpis)),
    rows: asArray<Record<string, unknown>>(payload.rows).map(mapRequestRow)
  };
}

export async function transitionHrSanctionRequest(params: {
  requestId: string;
  nextStatus: HrSanctionStatus;
  comment?: string | null;
}) {
  const client = getSupabaseClient();
  const { error } = await client.rpc("transition_hr_sanction_request", {
    p_request_id: params.requestId,
    p_next_status: params.nextStatus,
    p_comment: params.comment?.trim() || null
  });

  if (error) {
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible actualizar el estado de la sanción.", "message")
    );
  }
}
