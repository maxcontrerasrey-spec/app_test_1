type CandidateBukWorkerDraftLike = {
  employeeCode: string;
  companyEntryDate: string;
  privateRole: string;
  afcStartDate: string;
  seniorityRecognitionDate: string;
  progressiveVacationStartDate: string;
  paymentMethod: string;
  paymentPeriod: string;
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
};

function normalizeBukText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function isAffirmativeBukValue(value: string | null | undefined) {
  const normalized = normalizeBukText(value);
  return normalized === "si" || normalized === "true" || normalized === "yes";
}

export function healthProviderRequiresPlan(value: string | null | undefined) {
  const normalized = normalizeBukText(value);

  if (!normalized) {
    return false;
  }

  return !["fonasa", "mutual", "no cotiza salud", "no cotiza"].includes(normalized);
}

export function isFonasaBukHealthProvider(value: string | null | undefined) {
  return normalizeBukText(value) === "fonasa";
}

export function hasAnyHealthPlanValue(draft: Pick<
  CandidateBukWorkerDraftLike,
  "healthPlanUf" | "healthPlanPesos" | "healthPlanPercentage"
>) {
  return [draft.healthPlanUf, draft.healthPlanPesos, draft.healthPlanPercentage].some((value) =>
    Boolean(value.trim())
  );
}

export function applyCandidateBukWorkerDefaults<T extends CandidateBukWorkerDraftLike>(draft: T): T {
  const requiresHealthPlan = healthProviderRequiresPlan(draft.healthProvider);
  const isFonasa = isFonasaBukHealthProvider(draft.healthProvider);
  const isRetired = isAffirmativeBukValue(draft.retiredStatus);
  const pensionRegime = normalizeBukText(draft.pensionRegime);
  const paymentMethod = normalizeBukText(draft.paymentMethod);
  const companyEntryDate = draft.companyEntryDate.trim();

  return {
    ...draft,
    privateRole: draft.privateRole.trim() || "No",
    afcStartDate: draft.afcStartDate.trim() || companyEntryDate,
    seniorityRecognitionDate: draft.seniorityRecognitionDate.trim() || companyEntryDate,
    progressiveVacationStartDate:
      draft.progressiveVacationStartDate.trim() || companyEntryDate,
    valeVistaType: paymentMethod === "vale vista" ? draft.valeVistaType : "",
    afpCollectionEntity:
      draft.afpCollectionEntity.trim() ||
      (pensionRegime === "afp" ? draft.contributionFund.trim() : ""),
    increaseQuoteOnePercent: draft.increaseQuoteOnePercent.trim() || "No",
    afcRegime: draft.afcRegime.trim() || "Menos de 11 Años",
    healthPlanUf: requiresHealthPlan ? draft.healthPlanUf : "",
    healthPlanPesos: "",
    healthPlanPercentage: isFonasa ? "7" : "",
    retirementRegime: isRetired ? draft.retirementRegime : ""
  };
}

export function collectCandidateBukWorkerMissingFields(draft: CandidateBukWorkerDraftLike) {
  const normalizedDraft = applyCandidateBukWorkerDefaults(draft);
  const missingFields: string[] = [];

  if (!normalizedDraft.employeeCode.trim()) missingFields.push("Código de ficha");
  if (!normalizedDraft.companyEntryDate.trim()) missingFields.push("Ingreso compañía");
  if (!normalizedDraft.privateRole.trim()) missingFields.push("Rol privado");
  if (!normalizedDraft.paymentMethod.trim()) missingFields.push("Forma de pago");
  if (!normalizedDraft.pensionRegime.trim()) missingFields.push("Régimen previsional");
  if (!normalizedDraft.increaseQuoteOnePercent.trim()) {
    missingFields.push("Aumentar cotización 1%");
  }
  if (!normalizedDraft.healthProvider.trim()) missingFields.push("Fonasa / Isapre");
  if (!normalizedDraft.afcRegime.trim()) missingFields.push("AFC");
  if (!normalizedDraft.paymentPeriod.trim()) missingFields.push("Periodo de pago");

  if (isAffirmativeBukValue(normalizedDraft.retiredStatus) && !normalizedDraft.retirementRegime.trim()) {
    missingFields.push("Régimen jubilación");
  }

  if (
    healthProviderRequiresPlan(normalizedDraft.healthProvider) &&
    !normalizedDraft.healthPlanUf.trim()
  ) {
    missingFields.push("Plan Isapre UF");
  }

  return missingFields;
}
