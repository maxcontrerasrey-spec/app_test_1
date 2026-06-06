export type IncentiveCalculationBasis = "fixed" | "per_hour";

export type IncentiveRequestStatus = "P" | "E" | "R" | "F" | "C";

export type HrIncentiveAllowedJobTitle = {
  id: string;
  jobTitle: string;
  isActive: boolean;
  createdAt: string;
};

export type HrIncentiveType = {
  id: string;
  code: string;
  name: string;
  calculationBasis: IncentiveCalculationBasis;
  requiresReplacement: boolean;
  isActive: boolean;
  createdAt: string;
};

export type HrIncentiveRateRule = {
  id: string;
  incentiveTypeId: string;
  incentiveTypeName: string;
  contractCode: string | null;
  jobTitle: string | null;
  amount: number;
  priority: number;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  createdAt: string;
};

export type HrIncentiveSetupCatalogs = {
  allowedJobTitles: HrIncentiveAllowedJobTitle[];
  incentiveTypes: HrIncentiveType[];
  rateRules: HrIncentiveRateRule[];
};

export type HrIncentiveEligibleWorker = {
  bukEmployeeId: string;
  fullName: string;
  documentNumber: string;
  jobTitle: string;
  contractCode: string | null;
  areaName: string | null;
  displayLabel: string;
};

export type HrIncentiveWorkerAreaOption = {
  contractCode: string | null;
  areaName: string | null;
  areaCode: string | null;
  label: string;
  isPrimary: boolean;
};

export type HrIncentiveWorkerContext = {
  worker: {
    bukEmployeeId: string;
    fullName: string;
    documentNumber: string;
    documentType: string;
    jobTitle: string;
    primaryContractCode: string | null;
    primaryAreaName: string | null;
    primaryAreaCode: string | null;
  };
  availableAreas: HrIncentiveWorkerAreaOption[];
};

export type HrIncentivePreview = {
  worker: HrIncentiveWorkerContext["worker"];
  rule: {
    rateRuleId: string;
    incentiveTypeId: string;
    incentiveTypeName: string;
    calculationBasis: IncentiveCalculationBasis;
    requiresReplacement: boolean;
    rateRuleAmount: number;
    matchedContractCode: string | null;
    matchedJobTitle: string | null;
    priority: number;
  };
  durationHours: number | null;
  serviceDate: string;
  selectedContractCode: string;
  calculatedAmount: number;
};

export type HrIncentiveRequest = {
  id: string;
  folio: number;
  employeeFullName: string;
  employeeDocumentNumber: string;
  replacementFullName: string | null;
  replacementDocumentNumber: string | null;
  motive: string | null;
  description: string | null;
  incentiveTypeName: string;
  calculatedAmount: number;
  periodCode: string;
  selectedAreaName: string;
  selectedContractCode: string;
  createdAt: string;
  serviceDate: string;
  durationHours: number | null;
  requesterName: string;
  status: IncentiveRequestStatus;
  currentFlowUser: string | null;
  cancellationComment: string | null;
};

export type HrIncentiveRequestsFilters = {
  periodCode?: string;
  status?: string;
  contractCode?: string;
  workerSearch?: string;
  typeId?: string;
  serviceDateUntil?: string;
};

export type CreateHrIncentiveRequestInput = {
  bukEmployeeId: string;
  incentiveTypeId: string;
  selectedContractCode: string;
  selectedAreaName: string;
  selectedAreaCode?: string | null;
  serviceDate: string;
  durationHours?: number | null;
  motive?: string | null;
  description?: string | null;
  replacementBukEmployeeId?: string | null;
};

export type CreateHrIncentiveRequestResult = {
  requestId: string;
  folio: number;
  status: IncentiveRequestStatus;
  calculatedAmount: number;
};
