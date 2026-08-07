export type HrSanctionStatus =
  | "submitted"
  | "under_review"
  | "returned"
  | "rejected"
  | "issued"
  | "pending_signature"
  | "pending_certified_mail"
  | "pending_dt_filing"
  | "closed"
  | "expired"
  | "cancelled";

export type HrSanctionBukUploadStatus =
  | "not_ready"
  | "pending"
  | "uploaded"
  | "failed"
  | "not_applicable";

export type HrSanctionDocumentType =
  | "request_evidence"
  | "qav_report"
  | "image"
  | "video"
  | "signed_letter"
  | "signature_refusal"
  | "certified_mail_receipt"
  | "dt_filing_receipt"
  | "generated_letter"
  | "other";

export type HrSanctionCause = {
  id: string;
  code: string;
  name: string;
  description: string;
  regulatoryBasis: string;
  templateTitle: string | null;
};

export type HrSanctionMeasure = {
  id: string;
  code: string;
  name: string;
  requiresDtFiling: boolean;
  requiresCertifiedMailOnRefusal: boolean;
};

export type HrSanctionSetupCatalogs = {
  causes: HrSanctionCause[];
  measures: HrSanctionMeasure[];
};

export type HrSanctionWorker = {
  bukEmployeeId: string;
  fullName: string;
  documentNumber: string;
  documentType: string;
  jobTitle: string;
  contractCode: string | null;
  areaName: string | null;
  displayLabel: string;
};

export type CreateHrSanctionRequestInput = {
  bukEmployeeId: string;
  causeId: string;
  measureId: string;
  incidentAt: string;
  incidentPlace: string;
  equipmentNumber: string | null;
  regulatoryBasis: string | null;
  description: string;
};

export type CreateHrSanctionRequestResult = {
  requestId: string;
  folio: number;
  status: HrSanctionStatus;
  dueAt: string;
  isOutOfDeadline: boolean;
};

export type HrSanctionRequestRow = {
  id: string;
  folio: number;
  employeeBukEmployeeId: string;
  employeeFullName: string;
  employeeDocumentNumber: string;
  employeeJobTitle: string;
  employeeContractCode: string | null;
  employeeAreaName: string | null;
  incidentPlace: string;
  incidentAt: string;
  equipmentNumber: string | null;
  causeName: string;
  measureName: string;
  status: HrSanctionStatus;
  dueAt: string;
  createdAt: string;
  requesterName: string;
  bukUploadStatus: HrSanctionBukUploadStatus;
  documentsCount: number;
};

export type HrSanctionRequestsKpis = {
  total: number;
  submitted: number;
  underReview: number;
  issued: number;
  pendingSignature: number;
  closed: number;
  overdue: number;
};

export type HrSanctionRequestsPage = {
  total: number;
  kpis: HrSanctionRequestsKpis;
  rows: HrSanctionRequestRow[];
};

export type HrSanctionRequestsPageFilters = {
  status?: HrSanctionStatus | "all";
  search?: string;
  limit?: number;
  offset?: number;
};
