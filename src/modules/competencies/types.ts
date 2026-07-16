export type CompetencyCatalogOption = {
  id: string;
  code: string;
  name: string;
  sortOrder?: number;
};

export type CompetencyEquipmentModel = CompetencyCatalogOption & {
  brandId: string;
  typeId: string;
  brandName: string;
  typeName: string;
};

export type CompetencyInstructor = {
  id: string;
  userId: string | null;
  fullName: string;
  documentNumber: string;
  profileCode: string;
  signatureLabel: string | null;
  status: string;
};

export type CompetencyCatalogs = {
  brands: CompetencyCatalogOption[];
  types: CompetencyCatalogOption[];
  models: CompetencyEquipmentModel[];
  instructors: CompetencyInstructor[];
  permissions: {
    canAdmin: boolean;
    canAccess: boolean;
  };
};

export type CompetencyWorker = {
  bukEmployeeId: string;
  fullName: string;
  documentNumber: string;
  documentType: string;
  jobTitle: string | null;
  areaName: string | null;
  contractCode: string | null;
  displayLabel: string;
};

export type CompetencyRequestInput = {
  workerBukEmployeeId: string;
  instructorId: string;
  modelIds: string[];
  trainingDate: string;
  trainingStartTime: string;
  trainingEndTime: string;
  trainingLocation: string;
  theoreticalScore: number;
  practicalScore: number;
  finalScore: number;
  evaluationDate: string;
  evaluationFilePath: string;
  evaluationFileName: string;
  evaluationMimeType: string;
  evaluationSizeBytes: number;
  evaluationSha256: string;
  declarationAccepted: boolean;
  notes: string;
};

export type CompetencyRequestResult = {
  requestId: string;
  certificateId: string;
  folio: string;
  verificationToken: string;
};

export type CompetencyGenerationResult = {
  success: boolean;
  alreadyGenerated?: boolean;
  folio: string;
  verificationToken?: string;
  pdfPath: string;
  pdfHash?: string;
  bukUploadStatus: "success" | "failed" | string;
  bukDocumentId?: string | null;
  bukDocumentUrl?: string | null;
  bukError?: string | null;
};

export type CompetencyDashboardRow = {
  requestId: string;
  certificateId: string;
  folio: string;
  workerFullName: string;
  workerDocumentNumber: string;
  workerJobTitle: string | null;
  workerAreaName: string | null;
  workerContractCode: string | null;
  instructorFullName: string;
  modelSummary: string;
  trainingDate: string;
  requestStatus: string;
  certificateStatus: string;
  competencyStatus: string;
  bukUploadStatus: string;
  validUntil: string | null;
  pdfPath: string | null;
  createdAt: string;
};

export type CompetencyDashboardPayload = {
  summary: {
    total: number;
    enabled: number;
    pendingBuk: number;
    expired: number;
  };
  recent: CompetencyDashboardRow[];
};

export type CompetencyEvaluationUpload = {
  path: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};
