import type { SelectOption } from "../../../shared/ui";

export const defaultSiteForm = {
  siteId: "",
  code: "",
  name: "",
  siteType: "contract",
  contractCode: "",
  areaCode: "",
  description: ""
};

export const defaultRequirementForm = {
  requirementId: "",
  code: "",
  name: "",
  category: "general",
  description: "",
  alertDaysBeforeExpiry: "30",
  validityDays: "",
  processScope: "accreditation" as "accreditation" | "internal_license" | "both",
  requiresExpiryDate: false,
  isMandatory: true,
  blocksAccreditation: true
};

export const defaultStandardForm = {
  standardId: "",
  code: "",
  name: "",
  ownerName: "",
  description: ""
};

export const defaultStandardRequirementForm = {
  ruleId: "",
  standardId: "",
  requirementId: "",
  sortOrder: "0",
  notes: ""
};

export const defaultSiteStandardForm = {
  ruleId: "",
  siteId: "",
  standardId: "",
  notes: ""
};

export const defaultMatrixForm = {
  ruleId: "",
  siteId: "",
  requirementId: "",
  jobTitle: "",
  sortOrder: "0",
  notes: ""
};

export const fallbackSiteTypeOptions: SelectOption[] = [
  { value: "contract", label: "Contrato" },
  { value: "cost_center", label: "Centro de costo" },
  { value: "project", label: "Proyecto" },
  { value: "site", label: "Instalacion" },
  { value: "other", label: "Otro" }
];

export const fallbackRequirementCategoryOptions: SelectOption[] = [
  { value: "general", label: "General" },
  { value: "documental", label: "Documental" },
  { value: "seguridad", label: "Seguridad" },
  { value: "salud", label: "Salud" },
  { value: "operacional", label: "Operacional" },
  { value: "habilitante", label: "Habilitante" }
];

export const fallbackProcessScopeOptions: SelectOption[] = [
  { value: "accreditation", label: "Acreditacion ingreso" },
  { value: "internal_license", label: "Licencia interna" },
  { value: "both", label: "Ingreso y licencia interna" }
];
