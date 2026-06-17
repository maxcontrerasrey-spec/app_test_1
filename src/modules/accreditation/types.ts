export type AccreditationStatus = "pending" | "approved" | "expiring_soon" | "expired";

export type AccreditationDocumentStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "rejected"
  | "expired";

export type AccreditationSite = {
  id: string;
  code: string;
  name: string;
  siteType: string;
  contractCode: string | null;
  areaCode: string | null;
  description: string | null;
  isActive: boolean;
};

export type AccreditationRequirement = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  isMandatory: boolean;
  requiresExpiryDate: boolean;
  alertDaysBeforeExpiry: number;
  blocksAccreditation: boolean;
  validityDays: number | null;
  isActive: boolean;
};

export type AccreditationMatrixRule = {
  id: string;
  siteId: string;
  siteName: string;
  requirementId: string;
  requirementName: string;
  jobTitle: string | null;
  sortOrder: number;
  notes: string | null;
  isActive: boolean;
};

export type AccreditationSetupOption = {
  value: string;
  label: string;
  description: string;
};

export type AccreditationFieldGuide = {
  key: string;
  label: string;
  required: boolean;
  source: string;
  target: string;
  description: string;
};

export type AccreditationSetupMetadata = {
  siteTypes: AccreditationSetupOption[];
  requirementCategories: AccreditationSetupOption[];
  fieldGuides: {
    site: AccreditationFieldGuide[];
    requirement: AccreditationFieldGuide[];
    matrix: AccreditationFieldGuide[];
  };
};

export type AccreditationSetupCatalogs = {
  sites: AccreditationSite[];
  requirements: AccreditationRequirement[];
  matrixRules: AccreditationMatrixRule[];
  bukJobTitles: Array<{ value: string; label: string }>;
  contractOptions: Array<{ value: string; label: string; areaCode: string | null }>;
  areaOptions: Array<{ value: string; label: string }>;
  metadata: AccreditationSetupMetadata;
};

export type AccreditationDashboardSummary = {
  totalWorkers: number;
  approved: number;
  expiringSoon: number;
  pending: number;
  expired: number;
  expiringIn7Days: number;
  expiringIn15Days: number;
  expiringIn30Days: number;
};

export type AccreditationDashboardBySite = {
  siteId: string;
  siteName: string;
  totalWorkers: number;
  approved: number;
  pending: number;
  expired: number;
  expiringSoon: number;
};

export type AccreditationExpiringWorker = {
  workerAccreditationId: string;
  bukEmployeeId: string;
  fullName: string;
  jobTitle: string | null;
  siteName: string;
  status: AccreditationStatus;
  accreditationExpiryDate: string | null;
};

export type AccreditationDashboardPayload = {
  summary: AccreditationDashboardSummary;
  bySite: AccreditationDashboardBySite[];
  expiringWorkers: AccreditationExpiringWorker[];
};

export type AccreditationWorkerRow = {
  workerAccreditationId: string | null;
  bukEmployeeId: string;
  fullName: string;
  documentNumber: string | null;
  documentType: string;
  jobTitle: string | null;
  contractCode: string | null;
  areaName: string | null;
  siteId: string | null;
  siteName: string | null;
  accreditationStatus: AccreditationStatus;
  accreditationExpiryDate: string | null;
  requiredDocumentsTotal: number;
  approvedDocumentsTotal: number;
  pendingDocumentsTotal: number;
  expiredDocumentsTotal: number;
  rosterPatternName: string | null;
  rosterStartDate: string | null;
};

export type AccreditationProfileDocument = {
  documentTrackingId: string | null;
  requirementId: string;
  requirementCode: string;
  requirementName: string;
  category: string;
  description: string | null;
  isMandatory: boolean;
  requiresExpiryDate: boolean;
  alertDaysBeforeExpiry: number;
  blocksAccreditation: boolean;
  status: AccreditationDocumentStatus;
  issueDate: string | null;
  expiryDate: string | null;
  bukDocumentId: string | null;
  bukDocumentName: string | null;
  bukDocumentUrl: string | null;
  reviewedAt: string | null;
  reviewerNotes: string | null;
  metadata: Record<string, unknown>;
};

export type AccreditationAuditEntry = {
  id: string;
  eventType: string;
  eventSummary: string;
  payload: Record<string, unknown>;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
};

export type AccreditationWorkerProfile = {
  worker: {
    workerAccreditationId: string;
    bukEmployeeId: string;
    fullName: string;
    documentNumber: string | null;
    documentType: string;
    jobTitle: string | null;
    contractCode: string | null;
    areaName: string | null;
    siteId: string;
    siteName: string;
    siteCode: string;
    accreditationStatus: AccreditationStatus;
    accreditationExpiryDate: string | null;
    requiredDocumentsTotal: number;
    approvedDocumentsTotal: number;
    pendingDocumentsTotal: number;
    expiredDocumentsTotal: number;
  };
  rosterContext: {
    patternName: string;
    patternCode: string;
    startDate: string;
    endDate: string | null;
  } | null;
  recentRosterExceptions: Array<{
    exceptionDate: string;
    exceptionType: string;
    notes: string | null;
    isActive: boolean;
  }>;
  documents: AccreditationProfileDocument[];
  auditLog: AccreditationAuditEntry[];
};
