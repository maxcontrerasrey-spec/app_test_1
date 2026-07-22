import { useEffect, useState } from "react";
import {
  applyCandidateBukWorkerDefaults,
  collectCandidateBukWorkerMissingFields,
  healthProviderRequiresPlan,
  isFonasaBukHealthProvider
} from "../lib/candidateBukWorkerRules";
import {
  getCandidateEmailValidationMessage,
  validateOptionalCandidateEmail
} from "../lib/candidateEmail";
import {
  fetchCandidateBukProfile,
  updateCandidatePersonProfile,
  updateCandidateWorkerFile,
  type CandidateBukProfileDetails,
  type RecruitmentCaseCandidateRow,
  type RecruitmentCaseDetail
} from "../services/hiringControl";
import { CandidateWorkerFileFormContent } from "./CandidateWorkerFileFormContent";

type CandidateWorkerFileFormProps = {
  candidate: RecruitmentCaseCandidateRow;
  caseDetail: RecruitmentCaseDetail;
  readOnly?: boolean;
  onSaved?: () => Promise<void>;
};

import {
  buildDerivedAddressLine,
  buildPersonDraft,
  buildWorkerDraft,
  collectMissingFields,
  parseNullableInteger,
  parseNullableNumber,
  requiredPersonFields,
  type PersonDraft,
  type WorkerDraft,
} from "../lib/candidateWorkerFileFormHelpers";
export function CandidateWorkerFileForm({
  candidate,
  caseDetail,
  readOnly = false,
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
  const [touchedPersonEmails, setTouchedPersonEmails] = useState({
    companyEmail: false,
    personalEmail: false
  });

  const syncDraftsFromProfile = (
    profile: CandidateBukProfileDetails | null,
    candidateRow: RecruitmentCaseCandidateRow,
    detail: RecruitmentCaseDetail
  ) => {
    setBukProfile(profile);
    setPersonDraft(buildPersonDraft(candidateRow, profile));
    setWorkerDraft(buildWorkerDraft(candidateRow, detail, profile));
    setTouchedPersonEmails({ companyEmail: false, personalEmail: false });
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
    if (readOnly) return;

    setIsPersonSaving(true);
    setPersonMessage("");

    const derivedAddressLine = buildDerivedAddressLine(personDraft);
    const normalizedPersonDraft = {
      ...personDraft,
      addressLine: derivedAddressLine
    };
    const missingFields = collectMissingFields(normalizedPersonDraft, requiredPersonFields);
    const companyEmailValidation = validateOptionalCandidateEmail(personDraft.companyEmail);
    const personalEmailValidation = validateOptionalCandidateEmail(personDraft.personalEmail);

    if (missingFields.length > 0) {
      setPersonMessage(`Completa campos BUK obligatorios: ${missingFields.join(", ")}.`);
      setIsPersonSaving(false);
      return;
    }

    if (!companyEmailValidation.isValid || !personalEmailValidation.isValid) {
      setTouchedPersonEmails({ companyEmail: true, personalEmail: true });
      setPersonMessage(
        [
          getCandidateEmailValidationMessage("El email corporativo", personDraft.companyEmail),
          getCandidateEmailValidationMessage("El email personal", personDraft.personalEmail)
        ]
          .filter(Boolean)
          .join(" ")
      );
      setIsPersonSaving(false);
      return;
    }

    setPersonDraft((current) => ({
      ...current,
      addressLine: derivedAddressLine,
      companyEmail: companyEmailValidation.normalized,
      personalEmail: personalEmailValidation.normalized
    }));

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
      companyEmail: companyEmailValidation.normalized,
      personalEmail: personalEmailValidation.normalized,
      privatePhone: personDraft.privatePhone,
      officePhone: personDraft.officePhone,
      country: personDraft.country,
      addressLine: derivedAddressLine,
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
    if (readOnly) return;

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
  const companyEmailValidation = validateOptionalCandidateEmail(personDraft.companyEmail);
  const personalEmailValidation = validateOptionalCandidateEmail(personDraft.personalEmail);
  const shouldShowCompanyEmailError =
    touchedPersonEmails.companyEmail && !companyEmailValidation.isValid;
  const shouldShowPersonalEmailError =
    touchedPersonEmails.personalEmail && !personalEmailValidation.isValid;
  const derivedAddressLine = buildDerivedAddressLine(personDraft);

  return (
    <CandidateWorkerFileFormContent
      readOnly={readOnly}
      isProfileLoading={isProfileLoading}
      personDraft={personDraft}
      setPersonDraft={setPersonDraft}
      workerDraft={workerDraft}
      setWorkerDraft={setWorkerDraft}
      updateWorkerDraft={updateWorkerDraft}
      touchedPersonEmails={touchedPersonEmails}
      setTouchedPersonEmails={setTouchedPersonEmails}
      shouldShowCompanyEmailError={shouldShowCompanyEmailError}
      shouldShowPersonalEmailError={shouldShowPersonalEmailError}
      derivedAddressLine={derivedAddressLine}
      personMessage={personMessage}
      workerMessage={workerMessage}
      isPersonSaving={isPersonSaving}
      isWorkerSaving={isWorkerSaving}
      healthProviderRequiresUfPlan={healthProviderRequiresUfPlan}
      usesAutomaticFonasaPlan={usesAutomaticFonasaPlan}
      setPersonMessage={setPersonMessage}
      handlePersonSave={handlePersonSave}
      handleWorkerSave={handleWorkerSave}
    />
  );
}
