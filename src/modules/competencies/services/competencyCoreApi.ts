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
  CompetencyInstructor,
  CompetencyModelWarning,
  CompetencyPublicVerification,
  CompetencyWorker
} from "../types";

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
    companyName: readNullableText(item.company_name),
    displayLabel: readText(item.display_label)
  };
}

function mapModelWarning(item: Record<string, unknown>): CompetencyModelWarning {
  return {
    certificateId: readText(item.certificateId),
    requestId: readText(item.requestId),
    folio: readText(item.folio),
    modelId: readText(item.modelId),
    brandName: readText(item.brandName),
    typeName: readText(item.typeName),
    modelName: readText(item.modelName),
    validFrom: readNullableText(item.validFrom),
    validUntil: readNullableText(item.validUntil)
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
    instructorFullName: readText(item.instructor_full_name ?? item.instructor_name),
    modelSummary: readText(item.model_summary),
    trainingDate: readText(item.training_date ?? item.issued_at ?? item.created_at),
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
      generated: readNumber(summary.generated),
      enabled: readNumber(summary.enabled ?? summary.generated),
      pendingBuk: readNumber(summary.pending_buk),
      expiring30: readNumber(summary.expiring_30),
      expired: readNumber(summary.expired)
    },
    recent: asArray<Record<string, unknown>>(source.recent).map(mapDashboardRow)
  };
}

function mapPublicVerification(payload: unknown): CompetencyPublicVerification {
  const source = asRecord(payload);
  const certificate = asRecord(source.certificate);
  const worker = asRecord(source.worker);
  const instructor = asRecord(source.instructor);
  const training = asRecord(source.training);

  return {
    found: readBoolean(source.found),
    isAuthentic: readBoolean(source.is_authentic ?? source.isAuthentic),
    isCurrent: readBoolean(source.is_current ?? source.isCurrent),
    status: readText(source.status),
    verifiedAt: readNullableText(source.verified_at ?? source.verifiedAt),
    snapshotUpdatedAt: readNullableText(source.snapshot_updated_at ?? source.snapshotUpdatedAt),
    certificate: {
      folio: readText(certificate.folio),
      templateCode: readText(certificate.template_code ?? certificate.templateCode),
      templateVersion: readText(certificate.template_version ?? certificate.templateVersion),
      certificateStatus: readText(certificate.certificate_status ?? certificate.certificateStatus),
      competencyStatus: readText(certificate.competency_status ?? certificate.competencyStatus),
      issuedAt: readNullableText(certificate.issued_at ?? certificate.issuedAt),
      validFrom: readNullableText(certificate.valid_from ?? certificate.validFrom),
      validUntil: readNullableText(certificate.valid_until ?? certificate.validUntil),
      pdfSha256: readNullableText(certificate.pdf_sha256 ?? certificate.pdfSha256),
      bukRegistered: readBoolean(certificate.buk_registered ?? certificate.bukRegistered),
      bukUploadedAt: readNullableText(certificate.buk_uploaded_at ?? certificate.bukUploadedAt)
    },
    worker: {
      fullName: readText(worker.full_name ?? worker.fullName),
      documentNumber: readText(worker.document_number ?? worker.documentNumber),
      jobTitle: readNullableText(worker.job_title ?? worker.jobTitle)
    },
    instructor: {
      fullName: readText(instructor.full_name ?? instructor.fullName),
      documentNumber: readText(instructor.document_number ?? instructor.documentNumber),
      profileCode: readText(instructor.profile_code ?? instructor.profileCode)
    },
    training: {
      trainingDate: readNullableText(training.training_date ?? training.trainingDate)
    },
    equipment: asArray<Record<string, unknown>>(source.equipment).map((item) => ({
      brandName: readText(item.brand_name ?? item.brandName),
      typeName: readText(item.type_name ?? item.typeName),
      modelName: readText(item.model_name ?? item.modelName)
    }))
  };
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

export async function verifyCompetencyCertificate(lookupText: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke("verify-competency-certificate", {
    body: {
      lookup: lookupText.trim()
    }
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible validar el certificado.", "message"));
  }

  return mapPublicVerification(data);
}

export async function fetchCompetencyModelWarnings(input: {
  workerBukEmployeeId: string;
  modelIds: string[];
  trainingDate: string;
}): Promise<CompetencyModelWarning[]> {
  if (!input.workerBukEmployeeId || input.modelIds.length === 0 || !input.trainingDate) {
    return [];
  }

  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_competency_certificate_model_warnings", {
    p_worker_buk_employee_id: input.workerBukEmployeeId,
    p_model_ids: input.modelIds,
    p_training_date: input.trainingDate
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible validar advertencias de certificados vigentes.", "message"));
  }

  return asArray<Record<string, unknown>>(asRecord(data).conflicts).map(mapModelWarning);
}
