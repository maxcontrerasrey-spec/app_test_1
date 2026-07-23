import { formatRut, normalizeRut } from "../../../shared/lib/rut";
import { applyCandidateBukWorkerDefaults } from "./candidateBukWorkerRules";
import type { CandidateBukProfileDetails, RecruitmentCaseCandidateRow, RecruitmentCaseDetail } from "../services/hiringControl";

export type PersonDraft = {
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  secondLastName: string;
  gender: string;
  birthDate: string;
  nationality: string;
  maritalStatus: string;
  companyEmail: string;
  personalEmail: string;
  privatePhone: string;
  officePhone: string;
  country: string;
  addressLine: string;
  districtOrCommune: string;
  currentCity: string;
  region: string;
  streetName: string;
  streetNumber: string;
  apartmentOrOffice: string;
  educationTitle: string;
  educationInstitution: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  disabilityStatus: string;
  disabilityNoticeDate: string;
  invalidityStatus: string;
  invalidityNoticeDate: string;
  inclusionNotes: string;
  laborInclusion: string;
  firefighterStatus: string;
  foreignWorker: string;
  shirtSize: string;
  pantsSize: string;
  shoeSize: string;
};

export type WorkerDraft = {
  employeeCode: string;
  projectName: string;
  companyEntryDate: string;
  shiftName: string;
  advanceAmount: string;
  contractNotes: string;
  privateRole: string;
  afcStartDate: string;
  seniorityRecognitionDate: string;
  progressiveVacationStartDate: string;
  paymentMethod: string;
  paymentPeriod: string;
  bankName: string;
  bankAccountType: string;
  bankAccountNumber: string;
  bankBranchCode: string;
  valeVistaType: string;
  pensionRegime: string;
  contributionFund: string;
  afpCollectionEntity: string;
  increaseQuoteOnePercent: string;
  healthProvider: string;
  healthPlanUf: string;
  healthPlanPesos: string;
  healthPlanPercentage: string;
  afcRegime: string;
  retiredStatus: string;
  retirementRegime: string;
  accountTwoFund: string;
  accountTwoPlan: string;
  currency: string;
  simpleLoadCount: string;
  maternalLoadCount: string;
  invalidLoadCount: string;
  familyAllowanceSection: string;
  personalDataUpdateDate: string;
};

export const firefighterStatusOptions = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
  { value: "no_informa", label: "No informa" }
];

export const yesNoBukOptions = [
  { value: "Sí", label: "Sí" },
  { value: "No", label: "No" }
];

export const bukPaymentPeriodOptions = [
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
  { value: "quincenal", label: "Quincenal" },
  { value: "diario", label: "Diario" },
  { value: "por_hora", label: "Por hora" }
];

export function looksLikeRut(value: string | null | undefined) {
  const normalized = normalizeRut(value);
  return normalized.length >= 7 && normalized.length <= 9;
}

function resolveDocumentType(
  bukProfile: CandidateBukProfileDetails | null,
  candidate: RecruitmentCaseCandidateRow
) {
  if (bukProfile?.document_type?.trim()) {
    return bukProfile.document_type.trim();
  }

  return looksLikeRut(bukProfile?.document_number ?? candidate.national_id) ? "RUT" : "";
}

function resolveDocumentNumber(
  bukProfile: CandidateBukProfileDetails | null,
  candidate: RecruitmentCaseCandidateRow
) {
  const sourceValue = bukProfile?.document_number ?? candidate.national_id ?? "";
  return looksLikeRut(sourceValue) ? formatRut(sourceValue) : sourceValue;
}

export const requiredPersonFields: Array<{ key: keyof PersonDraft; label: string }> = [
  { key: "documentType", label: "Tipo de documento" },
  { key: "documentNumber", label: "Número de documento" },
  { key: "lastName", label: "Apellido" },
  { key: "firstName", label: "Nombre" },
  { key: "gender", label: "Sexo" },
  { key: "nationality", label: "Nacionalidad" },
  { key: "birthDate", label: "Fecha de nacimiento" },
  { key: "maritalStatus", label: "Estado civil" },
  { key: "personalEmail", label: "Email personal" },
  { key: "addressLine", label: "Dirección" },
  { key: "region", label: "Región" },
  { key: "districtOrCommune", label: "Comuna" },
  { key: "currentCity", label: "Ciudad" }
];

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 3) {
    return {
      firstName: parts.slice(0, -2).join(" "),
      lastName: parts[parts.length - 2],
      secondLastName: parts[parts.length - 1]
    };
  }

  if (parts.length === 2) {
    return {
      firstName: parts[0],
      lastName: parts[1],
      secondLastName: ""
    };
  }

  return {
    firstName: fullName,
    lastName: "",
    secondLastName: ""
  };
}

function normalizeLegacyMaritalStatus(value: string | null | undefined) {
  switch ((value ?? "").trim().toLowerCase()) {
    case "soltero":
    case "soltero(a)":
      return "Soltero";
    case "casado":
    case "casado(a)":
      return "Casado";
    case "divorciado":
    case "divorciado(a)":
      return "Divorciado";
    case "viudo":
    case "viudo(a)":
      return "Viudo";
    case "union_civil":
    case "unión civil":
      return "Acuerdo de Unión Civil";
    default:
      return value ?? "";
  }
}

function normalizeAddressPart(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function formatStreetNumberForAddress(value: string | null | undefined) {
  const normalized = normalizeAddressPart(value).replace(/^#+\s*/, "");
  return normalized ? `#${normalized}` : "";
}

export function buildDerivedAddressLine(input: {
  streetName?: string | null;
  streetNumber?: string | null;
}) {
  return [
    normalizeAddressPart(input.streetName),
    formatStreetNumberForAddress(input.streetNumber)
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildPersonDraft(
  candidate: RecruitmentCaseCandidateRow,
  bukProfile: CandidateBukProfileDetails | null
): PersonDraft {
  const fallbackName = splitFullName(candidate.full_name);
  const currentCity = bukProfile?.current_city ?? candidate.current_city ?? "";
  const streetName = bukProfile?.street_name ?? "";
  const streetNumber = bukProfile?.street_number ?? "";
  const addressLine =
    buildDerivedAddressLine({ streetName, streetNumber }) ||
    bukProfile?.address_line ||
    candidate.address_line ||
    "";

  return {
    documentType: resolveDocumentType(bukProfile, candidate),
    documentNumber: resolveDocumentNumber(bukProfile, candidate),
    firstName: bukProfile?.first_name ?? fallbackName.firstName,
    lastName: bukProfile?.last_name ?? fallbackName.lastName,
    secondLastName: bukProfile?.second_last_name ?? fallbackName.secondLastName,
    gender: bukProfile?.gender ?? "",
    birthDate: bukProfile?.birth_date ?? candidate.birth_date ?? "",
    nationality: bukProfile?.nationality ?? candidate.nationality ?? "",
    maritalStatus: normalizeLegacyMaritalStatus(
      bukProfile?.marital_status ?? candidate.marital_status
    ),
    companyEmail: bukProfile?.email ?? candidate.email ?? "",
    personalEmail: bukProfile?.personal_email ?? "",
    privatePhone: bukProfile?.phone ?? candidate.phone ?? "",
    officePhone: bukProfile?.office_phone ?? "",
    country: bukProfile?.country ?? "Chile",
    addressLine,
    districtOrCommune: bukProfile?.district_or_commune ?? candidate.district_or_commune ?? "",
    currentCity,
    region: bukProfile?.region ?? candidate.region ?? "",
    streetName,
    streetNumber,
    apartmentOrOffice: bukProfile?.apartment_or_office ?? "",
    educationTitle: bukProfile?.education_title ?? "",
    educationInstitution: bukProfile?.education_institution ?? "",
    emergencyContactName:
      bukProfile?.emergency_contact_name ?? candidate.emergency_contact_name ?? "",
    emergencyContactPhone:
      bukProfile?.emergency_contact_phone ?? candidate.emergency_contact_phone ?? "",
    emergencyContactRelationship:
      bukProfile?.emergency_contact_relationship ??
      candidate.emergency_contact_relationship ??
      "",
    disabilityStatus: bukProfile?.disability_status ?? "",
    disabilityNoticeDate: bukProfile?.disability_notice_date ?? "",
    invalidityStatus: bukProfile?.invalidity_status ?? "",
    invalidityNoticeDate: bukProfile?.invalidity_notice_date ?? "",
    inclusionNotes: bukProfile?.inclusion_notes ?? candidate.inclusion_notes ?? "",
    laborInclusion: bukProfile?.labor_inclusion ?? "",
    firefighterStatus: bukProfile?.firefighter_status ?? candidate.firefighter_status ?? "",
    foreignWorker: bukProfile?.foreign_worker ?? "",
    shirtSize: bukProfile?.shirt_size ?? candidate.shirt_size ?? "",
    pantsSize: bukProfile?.pants_size ?? candidate.pants_size ?? "",
    shoeSize: bukProfile?.shoe_size ?? candidate.shoe_size ?? ""
  };
}

export function buildWorkerDraft(
  candidate: RecruitmentCaseCandidateRow,
  caseDetail: RecruitmentCaseDetail,
  bukProfile: CandidateBukProfileDetails | null
): WorkerDraft {
  const worker = bukProfile?.worker_file;

  return applyCandidateBukWorkerDefaults({
    employeeCode: bukProfile?.suggested_employee_code ?? worker?.employee_code ?? "",
    projectName: worker?.project_name ?? caseDetail.case.contract_name ?? "",
    companyEntryDate:
      worker?.company_entry_date ??
      caseDetail.case.requested_entry_date ??
      caseDetail.case.hiring_request.start_date ??
      "",
    shiftName: worker?.shift_name ?? caseDetail.case.hiring_request.shift_name ?? "",
    advanceAmount: worker?.advance_amount != null ? String(worker.advance_amount) : "",
    contractNotes: worker?.contract_notes ?? candidate.worker_file?.contract_notes ?? "",
    privateRole: worker?.private_role ?? "",
    afcStartDate: worker?.afc_start_date ?? "",
    seniorityRecognitionDate: worker?.seniority_recognition_date ?? "",
    progressiveVacationStartDate: worker?.progressive_vacation_start_date ?? "",
    paymentMethod: worker?.payment_method ?? "",
    paymentPeriod: worker?.payment_period ?? "",
    bankName: worker?.bank_name ?? candidate.bank_name ?? "",
    bankAccountType: worker?.bank_account_type ?? candidate.bank_account_type ?? "",
    bankAccountNumber: worker?.bank_account_number ?? candidate.bank_account_number ?? "",
    bankBranchCode: worker?.bank_branch_code ?? "",
    valeVistaType: worker?.vale_vista_type ?? "",
    pensionRegime: worker?.pension_regime ?? "",
    contributionFund: worker?.contribution_fund ?? candidate.afp_name ?? "",
    afpCollectionEntity: worker?.afp_collection_entity ?? "",
    increaseQuoteOnePercent: worker?.increase_quote_one_percent ?? "",
    healthProvider: worker?.health_provider ?? candidate.health_provider ?? "",
    healthPlanUf: worker?.health_plan_uf != null ? String(worker.health_plan_uf) : "",
    healthPlanPesos: worker?.health_plan_pesos != null ? String(worker.health_plan_pesos) : "",
    healthPlanPercentage:
      worker?.health_plan_percentage != null ? String(worker.health_plan_percentage) : "",
    afcRegime: worker?.afc_regime ?? "",
    retiredStatus: worker?.retired_status ?? "",
    retirementRegime: worker?.retirement_regime ?? "",
    accountTwoFund: worker?.account_two_fund ?? "",
    accountTwoPlan: worker?.account_two_plan ?? "",
    currency: worker?.currency ?? "",
    simpleLoadCount:
      worker?.simple_load_count != null ? String(worker.simple_load_count) : "",
    maternalLoadCount:
      worker?.maternal_load_count != null ? String(worker.maternal_load_count) : "",
    invalidLoadCount:
      worker?.invalid_load_count != null ? String(worker.invalid_load_count) : "",
    familyAllowanceSection: worker?.family_allowance_section ?? "",
    personalDataUpdateDate: worker?.personal_data_update_date ?? ""
  });
}

export function parseNullableNumber(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const normalized = Number(value.replace(",", "."));
  return Number.isNaN(normalized) ? null : normalized;
}

export function parseNullableInteger(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const normalized = Number.parseInt(value, 10);
  return Number.isNaN(normalized) ? null : normalized;
}

export function collectMissingFields<T extends Record<string, string>>(
  draft: T,
  requiredFields: Array<{ key: keyof T; label: string }>
) {
  return requiredFields
    .filter(({ key }) => !String(draft[key] ?? "").trim())
    .map(({ label }) => label);
}
