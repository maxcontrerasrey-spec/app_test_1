export type IncentiveCalculationBasis = "fixed" | "per_hour";
export type HrIncentiveUnionStatus = "unionized" | "non_unionized" | "unknown";

export type HrIncentiveUnionStatusOption = {
  value: HrIncentiveUnionStatus;
  label: string;
};

export type HrIncentiveUnionOption = {
  value: string;
  label: string;
};

export type IncentiveRequestStatus = "P" | "E" | "R" | "F" | "C";

export type HrIncentiveApprovalDecision = "approved" | "rejected";

export type HrIncentiveApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

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
  unionName: string | null;
  unionStatus: HrIncentiveUnionStatus | null;
  amount: number;
  priority: number;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  createdAt: string;
};

export type HrIncentiveSetupCatalogs = {
  bukJobTitles: string[];
  bukUnions: HrIncentiveUnionOption[];
  bukUnionStatuses: HrIncentiveUnionStatusOption[];
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
    unionName: string | null;
    unionStatus: HrIncentiveUnionStatus;
    unionStatusLabel: string;
    unionJoinedAt: string | null;
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
    matchedUnionName: string | null;
    matchedUnionStatus: HrIncentiveUnionStatus | null;
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

export type HrIncentiveApprovalQueueItem = {
  approvalId: number;
  requestId: string;
  folio: number;
  stepCode: "contract_admin" | "area_manager";
  stepName: string;
  stepOrder: number;
  approvalStatus: HrIncentiveApprovalStatus;
  approverUserId: string | null;
  approverName: string;
  employeeFullName: string;
  employeeDocumentNumber: string;
  employeeJobTitle: string;
  employeeUnionName: string | null;
  selectedContractCode: string;
  selectedAreaName: string;
  incentiveTypeName: string;
  serviceDate: string;
  calculatedAmount: number;
  requesterName: string;
  createdAt: string;
};

export type HrIncentiveApprovalHistoryItem = {
  id: number;
  stepCode: "contract_admin" | "area_manager";
  stepName: string;
  stepOrder: number;
  approverUserId: string | null;
  approverName: string | null;
  approverEmail: string | null;
  status: HrIncentiveApprovalStatus;
  decisionBy: string | null;
  decisionComment: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type HrIncentiveRequestHistoryItem = {
  id: number;
  actionType: string;
  actorUserId: string | null;
  actorName: string | null;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type HrIncentiveRequestDetail = {
  request: {
    id: string;
    folio: number;
    status: IncentiveRequestStatus;
    employeeBukEmployeeId: string;
    employeeDocumentType: string;
    employeeDocumentNumber: string;
    employeeFullName: string;
    employeeJobTitle: string;
    employeeUnionName: string | null;
    employeeUnionStatus: HrIncentiveUnionStatus;
    employeeUnionJoinedAt: string | null;
    primaryContractCode: string | null;
    primaryAreaName: string | null;
    selectedContractCode: string;
    selectedAreaName: string;
    selectedAreaCode: string | null;
    incentiveTypeName: string;
    requiresReplacement: boolean;
    replacementBukEmployeeId: string | null;
    replacementDocumentNumber: string | null;
    replacementFullName: string | null;
    motive: string | null;
    description: string | null;
    serviceDate: string;
    durationHours: number | null;
    periodCode: string;
    calculationBasis: IncentiveCalculationBasis;
    rateRuleAmount: number;
    calculatedAmount: number;
    requesterName: string;
    requesterEmail: string | null;
    currentStepCode: "contract_admin" | "area_manager" | null;
    currentStepName: string | null;
    currentApproverName: string | null;
    cancelledAt: string | null;
    cancellationComment: string | null;
    createdAt: string;
    updatedAt: string;
  };
  approvals: HrIncentiveApprovalHistoryItem[];
  history: HrIncentiveRequestHistoryItem[];
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

export type BulkHrIncentiveApprovalDecisionResult = {
  approvalId: number;
  requestId: string | null;
  success: boolean;
  requestStatus: IncentiveRequestStatus | null;
  error: string | null;
};
