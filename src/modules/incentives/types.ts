import type { BukEmployee } from "../../shared/types/buk";

export type IncentiveCalculationBasis = "fixed" | "per_hour";
export type IncentiveAmountSource = "rule" | "manual";
export type IncentiveHourRateStrategy = "rule_amount" | "buk_overtime";
export type IncentiveHourRateSource = "rule_amount" | "buk_payload" | "rule_fallback_salary";
export type HrIncentiveUnionStatus = "unionized" | "non_unionized" | "unknown";

export type HrIncentiveUnionStatusOption = {
  value: HrIncentiveUnionStatus;
  label: string;
};

export type HrIncentiveUnionOption = {
  value: string;
  label: string;
};

export type HrIncentiveFilterOption = {
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
  hourRateStrategy: IncentiveHourRateStrategy;
  requiresReplacement: boolean;
  requiresRestDay: boolean;
  allowsManualAmount: boolean;
  isActive: boolean;
  createdAt: string;
};

export type HrIncentiveRosterSnapshot = {
  baseStatus: "working" | "resting" | "unassigned" | null;
  effectiveStatus: string | null;
  exceptionType: string | null;
  exceptionLabel: string | null;
  patternName: string | null;
  scheduleStatus: string | null;
  scheduleLabel: string | null;
  isWorkingDay: boolean;
  isRestDay: boolean;
  blockedByAbsence: boolean;
};

export type HrIncentiveRosterValidation = {
  requiresRestDay: boolean;
  baseStatus: "working" | "resting" | "unassigned" | null;
  effectiveStatus: string | null;
  exceptionType: string | null;
  exceptionLabel: string | null;
  patternName: string | null;
  scheduleStatus: string | null;
  scheduleLabel: string | null;
  isRestDay: boolean | null;
  blockedByAbsence: boolean;
  blockedByExistingRestDayIncentive: boolean;
  existingRestDayRequestId: string | null;
  existingRestDayFolio: number | null;
  existingRestDayContractCode: string | null;
  existingRestDayContractName: string | null;
  existingRestDayIncentiveTypeName: string | null;
  blockReason: string | null;
  matchedDate: string | null;
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
  fallbackBaseSalary: number | null;
  fallbackWeeklyHours: number | null;
  overtimeMultiplier: number;
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
  contractOptions: HrIncentiveFilterOption[];
  allowedJobTitles: HrIncentiveAllowedJobTitle[];
  incentiveTypes: HrIncentiveType[];
  rateRules: HrIncentiveRateRule[];
};

export type HrIncentiveEligibleWorker = BukEmployee;

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
    hourRateStrategy: IncentiveHourRateStrategy;
    requiresReplacement: boolean;
    requiresRestDay: boolean;
    allowsManualAmount: boolean;
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
  amountSource: IncentiveAmountSource;
  manualAmount: number | null;
  rateSource: IncentiveHourRateSource;
  rateBaseSalary: number | null;
  rateWeeklyHours: number | null;
  rateOvertimeMultiplier: number | null;
  calculatedAmount: number;
  rosterValidation: HrIncentiveRosterValidation;
};

export type HrIncentiveRequest = {
  id: string;
  folio: number;
  employeeBukEmployeeId: string;
  employeeDocumentType: string;
  employeeFullName: string;
  employeeDocumentNumber: string;
  employeeJobTitle: string;
  employeeUnionName: string | null;
  employeeUnionStatus: HrIncentiveUnionStatus;
  employeeUnionJoinedAt: string | null;
  primaryContractCode: string | null;
  primaryAreaName: string | null;
  selectedAreaCode: string | null;
  incentiveTypeId: string;
  requiresReplacement: boolean;
  replacementBukEmployeeId: string | null;
  replacementFullName: string | null;
  replacementDocumentNumber: string | null;
  motive: string | null;
  description: string | null;
  incentiveTypeName: string;
  calculationBasis: IncentiveCalculationBasis;
  rateRuleId: string | null;
  rateRuleAmount: number;
  amountSource: IncentiveAmountSource;
  manualAmount: number | null;
  calculatedAmount: number;
  periodCode: string;
  selectedAreaName: string;
  selectedContractCode: string;
  createdAt: string;
  serviceDate: string;
  durationHours: number | null;
  createdBy: string;
  requesterName: string;
  requesterEmail: string | null;
  status: IncentiveRequestStatus;
  currentFlowUser: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationComment: string | null;
  updatedAt: string;
  entryLagDays: number;
  isOutOfDeadline: boolean;
  isContractMismatch: boolean;
  declaredRestDay: boolean | null;
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
  periodCode: string;
  entryLagDays: number;
  isOutOfDeadline: boolean;
  isContractMismatch: boolean;
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
    entryLagDays: number;
    isOutOfDeadline: boolean;
    isContractMismatch: boolean;
    calculationBasis: IncentiveCalculationBasis;
    rateRuleAmount: number;
    amountSource: IncentiveAmountSource;
    manualAmount: number | null;
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
    declaredRestDay: boolean | null;
  };
  approvals: HrIncentiveApprovalHistoryItem[];
  history: HrIncentiveRequestHistoryItem[];
};

export type HrIncentiveRequestsFilters = {
  periodCode?: string;
  status?: string | string[];
  statuses?: string[];
  contractCode?: string | string[];
  contractCodes?: string[];
  workerSearch?: string;
  typeId?: string | string[];
  typeIds?: string[];
  serviceDateUntil?: string;
};

export type HrIncentiveAnalyticsFilters = {
  periodCode?: string;
  status?: string | string[];
  statuses?: string[];
  contractCode?: string | string[];
  contractCodes?: string[];
  typeId?: string | string[];
  typeIds?: string[];
};

export type HrIncentiveAnalyticsSummaryCards = {
  totalAmount: number;
  requestCount: number;
  approvedCount: number;
  rejectedCount: number;
  approvalRate: number;
  rejectionRate: number;
  declaredRestDayCount: number;
};

export type HrIncentiveAnalyticsAmountByPeriodItem = {
  periodCode: string;
  totalAmount: number;
  requestCount: number;
  approvedAmount: number;
  rejectedAmount: number;
};

export type HrIncentiveAnalyticsCountByTypeItem = {
  incentiveTypeId: string;
  incentiveTypeName: string;
  requestCount: number;
  totalAmount: number;
};

export interface HrIncentiveAnalyticsAmountByContractItem {
  contractCode: string;
  areaName: string | null;
  totalAmount: number;
};

export type HrIncentiveAnalyticsFilterOption = HrIncentiveFilterOption;

export type HrIncentiveAnalyticsFilterOptions = {
  contracts: HrIncentiveAnalyticsFilterOption[];
  incentiveTypes: HrIncentiveAnalyticsFilterOption[];
  statuses: HrIncentiveAnalyticsFilterOption[];
};

export interface HrIncentiveAnalyticsAmountByWorkerContract {
  contractCode: string;
  contractLabel: string;
  amount: number;
}

export interface HrIncentiveAnalyticsAmountByWorkerItem {
  workerName: string;
  totalAmount: number;
  contracts: HrIncentiveAnalyticsAmountByWorkerContract[];
}

export type HrIncentiveAnalyticsPayload = {
  summaryCards: HrIncentiveAnalyticsSummaryCards;
  totalAmountByPeriod: HrIncentiveAnalyticsAmountByPeriodItem[];
  countByIncentiveType: HrIncentiveAnalyticsCountByTypeItem[];
  amountByContract: HrIncentiveAnalyticsAmountByContractItem[];
  amountByWorker: HrIncentiveAnalyticsAmountByWorkerItem[];
  filterOptions: HrIncentiveAnalyticsFilterOptions;
};

export type CreateHrIncentiveRequestInput = {
  bukEmployeeId: string;
  incentiveTypeId: string;
  selectedContractCode: string;
  selectedAreaName: string;
  selectedAreaCode?: string | null;
  serviceDate: string;
  durationHours?: number | null;
  manualAmount?: number | null;
  motive?: string | null;
  description?: string | null;
  replacementBukEmployeeId?: string | null;
  declaredRestDay: boolean;
};

export type CreateHrIncentiveRequestResult = {
  requestId: string;
  folio: number;
  status: IncentiveRequestStatus;
  calculatedAmount: number;
  periodCode: string;
  entryLagDays: number;
  isOutOfDeadline: boolean;
  isContractMismatch: boolean;
};

export type BulkHrIncentiveApprovalDecisionResult = {
  approvalId: number;
  requestId: string | null;
  success: boolean;
  requestStatus: IncentiveRequestStatus | null;
  error: string | null;
};

export type HrIncentiveRequestSortColumn =
  | "folio"
  | "trabajador"
  | "incentivo"
  | "contrato"
  | "fecha"
  | "monto"
  | "estado";

export type HrIncentiveApprovalQueueSortColumn =
  | "folio"
  | "trabajador"
  | "incentivo"
  | "contrato"
  | "fecha"
  | "monto";

export type HrIncentivePagedResult<T> = {
  items: T[];
  totalCount: number;
};

export type HrIncentiveRequestsPageFilters = HrIncentiveRequestsFilters & {
  limit?: number;
  offset?: number;
  sortColumn?: HrIncentiveRequestSortColumn | null;
  sortDirection?: "asc" | "desc";
};

export type HrIncentiveApprovalQueuePageFilters = {
  search?: string;
  limit?: number;
  offset?: number;
  sortColumn?: HrIncentiveApprovalQueueSortColumn | null;
  sortDirection?: "asc" | "desc";
};
