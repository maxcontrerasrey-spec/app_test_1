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
    currentCompanyName: string;
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

export type InternalMobilitySetupCatalogs = {
  bukJobTitles: string[];
  destinations: InternalMobilityDestination[];
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
  currentCompanyName: string;
  destinationJobTitle: string;
  destinationAreaName: string;
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
    currentCompanyName: string;
    destinationJobTitle: string;
    destinationContractId: number;
    destinationContractCode: string | null;
    destinationContractNumber: string | null;
    destinationAreaName: string;
    destinationAreaCode: string | null;
    destinationCostCenterCode: string | null;
    destinationCostCenterName: string | null;
    destinationCompanyName: string;
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
  destinationContractId: number;
  destinationJobTitle: string;
  motive: string;
  requesterSigned: boolean;
};

export type CreateInternalMobilityRequestResult = {
  requestId: string;
  folio: string;
  status: InternalMobilityRequestStatus;
  requiresTermination: boolean;
  currentCompanyName: string;
  destinationCompanyName: string;
};
