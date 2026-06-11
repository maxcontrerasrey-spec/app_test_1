export type InternalMobilityEligibleWorker = {
  bukEmployeeId: string;
  fullName: string;
  documentNumber: string;
  jobTitle: string;
  contractCode: string | null;
  areaName: string | null;
  companyName: string | null;
  displayLabel: string;
};

export type InternalMobilityWorkerContext = {
  worker: {
    bukEmployeeId: string;
    fullName: string;
    documentNumber: string;
    documentType: string;
    currentJobTitle: string;
    currentContractCode: string | null;
    currentAreaName: string | null;
    currentAreaCode: string | null;
    currentCompanyName: string | null;
    currentShiftName: string | null;
    matchedDestinationContractId: number | null;
    matchedDestinationContractCode: string | null;
    matchedDestinationAreaName: string | null;
    matchedDestinationCompanyName: string | null;
  };
};

export type InternalMobilityDestination = {
  contractId: number;
  contractCode: string;
  contractNumber: string;
  areaName: string;
  areaCode: string | null;
  costCenterCode: string;
  costCenterName: string;
  companyName: string;
  label: string;
};

export type InternalMobilityShiftCatalogItem = {
  id: number;
  code: string;
  name: string;
  active: boolean;
};

export type InternalMobilitySetupCatalogs = {
  bukJobTitles: string[];
  shiftCatalog: InternalMobilityShiftCatalogItem[];
  destinations: InternalMobilityDestination[];
  eligibleFolios: InternalMobilityEligibleFolio[];
};

export type InternalMobilityEligibleFolio = {
  recruitmentCaseId: string;
  hiringRequestId: string;
  folio: string | null;
  caseCode: string;
  jobPositionName: string;
  contractName: string;
  contractNumber: string | null;
  shiftName: string | null;
  costCenterCode: string;
  costCenterName: string;
  companyName: string | null;
  requestedVacancies: number;
  filledVacancies: number;
  availableVacancies: number;
  pendingMobilityCount: number;
  approvedMobilityCount: number;
  label: string;
};

export type InternalMobilityRequestStatus =
  | "pending_area_manager"
  | "pending_contracts_control"
  | "approved"
  | "rejected"
  | "closed";

export type InternalMobilityRequestSummary = {
  requestId: string;
  folio: string;
  status: InternalMobilityRequestStatus;
  requesterName: string;
  requesterEmail: string | null;
  employeeFullName: string;
  employeeDocumentNumber: string | null;
  currentJobTitle: string | null;
  currentAreaName: string | null;
  currentCompanyName: string | null;
  currentShiftName: string | null;
  destinationJobTitle: string;
  destinationAreaName: string;
  destinationShiftName: string | null;
  destinationCostCenterCode: string | null;
  destinationCostCenterName: string | null;
  destinationCompanyName: string;
  requiresTermination: boolean;
  motive: string;
  currentStepName: string | null;
  currentApproverName: string | null;
  createdAt: string;
  submittedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
};

export type InternalMobilityApprovalHistoryItem = {
  id: number;
  stepCode: string;
  stepName: string;
  stepOrder: number;
  approverUserId: string | null;
  approverName: string | null;
  approverEmail: string | null;
  status: "pending" | "approved" | "rejected";
  decisionComment: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type InternalMobilityAuditLogItem = {
  id: number;
  actionType: string;
  actorUserId: string;
  actorName: string | null;
  createdAt: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

export type InternalMobilityRequestDetail = {
  request: {
    id: string;
    folio: string;
    status: InternalMobilityRequestStatus;
    requesterName: string;
    requesterJobTitle: string | null;
    requesterEmail: string | null;
    employeeBukEmployeeId: string;
    employeeDocumentNumber: string | null;
    employeeDocumentType: string | null;
    employeeFullName: string;
    currentJobTitle: string | null;
    currentContractCode: string | null;
    currentAreaName: string | null;
    currentAreaCode: string | null;
    currentCompanyName: string | null;
    currentShiftName: string | null;
    recruitmentCaseId: string | null;
    hiringRequestId: string | null;
    recruitmentCaseCode: string | null;
    sourceFolio: string | null;
    destinationJobTitle: string;
    destinationContractId: number | null;
    destinationContractCode: string | null;
    destinationContractNumber: string | null;
    destinationAreaName: string;
    destinationAreaCode: string | null;
    destinationCostCenterCode: string | null;
    destinationCostCenterName: string | null;
    destinationCompanyName: string | null;
    destinationShiftId: number | null;
    destinationShiftName: string | null;
    requiresTermination: boolean;
    motive: string;
    currentStepCode: string | null;
    submittedAt: string;
    approvedAt: string | null;
    rejectedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  approvals: InternalMobilityApprovalHistoryItem[];
  auditLog: InternalMobilityAuditLogItem[];
};

export type CreateInternalMobilityRequestInput = {
  bukEmployeeId: string;
  recruitmentCaseId: string;
  motive: string;
  requesterSigned: boolean;
};

export type CreateInternalMobilityRequestResult = {
  requestId: string;
  folio: string;
  status: InternalMobilityRequestStatus;
  requiresTermination: boolean;
  currentCompanyName: string | null;
  destinationCompanyName: string | null;
};
