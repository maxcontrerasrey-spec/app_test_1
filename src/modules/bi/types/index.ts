export interface BiFilters {
  periodCode?: string;
  contractCodes?: string[];
  jobTitles?: string[];
  managementNames?: string[];
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

export interface BiLabelValueDatum {
  label: string;
  value: number;
}

export interface BiRecruitmentVacancyByContractDatum {
  label: string;
  requested: number;
  filled: number;
}

export interface BiRecruitmentDashboardSummary {
  openFolios: number;
  openCases: number;
  requestedVacancies: number;
  filledVacancies: number;
  filledHiredCandidates: number;
  filledMobilityApproved: number;
  candidatesInProgress: number;
  readyCandidates: number;
  mobilityRequests: number;
  mobilityPendingExecution: number;
  mobilityExecuted: number;
  mobilityPendingApproval: number;
}

export interface BiRecruitmentTimelineDatum {
  bucketStart: string;
  bucketLabel: string;
  openedFolios: number;
  readyCandidates: number;
  hiredCandidates: number;
  executedMobilities: number;
  requestedVacancies: number;
}

export interface BiRecruitmentDashboard {
  availableManagements: string[];
  availableContracts: string[];
  summary: BiRecruitmentDashboardSummary;
  casesByStatus: BiLabelValueDatum[];
  candidatesByStage: BiLabelValueDatum[];
  vacanciesByContract: BiRecruitmentVacancyByContractDatum[];
  mobilityByStatus: BiLabelValueDatum[];
  timeline: BiRecruitmentTimelineDatum[];
}
