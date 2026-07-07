import { useEffect, useState } from "react";
import { TextField } from "../../../shared/ui/forms/TextField";
import { SearchableSelectField as SelectField } from "../../../shared/ui/forms/SearchableSelectField";
import { formatRut, normalizeRut } from "../../../shared/lib/rut";
import { bukEmployeeFieldOptions } from "../lib/bukEmployeeTemplate";
import {
  applyCandidateBukWorkerDefaults,
  collectCandidateBukWorkerMissingFields,
  healthProviderRequiresPlan,
  isFonasaBukHealthProvider
} from "../lib/candidateBukWorkerRules";
import {
  fetchCandidateBukProfile,
  updateCandidatePersonProfile,
  updateCandidateWorkerFile,
  type CandidateBukProfileDetails,
  type RecruitmentCaseCandidateRow,
  type RecruitmentCaseDetail
} from "../services/hiringControl";

type CandidateWorkerFileFormProps = {
  candidate: RecruitmentCaseCandidateRow;
  caseDetail: RecruitmentCaseDetail;
  onSaved?: () => Promise<void>;
};

type PersonDraft = {
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

type WorkerDraft = {
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

const firefighterStatusOptions = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
  { value: "no_informa", label: "No informa" }
];

const yesNoBukOptions = [
  { value: "Sí", label: "Sí" },
  { value: "No", label: "No" }
];

const bukPaymentPeriodOptions = [
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
  { value: "quincenal", label: "Quincenal" },
  { value: "diario", label: "Diario" },
  { value: "por_hora", label: "Por hora" }
];

function looksLikeRut(value: string | null | undefined) {
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

const requiredPersonFields: Array<{ key: keyof PersonDraft; label: string }> = [
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
  { key: "districtOrCommune", label: "Comuna" }
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

function buildPersonDraft(
  candidate: RecruitmentCaseCandidateRow,
  bukProfile: CandidateBukProfileDetails | null
): PersonDraft {
  const fallbackName = splitFullName(candidate.full_name);

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
    addressLine: bukProfile?.address_line ?? candidate.address_line ?? "",
    districtOrCommune: bukProfile?.district_or_commune ?? candidate.district_or_commune ?? "",
    currentCity: bukProfile?.current_city ?? candidate.current_city ?? "",
    region: bukProfile?.region ?? candidate.region ?? "",
    streetName: bukProfile?.street_name ?? "",
    streetNumber: bukProfile?.street_number ?? "",
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

function buildWorkerDraft(
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

function parseNullableNumber(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const normalized = Number(value.replace(",", "."));
  return Number.isNaN(normalized) ? null : normalized;
}

function parseNullableInteger(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const normalized = Number.parseInt(value, 10);
  return Number.isNaN(normalized) ? null : normalized;
}

function collectMissingFields<T extends Record<string, string>>(
  draft: T,
  requiredFields: Array<{ key: keyof T; label: string }>
) {
  return requiredFields
    .filter(({ key }) => !String(draft[key] ?? "").trim())
    .map(({ label }) => label);
}

export function CandidateWorkerFileForm({
  candidate,
  caseDetail,
  onSaved
}: CandidateWorkerFileFormProps) {
  const [bukProfile, setBukProfile] = useState<CandidateBukProfileDetails | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [personDraft, setPersonDraft] = useState<PersonDraft>(() => buildPersonDraft(candidate, null));
  const [workerDraft, setWorkerDraft] = useState<WorkerDraft>(() =>
    buildWorkerDraft(candidate, caseDetail, null)
  );
  const [isPersonSaving, setIsPersonSaving] = useState(false);
  const [isWorkerSaving, setIsWorkerSaving] = useState(false);
  const [personMessage, setPersonMessage] = useState("");
  const [workerMessage, setWorkerMessage] = useState("");

  const syncDraftsFromProfile = (
    profile: CandidateBukProfileDetails | null,
    candidateRow: RecruitmentCaseCandidateRow,
    detail: RecruitmentCaseDetail
  ) => {
    setBukProfile(profile);
    setPersonDraft(buildPersonDraft(candidateRow, profile));
    setWorkerDraft(buildWorkerDraft(candidateRow, detail, profile));
  };

  const updateWorkerDraft = (patch: Partial<WorkerDraft>) => {
    setWorkerDraft((current) => applyCandidateBukWorkerDefaults({ ...current, ...patch }));
  };

  useEffect(() => {
    let active = true;

    async function loadBukProfile() {
      setIsProfileLoading(true);
      setPersonMessage("");
      setWorkerMessage("");

      const { data, error } = await fetchCandidateBukProfile(candidate.id);

      if (!active) {
        return;
      }

      if (error) {
        syncDraftsFromProfile(null, candidate, caseDetail);
        setPersonMessage(error);
        setIsProfileLoading(false);
        return;
      }

      syncDraftsFromProfile(data, candidate, caseDetail);
      setIsProfileLoading(false);
    }

    void loadBukProfile();

    return () => {
      active = false;
    };
  }, [candidate, caseDetail]);

  const handlePersonSave = async () => {
    setIsPersonSaving(true);
    setPersonMessage("");

    const missingFields = collectMissingFields(personDraft, requiredPersonFields);

    if (missingFields.length > 0) {
      setPersonMessage(`Completa campos BUK obligatorios: ${missingFields.join(", ")}.`);
      setIsPersonSaving(false);
      return;
    }

    const { error } = await updateCandidatePersonProfile({
      caseCandidateId: candidate.id,
      documentType: personDraft.documentType,
      documentNumber: personDraft.documentNumber,
      firstName: personDraft.firstName,
      lastName: personDraft.lastName,
      secondLastName: personDraft.secondLastName,
      gender: personDraft.gender,
      birthDate: personDraft.birthDate || null,
      nationality: personDraft.nationality,
      maritalStatus: personDraft.maritalStatus,
      companyEmail: personDraft.companyEmail,
      personalEmail: personDraft.personalEmail,
      privatePhone: personDraft.privatePhone,
      officePhone: personDraft.officePhone,
      country: personDraft.country,
      addressLine: personDraft.addressLine,
      districtOrCommune: personDraft.districtOrCommune,
      currentCity: personDraft.currentCity,
      region: personDraft.region,
      streetName: personDraft.streetName,
      streetNumber: personDraft.streetNumber,
      apartmentOrOffice: personDraft.apartmentOrOffice,
      educationTitle: personDraft.educationTitle,
      educationInstitution: personDraft.educationInstitution,
      emergencyContactName: personDraft.emergencyContactName,
      emergencyContactPhone: personDraft.emergencyContactPhone,
      emergencyContactRelationship: personDraft.emergencyContactRelationship,
      disabilityStatus: personDraft.disabilityStatus,
      disabilityNoticeDate: personDraft.disabilityNoticeDate || null,
      invalidityStatus: personDraft.invalidityStatus,
      invalidityNoticeDate: personDraft.invalidityNoticeDate || null,
      inclusionNotes: personDraft.inclusionNotes,
      laborInclusion: personDraft.laborInclusion,
      firefighterStatus: personDraft.firefighterStatus,
      foreignWorker: personDraft.foreignWorker,
      shirtSize: personDraft.shirtSize,
      pantsSize: personDraft.pantsSize,
      shoeSize: personDraft.shoeSize
    });

    if (error) {
      setPersonMessage(error);
      setIsPersonSaving(false);
      return;
    }

    const refreshedProfile = await fetchCandidateBukProfile(candidate.id);

    if (!refreshedProfile.error) {
      syncDraftsFromProfile(refreshedProfile.data, candidate, caseDetail);
    }

    await onSaved?.();
    setPersonMessage("Ficha personal BUK actualizada.");
    setIsPersonSaving(false);
  };

  const handleWorkerSave = async () => {
    setIsWorkerSaving(true);
    setWorkerMessage("");

    const normalizedWorkerDraft = applyCandidateBukWorkerDefaults(workerDraft);
    setWorkerDraft(normalizedWorkerDraft);

    const missingFields = collectCandidateBukWorkerMissingFields(normalizedWorkerDraft);

    if (missingFields.length > 0) {
      setWorkerMessage(`Completa campos BUK obligatorios: ${missingFields.join(", ")}.`);
      setIsWorkerSaving(false);
      return;
    }

    const numericAdvanceAmount = parseNullableNumber(normalizedWorkerDraft.advanceAmount);
    const numericHealthPlanUf = parseNullableNumber(normalizedWorkerDraft.healthPlanUf);
    const numericHealthPlanPesos = parseNullableNumber(normalizedWorkerDraft.healthPlanPesos);
    const numericHealthPlanPercentage = parseNullableNumber(
      normalizedWorkerDraft.healthPlanPercentage
    );
    const simpleLoadCount = parseNullableInteger(normalizedWorkerDraft.simpleLoadCount);
    const maternalLoadCount = parseNullableInteger(normalizedWorkerDraft.maternalLoadCount);
    const invalidLoadCount = parseNullableInteger(normalizedWorkerDraft.invalidLoadCount);

    if (
      normalizedWorkerDraft.advanceAmount.trim() !== "" &&
      (numericAdvanceAmount == null || numericAdvanceAmount < 0)
    ) {
      setWorkerMessage("El anticipo debe ser un monto numérico válido.");
      setIsWorkerSaving(false);
      return;
    }

    const { error } = await updateCandidateWorkerFile({
      caseCandidateId: candidate.id,
      employeeCode: normalizedWorkerDraft.employeeCode,
      projectName: normalizedWorkerDraft.projectName,
      companyEntryDate: normalizedWorkerDraft.companyEntryDate || null,
      shiftName: normalizedWorkerDraft.shiftName,
      advanceAmount: numericAdvanceAmount,
      contractNotes: normalizedWorkerDraft.contractNotes,
      privateRole: normalizedWorkerDraft.privateRole,
      afcStartDate: normalizedWorkerDraft.afcStartDate || null,
      seniorityRecognitionDate: normalizedWorkerDraft.seniorityRecognitionDate || null,
      progressiveVacationStartDate: normalizedWorkerDraft.progressiveVacationStartDate || null,
      paymentMethod: normalizedWorkerDraft.paymentMethod,
      paymentPeriod: normalizedWorkerDraft.paymentPeriod,
      bankName: normalizedWorkerDraft.bankName,
      bankAccountType: normalizedWorkerDraft.bankAccountType,
      bankAccountNumber: normalizedWorkerDraft.bankAccountNumber,
      bankBranchCode: normalizedWorkerDraft.bankBranchCode,
      valeVistaType: normalizedWorkerDraft.valeVistaType,
      pensionRegime: normalizedWorkerDraft.pensionRegime,
      contributionFund: normalizedWorkerDraft.contributionFund,
      afpCollectionEntity: normalizedWorkerDraft.afpCollectionEntity,
      increaseQuoteOnePercent: normalizedWorkerDraft.increaseQuoteOnePercent,
      healthProvider: normalizedWorkerDraft.healthProvider,
      healthPlanUf: numericHealthPlanUf,
      healthPlanPesos: numericHealthPlanPesos,
      healthPlanPercentage: numericHealthPlanPercentage,
      afcRegime: normalizedWorkerDraft.afcRegime,
      retiredStatus: normalizedWorkerDraft.retiredStatus,
      retirementRegime: normalizedWorkerDraft.retirementRegime,
      accountTwoFund: normalizedWorkerDraft.accountTwoFund,
      accountTwoPlan: normalizedWorkerDraft.accountTwoPlan,
      currency: normalizedWorkerDraft.currency,
      simpleLoadCount,
      maternalLoadCount,
      invalidLoadCount,
      familyAllowanceSection: normalizedWorkerDraft.familyAllowanceSection,
      personalDataUpdateDate: normalizedWorkerDraft.personalDataUpdateDate || null
    });

    if (error) {
      setWorkerMessage(error);
      setIsWorkerSaving(false);
      return;
    }

    const refreshedProfile = await fetchCandidateBukProfile(candidate.id);

    if (!refreshedProfile.error) {
      syncDraftsFromProfile(refreshedProfile.data, candidate, caseDetail);
    }

    await onSaved?.();
    setWorkerMessage("Ficha contractual BUK actualizada.");
    setIsWorkerSaving(false);
  };

  const healthProviderRequiresUfPlan = healthProviderRequiresPlan(workerDraft.healthProvider);
  const usesAutomaticFonasaPlan = isFonasaBukHealthProvider(workerDraft.healthProvider);

  return (
    <div className="control-detail-body">
      <section className="worker-file-section">
        <div className="worker-file-section-header">
          <div>
            <small>Base BUK</small>
            <h4>Identidad y contacto del trabajador</h4>
          </div>
        </div>

        {isProfileLoading ? <p className="tracking-filter-caption">Cargando ficha BUK...</p> : null}

        <div className="control-edit-grid worker-file-grid">
          <SelectField
            id="candidate-document-type"
            label="Tipo de documento"
            value={personDraft.documentType}
            options={bukEmployeeFieldOptions.documentType}
            placeholder="Selecciona tipo"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, documentType: event.target.value }))
            }
          />
          <TextField
            id="candidate-document-number"
            label="Número de documento"
            value={personDraft.documentNumber}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                documentNumber:
                  current.documentType === "RUT" || looksLikeRut(event.target.value)
                    ? formatRut(event.target.value)
                    : event.target.value
              }))
            }
          />
          <TextField
            id="candidate-first-name"
            label="Nombre"
            value={personDraft.firstName}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, firstName: event.target.value }))
            }
          />
          <TextField
            id="candidate-last-name"
            label="Apellido"
            value={personDraft.lastName}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, lastName: event.target.value }))
            }
          />
          <TextField
            id="candidate-second-last-name"
            label="Segundo apellido"
            value={personDraft.secondLastName}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                secondLastName: event.target.value
              }))
            }
          />
          <SelectField
            id="candidate-gender"
            label="Sexo"
            value={personDraft.gender}
            options={bukEmployeeFieldOptions.gender}
            placeholder="Selecciona sexo"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, gender: event.target.value }))
            }
          />
          <TextField
            id="candidate-birth-date"
            label="Fecha de nacimiento"
            type="date"
            value={personDraft.birthDate}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, birthDate: event.target.value }))
            }
          />
          <SelectField
            id="candidate-nationality"
            label="Nacionalidad"
            value={personDraft.nationality}
            options={bukEmployeeFieldOptions.nationality}
            placeholder="Selecciona nacionalidad"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, nationality: event.target.value }))
            }
          />
          <SelectField
            id="candidate-marital-status"
            label="Estado civil"
            value={personDraft.maritalStatus}
            options={bukEmployeeFieldOptions.maritalStatus}
            placeholder="Selecciona estado civil"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                maritalStatus: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-company-email"
            label="Email corporativo"
            type="email"
            value={personDraft.companyEmail}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, companyEmail: event.target.value }))
            }
          />
          <TextField
            id="candidate-personal-email"
            label="Email personal"
            type="email"
            value={personDraft.personalEmail}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, personalEmail: event.target.value }))
            }
          />
          <TextField
            id="candidate-private-phone"
            label="Teléfono particular"
            value={personDraft.privatePhone}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, privatePhone: event.target.value }))
            }
          />
          <TextField
            id="candidate-office-phone"
            label="Teléfono oficina"
            value={personDraft.officePhone}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, officePhone: event.target.value }))
            }
          />
          <TextField
            id="candidate-country"
            label="País"
            value={personDraft.country}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, country: event.target.value }))
            }
          />
        </div>
      </section>

      <section className="worker-file-section">
        <div className="worker-file-section-header">
          <div>
            <small>Base BUK</small>
            <h4>Domicilio, estudios e inclusión</h4>
          </div>
        </div>

        <div className="control-edit-grid worker-file-grid">
          <TextField
            id="candidate-address-line"
            label="Dirección base"
            value={personDraft.addressLine}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, addressLine: event.target.value }))
            }
            className="control-span-full"
          />
          <SelectField
            id="candidate-region"
            label="Región"
            value={personDraft.region}
            options={bukEmployeeFieldOptions.region}
            placeholder="Selecciona región"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, region: event.target.value }))
            }
          />
          <SelectField
            id="candidate-commune"
            label="Comuna"
            value={personDraft.districtOrCommune}
            options={bukEmployeeFieldOptions.commune}
            placeholder="Selecciona comuna"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                districtOrCommune: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-city"
            label="Ciudad"
            value={personDraft.currentCity}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, currentCity: event.target.value }))
            }
          />
          <TextField
            id="candidate-street-name"
            label="Calle"
            value={personDraft.streetName}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, streetName: event.target.value }))
            }
          />
          <TextField
            id="candidate-street-number"
            label="Número de calle"
            value={personDraft.streetNumber}
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, streetNumber: event.target.value }))
            }
          />
          <TextField
            id="candidate-apartment"
            label="Depto / Oficina"
            value={personDraft.apartmentOrOffice}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                apartmentOrOffice: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-title"
            label="Título"
            value={personDraft.educationTitle}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                educationTitle: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-institution"
            label="Institución"
            value={personDraft.educationInstitution}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                educationInstitution: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-emergency-name"
            label="Contacto de emergencia"
            value={personDraft.emergencyContactName}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                emergencyContactName: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-emergency-phone"
            label="Teléfono de emergencia"
            value={personDraft.emergencyContactPhone}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                emergencyContactPhone: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-emergency-relationship"
            label="Relación contacto"
            value={personDraft.emergencyContactRelationship}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                emergencyContactRelationship: event.target.value
              }))
            }
          />
          <SelectField
            id="candidate-disability-status"
            label="Situación de discapacidad"
            value={personDraft.disabilityStatus}
            options={bukEmployeeFieldOptions.disabilityStatus}
            placeholder="Selecciona estado"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                disabilityStatus: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-disability-notice-date"
            label="Fecha notificación discapacidad"
            type="date"
            value={personDraft.disabilityNoticeDate}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                disabilityNoticeDate: event.target.value
              }))
            }
          />
          <SelectField
            id="candidate-invalidity-status"
            label="Situación de invalidez"
            value={personDraft.invalidityStatus}
            options={bukEmployeeFieldOptions.invalidityStatus}
            placeholder="Selecciona estado"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                invalidityStatus: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-invalidity-notice-date"
            label="Fecha notificación invalidez"
            type="date"
            value={personDraft.invalidityNoticeDate}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                invalidityNoticeDate: event.target.value
              }))
            }
          />
          <SelectField
            id="candidate-foreign-worker"
            label="Trabajador extranjero"
            value={personDraft.foreignWorker}
            options={yesNoBukOptions}
            placeholder="Selecciona condición"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                foreignWorker: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-labor-inclusion"
            label="Inclusión laboral"
            value={personDraft.laborInclusion}
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                laborInclusion: event.target.value
              }))
            }
          />
          <SelectField
            id="candidate-firefighter-status"
            label="Bomberos"
            value={personDraft.firefighterStatus}
            options={firefighterStatusOptions}
            placeholder="Selecciona condición"
            onChange={(event) =>
              setPersonDraft((current) => ({
                ...current,
                firefighterStatus: event.target.value
              }))
            }
          />
          <SelectField
            id="candidate-shoe-size"
            label="Número calzado"
            value={personDraft.shoeSize}
            options={bukEmployeeFieldOptions.shoeSize}
            placeholder="Selecciona talla"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, shoeSize: event.target.value }))
            }
          />
          <SelectField
            id="candidate-pants-size"
            label="Talla pantalón"
            value={personDraft.pantsSize}
            options={bukEmployeeFieldOptions.pantsSize}
            placeholder="Selecciona talla"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, pantsSize: event.target.value }))
            }
          />
          <SelectField
            id="candidate-shirt-size"
            label="Talla polera"
            value={personDraft.shirtSize}
            options={bukEmployeeFieldOptions.shirtSize}
            placeholder="Selecciona talla"
            onChange={(event) =>
              setPersonDraft((current) => ({ ...current, shirtSize: event.target.value }))
            }
          />
          <div className="field-group control-span-full">
            <label className="field-label" htmlFor="candidate-inclusion-notes">
              Notas de inclusión / observaciones
            </label>
            <textarea
              id="candidate-inclusion-notes"
              className="worker-file-textarea"
              value={personDraft.inclusionNotes}
              onChange={(event) =>
                setPersonDraft((current) => ({
                  ...current,
                  inclusionNotes: event.target.value
                }))
              }
            />
          </div>
        </div>

        {personMessage ? (
          <p
            className={`worker-file-feedback ${personMessage.includes("actualizada") ? "success" : "error"}`}
          >
            {personMessage}
          </p>
        ) : null}

        <div className="worker-file-actions">
          <button
            type="button"
            className="soft-primary-button approval-button-approve"
            onClick={() => void handlePersonSave()}
            disabled={isPersonSaving || isProfileLoading}
          >
            {isPersonSaving ? "Guardando..." : "Guardar ficha personal BUK"}
          </button>
        </div>
      </section>

      <section className="worker-file-section">
        <div className="worker-file-section-header">
          <div>
            <small>Base BUK</small>
            <h4>Previsión, pagos y datos del ingreso</h4>
          </div>
        </div>

        <div className="control-edit-grid worker-file-grid">
          <TextField
            id="candidate-employee-code"
            label="Código de ficha"
            value={workerDraft.employeeCode}
            onChange={(event) =>
              updateWorkerDraft({ employeeCode: event.target.value })
            }
          />
          <TextField
            id="candidate-entry-date"
            label="Ingreso compañía"
            type="date"
            value={workerDraft.companyEntryDate}
            onChange={(event) =>
              updateWorkerDraft({ companyEntryDate: event.target.value })
            }
          />
          <SelectField
            id="candidate-private-role"
            label="Rol privado"
            value={workerDraft.privateRole}
            options={bukEmployeeFieldOptions.privateRole}
            placeholder="Selecciona opción"
            onChange={(event) =>
              updateWorkerDraft({ privateRole: event.target.value })
            }
          />
          <TextField
            id="candidate-afc-start-date"
            label="Inicio cotización AFC"
            type="date"
            value={workerDraft.afcStartDate}
            onChange={(event) =>
              updateWorkerDraft({ afcStartDate: event.target.value })
            }
          />
          <TextField
            id="candidate-seniority-recognition-date"
            label="Reconocimiento antigüedad"
            type="date"
            value={workerDraft.seniorityRecognitionDate}
            onChange={(event) =>
              updateWorkerDraft({ seniorityRecognitionDate: event.target.value })
            }
          />
          <TextField
            id="candidate-progressive-vacation-start-date"
            label="Inicio vacaciones progresivas"
            type="date"
            value={workerDraft.progressiveVacationStartDate}
            onChange={(event) =>
              updateWorkerDraft({ progressiveVacationStartDate: event.target.value })
            }
          />
          <SelectField
            id="candidate-payment-method"
            label="Forma de pago"
            value={workerDraft.paymentMethod}
            options={bukEmployeeFieldOptions.paymentMethod}
            placeholder="Selecciona forma de pago"
            onChange={(event) =>
              updateWorkerDraft({ paymentMethod: event.target.value })
            }
          />
          <SelectField
            id="candidate-payment-period"
            label="Periodo de pago"
            value={workerDraft.paymentPeriod}
            options={bukPaymentPeriodOptions}
            placeholder="Selecciona periodo"
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, paymentPeriod: event.target.value }))
            }
          />
          <SelectField
            id="candidate-bank-name"
            label="Banco"
            value={workerDraft.bankName}
            options={bukEmployeeFieldOptions.bank}
            placeholder="Selecciona banco"
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, bankName: event.target.value }))
            }
          />
          <SelectField
            id="candidate-bank-account-type"
            label="Tipo de cuenta"
            value={workerDraft.bankAccountType}
            options={bukEmployeeFieldOptions.bankAccountType}
            placeholder="Selecciona tipo"
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                bankAccountType: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-bank-account-number"
            label="Número de cuenta"
            value={workerDraft.bankAccountNumber}
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                bankAccountNumber: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-bank-branch-code"
            label="Código sucursal"
            value={workerDraft.bankBranchCode}
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, bankBranchCode: event.target.value }))
            }
          />
          <SelectField
            id="candidate-vale-vista-type"
            label="Tipo vale vista"
            value={workerDraft.valeVistaType}
            options={bukEmployeeFieldOptions.valeVistaType}
            placeholder="Selecciona tipo"
            onChange={(event) =>
              updateWorkerDraft({ valeVistaType: event.target.value })
            }
          />
          <SelectField
            id="candidate-pension-regime"
            label="Régimen previsional"
            value={workerDraft.pensionRegime}
            options={bukEmployeeFieldOptions.pensionRegime}
            placeholder="Selecciona régimen"
            onChange={(event) =>
              updateWorkerDraft({ pensionRegime: event.target.value })
            }
          />
          <SelectField
            id="candidate-contribution-fund"
            label="Fondo de cotización"
            value={workerDraft.contributionFund}
            options={bukEmployeeFieldOptions.contributionFund}
            placeholder="Selecciona fondo"
            onChange={(event) =>
              updateWorkerDraft({ contributionFund: event.target.value })
            }
          />
          <TextField
            id="candidate-afp-collection-entity"
            label="AFP recaudadora"
            value={workerDraft.afpCollectionEntity}
            onChange={(event) =>
              updateWorkerDraft({ afpCollectionEntity: event.target.value })
            }
          />
          <SelectField
            id="candidate-increase-quote-one-percent"
            label="Aumentar cotización 1%"
            value={workerDraft.increaseQuoteOnePercent}
            options={yesNoBukOptions}
            placeholder="Selecciona opción"
            onChange={(event) =>
              updateWorkerDraft({ increaseQuoteOnePercent: event.target.value })
            }
          />
          <SelectField
            id="candidate-health-provider"
            label="Fonasa / Isapre"
            value={workerDraft.healthProvider}
            options={bukEmployeeFieldOptions.healthProvider}
            placeholder="Selecciona prestador"
            onChange={(event) =>
              updateWorkerDraft({ healthProvider: event.target.value })
            }
          />
          <TextField
            id="candidate-health-plan-uf"
            label="Plan Isapre UF"
            value={workerDraft.healthPlanUf}
            inputMode="decimal"
            disabled={!healthProviderRequiresUfPlan}
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, healthPlanUf: event.target.value }))
            }
          />
          <TextField
            id="candidate-health-plan-pesos"
            label="Plan Isapre pesos"
            value={workerDraft.healthPlanPesos}
            inputMode="decimal"
            disabled
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                healthPlanPesos: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-health-plan-percentage"
            label="Plan Isapre porcentual"
            value={workerDraft.healthPlanPercentage}
            inputMode="decimal"
            disabled
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                healthPlanPercentage: event.target.value
              }))
            }
          />
          <div className="control-span-full">
            <p className="tracking-filter-caption">
              {usesAutomaticFonasaPlan
                ? "Fonasa se completa automáticamente con plan porcentual 7% para el envío a BUK."
                : healthProviderRequiresUfPlan
                  ? "Si el prestador es Isapre, Plan Isapre UF es obligatorio."
                  : "Mutual y No Cotiza Salud no requieren plan adicional."}
            </p>
          </div>
          <SelectField
            id="candidate-afc-regime"
            label="AFC"
            value={workerDraft.afcRegime}
            options={bukEmployeeFieldOptions.afcRegime}
            placeholder="Selecciona tramo"
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, afcRegime: event.target.value }))
            }
          />
          <SelectField
            id="candidate-retired-status"
            label="Jubilado"
            value={workerDraft.retiredStatus}
            options={bukEmployeeFieldOptions.retiredStatus}
            placeholder="Selecciona condición"
            onChange={(event) =>
              updateWorkerDraft({ retiredStatus: event.target.value })
            }
          />
          <SelectField
            id="candidate-retirement-regime"
            label="Régimen jubilación"
            value={workerDraft.retirementRegime}
            options={bukEmployeeFieldOptions.retirementRegime}
            placeholder="Selecciona régimen"
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                retirementRegime: event.target.value
              }))
            }
          />
          <SelectField
            id="candidate-account-two-fund"
            label="Cuenta 2"
            value={workerDraft.accountTwoFund}
            options={bukEmployeeFieldOptions.accountTwoFund}
            placeholder="Selecciona fondo"
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, accountTwoFund: event.target.value }))
            }
          />
          <TextField
            id="candidate-account-two-plan"
            label="Plan cuenta 2"
            value={workerDraft.accountTwoPlan}
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, accountTwoPlan: event.target.value }))
            }
          />
          <SelectField
            id="candidate-currency"
            label="Moneda"
            value={workerDraft.currency}
            options={bukEmployeeFieldOptions.currency}
            placeholder="Selecciona moneda"
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, currency: event.target.value }))
            }
          />
          <TextField
            id="candidate-simple-load-count"
            label="Carga simple"
            value={workerDraft.simpleLoadCount}
            inputMode="numeric"
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                simpleLoadCount: event.target.value.replace(/[^\d]/g, "")
              }))
            }
          />
          <TextField
            id="candidate-maternal-load-count"
            label="Carga maternal"
            value={workerDraft.maternalLoadCount}
            inputMode="numeric"
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                maternalLoadCount: event.target.value.replace(/[^\d]/g, "")
              }))
            }
          />
          <TextField
            id="candidate-invalid-load-count"
            label="Carga inválida"
            value={workerDraft.invalidLoadCount}
            inputMode="numeric"
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                invalidLoadCount: event.target.value.replace(/[^\d]/g, "")
              }))
            }
          />
          <SelectField
            id="candidate-family-allowance-section"
            label="Tramo de asignación"
            value={workerDraft.familyAllowanceSection}
            options={bukEmployeeFieldOptions.familyAllowanceSection}
            placeholder="Selecciona tramo"
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                familyAllowanceSection: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-personal-data-update-date"
            label="Actualización datos personales"
            type="date"
            value={workerDraft.personalDataUpdateDate}
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                personalDataUpdateDate: event.target.value
              }))
            }
          />
          <TextField
            id="candidate-project-name"
            label="Proyecto / contrato"
            value={workerDraft.projectName}
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, projectName: event.target.value }))
            }
          />
          <TextField
            id="candidate-shift-name"
            label="Turno"
            value={workerDraft.shiftName}
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, shiftName: event.target.value }))
            }
          />
          <TextField
            id="candidate-advance-amount"
            label="Monto anticipo"
            value={workerDraft.advanceAmount}
            inputMode="decimal"
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                advanceAmount: event.target.value.replace(/[^\d.,-]/g, "")
              }))
            }
          />
          <div className="field-group control-span-full">
            <label className="field-label" htmlFor="candidate-contract-notes">
              Observaciones del ingreso actual
            </label>
            <textarea
              id="candidate-contract-notes"
              className="worker-file-textarea"
              value={workerDraft.contractNotes}
              onChange={(event) =>
                setWorkerDraft((current) => ({ ...current, contractNotes: event.target.value }))
              }
            />
          </div>
        </div>

        {workerMessage ? (
          <p
            className={`worker-file-feedback ${workerMessage.includes("actualizada") ? "success" : "error"}`}
          >
            {workerMessage}
          </p>
        ) : null}

        <div className="worker-file-actions">
          <button
            type="button"
            className="soft-primary-button approval-button-approve"
            onClick={() => void handleWorkerSave()}
            disabled={isWorkerSaving || isProfileLoading}
          >
            {isWorkerSaving ? "Guardando..." : "Guardar ficha contractual BUK"}
          </button>
        </div>
      </section>
    </div>
  );
}
