import { supabase } from "../../../shared/lib/supabase";
import type {
  BiFilters,
  BukBiWorkforceOverview,
  BukBiHeadcountByContract,
  BukBiHeadcountByJobTitle,
  BukBiHeadcountByCity,
  BukBiAgeDistribution,
  BukBiExceptionsToday,
  BukBiPresenceSummaryToday,
  BukBiExceptionsMonthly,
  BukBiVacationForecast,
  BukBiMedicalLeaveByArea,
  BukBiRecruitmentPipeline,
  BukBiHiringVelocity
} from "../types";

function getSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase no está configurado en este entorno.");
  }
  return supabase;
}

function normalizeBiFilters(filters?: BiFilters) {
  const periodCode = filters?.periodCode?.trim() || undefined;
  const contractCodes = filters?.contractCodes?.map((value) => value.trim()).filter(Boolean) ?? [];
  const jobTitles = filters?.jobTitles?.map((value) => value.trim()).filter(Boolean) ?? [];

  return {
    periodCode,
    contractCodes,
    jobTitles
  };
}

function buildBiRpcParams(filters?: BiFilters) {
  const normalized = normalizeBiFilters(filters);

  return {
    p_period_code: normalized.periodCode ?? null,
    p_contract_codes: normalized.contractCodes.length > 0 ? normalized.contractCodes : null,
    p_job_titles: normalized.jobTitles.length > 0 ? normalized.jobTitles : null
  };
}

// ============================================================================
// MAPPERS (Pure functions mapping Record<string, unknown> to Strict TS Interfaces)
// ============================================================================

export function mapWorkforceOverview(row: Record<string, unknown>): BukBiWorkforceOverview {
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

export function mapHeadcountByContract(row: Record<string, unknown>): BukBiHeadcountByContract {
  return {
    contractCode: String(row.contract_code ?? ""),
    areaName: String(row.area_name ?? ""),
    headcount: Number(row.headcount ?? 0),
    withBirthDate: Number(row.with_birth_date ?? 0),
    avgAge: row.avg_age != null ? Number(row.avg_age) : null
  };
}

export function mapHeadcountByJobTitle(row: Record<string, unknown>): BukBiHeadcountByJobTitle {
  return {
    contractCode: String(row.contract_code ?? ""),
    jobTitle: String(row.job_title ?? ""),
    headcount: Number(row.headcount ?? 0)
  };
}

export function mapHeadcountByCity(row: Record<string, unknown>): BukBiHeadcountByCity {
  return {
    regionName: String(row.region_name ?? ""),
    cityName: String(row.city_name ?? ""),
    headcount: Number(row.headcount ?? 0)
  };
}

export function mapAgeDistribution(row: Record<string, unknown>): BukBiAgeDistribution {
  return {
    contractCode: String(row.contract_code ?? ""),
    ageRange: String(row.age_range ?? ""),
    headcount: Number(row.headcount ?? 0)
  };
}

export function mapExceptionsToday(row: Record<string, unknown>): BukBiExceptionsToday {
  return {
    contractCode: String(row.contract_code ?? ""),
    areaName: String(row.area_name ?? ""),
    exceptionType: String(row.exception_type ?? ""),
    exceptionSource: String(row.exception_source ?? ""),
    totalPersons: Number(row.total_persons ?? 0)
  };
}

export function mapPresenceSummaryToday(row: Record<string, unknown>): BukBiPresenceSummaryToday {
  return {
    contractCode: String(row.contract_code ?? ""),
    headcount: Number(row.headcount ?? 0),
    absentToday: Number(row.absent_today ?? 0),
    presentToday: Number(row.present_today ?? 0),
    presencePct: Number(row.presence_pct ?? 0)
  };
}

export function mapExceptionsMonthly(row: Record<string, unknown>): BukBiExceptionsMonthly {
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

export function mapVacationForecast(row: Record<string, unknown>): BukBiVacationForecast {
  return {
    contractCode: String(row.contract_code ?? ""),
    exceptionDate: String(row.exception_date ?? ""),
    yearMonth: String(row.year_month ?? ""),
    vacationingEmployees: Number(row.vacationing_employees ?? 0)
  };
}

export function mapMedicalLeaveByArea(row: Record<string, unknown>): BukBiMedicalLeaveByArea {
  return {
    contractCode: String(row.contract_code ?? ""),
    areaName: String(row.area_name ?? ""),
    monthStart: String(row.month_start ?? ""),
    yearMonth: String(row.year_month ?? ""),
    medicalLeaveDays: Number(row.medical_leave_days ?? 0),
    uniqueEmployees: Number(row.unique_employees ?? 0),
    fteHeadcountEquivalent: Number(row.fte_headcount_equivalent ?? 0),
    headcountBase: Number(row.headcount_base ?? 0),
    absenteeismPct: Number(row.absenteeism_pct ?? 0)
  };
}

export function mapRecruitmentPipeline(row: Record<string, unknown>): BukBiRecruitmentPipeline {
  return {
    caseStatus: String(row.case_status ?? ""),
    stageCode: String(row.stage_code ?? ""),
    contractName: String(row.contract_name ?? ""),
    jobPositionName: String(row.job_position_name ?? ""),
    candidateCount: Number(row.candidate_count ?? 0),
    selectedCount: Number(row.selected_count ?? 0)
  };
}

export function mapHiringVelocity(row: Record<string, unknown>): BukBiHiringVelocity {
  return {
    contractName: String(row.contract_name ?? ""),
    monthStart: String(row.month_start ?? ""),
    yearMonth: String(row.year_month ?? ""),
    hiredCount: Number(row.hired_count ?? 0)
  };
}

// ============================================================================
// FETCHERS (Supabase Data Access Layer)
// ============================================================================

export async function fetchBiWorkforceOverview(filters?: BiFilters): Promise<BukBiWorkforceOverview> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_bi_workforce_overview", buildBiRpcParams(filters));

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      totalActiveEmployees: 0,
      totalContracts: 0,
      onVacationToday: 0,
      onMedicalLeaveToday: 0,
      otherAbsencesToday: 0,
      hiredThisMonth: 0,
      openRecruitmentCases: 0
    };
  }
  
  return mapWorkforceOverview(row as Record<string, unknown>);
}

export async function fetchBiHeadcountByContract(filters?: BiFilters): Promise<BukBiHeadcountByContract[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_bi_headcount_by_contract", buildBiRpcParams(filters));
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => mapHeadcountByContract(row));
}

export async function fetchBiHeadcountByJobTitle(filters?: BiFilters): Promise<BukBiHeadcountByJobTitle[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_bi_headcount_by_job_title", buildBiRpcParams(filters));
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => mapHeadcountByJobTitle(row));
}

export async function fetchBiHeadcountByCity(filters?: BiFilters): Promise<BukBiHeadcountByCity[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_bi_headcount_by_city", buildBiRpcParams(filters));
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => mapHeadcountByCity(row));
}

export async function fetchBiAgeDistribution(filters?: BiFilters): Promise<BukBiAgeDistribution[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_bi_age_distribution", buildBiRpcParams(filters));
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => mapAgeDistribution(row));
}

export async function fetchBiExceptionsToday(filters?: BiFilters): Promise<BukBiExceptionsToday[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_bi_exceptions_today", buildBiRpcParams(filters));
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => mapExceptionsToday(row));
}

export async function fetchBiPresenceSummaryToday(filters?: BiFilters): Promise<BukBiPresenceSummaryToday[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_bi_presence_summary_today", buildBiRpcParams(filters));
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => mapPresenceSummaryToday(row));
}

export async function fetchBiExceptionsMonthly(filters?: BiFilters): Promise<BukBiExceptionsMonthly[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_bi_exceptions_monthly", buildBiRpcParams(filters));
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => mapExceptionsMonthly(row));
}

export async function fetchBiVacationForecast(filters?: BiFilters): Promise<BukBiVacationForecast[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_bi_vacation_forecast", buildBiRpcParams(filters));
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => mapVacationForecast(row));
}

export async function fetchBiMedicalLeaveByArea(filters?: BiFilters): Promise<BukBiMedicalLeaveByArea[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_bi_medical_leave_by_area", buildBiRpcParams(filters));
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => mapMedicalLeaveByArea(row));
}

export async function fetchBiRecruitmentPipeline(filters?: BiFilters): Promise<BukBiRecruitmentPipeline[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_bi_recruitment_pipeline", buildBiRpcParams(filters));
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => mapRecruitmentPipeline(row));
}

export async function fetchBiHiringVelocity(filters?: BiFilters): Promise<BukBiHiringVelocity[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_bi_hiring_velocity", buildBiRpcParams(filters));
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => mapHiringVelocity(row));
}
