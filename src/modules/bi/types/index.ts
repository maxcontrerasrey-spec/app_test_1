export interface BiFilters {
  periodCode?: string;
  contractCodes?: string[];
  jobTitles?: string[];
}

export interface BukBiWorkforceOverview {
  totalActiveEmployees: number;
  totalContracts: number;
  onVacationToday: number;
  onMedicalLeaveToday: number;
  otherAbsencesToday: number;
  hiredThisMonth: number;
  openRecruitmentCases: number;
}

export interface BukBiHeadcountByContract {
  contractCode: string;
  areaName: string;
  headcount: number;
  withBirthDate: number;
  avgAge: number | null;
}

export interface BukBiHeadcountByJobTitle {
  contractCode: string;
  areaName: string;
  jobTitle: string;
  headcount: number;
}

export interface BukBiHeadcountByCity {
  regionName: string;
  cityName: string;
  headcount: number;
}

export interface BukBiAgeDistribution {
  contractCode: string;
  areaName: string;
  ageRange: string;
  headcount: number;
}

export interface BukBiExceptionsToday {
  contractCode: string;
  areaName: string;
  exceptionType: string;
  exceptionSource: string;
  totalPersons: number;
}

export interface BukBiPresenceSummaryToday {
  contractCode: string;
  headcount: number;
  absentToday: number;
  presentToday: number;
  presencePct: number;
}

export interface BukBiExceptionsMonthly {
  contractCode: string;
  monthStart: string;
  yearMonth: string;
  exceptionType: string;
  exceptionSource: string;
  totalDays: number;
  uniqueEmployees: number;
  fteHeadcountEquivalent: number;
  headcountBase: number;
  absenteeismPct: number;
}

export interface BukBiVacationForecast {
  contractCode: string;
  exceptionDate: string;
  yearMonth: string;
  vacationingEmployees: number;
}

export interface BukBiMedicalLeaveByArea {
  contractCode: string;
  areaName: string;
  monthStart: string;
  yearMonth: string;
  medicalLeaveDays: number;
  uniqueEmployees: number;
  fteHeadcountEquivalent: number;
  headcountBase: number;
  absenteeismPct: number;
}

export interface BukBiRecruitmentPipeline {
  caseStatus: string;
  stageCode: string;
  contractName: string;
  jobPositionName: string;
  candidateCount: number;
  selectedCount: number;
}

export interface BukBiHiringVelocity {
  contractName: string;
  monthStart: string;
  yearMonth: string;
  hiredCount: number;
}

export interface BiLabelValueDatum {
  label: string;
  value: number;
}

export interface BiRecruitmentApprovalStepMetric {
  stepCode: string;
  stepName: string;
  totalItems: number;
  pendingItems: number;
  decidedItems: number;
  avgHours: number | null;
}

export interface BiRecruitmentApprovalOwnerMetric {
  label: string;
  totalItems: number;
  pendingItems: number;
  avgHours: number | null;
}

export interface BiRecruitmentTimelineDatum {
  bucketStart: string;
  bucketLabel: string;
  openedFolios: number;
  openedCases: number;
  hiredCandidates: number;
  submittedMobilities: number;
  approvedMobilities: number;
  executedMobilities: number;
}

export interface BukBiRecruitmentDashboardSummary {
  openFolios: number;
  openCases: number;
  requestedVacancies: number;
  candidatesInProgress: number;
  readyCandidates: number;
  hiredCandidates: number;
  pendingApprovals: number;
  avgDaysToHire: number | null;
  avgApprovalHours: number | null;
  mobilityRequests: number;
  mobilityPendingExecution: number;
  mobilityExecuted: number;
  mobilityRejected: number;
  avgMobilityApprovalHours: number | null;
  avgMobilityExecutionHours: number | null;
}

export interface BukBiRecruitmentDashboard {
  summary: BukBiRecruitmentDashboardSummary;
  casesByStatus: BiLabelValueDatum[];
  candidatesByStage: BiLabelValueDatum[];
  approvalsByStep: BiRecruitmentApprovalStepMetric[];
  approvalOwners: BiRecruitmentApprovalOwnerMetric[];
  mobilityByStatus: BiLabelValueDatum[];
  timeline: BiRecruitmentTimelineDatum[];
}
