import {
  asArray,
  asRecord,
  getSupabaseClientOrThrow as getSupabaseClient,
  getSupabaseErrorMessage,
  readBoolean,
  readNullableText,
  readNumber,
  readText
} from "../../../shared/lib/supabaseRpc";
import type {
  CompetencyCatalogOption,
  CompetencyCatalogs,
  CompetencyDashboardPayload,
  CompetencyDashboardRow,
  CompetencyEquipmentModel,
  CompetencyEvaluationUpload,
  CompetencyGenerationResult,
  CompetencyInstructor,
  CompetencyRequestInput,
  CompetencyRequestResult,
  CompetencyWorker
} from "../types";

const COMPETENCY_BUCKET = "competency_documents";
const MAX_EVALUATION_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EVALUATION_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

function mapCatalogOption(item: Record<string, unknown>): CompetencyCatalogOption {
  return {
    id: readText(item.id),
    code: readText(item.code),
    name: readText(item.name),
    sortOrder: readNumber(item.sort_order)
  };
}

function mapEquipmentModel(item: Record<string, unknown>): CompetencyEquipmentModel {
  return {
    ...mapCatalogOption(item),
    brandId: readText(item.brand_id),
    typeId: readText(item.type_id),
    brandName: readText(item.brand_name),
    typeName: readText(item.type_name)
  };
}

function mapInstructor(item: Record<string, unknown>): CompetencyInstructor {
  return {
    id: readText(item.id),
    userId: readNullableText(item.user_id),
    fullName: readText(item.full_name),
    documentNumber: readText(item.document_number),
    profileCode: readText(item.profile_code),
    signatureLabel: readNullableText(item.signature_label),
    status: readText(item.status)
  };
}

function mapCatalogs(payload: unknown): CompetencyCatalogs {
  const source = asRecord(payload);
  const permissions = asRecord(source.permissions);

  return {
    brands: asArray<Record<string, unknown>>(source.brands).map(mapCatalogOption),
    types: asArray<Record<string, unknown>>(source.types).map(mapCatalogOption),
    models: asArray<Record<string, unknown>>(source.models).map(mapEquipmentModel),
    instructors: asArray<Record<string, unknown>>(source.instructors).map(mapInstructor),
    permissions: {
      canAdmin: readBoolean(permissions.can_admin),
      canAccess: readBoolean(permissions.can_access)
    }
  };
}

function mapWorker(item: Record<string, unknown>): CompetencyWorker {
  return {
    bukEmployeeId: readText(item.buk_employee_id),
    fullName: readText(item.full_name),
    documentNumber: readNullableText(item.document_number) ?? "",
    documentType: readText(item.document_type),
    jobTitle: readNullableText(item.job_title),
    areaName: readNullableText(item.area_name),
    contractCode: readNullableText(item.contract_code),
    displayLabel: readText(item.display_label)
  };
}

function mapRequestResult(payload: unknown): CompetencyRequestResult {
  const source = asRecord(payload);
  return {
    requestId: readText(source.request_id),
    certificateId: readText(source.certificate_id),
    folio: readText(source.folio),
    verificationToken: readText(source.verification_token)
  };
}

function mapGenerationResult(payload: unknown): CompetencyGenerationResult {
  const source = asRecord(payload);
  return {
    success: readBoolean(source.success),
    alreadyGenerated: source.alreadyGenerated === undefined ? undefined : readBoolean(source.alreadyGenerated),
    folio: readText(source.folio),
    verificationToken: readNullableText(source.verificationToken) ?? undefined,
    pdfPath: readText(source.pdfPath),
    pdfHash: readNullableText(source.pdfHash) ?? undefined,
    bukUploadStatus: readText(source.bukUploadStatus),
    bukDocumentId: readNullableText(source.bukDocumentId),
    bukDocumentUrl: readNullableText(source.bukDocumentUrl),
    bukError: readNullableText(source.bukError)
  };
}

function mapDashboardRow(item: Record<string, unknown>): CompetencyDashboardRow {
  return {
    requestId: readText(item.request_id),
    certificateId: readText(item.certificate_id),
    folio: readText(item.folio),
    workerFullName: readText(item.worker_full_name),
    workerDocumentNumber: readText(item.worker_document_number),
    workerJobTitle: readNullableText(item.worker_job_title),
    workerAreaName: readNullableText(item.worker_area_name),
    workerContractCode: readNullableText(item.worker_contract_code),
    instructorFullName: readText(item.instructor_full_name),
    modelSummary: readText(item.model_summary),
    trainingDate: readText(item.training_date),
    requestStatus: readText(item.request_status),
    certificateStatus: readText(item.certificate_status),
    competencyStatus: readText(item.competency_status),
    bukUploadStatus: readText(item.buk_upload_status),
    validUntil: readNullableText(item.valid_until),
    pdfPath: readNullableText(item.pdf_path),
    createdAt: readText(item.created_at)
  };
}

function mapDashboard(payload: unknown): CompetencyDashboardPayload {
  const source = asRecord(payload);
  const summary = asRecord(source.summary);
  return {
    summary: {
      total: readNumber(summary.total),
      enabled: readNumber(summary.enabled),
      pendingBuk: readNumber(summary.pending_buk),
      expired: readNumber(summary.expired)
    },
    recent: asArray<Record<string, unknown>>(source.recent).map(mapDashboardRow)
  };
}

async function sha256Hex(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sanitizeFileName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "evaluacion";
}

export async function fetchCompetencyCatalogs() {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_competency_catalogs");

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible cargar los catalogos de competencias.", "message"));
  }

  return mapCatalogs(data);
}

export async function searchCompetencyWorkers(searchText: string, limit = 20) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("search_competency_workers", {
    search_text: searchText,
    result_limit: limit
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible buscar trabajadores BUK.", "message"));
  }

  return asArray<Record<string, unknown>>(data).map(mapWorker);
}

export async function fetchCompetencyDashboard() {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_competency_dashboard");

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible cargar el resumen de competencias.", "message"));
  }

  return mapDashboard(data);
}

export async function uploadCompetencyEvaluationFile(file: File, userId: string): Promise<CompetencyEvaluationUpload> {
  if (!ALLOWED_EVALUATION_MIME_TYPES.has(file.type)) {
    throw new Error("Solo se permiten evaluaciones en PDF, JPG o PNG.");
  }

  if (file.size <= 0 || file.size > MAX_EVALUATION_SIZE_BYTES) {
    throw new Error("El archivo de evaluacion debe pesar entre 1 byte y 15 MB.");
  }

  const client = getSupabaseClient();
  const sha256 = await sha256Hex(file);
  const safeName = sanitizeFileName(file.name);
  const path = `evaluations/${userId}/${Date.now()}-${safeName}`;
  const { error } = await client.storage.from(COMPETENCY_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible cargar la evaluacion.", "message"));
  }

  return {
    path,
    name: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    sha256
  };
}

export async function createCompetencyRequest(input: CompetencyRequestInput) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("create_competency_request", {
    request_payload: {
      workerBukEmployeeId: input.workerBukEmployeeId,
      instructorId: input.instructorId,
      modelIds: input.modelIds,
      trainingDate: input.trainingDate,
      trainingStartTime: input.trainingStartTime,
      trainingEndTime: input.trainingEndTime,
      trainingLocation: input.trainingLocation,
      theoreticalScore: input.theoreticalScore,
      practicalScore: input.practicalScore,
      finalScore: input.finalScore,
      evaluationDate: input.evaluationDate,
      evaluationFilePath: input.evaluationFilePath,
      evaluationFileName: input.evaluationFileName,
      evaluationMimeType: input.evaluationMimeType,
      evaluationSizeBytes: input.evaluationSizeBytes,
      evaluationSha256: input.evaluationSha256,
      declarationAccepted: input.declarationAccepted,
      notes: input.notes
    }
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible crear la solicitud de competencia.", "message"));
  }

  return mapRequestResult(data);
}

export async function generateCompetencyCertificate(requestId: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke("generate-competency-certificate", {
    body: { requestId }
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible generar el certificado.", "message"));
  }

  const payload = asRecord(data);
  if (payload.error) {
    throw new Error(readText(payload.error) || "No fue posible generar el certificado.");
  }

  return mapGenerationResult(payload);
}

export async function createCompetencyDocumentUrl(path: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.storage.from(COMPETENCY_BUCKET).createSignedUrl(path, 60);

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible preparar la descarga.", "message"));
  }

  return data.signedUrl;
}
