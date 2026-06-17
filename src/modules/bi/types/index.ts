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
  jobTitle: string;
  headcount: number;
}

export interface BukBiAgeDistribution {
  contractCode: string;
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
