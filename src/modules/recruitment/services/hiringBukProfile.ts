import { supabase } from "../../../shared/lib/supabase";
import { formatRut, normalizeRut } from "../../../shared/lib/rut";
import { getSupabaseErrorMessage } from "../../../shared/lib/supabaseRpc";
import type { CandidateBukProfileDetails, CandidateDocumentValidationSummary, CandidateWorkerFile } from "./hiringControlTypes";

export async function fetchCandidateBukProfile(caseCandidateId: string): Promise<{
  data: CandidateBukProfileDetails | null;
  error: string | null;
}> {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_candidate_buk_profile", {
    p_case_candidate_id: caseCandidateId
  });

  if (error) {
    return {
      data: null,
      error: getSupabaseErrorMessage(error, "No fue posible cargar la ficha BUK del candidato.")
    };
  }

  return {
    data: (data ?? null) as CandidateBukProfileDetails | null,
    error: null
  };
}

export async function updateCandidatePersonProfile(input: {
  caseCandidateId: string;
  documentType?: string | null;
  documentNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  secondLastName?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  maritalStatus?: string | null;
  companyEmail?: string | null;
  personalEmail?: string | null;
  privatePhone?: string | null;
  officePhone?: string | null;
  country?: string | null;
  addressLine?: string | null;
  districtOrCommune?: string | null;
  currentCity?: string | null;
  region?: string | null;
  streetName?: string | null;
  streetNumber?: string | null;
  apartmentOrOffice?: string | null;
  educationTitle?: string | null;
  educationInstitution?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  disabilityStatus?: string | null;
  disabilityNoticeDate?: string | null;
  invalidityStatus?: string | null;
  invalidityNoticeDate?: string | null;
  inclusionNotes?: string | null;
  laborInclusion?: string | null;
  firefighterStatus?: string | null;
  foreignWorker?: string | null;
  shirtSize?: string | null;
  pantsSize?: string | null;
  shoeSize?: string | null;
}) {
  if (!supabase) {
    return {
      error: "Supabase no está configurado en este entorno."
    };
  }

  const normalizedDocumentNumber =
    input.documentType?.trim() === "RUT"
      ? normalizeRut(input.documentNumber)
      : input.documentNumber?.trim() ?? null;

  const { error } = await supabase.rpc("upsert_candidate_person_profile", {
    p_case_candidate_id: input.caseCandidateId,
    p_document_type: input.documentType?.trim() ? input.documentType.trim() : null,
    p_document_number: normalizedDocumentNumber?.trim() ? normalizedDocumentNumber.trim() : null,
    p_first_name: input.firstName?.trim() ? input.firstName.trim() : null,
    p_last_name: input.lastName?.trim() ? input.lastName.trim() : null,
    p_second_last_name: input.secondLastName?.trim() ? input.secondLastName.trim() : null,
    p_gender: input.gender?.trim() ? input.gender.trim() : null,
    p_birth_date: input.birthDate || null,
    p_nationality: input.nationality?.trim() ? input.nationality.trim() : null,
    p_marital_status: input.maritalStatus?.trim() ? input.maritalStatus.trim() : null,
    p_company_email: input.companyEmail?.trim() ? input.companyEmail.trim() : null,
    p_personal_email: input.personalEmail?.trim() ? input.personalEmail.trim() : null,
    p_private_phone: input.privatePhone?.trim() ? input.privatePhone.trim() : null,
    p_office_phone: input.officePhone?.trim() ? input.officePhone.trim() : null,
    p_country: input.country?.trim() ? input.country.trim() : null,
    p_address_line: input.addressLine?.trim() ? input.addressLine.trim() : null,
    p_district_or_commune: input.districtOrCommune?.trim()
      ? input.districtOrCommune.trim()
      : null,
    p_current_city: input.currentCity?.trim() ? input.currentCity.trim() : null,
    p_region: input.region?.trim() ? input.region.trim() : null,
    p_street_name: input.streetName?.trim() ? input.streetName.trim() : null,
    p_street_number: input.streetNumber?.trim() ? input.streetNumber.trim() : null,
    p_apartment_or_office: input.apartmentOrOffice?.trim()
      ? input.apartmentOrOffice.trim()
      : null,
    p_education_title: input.educationTitle?.trim() ? input.educationTitle.trim() : null,
    p_education_institution: input.educationInstitution?.trim()
      ? input.educationInstitution.trim()
      : null,
    p_emergency_contact_name: input.emergencyContactName?.trim()
      ? input.emergencyContactName.trim()
      : null,
    p_emergency_contact_phone: input.emergencyContactPhone?.trim()
      ? input.emergencyContactPhone.trim()
      : null,
    p_emergency_contact_relationship: input.emergencyContactRelationship?.trim()
      ? input.emergencyContactRelationship.trim()
      : null,
    p_disability_status: input.disabilityStatus?.trim()
      ? input.disabilityStatus.trim()
      : null,
    p_disability_notice_date: input.disabilityNoticeDate || null,
    p_invalidity_status: input.invalidityStatus?.trim()
      ? input.invalidityStatus.trim()
      : null,
    p_invalidity_notice_date: input.invalidityNoticeDate || null,
    p_inclusion_notes: input.inclusionNotes?.trim() ? input.inclusionNotes.trim() : null,
    p_labor_inclusion: input.laborInclusion?.trim() ? input.laborInclusion.trim() : null,
    p_firefighter_status: input.firefighterStatus?.trim()
      ? input.firefighterStatus.trim()
      : null,
    p_foreign_worker: input.foreignWorker?.trim() ? input.foreignWorker.trim() : null,
    p_shirt_size: input.shirtSize?.trim() ? input.shirtSize.trim() : null,
    p_pants_size: input.pantsSize?.trim() ? input.pantsSize.trim() : null,
    p_shoe_size: input.shoeSize?.trim() ? input.shoeSize.trim() : null
  });

  if (error) {
    return {
      error: getSupabaseErrorMessage(error, "No fue posible actualizar la ficha personal del candidato.")
    };
  }

  return { error: null };
}

export async function updateCandidateWorkerFile(input: {
  caseCandidateId: string;
  employeeCode?: string | null;
  projectName?: string | null;
  companyEntryDate?: string | null;
  shiftName?: string | null;
  advanceAmount?: number | null;
  contractNotes?: string | null;
  privateRole?: string | null;
  afcStartDate?: string | null;
  seniorityRecognitionDate?: string | null;
  progressiveVacationStartDate?: string | null;
  paymentMethod?: string | null;
  paymentPeriod?: string | null;
  bankName?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  bankBranchCode?: string | null;
  valeVistaType?: string | null;
  pensionRegime?: string | null;
  contributionFund?: string | null;
  afpCollectionEntity?: string | null;
  increaseQuoteOnePercent?: string | null;
  healthProvider?: string | null;
  healthPlanUf?: number | null;
  healthPlanPesos?: number | null;
  healthPlanPercentage?: number | null;
  afcRegime?: string | null;
  retiredStatus?: string | null;
  retirementRegime?: string | null;
  accountTwoFund?: string | null;
  accountTwoPlan?: string | null;
  currency?: string | null;
  simpleLoadCount?: number | null;
  maternalLoadCount?: number | null;
  invalidLoadCount?: number | null;
  familyAllowanceSection?: string | null;
  personalDataUpdateDate?: string | null;
}) {
  if (!supabase) {
    return {
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { error } = await supabase.rpc("upsert_candidate_worker_file", {
    p_case_candidate_id: input.caseCandidateId,
    p_employee_code: input.employeeCode?.trim() ? input.employeeCode.trim() : null,
    p_project_name: input.projectName?.trim() ? input.projectName.trim() : null,
    p_company_entry_date: input.companyEntryDate || null,
    p_shift_name: input.shiftName?.trim() ? input.shiftName.trim() : null,
    p_advance_amount: input.advanceAmount ?? null,
    p_contract_notes: input.contractNotes?.trim() ? input.contractNotes.trim() : null,
    p_private_role: input.privateRole?.trim() ? input.privateRole.trim() : null,
    p_afc_start_date: input.afcStartDate || null,
    p_seniority_recognition_date: input.seniorityRecognitionDate || null,
    p_progressive_vacation_start_date: input.progressiveVacationStartDate || null,
    p_payment_method: input.paymentMethod?.trim() ? input.paymentMethod.trim() : null,
    p_payment_period: input.paymentPeriod?.trim() ? input.paymentPeriod.trim() : null,
    p_bank_name: input.bankName?.trim() ? input.bankName.trim() : null,
    p_bank_account_type: input.bankAccountType?.trim()
      ? input.bankAccountType.trim()
      : null,
    p_bank_account_number: input.bankAccountNumber?.trim()
      ? input.bankAccountNumber.trim()
      : null,
    p_bank_branch_code: input.bankBranchCode?.trim() ? input.bankBranchCode.trim() : null,
    p_vale_vista_type: input.valeVistaType?.trim() ? input.valeVistaType.trim() : null,
    p_pension_regime: input.pensionRegime?.trim() ? input.pensionRegime.trim() : null,
    p_contribution_fund: input.contributionFund?.trim()
      ? input.contributionFund.trim()
      : null,
    p_afp_collection_entity: input.afpCollectionEntity?.trim()
      ? input.afpCollectionEntity.trim()
      : null,
    p_increase_quote_one_percent: input.increaseQuoteOnePercent?.trim()
      ? input.increaseQuoteOnePercent.trim()
      : null,
    p_health_provider: input.healthProvider?.trim() ? input.healthProvider.trim() : null,
    p_health_plan_uf: input.healthPlanUf ?? null,
    p_health_plan_pesos: input.healthPlanPesos ?? null,
    p_health_plan_percentage: input.healthPlanPercentage ?? null,
    p_afc_regime: input.afcRegime?.trim() ? input.afcRegime.trim() : null,
    p_retired_status: input.retiredStatus?.trim() ? input.retiredStatus.trim() : null,
    p_retirement_regime: input.retirementRegime?.trim()
      ? input.retirementRegime.trim()
      : null,
    p_account_two_fund: input.accountTwoFund?.trim() ? input.accountTwoFund.trim() : null,
    p_account_two_plan: input.accountTwoPlan?.trim() ? input.accountTwoPlan.trim() : null,
    p_currency: input.currency?.trim() ? input.currency.trim() : null,
    p_simple_load_count: input.simpleLoadCount ?? null,
    p_maternal_load_count: input.maternalLoadCount ?? null,
    p_invalid_load_count: input.invalidLoadCount ?? null,
    p_family_allowance_section: input.familyAllowanceSection?.trim()
      ? input.familyAllowanceSection.trim()
      : null,
    p_personal_data_update_date: input.personalDataUpdateDate || null
  });

  if (error) {
    return {
      error: getSupabaseErrorMessage(error, "No fue posible actualizar la ficha del ingreso actual.")
    };
  }

  return { error: null };
}

export async function enqueueCandidatesToBuk(candidateIds: string[]) {
  if (!supabase) {
    return {
      data: [] as Array<{
        job_id: string;
        recruitment_case_candidate_id: string;
        status: string;
      }>,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const normalizedIds = Array.from(
    new Set(candidateIds.map((candidateId) => candidateId.trim()).filter(Boolean))
  );

  if (normalizedIds.length === 0) {
    return {
      data: [],
      error: "Selecciona al menos una persona para generar en BUK."
    };
  }

  const { data, error } = await supabase.rpc("enqueue_buk_generation", {
    p_candidate_ids: normalizedIds
  });

  if (error) {
    return {
      data: [],
      error: getSupabaseErrorMessage(error, "No fue posible encolar la generación en BUK.")
    };
  }

  return {
    data: Array.isArray(data)
      ? (data as Array<{
          job_id: string;
          recruitment_case_candidate_id: string;
          status: string;
        }>)
      : [],
    error: null
  };
}

type BukSyncQueueRow = {
  job_id: string;
  recruitment_case_candidate_id: string;
  status: string;
};

type BukSyncQueueStatusRow = {
  job_id: string;
  recruitment_case_candidate_id: string;
  status: "pending" | "processing" | "success" | "error";
  buk_employee_id: string | null;
  error_message: string | null;
  attempts: number;
  started_at: string | null;
  finished_at: string | null;
};

type BukSyncProcessedRow = {
  jobId: string;
  candidateId: string;
  status: "success" | "error";
  bukEmployeeId?: string;
  error?: string;
};

const MAX_BUK_SYNC_ERROR_MESSAGE_LENGTH = 220;

function sanitizeBukSyncErrorMessage(message: string | null | undefined) {
  const normalized = (message ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }

  const lowerMessage = normalized.toLowerCase();
  if (
    lowerMessage.includes("<!doctype html") ||
    lowerMessage.includes("<html") ||
    lowerMessage.includes("</html>")
  ) {
    const statusMatch = normalized.match(/\b(Buk API\s+)?(\d{3})\s+([A-Za-z][A-Za-z ]{2,40})/i);
    const statusText = statusMatch ? ` (${statusMatch[2]} ${statusMatch[3].trim()})` : "";
    return `BUK no pudo procesar la solicitud${statusText}. El proveedor devolvió una respuesta interna no legible; revisa el job de sincronización y reintenta.`;
  }

  const withoutTags = normalized.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (withoutTags.length <= MAX_BUK_SYNC_ERROR_MESSAGE_LENGTH) {
    return withoutTags;
  }

  return `${withoutTags.slice(0, MAX_BUK_SYNC_ERROR_MESSAGE_LENGTH - 1).trim()}…`;
}

async function fetchBukSyncJobsStatus(jobIds: string[]) {
  if (!supabase) {
    return {
      data: [] as BukSyncQueueStatusRow[],
      error: "Supabase no está configurado en este entorno."
    };
  }

  const normalizedJobIds = Array.from(new Set(jobIds.map((jobId) => jobId.trim()).filter(Boolean)));
  if (normalizedJobIds.length === 0) {
    return {
      data: [] as BukSyncQueueStatusRow[],
      error: null
    };
  }

  const { data, error } = await supabase.rpc("get_buk_sync_jobs_status", {
    p_job_ids: normalizedJobIds
  });

  if (error) {
    return {
      data: [] as BukSyncQueueStatusRow[],
      error: getSupabaseErrorMessage(error, "No fue posible consultar el estado de la cola BUK.")
    };
  }

  return {
    data: Array.isArray(data) ? (data as BukSyncQueueStatusRow[]) : [],
    error: null
  };
}

function mergeQueuedJobsWithStatus(
  queuedJobs: BukSyncQueueRow[],
  statusRows: BukSyncQueueStatusRow[]
) {
  const statusByJobId = new Map(statusRows.map((row) => [row.job_id, row]));

  return queuedJobs.map((job) => ({
    ...job,
    status: statusByJobId.get(job.job_id)?.status ?? job.status
  }));
}

function mapStatusRowsToProcessed(statusRows: BukSyncQueueStatusRow[]) {
  return statusRows
    .filter(
      (row): row is BukSyncQueueStatusRow & { status: "success" | "error" } =>
        row.status === "success" || row.status === "error"
    )
    .map((row) => ({
      jobId: row.job_id,
      candidateId: row.recruitment_case_candidate_id,
      status: row.status,
      bukEmployeeId: row.buk_employee_id ?? undefined,
      error: sanitizeBukSyncErrorMessage(row.error_message)
    }));
}

export async function generateCandidatesInBuk(candidateIds: string[]) {
  const queueResult = await enqueueCandidatesToBuk(candidateIds);
  if (queueResult.error) {
    return {
      data: [] as BukSyncQueueRow[],
      processed: [] as BukSyncProcessedRow[],
      error: queueResult.error,
      dispatchError: null as string | null
    };
  }

  const queuedJobs = queueResult.data as BukSyncQueueRow[];
  const pendingJobIds = queuedJobs
    .filter((job) => job.status === "pending" && typeof job.job_id === "string" && job.job_id.trim())
    .map((job) => job.job_id);

  if (pendingJobIds.length === 0) {
    return {
      data: queuedJobs,
      processed: [] as BukSyncProcessedRow[],
      error: null,
      dispatchError: null
    };
  }

  if (!supabase) {
    return {
      data: queuedJobs,
      processed: [] as BukSyncProcessedRow[],
      error: null,
      dispatchError: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.functions.invoke("sync-buk-candidates", {
    body: { jobIds: pendingJobIds }
  });

  if (error) {
    const statusResult = await fetchBukSyncJobsStatus(pendingJobIds);
    if (!statusResult.error) {
      const hasProcessingEvidence = statusResult.data.some(
        (job) =>
          job.status !== "pending" ||
          job.started_at !== null ||
          job.finished_at !== null
      );

      if (hasProcessingEvidence) {
        return {
          data: mergeQueuedJobsWithStatus(queuedJobs, statusResult.data),
          processed: mapStatusRowsToProcessed(statusResult.data),
          error: null,
          dispatchError: null
        };
      }
    }

    return {
      data: queuedJobs,
      processed: [] as BukSyncProcessedRow[],
      error: null,
      dispatchError: getSupabaseErrorMessage(
        error,
        "No fue posible ejecutar la sincronización automática con BUK.",
        "message"
      )
    };
  }

  const payload =
    data && typeof data === "object" ? (data as { error?: unknown; processed?: unknown }) : null;
  const functionError =
    payload?.error && typeof payload.error === "string"
      ? payload.error
      : payload?.error
        ? String(payload.error)
        : null;

  return {
    data: queuedJobs,
    processed: Array.isArray(payload?.processed)
      ? (payload.processed as BukSyncProcessedRow[]).map((row) => ({
          ...row,
          error: sanitizeBukSyncErrorMessage(row.error)
        }))
      : [],
    error: null,
    dispatchError: sanitizeBukSyncErrorMessage(functionError) ?? null
  };
}


export interface CandidateHistoricalRejection {
  case_code: string;
  job_position: string;
  stage_code: string;
  rejection_reason: string | null;
  date: string;
}

export interface CandidateProfileSearchResult {
  id: string;
  national_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  historical_rejections?: CandidateHistoricalRejection[];
}

export async function findCandidateProfileByRut(rut: string): Promise<{
  data: CandidateProfileSearchResult | null;
  error: string | null;
}> {
  if (!supabase) {
    return { data: null, error: "Supabase no está configurado." };
  }

  const normalizedNationalId = normalizeRut(rut);

  const { data, error } = await supabase.rpc("find_candidate_profile_with_history_by_rut", {
    p_national_id: normalizedNationalId
  });

  if (error) {
    return {
      data: null,
      error: getSupabaseErrorMessage(error, "No fue posible buscar el candidato.")
    };
  }

  const results = data as unknown as CandidateProfileSearchResult[];
  return {
    data: (results && results.length > 0 ? results[0] : null),
    error: null
  };
}

export interface BukCandidateStatus {
  exists: boolean;
  status?: string;
  name?: string;
  is_active?: boolean;
  exit_date?: string | null;
}

export async function checkCandidateInBukLive(rut: string): Promise<{
  data: BukCandidateStatus | null;
  error: string | null;
}> {
  if (!supabase) {
    return { data: null, error: "Supabase no está configurado." };
  }

  const normalizedNationalId = normalizeRut(rut);

  const { data, error } = await supabase.rpc("find_buk_employee_status_by_rut", {
    p_national_id: normalizedNationalId
  });

  if (error) {
    return {
      data: null,
      error: getSupabaseErrorMessage(error, "No fue posible verificar el estado en BUK.")
    };
  }

  const results = data as unknown as Array<{
    match_found: boolean;
    name?: string;
    status?: string;
    is_active?: boolean;
    exit_date?: string | null;
  }> | null;

  const firstResult = results && results.length > 0 ? results[0] : null;

  return {
    data: firstResult
      ? {
          exists: Boolean(firstResult.match_found),
          status: firstResult.status,
          name: firstResult.name,
          is_active: firstResult.is_active,
          exit_date: firstResult.exit_date ?? null
        }
      : { exists: false },
    error: null
  };
}
