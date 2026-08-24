import {
  asArray,
  getSupabaseClientOrThrow as getSupabaseClient
} from "../../../shared/lib/supabaseRpc";
import type {
  BiFilters,
  BukBiWorkforceOverview,
  BukBiHeadcountByContract,
  BukBiHeadcountByManagement,
  BukBiHeadcountByJobTitle,
  BukBiHeadcountByRegion,
  BukBiAgeDistribution,
  BukBiExceptionsToday,
  BukBiPresenceSummaryToday,
  BukBiExceptionsMonthly,
  BukBiRecruitmentPipeline,
  BiLabelValueDatum,
  BiRecruitmentDashboard,
  BiRecruitmentTimelineDatum,
  BiRecruitmentVacancyByContractDatum,
  BiDotacionDashboard
} from "../types";

function normalizeBiFilters(filters?: BiFilters) {
  const periodCode = filters?.periodCode?.trim() || undefined;
  const contractCodes = filters?.contractCodes?.map((value) => value.trim()).filter(Boolean) ?? [];
  const jobTitles = filters?.jobTitles?.map((value) => value.trim()).filter(Boolean) ?? [];
  const shiftNames = filters?.shiftNames?.map((value) => value.trim()).filter(Boolean) ?? [];

  return {
    periodCode,
    contractCodes,
    jobTitles,
    shiftNames,
    managementNames: filters?.managementNames?.map((value) => value.trim()).filter(Boolean) ?? []
  };
}

function buildBiRpcParams(filters?: BiFilters) {
  const normalized = normalizeBiFilters(filters);

  return {
    p_period_code: normalized.periodCode ?? null,
    p_contract_codes: normalized.contractCodes.length > 0 ? normalized.contractCodes : null,
    p_job_titles: normalized.jobTitles.length > 0 ? normalized.jobTitles : null,
    p_management_names: normalized.managementNames.length > 0 ? normalized.managementNames : null
  };
}

function mapVacancyByContract(value: unknown): BiRecruitmentVacancyByContractDatum {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    label: String(row.label ?? ""),
    requested: Number(row.requested ?? 0),
    filled: Number(row.filled ?? 0)
  };
}

function normalizeRecruitmentLabel(label: string) {
  const normalizedLabels: Record<string, string> = {
    Busqueda: "Búsqueda",
    "Examenes medicos": "Exámenes médicos",
    medical_contraindication_resolution: "Levantamiento de Contraindicación",
    "Levantamiento de Contraindicacion": "Levantamiento de Contraindicación",
    "Revision documental": "Revisión documental",
    "Pendiente ejecucion RRHH": "Pendiente ejecución RRHH"
  };

  return normalizedLabels[label] ?? label;
}

function mapRecruitmentTimeline(
  value: unknown,
  fallbackRequestedVacancies = 0
): BiRecruitmentTimelineDatum {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    bucketStart: String(row.bucketStart ?? ""),
    bucketLabel: String(row.bucketLabel ?? ""),
    openedFolios: Number(row.openedFolios ?? 0),
    readyCandidates: Number(row.readyCandidates ?? 0),
    hiredCandidates: Number(row.hiredCandidates ?? 0),
    executedMobilities: Number(row.executedMobilities ?? 0),
    requestedVacancies: Number(row.requestedVacancies ?? fallbackRequestedVacancies)
  };
}

export function mapRecruitmentDashboard(payload: unknown): BiRecruitmentDashboard {
  const row = (payload ?? {}) as Record<string, unknown>;
  const summary = (row.summary ?? {}) as Record<string, unknown>;
  const filterOptions = (row.filterOptions ?? {}) as Record<string, unknown>;
  const filledVacancies = Number(summary.filledVacancies ?? 0);
  const requestedVacancies = Number(summary.requestedVacancies ?? 0);
  const filledMobilityApproved = Number(
    summary.filledMobilityApproved ??
      Number(summary.mobilityExecuted ?? 0) + Number(summary.mobilityPendingExecution ?? 0)
  );
  const averageHiringDays =
    summary.averageHiringDays === null || summary.averageHiringDays === undefined
      ? null
      : Number(summary.averageHiringDays);

  return {
    availableManagements: Array.isArray(filterOptions.managements)
      ? filterOptions.managements.map(String)
      : [],
    availableContracts: Array.isArray(filterOptions.contracts)
      ? filterOptions.contracts.map(String)
      : [],
    availableJobs: Array.isArray(filterOptions.jobs)
      ? filterOptions.jobs.map(String)
      : [],
    availableShifts: Array.isArray(filterOptions.shifts)
      ? filterOptions.shifts.map(String)
      : [],
    summary: {
      openFolios: Number(summary.openFolios ?? 0),
      openCases: Number(summary.openCases ?? 0),
      requestedVacancies,
      filledVacancies,
      filledHiredCandidates: Number(
        summary.filledHiredCandidates ?? Math.max(filledVacancies - filledMobilityApproved, 0)
      ),
      filledMobilityApproved,
      candidatesInProgress: Number(summary.candidatesInProgress ?? 0),
      readyCandidates: Number(summary.readyCandidates ?? 0),
      averageHiringDays:
        averageHiringDays !== null && Number.isFinite(averageHiringDays)
          ? averageHiringDays
          : null,
      mobilityRequests: Number(summary.mobilityRequests ?? 0),
      mobilityPendingExecution: Number(summary.mobilityPendingExecution ?? 0),
      mobilityExecuted: Number(summary.mobilityExecuted ?? 0),
      mobilityPendingApproval: Number(summary.mobilityPendingApproval ?? 0)
    },
    casesByStatus: Array.isArray(row.casesByStatus) ? row.casesByStatus.map(mapLabelValueDatum) : [],
    candidatesByStage: Array.isArray(row.candidatesByStage)
      ? row.candidatesByStage.map(mapLabelValueDatum)
      : [],
    vacanciesByContract: Array.isArray(row.vacanciesByContract)
      ? row.vacanciesByContract.map(mapVacancyByContract)
      : [],
    mobilityByStatus: Array.isArray(row.mobilityByStatus)
      ? row.mobilityByStatus.map(mapLabelValueDatum)
      : [],
    timeline: Array.isArray(row.timeline)
      ? row.timeline.map((item) => mapRecruitmentTimeline(item, requestedVacancies))
      : []
  };
}

function mapBiDotacionDashboard(payload: unknown): BiDotacionDashboard {
  const row = (payload ?? {}) as Record<string, unknown>;
  const overviewRow = (row.overview ?? {}) as Record<string, unknown>;
  return {
    overview: mapWorkforceOverview(overviewRow),
    headcountByContract: asArray<Record<string, unknown>>(row.headcountByContract).map(mapHeadcountByContract),
    headcountByManagement: asArray<Record<string, unknown>>(row.headcountByManagement).map(mapHeadcountByManagement),
    headcountByRegion: asArray<Record<string, unknown>>(row.headcountByRegion).map(mapHeadcountByRegion),
    ageDistribution: asArray<Record<string, unknown>>(row.ageDistribution).map(mapAgeDistribution),
    exceptionsToday: asArray<Record<string, unknown>>(row.exceptionsToday).map(mapExceptionsToday),
    presenceSummaryToday: asArray<Record<string, unknown>>(row.presenceSummaryToday).map(mapPresenceSummaryToday),
    exceptionsMonthly: asArray<Record<string, unknown>>(row.exceptionsMonthly).map(mapExceptionsMonthly),
    recruitmentPipeline: asArray<Record<string, unknown>>(row.recruitmentPipeline).map(mapRecruitmentPipeline)
  };
}

// ============================================================================
// MAPPERS (Pure functions mapping Record<string, unknown> to Strict TS Interfaces)
// ============================================================================

function mapWorkforceOverview(row: Record<string, unknown>): BukBiWorkforceOverview {
  return {
    totalActiveEmployees: Number(row.total_active_employees ?? 0),
    totalContracts: Number(row.total_contracts ?? 0),
    onVacationToday: Number(row.on_vacation_today ?? 0),
    onMedicalLeaveToday: Number(row.on_medical_leave_today ?? 0),
    otherAbsencesToday: Number(row.other_absences_today ?? 0),
    hiredThisMonth: Number(row.hired_this_month ?? 0),
    openRecruitmentCases: Number(row.open_recruitment_cases ?? 0)
  };
}

function mapHeadcountByContract(row: Record<string, unknown>): BukBiHeadcountByContract {
  return {
    contractCode: String(row.contract_code ?? ""),
    areaName: String(row.area_name ?? ""),
    headcount: Number(row.headcount ?? 0),
    withBirthDate: Number(row.with_birth_date ?? 0),
    avgAge: row.avg_age != null ? Number(row.avg_age) : null
  };
}

function mapHeadcountByManagement(row: Record<string, unknown>): BukBiHeadcountByManagement {
  return {
    managementName: String(row.management_name ?? "SIN GERENCIA"),
    headcount: Number(row.headcount ?? 0)
  };
}

function mapHeadcountByJobTitle(row: Record<string, unknown>): BukBiHeadcountByJobTitle {
  return {
    contractCode: String(row.contract_code ?? ""),
    areaName: String(row.area_name ?? ""),
    jobTitle: String(row.job_title ?? ""),
    headcount: Number(row.headcount ?? 0)
  };
}

function mapHeadcountByRegion(row: Record<string, unknown>): BukBiHeadcountByRegion {
  return {
    regionName: String(row.region_name ?? "SIN REGION"),
    headcount: Number(row.headcount ?? 0)
  };
}

function mapAgeDistribution(row: Record<string, unknown>): BukBiAgeDistribution {
  return {
    contractCode: String(row.contract_code ?? ""),
    areaName: String(row.area_name ?? ""),
    ageRange: String(row.age_range ?? ""),
    headcount: Number(row.headcount ?? 0)
  };
}

function mapExceptionsToday(row: Record<string, unknown>): BukBiExceptionsToday {
  return {
    contractCode: String(row.contract_code ?? ""),
    areaName: String(row.area_name ?? ""),
    exceptionType: String(row.exception_type ?? ""),
    exceptionSource: String(row.exception_source ?? ""),
    totalPersons: Number(row.total_persons ?? 0)
  };
}

function mapPresenceSummaryToday(row: Record<string, unknown>): BukBiPresenceSummaryToday {
  return {
    contractCode: String(row.contract_code ?? ""),
    headcount: Number(row.headcount ?? 0),
    absentToday: Number(row.absent_today ?? 0),
    presentToday: Number(row.present_today ?? 0),
    presencePct: Number(row.presence_pct ?? 0)
  };
}

function mapExceptionsMonthly(row: Record<string, unknown>): BukBiExceptionsMonthly {
  return {
    contractCode: String(row.contract_code ?? ""),
    monthStart: String(row.month_start ?? ""),
    yearMonth: String(row.year_month ?? ""),
    exceptionType: String(row.exception_type ?? ""),
    exceptionSource: String(row.exception_source ?? ""),
    totalDays: Number(row.total_days ?? 0),
    uniqueEmployees: Number(row.unique_employees ?? 0),
    fteHeadcountEquivalent: Number(row.fte_headcount_equivalent ?? 0),
    headcountBase: Number(row.headcount_base ?? 0),
    absenteeismPct: Number(row.absenteeism_pct ?? 0)
  };
}

function mapRecruitmentPipeline(row: Record<string, unknown>): BukBiRecruitmentPipeline {
  return {
    caseStatus: String(row.case_status ?? ""),
    stageCode: String(row.stage_code ?? ""),
    contractName: String(row.contract_name ?? ""),
    jobPositionName: String(row.job_position_name ?? ""),
    candidateCount: Number(row.candidate_count ?? 0),
    selectedCount: Number(row.selected_count ?? 0)
  };
}

function mapLabelValueDatum(value: unknown): BiLabelValueDatum {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    label: normalizeRecruitmentLabel(String(row.label ?? "")),
    value: Number(row.value ?? 0)
  };
}

// ============================================================================
// FETCHERS (Supabase Data Access Layer)
// ============================================================================

export async function fetchBiDotacionDashboard(filters?: BiFilters): Promise<BiDotacionDashboard> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_bi_dotacion_dashboard", buildBiRpcParams(filters));
  if (error) throw error;
  return mapBiDotacionDashboard(data);
}

export async function fetchBiHeadcountByContract(filters?: BiFilters): Promise<BukBiHeadcountByContract[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_bi_headcount_by_contract", buildBiRpcParams(filters));
  if (error) throw error;
  return asArray<Record<string, unknown>>(data).map((row) => mapHeadcountByContract(row));
}

export async function fetchBiHeadcountByJobTitle(filters?: BiFilters): Promise<BukBiHeadcountByJobTitle[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_bi_headcount_by_job_title", buildBiRpcParams(filters));
  if (error) throw error;
  return asArray<Record<string, unknown>>(data).map((row) => mapHeadcountByJobTitle(row));
}

export async function fetchBiRecruitmentDashboard(filters?: BiFilters): Promise<BiRecruitmentDashboard> {
  const client = getSupabaseClient();
  const normalized = normalizeBiFilters(filters);
  const recruitmentParams = {
    p_period_code: normalized.periodCode ?? null,
    p_management_names:
      normalized.managementNames.length > 0 ? normalized.managementNames : null,
    p_contract_names: normalized.contractCodes.length > 0 ? normalized.contractCodes : null,
    p_job_position_names: normalized.jobTitles.length > 0 ? normalized.jobTitles : null,
    p_shift_names: normalized.shiftNames.length > 0 ? normalized.shiftNames : null
  };
  const [dashboardResponse, dailyTimelineResponse] = await Promise.all([
    client.rpc("get_bi_recruitment_dashboard", recruitmentParams),
    client.rpc("get_bi_recruitment_daily_timeline", recruitmentParams)
  ]);

  if (dashboardResponse.error) throw dashboardResponse.error;

  const dashboard = mapRecruitmentDashboard(dashboardResponse.data);
  const { data: dailyTimelineData, error: dailyTimelineError } = dailyTimelineResponse;

  if (!dailyTimelineError && Array.isArray(dailyTimelineData)) {
    return {
      ...dashboard,
      timeline: dailyTimelineData.map((item) =>
        mapRecruitmentTimeline(item, dashboard.summary.requestedVacancies)
      )
    };
  }

  return dashboard;
}
