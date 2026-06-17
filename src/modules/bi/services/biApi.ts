import { supabase } from "../../../shared/lib/supabase";
import type {
  BukBiWorkforceOverview,
  BukBiHeadcountByContract,
  BukBiHeadcountByJobTitle,
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
    uniqueEmployees: Number(row.unique_employees ?? 0)
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
    uniqueEmployees: Number(row.unique_employees ?? 0)
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

export async function fetchBiWorkforceOverview(): Promise<BukBiWorkforceOverview> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("buk_bi_workforce_overview").select("*").limit(1).maybeSingle();
  
  if (error) throw error;
  if (!data) {
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
  
  return mapWorkforceOverview(data as Record<string, unknown>);
}

export async function fetchBiHeadcountByContract(): Promise<BukBiHeadcountByContract[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("buk_bi_headcount_by_contract").select("*");
  if (error) throw error;
  return (data || []).map((row) => mapHeadcountByContract(row as Record<string, unknown>));
}

export async function fetchBiHeadcountByJobTitle(): Promise<BukBiHeadcountByJobTitle[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("buk_bi_headcount_by_job_title").select("*");
  if (error) throw error;
  return (data || []).map((row) => mapHeadcountByJobTitle(row as Record<string, unknown>));
}

export async function fetchBiAgeDistribution(): Promise<BukBiAgeDistribution[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("buk_bi_age_distribution").select("*");
  if (error) throw error;
  return (data || []).map((row) => mapAgeDistribution(row as Record<string, unknown>));
}

export async function fetchBiExceptionsToday(): Promise<BukBiExceptionsToday[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("buk_bi_exceptions_today").select("*");
  if (error) throw error;
  return (data || []).map((row) => mapExceptionsToday(row as Record<string, unknown>));
}

export async function fetchBiPresenceSummaryToday(): Promise<BukBiPresenceSummaryToday[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("buk_bi_presence_summary_today").select("*");
  if (error) throw error;
  return (data || []).map((row) => mapPresenceSummaryToday(row as Record<string, unknown>));
}

export async function fetchBiExceptionsMonthly(): Promise<BukBiExceptionsMonthly[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("buk_bi_exceptions_monthly").select("*");
  if (error) throw error;
  return (data || []).map((row) => mapExceptionsMonthly(row as Record<string, unknown>));
}

export async function fetchBiVacationForecast(): Promise<BukBiVacationForecast[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("buk_bi_vacation_forecast").select("*");
  if (error) throw error;
  return (data || []).map((row) => mapVacationForecast(row as Record<string, unknown>));
}

export async function fetchBiMedicalLeaveByArea(): Promise<BukBiMedicalLeaveByArea[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("buk_bi_medical_leave_by_area").select("*");
  if (error) throw error;
  return (data || []).map((row) => mapMedicalLeaveByArea(row as Record<string, unknown>));
}

export async function fetchBiRecruitmentPipeline(): Promise<BukBiRecruitmentPipeline[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("buk_bi_recruitment_pipeline").select("*");
  if (error) throw error;
  return (data || []).map((row) => mapRecruitmentPipeline(row as Record<string, unknown>));
}

export async function fetchBiHiringVelocity(): Promise<BukBiHiringVelocity[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("buk_bi_hiring_velocity").select("*");
  if (error) throw error;
  return (data || []).map((row) => mapHiringVelocity(row as Record<string, unknown>));
}
